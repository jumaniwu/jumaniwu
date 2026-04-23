const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIII','XIV','XV'];

function checkProject(db, projectId, tenantId) {
  return db.prepare('SELECT * FROM projects WHERE id = ? AND tenant_id = ?').get(projectId, tenantId);
}

router.get('/:projectId', (req, res) => {
  const db = getDb();
  if (!checkProject(db, req.params.projectId, req.tenantId)) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  const divisions = db.prepare('SELECT * FROM rab_divisions WHERE project_id = ? ORDER BY sort_order').all(req.params.projectId);
  const items = db.prepare('SELECT * FROM rab_items WHERE project_id = ? ORDER BY division_id, sort_order').all(req.params.projectId);
  res.json({ divisions, items });
});

router.get('/:projectId/summary', (req, res) => {
  const db = getDb();
  if (!checkProject(db, req.params.projectId, req.tenantId)) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  const total = db.prepare('SELECT COALESCE(SUM(subtotal),0) as total, COUNT(*) as count FROM rab_items WHERE project_id = ?').get(req.params.projectId);
  res.json(total);
});

router.post('/:projectId/divisions', (req, res) => {
  const db = getDb();
  if (!checkProject(db, req.params.projectId, req.tenantId)) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  const { name } = req.body;
  const existing = db.prepare('SELECT COUNT(*) as c FROM rab_divisions WHERE project_id = ?').get(req.params.projectId);
  const roman = ROMAN[existing.c] || String(existing.c + 1);
  const result = db.prepare('INSERT INTO rab_divisions (project_id, roman_number, name, sort_order) VALUES (?,?,?,?)').run(req.params.projectId, roman, name, existing.c);
  res.json(db.prepare('SELECT * FROM rab_divisions WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/divisions/:id', (req, res) => {
  const db = getDb();
  const { name } = req.body;
  db.prepare('UPDATE rab_divisions SET name = ? WHERE id = ?').run(name, req.params.id);
  res.json(db.prepare('SELECT * FROM rab_divisions WHERE id = ?').get(req.params.id));
});

router.delete('/divisions/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM rab_divisions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:projectId/items', (req, res) => {
  const db = getDb();
  if (!checkProject(db, req.params.projectId, req.tenantId)) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  const { division_id, uraian, volume, satuan, harga_satuan, analisa_source } = req.body;
  const subtotal = (parseFloat(volume) || 0) * (parseFloat(harga_satuan) || 0);
  const count = db.prepare('SELECT COUNT(*) as c FROM rab_items WHERE project_id = ?').get(req.params.projectId);
  const result = db.prepare(`
    INSERT INTO rab_items (project_id, division_id, no, uraian, volume, satuan, harga_satuan, subtotal, analisa_source, sort_order)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(req.params.projectId, division_id, count.c + 1, uraian, volume || 0, satuan || 'm²', harga_satuan || 0, subtotal, analisa_source || 'manual', count.c);

  // Create progress entry
  db.prepare('INSERT INTO progress_items (project_id, rab_item_id, progress_fisik) VALUES (?,?,0)').run(req.params.projectId, result.lastInsertRowid);

  res.json(db.prepare('SELECT * FROM rab_items WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/items/:id', (req, res) => {
  const db = getDb();
  const item = db.prepare('SELECT * FROM rab_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item tidak ditemukan' });
  const { uraian, volume, satuan, harga_satuan, division_id } = req.body;
  const v = parseFloat(volume ?? item.volume);
  const h = parseFloat(harga_satuan ?? item.harga_satuan);
  db.prepare(`
    UPDATE rab_items SET uraian=?, volume=?, satuan=?, harga_satuan=?, subtotal=?, division_id=? WHERE id=?
  `).run(uraian ?? item.uraian, v, satuan ?? item.satuan, h, v * h, division_id ?? item.division_id, req.params.id);
  res.json(db.prepare('SELECT * FROM rab_items WHERE id = ?').get(req.params.id));
});

router.delete('/items/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM rab_items WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
