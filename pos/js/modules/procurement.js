/* =============================================================
   SajiPOS — Pembelian: Supplier, PO, Penerimaan, Tagihan
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

App.Procure = (function () {
  const U = App.U, DB = App.DB;

  /* Buat PO dari daftar bahan yang menipis, dikelompokkan per supplier */
  function autoPO(outletId, lowList) {
    const rows = lowList.map(r => ({
      product: r.product,
      qty: Math.max(Math.ceil((r.product.minStock * 4 - r.qty) / 10) * 10, 10),
      price: App.Inv.avgCost(outletId, r.product.id) || r.product.cost
    }));
    const suppliers = DB.all('suppliers');
    const m = App.UI.modal({
      title:'Buat PO Otomatis', subtitle:'Berdasarkan bahan di bawah stok minimum', size:'lg',
      body:`<div class="field"><label>Supplier</label>
          <select class="select" id="ap-sup">${suppliers.map(s => `<option value="${s.id}">${U.esc(s.name)}</option>`).join('')}</select></div>
        <div class="tbl-wrap card"><table class="tbl">
          <thead><tr><th>Bahan</th><th class="num">Stok</th><th class="num" style="width:110px">Order</th><th class="num" style="width:130px">Harga</th><th class="num">Subtotal</th></tr></thead>
          <tbody>${rows.map((r, i) => `<tr data-i="${i}">
            <td><b>${U.esc(r.product.name)}</b><div class="small muted">${U.esc(r.product.unit)}</div></td>
            <td class="num">${U.num(App.Inv.qty(outletId, r.product.id), 1)}</td>
            <td><input class="input input--num ap-q" type="number" value="${r.qty}"></td>
            <td><input class="input input--num ap-p" type="number" step="0.01" value="${U.round2(r.price)}"></td>
            <td class="num sub">${U.rp(r.qty * r.price)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="4">Total</td><td class="num" id="ap-total">${U.rp(U.sum(rows, r => r.qty * r.price))}</td></tr></tfoot>
        </table></div>`,
      footer:`<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Buat Purchase Order</button>`
    });
    const upd = () => {
      let t = 0;
      m.body.querySelectorAll('tr[data-i]').forEach((tr, i) => {
        const q = Number(tr.querySelector('.ap-q').value) || 0;
        const p = Number(tr.querySelector('.ap-p').value) || 0;
        tr.querySelector('.sub').textContent = U.rp(q * p); t += q * p;
      });
      m.body.querySelector('#ap-total').textContent = U.rp(t);
    };
    m.body.querySelectorAll('.ap-q,.ap-p').forEach(i => i.oninput = upd);
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const items = [];
      m.body.querySelectorAll('tr[data-i]').forEach(tr => {
        const i = +tr.dataset.i;
        const qty = Number(tr.querySelector('.ap-q').value) || 0;
        const price = Number(tr.querySelector('.ap-p').value) || 0;
        if (qty > 0) items.push({ productId:rows[i].product.id, name:rows[i].product.name,
          unit:rows[i].product.unit, qty, price, subtotal:qty * price });
      });
      if (!items.length) return App.UI.toast('Tidak ada item', 'warn');
      const po = DB.insert('purchaseOrders', {
        no:DB.nextNo('po','PO'), date:U.today(), supplierId:m.body.querySelector('#ap-sup').value,
        outletId, items, total:U.sum(items, i => i.subtotal), expectedDate:U.addDays(U.today(), 3),
        status:'draft', note:'Dibuat otomatis dari peringatan stok minimum', createdBy:App.Auth.user().id
      });
      m.close();
      App.UI.toast('PO ' + po.no + ' dibuat', 'ok');
      App.Router.go('purchase');
    };
  }

  /* Terima barang dari PO → stok masuk + tagihan + jurnal */
  function receiveDialog(po, done) {
    const m = App.UI.modal({
      title:'Terima Barang — ' + po.no, size:'lg',
      subtitle:U.esc((DB.find('suppliers', po.supplierId)||{}).name),
      body:`<div class="tbl-wrap card mb-12"><table class="tbl">
          <thead><tr><th>Bahan</th><th class="num">Dipesan</th><th class="num">Sudah Diterima</th>
          <th class="num" style="width:120px">Terima Kini</th><th class="num" style="width:130px">Harga</th></tr></thead>
          <tbody>${po.items.map((it, i) => {
            const received = U.sum(DB.where('goodsReceipts', g => g.poId === po.id),
              g => U.sum(g.items.filter(x => x.productId === it.productId), x => x.qty));
            const sisa = it.qty - received;
            return `<tr data-i="${i}">
              <td><b>${U.esc(it.name)}</b><div class="small muted">${U.esc(it.unit || '')}</div></td>
              <td class="num">${U.num(it.qty, 1)}</td><td class="num">${U.num(received, 1)}</td>
              <td><input class="input input--num rc-q" type="number" step="0.01" value="${Math.max(0, sisa)}"></td>
              <td><input class="input input--num rc-p" type="number" step="0.01" value="${it.price}"></td></tr>`;
          }).join('')}</tbody></table></div>
        <div class="form-row c2">
          <div class="field"><label>Tanggal terima</label><input class="input" type="date" id="rc-date" value="${U.today()}"></div>
          <div class="field"><label>Nomor surat jalan / faktur supplier</label><input class="input" id="rc-doc" placeholder="opsional"></div>
        </div>
        <div class="field"><label>Catatan</label><input class="input" id="rc-note" placeholder="mis. 1 dus penyok, sudah diganti"></div>`,
      footer:`<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Terima & Buat Tagihan</button>`
    });
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const items = [];
      m.body.querySelectorAll('tr[data-i]').forEach(tr => {
        const it = po.items[+tr.dataset.i];
        const qty = Number(tr.querySelector('.rc-q').value) || 0;
        const price = Number(tr.querySelector('.rc-p').value) || 0;
        if (qty > 0) items.push({ ...it, qty, price, qtyOrder:it.qty, subtotal:qty * price });
      });
      if (!items.length) return App.UI.toast('Isi jumlah barang yang diterima', 'warn');
      const total = U.sum(items, i => i.subtotal);
      const sup = DB.find('suppliers', po.supplierId);
      const date = m.body.querySelector('#rc-date').value;
      const grn = DB.insert('goodsReceipts', {
        no:DB.nextNo('grn','GRN'), date, poId:po.id, supplierId:po.supplierId, outletId:po.outletId,
        items, total, note:m.body.querySelector('#rc-note').value,
        supplierDoc:m.body.querySelector('#rc-doc').value, receivedBy:App.Auth.user().id
      });
      App.Inv.receive(po.outletId, items, grn.no, 'Penerimaan dari ' + sup.name);
      const bill = DB.insert('bills', {
        no:DB.nextNo('bill','INV'), date, dueDate:U.addDays(date, sup.term || 0),
        supplierId:po.supplierId, grnId:grn.id, poId:po.id, outletId:po.outletId,
        total, paid:0, status:'unpaid', note:'Tagihan atas ' + grn.no
      });
      App.Ledger.postGRN(grn);
      /* status PO */
      const allReceived = po.items.every(it => {
        const rec = U.sum(DB.where('goodsReceipts', g => g.poId === po.id),
          g => U.sum(g.items.filter(x => x.productId === it.productId), x => x.qty));
        return rec >= it.qty - 0.001;
      });
      DB.update('purchaseOrders', po.id, { status: allReceived ? 'received' : 'partial' });
      DB.log('procure.receive', `Terima barang ${grn.no} senilai ${U.rp(total)}`);
      App.UI.toast(`Barang diterima. Stok bertambah & tagihan ${bill.no} dibuat.`, 'ok');
      m.close(); if (done) done();
    };
  }

  function payBill(bill, done) {
    const sisa = bill.total - (bill.paid || 0);
    const accounts = App.Ledger.cashAccounts();
    App.UI.formModal({
      title:'Bayar Tagihan ' + bill.no,
      subtitle:`${(DB.find('suppliers', bill.supplierId)||{}).name} · sisa ${U.rp(sisa)}`,
      fields:[
        { name:'amount', label:'Jumlah bayar (Rp)', type:'money', value:sisa, required:true },
        { name:'accountId', label:'Dibayar dari', type:'select', required:true,
          options: accounts.map(a => ({ value:a.id, label:`${a.name} — saldo ${U.rp(App.Ledger.balance(a.id))}` })) },
        { name:'date', label:'Tanggal', type:'date', value:U.today(), required:true },
        { name:'ref', label:'No. referensi / bukti transfer' },
        { name:'note', label:'Catatan', col:2 }
      ],
      validate: d => d.amount > sisa ? 'Jumlah melebihi sisa tagihan' : null,
      onSubmit(d) {
        const pay = DB.insert('billPayments', { ...d, billId:bill.id, supplierId:bill.supplierId,
          outletId:bill.outletId, method:'transfer', userId:App.Auth.user().id });
        const paid = (bill.paid || 0) + d.amount;
        DB.update('bills', bill.id, { paid, status: paid >= bill.total - 0.5 ? 'paid' : 'partial' });
        App.Ledger.postBillPayment(pay, bill);
        App.UI.toast('Pembayaran dicatat & hutang berkurang', 'ok');
        if (done) done();
      }
    });
  }

  return { autoPO, receiveDialog, payBill };
})();

/* ---------------- Supplier ---------------- */
App.Views.suppliers = function (root) {
  const U = App.U, DB = App.DB;
  function draw() {
    const sups = DB.all('suppliers').map(s => {
      const bills = DB.where('bills', b => b.supplierId === s.id);
      const pos = DB.where('purchaseOrders', p => p.supplierId === s.id);
      return { ...s, hutang: U.sum(bills.filter(b => b.status !== 'paid'), b => b.total - b.paid),
        totalBeli: U.sum(bills, b => b.total), poCount: pos.length,
        lastPo: pos.length ? U.sortBy(pos, p => p.date, 'desc')[0].date : null };
    });
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Supplier</h2><p>Data pemasok, termin pembayaran, dan posisi hutang</p></div>
        <div class="page-head__actions"><button class="btn btn--primary" id="new-sup">+ Supplier Baru</button></div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Supplier', icon:'🚚', value:U.num(sups.length), sub:'aktif bekerja sama' })}
        ${App.UI.stat({ label:'Total Hutang', icon:'🧮', value:U.rp(U.sum(sups, s => s.hutang)), sub:'belum dibayar', tone:'var(--rose)' })}
        ${App.UI.stat({ label:'Nilai Pembelian', icon:'📦', value:U.rp(U.sum(sups, s => s.totalBeli)), sub:'sepanjang periode' })}
        ${App.UI.stat({ label:'Supplier Berhutang', icon:'⚠️', value:U.num(sups.filter(s => s.hutang > 0).length), sub:'perlu dilunasi' })}
      </div>
      <div id="table"></div>`;
    root.querySelector('#new-sup').onclick = () => form();
    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:sups, exportName:'daftar-supplier', pageSize:15, onRowClick: s => detail(s),
      searchKeys:['name','contact','phone','code'],
      cols:[
        { key:'name', label:'Supplier', render:s => `<b>${U.esc(s.name)}</b><div class="small muted">${U.esc(s.code)} · ${U.esc(s.contact || '')}</div>` },
        { key:'phone', label:'Kontak', render:s => `${U.esc(s.phone)}<div class="small muted">${U.esc(s.email || '')}</div>` },
        { key:'term', label:'Termin', render:s => s.term ? s.term + ' hari' : 'Tunai' },
        { key:'poCount', label:'PO', align:'right', render:s => U.num(s.poCount) },
        { key:'totalBeli', label:'Total Pembelian', align:'right', render:s => U.rp(s.totalBeli) },
        { key:'hutang', label:'Hutang', align:'right', render:s => s.hutang
            ? `<b style="color:var(--rose)">${U.rp(s.hutang)}</b>` : '<span class="muted">lunas</span>' },
        { key:'lastPo', label:'PO Terakhir', render:s => s.lastPo ? U.fmtDate(s.lastPo) : '-' }
      ]
    }));
  }
  function form(s) {
    App.UI.formModal({
      title:s ? 'Ubah Supplier' : 'Supplier Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama supplier', required:true, col:2 },
        { name:'code', label:'Kode', value:'SUP-' + String(DB.all('suppliers').length + 1).padStart(3,'0') },
        { name:'contact', label:'Nama kontak (PIC)' },
        { name:'phone', label:'Telepon / WhatsApp', required:true },
        { name:'email', label:'Email' },
        { name:'term', label:'Termin pembayaran (hari)', type:'number', value:0, hint:'0 = bayar tunai saat terima' },
        { name:'bank', label:'Rekening bank' },
        { name:'address', label:'Alamat', type:'textarea', col:2 },
        { name:'note', label:'Catatan', type:'textarea', col:2 }
      ],
      values:s || {},
      onSubmit(d) { s ? DB.update('suppliers', s.id, d) : DB.insert('suppliers', { ...d, active:true }); App.UI.toast('Supplier disimpan','ok'); draw(); }
    });
  }
  function detail(s) {
    const bills = U.sortBy(DB.where('bills', b => b.supplierId === s.id), b => b.date, 'desc');
    const pos = U.sortBy(DB.where('purchaseOrders', p => p.supplierId === s.id), p => p.date, 'desc');
    const items = {};
    DB.where('goodsReceipts', g => g.supplierId === s.id).forEach(g => g.items.forEach(i => {
      items[i.productId] = (items[i.productId] || 0) + i.subtotal;
    }));
    const m = App.UI.modal({
      title:s.name, subtitle:`${s.code} · ${s.contact || '-'} · ${s.phone}`, size:'xl',
      body:`<div class="grid g3 mb-16">
          ${App.UI.stat({ label:'Total Pembelian', value:U.rp(U.sum(bills, b => b.total)) })}
          ${App.UI.stat({ label:'Hutang Berjalan', value:U.rp(U.sum(bills.filter(b => b.status !== 'paid'), b => b.total - b.paid)) })}
          ${App.UI.stat({ label:'Termin', value:s.term ? s.term + ' hari' : 'Tunai' })}
        </div>
        <div class="grid g2">
          <div class="card"><div class="card__head"><h3>Tagihan Terakhir</h3></div>
            <div class="card__body" style="max-height:280px;overflow:auto">
            ${bills.slice(0,10).map(b => `<div class="kv"><span class="k">${U.esc(b.no)}<br><span class="small">${U.fmtDate(b.date)}</span></span>
              <span class="v">${U.rp(b.total)} ${App.UI.badge(b.status === 'paid' ? 'Lunas' : 'Belum', b.status === 'paid' ? 'green' : 'red')}</span></div>`).join('')
              || '<div class="empty small">Belum ada tagihan</div>'}</div></div>
          <div class="card"><div class="card__head"><h3>Barang Terbanyak Dibeli</h3></div>
            <div class="card__body">${App.Chart.hbar(Object.entries(items).map(([pid, v]) =>
              ({ label:(DB.find('products', pid)||{}).name || '-', value:v })).sort((a,b) => b.value - a.value).slice(0, 7), { money:true })}</div></div>
        </div>`,
      footer:`<button class="btn" data-a="edit">✏️ Ubah Data</button>
              <button class="btn btn--primary" data-a="po">+ Buat PO</button>`
    });
    m.el.querySelector('[data-a="edit"]').onclick = () => { m.close(); form(s); };
    m.el.querySelector('[data-a="po"]').onclick = () => { m.close(); App.Views.poForm(null, s.id); };
  }
  draw();
};

/* ---------------- Purchase Order ---------------- */
App.Views.poForm = function (po, supplierId) {
  const U = App.U, DB = App.DB;
  const mats = DB.all('products').filter(p => p.type === 'material');
  const sups = DB.all('suppliers');
  const oid = App.State.outletId() === 'ALL' ? DB.all('outlets')[0].id : App.State.outletId();
  let items = po ? U.clone(po.items) : [];

  const m = App.UI.modal({
    title: po ? 'Ubah ' + po.no : 'Purchase Order Baru', size:'xl',
    body:`<div class="form-row c3 mb-12">
        <div class="field"><label>Supplier *</label><select class="select" id="po-sup">
          ${sups.map(s => `<option value="${s.id}" ${(po ? po.supplierId : supplierId) === s.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Tanggal PO</label><input class="input" type="date" id="po-date" value="${po ? po.date : U.today()}"></div>
        <div class="field"><label>Perkiraan tiba</label><input class="input" type="date" id="po-exp" value="${po ? po.expectedDate : U.addDays(U.today(), 3)}"></div>
      </div>
      <div class="tbl-wrap card mb-12"><table class="tbl">
        <thead><tr><th>Bahan</th><th class="num" style="width:110px">Qty</th><th style="width:90px">Satuan</th>
        <th class="num" style="width:130px">Harga</th><th class="num">Subtotal</th><th style="width:40px"></th></tr></thead>
        <tbody id="po-body"></tbody>
        <tfoot><tr><td colspan="4">TOTAL</td><td class="num" id="po-total">Rp 0</td><td></td></tr></tfoot>
      </table></div>
      <div class="flex gap-8 mb-12">
        <button class="btn btn--sm" id="po-add">+ Tambah Item</button>
        <button class="btn btn--sm" id="po-low">⚠️ Isi dari stok menipis</button>
      </div>
      <div class="field"><label>Catatan</label><input class="input" id="po-note" value="${po ? U.esc(po.note || '') : ''}"></div>`,
    footer:`<button class="btn" data-no>Batal</button>
            <button class="btn" data-draft>Simpan Draft</button>
            <button class="btn btn--primary" data-send>Kirim ke Supplier</button>`
  });

  function render() {
    m.body.querySelector('#po-body').innerHTML = items.map((it, i) => {
      const p = DB.find('products', it.productId) || {};
      return `<tr data-i="${i}">
        <td><select class="select po-p">${mats.map(x => `<option value="${x.id}" ${x.id === it.productId ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select>
          <div class="small muted">stok: ${U.num(App.Inv.qty(oid, it.productId), 1)} ${U.esc(p.unit || '')}</div></td>
        <td><input class="input input--num po-q" type="number" step="0.01" value="${it.qty}"></td>
        <td class="small">${U.esc(p.unit || '')}</td>
        <td><input class="input input--num po-c" type="number" step="0.01" value="${it.price}"></td>
        <td class="num">${U.rp(it.qty * it.price)}</td>
        <td><button class="citem__x po-d">✕</button></td></tr>`;
    }).join('') || '<tr><td colspan="6" class="center muted" style="padding:18px">Belum ada item</td></tr>';
    m.body.querySelector('#po-total').textContent = U.rp(U.sum(items, i => i.qty * i.price));
    m.body.querySelectorAll('tr[data-i]').forEach(tr => {
      const i = +tr.dataset.i;
      tr.querySelector('.po-p').onchange = e => {
        items[i].productId = e.target.value;
        const p = DB.find('products', e.target.value);
        items[i].name = p.name; items[i].unit = p.unit; items[i].price = App.Inv.avgCost(oid, p.id) || p.cost;
        render();
      };
      tr.querySelector('.po-q').oninput = e => { items[i].qty = Number(e.target.value) || 0; };
      tr.querySelector('.po-q').onchange = render;
      tr.querySelector('.po-c').oninput = e => { items[i].price = Number(e.target.value) || 0; };
      tr.querySelector('.po-c').onchange = render;
      tr.querySelector('.po-d').onclick = () => { items.splice(i, 1); render(); };
    });
  }
  m.body.querySelector('#po-add').onclick = () => {
    const p = mats[0];
    items.push({ productId:p.id, name:p.name, unit:p.unit, qty:1, price:App.Inv.avgCost(oid, p.id) || p.cost });
    render();
  };
  m.body.querySelector('#po-low').onclick = () => {
    App.Inv.lowStockList(oid).forEach(r => {
      if (items.find(i => i.productId === r.product.id)) return;
      items.push({ productId:r.product.id, name:r.product.name, unit:r.product.unit,
        qty:Math.max(10, Math.ceil((r.product.minStock * 4 - r.qty) / 10) * 10),
        price:App.Inv.avgCost(oid, r.product.id) || r.product.cost });
    });
    render();
  };
  const save = status => {
    const valid = items.filter(i => i.qty > 0);
    if (!valid.length) return App.UI.toast('Tambahkan minimal satu item', 'warn');
    const payload = {
      supplierId:m.body.querySelector('#po-sup').value,
      date:m.body.querySelector('#po-date').value,
      expectedDate:m.body.querySelector('#po-exp').value,
      note:m.body.querySelector('#po-note').value,
      outletId:oid, items:valid.map(i => ({ ...i, subtotal:i.qty * i.price })),
      total:U.sum(valid, i => i.qty * i.price), status
    };
    if (po) DB.update('purchaseOrders', po.id, payload);
    else DB.insert('purchaseOrders', { ...payload, no:DB.nextNo('po','PO'), createdBy:App.Auth.user().id });
    App.UI.toast(status === 'draft' ? 'PO disimpan sebagai draft' : 'PO dikirim ke supplier', 'ok');
    m.close();
    App.Router.reload();
  };
  m.el.querySelector('[data-no]').onclick = m.close;
  m.el.querySelector('[data-draft]').onclick = () => save('draft');
  m.el.querySelector('[data-send]').onclick = () => save('sent');
  render();
};

App.Views.purchase = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'all';
  function draw() {
    const oid = App.State.outletId();
    const all = DB.all('purchaseOrders').filter(p => oid === 'ALL' || p.outletId === oid);
    const rows = tab === 'all' ? all : all.filter(p => p.status === tab);
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Purchase Order</h2><p>Pemesanan bahan baku ke supplier, dari draft hingga barang diterima</p></div>
        <div class="page-head__actions"><button class="btn btn--primary" id="new-po">+ Purchase Order</button></div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total PO', icon:'🛒', value:U.num(all.length), sub:'seluruh periode' })}
        ${App.UI.stat({ label:'Menunggu Barang', icon:'⏳', value:U.num(all.filter(p => ['sent','partial'].includes(p.status)).length), sub:'sudah dikirim ke supplier' })}
        ${App.UI.stat({ label:'Nilai PO Berjalan', icon:'💰', value:U.rp(U.sum(all.filter(p => ['sent','partial','draft'].includes(p.status)), p => p.total)), sub:'komitmen pembelian' })}
        ${App.UI.stat({ label:'Draft', icon:'📝', value:U.num(all.filter(p => p.status === 'draft').length), sub:'belum dikirim' })}
      </div>
      <div id="tabs"></div><div id="table"></div>`;
    root.querySelector('#new-po').onclick = () => App.Views.poForm();
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'all', label:'Semua', count:all.length },
      { key:'draft', label:'Draft', count:all.filter(p=>p.status==='draft').length },
      { key:'sent', label:'Dikirim', count:all.filter(p=>p.status==='sent').length },
      { key:'partial', label:'Sebagian Diterima', count:all.filter(p=>p.status==='partial').length },
      { key:'received', label:'Selesai', count:all.filter(p=>p.status==='received').length }
    ], tab, k => { tab = k; draw(); }));
    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:U.sortBy(rows, p => p.date, 'desc'), exportName:'purchase-order', pageSize:15,
      searchKeys:['no'], onRowClick: p => detail(p),
      cols:[
        { key:'no', label:'No. PO', render:p => `<span class="mono">${U.esc(p.no)}</span>` },
        { key:'date', label:'Tanggal', render:p => U.fmtDate(p.date) },
        { key:'supplierId', label:'Supplier', render:p => U.esc((DB.find('suppliers', p.supplierId)||{}).name || '-') },
        { key:'items', label:'Item', align:'right', render:p => p.items.length, sortValue:p => p.items.length },
        { key:'total', label:'Nilai', align:'right', render:p => `<b>${U.rp(p.total)}</b>`, sortValue:p => p.total },
        { key:'expectedDate', label:'Perkiraan Tiba', render:p => U.fmtDate(p.expectedDate) },
        { key:'status', label:'Status', render:p => App.UI.badge(
            ({ draft:'Draft', sent:'Dikirim', partial:'Sebagian', received:'Diterima', cancelled:'Batal' })[p.status] || p.status,
            p.status === 'received' ? 'green' : p.status === 'draft' ? '' : p.status === 'cancelled' ? 'red' : 'amber') }
      ]
    }));
  }
  function detail(po) {
    const sup = DB.find('suppliers', po.supplierId) || {};
    const grns = DB.where('goodsReceipts', g => g.poId === po.id);
    const m = App.UI.modal({
      title:po.no, subtitle:`${sup.name} · ${U.fmtDate(po.date)}`, size:'lg',
      body:`<div class="grid g3 mb-16">
          ${App.UI.stat({ label:'Nilai PO', value:U.rp(po.total) })}
          ${App.UI.stat({ label:'Sudah Diterima', value:U.rp(U.sum(grns, g => g.total)) })}
          ${App.UI.stat({ label:'Status', value:`<span style="font-size:15px">${({draft:'Draft',sent:'Dikirim',partial:'Sebagian',received:'Diterima'})[po.status]}</span>` })}
        </div>
        <div class="tbl-wrap card mb-12"><table class="tbl">
          <thead><tr><th>Bahan</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th><th class="num">Diterima</th></tr></thead>
          <tbody>${po.items.map(it => {
            const rec = U.sum(grns, g => U.sum(g.items.filter(x => x.productId === it.productId), x => x.qty));
            return `<tr><td>${U.esc(it.name)}</td><td class="num">${U.num(it.qty,1)} ${U.esc(it.unit||'')}</td>
              <td class="num">${U.rp(it.price)}</td><td class="num">${U.rp(it.qty * it.price)}</td>
              <td class="num" style="color:${rec >= it.qty ? 'var(--lime)' : 'var(--amber)'}">${U.num(rec,1)}</td></tr>`;
          }).join('')}</tbody>
          <tfoot><tr><td colspan="3">TOTAL</td><td class="num">${U.rp(po.total)}</td><td></td></tr></tfoot>
        </table></div>
        ${po.note ? `<div class="small muted">Catatan: ${U.esc(po.note)}</div>` : ''}
        ${grns.length ? `<div class="mt-12"><div class="bold small mb-8">Riwayat penerimaan</div>
          ${grns.map(g => `<div class="kv"><span class="k">${U.esc(g.no)} · ${U.fmtDate(g.date)}</span><span class="v">${U.rp(g.total)}</span></div>`).join('')}</div>` : ''}`,
      footer:`<button class="btn" data-a="print">🖨️ Cetak</button>
              ${po.status === 'draft' ? '<button class="btn" data-a="edit">✏️ Ubah</button><button class="btn btn--primary" data-a="send">Kirim ke Supplier</button>' : ''}
              ${['sent','partial'].includes(po.status) ? '<button class="btn btn--primary" data-a="receive">📥 Terima Barang</button>' : ''}`
    });
    const a = k => m.el.querySelector(`[data-a="${k}"]`);
    a('print').onclick = () => App.UI.print(poPrintHTML(po, sup));
    if (a('edit')) a('edit').onclick = () => { m.close(); App.Views.poForm(po); };
    if (a('send')) a('send').onclick = () => { DB.update('purchaseOrders', po.id, { status:'sent' }); m.close(); draw(); App.UI.toast('PO dikirim ke supplier','ok'); };
    if (a('receive')) a('receive').onclick = () => { m.close(); App.Procure.receiveDialog(po, draw); };
  }
  function poPrintHTML(po, sup) {
    const biz = DB.settings().business;
    const outlet = DB.find('outlets', po.outletId) || {};
    return `<div style="font-family:sans-serif;padding:24px;max-width:800px;margin:0 auto;color:#111">
      <div style="display:flex;justify-content:space-between;border-bottom:2px solid #333;padding-bottom:10px">
        <div><h2 style="margin:0">PURCHASE ORDER</h2><div>${U.esc(po.no)}</div></div>
        <div style="text-align:right"><b>${U.esc(biz.name)}</b><br>${U.esc(outlet.address)}<br>${U.esc(outlet.phone)}</div>
      </div>
      <div style="display:flex;gap:40px;margin:16px 0">
        <div><b>Kepada:</b><br>${U.esc(sup.name)}<br>${U.esc(sup.contact || '')}<br>${U.esc(sup.phone)}<br>${U.esc(sup.address || '')}</div>
        <div><b>Tanggal PO:</b> ${U.fmtDate(po.date, 'long')}<br><b>Perkiraan tiba:</b> ${U.fmtDate(po.expectedDate, 'long')}<br>
             <b>Termin:</b> ${sup.term ? sup.term + ' hari' : 'Tunai'}<br><b>Kirim ke:</b> ${U.esc(outlet.name)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead><tr style="background:#eee"><th style="text-align:left;padding:7px;border:1px solid #ccc">Bahan</th>
        <th style="padding:7px;border:1px solid #ccc">Qty</th><th style="padding:7px;border:1px solid #ccc">Satuan</th>
        <th style="padding:7px;border:1px solid #ccc">Harga</th><th style="padding:7px;border:1px solid #ccc">Subtotal</th></tr></thead>
        <tbody>${po.items.map(i => `<tr><td style="padding:6px;border:1px solid #ccc">${U.esc(i.name)}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:right">${U.num(i.qty,1)}</td>
          <td style="padding:6px;border:1px solid #ccc">${U.esc(i.unit||'')}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:right">${U.num(i.price)}</td>
          <td style="padding:6px;border:1px solid #ccc;text-align:right">${U.num(i.qty*i.price)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="4" style="padding:7px;text-align:right;border:1px solid #ccc"><b>TOTAL</b></td>
          <td style="padding:7px;text-align:right;border:1px solid #ccc"><b>${U.rp(po.total)}</b></td></tr></tfoot>
      </table>
      <p style="font-size:12px;margin-top:10px">${U.esc(po.note || '')}</p>
      <p style="font-size:12px">Terbilang: <i>${U.terbilang(po.total)} rupiah</i></p>
      <div style="display:flex;justify-content:space-between;margin-top:50px;font-size:13px">
        <div>Dibuat oleh,<br><br><br>_______________</div>
        <div>Disetujui,<br><br><br>_______________</div>
        <div>Supplier,<br><br><br>_______________</div>
      </div></div>`;
  }
  draw();
};

/* ---------------- Penerimaan Barang ---------------- */
App.Views.receiving = function (root) {
  const U = App.U, DB = App.DB;
  function draw() {
    const oid = App.State.outletId();
    const grns = DB.all('goodsReceipts').filter(g => oid === 'ALL' || g.outletId === oid);
    const pending = DB.all('purchaseOrders').filter(p => ['sent','partial'].includes(p.status) && (oid === 'ALL' || p.outletId === oid));
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Penerimaan Barang</h2><p>Terima barang dari PO — stok bertambah dan tagihan otomatis dibuat</p></div>
      </div>
      ${pending.length ? `<div class="card mb-16">
        <div class="card__head"><h3>📦 PO Menunggu Penerimaan</h3></div>
        <div class="card__body"><div class="oq">${pending.map(p => `
          <div class="oq-card"><div class="oq-card__ch" style="background:var(--amber-soft)">📥</div>
            <div class="oq-card__main"><div class="oq-card__no">${U.esc(p.no)} — ${U.esc((DB.find('suppliers', p.supplierId)||{}).name)}</div>
              <div class="oq-card__sub">${p.items.length} item · perkiraan tiba ${U.fmtDate(p.expectedDate)}</div></div>
            <div class="right"><b>${U.rp(p.total)}</b></div>
            <button class="btn btn--sm btn--primary" data-rec="${p.id}">Terima</button></div>`).join('')}</div></div>
      </div>` : ''}
      <div id="table"></div>`;
    root.querySelectorAll('[data-rec]').forEach(b => b.onclick = () =>
      App.Procure.receiveDialog(DB.find('purchaseOrders', b.dataset.rec), draw));
    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:U.sortBy(grns, g => g.date, 'desc'), exportName:'penerimaan-barang', pageSize:15,
      searchKeys:['no','supplierDoc'], onRowClick: g => detail(g),
      cols:[
        { key:'no', label:'No. Penerimaan', render:g => `<span class="mono">${U.esc(g.no)}</span>` },
        { key:'date', label:'Tanggal', render:g => U.fmtDate(g.date) },
        { key:'supplierId', label:'Supplier', render:g => U.esc((DB.find('suppliers', g.supplierId)||{}).name || '-') },
        { key:'poId', label:'PO', render:g => U.esc((DB.find('purchaseOrders', g.poId)||{}).no || '-') },
        { key:'items', label:'Item', align:'right', render:g => g.items.length },
        { key:'total', label:'Nilai', align:'right', render:g => U.rp(g.total), sortValue:g => g.total }
      ]
    }));
  }
  function detail(g) {
    App.UI.modal({
      title:g.no, subtitle:`${(DB.find('suppliers', g.supplierId)||{}).name} · ${U.fmtDate(g.date)}`, size:'lg',
      body:`<div class="tbl-wrap card"><table class="tbl">
        <thead><tr><th>Bahan</th><th class="num">Diterima</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
        <tbody>${g.items.map(i => `<tr><td>${U.esc(i.name)}</td><td class="num">${U.num(i.qty,1)} ${U.esc(i.unit||'')}</td>
          <td class="num">${U.rp(i.price)}</td><td class="num">${U.rp(i.qty * i.price)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="3">TOTAL</td><td class="num">${U.rp(g.total)}</td></tr></tfoot></table></div>
        ${g.note ? `<p class="small muted mt-8">${U.esc(g.note)}</p>` : ''}`
    });
  }
  draw();
};

/* ---------------- Tagihan & Hutang ---------------- */
App.Views.bills = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'unpaid';
  function draw() {
    const oid = App.State.outletId();
    const all = DB.all('bills').filter(b => oid === 'ALL' || b.outletId === oid);
    const unpaid = all.filter(b => b.status !== 'paid');
    const aging = App.Ledger.agingBuckets(unpaid);
    const rows = tab === 'all' ? all : tab === 'unpaid' ? unpaid : all.filter(b => b.status === tab);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Tagihan & Hutang Supplier</h2><p>Kelola pembayaran hutang usaha berdasarkan umur tagihan</p></div>
        <div class="page-head__actions"><button class="btn" id="pay-batch">💳 Bayar Massal</button></div>
      </div>
      <div class="grid g5 mb-16">
        ${App.UI.stat({ label:'Total Hutang', icon:'🧮', value:U.rp(U.sum(unpaid, b => b.total - b.paid)), sub:`${unpaid.length} tagihan`, tone:'var(--rose)' })}
        ${App.UI.stat({ label:'Belum Jatuh Tempo', icon:'🟢', value:U.rp(aging.lancar), sub:'masih dalam termin' })}
        ${App.UI.stat({ label:'Lewat 1–30 Hari', icon:'🟡', value:U.rp(aging.d30), sub:'segera dibayar' })}
        ${App.UI.stat({ label:'Lewat 31–60 Hari', icon:'🟠', value:U.rp(aging.d60), sub:'perlu perhatian' })}
        ${App.UI.stat({ label:'Lewat >60 Hari', icon:'🔴', value:U.rp(aging.d90 + aging.lebih), sub:'kritis', tone:'var(--rose)' })}
      </div>
      <div id="tabs"></div><div id="table"></div>`;

    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'unpaid', label:'Belum Lunas', count:unpaid.length },
      { key:'partial', label:'Sebagian', count:all.filter(b=>b.status==='partial').length },
      { key:'paid', label:'Lunas', count:all.filter(b=>b.status==='paid').length },
      { key:'all', label:'Semua', count:all.length }
    ], tab, k => { tab = k; draw(); }));

    root.querySelector('#pay-batch').onclick = () => {
      const due = unpaid.filter(b => b.dueDate <= U.addDays(U.today(), 7));
      if (!due.length) return App.UI.toast('Tidak ada tagihan jatuh tempo dalam 7 hari', 'info');
      App.UI.confirm(`Bayar ${due.length} tagihan jatuh tempo senilai <b>${U.rp(U.sum(due, b => b.total - b.paid))}</b> dari Bank BCA?`)
        .then(ok => {
          if (!ok) return;
          due.forEach(b => {
            const amt = b.total - b.paid;
            const pay = DB.insert('billPayments', { date:U.today(), billId:b.id, supplierId:b.supplierId,
              amount:amt, accountId:App.Ledger.id(App.Ledger.A.BANK), method:'transfer',
              note:'Pembayaran massal', outletId:b.outletId, userId:App.Auth.user().id });
            DB.update('bills', b.id, { paid:b.total, status:'paid' });
            App.Ledger.postBillPayment(pay, b);
          });
          App.UI.toast(`${due.length} tagihan dilunasi`, 'ok'); draw();
        });
    };

    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:U.sortBy(rows, b => b.dueDate), exportName:'tagihan-supplier', pageSize:15,
      searchKeys:['no'], onRowClick: b => detail(b),
      cols:[
        { key:'no', label:'No. Tagihan', render:b => `<span class="mono">${U.esc(b.no)}</span>` },
        { key:'supplierId', label:'Supplier', render:b => U.esc((DB.find('suppliers', b.supplierId)||{}).name || '-') },
        { key:'date', label:'Tanggal', render:b => U.fmtDate(b.date) },
        { key:'dueDate', label:'Jatuh Tempo', render:b => {
            const late = b.status !== 'paid' && b.dueDate < U.today();
            const d = Math.floor((new Date(U.today()) - new Date(b.dueDate)) / 86400000);
            return `${U.fmtDate(b.dueDate)}${late ? `<div class="small" style="color:var(--rose)">telat ${d} hari</div>` : ''}`; } },
        { key:'total', label:'Nilai', align:'right', render:b => U.rp(b.total), sortValue:b => b.total },
        { key:'paid', label:'Dibayar', align:'right', render:b => U.rp(b.paid || 0) },
        { key:'sisa', label:'Sisa', align:'right', render:b => `<b style="color:${b.total - b.paid > 0 ? 'var(--rose)' : 'var(--lime)'}">${U.rp(b.total - b.paid)}</b>`,
          sortValue:b => b.total - b.paid },
        { key:'status', label:'Status', render:b => App.UI.badge(
            ({ unpaid:'Belum Lunas', partial:'Sebagian', paid:'Lunas' })[b.status] || b.status,
            b.status === 'paid' ? 'green' : b.status === 'partial' ? 'amber' : 'red') },
        { key:'aksi', label:'', sortable:false, render:b => b.status !== 'paid'
            ? `<button class="btn btn--sm btn--primary" data-pay="${b.id}">Bayar</button>` : '' }
      ]
    }));
    root.querySelectorAll('[data-pay]').forEach(btn => btn.onclick = e => {
      e.stopPropagation();
      App.Procure.payBill(DB.find('bills', btn.dataset.pay), draw);
    });
  }
  function detail(b) {
    const pays = DB.where('billPayments', p => p.billId === b.id);
    const grn = DB.find('goodsReceipts', b.grnId);
    const m = App.UI.modal({
      title:'Tagihan ' + b.no, size:'lg',
      subtitle:`${(DB.find('suppliers', b.supplierId)||{}).name} · jatuh tempo ${U.fmtDate(b.dueDate)}`,
      body:`<div class="grid g3 mb-16">
          ${App.UI.stat({ label:'Nilai Tagihan', value:U.rp(b.total) })}
          ${App.UI.stat({ label:'Sudah Dibayar', value:U.rp(b.paid || 0) })}
          ${App.UI.stat({ label:'Sisa', value:U.rp(b.total - b.paid), tone: b.total - b.paid > 0 ? 'var(--rose)' : 'var(--lime)' })}
        </div>
        ${grn ? `<div class="tbl-wrap card mb-12"><table class="tbl">
          <thead><tr><th>Bahan</th><th class="num">Qty</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead>
          <tbody>${grn.items.map(i => `<tr><td>${U.esc(i.name)}</td><td class="num">${U.num(i.qty,1)}</td>
            <td class="num">${U.rp(i.price)}</td><td class="num">${U.rp(i.qty * i.price)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${pays.length ? `<div class="bold small mb-8">Riwayat pembayaran</div>
          ${pays.map(p => `<div class="kv"><span class="k">${U.fmtDate(p.date)} · ${U.esc(App.Ledger.name(p.accountId))}</span><span class="v">${U.rp(p.amount)}</span></div>`).join('')}` : ''}`,
      footer: b.status !== 'paid' ? `<button class="btn btn--primary" data-a="pay">💳 Bayar Tagihan</button>` : ''
    });
    const pay = m.el.querySelector('[data-a="pay"]');
    if (pay) pay.onclick = () => { m.close(); App.Procure.payBill(b, draw); };
  }
  draw();
};
