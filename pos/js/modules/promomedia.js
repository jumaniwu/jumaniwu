/* =============================================================
   SajiPOS — Materi Promosi Layar
   Unggah foto/desain promo untuk Customer Display & Order Display,
   lengkap dengan panduan ukuran, area aman teks, dan slideshow.
   ============================================================= */
window.App = window.App || {}; App.Views = App.Views || {};

App.Promo = (function () {
  const DB = App.DB;
  const DEFAULTS = {
    interval: 8,            // detik per slide
    transition: 'fade',
    showOnCustomer: true,
    showOnOrder: false,
    fallbackText: true,     // pakai promo teks bila belum ada gambar
    fit: 'cover'
  };
  function cfg() { return { ...DEFAULTS, ...(DB.settings().promoDisplay || {}) }; }
  function setCfg(patch) { DB.setSetting('promoDisplay', { ...cfg(), ...patch }); }

  function list() {
    return App.U.sortBy(DB.all('promoMedia'), m => m.sort ?? 0);
  }
  function active() {
    const t = App.U.today();
    return list().filter(m => m.active !== false &&
      (!m.startDate || t >= m.startDate) && (!m.endDate || t <= m.endDate));
  }
  return { cfg, setCfg, list, active, DEFAULTS };
})();

App.Views.promomedia = function (root) {
  const U = App.U, DB = App.DB, M = App.Media, S = App.Media.SPEC;
  let selected = null;
  let safeGuide = true;

  function draw() {
    const items = App.Promo.list();
    const c = App.Promo.cfg();
    root.innerHTML = `
      <div class="page-head">
        <div><h2>Materi Promosi Layar</h2>
          <p>Ganti tampilan promosi pada Customer Display dengan foto atau desain Anda sendiri</p></div>
        <div class="page-head__actions">
          <button class="btn" id="pv-open">🖥️ Buka Customer Display</button>
          <button class="btn btn--primary" id="pm-add">⬆️ Unggah Gambar</button>
        </div>
      </div>
      <input type="file" id="pm-file" accept="image/*" multiple class="hidden">

      <div class="card mb-16" style="border-color:var(--brand-300)">
        <div class="card__body">
          <div class="grid g3">
            <div><div class="small muted">Ukuran ideal</div>
              <div style="font-size:19px;font-weight:800">${S.idealW} × ${S.idealH} px</div>
              <div class="small muted">rasio 16:9 (landscape) — pas layar penuh tanpa terpotong</div></div>
            <div><div class="small muted">Minimum agar tidak pecah</div>
              <div style="font-size:19px;font-weight:800">${S.minW} × ${S.minH} px</div>
              <div class="small muted">di bawah ini gambar akan tampak kabur di TV/monitor besar</div></div>
            <div><div class="small muted">Format &amp; berkas</div>
              <div style="font-size:19px;font-weight:800">JPG / PNG / WebP</div>
              <div class="small muted">maks ${S.maxSourceMB} MB — otomatis dikecilkan &amp; dikompres</div></div>
          </div>
          <div class="divider"></div>
          <div class="small muted">
            💡 <b>Letakkan teks penting di dalam area aman</b> (tengah ${Math.round(S.safeX*100)}% lebar × ${Math.round(S.safeY*100)}% tinggi).
            Saat kasir sedang memasukkan pesanan, panel struk muncul di kanan sehingga sisi gambar ikut terpotong.
            Gambar tidak pernah digepengkan — proporsinya selalu dijaga.
          </div>
        </div>
      </div>

      <div class="grid g-2-1">
        <div>
          <div class="card mb-16" id="dropzone" style="border-style:dashed;border-width:2px">
            <div class="card__body center" style="padding:26px">
              <div style="font-size:34px;opacity:.5">🖼️</div>
              <div class="bold mt-8">Tarik &amp; lepas gambar di sini</div>
              <div class="small muted">atau klik tombol “Unggah Gambar” di atas · bisa beberapa sekaligus</div>
            </div>
          </div>
          <div id="pm-list"></div>
        </div>
        <div>
          <div class="card mb-16">
            <div class="card__head"><h3>Pratinjau Layar</h3>
              <label class="check small" style="margin-left:auto"><input type="checkbox" id="pm-safe" ${safeGuide?'checked':''}> Area aman</label></div>
            <div class="card__body" id="pm-preview"></div>
          </div>
          <div class="card">
            <div class="card__head"><h3>Pengaturan Tampilan</h3></div>
            <div class="card__body">
              <div class="field"><label>Durasi tiap gambar (detik)</label>
                <input class="input input--num" type="number" min="3" max="120" id="cf-interval" value="${c.interval}"></div>
              <label class="check mb-8"><input type="checkbox" id="cf-cust" ${c.showOnCustomer?'checked':''}> <span>Tampilkan di Customer Display</span></label>
              <label class="check mb-8"><input type="checkbox" id="cf-order" ${c.showOnOrder?'checked':''}> <span>Tampilkan di Order Display</span></label>
              <label class="check mb-8"><input type="checkbox" id="cf-fallback" ${c.fallbackText?'checked':''}> <span>Bila belum ada gambar, tampilkan promo teks otomatis</span></label>
              <div class="field mt-8"><label>Cara gambar mengisi layar</label>
                <select class="select" id="cf-fit">
                  <option value="cover" ${c.fit==='cover'?'selected':''}>Penuhi layar (sisi bisa terpotong)</option>
                  <option value="contain" ${c.fit==='contain'?'selected':''}>Tampilkan utuh (ada bidang kosong)</option>
                </select></div>
              <button class="btn btn--primary btn--block mt-8" id="cf-save">Simpan Pengaturan</button>
              <div class="small muted mt-8" id="pm-usage">Menghitung pemakaian penyimpanan…</div>
            </div>
          </div>
        </div>
      </div>`;

    root.querySelector('#pm-add').onclick = () => root.querySelector('#pm-file').click();
    root.querySelector('#pm-file').onchange = e => upload([...e.target.files]);
    root.querySelector('#pv-open').onclick = () => window.open(location.href.split('#')[0] + '#/customerdisplay', '_blank');
    root.querySelector('#pm-safe').onchange = e => { safeGuide = e.target.checked; renderPreview(); };
    root.querySelector('#cf-save').onclick = () => {
      App.Promo.setCfg({
        interval: Math.max(3, Number(root.querySelector('#cf-interval').value) || 8),
        showOnCustomer: root.querySelector('#cf-cust').checked,
        showOnOrder: root.querySelector('#cf-order').checked,
        fallbackText: root.querySelector('#cf-fallback').checked,
        fit: root.querySelector('#cf-fit').value
      });
      App.Bridge.send('promo', { at: Date.now() });
      App.UI.toast('Pengaturan tampilan disimpan', 'ok');
      draw();
    };

    const dz = root.querySelector('#dropzone');
    ['dragenter','dragover'].forEach(ev => dz.addEventListener(ev, e => {
      e.preventDefault(); dz.style.borderColor = 'var(--brand-500)'; dz.style.background = 'var(--brand-50)';
    }));
    ['dragleave','drop'].forEach(ev => dz.addEventListener(ev, e => {
      e.preventDefault(); dz.style.borderColor = ''; dz.style.background = '';
    }));
    dz.addEventListener('drop', e => upload([...(e.dataTransfer.files || [])]));

    renderList(items);
    renderPreview();
    M.usage().then(u => {
      const el = root.querySelector('#pm-usage');
      if (!el) return;
      el.innerHTML = `${u.count} gambar · ${(u.bytes / 1048576).toFixed(2).replace('.', ',')} MB terpakai.
        Gambar disimpan terpisah dari basis data (IndexedDB) agar tidak membebani kuota aplikasi.`;
    }).catch(() => {});
  }

  async function upload(files) {
    const imgs = files.filter(f => /^image\//.test(f.type));
    if (!imgs.length) return App.UI.toast('Pilih berkas gambar (JPG/PNG/WebP)', 'warn');
    let ok = 0; const notes = [];
    for (const f of imgs) {
      try {
        const r = await M.save(f);
        DB.insert('promoMedia', {
          id: r.id, name: r.name, width: r.width, height: r.height, size: r.size, type: r.type,
          sourceWidth: r.sourceWidth, sourceHeight: r.sourceHeight, sourceSize: r.sourceSize,
          active: true, sort: App.Promo.list().length, startDate: '', endDate: '', caption: ''
        });
        ok++;
        r.warnings.forEach(w => notes.push(`${r.name}: ${w}`));
      } catch (e) {
        notes.push(`${f.name}: ${e.message}`);
      }
    }
    DB.saveNow();
    App.Bridge.send('promo', { at: Date.now() });
    App.UI.toast(`${ok} gambar diunggah${notes.length ? ' — ada catatan mutu' : ''}`, ok ? 'ok' : 'err');
    if (notes.length) App.UI.modal({
      title: 'Catatan Mutu Gambar',
      body: `<p class="small muted mb-12">Gambar tetap tersimpan, tetapi perhatikan hal berikut agar tampilan tidak pecah:</p>
        ${notes.map(n => `<div class="kv"><span class="k">⚠️ ${U.esc(n)}</span></div>`).join('')}`
    });
    draw();
  }

  function renderList(items) {
    const box = root.querySelector('#pm-list');
    if (!items.length) {
      box.innerHTML = App.UI.emptyState('Belum ada materi promosi',
        'Unggah foto menu, banner promo, atau desain dari Canva.', '🖼️');
      return;
    }
    box.innerHTML = `<div class="grid g2">${items.map((m, i) => `
      <div class="card ${selected === m.id ? 'is-sel' : ''}" data-m="${m.id}"
           style="${selected === m.id ? 'border-color:var(--brand-500);box-shadow:var(--shadow)' : ''}">
        <div class="promo-thumb" data-thumb="${m.id}"></div>
        <div class="card__body">
          <div class="flex items-center gap-8">
            <div style="flex:1;min-width:0">
              <b style="font-size:13px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(m.name)}</b>
              <div class="small muted">${m.width}×${m.height} px · ${(m.size/1024).toFixed(0)} KB
                ${m.sourceWidth && m.sourceWidth > m.width ? `<br>asli ${m.sourceWidth}×${m.sourceHeight} → dikecilkan` : ''}</div>
            </div>
            ${m.width < S.minW || m.height < S.minH
              ? '<span class="badge badge--amber" title="Resolusi rendah, berpotensi pecah">⚠️ Rendah</span>'
              : '<span class="badge badge--green">✓ Tajam</span>'}
          </div>
          ${m.caption ? `<div class="small muted mt-4">“${U.esc(m.caption)}”</div>` : ''}
          ${(m.startDate || m.endDate) ? `<div class="small muted mt-4">📅 ${U.esc(m.startDate || '…')} – ${U.esc(m.endDate || '…')}</div>` : ''}
          <div class="flex gap-6 mt-8">
            <button class="btn btn--sm" data-up="${m.id}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn btn--sm" data-down="${m.id}" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn btn--sm" data-edit="${m.id}">✏️</button>
            <button class="btn btn--sm" data-toggle="${m.id}" style="flex:1">${m.active !== false ? '👁️ Aktif' : '🚫 Nonaktif'}</button>
            <button class="btn btn--sm btn--danger" data-del="${m.id}">🗑️</button>
          </div>
        </div>
      </div>`).join('')}</div>`;

    items.forEach(m => M.url(m.id).then(u => {
      const el = box.querySelector(`[data-thumb="${m.id}"]`);
      if (el && u) el.style.backgroundImage = `url("${u}")`;
    }));

    box.querySelectorAll('[data-m]').forEach(el => el.onclick = e => {
      if (e.target.closest('button')) return;
      selected = el.dataset.m; draw();
    });
    box.querySelectorAll('[data-toggle]').forEach(b => b.onclick = () => {
      const m = DB.find('promoMedia', b.dataset.toggle);
      DB.update('promoMedia', m.id, { active: m.active === false });
      App.Bridge.send('promo', { at: Date.now() }); draw();
    });
    box.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const m = DB.find('promoMedia', b.dataset.del);
      if (!await App.UI.confirm(`Hapus materi promosi <b>${U.esc(m.name)}</b>?`, { danger: true })) return;
      await M.del(m.id);
      DB.remove('promoMedia', m.id);
      if (selected === m.id) selected = null;
      App.Bridge.send('promo', { at: Date.now() });
      App.UI.toast('Materi dihapus', 'ok'); draw();
    });
    const move = (id, dir) => {
      const arr = App.Promo.list();
      const i = arr.findIndex(x => x.id === id);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return;
      arr.forEach((x, k) => DB.update('promoMedia', x.id, { sort: k }));
      DB.update('promoMedia', arr[i].id, { sort: j });
      DB.update('promoMedia', arr[j].id, { sort: i });
      App.Bridge.send('promo', { at: Date.now() }); draw();
    };
    box.querySelectorAll('[data-up]').forEach(b => b.onclick = () => move(b.dataset.up, -1));
    box.querySelectorAll('[data-down]').forEach(b => b.onclick = () => move(b.dataset.down, 1));
    box.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const m = DB.find('promoMedia', b.dataset.edit);
      App.UI.formModal({
        title: 'Atur Materi Promosi', subtitle: m.name,
        fields: [
          { name:'caption', label:'Keterangan internal', col:2, placeholder:'mis. Banner promo gajian' },
          { name:'startDate', label:'Mulai tampil (opsional)', type:'date' },
          { name:'endDate', label:'Berhenti tampil (opsional)', type:'date' },
          { name:'active', label:'Aktif', type:'checkbox', checkLabel:'Tampilkan di layar', col:2 }
        ],
        values: m,
        onSubmit(d) {
          DB.update('promoMedia', m.id, d);
          App.Bridge.send('promo', { at: Date.now() });
          App.UI.toast('Materi diperbarui', 'ok'); draw();
        }
      });
    });
  }

  function renderPreview() {
    const box = root.querySelector('#pm-preview');
    if (!box) return;
    const items = App.Promo.active();
    const pick = items.find(m => m.id === selected) || items[0];
    const c = App.Promo.cfg();
    box.innerHTML = `
      <div class="promo-preview">
        <div class="promo-preview__img" id="pp-img" style="background:#0a2b28"></div>
        ${safeGuide ? `<div class="promo-preview__safe" style="width:${S.safeX*100}%;height:${S.safeY*100}%">
            <span>area aman teks</span></div>` : ''}
        <div class="promo-preview__panel">Panel struk<br><small>muncul saat transaksi</small></div>
      </div>
      <div class="small muted mt-8">
        ${pick ? `Menampilkan: <b>${U.esc(pick.name)}</b> · ${pick.width}×${pick.height} px`
               : 'Belum ada gambar aktif — layar akan memakai promo teks otomatis.'}
        ${items.length > 1 ? `<br>${items.length} gambar bergantian tiap ${c.interval} detik.` : ''}
      </div>`;
    if (pick) M.url(pick.id).then(u => {
      const el = box.querySelector('#pp-img');
      if (el && u) { el.style.backgroundImage = `url("${u}")`; el.style.backgroundSize = c.fit; }
    });
  }
  draw();
};
