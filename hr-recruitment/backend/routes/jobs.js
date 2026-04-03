const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const auth = require('../middleware/auth');

const JOBS_FILE = path.join(__dirname, '../data/jobs.json');
function readJobs() { try { return JSON.parse(fs.readFileSync(JOBS_FILE,'utf8')); } catch { return []; } }
function writeJobs(data) { fs.writeFileSync(JOBS_FILE, JSON.stringify(data, null, 2)); }

// GET /api/jobs
router.get('/', auth, (req, res) => {
  const jobs = readJobs().filter(j => j.companyId === req.user.id);
  res.json({ jobs });
});

// POST /api/jobs
router.post('/', auth, (req, res) => {
  const { title, department, location, type, salary, deadline, description, vacancies, status } = req.body;
  if (!title || !department || !location) return res.status(400).json({ message: 'Title, department, and location are required.' });
  const jobs = readJobs();
  const job = { id: uuidv4(), companyId: req.user.id, title, department, location, type: type||'Full-time', salary: salary||'', deadline: deadline||'', description: description||'', vacancies: vacancies||1, status: status||'open', createdAt: new Date().toISOString() };
  jobs.push(job);
  writeJobs(jobs);
  res.status(201).json({ job });
});

// PUT /api/jobs/:id
router.put('/:id', auth, (req, res) => {
  const jobs = readJobs();
  const idx = jobs.findIndex(j => j.id === req.params.id && j.companyId === req.user.id);
  if (idx === -1) return res.status(404).json({ message: 'Job not found.' });
  jobs[idx] = Object.assign(jobs[idx], req.body, { id: jobs[idx].id, companyId: jobs[idx].companyId, createdAt: jobs[idx].createdAt });
  writeJobs(jobs);
  res.json({ job: jobs[idx] });
});

// DELETE /api/jobs/:id
router.delete('/:id', auth, (req, res) => {
  const jobs = readJobs();
  const filtered = jobs.filter(j => !(j.id === req.params.id && j.companyId === req.user.id));
  if (filtered.length === jobs.length) return res.status(404).json({ message: 'Job not found.' });
  writeJobs(filtered);
  res.json({ message: 'Job deleted.' });
});

module.exports = router;
