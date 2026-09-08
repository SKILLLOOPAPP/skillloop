// SkillLoop Server - Vercel Serverless Setup
// Key changes for Vercel deployment

const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// ===== Middleware =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', './views');

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

// ===== Database Connection =====
let mongoConnection = null;

async function connectDB() {
  if (mongoConnection) return mongoConnection;

  try {
    mongoConnection = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillloop', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('✓ MongoDB connected');
    return mongoConnection;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Connect on first request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Database connection failed' });
  }
});

// ===== Authentication Middleware =====
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
};

// ===== Routes =====
app.get('/dashboard', requireLogin, (req, res) => {
  res.render('dashboard/dashboard', {
    user: req.session.user,
    currentUser: req.session.user
  });
});

app.get('/messages', requireLogin, (req, res) => {
  res.render('messaging/messages', {
    currentUser: req.session.user
  });
});

app.get('/browse', (req, res) => {
  res.render('browse', { currentUser: req.session.user });
});

// ===== API Endpoints =====

app.get('/api/conversations', requireLogin, async (req, res) => {
  try {
    const Conversation = require('./models/Conversation');
    const conversations = await Conversation.find({
      participants: req.session.userId
    })
    .populate('postId', 'title')
    .sort({ updatedAt: -1 })
    .lean();

    const formatted = conversations.map(conv => ({
      id: conv._id,
      postTitle: conv.postId?.title || 'Unknown Post',
      lastMessage: 'Last message preview',
      lastMessageTime: conv.updatedAt
    }));

    res.json({ conversations: formatted });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

app.get('/api/conversations/:id/messages', requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const sinceTime = req.query.since ? new Date(req.query.since) : null;

    const Message = require('./models/Message');

    let query = { conversationId: id };
    if (sinceTime) {
      query.createdAt = { $gt: sinceTime };
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .lean();

    const formatted = messages.map(msg => ({
      id: msg._id,
      userId: msg.userId,
      content: msg.content,
      createdAt: msg.createdAt,
      isSent: msg.userId.toString() === req.session.userId
    }));

    res.json({ messages: formatted });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

app.post('/api/conversations/:id/messages', requireLogin, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const Message = require('./models/Message');
    const Conversation = require('./models/Conversation');

    const message = new Message({
      conversationId: id,
      userId: req.session.userId,
      content: content.trim(),
      createdAt: new Date()
    });

    await message.save();
    await Conversation.findByIdAndUpdate(id, { updatedAt: new Date() });

    res.json({
      message: {
        id: message._id,
        userId: message.userId,
        content: message.content,
        createdAt: message.createdAt,
        isSent: true
      }
    });

    console.log(`✓ Message sent in conversation ${id}`);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.post('/api/conversations', requireLogin, async (req, res) => {
  try {
    const { postId, participantId } = req.body;
    const Conversation = require('./models/Conversation');

    let conversation = await Conversation.findOne({
      postId,
      participants: { $all: [req.session.userId, participantId] }
    });

    if (!conversation) {
      conversation = new Conversation({
        postId,
        participants: [req.session.userId, participantId]
      });
      await conversation.save();
    }

    res.json({ conversation });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// ===== Error Handler =====
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
}
