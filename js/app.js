/**
 * app.js — perekat UI: parsing input, generate, ringkasan, export, OCR.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var els = {
    coords: $('coordsInput'),
    coordsInfo: $('coordsInfo'),
    coordsError: $('coordsError'),
    generate: $('generateBtn'),
    png: $('exportPngBtn'),
    dxf: $('exportDxfBtn'),
    pdf: $('exportPdfBtn'),
    fit: $('fitBtn'),
    empty: $('emptyState'),
    summary: $('summaryPanel'),
    summaryBody: document.querySelector('#summaryTable tbody'),
    summaryFoot: document.querySelector('#summaryTable tfoot'),
    warnings: $('warningList'),
    comEnabled: $('comEnabled'),
    comFields: $('comFields')
  };

  var TYPE_LABELS = {
    kavling: 'Kavling Rumah',
    komersial: 'Komersial (Ruko)',
    jalan: 'Jalan',
    rth: 'RTH / Taman',
    fasum: 'Fasum / Fasos'
  };

  var renderer = new SiteplanRenderer($('canvas'), $('tooltip'));
  var currentResult = null;

  // untuk verifikasi E2E
  window.__renderer = renderer;
  window.__siteplan = null;

  /* ---------- Parsing koordinat ---------- */

  /**
   * Toleran terhadap "x,y", "x y", "x;y", "x<tab>y".
   * Mengembalikan { points, errors[] }.
   */
  function parseCoords(text) {
    var points = [], errors = [];
    var lines = text.split(/\n+/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = line.split(/[,;\t]+|\s+/).filter(Boolean);
      if (parts.length < 2) {
        errors.push('Baris ' + (i + 1) + ': "' + line + '" bukan pasangan angka.');
        continue;
      }
      var x = parseFloat(parts[0]), y = parseFloat(parts[1]);
      if (!isFinite(x) || !isFinite(y)) {
        errors.push('Baris ' + (i + 1) + ': "' + line + '" bukan angka valid.');
        continue;
      }
      points.push([x, y]);
    }
    return { points: points, errors: errors };
  }

  function updateCoordsInfo() {
    var parsed = parseCoords(els.coords.value);
    var info = 'Titik: ' + parsed.points.length;
    if (parsed.points.length >= 3) {
      info += ' · Luas: ±' + formatNum(Geom.polygonArea(parsed.points)) + ' m²';
    }
    els.coordsInfo.textContent = info;
    if (parsed.errors.length) {
      els.coordsError.textContent = parsed.errors.join('\n');
      els.coordsError.classList.remove('hidden');
    } else {
      els.coordsError.classList.add('hidden');
    }
    return parsed;
  }

  function formatNum(n, dec) {
    return Number(n).toLocaleString('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: dec === undefined ? 0 : dec
    });
  }

  /* ---------- Parameter dari form ---------- */

  function readParams() {
    return {
      lot: { w: num('lotW', 6), d: num('lotD', 12) },
      road: { main: num('roadMain', 8), secondary: num('roadSec', 6) },
      rthPct: num('rthPct', 10),
      fasumPct: num('fasumPct', 5),
      commercial: {
        enabled: els.comEnabled.checked,
        w: num('comW', 5),
        d: num('comD', 15),
        maxCount: num('comMax', 10)
      },
      blockMaxLen: num('blockMaxLen', 60)
    };
  }

  function num(id, fallback) {
    var v = parseFloat($(id).value);
    return isFinite(v) && v > 0 ? v : fallback;
  }

  /* ---------- Generate ---------- */

  function generate() {
    var parsed = updateCoordsInfo();
    if (parsed.errors.length) return;
    if (parsed.points.length < 3) {
      showError('Masukkan minimal 3 titik koordinat.');
      return;
    }
    try {
      var result = Layout.generateSiteplan(parsed.points, readParams());
    } catch (e) {
      showError(e.message);
      return;
    }
    currentResult = result;
    window.__siteplan = result;

    els.empty.classList.add('hidden');
    renderer.setData(result);
    renderer.fitToView();

    renderSummary(result);
    [els.png, els.dxf, els.pdf, els.fit].forEach(function (b) { b.disabled = false; });
  }

  function showError(msg) {
    els.coordsError.textContent = msg;
    els.coordsError.classList.remove('hidden');
  }

  /* ---------- Ringkasan ---------- */

  function renderSummary(result) {
    var order = ['kavling', 'komersial', 'jalan', 'fasum', 'rth'];
    var rows = '';
    order.forEach(function (t) {
      var s = result.stats.byType[t];
      if (!s || s.area < 0.5) return;
      var count = t === 'kavling' ? result.stats.counts.kavling
        : t === 'komersial' ? result.stats.counts.komersial : '—';
      rows += '<tr>' +
        '<td><span class="swatch" style="background:' + SiteplanRenderer.COLORS[t].fill + '"></span>' +
        TYPE_LABELS[t] + '</td>' +
        '<td class="num">' + count + '</td>' +
        '<td class="num">' + formatNum(s.area) + '</td>' +
        '<td class="num">' + s.pct.toFixed(1) + '%</td>' +
        '</tr>';
    });
    els.summaryBody.innerHTML = rows;
    els.summaryFoot.innerHTML =
      '<tr><td>Total Luas Lahan</td><td></td>' +
      '<td class="num">' + formatNum(result.stats.totalAreaM2) + '</td><td></td></tr>' +
      '<tr><td colspan="4">Efisiensi Lahan (kavling + komersial): ' +
      result.stats.efficiencyPct.toFixed(1) + '%</td></tr>';

    els.warnings.innerHTML = result.warnings
      .map(function (w) { return '<div class="warning-item">⚠️ ' + w + '</div>'; })
      .join('');
    els.summary.classList.remove('hidden');
    renderer.resize(); // tinggi canvas berubah karena panel ringkasan muncul
    renderer.fitToView();
  }

  /* ---------- Event ---------- */

  els.coords.addEventListener('input', updateCoordsInfo);
  els.generate.addEventListener('click', generate);
  els.fit.addEventListener('click', function () { renderer.fitToView(); });

  $('preset1Btn').addEventListener('click', function () { applyPreset(0); });
  $('preset2Btn').addEventListener('click', function () { applyPreset(1); });

  function applyPreset(i) {
    els.coords.value = Presets[i].coords.map(function (p) { return p[0] + ',' + p[1]; }).join('\n');
    updateCoordsInfo();
  }

  els.comEnabled.addEventListener('change', function () {
    els.comFields.classList.toggle('hidden', !els.comEnabled.checked);
  });

  els.png.addEventListener('click', function () {
    if (currentResult) ExportPNG.download(currentResult, 'siteplan');
  });
  els.dxf.addEventListener('click', function () {
    if (currentResult) ExportDXF.download(currentResult, 'siteplan');
  });
  els.pdf.addEventListener('click', function () {
    if (currentResult) ExportPDF.download(currentResult, 'siteplan');
  });

  // OCR scan
  OCRScan.init({
    scanBtn: $('scanBtn'),
    fileInput: $('scanFile'),
    modal: $('ocrModal'),
    progressWrap: $('ocrProgress'),
    progressBar: $('ocrProgressBar'),
    statusEl: $('ocrStatus'),
    resultWrap: $('ocrResult'),
    coordsEl: $('ocrCoords'),
    infoEl: $('ocrInfo'),
    useBtn: $('ocrUseBtn'),
    cancelBtn: $('ocrCancelBtn'),
    onUse: function (text) {
      els.coords.value = text;
      updateCoordsInfo();
    }
  });

  window.addEventListener('resize', function () {
    renderer.resize();
    if (currentResult) renderer.draw();
  });

  updateCoordsInfo();
})();
