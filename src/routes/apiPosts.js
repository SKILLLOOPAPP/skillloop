const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const Post = require('../models/Post');

// ============================================================
// UC4-6
// GET /api/posts/:id
// Fetch a single SkillLoop post by MongoDB ID
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID'
      });
    }

    // Find post but do not expose soft-deleted posts
    const post = await Post.findOne({
      _id: id,
      status: { $ne: 'deleted' }
    })
      .populate(
        'author',
        'firstName lastName school rating avatar'
      )
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    return res.status(200).json({
      success: true,
      post: {
        id: post._id,
        type: post.type,
        title: post.title,
        description: post.description,
        skills: post.skills,
        availability: post.availability,
        status: post.status,
        author: post.author,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      }
    });

  } catch (error) {
    console.error('GET /api/posts/:id error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch post'
    });
  }
});

module.exports = router;