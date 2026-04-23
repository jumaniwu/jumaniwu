const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/:projectId', (req, res) => {
  const db = getDb();
  const data = db.prepare('SELECT * FROM kurva_s WHERE project_id = ? ORDER BY minggu').all(req.params.projectId);
  res.json(data);
});

router.put('/:projectId', (req, res) => {
  const db = getDb();
  const { rows } = req.body; // [{minggu, plan_pct, realisasi_pct}]
  if (!rows || !Array.isArray(rows)) return res.status(400).json({ error: 'Data tidak valid' });

  db.prepare('DELETE FROM kurva_s WHERE project_id = ?').run(req.params.projectId);
  const insert = db.prepare('INSERT INTO kurva_s (project_id, minggu, plan_pct, realisasi_pct) VALUES (?,?,?,?)');
  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      if (r.plan_pct > 0 || r.realisasi_pct > 0) {
        insert.run(req.params.projectId, r.minggu, r.plan_pct || 0, r.realisasi_pct || 0);
      }
    }
  });
  insertMany(rows);
  res.json({ success: true });
});

module.exports = router;
