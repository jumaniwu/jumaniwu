/* =============================================================
   SajiPOS — Boot aplikasi, navigasi & shell
   ============================================================= */
(function () {
  const U = App.U, DB = App.DB;

  /* ---------------- Struktur navigasi ---------------- */
  const NAV = [
    { group:'Operasional', items:[
      { path:'dashboard',   icon:'📊', label:'Dashboard' },
      { path:'pos',         icon:'🧾', label:'Kasir (POS)' },
      { path:'orders',      icon:'📋', label:'Daftar Pesanan', badge:'openOrders' },
      { path:'tables',      icon:'🪑', label:'Meja & Reservasi' },
      { path:'kds',         icon:'👨‍🍳', label:'Kitchen Display', badge:'kitchen' },
      { path:'shifts',      icon:'💰', label:'Kas & Shift' }
    ]},
    { group:'Perangkat', items:[
      { path:'selforder',      icon:'📱', label:'Self Order (E-Menu)' },
      { path:'customerdisplay',icon:'🖥️', label:'Customer Display' },
      { path:'orderdisplay',   icon:'📺', label:'Order Display' },
      { path:'qrtools',        icon:'🔳', label:'QR Meja & Label' },
      { path:'ownerapp',       icon:'👑', label:'Aplikasi Owner' },
      { path:'teamsapp',       icon:'🧑‍🍳', label:'Aplikasi Teams' }
    ]},
    { group:'Inventori', items:[
      { path:'products',    icon:'🍽️', label:'Produk & Resep' },
      { path:'stock',       icon:'📦', label:'Stok & Opname', badge:'lowStock' },
      { path:'stockmoves',  icon:'🔄', label:'Mutasi Stok' }
    ]},
    { group:'Pembelian', items:[
      { path:'suppliers',   icon:'🚚', label:'Supplier' },
      { path:'purchase',    icon:'🛒', label:'Purchase Order' },
      { path:'receiving',   icon:'📥', label:'Penerimaan Barang' },
      { path:'bills',       icon:'🧮', label:'Tagihan & Hutang', badge:'dueBills' }
    ]},
    { group:'Keuangan', items:[
      { path:'finance',     icon:'💵', label:'Kas & Bank' },
      { path:'expenses',    icon:'🧾', label:'Pengeluaran' },
      { path:'journal',     icon:'📒', label:'Jurnal Umum' },
      { path:'accounts',    icon:'🗂️', label:'Bagan Akun' },
      { path:'reports-fin', icon:'📈', label:'Laporan Keuangan' }
    ]},
    { group:'Karyawan', items:[
      { path:'employees',   icon:'👥', label:'Data Karyawan' },
      { path:'attendance',  icon:'⏰', label:'Absensi & Shift' },
      { path:'payroll',     icon:'💳', label:'Payroll & Komisi' }
    ]},
    { group:'Pelanggan', items:[
      { path:'customers',   icon:'💚', label:'Pelanggan & Member' },
      { path:'promos',      icon:'🎁', label:'Promo & Loyalty' },
      { path:'campaigns',   icon:'📣', label:'Kampanye Marketing' },
      { path:'onlinestore', icon:'🌐', label:'Toko Online & E-Menu' }
    ]},
    { group:'Analisa', items:[
      { path:'reports',     icon:'📑', label:'Pusat Laporan' },
      { path:'analytics',   icon:'🔍', label:'Analisa Bisnis' }
    ]},
    { group:'Sistem', items:[
      { path:'settings',    icon:'⚙️', label:'Pengaturan' },
      { path:'users',       icon:'🔐', label:'Pengguna & Hak Akses' },
      { path:'data',        icon:'💾', label:'Data & Backup' }
    ]}
  ];

  /* ---------------- Shell ---------------- */
  App.Shell = {
    setTitle(title, group) {
      document.getElementById('title').textContent = title || '';
      document.getElementById('crumb').textContent = group || '';
      document.title = (title ? title + ' · ' : '') + 'SajiPOS';
    },
    highlight(path) {
      U.$$('#nav .nav-item').forEach(a => a.classList.toggle('is-active', a.dataset.path === path));
    },
    badges() {
      const oid = App.State.outletId();
      const counts = {
        openOrders: DB.where('orders', o => o.status === 'open' && (oid === 'ALL' || o.outletId === oid)).length,
        kitchen: DB.where('orders', o => o.status === 'open' && o.kitchenStatus !== 'served' && (oid === 'ALL' || o.outletId === oid)).length,
        lowStock: App.Inv.lowStockList(oid === 'ALL' ? DB.all('outlets')[0].id : oid).length,
        dueBills: DB.where('bills', b => b.status !== 'paid' && b.dueDate <= U.addDays(U.today(), 7)).length
      };
      U.$$('#nav .nav-item').forEach(a => {
        const key = a.dataset.badge;
        const old = a.querySelector('.nav-item__badge');
        if (old) old.remove();
        if (key && counts[key]) a.insertAdjacentHTML('beforeend', `<span class="nav-item__badge">${counts[key]}</span>`);
      });
      const n = DB.where('notifications', x => !x.read).length;
      document.getElementById('notif-count').textContent = n;
    },
    refresh() { App.Router.reload(); this.badges(); }
  };

  function buildNav() {
    const nav = document.getElementById('nav');
    nav.innerHTML = NAV.map(g => `
      <div class="nav-group">
        <div class="nav-group__label">${g.group}</div>
        ${g.items.filter(i => {
          const def = App.Router.get(i.path);
          return !def || !def.permission || App.Auth.can(def.permission);
        }).map(i => `
          <a class="nav-item" href="#/${i.path}" data-path="${i.path}" ${i.badge ? `data-badge="${i.badge}"` : ''}>
            <span class="nav-item__icon">${i.icon}</span><span>${i.label}</span>
          </a>`).join('')}
      </div>`).join('');
  }

  /* ---------------- Pemilih outlet ---------------- */
  function outletPicker() {
    const outlets = DB.all('outlets');
    const cur = App.State.outletId();
    const m = App.UI.modal({
      title:'Pilih Outlet', subtitle:'Data pada seluruh modul mengikuti outlet aktif',
      body:`<div class="user-pick">
        ${outlets.map(o => `<button data-id="${o.id}" class="${o.id === cur ? 'is-active' : ''}">
          <span class="thumb">${o.type === 'restoran' ? '🍽️' : '☕'}</span>
          <span style="flex:1"><b>${U.esc(o.name)}</b><small>${U.esc(o.address)}</small></span>
          ${o.id === cur ? '<span class="badge badge--brand">Aktif</span>' : ''}
        </button>`).join('')}
        <button data-id="ALL" class="${cur === 'ALL' ? 'is-active' : ''}">
          <span class="thumb">🌐</span>
          <span style="flex:1"><b>Semua Outlet (Konsolidasi)</b><small>Gabungan seluruh cabang — mode laporan</small></span>
        </button>
      </div>`
    });
    m.body.querySelectorAll('button[data-id]').forEach(b => b.onclick = () => {
      App.State.setOutlet(b.dataset.id);
      m.close();
      renderOutletName();
      App.Shell.refresh();
      App.UI.toast('Outlet aktif: ' + (b.dataset.id === 'ALL' ? 'Semua Outlet' : DB.find('outlets', b.dataset.id).name));
    });
  }
  function renderOutletName() {
    const id = App.State.outletId();
    document.getElementById('outlet-name').textContent =
      id === 'ALL' ? 'Semua Outlet' : (App.State.outlet().name || '—').replace(/^.*— /, '');
  }

  /* ---------------- Notifikasi ---------------- */
  function notifPanel() {
    const list = U.sortBy(DB.all('notifications'), n => n.at, 'desc').slice(0, 40);
    const icon = { lowstock:'📦', bill:'🧮', hr:'👥', order:'🧾', system:'⚙️' };
    const m = App.UI.modal({
      title:'Notifikasi', subtitle:`${DB.where('notifications', n => !n.read).length} belum dibaca`,
      body: list.length ? `<div style="display:grid;gap:8px">${list.map(n => `
        <div style="display:flex;gap:10px;padding:10px;border:1px solid var(--border);border-radius:10px;background:${n.read ? 'transparent' : 'var(--brand-50)'}">
          <span class="thumb">${icon[n.type] || 'ℹ️'}</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px">${U.esc(n.title)}</div>
            <div class="small muted">${U.esc(n.message)}</div>
            <div class="small muted" style="margin-top:3px">${U.ago(n.at)}</div>
          </div>
        </div>`).join('')}</div>` : App.UI.emptyState('Tidak ada notifikasi','Semua aman terkendali 👌','🔔'),
      footer:`<button class="btn" data-close>Tutup</button><button class="btn btn--primary" data-read>Tandai semua dibaca</button>`
    });
    m.el.querySelector('[data-close]').onclick = m.close;
    m.el.querySelector('[data-read]').onclick = () => {
      DB.all('notifications').forEach(n => DB.update('notifications', n.id, { read:true }));
      m.close(); App.Shell.badges();
    };
  }

  /* ---------------- Profil pengguna ---------------- */
  function userPanel() {
    const u = App.Auth.user();
    const role = App.Auth.roleOf(u);
    const emp = DB.first('employees', e => e.userId === u.id);
    const shift = App.State.activeShift();
    App.UI.modal({
      title: u.name, subtitle: role.name + (emp ? ` · ${emp.position}` : ''),
      body:`
        <div class="kv"><span class="k">Email</span><span class="v">${U.esc(u.email || '-')}</span></div>
        <div class="kv"><span class="k">Outlet</span><span class="v">${u.outletIds.includes('ALL') ? 'Semua outlet' : u.outletIds.map(i => (DB.find('outlets',i)||{}).name).join(', ')}</span></div>
        <div class="kv"><span class="k">Shift kasir</span><span class="v">${shift ? 'Aktif sejak ' + U.fmtTime(shift.openAt) : 'Belum dibuka'}</span></div>
        <div class="kv"><span class="k">Login terakhir</span><span class="v">${U.fmtDateTime(u.lastLogin)}</span></div>
        <div class="divider"></div>
        <div class="small muted mb-8">Hak akses aktif (${role.permissions.length}):</div>
        <div class="pill-row">${role.permissions.map(p => `<span class="badge">${U.esc(App.Auth.PERMISSIONS[p] || p)}</span>`).join('')}</div>`,
      footer:`<button class="btn btn--danger" id="u-out">Keluar dari sistem</button>`,
      onMount(m) { m.el.querySelector('#u-out').onclick = () => App.Auth.logout(); }
    });
  }

  /* ---------------- Layar masuk ---------------- */
  function renderLogin() {
    const users = DB.all('users').filter(u => u.active !== false);
    let selected = users[0];
    let pin = '';
    const pick = document.getElementById('user-pick');
    const dots = document.getElementById('pin-dots');
    const err = document.getElementById('login-err');

    pick.innerHTML = users.map(u => `
      <button data-id="${u.id}" class="${u.id === selected.id ? 'is-active' : ''}">
        <span class="avatar-sm">${U.initials(u.name)}</span>
        <span style="flex:1"><b>${U.esc(u.name)}</b><small>${App.Auth.roleOf(u).name} · PIN ${u.pin}</small></span>
      </button>`).join('');

    function drawDots() {
      dots.innerHTML = [0,1,2,3].map(i => `<i class="${i < pin.length ? 'on' : ''}"></i>`).join('');
    }
    function tryLogin() {
      const r = App.Auth.login(selected.id, pin);
      if (r.ok) { boot(); }
      else { err.textContent = r.msg; pin = ''; drawDots(); }
    }
    function press(k) {
      err.textContent = '';
      if (k === 'del') pin = pin.slice(0, -1);
      else if (k === 'ok') { if (pin.length >= 4) tryLogin(); }
      else if (pin.length < 4) pin += k;
      drawDots();
      if (pin.length === 4) setTimeout(tryLogin, 140);
    }
    pick.querySelectorAll('button').forEach(b => b.onclick = () => {
      selected = DB.find('users', b.dataset.id);
      pick.querySelectorAll('button').forEach(x => x.classList.toggle('is-active', x === b));
      pin = ''; drawDots(); err.textContent = '';
    });
    document.getElementById('pinpad').innerHTML =
      ['1','2','3','4','5','6','7','8','9','del','0','ok'].map(k =>
        `<button data-k="${k}">${k === 'del' ? '⌫' : k === 'ok' ? '✓' : k}</button>`).join('');
    U.$$('#pinpad button').forEach(b => b.onclick = () => press(b.dataset.k));
    document.addEventListener('keydown', e => {
      if (document.getElementById('login').style.display === 'none') return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') press('ok');
    });
    drawDots();
  }

  /* ---------------- Daftar rute ---------------- */
  function registerRoutes() {
    const R = App.Router.add;
    R('dashboard',  { title:'Dashboard', group:'Operasional', render:App.Views.dashboard });
    R('pos',        { title:'Kasir', group:'Operasional', flush:true, permission:'pos.use', render:App.Views.pos });
    R('orders',     { title:'Daftar Pesanan', group:'Operasional', permission:'order.manage', render:App.Views.orders });
    R('tables',     { title:'Meja & Reservasi', group:'Operasional', permission:'order.manage', render:App.Views.tables });
    R('kds',        { title:'Kitchen Display System', group:'Operasional', permission:'kds.use', render:App.Views.kds });
    R('shifts',     { title:'Kas & Shift Kasir', group:'Operasional', permission:'pos.use', render:App.Views.shifts });

    R('selforder',      { title:'Self Order', group:'Perangkat', flush:true, render:App.Views.selforder });
    R('customerdisplay',{ title:'Customer Display', group:'Perangkat', flush:true, render:App.Views.customerdisplay });
    R('orderdisplay',   { title:'Order Display', group:'Perangkat', flush:true, render:App.Views.orderdisplay });
    R('qrtools',        { title:'QR Meja & Label Produk', group:'Perangkat', permission:'settings.manage', render:App.Views.qrtools });
    R('ownerapp',       { title:'Aplikasi Owner', group:'Perangkat', flush:true, permission:'report.view', render:App.Views.ownerapp });
    R('teamsapp',       { title:'Aplikasi Teams', group:'Perangkat', flush:true, render:App.Views.teamsapp });

    R('products',   { title:'Produk & Resep', group:'Inventori', permission:'inventory.view', render:App.Views.products });
    R('stock',      { title:'Stok & Opname', group:'Inventori', permission:'inventory.view', render:App.Views.stock });
    R('stockmoves', { title:'Mutasi Stok', group:'Inventori', permission:'inventory.view', render:App.Views.stockmoves });

    R('suppliers',  { title:'Supplier', group:'Pembelian', permission:'procure.view', render:App.Views.suppliers });
    R('purchase',   { title:'Purchase Order', group:'Pembelian', permission:'procure.view', render:App.Views.purchase });
    R('receiving',  { title:'Penerimaan Barang', group:'Pembelian', permission:'procure.view', render:App.Views.receiving });
    R('bills',      { title:'Tagihan & Hutang Supplier', group:'Pembelian', permission:'procure.view', render:App.Views.bills });

    R('finance',    { title:'Kas & Bank', group:'Keuangan', permission:'acc.view', render:App.Views.finance });
    R('expenses',   { title:'Pengeluaran', group:'Keuangan', permission:'acc.view', render:App.Views.expenses });
    R('journal',    { title:'Jurnal Umum', group:'Keuangan', permission:'acc.view', render:App.Views.journal });
    R('accounts',   { title:'Bagan Akun', group:'Keuangan', permission:'acc.view', render:App.Views.accounts });
    R('reports-fin',{ title:'Laporan Keuangan', group:'Keuangan', permission:'acc.view', render:App.Views.financeReports });

    R('employees',  { title:'Data Karyawan', group:'Karyawan', permission:'hr.view', render:App.Views.employees });
    R('attendance', { title:'Absensi & Jadwal Shift', group:'Karyawan', permission:'hr.view', render:App.Views.attendance });
    R('payroll',    { title:'Payroll & Komisi', group:'Karyawan', permission:'hr.view', render:App.Views.payroll });

    R('customers',  { title:'Pelanggan & Membership', group:'Pelanggan', permission:'crm.view', render:App.Views.customers });
    R('promos',     { title:'Promo & Program Loyalty', group:'Pelanggan', permission:'crm.view', render:App.Views.promos });
    R('campaigns',  { title:'Kampanye Marketing', group:'Pelanggan', permission:'crm.view', render:App.Views.campaigns });
    R('onlinestore',{ title:'Toko Online & E-Menu', group:'Pelanggan', permission:'crm.view', render:App.Views.onlinestore });

    R('reports',    { title:'Pusat Laporan', group:'Analisa', permission:'report.view', render:App.Views.reports });
    R('analytics',  { title:'Analisa Bisnis', group:'Analisa', permission:'report.view', render:App.Views.analytics });

    R('settings',   { title:'Pengaturan', group:'Sistem', permission:'settings.manage', render:App.Views.settings });
    R('users',      { title:'Pengguna & Hak Akses', group:'Sistem', permission:'settings.manage', render:App.Views.users });
    R('data',       { title:'Data & Backup', group:'Sistem', render:App.Views.data });
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    document.getElementById('login').style.display = 'none';
    const app = document.getElementById('app');
    app.classList.add('is-ready');

    buildNav();
    renderOutletName();
    const u = App.Auth.user();
    document.getElementById('chip-user').textContent = U.initials(u.name);
    document.getElementById('chip-user').onclick = userPanel;
    document.getElementById('chip-outlet').onclick = outletPicker;
    document.getElementById('chip-notif').onclick = notifPanel;
    document.getElementById('chip-pos').onclick = () => App.Router.go('pos');
    document.getElementById('btn-logout').onclick = () => App.Auth.logout();
    const themeBtn = document.getElementById('btn-theme');
    const syncTheme = () => themeBtn.innerHTML = App.State.theme() === 'dark'
      ? '<span class="nav-item__icon">☀️</span><span>Mode Terang</span>'
      : '<span class="nav-item__icon">🌙</span><span>Mode Gelap</span>';
    themeBtn.onclick = () => { App.State.toggleTheme(); syncTheme(); };
    syncTheme();

    App.Router.start();
    App.Shell.badges();
    setInterval(() => App.Shell.badges(), 30000);

    /* Pintasan papan ketik */
    document.addEventListener('keydown', e => {
      if (e.target.matches('input,textarea,select')) return;
      if (e.key === 'F2') { e.preventDefault(); App.Router.go('pos'); }
      if (e.key === 'F3') { e.preventDefault(); App.Router.go('orders'); }
      if (e.key === 'F4') { e.preventDefault(); App.Router.go('tables'); }
    });
  }

  /* ---------------- Mode perangkat ----------------
     Layar yang menghadap pelanggan (self order, customer display, order
     display) tidak memerlukan login staf. Sesi tamu dibuat tanpa hak akses
     apa pun dan navigasinya dikunci hanya pada layar-layar tersebut. */
  const DEVICE_ROUTES = ['selforder', 'customerdisplay', 'orderdisplay'];

  function deviceBoot() {
    document.getElementById('login').style.display = 'none';
    document.getElementById('app').classList.add('is-ready');
    App.Auth.setUser({ id:'device', name:'Perangkat', role:'device', roleId:null,
      outletIds:['ALL'], active:true, guest:true });

    const params = App.Router.parse().params;
    if (params.o && DB.find('outlets', params.o)) App.State.setOutlet(params.o);

    /* Kunci navigasi: rute lain dialihkan kembali ke layar perangkat. */
    const origRender = App.Router.render;
    App.Router.render = function () {
      const { path } = App.Router.parse();
      if (!DEVICE_ROUTES.includes(path)) { App.Router.go(DEVICE_ROUTES[0]); return; }
      origRender();
    };
    document.querySelector('.sidebar').style.display = 'none';
    document.querySelector('.topbar').style.display = 'none';
    App.Router.start();
  }

  /* ---------------- Mulai ---------------- */
  function init() {
    App.State.setTheme(App.State.theme());
    registerRoutes();

    if (!DB.all('outlets').length) {
      const splash = U.el(`<div style="position:fixed;inset:0;display:grid;place-items:center;background:var(--brand-800);color:#fff;z-index:999;text-align:center">
        <div><div style="font-size:44px">☕</div>
        <h2 style="margin:10px 0 6px">Menyiapkan data demo…</h2>
        <p style="color:#a9dbd1;font-size:13px">Membuat outlet, menu, resep, stok, transaksi 21 hari, jurnal &amp; payroll</p></div></div>`);
      document.body.appendChild(splash);
      setTimeout(() => {
        try {
          App.SeedMaster.build();
          App.SeedHistory.build();
        } catch (e) {
          console.error('Seeding gagal', e);
          alert('Gagal menyiapkan data contoh: ' + e.message);
        }
        splash.remove();
        start();
      }, 60);
      return;
    }
    start();
  }
  function start() {
    if (DB.isMemoryOnly()) {
      setTimeout(() => App.UI.toast('Penyimpanan browser tidak tersedia — data hanya bertahan selama sesi ini. Jalankan lewat server lokal untuk penyimpanan permanen.', 'warn', 6000), 800);
    }
    const restored = App.Auth.restore();
    if (restored) { boot(); return; }
    if (DEVICE_ROUTES.includes(App.Router.parse().path)) { deviceBoot(); return; }
    renderLogin();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
