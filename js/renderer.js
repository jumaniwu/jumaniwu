/**
 * SiteplanRenderer — penggambar siteplan di canvas 2D.
 * Transform: sx = x*scale + tx ; sy = -y*scale + ty (Y dunia ke utara/atas).
 * Dipakai juga oleh exporter PNG dengan canvas offscreen (interactive: false).
 */
(function (root) {
  'use strict';

  var COLORS = {
    kavling:   { fill: '#ffe0b2', stroke: '#c8935a' },
    komersial: { fill: '#ce93d8', stroke: '#8e5a9e' },
    jalan:     { fill: '#b0bec5', stroke: '#8fa0a8' },
    rth:       { fill: '#81c784', stroke: '#4e9553' },
    fasum:     { fill: '#64b5f6', stroke: '#3d7fb5' },
    boundary:  { stroke: '#22303c' }
  };

  var LEGEND_ITEMS = [
    ['kavling', 'Kavling Rumah'],
    ['komersial', 'Komersial (Ruko)'],
    ['jalan', 'Jalan'],
    ['fasum', 'Fasum / Fasos'],
    ['rth', 'RTH / Taman']
  ];

  function SiteplanRenderer(canvas, tooltipEl, opts) {
    this.canvas = canvas;
    this.tooltip = tooltipEl || null;
    this.opts = opts || {};
    this.ctx = canvas.getContext('2d');
    this.result = null;
    this.scale = 1;   // px per meter
    this.tx = 0;
    this.ty = 0;
    this.hovered = null;
    this._raf = 0;
    if (!this.opts.fixedSize) this.resize();
    if (this.opts.interactive !== false) this._bindEvents();
  }

  SiteplanRenderer.COLORS = COLORS;

  SiteplanRenderer.prototype.resize = function () {
    if (this.opts.fixedSize) return;
    var dpr = window.devicePixelRatio || 1;
    var w = this.canvas.clientWidth || 1;
    var h = this.canvas.clientHeight || 1;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
  };

  SiteplanRenderer.prototype._viewSize = function () {
    var dpr = this.opts.fixedSize ? 1 : (this.dpr || 1);
    return { w: this.canvas.width / dpr, h: this.canvas.height / dpr, dpr: dpr };
  };

  SiteplanRenderer.prototype.setData = function (result) {
    this.result = result;
    this.hovered = null;
  };

  SiteplanRenderer.prototype.fitToView = function () {
    if (!this.result) return;
    var bb = Geom.bbox(this.result.boundary);
    var v = this._viewSize();
    var pad = 0.08;
    var sw = v.w * (1 - 2 * pad) / Math.max(bb.maxX - bb.minX, 1e-6);
    var sh = v.h * (1 - 2 * pad) / Math.max(bb.maxY - bb.minY, 1e-6);
    this.scale = Math.min(sw, sh);
    var cx = (bb.minX + bb.maxX) / 2, cy = (bb.minY + bb.maxY) / 2;
    this.tx = v.w / 2 - cx * this.scale;
    this.ty = v.h / 2 + cy * this.scale;
    this._fitScale = this.scale;
    this.draw();
  };

  SiteplanRenderer.prototype.worldToScreen = function (p) {
    return [p[0] * this.scale + this.tx, -p[1] * this.scale + this.ty];
  };

  SiteplanRenderer.prototype.screenToWorld = function (p) {
    return [(p[0] - this.tx) / this.scale, -(p[1] - this.ty) / this.scale];
  };

  /* ---------------- Menggambar ---------------- */

  SiteplanRenderer.prototype.draw = function () {
    if (this._raf) return;
    var self = this;
    this._raf = requestAnimationFrame(function () {
      self._raf = 0;
      self._drawNow();
    });
  };

  SiteplanRenderer.prototype.drawSync = function () {
    this._drawNow();
  };

  SiteplanRenderer.prototype._drawNow = function () {
    var ctx = this.ctx;
    var v = this._viewSize();
    ctx.setTransform(v.dpr, 0, 0, v.dpr, 0, 0);
    ctx.clearRect(0, 0, v.w, v.h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, v.w, v.h);
    if (!this.result) return;

    var order = { jalan: 0, rth: 1, fasum: 2, kavling: 3, komersial: 4 };
    var parcels = this.result.parcels.slice().sort(function (a, b) {
      return (order[a.type] || 0) - (order[b.type] || 0);
    });

    // fill + stroke
    for (var i = 0; i < parcels.length; i++) {
      var p = parcels[i];
      var col = COLORS[p.type] || COLORS.kavling;
      this._path(p.polygon);
      ctx.fillStyle = col.fill;
      ctx.fill();
      ctx.strokeStyle = col.stroke;
      ctx.lineWidth = p === this.hovered ? 2.5 : 0.8;
      ctx.stroke();
    }

    // highlight parcel yang di-hover
    if (this.hovered) {
      this._path(this.hovered.polygon);
      ctx.strokeStyle = '#1e2a36';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // boundary
    this._path(this.result.boundary);
    ctx.strokeStyle = COLORS.boundary.stroke;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    this._drawLabels(parcels);
    this._drawOverlays(v);
  };

  SiteplanRenderer.prototype._path = function (poly) {
    var ctx = this.ctx;
    ctx.beginPath();
    for (var i = 0; i < poly.length; i++) {
      var s = this.worldToScreen(poly[i]);
      if (i === 0) ctx.moveTo(s[0], s[1]);
      else ctx.lineTo(s[0], s[1]);
    }
    ctx.closePath();
  };

  SiteplanRenderer.prototype._drawLabels = function (parcels) {
    var ctx = this.ctx;
    var force = this.opts.forceLabels;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < parcels.length; i++) {
      var p = parcels[i];
      if (!p.label) continue;
      var c = Geom.centroid(p.polygon);
      var s = this.worldToScreen(c);
      if (p.type === 'kavling' || p.type === 'komersial') {
        var wPx = (p.w || 6) * this.scale;
        if (!force && wPx < 26) continue;
        var fs = Math.max(9, Math.min(13, wPx * 0.28));
        ctx.fillStyle = '#5b4a30';
        ctx.font = '600 ' + fs + 'px system-ui, sans-serif';
        if (force || wPx > 48) {
          ctx.fillText(p.label, s[0], s[1] - fs * 0.55);
          ctx.font = (fs * 0.85) + 'px system-ui, sans-serif';
          ctx.fillText(p.w + '×' + p.d, s[0], s[1] + fs * 0.6);
        } else {
          ctx.fillText(p.label, s[0], s[1]);
        }
      } else {
        // RTH / FASUM di centroid jika cukup besar di layar
        var areaPx = p.areaM2 * this.scale * this.scale;
        if (!force && areaPx < 2000) continue;
        ctx.fillStyle = p.type === 'rth' ? '#2e5e31' : '#1d4f7a';
        ctx.font = '700 12px system-ui, sans-serif';
        ctx.fillText(p.label, s[0], s[1]);
      }
    }
  };

  /* ---------------- Overlay layar ---------------- */

  SiteplanRenderer.prototype._drawOverlays = function (v) {
    this._drawLegend(v);
    this._drawNorthArrow(v);
    this._drawScaleBar(v);
  };

  SiteplanRenderer.prototype._drawLegend = function (v) {
    var ctx = this.ctx;
    var pad = 10, lh = 19, w = 150;
    var h = LEGEND_ITEMS.length * lh + 16;
    var x = v.w - w - 12, y = 12;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#d5dce3';
    ctx.lineWidth = 1;
    _roundRect(ctx, x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (var i = 0; i < LEGEND_ITEMS.length; i++) {
      var it = LEGEND_ITEMS[i];
      var iy = y + 8 + lh * i + lh / 2 - 2;
      ctx.fillStyle = COLORS[it[0]].fill;
      ctx.strokeStyle = COLORS[it[0]].stroke;
      _roundRect(ctx, x + pad, iy - 6, 12, 12, 3);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#33414e';
      ctx.font = '11.5px system-ui, sans-serif';
      ctx.fillText(it[1], x + pad + 19, iy);
    }
  };

  SiteplanRenderer.prototype._drawNorthArrow = function (v) {
    var ctx = this.ctx;
    var x = 30, y = 38, r = 16;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.strokeStyle = '#d5dce3';
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y - r + 3);
    ctx.lineTo(x - 6, y + r - 8);
    ctx.lineTo(x, y + r - 13);
    ctx.lineTo(x + 6, y + r - 8);
    ctx.closePath();
    ctx.fillStyle = '#22303c';
    ctx.fill();
    ctx.font = '700 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('U', x, y + r + 12);
  };

  SiteplanRenderer.prototype._drawScaleBar = function (v) {
    var ctx = this.ctx;
    var nice = [1, 2, 5, 10, 20, 50, 100, 200, 500];
    var len = nice[0];
    for (var i = 0; i < nice.length; i++) {
      if (nice[i] * this.scale <= 140) len = nice[i];
    }
    var px = len * this.scale;
    var x = 14, y = v.h - 22;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(x - 4, y - 16, px + 44, 26);
    ctx.strokeStyle = '#22303c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 4); ctx.lineTo(x, y);
    ctx.lineTo(x + px, y); ctx.lineTo(x + px, y - 4);
    ctx.stroke();
    ctx.fillStyle = '#22303c';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(len + ' m', x + px + 6, y + 2);
  };

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ---------------- Interaksi ---------------- */

  SiteplanRenderer.prototype._bindEvents = function () {
    var self = this;
    var canvas = this.canvas;
    var dragging = false, lastX = 0, lastY = 0, moved = false;

    canvas.addEventListener('wheel', function (e) {
      if (!self.result) return;
      e.preventDefault();
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left, my = e.clientY - rect.top;
      var k = Math.exp(-e.deltaY * 0.0015);
      var minScale = (self._fitScale || 1) / 10;
      var newScale = Math.min(200, Math.max(minScale, self.scale * k));
      k = newScale / self.scale;
      self.scale = newScale;
      self.tx = mx - (mx - self.tx) * k;
      self.ty = my - (my - self.ty) * k;
      self.draw();
    }, { passive: false });

    canvas.addEventListener('pointerdown', function (e) {
      dragging = true; moved = false;
      lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('dragging');
    });

    canvas.addEventListener('pointermove', function (e) {
      if (dragging) {
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
        self.tx += dx; self.ty += dy;
        lastX = e.clientX; lastY = e.clientY;
        self._hideTooltip();
        self.draw();
      } else {
        self._onHover(e);
      }
    });

    canvas.addEventListener('pointerup', function (e) {
      dragging = false;
      canvas.releasePointerCapture(e.pointerId);
      canvas.classList.remove('dragging');
    });

    canvas.addEventListener('pointerleave', function () {
      self._hideTooltip();
      if (self.hovered) { self.hovered = null; self.draw(); }
    });
  };

  SiteplanRenderer.prototype._onHover = function (e) {
    if (!this.result || !this.tooltip) return;
    var rect = this.canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left, my = e.clientY - rect.top;
    var w = this.screenToWorld([mx, my]);
    var hit = null;
    var parcels = this.result.parcels;
    // prioritas kavling/komersial, lalu lainnya
    for (var pass = 0; pass < 2 && !hit; pass++) {
      for (var i = 0; i < parcels.length; i++) {
        var p = parcels[i];
        var isLot = p.type === 'kavling' || p.type === 'komersial';
        if (pass === 0 && !isLot) continue;
        if (pass === 1 && isLot) continue;
        if (Geom.pointInPolygon(w, p.polygon)) { hit = p; break; }
      }
    }
    if (hit !== this.hovered) {
      this.hovered = hit;
      this.draw();
    }
    if (hit) {
      var txt;
      if (hit.type === 'kavling') txt = hit.label + ' · Kavling ' + hit.w + '×' + hit.d + ' m · ' + hit.areaM2 + ' m²';
      else if (hit.type === 'komersial') txt = hit.label + ' · Ruko ' + hit.w + '×' + hit.d + ' m · ' + hit.areaM2 + ' m²';
      else if (hit.type === 'jalan') txt = 'Jalan · ' + hit.areaM2 + ' m²';
      else if (hit.type === 'rth') txt = 'RTH / Taman · ' + hit.areaM2 + ' m²';
      else txt = 'Fasum / Fasos · ' + hit.areaM2 + ' m²';
      this.tooltip.textContent = txt;
      this.tooltip.style.left = mx + 'px';
      this.tooltip.style.top = my + 'px';
      this.tooltip.classList.remove('hidden');
    } else {
      this._hideTooltip();
    }
  };

  SiteplanRenderer.prototype._hideTooltip = function () {
    if (this.tooltip) this.tooltip.classList.add('hidden');
  };

  root.SiteplanRenderer = SiteplanRenderer;
  if (typeof module !== 'undefined' && module.exports) module.exports = SiteplanRenderer;
})(typeof window !== 'undefined' ? window : globalThis);
