const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db/database');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Semua field wajib diisi' });

  const db = getDb();
  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(400).json({ error: 'Email sudah terdaftar' });

    const slug = email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() + '-' + Date.now();
    const tenantResult = db.prepare(`
      INSERT INTO tenants (name, slug, plan, expires_at)
      VALUES (?, ?, 'trial', datetime('now', '+8 hours'))
    `).run(name + ' Tenant', slug);

    const hash = bcrypt.hashSync(password, 10);
    const userResult = db.prepare(`
      INSERT INTO users (tenant_id, name, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'admin')
    `).run(tenantResult.lastInsertRowid, name, email, hash);

    const token = jwt.sign({ userId: userResult.lastInsertRowid }, JWT_SECRET, { expiresIn: '30d' });
    const user = db.prepare('SELECT id, name, email, role, is_demo, tenant_id FROM users WHERE id = ?').get(userResult.lastInsertRowid);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantResult.lastInsertRowid);

    res.json({ token, user, tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email dan password wajib diisi' });

  const db = getDb();
  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return res.status(401).json({ error: 'Email atau password salah' });

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Email atau password salah' });

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(user.tenant_id);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

    const { password_hash, ...safeUser } = user;
    res.json({ token, user: safeUser, tenant });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me', authMiddleware, (req, res) => {
  const db = getDb();
  const { password_hash, ...safeUser } = req.user;
  const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.user.tenant_id);
  res.json({ user: safeUser, tenant });
});

module.exports = router;
