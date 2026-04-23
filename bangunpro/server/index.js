require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/database');
const { seed } = require('./db/seed');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Initialize DB and seed
getDb();
seed();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/license', require('./routes/license'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/rab', require('./routes/rab'));
app.use('/api/invoice', require('./routes/invoice'));
app.use('/api/kurvas', require('./routes/kurvas'));
app.use('/api/keuangan', require('./routes/keuangan'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/logistik', require('./routes/logistik'));
app.use('/api/master-harga', require('./routes/masterHarga'));
app.use('/api/master-analisa', require('./routes/masterAnalisa'));
app.use('/api/dashboard', require('./routes/dashboard'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`🚀 BangunPro Server running on http://localhost:${PORT}`);
});
