const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();
const User = require('../models/User');

// Fields safe to expose on a user's public profile.
// Deliberately excludes password and email — SRS §3.3 data minimisation.
const PUBLIC_FIELDS = 'firstName lastName bio expertise school avatar rating';

// ── Validation rules ────────────────────────────────────────────────────────
// Only these fields may ever be written by this endpoint. Anything else in the
// body (email, password, rating, accountStatus, ...) is ignored, not rejected.
const TEXT_FIELDS = {
  firstName: { label: 'First name', max: 60 },
  lastName: { label: 'Last name', max: 60 },
  school: { label: 'School', max: 120 },
  bio: { label: 'Bio', max: 500 },
  avatar: { label: 'Avatar URL', max: 500 },
};
const SKILL_FIELDS = {
  expertise: { label: 'Expertise', key: 'level', allowed: ['beginner', 'intermediate', 'advanced', 'expert'], fallback: 'intermediate' },
  lookingToLearn: { label: 'Looking to learn', key: 'priority', allowed: ['low', 'medium', 'high'], fallback: 'medium' },
};
const MAX_SKILLS = 20;
const SCHOOL_DEFAULT = 'SkillLoop User';

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

// An avatar is either blank or a web URL / site-relative path.
function isValidAvatar(value) {
  return /^(https?:\/\/|\/)\S+$/.test(value);
}

// Accepts either "JavaScript, React" or [{ skill, level }] / ["JavaScript"] and
// returns the array shape the User schema stores. Returns null if the value is
// not a usable type, so the caller can answer 400 rather than saving junk.
function normaliseSkills(value, rule) {
  let items;

  if (typeof value === 'string') {
    items = value.split(',').map(skill => ({ skill }));
  } else if (Array.isArray(value)) {
    items = [];
    for (const item of value) {
      if (typeof item === 'string') {
        items.push({ skill: item });
      } else if (item && typeof item === 'object' && typeof item.skill === 'string') {
        items.push(item);
      } else {
        return null;
      }
    }
  } else {
    return null;
  }

  return items
    .map(item => ({ ...item, skill: item.skill.trim() }))
    .filter(item => item.skill)
    .slice(0, MAX_SKILLS)
    .map(item => ({
      skill: item.skill,
      [rule.key]: rule.allowed.includes(item[rule.key]) ? item[rule.key] : rule.fallback,
    }));
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
// UC11 / T083
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

    const body = req.body || {};
    const updates = {};

    // ── Text fields: must be text, must fit the field's limit ──
    for (const [field, rule] of Object.entries(TEXT_FIELDS)) {
      if (body[field] === undefined) continue;

      if (typeof body[field] !== 'string') {
        return res.status(400).json({
          success: false,
          message: `${rule.label} must be text`,
        });
      }

      const value = body[field].trim();

      if (value.length > rule.max) {
        return res.status(400).json({
          success: false,
          message: `${rule.label} must be ${rule.max} characters or fewer`,
        });
      }

      updates[field] = value;
    }

    if (updates.firstName !== undefined && !updates.firstName) {
      return res.status(400).json({
        success: false,
        message: 'First name cannot be empty',
      });
    }

    if (updates.avatar) {
      if (!isValidAvatar(updates.avatar)) {
        return res.status(400).json({
          success: false,
          message: 'Avatar URL must start with http://, https:// or /',
        });
      }
    } else if (updates.avatar !== undefined) {
      updates.avatar = null;
    }

    // Blank school falls back to the schema default, matching POST /profile/edit.
    if (updates.school !== undefined && !updates.school) {
      updates.school = SCHOOL_DEFAULT;
    }

    // ── Skill lists: comma-separated text or an array of skills ──
    for (const [field, rule] of Object.entries(SKILL_FIELDS)) {
      if (body[field] === undefined) continue;

      const skills = normaliseSkills(body[field], rule);

      if (skills === null) {
        return res.status(400).json({
          success: false,
          message: `${rule.label} must be a comma-separated list of skills`,
        });
      }

      updates[field] = skills;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No profile fields to update',
      });
    }

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
