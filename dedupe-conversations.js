/**
 * One-off cleanup: merge duplicate conversations.
 *
 * A duplicate = same two participants + same post. Keeps the oldest one,
 * moves every message from the duplicates onto it, then deletes the extras.
 *
 * Run from the project root:   node dedupe-conversations.js
 */

require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/skillloop');
  console.log('Connected.\n');

  const Conversation = require('./src/models/Conversation');
  const Message = require('./src/models/Message');

  const all = await Conversation.find({}).sort({ createdAt: 1 }).lean();
  console.log(`${all.length} conversation(s) total.`);

  // group by "sorted participant ids | post id"
  const groups = new Map();
  for (const c of all) {
    const ids = (c.participants || []).map(String).sort().join(',');
    const key = ids + '|' + (c.post ? String(c.post) : 'none');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }

  let merged = 0, removed = 0;

  for (const [key, list] of groups) {
    if (list.length < 2) continue;

    const keep = list[0];
    const dupes = list.slice(1);
    console.log(`\nDuplicate group (${list.length}) -> keeping ${keep._id}`);

    for (const d of dupes) {
      const r = await Message.updateMany(
        { conversation: d._id },
        { $set: { conversation: keep._id } }
      );
      console.log(`   moved ${r.modifiedCount} message(s) off ${d._id}`);
      await Conversation.deleteOne({ _id: d._id });
      removed++;
    }

    // refresh the preview from whatever message is now newest
    const last = await Message.findOne({ conversation: keep._id })
      .sort({ createdAt: -1 })
      .lean();
    if (last) {
      await Conversation.updateOne(
        { _id: keep._id },
        { lastMessage: last.content.slice(0, 120), lastMessageAt: last.createdAt }
      );
    }
    merged++;
  }

  console.log(`\nDone. Merged ${merged} group(s), deleted ${removed} duplicate conversation(s).`);
  process.exit(0);
})().catch(e => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
