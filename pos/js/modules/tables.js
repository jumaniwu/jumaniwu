/* =============================================================
   SajiPOS — Meja, Denah Outlet & Reservasi
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

App.Views.tables = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'map';

  function draw() {
    const oid = App.State.outletId();
    const tables = DB.all('tables').filter(t => oid === 'ALL' || t.outletId === oid);
    const res = DB.all('reservations').filter(r => oid === 'ALL' || r.outletId === oid);
    const upcoming = res.filter(r => r.date >= U.today() && r.status !== 'selesai');

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Meja & Reservasi</h2><p>Denah meja real-time, status pesanan, dan daftar reservasi</p></div>
        <div class="page-head__actions">
          <button class="btn" id="add-table">+ Meja</button>
          <button class="btn btn--primary" id="add-res">📅 Reservasi Baru</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Meja Kosong', icon:'🟢', value:U.num(tables.filter(t=>t.status==='free').length), sub:`dari ${tables.length} meja` })}
        ${App.UI.stat({ label:'Terisi', icon:'🟠', value:U.num(tables.filter(t=>t.status==='occupied').length), sub:'sedang dilayani' })}
        ${App.UI.stat({ label:'Minta Bill', icon:'🔵', value:U.num(tables.filter(t=>t.status==='billed').length), sub:'siap dibayar' })}
        ${App.UI.stat({ label:'Reservasi Mendatang', icon:'📅', value:U.num(upcoming.length), sub:`${U.sum(upcoming, r=>r.pax)} tamu` })}
      </div>
      <div id="tabs"></div>
      <div id="body"></div>`;

    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'map', label:'Denah Meja' },
      { key:'res', label:'Reservasi', count:upcoming.length }
    ], tab, k => { tab = k; draw(); }));

    const body = root.querySelector('#body');
    if (tab === 'map') drawMap(body, tables);
    else drawRes(body, res);

    root.querySelector('#add-table').onclick = () => tableForm();
    root.querySelector('#add-res').onclick = () => resForm();
  }

  function drawMap(body, tables) {
    const areas = U.unique(tables.map(t => t.area));
    body.innerHTML = areas.map(a => {
      const list = tables.filter(t => t.area === a);
      return `<div class="card mb-16">
        <div class="card__head"><h3>${U.esc(a)}</h3>
          <span class="sub">${list.filter(t=>t.status==='free').length}/${list.length} kosong</span></div>
        <div class="card__body"><div class="tmap">
          ${list.map(t => {
            const o = t.orderId ? DB.find('orders', t.orderId) : null;
            const dur = t.openedAt ? U.minutesSince(t.openedAt) : 0;
            return `<div class="tbl-card ${t.status}" data-t="${t.id}">
              <div class="tbl-card__no">${U.esc(t.name)}</div>
              <div class="tbl-card__cap">${t.capacity} kursi</div>
              <div class="tbl-card__st">${({free:'Kosong',occupied:'Terisi',billed:'Minta Bill',reserved:'Reservasi'})[t.status]}</div>
              ${o ? `<div class="tbl-card__amt">${U.rp(o.total)}</div><div class="small muted">${dur} menit</div>` : ''}
            </div>`;
          }).join('')}
        </div></div></div>`;
    }).join('') || App.UI.emptyState('Belum ada meja', 'Tambahkan meja untuk outlet ini', '🪑');

    body.querySelectorAll('[data-t]').forEach(el => el.onclick = () => tableAction(DB.find('tables', el.dataset.t)));
  }

  function tableAction(t) {
    const o = t.orderId ? DB.find('orders', t.orderId) : null;
    const m = App.UI.modal({
      title:'Meja ' + t.name, subtitle:`${t.area} · ${t.capacity} kursi · ${({free:'Kosong',occupied:'Terisi',billed:'Minta Bill',reserved:'Reservasi'})[t.status]}`,
      body: o ? `
        <div class="kv"><span class="k">No. pesanan</span><span class="v mono">${U.esc(o.no)}</span></div>
        <div class="kv"><span class="k">Dibuka</span><span class="v">${U.fmtTime(o.createdAt)} (${U.minutesSince(o.createdAt)} menit)</span></div>
        <div class="kv"><span class="k">Tamu</span><span class="v">${o.guestCount}</span></div>
        <div class="kv"><span class="k">Pelanggan</span><span class="v">${U.esc(o.customerName || 'Umum')}</span></div>
        <div class="divider"></div>
        ${o.items.map(it => `<div class="kv"><span class="k">${it.qty}× ${U.esc(it.name)}</span><span class="v">${U.rp(it.subtotal)}</span></div>`).join('')}
        <div class="divider"></div>
        <div class="kv" style="font-size:15px"><span class="k bold">Total</span><span class="v">${U.rp(o.total)}</span></div>`
        : `<p class="muted small">Meja kosong. Mulai pesanan baru atau ubah statusnya.</p>`,
      footer: o ? `<button class="btn" data-a="move">↔️ Pindah Meja</button>
                   <button class="btn" data-a="bill">🧾 Minta Bill</button>
                   <button class="btn btn--primary" data-a="open">Buka di Kasir</button>`
                : `<button class="btn" data-a="edit">✏️ Ubah Meja</button>
                   <button class="btn" data-a="reserve">📅 Tandai Reservasi</button>
                   <button class="btn btn--primary" data-a="new">🧾 Pesanan Baru</button>`
    });
    const a = k => m.el.querySelector(`[data-a="${k}"]`);
    if (a('open')) a('open').onclick = () => { m.close(); App.Router.go('pos', { table:t.id }); };
    if (a('new')) a('new').onclick = () => { m.close(); App.Router.go('pos', { table:t.id }); };
    if (a('bill')) a('bill').onclick = () => { DB.update('tables', t.id, { status:'billed' }); m.close(); draw(); App.UI.toast('Meja ditandai minta bill'); };
    if (a('edit')) a('edit').onclick = () => { m.close(); tableForm(t); };
    if (a('reserve')) a('reserve').onclick = () => { DB.update('tables', t.id, { status:'reserved' }); m.close(); draw(); };
    if (a('move')) a('move').onclick = () => {
      m.close();
      const free = DB.where('tables', x => x.outletId === t.outletId && x.status === 'free');
      const mm = App.UI.modal({ title:'Pindahkan ke meja', body:`<div class="tmap">
        ${free.map(f => `<div class="tbl-card free" data-f="${f.id}"><div class="tbl-card__no">${U.esc(f.name)}</div>
          <div class="tbl-card__cap">${f.capacity} kursi</div></div>`).join('') || App.UI.emptyState('Tidak ada meja kosong','','🪑')}</div>` });
      mm.body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => {
        const dest = DB.find('tables', b.dataset.f);
        DB.update('tables', dest.id, { status:t.status, orderId:t.orderId, openedAt:t.openedAt });
        DB.update('tables', t.id, { status:'free', orderId:null, openedAt:null });
        DB.update('orders', o.id, { tableId:dest.id, tableName:dest.name });
        mm.close(); draw(); App.UI.toast(`Pesanan dipindah ke meja ${dest.name}`, 'ok');
      });
    };
  }

  function tableForm(t) {
    const oid = App.State.outletId() === 'ALL' ? DB.all('outlets')[0].id : App.State.outletId();
    const areas = U.unique(DB.where('tables', x => x.outletId === oid).map(x => x.area));
    App.UI.formModal({
      title: t ? 'Ubah Meja' : 'Tambah Meja',
      fields:[
        { name:'name', label:'Nama / nomor meja', required:true },
        { name:'area', label:'Area', type:'select', options: areas.length ? areas : ['Indoor','Outdoor'] },
        { name:'capacity', label:'Kapasitas kursi', type:'number', value:4, required:true },
        { name:'status', label:'Status', type:'select', options:[
          { value:'free', label:'Kosong' }, { value:'occupied', label:'Terisi' },
          { value:'reserved', label:'Reservasi' }, { value:'billed', label:'Minta Bill' }] }
      ],
      values: t || {},
      extraHTML: t ? `<button class="btn btn--danger btn--sm" id="del-table">Hapus meja</button>` : '',
      onSubmit(d) {
        if (t) DB.update('tables', t.id, d);
        else DB.insert('tables', { ...d, outletId:oid, orderId:null });
        App.UI.toast('Meja disimpan', 'ok'); draw();
      },
      onMount(m) {}
    });
    const del = document.getElementById('del-table');
    if (del) del.onclick = async () => {
      if (await App.UI.confirm('Hapus meja ini?', { danger:true })) {
        DB.remove('tables', t.id); document.querySelector('.overlay').remove();
        document.body.style.overflow = ''; draw();
      }
    };
  }

  function drawRes(body, res) {
    body.innerHTML = '<div id="res-table"></div>';
    body.querySelector('#res-table').appendChild(App.UI.dataTable({
      rows:U.sortBy(res, r => r.date + r.time, 'desc'), exportName:'reservasi', pageSize:15,
      searchKeys:['name','phone'],
      onRowClick: r => resForm(r),
      cols:[
        { key:'date', label:'Tanggal', render:r => `${U.fmtDate(r.date)}<div class="small muted">${U.esc(r.time)}</div>` },
        { key:'name', label:'Nama', render:r => `<b>${U.esc(r.name)}</b><div class="small muted">${U.esc(r.phone || '')}</div>` },
        { key:'pax', label:'Tamu', align:'right', render:r => U.num(r.pax) },
        { key:'tableId', label:'Meja', render:r => U.esc((DB.find('tables', r.tableId)||{}).name || '-') },
        { key:'depositPaid', label:'DP', align:'right', render:r => r.depositPaid ? U.rp(r.depositPaid) : '-' },
        { key:'note', label:'Catatan', render:r => `<span class="small">${U.esc(r.note || '')}</span>` },
        { key:'status', label:'Status', render:r => App.UI.badge(U.titleCase(r.status),
            r.status === 'dikonfirmasi' ? 'green' : r.status === 'menunggu' ? 'amber' : r.status === 'batal' ? 'red' : 'blue') }
      ]
    }));
  }

  function resForm(r) {
    const oid = App.State.outletId() === 'ALL' ? DB.all('outlets')[0].id : App.State.outletId();
    const tables = DB.where('tables', t => t.outletId === oid);
    App.UI.formModal({
      title: r ? 'Ubah Reservasi' : 'Reservasi Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama pemesan', required:true },
        { name:'phone', label:'Nomor HP', required:true },
        { name:'date', label:'Tanggal', type:'date', value:U.today(), required:true },
        { name:'time', label:'Jam', type:'time', value:'19:00', required:true },
        { name:'pax', label:'Jumlah tamu', type:'number', value:2, required:true },
        { name:'tableId', label:'Meja', type:'select', options:[{value:'',label:'— belum ditentukan —'},
            ...tables.map(t => ({ value:t.id, label:`${t.name} (${t.area}, ${t.capacity} kursi)` }))] },
        { name:'depositPaid', label:'Deposit / DP (Rp)', type:'money', value:0 },
        { name:'status', label:'Status', type:'select', options:['menunggu','dikonfirmasi','selesai','batal'] },
        { name:'note', label:'Catatan khusus', type:'textarea', col:2 }
      ],
      values: r || { status:'menunggu' },
      onSubmit(d) {
        if (r) DB.update('reservations', r.id, d);
        else DB.insert('reservations', { ...d, outletId:oid, customerId:null });
        if (d.tableId && d.status === 'dikonfirmasi' && d.date === U.today())
          DB.update('tables', d.tableId, { status:'reserved' });
        App.UI.toast('Reservasi disimpan', 'ok'); draw();
      }
    });
  }
  draw();
};
