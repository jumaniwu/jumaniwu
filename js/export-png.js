/**
 * ExportPNG — render siteplan ke canvas offscreen resolusi tinggi lalu unduh.
 */
(function (root) {
  'use strict';

  var LONG_SIDE = 3000; // px

  /** Render hasil ke canvas offscreen; dipakai juga oleh export PDF. */
  function renderToCanvas(result) {
    var bb = Geom.bbox(result.boundary);
    var w = bb.maxX - bb.minX, h = bb.maxY - bb.minY;
    var canvas = document.createElement('canvas');
    if (w >= h) {
      canvas.width = LONG_SIDE;
      canvas.height = Math.max(200, Math.round(LONG_SIDE * h / w) + 160);
    } else {
      canvas.height = LONG_SIDE;
      canvas.width = Math.max(200, Math.round(LONG_SIDE * w / h) + 160);
    }
    var r = new SiteplanRenderer(canvas, null, {
      fixedSize: true,
      interactive: false,
      forceLabels: true
    });
    r.setData(result);
    // fitToView memakai draw() (rAF); untuk offscreen gambar sinkron
    var v = { w: canvas.width, h: canvas.height };
    var pad = 0.05;
    var scale = Math.min(
      v.w * (1 - 2 * pad) / Math.max(w, 1e-6),
      v.h * (1 - 2 * pad) / Math.max(h, 1e-6)
    );
    r.scale = scale;
    r.tx = v.w / 2 - (bb.minX + bb.maxX) / 2 * scale;
    r.ty = v.h / 2 + (bb.minY + bb.maxY) / 2 * scale;
    r._fitScale = scale;
    r.drawSync();
    return canvas;
  }

  function download(result, filenameBase) {
    var canvas = renderToCanvas(result);
    canvas.toBlob(function (blob) {
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (filenameBase || 'siteplan') + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
    }, 'image/png');
  }

  root.ExportPNG = { download: download, renderToCanvas: renderToCanvas };
})(typeof window !== 'undefined' ? window : globalThis);
