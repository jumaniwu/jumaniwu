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
    const source = analisa.find(a => a.nama === item.uraian.split('(')[0].trim() || item.analisa_source === 'ahsp_sni');
    if (!source || !source.koefisien_json) continue;

    let koef;
    try { koef = JSON.parse(source.koefisien_json); } catch { continue; }

    if (koef.material) {
      for (const m of koef.material) {
        const vol = item.volume * m.koef;
        const mh = masterHarga.find(h => h.nama === m.nama);
        const harga = mh ? mh.harga : 0;
        if (!materialMap[m.nama]) materialMap[m.nama] = { nama: m.nama, satuan: m.satuan, volume: 0, biaya: 0 };
        materialMap[m.nama].volume += vol;
        materialMap[m.nama].biaya += vol * harga;
      }
    }

    if (koef.tenaga) {
      for (const t of koef.tenaga) {
        const vol = item.volume * t.koef;
        const mh = masterHarga.find(h => h.nama === t.posisi);
        const harga = mh ? mh.harga : 0;
        if (!tenagaMap[t.posisi]) tenagaMap[t.posisi] = { posisi: t.posisi, volume: 0, satuan: t.satuan, jumlah: 0 };
        tenagaMap[t.posisi].volume += vol;
        tenagaMap[t.posisi].jumlah += vol * harga;
      }
    }
  }

  res.json({
    material: Object.values(materialMap),
    tenaga: Object.values(tenagaMap),
  });
});

module.exports = router;
