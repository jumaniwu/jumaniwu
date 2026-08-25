/* =============================================================
   SajiPOS — Inventori: Produk & Resep, Stok, Opname, Mutasi
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

/* ---------------- Produk & Resep ---------------- */
App.Views.products = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'menu';

  function draw() {
    const oid = App.State.outletId() === 'ALL' ? DB.all('outlets')[0].id : App.State.outletId();
    const cats = DB.all('categories');
    const menu = DB.all('products').filter(p => p.type === 'product');
    const mats = DB.all('products').filter(p => p.type === 'material');
    const rows = tab === 'menu' ? menu : mats;

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Produk & Resep</h2><p>Kelola menu, varian, resep (bahan baku), harga jual, dan HPP otomatis</p></div>
        <div class="page-head__actions">
          <button class="btn" id="btn-cat">🗂️ Kategori</button>
          <button class="btn" id="btn-mod">➕ Modifier / Extra</button>
          <button class="btn btn--primary" id="btn-new">+ ${tab === 'menu' ? 'Menu Baru' : 'Bahan Baku'}</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Menu', icon:'🍽️', value:U.num(menu.length), sub:`${cats.filter(c=>!c.isMaterial).length} kategori` })}
        ${App.UI.stat({ label:'Bahan Baku', icon:'📦', value:U.num(mats.length), sub:'item persediaan' })}
        ${App.UI.stat({ label:'Nilai Persediaan', icon:'💰', value:U.rp(App.Inv.stockValue(oid)), sub:'outlet aktif' })}
        ${App.UI.stat({ label:'Margin Rata-rata', icon:'📈',
          value: (() => { const ms = menu.map(p => App.Inv.margin(p, oid).pct).filter(x => isFinite(x));
            return (U.sum(ms) / (ms.length || 1)).toFixed(1).replace('.', ',') + '%'; })(), sub:'seluruh menu' })}
      </div>
      <div id="tabs"></div><div id="table"></div>`;

    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'menu', label:'Menu Jual', count:menu.length },
      { key:'material', label:'Bahan Baku', count:mats.length }
    ], tab, k => { tab = k; draw(); }));

    root.querySelector('#btn-new').onclick = () => productForm(null, tab === 'menu' ? 'product' : 'material');
    root.querySelector('#btn-cat').onclick = categoryManager;
    root.querySelector('#btn-mod').onclick = modifierManager;

    const cols = tab === 'menu' ? [
      { key:'name', label:'Menu', render:p => `<div class="flex items-center gap-8">
          <span class="thumb">${p.emoji || '🍽️'}</span>
          <div><b>${U.esc(p.name)}</b><div class="small muted">${U.esc(p.sku)} · ${U.esc((DB.find('categories', p.categoryId)||{}).name || '-')}</div></div></div>` },
      { key:'price', label:'Harga Jual', align:'right', render:p => U.rp(p.price), sortValue:p => p.price },
      { key:'cost', label:'HPP (Resep)', align:'right', render:p => U.rp(App.Inv.recipeCost(p.id, oid)), sortValue:p => App.Inv.recipeCost(p.id, oid) },
      { key:'margin', label:'Margin', align:'right', render:p => {
          const m = App.Inv.margin(p, oid);
          return `<b style="color:${m.pct > 60 ? 'var(--lime)' : m.pct > 35 ? 'var(--amber)' : 'var(--rose)'}">${m.pct.toFixed(0)}%</b>
                  <div class="small muted">${U.rp(m.profit)}</div>`; },
          sortValue:p => App.Inv.margin(p, oid).pct },
      { key:'recipe', label:'Resep', render:p => `${(p.recipe||[]).length} bahan`, sortValue:p => (p.recipe||[]).length },
      { key:'avail', label:'Bisa Dibuat', align:'right', render:p => {
          const a = App.Inv.available(p.id, oid);
          return a === Infinity ? '<span class="muted">∞</span>'
            : `<b style="color:${a <= 0 ? 'var(--rose)' : a <= 5 ? 'var(--amber)' : ''}">${U.num(a)}</b> porsi`; },
          sortValue:p => { const a = App.Inv.available(p.id, oid); return a === Infinity ? 99999 : a; } },
      { key:'active', label:'Status', render:p => App.UI.badge(p.active !== false ? 'Aktif' : 'Nonaktif', p.active !== false ? 'green' : '') }
    ] : [
      { key:'name', label:'Bahan Baku', render:p => `<b>${U.esc(p.name)}</b><div class="small muted">${U.esc(p.sku)}</div>` },
      { key:'unit', label:'Satuan', render:p => U.esc(p.unit) },
      { key:'cost', label:'Harga Modal', align:'right', render:p => U.rp(App.Inv.avgCost(oid, p.id)) + `<div class="small muted">rata-rata</div>`, sortValue:p => p.cost },
      { key:'qty', label:'Stok Outlet', align:'right', render:p => {
          const q = App.Inv.qty(oid, p.id);
          return `<b style="color:${q <= 0 ? 'var(--rose)' : q <= p.minStock ? 'var(--amber)' : ''}">${U.num(q, 1)}</b> ${U.esc(p.unit)}`; },
          sortValue:p => App.Inv.qty(oid, p.id) },
      { key:'minStock', label:'Min. Stok', align:'right', render:p => U.num(p.minStock, 1) },
      { key:'value', label:'Nilai', align:'right', render:p => U.rp(App.Inv.qty(oid, p.id) * App.Inv.avgCost(oid, p.id)),
        sortValue:p => App.Inv.qty(oid, p.id) * App.Inv.avgCost(oid, p.id) },
      { key:'usage', label:'Dipakai di', render:p => {
          const n = DB.all('products').filter(x => (x.recipe||[]).some(r => r.materialId === p.id)).length;
          return n ? `${n} menu` : '<span class="muted">-</span>'; } }
    ];

    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows, cols, exportName: tab === 'menu' ? 'daftar-menu' : 'daftar-bahan-baku',
      pageSize:15, onRowClick: p => productForm(p, p.type),
      searchKeys:['name','sku','barcode']
    }));
  }

  /* ---- form produk ---- */
  function productForm(p, type) {
    const isMenu = type === 'product';
    const cats = DB.all('categories').filter(c => isMenu ? !c.isMaterial : c.isMaterial);
    const mats = DB.all('products').filter(x => x.type === 'material');
    let recipe = p ? U.clone(p.recipe || []) : [];
    let variants = p ? U.clone(p.variants || []) : [];

    const m = App.UI.modal({
      title: p ? 'Ubah ' + p.name : (isMenu ? 'Menu Baru' : 'Bahan Baku Baru'), size:'xl',
      body:`<div id="pf-tabs"></div><div id="pf-body"></div>`,
      footer:`${p ? '<button class="btn btn--danger" data-del style="margin-right:auto">Hapus</button>' : ''}
              <button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Simpan</button>`
    });
    let ptab = 'info';
    const tabsDef = isMenu
      ? [{ key:'info', label:'Informasi' }, { key:'recipe', label:'Resep / BOM' }, { key:'variant', label:'Varian & Opsi' }]
      : [{ key:'info', label:'Informasi' }, { key:'unit', label:'Satuan & Konversi' }];

    function renderTabs() {
      const holder = m.body.querySelector('#pf-tabs');
      holder.innerHTML = '';
      holder.appendChild(App.UI.tabs(tabsDef, ptab, k => { collect(); ptab = k; renderTabs(); renderBody(); }));
    }
    function renderBody() {
      const b = m.body.querySelector('#pf-body');
      if (ptab === 'info') {
        b.innerHTML = App.UI.formHTML([
          { name:'name', label:'Nama', required:true, col:2 },
          { name:'sku', label:'Kode / SKU', required:true },
          { name:'categoryId', label:'Kategori', type:'select', options:cats.map(c => ({ value:c.id, label:c.name })), required:true },
          ...(isMenu ? [
            { name:'price', label:'Harga jual (Rp)', type:'money', required:true },
            { name:'emoji', label:'Ikon (emoji)', value:'🍽️' },
            { name:'station', label:'Stasiun penyajian', type:'select', options:[{value:'dapur',label:'🍳 Dapur'},{value:'bar',label:'☕ Bar'}] },
            { name:'barcode', label:'Barcode' },
            { name:'favorite', label:'Favorit', type:'checkbox', checkLabel:'Tampilkan di tab Favorit kasir' },
            { name:'bestSeller', label:'Best seller', type:'checkbox', checkLabel:'Tandai sebagai best seller' },
            { name:'active', label:'Aktif', type:'checkbox', checkLabel:'Tersedia untuk dijual' }
          ] : [
            { name:'unit', label:'Satuan dasar', required:true, hint:'mis. gr, ml, pcs, butir' },
            { name:'cost', label:'Harga modal per satuan (Rp)', type:'number', step:'0.0001', required:true },
            { name:'minStock', label:'Stok minimum (peringatan)', type:'number' },
            { name:'active', label:'Aktif', type:'checkbox', checkLabel:'Bahan masih digunakan' }
          ])
        ], p || { active:true, station:'dapur', emoji:'🍽️', sku: nextSku(isMenu) });
      }
      else if (ptab === 'recipe') {
        b.innerHTML = `
          <p class="small muted mb-12">Resep menentukan bahan yang dipotong otomatis setiap kali menu terjual, sekaligus menghitung HPP.</p>
          <div class="tbl-wrap card mb-12"><table class="tbl">
            <thead><tr><th>Bahan Baku</th><th class="num" style="width:120px">Jumlah</th><th style="width:90px">Satuan</th><th class="num">Biaya</th><th style="width:40px"></th></tr></thead>
            <tbody id="rc-body"></tbody>
            <tfoot><tr><td colspan="3">Total HPP per porsi</td><td class="num" id="rc-total">Rp 0</td><td></td></tr></tfoot>
          </table></div>
          <button class="btn btn--sm" id="rc-add">+ Tambah Bahan</button>`;
        renderRecipe();
      }
      else if (ptab === 'variant') {
        b.innerHTML = `
          <p class="small muted mb-12">Varian menambah pilihan saat transaksi, misalnya ukuran Regular/Large dengan selisih harga.</p>
          <div id="vr-list"></div>
          <button class="btn btn--sm mt-8" id="vr-add">+ Grup Varian</button>`;
        renderVariants();
      }
      else if (ptab === 'unit') {
        b.innerHTML = `
          <p class="small muted mb-12">Satuan konversi memudahkan pembelian dalam satuan besar (mis. beli per kg, pakai per gram).</p>
          <div id="un-list"></div><button class="btn btn--sm mt-8" id="un-add">+ Satuan</button>`;
        renderUnits();
      }
    }
    function renderRecipe() {
      const body = m.body.querySelector('#rc-body');
      if (!body) return;
      body.innerHTML = recipe.map((r, i) => {
        const mat = DB.find('products', r.materialId) || {};
        return `<tr>
          <td><select class="select" data-rm="${i}">${mats.map(x =>
            `<option value="${x.id}" ${x.id === r.materialId ? 'selected' : ''}>${U.esc(x.name)}</option>`).join('')}</select></td>
          <td><input class="input input--num" type="number" step="0.01" value="${r.qty}" data-rq="${i}"></td>
          <td class="small">${U.esc(mat.unit || '')}</td>
          <td class="num">${U.rp((r.qty || 0) * App.Inv.avgCost(App.State.outletId(), r.materialId))}</td>
          <td><button class="citem__x" data-rd="${i}">✕</button></td></tr>`;
      }).join('') || `<tr><td colspan="5" class="center muted small" style="padding:18px">Belum ada bahan. Menu tanpa resep tidak memotong stok.</td></tr>`;
      const total = U.sum(recipe, r => (r.qty || 0) * App.Inv.avgCost(App.State.outletId(), r.materialId));
      m.body.querySelector('#rc-total').textContent = U.rp(total);
      body.querySelectorAll('[data-rm]').forEach(s => s.onchange = e => { recipe[+s.dataset.rm].materialId = e.target.value; renderRecipe(); });
      body.querySelectorAll('[data-rq]').forEach(s => s.oninput = e => { recipe[+s.dataset.rq].qty = Number(e.target.value) || 0; });
      body.querySelectorAll('[data-rq]').forEach(s => s.onchange = () => renderRecipe());
      body.querySelectorAll('[data-rd]').forEach(s => s.onclick = () => { recipe.splice(+s.dataset.rd, 1); renderRecipe(); });
      m.body.querySelector('#rc-add').onclick = () => { recipe.push({ materialId:mats[0].id, qty:1, unit:mats[0].unit }); renderRecipe(); };
    }
    function renderVariants() {
      const box = m.body.querySelector('#vr-list');
      if (!box) return;
      box.innerHTML = variants.map((v, vi) => `
        <div class="card mb-12"><div class="card__body">
          <div class="flex gap-8 items-center mb-8">
            <input class="input" value="${U.esc(v.name)}" data-vn="${vi}" placeholder="Nama grup, mis. Ukuran" style="flex:1">
            <button class="btn btn--sm btn--danger" data-vd="${vi}">Hapus grup</button>
          </div>
          ${v.options.map((o, oi) => `<div class="flex gap-8 mb-8">
            <input class="input" value="${U.esc(o.name)}" data-on="${vi}-${oi}" placeholder="Nama opsi" style="flex:1">
            <input class="input input--num" type="number" value="${o.priceDelta}" data-op="${vi}-${oi}" placeholder="Selisih harga" style="width:150px">
            <button class="citem__x" data-od="${vi}-${oi}">✕</button></div>`).join('')}
          <button class="btn btn--sm" data-oa="${vi}">+ Opsi</button>
        </div></div>`).join('') || '<div class="empty small">Belum ada varian</div>';
      box.querySelectorAll('[data-vn]').forEach(i => i.oninput = e => variants[+i.dataset.vn].name = e.target.value);
      box.querySelectorAll('[data-vd]').forEach(b => b.onclick = () => { variants.splice(+b.dataset.vd, 1); renderVariants(); });
      box.querySelectorAll('[data-on]').forEach(i => i.oninput = e => { const [v, o] = i.dataset.on.split('-'); variants[v].options[o].name = e.target.value; });
      box.querySelectorAll('[data-op]').forEach(i => i.oninput = e => { const [v, o] = i.dataset.op.split('-'); variants[v].options[o].priceDelta = Number(e.target.value) || 0; });
      box.querySelectorAll('[data-od]').forEach(b => b.onclick = () => { const [v, o] = b.dataset.od.split('-'); variants[v].options.splice(o, 1); renderVariants(); });
      box.querySelectorAll('[data-oa]').forEach(b => b.onclick = () => { variants[+b.dataset.oa].options.push({ name:'Opsi', priceDelta:0 }); renderVariants(); });
      m.body.querySelector('#vr-add').onclick = () => { variants.push({ name:'Grup Baru', options:[{ name:'Opsi 1', priceDelta:0 }] }); renderVariants(); };
    }
    function renderUnits() {
      const box = m.body.querySelector('#un-list');
      if (!box) return;
      const units = (p && p.units) || [{ name:(p && p.unit) || 'pcs', factor:1 }];
      box.innerHTML = units.map((u, i) => `<div class="flex gap-8 mb-8">
        <input class="input" value="${U.esc(u.name)}" data-un="${i}" style="flex:1">
        <input class="input input--num" type="number" value="${u.factor}" data-uf="${i}" style="width:150px">
        <span class="small muted" style="align-self:center">× satuan dasar</span></div>`).join('');
      m.body.querySelector('#un-add').onclick = () => {
        if (p) { p.units = [...units, { name:'satuan', factor:1 }]; renderUnits(); }
      };
      box.querySelectorAll('[data-un]').forEach(i => i.oninput = e => units[+i.dataset.un].name = e.target.value);
      box.querySelectorAll('[data-uf]').forEach(i => i.oninput = e => units[+i.dataset.uf].factor = Number(e.target.value) || 1);
    }

    let formCache = {};
    function collect() {
      const f = m.body.querySelector('#pf-body [name]');
      if (f) Object.assign(formCache, App.UI.readForm(m.body.querySelector('#pf-body')));
    }
    function nextSku(menu) {
      const pre = menu ? 'MN-' : 'BB-';
      const n = DB.all('products').filter(x => (x.sku || '').startsWith(pre)).length + 1;
      return pre + String(n).padStart(3, '0');
    }

    renderTabs(); renderBody();
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      collect();
      const d = formCache;
      if (!d.name) return App.UI.toast('Nama wajib diisi', 'warn');
      const payload = {
        ...d, type, recipe, variants,
        trackStock: type === 'material',
        unit: type === 'material' ? (d.unit || 'pcs') : 'porsi',
        price: Number(d.price) || 0, cost: Number(d.cost) || 0, minStock: Number(d.minStock) || 0,
        modifierGroups: p ? p.modifierGroups : ['Tambahan'],
        outletIds: p ? p.outletIds : ['ALL']
      };
      if (p) DB.update('products', p.id, payload);
      else {
        const np = DB.insert('products', payload);
        if (type === 'material') DB.all('outlets').forEach(o =>
          DB.insert('stock', { outletId:o.id, productId:np.id, qty:0, avgCost:payload.cost }));
      }
      App.UI.toast('Produk disimpan', 'ok');
      m.close(); draw();
    };
    const del = m.el.querySelector('[data-del]');
    if (del) del.onclick = async () => {
      const used = DB.all('products').filter(x => (x.recipe||[]).some(r => r.materialId === p.id));
      if (used.length) return App.UI.toast(`Tidak bisa dihapus, dipakai di ${used.length} resep`, 'err');
      if (await App.UI.confirm(`Hapus <b>${U.esc(p.name)}</b>? Riwayat transaksi tetap tersimpan.`, { danger:true })) {
        DB.remove('products', p.id);
        DB.removeWhere('stock', s => s.productId === p.id);
        m.close(); draw(); App.UI.toast('Produk dihapus', 'ok');
      }
    };
  }

  function categoryManager() {
    const cats = DB.all('categories');
    const m = App.UI.modal({ title:'Kategori Produk', size:'lg', body:`<div id="cat-list"></div>
      <button class="btn btn--sm mt-12" id="cat-add">+ Kategori</button>` });
    const render = () => {
      m.body.querySelector('#cat-list').innerHTML = `<div class="tbl-wrap card"><table class="tbl">
        <thead><tr><th>Ikon</th><th>Nama</th><th>Akun Pendapatan</th><th>Produk</th><th></th></tr></thead>
        <tbody>${DB.all('categories').map(c => `<tr>
          <td style="font-size:19px">${c.icon || '📁'}</td>
          <td><b>${U.esc(c.name)}</b></td>
          <td class="small muted">${U.esc((App.Ledger.byCode(c.revenueAccount) || {}).name || '-')}</td>
          <td>${DB.all('products').filter(p => p.categoryId === c.id).length}</td>
          <td><button class="btn btn--sm" data-ce="${c.id}">Ubah</button></td></tr>`).join('')}
        </tbody></table></div>`;
      m.body.querySelectorAll('[data-ce]').forEach(b => b.onclick = () => catForm(DB.find('categories', b.dataset.ce)));
    };
    const catForm = c => App.UI.formModal({
      title: c ? 'Ubah Kategori' : 'Kategori Baru',
      fields:[
        { name:'name', label:'Nama kategori', required:true },
        { name:'icon', label:'Ikon (emoji)', value:'📁' },
        { name:'revenueAccount', label:'Akun pendapatan', type:'select', col:2,
          options: DB.all('accounts').filter(a => a.type === 'revenue' && !a.isGroup).map(a => ({ value:a.code, label:`${a.code} — ${a.name}` })) },
        { name:'isMaterial', label:'Bahan baku', type:'checkbox', checkLabel:'Kategori ini berisi bahan baku (bukan menu jual)' }
      ],
      values: c || {},
      onSubmit(d) { c ? DB.update('categories', c.id, d) : DB.insert('categories', d); render(); draw(); }
    });
    m.body.querySelector('#cat-add').onclick = () => catForm(null);
    render();
  }

  function modifierManager() {
    const m = App.UI.modal({ title:'Modifier / Extra', subtitle:'Tambahan yang bisa dipilih saat transaksi', size:'lg',
      body:`<div id="mod-list"></div><button class="btn btn--sm mt-12" id="mod-add">+ Modifier</button>` });
    const mats = DB.all('products').filter(p => p.type === 'material');
    const render = () => {
      const mods = DB.settings().modifiers || [];
      m.body.querySelector('#mod-list').innerHTML = `<div class="tbl-wrap card"><table class="tbl">
        <thead><tr><th>Grup</th><th>Nama</th><th class="num">Harga</th><th>Potong Bahan</th><th></th></tr></thead>
        <tbody>${mods.map((x, i) => `<tr><td>${U.esc(x.group)}</td><td><b>${U.esc(x.name)}</b></td>
          <td class="num">${U.rp(x.price)}</td>
          <td class="small muted">${x.materialId ? U.esc((DB.find('products', x.materialId)||{}).name) + ' × ' + x.qty : '—'}</td>
          <td><button class="citem__x" data-md="${i}">✕</button></td></tr>`).join('')}</tbody></table></div>`;
      m.body.querySelectorAll('[data-md]').forEach(b => b.onclick = () => {
        const mods2 = DB.settings().modifiers; mods2.splice(+b.dataset.md, 1);
        DB.setSetting('modifiers', mods2); render();
      });
    };
    m.body.querySelector('#mod-add').onclick = () => App.UI.formModal({
      title:'Modifier Baru',
      fields:[
        { name:'name', label:'Nama', required:true },
        { name:'group', label:'Grup', required:true, value:'Tambahan' },
        { name:'price', label:'Harga tambahan (Rp)', type:'money', value:0 },
        { name:'materialId', label:'Potong bahan baku', type:'select',
          options:[{ value:'', label:'— tidak memotong stok —' }, ...mats.map(x => ({ value:x.id, label:x.name }))] },
        { name:'qty', label:'Jumlah bahan', type:'number', value:0 }
      ],
      onSubmit(d) {
        const mods = DB.settings().modifiers || [];
        mods.push({ id:U.uid('mod'), ...d, materialId:d.materialId || null });
        DB.setSetting('modifiers', mods); render();
      }
    });
    render();
  }
  draw();
};

/* ---------------- Stok & Opname ---------------- */
App.Views.stock = function (root) {
  const U = App.U, DB = App.DB;

  function draw() {
    const oid = App.State.outletId() === 'ALL' ? DB.all('outlets')[0].id : App.State.outletId();
    const mats = DB.all('products').filter(p => p.type === 'material' && p.active !== false);
    const low = App.Inv.lowStockList(oid);
    const rows = mats.map(p => {
      const q = App.Inv.qty(oid, p.id);
      const cost = App.Inv.avgCost(oid, p.id);
      return { p, qty:q, cost, value:q * cost, min:p.minStock,
        status: q <= 0 ? 'habis' : q <= p.minStock ? 'menipis' : q <= p.minStock * 2 ? 'perhatian' : 'aman' };
    });

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Stok & Opname</h2><p>Posisi persediaan ${U.esc((DB.find('outlets', oid)||{}).name)} · metode HPP rata-rata bergerak</p></div>
        <div class="page-head__actions">
          <button class="btn" id="btn-in">📥 Stok Masuk</button>
          <button class="btn" id="btn-waste">🗑️ Stok Terbuang</button>
          <button class="btn" id="btn-transfer">↔️ Mutasi Antar Outlet</button>
          <button class="btn" id="btn-produce">🏭 Produksi</button>
          <button class="btn btn--primary" id="btn-opname">📋 Stok Opname</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Nilai Persediaan', icon:'💰', value:U.rp(U.sum(rows, r => r.value)), sub:`${rows.length} item bahan` })}
        ${App.UI.stat({ label:'Stok Habis', icon:'🔴', value:U.num(rows.filter(r=>r.status==='habis').length), sub:'perlu pembelian segera', tone:'var(--rose)' })}
        ${App.UI.stat({ label:'Stok Menipis', icon:'🟠', value:U.num(low.length), sub:'di bawah minimum', tone:'var(--amber)' })}
        ${App.UI.stat({ label:'Perputaran 7 Hari', icon:'🔄', value:U.rp(Math.abs(U.sum(DB.all('stockMoves').filter(m =>
            m.outletId === oid && m.type === 'sale' && U.ymd(m.date) >= U.addDays(U.today(), -6)), m => m.value))), sub:'nilai bahan terpakai' })}
      </div>
      ${low.length ? `<div class="card mb-16" style="border-color:var(--amber)">
        <div class="card__head"><h3>⚠️ Perlu Segera Dibeli</h3>
          <button class="btn btn--sm btn--primary" id="auto-po" style="margin-left:auto">Buat PO Otomatis</button></div>
        <div class="card__body"><div class="pill-row">${low.map(r =>
          `<span class="badge ${r.qty <= 0 ? 'badge--red' : 'badge--amber'}">${U.esc(r.product.name)}: ${U.num(r.qty,1)} ${U.esc(r.product.unit)}</span>`).join('')}</div></div>
      </div>` : ''}
      <div id="table"></div>`;

    root.querySelector('#btn-in').onclick = () => stockInForm(oid);
    root.querySelector('#btn-waste').onclick = () => wasteForm(oid);
    root.querySelector('#btn-transfer').onclick = () => transferForm(oid);
    root.querySelector('#btn-produce').onclick = () => produceForm(oid);
    root.querySelector('#btn-opname').onclick = () => opnameForm(oid);
    const apo = root.querySelector('#auto-po');
    if (apo) apo.onclick = () => App.Procure.autoPO(oid, low);

    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows, exportName:'kartu-stok', pageSize:20,
      searchKeys:[], search:false,
      toolbar:`<div class="search" style="max-width:none;flex:1"><input class="input" id="st-q" placeholder="Cari bahan baku…"></div>`,
      onRowClick: r => stockCard(r.p, oid),
      cols:[
        { key:'nama', label:'Bahan Baku', render:r => `<b>${U.esc(r.p.name)}</b><div class="small muted">${U.esc(r.p.sku)}</div>`, sortValue:r => r.p.name },
        { key:'qty', label:'Stok Saat Ini', align:'right', render:r => `<b>${U.num(r.qty, 1)}</b> ${U.esc(r.p.unit)}`, sortValue:r => r.qty },
        { key:'min', label:'Min.', align:'right', render:r => U.num(r.min, 1) },
        { key:'cost', label:'HPP Rata-rata', align:'right', render:r => U.rp(r.cost), sortValue:r => r.cost },
        { key:'value', label:'Nilai Persediaan', align:'right', render:r => U.rp(r.value), sortValue:r => r.value },
        { key:'status', label:'Status', render:r => App.UI.badge(U.titleCase(r.status),
            r.status === 'habis' ? 'red' : r.status === 'menipis' ? 'amber' : r.status === 'perhatian' ? 'blue' : 'green') },
        { key:'aksi', label:'', render:r => `<button class="btn btn--sm" data-adj="${r.p.id}">Sesuaikan</button>`, sortable:false }
      ]
    }));
    const q = root.querySelector('#st-q');
    if (q) q.oninput = U.debounce(() => draw(), 400);
    root.querySelectorAll('[data-adj]').forEach(b => b.onclick = e => {
      e.stopPropagation();
      const p = DB.find('products', b.dataset.adj);
      App.UI.formModal({
        title:'Sesuaikan Stok — ' + p.name,
        fields:[
          { name:'qty', label:`Stok fisik hasil hitung (${p.unit})`, type:'number', step:'0.01', value:App.Inv.qty(oid, p.id), required:true },
          { name:'note', label:'Keterangan', col:2, value:'Penyesuaian manual' }
        ],
        onSubmit(d) {
          App.Inv.opname(oid, p.id, d.qty, d.note);
          App.UI.toast('Stok disesuaikan & selisih terposting ke jurnal', 'ok'); draw();
        }
      });
    });
  }

  function stockCard(p, oid) {
    const moves = U.sortBy(DB.all('stockMoves').filter(m => m.productId === p.id && m.outletId === oid), m => m.date, 'desc').slice(0, 60);
    App.UI.modal({
      title:'Kartu Stok — ' + p.name, size:'xl',
      subtitle:`${U.num(App.Inv.qty(oid, p.id), 2)} ${p.unit} · HPP rata-rata ${U.rp(App.Inv.avgCost(oid, p.id))}`,
      body:`<div class="grid g3 mb-16">
          ${App.UI.stat({ label:'Stok Saat Ini', value:U.num(App.Inv.qty(oid, p.id), 1) + ' ' + p.unit })}
          ${App.UI.stat({ label:'Nilai', value:U.rp(App.Inv.qty(oid, p.id) * App.Inv.avgCost(oid, p.id)) })}
          ${App.UI.stat({ label:'Dipakai di', value:DB.all('products').filter(x => (x.recipe||[]).some(r => r.materialId === p.id)).length + ' menu' })}
        </div>
        <div class="tbl-wrap card"><table class="tbl">
          <thead><tr><th>Waktu</th><th>Jenis</th><th>Referensi</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Saldo</th><th class="num">Nilai</th></tr></thead>
          <tbody>${moves.map(mv => `<tr>
            <td class="small">${U.fmtDateTime(mv.date)}</td>
            <td>${App.UI.badge(({ in:'Masuk', sale:'Terjual', waste:'Terbuang', opname:'Opname', transfer:'Mutasi', production:'Produksi', return:'Retur', adjust:'Sesuai' })[mv.type] || mv.type,
                 mv.qty > 0 ? 'green' : 'amber')}</td>
            <td class="small">${U.esc(mv.ref || mv.note || '-')}</td>
            <td class="num">${mv.qty > 0 ? U.num(mv.qty, 1) : ''}</td>
            <td class="num">${mv.qty < 0 ? U.num(-mv.qty, 1) : ''}</td>
            <td class="num">${U.num(mv.after, 1)}</td>
            <td class="num">${U.rp(mv.value)}</td></tr>`).join('')
            || '<tr><td colspan="7" class="center muted" style="padding:20px">Belum ada mutasi</td></tr>'}
          </tbody></table></div>`
    });
  }

  function pickMaterialsForm(title, oid, cb, opts = {}) {
    const mats = DB.all('products').filter(p => p.type === 'material');
    let lines = [{ productId:mats[0].id, qty:0, price:mats[0].cost }];
    const m = App.UI.modal({
      title, size:'lg',
      body:`<div class="tbl-wrap card mb-12"><table class="tbl">
        <thead><tr><th>Bahan</th><th class="num" style="width:120px">Jumlah</th>
        ${opts.withPrice ? '<th class="num" style="width:140px">Harga/satuan</th>' : ''}<th style="width:40px"></th></tr></thead>
        <tbody id="ln-body"></tbody></table></div>
        <button class="btn btn--sm" id="ln-add">+ Baris</button>
        <div class="field mt-12"><label>Keterangan</label><input class="input" id="ln-note" value="${U.esc(opts.note || '')}"></div>`,
      footer:`<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Simpan</button>`
    });
    const render = () => {
      m.body.querySelector('#ln-body').innerHTML = lines.map((l, i) => {
        const p = DB.find('products', l.productId) || {};
        return `<tr>
          <td><select class="select" data-lp="${i}">${mats.map(x => `<option value="${x.id}" ${x.id === l.productId ? 'selected' : ''}>${U.esc(x.name)} (${U.esc(x.unit)})</option>`).join('')}</select>
            <div class="small muted">stok kini: ${U.num(App.Inv.qty(oid, l.productId), 1)} ${U.esc(p.unit || '')}</div></td>
          <td><input class="input input--num" type="number" step="0.01" value="${l.qty}" data-lq="${i}"></td>
          ${opts.withPrice ? `<td><input class="input input--num" type="number" step="0.0001" value="${l.price}" data-lc="${i}"></td>` : ''}
          <td><button class="citem__x" data-ld="${i}">✕</button></td></tr>`;
      }).join('');
      m.body.querySelectorAll('[data-lp]').forEach(s => s.onchange = e => {
        lines[+s.dataset.lp].productId = e.target.value;
        lines[+s.dataset.lp].price = (DB.find('products', e.target.value) || {}).cost || 0; render();
      });
      m.body.querySelectorAll('[data-lq]').forEach(s => s.oninput = e => lines[+s.dataset.lq].qty = Number(e.target.value) || 0);
      m.body.querySelectorAll('[data-lc]').forEach(s => s.oninput = e => lines[+s.dataset.lc].price = Number(e.target.value) || 0);
      m.body.querySelectorAll('[data-ld]').forEach(s => s.onclick = () => { lines.splice(+s.dataset.ld, 1); render(); });
    };
    m.body.querySelector('#ln-add').onclick = () => { lines.push({ productId:mats[0].id, qty:0, price:mats[0].cost }); render(); };
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const valid = lines.filter(l => l.qty > 0);
      if (!valid.length) return App.UI.toast('Isi jumlah minimal satu baris', 'warn');
      cb(valid, m.body.querySelector('#ln-note').value);
      m.close(); draw();
    };
    render();
  }

  const stockInForm = oid => pickMaterialsForm('Stok Masuk (tanpa PO)', oid, (lines, note) => {
    lines.forEach(l => App.Inv.move({ outletId:oid, productId:l.productId, delta:l.qty, unitCost:l.price,
      type:'in', ref:'MANUAL', note: note || 'Stok masuk manual' }));
    const val = U.sum(lines, l => l.qty * l.price);
    App.Ledger.post({ date:U.today(), ref:'STOK-MASUK', refType:'stockIn', memo: note || 'Stok masuk manual',
      outletId:oid, source:'inventory',
      lines:[{ code:App.Ledger.A.INV_MATERIAL, debit:val }, { code:App.Ledger.A.CASH_MAIN, credit:val }] });
    App.UI.toast('Stok masuk dicatat & terposting ke jurnal', 'ok');
  }, { withPrice:true, note:'Pembelian langsung / stok masuk manual' });

  const wasteForm = oid => pickMaterialsForm('Catat Stok Terbuang', oid, (lines, note) => {
    lines.forEach(l => App.Inv.waste(oid, l.productId, l.qty, note || 'Bahan rusak/kadaluarsa'));
    App.UI.toast('Stok terbuang dicatat sebagai beban kerugian persediaan', 'ok');
  }, { note:'Bahan rusak / kadaluarsa / tumpah' });

  const produceForm = oid => {
    const prods = DB.all('products').filter(p => (p.recipe || []).length);
    App.UI.formModal({
      title:'Produksi Stok', subtitle:'Ubah bahan baku menjadi produk jadi (mis. adonan, sirup house-made)',
      fields:[
        { name:'productId', label:'Produk hasil', type:'select', required:true, col:2,
          options: prods.map(p => ({ value:p.id, label:p.name })) },
        { name:'qty', label:'Jumlah hasil produksi', type:'number', step:'0.01', required:true },
        { name:'note', label:'Keterangan' }
      ],
      onSubmit(d) {
        const r = App.Inv.produce(oid, d.productId, d.qty, d.note);
        App.UI.toast(`Produksi selesai. HPP per unit ${U.rp(r.unitCost)}`, 'ok'); draw();
      }
    });
  };

  const transferForm = oid => {
    const outlets = DB.all('outlets').filter(o => o.id !== oid);
    const mats = DB.all('products').filter(p => p.type === 'material');
    App.UI.formModal({
      title:'Mutasi Stok Antar Outlet', size:'lg',
      fields:[
        { name:'toOutlet', label:'Outlet tujuan', type:'select', required:true, col:2,
          options: outlets.map(o => ({ value:o.id, label:o.name })) },
        { name:'productId', label:'Bahan', type:'select', required:true, col:2,
          options: mats.map(p => ({ value:p.id, label:`${p.name} (stok ${U.num(App.Inv.qty(oid, p.id),1)} ${p.unit})` })) },
        { name:'qty', label:'Jumlah', type:'number', step:'0.01', required:true },
        { name:'note', label:'Catatan' }
      ],
      validate(d) {
        if (d.qty > App.Inv.qty(oid, d.productId)) return 'Jumlah melebihi stok tersedia';
        return null;
      },
      onSubmit(d) {
        App.Inv.transfer(oid, d.toOutlet, d.productId, d.qty, d.note);
        App.UI.toast('Mutasi stok berhasil', 'ok'); draw();
      }
    });
  };

  const opnameForm = oid => {
    const mats = DB.all('products').filter(p => p.type === 'material' && p.active !== false);
    const m = App.UI.modal({
      title:'Stok Opname', subtitle:'Masukkan hasil hitung fisik — selisih otomatis dijurnal', size:'xl',
      body:`<div class="tbl-wrap card"><table class="tbl">
        <thead><tr><th>Bahan</th><th class="num">Stok Sistem</th><th class="num" style="width:130px">Hitung Fisik</th>
        <th class="num">Selisih</th><th class="num">Nilai Selisih</th></tr></thead>
        <tbody>${mats.map(p => {
          const q = App.Inv.qty(oid, p.id);
          return `<tr data-p="${p.id}">
            <td><b>${U.esc(p.name)}</b><div class="small muted">${U.esc(p.unit)}</div></td>
            <td class="num sys">${U.num(q, 2)}</td>
            <td><input class="input input--num op-in" type="number" step="0.01" placeholder="${U.num(q,2)}"></td>
            <td class="num diff">-</td><td class="num val">-</td></tr>`;
        }).join('')}</tbody></table></div>
        <div class="field mt-12"><label>Catatan opname</label><input class="input" id="op-note" value="Stok opname ${U.fmtDate(U.today())}"></div>`,
      footer:`<span class="muted small" style="margin-right:auto" id="op-sum">Belum ada selisih</span>
              <button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Simpan Opname</button>`
    });
    const upd = () => {
      let total = 0, n = 0;
      m.body.querySelectorAll('tr[data-p]').forEach(tr => {
        const pid = tr.dataset.p;
        const inp = tr.querySelector('.op-in');
        if (inp.value === '') { tr.querySelector('.diff').textContent = '-'; tr.querySelector('.val').textContent = '-'; return; }
        const sys = App.Inv.qty(oid, pid);
        const diff = Number(inp.value) - sys;
        const val = diff * App.Inv.avgCost(oid, pid);
        tr.querySelector('.diff').innerHTML = `<b style="color:${diff < 0 ? 'var(--rose)' : diff > 0 ? 'var(--lime)' : ''}">${U.num(diff, 2)}</b>`;
        tr.querySelector('.val').textContent = U.rp(val);
        if (diff) { total += val; n++; }
      });
      m.el.querySelector('#op-sum').textContent = n ? `${n} item selisih · nilai ${U.rp(total)}` : 'Belum ada selisih';
    };
    m.body.querySelectorAll('.op-in').forEach(i => i.oninput = upd);
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const note = m.body.querySelector('#op-note').value;
      let n = 0;
      m.body.querySelectorAll('tr[data-p]').forEach(tr => {
        const inp = tr.querySelector('.op-in');
        if (inp.value === '') return;
        if (App.Inv.opname(oid, tr.dataset.p, Number(inp.value), note)) n++;
      });
      DB.log('inventory.opname', `Stok opname: ${n} item disesuaikan`);
      App.UI.toast(`Opname selesai — ${n} item disesuaikan`, 'ok');
      m.close(); draw();
    };
  };
  draw();
};

/* ---------------- Mutasi stok ---------------- */
App.Views.stockmoves = function (root) {
  const U = App.U, DB = App.DB;
  const state = App.Period.init('week');
  let type = 'all';

  function draw() {
    const oid = App.State.outletId();
    let moves = DB.all('stockMoves').filter(m =>
      (oid === 'ALL' || m.outletId === oid) && U.ymd(m.date) >= state.from && U.ymd(m.date) <= state.to);
    if (type !== 'all') moves = moves.filter(m => m.type === type);
    const summary = App.Inv.movementSummary(oid, state.from, state.to);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Mutasi Stok</h2><p>Seluruh pergerakan persediaan: masuk, terjual, terbuang, opname, mutasi & produksi</p></div>
        <div class="page-head__actions" id="period"></div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Mutasi', icon:'🔄', value:U.num(moves.length), sub:'baris pergerakan' })}
        ${App.UI.stat({ label:'Nilai Masuk', icon:'📥', value:U.rp(U.sum(moves.filter(m=>m.qty>0), m=>m.value)), sub:'pembelian & produksi' })}
        ${App.UI.stat({ label:'Nilai Keluar', icon:'📤', value:U.rp(Math.abs(U.sum(moves.filter(m=>m.qty<0), m=>m.value))), sub:'terjual & terpakai' })}
        ${App.UI.stat({ label:'Kerugian Terbuang', icon:'🗑️', value:U.rp(Math.abs(U.sum(moves.filter(m=>m.type==='waste'), m=>m.value))), sub:'stok rusak/hilang', tone:'var(--rose)' })}
      </div>
      <div class="pill-row mb-16" id="types">
        ${[['all','Semua'],['in','Masuk'],['sale','Terjual'],['waste','Terbuang'],['opname','Opname'],['transfer','Mutasi'],['production','Produksi']]
          .map(([k, l]) => `<button class="pill ${type===k?'is-active':''}" data-t="${k}">${l}</button>`).join('')}
      </div>
      <div class="grid g-2-1">
        <div id="table"></div>
        <div class="card">
          <div class="card__head"><h3>Ringkasan per Bahan</h3></div>
          <div class="card__body" style="max-height:520px;overflow:auto">
            ${App.Chart.hbar(summary.slice(0, 12).map(s => ({ label:s.nama, value:Math.abs(s.terjual) })), { unit:'' })}
          </div>
        </div>
      </div>`;

    root.querySelector('#period').appendChild(App.Period.bar(state, draw));
    root.querySelectorAll('#types [data-t]').forEach(b => b.onclick = () => { type = b.dataset.t; draw(); });

    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:U.sortBy(moves, m => m.date, 'desc'), exportName:'mutasi-stok', pageSize:20, search:false,
      cols:[
        { key:'date', label:'Waktu', render:m => U.fmtDateTime(m.date) },
        { key:'productId', label:'Bahan', render:m => U.esc((DB.find('products', m.productId)||{}).name || '-') },
        { key:'type', label:'Jenis', render:m => App.UI.badge(
            ({ in:'Masuk', sale:'Terjual', waste:'Terbuang', opname:'Opname', transfer:'Mutasi', production:'Produksi', return:'Retur', adjust:'Sesuai' })[m.type] || m.type,
            m.qty > 0 ? 'green' : m.type === 'waste' ? 'red' : 'amber') },
        { key:'qty', label:'Jumlah', align:'right', render:m => `<b style="color:${m.qty<0?'var(--rose)':'var(--lime)'}">${m.qty>0?'+':''}${U.num(m.qty,2)}</b>` },
        { key:'after', label:'Saldo', align:'right', render:m => U.num(m.after, 1) },
        { key:'value', label:'Nilai', align:'right', render:m => U.rp(m.value) },
        { key:'ref', label:'Referensi', render:m => `<span class="small">${U.esc(m.ref || m.note || '-')}</span>` }
      ]
    }));
  }
  draw();
};
