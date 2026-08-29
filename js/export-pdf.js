/**
 * ExportPDF — dokumen A4 landscape: gambar siteplan + tabel ringkasan.
 * jsPDF dimuat lazy dari CDN saat pertama dipakai; kegagalan non-fatal.
 */
(function (root) {
  'use strict';

  var JSPDF_URL = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js';
  var loading = null;

  function loadJsPDF() {
    if (root.jspdf && root.jspdf.jsPDF) return Promise.resolve(root.jspdf.jsPDF);
    if (!loading) {
      loading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = JSPDF_URL;
        s.onload = function () {
          if (root.jspdf && root.jspdf.jsPDF) resolve(root.jspdf.jsPDF);
          else reject(new Error('jsPDF tidak tersedia setelah dimuat.'));
        };
        s.onerror = function () {
          loading = null;
          reject(new Error('Gagal memuat jsPDF (butuh koneksi internet).'));
        };
        document.head.appendChild(s);
      });
    }
    return loading;
  }

  var TYPE_LABELS = {
    kavling: 'Kavling Rumah',
    komersial: 'Komersial (Ruko)',
    jalan: 'Jalan',
    fasum: 'Fasum / Fasos',
    rth: 'RTH / Taman'
  };

  function download(result, filenameBase) {
    loadJsPDF().then(function (jsPDF) {
      var doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      var pageW = 297, pageH = 210, margin = 12;

      // Judul
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('Siteplan', margin, margin + 4);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      var today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      doc.text('Dibuat: ' + today + '  ·  Total luas lahan: ' +
        result.stats.totalAreaM2.toLocaleString('id-ID') + ' m²', margin, margin + 10);

      // Gambar siteplan (area kiri)
      var canvas = ExportPNG.renderToCanvas(result);
      var imgW = 190, imgH = imgW * canvas.height / canvas.width;
      var maxH = pageH - margin * 2 - 16;
      if (imgH > maxH) { imgH = maxH; imgW = imgH * canvas.width / canvas.height; }
      doc.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin + 16, imgW, imgH);

      // Tabel ringkasan (area kanan)
      var tx = margin + imgW + 10;
      var ty = margin + 20;
      var colW = [40, 14, 22, 14];
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Ringkasan', tx, ty);
      ty += 6;
      doc.setFontSize(8);
      var headers = ['Kategori', 'Jumlah', 'Luas (m²)', '%'];
      var x = tx;
      headers.forEach(function (h, i) { doc.text(h, x, ty); x += colW[i]; });
      ty += 1.5;
      doc.line(tx, ty, tx + colW.reduce(function (a, b) { return a + b; }, 0), ty);
      ty += 4;
      doc.setFont('helvetica', 'normal');
      ['kavling', 'komersial', 'jalan', 'fasum', 'rth'].forEach(function (t) {
        var s = result.stats.byType[t];
        if (!s || s.area < 0.5) return;
        var count = t === 'kavling' ? String(result.stats.counts.kavling)
          : t === 'komersial' ? String(result.stats.counts.komersial) : '-';
        var row = [TYPE_LABELS[t], count, s.area.toLocaleString('id-ID', { maximumFractionDigits: 0 }), s.pct.toFixed(1)];
        x = tx;
        row.forEach(function (cell, i) { doc.text(String(cell), x, ty); x += colW[i]; });
        ty += 5;
      });
      ty += 2;
      doc.setFont('helvetica', 'bold');
      doc.text('Efisiensi lahan: ' + result.stats.efficiencyPct.toFixed(1) + '%', tx, ty);
      ty += 8;

      // Rekap parameter
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Parameter', tx, ty);
      ty += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      var prm = result.params;
      var lines = [
        'Kavling: ' + prm.lot.w + ' × ' + prm.lot.d + ' m',
        'Jalan utama: ' + prm.road.main + ' m · lingkungan: ' + prm.road.secondary + ' m',
        'Panjang blok maks: ' + prm.blockMaxLen + ' m',
        'Target RTH: ' + prm.rthPct + '% · fasum: ' + prm.fasumPct + '%'
      ];
      if (prm.commercial && prm.commercial.enabled) {
        lines.push('Ruko: ' + prm.commercial.w + ' × ' + prm.commercial.d +
          ' m (maks ' + prm.commercial.maxCount + ')');
      }
      lines.forEach(function (l) { doc.text(l, tx, ty); ty += 4.5; });

      doc.save((filenameBase || 'siteplan') + '.pdf');
    }).catch(function (err) {
      alert('Export PDF gagal: ' + err.message);
    });
  }

  root.ExportPDF = { download: download };
})(typeof window !== 'undefined' ? window : globalThis);
