/* =============================================================
   SajiPOS — Lapisan Data (localStorage + fallback memori)
   Semua modul membaca/menulis lewat App.DB agar konsisten.
   ============================================================= */
window.App = window.App || {};

App.DB = (function () {
  const KEY = 'sajipos.db.v1';
  const COLLECTIONS = [
    'outlets','users','roles','categories','products','stock','stockMoves',
    'suppliers','purchaseRequests','purchaseOrders','goodsReceipts','bills','billPayments','purchaseReturns',
    'customers','customerGroups','tiers','promos','campaigns','vouchers','feedback','promoMedia',
    'orders','tables','areas','reservations','shifts','cashMoves',
    'accounts','journals','expenses','assets',
    'employees','attendance','schedules','leaves','payrolls','commissions',
    'notifications','activityLog'
  ];

  let mem = null;          // cache di memori
  let usingMemoryOnly = false;
  let saveTimer = null;

  function blank() {
    const o = { _v: 1, settings: {}, counters: {} };
    COLLECTIONS.forEach(c => o[c] = []);
    return o;
  }

  function storageAvailable() {
    try {
      localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true;
    } catch (e) { return false; }
  }

  function load() {
    if (mem) return mem;
    if (!storageAvailable()) {
      usingMemoryOnly = true;
      mem = blank();
      return mem;
    }
    try {
      const raw = localStorage.getItem(KEY);
      mem = raw ? JSON.parse(raw) : blank();
    } catch (e) {
      console.warn('DB rusak, memulai baru', e);
      mem = blank();
    }
    COLLECTIONS.forEach(c => { if (!Array.isArray(mem[c])) mem[c] = []; });
    mem.settings = mem.settings || {};
    mem.counters = mem.counters || {};
    return mem;
  }

  function persist() {
    if (usingMemoryOnly) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(mem));
    } catch (e) {
      /* Kuota localStorage (~5 MB) penuh: pangkas riwayat paling lama agar
         transaksi baru tetap bisa disimpan, lalu beri tahu pengguna. */
      const freed = pruneOldest();
      try {
        localStorage.setItem(KEY, JSON.stringify(mem));
        if (App.UI) App.UI.toast(
          `Penyimpanan hampir penuh — ${freed} data riwayat terlama diarsipkan agar transaksi baru tetap tersimpan. Unduh backup di menu Data & Backup.`,
          'warn', 8000);
      } catch (e2) {
        console.warn('Gagal menyimpan meski sudah dipangkas', e2);
        if (App.UI) App.UI.toast('Penyimpanan penuh — unduh backup lalu atur ulang data di menu Data & Backup.', 'err', 8000);
      }
    }
  }

  /* Buang 25% pesanan & mutasi stok terlama beserta jurnal terkait.
     Saldo akun tetap benar karena jurnal pembukanya diganti saldo ringkas. */
  function pruneOldest() {
    const U = App.U;
    let removed = 0;
    const cut = (col, dateKey) => {
      const list = mem[col] || [];
      if (list.length < 400) return;
      const sorted = [...list].sort((a, b) => String(a[dateKey] || '').localeCompare(String(b[dateKey] || '')));
      const drop = new Set(sorted.slice(0, Math.floor(list.length * 0.25)).map(r => r.id));
      mem[col] = list.filter(r => !drop.has(r.id));
      removed += drop.size;
    };
    cut('orders', 'date');
    cut('stockMoves', 'date');
    cut('activityLog', 'at');
    return removed;
  }
  function save() {                       // tulis tertunda agar hemat I/O
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 120);
  }
  function saveNow() { clearTimeout(saveTimer); persist(); }

  /* ---------- CRUD ---------- */
  function all(col) { return load()[col] || []; }
  function find(col, id) { return all(col).find(r => r.id === id) || null; }
  function where(col, fn) { return all(col).filter(fn); }
  function first(col, fn) { return all(col).find(fn) || null; }

  function insert(col, row) {
    const db = load();
    if (!row.id) row.id = App.U.uid(col.slice(0, 3));
    /* Hindari dua stempel waktu untuk baris yang sudah punya `date`/`at`
       — menghemat ruang penyimpanan browser yang terbatas (~5 MB). */
    if (!row.createdAt && !row.date && !row.at) row.createdAt = App.U.now();
    db[col] = db[col] || [];
    db[col].push(row);
    save();
    return row;
  }
  function insertMany(col, rows) { rows.forEach(r => insert(col, r)); return rows; }

  function update(col, id, patch) {
    const row = find(col, id);
    if (!row) return null;
    Object.assign(row, typeof patch === 'function' ? patch(row) : patch, { updatedAt: App.U.now() });
    save();
    return row;
  }
  function upsert(col, row) {
    return find(col, row.id) ? update(col, row.id, row) : insert(col, row);
  }
  function remove(col, id) {
    const db = load();
    const i = (db[col] || []).findIndex(r => r.id === id);
    if (i >= 0) { db[col].splice(i, 1); save(); return true; }
    return false;
  }
  function removeWhere(col, fn) {
    const db = load();
    const before = (db[col] || []).length;
    db[col] = (db[col] || []).filter(r => !fn(r));
    save();
    return before - db[col].length;
  }

  /* ---------- pengaturan & penomoran ---------- */
  function settings() { return load().settings; }
  function setSetting(k, v) { load().settings[k] = v; save(); return v; }
  function nextNo(key, prefix, digits = 4) {
    const db = load();
    db.counters[key] = (db.counters[key] || 0) + 1;
    save();
    return App.U.docNo(prefix, db.counters[key], digits);
  }
  function peekNo(key) { return (load().counters[key] || 0) + 1; }

  /* ---------- utilitas basis data ---------- */
  /* Buang cache memori agar pembacaan berikutnya mengambil ulang dari
     localStorage. Dipakai layar pendamping (jendela lain) supaya melihat
     perubahan yang dilakukan di jendela admin. */
  function reload() { mem = null; return load(); }

  function raw() { return load(); }
  function replaceAll(data) { mem = data; saveNow(); }
  function reset() { mem = blank(); saveNow(); }
  function exportJSON() { return JSON.stringify(load(), null, 2); }
  function importJSON(text) {
    const data = JSON.parse(text);
    COLLECTIONS.forEach(c => { if (!Array.isArray(data[c])) data[c] = []; });
    data.settings = data.settings || {}; data.counters = data.counters || {};
    replaceAll(data);
    return true;
  }
  function stats() {
    const db = load();
    const rows = COLLECTIONS.map(c => ({ koleksi: c, jumlah: db[c].length })).filter(r => r.jumlah);
    let bytes = 0;
    try { bytes = new Blob([JSON.stringify(db)]).size; } catch (e) { bytes = JSON.stringify(db).length; }
    return { rows, bytes, memoryOnly: usingMemoryOnly };
  }
  function isMemoryOnly() { return usingMemoryOnly; }

  /* ---------- jejak aktivitas ---------- */
  function log(action, detail, meta = {}) {
    insert('activityLog', {
      action, detail,
      userId: App.Auth && App.Auth.user() ? App.Auth.user().id : null,
      userName: App.Auth && App.Auth.user() ? App.Auth.user().name : 'sistem',
      outletId: App.State ? App.State.outletId() : null,
      at: App.U.now(), ...meta
    });
    const db = load();
    if (db.activityLog.length > 800) db.activityLog.splice(0, db.activityLog.length - 800);
  }

  return {
    COLLECTIONS, all, find, where, first, insert, insertMany, update, upsert, remove, removeWhere,
    settings, setSetting, nextNo, peekNo,
    raw, reload, replaceAll, reset, exportJSON, importJSON, stats, isMemoryOnly, save, saveNow, log
  };
})();
