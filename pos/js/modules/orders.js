/* =============================================================
   SajiPOS — Daftar Pesanan, Detail Transaksi, Kas & Shift
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

/* ---------------- Detail pesanan ---------------- */
App.OrderDetail = function (orderId, onChange) {
  const U = App.U, DB = App.DB, P = App.POS;
  const o = DB.find('orders', orderId);
  if (!o) return App.UI.toast('Pesanan tidak ditemukan', 'err');
  const cust = o.customerId ? DB.find('customers', o.customerId) : null;
  const cashier = DB.find('users', o.cashierId) || {};
  const waiter = o.waiterId ? DB.find('employees', o.waiterId) : null;
  const outlet = DB.find('outlets', o.outletId) || {};

  const m = App.UI.modal({
    title:'Pesanan ' + o.no, size:'lg',
    subtitle:`${U.fmtDateTime(o.paidAt || o.date)} · ${U.esc(outlet.name)}`,
    body:`
      <div class="grid g2 mb-16">
        <div>
          <div class="kv"><span class="k">Status</span><span class="v">${App.UI.badge(
            o.status === 'paid' ? 'Lunas' : o.status === 'open' ? 'Berjalan' : o.status === 'refund' ? 'Refund' : 'Void',
            o.status === 'paid' ? 'green' : o.status === 'open' ? 'amber' : 'red')}</span></div>
          <div class="kv"><span class="k">Jenis</span><span class="v">${U.esc(P.TYPE_LABEL[o.type] || o.type)}${o.tableName ? ' · Meja ' + U.esc(o.tableName) : ''}</span></div>
          <div class="kv"><span class="k">Kanal</span><span class="v">${U.esc((DB.settings().channels.find(c => c.key === o.channel) || {}).label || o.channel)}</span></div>
          <div class="kv"><span class="k">Kasir</span><span class="v">${U.esc(cashier.name || '-')}</span></div>
          ${waiter ? `<div class="kv"><span class="k">Pramusaji</span><span class="v">${U.esc(waiter.name)} (komisi ${U.rp(o.commission || 0)})</span></div>` : ''}
        </div>
        <div>
          <div class="kv"><span class="k">Pelanggan</span><span class="v">${cust ? U.esc(cust.name) : 'Umum'}</span></div>
          <div class="kv"><span class="k">Jumlah tamu</span><span class="v">${o.guestCount || 1}</span></div>
          <div class="kv"><span class="k">HPP</span><span class="v">${U.rp(o.cogs || 0)}</span></div>
          <div class="kv"><span class="k">Laba kotor</span><span class="v" style="color:var(--lime)">${U.rp((o.subtotal - o.discount) - (o.cogs || 0))}</span></div>
          ${o.promoName ? `<div class="kv"><span class="k">Promo</span><span class="v">${U.esc(o.promoName)}</span></div>` : ''}
        </div>
      </div>
      <div class="tbl-wrap card mb-16"><table class="tbl">
        <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${o.items.map(it => `<tr>
          <td><b>${U.esc(it.name)}</b>
            ${(it.variants||[]).length ? `<div class="small muted">${U.esc(it.variants.map(v=>v.name).join(' · '))}</div>` : ''}
            ${(it.modifiers||[]).length ? `<div class="small muted">+ ${U.esc(it.modifiers.map(x=>x.name).join(', '))}</div>` : ''}
            ${it.note ? `<div class="small" style="color:var(--amber)">📝 ${U.esc(it.note)}</div>` : ''}</td>
          <td class="num">${it.qty}</td><td class="num">${U.rp(it.price)}</td><td class="num">${U.rp(it.subtotal)}</td></tr>`).join('')}
        </tbody>
        <tfoot>
          <tr><td colspan="3">Subtotal</td><td class="num">${U.rp(o.subtotal)}</td></tr>
          ${o.discount ? `<tr><td colspan="3">Diskon</td><td class="num">−${U.rp(o.discount)}</td></tr>` : ''}
          ${o.serviceCharge ? `<tr><td colspan="3">Service charge</td><td class="num">${U.rp(o.serviceCharge)}</td></tr>` : ''}
          ${o.tax ? `<tr><td colspan="3">Pajak</td><td class="num">${U.rp(o.tax)}</td></tr>` : ''}
          <tr><td colspan="3">TOTAL</td><td class="num">${U.rp(o.total)}</td></tr>
        </tfoot></table></div>
      ${(o.payments || []).length ? `<div class="card mb-16"><div class="card__body">
        <div class="bold small mb-8">Pembayaran</div>
        ${o.payments.map(p => `<div class="kv"><span class="k">${U.esc(P.labelOfMethod(p.method))}${p.ref ? ' · ' + U.esc(p.ref) : ''}</span><span class="v">${U.rp(p.amount)}</span></div>`).join('')}
        ${o.change ? `<div class="kv"><span class="k">Kembalian</span><span class="v">${U.rp(o.change)}</span></div>` : ''}
      </div></div>` : ''}
      ${o.voidReason ? `<div class="card" style="border-color:var(--rose)"><div class="card__body small">
        <b style="color:var(--rose)">Dibatalkan:</b> ${U.esc(o.voidReason)} · oleh ${U.esc((DB.find('users', o.voidBy)||{}).name || '-')} · ${U.fmtDateTime(o.voidAt)}</div></div>` : ''}
      ${(o.refunds || []).length ? `<div class="card"><div class="card__body small">
        <b>Riwayat refund</b>${o.refunds.map(r => `<div>${U.fmtDateTime(r.at)} — ${U.rp(r.amount)} (${U.esc(r.reason)})</div>`).join('')}</div></div>` : ''}
      <div class="mt-16">
        <div class="bold small mb-8">Jurnal terkait</div>
        ${(() => {
          const js = DB.where('journals', j => j.refId === o.id);
          return js.length ? js.map(j => `<div class="small"><a class="link" href="#/journal?q=${encodeURIComponent(j.no)}">${U.esc(j.no)}</a> — ${U.esc(j.memo)} (${U.rp(j.total)})</div>`).join('')
            : '<div class="small muted">Terposting dalam rekap jurnal harian.</div>';
        })()}
      </div>`,
    footer:`
      <button class="btn" data-a="print">🖨️ Struk</button>
      ${o.status === 'open' ? '<button class="btn btn--primary" data-a="continue">Lanjutkan di Kasir</button>' : ''}
      ${o.status === 'paid' ? '<button class="btn" data-a="refund">↩️ Refund</button>' : ''}
      ${o.status !== 'void' ? '<button class="btn btn--danger" data-a="void">Void</button>' : ''}`
  });
  const act = k => m.el.querySelector(`[data-a="${k}"]`);
  act('print').onclick = () => App.UI.print(P.receiptHTML(o, { reprint: o.status === 'paid' }));
  if (act('continue')) act('continue').onclick = () => { m.close(); App.Router.go('pos', { order:o.id }); };
  if (act('void')) act('void').onclick = async () => {
    const reason = await App.UI.prompt('Alasan pembatalan', { title:'Void Transaksi', placeholder:'mis. salah input menu' });
    if (!reason) return;
    if (await P.voidOrder(o, reason)) { m.close(); if (onChange) onChange(); }
  };
  if (act('refund')) act('refund').onclick = () => refundDialog(o, () => { m.close(); if (onChange) onChange(); });

  function refundDialog(order, done) {
    const chosen = new Set();
    const rm = App.UI.modal({
      title:'Refund — ' + order.no, subtitle:'Pilih item yang dikembalikan',
      body:`<div id="rf-list">${order.items.map((it, i) => `
        <label class="check" style="padding:8px;border:1px solid var(--border);border-radius:9px;margin-bottom:6px">
          <input type="checkbox" data-i="${i}"> <span style="flex:1">${U.esc(it.name)} × ${it.qty}</span>
          <b class="num">${U.rp(it.subtotal)}</b></label>`).join('')}</div>
        <div class="field mt-12"><label>Alasan refund *</label><input class="input" id="rf-reason" placeholder="mis. pesanan salah / kualitas tidak sesuai"></div>
        <div class="kv"><span class="k">Total refund</span><span class="v" id="rf-total">Rp 0</span></div>`,
      footer:`<button class="btn" data-no>Batal</button><button class="btn btn--danger" data-yes>Proses Refund</button>`
    });
    const upd = () => rm.body.querySelector('#rf-total').textContent =
      U.rp(U.sum([...chosen], i => order.items[i].subtotal));
    rm.body.querySelectorAll('[data-i]').forEach(cb => cb.onchange = () => {
      const i = +cb.dataset.i;
      cb.checked ? chosen.add(i) : chosen.delete(i);
      upd();
    });
    rm.el.querySelector('[data-no]').onclick = rm.close;
    rm.el.querySelector('[data-yes]').onclick = async () => {
      const reason = rm.body.querySelector('#rf-reason').value.trim();
      if (!chosen.size) return App.UI.toast('Pilih minimal satu item', 'warn');
      if (!reason) return App.UI.toast('Isi alasan refund', 'warn');
      const items = [...chosen].map(i => order.items[i]);
      if (await App.POS.refundOrder(order, items, reason)) { rm.close(); done(); }
    };
  }
};

/* ---------------- Daftar pesanan ---------------- */
App.Views.orders = function (root) {
  const U = App.U, DB = App.DB, P = App.POS;
  const state = App.Period.init('today');
  let tab = 'all';

  function draw() {
    const oid = App.State.outletId();
    const all = DB.all('orders').filter(o => (oid === 'ALL' || o.outletId === oid) &&
      U.ymd(o.date) >= state.from && U.ymd(o.date) <= state.to);
    const openList = DB.where('orders', o => o.status === 'open' && (oid === 'ALL' || o.outletId === oid));
    const online = openList.filter(o => ['ojol','ecommerce','delivery'].includes(o.type));

    const filtered = tab === 'all' ? all
      : tab === 'open' ? openList
      : tab === 'online' ? online
      : all.filter(o => o.status === tab);

    const t = App.Sales.totals(all.filter(o => o.status === 'paid'));

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Daftar Pesanan</h2><p>Semua transaksi kasir, online, dan pesanan berjalan</p></div>
        <div class="page-head__actions" id="period"></div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Transaksi', icon:'🧾', value:U.num(t.trx), sub:'periode terpilih' })}
        ${App.UI.stat({ label:'Omzet', icon:'💰', value:U.rp(t.total), sub:`rata-rata ${U.rp(t.avg)}` })}
        ${App.UI.stat({ label:'Pesanan Berjalan', icon:'⏳', value:U.num(openList.length), sub:`${online.length} dari kanal online` })}
        ${App.UI.stat({ label:'Void / Refund', icon:'↩️', value:U.num(all.filter(o => ['void','refund'].includes(o.status)).length), sub:'perlu ditinjau' })}
      </div>
      ${online.length ? `<div class="card mb-16">
        <div class="card__head"><h3>🛵 Pesanan Online Masuk</h3><span class="sub">butuh konfirmasi & diproses</span></div>
        <div class="card__body"><div class="oq">${online.map(o => {
          const ch = DB.settings().channels.find(c => c.key === o.channel) || {};
          return `<div class="oq-card" data-o="${o.id}">
            <div class="oq-card__ch" style="background:${ch.color}22;color:${ch.color}">${ch.icon || '🌐'}</div>
            <div class="oq-card__main">
              <div class="oq-card__no">${U.esc(o.no)} · ${U.esc(ch.label || o.channel)}</div>
              <div class="oq-card__sub">${o.items.length} item · ${U.esc(o.customerName || 'Pelanggan')} ${o.driverName ? '· Driver ' + U.esc(o.driverName) : ''} · ${U.ago(o.createdAt)}</div>
            </div>
            <div class="right"><div class="bold">${U.rp(o.total)}</div>
              <div class="small muted">${U.esc(o.onlineStatus || 'menunggu')}</div></div>
            <button class="btn btn--sm btn--primary" data-accept="${o.id}">Proses</button>
          </div>`;
        }).join('')}</div></div></div>` : ''}
      <div id="tabs"></div>
      <div id="table"></div>`;

    root.querySelector('#period').appendChild(App.Period.bar(state, draw));
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'all', label:'Semua', count:all.length },
      { key:'open', label:'Berjalan', count:openList.length },
      { key:'online', label:'Online', count:online.length },
      { key:'paid', label:'Lunas', count:all.filter(o => o.status === 'paid').length },
      { key:'void', label:'Void', count:all.filter(o => o.status === 'void').length }
    ], tab, k => { tab = k; draw(); }));

    root.querySelectorAll('[data-o]').forEach(el => el.onclick = e => {
      if (e.target.closest('[data-accept]')) return;
      App.OrderDetail(el.dataset.o, draw);
    });
    root.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => {
      DB.update('orders', b.dataset.accept, { onlineStatus:'diproses', kitchenStatus:'cooking' });
      App.UI.toast('Pesanan diproses & dikirim ke dapur', 'ok'); draw();
    });

    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows: U.sortBy(filtered, o => o.date, 'desc'),
      exportName:'daftar-pesanan',
      searchKeys:['no','customerName','tableName'],
      pageSize:20,
      onRowClick: o => App.OrderDetail(o.id, draw),
      cols:[
        { key:'no', label:'No. Transaksi', render:o => `<span class="mono">${U.esc(o.no)}</span>` },
        { key:'date', label:'Waktu', render:o => U.fmtDateTime(o.date), sortValue:o => o.date },
        { key:'type', label:'Jenis', render:o => `${U.esc(P.TYPE_LABEL[o.type] || o.type)}${o.tableName ? `<div class="small muted">Meja ${U.esc(o.tableName)}</div>` : ''}` },
        { key:'channel', label:'Kanal', render:o => {
            const c = DB.settings().channels.find(x => x.key === o.channel) || {};
            return `${c.icon || ''} ${U.esc(c.label || o.channel)}`; } },
        { key:'customerName', label:'Pelanggan', render:o => U.esc(o.customerName || 'Umum') },
        { key:'items', label:'Item', align:'right', render:o => U.sum(o.items, i => i.qty), sortValue:o => U.sum(o.items, i => i.qty) },
        { key:'total', label:'Total', align:'right', render:o => `<b>${U.rp(o.total)}</b>`, sortValue:o => o.total },
        { key:'status', label:'Status', render:o => App.UI.badge(
            o.status === 'paid' ? 'Lunas' : o.status === 'open' ? 'Berjalan' : o.status === 'refund' ? 'Refund' : 'Void',
            o.status === 'paid' ? 'green' : o.status === 'open' ? 'amber' : 'red') }
      ]
    }));
  }
  draw();
};

/* ---------------- Kas & Shift ---------------- */
App.Views.openShiftDialog = function (done) {
  const U = App.U, DB = App.DB;
  if (App.State.activeShift()) { App.UI.toast('Shift sudah terbuka', 'warn'); return; }
  App.UI.formModal({
    title:'Buka Kasir', subtitle:'Catat modal awal laci kasir',
    fields:[{ name:'openingCash', label:'Modal awal (Rp)', type:'money', value:500000, required:true, col:2 },
            { name:'note', label:'Catatan', type:'text', col:2 }],
    okText:'Buka Kasir',
    onSubmit(d) {
      const s = DB.insert('shifts', {
        outletId:App.State.outletId(), userId:App.Auth.user().id, openAt:U.now(), closeAt:null,
        openingCash:d.openingCash, cashIn:0, cashOut:0, salesCash:0, salesNonCash:0,
        orders:0, gross:0, status:'open', note:d.note || ''
      });
      DB.log('shift.open', `Kasir dibuka, modal ${U.rp(d.openingCash)}`);
      App.UI.toast('Kasir dibuka. Selamat bertugas! ☕', 'ok');
      if (done) done(s);
    }
  });
};

App.Views.closeShiftDialog = function (shiftId, done) {
  const U = App.U, DB = App.DB;
  const s = shiftId ? DB.find('shifts', shiftId) : App.State.activeShift();
  if (!s) { App.UI.toast('Tidak ada shift terbuka', 'warn'); return; }
  const expected = s.openingCash + s.salesCash + (s.cashIn || 0) - (s.cashOut || 0);
  const orders = DB.where('orders', o => o.shiftId === s.id && o.status === 'paid');
  const byMethod = App.Sales.byPayment(orders);

  const m = App.UI.modal({
    title:'Tutup Kasir', subtitle:`Shift dibuka ${U.fmtDateTime(s.openAt)}`, size:'lg',
    body:`
      <div class="grid g2 mb-16">
        <div class="card"><div class="card__body">
          <div class="bold small mb-8">Ringkasan Shift</div>
          <div class="kv"><span class="k">Jumlah transaksi</span><span class="v">${U.num(orders.length)}</span></div>
          <div class="kv"><span class="k">Total penjualan</span><span class="v">${U.rp(U.sum(orders, o => o.total))}</span></div>
          <div class="divider"></div>
          ${byMethod.map(p => `<div class="kv"><span class="k">${U.esc(p.label)}</span><span class="v">${U.rp(p.value)}</span></div>`).join('')}
        </div></div>
        <div class="card"><div class="card__body">
          <div class="bold small mb-8">Perhitungan Kas Laci</div>
          <div class="kv"><span class="k">Modal awal</span><span class="v">${U.rp(s.openingCash)}</span></div>
          <div class="kv"><span class="k">Penjualan tunai</span><span class="v">${U.rp(s.salesCash)}</span></div>
          <div class="kv"><span class="k">Kas masuk</span><span class="v">${U.rp(s.cashIn || 0)}</span></div>
          <div class="kv"><span class="k">Kas keluar</span><span class="v">−${U.rp(s.cashOut || 0)}</span></div>
          <div class="divider"></div>
          <div class="kv"><span class="k bold">Kas seharusnya</span><span class="v" style="font-size:16px">${U.rp(expected)}</span></div>
        </div></div>
      </div>
      <div class="form-row c2">
        <div class="field"><label>Kas fisik hasil hitung (Rp) *</label>
          <input class="input input--num" id="actual" type="number" value="${expected}" style="font-size:18px;font-weight:700"></div>
        <div class="field"><label>Selisih</label><input class="input input--num" id="diff" readonly value="0"></div>
      </div>
      <div class="field"><label>Setor ke kas besar (Rp)</label>
        <input class="input input--num" id="deposit" type="number" value="${Math.max(0, expected - s.openingCash)}">
        <div class="hint">Sisanya tetap di laci sebagai modal shift berikutnya.</div></div>
      <div class="field"><label>Catatan</label><textarea class="textarea" id="note" placeholder="mis. selisih karena kembalian"></textarea></div>`,
    footer:`<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Tutup Kasir & Cetak Laporan</button>`
  });
  const actual = m.body.querySelector('#actual');
  const diffEl = m.body.querySelector('#diff');
  const upd = () => {
    const d = (Number(actual.value) || 0) - expected;
    diffEl.value = U.rp(d);
    diffEl.style.color = d < 0 ? 'var(--rose)' : d > 0 ? 'var(--lime)' : '';
  };
  actual.oninput = upd; upd();
  m.el.querySelector('[data-no]').onclick = m.close;
  m.el.querySelector('[data-yes]').onclick = () => {
    const act = Number(actual.value) || 0;
    const diff = act - expected;
    const deposit = Number(m.body.querySelector('#deposit').value) || 0;
    App.DB.update('shifts', s.id, {
      closeAt:U.now(), actualCash:act, expectedCash:expected, diff, deposit,
      status:'closed', note:m.body.querySelector('#note').value, closedBy:App.Auth.user().id
    });
    if (diff) App.Ledger.postShiftVariance(s, diff);
    if (deposit) App.Ledger.postShiftDeposit(s, deposit);
    DB.log('shift.close', `Kasir ditutup. Selisih ${U.rp(diff)}`);
    m.close();
    App.UI.print(shiftReportHTML(DB.find('shifts', s.id), orders));
    App.UI.toast('Kasir ditutup. Laporan shift dicetak.', 'ok');
    if (done) done(); else App.Router.reload();
  };

  function shiftReportHTML(sh, ords) {
    const outlet = DB.find('outlets', sh.outletId) || {};
    const user = DB.find('users', sh.userId) || {};
    const mix = App.Sales.productMix(ords).slice(0, 10);
    return `<div class="receipt">
      <div class="c big">LAPORAN TUTUP KASIR</div>
      <div class="c">${U.esc(outlet.name)}</div><hr>
      <div class="row"><span>Kasir</span><span>${U.esc(user.name)}</span></div>
      <div class="row"><span>Buka</span><span>${U.fmtDateTime(sh.openAt)}</span></div>
      <div class="row"><span>Tutup</span><span>${U.fmtDateTime(sh.closeAt)}</span></div>
      <hr>
      <div class="row"><span>Transaksi</span><span>${ords.length}</span></div>
      <div class="row"><span>Total penjualan</span><span>${U.num(U.sum(ords, o => o.total))}</span></div>
      <div class="row"><span>Tunai</span><span>${U.num(sh.salesCash)}</span></div>
      <div class="row"><span>Non-tunai</span><span>${U.num(sh.salesNonCash)}</span></div>
      <hr>
      <div class="row"><span>Modal awal</span><span>${U.num(sh.openingCash)}</span></div>
      <div class="row"><span>Kas seharusnya</span><span>${U.num(sh.expectedCash)}</span></div>
      <div class="row"><span>Kas fisik</span><span>${U.num(sh.actualCash)}</span></div>
      <div class="row big"><span>SELISIH</span><span>${U.num(sh.diff)}</span></div>
      <div class="row"><span>Setoran</span><span>${U.num(sh.deposit || 0)}</span></div>
      <hr><div class="c">10 MENU TERLARIS</div>
      <table>${mix.map(x => `<tr><td>${U.esc(x.nama)}</td><td class="r">${x.qty}</td></tr>`).join('')}</table>
      <hr><div class="c">Diperiksa oleh: ____________</div>
      <div class="c" style="margin-top:14px">${U.esc(sh.note || '')}</div></div>`;
  }
};

App.Views.shifts = function (root) {
  const U = App.U, DB = App.DB;
  const oid = App.State.outletId();

  function draw() {
    const active = App.State.activeShift();
    const list = U.sortBy(DB.all('shifts').filter(s => oid === 'ALL' || s.outletId === oid), s => s.openAt, 'desc');
    const moves = U.sortBy(DB.all('cashMoves').filter(c => oid === 'ALL' || c.outletId === oid), c => c.date, 'desc').slice(0, 20);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Kas & Shift Kasir</h2><p>Buka-tutup kasir, kas masuk/keluar outlet, dan riwayat setoran</p></div>
        <div class="page-head__actions">
          ${active ? `<button class="btn" id="cash-in">➕ Kas Masuk</button>
                      <button class="btn" id="cash-out">➖ Kas Keluar</button>
                      <button class="btn btn--danger" id="close-shift">🔒 Tutup Kasir</button>`
                   : `<button class="btn btn--primary" id="open-shift">💰 Buka Kasir</button>`}
        </div>
      </div>
      ${active ? `<div class="card mb-16" style="border-color:var(--brand-400)">
        <div class="card__head"><h3>Shift Aktif</h3><span class="badge badge--green"><span class="dot"></span> Berjalan</span></div>
        <div class="card__body"><div class="grid g4">
          ${App.UI.stat({ label:'Kasir', value:`<span style="font-size:15px">${U.esc((DB.find('users', active.userId)||{}).name || '-')}</span>`, sub:'sejak ' + U.fmtTime(active.openAt) })}
          ${App.UI.stat({ label:'Transaksi', value:U.num(active.orders || 0), sub:'shift berjalan' })}
          ${App.UI.stat({ label:'Penjualan Tunai', value:U.rp(active.salesCash || 0), sub:'masuk laci' })}
          ${App.UI.stat({ label:'Perkiraan Kas Laci', value:U.rp(active.openingCash + (active.salesCash||0) + (active.cashIn||0) - (active.cashOut||0)), sub:'modal + tunai ± kas' })}
        </div></div></div>` : ''}
      <div class="grid g-2-1">
        <div id="shift-table"></div>
        <div class="card">
          <div class="card__head"><h3>Kas Masuk / Keluar</h3></div>
          <div class="card__body" style="max-height:430px;overflow:auto">
            ${moves.length ? moves.map(c => `<div class="kv">
              <span class="k">${c.type === 'in' ? '⬆️' : '⬇️'} ${U.esc(c.note || '-')}<br><span class="small">${U.fmtDateTime(c.date)}</span></span>
              <span class="v" style="color:${c.type === 'in' ? 'var(--lime)' : 'var(--rose)'}">${c.type === 'in' ? '+' : '−'}${U.rp(c.amount)}</span></div>`).join('')
            : App.UI.emptyState('Belum ada mutasi kas','','💵')}
          </div>
        </div>
      </div>`;

    if (active) {
      root.querySelector('#close-shift').onclick = () => App.Views.closeShiftDialog(active.id, draw);
      root.querySelector('#cash-in').onclick = () => cashMove('in');
      root.querySelector('#cash-out').onclick = () => cashMove('out');
    } else {
      root.querySelector('#open-shift').onclick = () => App.Views.openShiftDialog(draw);
    }

    root.querySelector('#shift-table').appendChild(App.UI.dataTable({
      rows:list, exportName:'riwayat-shift', pageSize:12,
      onRowClick: s => shiftDetail(s),
      cols:[
        { key:'openAt', label:'Buka', render:s => U.fmtDateTime(s.openAt) },
        { key:'closeAt', label:'Tutup', render:s => s.closeAt ? U.fmtDateTime(s.closeAt) : App.UI.badge('Berjalan','amber') },
        { key:'userId', label:'Kasir', render:s => U.esc((DB.find('users', s.userId)||{}).name || '-') },
        { key:'orders', label:'Trx', align:'right', render:s => U.num(s.orders || 0) },
        { key:'gross', label:'Penjualan', align:'right', render:s => U.rp(s.gross || 0) },
        { key:'salesCash', label:'Tunai', align:'right', render:s => U.rp(s.salesCash || 0) },
        { key:'diff', label:'Selisih', align:'right', render:s => s.closeAt
            ? `<span style="color:${s.diff < 0 ? 'var(--rose)' : s.diff > 0 ? 'var(--lime)' : ''}">${U.rp(s.diff || 0)}</span>` : '-' }
      ]
    }));
  }

  function cashMove(type) {
    const active = App.State.activeShift();
    const accounts = DB.all('accounts').filter(a => !a.isGroup && (type === 'in' ? a.isCash || a.type === 'equity' : a.type === 'expense' || a.isCash));
    App.UI.formModal({
      title: type === 'in' ? 'Kas Masuk Outlet' : 'Kas Keluar Outlet',
      fields:[
        { name:'amount', label:'Jumlah (Rp)', type:'money', required:true },
        { name:'counterAccountId', label: type === 'in' ? 'Sumber dana' : 'Kategori pengeluaran', type:'select',
          options: accounts.map(a => ({ value:a.id, label:`${a.code} — ${a.name}` })), required:true },
        { name:'note', label:'Keterangan', type:'text', required:true, col:2,
          placeholder: type === 'in' ? 'mis. tambahan modal kembalian' : 'mis. beli galon & es batu' }
      ],
      onSubmit(d) {
        const mv = DB.insert('cashMoves', { ...d, type, date:U.now(), shiftId:active.id,
          outletId:App.State.outletId(), userId:App.Auth.user().id });
        DB.update('shifts', active.id, s => type === 'in'
          ? { cashIn:(s.cashIn||0) + d.amount } : { cashOut:(s.cashOut||0) + d.amount });
        App.Ledger.postCashMove(mv);
        App.UI.toast('Mutasi kas dicatat & terposting ke jurnal', 'ok');
        draw();
      }
    });
  }

  function shiftDetail(s) {
    const orders = DB.where('orders', o => o.shiftId === s.id);
    const paid = orders.filter(o => o.status === 'paid');
    App.UI.modal({
      title:'Detail Shift', size:'lg',
      subtitle:`${U.fmtDateTime(s.openAt)} — ${s.closeAt ? U.fmtDateTime(s.closeAt) : 'berjalan'}`,
      body:`<div class="grid g2 mb-16">
        <div class="card"><div class="card__body">
          <div class="kv"><span class="k">Kasir</span><span class="v">${U.esc((DB.find('users', s.userId)||{}).name || '-')}</span></div>
          <div class="kv"><span class="k">Outlet</span><span class="v">${U.esc((DB.find('outlets', s.outletId)||{}).name || '-')}</span></div>
          <div class="kv"><span class="k">Transaksi</span><span class="v">${paid.length} lunas / ${orders.length} total</span></div>
          <div class="kv"><span class="k">Void</span><span class="v">${orders.filter(o => o.status === 'void').length}</span></div>
        </div></div>
        <div class="card"><div class="card__body">
          <div class="kv"><span class="k">Modal awal</span><span class="v">${U.rp(s.openingCash)}</span></div>
          <div class="kv"><span class="k">Penjualan tunai</span><span class="v">${U.rp(s.salesCash||0)}</span></div>
          <div class="kv"><span class="k">Non-tunai</span><span class="v">${U.rp(s.salesNonCash||0)}</span></div>
          <div class="kv"><span class="k">Kas fisik</span><span class="v">${U.rp(s.actualCash||0)}</span></div>
          <div class="kv"><span class="k bold">Selisih</span><span class="v" style="color:${(s.diff||0)<0?'var(--rose)':'var(--lime)'}">${U.rp(s.diff||0)}</span></div>
        </div></div></div>
      <div class="card"><div class="card__head"><h3>Menu terjual</h3></div><div class="card__body">
        ${App.Chart.hbar(App.Sales.productMix(paid).slice(0,8).map(x => ({ label:x.nama, value:x.qty })), { unit:' porsi' })}
      </div></div>`
    });
  }
  draw();
};
