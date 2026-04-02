'use strict';

const router = require('express').Router();
const { getDb } = require('../db');

// GET /api/knowledge?session_id=
router.get('/', (req, res) => {
  const db = getDb();
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'session_id is required' });

  const entries = db.prepare(
    'SELECT * FROM knowledge_base WHERE session_id=? ORDER BY created_at ASC'
  ).all(session_id);
  res.json(entries);
});

// POST /api/knowledge
router.post('/', (req, res) => {
  const { session_id, title, content } = req.body;
  if (!session_id || !title || !content) {
    return res.status(400).json({ error: 'session_id, title, content are required' });
  }
  const db = getDb();
  const result = db.prepare(
    'INSERT INTO knowledge_base (session_id, title, content) VALUES (?, ?, ?)'
  ).run(session_id, title, content);

  const entry = db.prepare('SELECT * FROM knowledge_base WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// PUT /api/knowledge/:id
router.put('/:id', (req, res) => {
  const { title, content } = req.body;
  const db = getDb();
  const entry = db.prepare('SELECT * FROM knowledge_base WHERE id=?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Not found' });

  db.prepare(
    'UPDATE knowledge_base SET title=?, content=?, updated_at=unixepoch() WHERE id=?'
  ).run(title ?? entry.title, content ?? entry.content, req.params.id);

  res.json(db.prepare('SELECT * FROM knowledge_base WHERE id=?').get(req.params.id));
});

// DELETE /api/knowledge/:id
router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM knowledge_base WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
