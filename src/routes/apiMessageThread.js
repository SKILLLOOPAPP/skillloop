const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

// GET /api/messages/:postId
router.get('/:postId', async (req, res) => {
  try {
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID'
      });
    }

    const conversation = await Conversation.findOne({
      post: postId,
      participants: req.user.id
    }).lean();

    if (!conversation) {
      return res.status(200).json({
        success: true,
        messages: []
      });
    }

    const messages = await Message.find({
      conversation: conversation._id
    })
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      conversationId: conversation._id,
      messages
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
});

module.exports = router;