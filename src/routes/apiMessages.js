const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Post = require('../models/Post');

// ============================================================
// UC9
// POST /api/messages
// Send a message tied to a SkillLoop post
// ============================================================
router.post('/', async (req, res) => {
  try {
    const senderId = req.user.id;
    const { postId, content } = req.body;

    // Validate required fields
    if (!postId || !content || !content.trim()) {
      return res.status(400).json({
        success: false,
        message: 'postId and message content are required'
      });
    }

    // Validate post ID
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid post ID'
      });
    }

    // Find the post
    const post = await Post.findOne({
      _id: postId,
      status: { $ne: 'deleted' }
    }).lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Message is sent to the author of the post
    const recipientId = post.author.toString();

    // Prevent users messaging themselves through their own post
    if (recipientId === senderId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot send a message to your own post'
      });
    }

    const senderObjectId = new mongoose.Types.ObjectId(senderId);
    const recipientObjectId = new mongoose.Types.ObjectId(recipientId);

    // Find an existing conversation for these users + this post
    const candidates = await Conversation.find({
      participants: {
        $all: [senderObjectId, recipientObjectId]
      },
      post: post._id
    }).sort({ createdAt: 1 });

    let conversation = candidates.find(
      c => (c.participants || []).length === 2
    );

    // Create conversation if one does not already exist
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recipientId],
        post: post._id
      });
    }

    // Create the message
    const message = await Message.create({
      conversation: conversation._id,
      sender: senderId,
      content: content.trim(),
      readBy: [senderId]
    });

    // Update conversation preview
    conversation.lastMessage = message.content.slice(0, 120);
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    return res.status(201).json({
      success: true,
      message: {
        id: message._id,
        conversationId: conversation._id,
        postId: post._id,
        senderId,
        recipientId,
        content: message.content,
        createdAt: message.createdAt
      }
    });

  } catch (error) {
    console.error('POST /api/messages error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

module.exports = router;