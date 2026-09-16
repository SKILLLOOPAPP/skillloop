const mongoose = require('mongoose');
const Post = require('../models/Post');

/**
 * Middleware that ensures the authenticated user owns the requested post.
 *
 * The post is loaded once and attached to req.post so that protected
 * route handlers do not need to repeat the ownership lookup.
 */
async function requirePostOwner(req, res, next) {
  try {
    const postId = req.params.id;

    // Prevent invalid MongoDB ObjectId values from causing a database error
    if (!mongoose.isValidObjectId(postId)) {
      return res.status(404).send('Post not found');
    }

    // Deleted posts should no longer be modifiable
    const post = await Post.findOne({
      _id: postId,
      status: { $ne: 'deleted' },
    }).lean();

    if (!post) {
      return res.status(404).send('Post not found');
    }

    // The logged-in user must be the author of the post
    if (!req.user || post.author.toString() !== req.user.id.toString()) {
      return res
        .status(403)
        .send('You do not have permission to modify this post');
    }

    // Make the verified post available to the next route handler
    req.post = post;

    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requirePostOwner,
};