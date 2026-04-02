'use strict';

const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');
const { createSession, destroySession } = require('../whatsapp/baileyFactory');

// GET /api/sessions
router.get('/', (req, res) => {
  const db = getDb();
  const sessions = db.prepare('SELECT * FROM sessions ORDER BY created_at DESC').all();
  res.json(sessions);
});

// POST /api/sessions
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO sessions (id, name) VALUES (?, ?)').run(id, name);
  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(id);
  res.status(201).json(session);
});

// DELETE /api/sessions/:id
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const session = db.prepare('SELECT id FROM sessions WHERE id=?').get(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  await destroySession(id);
  db.prepare('DELETE FROM sessions WHERE id=?').run(id);
  res.json({ ok: true });
});

// POST /api/sessions/:id/connect
router.post('/:id/connect', async (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const session = db.prepare('SELECT id FROM sessions WHERE id=?').get(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  try {
    await createSession(id);
    res.json({ ok: true, message: 'Connecting... watch for QR event' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sessions/:id/disconnect
router.post('/:id/disconnect', async (req, res) => {
  const { id } = req.params;
  await destroySession(id);
  res.json({ ok: true });
});

// POST /api/sessions/:id/ai-toggle
router.post('/:id/ai-toggle', (req, res) => {
  const { id } = req.params;
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id=?').get(id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  const newVal = session.ai_enabled ? 0 : 1;
  db.prepare('UPDATE sessions SET ai_enabled=?, updated_at=unixepoch() WHERE id=?').run(newVal, id);
  res.json({ ai_enabled: newVal });
});

module.exports = router;
