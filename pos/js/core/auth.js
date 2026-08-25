/* =============================================================
   SajiPOS — Otentikasi, Peran & Hak Akses
   ============================================================= */
window.App = window.App || {};

App.Auth = (function () {
  const SESSION_KEY = 'sajipos.session';
  let current = null;

  /* Daftar hak akses lengkap (dipetakan ke peran) */
  const PERMISSIONS = {
    'pos.use':          'Menggunakan kasir',
    'pos.discount':     'Memberi diskon manual',
    'pos.void':         'Void / batalkan transaksi',
    'pos.refund':       'Refund transaksi',
    'pos.openPrice':    'Ubah harga saat transaksi',
    'shift.open':       'Buka kasir',
    'shift.close':      'Tutup kasir',
    'cash.move':        'Kas masuk/keluar outlet',
    'order.manage':     'Kelola pesanan & meja',
    'kds.use':          'Kitchen display',
    'inventory.view':   'Lihat inventori',
    'inventory.manage': 'Kelola stok, resep & opname',
    'procure.view':     'Lihat pembelian',
    'procure.manage':   'Kelola PO, penerimaan & tagihan',
    'crm.view':         'Lihat pelanggan',
    'crm.manage':       'Kelola promo, membership & kampanye',
    'hr.view':          'Lihat karyawan & absensi',
    'hr.manage':        'Kelola karyawan, jadwal & payroll',
    'acc.view':         'Lihat laporan keuangan',
    'acc.manage':       'Jurnal, akun & pengeluaran',
    'report.view':      'Lihat laporan bisnis',
    'settings.manage':  'Pengaturan & pengguna'
  };
  const ALL = Object.keys(PERMISSIONS);

  const ROLE_TEMPLATES = {
    owner:      { name: 'Owner',      permissions: ALL },
    manager:    { name: 'Manager',    permissions: ALL.filter(p => p !== 'settings.manage') },
    supervisor: { name: 'Supervisor', permissions: ['pos.use','pos.discount','pos.void','pos.refund','shift.open','shift.close','cash.move','order.manage','kds.use','inventory.view','inventory.manage','procure.view','crm.view','hr.view','report.view'] },
    kasir:      { name: 'Kasir',      permissions: ['pos.use','shift.open','shift.close','order.manage','kds.use','inventory.view','crm.view'] },
    dapur:      { name: 'Dapur',      permissions: ['kds.use','order.manage','inventory.view'] },
    akuntan:    { name: 'Akuntan',    permissions: ['acc.view','acc.manage','report.view','procure.view','procure.manage','inventory.view'] },
    hrd:        { name: 'HRD',        permissions: ['hr.view','hr.manage','report.view'] },
    gudang:     { name: 'Gudang',     permissions: ['inventory.view','inventory.manage','procure.view','procure.manage'] }
  };

  function roleOf(user) {
    if (!user) return null;
    const custom = App.DB.find('roles', user.roleId);
    if (custom) return custom;
    return ROLE_TEMPLATES[user.role] || ROLE_TEMPLATES.kasir;
  }
  function can(perm, user) {
    const u = user || current;
    if (!u) return false;
    if (u.role === 'owner') return true;
    const r = roleOf(u);
    return !!(r && r.permissions && r.permissions.includes(perm));
  }
  function requireOr(perm, msg) {
    if (can(perm)) return true;
    App.UI.toast(msg || 'Anda tidak memiliki hak akses untuk tindakan ini', 'err');
    return false;
  }

  function login(userId, pin) {
    const u = App.DB.find('users', userId);
    if (!u || u.active === false) return { ok: false, msg: 'Pengguna tidak ditemukan atau nonaktif' };
    if (String(u.pin) !== String(pin)) return { ok: false, msg: 'PIN salah' };
    current = u;
    try { sessionStorage.setItem(SESSION_KEY, u.id); } catch (e) {}
    App.DB.update('users', u.id, { lastLogin: App.U.now() });
    App.DB.log('login', `${u.name} masuk sistem`);
    return { ok: true, user: u };
  }
  function logout() {
    if (current) App.DB.log('logout', `${current.name} keluar`);
    current = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    location.reload();
  }
  function restore() {
    try {
      const id = sessionStorage.getItem(SESSION_KEY);
      if (id) { const u = App.DB.find('users', id); if (u && u.active !== false) { current = u; return u; } }
    } catch (e) {}
    return null;
  }
  function user() { return current; }
  function setUser(u) { current = u; }

  return { PERMISSIONS, ROLE_TEMPLATES, ALL, roleOf, can, requireOr, login, logout, restore, user, setUser };
})();

/* =============================================================
   State aplikasi: outlet aktif, periode, tema
   ============================================================= */
App.State = (function () {
  let _outletId = null;
  let listeners = [];

  function outletId() {
    if (!_outletId) {
      try { _outletId = localStorage.getItem('sajipos.outlet'); } catch (e) {}
      const list = App.DB.all('outlets');
      if (!_outletId || !list.find(o => o.id === _outletId)) _outletId = list[0] ? list[0].id : null;
    }
    return _outletId;
  }
  function outlet() { return App.DB.find('outlets', outletId()) || App.DB.all('outlets')[0] || {}; }
  function setOutlet(id) {
    _outletId = id;
    try { localStorage.setItem('sajipos.outlet', id); } catch (e) {}
    emit('outlet');
  }
  function allOutletsMode() { return _outletId === 'ALL'; }
  function scope(rows) {                    // filter baris berdasarkan outlet aktif
    const id = outletId();
    if (id === 'ALL') return rows;
    return rows.filter(r => !r.outletId || r.outletId === id);
  }

  function theme() {
    try { return localStorage.getItem('sajipos.theme') || 'light'; } catch (e) { return 'light'; }
  }
  function setTheme(t) {
    try { localStorage.setItem('sajipos.theme', t); } catch (e) {}
    document.documentElement.setAttribute('data-theme', t);
    emit('theme');
  }
  function toggleTheme() { setTheme(theme() === 'dark' ? 'light' : 'dark'); }

  function on(fn) { listeners.push(fn); }
  function emit(evt) { listeners.forEach(f => { try { f(evt); } catch (e) { console.error(e); } }); }

  /* Shift kasir aktif untuk outlet + user saat ini */
  function activeShift() {
    const uid = App.Auth.user() ? App.Auth.user().id : null;
    return App.DB.first('shifts', s => s.status === 'open' && s.outletId === outletId() && (!uid || s.userId === uid))
        || App.DB.first('shifts', s => s.status === 'open' && s.outletId === outletId());
  }

  return { outletId, outlet, setOutlet, allOutletsMode, scope, theme, setTheme, toggleTheme, on, emit, activeShift };
})();

/* =============================================================
   Router berbasis hash
   ============================================================= */
App.Router = (function () {
  const routes = {};
  let currentRoute = null;

  function add(path, def) { routes[path] = def; }
  function get(path) { return routes[path]; }
  function list() { return routes; }
  function current() { return currentRoute; }

  function parse() {
    const h = location.hash.replace(/^#\/?/, '') || 'dashboard';
    const [path, qs] = h.split('?');
    const params = {};
    (qs || '').split('&').filter(Boolean).forEach(p => {
      const [k, v] = p.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { path, params };
  }
  function go(path, params) {
    const qs = params ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
    location.hash = '#/' + path + qs;
  }
  function reload() { render(); }

  function render() {
    const { path, params } = parse();
    const def = routes[path] || routes['dashboard'];
    currentRoute = { path, params, def };
    if (def.permission && !App.Auth.can(def.permission)) {
      document.getElementById('view').innerHTML = App.UI.emptyState(
        'Akses ditolak', 'Peran Anda tidak memiliki izin membuka halaman ini.', '🔒');
      App.Shell.setTitle(def.title || 'Akses ditolak', def.group || '');
      App.Shell.highlight(path);
      return;
    }
    App.Shell.setTitle(def.title, def.group);
    App.Shell.highlight(path);
    const view = document.getElementById('view');
    view.className = def.flush ? 'view view--flush' : 'view';
    view.innerHTML = '';
    window.scrollTo(0, 0);
    try {
      def.render(view, params);
    } catch (err) {
      console.error(err);
      view.innerHTML = App.UI.emptyState('Terjadi kesalahan', String(err && err.message || err), '⚠️');
    }
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }
  return { add, get, list, go, start, render, reload, parse, current };
})();
