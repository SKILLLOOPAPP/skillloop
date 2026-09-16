const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const User = require('../models/User');

// Fields safe to expose on a user's public profile.
// Deliberately excludes password and email — SRS §3.3 data minimisation.
const PUBLIC_FIELDS = 'firstName lastName bio expertise school avatar rating';

function toPublicProfile(user) {
  return {
    id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    bio: user.bio || '',
    expertise: user.expertise || [],
    school: user.school,
    avatar: user.avatar,
    rating: user.rating,
  };
}

// ============================================================
// UC11-81
// GET /api/users/:id
// Return a user's public profile.
// ============================================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    const user = await User.findById(id).select(PUBLIC_FIELDS).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: toPublicProfile(user),
    });
  } catch (error) {
    console.error('GET /api/users/:id error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load profile',
    });
  }
});

// ============================================================
// UC11
// PUT /api/users/:id
// Update the caller's own profile. A user may only update themselves.
// ============================================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    if (id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You can only update your own profile',
      });
    }

    const { firstName, lastName, school, bio, avatar, expertise, lookingToLearn } = req.body;
    const updates = {};

    if (firstName !== undefined) {
      if (!firstName.trim()) {
        return res.status(400).json({
          success: false,
          message: 'First name cannot be empty',
        });
      }
      updates.firstName = firstName.trim();
    }
    if (lastName !== undefined) updates.lastName = lastName.trim();
    if (school !== undefined) updates.school = school.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (avatar !== undefined) updates.avatar = avatar.trim() || null;
    if (expertise !== undefined) updates.expertise = expertise;
    if (lookingToLearn !== undefined) updates.lookingToLearn = lookingToLearn;

    const updated = await User.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).select(PUBLIC_FIELDS);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: toPublicProfile(updated),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    console.error('PUT /api/users/:id error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
});

module.exports = router;
