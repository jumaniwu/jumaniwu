/**
 * E2E verifikasi SitePlan Generator (headless Chromium via Playwright).
 * Jalankan: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=<global modules> node test/verify.mjs
 * Prasyarat: server statis di http://localhost:8080 (mis. `http-server -p 8080`).
 */
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://localhost:8080';
const OUT = process.env.OUT_DIR || 'test/out';
fs.mkdirSync(OUT, { recursive: true });

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log('  ✓', msg); }
  else { failed++; console.error('  ✗ GAGAL:', msg); }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Sandbox CI ini tidak boleh mengakses CDN (kebijakan egress), maka:
// - jsPDF di-route ke salinan npm lokal (kode produksi tetap memakai URL CDN)
// - Tesseract di-stub deterministik sebelum alur OCR diuji
const jspdfLocal = path.resolve('node_modules/jspdf/dist/jspdf.umd.min.js');
await page.route('**/cdn.jsdelivr.net/npm/jspdf**', route => route.fulfill({
  contentType: 'application/javascript',
  body: fs.readFileSync(jspdfLocal, 'utf8')
}));

const consoleErrors = [];
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('pageerror', e => consoleErrors.push(String(e)));

console.log('• Muat halaman');
await page.goto(BASE, { waitUntil: 'networkidle' });
assert((await page.title()).includes('SitePlan'), 'judul halaman benar');

console.log('• Generate preset 2 (concave)');
await page.click('#preset2Btn');
await page.click('#generateBtn');
await page.waitForFunction(() => window.__siteplan !== null);

const checks = await page.evaluate(() => {
  const r = window.__siteplan;
  const kavling = r.parcels.filter(p => p.type === 'kavling');
  let allInside = true;
  for (const p of [...kavling, ...r.parcels.filter(q => q.type === 'komersial')]) {
    const c = Geom.centroid(p.polygon);
    for (const v of p.polygon) {
      const shrunk = [v[0] + (c[0] - v[0]) * 0.01, v[1] + (c[1] - v[1]) * 0.01];
      if (!Geom.pointInPolygon(shrunk, r.boundary)) { allInside = false; }
    }
  }
  const sumPct = Object.values(r.stats.byType).reduce((s, t) => s + t.pct, 0);
  return {
    nKavling: kavling.length,
    allInside,
    sumPct,
    rthPct: r.stats.byType.rth.pct,
    warnings: r.warnings.length
  };
});
assert(checks.nKavling > 20, 'kavling > 20 (' + checks.nKavling + ')');
assert(checks.allInside, 'semua kavling di dalam boundary');
assert(checks.sumPct > 90 && checks.sumPct < 105, 'total persentase wajar (' + checks.sumPct.toFixed(1) + '%)');
assert(checks.rthPct >= 8, 'RTH ≥ 8% (' + checks.rthPct + '%)');

const summaryVisible = await page.isVisible('#summaryPanel');
assert(summaryVisible, 'panel ringkasan tampil');
const rowCount = await page.locator('#summaryTable tbody tr').count();
assert(rowCount >= 3, 'tabel ringkasan berisi ≥3 kategori (' + rowCount + ')');

await page.screenshot({ path: path.join(OUT, 'preset2.png') });

console.log('• Interaksi zoom/pan');
const before = await page.locator('#canvas').screenshot();
const box = await page.locator('#canvas').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel(0, -600);
await page.waitForTimeout(200);
const afterZoom = await page.locator('#canvas').screenshot();
assert(!before.equals(afterZoom), 'zoom mengubah tampilan canvas');

await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 60, { steps: 5 });
await page.mouse.up();
await page.waitForTimeout(200);
const afterPan = await page.locator('#canvas').screenshot();
assert(!afterZoom.equals(afterPan), 'pan menggeser tampilan canvas');

console.log('• Tooltip hover');
await page.click('#fitBtn');
await page.waitForTimeout(200);
const lotScreen = await page.evaluate(() => {
  const r = window.__siteplan;
  const lot = r.parcels.find(p => p.type === 'kavling');
  const c = Geom.centroid(lot.polygon);
  return { pos: window.__renderer.worldToScreen(c), label: lot.label };
});
await page.mouse.move(box.x + 5, box.y + 5);
await page.mouse.move(box.x + lotScreen.pos[0], box.y + lotScreen.pos[1], { steps: 3 });
await page.waitForTimeout(150);
const tooltipVisible = await page.isVisible('#tooltip');
const tooltipText = tooltipVisible ? await page.textContent('#tooltip') : '';
assert(tooltipVisible, 'tooltip tampil saat hover kavling');
assert(tooltipText.includes('Kavling'), 'tooltip berisi info kavling (' + tooltipText + ')');

console.log('• Generate preset 1 + ruko');
await page.click('#preset1Btn');
await page.check('#comEnabled');
await page.click('#generateBtn');
await page.waitForTimeout(300);
const ruko = await page.evaluate(() =>
  window.__siteplan.parcels.filter(p => p.type === 'komersial').length);
assert(ruko > 0, 'ruko terbentuk (' + ruko + ')');
await page.screenshot({ path: path.join(OUT, 'preset1-ruko.png') });

console.log('• Export PNG / DXF');
const dl1 = page.waitForEvent('download');
await page.click('#exportPngBtn');
const pngDl = await dl1;
const pngPath = path.join(OUT, 'export.png');
await pngDl.saveAs(pngPath);
assert(fs.statSync(pngPath).size > 50000, 'PNG > 50 KB (' + fs.statSync(pngPath).size + ' B)');

const dl2 = page.waitForEvent('download');
await page.click('#exportDxfBtn');
const dxfDl = await dl2;
const dxfPath = path.join(OUT, 'export.dxf');
await dxfDl.saveAs(dxfPath);
const dxfText = fs.readFileSync(dxfPath, 'utf8');
const nParcels = await page.evaluate(() => window.__siteplan.parcels.length);
const nPoly = (dxfText.match(/\nPOLYLINE\n/g) || []).length;
assert(nPoly === nParcels + 1, 'DXF: POLYLINE = parcels + boundary (' + nPoly + '/' + (nParcels + 1) + ')');
for (const layer of ['BOUNDARY', 'JALAN', 'KAVLING', 'RTH', 'FASUM', 'KOMERSIAL', 'LABEL']) {
  assert(dxfText.includes('\n' + layer + '\n'), 'DXF: layer ' + layer);
}

console.log('• Export PDF (jsPDF via route lokal)');
const dl3 = page.waitForEvent('download', { timeout: 30000 });
await page.click('#exportPdfBtn');
const pdfDl = await dl3;
const pdfPath = path.join(OUT, 'export.pdf');
await pdfDl.saveAs(pdfPath);
const head = fs.readFileSync(pdfPath).subarray(0, 5).toString();
assert(head === '%PDF-', 'PDF valid (header ' + head + ')');

console.log('• Alur OCR dengan gambar dokumen sintetis (Tesseract di-stub)');
{
  // stub mesin OCR: kembalikan teks seperti hasil OCR nyata dari dokumen
  // (termasuk salah baca O→0) — menguji seluruh alur kecuali jaringan CDN
  await page.evaluate(() => {
    window.Tesseract = {
      recognize: async (canvas, lang, opts) => {
        if (opts && opts.logger) {
          opts.logger({ status: 'recognizing text', progress: 0.5 });
          opts.logger({ status: 'recognizing text', progress: 1 });
        }
        return {
          data: {
            text: 'DAFTAR KOORDINAT BIDANG TANAH\n' +
              '1 0 0\n2 15O 10\n3 160 90\n4 90 100\n5 80 60\n6 0 70\n'
          }
        };
      }
    };
  });
  // buat gambar "dokumen" sintetis berisi tabel koordinat
  const docImg = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 900; c.height = 620;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#000';
    x.font = 'bold 34px Arial';
    x.fillText('DAFTAR KOORDINAT BIDANG TANAH', 60, 70);
    x.font = '30px Arial';
    const rows = [
      ['No', 'X (m)', 'Y (m)'],
      ['1', '0', '0'],
      ['2', '150', '10'],
      ['3', '160', '90'],
      ['4', '90', '100'],
      ['5', '80', '60'],
      ['6', '0', '70']
    ];
    rows.forEach((r, i) => {
      x.fillText(r[0], 80, 150 + i * 60);
      x.fillText(r[1], 260, 150 + i * 60);
      x.fillText(r[2], 520, 150 + i * 60);
    });
    return c.toDataURL('image/png');
  });
  const b64 = docImg.split(',')[1];
  const imgPath = path.join(OUT, 'doc-sintetis.png');
  fs.writeFileSync(imgPath, Buffer.from(b64, 'base64'));

  await page.setInputFiles('#scanFile', imgPath);
  await page.waitForSelector('#ocrResult:not(.hidden)', { timeout: 30000 });
  const ocrText = await page.inputValue('#ocrCoords');
  const nLines = ocrText.split('\n').filter(l => l.trim()).length;
  assert(nLines >= 5, 'OCR membaca ≥5 titik (' + nLines + ')');
  assert(ocrText.includes('150,10'), 'salah baca O→0 terkoreksi (150,10 ada)');
  const useEnabled = await page.evaluate(() => !document.getElementById('ocrUseBtn').disabled);
  assert(useEnabled, 'tombol "Gunakan Koordinat" aktif');
  await page.click('#ocrUseBtn');
  const mainCoords = await page.inputValue('#coordsInput');
  assert(mainCoords.trim().length > 0 && mainCoords === ocrText, 'koordinat hasil OCR terisi ke input utama');
  await page.click('#generateBtn');
  await page.waitForTimeout(400);
  const okGen = await page.evaluate(() => window.__siteplan && window.__siteplan.parcels.length > 0);
  assert(okGen, 'siteplan ter-generate dari hasil scan');
  await page.screenshot({ path: path.join(OUT, 'ocr-flow.png') });
}

assert(consoleErrors.length === 0, 'tidak ada error console (' + consoleErrors.join(' | ') + ')');

await browser.close();
console.log('\nHasil E2E:', passed, 'lulus,', failed, 'gagal');
process.exit(failed ? 1 : 0);
