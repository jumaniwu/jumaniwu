'use strict';

const router = require('express').Router();
const { getDb } = require('../db');

// GET /api/contacts?session_id=&q=
router.get('/', (req, res) => {
  const db = getDb();
  const { session_id, q } = req.query;

  let query = 'SELECT * FROM contacts';
  const params = [];
  const conditions = [];

  if (session_id) {
    conditions.push('session_id=?');
    params.push(session_id);
  }
  if (q) {
    conditions.push('(name LIKE ? OR phone LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY name ASC';

  res.json(db.prepare(query).all(...params));
});

// GET /api/contacts/:id
router.get('/:id', (req, res) => {
  const db = getDb();
  const contact = db.prepare('SELECT * FROM contacts WHERE id=?').get(req.params.id);
  if (!contact) return res.status(404).json({ error: 'Contact not found' });
  res.json(contact);
});

module.exports = router;
