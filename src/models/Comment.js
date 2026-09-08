const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  body: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000,
  },
  // null = top-level comment; set = reply to that comment
  parent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'deleted'],
    default: 'active',
  },
}, { timestamps: true });

commentSchema.index({ post: 1, parent: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', commentSchema);
