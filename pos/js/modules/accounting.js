/* =============================================================
   SajiPOS — Akuntansi: Kas & Bank, Pengeluaran, Jurnal,
   Bagan Akun, Laporan Keuangan
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

/* ---------------- Kas & Bank ---------------- */
App.Views.finance = function (root) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  const state = App.Period.init('month');

  function draw() {
    const oid = App.State.outletId();
    const cashAccts = L.cashAccounts();
    const cf = L.cashFlow(state.from, state.to, oid);
    const ar = L.balanceByCode(L.A.AR, U.today(), oid);
    const ap = L.balanceByCode(L.A.AP, U.today(), oid);
    const arRows = App.Sales.orders({ from:'2000-01-01', to:U.today(), outletId:oid })
      .filter(o => (o.payments || []).some(p => p.method === 'invoice'));

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Kas & Bank</h2><p>Posisi likuiditas, arus kas masuk/keluar, piutang dan hutang</p></div>
        <div class="page-head__actions" id="period"></div>
      </div>
      <div class="grid g4 mb-16">
        ${cashAccts.map(a => App.UI.stat({ label:a.name, icon:'💳', value:U.rp(L.balance(a.id, U.today(), null)),
          sub:'saldo per hari ini' })).join('')}
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Kas Masuk', icon:'⬆️', value:U.rp(cf.masuk), sub:'periode terpilih', tone:'var(--lime)' })}
        ${App.UI.stat({ label:'Kas Keluar', icon:'⬇️', value:U.rp(cf.keluar), sub:'periode terpilih', tone:'var(--rose)' })}
        ${App.UI.stat({ label:'Arus Kas Bersih', icon:'💧', value:U.rp(cf.net), sub:`saldo akhir ${U.compact(cf.closingCash)}` })}
        ${App.UI.stat({ label:'Piutang / Hutang', icon:'⚖️', value:U.rp(ar) + ' / ' + U.rp(ap), sub:'AR / AP berjalan' })}
      </div>
      <div class="grid g-2-1 mb-16">
        <div class="card">
          <div class="card__head"><h3>Arus Kas Harian</h3></div>
          <div class="card__body" id="cf-chart"></div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Klasifikasi Arus Kas</h3></div>
          <div class="card__body">
            <div class="kv"><span class="k">Aktivitas Operasi</span><span class="v">${U.rp(cf.totals.operasi)}</span></div>
            <div class="kv"><span class="k">Aktivitas Investasi</span><span class="v">${U.rp(cf.totals.investasi)}</span></div>
            <div class="kv"><span class="k">Aktivitas Pendanaan</span><span class="v">${U.rp(cf.totals.pendanaan)}</span></div>
            <div class="divider"></div>
            <div class="kv"><span class="k">Saldo awal periode</span><span class="v">${U.rp(cf.openingCash)}</span></div>
            <div class="kv"><span class="k bold">Saldo akhir</span><span class="v" style="color:var(--brand-600)">${U.rp(cf.closingCash)}</span></div>
          </div>
        </div>
      </div>
      <div class="grid g2">
        <div class="card">
          <div class="card__head"><h3>Piutang Usaha (Invoice)</h3><span class="sub">${U.rp(ar)}</span></div>
          <div class="card__body" style="max-height:340px;overflow:auto">
            ${arRows.length ? arRows.map(o => `<div class="kv"><span class="k">${U.esc(o.no)} · ${U.esc(o.customerName || 'Umum')}<br>
              <span class="small">${U.fmtDate(o.date)}</span></span>
              <span class="v">${U.rp(o.total)} <button class="btn btn--sm" data-ar="${o.id}">Terima</button></span></div>`).join('')
              : App.UI.emptyState('Tidak ada piutang','Semua transaksi lunas','✅')}
          </div>
        </div>
        <div class="card">
          <div class="card__head"><h3>Mutasi Kas Terakhir</h3></div>
          <div class="card__body" style="max-height:340px;overflow:auto">
            ${U.sortBy([...cf.buckets.operasi, ...cf.buckets.investasi, ...cf.buckets.pendanaan], r => r.date, 'desc').slice(0, 18)
              .map(r => `<div class="kv"><span class="k">${U.esc(r.memo)}<br><span class="small">${U.fmtDate(r.date)} · ${U.esc(r.akun)}</span></span>
                <span class="v" style="color:${r.amount > 0 ? 'var(--lime)' : 'var(--rose)'}">${r.amount > 0 ? '+' : ''}${U.rp(r.amount)}</span></div>`).join('')
              || App.UI.emptyState('Belum ada mutasi','','💵')}
          </div>
        </div>
      </div>`;

    root.querySelector('#period').appendChild(App.Period.bar(state, draw));
    const days = U.dateRangeDays(state.from, state.to);
    const allRows = [...cf.buckets.operasi, ...cf.buckets.investasi, ...cf.buckets.pendanaan];
    const byDay = U.groupBy(allRows, r => r.date);
    root.querySelector('#cf-chart').innerHTML = App.Chart.bar(days.map(d => ({
      label:U.fmtDate(d, 'dm'), value:U.sum(byDay[d] || [], r => r.amount),
      color: U.sum(byDay[d] || [], r => r.amount) >= 0 ? '#0d9c86' : '#e5484d'
    })), { height:200 });

    root.querySelectorAll('[data-ar]').forEach(b => b.onclick = () => {
      const o = DB.find('orders', b.dataset.ar);
      App.UI.formModal({
        title:'Terima Pembayaran Piutang', subtitle:`${o.no} — ${U.rp(o.total)}`,
        fields:[
          { name:'amount', label:'Jumlah diterima', type:'money', value:o.total, required:true },
          { name:'method', label:'Melalui', type:'select', options:[
            { value:'cash', label:'Tunai' }, { value:'transfer', label:'Transfer Bank' }, { value:'qris', label:'QRIS' }] }
        ],
        onSubmit(d) {
          L.postARPayment(o, d.amount, d.method);
          DB.update('orders', o.id, ord => ({ payments:[...ord.payments.filter(p => p.method !== 'invoice'),
            { method:d.method, amount:d.amount, ref:'AR-SETTLE' }] }));
          App.UI.toast('Piutang diterima & terposting', 'ok'); draw();
        }
      });
    });
  }
  draw();
};

/* ---------------- Pengeluaran ---------------- */
App.Views.expenses = function (root) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  const state = App.Period.init('month');

  function draw() {
    const oid = App.State.outletId();
    const rows = DB.all('expenses').filter(e =>
      (oid === 'ALL' || e.outletId === oid) && e.date >= state.from && e.date <= state.to);
    const byAcc = U.groupBy(rows, e => e.accountId);
    const chart = Object.entries(byAcc).map(([aid, list]) =>
      ({ label:L.name(aid), value:U.sum(list, e => e.amount) })).sort((a, b) => b.value - a.value);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Pengeluaran</h2><p>Catat biaya operasional — otomatis masuk jurnal & laporan laba rugi</p></div>
        <div class="page-head__actions" id="period">
          <button class="btn btn--primary" id="new-exp">+ Catat Pengeluaran</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Pengeluaran', icon:'🧾', value:U.rp(U.sum(rows, e => e.amount)), sub:`${rows.length} transaksi` })}
        ${App.UI.stat({ label:'Rata-rata Harian', icon:'📅', value:U.rp(U.sum(rows, e => e.amount) / Math.max(1, U.dateRangeDays(state.from, state.to).length)), sub:'periode terpilih' })}
        ${App.UI.stat({ label:'Kategori Terbesar', icon:'🔝', value:`<span style="font-size:14px">${U.esc(chart[0] ? chart[0].label : '-')}</span>`, sub:chart[0] ? U.rp(chart[0].value) : '' })}
        ${App.UI.stat({ label:'% dari Omzet', icon:'📊', value:(() => {
            const t = App.Sales.totals(App.Sales.orders({ from:state.from, to:state.to, outletId:oid }));
            return t.net ? U.pct(U.sum(rows, e => e.amount), t.net) : '0%'; })(), sub:'beban operasional' })}
      </div>
      <div class="grid g-2-1">
        <div id="table"></div>
        <div class="card">
          <div class="card__head"><h3>Komposisi Biaya</h3></div>
          <div class="card__body">${App.Chart.hbar(chart.slice(0, 10), { money:true })}</div>
        </div>
      </div>`;

    root.querySelector('#period').insertBefore(App.Period.bar(state, draw), root.querySelector('#new-exp'));
    root.querySelector('#new-exp').onclick = () => form();
    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:U.sortBy(rows, e => e.date, 'desc'), exportName:'pengeluaran', pageSize:15,
      searchKeys:['no','note'], onRowClick: e => form(e),
      cols:[
        { key:'no', label:'No', render:e => `<span class="mono">${U.esc(e.no)}</span>` },
        { key:'date', label:'Tanggal', render:e => U.fmtDate(e.date) },
        { key:'accountId', label:'Kategori Biaya', render:e => U.esc(L.name(e.accountId)) },
        { key:'note', label:'Keterangan', render:e => U.esc(e.note || '-') },
        { key:'paymentAccountId', label:'Dibayar dari', render:e => U.esc(L.name(e.paymentAccountId)) },
        { key:'outletId', label:'Outlet', render:e => U.esc((DB.find('outlets', e.outletId)||{}).name || 'Pusat') },
        { key:'amount', label:'Jumlah', align:'right', render:e => `<b>${U.rp(e.amount)}</b>`, sortValue:e => e.amount }
      ],
      footRow: data => `<td colspan="6">TOTAL</td><td class="num">${U.rp(U.sum(data, e => e.amount))}</td>`
    }));
  }
  function form(e) {
    const expAccounts = DB.all('accounts').filter(a => a.type === 'expense' && !a.isGroup);
    const payAccounts = L.cashAccounts();
    App.UI.formModal({
      title: e ? 'Ubah Pengeluaran' : 'Catat Pengeluaran', size:'lg',
      fields:[
        { name:'date', label:'Tanggal', type:'date', value:U.today(), required:true },
        { name:'amount', label:'Jumlah (Rp)', type:'money', required:true },
        { name:'accountId', label:'Kategori biaya', type:'select', required:true, col:2,
          options: expAccounts.map(a => ({ value:a.id, label:`${a.code} — ${a.name}` })) },
        { name:'paymentAccountId', label:'Dibayar dari', type:'select', required:true,
          options: payAccounts.map(a => ({ value:a.id, label:`${a.name} (${U.rp(L.balance(a.id))})` })) },
        { name:'outletId', label:'Outlet', type:'select',
          options: DB.all('outlets').map(o => ({ value:o.id, label:o.name })) },
        { name:'note', label:'Keterangan', required:true, col:2, placeholder:'mis. bayar listrik bulan Agustus' }
      ],
      values: e || { outletId: App.State.outletId() === 'ALL' ? DB.all('outlets')[0].id : App.State.outletId() },
      onSubmit(d) {
        if (e) {
          L.removeByRef('expense', e.id);
          DB.update('expenses', e.id, d);
          L.postExpense({ ...e, ...d });
        } else {
          const rec = DB.insert('expenses', { ...d, no:DB.nextNo('expense','BY'), status:'paid', userId:App.Auth.user().id });
          L.postExpense(rec);
        }
        App.UI.toast('Pengeluaran dicatat & terposting ke jurnal', 'ok');
        draw();
      }
    });
  }
  draw();
};

/* ---------------- Jurnal Umum ---------------- */
App.Views.journal = function (root, params) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  const state = App.Period.init('month');
  let q = (params && params.q) || '';

  function draw() {
    const oid = App.State.outletId();
    let rows = L.entriesIn(state.from, state.to, oid);
    if (q) rows = rows.filter(j => (j.no + j.memo + j.ref).toLowerCase().includes(q.toLowerCase()));
    rows = U.sortBy(rows, j => j.date + (j.createdAt || ''), 'desc');
    const totalD = U.sum(rows, j => j.total);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Jurnal Umum</h2><p>Seluruh pencatatan double-entry — otomatis dari POS, pembelian, HR, dan manual</p></div>
        <div class="page-head__actions" id="period">
          <button class="btn btn--primary" id="new-j">+ Jurnal Manual</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Jumlah Jurnal', icon:'📒', value:U.num(rows.length), sub:'periode terpilih' })}
        ${App.UI.stat({ label:'Total Debit = Kredit', icon:'⚖️', value:U.rp(totalD), sub:'seimbang' })}
        ${App.UI.stat({ label:'Otomatis dari Sistem', icon:'🤖', value:U.num(rows.filter(j => j.source !== 'manual').length), sub:'POS, pembelian, HR' })}
        ${App.UI.stat({ label:'Jurnal Manual', icon:'✍️', value:U.num(rows.filter(j => j.source === 'manual').length), sub:'input akuntan' })}
      </div>
      <div class="card mb-16"><div class="tbl-toolbar">
        <div class="search" style="max-width:none;flex:1"><input class="input" id="j-q" value="${U.esc(q)}" placeholder="Cari nomor jurnal / keterangan / referensi…"></div>
        <button class="btn btn--sm" id="j-export">⬇ Ekspor</button>
      </div></div>
      <div id="list"></div>`;

    root.querySelector('#period').insertBefore(App.Period.bar(state, draw), root.querySelector('#new-j'));
    root.querySelector('#j-q').oninput = U.debounce(e => { q = e.target.value; draw();
      const n = root.querySelector('#j-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 260);
    root.querySelector('#new-j').onclick = () => manualJournal();
    root.querySelector('#j-export').onclick = () => {
      const flat = [];
      rows.forEach(j => j.lines.forEach(l => flat.push({
        Tanggal:j.date, NoJurnal:j.no, Referensi:j.ref, Keterangan:j.memo,
        KodeAkun:(DB.find('accounts', l.accountId)||{}).code, NamaAkun:L.name(l.accountId),
        Debit:l.debit, Kredit:l.credit })));
      U.exportTable('jurnal-umum', flat);
    };

    const list = root.querySelector('#list');
    list.innerHTML = rows.slice(0, 120).map(j => `
      <div class="card mb-8"><div class="card__body card__body--tight">
        <div class="flex items-center gap-8 mb-8" style="padding:4px 6px">
          <span class="mono bold">${U.esc(j.no)}</span>
          <span class="muted small">${U.fmtDate(j.date)}</span>
          ${App.UI.badge(({ pos:'POS', procurement:'Pembelian', inventory:'Inventori', hr:'HR',
            accounting:'Akuntansi', system:'Sistem', crm:'CRM', reversal:'Pembalikan', manual:'Manual' })[j.source] || j.source,
            j.source === 'manual' ? 'violet' : 'brand')}
          <span style="flex:1">${U.esc(j.memo)}</span>
          <span class="bold num">${U.rp(j.total)}</span>
          ${j.source === 'manual' ? `<button class="btn btn--sm" data-jd="${j.id}">🗑️</button>` : ''}
        </div>
        <table class="tbl"><tbody>
          ${j.lines.map(l => `<tr>
            <td style="width:120px" class="mono small">${U.esc((DB.find('accounts', l.accountId)||{}).code || '')}</td>
            <td>${U.esc(L.name(l.accountId))}${l.memo ? `<div class="small muted">${U.esc(l.memo)}</div>` : ''}</td>
            <td class="num" style="width:140px">${l.debit ? U.rp(l.debit) : ''}</td>
            <td class="num" style="width:140px">${l.credit ? U.rp(l.credit) : ''}</td></tr>`).join('')}
        </tbody></table>
      </div></div>`).join('') || App.UI.emptyState('Belum ada jurnal', 'Transaksi akan otomatis membuat jurnal', '📒');
    if (rows.length > 120) list.insertAdjacentHTML('beforeend', `<p class="center muted small">Menampilkan 120 dari ${rows.length} jurnal. Persempit periode atau gunakan pencarian.</p>`);

    list.querySelectorAll('[data-jd]').forEach(b => b.onclick = async () => {
      if (await App.UI.confirm('Hapus jurnal manual ini?', { danger:true })) {
        DB.remove('journals', b.dataset.jd); draw();
      }
    });
  }

  function manualJournal() {
    const accts = DB.all('accounts').filter(a => !a.isGroup);
    let lines = [{ accountId:accts[0].id, debit:0, credit:0, memo:'' }, { accountId:accts[1].id, debit:0, credit:0, memo:'' }];
    const m = App.UI.modal({
      title:'Jurnal Manual', size:'xl',
      body:`<div class="form-row c3 mb-12">
          <div class="field"><label>Tanggal</label><input class="input" type="date" id="mj-date" value="${U.today()}"></div>
          <div class="field"><label>Referensi</label><input class="input" id="mj-ref" placeholder="opsional"></div>
          <div class="field"><label>Outlet</label><select class="select" id="mj-outlet">
            ${DB.all('outlets').map(o => `<option value="${o.id}">${U.esc(o.name)}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Keterangan *</label><input class="input" id="mj-memo" placeholder="mis. penyesuaian akhir bulan"></div>
        <div class="tbl-wrap card mb-12"><table class="tbl">
          <thead><tr><th>Akun</th><th>Keterangan</th><th class="num" style="width:150px">Debit</th><th class="num" style="width:150px">Kredit</th><th style="width:40px"></th></tr></thead>
          <tbody id="mj-body"></tbody>
          <tfoot><tr><td colspan="2">TOTAL</td><td class="num" id="mj-d">Rp 0</td><td class="num" id="mj-c">Rp 0</td><td></td></tr></tfoot>
        </table></div>
        <button class="btn btn--sm" id="mj-add">+ Baris</button>
        <div class="small mt-8" id="mj-status"></div>`,
      footer:`<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Posting Jurnal</button>`
    });
    const render = () => {
      m.body.querySelector('#mj-body').innerHTML = lines.map((l, i) => `<tr data-i="${i}">
        <td><select class="select mj-a">${accts.map(a => `<option value="${a.id}" ${a.id === l.accountId ? 'selected' : ''}>${a.code} — ${U.esc(a.name)}</option>`).join('')}</select></td>
        <td><input class="input mj-m" value="${U.esc(l.memo)}"></td>
        <td><input class="input input--num mj-d" type="number" value="${l.debit || ''}"></td>
        <td><input class="input input--num mj-c" type="number" value="${l.credit || ''}"></td>
        <td><button class="citem__x mj-x">✕</button></td></tr>`).join('');
      const d = U.sum(lines, l => l.debit), c = U.sum(lines, l => l.credit);
      m.body.querySelector('#mj-d').textContent = U.rp(d);
      m.body.querySelector('#mj-c').textContent = U.rp(c);
      m.body.querySelector('#mj-status').innerHTML = Math.abs(d - c) < 0.5 && d > 0
        ? '<span style="color:var(--lime)">✔ Jurnal seimbang</span>'
        : `<span style="color:var(--rose)">Selisih ${U.rp(d - c)} — debit dan kredit harus sama</span>`;
      m.body.querySelectorAll('tr[data-i]').forEach(tr => {
        const i = +tr.dataset.i;
        tr.querySelector('.mj-a').onchange = e => lines[i].accountId = e.target.value;
        tr.querySelector('.mj-m').oninput = e => lines[i].memo = e.target.value;
        tr.querySelector('.mj-d').oninput = e => { lines[i].debit = Number(e.target.value) || 0; render2(); };
        tr.querySelector('.mj-c').oninput = e => { lines[i].credit = Number(e.target.value) || 0; render2(); };
        tr.querySelector('.mj-x').onclick = () => { lines.splice(i, 1); render(); };
      });
    };
    const render2 = () => {
      const d = U.sum(lines, l => l.debit), c = U.sum(lines, l => l.credit);
      m.body.querySelector('#mj-d').textContent = U.rp(d);
      m.body.querySelector('#mj-c').textContent = U.rp(c);
      m.body.querySelector('#mj-status').innerHTML = Math.abs(d - c) < 0.5 && d > 0
        ? '<span style="color:var(--lime)">✔ Jurnal seimbang</span>'
        : `<span style="color:var(--rose)">Selisih ${U.rp(d - c)}</span>`;
    };
    m.body.querySelector('#mj-add').onclick = () => { lines.push({ accountId:accts[0].id, debit:0, credit:0, memo:'' }); render(); };
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-yes]').onclick = () => {
      const memo = m.body.querySelector('#mj-memo').value.trim();
      if (!memo) return App.UI.toast('Isi keterangan jurnal', 'warn');
      const j = L.post({
        date:m.body.querySelector('#mj-date').value, ref:m.body.querySelector('#mj-ref').value,
        refType:'manual', memo, outletId:m.body.querySelector('#mj-outlet').value, source:'manual', lines
      });
      if (j) { App.UI.toast('Jurnal ' + j.no + ' diposting', 'ok'); m.close(); draw(); }
    };
    render();
  }
  draw();
};

/* ---------------- Bagan Akun ---------------- */
App.Views.accounts = function (root) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  function draw() {
    const oid = App.State.outletId();
    const accts = U.sortBy(DB.all('accounts'), a => a.code);
    const TYPE = { asset:'Aset', liability:'Liabilitas', equity:'Ekuitas', revenue:'Pendapatan', expense:'Beban' };
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Bagan Akun (Chart of Accounts)</h2><p>Struktur akun standar akuntansi Indonesia untuk usaha F&B</p></div>
        <div class="page-head__actions"><button class="btn btn--primary" id="new-acc">+ Akun Baru</button></div>
      </div>
      <div class="grid g5 mb-16">
        ${Object.entries(TYPE).map(([k, lbl]) => App.UI.stat({
          label:lbl, value:U.rp(U.sum(accts.filter(a => a.type === k && !a.isGroup), a => L.balance(a.id, U.today(), oid))),
          sub:accts.filter(a => a.type === k && !a.isGroup).length + ' akun' })).join('')}
      </div>
      <div id="table"></div>`;
    root.querySelector('#new-acc').onclick = () => form();
    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:accts, exportName:'bagan-akun', pageSize:60, searchKeys:['code','name'],
      onRowClick: a => a.isGroup ? null : ledger(a),
      cols:[
        { key:'code', label:'Kode', render:a => `<span class="mono ${a.isGroup ? 'bold' : ''}">${U.esc(a.code)}</span>` },
        { key:'name', label:'Nama Akun', render:a => a.isGroup
            ? `<b>${U.esc(a.name)}</b>` : `<span style="padding-left:14px">${U.esc(a.name)}</span>` },
        { key:'type', label:'Tipe', render:a => U.esc(TYPE[a.type] || a.type) },
        { key:'normal', label:'Saldo Normal', render:a => L.normalOf(a.id) === 'D' ? 'Debit' : 'Kredit' },
        { key:'saldo', label:'Saldo', align:'right', render:a => a.isGroup ? '' :
            `<b>${U.rp(L.balance(a.id, U.today(), oid))}</b>`, sortValue:a => L.balance(a.id, U.today(), oid) },
        { key:'isCash', label:'Kas', render:a => a.isCash ? App.UI.badge('Kas/Bank','brand') : '' }
      ]
    }));
  }
  function form(a) {
    App.UI.formModal({
      title:a ? 'Ubah Akun' : 'Akun Baru',
      fields:[
        { name:'code', label:'Kode akun', required:true, hint:'Format: 1-10001' },
        { name:'name', label:'Nama akun', required:true },
        { name:'type', label:'Tipe', type:'select', required:true, options:[
          { value:'asset', label:'Aset' }, { value:'liability', label:'Liabilitas' }, { value:'equity', label:'Ekuitas' },
          { value:'revenue', label:'Pendapatan' }, { value:'expense', label:'Beban' }] },
        { name:'isCash', label:'Kas/bank', type:'checkbox', checkLabel:'Akun kas atau bank (masuk laporan arus kas)' }
      ],
      values:a || {},
      onSubmit(d) {
        if (a) DB.update('accounts', a.id, d);
        else DB.insert('accounts', { ...d, isGroup:false, active:true });
        App.UI.toast('Akun disimpan', 'ok'); draw();
      }
    });
  }
  function ledger(a) {
    const state = App.Period.init('month');
    const m = App.UI.modal({ title:`Buku Besar — ${a.code} ${a.name}`, size:'xl', body:'<div id="lg"></div>' });
    const render = () => {
      const lg = L.ledgerOf(a.id, state.from, state.to, App.State.outletId());
      m.body.querySelector('#lg').innerHTML = `
        <div class="grid g3 mb-16">
          ${App.UI.stat({ label:'Saldo Awal', value:U.rp(lg.opening) })}
          ${App.UI.stat({ label:'Mutasi', value:U.rp(lg.closing - lg.opening) })}
          ${App.UI.stat({ label:'Saldo Akhir', value:U.rp(lg.closing) })}
        </div>
        <div class="tbl-wrap card"><table class="tbl">
          <thead><tr><th>Tanggal</th><th>No. Jurnal</th><th>Keterangan</th><th class="num">Debit</th><th class="num">Kredit</th><th class="num">Saldo</th></tr></thead>
          <tbody>
            <tr><td colspan="5"><i>Saldo awal</i></td><td class="num">${U.rp(lg.opening)}</td></tr>
            ${lg.rows.map(r => `<tr><td>${U.fmtDate(r.date)}</td><td class="mono small">${U.esc(r.no)}</td>
              <td>${U.esc(r.memo)}</td><td class="num">${r.debit ? U.rp(r.debit) : ''}</td>
              <td class="num">${r.credit ? U.rp(r.credit) : ''}</td><td class="num">${U.rp(r.saldo)}</td></tr>`).join('')}
          </tbody></table></div>`;
    };
    const bar = App.Period.bar(state, render);
    m.body.parentElement.querySelector('.modal__head').appendChild(bar);
    bar.style.marginLeft = 'auto';
    render();
  }
  draw();
};

/* ---------------- Laporan Keuangan ---------------- */
App.Views.financeReports = function (root) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  const state = App.Period.init('month');
  let tab = 'pl';

  function draw() {
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Laporan Keuangan</h2><p>Laba rugi, neraca, arus kas, neraca saldo & buku besar</p></div>
        <div class="page-head__actions" id="period">
          <button class="btn" id="print-rep">🖨️ Cetak</button>
        </div>
      </div>
      <div id="tabs"></div><div id="body"></div>`;
    root.querySelector('#period').insertBefore(App.Period.bar(state, draw), root.querySelector('#print-rep'));
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'pl', label:'Laba Rugi' }, { key:'bs', label:'Neraca' },
      { key:'cf', label:'Arus Kas' }, { key:'tb', label:'Neraca Saldo' }, { key:'ar', label:'Piutang & Hutang' }
    ], tab, k => { tab = k; draw(); }));
    const body = root.querySelector('#body');
    if (tab === 'pl') plView(body);
    else if (tab === 'bs') bsView(body);
    else if (tab === 'cf') cfView(body);
    else if (tab === 'tb') tbView(body);
    else arView(body);
    root.querySelector('#print-rep').onclick = () => App.UI.print(
      `<div style="font-family:sans-serif;padding:20px">
        <h2>${U.esc(DB.settings().business.name)}</h2>
        <p>Periode ${U.fmtDate(state.from,'long')} – ${U.fmtDate(state.to,'long')}</p>
        ${body.innerHTML}</div>`);
  }

  function row(label, value, opts = {}) {
    return `<div class="kv" style="${opts.bold ? 'font-weight:700;font-size:14px' : ''};${opts.indent ? 'padding-left:16px' : ''}
      ${opts.top ? ';border-top:1px solid var(--border);margin-top:4px;padding-top:8px' : ''}">
      <span class="k" style="${opts.bold ? 'color:var(--text)' : ''}">${U.esc(label)}</span>
      <span class="v" style="${opts.color ? 'color:' + opts.color : ''}">${U.rp(value)}</span></div>`;
  }

  function plView(body) {
    const oid = App.State.outletId();
    const pl = L.profitLoss(state.from, state.to, oid);
    const prevFrom = U.addDays(state.from, -(U.dateRangeDays(state.from, state.to).length));
    const prev = L.profitLoss(prevFrom, U.addDays(state.from, -1), oid);
    const comparable = App.Sales.periodComparable(prevFrom);
    body.innerHTML = `
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Penjualan Bersih', icon:'💰', value:U.rp(pl.netSales),
          delta: comparable && prev.netSales ? ((pl.netSales - prev.netSales) / prev.netSales) * 100 : null, sub:'setelah diskon' })}
        ${App.UI.stat({ label:'Laba Kotor', icon:'📈', value:U.rp(pl.grossProfit), sub:`margin ${pl.grossMargin.toFixed(1).replace('.',',')}%` })}
        ${App.UI.stat({ label:'Beban Operasional', icon:'🧾', value:U.rp(pl.totalOpex), sub:U.pct(pl.totalOpex, pl.netSales || 1) + ' dari omzet' })}
        ${App.UI.stat({ label:'Laba Bersih', icon:'🏆', value:U.rp(pl.netProfit), sub:`margin ${pl.netMargin.toFixed(1).replace('.',',')}%`,
          tone: pl.netProfit >= 0 ? 'var(--lime)' : 'var(--rose)' })}
      </div>
      <div class="grid g-2-1">
        <div class="card"><div class="card__head"><h3>Laporan Laba Rugi</h3>
          <span class="sub">${U.fmtDate(state.from,'long')} – ${U.fmtDate(state.to,'long')}</span></div>
          <div class="card__body">
            <div class="bold small mb-8" style="color:var(--brand-600)">PENDAPATAN</div>
            ${pl.revenue.map(a => row(a.name, a.value, { indent:true })).join('')}
            ${pl.discount ? row('Diskon & potongan penjualan', -pl.discount, { indent:true, color:'var(--rose)' }) : ''}
            ${row('Penjualan Bersih', pl.netSales, { bold:true, top:true })}
            <div class="bold small mb-8 mt-16" style="color:var(--brand-600)">HARGA POKOK PENJUALAN</div>
            ${pl.cogs.map(a => row(a.name, -a.value, { indent:true })).join('')}
            ${row('LABA KOTOR', pl.grossProfit, { bold:true, top:true, color:'var(--lime)' })}
            <div class="bold small mb-8 mt-16" style="color:var(--brand-600)">BEBAN OPERASIONAL</div>
            ${pl.opex.map(a => row(a.name, -a.value, { indent:true })).join('')}
            ${row('Total Beban Operasional', -pl.totalOpex, { top:true })}
            ${row('LABA BERSIH', pl.netProfit, { bold:true, top:true, color: pl.netProfit >= 0 ? 'var(--lime)' : 'var(--rose)' })}
          </div></div>
        <div>
          <div class="card mb-16"><div class="card__head"><h3>Struktur Biaya</h3></div>
            <div class="card__body">${App.Chart.donut([
              { label:'HPP', value:pl.totalCogs, color:'#f5a524' },
              ...pl.opex.slice(0, 5).map((a, i) => ({ label:a.name, value:a.value, color:App.Chart.PALETTE[i + 1] })),
              { label:'Laba bersih', value:Math.max(0, pl.netProfit), color:'#0d9c86' }
            ], { money:true, centerLabel:'Omzet', size:140 })}</div></div>
          <div class="card"><div class="card__body">
            <div class="bold small mb-8">Rasio Kunci</div>
            <div class="kv"><span class="k">Food cost ratio</span><span class="v">${U.pct(pl.totalCogs, pl.netSales || 1)}</span></div>
            <div class="kv"><span class="k">Gross margin</span><span class="v">${pl.grossMargin.toFixed(1).replace('.',',')}%</span></div>
            <div class="kv"><span class="k">Opex ratio</span><span class="v">${U.pct(pl.totalOpex, pl.netSales || 1)}</span></div>
            <div class="kv"><span class="k">Net margin</span><span class="v">${pl.netMargin.toFixed(1).replace('.',',')}%</span></div>
            <div class="kv"><span class="k">Break-even omzet/hari</span><span class="v">${U.rp(
              pl.grossMargin > 0 ? (pl.totalOpex / (pl.grossMargin / 100)) / Math.max(1, U.dateRangeDays(state.from, state.to).length) : 0)}</span></div>
          </div></div>
        </div>
      </div>`;
  }

  function bsView(body) {
    const oid = App.State.outletId();
    const bs = L.balanceSheet(state.to, oid);
    body.innerHTML = `
      <div class="grid g3 mb-16">
        ${App.UI.stat({ label:'Total Aset', icon:'🏦', value:U.rp(bs.totalAsset), sub:'per ' + U.fmtDate(state.to, 'long') })}
        ${App.UI.stat({ label:'Total Liabilitas', icon:'📉', value:U.rp(bs.totalLiab), sub:'kewajiban' })}
        ${App.UI.stat({ label:'Total Ekuitas', icon:'💎', value:U.rp(bs.totalEquity), sub:bs.balanced ? '✔ neraca seimbang' : '⚠️ periksa jurnal' })}
      </div>
      <div class="grid g2">
        <div class="card"><div class="card__head"><h3>ASET</h3></div><div class="card__body">
          <div class="bold small mb-8" style="color:var(--brand-600)">ASET LANCAR</div>
          ${bs.assets.filter(a => a.code.startsWith('1-1')).map(a => row(a.name, a.value, { indent:true })).join('')}
          <div class="bold small mb-8 mt-16" style="color:var(--brand-600)">ASET TETAP</div>
          ${bs.assets.filter(a => a.code.startsWith('1-2')).map(a => row(a.name, a.value, { indent:true })).join('')}
          ${row('TOTAL ASET', bs.totalAsset, { bold:true, top:true })}
        </div></div>
        <div class="card"><div class="card__head"><h3>LIABILITAS & EKUITAS</h3></div><div class="card__body">
          <div class="bold small mb-8" style="color:var(--brand-600)">LIABILITAS</div>
          ${bs.liabilities.map(a => row(a.name, a.value, { indent:true })).join('')}
          ${row('Total Liabilitas', bs.totalLiab, { top:true })}
          <div class="bold small mb-8 mt-16" style="color:var(--brand-600)">EKUITAS</div>
          ${bs.equityAcc.map(a => row(a.name, a.value, { indent:true })).join('')}
          ${row('Laba tahun berjalan', bs.currentEarning, { indent:true })}
          ${row('Total Ekuitas', bs.totalEquity, { top:true })}
          ${row('TOTAL LIABILITAS & EKUITAS', bs.totalLiab + bs.totalEquity, { bold:true, top:true })}
        </div></div>
      </div>`;
  }

  function cfView(body) {
    const cf = L.cashFlow(state.from, state.to, App.State.outletId());
    const sec = (title, rows, total) => `
      <div class="bold small mb-8 mt-16" style="color:var(--brand-600)">${title}</div>
      ${rows.slice(0, 25).map(r => `<div class="kv"><span class="k" style="padding-left:12px">${U.esc(r.memo)}<br>
        <span class="small">${U.fmtDate(r.date)}</span></span>
        <span class="v" style="color:${r.amount > 0 ? 'var(--lime)' : 'var(--rose)'}">${U.rp(r.amount)}</span></div>`).join('')
        || '<div class="small muted" style="padding-left:12px">Tidak ada transaksi</div>'}
      ${row('Arus kas ' + title.toLowerCase(), total, { bold:true, top:true })}`;
    body.innerHTML = `
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Saldo Awal', value:U.rp(cf.openingCash) })}
        ${App.UI.stat({ label:'Kas Masuk', value:U.rp(cf.masuk), tone:'var(--lime)' })}
        ${App.UI.stat({ label:'Kas Keluar', value:U.rp(cf.keluar), tone:'var(--rose)' })}
        ${App.UI.stat({ label:'Saldo Akhir', value:U.rp(cf.closingCash) })}
      </div>
      <div class="card"><div class="card__head"><h3>Laporan Arus Kas</h3></div><div class="card__body">
        ${sec('Aktivitas Operasi', cf.buckets.operasi, cf.totals.operasi)}
        ${sec('Aktivitas Investasi', cf.buckets.investasi, cf.totals.investasi)}
        ${sec('Aktivitas Pendanaan', cf.buckets.pendanaan, cf.totals.pendanaan)}
        ${row('KENAIKAN (PENURUNAN) KAS BERSIH', cf.net, { bold:true, top:true })}
        ${row('Kas dan setara kas awal periode', cf.openingCash)}
        ${row('KAS DAN SETARA KAS AKHIR PERIODE', cf.closingCash, { bold:true, top:true })}
      </div></div>`;
  }

  function tbView(body) {
    const tb = L.trialBalance(state.from, state.to, App.State.outletId());
    body.innerHTML = '<div id="tb-table"></div>';
    body.querySelector('#tb-table').appendChild(App.UI.dataTable({
      rows:tb, exportName:'neraca-saldo', pageSize:60, searchKeys:['code','name'],
      cols:[
        { key:'code', label:'Kode', render:a => `<span class="mono">${U.esc(a.code)}</span>` },
        { key:'name', label:'Nama Akun' },
        { key:'opening', label:'Saldo Awal', align:'right', render:a => U.rp(a.opening) },
        { key:'debit', label:'Mutasi Debit', align:'right', render:a => a.debit ? U.rp(a.debit) : '-' },
        { key:'credit', label:'Mutasi Kredit', align:'right', render:a => a.credit ? U.rp(a.credit) : '-' },
        { key:'closing', label:'Saldo Akhir', align:'right', render:a => `<b>${U.rp(a.closing)}</b>` }
      ],
      footRow: rows => `<td colspan="3">TOTAL</td><td class="num">${U.rp(U.sum(rows, r => r.debit))}</td>
        <td class="num">${U.rp(U.sum(rows, r => r.credit))}</td><td></td>`
    }));
  }

  function arView(body) {
    const bills = DB.all('bills').filter(b => b.status !== 'paid');
    const ap = L.agingBuckets(bills);
    const arOrders = DB.all('orders').filter(o => o.status === 'paid' && (o.payments || []).some(p => p.method === 'invoice'))
      .map(o => ({ ...o, dueDate:U.addDays(U.ymd(o.date), 14), total:o.total, paid:0 }));
    const ar = L.agingBuckets(arOrders);
    const agingCard = (title, b, nameFn) => `
      <div class="card"><div class="card__head"><h3>${title}</h3><span class="sub">${U.rp(b.lancar + b.d30 + b.d60 + b.d90 + b.lebih)}</span></div>
        <div class="card__body">
          <div class="kv"><span class="k">Belum jatuh tempo</span><span class="v">${U.rp(b.lancar)}</span></div>
          <div class="kv"><span class="k">1–30 hari</span><span class="v">${U.rp(b.d30)}</span></div>
          <div class="kv"><span class="k">31–60 hari</span><span class="v">${U.rp(b.d60)}</span></div>
          <div class="kv"><span class="k">61–90 hari</span><span class="v">${U.rp(b.d90)}</span></div>
          <div class="kv"><span class="k">>90 hari</span><span class="v" style="color:var(--rose)">${U.rp(b.lebih)}</span></div>
          <div class="divider"></div>
          ${U.sortBy(b.rows, r => r.days, 'desc').slice(0, 10).map(r => `<div class="kv">
            <span class="k">${U.esc(nameFn(r))}<br><span class="small">jatuh tempo ${U.fmtDate(r.dueDate)}${r.days > 0 ? ` · telat ${r.days} hari` : ''}</span></span>
            <span class="v">${U.rp(r.outstanding)}</span></div>`).join('')}
        </div></div>`;
    body.innerHTML = `<div class="grid g2">
      ${agingCard('Umur Hutang (AP)', ap, r => (DB.find('suppliers', r.supplierId) || {}).name + ' — ' + r.no)}
      ${agingCard('Umur Piutang (AR)', ar, r => (r.customerName || 'Umum') + ' — ' + r.no)}
    </div>`;
  }
  draw();
};
