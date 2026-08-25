/* =============================================================
   SajiPOS — HR: Karyawan, Absensi & Jadwal, Payroll & Komisi
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

/* ---------------- Karyawan ---------------- */
App.Views.employees = function (root) {
  const U = App.U, DB = App.DB;
  function draw() {
    const oid = App.State.outletId();
    const emps = DB.all('employees').filter(e => oid === 'ALL' || e.outletId === oid);
    const gaji = U.sum(emps, e => e.salaryBase + U.sum(e.allowances, a => a.amount));
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Data Karyawan</h2><p>Profil, struktur gaji, tunjangan, dan pengaturan komisi</p></div>
        <div class="page-head__actions">
          <button class="btn" id="leave-btn">🌴 Pengajuan Cuti</button>
          <button class="btn btn--primary" id="new-emp">+ Karyawan Baru</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Total Karyawan', icon:'👥', value:U.num(emps.length), sub:`${emps.filter(e=>e.status==='aktif').length} aktif` })}
        ${App.UI.stat({ label:'Beban Gaji Bulanan', icon:'💳', value:U.rp(gaji), sub:'gaji pokok + tunjangan' })}
        ${App.UI.stat({ label:'Rata-rata Gaji', icon:'📊', value:U.rp(gaji / (emps.length || 1)), sub:'per karyawan' })}
        ${App.UI.stat({ label:'Cuti Menunggu', icon:'🌴', value:U.num(DB.where('leaves', l => l.status === 'menunggu').length), sub:'perlu persetujuan', tone:'var(--amber)' })}
      </div>
      <div id="table"></div>`;
    root.querySelector('#new-emp').onclick = () => form();
    root.querySelector('#leave-btn').onclick = leaveManager;
    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:emps, exportName:'data-karyawan', pageSize:15, searchKeys:['name','nik','position'],
      onRowClick: e => detail(e),
      cols:[
        { key:'name', label:'Karyawan', render:e => `<div class="flex items-center gap-8">
            <span class="avatar-sm">${U.initials(e.name)}</span>
            <div><b>${U.esc(e.name)}</b><div class="small muted">${U.esc(e.nik)} · ${U.esc(e.position)}</div></div></div>` },
        { key:'outletId', label:'Outlet', render:e => U.esc((DB.find('outlets', e.outletId)||{}).name || '-') },
        { key:'employmentType', label:'Status', render:e => App.UI.badge(U.titleCase(e.employmentType || 'tetap'),
            e.employmentType === 'tetap' ? 'green' : 'amber') },
        { key:'joinDate', label:'Bergabung', render:e => `${U.fmtDate(e.joinDate)}<div class="small muted">${
            Math.floor((Date.now() - new Date(e.joinDate)) / 2592000000)} bulan</div>` },
        { key:'salaryBase', label:'Gaji Pokok', align:'right', render:e => U.rp(e.salaryBase), sortValue:e => e.salaryBase },
        { key:'allow', label:'Tunjangan', align:'right', render:e => U.rp(U.sum(e.allowances, a => a.amount)) },
        { key:'commissionRate', label:'Komisi', align:'right', render:e => e.commissionRate ? e.commissionRate + '%' : '-' },
        { key:'status', label:'', render:e => App.UI.badge(U.titleCase(e.status), e.status === 'aktif' ? 'green' : 'red') }
      ]
    }));
  }

  function form(e) {
    const outlets = DB.all('outlets');
    const users = DB.all('users');
    App.UI.formModal({
      title:e ? 'Ubah Data — ' + e.name : 'Karyawan Baru', size:'lg',
      fields:[
        { name:'name', label:'Nama lengkap', required:true },
        { name:'nik', label:'NIK karyawan', required:true, value:'KS' + (2200 + DB.all('employees').length) },
        { name:'position', label:'Jabatan', required:true },
        { name:'outletId', label:'Outlet penempatan', type:'select', required:true,
          options:outlets.map(o => ({ value:o.id, label:o.name })) },
        { name:'phone', label:'Telepon' },
        { name:'email', label:'Email' },
        { name:'joinDate', label:'Tanggal bergabung', type:'date', value:U.today(), required:true },
        { name:'employmentType', label:'Jenis kontrak', type:'select', options:['tetap','kontrak','harian','magang'] },
        { name:'salaryBase', label:'Gaji pokok (Rp)', type:'money', required:true },
        { name:'commissionRate', label:'Komisi penjualan (%)', type:'number', step:'0.1', value:0 },
        { name:'bankName', label:'Bank', value:'BCA' },
        { name:'bankAccount', label:'No. rekening' },
        { name:'npwp', label:'NPWP' },
        { name:'userId', label:'Akun login sistem', type:'select',
          options:[{ value:'', label:'— tidak punya akses sistem —' }, ...users.map(u => ({ value:u.id, label:u.name + ' (' + App.Auth.roleOf(u).name + ')' }))] },
        { name:'status', label:'Status', type:'select', options:['aktif','cuti','resign'] }
      ],
      values:e || { status:'aktif', employmentType:'tetap' },
      onSubmit(d) {
        const payload = { ...d, userId:d.userId || null,
          allowances: e ? e.allowances : [
            { name:'Tunjangan Transport', amount:Math.round(d.salaryBase * 0.06) },
            { name:'Tunjangan Makan', amount:Math.round(d.salaryBase * 0.06) }],
          deductions: e ? e.deductions : [
            { name:'BPJS Kesehatan (1%)', amount:Math.round(d.salaryBase * 0.01) },
            { name:'BPJS Ketenagakerjaan (2%)', amount:Math.round(d.salaryBase * 0.02) }] };
        e ? DB.update('employees', e.id, payload) : DB.insert('employees', payload);
        App.UI.toast('Data karyawan disimpan', 'ok'); draw();
      }
    });
  }

  function detail(e) {
    const att = U.sortBy(DB.where('attendance', a => a.employeeId === e.id), a => a.date, 'desc');
    const last30 = att.filter(a => a.date >= U.addDays(U.today(), -29));
    const orders = DB.where('orders', o => o.waiterId === e.id && o.status === 'paid');
    const komisi = U.sum(orders, o => o.commission);
    const allow = U.sum(e.allowances, a => a.amount);
    const ded = U.sum(e.deductions, a => a.amount);
    const m = App.UI.modal({
      title:e.name, subtitle:`${e.nik} · ${e.position} · ${(DB.find('outlets', e.outletId)||{}).name}`, size:'xl',
      body:`<div class="grid g4 mb-16">
          ${App.UI.stat({ label:'Take Home Pay', value:U.rp(e.salaryBase + allow - ded), sub:'estimasi per bulan' })}
          ${App.UI.stat({ label:'Kehadiran 30 Hari', value:U.num(last30.filter(a => a.status !== 'izin').length) + ' hari',
            sub:`${last30.filter(a => a.status === 'telat').length} kali terlambat` })}
          ${App.UI.stat({ label:'Total Lembur', value:U.num(U.sum(last30, a => a.overtime || 0)) + ' jam', sub:'30 hari terakhir' })}
          ${App.UI.stat({ label:'Komisi Terkumpul', value:U.rp(komisi), sub:`${orders.length} transaksi dilayani` })}
        </div>
        <div class="grid g2">
          <div class="card"><div class="card__head"><h3>Struktur Gaji</h3></div><div class="card__body">
            <div class="kv"><span class="k">Gaji pokok</span><span class="v">${U.rp(e.salaryBase)}</span></div>
            ${e.allowances.map(a => `<div class="kv"><span class="k" style="padding-left:12px">${U.esc(a.name)}</span><span class="v">+${U.rp(a.amount)}</span></div>`).join('')}
            ${e.deductions.map(a => `<div class="kv"><span class="k" style="padding-left:12px">${U.esc(a.name)}</span><span class="v" style="color:var(--rose)">−${U.rp(a.amount)}</span></div>`).join('')}
            <div class="divider"></div>
            <div class="kv bold"><span class="k">Take home pay</span><span class="v">${U.rp(e.salaryBase + allow - ded)}</span></div>
            <div class="divider"></div>
            <div class="kv"><span class="k">Bank</span><span class="v">${U.esc(e.bankName || '-')} ${U.esc(e.bankAccount || '')}</span></div>
            <div class="kv"><span class="k">NPWP</span><span class="v">${U.esc(e.npwp || '-')}</span></div>
            <div class="kv"><span class="k">Komisi penjualan</span><span class="v">${e.commissionRate || 0}%</span></div>
          </div></div>
          <div class="card"><div class="card__head"><h3>Riwayat Absensi</h3></div>
            <div class="card__body" style="max-height:360px;overflow:auto">
            ${att.slice(0, 22).map(a => `<div class="kv">
              <span class="k">${U.fmtDate(a.date, 'full')}<br><span class="small">${a.inTime ? U.fmtTime(a.inTime) : '—'} – ${a.outTime ? U.fmtTime(a.outTime) : '—'}</span></span>
              <span class="v">${App.UI.badge(U.titleCase(a.status), a.status === 'hadir' ? 'green' : a.status === 'telat' ? 'amber' : 'blue')}
              ${a.overtime ? `<div class="small muted">lembur ${a.overtime} jam</div>` : ''}</span></div>`).join('')
              || App.UI.emptyState('Belum ada absensi','','⏰')}
          </div></div>
        </div>`,
      footer:`<button class="btn" data-a="slip">📄 Slip Gaji</button>
              <button class="btn btn--primary" data-a="edit">✏️ Ubah Data</button>`
    });
    m.el.querySelector('[data-a="edit"]').onclick = () => { m.close(); form(e); };
    m.el.querySelector('[data-a="slip"]').onclick = () => {
      const run = U.sortBy(DB.all('payrolls'), p => p.period, 'desc')[0];
      const line = run && run.lines.find(l => l.employeeId === e.id);
      if (!line) return App.UI.toast('Belum ada data payroll untuk karyawan ini', 'warn');
      App.UI.print(App.HR.slipHTML(e, line, run));
    };
  }

  function leaveManager() {
    const leaves = U.sortBy(DB.all('leaves'), l => l.from, 'desc');
    const m = App.UI.modal({
      title:'Pengajuan Cuti & Izin', size:'lg',
      body:`<div id="lv-list"></div><button class="btn btn--sm mt-12" id="lv-add">+ Ajukan Cuti</button>`
    });
    const render = () => {
      m.body.querySelector('#lv-list').innerHTML = `<div class="tbl-wrap card"><table class="tbl">
        <thead><tr><th>Karyawan</th><th>Jenis</th><th>Periode</th><th>Hari</th><th>Alasan</th><th>Status</th><th></th></tr></thead>
        <tbody>${DB.all('leaves').map(l => {
          const e = DB.find('employees', l.employeeId) || {};
          return `<tr><td><b>${U.esc(e.name || '-')}</b><div class="small muted">${U.esc(e.position || '')}</div></td>
            <td>${U.esc(l.type)}</td><td class="small">${U.fmtDate(l.from)} – ${U.fmtDate(l.to)}</td>
            <td class="num">${l.days}</td><td class="small">${U.esc(l.reason)}</td>
            <td>${App.UI.badge(U.titleCase(l.status), l.status === 'disetujui' ? 'green' : l.status === 'ditolak' ? 'red' : 'amber')}</td>
            <td>${l.status === 'menunggu' ? `<button class="btn btn--sm btn--primary" data-ok="${l.id}">Setujui</button>
              <button class="btn btn--sm" data-no="${l.id}">Tolak</button>` : ''}</td></tr>`;
        }).join('')}</tbody></table></div>`;
      m.body.querySelectorAll('[data-ok]').forEach(b => b.onclick = () => {
        DB.update('leaves', b.dataset.ok, { status:'disetujui', approvedBy:App.Auth.user().id });
        App.UI.toast('Cuti disetujui', 'ok'); render(); });
      m.body.querySelectorAll('[data-no]').forEach(b => b.onclick = () => {
        DB.update('leaves', b.dataset.no, { status:'ditolak', approvedBy:App.Auth.user().id }); render(); });
    };
    m.body.querySelector('#lv-add').onclick = () => App.UI.formModal({
      title:'Ajukan Cuti / Izin',
      fields:[
        { name:'employeeId', label:'Karyawan', type:'select', required:true, col:2,
          options:DB.all('employees').map(e => ({ value:e.id, label:e.name })) },
        { name:'type', label:'Jenis', type:'select', options:['Cuti Tahunan','Sakit','Izin','Cuti Melahirkan','Cuti Menikah'] },
        { name:'from', label:'Dari', type:'date', value:U.today(), required:true },
        { name:'to', label:'Sampai', type:'date', value:U.today(), required:true },
        { name:'reason', label:'Alasan', type:'textarea', col:2, required:true }
      ],
      onSubmit(d) {
        const days = U.dateRangeDays(d.from, d.to).length;
        DB.insert('leaves', { ...d, days, status:'menunggu', requestedAt:U.now() });
        render();
      }
    });
    render();
  }
  draw();
};

/* ---------------- Absensi & Jadwal ---------------- */
App.Views.attendance = function (root) {
  const U = App.U, DB = App.DB;
  const state = App.Period.init('week');
  let tab = 'absen';

  function draw() {
    const oid = App.State.outletId();
    const emps = DB.all('employees').filter(e => oid === 'ALL' || e.outletId === oid);
    const empIds = emps.map(e => e.id);
    const att = DB.all('attendance').filter(a => empIds.includes(a.employeeId) && a.date >= state.from && a.date <= state.to);
    const hariKerja = U.dateRangeDays(state.from, state.to).length;

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Absensi & Jadwal Shift</h2><p>Presensi karyawan, keterlambatan, lembur, dan penjadwalan shift</p></div>
        <div class="page-head__actions" id="period">
          <button class="btn btn--primary" id="clock">🕐 Absen Masuk/Pulang</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Tingkat Kehadiran', icon:'✅', value:U.pct(att.filter(a => a.status !== 'izin').length, emps.length * hariKerja || 1), sub:`${att.length} record` })}
        ${App.UI.stat({ label:'Keterlambatan', icon:'⏰', value:U.num(att.filter(a => a.status === 'telat').length), sub:'kali terlambat', tone:'var(--amber)' })}
        ${App.UI.stat({ label:'Total Jam Lembur', icon:'🌙', value:U.num(U.sum(att, a => a.overtime || 0)) + ' jam', sub:'periode terpilih' })}
        ${App.UI.stat({ label:'Izin / Sakit', icon:'🤒', value:U.num(att.filter(a => a.status === 'izin').length), sub:'hari tidak masuk' })}
      </div>
      <div id="tabs"></div><div id="body"></div>`;

    root.querySelector('#period').insertBefore(App.Period.bar(state, draw), root.querySelector('#clock'));
    root.querySelector('#clock').onclick = clockDialog;
    root.querySelector('#tabs').appendChild(App.UI.tabs([
      { key:'absen', label:'Absensi' }, { key:'rekap', label:'Rekap per Karyawan' }, { key:'jadwal', label:'Jadwal Shift' }
    ], tab, k => { tab = k; draw(); }));

    const body = root.querySelector('#body');
    if (tab === 'absen') {
      body.innerHTML = '<div id="t"></div>';
      body.querySelector('#t').appendChild(App.UI.dataTable({
        rows:U.sortBy(att, a => a.date + (a.inTime || ''), 'desc'), exportName:'absensi', pageSize:20, search:false,
        cols:[
          { key:'date', label:'Tanggal', render:a => U.fmtDate(a.date, 'full') },
          { key:'employeeId', label:'Karyawan', render:a => U.esc((DB.find('employees', a.employeeId)||{}).name || '-') },
          { key:'inTime', label:'Masuk', render:a => a.inTime ? `${a.photoIn || '📷'} ${U.fmtTime(a.inTime)}` : '—' },
          { key:'outTime', label:'Pulang', render:a => a.outTime ? U.fmtTime(a.outTime) : '—' },
          { key:'hours', label:'Jam Kerja', align:'right', render:a => U.num(a.hours || 0, 1) },
          { key:'overtime', label:'Lembur', align:'right', render:a => a.overtime ? `<b style="color:var(--violet)">${U.num(a.overtime,1)} jam</b>` : '-' },
          { key:'late', label:'Telat', align:'right', render:a => a.late ? `<span style="color:var(--rose)">${a.late} mnt</span>` : '-' },
          { key:'status', label:'Status', render:a => App.UI.badge(U.titleCase(a.status),
              a.status === 'hadir' ? 'green' : a.status === 'telat' ? 'amber' : 'blue') },
          { key:'note', label:'Catatan', render:a => `<span class="small">${U.esc(a.note || '')}</span>` }
        ]
      }));
    } else if (tab === 'rekap') {
      const rows = emps.map(e => {
        const list = att.filter(a => a.employeeId === e.id);
        const hadir = list.filter(a => a.status !== 'izin').length;
        return { e, hadir, telat:list.filter(a => a.status === 'telat').length,
          izin:list.filter(a => a.status === 'izin').length,
          jam:U.sum(list, a => a.hours || 0), lembur:U.sum(list, a => a.overtime || 0),
          rate: hariKerja ? (hadir / hariKerja) * 100 : 0,
          komisi: U.sum(DB.where('orders', o => o.waiterId === e.id && o.status === 'paid' &&
            U.ymd(o.date) >= state.from && U.ymd(o.date) <= state.to), o => o.commission) };
      });
      body.innerHTML = '<div id="t"></div>';
      body.querySelector('#t').appendChild(App.UI.dataTable({
        rows, exportName:'rekap-absensi', pageSize:20, search:false,
        cols:[
          { key:'nama', label:'Karyawan', render:r => `<b>${U.esc(r.e.name)}</b><div class="small muted">${U.esc(r.e.position)}</div>`, sortValue:r => r.e.name },
          { key:'hadir', label:'Hadir', align:'right', render:r => `${r.hadir}/${hariKerja}` },
          { key:'rate', label:'Kehadiran', align:'right', render:r => `<div class="progress" style="width:70px;display:inline-block;vertical-align:middle"><i style="width:${Math.min(100,r.rate)}%"></i></div> ${r.rate.toFixed(0)}%` },
          { key:'telat', label:'Telat', align:'right', render:r => r.telat || '-' },
          { key:'izin', label:'Izin', align:'right', render:r => r.izin || '-' },
          { key:'jam', label:'Jam Kerja', align:'right', render:r => U.num(r.jam, 1) },
          { key:'lembur', label:'Lembur', align:'right', render:r => U.num(r.lembur, 1) + ' jam' },
          { key:'komisi', label:'Komisi', align:'right', render:r => U.rp(r.komisi) }
        ]
      }));
    } else {
      const days = U.dateRangeDays(U.today(), U.addDays(U.today(), 6));
      const sch = DB.all('schedules').filter(s => empIds.includes(s.employeeId) && days.includes(s.date));
      body.innerHTML = `<div class="card"><div class="card__head"><h3>Jadwal 7 Hari Ke Depan</h3>
          <button class="btn btn--sm btn--primary" id="add-sch" style="margin-left:auto">+ Atur Jadwal</button></div>
        <div class="tbl-wrap"><table class="tbl">
          <thead><tr><th>Karyawan</th>${days.map(d => `<th class="center">${U.fmtDate(d,'dm')}<div class="small muted">${U.HARI[new Date(d).getDay()].slice(0,3)}</div></th>`).join('')}</tr></thead>
          <tbody>${emps.map(e => `<tr><td><b>${U.esc(e.name)}</b><div class="small muted">${U.esc(e.position)}</div></td>
            ${days.map(d => {
              const s = sch.find(x => x.employeeId === e.id && x.date === d);
              return `<td class="center">${s ? `<span class="badge ${s.shiftName.includes('Pagi') ? 'badge--amber' : 'badge--violet'}">${U.esc(s.start)}–${U.esc(s.end)}</span>`
                : '<span class="muted small">Libur</span>'}</td>`;
            }).join('')}</tr>`).join('')}
          </tbody></table></div></div>`;
      body.querySelector('#add-sch').onclick = () => App.UI.formModal({
        title:'Atur Jadwal Shift',
        fields:[
          { name:'employeeId', label:'Karyawan', type:'select', required:true, col:2,
            options:emps.map(e => ({ value:e.id, label:e.name })) },
          { name:'date', label:'Tanggal', type:'date', value:U.today(), required:true },
          { name:'shiftName', label:'Shift', type:'select', options:['Shift Pagi','Shift Sore','Shift Malam','Full Day'] },
          { name:'start', label:'Jam mulai', type:'time', value:'07:00' },
          { name:'end', label:'Jam selesai', type:'time', value:'15:00' }
        ],
        onSubmit(d) {
          const e = DB.find('employees', d.employeeId);
          const exist = DB.first('schedules', s => s.employeeId === d.employeeId && s.date === d.date);
          if (exist) DB.update('schedules', exist.id, d);
          else DB.insert('schedules', { ...d, outletId:e.outletId });
          App.UI.toast('Jadwal disimpan', 'ok'); draw();
        }
      });
    }
  }

  function clockDialog() {
    const oid = App.State.outletId();
    const emps = DB.all('employees').filter(e => (oid === 'ALL' || e.outletId === oid) && e.status === 'aktif');
    const m = App.UI.modal({
      title:'Absensi Karyawan', subtitle:U.fmtDate(U.today(), 'full') + ' · ' + U.fmtTime(U.now()), size:'lg',
      body:`<div class="user-pick" style="max-height:430px">${emps.map(e => {
        const a = DB.first('attendance', x => x.employeeId === e.id && x.date === U.today());
        return `<button data-e="${e.id}">
          <span class="avatar-sm">${U.initials(e.name)}</span>
          <span style="flex:1"><b>${U.esc(e.name)}</b><small>${U.esc(e.position)}</small></span>
          <span class="small">${a ? (a.outTime ? '✅ Selesai ' + U.fmtTime(a.inTime) + '–' + U.fmtTime(a.outTime)
            : '🟢 Masuk ' + U.fmtTime(a.inTime)) : '⚪ Belum absen'}</span></button>`;
      }).join('')}</div>`
    });
    m.body.querySelectorAll('[data-e]').forEach(b => b.onclick = () => {
      const e = DB.find('employees', b.dataset.e);
      const a = DB.first('attendance', x => x.employeeId === e.id && x.date === U.today());
      const now = U.now();
      if (!a) {
        const sch = DB.first('schedules', s => s.employeeId === e.id && s.date === U.today());
        const startH = sch ? Number(sch.start.slice(0, 2)) : 8;
        const late = Math.max(0, Math.round((new Date(now) - new Date(`${U.today()}T${String(startH).padStart(2,'0')}:00:00`)) / 60000));
        DB.insert('attendance', { employeeId:e.id, date:U.today(), status: late > 10 ? 'telat' : 'hadir',
          inTime:now, outTime:null, hours:0, overtime:0, late, photoIn:'📷', note:'', approved:true, outletId:e.outletId });
        App.UI.toast(`${e.name} absen masuk ${U.fmtTime(now)}${late > 10 ? ` (telat ${late} menit)` : ''}`, late > 10 ? 'warn' : 'ok');
      } else if (!a.outTime) {
        const hours = U.round2((new Date(now) - new Date(a.inTime)) / 3600000);
        DB.update('attendance', a.id, { outTime:now, hours, overtime:Math.max(0, U.round2(hours - 8)) });
        App.UI.toast(`${e.name} absen pulang — ${U.num(hours, 1)} jam kerja`, 'ok');
      } else {
        App.UI.toast('Karyawan sudah menyelesaikan absensi hari ini', 'info');
      }
      m.close(); draw();
    });
  }
  draw();
};

/* ---------------- Payroll ---------------- */
App.HR = (function () {
  const U = App.U, DB = App.DB;

  function buildLines(period, outletId) {
    const emps = DB.all('employees').filter(e => e.status === 'aktif' && (outletId === 'ALL' || e.outletId === outletId));
    const from = period + '-01', to = U.endOfMonth(from);
    const cfg = DB.settings().payroll || {};
    return emps.map(e => {
      const att = DB.where('attendance', a => a.employeeId === e.id && a.date >= from && a.date <= to);
      const days = att.filter(a => a.status !== 'izin').length;
      const otHours = U.sum(att, a => a.overtime || 0);
      const otRate = e.salaryBase / 173 * (cfg.overtimeRate || 1.5);
      const overtime = Math.round(otHours * otRate);
      const allowance = U.sum(e.allowances, a => a.amount);
      const deduction = U.sum(e.deductions, a => a.amount);
      const commission = U.sum(DB.where('orders', o => o.waiterId === e.id && o.status === 'paid' &&
        U.ymd(o.date) >= from && U.ymd(o.date) <= to), o => o.commission || 0);
      const gross = e.salaryBase + allowance + overtime + commission;
      const tax = cfg.pph21 && gross > 5400000 ? Math.round((gross - 4500000) * 0.05) : 0;
      return { employeeId:e.id, name:e.name, position:e.position, days, otHours,
        base:e.salaryBase, allowance, overtime, commission, deduction, tax, bpjs:0,
        net: gross - deduction - tax };
    });
  }

  function slipHTML(emp, line, run) {
    const biz = DB.settings().business;
    const gross = line.base + line.allowance + line.overtime + line.commission;
    return `<div style="font-family:sans-serif;padding:26px;max-width:640px;margin:0 auto;color:#111">
      <div style="text-align:center;border-bottom:2px solid #333;padding-bottom:10px">
        <h2 style="margin:0">SLIP GAJI KARYAWAN</h2>
        <div>${U.esc(biz.name)} — Periode ${U.fmtDate(run.period + '-01', 'month')}</div>
      </div>
      <table style="width:100%;margin:16px 0;font-size:13px">
        <tr><td>Nama</td><td>: <b>${U.esc(emp.name)}</b></td><td>NIK</td><td>: ${U.esc(emp.nik)}</td></tr>
        <tr><td>Jabatan</td><td>: ${U.esc(emp.position)}</td><td>Outlet</td><td>: ${U.esc((DB.find('outlets', emp.outletId)||{}).name || '-')}</td></tr>
        <tr><td>Hari kerja</td><td>: ${line.days} hari</td><td>Lembur</td><td>: ${U.num(line.otHours || 0, 1)} jam</td></tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <tr style="background:#eee"><th style="text-align:left;padding:6px">PENERIMAAN</th><th style="text-align:right;padding:6px">Jumlah</th></tr>
        <tr><td style="padding:5px">Gaji pokok</td><td style="text-align:right">${U.num(line.base)}</td></tr>
        <tr><td style="padding:5px">Tunjangan</td><td style="text-align:right">${U.num(line.allowance)}</td></tr>
        <tr><td style="padding:5px">Lembur</td><td style="text-align:right">${U.num(line.overtime)}</td></tr>
        <tr><td style="padding:5px">Komisi penjualan</td><td style="text-align:right">${U.num(line.commission)}</td></tr>
        <tr style="border-top:1px solid #999"><td style="padding:6px"><b>Total penerimaan</b></td><td style="text-align:right"><b>${U.num(gross)}</b></td></tr>
        <tr style="background:#eee"><th style="text-align:left;padding:6px">POTONGAN</th><th style="text-align:right;padding:6px">Jumlah</th></tr>
        <tr><td style="padding:5px">BPJS & potongan lain</td><td style="text-align:right">${U.num(line.deduction)}</td></tr>
        <tr><td style="padding:5px">PPh 21</td><td style="text-align:right">${U.num(line.tax)}</td></tr>
        <tr style="border-top:1px solid #999"><td style="padding:6px"><b>Total potongan</b></td><td style="text-align:right"><b>${U.num(line.deduction + line.tax)}</b></td></tr>
        <tr style="background:#dff2ee"><td style="padding:8px"><b>GAJI DITERIMA</b></td><td style="text-align:right;font-size:15px"><b>${U.rp(line.net)}</b></td></tr>
      </table>
      <p style="font-size:12px">Terbilang: <i>${U.terbilang(line.net)} rupiah</i></p>
      <p style="font-size:12px">Ditransfer ke ${U.esc(emp.bankName || '-')} ${U.esc(emp.bankAccount || '')}</p>
      <div style="display:flex;justify-content:space-between;margin-top:44px;font-size:13px">
        <div>Diterima oleh,<br><br><br>${U.esc(emp.name)}</div>
        <div>Disetujui,<br><br><br>HRD / Manager</div></div>
      <p style="font-size:10px;color:#777;margin-top:20px">Slip gaji ini dicetak otomatis oleh sistem dan sah tanpa tanda tangan basah.</p>
    </div>`;
  }
  return { buildLines, slipHTML };
})();

App.Views.payroll = function (root) {
  const U = App.U, DB = App.DB, L = App.Ledger;
  function draw() {
    const runs = U.sortBy(DB.all('payrolls'), p => p.period, 'desc');
    const last = runs[0];
    const oid = App.State.outletId();
    const komisiBulanIni = U.sum(DB.all('orders').filter(o => o.status === 'paid' &&
      U.monthKey(U.ymd(o.date)) === U.monthKey(U.today()) && (oid === 'ALL' || o.outletId === oid)), o => o.commission || 0);
    const hutangGaji = L.balanceByCode(L.A.SALARY_PAYABLE, U.today(), null);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Payroll & Komisi</h2><p>Hitung gaji otomatis dari absensi, lembur, dan komisi penjualan</p></div>
        <div class="page-head__actions">
          <button class="btn" id="komisi-btn">💵 Laporan Komisi</button>
          <button class="btn btn--primary" id="new-run">+ Proses Payroll</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Payroll Terakhir', icon:'💳', value:last ? U.rp(last.total) : 'Rp 0',
          sub:last ? U.fmtDate(last.period + '-01', 'month') : 'belum ada' })}
        ${App.UI.stat({ label:'Karyawan Digaji', icon:'👥', value:last ? U.num(last.lines.length) : '0', sub:'periode terakhir' })}
        ${App.UI.stat({ label:'Komisi Bulan Ini', icon:'🎯', value:U.rp(komisiBulanIni), sub:'akan masuk payroll' })}
        ${App.UI.stat({ label:'Hutang Gaji', icon:'⚠️', value:U.rp(hutangGaji), sub:'belum dibayarkan', tone: hutangGaji > 0 ? 'var(--amber)' : '' })}
      </div>
      <div id="table"></div>`;
    root.querySelector('#new-run').onclick = runDialog;
    root.querySelector('#komisi-btn').onclick = komisiReport;
    root.querySelector('#table').appendChild(App.UI.dataTable({
      rows:runs, exportName:'payroll', pageSize:12, onRowClick: r => detail(r),
      cols:[
        { key:'no', label:'No', render:r => `<span class="mono">${U.esc(r.no)}</span>` },
        { key:'period', label:'Periode', render:r => U.fmtDate(r.period + '-01', 'month') },
        { key:'runDate', label:'Tanggal Proses', render:r => U.fmtDate(r.runDate) },
        { key:'lines', label:'Karyawan', align:'right', render:r => r.lines.length },
        { key:'gross', label:'Bruto', align:'right', render:r => U.rp(U.sum(r.lines, l => l.base + l.allowance + l.overtime + l.commission)) },
        { key:'potongan', label:'Potongan', align:'right', render:r => U.rp(U.sum(r.lines, l => l.deduction + l.tax)) },
        { key:'total', label:'Dibayarkan', align:'right', render:r => `<b>${U.rp(r.total)}</b>`, sortValue:r => r.total },
        { key:'status', label:'Status', render:r => App.UI.badge(U.titleCase(r.status),
            r.status === 'dibayar' ? 'green' : 'amber') }
      ]
    }));
  }

  function runDialog() {
    const period = U.monthKey(U.addMonths(U.today(), -1));
    const oid = App.State.outletId();
    let lines = App.HR.buildLines(period, oid);
    const m = App.UI.modal({
      title:'Proses Payroll', subtitle:'Gaji, tunjangan, lembur & komisi dihitung otomatis', size:'xl',
      body:`<div class="form-row c3 mb-12">
          <div class="field"><label>Periode gaji</label><input class="input" type="month" id="pr-period" value="${period}"></div>
          <div class="field"><label>Tanggal bayar</label><input class="input" type="date" id="pr-date" value="${U.today()}"></div>
          <div class="field"><label>Outlet</label><select class="select" id="pr-outlet">
            <option value="ALL">Semua outlet</option>
            ${DB.all('outlets').map(o => `<option value="${o.id}" ${o.id === oid ? 'selected' : ''}>${U.esc(o.name)}</option>`).join('')}</select></div>
        </div>
        <div class="tbl-wrap card mb-12" style="max-height:380px;overflow:auto"><table class="tbl">
          <thead><tr><th>Karyawan</th><th class="num">Hari</th><th class="num">Gaji Pokok</th><th class="num">Tunjangan</th>
          <th class="num">Lembur</th><th class="num">Komisi</th><th class="num">Potongan</th><th class="num">PPh21</th><th class="num">Diterima</th></tr></thead>
          <tbody id="pr-body"></tbody>
          <tfoot><tr><td colspan="8">TOTAL DIBAYARKAN</td><td class="num" id="pr-total">Rp 0</td></tr></tfoot>
        </table></div>`,
      footer:`<button class="btn" data-no>Batal</button>
              <button class="btn" data-draft>Simpan Draft</button>
              <button class="btn btn--primary" data-pay>Proses & Bayar</button>`
    });
    const render = () => {
      m.body.querySelector('#pr-body').innerHTML = lines.map(l => `<tr>
        <td><b>${U.esc(l.name)}</b><div class="small muted">${U.esc(l.position || '')}</div></td>
        <td class="num">${l.days}</td><td class="num">${U.num(l.base)}</td><td class="num">${U.num(l.allowance)}</td>
        <td class="num">${U.num(l.overtime)}</td><td class="num">${U.num(l.commission)}</td>
        <td class="num">${U.num(l.deduction)}</td><td class="num">${U.num(l.tax)}</td>
        <td class="num"><b>${U.rp(l.net)}</b></td></tr>`).join('');
      m.body.querySelector('#pr-total').textContent = U.rp(U.sum(lines, l => l.net));
    };
    const reload = () => {
      lines = App.HR.buildLines(m.body.querySelector('#pr-period').value, m.body.querySelector('#pr-outlet').value);
      render();
    };
    m.body.querySelector('#pr-period').onchange = reload;
    m.body.querySelector('#pr-outlet').onchange = reload;
    const save = pay => {
      const period = m.body.querySelector('#pr-period').value;
      const outletSel = m.body.querySelector('#pr-outlet').value;
      const dup = DB.first('payrolls', r => r.period === period && r.outletId === outletSel);
      if (dup) {
        App.UI.toast(`Payroll periode ${U.fmtDate(period + '-01','month')} sudah pernah diproses (${dup.no}). Hapus atau pilih periode lain.`, 'warn', 5000);
        return;
      }
      const run = DB.insert('payrolls', {
        no:DB.nextNo('payroll','PAY'), period, outletId:outletSel,
        runDate:m.body.querySelector('#pr-date').value,
        lines, total:U.sum(lines, l => l.net), status: pay ? 'dibayar' : 'draft',
        paidAt: pay ? U.now() : null, note:''
      });
      L.postPayroll(run);
      if (pay) L.postPayrollPayment(run, L.id(L.A.BANK));
      DB.log('hr.payroll', `Payroll ${run.period}: ${U.rp(run.total)} untuk ${lines.length} karyawan`);
      App.UI.toast(pay ? 'Payroll diproses & dibayarkan' : 'Payroll disimpan sebagai draft', 'ok');
      m.close(); draw();
    };
    m.el.querySelector('[data-no]').onclick = m.close;
    m.el.querySelector('[data-draft]').onclick = () => save(false);
    m.el.querySelector('[data-pay]').onclick = () => save(true);
    render();
  }

  function detail(run) {
    const m = App.UI.modal({
      title:'Payroll ' + run.no, subtitle:`${U.fmtDate(run.period + '-01','month')} · ${run.lines.length} karyawan`, size:'xl',
      body:`<div class="grid g4 mb-16">
          ${App.UI.stat({ label:'Total Bruto', value:U.rp(U.sum(run.lines, l => l.base + l.allowance + l.overtime + l.commission)) })}
          ${App.UI.stat({ label:'Total Potongan', value:U.rp(U.sum(run.lines, l => l.deduction + l.tax)) })}
          ${App.UI.stat({ label:'Total Komisi', value:U.rp(U.sum(run.lines, l => l.commission)) })}
          ${App.UI.stat({ label:'Dibayarkan', value:U.rp(run.total) })}
        </div>
        <div class="tbl-wrap card"><table class="tbl">
          <thead><tr><th>Karyawan</th><th class="num">Pokok</th><th class="num">Tunjangan</th><th class="num">Lembur</th>
          <th class="num">Komisi</th><th class="num">Potongan</th><th class="num">Diterima</th><th></th></tr></thead>
          <tbody>${run.lines.map(l => `<tr><td><b>${U.esc(l.name)}</b></td>
            <td class="num">${U.num(l.base)}</td><td class="num">${U.num(l.allowance)}</td>
            <td class="num">${U.num(l.overtime)}</td><td class="num">${U.num(l.commission)}</td>
            <td class="num">${U.num(l.deduction + l.tax)}</td><td class="num"><b>${U.rp(l.net)}</b></td>
            <td><button class="btn btn--sm" data-slip="${l.employeeId}">Slip</button></td></tr>`).join('')}</tbody>
        </table></div>`,
      footer: run.status !== 'dibayar' ? `<button class="btn btn--primary" data-a="pay">💳 Bayarkan Sekarang</button>` : ''
    });
    m.body.querySelectorAll('[data-slip]').forEach(b => b.onclick = () => {
      const emp = DB.find('employees', b.dataset.slip);
      const line = run.lines.find(l => l.employeeId === b.dataset.slip);
      App.UI.print(App.HR.slipHTML(emp, line, run));
    });
    const pay = m.el.querySelector('[data-a="pay"]');
    if (pay) pay.onclick = () => {
      L.postPayrollPayment(run, L.id(L.A.BANK));
      DB.update('payrolls', run.id, { status:'dibayar', paidAt:U.now() });
      App.UI.toast('Gaji dibayarkan & hutang gaji dilunasi', 'ok'); m.close(); draw();
    };
  }

  function komisiReport() {
    const state = App.Period.init('month');
    const m = App.UI.modal({ title:'Laporan Komisi Karyawan', size:'xl', body:'<div id="km"></div>' });
    const render = () => {
      const oid = App.State.outletId();
      const orders = App.Sales.orders({ from:state.from, to:state.to, outletId:oid }).filter(o => o.waiterId);
      const g = U.groupBy(orders, o => o.waiterId);
      const rows = Object.entries(g).map(([eid, list]) => {
        const e = DB.find('employees', eid) || {};
        return { nama:e.name || '-', posisi:e.position || '', rate:(e.commissionRate || 0) + '%',
          trx:list.length, omzet:U.sum(list, o => o.subtotal - o.discount), komisi:U.sum(list, o => o.commission) };
      }).sort((a, b) => b.komisi - a.komisi);
      m.body.querySelector('#km').innerHTML = `
        <div class="grid g3 mb-16">
          ${App.UI.stat({ label:'Total Komisi', value:U.rp(U.sum(rows, r => r.komisi)) })}
          ${App.UI.stat({ label:'Transaksi Berkomisi', value:U.num(U.sum(rows, r => r.trx)) })}
          ${App.UI.stat({ label:'Karyawan', value:U.num(rows.length) })}
        </div>
        <div class="tbl-wrap card"><table class="tbl">
          <thead><tr><th>Karyawan</th><th>Jabatan</th><th class="num">Rate</th><th class="num">Transaksi</th>
          <th class="num">Omzet Dilayani</th><th class="num">Komisi</th></tr></thead>
          <tbody>${rows.map(r => `<tr><td><b>${U.esc(r.nama)}</b></td><td>${U.esc(r.posisi)}</td>
            <td class="num">${r.rate}</td><td class="num">${U.num(r.trx)}</td>
            <td class="num">${U.rp(r.omzet)}</td><td class="num"><b>${U.rp(r.komisi)}</b></td></tr>`).join('')
            || '<tr><td colspan="6" class="center muted" style="padding:20px">Belum ada data komisi</td></tr>'}</tbody>
        </table></div>`;
    };
    const bar = App.Period.bar(state, render);
    bar.style.marginLeft = 'auto';
    m.el.querySelector('.modal__head').appendChild(bar);
    render();
  }
  draw();
};
