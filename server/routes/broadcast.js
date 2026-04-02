'use strict';

const router = require('express').Router();
const { getDb } = require('../db');
const sessionManager = require('../whatsapp/sessionManager');
const { v4: uuidv4 } = require('uuid');

// POST /api/broadcast
// Body: { session_id, jids: [...], text }
router.post('/', async (req, res) => {
  const { session_id, jids, text } = req.body;
  if (!session_id || !jids?.length || !text) {
    return res.status(400).json({ error: 'session_id, jids[], and text are required' });
  }

  const instance = sessionManager.get(session_id);
  if (!instance) return res.status(400).json({ error: 'Session not connected' });

  const db = getDb();
  const results = [];

  for (const jid of jids) {
    try {
      await instance.sock.sendMessage(jid, { text });

      // Find or create conversation
      let conv = db.prepare(
        'SELECT * FROM conversations WHERE session_id=? AND contact_jid=?'
      ).get(session_id, jid);

      if (!conv) {
        const convId = uuidv4();
        const phone = jid.replace(/[@:].*$/, '');
        db.prepare(`
          INSERT INTO conversations (id, session_id, contact_jid, contact_name, last_message, last_message_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(convId, session_id, jid, phone, text, Math.floor(Date.now() / 1000));
        conv = { id: convId };
      }

      const ts = Math.floor(Date.now() / 1000);
      const msgId = uuidv4();
      db.prepare(`
        INSERT INTO messages (id, conversation_id, role, content, timestamp, is_read)
        VALUES (?, ?, 'human_agent', ?, ?, 1)
      `).run(msgId, conv.id, text, ts);

      db.prepare(
        'UPDATE conversations SET last_message=?, last_message_at=?, updated_at=unixepoch() WHERE id=?'
      ).run(text, ts, conv.id);

      results.push({ jid, ok: true });

      // Small delay to avoid spam detection (1s between messages)
      await new Promise(r => setTimeout(r, 1000));
    } catch (err) {
      results.push({ jid, ok: false, error: err.message });
    }
  }

  res.json({ results });
});

module.exports = router;
