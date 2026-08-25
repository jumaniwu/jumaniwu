/* =============================================================
   SajiPOS — Riwayat Transaksi Contoh (21 hari terakhir)
   Menghasilkan penjualan, pembelian, biaya, payroll, absensi,
   beserta jurnal & mutasi stok agar seluruh modul saling terhubung.
   ============================================================= */
window.App = window.App || {};
App.SeedHistory = (function () {
  const U = App.U, DB = App.DB, L = App.Ledger;
  /* Riwayat mencakup minimal 21 hari DAN seluruh bulan berjalan, agar laporan
     "bulan ini" selalu utuh. Volume harian diskalakan supaya ukuran basis data
     tetap wajar untuk penyimpanan browser. */
  const DAYS = Math.min(34, Math.max(21, new Date().getDate() + 1));
  const SCALE = Math.max(0.55, 21 / DAYS);

  function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function chance(p) { return Math.random() < p; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function weighted(items) {                       // items: [[nilai, bobot]]
    const total = U.sum(items, i => i[1]);
    let r = Math.random() * total;
    for (const [v, w] of items) { r -= w; if (r <= 0) return v; }
    return items[0][0];
  }

  function build() {
    const outlets  = DB.all('outlets');
    const products = DB.all('products').filter(p => p.type === 'product' && p.active);
    const materials= DB.all('products').filter(p => p.type === 'material');
    const customers= DB.all('customers');
    const employees= DB.all('employees');
    const suppliers= DB.all('suppliers');
    const users    = DB.all('users');
    const catOf    = id => DB.find('categories', id) || {};

    /* -------- 1. Saldo awal -------- */
    const startDate = U.addDays(U.today(), -(DAYS + 1));
    const persediaanAwal = U.sum(DB.all('stock'), s => s.qty * s.avgCost);
    L.post({
      date: startDate, ref:'SALDO-AWAL', refType:'opening', memo:'Saldo awal pembukuan', source:'system',
      outletId: outlets[0].id,
      lines: [
        { code:L.A.CASH_MAIN,    debit: 25000000, memo:'Kas besar' },
        { code:L.A.CASH_DRAWER,  debit: 4500000,  memo:'Modal kas kasir 3 outlet' },
        { code:L.A.BANK,         debit: 185000000,memo:'Saldo bank operasional' },
        { code:L.A.INV_MATERIAL, debit: Math.round(persediaanAwal), memo:'Persediaan bahan baku awal' },
        { code:L.A.EQUIPMENT,    debit: 320000000,memo:'Mesin kopi, peralatan dapur, furnitur, POS' },
        { code:L.A.PREPAID,      debit: 48000000, memo:'Sewa dibayar dimuka 12 bulan' },
        { code:L.A.BANK_LOAN,    credit:150000000,memo:'Kredit modal kerja' },
        { code:L.A.CAPITAL,      credit: Math.round(25000000+4500000+185000000+persediaanAwal+320000000+48000000-150000000), memo:'Modal disetor pemilik' }
      ]
    });

    /* -------- 2. Pemasok untuk tiap bahan -------- */
    const supplierOf = {};
    materials.forEach((m, i) => {
      let s;
      if (/kopi/i.test(m.name)) s = suppliers[0];
      else if (/susu|whipped|es krim|butter|keju/i.test(m.name)) s = suppliers[1];
      else if (/tepung|coklat|matcha|gula|sirup|roti|teh|spaghetti/i.test(m.name)) s = suppliers[2];
      else if (/ayam|daging|telur|protein/i.test(m.name)) s = suppliers[3];
      else if (/sayur|cabai|bawang|kentang|pisang|santan/i.test(m.name)) s = suppliers[4];
      else s = suppliers[5];
      supplierOf[m.id] = s.id;
    });

    /* -------- 3. Bantu: buat PO + penerimaan + tagihan -------- */
    function replenish(outletId, date) {
      const need = materials
        .map(m => ({ m, q: App.Inv.qty(outletId, m.id) }))
        .filter(r => r.q <= r.m.minStock * 2.5);
      if (!need.length) return;
      const bySup = U.groupBy(need, r => supplierOf[r.m.id]);
      Object.entries(bySup).forEach(([supId, rows]) => {
        const sup = DB.find('suppliers', supId);
        const items = rows.map(r => {
          const target = Math.max(r.m.minStock * 6, 500);
          const qty = Math.ceil((target - r.q) / 10) * 10;
          const price = U.round4(r.m.cost * (0.94 + Math.random() * 0.12));
          return { productId:r.m.id, name:r.m.name, qty, unit:r.m.unit, price, subtotal: qty * price };
        });
        const total = Math.round(U.sum(items, i => i.subtotal));
        const po = DB.insert('purchaseOrders', {
          no: DB.nextNo('po','PO'), date, supplierId:supId, outletId, items, total,
          expectedDate: U.addDays(date, 2), status:'received', note:'Pembelian rutin bahan baku',
          createdBy:'usr_gudang', approvedBy:'usr_mgr', approvedAt:date
        });
        const grn = DB.insert('goodsReceipts', {
          no: DB.nextNo('grn','GRN'), date: U.addDays(date, 1), poId:po.id, supplierId:supId, outletId,
          items: items.map(i => ({ ...i, qtyOrder:i.qty, qty:i.qty })), total,
          note:'Barang diterima lengkap', receivedBy:'usr_gudang'
        });
        App.Inv.receive(outletId, items, grn.no, 'Penerimaan dari ' + sup.name);
        const bill = DB.insert('bills', {
          no: DB.nextNo('bill','INV'), date: grn.date, dueDate: U.addDays(grn.date, sup.term || 14),
          supplierId:supId, grnId:grn.id, poId:po.id, outletId, total, paid:0, status:'unpaid',
          note:'Tagihan atas ' + grn.no
        });
        L.postGRN(grn);
        /* Lunasi tagihan yang sudah jatuh tempo */
        if (bill.dueDate < U.addDays(U.today(), -2) || (sup.term === 0)) {
          const pay = DB.insert('billPayments', {
            date: sup.term === 0 ? grn.date : bill.dueDate, billId:bill.id, supplierId:supId,
            amount: total, accountId: L.id(sup.term === 0 ? L.A.CASH_MAIN : L.A.BANK),
            method: sup.term === 0 ? 'cash' : 'transfer', note:'Pelunasan ' + bill.no, outletId
          });
          DB.update('bills', bill.id, { paid: total, status:'paid' });
          L.postBillPayment(pay, bill);
        }
      });
    }

    /* Pembelian mendesak: menjaga stok tidak pernah minus bila pemakaian
       harian melampaui persediaan sebelum jadwal restok berikutnya. */
    function emergencyRestock(outletId, date) {
      const minus = materials.filter(m => App.Inv.qty(outletId, m.id) < m.minStock * 0.5);
      if (!minus.length) return;
      const bySup = U.groupBy(minus, m => supplierOf[m.id]);
      Object.entries(bySup).forEach(([supId, list]) => {
        const items = list.map(m => {
          const qty = Math.ceil((m.minStock * 5 - App.Inv.qty(outletId, m.id)) / 10) * 10;
          const price = U.round4(m.cost * (0.98 + Math.random() * 0.1));
          return { productId:m.id, name:m.name, qty, unit:m.unit, price, subtotal: qty * price };
        });
        const total = Math.round(U.sum(items, i => i.subtotal));
        const grn = DB.insert('goodsReceipts', {
          no: DB.nextNo('grn','GRN'), date, supplierId:supId, outletId, items,
          total, note:'Pembelian mendesak — stok kritis' });
        App.Inv.receive(outletId, items, grn.no, 'Pembelian mendesak');
        const bill = DB.insert('bills', {
          no: DB.nextNo('bill','INV'), date, dueDate: date, supplierId:supId, grnId:grn.id,
          outletId, total, paid: total, status:'paid', note:'Dibayar tunai saat terima' });
        L.postGRN(grn);
        const pay = DB.insert('billPayments', { date, billId:bill.id, supplierId:supId, amount:total,
          accountId: L.id(L.A.CASH_MAIN), method:'cash', note:'Pembelian mendesak', outletId });
        L.postBillPayment(pay, bill);
      });
    }

    /* -------- 4. Penjualan harian -------- */
    const orderCounter = {};
    function makeOrder(outlet, dateStr, hour, seq, shiftId) {
      const isResto = outlet.type === 'restoran';
      const type = weighted(isResto
        ? [['dinein',55],['takeaway',18],['ojol',20],['delivery',5],['ecommerce',2]]
        : [['dinein',40],['takeaway',32],['ojol',22],['ecommerce',6]]);
      const channel = type === 'ojol' ? pick(['gofood','grabfood','shopeefood'])
                    : type === 'ecommerce' ? pick(['webstore','emenu']) : 'kasir';

      /* Pilih item */
      const nItems = weighted([[1,26],[2,32],[3,22],[4,12],[5,8]]);
      const items = [];
      let cogs = 0;
      for (let i = 0; i < nItems; i++) {
        const p = weighted(products.map(x => [x, x.bestSeller ? 9 : x.favorite ? 6 : x.isBundle ? 2 : 3]));
        if (items.find(x => x.productId === p.id)) continue;
        const qty = weighted([[1,72],[2,20],[3,6],[4,2]]);
        let price = p.price;
        const variants = [];
        if (p.variants && p.variants.length && chance(0.4)) {
          p.variants.forEach(v => {
            const o = pick(v.options);
            if (o.priceDelta) { price += o.priceDelta; variants.push({ group:v.name, name:o.name, priceDelta:o.priceDelta }); }
          });
        }
        const sub = price * qty;
        cogs += App.Inv.recipeCost(p.id, outlet.id) * qty;
        const item = { productId:p.id, name:p.name, qty, price, subtotal:sub };
        if (variants.length) item.variants = variants;
        items.push(item);
      }
      if (!items.length) return null;

      const subtotal = U.sum(items, i => i.subtotal);
      /* Pelanggan & promo */
      const cust = chance(0.42) ? pick(customers) : null;
      let discount = 0, promoId = null;
      if (cust) {
        const tier = DB.find('tiers', cust.tierId);
        if (tier && tier.discount) { discount = Math.round(subtotal * tier.discount / 100); promoId = 'pro_4'; }
      }
      if (!discount && hour >= 15 && hour < 17 && chance(0.5)) {
        const drinks = U.sum(items.filter(i => {
          const p = DB.find('products', i.productId);
          const c = catOf(p.categoryId);
          return c.name === 'Kopi' || c.name === 'Non-Kopi';
        }), i => i.subtotal);
        if (drinks) { discount = Math.round(drinks * 0.2); promoId = 'pro_2'; }
      }
      if (!discount && subtotal >= 150000 && chance(0.55)) { discount = 15000; promoId = 'pro_5'; }

      const dpp = subtotal - discount;
      const svc = type === 'dinein' ? Math.round(dpp * (outlet.serviceCharge || 0) / 100) : 0;
      const tax = Math.round((dpp + svc) * (outlet.taxRate || 0) / 100);
      const raw = dpp + svc + tax;
      const total = Math.round(raw / 100) * 100;
      const roundingAdj = total - raw;

      /* Pembayaran */
      const method = weighted(type === 'ojol'
        ? [['transfer',100]]
        : [['cash',34],['qris',36],['debit',12],['credit',7],['ewallet',11]]);
      const mdrRates = DB.settings().pos.mdrRates || {};
      const mdr = method === 'cash' ? 0 : Math.round(total * (mdrRates[method] || 0) / 100);
      const paid = method === 'cash' ? Math.ceil(total / 5000) * 5000 : total;

      const outletUsers = users.filter(u => u.outletIds.includes('ALL') || u.outletIds.includes(outlet.id));
      const cashier = pick(outletUsers.filter(u => ['kasir','supervisor','manager'].includes(u.role)) .concat(outletUsers))
      const waiterPool = employees.filter(e => e.outletId === outlet.id && e.commissionRate > 0);
      const waiter = waiterPool.length ? pick(waiterPool) : null;
      const commission = waiter ? Math.round(dpp * waiter.commissionRate / 100) : 0;

      const table = type === 'dinein'
        ? pick(DB.where('tables', t => t.outletId === outlet.id)) : null;
      const iso = `${dateStr}T${String(hour).padStart(2,'0')}:${String(rnd(0,59)).padStart(2,'0')}:00`;
      orderCounter[outlet.code] = (orderCounter[outlet.code] || 0) + 1;

      /* Record riwayat sengaja dibuat ramping (hanya field yang terisi) karena
         penyimpanan browser dibatasi ~5 MB. Pembaca data selalu memakai pola
         `o.field || default`, jadi field yang dihilangkan aman. */
      const o = {
        id: U.uid('ord'),
        no: `${outlet.code}/${dateStr.replace(/-/g,'').slice(2)}/${String(seq).padStart(4,'0')}`,
        date: iso, outletId: outlet.id, type, channel,
        items, subtotal, tax, total, cogs: Math.round(cogs),
        payments: [{ method, amount: total }],
        status:'paid', cashierId: cashier.id, shiftId
      };
      if (svc)         o.serviceCharge = svc;
      if (discount)    o.discount = discount;
      if (roundingAdj) o.roundingAdj = roundingAdj;
      if (commission)  o.commission = commission;
      if (mdr)         o.payments[0].mdr = mdr;
      if (method === 'cash' && paid - total) o.change = paid - total;
      if (type === 'dinein') o.guestCount = rnd(1, 4);
      if (table)   { o.tableId = table.id; o.tableName = table.name; }
      if (cust)    { o.customerId = cust.id; o.customerName = cust.name; }
      if (promoId)  o.promoId = promoId;
      if (waiter)   o.waiterId = waiter.id;
      return o;
    }

    /* Jurnal ringkas harian per outlet (menjaga ukuran basis data tetap wajar) */
    function postDailySummary(outlet, dateStr, orders) {
      if (!orders.length) return;
      const revByCode = {};
      orders.forEach(o => o.items.forEach(it => {
        const p = DB.find('products', it.productId);
        const c = catOf(p ? p.categoryId : null);
        const code = c.revenueAccount || L.A.SALES_FOOD;
        revByCode[code] = (revByCode[code] || 0) + it.subtotal;
      }));
      const payByAcc = {};
      let mdrTotal = 0;
      orders.forEach(o => o.payments.forEach(p => {
        const acc = L.accountForPayment(p.method);
        payByAcc[acc] = (payByAcc[acc] || 0) + (p.amount - (p.mdr || 0));
        mdrTotal += p.mdr || 0;
      }));
      const disc = U.sum(orders, o => o.discount);
      const svc  = U.sum(orders, o => o.serviceCharge);
      const tax  = U.sum(orders, o => o.tax);
      const rnd_ = U.sum(orders, o => o.roundingAdj);
      const cogs = U.sum(orders, o => o.cogs);
      const comm = U.sum(orders, o => o.commission);

      const lines = [];
      Object.entries(payByAcc).forEach(([acc, amt]) => lines.push({ accountId:acc, debit:Math.round(amt), memo:'Penerimaan penjualan' }));
      if (mdrTotal) lines.push({ code:L.A.EXP_BANK, debit:Math.round(mdrTotal), memo:'Biaya MDR pembayaran digital' });
      if (disc) lines.push({ code:L.A.SALES_DISCOUNT, debit:disc, memo:'Diskon & promo' });
      if (rnd_ < 0) lines.push({ code:L.A.OTHER_INCOME, debit:-rnd_, memo:'Pembulatan' });
      Object.entries(revByCode).forEach(([code, amt]) => lines.push({ code, credit:Math.round(amt), memo:'Penjualan harian' }));
      if (svc) lines.push({ code:L.A.SERVICE_CHARGE, credit:svc, memo:'Service charge' });
      if (tax) lines.push({ code:L.A.TAX_OUT, credit:tax, memo:'PB1 terutang' });
      if (rnd_ > 0) lines.push({ code:L.A.OTHER_INCOME, credit:rnd_, memo:'Pembulatan' });

      L.post({ date:dateStr, ref:`REKAP/${outlet.code}/${dateStr}`, refType:'saleSummary',
        memo:`Rekap penjualan ${outlet.name} — ${orders.length} transaksi`, outletId:outlet.id, source:'pos', lines });

      if (cogs) L.post({ date:dateStr, ref:`HPP/${outlet.code}/${dateStr}`, refType:'cogs',
        memo:`HPP penjualan ${outlet.name}`, outletId:outlet.id, source:'pos',
        lines:[{ code:L.A.COGS, debit:Math.round(cogs) }, { code:L.A.INV_MATERIAL, credit:Math.round(cogs) }] });

      if (comm) L.post({ date:dateStr, ref:`KOM/${outlet.code}/${dateStr}`, refType:'commission',
        memo:`Komisi karyawan ${outlet.name}`, outletId:outlet.id, source:'pos',
        lines:[{ code:L.A.EXP_COMMISSION, debit:Math.round(comm) }, { code:L.A.SALARY_PAYABLE, credit:Math.round(comm) }] });
    }

    /* Konsumsi bahan digabung per hari agar mutasi stok tetap ringkas */
    function consumeDaily(outlet, dateStr, orders) {
      const need = {};
      orders.forEach(o => o.items.forEach(it => {
        const exp = App.Inv.explode(it.productId, it.qty);
        Object.entries(exp).forEach(([mid, q]) => need[mid] = (need[mid] || 0) + q);
      }));
      Object.entries(need).forEach(([mid, q]) => {
        const m = DB.find('products', mid);
        if (!m || m.trackStock === false) return;
        App.Inv.move({ outletId:outlet.id, productId:mid, delta:-q, type:'sale',
          ref:`REKAP/${dateStr}`, note:`Pemakaian penjualan ${orders.length} transaksi`, date:`${dateStr}T23:30:00` });
      });
    }

    /* -------- Loop harian -------- */
    for (let d = DAYS; d >= 1; d--) {
      const dateStr = U.addDays(U.today(), -d);
      const dow = new Date(dateStr).getDay();
      const weekend = dow === 0 || dow === 6;

      outlets.forEach((outlet, oi) => {
        if (d % 2 === (oi % 2)) replenish(outlet.id, dateStr);

        const base = (outlet.type === 'restoran' ? 38 : (oi === 0 ? 44 : 28)) * SCALE;
        const count = Math.max(4, Math.round(base * (weekend ? 1.32 : 1) * (0.85 + Math.random() * 0.3)));
        const shiftId = 'shf_' + outlet.code + '_' + dateStr;
        const dayOrders = [];
        for (let i = 0; i < count; i++) {
          const hour = weighted([[8,5],[9,7],[10,8],[11,10],[12,14],[13,11],[14,7],[15,8],[16,9],[17,8],[18,10],[19,12],[20,9],[21,5]]);
          const o = makeOrder(outlet, dateStr, hour, i + 1, shiftId);
          if (o) { DB.insert('orders', o); dayOrders.push(o); }
        }
        /* Beberapa transaksi dibatalkan */
        if (chance(0.35) && dayOrders.length > 5) {
          const v = pick(dayOrders);
          DB.update('orders', v.id, { status:'void', voidReason:pick(['Salah input menu','Pelanggan batal','Duplikat transaksi']), voidBy:'usr_mgr', voidAt:v.date });
          const idx = dayOrders.indexOf(v); dayOrders.splice(idx, 1);
        }
        postDailySummary(outlet, dateStr, dayOrders);
        consumeDaily(outlet, dateStr, dayOrders);
        emergencyRestock(outlet.id, dateStr);

        /* Sesi kasir tertutup */
        const cashOrders = dayOrders.filter(o => o.payments.some(p => p.method === 'cash'));
        const cashTotal = U.sum(cashOrders, o => U.sum(o.payments.filter(p => p.method === 'cash'), p => p.amount));
        const selisih = chance(0.25) ? rnd(-25000, 15000) : 0;
        DB.insert('shifts', {
          id: shiftId, outletId: outlet.id, userId: pick(users.filter(u => u.role === 'kasir')).id,
          openAt: `${dateStr}T07:30:00`, closeAt: `${dateStr}T22:45:00`,
          openingCash: 500000, cashIn: 0, cashOut: 0,
          salesCash: cashTotal, salesNonCash: U.sum(dayOrders, o => o.total) - cashTotal,
          expectedCash: 500000 + cashTotal, actualCash: 500000 + cashTotal + selisih, diff: selisih,
          orders: dayOrders.length, gross: U.sum(dayOrders, o => o.total), status:'closed',
          note: selisih ? (selisih < 0 ? 'Selisih kurang' : 'Selisih lebih') : ''
        });
      });
    }

    /* -------- 5. Biaya operasional -------- */
    const expenseTemplates = [
      ['Sewa tempat bulanan', L.A.EXP_RENT, 25000000, 'monthly', L.A.BANK],
      ['Listrik, air & internet', L.A.EXP_UTILITY, 7800000, 'monthly', L.A.BANK],
      ['Iklan digital & endorsement', L.A.EXP_MARKETING, 4500000, 'monthly', L.A.BANK],
      ['Perlengkapan kebersihan outlet', L.A.EXP_SUPPLIES, 1250000, 'weekly', L.A.CASH_MAIN],
      ['Servis mesin kopi & AC', L.A.EXP_MAINT, 2200000, 'biweekly', L.A.CASH_MAIN],
      ['Penyusutan peralatan', L.A.EXP_DEPR, 4400000, 'monthly', null]
    ];
    let expSeq = 0;
    expenseTemplates.forEach(([note, code, amount, freq, payCode]) => {
      const dates = freq === 'monthly' ? [U.addDays(U.today(), -DAYS + 2)]
        : freq === 'weekly' ? [U.addDays(U.today(), -18), U.addDays(U.today(), -11), U.addDays(U.today(), -4)]
        : [U.addDays(U.today(), -15), U.addDays(U.today(), -3)];
      dates.forEach(date => {
        outlets.forEach((o, i) => {
          const amt = Math.round(amount / outlets.length * (0.9 + Math.random() * 0.25));
          expSeq++;
          if (!payCode) {   /* penyusutan: lawan akumulasi penyusutan */
            L.post({ date, ref:'DEP/' + expSeq, refType:'depreciation', memo:note + ' — ' + o.name,
              outletId:o.id, source:'accounting',
              lines:[{ code:L.A.EXP_DEPR, debit:amt }, { code:L.A.ACC_DEPR, credit:amt }] });
            return;
          }
          const e = DB.insert('expenses', {
            no: DB.nextNo('expense','BY'), date, accountId: L.id(code), amount: amt,
            paymentAccountId: L.id(payCode), outletId:o.id, note: note + ' — ' + o.name,
            category: note, supplierId:null, status:'paid'
          });
          L.postExpense(e);
        });
      });
    });

    /* -------- 6. Absensi & jadwal -------- */
    for (let d = 14; d >= 0; d--) {
      const date = U.addDays(U.today(), -d);
      employees.forEach(e => {
        if (Math.random() < 0.08) {                       /* libur */
          if (d <= 14 && Math.random() < 0.25)
            DB.insert('attendance', { employeeId:e.id, date, status:'izin', inTime:null, outTime:null,
              hours:0, overtime:0, late:0, note:pick(['Sakit','Izin keperluan keluarga','Cuti tahunan']), approved:true, outletId:e.outletId });
          return;
        }
        const jadwal = e.position.match(/Chef|Cook|Barista/) ? '09:00' : '08:00';
        const lateMin = Math.random() < 0.18 ? rnd(3, 35) : 0;
        const inH = Number(jadwal.slice(0,2));
        const inTime = `${date}T${String(inH).padStart(2,'0')}:${String(lateMin).padStart(2,'0')}:00`;
        const workH = 8 + (Math.random() < 0.22 ? rnd(1,3) : 0);
        const outTime = `${date}T${String(Math.min(23, inH + workH)).padStart(2,'0')}:${String(rnd(0,50)).padStart(2,'0')}:00`;
        DB.insert('attendance', {
          employeeId:e.id, date, status: lateMin > 10 ? 'telat' : 'hadir',
          inTime, outTime, hours: workH, overtime: Math.max(0, workH - 8), late: lateMin,
          photoIn:'📷', note:'', approved:true, outletId:e.outletId
        });
      });
    }
    for (let d = 0; d < 7; d++) {
      const date = U.addDays(U.today(), d);
      employees.forEach((e, i) => {
        if ((i + d) % 7 === 0) return;                    /* jadwal libur bergilir */
        const pagi = (i + d) % 2 === 0;
        DB.insert('schedules', {
          employeeId:e.id, date, outletId:e.outletId,
          shiftName: pagi ? 'Shift Pagi' : 'Shift Sore',
          start: pagi ? '07:00' : '14:00', end: pagi ? '15:00' : '22:00'
        });
      });
    }
    DB.insertMany('leaves', [
      { employeeId:employees[5].id, type:'Cuti Tahunan', from:U.addDays(U.today(),4), to:U.addDays(U.today(),6), days:3, reason:'Acara keluarga di luar kota', status:'menunggu', requestedAt:U.addDays(U.today(),-1) },
      { employeeId:employees[7].id, type:'Sakit', from:U.addDays(U.today(),-3), to:U.addDays(U.today(),-2), days:2, reason:'Demam, ada surat dokter', status:'disetujui', approvedBy:'usr_hrd', requestedAt:U.addDays(U.today(),-4) },
      { employeeId:employees[11].id,type:'Izin', from:U.addDays(U.today(),1), to:U.addDays(U.today(),1), days:1, reason:'Mengurus dokumen', status:'menunggu', requestedAt:U.today() }
    ]);

    /* -------- 7. Payroll bulan lalu -------- */
    const lastMonth = U.monthKey(U.addMonths(U.today(), -1));
    const payLines = employees.map(e => {
      const allow = U.sum(e.allowances, a => a.amount);
      const ded = U.sum(e.deductions, a => a.amount);
      const ot = rnd(0, 14) * Math.round(e.salaryBase / 173 * 1.5);
      const comm = e.commissionRate ? rnd(120, 700) * 1000 : 0;
      const gross = e.salaryBase + allow + ot + comm;
      const tax = gross > 5400000 ? Math.round((gross - 4500000) * 0.05) : 0;
      return { employeeId:e.id, name:e.name, base:e.salaryBase, allowance:allow, overtime:ot,
               commission:comm, deduction:ded, tax, bpjs:0, net: gross - ded - tax, days:rnd(22,26) };
    });
    /* Komisi pada payroll periode lalu berasal dari penjualan sebelum rentang
       riwayat ini. Akui dulu sebagai beban & hutang agar saldo Hutang Gaji
       tetap benar saat gaji dibayarkan. */
    const commPrev = U.sum(payLines, l => l.commission);
    if (commPrev) L.post({
      date: U.endOfMonth(lastMonth + '-01'), ref:'KOM/' + lastMonth, refType:'commission',
      memo:`Akrual komisi karyawan periode ${lastMonth}`, outletId: outlets[0].id, source:'hr',
      lines:[{ code:L.A.EXP_COMMISSION, debit:commPrev }, { code:L.A.SALARY_PAYABLE, credit:commPrev }]
    });
    const run = DB.insert('payrolls', {
      no: DB.nextNo('payroll','PAY'), period:lastMonth, outletId:'ALL',
      runDate: U.addDays(U.today(), -DAYS + 4), lines: payLines,
      total: U.sum(payLines, l => l.net), status:'dibayar', paidAt: U.addDays(U.today(), -DAYS + 4),
      note:'Penggajian reguler ' + U.fmtDate(lastMonth + '-01','month')
    });
    L.postPayroll(run);
    L.postPayrollPayment(run, L.id(L.A.BANK));

    /* -------- 8. Reservasi -------- */
    const resStatus = ['dikonfirmasi','menunggu','dikonfirmasi','selesai'];
    for (let i = 0; i < 8; i++) {
      const c = pick(customers);
      const o = pick(outlets);
      DB.insert('reservations', {
        outletId:o.id, customerId:c.id, name:c.name, phone:c.phone,
        date: U.addDays(U.today(), rnd(-1, 5)), time: pick(['11:30','12:00','13:00','18:00','19:00','19:30','20:00']),
        pax: rnd(2, 12), tableId: pick(DB.where('tables', t => t.outletId === o.id)).id,
        status: pick(resStatus), note: pick(['Ulang tahun, tolong siapkan lilin','Butuh kursi bayi','Dekat jendela','Meeting kantor','-']),
        depositPaid: chance(0.3) ? 200000 : 0
      });
    }

    /* -------- 9. Sesi kasir & pesanan berjalan hari ini -------- */
    const today = U.today();
    const mainOutlet = outlets[0];
    const openShift = DB.insert('shifts', {
      id:'shf_open_today', outletId:mainOutlet.id, userId:'usr_kasir1',
      openAt: `${today}T07:30:00`, closeAt:null, openingCash:500000,
      cashIn:0, cashOut:0, salesCash:0, salesNonCash:0, orders:0, gross:0, status:'open', note:''
    });
    outlets.slice(1).forEach((o, i) => {
      DB.insert('shifts', {
        id:'shf_open_' + o.code, outletId:o.id, userId: i === 0 ? 'usr_kasir2' : 'usr_dapur',
        openAt: `${today}T08:00:00`, closeAt:null, openingCash:500000,
        cashIn:0, cashOut:0, salesCash:0, salesNonCash:0, orders:0, gross:0, status:'open', note:''
      });
    });

    /* Transaksi hari ini yang sudah lunas */
    const todayOrders = [];
    const hoursSoFar = Math.max(9, new Date().getHours());
    for (let i = 0; i < rnd(9, 16); i++) {
      const o = makeOrder(mainOutlet, today, rnd(8, hoursSoFar), i + 1, openShift.id);
      if (o) { DB.insert('orders', o); todayOrders.push(o); }
    }
    consumeDaily(mainOutlet, today, todayOrders);
    todayOrders.forEach(o => L.postSale(o));
    const cashToday = U.sum(todayOrders, o => U.sum(o.payments.filter(p => p.method === 'cash'), p => p.amount));
    DB.update('shifts', openShift.id, {
      salesCash: cashToday, salesNonCash: U.sum(todayOrders, o => o.total) - cashToday,
      orders: todayOrders.length, gross: U.sum(todayOrders, o => o.total)
    });

    /* Pesanan meja yang masih berjalan (untuk peta meja & KDS) */
    const openTables = DB.where('tables', t => t.outletId === mainOutlet.id).slice(0, 3);
    openTables.forEach((t, i) => {
      const o = makeOrder(mainOutlet, today, hoursSoFar, 900 + i, openShift.id);
      if (!o) return;
      o.status = 'open'; o.payments = []; o.paidAt = null; o.change = 0;
      o.tableId = t.id; o.tableName = t.name; o.type = 'dinein'; o.channel = 'kasir';
      o.kitchenStatus = i === 0 ? 'cooking' : 'new';
      o.createdAt = new Date(Date.now() - (i * 7 + 3) * 60000).toISOString();
      o.date = o.createdAt;
      o.items.forEach(it => { it.kdsStatus = i === 0 ? 'cooking' : 'new'; it.station = (DB.find('products', it.productId)||{}).station; it.modifiers = it.modifiers || []; });
      DB.insert('orders', o);
      DB.update('tables', t.id, { status:'occupied', orderId:o.id, openedAt:o.createdAt });
    });
    /* Satu meja sudah minta bill */
    const billedTable = DB.where('tables', t => t.outletId === mainOutlet.id)[4];
    if (billedTable) {
      const o = makeOrder(mainOutlet, today, hoursSoFar, 910, openShift.id);
      if (o) {
        o.status='open'; o.payments=[]; o.paidAt=null; o.tableId=billedTable.id; o.tableName=billedTable.name;
        o.type='dinein'; o.channel='kasir'; o.kitchenStatus='served';
        o.items.forEach(it => { it.kdsStatus='done'; it.station = (DB.find('products', it.productId)||{}).station; it.modifiers = it.modifiers || []; });
        o.createdAt = new Date(Date.now() - 52 * 60000).toISOString(); o.date = o.createdAt;
        DB.insert('orders', o);
        DB.update('tables', billedTable.id, { status:'billed', orderId:o.id, openedAt:o.createdAt });
      }
    }

    /* Pesanan online masuk (menunggu diproses) */
    const chans = ['gofood','grabfood','shopeefood','webstore','emenu'];
    for (let i = 0; i < 5; i++) {
      const o = makeOrder(mainOutlet, today, hoursSoFar, 950 + i, openShift.id);
      if (!o) continue;
      o.status='open'; o.payments=[]; o.paidAt=null; o.type = i < 3 ? 'ojol' : 'ecommerce';
      o.channel = chans[i]; o.tableId=null; o.tableName=null;
      o.kitchenStatus = 'new'; o.onlineStatus='menunggu konfirmasi';
      o.items.forEach(it => { it.kdsStatus='new'; it.station = (DB.find('products', it.productId)||{}).station; it.modifiers = it.modifiers || []; });
      o.createdAt = new Date(Date.now() - rnd(1, 14) * 60000).toISOString(); o.date = o.createdAt;
      o.driverName = i < 3 ? pick(['Agus S.','Rudi H.','Bambang W.','Slamet R.']) : null;
      DB.insert('orders', o);
    }

    /* -------- 10. Stok terbuang & kondisi restok (agar alur pembelian terlihat) -------- */
    const wasteTargets = ['Susu UHT Full Cream','Kentang Beku','Keju Mozarella','Sirup Caramel'];
    wasteTargets.forEach((nama, i) => {
      const m = DB.all('products').find(p => p.name === nama);
      if (!m) return;
      const kini = App.Inv.qty(mainOutlet.id, m.id);
      const target = m.minStock * (0.55 + i * 0.12);
      const buang = Math.round(kini - target);
      if (buang > 0) App.Inv.waste(mainOutlet.id, m.id, buang,
        pick(['Bahan kadaluarsa saat pengecekan harian','Tumpah saat penyimpanan','Kemasan rusak dari supplier','Kualitas menurun, tidak layak jual']));
    });
    /* beberapa catatan terbuang kecil di hari-hari sebelumnya */
    for (let i = 0; i < 5; i++) {
      const m = pick(materials);
      const kini = App.Inv.qty(mainOutlet.id, m.id);
      if (kini > m.minStock * 2) App.Inv.waste(mainOutlet.id, m.id, Math.max(1, Math.round(m.minStock * 0.05)),
        pick(['Sisa produksi tidak terpakai','Tumpah','Rusak saat penyimpanan']));
    }

    /* -------- 11. Notifikasi awal -------- */
    App.Inv.lowStockList(mainOutlet.id).slice(0, 4).forEach(r =>
      DB.insert('notifications', { type:'lowstock', title:'Stok menipis',
        message:`${r.product.name} tersisa ${U.num(r.qty,1)} ${r.product.unit} (min ${U.num(r.min,1)})`,
        productId:r.product.id, outletId:mainOutlet.id, read:false, at:U.now(), level:'warn' }));
    DB.insert('notifications', { type:'bill', title:'Tagihan jatuh tempo',
      message:'Ada tagihan supplier yang akan jatuh tempo dalam 3 hari. Cek menu Pembelian → Tagihan.',
      read:false, at:U.now(), level:'warn' });
    DB.insert('notifications', { type:'hr', title:'Pengajuan cuti menunggu',
      message:'2 pengajuan cuti karyawan menunggu persetujuan Anda.', read:false, at:U.now(), level:'info' });

    DB.saveNow();
  }

  return { build, DAYS };
})();
