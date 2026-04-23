const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects WHERE tenant_id = ? ORDER BY created_at DESC').all(req.tenantId);
  // Add RAB totals
  const withTotals = projects.map(p => {
    const total = db.prepare('SELECT COALESCE(SUM(subtotal),0) as total FROM rab_items WHERE project_id = ?').get(p.id);
    return { ...p, total_rab: total.total };
  });
  res.json(withTotals);
});

router.get('/active', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE tenant_id = ? AND active = 1').get(req.tenantId);
  if (!project) return res.json(null);
  const total = db.prepare('SELECT COALESCE(SUM(subtotal),0) as total FROM rab_items WHERE project_id = ?').get(project.id);
  res.json({ ...project, total_rab: total.total });
});

router.post('/', (req, res) => {
  const { name, type, lokasi, pemilik, tanggal_mulai, estimasi_selesai } = req.body;
  if (!name) return res.status(400).json({ error: 'Nama proyek wajib diisi' });
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO projects (tenant_id, name, type, lokasi, pemilik, tanggal_mulai, estimasi_selesai)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(req.tenantId, name, type || 'gedung', lokasi || '', pemilik || '', tanggal_mulai || '', estimasi_selesai || '');
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const { name, type, lokasi, pemilik, tanggal_mulai, estimasi_selesai, status } = req.body;
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  db.prepare(`
    UPDATE projects SET name=?, type=?, lokasi=?, pemilik=?, tanggal_mulai=?, estimasi_selesai=?, status=? WHERE id=?
  `).run(name || project.name, type || project.type, lokasi ?? project.lokasi, pemilik ?? project.pemilik,
    tanggal_mulai ?? project.tanggal_mulai, estimasi_selesai ?? project.estimasi_selesai,
    status || project.status, req.params.id);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/:id/set-active', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE id = ? AND tenant_id = ?').get(req.params.id, req.tenantId);
  if (!project) return res.status(404).json({ error: 'Proyek tidak ditemukan' });
  db.prepare('UPDATE projects SET active = 0 WHERE tenant_id = ?').run(req.tenantId);
  db.prepare('UPDATE projects SET active = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
