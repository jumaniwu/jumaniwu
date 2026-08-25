/* =============================================================
   SajiPOS — CRM: Pelanggan, Membership, Promo, Kampanye,
   Toko Online & E-Menu
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

App.CRM = (function () {
  const U = App.U, DB = App.DB;

  function customerForm(c, done) {
    const tiers = DB.all('tiers');
    const groups = DB.all('customerGroups');
    App.UI.formModal({
      title:c ? 'Ubah Pelanggan' : 'Member Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama lengkap', required:true, col:2 },
        { name:'phone', label:'Nomor HP / WhatsApp', required:true },
        { name:'email', label:'Email' },
        { name:'code', label:'Kode member', value:'MBR-' + (1001 + DB.all('customers').length) },
        { name:'birthday', label:'Tanggal lahir', type:'date' },
        { name:'tierId', label:'Tier membership', type:'select', options:tiers.map(t => ({ value:t.id, label:t.name })) },
        { name:'groupId', label:'Grup pelanggan', type:'select', options:groups.map(g => ({ value:g.id, label:g.name })) },
        { name:'address', label:'Alamat', type:'textarea', col:2 },
        { name:'note', label:'Catatan (preferensi, alergi, dll.)', type:'textarea', col:2 }
      ],
      values:c || { tierId:'tier_reg', groupId:groups[0] && groups[0].id },
      onSubmit(d) {
        let rec;
        if (c) rec = DB.update('customers', c.id, d);
        else rec = DB.insert('customers', { ...d, points:0, stamps:0, deposit:0, totalSpend:0,
          visits:0, joinDate:U.today(), lastVisit:null, active:true });
        App.UI.toast('Data pelanggan disimpan', 'ok');
        if (done) done(rec);
      }
    });
  }

  function customerStats(c) {
    const orders = DB.all('orders').filter(o => o.customerId === c.id && o.status === 'paid');
    const mix = App.Sales.productMix(orders);
    const days = orders.length > 1
      ? Math.round((new Date(U.ymd(orders[orders.length - 1].date)) - new Date(U.ymd(orders[0].date))) / 86400000 / (orders.length - 1))
      : 0;
    return { orders, mix, avgGap:days, total:U.sum(orders, o => o.total),
      avg: orders.length ? U.sum(orders, o => o.total) / orders.length : 0 };
  }

  function customerDetail(c, onChange) {
    const st = customerStats(c);
    const tier = DB.find('tiers', c.tierId) || {};
    const nextTier = U.sortBy(DB.all('tiers').filter(t => t.minSpend > (c.totalSpend || 0)), t => t.minSpend)[0];
    const m = App.UI.modal({
      title:c.name, subtitle:`${c.code} · ${c.phone} · member sejak ${U.fmtDate(c.joinDate)}`, size:'xl',
      body:`<div class="grid g4 mb-16">
          ${App.UI.stat({ label:'Total Belanja', value:U.rp(c.totalSpend || 0), sub:`${c.visits || 0} kunjungan` })}
          ${App.UI.stat({ label:'Rata-rata Transaksi', value:U.rp(st.avg), sub:st.avgGap ? `datang tiap ~${st.avgGap} hari` : '' })}
          ${App.UI.stat({ label:'Poin', value:U.num(c.points || 0), sub:`stamp ${c.stamps || 0}/10` })}
          ${App.UI.stat({ label:'Deposit', value:U.rp(c.deposit || 0), sub:'saldo tersimpan' })}
        </div>
        <div class="card mb-16"><div class="card__body">
          <div class="flex items-center gap-12 mb-8">
            <span class="badge" style="background:${tier.color}22;color:${tier.color};font-size:13px;padding:5px 12px">${U.esc(tier.name || '-')}</span>
            <span class="small muted">${U.esc(tier.benefit || '')}</span>
          </div>
          ${nextTier ? `<div class="small muted mb-8">Menuju ${nextTier.name}: kurang ${U.rp(nextTier.minSpend - (c.totalSpend || 0))}</div>
            <div class="progress"><i style="width:${Math.min(100, ((c.totalSpend || 0) / nextTier.minSpend) * 100)}%"></i></div>`
            : '<div class="small muted">Sudah mencapai tier tertinggi 🎉</div>'}
        </div></div>
        <div class="grid g2">
          <div class="card"><div class="card__head"><h3>Menu Favorit</h3></div><div class="card__body">
            ${App.Chart.hbar(st.mix.slice(0, 6).map(x => ({ label:x.nama, value:x.qty })), { unit:'×' })
              || '<div class="empty small">Belum ada transaksi</div>'}</div></div>
          <div class="card"><div class="card__head"><h3>Riwayat Transaksi</h3></div>
            <div class="card__body" style="max-height:300px;overflow:auto">
            ${U.sortBy(st.orders, o => o.date, 'desc').slice(0, 15).map(o => `<div class="kv">
              <span class="k">${U.esc(o.no)}<br><span class="small">${U.fmtDateTime(o.date)}</span></span>
              <span class="v">${U.rp(o.total)}</span></div>`).join('') || App.UI.emptyState('Belum ada transaksi','','🧾')}
          </div></div>
        </div>
        ${c.note ? `<div class="card mt-16"><div class="card__body small"><b>Catatan:</b> ${U.esc(c.note)}</div></div>` : ''}`,
      footer:`<button class="btn" data-a="deposit">💰 Top Up Deposit</button>
              <button class="btn" data-a="wa">💬 Kirim WhatsApp</button>
              <button class="btn btn--primary" data-a="edit">✏️ Ubah Data</button>`
    });
    m.el.querySelector('[data-a="edit"]').onclick = () => { m.close(); customerForm(c, () => { if (onChange) onChange(); }); };
    m.el.querySelector('[data-a="wa"]').onclick = () => {
      App.UI.prompt('Pesan WhatsApp', { value:`Halo ${c.name}, ada promo spesial untuk Anda di Kopi Senja hari ini!` })
        .then(v => { if (v) { App.UI.toast('Pesan dikirim ke ' + c.phone, 'ok'); DB.log('crm.wa', `WA ke ${c.name}`); } });
    };
    m.el.querySelector('[data-a="deposit"]').onclick = () => App.UI.formModal({
      title:'Top Up Deposit — ' + c.name,
      fields:[
        { name:'amount', label:'Jumlah top up (Rp)', type:'money', required:true },
        { name:'method', label:'Metode', type:'select', options:[
          { value:'cash', label:'Tunai' }, { value:'transfer', label:'Transfer' }, { value:'qris', label:'QRIS' }] }
      ],
      onSubmit(d) {
        DB.update('customers', c.id, cu => ({ deposit:(cu.deposit || 0) + d.amount }));
        App.Ledger.postCustomerDeposit(c, d.amount, d.method);
        App.UI.toast('Deposit ditambahkan & terposting ke jurnal', 'ok');
        m.close(); if (onChange) onChange();
      }
    });
  }
  return { customerForm, customerDetail, customerStats };
})();

/* ---------------- Pelanggan ---------------- */
App.Views.customers = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'all';

  function draw() {
    const cs = DB.all('customers');
    const tiers = DB.all('tiers');
    const aktif = cs.filter(c => c.lastVisit && c.lastVisit >= U.addDays(U.today(), -30));
    const churn = cs.filter(c => c.lastVisit && c.lastVisit < U.addDays(U.today(), -60));
    const ultah = cs.filter(c => c.birthday && c.birthday.slice(5, 7) === U.today().slice(5, 7));
    const rows = tab === 'all' ? cs : tab === 'aktif' ? aktif : tab === 'churn' ? churn
      : tab === 'ultah' ? ultah : cs.filter(c => c.tierId === tab);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Pelanggan & Membership</h2><p>Basis data pelanggan, tier, poin, stamp, dan analisa perilaku belanja</p></div>
        <div class="page-head__actions">
          <button class="btn" id="tier-btn">🏅 Kelola Tier</button>
          <button class="btn" id="grp-btn">👥 Grup Pelanggan</button>
          <button class="btn btn--primary" id="new-cust">+ Member Baru</button>
        </div>
      </div>
      <div class="grid g5 mb-16">
        ${App.UI.stat({ label:'Total Member', icon:'💚', value:U.num(cs.length), sub:'terdaftar' })}
        ${App.UI.stat({ label:'Aktif 30 Hari', icon:'🔥', value:U.num(aktif.length), sub:U.pct(aktif.length, cs.length || 1) + ' dari total' })}
        ${App.UI.stat({ label:'Berisiko Churn', icon:'😴', value:U.num(churn.length), sub:'>60 hari tidak datang', tone:'var(--amber)' })}
        ${App.UI.stat({ label:'Total Poin Beredar', icon:'⭐', value:U.num(U.sum(cs, c => c.points || 0)), sub:'kewajiban loyalty' })}
        ${App.UI.stat({ label:'Ulang Tahun Bulan Ini', icon:'🎂', value:U.num(ultah.length), sub:'peluang kampanye' })}
      </div>
      <div class="grid g4 mb-16">
        ${tiers.map(t => {
          const n = cs.filter(c => c.tierId === t.id).length;
          return `<div class="card"><div class="card__body">
            <div class="flex items-center gap-8">
              <span style="width:10px;height:10px;border-radius:50%;background:${t.color}"></span>
              <b>${U.esc(t.name)}</b><span style="margin-left:auto" class="bold">${U.num(n)}</span></div>
            <div class="small muted mt-4">${U.esc(t.benefit)}</div>
            <div class="progress mt-8"><i style="width:${(n / (cs.length || 1)) * 100}%;background:${t.color}"></i></div>
          </div></div>`;
        }).join('')}
      </div>
      <div id="tabs"></div><div id="table"></div>`;

    root.querySelector('#new-cust').onclick = () => App.CRM.customerForm(null, draw);
    root.querySelector('#tier-btn').onclick = tierManager;
    root.querySelector('#grp-btn').onclick = groupManager;
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'all', label:'Semua', count:cs.length },
      { key:'aktif', label:'Aktif', count:aktif.length },
      { key:'churn', label:'Berisiko Churn', count:churn.length },
      { key:'ultah', label:'Ulang Tahun', count:ultah.length },
      ...tiers.map(t => ({ key:t.id, label:t.name, count:cs.filter(c => c.tierId === t.id).length }))
    ], tab, k => { tab = k; draw(); }));

    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows, exportName:'data-pelanggan', pageSize:15, searchKeys:['name','phone','email','code'],
      onRowClick: c => App.CRM.customerDetail(c, draw),
      cols:[
        { key:'name', label:'Pelanggan', render:c => `<div class="flex items-center gap-8">
            <span class="avatar-sm">${U.initials(c.name)}</span>
            <div><b>${U.esc(c.name)}</b><div class="small muted">${U.esc(c.code)} · ${U.esc(c.phone)}</div></div></div>` },
        { key:'tierId', label:'Tier', render:c => { const t = DB.find('tiers', c.tierId) || {};
            return `<span class="badge" style="background:${t.color}22;color:${t.color}">${U.esc(t.name || '-')}</span>`; } },
        { key:'totalSpend', label:'Total Belanja', align:'right', render:c => U.rp(c.totalSpend || 0), sortValue:c => c.totalSpend || 0 },
        { key:'visits', label:'Kunjungan', align:'right', render:c => U.num(c.visits || 0) },
        { key:'points', label:'Poin', align:'right', render:c => U.num(c.points || 0), sortValue:c => c.points || 0 },
        { key:'stamps', label:'Stamp', align:'right', render:c => `${c.stamps || 0}/10` },
        { key:'deposit', label:'Deposit', align:'right', render:c => c.deposit ? U.rp(c.deposit) : '-' },
        { key:'lastVisit', label:'Kunjungan Terakhir', render:c => c.lastVisit
            ? `${U.fmtDate(c.lastVisit)}<div class="small muted">${U.ago(c.lastVisit)}</div>` : '<span class="muted">belum pernah</span>' }
      ]
    }));
  }

  function tierManager() {
    const m = App.UI.modal({ title:'Tier Membership', size:'lg', body:'<div id="tl"></div>' });
    const render = () => {
      m.body.querySelector('#tl').innerHTML = `<div class="tbl-wrap card"><table class="tbl">
        <thead><tr><th>Tier</th><th class="num">Min. Belanja</th><th class="num">Diskon</th><th class="num">Poin</th><th>Benefit</th><th></th></tr></thead>
        <tbody>${DB.all('tiers').map(t => `<tr>
          <td><span class="badge" style="background:${t.color}22;color:${t.color}">${U.esc(t.name)}</span></td>
          <td class="num">${U.rp(t.minSpend)}</td><td class="num">${t.discount}%</td><td class="num">${t.pointRate}×</td>
          <td class="small">${U.esc(t.benefit)}</td>
          <td><button class="btn btn--sm" data-te="${t.id}">Ubah</button></td></tr>`).join('')}</tbody></table></div>
        <button class="btn btn--sm mt-12" id="t-add">+ Tier Baru</button>`;
      m.body.querySelectorAll('[data-te]').forEach(b => b.onclick = () => tierForm(DB.find('tiers', b.dataset.te)));
      m.body.querySelector('#t-add').onclick = () => tierForm(null);
    };
    const tierForm = t => App.UI.formModal({
      title:t ? 'Ubah Tier' : 'Tier Baru',
      fields:[
        { name:'name', label:'Nama tier', required:true },
        { name:'minSpend', label:'Minimum total belanja (Rp)', type:'money', required:true },
        { name:'discount', label:'Diskon otomatis (%)', type:'number', step:'0.5' },
        { name:'pointRate', label:'Pengali poin', type:'number', step:'0.25', value:1 },
        { name:'color', label:'Warna', type:'color', value:'#0d9c86' },
        { name:'benefit', label:'Deskripsi benefit', col:2 }
      ],
      values:t || {},
      onSubmit(d) { t ? DB.update('tiers', t.id, d) : DB.insert('tiers', d); render(); draw(); }
    });
    render();
  }

  function groupManager() {
    const m = App.UI.modal({ title:'Grup Pelanggan', body:'<div id="gl"></div>' });
    const render = () => {
      m.body.querySelector('#gl').innerHTML = DB.all('customerGroups').map(g => `
        <div class="kv"><span class="k"><b>${U.esc(g.name)}</b><br><span class="small">${DB.all('customers').filter(c => c.groupId === g.id).length} pelanggan</span></span>
        <span class="v"><button class="btn btn--sm" data-gd="${g.id}">Hapus</button></span></div>`).join('')
        + `<button class="btn btn--sm mt-12" id="g-add">+ Grup Baru</button>`;
      m.body.querySelector('#g-add').onclick = async () => {
        const n = await App.UI.prompt('Nama grup');
        if (n) { DB.insert('customerGroups', { name:n, note:'' }); render(); }
      };
      m.body.querySelectorAll('[data-gd]').forEach(b => b.onclick = () => { DB.remove('customerGroups', b.dataset.gd); render(); });
    };
    render();
  }
  draw();
};

/* ---------------- Promo & Loyalty ---------------- */
App.Views.promos = function (root) {
  const U = App.U, DB = App.DB;
  function draw() {
    const promos = DB.all('promos');
    const aktif = App.POS.activePromos(App.State.outletId());
    const used = U.groupBy(DB.all('orders').filter(o => o.promoId && o.status === 'paid'), o => o.promoId);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Promo & Program Loyalty</h2><p>Diskon, buy 1 get 1, stamp card, dan diskon otomatis member</p></div>
        <div class="page-head__actions"><button class="btn btn--primary" id="new-promo">+ Promo Baru</button></div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Promo', icon:'🎁', value:U.num(promos.length), sub:`${promos.filter(p=>p.active).length} aktif` })}
        ${App.UI.stat({ label:'Berlaku Sekarang', icon:'🔥', value:U.num(aktif.length), sub:'siap dipakai di kasir' })}
        ${App.UI.stat({ label:'Transaksi Berpromo', icon:'🧾', value:U.num(U.sum(Object.values(used), l => l.length)), sub:'sepanjang periode' })}
        ${App.UI.stat({ label:'Nilai Diskon Diberikan', icon:'💸',
          value:U.rp(U.sum(DB.all('orders').filter(o => o.status === 'paid'), o => o.discount)), sub:'total investasi promo' })}
      </div>
      <div class="grid g3 mb-16">
        ${promos.map(p => {
          const u = used[p.id] || [];
          const berlaku = aktif.some(a => a.id === p.id);
          return `<div class="card" style="${berlaku ? 'border-color:var(--brand-400)' : ''}">
            <div class="card__body">
              <div class="flex items-center gap-8 mb-8">
                <span class="thumb">${({ percent:'％', amount:'💸', bogo:'🎁', stamp:'🎫', member:'💚', bundle:'🍱' })[p.type] || '🎁'}</span>
                <div style="flex:1"><b>${U.esc(p.name)}</b>
                  <div class="small muted">${U.fmtDate(p.startDate)} – ${U.fmtDate(p.endDate)}</div></div>
                ${App.UI.badge(p.active ? (berlaku ? 'Berlaku' : 'Aktif') : 'Nonaktif', p.active ? (berlaku ? 'green' : 'brand') : '')}
              </div>
              <p class="small muted mb-12">${U.esc(p.description || '')}</p>
              <div class="kv"><span class="k">Dipakai</span><span class="v">${u.length}× · ${U.rp(U.sum(u, o => o.discount))}</span></div>
              ${p.autoApply ? '<div class="small" style="color:var(--brand-600)">⚡ Diterapkan otomatis di kasir</div>' : ''}
              <div class="flex gap-6 mt-12">
                <button class="btn btn--sm" data-pe="${p.id}" style="flex:1">Ubah</button>
                <button class="btn btn--sm" data-pt="${p.id}" style="flex:1">${p.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
              </div>
            </div></div>`;
        }).join('')}
      </div>`;
    root.querySelector('#new-promo').onclick = () => form();
    root.querySelectorAll('[data-pe]').forEach(b => b.onclick = () => form(DB.find('promos', b.dataset.pe)));
    root.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => {
      const p = DB.find('promos', b.dataset.pt);
      DB.update('promos', p.id, { active: !p.active }); draw();
    });
  }
  function form(p) {
    const cats = DB.all('categories').filter(c => !c.isMaterial);
    const prods = DB.all('products').filter(x => x.type === 'product');
    App.UI.formModal({
      title:p ? 'Ubah Promo' : 'Promo Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama promo', required:true, col:2 },
        { name:'type', label:'Jenis promo', type:'select', required:true, options:[
          { value:'percent', label:'Diskon persen (%)' }, { value:'amount', label:'Potongan nominal (Rp)' },
          { value:'bogo', label:'Buy 1 Get 1' }, { value:'stamp', label:'Stamp card (kumpul gratis)' },
          { value:'member', label:'Diskon otomatis member' }] },
        { name:'value', label:'Nilai (persen / rupiah / jumlah stamp)', type:'number', required:true },
        { name:'minPurchase', label:'Minimum belanja (Rp)', type:'money', value:0 },
        { name:'startDate', label:'Mulai', type:'date', value:U.today(), required:true },
        { name:'endDate', label:'Berakhir', type:'date', value:U.addDays(U.today(), 30), required:true },
        { name:'hourFrom', label:'Jam mulai (opsional)', type:'number', hint:'kosongkan bila berlaku sepanjang hari' },
        { name:'hourTo', label:'Jam selesai (opsional)', type:'number' },
        { name:'description', label:'Deskripsi', type:'textarea', col:2 },
        { name:'autoApply', label:'Otomatis', type:'checkbox', checkLabel:'Terapkan otomatis di kasir bila memenuhi syarat' },
        { name:'active', label:'Aktif', type:'checkbox', checkLabel:'Promo aktif' }
      ],
      values:p || { active:true, autoApply:false },
      extraHTML:`<div class="field"><label>Hari berlaku (kosongkan = semua hari)</label>
        <div class="pill-row" id="days">${U.HARI.map((h, i) =>
          `<button type="button" class="pill ${p && p.days && p.days.includes(i) ? 'is-active' : ''}" data-d="${i}">${h}</button>`).join('')}</div></div>
        <div class="field"><label>Berlaku untuk kategori (kosongkan = semua)</label>
        <div class="pill-row" id="cats">${cats.map(c =>
          `<button type="button" class="pill ${p && p.categoryIds && p.categoryIds.includes(c.id) ? 'is-active' : ''}" data-c="${c.id}">${c.icon} ${U.esc(c.name)}</button>`).join('')}</div></div>`,
      onSubmit(d) {
        const days = [...document.querySelectorAll('#days .is-active')].map(b => +b.dataset.d);
        const categoryIds = [...document.querySelectorAll('#cats .is-active')].map(b => b.dataset.c);
        const payload = { ...d, days, categoryIds, productIds: p ? p.productIds : [], outletIds:['ALL'],
          hourFrom:d.hourFrom === null ? undefined : d.hourFrom, hourTo:d.hourTo === null ? undefined : d.hourTo };
        p ? DB.update('promos', p.id, payload) : DB.insert('promos', payload);
        App.UI.toast('Promo disimpan', 'ok'); draw();
      }
    });
    setTimeout(() => {
      document.querySelectorAll('#days .pill, #cats .pill').forEach(b =>
        b.onclick = () => b.classList.toggle('is-active'));
    }, 60);
  }
  draw();
};

/* ---------------- Kampanye Marketing ---------------- */
App.Views.campaigns = function (root) {
  const U = App.U, DB = App.DB;
  function draw() {
    const camps = U.sortBy(DB.all('campaigns'), c => c.scheduledAt, 'desc');
    const cs = DB.all('customers');
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Kampanye Marketing</h2><p>Kirim promo lewat WhatsApp, SMS, dan email ke segmen pelanggan</p></div>
        <div class="page-head__actions"><button class="btn btn--primary" id="new-camp">+ Kampanye Baru</button></div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Kampanye', icon:'📣', value:U.num(camps.length), sub:`${camps.filter(c=>c.status==='terkirim').length} terkirim` })}
        ${App.UI.stat({ label:'Pesan Terkirim', icon:'✉️', value:U.num(U.sum(camps, c => c.sent)), sub:'ke pelanggan' })}
        ${App.UI.stat({ label:'Tingkat Dibuka', icon:'👀', value:U.pct(U.sum(camps, c => c.opened), U.sum(camps, c => c.sent) || 1), sub:'open rate' })}
        ${App.UI.stat({ label:'Omzet dari Kampanye', icon:'💰', value:U.rp(U.sum(camps, c => c.revenue || 0)), sub:'terlacak' })}
      </div>
      <div class="grid g3 mb-16">
        ${camps.map(c => `<div class="card"><div class="card__body">
          <div class="flex items-center gap-8 mb-8">
            <span class="thumb">${({ whatsapp:'💬', sms:'📱', email:'✉️' })[c.channel] || '📣'}</span>
            <div style="flex:1"><b>${U.esc(c.name)}</b><div class="small muted">${U.fmtDate(c.scheduledAt)}</div></div>
            ${App.UI.badge(U.titleCase(c.status), c.status === 'terkirim' ? 'green' : c.status === 'terjadwal' ? 'amber' : '')}
          </div>
          <p class="small muted mb-12" style="line-height:1.5">"${U.esc((c.template || '').slice(0, 110))}${(c.template||'').length > 110 ? '…' : ''}"</p>
          <div class="grid g3 gap-8 small">
            <div><div class="muted">Terkirim</div><b>${U.num(c.sent)}</b></div>
            <div><div class="muted">Dibuka</div><b>${U.num(c.opened)}</b></div>
            <div><div class="muted">Omzet</div><b>${U.compact(c.revenue || 0)}</b></div>
          </div>
          <div class="flex gap-6 mt-12">
            <button class="btn btn--sm" data-ce="${c.id}" style="flex:1">Detail</button>
            ${c.status !== 'terkirim' ? `<button class="btn btn--sm btn--primary" data-cs="${c.id}" style="flex:1">Kirim Sekarang</button>` : ''}
          </div>
        </div></div>`).join('')}
      </div>`;
    root.querySelector('#new-camp').onclick = () => form();
    root.querySelectorAll('[data-ce]').forEach(b => b.onclick = () => form(DB.find('campaigns', b.dataset.ce)));
    root.querySelectorAll('[data-cs]').forEach(b => b.onclick = () => {
      const c = DB.find('campaigns', b.dataset.cs);
      const targets = audience(c.target);
      App.UI.confirm(`Kirim kampanye <b>${U.esc(c.name)}</b> ke <b>${targets.length}</b> pelanggan via ${c.channel}?`)
        .then(ok => {
          if (!ok) return;
          DB.update('campaigns', c.id, { status:'terkirim', sent:targets.length,
            opened:Math.round(targets.length * (0.55 + Math.random() * 0.25)),
            clicked:Math.round(targets.length * 0.2), sentAt:U.now() });
          DB.log('crm.campaign', `Kampanye ${c.name} dikirim ke ${targets.length} pelanggan`);
          App.UI.toast(`Kampanye dikirim ke ${targets.length} pelanggan`, 'ok'); draw();
        });
    });
  }
  function audience(target) {
    const cs = DB.all('customers');
    if (target === 'all') return cs;
    if (target === 'churn') return cs.filter(c => c.lastVisit && c.lastVisit < U.addDays(U.today(), -60));
    if (target === 'birthday') return cs.filter(c => c.birthday && c.birthday.slice(5, 7) === U.today().slice(5, 7));
    if (target === 'active') return cs.filter(c => c.lastVisit && c.lastVisit >= U.addDays(U.today(), -30));
    return cs.filter(c => c.tierId === target);
  }
  function form(c) {
    const tiers = DB.all('tiers');
    App.UI.formModal({
      title:c ? 'Ubah Kampanye' : 'Kampanye Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama kampanye', required:true, col:2 },
        { name:'channel', label:'Kanal', type:'select', options:[
          { value:'whatsapp', label:'WhatsApp' }, { value:'sms', label:'SMS' }, { value:'email', label:'Email' }] },
        { name:'target', label:'Target audiens', type:'select', options:[
          { value:'all', label:'Semua pelanggan' }, { value:'active', label:'Aktif 30 hari' },
          { value:'churn', label:'Berisiko churn (>60 hari)' }, { value:'birthday', label:'Ulang tahun bulan ini' },
          ...tiers.map(t => ({ value:t.id, label:'Tier ' + t.name }))] },
        { name:'scheduledAt', label:'Jadwal kirim', type:'date', value:U.today() },
        { name:'status', label:'Status', type:'select', options:['draft','terjadwal','terkirim'] },
        { name:'template', label:'Isi pesan', type:'textarea', col:2, required:true,
          hint:'Gunakan {nama} untuk menyapa pelanggan secara personal' }
      ],
      values:c || { channel:'whatsapp', target:'all', status:'draft' },
      onSubmit(d) {
        const payload = { ...d, sent:c ? c.sent : 0, opened:c ? c.opened : 0, clicked:c ? c.clicked : 0, revenue:c ? c.revenue : 0 };
        c ? DB.update('campaigns', c.id, payload) : DB.insert('campaigns', payload);
        App.UI.toast('Kampanye disimpan', 'ok'); draw();
      }
    });
  }
  draw();
};

/* ---------------- Toko Online & E-Menu ---------------- */
App.Views.onlinestore = function (root) {
  const U = App.U, DB = App.DB;
  const state = App.Period.init('month');
  function draw() {
    const oid = App.State.outletId();
    const orders = App.Sales.orders({ from:state.from, to:state.to, outletId:oid });
    const channels = App.Sales.byChannel(orders);
    const online = orders.filter(o => o.channel !== 'kasir');
    const chCfg = DB.settings().channels;

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Toko Online & E-Menu</h2><p>Omnichannel: marketplace ojek online, website toko, dan pemesanan QR di meja</p></div>
        <div class="page-head__actions" id="period"></div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Omzet Kanal Online', icon:'🌐', value:U.rp(U.sum(online, o => o.total)),
          sub:U.pct(U.sum(online, o => o.total), U.sum(orders, o => o.total) || 1) + ' dari total omzet' })}
        ${App.UI.stat({ label:'Transaksi Online', icon:'📲', value:U.num(online.length), sub:`${orders.length} total transaksi` })}
        ${App.UI.stat({ label:'Rata-rata Order Online', icon:'🧾', value:U.rp(online.length ? U.sum(online, o => o.total) / online.length : 0), sub:'lebih tinggi dari offline' })}
        ${App.UI.stat({ label:'Estimasi Komisi Platform', icon:'💸', value:U.rp(U.sum(online, o => {
          const c = chCfg.find(x => x.key === o.channel) || {};
          return o.total * (c.commission || 0) / 100; })), sub:'biaya marketplace', tone:'var(--rose)' })}
      </div>
      <div class="grid g-2-1 mb-16">
        <div class="card">
          <div class="card__head"><h3>Performa per Kanal</h3></div>
          <div class="card__body">
            <div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>Kanal</th><th class="num">Transaksi</th><th class="num">Omzet</th><th class="num">Rata-rata</th><th class="num">Komisi</th><th class="num">Net</th></tr></thead>
              <tbody>${channels.map(c => {
                const cfg = chCfg.find(x => x.key === c.key) || {};
                const komisi = c.value * (cfg.commission || 0) / 100;
                return `<tr><td>${c.icon} <b>${U.esc(c.label)}</b></td>
                  <td class="num">${U.num(c.trx)}</td><td class="num">${U.rp(c.value)}</td>
                  <td class="num">${U.rp(c.value / c.trx)}</td>
                  <td class="num" style="color:var(--rose)">${komisi ? '−' + U.rp(komisi) : '-'}</td>
                  <td class="num"><b>${U.rp(c.value - komisi)}</b></td></tr>`;
              }).join('')}</tbody></table></div>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Integrasi Aktif</h3></div>
          <div class="card__body">
            ${chCfg.map(c => `<div class="kv"><span class="k">${c.icon} ${U.esc(c.label)}</span>
              <span class="v">${App.UI.badge(c.key === 'kasir' ? 'Inti' : 'Terhubung', 'green')}</span></div>`).join('')}
            <div class="divider"></div>
            <button class="btn btn--sm btn--block" id="emenu-btn">📱 Lihat E-Menu (QR)</button>
            <button class="btn btn--sm btn--block mt-8" id="web-btn">🌐 Pratinjau Toko Online</button>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card__head"><h3>Menu Terlaris di Kanal Online</h3></div>
        <div class="card__body">${App.Chart.hbar(App.Sales.productMix(online).slice(0, 10)
          .map(x => ({ label:x.nama, value:x.omzet })), { money:true })}</div>
      </div>`;
    root.querySelector('#period').appendChild(App.Period.bar(state, draw));
    root.querySelector('#emenu-btn').onclick = emenu;
    root.querySelector('#web-btn').onclick = emenu;
  }
  function emenu() {
    const cats = DB.all('categories').filter(c => !c.isMaterial);
    const outlet = App.State.outlet();
    App.UI.modal({
      title:'E-Menu / Toko Online', subtitle:'Tampilan yang dilihat pelanggan saat scan QR di meja', size:'lg',
      body:`<div class="emenu">
        <div style="background:linear-gradient(135deg,var(--brand-600),var(--brand-800));color:#fff;padding:20px;text-align:center">
          <div style="font-size:34px">☕</div>
          <div style="font-weight:800;font-size:18px">${U.esc(DB.settings().receipt.header)}</div>
          <div style="font-size:12px;opacity:.85">${U.esc(outlet.name)}</div>
        </div>
        <div style="padding:14px;max-height:420px;overflow:auto">
          ${cats.map(c => {
            const items = DB.all('products').filter(p => p.categoryId === c.id && p.active !== false);
            if (!items.length) return '';
            return `<div class="bold small mb-8" style="margin-top:12px">${c.icon} ${U.esc(c.name)}</div>
              ${items.map(p => `<div class="flex items-center gap-8" style="padding:8px 0;border-bottom:1px solid var(--border)">
                <span class="thumb">${p.emoji}</span>
                <div style="flex:1"><b style="font-size:13px">${U.esc(p.name)}</b>
                  ${p.bestSeller ? '<span class="badge badge--amber" style="margin-left:5px">Best</span>' : ''}
                  <div class="small muted">${(p.recipe||[]).length ? 'Fresh dibuat saat dipesan' : ''}</div></div>
                <b style="color:var(--brand-600)">${U.rp(p.price)}</b>
                <button class="btn btn--sm btn--primary">+</button></div>`).join('')}`;
          }).join('')}
        </div>
        <div style="padding:12px;border-top:1px solid var(--border);text-align:center" class="small muted">
          Pesanan langsung masuk ke kasir & dapur · Powered by SajiPOS</div>
      </div>
      <p class="small muted center mt-12">Cetak QR ini dan tempel di setiap meja agar pelanggan bisa memesan sendiri.</p>`
    });
  }
  draw();
};
