/* =============================================================
   SajiPOS — Mesin Inventori
   Stok per outlet, resep (BOM) berjenjang, COGS rata-rata bergerak,
   multi satuan, mutasi antar cabang, opname & produksi.
   ============================================================= */
window.App = window.App || {};

App.Inv = (function () {
  const U = App.U;

  /* ---------- stok ---------- */
  function rec(outletId, productId, create = false) {
    let s = App.DB.first('stock', x => x.outletId === outletId && x.productId === productId);
    if (!s && create) s = App.DB.insert('stock', { outletId, productId, qty: 0, avgCost: 0, reserved: 0 });
    return s;
  }
  function qty(outletId, productId) { const s = rec(outletId, productId); return s ? s.qty : 0; }
  function avgCost(outletId, productId) {
    const s = rec(outletId, productId);
    if (s && s.avgCost) return s.avgCost;
    const p = App.DB.find('products', productId);
    return p ? (p.cost || 0) : 0;
  }
  function totalQty(productId) { return U.sum(App.DB.where('stock', s => s.productId === productId), s => s.qty); }
  function stockValue(outletId) {
    return U.sum(App.DB.where('stock', s => !outletId || outletId === 'ALL' || s.outletId === outletId),
      s => s.qty * (s.avgCost || 0));
  }

  /* konversi satuan → satuan dasar */
  function toBase(product, q, unitName) {
    if (!unitName || !product || !product.units) return q;
    const u = product.units.find(x => x.name === unitName);
    return u ? q * (u.factor || 1) : q;
  }
  function unitLabel(product) { return product ? (product.unit || 'pcs') : 'pcs'; }

  /* ---------- pergerakan stok ---------- */
  /* delta positif = masuk. unitCost dipakai untuk rata-rata bergerak saat masuk. */
  function move({ outletId, productId, delta, unitCost = null, type = 'adjust', ref = '', note = '', postJournal = false, date = null }) {
    const p = App.DB.find('products', productId);
    if (!p || p.trackStock === false) return null;
    const s = rec(outletId, productId, true);
    const before = s.qty;
    let cost = s.avgCost || p.cost || 0;

    if (delta > 0 && unitCost !== null && unitCost !== undefined) {
      const totalVal = before * cost + delta * unitCost;
      const totalQ = before + delta;
      cost = totalQ > 0 ? U.round4(totalVal / totalQ) : unitCost;
    }
    const after = U.round4(before + delta);
    App.DB.update('stock', s.id, { qty: after, avgCost: cost });

    const row = {
      date: date || U.now(), outletId, productId, type,
      qty: U.round4(delta), unitCost: unitCost !== null ? unitCost : cost,
      value: U.round2(delta * (unitCost !== null ? unitCost : cost)),
      before, after
    };
    if (ref) row.ref = ref;
    if (note) row.note = note;
    if (App.Auth.user()) row.userId = App.Auth.user().id;
    const mv = App.DB.insert('stockMoves', row);
    if (postJournal) App.Ledger.postInventoryAdj(mv, mv.value);
    checkLowStock(outletId, productId);
    return mv;
  }

  function checkLowStock(outletId, productId) {
    const p = App.DB.find('products', productId);
    if (!p || !p.minStock) return;
    const q = qty(outletId, productId);
    if (q <= p.minStock) {
      const exists = App.DB.first('notifications', n =>
        n.type === 'lowstock' && n.productId === productId && n.outletId === outletId && !n.read);
      if (!exists) {
        App.DB.insert('notifications', {
          type: 'lowstock', title: 'Stok menipis',
          message: `${p.name} tersisa ${U.num(q, 1)} ${p.unit} (min ${U.num(p.minStock, 1)})`,
          productId, outletId, read: false, at: U.now(), level: q <= 0 ? 'danger' : 'warn'
        });
      }
    }
  }
  function lowStockList(outletId) {
    return App.DB.all('products')
      .filter(p => p.trackStock !== false && p.minStock > 0)
      .map(p => ({ product: p, qty: qty(outletId, p.id), min: p.minStock }))
      .filter(r => r.qty <= r.min)
      .sort((a, b) => (a.qty / (a.min || 1)) - (b.qty / (b.min || 1)));
  }

  /* ---------- resep / BOM ---------- */
  /* Kembalikan daftar bahan dasar untuk 1 unit produk (rekursif, maks 4 level) */
  function explode(productId, multiplier = 1, depth = 0, acc = {}) {
    const p = App.DB.find('products', productId);
    if (!p || depth > 4) return acc;
    if (!p.recipe || !p.recipe.length) {
      acc[productId] = (acc[productId] || 0) + multiplier;
      return acc;
    }
    p.recipe.forEach(r => {
      const child = App.DB.find('products', r.materialId);
      const q = toBase(child, r.qty, r.unit) * multiplier;
      if (child && child.recipe && child.recipe.length) explode(child.id, q, depth + 1, acc);
      else acc[r.materialId] = (acc[r.materialId] || 0) + q;
    });
    return acc;
  }

  /* Biaya pokok satu produk berdasar resep + harga rata-rata bahan */
  function recipeCost(productId, outletId) {
    const oid = outletId || App.State.outletId();
    const p = App.DB.find('products', productId);
    if (!p) return 0;
    if (!p.recipe || !p.recipe.length) return avgCost(oid, productId) || p.cost || 0;
    return U.round2(U.sum(p.recipe, r => {
      const child = App.DB.find('products', r.materialId);
      const q = toBase(child, r.qty, r.unit);
      const c = (child && child.recipe && child.recipe.length) ? recipeCost(r.materialId, oid) : (avgCost(oid, r.materialId) || (child ? child.cost : 0) || 0);
      return q * c;
    }));
  }
  function margin(product, outletId) {
    const cost = recipeCost(product.id, outletId);
    const price = product.price || 0;
    return { cost, price, profit: price - cost, pct: price ? ((price - cost) / price) * 100 : 0 };
  }

  /* Ketersediaan produk berdasarkan bahan baku (untuk badge HABIS di kasir) */
  function available(productId, outletId) {
    const p = App.DB.find('products', productId);
    if (!p) return 0;
    if (!p.recipe || !p.recipe.length) {
      return p.trackStock === false ? Infinity : qty(outletId, productId);
    }
    let min = Infinity;
    const need = explode(productId, 1);
    Object.entries(need).forEach(([mid, q]) => {
      const m = App.DB.find('products', mid);
      if (!m || m.trackStock === false || !q) return;
      min = Math.min(min, Math.floor(qty(outletId, mid) / q));
    });
    return min === Infinity ? Infinity : Math.max(0, min);
  }

  /* ---------- konsumsi saat penjualan ---------- */
  function consumeForOrder(order) {
    let cogs = 0;
    (order.items || []).forEach(it => {
      const p = App.DB.find('products', it.productId);
      if (!p) return;
      if (p.recipe && p.recipe.length) {
        const need = explode(p.id, it.qty);
        Object.entries(need).forEach(([mid, q]) => {
          const m = App.DB.find('products', mid);
          if (!m || m.trackStock === false) return;
          const c = avgCost(order.outletId, mid);
          cogs += q * c;
          move({ outletId: order.outletId, productId: mid, delta: -q, type: 'sale',
                 ref: order.no, note: `Terjual: ${p.name} ×${it.qty}`, date: order.paidAt || U.now() });
        });
      } else if (p.trackStock !== false) {
        const c = avgCost(order.outletId, p.id);
        cogs += it.qty * c;
        move({ outletId: order.outletId, productId: p.id, delta: -it.qty, type: 'sale',
               ref: order.no, note: 'Penjualan', date: order.paidAt || U.now() });
      } else {
        cogs += (p.cost || 0) * it.qty;
      }
      /* bahan tambahan dari modifier/extra */
      (it.modifiers || []).forEach(mo => {
        if (!mo.materialId) return;
        const m = App.DB.find('products', mo.materialId);
        if (!m || m.trackStock === false) return;
        const q = (mo.qty || 1) * it.qty;
        cogs += q * avgCost(order.outletId, mo.materialId);
        move({ outletId: order.outletId, productId: mo.materialId, delta: -q, type: 'sale',
               ref: order.no, note: 'Extra: ' + mo.name, date: order.paidAt || U.now() });
      });
    });
    return U.round2(cogs);
  }
  function restoreForOrder(order) {
    let value = 0;
    (order.items || []).forEach(it => {
      const p = App.DB.find('products', it.productId);
      if (!p) return;
      const need = (p.recipe && p.recipe.length) ? explode(p.id, it.qty) : { [p.id]: it.qty };
      Object.entries(need).forEach(([mid, q]) => {
        const m = App.DB.find('products', mid);
        if (!m || m.trackStock === false) return;
        value += q * avgCost(order.outletId, mid);
        move({ outletId: order.outletId, productId: mid, delta: q, type: 'return',
               ref: order.no, note: 'Pengembalian stok (void/refund)' });
      });
    });
    return U.round2(value);
  }

  /* ---------- operasi gudang ---------- */
  function receive(outletId, items, ref, note) {
    items.forEach(i => move({
      outletId, productId: i.productId, delta: i.qty, unitCost: i.price,
      type: 'in', ref, note: note || 'Penerimaan barang'
    }));
  }
  function waste(outletId, productId, q, note) {
    const mv = move({ outletId, productId, delta: -Math.abs(q), type: 'waste', note: note || 'Stok terbuang' });
    if (mv) App.Ledger.postInventoryAdj(mv, mv.value);
    return mv;
  }
  function opname(outletId, productId, actualQty, note) {
    const cur = qty(outletId, productId);
    const delta = U.round4(actualQty - cur);
    if (!delta) return null;
    const mv = move({ outletId, productId, delta, type: 'opname',
      note: note || `Opname: sistem ${U.num(cur, 2)} → fisik ${U.num(actualQty, 2)}` });
    if (mv) App.Ledger.postInventoryAdj(mv, mv.value);
    return mv;
  }
  function transfer(fromOutlet, toOutlet, productId, q, note) {
    const c = avgCost(fromOutlet, productId);
    move({ outletId: fromOutlet, productId, delta: -Math.abs(q), type: 'transfer',
           note: `Kirim ke ${outletName(toOutlet)}. ${note || ''}` });
    move({ outletId: toOutlet, productId, delta: Math.abs(q), unitCost: c, type: 'transfer',
           note: `Terima dari ${outletName(fromOutlet)}. ${note || ''}` });
    /* Nilai persediaan total tidak berubah → tidak ada jurnal, hanya mutasi. */
    return true;
  }
  function produce(outletId, productId, q, note) {
    const p = App.DB.find('products', productId);
    if (!p) return null;
    let cost = 0;
    (p.recipe || []).forEach(r => {
      const child = App.DB.find('products', r.materialId);
      const need = toBase(child, r.qty, r.unit) * q;
      cost += need * avgCost(outletId, r.materialId);
      move({ outletId, productId: r.materialId, delta: -need, type: 'production',
             note: `Produksi ${p.name} ×${q}` });
    });
    const unitCost = q ? U.round2(cost / q) : 0;
    move({ outletId, productId, delta: q, unitCost, type: 'production', note: note || `Hasil produksi ×${q}` });
    return { qty: q, unitCost, totalCost: cost };
  }
  function outletName(id) { const o = App.DB.find('outlets', id); return o ? o.name : '—'; }

  /* ---------- analitik ---------- */
  function movementSummary(outletId, from, to) {
    const mvs = App.DB.all('stockMoves').filter(m =>
      (!outletId || outletId === 'ALL' || m.outletId === outletId) &&
      U.ymd(m.date) >= from && U.ymd(m.date) <= to);
    const g = U.groupBy(mvs, m => m.productId);
    return Object.entries(g).map(([pid, list]) => {
      const p = App.DB.find('products', pid) || { name: '(dihapus)', unit: '' };
      const masuk = U.sum(list.filter(m => m.qty > 0), m => m.qty);
      const keluar = -U.sum(list.filter(m => m.qty < 0), m => m.qty);
      const terjual = -U.sum(list.filter(m => m.type === 'sale'), m => m.qty);
      const terbuang = -U.sum(list.filter(m => m.type === 'waste'), m => m.qty);
      const awal = list.length ? list[0].before : 0;
      const akhir = list.length ? list[list.length - 1].after : 0;
      return { productId: pid, nama: p.name, sku: p.sku, satuan: p.unit, jenis: p.type,
               awal, masuk, keluar, terjual, terbuang, akhir,
               nilai: akhir * avgCost(outletId === 'ALL' ? App.State.outletId() : outletId, pid) };
    }).sort((a, b) => b.terjual - a.terjual);
  }

  return {
    rec, qty, avgCost, totalQty, stockValue, toBase, unitLabel,
    move, checkLowStock, lowStockList, explode, recipeCost, margin, available,
    consumeForOrder, restoreForOrder, receive, waste, opname, transfer, produce, movementSummary
  };
})();
