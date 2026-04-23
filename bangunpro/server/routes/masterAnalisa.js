const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = getDb();
  const data = db.prepare('SELECT * FROM master_analisa WHERE tenant_id = ? ORDER BY kategori, nama').all(req.tenantId);
  res.json(data);
});

router.post('/', (req, res) => {
  const db = getDb();
  const { kode, nama, satuan, kategori, sumber, koefisien_json, harga_satuan } = req.body;
  const result = db.prepare(`
    INSERT INTO master_analisa (tenant_id, kode, nama, satuan, kategori, sumber, koefisien_json, harga_satuan)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(req.tenantId, kode || '', nama, satuan || '', kategori || '', sumber || 'SNI', koefisien_json || '{}', harga_satuan || 0);
  res.json(db.prepare('SELECT * FROM master_analisa WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM master_analisa WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!item) return res.status(404).json({ error: 'Item tidak ditemukan' });
  const { kode, nama, satuan, kategori, sumber, koefisien_json, harga_satuan } = req.body;
  db.prepare(`
    UPDATE master_analisa SET kode=?, nama=?, satuan=?, kategori=?, sumber=?, koefisien_json=?, harga_satuan=? WHERE id=?
  `).run(kode ?? item.kode, nama ?? item.nama, satuan ?? item.satuan, kategori ?? item.kategori,
    sumber ?? item.sumber, koefisien_json ?? item.koefisien_json, harga_satuan ?? item.harga_satuan, req.params.id);
  res.json(db.prepare('SELECT * FROM master_analisa WHERE id = ?').get(req.params.id));
});

module.exports = router;
