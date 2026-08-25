/* =============================================================
   SajiPOS — Layar Kasir (POS)
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

App.POS = (function () {
  const U = App.U, DB = App.DB;

  const TYPES = [
    { key:'dinein',    label:'Dine In',     icon:'🍽️' },
    { key:'takeaway',  label:'Bungkus',     icon:'🥡' },
    { key:'delivery',  label:'Pengiriman',  icon:'🛵' },
    { key:'ojol',      label:'Ojek Online', icon:'📲' },
    { key:'reservation',label:'Reservasi',  icon:'📅' },
    { key:'ecommerce', label:'Toko Online', icon:'🌐' }
  ];
  const TYPE_LABEL = Object.fromEntries(TYPES.map(t => [t.key, t.label]));

  /* Keranjang aktif */
  let cart = null;

  function newCart(seed = {}) {
    return {
      id: null, no: null, items: [], type: DB.settings().pos.defaultOrderType || 'dinein',
      channel: 'kasir', tableId: null, tableName: null, customerId: null, guestCount: 1,
      discountManual: 0, discountManualPct: 0, promoId: null, note: '', waiterId: null,
      ...seed
    };
  }
  function getCart() { if (!cart) cart = newCart(); return cart; }
  function setCart(c) { cart = c; }
  function clearCart() { cart = newCart(); }

  /* ---------------- perhitungan ---------------- */
  function lineTotal(it) {
    const varDelta = U.sum(it.variants || [], v => v.priceDelta || 0);
    const modDelta = U.sum(it.modifiers || [], m => m.price || 0);
    return (it.price + varDelta + modDelta) * it.qty - (it.discount || 0);
  }
  function activePromos(outletId) {
    const now = new Date();
    const t = U.today(), hour = now.getHours(), dow = now.getDay();
    return DB.all('promos').filter(p => {
      if (!p.active) return false;
      if (p.startDate && t < p.startDate) return false;
      if (p.endDate && t > p.endDate) return false;
      if (p.days && p.days.length && !p.days.includes(dow)) return false;
      if (p.hourFrom !== undefined && (hour < p.hourFrom || hour >= p.hourTo)) return false;
      if (p.outletIds && p.outletIds.length && !p.outletIds.includes('ALL') && !p.outletIds.includes(outletId)) return false;
      return true;
    });
  }
  function promoDiscount(promo, c, subtotal) {
    if (!promo) return 0;
    const cust = c.customerId ? DB.find('customers', c.customerId) : null;
    switch (promo.type) {
      case 'percent': {
        let base = subtotal;
        if (promo.categoryIds && promo.categoryIds.length) {
          base = U.sum(c.items.filter(it => {
            const p = DB.find('products', it.productId);
            return p && promo.categoryIds.includes(p.categoryId);
          }), lineTotal);
        } else if (promo.productIds && promo.productIds.length) {
          base = U.sum(c.items.filter(it => promo.productIds.includes(it.productId)), lineTotal);
        }
        if (promo.minPurchase && subtotal < promo.minPurchase) return 0;
        return Math.round(base * promo.value / 100);
      }
      case 'amount':
        if (promo.minPurchase && subtotal < promo.minPurchase) return 0;
        return Math.min(promo.value, subtotal);
      case 'member': {
        if (!cust) return 0;
        const tier = DB.find('tiers', cust.tierId);
        if (!tier || !tier.discount) return 0;
        return Math.round(subtotal * tier.discount / 100);
      }
      case 'bogo': {
        const eligible = c.items.filter(it => promo.productIds.includes(it.productId));
        return U.sum(eligible, it => Math.floor(it.qty / 2) * it.price);
      }
      case 'stamp': {
        if (!cust || (cust.stamps || 0) < promo.value) return 0;
        const eligible = c.items.filter(it => {
          const p = DB.find('products', it.productId);
          return !promo.categoryIds || !promo.categoryIds.length || (p && promo.categoryIds.includes(p.categoryId));
        });
        if (!eligible.length) return 0;
        return Math.min(...eligible.map(it => it.price));
      }
      default: return 0;
    }
  }
  function bestPromo(c, subtotal, outletId) {
    const list = activePromos(outletId).filter(p => p.autoApply);
    let best = null, bestVal = 0;
    list.forEach(p => {
      const v = promoDiscount(p, c, subtotal);
      if (v > bestVal) { bestVal = v; best = p; }
    });
    return { promo: best, value: bestVal };
  }
  function calc(c, outlet) {
    const o = outlet || App.State.outlet();
    const subtotal = U.sum(c.items, lineTotal);
    let discount = 0, promoId = c.promoId, promoName = '';
    if (c.promoId) {
      const p = DB.find('promos', c.promoId);
      discount = promoDiscount(p, c, subtotal);
      promoName = p ? p.name : '';
    } else {
      const b = bestPromo(c, subtotal, o.id);
      if (b.promo) { discount = b.value; promoId = b.promo.id; promoName = b.promo.name; }
    }
    if (c.discountManualPct) discount += Math.round(subtotal * c.discountManualPct / 100);
    if (c.discountManual) discount += c.discountManual;
    discount = Math.min(discount, subtotal);

    const dpp = subtotal - discount;
    const svc = c.type === 'dinein' ? Math.round(dpp * (o.serviceCharge || 0) / 100) : 0;
    const tax = Math.round((dpp + svc) * (o.taxRate || 0) / 100);
    const raw = dpp + svc + tax;
    const step = o.rounding || 1;
    const total = Math.round(raw / step) * step;
    return { subtotal, discount, promoId, promoName, dpp, svc, tax, raw, total, roundingAdj: total - raw };
  }

  /* ---------------- simpan pesanan ---------------- */
  function buildOrder(c, calcRes, payments, extra = {}) {
    const outlet = App.State.outlet();
    const shift = App.State.activeShift();
    const seq = DB.where('orders', o => o.outletId === outlet.id && U.ymd(o.date) === U.today()).length + 1;
    const waiter = c.waiterId ? DB.find('employees', c.waiterId) : null;
    const dpp = calcRes.dpp;
    return {
      id: c.id || U.uid('ord'),
      no: c.no || `${outlet.code}/${U.today().replace(/-/g,'').slice(2)}/${String(seq).padStart(4,'0')}`,
      date: c.createdAt || U.now(), createdAt: c.createdAt || U.now(),
      outletId: outlet.id, type: c.type, typeLabel: TYPE_LABEL[c.type], channel: c.channel || 'kasir',
      tableId: c.tableId, tableName: c.tableName, customerId: c.customerId,
      customerName: c.customerId ? (DB.find('customers', c.customerId) || {}).name : null,
      guestCount: c.guestCount || 1,
      items: c.items.map(it => ({ ...it, subtotal: lineTotal(it) })),
      subtotal: calcRes.subtotal, discount: calcRes.discount, promoId: calcRes.promoId,
      promoName: calcRes.promoName, tax: calcRes.tax, serviceCharge: calcRes.svc,
      roundingAdj: calcRes.roundingAdj, total: calcRes.total,
      cogs: 0, commission: waiter ? Math.round(dpp * (waiter.commissionRate || 0) / 100) : 0,
      payments: payments || [], change: extra.change || 0, cashReceived: extra.cashReceived || 0,
      status: extra.status || 'open', cashierId: App.Auth.user().id, waiterId: c.waiterId,
      shiftId: shift ? shift.id : null, kitchenStatus: extra.kitchenStatus || 'new',
      notes: c.note || '', paidAt: extra.paidAt || null, deliveryInfo: c.deliveryInfo || null
    };
  }

  function saveOpen(c) {                 /* simpan pesanan (belum dibayar) */
    const res = calc(c);
    const existing = c.id ? DB.find('orders', c.id) : null;
    const order = buildOrder(c, res, [], { status:'open', kitchenStatus: existing ? existing.kitchenStatus : 'new' });
    if (existing) DB.update('orders', order.id, order); else DB.insert('orders', order);
    if (c.tableId) DB.update('tables', c.tableId, { status:'occupied', orderId:order.id, openedAt: order.createdAt });
    DB.log('order.save', `Simpan pesanan ${order.no} (${U.rp(order.total)})`);
    return order;
  }

  function finalize(c, payments, extra) {
    const res = calc(c);
    const order = buildOrder(c, res, payments, { ...extra, status:'paid', paidAt:U.now(), kitchenStatus: extra.kitchenStatus || 'new' });

    /* stok & HPP */
    order.cogs = App.Inv.consumeForOrder(order);

    const existing = c.id ? DB.find('orders', c.id) : null;
    if (existing) DB.update('orders', order.id, order); else DB.insert('orders', order);

    /* jurnal otomatis */
    App.Ledger.postSale(order);

    /* shift */
    const shift = App.State.activeShift();
    if (shift) {
      const cash = U.sum(payments.filter(p => p.method === 'cash'), p => p.amount);
      DB.update('shifts', shift.id, s => ({
        salesCash: (s.salesCash || 0) + cash,
        salesNonCash: (s.salesNonCash || 0) + (order.total - cash),
        orders: (s.orders || 0) + 1, gross: (s.gross || 0) + order.total
      }));
    }
    /* meja */
    if (order.tableId) DB.update('tables', order.tableId, { status:'free', orderId:null, openedAt:null });

    /* loyalty */
    if (order.customerId) applyLoyalty(order);

    /* deposit terpakai */
    const dep = U.sum(payments.filter(p => p.method === 'deposit'), p => p.amount);
    if (dep && order.customerId) DB.update('customers', order.customerId, cu => ({ deposit: (cu.deposit || 0) - dep }));

    DB.log('order.paid', `Transaksi ${order.no} lunas ${U.rp(order.total)}`);
    DB.saveNow();
    return order;
  }

  function applyLoyalty(order) {
    const cust = DB.find('customers', order.customerId);
    if (!cust) return;
    const tier = DB.find('tiers', cust.tierId) || { pointRate: 1 };
    const net = order.subtotal - order.discount;
    const points = Math.floor(net / 10000 * (tier.pointRate || 1));
    const cups = U.sum(order.items.filter(it => {
      const p = DB.find('products', it.productId);
      const c = p ? DB.find('categories', p.categoryId) : null;
      return c && /kopi/i.test(c.name);
    }), it => it.qty);
    const totalSpend = (cust.totalSpend || 0) + net;
    const tiers = U.sortBy(DB.all('tiers'), t => t.minSpend, 'desc');
    const newTier = tiers.find(t => totalSpend >= t.minSpend) || tiers[tiers.length - 1];
    const stampPromo = DB.first('promos', p => p.type === 'stamp' && p.active);
    let stamps = (cust.stamps || 0) + cups;
    if (order.promoId && stampPromo && order.promoId === stampPromo.id) stamps -= stampPromo.value;

    DB.update('customers', cust.id, {
      points: (cust.points || 0) + points,
      stamps: Math.max(0, stamps),
      totalSpend, visits: (cust.visits || 0) + 1, lastVisit: U.today(),
      tierId: newTier.id
    });
    if (newTier.id !== cust.tierId) {
      DB.insert('notifications', { type:'crm', title:'Naik tier membership!', level:'info', read:false, at:U.now(),
        message:`${cust.name} naik ke tier ${newTier.name}.` });
    }
  }

  /* ---------------- void & refund ---------------- */
  async function voidOrder(order, reason) {
    const auth = await App.UI.authorize(`Void transaksi ${order.no} — ${U.rp(order.total)}`, 'pos.void');
    if (!auth) return false;
    if (order.status === 'paid') {
      App.Inv.restoreForOrder(order);
      App.Ledger.postVoid(order, reason);
      const shift = DB.find('shifts', order.shiftId);
      if (shift && shift.status === 'open') {
        const cash = U.sum((order.payments||[]).filter(p => p.method === 'cash'), p => p.amount);
        DB.update('shifts', shift.id, s => ({
          salesCash:(s.salesCash||0) - cash, salesNonCash:(s.salesNonCash||0) - (order.total - cash),
          orders:Math.max(0,(s.orders||0) - 1), gross:(s.gross||0) - order.total }));
      }
      if (order.customerId) {
        const c = DB.find('customers', order.customerId);
        if (c) DB.update('customers', c.id, {
          totalSpend: Math.max(0, (c.totalSpend||0) - (order.subtotal - order.discount)),
          visits: Math.max(0, (c.visits||0) - 1) });
      }
    }
    DB.update('orders', order.id, { status:'void', voidReason:reason, voidBy:auth.id, voidAt:U.now() });
    if (order.tableId) DB.update('tables', order.tableId, { status:'free', orderId:null });
    DB.log('order.void', `Void ${order.no}: ${reason}`, { authorizedBy: auth.name });
    App.UI.toast('Transaksi ' + order.no + ' dibatalkan', 'ok');
    return true;
  }

  async function refundOrder(order, items, reason) {
    const auth = await App.UI.authorize(`Refund transaksi ${order.no}`, 'pos.refund');
    if (!auth) return false;
    const amount = U.sum(items, i => i.subtotal);
    const refundOrd = { ...order, items, outletId: order.outletId };
    const value = App.Inv.restoreForOrder(refundOrd);
    App.Ledger.post({
      date:U.today(), ref:order.no, refType:'refund', refId:order.id,
      memo:`Refund ${order.no}: ${reason}`, outletId:order.outletId, source:'pos',
      lines:[
        { code:App.Ledger.A.SALES_FOOD, debit:amount, memo:'Pembatalan penjualan' },
        { accountId:App.Ledger.accountForPayment((order.payments[0]||{}).method || 'cash'), credit:amount, memo:'Pengembalian dana' },
        { code:App.Ledger.A.INV_MATERIAL, debit:value, memo:'Stok kembali' },
        { code:App.Ledger.A.COGS, credit:value, memo:'Koreksi HPP' }
      ].filter(l => l.debit || l.credit)
    });
    DB.update('orders', order.id, o => ({
      refunds: [...(o.refunds || []), { at:U.now(), amount, reason, items, by:auth.id }],
      status: amount >= o.total ? 'refund' : o.status
    }));
    DB.log('order.refund', `Refund ${order.no} ${U.rp(amount)}: ${reason}`, { authorizedBy: auth.name });
    App.UI.toast('Refund ' + U.rp(amount) + ' diproses', 'ok');
    return true;
  }

  /* ---------------- struk ---------------- */
  function receiptHTML(order, opts = {}) {
    const r = DB.settings().receipt || {};
    const biz = DB.settings().business || {};
    const outlet = DB.find('outlets', order.outletId) || {};
    const cashier = DB.find('users', order.cashierId) || {};
    const cust = order.customerId ? DB.find('customers', order.customerId) : null;
    const money = n => U.num(n);
    return `<div class="receipt">
      <div class="c big">${U.esc(r.header || biz.name || 'STRUK')}</div>
      <div class="c">${U.esc(r.subheader || '')}</div>
      <div class="c">${U.esc(outlet.name || '')}</div>
      <div class="c">${U.esc(outlet.address || '')}</div>
      <div class="c">${U.esc(outlet.phone || '')}</div>
      ${r.showNpwp && biz.npwp ? `<div class="c">NPWP ${U.esc(biz.npwp)}</div>` : ''}
      <hr>
      <div class="row"><span>No</span><span>${U.esc(order.no)}</span></div>
      <div class="row"><span>Tanggal</span><span>${U.fmtDate(order.paidAt || order.date)} ${U.fmtTime(order.paidAt || order.date)}</span></div>
      ${r.showCashier ? `<div class="row"><span>Kasir</span><span>${U.esc(cashier.name || '-')}</span></div>` : ''}
      <div class="row"><span>Jenis</span><span>${U.esc(TYPE_LABEL[order.type] || order.type)}${order.tableName ? ' · ' + order.tableName : ''}</span></div>
      ${cust ? `<div class="row"><span>Member</span><span>${U.esc(cust.name)}</span></div>` : ''}
      <hr>
      <table>${order.items.map(it => `
        <tr><td colspan="2">${U.esc(it.name)}</td></tr>
        ${(it.variants||[]).length ? `<tr><td colspan="2" style="padding-left:6px">· ${U.esc(it.variants.map(v=>v.name).join(', '))}</td></tr>` : ''}
        ${(it.modifiers||[]).length ? `<tr><td colspan="2" style="padding-left:6px">+ ${U.esc(it.modifiers.map(m=>m.name).join(', '))}</td></tr>` : ''}
        ${it.note ? `<tr><td colspan="2" style="padding-left:6px">* ${U.esc(it.note)}</td></tr>` : ''}
        <tr><td>${it.qty} x ${money(it.price + U.sum(it.variants||[],v=>v.priceDelta||0) + U.sum(it.modifiers||[],m=>m.price||0))}</td>
            <td class="r">${money(it.subtotal)}</td></tr>`).join('')}
      </table>
      <hr>
      <div class="row"><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
      ${order.discount ? `<div class="row"><span>Diskon${order.promoName ? ' ('+U.esc(order.promoName)+')' : ''}</span><span>-${money(order.discount)}</span></div>` : ''}
      ${order.serviceCharge ? `<div class="row"><span>Service Charge</span><span>${money(order.serviceCharge)}</span></div>` : ''}
      ${order.tax ? `<div class="row"><span>PB1/PPN</span><span>${money(order.tax)}</span></div>` : ''}
      ${order.roundingAdj ? `<div class="row"><span>Pembulatan</span><span>${money(order.roundingAdj)}</span></div>` : ''}
      <div class="row big"><span>TOTAL</span><span>${money(order.total)}</span></div>
      ${(order.payments||[]).map(p => `<div class="row"><span>${U.esc(labelOfMethod(p.method))}</span><span>${money(p.amount)}</span></div>`).join('')}
      ${order.change ? `<div class="row"><span>Kembali</span><span>${money(order.change)}</span></div>` : ''}
      ${cust ? `<hr><div class="row"><span>Poin transaksi ini</span><span>+${Math.floor((order.subtotal-order.discount)/10000)}</span></div>
                <div class="row"><span>Total poin</span><span>${U.num(cust.points||0)}</span></div>
                <div class="row"><span>Stamp</span><span>${cust.stamps||0}/10</span></div>` : ''}
      <hr>
      <div class="c" style="white-space:pre-line">${U.esc(r.footer || 'Terima kasih')}</div>
      ${r.showQr ? `<div class="c" style="margin-top:6px;font-size:9px">${U.esc(order.no)}</div>
        <div class="c" style="font-family:monospace;font-size:7px;letter-spacing:-1px;line-height:1">${barcodeArt(order.no)}</div>` : ''}
      ${opts.reprint ? `<div class="c" style="margin-top:5px">— CETAK ULANG —</div>` : ''}
    </div>`;
  }
  function barcodeArt(text) {
    let s = '';
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i) % 4;
      s += ['▌▏','▌▌','▏▌','▎▍'][c];
    }
    return s + s.slice(0, 8);
  }
  function labelOfMethod(k) {
    const m = (DB.settings().paymentMethods || []).find(x => x.key === k);
    return m ? m.label : k;
  }

  return {
    TYPES, TYPE_LABEL, newCart, getCart, setCart, clearCart, lineTotal, calc, activePromos, promoDiscount,
    saveOpen, finalize, voidOrder, refundOrder, receiptHTML, labelOfMethod, applyLoyalty, buildOrder
  };
})();

/* =============================================================
   Tampilan Kasir
   ============================================================= */
App.Views.pos = function (root, params) {
  const U = App.U, DB = App.DB, P = App.POS;
  const outlet = App.State.outlet();

  /* --- pastikan shift terbuka --- */
  const shift = App.State.activeShift();
  if (!shift) {
    root.innerHTML = `<div class="view" style="padding:40px">
      ${App.UI.emptyState('Kasir belum dibuka', 'Buka sesi kasir terlebih dahulu untuk mulai bertransaksi.', '🔒')}
      <div class="center"><button class="btn btn--primary btn--lg" id="open-shift">💰 Buka Kasir Sekarang</button></div></div>`;
    root.querySelector('#open-shift').onclick = () => App.Views.openShiftDialog(() => App.Router.reload());
    return;
  }

  /* --- muat pesanan yang ada bila diminta --- */
  if (params && params.order) {
    const o = DB.find('orders', params.order);
    if (o && o.status === 'open') {
      P.setCart({ id:o.id, no:o.no, items:U.clone(o.items), type:o.type, channel:o.channel,
        tableId:o.tableId, tableName:o.tableName, customerId:o.customerId, guestCount:o.guestCount,
        discountManual:0, discountManualPct:0, promoId:o.promoId, note:o.notes, waiterId:o.waiterId,
        createdAt:o.createdAt });
    }
  } else if (params && params.table) {
    const t = DB.find('tables', params.table);
    if (t) {
      if (t.orderId) {
        const o = DB.find('orders', t.orderId);
        if (o && o.status === 'open') {
          P.setCart({ id:o.id, no:o.no, items:U.clone(o.items), type:'dinein', channel:'kasir',
            tableId:t.id, tableName:t.name, customerId:o.customerId, guestCount:o.guestCount,
            discountManual:0, discountManualPct:0, promoId:o.promoId, note:o.notes, waiterId:o.waiterId, createdAt:o.createdAt });
        }
      } else {
        P.setCart(P.newCart({ type:'dinein', tableId:t.id, tableName:t.name }));
      }
    }
  }

  const cart = P.getCart();
  let activeCat = 'all';
  let search = '';

  const cats = DB.all('categories').filter(c => !c.isMaterial);
  const allProducts = DB.all('products').filter(p => p.type === 'product' && p.active !== false);

  root.innerHTML = `
    <div class="pos">
      <div class="pos__left">
        <div class="pos__bar">
          <div class="search" style="max-width:none;flex:1"><input class="input" id="pos-search" placeholder="Cari menu / scan barcode… (F1)"></div>
          <button class="btn btn--sm" id="btn-tables">🪑 Meja</button>
          <button class="btn btn--sm" id="btn-orders">📋 Pesanan</button>
          <button class="btn btn--sm" id="btn-kds">👨‍🍳 Dapur</button>
          <button class="btn btn--sm" id="btn-close-shift">💰 Tutup Kasir</button>
        </div>
        <div class="pos__cats" id="pos-cats"></div>
        <div class="pos__grid" id="pos-grid"></div>
      </div>

      <aside class="pos__cart" id="pos-cart">
        <div class="cart__head">
          <div style="flex:1">
            <div style="font-weight:800;font-size:14px" id="cart-title">Pesanan Baru</div>
            <div class="small muted" id="cart-sub">${U.esc(outlet.name)}</div>
          </div>
          <button class="btn btn--sm btn--ghost" id="btn-clear" title="Kosongkan">🗑️</button>
        </div>
        <div class="cart__type" id="cart-type"></div>
        <div class="cart__meta" id="cart-meta"></div>
        <div class="cart__items" id="cart-items"></div>
        <div class="cart__sum" id="cart-sum"></div>
        <div class="cart__actions">
          <button class="btn" id="btn-hold">💾 Simpan</button>
          <button class="btn" id="btn-kitchen">👨‍🍳 Ke Dapur</button>
          <button class="btn btn--primary btn--pay" id="btn-pay">BAYAR</button>
        </div>
      </aside>
    </div>`;

  /* ---------- kategori ---------- */
  function drawCats() {
    const counts = {};
    allProducts.forEach(p => counts[p.categoryId] = (counts[p.categoryId] || 0) + 1);
    root.querySelector('#pos-cats').innerHTML =
      `<button class="pill ${activeCat === 'all' ? 'is-active' : ''}" data-c="all">Semua (${allProducts.length})</button>
       <button class="pill ${activeCat === 'fav' ? 'is-active' : ''}" data-c="fav">⭐ Favorit</button>` +
      cats.map(c => `<button class="pill ${activeCat === c.id ? 'is-active' : ''}" data-c="${c.id}">${c.icon} ${U.esc(c.name)} (${counts[c.id] || 0})</button>`).join('');
    root.querySelectorAll('#pos-cats [data-c]').forEach(b => b.onclick = () => { activeCat = b.dataset.c; drawCats(); drawGrid(); });
  }

  /* ---------- grid produk ---------- */
  function drawGrid() {
    let list = allProducts;
    if (activeCat === 'fav') list = list.filter(p => p.favorite || p.bestSeller);
    else if (activeCat !== 'all') list = list.filter(p => p.categoryId === activeCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '') === search);
    }
    const grid = root.querySelector('#pos-grid');
    if (!list.length) { grid.innerHTML = App.UI.emptyState('Menu tidak ditemukan', 'Coba kata kunci lain', '🔍'); return; }
    grid.innerHTML = list.map(p => {
      const avail = App.Inv.available(p.id, outlet.id);
      const out = avail !== Infinity && avail <= 0;
      const low = avail !== Infinity && avail > 0 && avail <= 5;
      return `<button class="prod ${out ? 'is-out' : ''}" data-p="${p.id}" ${out ? 'disabled' : ''}>
        ${p.bestSeller ? '<span class="prod__flag">BEST</span>' : p.isBundle ? '<span class="prod__flag" style="background:var(--lime)">PAKET</span>' : ''}
        ${avail !== Infinity ? `<span class="prod__stock ${low ? 'low' : ''}">${avail > 99 ? '99+' : avail}</span>` : ''}
        <div class="prod__img">${p.emoji || '🍽️'}</div>
        <div class="prod__body">
          <div class="prod__name">${U.esc(p.name)}</div>
          <div class="prod__price">${U.rp(p.price)}</div>
        </div></button>`;
    }).join('');
    grid.querySelectorAll('[data-p]').forEach(b => b.onclick = () => addProduct(b.dataset.p));
  }

  /* ---------- tambah item ---------- */
  function addProduct(pid) {
    const p = DB.find('products', pid);
    if (!p) return;
    const mods = (DB.settings().modifiers || []).filter(m => (p.modifierGroups || []).includes(m.group));
    const hasOptions = (p.variants && p.variants.length) || mods.length;
    if (!hasOptions) { pushItem(p, 1, [], [], ''); return; }
    optionModal(p, mods);
  }
  function pushItem(p, qty, variants, modifiers, note) {
    const key = JSON.stringify([p.id, variants, modifiers, note]);
    const found = cart.items.find(it => JSON.stringify([it.productId, it.variants, it.modifiers, it.note]) === key);
    if (found) found.qty += qty;
    else cart.items.push({ productId:p.id, name:p.name, qty, price:p.price, variants, modifiers,
      note, discount:0, station:p.station, kdsStatus:'new' });
    drawCart();
  }
  function optionModal(p, mods) {
    const groups = U.groupBy(mods, m => m.group);
    const m = App.UI.modal({
      title: p.name, subtitle: U.rp(p.price) + ' · pilih varian & tambahan', size:'lg',
      body: `
        ${(p.variants || []).map((v, vi) => `
          <div class="mb-12"><div class="bold small mb-8">${U.esc(v.name)}</div>
            <div class="pill-row">${v.options.map((o, oi) => `
              <button class="pill ${oi === 0 ? 'is-active' : ''}" data-var="${vi}" data-opt="${oi}">
                ${U.esc(o.name)}${o.priceDelta ? ` +${U.num(o.priceDelta)}` : ''}</button>`).join('')}</div></div>`).join('')}
        ${Object.entries(groups).map(([g, list]) => `
          <div class="mb-12"><div class="bold small mb-8">${U.esc(g)}</div>
            <div class="pill-row">${list.map(mo => `
              <button class="pill" data-mod="${mo.id}">${U.esc(mo.name)}${mo.price ? ` +${U.num(mo.price)}` : ''}</button>`).join('')}</div></div>`).join('')}
        <div class="field"><label>Catatan untuk dapur</label>
          <input class="input" id="opt-note" placeholder="mis. tanpa bawang, sedikit gula"></div>
        <div class="flex items-center gap-12">
          <span class="small bold">Jumlah</span>
          <button class="qty-btn" id="opt-min">−</button>
          <span class="qty-val" id="opt-qty" style="font-size:16px">1</span>
          <button class="qty-btn" id="opt-plus">+</button>
          <span class="muted small" style="margin-left:auto">Total: <b id="opt-total">${U.rp(p.price)}</b></span>
        </div>`,
      footer:`<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Tambah ke Pesanan</button>`
    });
    let qty = 1;
    const sel = {}; (p.variants || []).forEach((v, i) => sel[i] = 0);
    const chosenMods = new Set();
    const recalc = () => {
      const vd = U.sum(Object.entries(sel), ([vi, oi]) => p.variants[vi].options[oi].priceDelta || 0);
      const md = U.sum([...chosenMods], id => (DB.settings().modifiers.find(x => x.id === id) || {}).price || 0);
      m.body.querySelector('#opt-total').textContent = U.rp((p.price + vd + md) * qty);
      m.body.querySelector('#opt-qty').textContent = qty;
    };
    m.body.querySelectorAll('[data-var]').forEach(b => b.onclick = () => {
      const vi = b.dataset.var;
      m.body.querySelectorAll(`[data-var="${vi}"]`).forEach(x => x.classList.remove('is-active'));
      b.classList.add('is-active'); sel[vi] = +b.dataset.opt; recalc();
    });
    m.body.querySelectorAll('[data-mod]').forEach(b => b.onclick = () => {
      const id = b.dataset.mod;
      if (chosenMods.has(id)) { chosenMods.delete(id); b.classList.remove('is-active'); }
      else { chosenMods.add(id); b.classList.add('is-active'); }
      recalc();
    });
    m.body.querySelector('#opt-min').onclick = () => { qty = Math.max(1, qty - 1); recalc(); };
    m.body.querySelector('#opt-plus').onclick = () => { qty++; recalc(); };
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const variants = Object.entries(sel).map(([vi, oi]) => ({
        group:p.variants[vi].name, name:p.variants[vi].options[oi].name, priceDelta:p.variants[vi].options[oi].priceDelta || 0
      })).filter(v => v.priceDelta || true);
      const modifiers = [...chosenMods].map(id => {
        const mo = DB.settings().modifiers.find(x => x.id === id);
        return { id, name:mo.name, price:mo.price, materialId:mo.materialId, qty:mo.qty };
      });
      pushItem(p, qty, variants, modifiers, m.body.querySelector('#opt-note').value.trim());
      m.close();
    };
  }

  /* ---------- keranjang ---------- */
  function drawCart() {
    /* jenis pesanan */
    root.querySelector('#cart-type').innerHTML = P.TYPES.map(t =>
      `<button class="pill ${cart.type === t.key ? 'is-active' : ''}" data-t="${t.key}">${t.icon} ${t.label}</button>`).join('');
    root.querySelectorAll('#cart-type [data-t]').forEach(b => b.onclick = () => {
      cart.type = b.dataset.t;
      if (cart.type !== 'dinein') { cart.tableId = null; cart.tableName = null; }
      if (cart.type === 'ojol') pickChannel();
      drawCart();
    });

    /* meta */
    const cust = cart.customerId ? DB.find('customers', cart.customerId) : null;
    const tier = cust ? DB.find('tiers', cust.tierId) : null;
    root.querySelector('#cart-meta').innerHTML = `
      <div class="flex gap-6">
        ${cart.type === 'dinein' ? `<button class="btn btn--sm" id="m-table" style="flex:1">🪑 ${cart.tableName ? U.esc(cart.tableName) : 'Pilih Meja'}</button>` : ''}
        ${cart.type === 'ojol' || cart.type === 'ecommerce' ? `<button class="btn btn--sm" id="m-channel" style="flex:1">📲 ${U.esc((DB.settings().channels.find(c=>c.key===cart.channel)||{}).label || 'Kanal')}</button>` : ''}
        <button class="btn btn--sm" id="m-cust" style="flex:1">${cust ? '💚 ' + U.esc(cust.name.split(' ')[0]) : '👤 Pelanggan'}</button>
        <button class="btn btn--sm" id="m-waiter" title="Pramusaji (komisi)">🙋 ${cart.waiterId ? U.esc((DB.find('employees',cart.waiterId)||{}).name.split(' ')[0]) : 'Pelayan'}</button>
      </div>
      ${cust ? `<div class="small" style="display:flex;gap:8px;flex-wrap:wrap">
        <span class="badge" style="background:${tier?tier.color:'#ccc'}20;color:${tier?tier.color:''}">${U.esc(tier ? tier.name : '-')}</span>
        <span class="muted">Poin ${U.num(cust.points||0)}</span>
        <span class="muted">Stamp ${cust.stamps||0}/10</span>
        ${cust.deposit ? `<span class="muted">Deposit ${U.rp(cust.deposit)}</span>` : ''}
      </div>` : ''}`;
    const bt = root.querySelector('#m-table'); if (bt) bt.onclick = pickTable;
    const bc = root.querySelector('#m-cust'); if (bc) bc.onclick = pickCustomer;
    const bch = root.querySelector('#m-channel'); if (bch) bch.onclick = pickChannel;
    const bw = root.querySelector('#m-waiter'); if (bw) bw.onclick = pickWaiter;

    /* item */
    const box = root.querySelector('#cart-items');
    if (!cart.items.length) {
      box.innerHTML = App.UI.emptyState('Keranjang kosong', 'Pilih menu di sebelah kiri', '🛒');
    } else {
      box.innerHTML = cart.items.map((it, i) => `
        <div class="citem">
          <div>
            <div class="citem__name">${U.esc(it.name)}</div>
            ${(it.variants||[]).length ? `<div class="citem__opts">${U.esc(it.variants.map(v=>v.name).join(' · '))}</div>` : ''}
            ${(it.modifiers||[]).length ? `<div class="citem__opts">+ ${U.esc(it.modifiers.map(m=>m.name).join(', '))}</div>` : ''}
            ${it.note ? `<div class="citem__note">📝 ${U.esc(it.note)}</div>` : ''}
            <div class="citem__ctrl">
              <button class="qty-btn" data-dec="${i}">−</button>
              <span class="qty-val">${it.qty}</span>
              <button class="qty-btn" data-inc="${i}">+</button>
              <button class="btn btn--sm btn--ghost" data-note="${i}" title="Catatan">📝</button>
              <button class="citem__x" data-del="${i}">✕</button>
            </div>
          </div>
          <div class="citem__price">${U.rp(P.lineTotal(it))}</div>
        </div>`).join('');
      box.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { cart.items[+b.dataset.inc].qty++; drawCart(); });
      box.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
        const it = cart.items[+b.dataset.dec];
        it.qty--; if (it.qty <= 0) cart.items.splice(+b.dataset.dec, 1);
        drawCart();
      });
      box.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { cart.items.splice(+b.dataset.del, 1); drawCart(); });
      box.querySelectorAll('[data-note]').forEach(b => b.onclick = async () => {
        const it = cart.items[+b.dataset.note];
        const v = await App.UI.prompt('Catatan untuk dapur', { value: it.note || '' });
        if (v !== null) { it.note = v; drawCart(); }
      });
    }

    /* ringkasan */
    const c = P.calc(cart, outlet);
    root.querySelector('#cart-sum').innerHTML = `
      <div class="kv"><span class="k">Subtotal (${U.sum(cart.items, i => i.qty)} item)</span><span class="v">${U.rp(c.subtotal)}</span></div>
      ${c.discount ? `<div class="kv"><span class="k">Diskon ${c.promoName ? '· ' + U.esc(c.promoName) : ''}</span><span class="v" style="color:var(--rose)">−${U.rp(c.discount)}</span></div>` : ''}
      ${c.svc ? `<div class="kv"><span class="k">Service charge ${outlet.serviceCharge}%</span><span class="v">${U.rp(c.svc)}</span></div>` : ''}
      ${c.tax ? `<div class="kv"><span class="k">PB1 ${outlet.taxRate}%</span><span class="v">${U.rp(c.tax)}</span></div>` : ''}
      ${c.roundingAdj ? `<div class="kv"><span class="k">Pembulatan</span><span class="v">${U.rp(c.roundingAdj)}</span></div>` : ''}
      <div class="flex gap-6 mt-8">
        <button class="btn btn--sm" id="btn-promo" style="flex:1">🎁 Promo</button>
        <button class="btn btn--sm" id="btn-disc" style="flex:1">% Diskon</button>
        <button class="btn btn--sm" id="btn-note" style="flex:1">📝 Catatan</button>
      </div>
      <div class="cart__total"><span>TOTAL</span><span>${U.rp(c.total)}</span></div>`;
    root.querySelector('#btn-promo').onclick = pickPromo;
    root.querySelector('#btn-disc').onclick = manualDiscount;
    root.querySelector('#btn-note').onclick = async () => {
      const v = await App.UI.prompt('Catatan pesanan', { value: cart.note || '' });
      if (v !== null) cart.note = v;
    };

    /* Siarkan ke Customer Display (jendela/tab lain) */
    if (App.Bridge) App.Bridge.send('cart', {
      items: cart.items.map(it => ({
        name: it.name, qty: it.qty, subtotal: P.lineTotal(it),
        opts: [...(it.variants || []).map(v => v.name), ...(it.modifiers || []).map(x => x.name)].join(' · ')
      })),
      subtotal: c.subtotal, discount: c.discount, promoName: c.promoName,
      svc: c.svc, tax: c.tax, total: c.total
    });

    root.querySelector('#cart-title').textContent = cart.no ? 'Pesanan ' + cart.no : 'Pesanan Baru';
    root.querySelector('#btn-pay').disabled = !cart.items.length;
    root.querySelector('#btn-hold').disabled = !cart.items.length;
    root.querySelector('#btn-kitchen').disabled = !cart.items.length;
  }

  /* ---------- dialog pendukung ---------- */
  function pickTable() {
    const tables = DB.where('tables', t => t.outletId === outlet.id);
    const areas = U.unique(tables.map(t => t.area));
    const m = App.UI.modal({ title:'Pilih Meja', size:'lg', body:
      areas.map(a => `<div class="mb-16"><div class="bold small mb-8">${U.esc(a)}</div>
        <div class="tmap">${tables.filter(t => t.area === a).map(t => `
          <div class="tbl-card ${t.status}" data-t="${t.id}">
            <div class="tbl-card__no">${U.esc(t.name)}</div>
            <div class="tbl-card__cap">${t.capacity} kursi</div>
            <div class="tbl-card__st">${({free:'Kosong',occupied:'Terisi',billed:'Minta Bill',reserved:'Reservasi'})[t.status]}</div>
          </div>`).join('')}</div></div>`).join('')
    });
    m.body.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const t = DB.find('tables', b.dataset.t);
      if (t.orderId && t.orderId !== cart.id) {
        m.close();
        App.UI.confirm(`Meja ${t.name} sudah memiliki pesanan berjalan. Buka pesanan tersebut?`).then(ok => {
          if (ok) App.Router.go('pos', { table: t.id });
        });
        return;
      }
      cart.tableId = t.id; cart.tableName = t.name; cart.type = 'dinein';
      m.close(); drawCart();
    });
  }
  function pickCustomer() {
    const list = U.sortBy(DB.all('customers'), c => c.name);
    const m = App.UI.modal({ title:'Pilih Pelanggan', size:'lg', body:`
      <div class="flex gap-8 mb-12">
        <div class="search" style="flex:1;max-width:none"><input class="input" id="cs-q" placeholder="Cari nama / nomor HP / kode member…"></div>
        <button class="btn btn--primary" id="cs-new">+ Member Baru</button>
        ${cart.customerId ? '<button class="btn" id="cs-clear">Lepas</button>' : ''}
      </div>
      <div id="cs-list" class="user-pick" style="max-height:400px"></div>`
    });
    const render = q => {
      const f = q ? list.filter(c => (c.name + c.phone + c.code).toLowerCase().includes(q.toLowerCase())) : list.slice(0, 40);
      m.body.querySelector('#cs-list').innerHTML = f.map(c => {
        const t = DB.find('tiers', c.tierId) || {};
        return `<button data-c="${c.id}">
          <span class="avatar-sm">${U.initials(c.name)}</span>
          <span style="flex:1"><b>${U.esc(c.name)}</b><small>${U.esc(c.phone)} · ${U.esc(c.code)}</small></span>
          <span class="badge" style="background:${t.color}20;color:${t.color}">${U.esc(t.name || '')}</span>
          <span class="small muted">${U.num(c.points || 0)} poin</span>
        </button>`;
      }).join('') || App.UI.emptyState('Tidak ditemukan','Buat member baru','🔍');
      m.body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
        cart.customerId = b.dataset.c; m.close(); drawCart();
        App.UI.toast('Pelanggan: ' + DB.find('customers', b.dataset.c).name);
      });
    };
    m.body.querySelector('#cs-q').oninput = U.debounce(e => render(e.target.value), 180);
    m.body.querySelector('#cs-new').onclick = () => { m.close(); App.CRM.customerForm(null, c => { cart.customerId = c.id; drawCart(); }); };
    const cl = m.body.querySelector('#cs-clear');
    if (cl) cl.onclick = () => { cart.customerId = null; m.close(); drawCart(); };
    render('');
  }
  function pickChannel() {
    const ch = DB.settings().channels.filter(c => c.key !== 'kasir');
    const m = App.UI.modal({ title:'Kanal Penjualan', body:`<div class="user-pick">
      ${ch.map(c => `<button data-c="${c.key}"><span class="thumb">${c.icon}</span>
        <span style="flex:1"><b>${U.esc(c.label)}</b><small>Komisi platform ${c.commission}%</small></span></button>`).join('')}</div>` });
    m.body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cart.channel = b.dataset.c; m.close(); drawCart(); });
  }
  function pickWaiter() {
    const emps = DB.where('employees', e => e.outletId === outlet.id && e.status === 'aktif');
    const m = App.UI.modal({ title:'Pramusaji / Penanggung Jawab', subtitle:'Untuk perhitungan komisi', body:`
      <div class="user-pick">${emps.map(e => `<button data-e="${e.id}"><span class="avatar-sm">${U.initials(e.name)}</span>
        <span style="flex:1"><b>${U.esc(e.name)}</b><small>${U.esc(e.position)} · komisi ${e.commissionRate}%</small></span></button>`).join('')}
        <button data-e="">— Tanpa pramusaji —</button></div>` });
    m.body.querySelectorAll('[data-e]').forEach(b => b.onclick = () => { cart.waiterId = b.dataset.e || null; m.close(); drawCart(); });
  }
  function pickPromo() {
    const subtotal = U.sum(cart.items, P.lineTotal);
    const list = P.activePromos(outlet.id);
    const m = App.UI.modal({ title:'Promo Tersedia', size:'lg', body:`
      <div class="user-pick" style="max-height:420px">
        ${list.map(p => {
          const val = P.promoDiscount(p, cart, subtotal);
          return `<button data-p="${p.id}" ${val ? '' : 'style="opacity:.5"'}>
            <span class="thumb">🎁</span>
            <span style="flex:1"><b>${U.esc(p.name)}</b><small>${U.esc(p.description || '')}</small></span>
            <span class="bold" style="color:${val ? 'var(--brand-600)' : 'var(--text-3)'}">${val ? '−' + U.rp(val) : 'Tidak berlaku'}</span>
          </button>`;
        }).join('') || App.UI.emptyState('Tidak ada promo aktif','','🎁')}
        ${cart.promoId ? '<button data-p="">— Lepas promo —</button>' : ''}
      </div>` });
    m.body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { cart.promoId = b.dataset.p || null; m.close(); drawCart(); });
  }
  async function manualDiscount() {
    if (!App.Auth.can('pos.discount')) {
      const auth = await App.UI.authorize('Diskon manual pada transaksi', 'pos.discount');
      if (!auth) return;
    }
    App.UI.formModal({
      title:'Diskon Manual', fields:[
        { name:'pct', label:'Diskon persen (%)', type:'number', value:cart.discountManualPct || '', step:'0.5' },
        { name:'amt', label:'Diskon nominal (Rp)', type:'money', value:cart.discountManual || '' }
      ],
      onSubmit(d) {
        cart.discountManualPct = d.pct || 0;
        cart.discountManual = d.amt || 0;
        drawCart();
        DB.log('pos.discount', `Diskon manual ${d.pct || 0}% / ${U.rp(d.amt || 0)}`);
      }
    });
  }

  /* ---------- pembayaran ---------- */
  function payDialog() {
    const c = P.calc(cart, outlet);
    const methods = DB.settings().paymentMethods.filter(m => m.active);
    const cust = cart.customerId ? DB.find('customers', cart.customerId) : null;
    let payments = [];
    let method = 'cash';
    let entry = '';

    const m = App.UI.modal({
      title:'Pembayaran', subtitle:`Total ${U.rp(c.total)}`, size:'lg', closeOnBackdrop:false,
      body:`<div class="form-row c2" style="grid-template-columns:1.1fr 1fr">
        <div>
          <div class="pay-methods mb-12" id="pm"></div>
          <div class="field"><label>Jumlah dibayar</label>
            <input class="input input--num" id="pay-amt" style="font-size:22px;font-weight:800;padding:12px" readonly value="0"></div>
          <div class="quick-cash mb-12" id="qc"></div>
          <div class="numpad" id="np"></div>
        </div>
        <div>
          <div class="card" style="background:var(--surface-2)">
            <div class="card__body">
              <div class="kv"><span class="k">Subtotal</span><span class="v">${U.rp(c.subtotal)}</span></div>
              ${c.discount ? `<div class="kv"><span class="k">Diskon</span><span class="v">−${U.rp(c.discount)}</span></div>` : ''}
              ${c.svc ? `<div class="kv"><span class="k">Service</span><span class="v">${U.rp(c.svc)}</span></div>` : ''}
              ${c.tax ? `<div class="kv"><span class="k">Pajak</span><span class="v">${U.rp(c.tax)}</span></div>` : ''}
              <div class="divider"></div>
              <div class="kv" style="font-size:16px"><span class="k bold">TOTAL</span><span class="v" style="color:var(--brand-600);font-size:18px">${U.rp(c.total)}</span></div>
            </div>
          </div>
          <div class="mt-12" id="pay-lines"></div>
          <div class="card mt-12"><div class="card__body">
            <div class="kv"><span class="k">Terbayar</span><span class="v" id="paid-sum">Rp 0</span></div>
            <div class="kv"><span class="k">Sisa</span><span class="v" id="rest-sum" style="color:var(--rose)">${U.rp(c.total)}</span></div>
            <div class="kv"><span class="k">Kembalian</span><span class="v" id="change-sum">Rp 0</span></div>
          </div></div>
          ${cust ? `<div class="small muted mt-8">Member: ${U.esc(cust.name)} · deposit ${U.rp(cust.deposit || 0)} · poin ${U.num(cust.points || 0)}</div>` : ''}
        </div>
      </div>`,
      footer:`<label class="check" style="margin-right:auto"><input type="checkbox" id="pay-print" checked> <span>Cetak struk</span></label>
              <button class="btn" data-no>Batal</button>
              <button class="btn btn--primary btn--lg" data-yes>✔ Selesaikan (Enter)</button>`
    });

    const amtEl = m.body.querySelector('#pay-amt');
    const paidSum = () => U.sum(payments, p => p.amount);

    function drawMethods() {
      m.body.querySelector('#pm').innerHTML = methods.map(x =>
        `<button class="pay-m ${method === x.key ? 'is-active' : ''}" data-m="${x.key}"
          ${x.key === 'deposit' && (!cust || !cust.deposit) ? 'disabled style="opacity:.4"' : ''}>
          <span class="ic">${x.icon}</span>${U.esc(x.label)}</button>`).join('');
      m.body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
        method = b.dataset.m; drawMethods();
        if (method !== 'cash') { entry = String(Math.max(0, c.total - paidSum())); amtEl.value = U.num(entry); }
      });
    }
    function drawQuick() {
      const qc = DB.settings().pos.quickCash || [];
      const rest = Math.max(0, c.total - paidSum());
      m.body.querySelector('#qc').innerHTML =
        `<button data-q="${rest}">PAS</button>` +
        qc.filter(v => v >= rest).slice(0, 3).map(v => `<button data-q="${v}">${U.compact(v)}</button>`).join('') +
        [Math.ceil(rest / 50000) * 50000, Math.ceil(rest / 100000) * 100000]
          .filter((v, i, a) => v > rest && a.indexOf(v) === i).slice(0, 2)
          .map(v => `<button data-q="${v}">${U.compact(v)}</button>`).join('');
      m.body.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { entry = b.dataset.q; amtEl.value = U.num(entry); addPayment(); });
    }
    function drawNumpad() {
      m.body.querySelector('#np').innerHTML =
        ['1','2','3','4','5','6','7','8','9','000','0','⌫'].map(k => `<button data-k="${k}">${k}</button>`).join('');
      m.body.querySelectorAll('#np [data-k]').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        if (k === '⌫') entry = entry.slice(0, -1);
        else entry = (entry === '0' ? '' : entry) + k;
        amtEl.value = U.num(Number(entry) || 0);
      });
    }
    function drawLines() {
      m.body.querySelector('#pay-lines').innerHTML = payments.map((p, i) => `
        <div class="pay-line"><span>${U.esc(P.labelOfMethod(p.method))}</span>
          <b class="num" style="margin-left:auto">${U.rp(p.amount)}</b>
          <button class="citem__x" data-rm="${i}">✕</button></div>`).join('');
      m.body.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { payments.splice(+b.dataset.rm, 1); refresh(); });
    }
    function refresh() {
      const paid = paidSum();
      const rest = c.total - paid;
      m.body.querySelector('#paid-sum').textContent = U.rp(paid);
      m.body.querySelector('#rest-sum').textContent = U.rp(Math.max(0, rest));
      m.body.querySelector('#rest-sum').style.color = rest > 0 ? 'var(--rose)' : 'var(--lime)';
      m.body.querySelector('#change-sum').textContent = U.rp(Math.max(0, -rest));
      drawLines(); drawQuick();
    }
    function addPayment() {
      const amt = Number(entry) || 0;
      if (amt <= 0) return;
      if (method === 'deposit' && cust && amt > (cust.deposit || 0)) { App.UI.toast('Deposit member tidak mencukupi', 'warn'); return; }
      const mdrRate = (DB.settings().pos.mdrRates || {})[method] || 0;
      payments.push({ method, amount: Math.min(amt, method === 'cash' ? amt : Math.max(0, c.total - paidSum())),
        mdr: Math.round(Math.min(amt, c.total) * mdrRate / 100), ref: method === 'cash' ? '' : 'TRX' + U.randInt(100000, 999999) });
      entry = ''; amtEl.value = '0';
      refresh();
    }
    m.body.querySelector('#pay-amt').onclick = addPayment;
    drawMethods(); drawNumpad(); refresh();

    let submitting = false;
    const done = () => {
      if (submitting) return;
      if (!entry && !payments.length) { App.UI.toast('Masukkan jumlah pembayaran', 'warn'); return; }
      if (entry) addPayment();
      const paid = paidSum();
      if (paid < c.total) { App.UI.toast('Pembayaran kurang ' + U.rp(c.total - paid), 'warn'); return; }
      const change = paid - c.total;
      /* kembalian hanya dari tunai */
      const cash = U.sum(payments.filter(p => p.method === 'cash'), p => p.amount);
      const finalPayments = payments.map(p => p.method === 'cash'
        ? { ...p, amount: Math.max(0, p.amount - change) } : p);
      submitting = true;
      const doPrint = m.el.querySelector('#pay-print').checked;
      const order = P.finalize(cart, finalPayments.filter(p => p.amount > 0), { change, cashReceived: cash });
      if (App.Bridge) App.Bridge.send('paid', { no: order.no, total: order.total });
      m.close();
      P.clearCart();
      successDialog(order, change, doPrint);
    };
    m.el.querySelector('[data-yes]').onclick = done;
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); done(); }
      if (/^\d$/.test(e.key)) { entry = (entry === '0' ? '' : entry) + e.key; amtEl.value = U.num(Number(entry)); }
      if (e.key === 'Backspace') { entry = entry.slice(0, -1); amtEl.value = U.num(Number(entry) || 0); }
      if (e.key === '+') addPayment();
    });
  }

  function successDialog(order, change, doPrint) {
    if (doPrint) App.UI.print(P.receiptHTML(order));
    const cust = order.customerId ? DB.find('customers', order.customerId) : null;
    const m = App.UI.modal({
      title:'Transaksi Berhasil ✅', subtitle: order.no,
      body:`<div class="center" style="padding:6px 0 14px">
        <div style="font-size:40px">🎉</div>
        <div style="font-size:13px;color:var(--text-3);margin-top:6px">Total dibayar</div>
        <div style="font-size:26px;font-weight:800">${U.rp(order.total)}</div>
        ${change ? `<div style="margin-top:8px;font-size:15px">Kembalian: <b style="color:var(--brand-600)">${U.rp(change)}</b></div>` : ''}
        ${cust ? `<div class="small muted mt-8">Poin ${U.esc(cust.name)}: ${U.num(cust.points)} · Stamp ${cust.stamps}/10</div>` : ''}
      </div>
      <div class="grid g3 gap-8">
        <button class="btn" data-a="print">🖨️ Cetak Ulang</button>
        <button class="btn" data-a="wa">💬 Kirim WhatsApp</button>
        <button class="btn" data-a="email">✉️ Kirim Email</button>
      </div>`,
      footer:`<button class="btn btn--primary btn--block" data-yes>Transaksi Baru (Enter)</button>`
    });
    m.el.querySelector('[data-yes]').onclick = () => { m.close(); App.Router.reload(); };
    m.body.querySelector('[data-a="print"]').onclick = () => App.UI.print(P.receiptHTML(order, { reprint:true }));
    m.body.querySelector('[data-a="wa"]').onclick = () => {
      if (!cust || !cust.phone) return App.UI.toast('Pelanggan tidak memiliki nomor WhatsApp', 'warn');
      App.UI.toast('Struk digital dikirim ke WhatsApp ' + cust.phone, 'ok');
      DB.log('receipt.wa', `Struk ${order.no} dikirim ke ${cust.phone}`);
    };
    m.body.querySelector('[data-a="email"]').onclick = () => {
      if (!cust || !cust.email) return App.UI.toast('Pelanggan tidak memiliki email', 'warn');
      App.UI.toast('Struk digital dikirim ke ' + cust.email, 'ok');
    };
    setTimeout(() => m.el.querySelector('[data-yes]').focus(), 60);
  }

  /* ---------- aksi bar ---------- */
  root.querySelector('#pos-search').oninput = U.debounce(e => { search = e.target.value; drawGrid(); }, 160);
  root.querySelector('#pos-search').onkeydown = e => {
    if (e.key === 'Enter') {
      const p = allProducts.find(x => x.barcode === e.target.value.trim());
      if (p) { addProduct(p.id); e.target.value = ''; search = ''; drawGrid(); }
    }
  };
  root.querySelector('#btn-tables').onclick = () => App.Router.go('tables');
  root.querySelector('#btn-orders').onclick = () => App.Router.go('orders');
  root.querySelector('#btn-kds').onclick = () => App.Router.go('kds');
  root.querySelector('#btn-close-shift').onclick = () => App.Views.closeShiftDialog();
  root.querySelector('#btn-clear').onclick = async () => {
    if (!cart.items.length) return;
    if (await App.UI.confirm('Kosongkan keranjang? Item yang belum disimpan akan hilang.', { danger:true, okText:'Kosongkan' })) {
      P.clearCart(); App.Router.reload();
    }
  };
  root.querySelector('#btn-pay').onclick = payDialog;
  root.querySelector('#btn-hold').onclick = () => {
    const o = P.saveOpen(cart);
    App.UI.toast('Pesanan ' + o.no + ' disimpan', 'ok');
    P.clearCart(); App.Router.reload();
  };
  root.querySelector('#btn-kitchen').onclick = () => {
    const o = P.saveOpen(cart);
    DB.update('orders', o.id, { kitchenStatus:'cooking' });
    o.items.forEach(it => it.kdsStatus = 'cooking');
    DB.update('orders', o.id, { items:o.items });
    App.UI.toast('Pesanan dikirim ke dapur & bar 👨‍🍳', 'ok');
    P.clearCart(); App.Router.reload();
  };

  document.addEventListener('keydown', function h(e) {
    if (!document.body.contains(root)) { document.removeEventListener('keydown', h); return; }
    if (e.key === 'F1') { e.preventDefault(); root.querySelector('#pos-search').focus(); }
    if (e.key === 'F9' && cart.items.length) { e.preventDefault(); payDialog(); }
  });

  drawCats(); drawGrid(); drawCart();
};
