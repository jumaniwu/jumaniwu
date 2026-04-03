const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const APPLICANTS_FILE = path.join(__dirname, '../data/applicants.json');
function readApplicants() { try { return JSON.parse(fs.readFileSync(APPLICANTS_FILE,'utf8')); } catch { return []; } }
function writeApplicants(data) { fs.writeFileSync(APPLICANTS_FILE, JSON.stringify(data, null, 2)); }

// GET /api/applicants  (HR view - protected)
router.get('/', auth, (req, res) => {
  const { position, status } = req.query;
  let applicants = readApplicants().filter(a => a.companyId === req.user.id);
  if (position) applicants = applicants.filter(a => a.position === position);
  if (status === 'pass') applicants = applicants.filter(a => a.passed);
  if (status === 'fail') applicants = applicants.filter(a => !a.passed);
  res.json({ applicants, total: applicants.length });
});

// POST /api/applicants  (candidate submits test - public)
router.post('/', (req, res) => {
  const data = req.body;
  if (!data.name || !data.email) return res.status(400).json({ message: 'Name and email required.' });
  const applicants = readApplicants();
  const applicant = Object.assign({ id: uuidv4(), date: new Date().toISOString() }, data);
  applicants.unshift(applicant);
  writeApplicants(applicants);
  res.status(201).json({ applicant });
});

// GET /api/applicants/:id  (protected)
router.get('/:id', auth, (req, res) => {
  const applicant = readApplicants().find(a => a.id === req.params.id && a.companyId === req.user.id);
  if (!applicant) return res.status(404).json({ message: 'Applicant not found.' });
  res.json({ applicant });
});

module.exports = router;
