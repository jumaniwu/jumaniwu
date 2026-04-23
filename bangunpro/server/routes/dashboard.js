const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const db = getDb();
  const project = db.prepare('SELECT * FROM projects WHERE tenant_id = ? AND active = 1').get(req.tenantId);
  if (!project) return res.json({ project: null });

  const items = db.prepare('SELECT * FROM rab_items WHERE project_id = ?').all(project.id);
  const totalRab = items.reduce((s, i) => s + i.subtotal, 0);
  const itemCount = items.length;

  const tanggalMulai = project.tanggal_mulai ? new Date(project.tanggal_mulai) : new Date();
  const hariBerjalan = Math.floor((new Date() - tanggalMulai) / (1000 * 60 * 60 * 24));

  const analisa = db.prepare('SELECT * FROM master_analisa WHERE tenant_id = ?').all(req.tenantId);
  const masterHarga = db.prepare('SELECT * FROM master_harga WHERE tenant_id = ?').all(req.tenantId);

  let biayaMaterial = 0;
  let biayaUpah = 0;
  for (const item of items) {
    const src = analisa.find(a => a.nama.includes(item.uraian.split('(')[0].trim()));
    if (!src || !src.koefisien_json) continue;
    let koef;
    try { koef = JSON.parse(src.koefisien_json); } catch { continue; }
    if (koef.material) {
      for (const m of koef.material) {
        const mh = masterHarga.find(h => h.nama === m.nama);
        biayaMaterial += item.volume * m.koef * (mh ? mh.harga : 0);
      }
    }
    if (koef.tenaga) {
      for (const t of koef.tenaga) {
        const mh = masterHarga.find(h => h.nama === t.posisi);
        biayaUpah += item.volume * t.koef * (mh ? mh.harga : 0);
      }
    }
  }

  const kurva = db.prepare('SELECT * FROM kurva_s WHERE project_id = ? ORDER BY minggu DESC LIMIT 1').get(project.id);
  const progressPct = kurva ? kurva.realisasi_pct : 0;

  const divisions = db.prepare('SELECT * FROM rab_divisions WHERE project_id = ? ORDER BY sort_order').all(project.id);
  const distribusi = divisions.map(div => {
    const divItems = items.filter(i => i.division_id === div.id);
    const total = divItems.reduce((s, i) => s + i.subtotal, 0);
    return { ...div, item_count: divItems.length, total, pct: totalRab > 0 ? (total / totalRab * 100) : 0 };
  });

  const pareto = [...items].sort((a, b) => b.subtotal - a.subtotal).slice(0, 5).map((item, i) => ({
    ...item, rank: i + 1, pct: totalRab > 0 ? (item.subtotal / totalRab * 100) : 0
  }));

  res.json({ project: { ...project, total_rab: totalRab }, itemCount, hariBerjalan, biayaMaterial, biayaUpah, progressPct, distribusi, pareto });
});

module.exports = router;
