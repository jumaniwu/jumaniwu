/* =============================================================
   SajiPOS — Pengaturan, Pengguna & Hak Akses, Data/Backup
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

App.Views.settings = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'usaha';

  function draw() {
    root.innerHTML = `
      <div class="page-head"><div><h2>Pengaturan</h2><p>Konfigurasi usaha, outlet, pajak, struk, pembayaran, dan operasional kasir</p></div></div>
      <div id="tabs"></div><div id="body"></div>`;
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'usaha', label:'Profil Usaha' }, { key:'outlet', label:'Outlet' },
      { key:'struk', label:'Struk & Printer' }, { key:'bayar', label:'Metode Pembayaran' },
      { key:'kasir', label:'Operasional Kasir' }, { key:'payroll', label:'Payroll' }
    ], tab, k => { tab = k; draw(); }));
    const b = root.querySelector('#body');
    ({ usaha:usahaTab, outlet:outletTab, struk:strukTab, bayar:bayarTab, kasir:kasirTab, payroll:payrollTab })[tab](b);
  }

  function saveCard(title, fields, values, onSave, extra = '') {
    return `<div class="card" style="max-width:760px">
      <div class="card__head"><h3>${U.esc(title)}</h3></div>
      <div class="card__body"><form id="sf">${App.UI.formHTML(fields, values)}${extra}</form></div>
      <div class="card__foot"><button class="btn btn--primary" id="save">Simpan Perubahan</button></div></div>`;
  }
  function wire(el, onSave) {
    el.querySelector('#save').onclick = () => {
      onSave(App.UI.readForm(el.querySelector('#sf')));
      App.UI.toast('Pengaturan disimpan', 'ok');
    };
  }

  function usahaTab(el) {
    const b = DB.settings().business;
    el.innerHTML = saveCard('Profil Usaha', [
      { name:'name', label:'Nama usaha', required:true, col:2 },
      { name:'legalName', label:'Nama badan usaha (PT/CV)', col:2 },
      { name:'npwp', label:'NPWP' }, { name:'phone', label:'Telepon' },
      { name:'email', label:'Email' }, { name:'currency', label:'Mata uang', type:'select', options:['IDR'] },
      { name:'address', label:'Alamat', type:'textarea', col:2 }
    ], b);
    wire(el, d => DB.setSetting('business', { ...b, ...d }));
  }

  function outletTab(el) {
    const outlets = DB.all('outlets');
    el.innerHTML = `<div class="flex justify-between items-center mb-12">
        <p class="small muted">Setiap outlet punya pengaturan pajak, service charge, dan jam operasional sendiri.</p>
        <button class="btn btn--primary btn--sm" id="new-outlet">+ Outlet Baru</button></div>
      <div class="grid g2">${outlets.map(o => `<div class="card"><div class="card__body">
        <div class="flex items-center gap-8 mb-8">
          <span class="thumb">${o.type === 'restoran' ? '🍽️' : '☕'}</span>
          <div style="flex:1"><b>${U.esc(o.name)}</b><div class="small muted">${U.esc(o.code)} · ${U.esc(o.address)}</div></div>
        </div>
        <div class="kv"><span class="k">Pajak (PB1)</span><span class="v">${o.taxRate}%</span></div>
        <div class="kv"><span class="k">Service charge</span><span class="v">${o.serviceCharge}%</span></div>
        <div class="kv"><span class="k">Jam operasional</span><span class="v">${U.esc(o.openHour)} – ${U.esc(o.closeHour)}</span></div>
        <div class="kv"><span class="k">Pembulatan</span><span class="v">Rp ${U.num(o.rounding)}</span></div>
        <div class="kv"><span class="k">Meja</span><span class="v">${DB.where('tables', t => t.outletId === o.id).length} meja</span></div>
        <button class="btn btn--sm btn--block mt-8" data-oe="${o.id}">Ubah Pengaturan</button>
      </div></div>`).join('')}</div>`;
    el.querySelector('#new-outlet').onclick = () => outletForm();
    el.querySelectorAll('[data-oe]').forEach(b => b.onclick = () => outletForm(DB.find('outlets', b.dataset.oe)));
  }
  function outletForm(o) {
    App.UI.formModal({
      title:o ? 'Ubah Outlet' : 'Outlet Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama outlet', required:true, col:2 },
        { name:'code', label:'Kode outlet', required:true, hint:'dipakai pada nomor transaksi' },
        { name:'type', label:'Jenis usaha', type:'select', options:[
          { value:'cafe', label:'Cafe / Coffee Shop' }, { value:'restoran', label:'Restoran' },
          { value:'foodtruck', label:'Food Truck / Booth' }] },
        { name:'phone', label:'Telepon' },
        { name:'taxRate', label:'Pajak PB1/PPN (%)', type:'number', step:'0.5', value:10 },
        { name:'serviceCharge', label:'Service charge (%)', type:'number', step:'0.5', value:5 },
        { name:'rounding', label:'Pembulatan (Rp)', type:'number', value:100 },
        { name:'openHour', label:'Jam buka', type:'time', value:'08:00' },
        { name:'closeHour', label:'Jam tutup', type:'time', value:'22:00' },
        { name:'address', label:'Alamat', type:'textarea', col:2 }
      ],
      values:o || { type:'cafe', taxRate:10, serviceCharge:5, rounding:100 },
      onSubmit(d) {
        o ? DB.update('outlets', o.id, d) : DB.insert('outlets', { ...d, active:true });
        App.UI.toast('Outlet disimpan', 'ok'); draw();
      }
    });
  }

  function strukTab(el) {
    const r = DB.settings().receipt;
    el.innerHTML = `<div class="grid g-1-2">
      ${saveCard('Struk & Printer', [
        { name:'header', label:'Judul struk', col:2 },
        { name:'subheader', label:'Sub judul / tagline', col:2 },
        { name:'footer', label:'Teks penutup', type:'textarea', col:2 },
        { name:'paperWidth', label:'Lebar kertas (mm)', type:'select', options:['58','80'] },
        { name:'copies', label:'Jumlah salinan', type:'number', value:1 },
        { name:'showNpwp', label:'NPWP', type:'checkbox', checkLabel:'Tampilkan NPWP di struk' },
        { name:'showCashier', label:'Kasir', type:'checkbox', checkLabel:'Tampilkan nama kasir' },
        { name:'showQr', label:'Kode', type:'checkbox', checkLabel:'Tampilkan barcode transaksi' }
      ], r)}
      <div class="card"><div class="card__head"><h3>Pratinjau Struk</h3>
        <button class="btn btn--sm" id="test-print" style="margin-left:auto">🖨️ Uji Cetak</button></div>
        <div class="card__body" style="background:var(--surface-3)"><div id="preview"></div></div></div>
    </div>`;
    const sample = () => {
      const o = DB.all('orders').find(x => x.status === 'paid');
      return o ? App.POS.receiptHTML(o) : '<p class="muted small">Belum ada transaksi untuk dipratinjau.</p>';
    };
    el.querySelector('#preview').innerHTML = sample();
    el.querySelector('#test-print').onclick = () => App.UI.print(sample());
    wire(el, d => { DB.setSetting('receipt', { ...r, ...d }); el.querySelector('#preview').innerHTML = sample(); });
  }

  function bayarTab(el) {
    const methods = DB.settings().paymentMethods;
    const mdr = DB.settings().pos.mdrRates || {};
    el.innerHTML = `<div class="card" style="max-width:820px">
      <div class="card__head"><h3>Metode Pembayaran</h3><span class="sub">aktif/nonaktif & biaya MDR</span></div>
      <div class="tbl-wrap"><table class="tbl">
        <thead><tr><th>Metode</th><th>Grup</th><th class="num" style="width:130px">MDR (%)</th><th style="width:110px">Status</th></tr></thead>
        <tbody>${methods.map((m, i) => `<tr>
          <td>${m.icon} <b>${U.esc(m.label)}</b></td><td class="small muted">${U.esc(m.group)}</td>
          <td><input class="input input--num md" type="number" step="0.1" data-k="${m.key}" value="${mdr[m.key] || 0}"></td>
          <td><label class="check"><input type="checkbox" class="ac" data-k="${m.key}" ${m.active ? 'checked' : ''}> Aktif</label></td>
        </tr>`).join('')}</tbody></table></div>
      <div class="card__foot"><button class="btn btn--primary" id="save-pay">Simpan</button></div></div>`;
    el.querySelector('#save-pay').onclick = () => {
      const newMdr = {}; const list = U.clone(methods);
      el.querySelectorAll('.md').forEach(i => newMdr[i.dataset.k] = Number(i.value) || 0);
      el.querySelectorAll('.ac').forEach(i => {
        const m = list.find(x => x.key === i.dataset.k); if (m) m.active = i.checked;
      });
      DB.setSetting('paymentMethods', list);
      DB.setSetting('pos', { ...DB.settings().pos, mdrRates:newMdr });
      App.UI.toast('Metode pembayaran disimpan', 'ok');
    };
  }

  function kasirTab(el) {
    const p = DB.settings().pos;
    el.innerHTML = saveCard('Operasional Kasir', [
      { name:'defaultOrderType', label:'Jenis order default', type:'select', options:[
        { value:'dinein', label:'Dine In' }, { value:'takeaway', label:'Bungkus' }] },
      { name:'roundingMode', label:'Mode pembulatan', type:'select', options:[
        { value:'nearest', label:'Terdekat' }, { value:'up', label:'Ke atas' }, { value:'down', label:'Ke bawah' }] },
      { name:'autoSendKitchen', label:'Dapur', type:'checkbox', checkLabel:'Kirim otomatis ke dapur saat transaksi dibayar' },
      { name:'requireCustomer', label:'Pelanggan', type:'checkbox', checkLabel:'Wajib pilih pelanggan setiap transaksi' },
      { name:'allowNegativeStock', label:'Stok', type:'checkbox', checkLabel:'Izinkan menjual walau stok bahan habis' }
    ], p, `<div class="field"><label>Tombol uang cepat (pisahkan dengan koma)</label>
      <input class="input" name="quickCashRaw" value="${(p.quickCash || []).join(', ')}"></div>`);
    wire(el, d => {
      const quickCash = String(d.quickCashRaw || '').split(',').map(x => U.parseNum(x)).filter(Boolean);
      delete d.quickCashRaw;
      DB.setSetting('pos', { ...p, ...d, quickCash });
    });
  }

  function payrollTab(el) {
    const p = DB.settings().payroll;
    el.innerHTML = saveCard('Pengaturan Payroll', [
      { name:'cutoffDay', label:'Tanggal cut-off absensi', type:'number', value:25 },
      { name:'payDay', label:'Tanggal pembayaran gaji', type:'number', value:1 },
      { name:'overtimeRate', label:'Pengali lembur', type:'number', step:'0.1', value:1.5 },
      { name:'lateToleranceMin', label:'Toleransi terlambat (menit)', type:'number', value:10 },
      { name:'bpjsKes', label:'BPJS Kesehatan (%)', type:'number', step:'0.1' },
      { name:'bpjsTk', label:'BPJS Ketenagakerjaan (%)', type:'number', step:'0.1' },
      { name:'pph21', label:'PPh 21', type:'checkbox', checkLabel:'Hitung PPh 21 otomatis' }
    ], p);
    wire(el, d => DB.setSetting('payroll', { ...p, ...d }));
  }
  draw();
};

/* ---------------- Pengguna & Hak Akses ---------------- */
App.Views.users = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'users';

  function draw() {
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Pengguna & Hak Akses</h2><p>Kelola akun kasir, manager, akuntan, dan pembagian otorisasi</p></div>
        <div class="page-head__actions">
          <button class="btn" id="log-btn">📜 Jejak Aktivitas</button>
          <button class="btn btn--primary" id="new-user">+ Pengguna Baru</button>
        </div>
      </div>
      <div id="tabs"></div><div id="body"></div>`;
    root.querySelector('#new-user').onclick = () => userForm();
    root.querySelector('#log-btn').onclick = auditLog;
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'users', label:'Pengguna', count:DB.all('users').length },
      { key:'roles', label:'Peran & Hak Akses', count:DB.all('roles').length }
    ], tab, k => { tab = k; draw(); }));
    const b = root.querySelector('#body');
    if (tab === 'users') usersTab(b); else rolesTab(b);
  }

  function usersTab(el) {
    el.innerHTML = '<div id="t"></div>';
    el.querySelector('#t').appendChild(App.UI.dataTable({
      rows:DB.all('users'), exportName:'daftar-pengguna', pageSize:15, searchKeys:['name','email'],
      onRowClick: u => userForm(u),
      cols:[
        { key:'name', label:'Pengguna', render:u => `<div class="flex items-center gap-8">
            <span class="avatar-sm">${U.initials(u.name)}</span>
            <div><b>${U.esc(u.name)}</b><div class="small muted">${U.esc(u.email || '')}</div></div></div>` },
        { key:'role', label:'Peran', render:u => App.UI.badge(App.Auth.roleOf(u).name, 'brand') },
        { key:'outletIds', label:'Akses Outlet', render:u => u.outletIds.includes('ALL') ? 'Semua outlet'
            : u.outletIds.map(i => (DB.find('outlets', i) || {}).name).join(', ') },
        { key:'pin', label:'PIN', render:u => `<span class="mono">••••</span>` },
        { key:'lastLogin', label:'Login Terakhir', render:u => u.lastLogin ? U.fmtDateTime(u.lastLogin) : '<span class="muted">belum pernah</span>' },
        { key:'active', label:'Status', render:u => App.UI.badge(u.active !== false ? 'Aktif' : 'Nonaktif', u.active !== false ? 'green' : 'red') }
      ]
    }));
  }

  function userForm(u) {
    const roles = DB.all('roles');
    const outlets = DB.all('outlets');
    App.UI.formModal({
      title:u ? 'Ubah Pengguna' : 'Pengguna Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama lengkap', required:true, col:2 },
        { name:'email', label:'Email' },
        { name:'pin', label:'PIN (4–6 digit)', required:true, attrs:'maxlength="6" inputmode="numeric"' },
        { name:'roleId', label:'Peran', type:'select', required:true,
          options:roles.map(r => ({ value:r.id, label:r.name })) },
        { name:'outletScope', label:'Akses outlet', type:'select', options:[
          { value:'ALL', label:'Semua outlet' }, ...outlets.map(o => ({ value:o.id, label:o.name }))] },
        { name:'active', label:'Aktif', type:'checkbox', checkLabel:'Akun dapat digunakan untuk login', col:2 }
      ],
      values:u ? { ...u, outletScope:u.outletIds[0] } : { active:true, roleId:'role_kasir', outletScope:'ALL' },
      validate(d) {
        if (!/^\d{4,6}$/.test(String(d.pin))) return 'PIN harus 4–6 digit angka';
        const dup = DB.first('users', x => x.pin === String(d.pin) && (!u || x.id !== u.id));
        if (dup) return `PIN sudah dipakai oleh ${dup.name}`;
        return null;
      },
      onSubmit(d) {
        const role = DB.find('roles', d.roleId);
        const payload = { name:d.name, email:d.email, pin:String(d.pin), roleId:d.roleId,
          role:role ? role.key || 'kasir' : 'kasir', outletIds:[d.outletScope], active:d.active };
        u ? DB.update('users', u.id, payload) : DB.insert('users', payload);
        App.UI.toast('Pengguna disimpan', 'ok'); draw();
      }
    });
  }

  function rolesTab(el) {
    el.innerHTML = `<div class="grid g2">${DB.all('roles').map(r => `
      <div class="card"><div class="card__body">
        <div class="flex items-center gap-8 mb-8">
          <b style="flex:1;font-size:15px">${U.esc(r.name)}</b>
          <span class="badge">${r.permissions.length} hak akses</span>
          <span class="badge badge--brand">${DB.all('users').filter(u => u.roleId === r.id).length} pengguna</span>
        </div>
        <div class="pill-row" style="max-height:120px;overflow:auto">
          ${r.permissions.slice(0, 8).map(p => `<span class="badge">${U.esc(App.Auth.PERMISSIONS[p] || p)}</span>`).join('')}
          ${r.permissions.length > 8 ? `<span class="badge">+${r.permissions.length - 8} lainnya</span>` : ''}
        </div>
        <button class="btn btn--sm btn--block mt-12" data-re="${r.id}">Atur Hak Akses</button>
      </div></div>`).join('')}</div>`;
    el.querySelectorAll('[data-re]').forEach(b => b.onclick = () => roleForm(DB.find('roles', b.dataset.re)));
  }
  function roleForm(r) {
    const m = App.UI.modal({
      title:'Hak Akses — ' + r.name, size:'lg',
      body:`<div class="field"><label>Nama peran</label><input class="input" id="r-name" value="${U.esc(r.name)}"></div>
        <div class="divider"></div>
        <div style="display:grid;gap:6px;max-height:400px;overflow:auto">
        ${Object.entries(App.Auth.PERMISSIONS).map(([k, lbl]) => `
          <label class="check" style="padding:7px 9px;border:1px solid var(--border);border-radius:8px">
            <input type="checkbox" data-p="${k}" ${r.permissions.includes(k) ? 'checked' : ''}>
            <span style="flex:1">${U.esc(lbl)}</span><span class="small muted mono">${k}</span></label>`).join('')}
        </div>`,
      footer:`<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Simpan</button>`
    });
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const permissions = [...m.body.querySelectorAll('[data-p]:checked')].map(i => i.dataset.p);
      DB.update('roles', r.id, { name:m.body.querySelector('#r-name').value, permissions });
      App.UI.toast('Hak akses diperbarui', 'ok'); m.close(); draw();
    };
  }

  function auditLog() {
    const logs = U.sortBy(DB.all('activityLog'), l => l.at, 'desc');
    const m = App.UI.modal({ title:'Jejak Aktivitas Sistem', subtitle:`${logs.length} catatan terakhir`, size:'xl', body:'<div id="al"></div>' });
    m.body.querySelector('#al').appendChild(App.UI.dataTable({
      rows:logs, exportName:'jejak-aktivitas', pageSize:20, searchKeys:['action','detail','userName'],
      cols:[
        { key:'at', label:'Waktu', render:l => U.fmtDateTime(l.at) },
        { key:'userName', label:'Pengguna' },
        { key:'action', label:'Aksi', render:l => `<span class="mono small">${U.esc(l.action)}</span>` },
        { key:'detail', label:'Keterangan' },
        { key:'outletId', label:'Outlet', render:l => U.esc((DB.find('outlets', l.outletId) || {}).name || '-') }
      ]
    }));
  }
  draw();
};

/* ---------------- Data & Backup ---------------- */
App.Views.data = function (root) {
  const U = App.U, DB = App.DB;
  function draw() {
    const st = DB.stats();
    root.innerHTML = `
      <div class="page-head"><div><h2>Data & Backup</h2><p>Cadangkan, pulihkan, atau atur ulang basis data aplikasi</p></div></div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Ukuran Data', icon:'💾', value:(st.bytes / 1048576).toFixed(2).replace('.', ',') + ' MB',
          sub: st.memoryOnly ? '⚠️ hanya di memori' : 'tersimpan di browser' })}
        ${App.UI.stat({ label:'Total Transaksi', icon:'🧾', value:U.num(DB.all('orders').length), sub:'pesanan tercatat' })}
        ${App.UI.stat({ label:'Jurnal', icon:'📒', value:U.num(DB.all('journals').length), sub:'entri akuntansi' })}
        ${App.UI.stat({ label:'Mutasi Stok', icon:'📦', value:U.num(DB.all('stockMoves').length), sub:'pergerakan persediaan' })}
      </div>
      ${st.memoryOnly ? `<div class="card mb-16" style="border-color:var(--amber)"><div class="card__body">
        <b>⚠️ Penyimpanan browser tidak tersedia.</b>
        <p class="small muted mt-4">Data hanya bertahan selama tab ini terbuka. Ini biasanya terjadi saat membuka file
        langsung lewat <span class="mono">file://</span>. Jalankan aplikasi melalui server lokal
        (<span class="mono">python3 -m http.server</span>) agar data tersimpan permanen.</p></div></div>` : ''}
      <div class="grid g2 mb-16">
        <div class="card"><div class="card__head"><h3>Cadangkan & Pulihkan</h3></div><div class="card__body">
          <p class="small muted mb-12">Unduh seluruh data dalam satu berkas JSON, simpan di tempat aman, dan pulihkan kapan saja.</p>
          <button class="btn btn--primary btn--block mb-8" id="bk">⬇️ Unduh Backup (JSON)</button>
          <button class="btn btn--block mb-8" id="rs">⬆️ Pulihkan dari Backup</button>
          <input type="file" id="file" accept=".json" class="hidden">
          <div class="divider"></div>
          <button class="btn btn--danger btn--block" id="reset">🗑️ Atur Ulang & Muat Data Contoh</button>
          <p class="small muted mt-8">Menghapus seluruh data lalu membuat ulang data demo (outlet, menu, transaksi 21 hari).</p>
        </div></div>
        <div class="card"><div class="card__head"><h3>Isi Basis Data</h3>
            <span class="sub" id="media-usage" style="margin-left:auto"></span></div>
          <div class="card__body" style="max-height:420px;overflow:auto">
            ${st.rows.map(r => `<div class="kv"><span class="k">${U.esc(r.koleksi)}</span><span class="v">${U.num(r.jumlah)}</span></div>`).join('')}
          </div></div>
      </div>
      <div class="card"><div class="card__head"><h3>Tentang Aplikasi</h3></div><div class="card__body">
        <div class="kv"><span class="k">Nama</span><span class="v">SajiPOS — Cafe & Restaurant Suite</span></div>
        <div class="kv"><span class="k">Modul</span><span class="v">POS · Inventori · Procurement · Akuntansi · HR · CRM</span></div>
        <div class="kv"><span class="k">Metode HPP</span><span class="v">Rata-rata bergerak (moving average)</span></div>
        <div class="kv"><span class="k">Akuntansi</span><span class="v">Double-entry, posting otomatis dari operasional</span></div>
        <div class="kv"><span class="k">Penyimpanan</span><span class="v">${st.memoryOnly ? 'Memori (sementara)' : 'localStorage browser'}</span></div>
      </div></div>`;

    root.querySelector('#bk').onclick = async () => {
      const btn = root.querySelector('#bk');
      btn.disabled = true; btn.textContent = '⏳ Menyiapkan backup…';
      try {
        const data = JSON.parse(DB.exportJSON());
        /* Foto materi promosi disimpan di IndexedDB — ikut disertakan sebagai
           data URL agar berkas backup benar-benar utuh. */
        data._media = await App.Media.exportAll();
        const json = JSON.stringify(data, null, 2);
        const ok = U.download(`sajipos-backup-${U.today()}.json`, json, 'application/json');
        const mb = (json.length / 1048576).toFixed(2).replace('.', ',');
        App.UI.toast(ok ? `Backup diunduh (${mb} MB, termasuk ${Object.keys(data._media).length} gambar)` : 'Gagal mengunduh', ok ? 'ok' : 'err');
      } catch (e) {
        App.UI.toast('Gagal membuat backup: ' + e.message, 'err');
      }
      btn.disabled = false; btn.textContent = '⬇️ Unduh Backup (JSON)';
    };
    App.Media.usage().then(u => {
      const el = root.querySelector('#media-usage');
      if (el) el.textContent = `+ ${u.count} gambar (${(u.bytes/1048576).toFixed(2).replace('.',',')} MB) di IndexedDB`;
    }).catch(() => {});
    root.querySelector('#rs').onclick = () => root.querySelector('#file').click();
    root.querySelector('#file').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        if (!await App.UI.confirm('Pulihkan data dari backup? Seluruh data saat ini akan ditimpa.', { danger:true, okText:'Pulihkan' })) return;
        try {
          const parsed = JSON.parse(rd.result);
          const media = parsed._media; delete parsed._media;
          DB.importJSON(JSON.stringify(parsed));
          let n = 0;
          if (media) { await App.Media.clear(); n = await App.Media.importAll(media); }
          App.UI.toast(`Data dipulihkan${n ? ` beserta ${n} gambar` : ''}`, 'ok');
          setTimeout(() => location.reload(), 900);
        } catch (err) { App.UI.toast('Berkas backup tidak valid: ' + err.message, 'err'); }
      };
      rd.readAsText(f);
    };
    root.querySelector('#reset').onclick = async () => {
      if (!await App.UI.confirm('Hapus <b>seluruh data</b> dan muat ulang data contoh? Tindakan ini tidak bisa dibatalkan.',
        { danger:true, okText:'Ya, atur ulang' })) return;
      DB.reset();
      try { await App.Media.clear(); } catch (e) {}
      try { sessionStorage.clear(); } catch (e) {}
      location.reload();
    };
  }
  draw();
};
