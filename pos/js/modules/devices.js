/* =============================================================
   SajiPOS — Perangkat pendamping
   Self Order (E-Menu QR), Customer Display, Order Display,
   cetak QR meja & label produk.
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

/* Saluran antar-tab: kasir menyiarkan keranjang, customer display menyimak. */
App.Bridge = (function () {
  const KEY = 'sajipos.bridge';
  function send(type, payload) {
    try { localStorage.setItem(KEY, JSON.stringify({ type, payload, at: Date.now() })); } catch (e) {}
  }
  function listen(fn) {
    const handler = e => {
      if (e.key !== KEY || !e.newValue) return;
      try { const m = JSON.parse(e.newValue); fn(m.type, m.payload); } catch (err) {}
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }
  function last() {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
  }
  return { send, listen, last };
})();

/* =============================================================
   Self Order — tampilan pelanggan (scan QR di meja)
   ============================================================= */
App.Views.selforder = function (root, params) {
  const U = App.U, DB = App.DB;
  const outletId = params.o || App.State.outletId();
  const outlet = DB.find('outlets', outletId) || App.State.outlet();
  const table = params.t ? DB.find('tables', params.t) : null;
  const cats = DB.all('categories').filter(c => !c.isMaterial);
  const products = DB.all('products').filter(p => p.type === 'product' && p.active !== false);

  let cat = 'all';
  let cart = [];
  let orderType = table ? 'dinein' : 'takeaway';
  let placed = null;

  root.innerHTML = `<div class="device"><div class="device__body"><div class="so" id="so"></div></div></div>`;
  const so = root.querySelector('#so');

  function total() { return U.sum(cart, i => i.price * i.qty); }

  function draw() {
    if (placed) return drawDone();
    so.innerHTML = `
      <div class="so__hero">
        <div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#a9dbd1">Pesan Sendiri</div>
        <h2>${U.esc(DB.settings().receipt.header || outlet.name)}</h2>
        <p>${U.esc(outlet.name)} · buka ${U.esc(outlet.openHour)}–${U.esc(outlet.closeHour)}</p>
        <div class="so__meja">${table ? '🪑 Meja ' + U.esc(table.name) : '🥡 Bungkus / Bawa Pulang'}</div>
      </div>
      <div class="so__cats" id="so-cats"></div>
      <div class="so__list" id="so-list"></div>
      <div class="so__bar">
        <div>
          <div class="small muted">${U.sum(cart, i => i.qty)} item</div>
          <div style="font-weight:800;font-size:16px">${U.rp(total())}</div>
        </div>
        <button class="so__cartbtn" id="so-checkout" ${cart.length ? '' : 'disabled'}>
          <span>Lihat Pesanan</span><span class="so-badge">${U.sum(cart, i => i.qty)}</span>
        </button>
      </div>`;

    so.querySelector('#so-cats').innerHTML =
      `<button class="pill ${cat === 'all' ? 'is-active' : ''}" data-c="all">Semua</button>` +
      cats.map(c => `<button class="pill ${cat === c.id ? 'is-active' : ''}" data-c="${c.id}">${c.icon} ${U.esc(c.name)}</button>`).join('');
    so.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });

    const list = cat === 'all' ? products : products.filter(p => p.categoryId === cat);
    so.querySelector('#so-list').innerHTML = list.map(p => {
      const avail = App.Inv.available(p.id, outletId);
      const habis = avail !== Infinity && avail <= 0;
      const inCart = U.sum(cart.filter(i => i.productId === p.id), i => i.qty);
      return `<div class="so-item ${habis ? 'habis' : ''}">
        <div class="so-item__img">${p.emoji || '🍽️'}</div>
        <div class="so-item__main">
          <div class="so-item__name">${U.esc(p.name)}${p.bestSeller ? ' <span class="badge badge--amber">Best</span>' : ''}</div>
          <div class="so-item__desc">${habis ? 'Stok habis' : U.esc((DB.find('categories', p.categoryId) || {}).name || '')}</div>
          <div class="so-item__price">${U.rp(p.price)}</div>
        </div>
        ${inCart ? `<div class="flex items-center gap-6">
            <button class="qty-btn" data-dec="${p.id}">−</button>
            <b style="min-width:18px;text-align:center">${inCart}</b>
            <button class="qty-btn" data-inc="${p.id}">+</button></div>`
          : `<button class="so-item__add" data-add="${p.id}" ${habis ? 'disabled' : ''}>+</button>`}
      </div>`;
    }).join('') || App.UI.emptyState('Menu belum tersedia', '', '🍽️');

    so.querySelectorAll('[data-add],[data-inc]').forEach(b => b.onclick = () => {
      const pid = b.dataset.add || b.dataset.inc;
      const p = DB.find('products', pid);
      const found = cart.find(i => i.productId === pid);
      if (found) found.qty++;
      else cart.push({ productId: pid, name: p.name, qty: 1, price: p.price, note: '' });
      draw();
    });
    so.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
      const i = cart.findIndex(x => x.productId === b.dataset.dec);
      if (i < 0) return;
      cart[i].qty--; if (cart[i].qty <= 0) cart.splice(i, 1);
      draw();
    });
    so.querySelector('#so-checkout').onclick = review;
  }

  function review() {
    const m = App.UI.modal({
      title: 'Konfirmasi Pesanan', subtitle: table ? 'Meja ' + table.name : 'Bungkus',
      body: `
        ${cart.map((i, idx) => `<div class="list-row">
          <div style="flex:1"><b>${U.esc(i.name)}</b>
            <div class="small muted">${U.rp(i.price)} × ${i.qty}</div>
            ${i.note ? `<div class="small" style="color:var(--amber)">📝 ${U.esc(i.note)}</div>` : ''}</div>
          <b class="num">${U.rp(i.price * i.qty)}</b>
          <button class="btn btn--sm" data-n="${idx}">📝</button>
        </div>`).join('')}
        <div class="divider"></div>
        ${!table ? `<div class="field"><label>Jenis pesanan</label>
          <select class="select" id="so-type">
            <option value="takeaway">Bungkus / bawa pulang</option>
            <option value="dinein">Makan di tempat</option>
          </select></div>` : ''}
        <div class="field"><label>Nama pemesan (opsional)</label>
          <input class="input" id="so-name" placeholder="mis. Rina"></div>
        <div class="field"><label>Nomor HP untuk notifikasi (opsional)</label>
          <input class="input" id="so-phone" inputmode="tel" placeholder="08xx"></div>
        <div class="kv" style="font-size:16px"><span class="k bold">Total</span>
          <span class="v" style="color:var(--brand-600)">${U.rp(total())}</span></div>
        <p class="small muted mt-8">Pembayaran dilakukan di kasir. Pesanan langsung diteruskan ke dapur.</p>`,
      footer: `<button class="btn" data-no>Tambah Menu Lagi</button>
               <button class="btn btn--primary" data-yes>Kirim Pesanan</button>`
    });
    m.body.querySelectorAll('[data-n]').forEach(b => b.onclick = async () => {
      const it = cart[+b.dataset.n];
      const v = await App.UI.prompt('Catatan untuk ' + it.name, { value: it.note });
      if (v !== null) { it.note = v; m.close(); review(); }
    });
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const typeSel = m.body.querySelector('#so-type');
      if (typeSel) orderType = typeSel.value;
      submit(m.body.querySelector('#so-name').value.trim(), m.body.querySelector('#so-phone').value.trim());
      m.close();
    };
  }

  function submit(name, phone) {
    const seq = DB.where('orders', o => o.outletId === outletId && U.ymd(o.date) === U.today()).length + 1;
    const items = cart.map(i => {
      const p = DB.find('products', i.productId);
      return { productId: i.productId, name: i.name, qty: i.qty, price: i.price,
        subtotal: i.price * i.qty, note: i.note, station: p.station, kdsStatus: 'new', modifiers: [] };
    });
    const subtotal = U.sum(items, i => i.subtotal);
    const svc = orderType === 'dinein' ? Math.round(subtotal * (outlet.serviceCharge || 0) / 100) : 0;
    const tax = Math.round((subtotal + svc) * (outlet.taxRate || 0) / 100);
    const raw = subtotal + svc + tax;
    const step = outlet.rounding || 1;
    const grand = Math.round(raw / step) * step;

    const order = DB.insert('orders', {
      no: `${outlet.code}/${U.today().replace(/-/g, '').slice(2)}/${String(seq).padStart(4, '0')}`,
      date: U.now(), createdAt: U.now(), outletId, type: orderType, channel: 'emenu',
      tableId: table ? table.id : null, tableName: table ? table.name : null,
      customerName: name || null, guestCount: 1, items,
      subtotal, discount: 0, tax, serviceCharge: svc, roundingAdj: grand - raw, total: grand,
      cogs: 0, commission: 0, payments: [], change: 0,
      status: 'open', cashierId: null, shiftId: null, kitchenStatus: 'new',
      notes: phone ? 'HP: ' + phone : '', selfOrder: true
    });
    if (table) DB.update('tables', table.id, { status: 'occupied', orderId: order.id, openedAt: U.now() });
    DB.insert('notifications', {
      type: 'order', title: 'Pesanan self-order masuk', level: 'info', read: false, at: U.now(),
      outletId, message: `${order.no}${table ? ' · Meja ' + table.name : ''} — ${items.length} item, ${U.rp(grand)}`
    });
    DB.log('selforder', `Pesanan mandiri ${order.no} dari ${table ? 'meja ' + table.name : 'e-menu'}`);
    DB.saveNow();
    App.Bridge.send('neworder', { no: order.no, outletId });
    placed = order;
    cart = [];
    draw();
  }

  function drawDone() {
    so.innerHTML = `
      <div class="so__hero"><h2>Pesanan Terkirim ✅</h2>
        <p>Dapur sudah menerima pesanan Anda</p></div>
      <div class="so__done">
        <div style="font-size:46px">🧾</div>
        <div class="small muted mt-8">Nomor pesanan</div>
        <div class="no">${U.esc(placed.no)}</div>
        <div class="badge badge--brand">${placed.tableName ? 'Meja ' + U.esc(placed.tableName) : 'Bungkus'}</div>
        <div class="card mt-16" style="text-align:left">
          <div class="card__body">
            ${placed.items.map(i => `<div class="kv"><span class="k">${i.qty}× ${U.esc(i.name)}</span>
              <span class="v">${U.rp(i.subtotal)}</span></div>`).join('')}
            <div class="divider"></div>
            ${placed.serviceCharge ? `<div class="kv"><span class="k">Service charge</span><span class="v">${U.rp(placed.serviceCharge)}</span></div>` : ''}
            <div class="kv"><span class="k">Pajak</span><span class="v">${U.rp(placed.tax)}</span></div>
            <div class="kv" style="font-size:16px"><span class="k bold">Total</span>
              <span class="v" style="color:var(--brand-600)">${U.rp(placed.total)}</span></div>
          </div>
        </div>
        <p class="small muted mt-16">Silakan lakukan pembayaran di kasir dengan menyebutkan nomor pesanan.</p>
        <button class="btn btn--primary btn--block mt-16" id="so-again">Pesan Lagi</button>
        <button class="btn btn--block mt-8" id="so-exit">Keluar</button>
      </div>`;
    so.querySelector('#so-again').onclick = () => { placed = null; draw(); };
    so.querySelector('#so-exit').onclick = () => App.Router.go('dashboard');
  }
  draw();
};

/* =============================================================
   Customer Display — layar menghadap pelanggan
   ============================================================= */
App.Views.customerdisplay = function (root) {
  const U = App.U, DB = App.DB;
  let stop = null;

  function promoSlide() {
    const promos = App.POS.activePromos(App.State.outletId());
    const p = promos.length ? promos[U.randInt(0, promos.length - 1)] : null;
    return p
      ? { tag: 'Promo Berjalan', h: p.name, s: p.description || '' }
      : { tag: 'Selamat Datang', h: DB.settings().receipt.header || 'Kopi Senja',
          s: DB.settings().receipt.subheader || 'Terima kasih atas kunjungan Anda' };
  }

  function draw(cart) {
    const outlet = App.State.outlet();
    const slide = promoSlide();
    const items = (cart && cart.items) || [];
    root.innerHTML = `<div class="device"><div class="device__body" style="overflow:hidden"><div class="cd">
      <div class="cd__promo">
        <span class="tag">${U.esc(slide.tag)}</span>
        <h1>${U.esc(slide.h)}</h1>
        <p>${U.esc(slide.s)}</p>
        <div style="margin-top:26px;display:flex;gap:20px;color:#9fd3c8;font-size:12.5px">
          <span>📍 ${U.esc(outlet.name)}</span><span>🕐 ${U.esc(outlet.openHour)}–${U.esc(outlet.closeHour)}</span>
        </div>
      </div>
      <div class="cd__side">
        <div class="cd__head"><b style="font-size:15px">Pesanan Anda</b>
          <div style="color:#7d959e;font-size:11.5px">${items.length ? U.sum(items, i => i.qty) + ' item' : 'menunggu kasir'}</div></div>
        ${items.length ? `<div class="cd__items">${items.map(i => `
            <div class="cd__line"><span>${i.qty}× ${U.esc(i.name)}
              ${i.opts ? `<small>${U.esc(i.opts)}</small>` : ''}</span>
              <b>${U.rp(i.subtotal)}</b></div>`).join('')}</div>
          <div class="cd__sum">
            <div class="cd__line" style="border:0"><span>Subtotal</span><b>${U.rp(cart.subtotal)}</b></div>
            ${cart.discount ? `<div class="cd__line" style="border:0;color:#f5a524"><span>Diskon${cart.promoName ? ' · ' + U.esc(cart.promoName) : ''}</span><b>−${U.rp(cart.discount)}</b></div>` : ''}
            ${cart.svc ? `<div class="cd__line" style="border:0"><span>Service</span><b>${U.rp(cart.svc)}</b></div>` : ''}
            ${cart.tax ? `<div class="cd__line" style="border:0"><span>Pajak</span><b>${U.rp(cart.tax)}</b></div>` : ''}
            <div class="cd__total"><span>TOTAL</span><span style="color:#54c8b5">${U.rp(cart.total)}</span></div>
          </div>`
        : `<div class="cd__empty"><div><div style="font-size:40px;opacity:.4">🛒</div>
             <div style="margin-top:10px;font-size:14px">Belum ada item</div>
             <div style="font-size:12px;margin-top:4px">Pesanan akan tampil di sini</div></div></div>`}
      </div>
    </div></div></div>`;
  }

  const lastMsg = App.Bridge.last();
  draw(lastMsg && lastMsg.type === 'cart' ? lastMsg.payload : null);
  stop = App.Bridge.listen((type, payload) => {
    if (!document.body.contains(root)) { stop && stop(); return; }
    if (type === 'cart') draw(payload);
    if (type === 'paid') { draw(null); App.UI.toast('Terima kasih! 🙏'); }
  });
};

/* =============================================================
   Order Display — antrean pesanan untuk pelanggan takeaway
   ============================================================= */
App.Views.orderdisplay = function (root) {
  const U = App.U, DB = App.DB;
  let timer = null;

  function draw() {
    const oid = App.State.outletId();
    const open = DB.all('orders').filter(o => o.status === 'open' && (oid === 'ALL' || o.outletId === oid));
    const cooking = open.filter(o => o.kitchenStatus !== 'ready' && o.kitchenStatus !== 'served');
    const ready = open.filter(o => o.kitchenStatus === 'ready');
    const shortNo = o => o.no.split('/').pop();

    root.innerHTML = `<div class="device"><div class="device__body" style="overflow:hidden"><div class="od">
      <div class="od__col">
        <div class="od__title">👨‍🍳 Sedang Disiapkan <span style="color:#7d959e;font-weight:600">${cooking.length}</span></div>
        <div class="od__grid">${cooking.map(o => `<div class="od__no">${U.esc(shortNo(o))}
          <small>${o.tableName ? 'Meja ' + U.esc(o.tableName) : U.esc(App.POS.TYPE_LABEL[o.type] || '')}</small></div>`).join('')
          || '<div style="color:#5f7880;font-size:13px">Tidak ada antrean</div>'}</div>
      </div>
      <div class="od__col">
        <div class="od__title">🛎️ Siap Diambil <span style="color:#7d959e;font-weight:600">${ready.length}</span></div>
        <div class="od__grid">${ready.map(o => `<div class="od__no ready">${U.esc(shortNo(o))}
          <small>${o.customerName ? U.esc(o.customerName) : (o.tableName ? 'Meja ' + U.esc(o.tableName) : 'Silakan diambil')}</small></div>`).join('')
          || '<div style="color:#5f7880;font-size:13px">Belum ada pesanan siap</div>'}</div>
      </div>
    </div></div></div>`;
    clearTimeout(timer);
    timer = setTimeout(() => { if (document.body.contains(root)) draw(); }, 8000);
  }
  draw();
};

/* =============================================================
   Cetak QR meja & label produk
   ============================================================= */
App.Views.qrtools = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'qr';

  function draw() {
    root.innerHTML = `
      <div class="page-head">
        <div><h2>QR Meja & Label Produk</h2>
          <p>Cetak QR E-Menu untuk tiap meja dan label harga berbarcode untuk bahan/produk</p></div>
      </div>
      <div id="tabs"></div><div id="body"></div>`;
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'qr', label:'QR E-Menu per Meja' },
      { key:'label', label:'Label & Barcode Produk' }
    ], tab, k => { tab = k; draw(); }));
    (tab === 'qr' ? qrTab : labelTab)(root.querySelector('#body'));
  }

  function baseURL() {
    return location.href.split('#')[0];
  }

  function qrTab(el) {
    const oid = App.State.outletId() === 'ALL' ? DB.all('outlets')[0].id : App.State.outletId();
    const outlet = DB.find('outlets', oid);
    const tables = DB.where('tables', t => t.outletId === oid);
    el.innerHTML = `
      <div class="card mb-16"><div class="card__body">
        <div class="flex items-center gap-12" style="flex-wrap:wrap">
          <div style="flex:1;min-width:240px">
            <b>Alamat aplikasi yang dipakai pada QR</b>
            <div class="small muted mt-4">Agar bisa dipindai dari HP pelanggan, gunakan alamat jaringan
              (mis. <span class="mono">http://192.168.1.10:8080/</span>), bukan <span class="mono">localhost</span>.</div>
          </div>
          <input class="input" id="qr-base" value="${U.esc(baseURL())}" style="flex:1;min-width:260px">
          <button class="btn" id="qr-refresh">Perbarui QR</button>
          <button class="btn btn--primary" id="qr-print">🖨️ Cetak Semua</button>
        </div>
      </div></div>
      <div class="grid g4" id="qr-grid"></div>`;

    const render = () => {
      const base = el.querySelector('#qr-base').value.replace(/#.*$/, '');
      el.querySelector('#qr-grid').innerHTML = tables.map(t => {
        const url = `${base}#/selforder?o=${oid}&t=${t.id}`;
        let img = '';
        try { img = App.QR.svg(url, { size: 132 }); }
        catch (e) { img = `<div class="small" style="color:var(--rose)">${U.esc(e.message)}</div>`; }
        return `<div class="card"><div class="card__body center">
          <div style="background:#fff;padding:6px;border-radius:8px;display:inline-block">${img}</div>
          <div style="font-weight:800;font-size:15px;margin-top:8px">Meja ${U.esc(t.name)}</div>
          <div class="small muted">${U.esc(t.area)} · ${t.capacity} kursi</div>
          <button class="btn btn--sm mt-8" data-one="${t.id}">🖨️ Cetak</button>
        </div></div>`;
      }).join('');
      el.querySelectorAll('[data-one]').forEach(b => b.onclick = () => printCards([DB.find('tables', b.dataset.one)], base));
    };
    el.querySelector('#qr-refresh').onclick = render;
    el.querySelector('#qr-print').onclick = () => printCards(tables, el.querySelector('#qr-base').value.replace(/#.*$/, ''));
    render();

    function printCards(list, base) {
      const biz = DB.settings().receipt;
      App.UI.print(`<div style="font-family:sans-serif;padding:10px">
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
          ${list.map(t => {
            const url = `${base}#/selforder?o=${oid}&t=${t.id}`;
            let img = ''; try { img = App.QR.svg(url, { size: 190 }); } catch (e) {}
            return `<div class="qr-card">
              <h4>${U.esc(biz.header || outlet.name)}</h4>
              <div style="font-size:11px;color:#555">${U.esc(outlet.name)}</div>
              <div class="meja">MEJA ${U.esc(t.name)}</div>
              ${img}
              <div class="hint">Pindai untuk melihat menu &amp; memesan langsung dari meja Anda.<br>
                Pesanan diteruskan otomatis ke dapur. Pembayaran di kasir.</div>
            </div>`;
          }).join('')}
        </div></div>`);
    }
  }

  function labelTab(el) {
    const products = DB.all('products');
    let picked = new Set(products.filter(p => p.type === 'product').slice(0, 12).map(p => p.id));
    el.innerHTML = `
      <div class="card mb-16"><div class="card__body">
        <div class="flex gap-8 items-center" style="flex-wrap:wrap">
          <b style="flex:1">Pilih produk yang akan dicetak labelnya</b>
          <button class="btn btn--sm" id="lb-all">Pilih Semua Menu</button>
          <button class="btn btn--sm" id="lb-none">Kosongkan</button>
          <button class="btn btn--primary" id="lb-print">🖨️ Cetak Label</button>
        </div>
        <div class="pill-row mt-12" id="lb-pick" style="max-height:190px;overflow:auto">
          ${products.map(p => `<button class="pill ${picked.has(p.id) ? 'is-active' : ''}" data-p="${p.id}">
            ${p.emoji || '📦'} ${U.esc(p.name)}</button>`).join('')}
        </div>
      </div></div>
      <div class="card"><div class="card__head"><h3>Pratinjau Label</h3>
        <span class="sub" id="lb-count"></span></div>
        <div class="card__body" style="background:#f0f2f3"><div class="labels" id="lb-prev"></div></div></div>`;

    const render = () => {
      const list = products.filter(p => picked.has(p.id));
      el.querySelector('#lb-count').textContent = `${list.length} label`;
      el.querySelector('#lb-prev').innerHTML = list.map(labelHTML).join('')
        || '<div class="empty small" style="grid-column:1/-1">Belum ada produk dipilih</div>';
      el.querySelectorAll('#lb-pick [data-p]').forEach(b =>
        b.classList.toggle('is-active', picked.has(b.dataset.p)));
    };
    const labelHTML = p => {
      const code = p.barcode || p.sku;
      let bc = ''; try { bc = App.QR.barcodeSVG(code, { width: 168, height: 42 }); } catch (e) {}
      return `<div class="label">
        <div class="n">${U.esc(p.name)}</div>
        <div class="p">${p.type === 'product' ? U.rp(p.price) : U.rp(App.Inv.avgCost(App.State.outletId(), p.id)) + '/' + U.esc(p.unit)}</div>
        ${bc}</div>`;
    };
    el.querySelectorAll('#lb-pick [data-p]').forEach(b => b.onclick = () => {
      picked.has(b.dataset.p) ? picked.delete(b.dataset.p) : picked.add(b.dataset.p);
      render();
    });
    el.querySelector('#lb-all').onclick = () => { picked = new Set(products.filter(p => p.type === 'product').map(p => p.id)); render(); };
    el.querySelector('#lb-none').onclick = () => { picked = new Set(); render(); };
    el.querySelector('#lb-print').onclick = () => {
      const list = products.filter(p => picked.has(p.id));
      if (!list.length) return App.UI.toast('Pilih produk terlebih dahulu', 'warn');
      App.UI.print(`<div style="font-family:sans-serif;padding:8px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">${list.map(labelHTML).join('')}</div></div>`);
    };
    render();
  }
  draw();
};
