const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/:projectId', (req, res) => {
  const db = getDb();
  const transaksi = db.prepare(`
    SELECT k.*, r.uraian as item_uraian
    FROM kas_realisasi k
    LEFT JOIN rab_items r ON k.alokasi_item_id = r.id
    WHERE k.project_id = ? ORDER BY k.tanggal DESC, k.created_at DESC
  `).all(req.params.projectId);
  res.json(transaksi);
});

router.post('/:projectId', (req, res) => {
  const db = getDb();
  const { tanggal, kategori, alokasi_item_id, keterangan, nominal } = req.body;
  if (!tanggal || !kategori || !nominal) return res.status(400).json({ error: 'Field wajib kurang' });
  const result = db.prepare(`
    INSERT INTO kas_realisasi (project_id, tanggal, kategori, alokasi_item_id, keterangan, nominal)
    VALUES (?,?,?,?,?,?)
  `).run(req.params.projectId, tanggal, kategori, alokasi_item_id || null, keterangan || '', parseFloat(nominal));
  res.json(db.prepare('SELECT * FROM kas_realisasi WHERE id = ?').get(result.lastInsertRowid));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM kas_realisasi WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
