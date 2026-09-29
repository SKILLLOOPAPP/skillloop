const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
 
// how many recent candidate posts to score / how many to return
const CANDIDATE_LIMIT = 50;
const RESULT_LIMIT = 6;
 
const normalise = (s) => String(s).trim().toLowerCase();
 
// Score a post against the user's skills:
// +2 for every post skill that exactly matches a user skill,
// +1 for every user skill that appears in the post title.
function scorePost(post, skillSet) {
  const postSkills = (post.skills || []).map(normalise);
  let score = postSkills.filter((s) => skillSet.has(s)).length * 2;
 
  const title = normalise(post.title || '');
  skillSet.forEach((skill) => {
    if (title.includes(skill)) score += 1;
  });
 
  return score;
}
 
// Core matching logic — used by both the /api/match route and the dashboard page,
// so there's one source of truth instead of two separate queries.
async function getSuggestionsForUser(userId) {
  const user = await User.findById(userId).select('expertise').lean();
  const userSkills = (user && Array.isArray(user.expertise))
    ? user.expertise.map((e) => (typeof e === 'string' ? e : e.skill)).filter(Boolean).map(normalise)
    : [];
 
  // Open posts by other users, newest first
  const candidates = await Post.find({
    status: 'open',
    author: { $ne: userId },
  })
    .sort({ createdAt: -1 })
    .limit(CANDIDATE_LIMIT)
    .select('_id type title skills author createdAt')
    .populate('author', 'firstName lastName')
    .lean();
 
  if (!userSkills.length || !candidates.length) {
    return { suggestions: candidates.slice(0, RESULT_LIMIT), source: 'fallback', reason: 'no_data' };
  }
 
  const skillSet = new Set(userSkills);
 
  // Keep posts with at least one skill overlap, highest score first.
  // Array.sort is stable, so ties stay in newest-first order.
  const ranked = candidates
    .map((post) => ({ post, score: scorePost(post, skillSet) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, RESULT_LIMIT)
    .map((r) => r.post);
 
  if (!ranked.length) {
    return { suggestions: candidates.slice(0, RESULT_LIMIT), source: 'fallback', reason: 'no_skill_match' };
  }
 
  return { suggestions: ranked, source: 'skills' };
}
 
// GET /api/match — skill-matched posts for the logged-in user (used for on-demand refresh, e.g. AJAX)
router.get('/match', async (req, res) => {
  try {
    const result = await getSuggestionsForUser(req.user.id);
    res.json(result);
  } catch (err) {
    console.error('Match route error:', err);
    res.status(500).json({ suggestions: [], source: 'error', error: 'Failed to load suggestions' });
  }
});
 
module.exports = router;
module.exports.getSuggestionsForUser = getSuggestionsForUser;
 
