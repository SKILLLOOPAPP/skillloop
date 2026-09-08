const mongoose = require('mongoose');

/**
 * A moderation report raised by one user against a post or another user.
 * Covers UC12 (report a post / report a user / moderator review).
 */
const reportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },

  // What is being reported — exactly one of post / reportedUser is set.
  targetType: {
    type: String,
    enum: ['post', 'user'],
    required: true,
  },
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    default: null,
  },
  reportedUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  reason: {
    type: String,
    enum: ['spam', 'harassment', 'inappropriate', 'scam', 'misleading', 'other'],
    required: true,
  },
  details: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: '',
  },

  // Moderation workflow
  status: {
    type: String,
    enum: ['pending', 'actioned', 'dismissed'],
    default: 'pending',
  },
  moderator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  moderatorNote: {
    type: String,
    trim: true,
    maxlength: 500,
    default: '',
  },
  reviewedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Queue lookups: newest pending first.
reportSchema.index({ status: 1, createdAt: -1 });

// One open report per reporter per target — stops report spam.
reportSchema.index(
  { reporter: 1, post: 1 },
  { unique: true, partialFilterExpression: { targetType: 'post', status: 'pending' } }
);
reportSchema.index(
  { reporter: 1, reportedUser: 1 },
  { unique: true, partialFilterExpression: { targetType: 'user', status: 'pending' } }
);

// Guard: the target must match the declared targetType.
reportSchema.pre('validate', function (next) {
  if (this.targetType === 'post' && !this.post) {
    return next(new Error('A post report must reference a post.'));
  }
  if (this.targetType === 'user' && !this.reportedUser) {
    return next(new Error('A user report must reference a user.'));
  }
  next();
});

module.exports = mongoose.model('Report', reportSchema);
