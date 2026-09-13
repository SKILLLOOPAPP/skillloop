const jwt = require('jsonwebtoken');

// Verify JWT token middleware
exports.verifyAuth = (req, res, next) => {
  try {
    // Get token from cookie or Authorization header
    let token = req.cookies.token;

    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route',
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired',
      });
    }

    res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }
};

// Render middleware - for EJS templates to check if user is logged in
exports.isLoggedIn = (req, res, next) => {
  try {
    let token = req.cookies.token;

    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      res.locals.isLoggedIn = true;
      res.locals.userId = decoded.id;
    } else {
      res.locals.isLoggedIn = false;
      res.locals.userId = null;
    }
  } catch (error) {
    res.locals.isLoggedIn = false;
    res.locals.userId = null;
  }

  next();
};

// Redirect to signin if not logged in
exports.requireLogin = (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.redirect('/signin');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.redirect('/signin');
  }
};

// ============================================================
// UC15 - Role-Based Access Control
// Only administrators can access moderation functionality
// ============================================================
exports.requireAdmin = async (req, res, next) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const User = require('../models/User');

    const user = await User.findById(req.user.id)
      .select('role accountStatus')
      .lean();

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({
        success: false,
        message: 'Account is not active'
      });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    req.authorizedUser = user;
    next();

  } catch (error) {
    console.error('RBAC error:', error);

    res.status(500).json({
      success: false,
      message: 'Authorization check failed'
    });
  }
};