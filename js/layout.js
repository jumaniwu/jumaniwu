/**
 * Layout — algoritma auto-layout siteplan.
 * Murni (tanpa DOM). Bekerja di "frame kerja": boundary dirotasi sehingga
 * sisi terpanjang (frontage utama) horizontal di bawah, lalu semua elemen
 * dibangun dari persegi axis-aligned dan dirotasi kembali di akhir.
 */
(function (root) {
  'use strict';

  var Geom = root.Geom || (typeof require !== 'undefined' ? require('./geometry.js') : null);

  var MIN_PARCEL_AREA = 1;    // m² — sliver di bawah ini dibuang
  var MIN_KAVLING_KEEP = 10;  // fasum/RTH tidak boleh memakan kavling hingga di bawah ini

  function defaultParams() {
    return {
      lot: { w: 6, d: 12 },
      road: { main: 8, secondary: 6 },
      rthPct: 10,
      fasumPct: 5,
      commercial: { enabled: false, w: 5, d: 15, maxCount: 10 },
      blockMaxLen: 60
    };
  }

  /* ---------------- Frame ---------------- */

  function _computeFrame(boundary) {
    if (!boundary || boundary.length < 3) {
      throw new Error('Minimal 3 titik koordinat diperlukan.');
    }
    var pts = Geom.ensureCCW(boundary);
    if (!Geom.isSimplePolygon(pts)) {
      throw new Error('Polygon batas lahan saling berpotongan (self-intersecting). Periksa urutan titik.');
    }
    var theta = Geom.longestEdgeAngle(pts);
    var origin = Geom.centroid(pts);
    var rot = Geom.rotatePoints(pts, -theta, origin);
    // pastikan sisi terpanjang berada di bawah (frontage utama = tepi bawah)
    var longestMidY = _longestEdgeMidY(rot);
    var c = Geom.centroid(rot);
    if (longestMidY > c[1]) {
      theta += Math.PI;
      rot = Geom.rotatePoints(pts, -theta, origin);
    }
    return { theta: theta, origin: origin, rotBoundary: rot, bbox: Geom.bbox(rot) };
  }

  function _longestEdgeMidY(pts) {
    var bestLen = -1, midY = 0;
    for (var i = 0, n = pts.length; i < n; i++) {
      var a = pts[i], b = pts[(i + 1) % n];
      var len = Geom.dist(a, b);
      if (len > bestLen) { bestLen = len; midY = (a[1] + b[1]) / 2; }
    }
    return midY;
  }

  /* ---------------- Band horizontal ---------------- */

  /**
   * Pola dari bawah ke atas: jalan → baris (hadap bawah) → baris (hadap atas) → jalan → ...
   * firstRowDepth menimpa kedalaman baris pertama (untuk ruko yang lebih dalam).
   */
  function _buildBands(bb, params, firstRowDepth) {
    var bands = [];
    var d = params.lot.d;
    var y = bb.minY;
    var pair = 0;
    var first = true;
    while (true) {
      var rowD = first && firstRowDepth ? firstRowDepth : d;
      // jalan di depan pasangan baris: frontage utama lebar penuh, sisanya jalan lingkungan
      var road = first ? params.road.main : params.road.secondary;
      bands.push({ kind: 'road', y1: y, y2: y + road, pairIndex: pair });
      y += road;
      if (y + rowD > bb.maxY) break;
      bands.push({ kind: 'row', y1: y, y2: y + rowD, rowFacing: 'down', pairIndex: pair, first: first });
      y += rowD;
      first = false;
      if (y + d <= bb.maxY) {
        bands.push({ kind: 'row', y1: y, y2: y + d, rowFacing: 'up', pairIndex: pair });
        y += d;
      }
      pair++;
      if (y >= bb.maxY) break;
    }
    // buang jalan menggantung di atas yang tidak melayani baris apa pun
    while (bands.length > 1 && bands[bands.length - 1].kind === 'road') bands.pop();
    return bands;
  }

  /* ---------------- Jalan lingkungan vertikal ---------------- */

  function _crossRoadXs(bb, params) {
    var strips = [];
    var period = params.blockMaxLen + params.road.secondary;
    var half = params.road.secondary / 2;
    var cx = (bb.minX + bb.maxX) / 2;
    var margin = params.lot.w; // strip terlalu mepet tepi tidak berguna
    var width = bb.maxX - bb.minX;
    if (width <= params.blockMaxLen) return strips;
    var k = 0;
    while (true) {
      var placed = false;
      var offs = k === 0 ? [0] : [-k * period, k * period];
      for (var i = 0; i < offs.length; i++) {
        var x = cx + offs[i];
        if (x - half > bb.minX + margin && x + half < bb.maxX - margin) {
          strips.push({ x1: x - half, x2: x + half });
          placed = true;
        }
      }
      if (!placed && k > 0) break;
      k++;
      if (k > 100) break;
    }
    strips.sort(function (a, b) { return a.x1 - b.x1; });
    return strips;
  }

  /* ---------------- Iris baris menjadi kavling ---------------- */

  /** intervals dikurangi daftar rentang [x1,x2] yang sudah terpakai. */
  function _subtractIntervals(intervals, occupied) {
    var out = intervals.slice();
    occupied.forEach(function (oc) {
      var next = [];
      out.forEach(function (iv) {
        if (oc[1] <= iv[0] || oc[0] >= iv[1]) { next.push(iv); return; }
        if (oc[0] > iv[0]) next.push([iv[0], oc[0]]);
        if (oc[1] < iv[1]) next.push([oc[1], iv[1]]);
      });
      out = next;
    });
    return out.filter(function (iv) { return iv[1] - iv[0] > 1e-6; });
  }

  function _freeIntervals(bb, crossRoads) {
    var iv = [], x = bb.minX;
    for (var i = 0; i < crossRoads.length; i++) {
      if (crossRoads[i].x1 > x) iv.push([x, crossRoads[i].x1]);
      x = Math.max(x, crossRoads[i].x2);
    }
    if (bb.maxX > x) iv.push([x, bb.maxX]);
    return iv;
  }

  /**
   * Iris satu band baris menjadi sel kavling + remnant.
   * dims: {w, d} — dimensi sel; maxCells opsional (untuk ruko).
   */
  function _sliceRow(band, intervals, rotBoundary, dims, startFromLeft) {
    var cells = [], remnants = [];
    for (var ii = 0; ii < intervals.length; ii++) {
      var a = intervals[ii][0], b = intervals[ii][1];
      var x = a;
      var runCells = [];
      while (x + dims.w <= b + 1e-9) {
        var rect = { x1: x, y1: band.y1, x2: x + dims.w, y2: band.y2 };
        if (Geom.rectFullyInside(rect, rotBoundary)) {
          runCells.push({ rect: rect, band: band });
        } else {
          _pushRemnant(remnants, rotBoundary, rect);
          if (runCells.length) { _markRunEdges(runCells); cells = cells.concat(runCells); runCells = []; }
        }
        x += dims.w;
      }
      if (x < b) _pushRemnant(remnants, rotBoundary, { x1: x, y1: band.y1, x2: b, y2: band.y2 });
      if (runCells.length) { _markRunEdges(runCells); cells = cells.concat(runCells); }
    }
    return { cells: cells, remnants: remnants };
  }

  function _markRunEdges(run) {
    run[0].runEdge = true;
    run[run.length - 1].runEdge = true;
  }

  function _pushRemnant(remnants, rotBoundary, rect) {
    var piece = Geom.clipPolyToRect(rotBoundary, rect);
    if (piece.length >= 3 && Geom.polygonArea(piece) > MIN_PARCEL_AREA) {
      remnants.push(piece);
    }
  }

  /* ---------------- Fasum & RTH ---------------- */

  function _cellArea(cell) {
    return (cell.rect.x2 - cell.rect.x1) * (cell.rect.y2 - cell.rect.y1);
  }

  function _cellCenter(cell) {
    return [(cell.rect.x1 + cell.rect.x2) / 2, (cell.rect.y1 + cell.rect.y2) / 2];
  }

  /** Ambil deretan sel bersebelahan (band sama, x kontigu) di sekitar sel indeks i. */
  function _contiguousRun(cells, seedIdx, needed) {
    var seed = cells[seedIdx];
    var sameBand = [];
    for (var i = 0; i < cells.length; i++) {
      if (cells[i].band === seed.band) sameBand.push(cells[i]);
    }
    sameBand.sort(function (a, b) { return a.rect.x1 - b.rect.x1; });
    var pos = sameBand.indexOf(seed);
    var chosen = [seed];
    var lo = pos - 1, hi = pos + 1;
    while (chosen.length < needed) {
      var extended = false;
      if (hi < sameBand.length && Math.abs(sameBand[hi].rect.x1 - chosen[chosen.length - 1].rect.x2) < 1e-6) {
        chosen.push(sameBand[hi]); hi++; extended = true;
      }
      if (chosen.length < needed && lo >= 0 && Math.abs(sameBand[lo].rect.x2 - chosen[0].rect.x1) < 1e-6) {
        chosen.unshift(sameBand[lo]); lo--; extended = true;
      }
      if (!extended) break;
    }
    return chosen;
  }

  function _mergeRunToRect(run) {
    var x1 = Infinity, x2 = -Infinity;
    for (var i = 0; i < run.length; i++) {
      x1 = Math.min(x1, run[i].rect.x1);
      x2 = Math.max(x2, run[i].rect.x2);
    }
    return { x1: x1, y1: run[0].rect.y1, x2: x2, y2: run[0].rect.y2 };
  }

  /**
   * Alokasi fasum lalu RTH dari sel kavling; remnant otomatis jadi RTH.
   * Mengubah isi array cells (menghapus yang dikonversi).
   */
  function _allocateFasumRth(cells, remnants, totalArea, params, warnings) {
    var fasumParcels = [], rthPolys = remnants.slice();
    var rthArea = 0;
    for (var i = 0; i < rthPolys.length; i++) rthArea += Geom.polygonArea(rthPolys[i]);

    // --- Fasum: deretan sel kontigu terdekat pusat lahan ---
    var fasumTarget = (params.fasumPct / 100) * totalArea;
    if (fasumTarget > 0 && cells.length > MIN_KAVLING_KEEP) {
      var center = [0, 0];
      for (var c = 0; c < cells.length; c++) {
        var cc = _cellCenter(cells[c]);
        center[0] += cc[0]; center[1] += cc[1];
      }
      center[0] /= cells.length; center[1] /= cells.length;
      var seedIdx = 0, bestD = Infinity;
      for (var s = 0; s < cells.length; s++) {
        var d = Geom.dist(_cellCenter(cells[s]), center);
        if (d < bestD) { bestD = d; seedIdx = s; }
      }
      var cellA = _cellArea(cells[seedIdx]);
      var needed = Math.max(1, Math.ceil(fasumTarget / cellA));
      needed = Math.min(needed, cells.length - MIN_KAVLING_KEEP);
      if (needed > 0) {
        var run = _contiguousRun(cells, seedIdx, needed);
        var rect = _mergeRunToRect(run);
        fasumParcels.push({ type: 'fasum', polygon: Geom.rectToPoly(rect), label: 'FASUM' });
        for (var r = 0; r < run.length; r++) cells.splice(cells.indexOf(run[r]), 1);
        var got = (rect.x2 - rect.x1) * (rect.y2 - rect.y1);
        if (got < fasumTarget * 0.9) {
          warnings.push('Target fasum ' + params.fasumPct + '% tidak sepenuhnya tercapai (' +
            (got / totalArea * 100).toFixed(1) + '%).');
        }
      }
    }

    // --- RTH top-up: konversi sel prioritas sampai target ---
    var rthTarget = (params.rthPct / 100) * totalArea;
    if (rthTarget > 0) {
      var candidates = cells.slice().sort(function (a, b) {
        // prioritas: ujung deretan dulu, lalu band paling atas
        var ea = a.runEdge ? 0 : 1, eb = b.runEdge ? 0 : 1;
        if (ea !== eb) return ea - eb;
        return b.rect.y1 - a.rect.y1;
      });
      var converted = [];
      var ci = 0;
      while (rthArea < rthTarget && ci < candidates.length && cells.length > MIN_KAVLING_KEEP) {
        var cell = candidates[ci++];
        var idx = cells.indexOf(cell);
        if (idx === -1) continue;
        cells.splice(idx, 1);
        converted.push(cell);
        rthArea += _cellArea(cell);
      }
      // merge sel RTH yang bersebelahan dalam band yang sama
      var groups = _groupAdjacent(converted);
      for (var g = 0; g < groups.length; g++) {
        rthPolys.push(Geom.rectToPoly(_mergeRunToRect(groups[g])));
      }
      if (rthArea < rthTarget - 1e-6) {
        warnings.push('Target RTH ' + params.rthPct + '% tidak sepenuhnya tercapai (' +
          (rthArea / totalArea * 100).toFixed(1) + '%) agar jumlah kavling tetap wajar.');
      }
    }

    var rthParcels = rthPolys.map(function (poly) {
      return { type: 'rth', polygon: poly, label: 'RTH' };
    });
    return { fasum: fasumParcels, rth: rthParcels };
  }

  function _groupAdjacent(cells) {
    var byBand = new Map();
    cells.forEach(function (c) {
      if (!byBand.has(c.band)) byBand.set(c.band, []);
      byBand.get(c.band).push(c);
    });
    var groups = [];
    byBand.forEach(function (arr) {
      arr.sort(function (a, b) { return a.rect.x1 - b.rect.x1; });
      var cur = [arr[0]];
      for (var i = 1; i < arr.length; i++) {
        if (Math.abs(arr[i].rect.x1 - cur[cur.length - 1].rect.x2) < 1e-6) cur.push(arr[i]);
        else { groups.push(cur); cur = [arr[i]]; }
      }
      groups.push(cur);
    });
    return groups;
  }

  /* ---------------- Statistik ---------------- */

  function _roadArea(rotBoundary, roadBands, crossRoads, bb) {
    var area = 0;
    var hRects = roadBands.map(function (band) {
      return { x1: bb.minX, y1: band.y1, x2: bb.maxX, y2: band.y2 };
    });
    var vRects = crossRoads.map(function (s) {
      return { x1: s.x1, y1: bb.minY, x2: s.x2, y2: bb.maxY };
    });
    var all = hRects.concat(vRects);
    for (var i = 0; i < all.length; i++) {
      var piece = Geom.clipPolyToRect(rotBoundary, all[i]);
      if (piece.length >= 3) area += Geom.polygonArea(piece);
    }
    // koreksi overlap H ∩ V (rect ∩ rect = rect)
    for (var h = 0; h < hRects.length; h++) {
      for (var v = 0; v < vRects.length; v++) {
        var ov = {
          x1: Math.max(hRects[h].x1, vRects[v].x1),
          y1: Math.max(hRects[h].y1, vRects[v].y1),
          x2: Math.min(hRects[h].x2, vRects[v].x2),
          y2: Math.min(hRects[h].y2, vRects[v].y2)
        };
        if (ov.x2 > ov.x1 && ov.y2 > ov.y1) {
          var op = Geom.clipPolyToRect(rotBoundary, ov);
          if (op.length >= 3) area -= Geom.polygonArea(op);
        }
      }
    }
    return area;
  }

  /* ---------------- Pipeline utama ---------------- */

  function generateSiteplan(boundaryPts, params) {
    params = params || defaultParams();
    var warnings = [];

    var frame = _computeFrame(boundaryPts);
    var rotB = frame.rotBoundary;
    var bb = frame.bbox;
    var totalArea = Geom.polygonArea(rotB);

    var minNeeded = params.lot.w * params.lot.d;
    if (totalArea < minNeeded * 4) {
      throw new Error('Luas lahan terlalu kecil (' + totalArea.toFixed(0) +
        ' m²) untuk membentuk siteplan dengan kavling ' + params.lot.w + '×' + params.lot.d + ' m.');
    }

    var com = params.commercial;
    var firstRowDepth = com.enabled && com.d > params.lot.d ? com.d : null;
    var bands = _buildBands(bb, params, firstRowDepth);
    var crossRoads = _crossRoadXs(bb, params);
    var intervals = _freeIntervals(bb, crossRoads);

    var parcels = [];

    // --- Jalan ---
    var roadBands = bands.filter(function (b) { return b.kind === 'road'; });
    roadBands.forEach(function (band) {
      var piece = Geom.clipPolyToRect(rotB, { x1: bb.minX, y1: band.y1, x2: bb.maxX, y2: band.y2 });
      if (piece.length >= 3 && Geom.polygonArea(piece) > MIN_PARCEL_AREA) {
        parcels.push({ type: 'jalan', polygon: piece, label: null });
      }
    });
    crossRoads.forEach(function (s) {
      var piece = Geom.clipPolyToRect(rotB, { x1: s.x1, y1: bb.minY, x2: s.x2, y2: bb.maxY });
      if (piece.length >= 3 && Geom.polygonArea(piece) > MIN_PARCEL_AREA) {
        parcels.push({ type: 'jalan', polygon: piece, label: null });
      }
    });
    var jalanArea = _roadArea(rotB, roadBands, crossRoads, bb);

    // --- Baris kavling & ruko ---
    var rowBands = bands.filter(function (b) { return b.kind === 'row'; });
    var allCells = [], allRemnants = [];
    var comCells = [];
    rowBands.forEach(function (band, bi) {
      if (com.enabled && band.first && comCells.length < com.maxCount) {
        // baris frontage: iris dengan dimensi ruko dulu (dari kiri), sisanya kavling
        var res = _sliceRow(band, intervals, rotB, { w: com.w, d: band.y2 - band.y1 });
        var take = Math.min(com.maxCount, res.cells.length);
        comCells = res.cells.slice(0, take);
        var occupied = comCells.map(function (c) { return [c.rect.x1, c.rect.x2]; });
        var restIntervals = _subtractIntervals(intervals, occupied);
        var res2 = _sliceRow(band, restIntervals, rotB, { w: params.lot.w, d: band.y2 - band.y1 });
        res2.cells.forEach(function (c) { c.bandIndex = bi; allCells.push(c); });
        allRemnants = allRemnants.concat(res2.remnants);
      } else {
        var r = _sliceRow(band, intervals, rotB, { w: params.lot.w, d: band.y2 - band.y1 });
        r.cells.forEach(function (c) { c.bandIndex = bi; allCells.push(c); });
        allRemnants = allRemnants.concat(r.remnants);
      }
    });

    // sisa lahan di atas band terakhir (tidak muat satu baris pun) → remnant/RTH
    var topY = bands.length ? bands[bands.length - 1].y2 : bb.minY;
    if (bb.maxY - topY > 0.01) {
      intervals.forEach(function (iv) {
        _pushRemnant(allRemnants, rotB, { x1: iv[0], y1: topY, x2: iv[1], y2: bb.maxY });
      });
    }

    if (allCells.length === 0 && comCells.length === 0) {
      throw new Error('Tidak ada kavling yang muat di dalam batas lahan. Coba kecilkan ukuran kavling atau lebar jalan.');
    }

    // --- Fasum & RTH ---
    var alloc = _allocateFasumRth(allCells, allRemnants, totalArea, params, warnings);

    // --- Penomoran ---
    var blocks = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var byPair = new Map();
    allCells.forEach(function (c) {
      var p = c.band.pairIndex;
      if (!byPair.has(p)) byPair.set(p, []);
      byPair.get(p).push(c);
    });
    var pairKeys = Array.from(byPair.keys()).sort(function (a, b) { return a - b; });
    pairKeys.forEach(function (pk, i) {
      var letter = blocks[i % blocks.length];
      var arr = byPair.get(pk);
      arr.sort(function (a, b) {
        if (Math.abs(a.rect.y1 - b.rect.y1) > 1e-6) return a.rect.y1 - b.rect.y1;
        return a.rect.x1 - b.rect.x1;
      });
      arr.forEach(function (c, j) {
        c.block = letter;
        c.label = letter + '-' + String(j + 1).padStart(2, '0');
      });
    });
    comCells.forEach(function (c, i) { c.label = 'R-' + String(i + 1).padStart(2, '0'); });

    allCells.forEach(function (c) {
      parcels.push({
        type: 'kavling', polygon: Geom.rectToPoly(c.rect), label: c.label, block: c.block,
        w: +(c.rect.x2 - c.rect.x1).toFixed(2), d: +(c.rect.y2 - c.rect.y1).toFixed(2)
      });
    });
    comCells.forEach(function (c) {
      parcels.push({
        type: 'komersial', polygon: Geom.rectToPoly(c.rect), label: c.label, block: 'R',
        w: +(c.rect.x2 - c.rect.x1).toFixed(2), d: +(c.rect.y2 - c.rect.y1).toFixed(2)
      });
    });
    alloc.fasum.forEach(function (p) { parcels.push(p); });
    alloc.rth.forEach(function (p) { parcels.push(p); });

    // --- Luas & id ---
    parcels.forEach(function (p, i) {
      p.id = i + 1;
      p.areaM2 = +Geom.polygonArea(p.polygon).toFixed(2);
      if (p.label === undefined) p.label = null;
      if (p.block === undefined) p.block = null;
      if (p.w === undefined) p.w = null;
      if (p.d === undefined) p.d = null;
    });

    // --- Rotasi kembali ke koordinat dunia ---
    parcels.forEach(function (p) {
      p.polygon = Geom.rotatePoints(p.polygon, frame.theta, frame.origin);
    });

    // --- Statistik ---
    var byType = { kavling: 0, jalan: 0, rth: 0, fasum: 0, komersial: 0 };
    var counts = { kavling: 0, komersial: 0 };
    parcels.forEach(function (p) {
      if (p.type === 'jalan') return; // jalan dihitung dari jalanArea (koreksi overlap)
      byType[p.type] += p.areaM2;
      if (p.type === 'kavling') counts.kavling++;
      if (p.type === 'komersial') counts.komersial++;
    });
    byType.jalan = jalanArea;

    var stats = { totalAreaM2: +totalArea.toFixed(2), counts: counts, byType: {}, efficiencyPct: 0 };
    Object.keys(byType).forEach(function (t) {
      stats.byType[t] = {
        area: +byType[t].toFixed(2),
        pct: +(byType[t] / totalArea * 100).toFixed(2)
      };
    });
    stats.efficiencyPct = +((byType.kavling + byType.komersial) / totalArea * 100).toFixed(2);

    var sumPct = Object.keys(stats.byType).reduce(function (s, t) { return s + stats.byType[t].pct; }, 0);
    if (sumPct < 96 || sumPct > 104) {
      warnings.push('Cek internal: total persentase penggunaan lahan ' + sumPct.toFixed(1) +
        '% (ada sisa lahan yang tidak teralokasi).');
    }

    return {
      boundary: Geom.ensureCCW(boundaryPts),
      theta: frame.theta,
      parcels: parcels,
      stats: stats,
      params: params,
      warnings: warnings
    };
  }

  var Layout = {
    generateSiteplan: generateSiteplan,
    defaultParams: defaultParams,
    _computeFrame: _computeFrame,
    _buildBands: _buildBands,
    _crossRoadXs: _crossRoadXs
  };

  root.Layout = Layout;
  if (typeof module !== 'undefined' && module.exports) module.exports = Layout;
})(typeof window !== 'undefined' ? window : globalThis);
