const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const User = require('../models/User');

// Fields safe to expose on a user's public profile.
// Deliberately excludes password and email — SRS §3.3 data minimisation.
const PUBLIC_FIELDS = 'firstName lastName bio expertise school avatar rating';

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
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        bio: user.bio || '',
        expertise: user.expertise || [],
        school: user.school,
        avatar: user.avatar,
        rating: user.rating,
      },
    });
  } catch (error) {
    console.error('GET /api/users/:id error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load profile',
    });
  }
});

module.exports = router;
