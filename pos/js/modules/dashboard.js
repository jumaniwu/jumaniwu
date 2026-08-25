/* =============================================================
   SajiPOS — Dashboard & pembantu analisa penjualan
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

/* ---------- Pembantu agregasi penjualan (dipakai banyak modul) ---------- */
App.Sales = (function () {
  const U = App.U, DB = App.DB;

  function orders({ from, to, outletId, status = 'paid', type, channel } = {}) {
    const oid = outletId === undefined ? App.State.outletId() : outletId;
    return DB.all('orders').filter(o => {
      if (status && status !== 'all' && o.status !== status) return false;
      if (oid && oid !== 'ALL' && o.outletId !== oid) return false;
      const d = U.ymd(o.paidAt || o.date);
      if (from && d < from) return false;
      if (to && d > to) return false;
      if (type && o.type !== type) return false;
      if (channel && o.channel !== channel) return false;
      return true;
    });
  }
  function totals(list) {
    const gross = U.sum(list, o => o.subtotal);
    const discount = U.sum(list, o => o.discount);
    const net = gross - discount;
    const tax = U.sum(list, o => o.tax);
    const svc = U.sum(list, o => o.serviceCharge);
    const total = U.sum(list, o => o.total);
    const cogs = U.sum(list, o => o.cogs || 0);
    const qty = U.sum(list, o => U.sum(o.items, i => i.qty));
    return {
      trx: list.length, gross, discount, net, tax, svc, total, cogs,
      profit: net - cogs, margin: net ? ((net - cogs) / net) * 100 : 0,
      avg: list.length ? total / list.length : 0, qty,
      guests: U.sum(list, o => o.guestCount || 1)
    };
  }
  function byDay(list, from, to) {
    const g = U.groupBy(list, o => U.ymd(o.paidAt || o.date));
    return U.dateRangeDays(from, to).map(d => ({
      label: U.fmtDate(d, 'dm'), date: d,
      value: U.sum(g[d] || [], o => o.total),
      trx: (g[d] || []).length,
      profit: U.sum(g[d] || [], o => (o.subtotal - o.discount) - (o.cogs || 0))
    }));
  }
  function byHour(list) {
    const arr = Array.from({ length: 24 }, (_, h) => ({ label: String(h), value: 0, trx: 0 }));
    list.forEach(o => { const h = new Date(o.paidAt || o.date).getHours(); arr[h].value += o.total; arr[h].trx++; });
    return arr.filter(x => x.trx > 0 || (Number(x.label) >= 7 && Number(x.label) <= 22));
  }
  function productMix(list) {
    const m = {};
    list.forEach(o => o.items.forEach(it => {
      const k = it.productId;
      if (!m[k]) {
        const p = DB.find('products', k) || {};
        m[k] = { productId:k, nama: it.name, kategori: (DB.find('categories', p.categoryId) || {}).name || '-',
                 qty:0, omzet:0, hpp:0, emoji: p.emoji || '🍽️' };
      }
      m[k].qty += it.qty;
      m[k].omzet += it.subtotal;
      m[k].hpp += App.Inv.recipeCost(k, o.outletId) * it.qty;
    }));
    return Object.values(m).map(r => ({ ...r, laba: r.omzet - r.hpp,
      margin: r.omzet ? ((r.omzet - r.hpp) / r.omzet) * 100 : 0 })).sort((a, b) => b.omzet - a.omzet);
  }
  function byCategory(list) {
    const mix = productMix(list);
    const g = U.groupBy(mix, r => r.kategori);
    return Object.entries(g).map(([label, rows]) => ({
      label, value: U.sum(rows, r => r.omzet), qty: U.sum(rows, r => r.qty), laba: U.sum(rows, r => r.laba)
    })).sort((a, b) => b.value - a.value);
  }
  function byPayment(list) {
    const m = {};
    list.forEach(o => (o.payments || []).forEach(p => {
      m[p.method] = (m[p.method] || 0) + p.amount;
    }));
    const meta = DB.settings().paymentMethods || [];
    return Object.entries(m).map(([k, v]) => ({
      key:k, label: (meta.find(x => x.key === k) || {}).label || k, value: v
    })).sort((a, b) => b.value - a.value);
  }
  function byChannel(list) {
    const meta = DB.settings().channels || [];
    const g = U.groupBy(list, o => o.channel || 'kasir');
    return Object.entries(g).map(([k, rows]) => {
      const c = meta.find(x => x.key === k) || { label:k, color:'#5b6b8c', icon:'•' };
      return { key:k, label:c.label, icon:c.icon, color:c.color, value:U.sum(rows, o => o.total), trx:rows.length };
    }).sort((a, b) => b.value - a.value);
  }
  function byType(list) {
    const LBL = { dinein:'Dine In', takeaway:'Bungkus', delivery:'Pengiriman', ojol:'Ojek Online',
                  reservation:'Reservasi', ecommerce:'Toko Online' };
    const g = U.groupBy(list, o => o.type);
    return Object.entries(g).map(([k, rows]) => ({ key:k, label:LBL[k] || k,
      value:U.sum(rows, o => o.total), trx:rows.length })).sort((a, b) => b.value - a.value);
  }
  function byCashier(list) {
    const g = U.groupBy(list, o => o.cashierId);
    return Object.entries(g).map(([k, rows]) => ({
      userId:k, nama:(DB.find('users', k) || {}).name || '-', trx:rows.length,
      omzet:U.sum(rows, o => o.total), avg:U.sum(rows, o => o.total) / rows.length
    })).sort((a, b) => b.omzet - a.omzet);
  }
  function heatMatrix(list) {
    const m = Array.from({ length: 7 }, () => Array(24).fill(0));
    list.forEach(o => { const d = new Date(o.paidAt || o.date); m[d.getDay()][d.getHours()]++; });
    return m;
  }
  /* Tanggal transaksi paling awal yang tercatat. Dipakai untuk memastikan
     periode pembanding benar-benar punya data sebelum menampilkan persentase
     pertumbuhan (agar tidak muncul angka seperti "+1189%"). */
  let _firstDate = null;
  function firstDate() {
    if (_firstDate === null) {
      const ds = DB.all('orders').map(o => U.ymd(o.date));
      _firstDate = ds.length ? ds.sort()[0] : U.today();
    }
    return _firstDate;
  }
  function periodComparable(prevFrom) { return prevFrom >= firstDate(); }

  function compare(curFrom, curTo, outletId) {
    const days = U.dateRangeDays(curFrom, curTo).length;
    const prevTo = U.addDays(curFrom, -1), prevFrom = U.addDays(prevTo, -(days - 1));
    const cur = totals(orders({ from:curFrom, to:curTo, outletId }));
    const prev = totals(orders({ from:prevFrom, to:prevTo, outletId }));
    /* Persentase pertumbuhan hanya ditampilkan bila periode pembanding
       tercakup penuh oleh data yang tersedia. */
    const ok = periodComparable(prevFrom);
    const d = (a, b) => (ok && b ? ((a - b) / b) * 100 : null);
    return { cur, prev, delta: {
      total:d(cur.total, prev.total), trx:d(cur.trx, prev.trx), avg:d(cur.avg, prev.avg),
      profit:d(cur.profit, prev.profit), net:d(cur.net, prev.net) } };
  }
  return { orders, totals, byDay, byHour, productMix, byCategory, byPayment, byChannel, byType,
           byCashier, heatMatrix, compare, firstDate, periodComparable };
})();

/* ---------- Pemilih periode yang dipakai bersama ---------- */
App.Period = (function () {
  const U = App.U;
  const PRESETS = {
    today:    () => [U.today(), U.today()],
    yesterday:() => [U.addDays(U.today(), -1), U.addDays(U.today(), -1)],
    week:     () => [U.addDays(U.today(), -6), U.today()],
    d30:      () => [U.addDays(U.today(), -29), U.today()],
    month:    () => [U.startOfMonth(U.today()), U.today()],
    lastmonth:() => [U.startOfMonth(U.addMonths(U.today(), -1)), U.endOfMonth(U.addMonths(U.today(), -1))],
    all:      () => ['2000-01-01', U.today()]
  };
  const LABEL = { today:'Hari ini', yesterday:'Kemarin', week:'7 hari', d30:'30 hari',
                  month:'Bulan ini', lastmonth:'Bulan lalu', all:'Semua' };

  function bar(state, onChange, presets) {
    const keys = presets || ['today','yesterday','week','d30','month','lastmonth'];
    const el = U.el(`<div class="flex items-center gap-8" style="flex-wrap:wrap">
      <div class="pill-row">${keys.map(k => `<button class="pill ${state.preset === k ? 'is-active' : ''}" data-p="${k}">${LABEL[k]}</button>`).join('')}</div>
      <div class="flex items-center gap-6">
        <input class="input" type="date" id="pf" value="${state.from}" style="width:145px">
        <span class="muted small">s/d</span>
        <input class="input" type="date" id="pt" value="${state.to}" style="width:145px">
      </div>
    </div>`);
    el.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      const [f, t] = PRESETS[b.dataset.p]();
      state.preset = b.dataset.p; state.from = f; state.to = t; onChange();
    });
    el.querySelector('#pf').onchange = e => { state.from = e.target.value; state.preset = null; onChange(); };
    el.querySelector('#pt').onchange = e => { state.to = e.target.value; state.preset = null; onChange(); };
    return el;
  }
  function init(preset = 'month') {
    const [from, to] = PRESETS[preset]();
    return { preset, from, to };
  }
  return { bar, init, PRESETS, LABEL };
})();

/* ============================================================= */
App.Views.dashboard = function (root) {
  const U = App.U, DB = App.DB, C = App.Chart;
  const state = App.Period.init('month');

  function draw() {
    const oid = App.State.outletId();
    const cmp = App.Sales.compare(state.from, state.to, oid);
    const list = App.Sales.orders({ from:state.from, to:state.to, outletId:oid });
    const t = cmp.cur;
    const daily = App.Sales.byDay(list, state.from, state.to);
    const mix = App.Sales.productMix(list);
    const low = App.Inv.lowStockList(oid === 'ALL' ? DB.all('outlets')[0].id : oid);
    const openOrders = DB.where('orders', o => o.status === 'open' && (oid === 'ALL' || o.outletId === oid));
    const bills = DB.where('bills', b => b.status !== 'paid');
    const ar = App.Ledger.balanceByCode(App.Ledger.A.AR, U.today(), oid);
    const kas = App.Ledger.cashAccounts().reduce((s, a) => s + App.Ledger.balance(a.id, U.today(), null), 0);
    const pl = App.Ledger.profitLoss(state.from, state.to, oid);
    const shift = App.State.activeShift();

    root.innerHTML = `
      <div class="page-head">
        <div>
          <h2>Halo, ${U.esc(App.Auth.user().name.split(' ')[0])} 👋</h2>
          <p>${U.fmtDate(U.today(),'full')} · ${oid === 'ALL' ? 'Semua outlet' : U.esc(App.State.outlet().name)}</p>
        </div>
        <div class="page-head__actions" id="period"></div>
      </div>

      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Omzet (setelah diskon)', icon:'💰', value:U.rp(t.net), delta:cmp.delta.net,
          sub:`${U.num(t.trx)} transaksi · ${U.num(t.qty)} item` })}
        ${App.UI.stat({ label:'Laba Kotor', icon:'📈', value:U.rp(t.profit), delta:cmp.delta.profit,
          sub:`Margin ${t.margin.toFixed(1).replace('.',',')}% · HPP ${U.compact(t.cogs)}` })}
        ${App.UI.stat({ label:'Rata-rata per Transaksi', icon:'🧾', value:U.rp(t.avg), delta:cmp.delta.avg,
          sub:`${U.num(t.guests)} tamu dilayani` })}
        ${App.UI.stat({ label:'Laba Bersih (periode)', icon:'🏦', value:U.rp(pl.netProfit),
          sub:`Beban operasional ${U.compact(pl.totalOpex)}`, tone: pl.netProfit >= 0 ? '' : 'var(--rose)' })}
      </div>

      <div class="grid g-2-1 mb-16">
        <div class="card">
          <div class="card__head"><h3>Tren Penjualan</h3><span class="sub">${U.fmtDate(state.from)} – ${U.fmtDate(state.to)}</span>
            <div class="btn-group" style="margin-left:auto"><button class="is-active" data-m="value">Omzet</button><button data-m="trx">Transaksi</button><button data-m="profit">Laba</button></div>
          </div>
          <div class="card__body" id="chart-main"></div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Komposisi Kategori</h3></div>
          <div class="card__body">${C.donut(App.Sales.byCategory(list).map((c,i)=>({...c,color:C.PALETTE[i%C.PALETTE.length]})), { money:true, centerLabel:'Omzet' })}</div>
        </div>
      </div>

      <div class="grid g3 mb-16">
        <div class="card">
          <div class="card__head"><h3>Menu Terlaris</h3><span class="sub">berdasarkan omzet</span></div>
          <div class="card__body">${C.hbar(mix.slice(0,7).map(m => ({ label:m.nama, value:m.omzet })), { money:true })}</div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Metode Pembayaran</h3></div>
          <div class="card__body">${C.donut(App.Sales.byPayment(list), { money:true, centerLabel:'Diterima', size:130 })}</div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Kanal Penjualan</h3></div>
          <div class="card__body">
            ${App.Sales.byChannel(list).map(c => `
              <div class="kv"><span class="k">${c.icon} ${U.esc(c.label)} <span class="muted small">(${c.trx})</span></span>
              <span class="v">${U.rp(c.value)}</span></div>`).join('') || '<div class="empty small">Belum ada data</div>'}
          </div>
        </div>
      </div>

      <div class="grid g4 mb-16">
        <div class="card">
          <div class="card__head"><h3>Perlu Perhatian</h3></div>
          <div class="card__body" style="display:grid;gap:9px">
            <a class="kv link" href="#/stock"><span class="k">📦 Stok menipis</span><span class="v" style="color:${low.length?'var(--amber)':''}">${low.length} item</span></a>
            <a class="kv link" href="#/orders"><span class="k">🧾 Pesanan berjalan</span><span class="v">${openOrders.length}</span></a>
            <a class="kv link" href="#/bills"><span class="k">🧮 Tagihan belum lunas</span><span class="v">${U.compact(U.sum(bills, b => b.total - b.paid))}</span></a>
            <a class="kv link" href="#/finance"><span class="k">💵 Piutang usaha</span><span class="v">${U.compact(ar)}</span></a>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Posisi Kas & Bank</h3></div>
          <div class="card__body">
            ${App.Ledger.cashAccounts().map(a => `<div class="kv"><span class="k">${U.esc(a.name)}</span><span class="v">${U.rp(App.Ledger.balance(a.id, U.today(), null))}</span></div>`).join('')}
            <div class="divider"></div>
            <div class="kv"><span class="k bold">Total likuid</span><span class="v" style="color:var(--brand-600)">${U.rp(kas)}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Shift Kasir</h3></div>
          <div class="card__body">
            ${shift ? `
              <div class="kv"><span class="k">Kasir</span><span class="v">${U.esc((DB.find('users', shift.userId)||{}).name || '-')}</span></div>
              <div class="kv"><span class="k">Dibuka</span><span class="v">${U.fmtTime(shift.openAt)}</span></div>
              <div class="kv"><span class="k">Modal awal</span><span class="v">${U.rp(shift.openingCash)}</span></div>
              <div class="kv"><span class="k">Penjualan tunai</span><span class="v">${U.rp(shift.salesCash)}</span></div>
              <div class="kv"><span class="k">Perkiraan kas</span><span class="v">${U.rp(shift.openingCash + shift.salesCash + (shift.cashIn||0) - (shift.cashOut||0))}</span></div>
              <a class="btn btn--sm btn--block mt-8" href="#/shifts">Kelola shift</a>`
              : `<div class="empty small">Belum ada shift terbuka.<br><a class="link" href="#/shifts">Buka kasir sekarang</a></div>`}
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Pelanggan</h3></div>
          <div class="card__body">
            ${(() => {
              const cs = DB.all('customers');
              const withOrder = U.unique(list.map(o => o.customerId).filter(Boolean));
              const baru = cs.filter(c => c.joinDate >= state.from).length;
              return `<div class="kv"><span class="k">Total member</span><span class="v">${U.num(cs.length)}</span></div>
                      <div class="kv"><span class="k">Member baru</span><span class="v">${U.num(baru)}</span></div>
                      <div class="kv"><span class="k">Aktif periode ini</span><span class="v">${U.num(withOrder.length)}</span></div>
                      <div class="kv"><span class="k">Transaksi bermember</span><span class="v">${U.pct(list.filter(o=>o.customerId).length, list.length||1)}</span></div>
                      <a class="btn btn--sm btn--block mt-8" href="#/customers">Lihat CRM</a>`;
            })()}
          </div>
        </div>
      </div>

      <div class="grid g2">
        <div class="card">
          <div class="card__head"><h3>Jam Ramai</h3><span class="sub">jumlah transaksi per jam</span></div>
          <div class="card__body">${C.bar(App.Sales.byHour(list).map(h => ({ label:h.label, value:h.trx })), { money:false, color:'#7c5cff', height:170 })}</div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Transaksi Terakhir</h3><a class="link small" href="#/orders" style="margin-left:auto">Lihat semua →</a></div>
          <div class="tbl-wrap">
            <table class="tbl"><thead><tr><th>No</th><th>Waktu</th><th>Jenis</th><th class="num">Total</th><th>Status</th></tr></thead>
            <tbody>${U.sortBy(DB.where('orders', o => oid === 'ALL' || o.outletId === oid), o => o.date, 'desc').slice(0,7).map(o => `
              <tr><td class="mono">${U.esc(o.no)}</td><td>${U.fmtTime(o.date)}</td>
                  <td>${U.esc({dinein:'Dine In',takeaway:'Bungkus',ojol:'Ojek Online',delivery:'Delivery',ecommerce:'Online'}[o.type]||o.type)}</td>
                  <td class="num">${U.rp(o.total)}</td>
                  <td>${App.UI.badge(o.status === 'paid' ? 'Lunas' : o.status === 'open' ? 'Berjalan' : 'Void',
                       o.status === 'paid' ? 'green' : o.status === 'open' ? 'amber' : 'red')}</td></tr>`).join('')}
            </tbody></table>
          </div>
        </div>
      </div>`;

    root.querySelector('#period').appendChild(App.Period.bar(state, draw));

    const chart = root.querySelector('#chart-main');
    const drawMain = m => chart.innerHTML = m === 'trx'
      ? C.bar(daily.map(d => ({ label:d.label, value:d.trx })), { money:false, color:'#0b93d5' })
      : C.line(daily.map(d => ({ label:d.label, value:m === 'profit' ? d.profit : d.value })),
               { color: m === 'profit' ? '#3fa62a' : '#0d9c86' });
    drawMain('value');
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
      root.querySelectorAll('[data-m]').forEach(x => x.classList.toggle('is-active', x === b));
      drawMain(b.dataset.m);
    });
  }
  draw();
};
