const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/applicants', require('./routes/applicants'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'RecruitFit API', version: '1.0.0', timestamp: new Date().toISOString() });
});

// SPA fallback — serve index.html for unmatched routes
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../marketing/index.html'));
  } else {
    res.status(404).json({ message: 'API endpoint not found.' });
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log('  ✅ RecruitFit Backend running!');
  console.log('  🌐 App:    http://localhost:' + PORT + '/marketing/index.html');
  console.log('  📊 Dashboard: http://localhost:' + PORT + '/dashboard.html');
  console.log('  🔌 API:    http://localhost:' + PORT + '/api/health');
  console.log('');
});

module.exports = app;
