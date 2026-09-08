// SkillLoop Express App Factory
// src/app.js

const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');

function createApp() {
  const app = express();

  // ===== Middleware =====
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Set view engine
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '../views'));

  // Static files
  app.use(express.static(path.join(__dirname, '../public')));

  // Session config
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000
    }
  }));

  // ===== Database Connection (serverless-compatible) =====
  let mongoConnection = null;

  async function connectDB() {
    if (mongoConnection && mongoose.connection.readyState === 1) return mongoConnection;
    mongoConnection = await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/skillloop',
      { serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 }
    );
    console.log('✓ MongoDB connected');
    return mongoConnection;
  }

  app.use(async (req, res, next) => {
    try {
      await connectDB();
      next();
    } catch (error) {
      res.status(500).json({ error: 'Database connection failed' });
    }
  });

  // ===== Auth Middleware =====
  const { isLoggedIn, requireLogin } = require('./middleware/auth');
  app.use(isLoggedIn);

  // Load the full user record once per request so every view gets
  // name/email/avatar via res.locals.currentUser (JWT only carries the id).
  app.use(async (req, res, next) => {
    res.locals.currentUser = null;
    if (!req.user || !req.user.id) return next();
    try {
      const User = require('./models/User');
      const full = await User.findById(req.user.id).lean();
      if (full) {
        req.fullUser = full;
        res.locals.currentUser = full;
      }
    } catch (e) {
      console.error('currentUser load failed:', e.message);
    }
    next();
  });

  // ===== Routes =====

  // Auth routes
  const authRoutes = require('./routes/auth');
  app.use('/api/auth', authRoutes);

  // Posts routes
  const postRoutes = require('./routes/posts');
  app.use('/posts', requireLogin, postRoutes);

  // Profile routes
  const profileRoutes = require('./routes/profile');
  app.use('/profile', requireLogin, profileRoutes);

  // Messaging routes
  const messageRoutes = require('./routes/messages');
  app.use('/messages', requireLogin, messageRoutes);

  // Logout
  app.get('/logout', (req, res) => {
    res.clearCookie('token');
    if (req.session) req.session.destroy(() => res.redirect('/'));
    else res.redirect('/');
  });

  // ── Page routes ──

  app.get('/', (req, res) => {
    res.render('home', {});
  });

  app.get('/signin', (req, res) => {
    res.render('auth/signin', { currentUser: null });
  });

  app.get('/signup', (req, res) => {
    res.render('auth/signup', { currentUser: null });
  });

  // ── Dashboard — fetches user + posts from DB ──
  app.get('/dashboard', requireLogin, async (req, res) => {
    try {
      const User = require('./models/User');
      const Post = require('./models/Post');

      // Full user from DB
      const user = req.fullUser || await User.findById(req.user.id).lean();
      if (!user) return res.redirect('/signin');

      // User's own posts (newest first)
      const userPosts = await Post.find({
        author: req.user.id,
        status: { $ne: 'deleted' }
      })
        .sort({ createdAt: -1 })
        .lean();

      // Suggested posts — open posts from OTHER users (up to 6)
      const suggestedPosts = await Post.find({
        author: { $ne: req.user.id },
        status: 'open'
      })
        .sort({ createdAt: -1 })
        .limit(6)
        .populate('author', 'firstName lastName')
        .lean();

      // Notifications placeholder (extend when you build a Notification model)
      const notifications = [];

      res.render('dashboard/dashboard', {
        user,
        currentUser: user,
        userPosts,
        suggestedPosts,
        notifications
      });
    } catch (err) {
      console.error('Dashboard error:', err);
      res.redirect('/signin');
    }
  });


  app.get('/browse', requireLogin, async (req, res, next) => {
    try {
      const Post = require('./models/Post');
      const { timeAgo, shortName } = require('./routes/posts');

      const raw = await Post.find({ status: 'open' })
        .sort({ createdAt: -1 })
        .populate('author', 'firstName lastName')
        .lean();

      const posts = raw.map(p => ({
        ...p,
        timeAgo: timeAgo(p.createdAt),
        authorName: shortName(p.author),
      }));

      res.render('browse', { posts });
    } catch (err) {
      next(err);
    }
  });

  // ===== API — Conversations / Messages =====





  // ===== 404 Handler =====
  app.use((req, res) => {
    res.status(404).send('Not found: ' + req.method + ' ' + req.originalUrl);
  });

  // ===== Error Handler =====
  app.use((err, req, res, next) => {
    console.error('\n===== ERROR on ' + req.method + ' ' + req.originalUrl + ' =====');
    console.error(err && err.stack ? err.stack : err);
    console.error('==========================================\n');

    if (process.env.NODE_ENV !== 'production') {
      return res.status(500).type('text/plain').send(
        'ERROR on ' + req.method + ' ' + req.originalUrl + '\n\n' +
        (err && err.stack ? err.stack : String(err))
      );
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createApp;
