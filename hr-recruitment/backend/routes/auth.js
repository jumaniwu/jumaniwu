const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'recruitfit_secret_2026';
const USERS_FILE = path.join(__dirname, '../data/users.json');

function readUsers() { try { return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); } catch { return []; } }
function writeUsers(data) { fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2)); }

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { company, industry, size, website, name, jobTitle, email, password, plan } = req.body;
    if (!email || !password || !name || !company) return res.status(400).json({ message: 'Required fields missing.' });
    const users = readUsers();
    if (users.find(u => u.email === email)) return res.status(409).json({ message: 'Email already registered.' });
    const hash = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), email, passwordHash: hash, name, jobTitle: jobTitle||'', company, industry: industry||'', companySize: size||'', website: website||'', plan: plan||'basic', trialStart: new Date().toISOString(), createdAt: new Date().toISOString() };
    users.push(user);
    writeUsers(users);
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, company: user.company, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, company: user.company, plan: user.plan } });
  } catch(err) { res.status(500).json({ message: 'Server error.' }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required.' });
    const users = readUsers();
    const user = users.find(u => u.email === email);
    if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ message: 'Invalid email or password.' });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, company: user.company, plan: user.plan }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, company: user.company, plan: user.plan } });
  } catch(err) { res.status(500).json({ message: 'Server error.' }); }
});

// GET /api/auth/me
router.get('/me', require('../middleware/auth'), (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
