const express = require('express');
const { getDb } = require('../db/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/:projectId', (req, res) => {
  const db = getDb();
  const items = db.prepare('SELECT * FROM rab_items WHERE project_id = ?').all(req.params.projectId);
  const analisa = db.prepare('SELECT * FROM master_analisa WHERE tenant_id = ?').all(req.tenantId);
  const masterHarga = db.prepare('SELECT * FROM master_harga WHERE tenant_id = ?').all(req.tenantId);

  const materialMap = {};
  const tenagaMap = {};

  for (const item of items) {
    // Match analisa by: exact name, or item uraian contains analisa name, or analisa name in item uraian
    const src = analisa.find(a => {
      const aName = a.nama.toLowerCase();
      const iName = item.uraian.toLowerCase();
      return iName === aName || iName.includes(aName) || aName.includes(iName.split('(')[0].trim());
    });

    if (!src || !src.koefisien_json) continue;

    let koef;
    try { koef = JSON.parse(src.koefisien_json); } catch { continue; }

    if (koef.material) {
      for (const m of koef.material) {
        const vol = item.volume * m.koef;
        const mh = masterHarga.find(h => h.nama.toLowerCase() === m.nama.toLowerCase());
        const harga = mh ? mh.harga : 0;
        const key = m.nama;
        if (!materialMap[key]) materialMap[key] = { nama: m.nama, satuan: m.satuan, volume: 0, biaya: 0 };
        materialMap[key].volume += vol;
        materialMap[key].biaya += vol * harga;
      }
    }

    if (koef.tenaga) {
      for (const t of koef.tenaga) {
        const vol = item.volume * t.koef;
        const mh = masterHarga.find(h => h.nama.toLowerCase() === t.posisi.toLowerCase());
        const harga = mh ? mh.harga : 0;
        const key = t.posisi;
        if (!tenagaMap[key]) tenagaMap[key] = { posisi: t.posisi, volume: 0, satuan: t.satuan, jumlah: 0 };
        tenagaMap[key].volume += vol;
        tenagaMap[key].jumlah += vol * harga;
      }
    }
  }

  res.json({
    material: Object.values(materialMap).sort((a, b) => b.biaya - a.biaya),
    tenaga: Object.values(tenagaMap).sort((a, b) => b.jumlah - a.jumlah),
  });
});

module.exports = router;
