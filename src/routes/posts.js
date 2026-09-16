const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const { requirePostOwner } = require('../middleware/postOwnership');

const PER_PAGE = 5;

// ── helper: "2 days ago" ──
function timeAgo(date) {
  const sec = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + (min === 1 ? ' minute ago' : ' minutes ago');
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + (hr === 1 ? ' hour ago' : ' hours ago');
  const day = Math.floor(hr / 24);
  if (day < 30) return day + (day === 1 ? ' day ago' : ' days ago');
  const mo = Math.floor(day / 30);
  if (mo < 12) return mo + (mo === 1 ? ' month ago' : ' months ago');
  return Math.floor(mo / 12) + ' year(s) ago';
}

// ── helper: "Alex M." ──
function shortName(author) {
  if (!author || !author.firstName) return 'SkillLoop User';
  const last = author.lastName ? ' ' + author.lastName.charAt(0).toUpperCase() + '.' : '';
  return author.firstName + last;
}

// GET /posts — browse all posts (search + filter + pagination)
router.get('/', async (req, res) => {
  try {
    const q      = (req.query.q || '').trim();
    const type   = (req.query.type || '').trim();
    const skill  = (req.query.skill || '').trim();
    const mine   = req.query.mine === '1';
    const page   = Math.max(1, parseInt(req.query.page) || 1);

    // Build query
    const query = { status: { $ne: 'deleted' } };
    if (mine) query.author = req.user.id;
    if (type) query.type = type;
    if (skill) query.skills = { $regex: new RegExp('^' + skill + '$', 'i') };
    if (q) {
      query.$or = [
        { title:       { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
        { skills:      { $regex: q, $options: 'i' } },
      ];
    }

    const total = await Post.countDocuments(query);
    const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

    const raw = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PER_PAGE)
      .limit(PER_PAGE)
      .populate('author', 'firstName lastName')
      .lean();

    const posts = raw.map(p => ({
      ...p,
      timeAgo: timeAgo(p.createdAt),
      authorName: shortName(p.author),
      isMine: p.author && p.author._id.toString() === req.user.id,
    }));

    // Popular skills for the filter chips
    const skillAgg = await Post.aggregate([
      { $match: { status: 'open' } },
      { $unwind: '$skills' },
      { $group: { _id: '$skills', n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 5 },
    ]);
    const topSkills = skillAgg.map(s => s._id);

    res.render('posts/list', {
      posts,
      q, type, skill, mine,
      page, totalPages, total,
      topSkills,
    });
  } catch (err) {
    console.error('Posts list error:', err);
    res.status(500).json({ error: 'Failed to load posts' });
  }
});

// GET /posts/create
router.get('/create', (req, res) => {
  res.render('posts/create', { error: null });
});

// POST /posts/create
router.post('/create', async (req, res) => {
  try {
    const { type, title, description, skills, availability } = req.body;
    if (!type || !title || !description) {
      return res.render('posts/create', {
          error: 'Type, title and description are required.'
      });
    }
    const skillsArray = skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [];
    await Post.create({
      type, title, description,
      skills: skillsArray,
      availability: availability || '',
      author: req.user.id,
    });
    res.redirect('/posts?mine=1');
  } catch (err) {
    console.error(err);
    res.render('posts/create', { error: 'Failed to create post.' });
  }
});

// GET /posts/:id/edit — edit form (owner only)
router.get('/:id/edit', requirePostOwner, (req, res) => {
  res.render('posts/edit', {
    post: req.post,
    error: null,
  });
});

// POST /posts/:id/edit — save changes (owner only)
router.post('/:id/edit', requirePostOwner, async (req, res) => {
  const { type, title, description, skills, availability } = req.body;

  try {

    if (!type || !title || !description) {
      return res.render('posts/edit', {
          post: { ...req.post, type, title, description, skills: (skills || '').split(',').map(s => s.trim()).filter(Boolean), availability },
        error: 'Type, title and description are required.'
      });
    }

    await Post.findByIdAndUpdate(
      req.post._id,
      {
        type,
        title,
        description,
        skills: skills ? skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        availability: availability || '',
      }
    );

    res.redirect('/posts?mine=1');
  } catch (err) {
    console.error('Edit save error:', err);
    res.redirect('/posts?mine=1');
  }
});

// POST /posts/:id/delete
router.post('/:id/delete', requirePostOwner, async (req, res) => {
  try {
    await Post.findByIdAndUpdate(
      req.post._id,
      { status: 'deleted' }
    );
    res.redirect(req.get('referer') || '/posts');
  } catch (err) {
    res.redirect('/posts');
  }
});

// POST /posts/:id/resolve
router.post('/:id/resolve', requirePostOwner, async (req, res) => {
  try {
    await Post.findByIdAndUpdate(
      req.post._id,
      { status: 'resolved' }
    );
    res.redirect(req.get('referer') || '/posts');
  } catch (err) {
    res.redirect('/posts');
  }
});

// ── GET /posts/:id — post detail with comments (must stay last) ──
router.get('/:id', async (req, res, next) => {
  try {
    const Comment = require('../models/Comment');

    const raw = await Post.findOne({
      _id: req.params.id,
      status: { $ne: 'deleted' }
    }).populate('author', 'firstName lastName school rating avatar').lean();

    if (!raw) return res.redirect('/browse');

    const post = {
      ...raw,
      timeAgo: timeAgo(raw.createdAt),
      authorName: shortName(raw.author),
    };
    const isOwner = raw.author && raw.author._id.toString() === req.user.id;

    const all = await Comment.find({ post: raw._id, status: 'active' })
      .sort({ createdAt: 1 })
      .populate('author', 'firstName lastName')
      .lean();

    const decorate = c => ({
      ...c,
      timeAgo: timeAgo(c.createdAt),
      authorName: shortName(c.author),
      isMine: c.author && c.author._id.toString() === req.user.id,
    });

    const tops = all.filter(c => !c.parent).map(c => ({ ...decorate(c), replies: [] }));
    const byId = {};
    tops.forEach(t => { byId[t._id.toString()] = t; });
    all.filter(c => c.parent).forEach(r => {
      const parent = byId[r.parent.toString()];
      if (parent) parent.replies.push(decorate(r));
    });

    res.render('posts/detail', {
      post, isOwner, comments: tops, commentCount: all.length,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /posts/:id/comments — add a comment or reply ──
router.post('/:id/comments', async (req, res, next) => {
  try {
    const Comment = require('../models/Comment');
    const body = (req.body.body || '').trim();
    const parent = req.body.parent || null;

    if (body) {
      const post = await Post.findOne({ _id: req.params.id, status: { $ne: 'deleted' } }).lean();
      if (post) {
        await Comment.create({
          post: post._id,
          author: req.user.id,
          body,
          parent: parent || null,
        });
      }
    }
    res.redirect('/posts/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

// ── POST /posts/comments/:cid/delete — soft-delete own comment ──
router.post('/comments/:cid/delete', async (req, res, next) => {
  try {
    const Comment = require('../models/Comment');
    const c = await Comment.findOneAndUpdate(
      { _id: req.params.cid, author: req.user.id },
      { status: 'deleted' }
    ).lean();
    res.redirect(c ? '/posts/' + c.post : '/browse');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.timeAgo = timeAgo;
module.exports.shortName = shortName;
