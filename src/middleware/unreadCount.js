const Conversation = require('../models/Conversation')
const Message = require('../models/Message')

async function getUnreadCount(userId) {
  const conversationIds = await Conversation.find({ participants: userId }).distinct('_id')

  return Message.countDocuments({
    conversation: { $in: conversationIds },
    readBy: { $ne: userId }
  })
}

async function attachUnreadCount(req, res, next) {
  if (!req.user) {
    res.locals.unreadCount = 0
    return next()
  }

  try {
    res.locals.unreadCount = await getUnreadCount(req.user.id)
    next()
  } catch (err) {
    next(err)
  }
}

module.exports = { attachUnreadCount, getUnreadCount }
