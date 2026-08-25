/* =============================================================
   SajiPOS — Mesin Akuntansi (double-entry)
   Semua transaksi operasional otomatis terposting ke jurnal.
   ============================================================= */
window.App = window.App || {};

App.Ledger = (function () {
  const U = App.U;

  /* Kode akun standar yang dipakai mesin auto-posting */
  const A = {
    CASH_DRAWER:'1-10001', CASH_MAIN:'1-10002', BANK:'1-10100', EWALLET:'1-10110',
    AR:'1-10200', INV_MATERIAL:'1-10300', INV_PRODUCT:'1-10310', PREPAID:'1-10400',
    EQUIPMENT:'1-20000', ACC_DEPR:'1-20100',
    AP:'2-10000', SALARY_PAYABLE:'2-10100', BPJS_PAYABLE:'2-10110', TAX_OUT:'2-10200', CUST_DEPOSIT:'2-10300', BANK_LOAN:'2-20000',
    CAPITAL:'3-10000', RETAINED:'3-20000', DRAWING:'3-30000',
    SALES_FOOD:'4-10000', SALES_BEV:'4-10100', SALES_OTHER:'4-10200', SERVICE_CHARGE:'4-10300',
    SALES_DISCOUNT:'4-20000', OTHER_INCOME:'4-30000',
    COGS:'5-10000',
    EXP_SALARY:'6-10000', EXP_COMMISSION:'6-10010', EXP_RENT:'6-10100', EXP_UTILITY:'6-10200',
    EXP_MARKETING:'6-10300', EXP_SUPPLIES:'6-10400', EXP_MAINT:'6-10500', EXP_BANK:'6-10600',
    EXP_DEPR:'6-10700', EXP_WASTE:'6-10800', EXP_OTHER:'6-10900'
  };

  function byCode(code) { return App.DB.first('accounts', a => a.code === code); }
  function id(code) { const a = byCode(code); return a ? a.id : null; }
  function name(accountId) { const a = App.DB.find('accounts', accountId); return a ? a.name : '—'; }
  function typeOf(accountId) { const a = App.DB.find('accounts', accountId); return a ? a.type : ''; }
  function normalOf(accountId) {
    const t = typeOf(accountId);
    return (t === 'asset' || t === 'expense') ? 'D' : 'C';
  }

  /* Akun kas/bank berdasarkan metode pembayaran POS */
  function accountForPayment(method) {
    switch (method) {
      case 'cash':    return id(A.CASH_DRAWER);
      case 'qris':
      case 'ewallet': return id(A.EWALLET);
      case 'debit':
      case 'credit':
      case 'transfer':return id(A.BANK);
      case 'invoice': return id(A.AR);
      case 'deposit': return id(A.CUST_DEPOSIT);
      default:        return id(A.CASH_DRAWER);
    }
  }

  /* ---------- posting ---------- */
  function post(entry) {
    const lines = (entry.lines || [])
      .map(l => ({
        accountId: l.accountId || id(l.code),
        debit: U.round2(l.debit || 0),
        credit: U.round2(l.credit || 0),
        memo: l.memo || ''
      }))
      .filter(l => l.accountId && (l.debit || l.credit));

    if (!lines.length) return null;
    const d = U.round2(U.sum(lines, l => l.debit));
    const c = U.round2(U.sum(lines, l => l.credit));
    if (Math.abs(d - c) > 0.5) {
      console.warn('Jurnal tidak seimbang', entry, d, c);
      if (App.UI) App.UI.toast(`Jurnal tidak seimbang (D ${U.rp(d)} vs K ${U.rp(c)})`, 'err');
      return null;
    }
    return App.DB.insert('journals', {
      no: App.DB.nextNo('journal', 'JU'),
      date: entry.date || U.today(),
      ref: entry.ref || '',
      refType: entry.refType || 'manual',
      refId: entry.refId || null,
      memo: entry.memo || '',
      outletId: entry.outletId || App.State.outletId(),
      source: entry.source || 'manual',
      userId: App.Auth.user() ? App.Auth.user().id : null,
      lines, total: d, posted: true
    });
  }
  function reverse(journalId, memo) {
    const j = App.DB.find('journals', journalId);
    if (!j) return null;
    return post({
      date: U.today(), ref: j.no, refType: 'reversal', refId: j.id,
      memo: memo || 'Pembalikan ' + j.no, outletId: j.outletId, source: 'reversal',
      lines: j.lines.map(l => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, memo: l.memo }))
    });
  }
  function removeByRef(refType, refId) {
    return App.DB.removeWhere('journals', j => j.refType === refType && j.refId === refId);
  }

  /* ---------- query ---------- */
  function entriesIn(from, to, outletId) {
    return App.DB.all('journals').filter(j =>
      (!from || j.date >= from) && (!to || j.date <= to) &&
      (!outletId || outletId === 'ALL' || j.outletId === outletId));
  }
  function accountMovement(accountId, from, to, outletId) {
    let d = 0, c = 0;
    entriesIn(from, to, outletId).forEach(j => j.lines.forEach(l => {
      if (l.accountId === accountId) { d += l.debit; c += l.credit; }
    }));
    return { debit: d, credit: c, net: normalOf(accountId) === 'D' ? d - c : c - d };
  }
  function balance(accountId, asOf, outletId) {
    return accountMovement(accountId, null, asOf || U.today(), outletId).net;
  }
  function balanceByCode(code, asOf, outletId) {
    const a = byCode(code);
    return a ? balance(a.id, asOf, outletId) : 0;
  }

  function ledgerOf(accountId, from, to, outletId) {
    const rows = [];
    let saldo = accountMovement(accountId, null, U.addDays(from, -1), outletId).net;
    const opening = saldo;
    U.sortBy(entriesIn(from, to, outletId), j => j.date + (j.createdAt || ''))
      .forEach(j => j.lines.forEach(l => {
        if (l.accountId !== accountId) return;
        saldo += normalOf(accountId) === 'D' ? (l.debit - l.credit) : (l.credit - l.debit);
        rows.push({ date: j.date, no: j.no, memo: l.memo || j.memo, ref: j.ref, debit: l.debit, credit: l.credit, saldo });
      }));
    return { opening, rows, closing: saldo };
  }

  function trialBalance(from, to, outletId) {
    return App.DB.all('accounts')
      .filter(a => !a.isGroup)
      .map(a => {
        const m = accountMovement(a.id, from, to, outletId);
        const open = accountMovement(a.id, null, U.addDays(from, -1), outletId).net;
        const close = normalOf(a.id) === 'D' ? open + m.debit - m.credit : open + m.credit - m.debit;
        return { ...a, opening: open, debit: m.debit, credit: m.credit, closing: close };
      })
      .filter(r => r.opening || r.debit || r.credit || r.closing)
      .sort((x, y) => x.code.localeCompare(y.code));
  }

  function profitLoss(from, to, outletId) {
    const accts = App.DB.all('accounts');
    const rev = [], exp = [];
    accts.filter(a => a.type === 'revenue').forEach(a => {
      const m = accountMovement(a.id, from, to, outletId);
      const v = m.credit - m.debit;
      if (v || m.debit || m.credit) rev.push({ ...a, value: v });
    });
    accts.filter(a => a.type === 'expense').forEach(a => {
      const m = accountMovement(a.id, from, to, outletId);
      const v = m.debit - m.credit;
      if (v || m.debit || m.credit) exp.push({ ...a, value: v });
    });
    const cogs = exp.filter(a => a.code.startsWith('5-'));
    const opex = exp.filter(a => !a.code.startsWith('5-'));
    const pendapatan = U.sum(rev.filter(a => !a.code.startsWith('4-20')), a => a.value);
    const diskon = -U.sum(rev.filter(a => a.code.startsWith('4-20')), a => a.value);
    const netSales = pendapatan - diskon;
    const totalCogs = U.sum(cogs, a => a.value);
    const grossProfit = netSales - totalCogs;
    const totalOpex = U.sum(opex, a => a.value);
    return {
      revenue: rev.filter(a => !a.code.startsWith('4-20')).sort((a, b) => a.code.localeCompare(b.code)),
      discount: diskon, netSales, cogs, totalCogs, grossProfit,
      opex: opex.sort((a, b) => a.code.localeCompare(b.code)), totalOpex,
      netProfit: grossProfit - totalOpex,
      grossMargin: netSales ? (grossProfit / netSales) * 100 : 0,
      netMargin: netSales ? ((grossProfit - totalOpex) / netSales) * 100 : 0
    };
  }

  function balanceSheet(asOf, outletId) {
    const accts = App.DB.all('accounts').filter(a => !a.isGroup);
    const grab = t => accts.filter(a => a.type === t)
      .map(a => ({ ...a, value: balance(a.id, asOf, outletId) }))
      .filter(a => Math.abs(a.value) > 0.4)
      .sort((a, b) => a.code.localeCompare(b.code));
    const assets = grab('asset'), liabilities = grab('liability'), equityAcc = grab('equity');
    const pl = profitLoss('1900-01-01', asOf, outletId);
    const totalAsset = U.sum(assets, a => a.value);
    const totalLiab = U.sum(liabilities, a => a.value);
    const totalEquityAcc = U.sum(equityAcc, a => a.value);
    return {
      assets, liabilities, equityAcc, totalAsset, totalLiab,
      currentEarning: pl.netProfit,
      totalEquity: totalEquityAcc + pl.netProfit,
      balanced: Math.abs(totalAsset - (totalLiab + totalEquityAcc + pl.netProfit)) < 1
    };
  }

  function cashAccounts() {
    return App.DB.all('accounts').filter(a => a.isCash);
  }
  function cashFlow(from, to, outletId) {
    const cashIds = cashAccounts().map(a => a.id);
    const buckets = { operasi: [], investasi: [], pendanaan: [] };
    let masuk = 0, keluar = 0;
    entriesIn(from, to, outletId).forEach(j => {
      const cashLines = j.lines.filter(l => cashIds.includes(l.accountId));
      if (!cashLines.length) return;
      const delta = U.sum(cashLines, l => l.debit - l.credit);
      if (!delta) return;
      if (delta > 0) masuk += delta; else keluar += -delta;
      const counter = j.lines.filter(l => !cashIds.includes(l.accountId));
      const cat = classifyFlow(counter);
      buckets[cat].push({ date: j.date, no: j.no, memo: j.memo, amount: delta,
        akun: counter.map(l => name(l.accountId)).join(', ') });
    });
    const openingCash = U.sum(cashIds, aid => accountMovement(aid, null, U.addDays(from, -1), outletId).net);
    return {
      buckets, masuk, keluar, net: masuk - keluar,
      openingCash, closingCash: openingCash + masuk - keluar,
      totals: {
        operasi: U.sum(buckets.operasi, r => r.amount),
        investasi: U.sum(buckets.investasi, r => r.amount),
        pendanaan: U.sum(buckets.pendanaan, r => r.amount)
      }
    };
  }
  function classifyFlow(lines) {
    const codes = lines.map(l => { const a = App.DB.find('accounts', l.accountId); return a ? a.code : ''; });
    if (codes.some(c => c.startsWith('1-2'))) return 'investasi';
    if (codes.some(c => c.startsWith('3-') || c.startsWith('2-2'))) return 'pendanaan';
    return 'operasi';
  }

  /* Umur piutang & hutang */
  function agingBuckets(items, dateKey = 'dueDate') {
    const today = U.today();
    const b = { lancar: 0, d30: 0, d60: 0, d90: 0, lebih: 0, rows: [] };
    items.forEach(it => {
      const outstanding = (it.total || 0) - (it.paid || 0);
      if (outstanding <= 0.5) return;
      const due = it[dateKey] || it.date;
      const days = Math.floor((new Date(today) - new Date(due)) / 86400000);
      let bucket = 'lancar';
      if (days > 90) bucket = 'lebih'; else if (days > 60) bucket = 'd90';
      else if (days > 30) bucket = 'd60'; else if (days > 0) bucket = 'd30';
      b[bucket] += outstanding;
      b.rows.push({ ...it, outstanding, days, bucket });
    });
    return b;
  }

  /* ---------- otomatisasi posting per dokumen ---------- */

  /* 1. Penjualan POS */
  function postSale(order) {
    if (!order || order.status === 'void') return null;
    const cat = c => App.DB.find('categories', c);
    const foodRev = {}; // { accountCode: amount }
    (order.items || []).forEach(it => {
      const p = App.DB.find('products', it.productId);
      const c = p ? cat(p.categoryId) : null;
      const code = (c && c.revenueAccount) || (c && /minum|beverage|kopi|drink/i.test(c.name) ? A.SALES_BEV : A.SALES_FOOD);
      foodRev[code] = (foodRev[code] || 0) + (it.subtotal || 0);
    });
    const lines = [];
    (order.payments || []).forEach(p => {
      lines.push({ accountId: accountForPayment(p.method), debit: p.amount, memo: 'Pembayaran ' + p.method });
      if (p.mdr) {
        lines.push({ code: A.EXP_BANK, debit: p.mdr, memo: 'Biaya MDR ' + p.method });
        lines[lines.length - 2].debit = U.round2(p.amount - p.mdr);
      }
    });
    if (order.discount) lines.push({ code: A.SALES_DISCOUNT, debit: order.discount, memo: 'Diskon penjualan' });
    if (order.roundingAdj) lines.push({ code: A.OTHER_INCOME, credit: order.roundingAdj, memo: 'Pembulatan' });
    Object.entries(foodRev).forEach(([code, amt]) => lines.push({ code, credit: amt, memo: 'Penjualan' }));
    if (order.serviceCharge) lines.push({ code: A.SERVICE_CHARGE, credit: order.serviceCharge, memo: 'Service charge' });
    if (order.tax) lines.push({ code: A.TAX_OUT, credit: order.tax, memo: 'PB1 / PPN keluaran' });

    const j1 = post({
      date: U.ymd(order.paidAt || order.date), ref: order.no, refType: 'sale', refId: order.id,
      memo: `Penjualan ${order.no} — ${order.typeLabel || order.type}`, outletId: order.outletId, source: 'pos', lines
    });
    if (order.cogs > 0) {
      post({
        date: U.ymd(order.paidAt || order.date), ref: order.no, refType: 'cogs', refId: order.id,
        memo: `HPP ${order.no}`, outletId: order.outletId, source: 'pos',
        lines: [
          { code: A.COGS, debit: order.cogs, memo: 'Harga pokok penjualan' },
          { code: A.INV_MATERIAL, credit: order.cogs, memo: 'Pemakaian persediaan' }
        ]
      });
    }
    if (order.commission > 0) {
      post({
        date: U.ymd(order.paidAt || order.date), ref: order.no, refType: 'commission', refId: order.id,
        memo: `Komisi karyawan ${order.no}`, outletId: order.outletId, source: 'pos',
        lines: [
          { code: A.EXP_COMMISSION, debit: order.commission, memo: 'Beban komisi' },
          { code: A.SALARY_PAYABLE, credit: order.commission, memo: 'Hutang komisi' }
        ]
      });
    }
    return j1;
  }

  /* 2. Penerimaan barang (GRN) → persediaan & hutang usaha */
  function postGRN(grn) {
    const total = U.sum(grn.items, i => i.qty * i.price);
    return post({
      date: grn.date, ref: grn.no, refType: 'grn', refId: grn.id,
      memo: `Penerimaan barang ${grn.no}`, outletId: grn.outletId, source: 'procurement',
      lines: [
        { code: A.INV_MATERIAL, debit: total, memo: 'Persediaan masuk' },
        { code: A.AP, credit: total, memo: 'Hutang ke supplier' }
      ]
    });
  }

  /* 3. Pembayaran tagihan supplier */
  function postBillPayment(payment, bill) {
    return post({
      date: payment.date, ref: bill.no, refType: 'billPayment', refId: payment.id,
      memo: `Pembayaran tagihan ${bill.no}`, outletId: bill.outletId, source: 'procurement',
      lines: [
        { code: A.AP, debit: payment.amount, memo: 'Pelunasan hutang' },
        { accountId: payment.accountId || id(A.BANK), credit: payment.amount, memo: 'Kas/bank keluar' }
      ]
    });
  }

  /* 4. Pengeluaran biaya operasional */
  function postExpense(exp) {
    return post({
      date: exp.date, ref: exp.no, refType: 'expense', refId: exp.id,
      memo: exp.note || 'Pengeluaran operasional', outletId: exp.outletId, source: 'accounting',
      lines: [
        { accountId: exp.accountId, debit: exp.amount, memo: exp.note },
        { accountId: exp.paymentAccountId, credit: exp.amount, memo: 'Pembayaran' }
      ]
    });
  }

  /* 5. Penyesuaian persediaan (waste / opname) */
  function postInventoryAdj(move, value) {
    if (!value) return null;
    const loss = value < 0;
    return post({
      date: U.ymd(move.date), ref: move.ref || move.id, refType: 'invAdj', refId: move.id,
      memo: `Penyesuaian stok: ${move.type} — ${move.note || ''}`, outletId: move.outletId, source: 'inventory',
      lines: loss
        ? [{ code: A.EXP_WASTE, debit: -value, memo: 'Kerugian persediaan' }, { code: A.INV_MATERIAL, credit: -value }]
        : [{ code: A.INV_MATERIAL, debit: value, memo: 'Selisih lebih opname' }, { code: A.OTHER_INCOME, credit: value }]
    });
  }

  /* 6. Payroll */
  /* Komisi penjualan sudah dibebankan & diakui sebagai hutang saat transaksi
     terjadi (postSale), sehingga di sini komisi TIDAK dibebankan ulang —
     hanya gaji pokok, tunjangan, dan lembur yang menjadi beban baru. */
  /* Beban gaji dijurnal per outlet penempatan karyawan, sehingga laporan laba
     rugi tiap cabang menanggung biaya tenaga kerjanya sendiri. */
  function postPayroll(run) {
    const byOutlet = {};
    run.lines.forEach(l => {
      const emp = App.DB.find('employees', l.employeeId);
      const oid = (emp && emp.outletId) || run.outletId;
      (byOutlet[oid] = byOutlet[oid] || []).push(l);
    });
    const posted = [];
    Object.entries(byOutlet).forEach(([oid, lines]) => {
      const earnings = U.sum(lines, l => l.base + l.allowance + l.overtime);
      const tax = U.sum(lines, l => l.tax);
      const ded = U.sum(lines, l => l.deduction + l.bpjs);
      const outletName = (App.DB.find('outlets', oid) || {}).name || '';
      const j = post({
        date: run.runDate, ref: run.no, refType: 'payroll', refId: run.id,
        memo: `Penggajian periode ${run.period}${outletName ? ' — ' + outletName : ''}`,
        outletId: oid, source: 'hr',
        lines: [
          { code: A.EXP_SALARY, debit: earnings, memo: 'Beban gaji, tunjangan & lembur' },
          { code: A.SALARY_PAYABLE, credit: earnings - tax - ded, memo: 'Hutang gaji karyawan' },
          { code: A.TAX_OUT, credit: tax, memo: 'PPh 21 terutang' },
          { code: A.BPJS_PAYABLE, credit: ded, memo: 'Potongan BPJS karyawan' }
        ].filter(l => l.debit || l.credit)
      });
      if (j) posted.push(j);
    });
    return posted[0] || null;
  }
  function postPayrollPayment(run, accountId) {
    const net = U.sum(run.lines, l => l.net);
    return post({
      date: U.today(), ref: run.no, refType: 'payrollPayment', refId: run.id,
      memo: `Pembayaran gaji ${run.period}`, outletId: run.outletId, source: 'hr',
      lines: [
        { code: A.SALARY_PAYABLE, debit: net, memo: 'Pelunasan gaji' },
        { accountId: accountId || id(A.BANK), credit: net, memo: 'Transfer gaji' }
      ]
    });
  }

  /* 7. Kas masuk/keluar outlet (shift) */
  function postCashMove(mv) {
    const isIn = mv.type === 'in';
    return post({
      date: U.ymd(mv.date), ref: mv.id, refType: 'cashMove', refId: mv.id,
      memo: mv.note || (isIn ? 'Kas masuk outlet' : 'Kas keluar outlet'),
      outletId: mv.outletId, source: 'pos',
      lines: isIn
        ? [{ code: A.CASH_DRAWER, debit: mv.amount }, { accountId: mv.counterAccountId || id(A.CASH_MAIN), credit: mv.amount }]
        : [{ accountId: mv.counterAccountId || id(A.EXP_SUPPLIES), debit: mv.amount }, { code: A.CASH_DRAWER, credit: mv.amount }]
    });
  }

  /* 8. Setoran tutup kasir ke kas besar */
  function postShiftDeposit(shift, amount) {
    if (amount <= 0) return null;
    return post({
      date: U.ymd(shift.closeAt || U.today()), ref: 'SHIFT/' + shift.id.slice(-5), refType: 'shift', refId: shift.id,
      memo: 'Setoran tutup kasir', outletId: shift.outletId, source: 'pos',
      lines: [{ code: A.CASH_MAIN, debit: amount }, { code: A.CASH_DRAWER, credit: amount }]
    });
  }
  function postShiftVariance(shift, diff) {
    if (!diff) return null;
    return post({
      date: U.ymd(shift.closeAt || U.today()), ref: 'SHIFT/' + shift.id.slice(-5), refType: 'shiftDiff', refId: shift.id,
      memo: diff < 0 ? 'Selisih kurang kas kasir' : 'Selisih lebih kas kasir',
      outletId: shift.outletId, source: 'pos',
      lines: diff < 0
        ? [{ code: A.EXP_OTHER, debit: -diff, memo: 'Selisih kas' }, { code: A.CASH_DRAWER, credit: -diff }]
        : [{ code: A.CASH_DRAWER, debit: diff }, { code: A.OTHER_INCOME, credit: diff, memo: 'Selisih kas' }]
    });
  }

  /* 9. Deposit pelanggan */
  function postCustomerDeposit(cust, amount, method) {
    return post({
      date: U.today(), ref: cust.code, refType: 'deposit', refId: cust.id,
      memo: `Top up deposit ${cust.name}`, source: 'crm',
      lines: [
        { accountId: accountForPayment(method), debit: amount },
        { code: A.CUST_DEPOSIT, credit: amount, memo: 'Deposit pelanggan' }
      ]
    });
  }

  /* 10. Pembayaran piutang (invoice pelanggan) */
  function postARPayment(order, amount, method) {
    return post({
      date: U.today(), ref: order.no, refType: 'arPayment', refId: order.id,
      memo: `Pelunasan piutang ${order.no}`, outletId: order.outletId, source: 'accounting',
      lines: [
        { accountId: accountForPayment(method), debit: amount },
        { code: A.AR, credit: amount, memo: 'Pelunasan piutang usaha' }
      ]
    });
  }

  /* 11. Void / refund penjualan */
  function postVoid(order, reason) {
    const js = App.DB.where('journals', j => j.refId === order.id && ['sale','cogs','commission'].includes(j.refType));
    js.forEach(j => reverse(j.id, `Void ${order.no}: ${reason || ''}`));
    return js.length;
  }

  return {
    A, byCode, id, name, typeOf, normalOf, accountForPayment, cashAccounts,
    post, reverse, removeByRef, entriesIn, accountMovement, balance, balanceByCode, ledgerOf,
    trialBalance, profitLoss, balanceSheet, cashFlow, agingBuckets,
    postSale, postGRN, postBillPayment, postExpense, postInventoryAdj, postPayroll, postPayrollPayment,
    postCashMove, postShiftDeposit, postShiftVariance, postCustomerDeposit, postARPayment, postVoid
  };
})();
