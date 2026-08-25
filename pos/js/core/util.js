/* =============================================================
   SajiPOS — Utilities
   ============================================================= */
window.App = window.App || {};

App.U = (function () {
  const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  const HARI  = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  /* ---------- angka & uang ---------- */
  function rupiah(n, withSymbol = true) {
    const v = Math.round(Number(n) || 0);
    const s = Math.abs(v).toLocaleString('id-ID');
    const sign = v < 0 ? '-' : '';
    return (withSymbol ? 'Rp ' : '') + sign + s;
  }
  function rp(n) { return rupiah(n); }
  function num(n, dec = 0) {
    const v = Number(n) || 0;
    return v.toLocaleString('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  }
  function compact(n) {
    const v = Number(n) || 0, a = Math.abs(v);
    if (a >= 1e12) return (v / 1e12).toFixed(1).replace('.', ',') + ' T';
    if (a >= 1e9)  return (v / 1e9 ).toFixed(1).replace('.', ',') + ' M';
    if (a >= 1e6)  return (v / 1e6 ).toFixed(1).replace('.', ',') + ' jt';
    if (a >= 1e3)  return (v / 1e3 ).toFixed(0) + ' rb';
    return String(Math.round(v));
  }
  function pct(a, b, dec = 1) {
    if (!b) return '0%';
    return ((a / b) * 100).toFixed(dec).replace('.', ',') + '%';
  }
  function parseNum(str) {
    if (typeof str === 'number') return str;
    return Number(String(str || '').replace(/[^\d,-]/g, '').replace(',', '.')) || 0;
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function round4(n) { return Math.round((Number(n) || 0) * 10000) / 10000; }

  /* ---------- tanggal ----------
     Seluruh perhitungan tanggal memakai zona waktu lokal perangkat.
     Penting untuk usaha F&B di WIB/WITA/WIT: memakai UTC akan membuat
     transaksi dini hari masuk ke tanggal yang salah. */
  const pad2 = n => String(n).padStart(2, '0');

  /* String 'YYYY-MM-DD' diurai sebagai tanggal LOKAL, bukan UTC. */
  function parseDate(d) {
    if (d instanceof Date) return new Date(d.getTime());
    const s = String(d ?? '');
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    return new Date(s);
  }
  function ymd(d) {
    const x = d === undefined || d === null ? new Date() : parseDate(d);
    if (isNaN(x)) return '';
    return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
  }
  function today() { return ymd(new Date()); }
  function now()   { return new Date().toISOString(); }
  function addDays(d, n) { const x = parseDate(d); x.setDate(x.getDate() + n); return ymd(x); }
  function addMonths(d, n) { const x = parseDate(d); x.setMonth(x.getMonth() + n); return ymd(x); }
  function startOfMonth(d) { const x = parseDate(d); return ymd(new Date(x.getFullYear(), x.getMonth(), 1)); }
  function endOfMonth(d)   { const x = parseDate(d); return ymd(new Date(x.getFullYear(), x.getMonth() + 1, 0)); }
  function monthKey(d) { return String(d).slice(0, 7); }
  function fmtDate(d, style = 'short') {
    if (!d) return '-';
    const x = parseDate(d);
    if (isNaN(x)) return '-';
    if (style === 'long')  return `${x.getDate()} ${BULAN[x.getMonth()]} ${x.getFullYear()}`;
    if (style === 'full')  return `${HARI[x.getDay()]}, ${x.getDate()} ${BULAN[x.getMonth()]} ${x.getFullYear()}`;
    if (style === 'month') return `${BULAN[x.getMonth()]} ${x.getFullYear()}`;
    if (style === 'dm')    return `${x.getDate()} ${BULAN[x.getMonth()].slice(0, 3)}`;
    return `${String(x.getDate()).padStart(2,'0')}/${String(x.getMonth()+1).padStart(2,'0')}/${x.getFullYear()}`;
  }
  function fmtTime(d) {
    if (!d) return '-';
    const x = parseDate(d);
    if (isNaN(x)) return '-';
    return `${String(x.getHours()).padStart(2,'0')}:${String(x.getMinutes()).padStart(2,'0')}`;
  }
  function fmtDateTime(d) { return d ? `${fmtDate(d)} ${fmtTime(d)}` : '-'; }
  function ago(d) {
    const ms = Date.now() - new Date(d).getTime();
    const m = Math.floor(ms / 60000);
    if (m < 1) return 'baru saja';
    if (m < 60) return m + ' mnt lalu';
    const h = Math.floor(m / 60);
    if (h < 24) return h + ' jam lalu';
    return Math.floor(h / 24) + ' hari lalu';
  }
  function minutesSince(d) { return Math.floor((Date.now() - new Date(d).getTime()) / 60000); }
  function mmss(fromIso) {
    const s = Math.max(0, Math.floor((Date.now() - new Date(fromIso).getTime()) / 1000));
    return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }
  function dateRangeDays(from, to) {
    const out = []; let c = ymd(from); const end = ymd(to); let guard = 0;
    while (c <= end && guard++ < 800) { out.push(c); c = addDays(c, 1); }
    return out;
  }

  /* ---------- id & teks ---------- */
  let _seq = 0;
  function uid(prefix = 'id') {
    _seq++;
    return `${prefix}_${Date.now().toString(36)}${_seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  }
  function docNo(prefix, n, digits = 4) {
    const d = new Date();
    return `${prefix}/${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}/${String(n).padStart(digits,'0')}`;
  }
  function initials(name) {
    return String(name || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function titleCase(s) { return String(s || '').replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase()); }
  function terbilang(n) {
    const satuan = ['','satu','dua','tiga','empat','lima','enam','tujuh','delapan','sembilan','sepuluh','sebelas'];
    n = Math.floor(Math.abs(Number(n) || 0));
    if (n < 12) return satuan[n];
    if (n < 20) return terbilang(n - 10) + ' belas';
    if (n < 100) return terbilang(Math.floor(n / 10)) + ' puluh ' + terbilang(n % 10);
    if (n < 200) return 'seratus ' + terbilang(n - 100);
    if (n < 1000) return terbilang(Math.floor(n / 100)) + ' ratus ' + terbilang(n % 100);
    if (n < 2000) return 'seribu ' + terbilang(n - 1000);
    if (n < 1e6) return terbilang(Math.floor(n / 1000)) + ' ribu ' + terbilang(n % 1000);
    if (n < 1e9) return terbilang(Math.floor(n / 1e6)) + ' juta ' + terbilang(n % 1e6);
    return terbilang(Math.floor(n / 1e9)) + ' miliar ' + terbilang(n % 1e9);
  }

  /* ---------- koleksi ---------- */
  function sum(arr, fn) { return (arr || []).reduce((a, x) => a + (Number(fn ? fn(x) : x) || 0), 0); }
  function groupBy(arr, fn) {
    return (arr || []).reduce((acc, x) => {
      const k = fn(x); (acc[k] = acc[k] || []).push(x); return acc;
    }, {});
  }
  function sortBy(arr, fn, dir = 'asc') {
    return [...(arr || [])].sort((a, b) => {
      const x = fn(a), y = fn(b);
      if (x === y) return 0;
      const r = x > y ? 1 : -1;
      return dir === 'asc' ? r : -r;
    });
  }
  function unique(arr) { return [...new Set(arr)]; }
  function chunk(arr, n) {
    const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  /* ---------- dom ---------- */
  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function $(sel, root = document) { return root.querySelector(sel); }
  function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }
  function on(root, evt, sel, handler) {
    root.addEventListener(evt, e => {
      const t = e.target.closest(sel);
      if (t && root.contains(t)) handler(e, t);
    });
  }
  function debounce(fn, ms = 250) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  /* ---------- export ---------- */
  function toCSV(rows, headers) {
    const cols = headers || Object.keys(rows[0] || {});
    const escCell = v => {
      const s = String(v ?? '');
      return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [cols.join(';'), ...rows.map(r => cols.map(c => escCell(r[c])).join(';'))].join('\n');
  }
  function download(filename, content, mime = 'text/csv;charset=utf-8') {
    try {
      const blob = new Blob(['﻿' + content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 400);
      return true;
    } catch (e) { return false; }
  }
  function exportTable(filename, rows, headers) {
    if (!rows || !rows.length) { App.UI.toast('Tidak ada data untuk diekspor', 'warn'); return; }
    const ok = download(filename.replace(/\.\w+$/, '') + '.csv', toCSV(rows, headers));
    App.UI.toast(ok ? 'Berhasil diekspor: ' + filename : 'Ekspor gagal', ok ? 'ok' : 'err');
  }

  return {
    BULAN, HARI,
    rupiah, rp, num, compact, pct, parseNum, round2, round4,
    today, now, ymd, parseDate, addDays, addMonths, startOfMonth, endOfMonth, monthKey,
    fmtDate, fmtTime, fmtDateTime, ago, minutesSince, mmss, dateRangeDays,
    uid, docNo, initials, esc, slug, titleCase, terbilang,
    sum, groupBy, sortBy, unique, chunk, clone, pick, randInt,
    el, $, $$, on, debounce,
    toCSV, download, exportTable
  };
})();
