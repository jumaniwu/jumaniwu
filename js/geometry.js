/**
 * Geom — primitif geometri murni untuk SitePlan Generator.
 * Point: [x, y] dalam meter, konvensi matematika (sumbu Y ke utara/atas).
 * Tidak menyentuh DOM sehingga bisa diuji langsung di Node.
 */
(function (root) {
  'use strict';

  var EPS = 1e-9;

  /** Luas bertanda (shoelace). Positif jika CCW. */
  function signedArea(pts) {
    var s = 0;
    for (var i = 0, n = pts.length; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return s / 2;
  }

  function polygonArea(pts) {
    return Math.abs(signedArea(pts));
  }

  /** Pastikan urutan titik berlawanan arah jarum jam (CCW). */
  function ensureCCW(pts) {
    return signedArea(pts) < 0 ? pts.slice().reverse() : pts.slice();
  }

  function centroid(pts) {
    var a = signedArea(pts);
    if (Math.abs(a) < EPS) { // degenerate: rata-rata titik
      var sx = 0, sy = 0;
      for (var j = 0; j < pts.length; j++) { sx += pts[j][0]; sy += pts[j][1]; }
      return [sx / pts.length, sy / pts.length];
    }
    var cx = 0, cy = 0;
    for (var i = 0, n = pts.length; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % n];
      var cross = p[0] * q[1] - q[0] * p[1];
      cx += (p[0] + q[0]) * cross;
      cy += (p[1] + q[1]) * cross;
    }
    return [cx / (6 * a), cy / (6 * a)];
  }

  function bbox(pts) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p[0] < minX) minX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] > maxY) maxY = p[1];
    }
    return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
  }

  function dist(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  /** Ray casting; titik tepat di tepi dianggap di dalam (toleransi eps). */
  function pointInPolygon(p, poly, eps) {
    eps = eps === undefined ? 1e-9 : eps;
    var x = p[0], y = p[1], inside = false;
    for (var i = 0, n = poly.length, j = n - 1; i < n; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      // cek titik di segmen tepi
      if (pointOnSegment(p, poly[j], poly[i], eps)) return true;
      if ((yi > y) !== (yj > y)) {
        var xInt = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (x < xInt) inside = !inside;
      }
    }
    return inside;
  }

  function pointOnSegment(p, a, b, eps) {
    eps = eps === undefined ? 1e-9 : eps;
    var cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    var len = dist(a, b);
    if (len < eps) return dist(p, a) < eps;
    if (Math.abs(cross) / len > eps) return false;
    var dot = (p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1]);
    return dot >= -eps && dot <= len * len + eps;
  }

  /** Perpotongan "proper" dua segmen (termasuk sentuh ujung). */
  function segIntersects(a1, a2, b1, b2) {
    function orient(p, q, r) {
      var v = (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
      if (v > EPS) return 1;
      if (v < -EPS) return -1;
      return 0;
    }
    var o1 = orient(a1, a2, b1), o2 = orient(a1, a2, b2);
    var o3 = orient(b1, b2, a1), o4 = orient(b1, b2, a2);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && pointOnSegment(b1, a1, a2)) return true;
    if (o2 === 0 && pointOnSegment(b2, a1, a2)) return true;
    if (o3 === 0 && pointOnSegment(a1, b1, b2)) return true;
    if (o4 === 0 && pointOnSegment(a2, b1, b2)) return true;
    return false;
  }

  /** Apakah polygon sederhana (tidak self-intersect antar sisi non-bersebelahan). */
  function isSimplePolygon(pts) {
    var n = pts.length;
    for (var i = 0; i < n; i++) {
      for (var j = i + 1; j < n; j++) {
        // lewati sisi bersebelahan (berbagi titik)
        if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
        if (segIntersects(pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n])) return false;
      }
    }
    return true;
  }

  function rotatePoints(pts, theta, origin) {
    var c = Math.cos(theta), s = Math.sin(theta);
    var ox = origin ? origin[0] : 0, oy = origin ? origin[1] : 0;
    var out = new Array(pts.length);
    for (var i = 0; i < pts.length; i++) {
      var x = pts[i][0] - ox, y = pts[i][1] - oy;
      out[i] = [ox + x * c - y * s, oy + x * s + y * c];
    }
    return out;
  }

  /** Sudut (rad) sisi terpanjang polygon. */
  function longestEdgeAngle(pts) {
    var best = 0, bestLen = -1;
    for (var i = 0, n = pts.length; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var len = dist(a, b);
      if (len > bestLen) {
        bestLen = len;
        best = Math.atan2(b[1] - a[1], b[0] - a[0]);
      }
    }
    return best;
  }

  function rectToPoly(r) {
    return [[r.x1, r.y1], [r.x2, r.y1], [r.x2, r.y2], [r.x1, r.y2]];
  }

  /**
   * Sutherland–Hodgman: clip polygon (boleh cekung) terhadap rect axis-aligned.
   * Mengembalikan Point[] (bisa kosong).
   */
  function clipPolyToRect(poly, rect) {
    var out = poly;
    out = clipHalfPlane(out, function (p) { return p[0] >= rect.x1; }, function (a, b) {
      var t = (rect.x1 - a[0]) / (b[0] - a[0]);
      return [rect.x1, a[1] + t * (b[1] - a[1])];
    });
    if (!out.length) return [];
    out = clipHalfPlane(out, function (p) { return p[0] <= rect.x2; }, function (a, b) {
      var t = (rect.x2 - a[0]) / (b[0] - a[0]);
      return [rect.x2, a[1] + t * (b[1] - a[1])];
    });
    if (!out.length) return [];
    out = clipHalfPlane(out, function (p) { return p[1] >= rect.y1; }, function (a, b) {
      var t = (rect.y1 - a[1]) / (b[1] - a[1]);
      return [a[0] + t * (b[0] - a[0]), rect.y1];
    });
    if (!out.length) return [];
    out = clipHalfPlane(out, function (p) { return p[1] <= rect.y2; }, function (a, b) {
      var t = (rect.y2 - a[1]) / (b[1] - a[1]);
      return [a[0] + t * (b[0] - a[0]), rect.y2];
    });
    return dedupe(out);
  }

  function clipHalfPlane(poly, inside, intersect) {
    var out = [];
    for (var i = 0, n = poly.length; i < n; i++) {
      var cur = poly[i], prev = poly[(i + n - 1) % n];
      var curIn = inside(cur), prevIn = inside(prev);
      if (curIn) {
        if (!prevIn) out.push(intersect(prev, cur));
        out.push(cur);
      } else if (prevIn) {
        out.push(intersect(prev, cur));
      }
    }
    return out;
  }

  function dedupe(pts) {
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length];
      if (dist(p, q) > 1e-7) out.push(p);
    }
    return out.length >= 3 ? out : [];
  }

  /**
   * Uji ketat: rect sepenuhnya di dalam polygon.
   * 4 sudut di dalam (dengan margin inset eps) DAN tidak ada sisi boundary
   * yang memotong sisi rect. Menangkap "notch" yang masuk lewat sisi rect.
   */
  function rectFullyInside(rect, poly, eps) {
    eps = eps === undefined ? 0.01 : eps;
    var r = { x1: rect.x1 + eps, y1: rect.y1 + eps, x2: rect.x2 - eps, y2: rect.y2 - eps };
    if (r.x2 <= r.x1 || r.y2 <= r.y1) return false;
    var corners = rectToPoly(r);
    for (var i = 0; i < 4; i++) {
      if (!pointInPolygon(corners[i], poly)) return false;
    }
    var edges = [
      [corners[0], corners[1]], [corners[1], corners[2]],
      [corners[2], corners[3]], [corners[3], corners[0]]
    ];
    for (var j = 0, n = poly.length; j < n; j++) {
      var a = poly[j], b = poly[(j + 1) % n];
      for (var k = 0; k < 4; k++) {
        if (segIntersects(a, b, edges[k][0], edges[k][1])) return false;
      }
    }
    return true;
  }

  var Geom = {
    signedArea: signedArea,
    polygonArea: polygonArea,
    ensureCCW: ensureCCW,
    centroid: centroid,
    bbox: bbox,
    dist: dist,
    pointInPolygon: pointInPolygon,
    pointOnSegment: pointOnSegment,
    segIntersects: segIntersects,
    isSimplePolygon: isSimplePolygon,
    rotatePoints: rotatePoints,
    longestEdgeAngle: longestEdgeAngle,
    rectToPoly: rectToPoly,
    clipPolyToRect: clipPolyToRect,
    rectFullyInside: rectFullyInside
  };

  root.Geom = Geom;
  if (typeof module !== 'undefined' && module.exports) module.exports = Geom;
})(typeof window !== 'undefined' ? window : globalThis);
