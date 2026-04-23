const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = getDb();
  const data = db.prepare('SELECT * FROM master_harga WHERE tenant_id = ? ORDER BY kategori, nama').all(req.tenantId);
  res.json(data);
});

router.put('/bulk', (req, res) => {
  const db = getDb();
  const { items } = req.body;
  const update = db.prepare('UPDATE master_harga SET harga = ? WHERE id = ? AND tenant_id = ?');
  const updateMany = db.transaction((items) => {
    for (const item of items) {
      update.run(item.harga, item.id, req.tenantId);
    }
  });
  updateMany(items);
  res.json({ success: true });
});

router.post('/apply-wilayah', (req, res) => {
  const db = getDb();
  const { wilayah, timpa } = req.body;

  const wilayahMultiplier = {
    'Standar DKI Jakarta': 1.0,
    'Standar Jawa Barat': 0.92,
    'Standar Jawa Timur': 0.90,
    'Standar Sumatera Utara': 0.95,
    'Standar Kepulauan Riau': 1.05,
    'Standar Kalimantan': 1.10,
    'Standar Sulawesi': 1.08,
  };

  const multiplier = wilayahMultiplier[wilayah] || 1.0;
  if (timpa) {
    db.prepare(`
      UPDATE master_harga SET harga = ROUND(std_wilayah * ?, 0), wilayah = ? WHERE tenant_id = ?
    `).run(multiplier, wilayah, req.tenantId);
  }
  res.json({ success: true, multiplier });
});

module.exports = router;
