'use strict';

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const sessionManager = require('../whatsapp/sessionManager');

// POST /api/messages/send
router.post('/send', async (req, res) => {
  const { conversation_id, text } = req.body;
  if (!conversation_id || !text) {
    return res.status(400).json({ error: 'conversation_id and text are required' });
  }

  const db = getDb();
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(conversation_id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const instance = sessionManager.get(conv.session_id);
  if (!instance) return res.status(400).json({ error: 'Session not connected' });

  try {
    await instance.sock.sendMessage(conv.contact_jid, { text });

    const ts = Math.floor(Date.now() / 1000);
    const msgId = uuidv4();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, timestamp, is_read)
      VALUES (?, ?, 'human_agent', ?, ?, 1)
    `).run(msgId, conversation_id, text, ts);

    db.prepare(`
      UPDATE conversations SET last_message=?, last_message_at=?, updated_at=unixepoch() WHERE id=?
    `).run(text, ts, conversation_id);

    const message = db.prepare('SELECT * FROM messages WHERE id=?').get(msgId);
    const io = req.app.get('io');
    io?.emit('message:new', { conversationId: conversation_id, message });

    res.json(message);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
