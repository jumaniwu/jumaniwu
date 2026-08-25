/* =============================================================
   SajiPOS — Grafik SVG ringan (tanpa dependensi eksternal)
   ============================================================= */
window.App = window.App || {};

App.Chart = (function () {
  const U = App.U;
  const PALETTE = ['#0d9c86','#7c5cff','#f5a524','#0b93d5','#e5484d','#3fa62a','#e06a9c','#5b6b8c'];

  function svgWrap(w, h, inner, extra = '') {
    return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" preserveAspectRatio="none" style="overflow:visible;display:block" ${extra}>${inner}</svg>`;
  }
  function niceMax(v) {
    if (v <= 0) return 10;
    const mag = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / mag;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  /* Grafik garis / area — data: [{label, value}] */
  function line(data, opts = {}) {
    const w = 700, h = opts.height || 190, pad = { l: 8, r: 8, t: 14, b: 22 };
    if (!data.length) return `<div class="empty small">Belum ada data</div>`;
    const max = niceMax(Math.max(...data.map(d => d.value), 1));
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const x = i => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
    const y = v => pad.t + ih - (v / max) * ih;
    const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
    const area = `${pad.l},${pad.t + ih} ${pts} ${x(data.length - 1)},${pad.t + ih}`;
    const color = opts.color || PALETTE[0];
    const grid = [0, .25, .5, .75, 1].map(f =>
      `<line x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + ih * f}" y2="${pad.t + ih * f}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3 4"/>`).join('');
    const step = Math.max(1, Math.ceil(data.length / 8));
    const labels = data.map((d, i) => i % step === 0 || i === data.length - 1
      ? `<text x="${x(i)}" y="${h - 5}" font-size="9" fill="var(--text-3)" text-anchor="middle">${U.esc(d.label)}</text>` : '').join('');
    const dots = data.map((d, i) =>
      `<circle cx="${x(i)}" cy="${y(d.value)}" r="2.6" fill="${color}"><title>${U.esc(d.label)}: ${opts.money !== false ? U.rp(d.value) : U.num(d.value)}</title></circle>`).join('');
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    return svgWrap(w, h, `
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity=".28"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
      </linearGradient></defs>
      ${grid}
      <polygon points="${area}" fill="url(#${id})"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}${labels}`, 'preserveAspectRatio="none"');
  }

  /* Batang vertikal */
  function bar(data, opts = {}) {
    const w = 700, h = opts.height || 190, pad = { l: 8, r: 8, t: 14, b: 24 };
    if (!data.length) return `<div class="empty small">Belum ada data</div>`;
    const max = niceMax(Math.max(...data.map(d => d.value), 1));
    const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    const bw = Math.min(46, (iw / data.length) * .62);
    const gap = iw / data.length;
    const bars = data.map((d, i) => {
      const bh = Math.max(1, (d.value / max) * ih);
      const bx = pad.l + gap * i + (gap - bw) / 2;
      const by = pad.t + ih - bh;
      const c = d.color || opts.color || PALETTE[i % PALETTE.length];
      return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="4" fill="${c}">
                <title>${U.esc(d.label)}: ${opts.money !== false ? U.rp(d.value) : U.num(d.value)}</title></rect>
              <text x="${bx + bw / 2}" y="${h - 7}" font-size="9" fill="var(--text-3)" text-anchor="middle">${U.esc(String(d.label).slice(0, 12))}</text>`;
    }).join('');
    const grid = [0, .5, 1].map(f => `<line x1="${pad.l}" x2="${w - pad.r}" y1="${pad.t + ih * f}" y2="${pad.t + ih * f}" stroke="var(--border)" stroke-dasharray="3 4"/>`).join('');
    return svgWrap(w, h, grid + bars);
  }

  /* Batang horizontal (untuk peringkat produk) */
  function hbar(data, opts = {}) {
    if (!data.length) return `<div class="empty small">Belum ada data</div>`;
    const max = Math.max(...data.map(d => d.value), 1);
    return `<div style="display:grid;gap:9px">${data.map((d, i) => `
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
          <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${i + 1}. ${U.esc(d.label)}</span>
          <span class="num muted" style="font-weight:700">${opts.money ? U.rp(d.value) : U.num(d.value) + (opts.unit || '')}</span>
        </div>
        <div class="progress"><i style="width:${(d.value / max) * 100}%;background:${d.color || PALETTE[i % PALETTE.length]}"></i></div>
      </div>`).join('')}</div>`;
  }

  /* Donat + legenda */
  function donut(data, opts = {}) {
    const total = U.sum(data, d => d.value);
    if (!total) return `<div class="empty small">Belum ada data</div>`;
    const size = opts.size || 150, r = size / 2 - 12, cx = size / 2, cy = size / 2, sw = 20;
    let acc = 0;
    const circ = 2 * Math.PI * r;
    const segs = data.map((d, i) => {
      const frac = d.value / total;
      const dash = `${frac * circ} ${circ}`;
      const off = -acc * circ;
      acc += frac;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${d.color || PALETTE[i % PALETTE.length]}"
                stroke-width="${sw}" stroke-dasharray="${dash}" stroke-dashoffset="${off}"
                transform="rotate(-90 ${cx} ${cy})"><title>${U.esc(d.label)}: ${U.pct(d.value, total)}</title></circle>`;
    }).join('');
    const legend = data.map((d, i) => `
      <div style="display:flex;align-items:center;gap:7px;font-size:12px;padding:2px 0">
        <span style="width:9px;height:9px;border-radius:3px;background:${d.color || PALETTE[i % PALETTE.length]};flex:0 0 9px"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(d.label)}</span>
        <b class="num">${U.pct(d.value, total)}</b>
      </div>`).join('');
    return `<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="position:relative;flex:0 0 ${size}px">
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${segs}</svg>
        <div style="position:absolute;inset:0;display:grid;place-items:center;text-align:center">
          <div><div style="font-size:15px;font-weight:800">${opts.money ? U.compact(total) : U.num(total)}</div>
          <div class="small muted">${U.esc(opts.centerLabel || 'Total')}</div></div>
        </div>
      </div>
      <div style="flex:1;min-width:150px">${legend}</div>
    </div>`;
  }

  /* Sparkline mini */
  function spark(values, color = '#0d9c86', w = 74, h = 26) {
    if (!values || values.length < 2) return '';
    const max = Math.max(...values, 1), min = Math.min(...values, 0);
    const rng = max - min || 1;
    const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / rng) * h}`).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }

  /* Heatmap jam × hari (analisa jam ramai) */
  function heat(matrix, opts = {}) {
    const rows = opts.rows || U.HARI;
    const cols = opts.cols || Array.from({ length: 24 }, (_, i) => i);
    let max = 1;
    matrix.forEach(r => r.forEach(v => { if (v > max) max = v; }));
    const cell = (v) => {
      const a = v / max;
      return `background:rgba(13,156,134,${(a * .9 + (v ? .1 : 0)).toFixed(2)});color:${a > .55 ? '#fff' : 'var(--text-2)'}`;
    };
    return `<div style="overflow-x:auto"><table style="border-collapse:separate;border-spacing:2px;font-size:9.5px">
      <thead><tr><th></th>${cols.map(c => `<th style="font-weight:600;color:var(--text-3);padding:0 1px">${c}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r, ri) => `<tr>
        <td style="font-weight:700;color:var(--text-3);padding-right:5px;white-space:nowrap">${U.esc(String(r).slice(0, 3))}</td>
        ${cols.map((c, ci) => {
          const v = (matrix[ri] && matrix[ri][ci]) || 0;
          return `<td title="${r} ${c}:00 — ${U.num(v)} transaksi" style="width:19px;height:17px;border-radius:3px;text-align:center;${cell(v)}">${v || ''}</td>`;
        }).join('')}</tr>`).join('')}</tbody></table></div>`;
  }

  return { line, bar, hbar, donut, spark, heat, PALETTE };
})();
