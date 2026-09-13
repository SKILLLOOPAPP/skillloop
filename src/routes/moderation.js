const express = require('express');

const router = express.Router();
const Report = require('../models/Report');

// ============================================================
// UC15
// GET /api/moderation/reports
// This router is protected by requireAdmin in app.js
// ============================================================
router.get('/reports', async (req, res) => {
  try {
    const reports = await Report.find({})
      .sort({ createdAt: -1 })
      .populate('reporter', 'firstName lastName')
      .populate('reportedUser', 'firstName lastName')
      .populate('post', 'title status')
      .lean();

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });

  } catch (error) {
    console.error('Moderation reports error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to load moderation reports'
    });
  }
});

module.exports = router;