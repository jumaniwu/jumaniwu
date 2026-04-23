const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/:projectId', (req, res) => {
  const db = getDb();
  const invoices = db.prepare('SELECT * FROM invoices WHERE project_id = ? ORDER BY created_at DESC').all(req.params.projectId);
  res.json(invoices);
});

router.post('/:projectId', (req, res) => {
  const db = getDb();
  const { no_invoice, keterangan_termin, tanggal_invoice, jatuh_tempo, mode_harga, persentase, nominal } = req.body;
  const totalRab = db.prepare('SELECT COALESCE(SUM(subtotal),0) as t FROM rab_items WHERE project_id = ?').get(req.params.projectId);
  const nom = mode_harga === 'persen' ? (totalRab.t * (parseFloat(persentase) / 100)) : parseFloat(nominal);
  const result = db.prepare(`
    INSERT INTO invoices (project_id, no_invoice, keterangan_termin, tanggal_invoice, jatuh_tempo, mode_harga, persentase, nominal)
    VALUES (?,?,?,?,?,?,?,?)
  `).run(req.params.projectId, no_invoice || ('INV-' + Date.now()), keterangan_termin, tanggal_invoice, jatuh_tempo, mode_harga || 'persen', persentase || 0, nom);
  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const db = getDb();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice tidak ditemukan' });
  const { keterangan_termin, tanggal_invoice, jatuh_tempo, mode_harga, persentase, nominal, status } = req.body;
  db.prepare(`
    UPDATE invoices SET keterangan_termin=?, tanggal_invoice=?, jatuh_tempo=?, mode_harga=?, persentase=?, nominal=?, status=? WHERE id=?
  `).run(keterangan_termin ?? inv.keterangan_termin, tanggal_invoice ?? inv.tanggal_invoice,
    jatuh_tempo ?? inv.jatuh_tempo, mode_harga ?? inv.mode_harga,
    persentase ?? inv.persentase, nominal ?? inv.nominal, status ?? inv.status, req.params.id);
  res.json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
