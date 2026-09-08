const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Post = require('../models/Post');

// ── "Today 2:30 PM" / "Yesterday 9:04 AM" / "3 Sep 2:15 PM" ──
function stamp(d) {
  const date = new Date(d);
  const now = new Date();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', hour12: true
  });
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return 'Today ' + time;

  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (date.toDateString() === y.toDateString()) return 'Yesterday ' + time;

  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' }) + ' ' + time;
}

function shortName(u) {
  if (!u || !u.firstName) return 'SkillLoop User';
  const last = u.lastName ? ' ' + u.lastName.charAt(0).toUpperCase() + '.' : '';
  return u.firstName + last;
}

const isValidId = id => mongoose.Types.ObjectId.isValid(id);

// Build the conversation list for the sidebar
async function listConversations(userId) {
  const convos = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1 })
    .populate('participants', 'firstName lastName')
    .populate('post', 'title')
    .lean();

  return convos.map(c => {
    const other = (c.participants || []).find(
      p => p && p._id.toString() !== userId.toString()
    );
    return {
      _id: c._id,
      otherName: shortName(other),
      topic: c.post ? c.post.title : 'Direct message',
      label: shortName(other) + ' - ' + (c.post ? c.post.title : 'Direct message'),
      lastMessage: c.lastMessage,
    };
  });
}

// ── GET /messages ──
// ?c=<conversationId>            open a conversation
// ?to=<userId>&post=<postId>     start (or find) a conversation, then redirect
router.get('/', async (req, res, next) => {
  try {
    const me = req.user.id;

    // Starting a conversation from a post's "Send Message" button
    if (req.query.to && isValidId(req.query.to) && req.query.to !== me) {
      const postId = isValidId(req.query.post) ? req.query.post : null;

      // Match on both participants AND the post, comparing as ObjectIds.
      // ($all + $size in one clause casts unreliably, which let duplicates through.)
      const oid = v => new mongoose.Types.ObjectId(v);
      const candidates = await Conversation.find({
        participants: { $all: [oid(me), oid(req.query.to)] },
        post: postId ? oid(postId) : null,
      }).sort({ createdAt: 1 }).lean();

      const existing = candidates.find(c => (c.participants || []).length === 2);

      let convo = existing;
      if (!convo) {
        convo = await Conversation.create({
          participants: [me, req.query.to],
          post: postId,
        });
      }
      return res.redirect('/messages?c=' + convo._id);
    }

    const conversations = await listConversations(me);

    // Which conversation is open? (explicit ?c=, else the most recent)
    let activeId = isValidId(req.query.c) ? req.query.c : null;
    if (!activeId && conversations.length) activeId = conversations[0]._id.toString();

    let active = null;
    let messages = [];

    if (activeId) {
      const convo = await Conversation.findOne({
        _id: activeId,
        participants: me,          // membership check — can't open someone else's chat
      })
        .populate('participants', 'firstName lastName avatar')
        .populate('post', 'title')
        .lean();

      if (convo) {
        const other = (convo.participants || []).find(
          p => p && p._id.toString() !== me
        );
        active = {
          _id: convo._id,
          otherName: shortName(other),
          otherId: other ? other._id : null,
          topic: convo.post ? convo.post.title : 'Direct message',
        };

        const raw = await Message.find({ conversation: convo._id })
          .sort({ createdAt: 1 })
          .lean();

        messages = raw.map(m => ({
          _id: m._id,
          content: m.content,
          stamp: stamp(m.createdAt),
          createdAt: m.createdAt,
          isMine: m.sender.toString() === me,
        }));

        await Message.updateMany(
          { conversation: convo._id, sender: { $ne: me }, readBy: { $ne: me } },
          { $addToSet: { readBy: me } }
        );
      }
    }

    res.render('messaging/messages', {
      conversations,
      active,
      messages,
      lastStamp: messages.length ? messages[messages.length - 1].createdAt : null,
    });
  } catch (err) {
    next(err);
  }
});

// ── POST /messages/:id/send ──
router.post('/:id/send', async (req, res, next) => {
  try {
    const me = req.user.id;
    const content = (req.body.content || '').trim();

    if (!isValidId(req.params.id) || !content) {
      return res.redirect('/messages?c=' + req.params.id);
    }

    const convo = await Conversation.findOne({
      _id: req.params.id,
      participants: me,
    });
    if (!convo) return res.redirect('/messages');

    await Message.create({
      conversation: convo._id,
      sender: me,
      content,
      readBy: [me],
    });

    convo.lastMessage = content.slice(0, 120);
    convo.lastMessageAt = new Date();
    await convo.save();

    res.redirect('/messages?c=' + convo._id);
  } catch (err) {
    next(err);
  }
});

// ── GET /messages/:id/poll?since=<ISO> ── new messages only (JSON)
router.get('/:id/poll', async (req, res) => {
  try {
    const me = req.user.id;
    if (!isValidId(req.params.id)) return res.json({ messages: [] });

    const convo = await Conversation.findOne({
      _id: req.params.id,
      participants: me,
    }).lean();
    if (!convo) return res.json({ messages: [] });

    const q = { conversation: convo._id };
    if (req.query.since) {
      const since = new Date(req.query.since);
      if (!isNaN(since.getTime())) q.createdAt = { $gt: since };
    }

    const raw = await Message.find(q).sort({ createdAt: 1 }).lean();

    res.json({
      messages: raw.map(m => ({
        id: m._id,
        content: m.content,
        stamp: stamp(m.createdAt),
        createdAt: m.createdAt,
        isMine: m.sender.toString() === me,
      })),
    });
  } catch (err) {
    console.error('Poll error:', err);
    res.json({ messages: [] });
  }
});

module.exports = router;
