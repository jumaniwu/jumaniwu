/* =============================================================
   SajiPOS — Pusat Laporan & Analisa Bisnis (30+ jenis laporan)
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

App.Views.reports = function (root) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  const state = App.Period.init('month');
  let active = null;

  const GROUPS = [
    { name:'Penjualan', icon:'💰', items:[
      { key:'sales-summary',  label:'Ringkasan Penjualan',        desc:'Omzet, diskon, pajak, laba kotor per hari' },
      { key:'sales-detail',   label:'Detail Transaksi',           desc:'Seluruh transaksi beserta rinciannya' },
      { key:'sales-product',  label:'Penjualan per Produk',       desc:'Kuantitas, omzet, HPP, dan margin tiap menu' },
      { key:'sales-category', label:'Penjualan per Kategori',     desc:'Kontribusi tiap kategori menu' },
      { key:'sales-hour',     label:'Penjualan per Jam',          desc:'Jam ramai & sepi untuk atur shift' },
      { key:'sales-type',     label:'Penjualan per Jenis Order',  desc:'Dine in, bungkus, ojol, online' },
      { key:'sales-channel',  label:'Penjualan per Kanal',        desc:'Kasir vs marketplace vs toko online' },
      { key:'sales-payment',  label:'Rekap Metode Pembayaran',    desc:'Tunai, QRIS, kartu, e-wallet' },
      { key:'sales-cashier',  label:'Penjualan per Kasir',        desc:'Performa tiap kasir' },
      { key:'sales-outlet',   label:'Perbandingan Antar Outlet',  desc:'Omzet & laba tiap cabang' },
      { key:'sales-void',     label:'Void & Refund',              desc:'Audit pembatalan transaksi' },
      { key:'sales-discount', label:'Diskon & Promo',             desc:'Efektivitas tiap promo' }
    ]},
    { name:'Inventori', icon:'📦', items:[
      { key:'inv-position',   label:'Posisi Persediaan',          desc:'Stok & nilai per bahan baku' },
      { key:'inv-movement',   label:'Kartu Mutasi Persediaan',    desc:'Stok awal, masuk, keluar, akhir' },
      { key:'inv-usage',      label:'Pemakaian Bahan Baku',       desc:'Bahan paling banyak terpakai' },
      { key:'inv-waste',      label:'Laporan Stok Terbuang',      desc:'Kerugian dari bahan rusak' },
      { key:'inv-lowstock',   label:'Stok Menipis',               desc:'Daftar bahan yang perlu dibeli' },
      { key:'inv-margin',     label:'Analisa Margin Menu',        desc:'Menu paling menguntungkan' }
    ]},
    { name:'Pembelian', icon:'🛒', items:[
      { key:'buy-po',         label:'Rekap Purchase Order',       desc:'Semua PO dan statusnya' },
      { key:'buy-supplier',   label:'Pembelian per Supplier',     desc:'Nilai pembelian tiap pemasok' },
      { key:'buy-ap',         label:'Umur Hutang Supplier',       desc:'Aging hutang usaha' }
    ]},
    { name:'Keuangan', icon:'📊', items:[
      { key:'fin-pl',         label:'Laba Rugi',                  desc:'Pendapatan, HPP, beban, laba bersih' },
      { key:'fin-bs',         label:'Neraca',                     desc:'Aset, liabilitas, ekuitas' },
      { key:'fin-cf',         label:'Arus Kas',                   desc:'Operasi, investasi, pendanaan' },
      { key:'fin-tb',         label:'Neraca Saldo',               desc:'Saldo seluruh akun' },
      { key:'fin-expense',    label:'Rekap Pengeluaran',          desc:'Biaya per kategori' },
      { key:'fin-tax',        label:'Rekap Pajak (PB1/PPN)',      desc:'Pajak terutang per periode' }
    ]},
    { name:'Karyawan', icon:'👥', items:[
      { key:'hr-attendance',  label:'Rekap Absensi',              desc:'Kehadiran, telat, lembur' },
      { key:'hr-commission',  label:'Komisi Karyawan',            desc:'Komisi dari penjualan' },
      { key:'hr-payroll',     label:'Rekap Payroll',              desc:'Biaya gaji per periode' }
    ]},
    { name:'Pelanggan', icon:'💚', items:[
      { key:'crm-customer',   label:'Analisa Pelanggan',          desc:'Belanja, kunjungan, tier' },
      { key:'crm-retention',  label:'Retensi & Churn',            desc:'Pelanggan aktif vs hilang' },
      { key:'crm-loyalty',    label:'Poin & Stamp Beredar',       desc:'Kewajiban program loyalty' }
    ]}
  ];

  function draw() {
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Pusat Laporan</h2><p>${U.sum(GROUPS, g => g.items.length)} jenis laporan siap ekspor ke Excel/CSV</p></div>
        <div class="page-head__actions" id="period"></div>
      </div>
      ${active ? '<button class="btn mb-16" id="back">← Kembali ke daftar laporan</button><div id="report"></div>'
        : GROUPS.map(g => `<div class="card mb-16">
            <div class="card__head"><h3>${g.icon} ${g.name}</h3><span class="sub">${g.items.length} laporan</span></div>
            <div class="card__body"><div class="grid g3">
              ${g.items.map(i => `<button class="card row-click" data-r="${i.key}" style="text-align:left;cursor:pointer;border:1px solid var(--border);background:var(--surface-2);padding:12px">
                <b style="font-size:13px">${U.esc(i.label)}</b>
                <div class="small muted mt-4">${U.esc(i.desc)}</div></button>`).join('')}
            </div></div></div>`).join('')}`;
    root.querySelector('#period').appendChild(App.Period.bar(state, draw));
    root.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { active = b.dataset.r; draw(); });
    const back = root.querySelector('#back');
    if (back) back.onclick = () => { active = null; draw(); };
    if (active) render(root.querySelector('#report'));
  }

  function table(el, title, rows, cols, extra = '') {
    el.innerHTML = `<div class="page-head"><div><h2>${U.esc(title)}</h2>
      <p>${U.fmtDate(state.from,'long')} – ${U.fmtDate(state.to,'long')} · ${App.State.outletId() === 'ALL' ? 'Semua outlet' : U.esc(App.State.outlet().name)}</p></div></div>${extra}<div id="t"></div>`;
    el.querySelector('#t').appendChild(App.UI.dataTable({
      rows, cols, exportName:U.slug(title), pageSize:25
    }));
  }

  function render(el) {
    const oid = App.State.outletId();
    const orders = App.Sales.orders({ from:state.from, to:state.to, outletId:oid });
    const allOrders = DB.all('orders').filter(o => (oid === 'ALL' || o.outletId === oid) &&
      U.ymd(o.date) >= state.from && U.ymd(o.date) <= state.to);

    switch (active) {
      case 'sales-summary': {
        const daily = App.Sales.byDay(orders, state.from, state.to);
        const g = U.groupBy(orders, o => U.ymd(o.paidAt || o.date));
        const rows = daily.map(d => {
          const list = g[d.date] || [];
          const t = App.Sales.totals(list);
          return { tanggal:U.fmtDate(d.date), hari:U.HARI[new Date(d.date).getDay()], trx:t.trx,
            bruto:t.gross, diskon:t.discount, netto:t.net, pajak:t.tax, service:t.svc,
            total:t.total, hpp:t.cogs, laba:t.profit, margin:t.margin };
        });
        table(el, 'Ringkasan Penjualan Harian', rows, [
          { key:'tanggal', label:'Tanggal' }, { key:'hari', label:'Hari' },
          { key:'trx', label:'Transaksi', align:'right', render:r => U.num(r.trx) },
          { key:'bruto', label:'Bruto', align:'right', render:r => U.rp(r.bruto) },
          { key:'diskon', label:'Diskon', align:'right', render:r => U.rp(r.diskon) },
          { key:'netto', label:'Netto', align:'right', render:r => U.rp(r.netto) },
          { key:'service', label:'Service', align:'right', render:r => U.rp(r.service) },
          { key:'pajak', label:'Pajak', align:'right', render:r => U.rp(r.pajak) },
          { key:'total', label:'Total Diterima', align:'right', render:r => `<b>${U.rp(r.total)}</b>` },
          { key:'hpp', label:'HPP', align:'right', render:r => U.rp(r.hpp) },
          { key:'laba', label:'Laba Kotor', align:'right', render:r => U.rp(r.laba) },
          { key:'margin', label:'Margin', align:'right', render:r => r.margin.toFixed(1).replace('.',',') + '%' }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.line(daily, {})}</div></div>`);
        break;
      }
      case 'sales-detail':
        table(el, 'Detail Transaksi', U.sortBy(allOrders, o => o.date, 'desc').map(o => ({
          no:o.no, waktu:U.fmtDateTime(o.date), jenis:App.POS.TYPE_LABEL[o.type] || o.type,
          meja:o.tableName || '-', pelanggan:o.customerName || 'Umum', item:U.sum(o.items, i => i.qty),
          bruto:o.subtotal, diskon:o.discount, pajak:o.tax, total:o.total, hpp:o.cogs || 0,
          bayar:(o.payments || []).map(p => App.POS.labelOfMethod(p.method)).join(', '),
          kasir:(DB.find('users', o.cashierId) || {}).name || '-', status:o.status
        })), [
          { key:'no', label:'No' }, { key:'waktu', label:'Waktu' }, { key:'jenis', label:'Jenis' },
          { key:'meja', label:'Meja' }, { key:'pelanggan', label:'Pelanggan' },
          { key:'item', label:'Item', align:'right' },
          { key:'bruto', label:'Bruto', align:'right', render:r => U.rp(r.bruto) },
          { key:'diskon', label:'Diskon', align:'right', render:r => U.rp(r.diskon) },
          { key:'total', label:'Total', align:'right', render:r => U.rp(r.total) },
          { key:'bayar', label:'Pembayaran' }, { key:'kasir', label:'Kasir' },
          { key:'status', label:'Status', render:r => App.UI.badge(r.status, r.status === 'paid' ? 'green' : 'red') }
        ]);
        break;
      case 'sales-product': {
        const mix = App.Sales.productMix(orders);
        table(el, 'Penjualan per Produk', mix, [
          { key:'nama', label:'Menu', render:r => `${r.emoji} <b>${U.esc(r.nama)}</b>` },
          { key:'kategori', label:'Kategori' },
          { key:'qty', label:'Terjual', align:'right', render:r => U.num(r.qty) },
          { key:'omzet', label:'Omzet', align:'right', render:r => U.rp(r.omzet) },
          { key:'hpp', label:'HPP', align:'right', render:r => U.rp(r.hpp) },
          { key:'laba', label:'Laba', align:'right', render:r => `<b>${U.rp(r.laba)}</b>` },
          { key:'margin', label:'Margin', align:'right', render:r => r.margin.toFixed(1).replace('.',',') + '%' }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.hbar(mix.slice(0,10).map(x => ({ label:x.nama, value:x.omzet })), { money:true })}</div></div>`);
        break;
      }
      case 'sales-category': {
        const rows = App.Sales.byCategory(orders);
        table(el, 'Penjualan per Kategori', rows, [
          { key:'label', label:'Kategori' },
          { key:'qty', label:'Item Terjual', align:'right', render:r => U.num(r.qty) },
          { key:'value', label:'Omzet', align:'right', render:r => U.rp(r.value) },
          { key:'laba', label:'Laba Kotor', align:'right', render:r => U.rp(r.laba) },
          { key:'kontribusi', label:'Kontribusi', align:'right',
            render:r => U.pct(r.value, U.sum(rows, x => x.value) || 1) }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.donut(rows, { money:true, centerLabel:'Omzet' })}</div></div>`);
        break;
      }
      case 'sales-hour': {
        const rows = App.Sales.byHour(orders);
        table(el, 'Penjualan per Jam', rows.map(r => ({ jam:r.label + ':00', trx:r.trx, omzet:r.value,
          rata:r.trx ? r.value / r.trx : 0 })), [
          { key:'jam', label:'Jam' }, { key:'trx', label:'Transaksi', align:'right', render:r => U.num(r.trx) },
          { key:'omzet', label:'Omzet', align:'right', render:r => U.rp(r.omzet) },
          { key:'rata', label:'Rata-rata', align:'right', render:r => U.rp(r.rata) }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.bar(rows, { height:200 })}</div></div>
            <div class="card mb-16"><div class="card__head"><h3>Peta Jam Ramai (hari × jam)</h3></div>
            <div class="card__body">${App.Chart.heat(App.Sales.heatMatrix(orders))}</div></div>`);
        break;
      }
      case 'sales-type': case 'sales-channel': {
        const rows = active === 'sales-type' ? App.Sales.byType(orders) : App.Sales.byChannel(orders);
        table(el, active === 'sales-type' ? 'Penjualan per Jenis Order' : 'Penjualan per Kanal', rows.map(r => ({
          label:r.label, trx:r.trx, omzet:r.value, rata:r.value / r.trx })), [
          { key:'label', label:active === 'sales-type' ? 'Jenis Order' : 'Kanal' },
          { key:'trx', label:'Transaksi', align:'right', render:r => U.num(r.trx) },
          { key:'omzet', label:'Omzet', align:'right', render:r => U.rp(r.omzet) },
          { key:'rata', label:'Rata-rata', align:'right', render:r => U.rp(r.rata) }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.donut(rows.map(r => ({ label:r.label, value:r.value })), { money:true })}</div></div>`);
        break;
      }
      case 'sales-payment': {
        const rows = App.Sales.byPayment(orders);
        const mdr = DB.settings().pos.mdrRates || {};
        table(el, 'Rekap Metode Pembayaran', rows.map(r => ({ ...r,
          mdr:r.value * (mdr[r.key] || 0) / 100, net:r.value - r.value * (mdr[r.key] || 0) / 100 })), [
          { key:'label', label:'Metode' },
          { key:'value', label:'Nilai Diterima', align:'right', render:r => U.rp(r.value) },
          { key:'mdr', label:'Biaya MDR', align:'right', render:r => U.rp(r.mdr) },
          { key:'net', label:'Net Diterima', align:'right', render:r => `<b>${U.rp(r.net)}</b>` },
          { key:'pct', label:'Porsi', align:'right', render:r => U.pct(r.value, U.sum(rows, x => x.value) || 1) }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.donut(rows, { money:true, centerLabel:'Total' })}</div></div>`);
        break;
      }
      case 'sales-cashier':
        table(el, 'Penjualan per Kasir', App.Sales.byCashier(orders), [
          { key:'nama', label:'Kasir' },
          { key:'trx', label:'Transaksi', align:'right', render:r => U.num(r.trx) },
          { key:'omzet', label:'Omzet', align:'right', render:r => U.rp(r.omzet) },
          { key:'avg', label:'Rata-rata/Transaksi', align:'right', render:r => U.rp(r.avg) }
        ]);
        break;
      case 'sales-outlet': {
        const rows = DB.all('outlets').map(o => {
          const list = App.Sales.orders({ from:state.from, to:state.to, outletId:o.id });
          const t = App.Sales.totals(list);
          const pl = L.profitLoss(state.from, state.to, o.id);
          return { outlet:o.name, tipe:o.type, trx:t.trx, omzet:t.total, netto:t.net, hpp:t.cogs,
            labaKotor:t.profit, beban:pl.totalOpex, labaBersih:pl.netProfit, avg:t.avg };
        });
        table(el, 'Perbandingan Antar Outlet', rows, [
          { key:'outlet', label:'Outlet' }, { key:'tipe', label:'Tipe' },
          { key:'trx', label:'Transaksi', align:'right', render:r => U.num(r.trx) },
          { key:'netto', label:'Omzet Netto', align:'right', render:r => U.rp(r.netto) },
          { key:'hpp', label:'HPP', align:'right', render:r => U.rp(r.hpp) },
          { key:'labaKotor', label:'Laba Kotor', align:'right', render:r => U.rp(r.labaKotor) },
          { key:'beban', label:'Beban Operasional', align:'right', render:r => U.rp(r.beban) },
          { key:'labaBersih', label:'Laba Bersih', align:'right',
            render:r => `<b style="color:${r.labaBersih >= 0 ? 'var(--lime)' : 'var(--rose)'}">${U.rp(r.labaBersih)}</b>` }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.bar(rows.map(r => ({ label:r.outlet.split('—')[1] || r.outlet, value:r.netto })), {})}</div></div>`);
        break;
      }
      case 'sales-void':
        table(el, 'Void & Refund', allOrders.filter(o => ['void','refund'].includes(o.status)).map(o => ({
          no:o.no, waktu:U.fmtDateTime(o.date), total:o.total, status:o.status,
          alasan:o.voidReason || (o.refunds || []).map(r => r.reason).join('; ') || '-',
          kasir:(DB.find('users', o.cashierId) || {}).name || '-',
          otorisasi:(DB.find('users', o.voidBy) || {}).name || '-'
        })), [
          { key:'no', label:'No' }, { key:'waktu', label:'Waktu' },
          { key:'total', label:'Nilai', align:'right', render:r => U.rp(r.total) },
          { key:'status', label:'Status', render:r => App.UI.badge(r.status, 'red') },
          { key:'alasan', label:'Alasan' }, { key:'kasir', label:'Kasir' }, { key:'otorisasi', label:'Diotorisasi' }
        ]);
        break;
      case 'sales-discount': {
        const g = U.groupBy(orders.filter(o => o.promoId), o => o.promoId);
        const rows = Object.entries(g).map(([pid, list]) => {
          const p = DB.find('promos', pid) || {};
          return { promo:p.name || '-', jenis:p.type || '-', dipakai:list.length,
            diskon:U.sum(list, o => o.discount), omzet:U.sum(list, o => o.total),
            rata:U.sum(list, o => o.total) / list.length };
        }).sort((a, b) => b.diskon - a.diskon);
        table(el, 'Efektivitas Diskon & Promo', rows, [
          { key:'promo', label:'Promo' }, { key:'jenis', label:'Jenis' },
          { key:'dipakai', label:'Dipakai', align:'right', render:r => U.num(r.dipakai) },
          { key:'diskon', label:'Nilai Diskon', align:'right', render:r => U.rp(r.diskon) },
          { key:'omzet', label:'Omzet Dihasilkan', align:'right', render:r => U.rp(r.omzet) },
          { key:'roi', label:'Rasio Omzet/Diskon', align:'right', render:r => (r.omzet / (r.diskon || 1)).toFixed(1) + '×' }
        ]);
        break;
      }
      case 'inv-position': {
        const o = oid === 'ALL' ? DB.all('outlets')[0].id : oid;
        table(el, 'Posisi Persediaan', DB.all('products').filter(p => p.type === 'material').map(p => ({
          sku:p.sku, nama:p.name, satuan:p.unit, stok:App.Inv.qty(o, p.id),
          min:p.minStock, hpp:App.Inv.avgCost(o, p.id), nilai:App.Inv.qty(o, p.id) * App.Inv.avgCost(o, p.id)
        })), [
          { key:'sku', label:'SKU' }, { key:'nama', label:'Bahan Baku' }, { key:'satuan', label:'Satuan' },
          { key:'stok', label:'Stok', align:'right', render:r => U.num(r.stok, 2) },
          { key:'min', label:'Min', align:'right', render:r => U.num(r.min, 1) },
          { key:'hpp', label:'HPP Rata-rata', align:'right', render:r => U.rp(r.hpp) },
          { key:'nilai', label:'Nilai', align:'right', render:r => `<b>${U.rp(r.nilai)}</b>` }
        ]);
        break;
      }
      case 'inv-movement':
        table(el, 'Kartu Mutasi Persediaan', App.Inv.movementSummary(oid, state.from, state.to), [
          { key:'nama', label:'Bahan' }, { key:'satuan', label:'Satuan' },
          { key:'awal', label:'Stok Awal', align:'right', render:r => U.num(r.awal, 1) },
          { key:'masuk', label:'Masuk', align:'right', render:r => U.num(r.masuk, 1) },
          { key:'terjual', label:'Terpakai', align:'right', render:r => U.num(r.terjual, 1) },
          { key:'terbuang', label:'Terbuang', align:'right', render:r => U.num(r.terbuang, 1) },
          { key:'akhir', label:'Stok Akhir', align:'right', render:r => `<b>${U.num(r.akhir, 1)}</b>` },
          { key:'nilai', label:'Nilai Akhir', align:'right', render:r => U.rp(r.nilai) }
        ]);
        break;
      case 'inv-usage': {
        const rows = App.Inv.movementSummary(oid, state.from, state.to).filter(r => r.terjual > 0);
        table(el, 'Pemakaian Bahan Baku', rows, [
          { key:'nama', label:'Bahan' },
          { key:'terjual', label:'Terpakai', align:'right', render:r => U.num(r.terjual, 1) + ' ' + r.satuan },
          { key:'nilai', label:'Nilai Sisa', align:'right', render:r => U.rp(r.nilai) }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.hbar(rows.slice(0,12).map(r => ({ label:r.nama, value:r.terjual })), {})}</div></div>`);
        break;
      }
      case 'inv-waste': {
        const moves = DB.all('stockMoves').filter(m => m.type === 'waste' &&
          (oid === 'ALL' || m.outletId === oid) && U.ymd(m.date) >= state.from && U.ymd(m.date) <= state.to);
        table(el, 'Laporan Stok Terbuang', moves.map(m => ({
          tanggal:U.fmtDate(m.date), bahan:(DB.find('products', m.productId) || {}).name || '-',
          qty:Math.abs(m.qty), nilai:Math.abs(m.value), alasan:m.note || '-'
        })), [
          { key:'tanggal', label:'Tanggal' }, { key:'bahan', label:'Bahan' },
          { key:'qty', label:'Jumlah', align:'right', render:r => U.num(r.qty, 2) },
          { key:'nilai', label:'Nilai Kerugian', align:'right', render:r => `<b style="color:var(--rose)">${U.rp(r.nilai)}</b>` },
          { key:'alasan', label:'Keterangan' }
        ]);
        break;
      }
      case 'inv-lowstock': {
        const o = oid === 'ALL' ? DB.all('outlets')[0].id : oid;
        table(el, 'Stok Menipis', App.Inv.lowStockList(o).map(r => ({
          nama:r.product.name, stok:r.qty, min:r.min, satuan:r.product.unit,
          kurang:Math.max(0, r.min - r.qty), estimasi:(r.min * 4 - r.qty) * App.Inv.avgCost(o, r.product.id)
        })), [
          { key:'nama', label:'Bahan' },
          { key:'stok', label:'Stok Kini', align:'right', render:r => `<b style="color:${r.stok <= 0 ? 'var(--rose)' : 'var(--amber)'}">${U.num(r.stok,1)}</b> ${r.satuan}` },
          { key:'min', label:'Minimum', align:'right', render:r => U.num(r.min, 1) },
          { key:'kurang', label:'Kekurangan', align:'right', render:r => U.num(r.kurang, 1) },
          { key:'estimasi', label:'Estimasi Biaya Restok', align:'right', render:r => U.rp(r.estimasi) }
        ]);
        break;
      }
      case 'inv-margin': {
        const o = oid === 'ALL' ? DB.all('outlets')[0].id : oid;
        const sold = U.groupBy(orders.flatMap(x => x.items), i => i.productId);
        table(el, 'Analisa Margin Menu', DB.all('products').filter(p => p.type === 'product').map(p => {
          const mg = App.Inv.margin(p, o);
          const qty = U.sum(sold[p.id] || [], i => i.qty);
          return { nama:p.name, harga:mg.price, hpp:mg.cost, laba:mg.profit, margin:mg.pct,
            terjual:qty, kontribusi:qty * mg.profit };
        }).sort((a, b) => b.kontribusi - a.kontribusi), [
          { key:'nama', label:'Menu' },
          { key:'harga', label:'Harga Jual', align:'right', render:r => U.rp(r.harga) },
          { key:'hpp', label:'HPP', align:'right', render:r => U.rp(r.hpp) },
          { key:'laba', label:'Laba/Porsi', align:'right', render:r => U.rp(r.laba) },
          { key:'margin', label:'Margin', align:'right',
            render:r => `<b style="color:${r.margin > 60 ? 'var(--lime)' : r.margin > 35 ? 'var(--amber)' : 'var(--rose)'}">${r.margin.toFixed(0)}%</b>` },
          { key:'terjual', label:'Terjual', align:'right', render:r => U.num(r.terjual) },
          { key:'kontribusi', label:'Kontribusi Laba', align:'right', render:r => `<b>${U.rp(r.kontribusi)}</b>` }
        ]);
        break;
      }
      case 'buy-po':
        table(el, 'Rekap Purchase Order', DB.all('purchaseOrders').filter(p =>
          (oid === 'ALL' || p.outletId === oid) && p.date >= state.from && p.date <= state.to).map(p => ({
          no:p.no, tanggal:U.fmtDate(p.date), supplier:(DB.find('suppliers', p.supplierId) || {}).name,
          item:p.items.length, total:p.total, status:p.status, tiba:U.fmtDate(p.expectedDate)
        })), [
          { key:'no', label:'No PO' }, { key:'tanggal', label:'Tanggal' }, { key:'supplier', label:'Supplier' },
          { key:'item', label:'Item', align:'right' },
          { key:'total', label:'Nilai', align:'right', render:r => U.rp(r.total) },
          { key:'tiba', label:'Perkiraan Tiba' }, { key:'status', label:'Status' }
        ]);
        break;
      case 'buy-supplier': {
        const bills = DB.all('bills').filter(b => b.date >= state.from && b.date <= state.to);
        const g = U.groupBy(bills, b => b.supplierId);
        table(el, 'Pembelian per Supplier', Object.entries(g).map(([sid, list]) => {
          const s = DB.find('suppliers', sid) || {};
          return { supplier:s.name || '-', termin:s.term ? s.term + ' hari' : 'Tunai', tagihan:list.length,
            total:U.sum(list, b => b.total), dibayar:U.sum(list, b => b.paid),
            sisa:U.sum(list, b => b.total - b.paid) };
        }).sort((a, b) => b.total - a.total), [
          { key:'supplier', label:'Supplier' }, { key:'termin', label:'Termin' },
          { key:'tagihan', label:'Tagihan', align:'right' },
          { key:'total', label:'Total Pembelian', align:'right', render:r => U.rp(r.total) },
          { key:'dibayar', label:'Dibayar', align:'right', render:r => U.rp(r.dibayar) },
          { key:'sisa', label:'Sisa Hutang', align:'right', render:r => `<b style="color:${r.sisa ? 'var(--rose)' : ''}">${U.rp(r.sisa)}</b>` }
        ]);
        break;
      }
      case 'buy-ap': {
        const aging = L.agingBuckets(DB.all('bills').filter(b => b.status !== 'paid'));
        table(el, 'Umur Hutang Supplier', aging.rows.map(r => ({
          no:r.no, supplier:(DB.find('suppliers', r.supplierId) || {}).name, tanggal:U.fmtDate(r.date),
          jatuhTempo:U.fmtDate(r.dueDate), umur:r.days > 0 ? r.days + ' hari' : 'belum jatuh tempo',
          sisa:r.outstanding, kategori:({ lancar:'Belum jatuh tempo', d30:'1-30 hari', d60:'31-60 hari', d90:'61-90 hari', lebih:'>90 hari' })[r.bucket]
        })), [
          { key:'no', label:'No Tagihan' }, { key:'supplier', label:'Supplier' },
          { key:'jatuhTempo', label:'Jatuh Tempo' }, { key:'umur', label:'Umur' },
          { key:'kategori', label:'Kategori' },
          { key:'sisa', label:'Sisa Hutang', align:'right', render:r => `<b>${U.rp(r.sisa)}</b>` }
        ]);
        break;
      }
      case 'fin-pl': case 'fin-bs': case 'fin-cf': case 'fin-tb':
        el.innerHTML = '<div id="fr"></div>';
        location.hash = '#/reports-fin';
        return;
      case 'fin-expense': {
        const exps = DB.all('expenses').filter(e => (oid === 'ALL' || e.outletId === oid) &&
          e.date >= state.from && e.date <= state.to);
        const g = U.groupBy(exps, e => e.accountId);
        table(el, 'Rekap Pengeluaran', Object.entries(g).map(([aid, list]) => ({
          kategori:L.name(aid), jumlah:list.length, total:U.sum(list, e => e.amount),
          rata:U.sum(list, e => e.amount) / list.length
        })).sort((a, b) => b.total - a.total), [
          { key:'kategori', label:'Kategori Biaya' },
          { key:'jumlah', label:'Transaksi', align:'right' },
          { key:'total', label:'Total', align:'right', render:r => `<b>${U.rp(r.total)}</b>` },
          { key:'rata', label:'Rata-rata', align:'right', render:r => U.rp(r.rata) }
        ]);
        break;
      }
      case 'fin-tax': {
        const g = U.groupBy(orders, o => U.monthKey(U.ymd(o.paidAt || o.date)));
        table(el, 'Rekap Pajak (PB1 / PPN)', Object.entries(g).map(([bulan, list]) => ({
          periode:U.fmtDate(bulan + '-01', 'month'), trx:list.length,
          dpp:U.sum(list, o => o.subtotal - o.discount + o.serviceCharge),
          pajak:U.sum(list, o => o.tax), total:U.sum(list, o => o.total)
        })), [
          { key:'periode', label:'Periode' }, { key:'trx', label:'Transaksi', align:'right' },
          { key:'dpp', label:'Dasar Pengenaan Pajak', align:'right', render:r => U.rp(r.dpp) },
          { key:'pajak', label:'Pajak Terutang', align:'right', render:r => `<b>${U.rp(r.pajak)}</b>` },
          { key:'total', label:'Total Termasuk Pajak', align:'right', render:r => U.rp(r.total) }
        ]);
        break;
      }
      case 'hr-attendance': {
        const emps = DB.all('employees').filter(e => oid === 'ALL' || e.outletId === oid);
        const hariKerja = U.dateRangeDays(state.from, state.to).length;
        table(el, 'Rekap Absensi', emps.map(e => {
          const att = DB.where('attendance', a => a.employeeId === e.id && a.date >= state.from && a.date <= state.to);
          return { nama:e.name, jabatan:e.position, hadir:att.filter(a => a.status !== 'izin').length,
            telat:att.filter(a => a.status === 'telat').length, izin:att.filter(a => a.status === 'izin').length,
            jam:U.sum(att, a => a.hours || 0), lembur:U.sum(att, a => a.overtime || 0),
            persen:hariKerja ? (att.filter(a => a.status !== 'izin').length / hariKerja) * 100 : 0 };
        }), [
          { key:'nama', label:'Karyawan' }, { key:'jabatan', label:'Jabatan' },
          { key:'hadir', label:'Hadir', align:'right' }, { key:'telat', label:'Telat', align:'right' },
          { key:'izin', label:'Izin', align:'right' },
          { key:'jam', label:'Jam Kerja', align:'right', render:r => U.num(r.jam, 1) },
          { key:'lembur', label:'Lembur', align:'right', render:r => U.num(r.lembur, 1) },
          { key:'persen', label:'% Kehadiran', align:'right', render:r => r.persen.toFixed(0) + '%' }
        ]);
        break;
      }
      case 'hr-commission': {
        const g = U.groupBy(orders.filter(o => o.waiterId), o => o.waiterId);
        table(el, 'Komisi Karyawan', Object.entries(g).map(([eid, list]) => {
          const e = DB.find('employees', eid) || {};
          return { nama:e.name || '-', jabatan:e.position || '', rate:(e.commissionRate || 0) + '%',
            trx:list.length, omzet:U.sum(list, o => o.subtotal - o.discount), komisi:U.sum(list, o => o.commission) };
        }).sort((a, b) => b.komisi - a.komisi), [
          { key:'nama', label:'Karyawan' }, { key:'jabatan', label:'Jabatan' }, { key:'rate', label:'Rate' },
          { key:'trx', label:'Transaksi', align:'right' },
          { key:'omzet', label:'Omzet Dilayani', align:'right', render:r => U.rp(r.omzet) },
          { key:'komisi', label:'Komisi', align:'right', render:r => `<b>${U.rp(r.komisi)}</b>` }
        ]);
        break;
      }
      case 'hr-payroll':
        table(el, 'Rekap Payroll', DB.all('payrolls').map(p => ({
          no:p.no, periode:U.fmtDate(p.period + '-01', 'month'), karyawan:p.lines.length,
          pokok:U.sum(p.lines, l => l.base), tunjangan:U.sum(p.lines, l => l.allowance),
          lembur:U.sum(p.lines, l => l.overtime), komisi:U.sum(p.lines, l => l.commission),
          potongan:U.sum(p.lines, l => l.deduction + l.tax), total:p.total, status:p.status
        })), [
          { key:'no', label:'No' }, { key:'periode', label:'Periode' },
          { key:'karyawan', label:'Karyawan', align:'right' },
          { key:'pokok', label:'Gaji Pokok', align:'right', render:r => U.rp(r.pokok) },
          { key:'tunjangan', label:'Tunjangan', align:'right', render:r => U.rp(r.tunjangan) },
          { key:'lembur', label:'Lembur', align:'right', render:r => U.rp(r.lembur) },
          { key:'komisi', label:'Komisi', align:'right', render:r => U.rp(r.komisi) },
          { key:'total', label:'Dibayarkan', align:'right', render:r => `<b>${U.rp(r.total)}</b>` },
          { key:'status', label:'Status' }
        ]);
        break;
      case 'crm-customer':
        table(el, 'Analisa Pelanggan', DB.all('customers').map(c => {
          const list = orders.filter(o => o.customerId === c.id);
          return { nama:c.name, kode:c.code, tier:(DB.find('tiers', c.tierId) || {}).name,
            trxPeriode:list.length, omzetPeriode:U.sum(list, o => o.total),
            totalBelanja:c.totalSpend || 0, kunjungan:c.visits || 0, poin:c.points || 0,
            terakhir:c.lastVisit ? U.fmtDate(c.lastVisit) : '-' };
        }).sort((a, b) => b.totalBelanja - a.totalBelanja), [
          { key:'nama', label:'Pelanggan' }, { key:'kode', label:'Kode' }, { key:'tier', label:'Tier' },
          { key:'trxPeriode', label:'Trx Periode', align:'right' },
          { key:'omzetPeriode', label:'Omzet Periode', align:'right', render:r => U.rp(r.omzetPeriode) },
          { key:'totalBelanja', label:'Total Belanja', align:'right', render:r => `<b>${U.rp(r.totalBelanja)}</b>` },
          { key:'kunjungan', label:'Kunjungan', align:'right' },
          { key:'poin', label:'Poin', align:'right', render:r => U.num(r.poin) },
          { key:'terakhir', label:'Terakhir Datang' }
        ]);
        break;
      case 'crm-retention': {
        const cs = DB.all('customers');
        const buckets = [
          ['Aktif (≤30 hari)', cs.filter(c => c.lastVisit && c.lastVisit >= U.addDays(U.today(), -30))],
          ['Melemah (31–60 hari)', cs.filter(c => c.lastVisit && c.lastVisit < U.addDays(U.today(), -30) && c.lastVisit >= U.addDays(U.today(), -60))],
          ['Berisiko (61–90 hari)', cs.filter(c => c.lastVisit && c.lastVisit < U.addDays(U.today(), -60) && c.lastVisit >= U.addDays(U.today(), -90))],
          ['Hilang (>90 hari)', cs.filter(c => c.lastVisit && c.lastVisit < U.addDays(U.today(), -90))],
          ['Belum pernah transaksi', cs.filter(c => !c.lastVisit)]
        ];
        table(el, 'Retensi & Churn Pelanggan', buckets.map(([label, list]) => ({
          segmen:label, jumlah:list.length, porsi:(list.length / (cs.length || 1)) * 100,
          nilai:U.sum(list, c => c.totalSpend || 0)
        })), [
          { key:'segmen', label:'Segmen' }, { key:'jumlah', label:'Pelanggan', align:'right' },
          { key:'porsi', label:'Porsi', align:'right', render:r => r.porsi.toFixed(1).replace('.',',') + '%' },
          { key:'nilai', label:'Nilai Belanja Historis', align:'right', render:r => U.rp(r.nilai) }
        ], `<div class="card mb-16"><div class="card__body">${App.Chart.donut(
          buckets.map(([l, list]) => ({ label:l, value:list.length })), { centerLabel:'Member' })}</div></div>`);
        break;
      }
      case 'crm-loyalty': {
        const cs = DB.all('customers');
        table(el, 'Poin & Stamp Beredar', cs.filter(c => (c.points || 0) > 0 || (c.stamps || 0) > 0).map(c => ({
          nama:c.name, tier:(DB.find('tiers', c.tierId) || {}).name, poin:c.points || 0,
          stamp:c.stamps || 0, nilaiPoin:(c.points || 0) * 100, deposit:c.deposit || 0
        })).sort((a, b) => b.poin - a.poin), [
          { key:'nama', label:'Pelanggan' }, { key:'tier', label:'Tier' },
          { key:'poin', label:'Poin', align:'right', render:r => U.num(r.poin) },
          { key:'stamp', label:'Stamp', align:'right', render:r => r.stamp + '/10' },
          { key:'nilaiPoin', label:'Estimasi Nilai Poin', align:'right', render:r => U.rp(r.nilaiPoin) },
          { key:'deposit', label:'Deposit', align:'right', render:r => U.rp(r.deposit) }
        ]);
        break;
      }
      default:
        el.innerHTML = App.UI.emptyState('Laporan tidak ditemukan', '', '📑');
    }
  }
  draw();
};

/* ---------------- Analisa Bisnis ---------------- */
App.Views.analytics = function (root) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  const state = App.Period.init('d30');

  function draw() {
    const oid = App.State.outletId();
    const orders = App.Sales.orders({ from:state.from, to:state.to, outletId:oid });
    const cmp = App.Sales.compare(state.from, state.to, oid);
    const pl = L.profitLoss(state.from, state.to, oid);
    const mix = App.Sales.productMix(orders);
    const days = U.dateRangeDays(state.from, state.to).length;
    const cs = DB.all('customers');
    const repeat = orders.filter(o => o.customerId);
    const uniqueCust = U.unique(repeat.map(o => o.customerId));

    /* Analisa menu: bintang / kuda beban / teka-teki / anjing (menu engineering) */
    const avgQty = U.sum(mix, m => m.qty) / (mix.length || 1);
    const avgMargin = U.sum(mix, m => m.margin) / (mix.length || 1);
    const quad = m => m.qty >= avgQty
      ? (m.margin >= avgMargin ? { k:'star', l:'⭐ Bintang', t:'green' } : { k:'horse', l:'🐴 Kuda Beban', t:'amber' })
      : (m.margin >= avgMargin ? { k:'puzzle', l:'🧩 Teka-teki', t:'blue' } : { k:'dog', l:'🐕 Kurang Laku', t:'red' });

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Analisa Bisnis</h2><p>Wawasan mendalam untuk pengambilan keputusan pemilik usaha</p></div>
        <div class="page-head__actions" id="period"></div>
      </div>

      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Omzet per Hari', icon:'📅', value:U.rp(cmp.cur.total / days), delta:cmp.delta.total, sub:`${days} hari periode` })}
        ${App.UI.stat({ label:'Transaksi per Hari', icon:'🧾', value:U.num(Math.round(cmp.cur.trx / days)), delta:cmp.delta.trx, sub:'rata-rata harian' })}
        ${App.UI.stat({ label:'Food Cost Ratio', icon:'🍳', value:U.pct(pl.totalCogs, pl.netSales || 1),
          sub:'ideal 30–35% untuk F&B', tone: (pl.totalCogs / (pl.netSales || 1)) > 0.4 ? 'var(--rose)' : 'var(--lime)' })}
        ${App.UI.stat({ label:'Net Margin', icon:'🏆', value:pl.netMargin.toFixed(1).replace('.',',') + '%',
          sub:'laba bersih dari omzet', tone: pl.netMargin > 10 ? 'var(--lime)' : 'var(--amber)' })}
      </div>

      <div class="grid g-2-1 mb-16">
        <div class="card">
          <div class="card__head"><h3>Menu Engineering</h3><span class="sub">popularitas × profitabilitas</span></div>
          <div class="card__body">
            <div class="tbl-wrap"><table class="tbl">
              <thead><tr><th>Menu</th><th class="num">Terjual</th><th class="num">Margin</th><th class="num">Kontribusi Laba</th><th>Klasifikasi</th><th>Saran</th></tr></thead>
              <tbody>${mix.slice(0, 14).map(m => { const q = quad(m);
                return `<tr><td><b>${U.esc(m.nama)}</b></td><td class="num">${U.num(m.qty)}</td>
                  <td class="num">${m.margin.toFixed(0)}%</td><td class="num">${U.rp(m.laba)}</td>
                  <td>${App.UI.badge(q.l, q.t)}</td>
                  <td class="small muted">${({ star:'Pertahankan & tampilkan menonjol',
                    horse:'Naikkan harga atau tekan HPP', puzzle:'Promosikan lebih agresif',
                    dog:'Pertimbangkan hapus dari menu' })[q.k]}</td></tr>`;
              }).join('')}</tbody></table></div>
          </div>
        </div>
        <div>
          <div class="card mb-16"><div class="card__head"><h3>Kesehatan Bisnis</h3></div><div class="card__body">
            ${(() => {
              const items = [
                ['Food cost ratio', pl.netSales ? (pl.totalCogs / pl.netSales) * 100 : 0, 35, true],
                ['Biaya gaji / omzet', pl.netSales ? (U.sum(pl.opex.filter(a => a.code.startsWith('6-100')), a => a.value) / pl.netSales) * 100 : 0, 25, true],
                ['Net margin', pl.netMargin, 10, false],
                ['Transaksi bermember', (repeat.length / (orders.length || 1)) * 100, 40, false]
              ];
              return items.map(([label, val, target, lower]) => {
                const good = lower ? val <= target : val >= target;
                return `<div class="mb-12"><div class="flex justify-between small mb-4">
                  <span>${label}</span><b style="color:${good ? 'var(--lime)' : 'var(--amber)'}">${val.toFixed(1).replace('.',',')}% <span class="muted">(target ${lower ? '≤' : '≥'}${target}%)</span></b></div>
                  <div class="progress"><i style="width:${Math.min(100, val)}%;background:${good ? 'var(--lime)' : 'var(--amber)'}"></i></div></div>`;
              }).join('');
            })()}
          </div></div>
          <div class="card"><div class="card__head"><h3>Basket Analysis</h3></div><div class="card__body">
            <div class="kv"><span class="k">Item per transaksi</span><span class="v">${(U.sum(orders, o => U.sum(o.items, i => i.qty)) / (orders.length || 1)).toFixed(1).replace('.',',')}</span></div>
            <div class="kv"><span class="k">Nilai keranjang rata-rata</span><span class="v">${U.rp(cmp.cur.avg)}</span></div>
            <div class="kv"><span class="k">Pelanggan unik</span><span class="v">${U.num(uniqueCust.length)}</span></div>
            <div class="kv"><span class="k">Frekuensi kunjungan</span><span class="v">${(repeat.length / (uniqueCust.length || 1)).toFixed(1).replace('.',',')}×</span></div>
            <div class="kv"><span class="k">Estimasi CLV member</span><span class="v">${U.rp(U.sum(cs, c => c.totalSpend || 0) / (cs.length || 1))}</span></div>
          </div></div>
        </div>
      </div>

      <div class="grid g2 mb-16">
        <div class="card"><div class="card__head"><h3>Peta Jam Ramai</h3><span class="sub">transaksi per hari × jam</span></div>
          <div class="card__body">${App.Chart.heat(App.Sales.heatMatrix(orders))}</div></div>
        <div class="card"><div class="card__head"><h3>Perbandingan Outlet</h3></div>
          <div class="card__body">${App.Chart.bar(DB.all('outlets').map(o => {
            const t = App.Sales.totals(App.Sales.orders({ from:state.from, to:state.to, outletId:o.id }));
            return { label:(o.name.split('—')[1] || o.name).trim(), value:t.net };
          }), {})}</div></div>
      </div>

      <div class="card">
        <div class="card__head"><h3>💡 Rekomendasi Otomatis</h3></div>
        <div class="card__body"><div class="grid g2">${insights(orders, pl, mix, quad, avgQty, avgMargin).map(i => `
          <div style="display:flex;gap:10px;padding:11px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2)">
            <span style="font-size:18px">${i.icon}</span>
            <div><b style="font-size:13px">${U.esc(i.title)}</b><div class="small muted mt-4">${i.text}</div></div>
          </div>`).join('')}</div></div>
      </div>`;
    root.querySelector('#period').appendChild(App.Period.bar(state, draw));
  }

  function insights(orders, pl, mix, quad, avgQty, avgMargin) {
    const out = [];
    const oid = App.State.outletId();
    const fc = pl.netSales ? (pl.totalCogs / pl.netSales) * 100 : 0;
    if (fc > 38) out.push({ icon:'⚠️', title:'Food cost terlalu tinggi',
      text:`Rasio HPP ${fc.toFixed(1)}% di atas standar F&B (30–35%). Tinjau harga beli bahan, porsi resep, dan stok terbuang.` });
    else if (fc > 0) out.push({ icon:'✅', title:'Food cost sehat',
      text:`Rasio HPP ${fc.toFixed(1)}% masih dalam batas wajar industri F&B.` });

    const dogs = mix.filter(m => quad(m).k === 'dog');
    if (dogs.length) out.push({ icon:'🐕', title:`${dogs.length} menu kurang laku`,
      text:`Menu seperti <b>${U.esc(dogs.slice(0,3).map(d => d.nama).join(', '))}</b> jarang dipesan dan marginnya rendah. Pertimbangkan diganti atau dijadikan paket bundling.` });

    const stars = mix.filter(m => quad(m).k === 'star').slice(0, 3);
    if (stars.length) out.push({ icon:'⭐', title:'Menu andalan',
      text:`<b>${U.esc(stars.map(s => s.nama).join(', '))}</b> paling laku sekaligus paling untung. Tampilkan di posisi utama menu dan e-menu.` });

    const hours = App.Sales.byHour(orders);
    const best = U.sortBy(hours, h => h.trx, 'desc')[0];
    const worst = U.sortBy(hours.filter(h => Number(h.label) >= 8 && Number(h.label) <= 21), h => h.trx)[0];
    if (best) out.push({ icon:'⏰', title:'Atur shift sesuai jam ramai',
      text:`Jam tersibuk pukul <b>${best.label}:00</b>${worst ? ` dan tersepi pukul <b>${worst.label}:00</b>` : ''}. Tambah staf saat ramai, jalankan promo happy hour saat sepi.` });

    const low = App.Inv.lowStockList(oid === 'ALL' ? DB.all('outlets')[0].id : oid);
    if (low.length) out.push({ icon:'📦', title:`${low.length} bahan di bawah stok minimum`,
      text:`Segera buat PO agar penjualan tidak terganggu. Contoh: ${U.esc(low.slice(0,3).map(l => l.product.name).join(', '))}.` });

    const churn = DB.all('customers').filter(c => c.lastVisit && c.lastVisit < U.addDays(U.today(), -60));
    if (churn.length) out.push({ icon:'💚', title:`${churn.length} pelanggan berisiko hilang`,
      text:`Mereka tidak datang >60 hari. Jalankan kampanye WhatsApp reaktivasi dengan voucher untuk menariknya kembali.` });

    const bills = DB.all('bills').filter(b => b.status !== 'paid' && b.dueDate < U.today());
    if (bills.length) out.push({ icon:'🧮', title:`${bills.length} tagihan supplier lewat jatuh tempo`,
      text:`Total ${U.rp(U.sum(bills, b => b.total - b.paid))}. Segera lunasi untuk menjaga hubungan baik dengan pemasok.` });

    const disc = U.sum(orders, o => o.discount);
    if (disc && pl.netSales) out.push({ icon:'🎁', title:'Investasi promo',
      text:`Diskon yang diberikan ${U.rp(disc)} (${U.pct(disc, pl.netSales + disc)} dari penjualan kotor). Bandingkan dengan kenaikan transaksi untuk menilai efektivitas.` });

    return out;
  }
  draw();
};
