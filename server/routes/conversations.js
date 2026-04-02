'use strict';

const router = require('express').Router();
const { getDb } = require('../db');

// GET /api/conversations?session_id=&page=&limit=
router.get('/', (req, res) => {
  const db = getDb();
  const { session_id, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT * FROM conversations';
  const params = [];
  if (session_id) {
    query += ' WHERE session_id=?';
    params.push(session_id);
  }
  query += ' ORDER BY last_message_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const conversations = db.prepare(query).all(...params);
  res.json(conversations);
});

// GET /api/conversations/:id/messages
router.get('/:id/messages', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { limit = 50, before } = req.query;

  let query = 'SELECT * FROM messages WHERE conversation_id=?';
  const params = [id];
  if (before) {
    query += ' AND timestamp < ?';
    params.push(parseInt(before));
  }
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(parseInt(limit));

  const messages = db.prepare(query).all(...params).reverse();

  // Mark as read
  db.prepare("UPDATE conversations SET unread_count=0 WHERE id=?").run(id);
  res.json(messages);
});

// POST /api/conversations/:id/handoff
router.post('/:id/handoff', (req, res) => {
  const db = getDb();
  const { id } = req.params;
  const { enabled } = req.body; // true = AI on, false = human mode

  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(id);
  if (!conv) return res.status(404).json({ error: 'Conversation not found' });

  const aiEnabled = enabled ? 1 : 0;
  db.prepare('UPDATE conversations SET ai_enabled=?, updated_at=unixepoch() WHERE id=?')
    .run(aiEnabled, id);

  const io = req.app.get('io');
  if (!aiEnabled) {
    io?.emit('handoff:activated', { conversationId: id });
  } else {
    io?.emit('handoff:deactivated', { conversationId: id });
  }

  res.json({ ai_enabled: aiEnabled });
});

module.exports = router;
