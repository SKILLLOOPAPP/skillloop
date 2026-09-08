const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Post = require('../models/Post');

// "JavaScript, React" -> [{ skill: 'JavaScript' }, { skill: 'React' }]
function parseSkills(str, extraKey, extraVal) {
  if (!str) return [];
  return str
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map(skill => {
      const o = { skill };
      if (extraKey) o[extraKey] = extraVal;
      return o;
    });
}

// GET /profile — view own profile
router.get('/', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.redirect('/signin');

    const posts = await Post.countDocuments({
      author: user._id,
      status: { $ne: 'deleted' },
    });

    const stats = {
      posts,
      connections: (user.followers || []).length,
      rating: user.rating && user.rating.average
        ? user.rating.average.toFixed(1)
        : '—',
      reviews: (user.rating && user.rating.count) || 0,
    };

    res.render('profile/profile', { user, stats });
  } catch (err) {
    next(err);
  }
});

// GET /profile/edit
router.get('/edit', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.redirect('/signin');
    res.render('profile/edit', { user, error: null, success: null });
  } catch (err) {
    next(err);
  }
});

// POST /profile/edit
router.post('/edit', async (req, res, next) => {
  try {
    const { firstName, lastName, school, bio, expertise, lookingToLearn, avatar } = req.body;

    if (!firstName || !firstName.trim()) {
      const user = await User.findById(req.user.id).lean();
      return res.render('profile/edit', {
        user: { ...user, ...req.body },
        error: 'First name is required.',
        success: null,
      });
    }

    await User.findByIdAndUpdate(req.user.id, {
      firstName: firstName.trim(),
      lastName: (lastName || '').trim(),
      school: (school || '').trim() || 'SkillLoop User',
      bio: (bio || '').trim(),
      expertise: parseSkills(expertise, 'level', 'intermediate'),
      lookingToLearn: parseSkills(lookingToLearn, 'priority', 'medium'),
      avatar: (avatar || '').trim() || null,
    }, { runValidators: true });

    res.redirect('/profile');
  } catch (err) {
    console.error('Profile save error:', err);
    try {
      const user = await User.findById(req.user.id).lean();
      res.render('profile/edit', {
        user: { ...user, ...req.body },
        error: 'Could not save your profile. Please check the fields and try again.',
        success: null,
      });
    } catch (e) { next(err); }
  }
});

// GET /profile/settings
router.get('/settings', async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).lean();
    if (!user) return res.redirect('/signin');
    res.render('profile/settings', { user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
