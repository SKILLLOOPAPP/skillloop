const express = require('express');

const router = express.Router();
const Post = require('../models/Post');

// GET /api/posts?search=keyword
router.get('/', async (req, res) => {
  try {
    const search = (req.query.search || '').trim();

    const query = {
      status: { $ne: 'deleted' }
    };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { skills: { $regex: search, $options: 'i' } }
      ];
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.status(200).json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Failed to search posts'
    });
  }
});

module.exports = router;