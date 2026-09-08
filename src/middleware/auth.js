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
