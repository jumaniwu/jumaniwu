/**
 * Unit test Node untuk Geom + Layout (tanpa browser).
 * Jalankan: node test/unit.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const Geom = require('../js/geometry.js');
const Layout = require('../js/layout.js');
const Presets = require('../js/presets.js');

let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error('  ✗ GAGAL:', msg); }
}
function section(name) { console.log('•', name); }

/* ---------- Geometri ---------- */
section('Geom.polygonArea / signedArea');
const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
assert(Math.abs(Geom.polygonArea(square) - 100) < 1e-9, 'luas persegi 10x10 = 100');
assert(Geom.signedArea(square) > 0, 'CCW → luas bertanda positif');
const tri = [[0, 0], [4, 0], [0, 3]];
assert(Math.abs(Geom.polygonArea(tri) - 6) < 1e-9, 'luas segitiga 4x3/2 = 6');

section('Geom.ensureCCW');
const cw = [[0, 0], [0, 10], [10, 10], [10, 0]];
assert(Geom.signedArea(Geom.ensureCCW(cw)) > 0, 'CW dibalik menjadi CCW');

section('Geom.pointInPolygon');
assert(Geom.pointInPolygon([5, 5], square), 'titik tengah di dalam');
assert(!Geom.pointInPolygon([15, 5], square), 'titik luar di luar');
assert(Geom.pointInPolygon([0, 5], square), 'titik di tepi dianggap di dalam');
const concave = [[0, 0], [10, 0], [10, 10], [6, 10], [6, 4], [4, 4], [4, 10], [0, 10]];
assert(!Geom.pointInPolygon([5, 8], concave), 'titik dalam takik (notch) di luar');
assert(Geom.pointInPolygon([2, 8], concave), 'titik samping takik di dalam');

section('Geom.isSimplePolygon');
assert(Geom.isSimplePolygon(square), 'persegi = simple');
const bowtie = [[0, 0], [10, 10], [10, 0], [0, 10]];
assert(!Geom.isSimplePolygon(bowtie), 'bowtie terdeteksi self-intersect');

section('Geom.clipPolyToRect');
let clipped = Geom.clipPolyToRect(square, { x1: 0, y1: 0, x2: 5, y2: 10 });
assert(Math.abs(Geom.polygonArea(clipped) - 50) < 1e-9, 'clip setengah persegi → luas 50');
clipped = Geom.clipPolyToRect(square, { x1: 20, y1: 20, x2: 30, y2: 30 });
assert(clipped.length === 0, 'clip di luar → kosong');
clipped = Geom.clipPolyToRect(concave, { x1: 0, y1: 0, x2: 10, y2: 3 });
assert(Math.abs(Geom.polygonArea(clipped) - 30) < 1e-9, 'clip concave di bawah takik → luas 30');
clipped = Geom.clipPolyToRect(concave, { x1: 0, y1: 5, x2: 10, y2: 10 });
// dua kaki 4x5 + jembatan nol-lebar; luas tetap 2*(4*5)=40
assert(Math.abs(Geom.polygonArea(clipped) - 40) < 1e-6, 'clip concave memotong takik → luas 40 (jembatan SH)');

section('Geom.rectFullyInside');
assert(Geom.rectFullyInside({ x1: 1, y1: 1, x2: 9, y2: 9 }, square), 'rect dalam persegi');
assert(!Geom.rectFullyInside({ x1: 5, y1: 5, x2: 15, y2: 9 }, square), 'rect keluar batas');
assert(!Geom.rectFullyInside({ x1: 3, y1: 5, x2: 7, y2: 9 }, concave), 'rect menabrak takik');
assert(Geom.rectFullyInside({ x1: 0.5, y1: 0.5, x2: 3.5, y2: 9 }, concave), 'rect di kaki kiri concave');

section('Geom.rotatePoints / longestEdgeAngle');
const rot = Geom.rotatePoints([[1, 0]], Math.PI / 2, [0, 0]);
assert(Math.abs(rot[0][0]) < 1e-9 && Math.abs(rot[0][1] - 1) < 1e-9, 'rotasi 90° benar');
assert(Math.abs(Geom.longestEdgeAngle([[0, 0], [10, 0], [5, 3]])) < 1e-9, 'sisi terpanjang horizontal → sudut 0');

/* ---------- Layout ---------- */
function checkSiteplan(name, coords, params) {
  section('Layout: ' + name);
  const result = Layout.generateSiteplan(coords, params);
  const boundary = result.boundary;
  const kavling = result.parcels.filter(p => p.type === 'kavling');
  const komersial = result.parcels.filter(p => p.type === 'komersial');

  assert(kavling.length > 0, 'ada kavling terbentuk (' + kavling.length + ')');
  assert(result.stats.counts.kavling === kavling.length, 'stats.counts.kavling konsisten');

  // semua vertex kavling/komersial di dalam boundary (dengan sedikit shrink ke centroid)
  let allInside = true;
  for (const p of [...kavling, ...komersial]) {
    const c = Geom.centroid(p.polygon);
    for (const v of p.polygon) {
      const shrunk = [v[0] + (c[0] - v[0]) * 0.01, v[1] + (c[1] - v[1]) * 0.01];
      if (!Geom.pointInPolygon(shrunk, boundary)) { allInside = false; break; }
    }
    if (!allInside) break;
  }
  assert(allInside, 'semua kavling/komersial di dalam batas lahan');

  // tidak ada kavling tumpang tindih: centroid satu tidak di dalam yang lain
  let overlap = false;
  const lots = [...kavling, ...komersial];
  for (let i = 0; i < lots.length && !overlap; i++) {
    const ci = Geom.centroid(lots[i].polygon);
    for (let j = 0; j < lots.length; j++) {
      if (i !== j && Geom.pointInPolygon(ci, lots[j].polygon, 1e-12)) { overlap = true; break; }
    }
  }
  assert(!overlap, 'tidak ada kavling tumpang tindih');

  // persentase masuk akal
  const sumPct = Object.values(result.stats.byType).reduce((s, t) => s + t.pct, 0);
  assert(sumPct > 90 && sumPct < 105, 'total persentase penggunaan lahan wajar (' + sumPct.toFixed(1) + '%)');

  // RTH mencapai target atau ada warning
  const rthOk = result.stats.byType.rth.pct >= (params?.rthPct ?? 10) - 2 ||
    result.warnings.some(w => w.includes('RTH'));
  assert(rthOk, 'RTH mencapai target atau ada peringatan (RTH=' + result.stats.byType.rth.pct + '%)');

  assert(result.stats.efficiencyPct > 20, 'efisiensi lahan > 20% (' + result.stats.efficiencyPct + '%)');

  // label unik untuk kavling
  const labels = new Set(kavling.map(p => p.label));
  assert(labels.size === kavling.length, 'label kavling unik');

  console.log('   →', kavling.length, 'kavling,', komersial.length, 'ruko,',
    'efisiensi', result.stats.efficiencyPct + '%,',
    'RTH', result.stats.byType.rth.pct + '%,',
    'jalan', result.stats.byType.jalan.pct + '%,',
    'warnings:', result.warnings.length);
  return result;
}

const p1 = Layout.defaultParams();
checkSiteplan(Presets[0].name, Presets[0].coords, p1);

const p2 = Layout.defaultParams();
checkSiteplan(Presets[1].name + ' (concave)', Presets[1].coords, p2);

const p3 = Layout.defaultParams();
p3.commercial = { enabled: true, w: 5, d: 15, maxCount: 8 };
const r3 = checkSiteplan(Presets[0].name + ' + ruko', Presets[0].coords, p3);
assert(r3.parcels.filter(p => p.type === 'komersial').length > 0, 'ruko terbentuk saat komersial aktif');
assert(r3.parcels.filter(p => p.type === 'komersial').length <= 8, 'jumlah ruko ≤ maxCount');

// lahan miring (frontage tidak horizontal) — uji rotasi frame
const rotated = Geom.rotatePoints(Presets[0].coords, 0.6, [0, 0]);
checkSiteplan('Lahan dirotasi 0.6 rad', rotated, Layout.defaultParams());

// error handling
section('Layout: validasi input');
let threw = false;
try { Layout.generateSiteplan([[0, 0], [1, 0]], Layout.defaultParams()); } catch (e) { threw = true; }
assert(threw, 'kurang dari 3 titik → error');
threw = false;
try { Layout.generateSiteplan([[0, 0], [10, 10], [10, 0], [0, 10]], Layout.defaultParams()); } catch (e) { threw = true; }
assert(threw, 'polygon self-intersect → error');
threw = false;
try { Layout.generateSiteplan([[0, 0], [10, 0], [10, 10], [0, 10]], Layout.defaultParams()); } catch (e) { threw = true; }
assert(threw, 'lahan terlalu kecil → error');

/* ---------- OCRScan.parseCoords ---------- */
const OCRScan = require('../js/ocr-scan.js');

section('OCRScan.parseCoords: format sederhana');
let ocr = OCRScan.parseCoords('0,0\n120,0\n115,85\n5,80');
assert(ocr.points.length === 4, '4 titik terbaca');
assert(ocr.offset === null, 'tanpa offset untuk angka kecil');
assert(ocr.points[2][0] === 115 && ocr.points[2][1] === 85, 'nilai titik benar');

section('OCRScan.parseCoords: tabel Surat Ukur (No X Y) + UTM');
ocr = OCRScan.parseCoords(
  'DAFTAR KOORDINAT\n' +
  '1 698450.25 9214300.10\n' +
  '2 698570.00 9214310.50\n' +
  '3 698560.75 9214395.00\n' +
  '4 698455.00 9214390.25\n'
);
assert(ocr.points.length === 4, '4 titik dari tabel bernomor');
assert(ocr.offset !== null, 'offset UTM terdeteksi');
assert(Math.abs(ocr.points[0][0] - 0) < 1e-6, 'titik pertama ternormalisasi ke ~0');
assert(Math.abs(ocr.points[1][0] - 119.75) < 1e-6, 'jarak relatif dipertahankan');

section('OCRScan.parseCoords: pemisah ribuan gaya Indonesia');
ocr = OCRScan.parseCoords('1 698.450,25 9.214.300,10\n2 698.570,00 9.214.310,50\n3 698.560,00 9.214.395,00');
assert(ocr.points.length === 3, '3 titik terbaca (format id-ID)');
assert(Math.abs((ocr.points[1][0] - ocr.points[0][0]) - 119.75) < 1e-6, 'nilai id-ID diparse benar');

section('OCRScan.parseCoords: salah baca OCR umum');
ocr = OCRScan.parseCoords('1 1O0 2OO\n2 15l 210\n3 120 30O');
assert(ocr.points.length === 3, 'O→0 dan l→1 dikoreksi');
assert(ocr.points[0][0] === 100 && ocr.points[0][1] === 200, 'nilai terkoreksi benar');

section('OCRScan.parseCoords: baris sampah diabaikan');
ocr = OCRScan.parseCoords('SURAT UKUR\nNomor: 123\n\n1 10 20\n2 30 40\n3 50 10\ncatatan kaki');
assert(ocr.points.length >= 3, 'baris non-koordinat tidak merusak parsing');

/* ---------- ExportDXF.build ---------- */
const ExportDXF = require('../js/export-dxf.js');
section('ExportDXF.build');
const dxfResult = Layout.generateSiteplan(Presets[0].coords, Layout.defaultParams());
const dxf = ExportDXF.build(dxfResult);
assert(dxf.startsWith('0\nSECTION'), 'mulai dengan SECTION');
assert(dxf.trimEnd().endsWith('EOF'), 'diakhiri EOF');
for (const layer of ['BOUNDARY', 'JALAN', 'KAVLING', 'RTH', 'FASUM', 'KOMERSIAL', 'LABEL']) {
  assert(dxf.includes('\n' + layer + '\n'), 'layer ' + layer + ' ada');
}
const nPolylines = (dxf.match(/\nPOLYLINE\n/g) || []).length;
assert(nPolylines === dxfResult.parcels.length + 1, 'jumlah POLYLINE = parcels + boundary (' + nPolylines + ')');
const nSeqend = (dxf.match(/\nSEQEND\n/g) || []).length;
assert(nSeqend === nPolylines, 'setiap POLYLINE ditutup SEQEND');
const nTexts = (dxf.match(/\nTEXT\n/g) || []).length;
const nLabels = dxfResult.parcels.filter(p => p.label).length;
assert(nTexts === nLabels, 'jumlah TEXT = jumlah label (' + nTexts + ')');

console.log('\nHasil:', passed, 'lulus,', failed, 'gagal');
process.exit(failed ? 1 : 0);
