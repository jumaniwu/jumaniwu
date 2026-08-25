/* =============================================================
   SajiPOS — Aplikasi Owner & Aplikasi Teams (karyawan)
   Tampilan ringkas bergaya mobile, memakai basis data yang sama.
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

/* =============================================================
   Aplikasi Owner — pantau seluruh outlet dari genggaman
   ============================================================= */
App.Views.ownerapp = function (root) {
  const U = App.U, DB = App.DB, C = App.Chart;
  let tab = 'dashboard';

  function draw() {
    root.innerHTML = `<div class="device"><div class="device__body"><div class="phone">
      <div class="phone__head">
        <div class="flex items-center gap-8">
          <div style="width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,.18);display:grid;place-items:center;font-size:18px">👑</div>
          <div style="flex:1">
            <h3>Halo, ${U.esc(App.Auth.user().name.split(' ')[0])}</h3>
            <p>${U.fmtDate(U.today(), 'full')}</p>
          </div>
          <button class="btn btn--sm" id="oa-exit" style="background:rgba(255,255,255,.18);border:0;color:#fff">✕</button>
        </div>
      </div>
      <div class="phone__body" id="oa-body"></div>
      <div class="phone__nav" id="oa-nav"></div>
    </div></div></div>`;

    root.querySelector('#oa-exit').onclick = () => App.Router.go('dashboard');
    const nav = [
      { k:'dashboard', ic:'📊', l:'Ringkasan' }, { k:'outlet', ic:'🏪', l:'Outlet' },
      { k:'kas', ic:'💰', l:'Kas' }, { k:'karyawan', ic:'👥', l:'Karyawan' },
      { k:'pesan', ic:'✉️', l:'Pesan' }
    ];
    root.querySelector('#oa-nav').innerHTML = nav.map(n =>
      `<button class="${tab === n.k ? 'is-active' : ''}" data-t="${n.k}">
        <span class="ic">${n.ic}</span><span>${n.l}</span></button>`).join('');
    root.querySelectorAll('#oa-nav [data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });

    ({ dashboard:tabRingkasan, outlet:tabOutlet, kas:tabKas, karyawan:tabKaryawan, pesan:tabPesan })[tab](root.querySelector('#oa-body'));
  }

  function tabRingkasan(el) {
    const today = App.Sales.orders({ from:U.today(), to:U.today(), outletId:'ALL' });
    const yest = App.Sales.orders({ from:U.addDays(U.today(),-1), to:U.addDays(U.today(),-1), outletId:'ALL' });
    const t = App.Sales.totals(today), y = App.Sales.totals(yest);
    const week = U.dateRangeDays(U.addDays(U.today(), -6), U.today());
    const g = U.groupBy(App.Sales.orders({ from:week[0], to:U.today(), outletId:'ALL' }), o => U.ymd(o.paidAt || o.date));
    const series = week.map(d => ({ label:U.fmtDate(d,'dm'), value:U.sum(g[d] || [], o => o.total) }));
    const mix = App.Sales.productMix(today).slice(0, 5);
    const unread = DB.where('notifications', n => !n.read);

    el.innerHTML = `
      <div class="grid g2 mb-12">
        <div class="mini-stat"><div class="l">💰 Omzet hari ini</div><div class="v">${U.rp(t.total)}</div>
          <div class="s">${y.total ? (t.total >= y.total ? '▲' : '▼') + ' ' + U.pct(Math.abs(t.total - y.total), y.total) + ' vs kemarin' : U.num(t.trx) + ' transaksi'}</div></div>
        <div class="mini-stat"><div class="l">📈 Laba kotor</div><div class="v">${U.rp(t.profit)}</div>
          <div class="s">margin ${t.margin.toFixed(0)}%</div></div>
        <div class="mini-stat"><div class="l">🧾 Transaksi</div><div class="v">${U.num(t.trx)}</div>
          <div class="s">rata-rata ${U.rp(t.avg)}</div></div>
        <div class="mini-stat"><div class="l">👥 Tamu</div><div class="v">${U.num(t.guests)}</div>
          <div class="s">${U.num(t.qty)} item terjual</div></div>
      </div>
      <div class="card mb-12"><div class="card__head"><h3>Penjualan 7 Hari</h3></div>
        <div class="card__body">${C.line(series, { height:150 })}</div></div>
      <div class="card mb-12"><div class="card__head"><h3>Terlaris Hari Ini</h3></div>
        <div class="card__body">${mix.length ? C.hbar(mix.map(m => ({ label:m.nama, value:m.qty })), { unit:'×' })
          : '<div class="empty small">Belum ada transaksi hari ini</div>'}</div></div>
      <div class="card"><div class="card__head"><h3>Notifikasi</h3>
        <span class="badge ${unread.length ? 'badge--red' : ''}" style="margin-left:auto">${unread.length}</span></div>
        <div class="card__body">
          ${U.sortBy(DB.all('notifications'), n => n.at, 'desc').slice(0, 6).map(n => `
            <div class="list-row"><span class="thumb">${({ lowstock:'📦', bill:'🧮', hr:'👥', order:'🧾', crm:'💚' })[n.type] || 'ℹ️'}</span>
              <div style="flex:1"><b style="font-size:12.5px">${U.esc(n.title)}</b>
                <div class="small muted">${U.esc(n.message)}</div>
                <div class="small muted">${U.ago(n.at)}</div></div></div>`).join('')
            || '<div class="empty small">Tidak ada notifikasi</div>'}
        </div></div>`;
  }

  function tabOutlet(el) {
    const outlets = DB.all('outlets');
    el.innerHTML = outlets.map(o => {
      const t = App.Sales.totals(App.Sales.orders({ from:U.today(), to:U.today(), outletId:o.id }));
      const m = App.Sales.totals(App.Sales.orders({ from:U.startOfMonth(U.today()), to:U.today(), outletId:o.id }));
      const shift = DB.first('shifts', s => s.status === 'open' && s.outletId === o.id);
      const low = App.Inv.lowStockList(o.id).length;
      const tables = DB.where('tables', x => x.outletId === o.id);
      return `<div class="card mb-12"><div class="card__body">
        <div class="flex items-center gap-8 mb-8">
          <span class="thumb">${o.type === 'restoran' ? '🍽️' : '☕'}</span>
          <div style="flex:1"><b>${U.esc(o.name)}</b>
            <div class="small muted">${shift ? '🟢 Kasir buka sejak ' + U.fmtTime(shift.openAt) : '⚪ Kasir belum dibuka'}</div></div>
        </div>
        <div class="grid g2 gap-8">
          <div class="mini-stat"><div class="l">Hari ini</div><div class="v" style="font-size:15px">${U.rp(t.total)}</div>
            <div class="s">${t.trx} transaksi</div></div>
          <div class="mini-stat"><div class="l">Bulan ini</div><div class="v" style="font-size:15px">${U.rp(m.total)}</div>
            <div class="s">laba ${U.compact(m.profit)}</div></div>
        </div>
        <div class="flex gap-8 mt-8" style="flex-wrap:wrap">
          <span class="badge">🪑 ${tables.filter(x => x.status !== 'free').length}/${tables.length} meja terisi</span>
          <span class="badge ${low ? 'badge--amber' : ''}">📦 ${low} stok menipis</span>
        </div>
      </div></div>`;
    }).join('');
  }

  function tabKas(el) {
    const shifts = DB.all('shifts').filter(s => s.status === 'open');
    const cash = App.Ledger.cashAccounts();
    el.innerHTML = `
      <div class="card mb-12"><div class="card__head"><h3>Posisi Kas & Bank</h3></div><div class="card__body">
        ${cash.map(a => `<div class="kv"><span class="k">${U.esc(a.name)}</span>
          <span class="v">${U.rp(App.Ledger.balance(a.id, U.today(), null))}</span></div>`).join('')}
      </div></div>
      <div class="card mb-12"><div class="card__head"><h3>Kas Kasir Berjalan</h3></div><div class="card__body">
        ${shifts.length ? shifts.map(s => {
          const o = DB.find('outlets', s.outletId) || {};
          const expect = s.openingCash + (s.salesCash || 0) + (s.cashIn || 0) - (s.cashOut || 0);
          return `<div class="list-row"><div style="flex:1">
            <b style="font-size:12.5px">${U.esc(o.name)}</b>
            <div class="small muted">${U.esc((DB.find('users', s.userId) || {}).name || '')} · sejak ${U.fmtTime(s.openAt)}</div></div>
            <div class="right"><b>${U.rp(expect)}</b><div class="small muted">${s.orders || 0} trx</div></div></div>`;
        }).join('') : '<div class="empty small">Tidak ada shift terbuka</div>'}
      </div></div>
      <div class="card"><div class="card__head"><h3>Perlu Dibayar</h3></div><div class="card__body">
        ${(() => {
          const bills = DB.all('bills').filter(b => b.status !== 'paid').sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
          return bills.length ? bills.map(b => `<div class="list-row"><div style="flex:1">
            <b style="font-size:12.5px">${U.esc((DB.find('suppliers', b.supplierId) || {}).name)}</b>
            <div class="small muted">${U.esc(b.no)} · jatuh tempo ${U.fmtDate(b.dueDate)}</div></div>
            <b style="color:${b.dueDate < U.today() ? 'var(--rose)' : ''}">${U.rp(b.total - b.paid)}</b></div>`).join('')
            : '<div class="empty small">Semua tagihan lunas 🎉</div>';
        })()}
      </div></div>`;
  }

  function tabKaryawan(el) {
    const today = U.today();
    const emps = DB.all('employees').filter(e => e.status === 'aktif');
    const att = DB.where('attendance', a => a.date === today);
    const sch = DB.where('schedules', s => s.date === today);
    const leaves = DB.where('leaves', l => l.status === 'menunggu');
    el.innerHTML = `
      <div class="grid g2 mb-12">
        <div class="mini-stat"><div class="l">Hadir hari ini</div><div class="v">${att.filter(a => a.status !== 'izin').length}/${emps.length}</div>
          <div class="s">${att.filter(a => a.status === 'telat').length} terlambat</div></div>
        <div class="mini-stat"><div class="l">Cuti menunggu</div><div class="v">${leaves.length}</div>
          <div class="s">perlu persetujuan</div></div>
      </div>
      <div class="card mb-12"><div class="card__head"><h3>Absensi Hari Ini</h3></div><div class="card__body">
        ${emps.map(e => {
          const a = att.find(x => x.employeeId === e.id);
          const s = sch.find(x => x.employeeId === e.id);
          return `<div class="list-row"><span class="avatar-sm">${U.initials(e.name)}</span>
            <div style="flex:1"><b style="font-size:12.5px">${U.esc(e.name)}</b>
              <div class="small muted">${U.esc(e.position)}${s ? ' · ' + U.esc(s.start) + '–' + U.esc(s.end) : ' · libur'}</div></div>
            <div class="right">${a
              ? `<span class="badge ${a.status === 'telat' ? 'badge--amber' : a.status === 'izin' ? 'badge--blue' : 'badge--green'}">${U.titleCase(a.status)}</span>
                 <div class="small muted">${a.inTime ? U.fmtTime(a.inTime) : ''}${a.outTime ? '–' + U.fmtTime(a.outTime) : ''}</div>`
              : '<span class="badge">Belum absen</span>'}</div></div>`;
        }).join('')}
      </div></div>
      ${leaves.length ? `<div class="card"><div class="card__head"><h3>Pengajuan Cuti</h3></div><div class="card__body">
        ${leaves.map(l => {
          const e = DB.find('employees', l.employeeId) || {};
          return `<div class="list-row"><div style="flex:1">
            <b style="font-size:12.5px">${U.esc(e.name || '-')}</b>
            <div class="small muted">${U.esc(l.type)} · ${U.fmtDate(l.from)}–${U.fmtDate(l.to)} (${l.days} hari)</div>
            <div class="small muted">${U.esc(l.reason)}</div></div>
            <button class="btn btn--sm btn--primary" data-ok="${l.id}">Setujui</button></div>`;
        }).join('')}
      </div></div>` : ''}`;
    el.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => {
      DB.update('leaves', b.dataset.ok, { status:'disetujui', approvedBy:App.Auth.user().id });
      App.UI.toast('Cuti disetujui', 'ok'); draw();
    });
  }

  function tabPesan(el) {
    const msgs = U.sortBy(DB.where('notifications', n => n.type === 'pesan'), n => n.at, 'desc');
    el.innerHTML = `
      <div class="card mb-12"><div class="card__body">
        <div class="field"><label>Kirim pesan ke outlet</label>
          <select class="select" id="pm-outlet">
            <option value="ALL">Semua outlet</option>
            ${DB.all('outlets').map(o => `<option value="${o.id}">${U.esc(o.name)}</option>`).join('')}
          </select></div>
        <div class="field"><label>Isi pesan</label>
          <textarea class="textarea" id="pm-text" placeholder="mis. Besok stok susu oat datang, tolong dicek saat penerimaan."></textarea></div>
        <button class="btn btn--primary btn--block" id="pm-send">Kirim ke Outlet</button>
      </div></div>
      <div class="card"><div class="card__head"><h3>Riwayat Pesan</h3></div><div class="card__body">
        ${msgs.length ? msgs.map(n => `<div class="list-row"><span class="thumb">✉️</span>
          <div style="flex:1"><b style="font-size:12.5px">${U.esc(n.title)}</b>
            <div class="small muted">${U.esc(n.message)}</div>
            <div class="small muted">${U.ago(n.at)}</div></div></div>`).join('')
          : '<div class="empty small">Belum ada pesan terkirim</div>'}
      </div></div>`;
    el.querySelector('#pm-send').onclick = () => {
      const text = el.querySelector('#pm-text').value.trim();
      if (!text) return App.UI.toast('Tulis isi pesan terlebih dahulu', 'warn');
      const oid = el.querySelector('#pm-outlet').value;
      const target = oid === 'ALL' ? 'Semua outlet' : (DB.find('outlets', oid) || {}).name;
      DB.insert('notifications', { type:'pesan', title:'Pesan dari Owner — ' + target,
        message:text, outletId: oid === 'ALL' ? null : oid, read:false, at:U.now(), level:'info' });
      DB.log('owner.message', `Pesan ke ${target}: ${text.slice(0, 60)}`);
      App.UI.toast('Pesan terkirim ke ' + target, 'ok');
      draw();
    };
  }
  draw();
};

/* =============================================================
   Aplikasi Teams — untuk karyawan
   ============================================================= */
App.Views.teamsapp = function (root) {
  const U = App.U, DB = App.DB;
  let tab = 'beranda';
  let me = DB.first('employees', e => e.userId === App.Auth.user().id) || DB.all('employees')[0];

  function draw() {
    const outlet = DB.find('outlets', me.outletId) || {};
    root.innerHTML = `<div class="device"><div class="device__body"><div class="phone">
      <div class="phone__head">
        <div class="flex items-center gap-8">
          <span class="avatar" style="background:rgba(255,255,255,.2)">${U.initials(me.name)}</span>
          <div style="flex:1"><h3>${U.esc(me.name)}</h3>
            <p>${U.esc(me.position)} · ${U.esc(outlet.name || '')}</p></div>
          <button class="btn btn--sm" id="ta-exit" style="background:rgba(255,255,255,.18);border:0;color:#fff">✕</button>
        </div>
      </div>
      <div class="phone__body" id="ta-body"></div>
      <div class="phone__nav" id="ta-nav"></div>
    </div></div></div>`;
    root.querySelector('#ta-exit').onclick = () => App.Router.go('dashboard');
    const nav = [
      { k:'beranda', ic:'🏠', l:'Beranda' }, { k:'absen', ic:'⏰', l:'Absensi' },
      { k:'jadwal', ic:'📅', l:'Jadwal' }, { k:'gaji', ic:'💳', l:'Gaji' },
      { k:'ajukan', ic:'📝', l:'Pengajuan' }
    ];
    root.querySelector('#ta-nav').innerHTML = nav.map(n =>
      `<button class="${tab === n.k ? 'is-active' : ''}" data-t="${n.k}">
        <span class="ic">${n.ic}</span><span>${n.l}</span></button>`).join('');
    root.querySelectorAll('#ta-nav [data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    ({ beranda:tabBeranda, absen:tabAbsen, jadwal:tabJadwal, gaji:tabGaji, ajukan:tabAjukan })[tab](root.querySelector('#ta-body'));
  }

  function todayAtt() { return DB.first('attendance', a => a.employeeId === me.id && a.date === U.today()); }

  function tabBeranda(el) {
    const a = todayAtt();
    const sch = DB.first('schedules', s => s.employeeId === me.id && s.date === U.today());
    const bulan = DB.where('attendance', x => x.employeeId === me.id && U.monthKey(x.date) === U.monthKey(U.today()));
    const komisi = U.sum(DB.where('orders', o => o.waiterId === me.id && o.status === 'paid' &&
      U.monthKey(U.ymd(o.date)) === U.monthKey(U.today())), o => o.commission || 0);
    const pesan = U.sortBy(DB.where('notifications', n => n.type === 'pesan' &&
      (!n.outletId || n.outletId === me.outletId)), n => n.at, 'desc').slice(0, 3);

    el.innerHTML = `
      <div class="card mb-12" style="border-color:var(--brand-400)"><div class="card__body center">
        <div class="small muted">${U.fmtDate(U.today(), 'full')}</div>
        <div style="font-size:26px;font-weight:800;margin:4px 0">${sch ? U.esc(sch.start) + ' – ' + U.esc(sch.end) : 'Libur'}</div>
        <div class="small muted">${sch ? U.esc(sch.shiftName) : 'Tidak ada jadwal hari ini'}</div>
        <div class="mt-12">${a
          ? (a.outTime ? `<span class="badge badge--green">✅ Selesai ${U.fmtTime(a.inTime)}–${U.fmtTime(a.outTime)}</span>`
                       : `<span class="badge badge--amber">🟢 Masuk ${U.fmtTime(a.inTime)}</span>`)
          : '<span class="badge">Belum absen</span>'}</div>
        <button class="btn btn--primary btn--block mt-12" id="tb-clock">
          ${!a ? '📷 Absen Masuk' : (!a.outTime ? '👋 Absen Pulang' : '✅ Absensi Hari Ini Selesai')}</button>
      </div></div>
      <div class="grid g2 mb-12">
        <div class="mini-stat"><div class="l">Hadir bulan ini</div><div class="v">${bulan.filter(x => x.status !== 'izin').length}</div>
          <div class="s">${bulan.filter(x => x.status === 'telat').length} terlambat</div></div>
        <div class="mini-stat"><div class="l">Lembur</div><div class="v">${U.num(U.sum(bulan, x => x.overtime || 0), 1)} jam</div>
          <div class="s">bulan berjalan</div></div>
        <div class="mini-stat"><div class="l">Komisi</div><div class="v" style="font-size:15px">${U.rp(komisi)}</div>
          <div class="s">dari penjualan</div></div>
        <div class="mini-stat"><div class="l">Estimasi THP</div><div class="v" style="font-size:15px">${U.rp(
          me.salaryBase + U.sum(me.allowances, x => x.amount) - U.sum(me.deductions, x => x.amount) + komisi)}</div>
          <div class="s">termasuk komisi</div></div>
      </div>
      ${pesan.length ? `<div class="card"><div class="card__head"><h3>Pengumuman</h3></div><div class="card__body">
        ${pesan.map(n => `<div class="list-row"><span class="thumb">📢</span>
          <div style="flex:1"><b style="font-size:12.5px">${U.esc(n.title)}</b>
            <div class="small muted">${U.esc(n.message)}</div>
            <div class="small muted">${U.ago(n.at)}</div></div></div>`).join('')}
      </div></div>` : ''}`;
    el.querySelector('#tb-clock').onclick = clock;
  }

  function clock() {
    const a = todayAtt();
    const now = U.now();
    if (!a) {
      const sch = DB.first('schedules', s => s.employeeId === me.id && s.date === U.today());
      const startH = sch ? Number(sch.start.slice(0, 2)) : 8;
      const late = Math.max(0, Math.round((new Date(now) - new Date(`${U.today()}T${String(startH).padStart(2,'0')}:00:00`)) / 60000));
      const tol = (DB.settings().payroll || {}).lateToleranceMin || 10;
      DB.insert('attendance', { employeeId:me.id, date:U.today(), status: late > tol ? 'telat' : 'hadir',
        inTime:now, outTime:null, hours:0, overtime:0, late, photoIn:'📷', note:'', approved:true, outletId:me.outletId });
      App.UI.toast(`Absen masuk ${U.fmtTime(now)}${late > tol ? ` — terlambat ${late} menit` : ' — tepat waktu 👍'}`, late > tol ? 'warn' : 'ok');
    } else if (!a.outTime) {
      const hours = U.round2((new Date(now) - new Date(a.inTime)) / 3600000);
      DB.update('attendance', a.id, { outTime:now, hours, overtime:Math.max(0, U.round2(hours - 8)) });
      App.UI.toast(`Absen pulang — ${U.num(hours, 1)} jam kerja hari ini`, 'ok');
    } else {
      App.UI.toast('Absensi hari ini sudah lengkap', 'info');
    }
    draw();
  }

  function tabAbsen(el) {
    const list = U.sortBy(DB.where('attendance', a => a.employeeId === me.id), a => a.date, 'desc').slice(0, 30);
    el.innerHTML = `<div class="card"><div class="card__head"><h3>Riwayat Absensi</h3></div><div class="card__body">
      ${list.map(a => `<div class="list-row">
        <div style="flex:1"><b style="font-size:12.5px">${U.fmtDate(a.date, 'full')}</b>
          <div class="small muted">${a.inTime ? U.fmtTime(a.inTime) : '—'} – ${a.outTime ? U.fmtTime(a.outTime) : '—'}
            ${a.overtime ? ' · lembur ' + U.num(a.overtime, 1) + ' jam' : ''}</div></div>
        <span class="badge ${a.status === 'telat' ? 'badge--amber' : a.status === 'izin' ? 'badge--blue' : 'badge--green'}">${U.titleCase(a.status)}</span>
      </div>`).join('') || '<div class="empty small">Belum ada riwayat</div>'}
    </div></div>`;
  }

  function tabJadwal(el) {
    const days = U.dateRangeDays(U.today(), U.addDays(U.today(), 13));
    const sch = DB.where('schedules', s => s.employeeId === me.id);
    el.innerHTML = `<div class="card"><div class="card__head"><h3>Jadwal 14 Hari</h3></div><div class="card__body">
      ${days.map(d => {
        const s = sch.find(x => x.date === d);
        return `<div class="list-row">
          <div style="width:46px;text-align:center">
            <div style="font-size:16px;font-weight:800">${new Date(d).getDate()}</div>
            <div class="small muted">${U.HARI[new Date(d).getDay()].slice(0,3)}</div></div>
          <div style="flex:1">${s ? `<b style="font-size:12.5px">${U.esc(s.shiftName)}</b>
            <div class="small muted">${U.esc(s.start)} – ${U.esc(s.end)}</div>`
            : '<span class="muted small">Libur</span>'}</div>
          ${d === U.today() ? '<span class="badge badge--brand">Hari ini</span>' : ''}
        </div>`;
      }).join('')}
    </div></div>`;
  }

  function tabGaji(el) {
    const runs = U.sortBy(DB.all('payrolls'), p => p.period, 'desc');
    const mine = runs.map(r => ({ r, line: r.lines.find(l => l.employeeId === me.id) })).filter(x => x.line);
    el.innerHTML = `
      <div class="card mb-12"><div class="card__head"><h3>Struktur Gaji</h3></div><div class="card__body">
        <div class="kv"><span class="k">Gaji pokok</span><span class="v">${U.rp(me.salaryBase)}</span></div>
        ${me.allowances.map(a => `<div class="kv"><span class="k" style="padding-left:10px">${U.esc(a.name)}</span><span class="v">+${U.rp(a.amount)}</span></div>`).join('')}
        ${me.deductions.map(a => `<div class="kv"><span class="k" style="padding-left:10px">${U.esc(a.name)}</span><span class="v" style="color:var(--rose)">−${U.rp(a.amount)}</span></div>`).join('')}
        <div class="divider"></div>
        <div class="kv bold"><span class="k">Take home pay</span><span class="v">${U.rp(
          me.salaryBase + U.sum(me.allowances, a => a.amount) - U.sum(me.deductions, a => a.amount))}</span></div>
        <div class="kv"><span class="k">Rekening</span><span class="v">${U.esc(me.bankName || '-')} ${U.esc(me.bankAccount || '')}</span></div>
      </div></div>
      <div class="card"><div class="card__head"><h3>Slip Gaji</h3></div><div class="card__body">
        ${mine.length ? mine.map(({ r, line }) => `<div class="list-row">
          <div style="flex:1"><b style="font-size:12.5px">${U.fmtDate(r.period + '-01', 'month')}</b>
            <div class="small muted">${U.esc(r.no)} · ${U.titleCase(r.status)}</div></div>
          <div class="right"><b>${U.rp(line.net)}</b>
            <div><button class="btn btn--sm mt-4" data-slip="${r.id}">Lihat</button></div></div></div>`).join('')
          : '<div class="empty small">Belum ada slip gaji</div>'}
      </div></div>`;
    el.querySelectorAll('[data-slip]').forEach(b => b.onclick = () => {
      const r = DB.find('payrolls', b.dataset.slip);
      App.UI.print(App.HR.slipHTML(me, r.lines.find(l => l.employeeId === me.id), r));
    });
  }

  function tabAjukan(el) {
    const mine = U.sortBy(DB.where('leaves', l => l.employeeId === me.id), l => l.from, 'desc');
    el.innerHTML = `
      <div class="card mb-12"><div class="card__body">
        <button class="btn btn--primary btn--block" id="aj-new">📝 Ajukan Cuti / Izin</button>
      </div></div>
      <div class="card"><div class="card__head"><h3>Riwayat Pengajuan</h3></div><div class="card__body">
        ${mine.length ? mine.map(l => `<div class="list-row">
          <div style="flex:1"><b style="font-size:12.5px">${U.esc(l.type)}</b>
            <div class="small muted">${U.fmtDate(l.from)} – ${U.fmtDate(l.to)} (${l.days} hari)</div>
            <div class="small muted">${U.esc(l.reason)}</div></div>
          <span class="badge ${l.status === 'disetujui' ? 'badge--green' : l.status === 'ditolak' ? 'badge--red' : 'badge--amber'}">${U.titleCase(l.status)}</span>
        </div>`).join('') : '<div class="empty small">Belum ada pengajuan</div>'}
      </div></div>`;
    el.querySelector('#aj-new').onclick = () => App.UI.formModal({
      title:'Ajukan Cuti / Izin',
      fields:[
        { name:'type', label:'Jenis', type:'select', options:['Cuti Tahunan','Sakit','Izin','Cuti Menikah'] },
        { name:'from', label:'Dari tanggal', type:'date', value:U.today(), required:true },
        { name:'to', label:'Sampai tanggal', type:'date', value:U.today(), required:true },
        { name:'reason', label:'Alasan', type:'textarea', col:2, required:true }
      ],
      validate: d => d.to < d.from ? 'Tanggal selesai tidak boleh sebelum tanggal mulai' : null,
      onSubmit(d) {
        DB.insert('leaves', { ...d, employeeId:me.id, days:U.dateRangeDays(d.from, d.to).length,
          status:'menunggu', requestedAt:U.now() });
        DB.insert('notifications', { type:'hr', title:'Pengajuan cuti baru', level:'info', read:false, at:U.now(),
          message:`${me.name} mengajukan ${d.type} ${U.fmtDate(d.from)}–${U.fmtDate(d.to)}` });
        App.UI.toast('Pengajuan terkirim, menunggu persetujuan', 'ok');
        draw();
      }
    });
  }
  draw();
};
