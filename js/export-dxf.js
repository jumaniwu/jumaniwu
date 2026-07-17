/**
 * ExportDXF — generator DXF teks murni (tanpa library).
 * Format R12 (AC1009): POLYLINE/VERTEX/SEQEND tertutup per parcel + TEXT label,
 * layer per kategori, satuan meter ($INSUNITS=6). R12 dipilih karena tidak
 * membutuhkan handle/subclass sehingga diterima semua CAD (AutoCAD, LibreCAD,
 * QCAD, ezdxf). build() murni sehingga bisa diuji di Node.
 */
(function (root) {
  'use strict';

  var GeomRef = root.Geom || (typeof require !== 'undefined' ? require('./geometry.js') : null);

  // [nama layer, warna ACI]
  var LAYERS = [
    ['BOUNDARY', 7],
    ['JALAN', 8],
    ['KAVLING', 30],
    ['RTH', 3],
    ['FASUM', 5],
    ['KOMERSIAL', 6],
    ['LABEL', 2]
  ];

  var TYPE_TO_LAYER = {
    jalan: 'JALAN',
    kavling: 'KAVLING',
    rth: 'RTH',
    fasum: 'FASUM',
    komersial: 'KOMERSIAL'
  };

  function n(v) { return (+v).toFixed(3); }

  function build(result) {
    var out = [];
    function w() { for (var i = 0; i < arguments.length; i++) out.push(arguments[i]); }

    // HEADER
    w('0', 'SECTION', '2', 'HEADER',
      '9', '$ACADVER', '1', 'AC1009',
      '9', '$INSUNITS', '70', '6',
      '0', 'ENDSEC');

    // TABLES → LAYER
    w('0', 'SECTION', '2', 'TABLES',
      '0', 'TABLE', '2', 'LAYER', '70', String(LAYERS.length));
    LAYERS.forEach(function (L) {
      w('0', 'LAYER', '2', L[0], '70', '0', '62', String(L[1]), '6', 'CONTINUOUS');
    });
    w('0', 'ENDTAB', '0', 'ENDSEC');

    // ENTITIES
    w('0', 'SECTION', '2', 'ENTITIES');

    function polyline(layer, pts) {
      w('0', 'POLYLINE', '8', layer, '66', '1', '70', '1');
      pts.forEach(function (p) {
        w('0', 'VERTEX', '8', layer, '10', n(p[0]), '20', n(p[1]), '30', '0');
      });
      w('0', 'SEQEND');
    }

    function text(layer, pos, height, str) {
      w('0', 'TEXT', '8', layer,
        '10', n(pos[0]), '20', n(pos[1]),
        '40', n(height), '1', str,
        '72', '1', '73', '2',
        '11', n(pos[0]), '21', n(pos[1]));
    }

    polyline('BOUNDARY', result.boundary);

    result.parcels.forEach(function (p) {
      polyline(TYPE_TO_LAYER[p.type] || 'KAVLING', p.polygon);
      if (p.label) {
        var c = GeomRef.centroid(p.polygon);
        text('LABEL', c, 1.2, p.label);
      }
    });

    w('0', 'ENDSEC', '0', 'EOF');
    return out.join('\n') + '\n';
  }

  function download(result, filenameBase) {
    var blob = new Blob([build(result)], { type: 'application/dxf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (filenameBase || 'siteplan') + '.dxf';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  var ExportDXF = { build: build, download: download, LAYERS: LAYERS };
  root.ExportDXF = ExportDXF;
  if (typeof module !== 'undefined' && module.exports) module.exports = ExportDXF;
})(typeof window !== 'undefined' ? window : globalThis);
