/* =============================================================
   SajiPOS — Komponen UI (modal, toast, tabel data, form)
   ============================================================= */
window.App = window.App || {};

App.UI = (function () {
  const U = App.U;

  /* ---------- Toast ---------- */
  function toastHost() {
    let h = document.getElementById('toasts');
    if (!h) { h = U.el('<div class="toasts" id="toasts"></div>'); document.body.appendChild(h); }
    return h;
  }
  function toast(msg, type = 'ok', ms = 2600) {
    const icons = { ok: '✅', err: '⛔', warn: '⚠️', info: 'ℹ️' };
    const t = U.el(`<div class="toast toast--${type}"><span>${icons[type] || 'ℹ️'}</span><span>${U.esc(msg)}</span></div>`);
    toastHost().appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(6px)'; t.style.transition = '.2s'; }, ms - 220);
    setTimeout(() => t.remove(), ms);
  }

  /* ---------- Modal ---------- */
  let openModals = [];
  function modal(opts) {
    const { title = '', subtitle = '', body = '', size = '', footer = null, onMount, closeOnBackdrop = true } = opts;
    const ov = U.el(`
      <div class="overlay">
        <div class="modal ${size ? 'modal--' + size : ''}" role="dialog" aria-modal="true">
          <div class="modal__head">
            <div>
              <h3>${U.esc(title)}</h3>
              ${subtitle ? `<div class="sub">${U.esc(subtitle)}</div>` : ''}
            </div>
            <button class="modal__close" title="Tutup (Esc)">✕</button>
          </div>
          <div class="modal__body"></div>
        </div>
      </div>`);
    const bodyEl = ov.querySelector('.modal__body');
    if (typeof body === 'string') bodyEl.innerHTML = body; else bodyEl.appendChild(body);

    if (footer) {
      const f = U.el('<div class="modal__foot"></div>');
      if (typeof footer === 'string') f.innerHTML = footer; else f.appendChild(footer);
      ov.querySelector('.modal').appendChild(f);
    }
    const api = {
      el: ov, body: bodyEl,
      close() {
        ov.remove();
        openModals = openModals.filter(m => m !== api);
        if (!openModals.length) document.body.style.overflow = '';
      },
      setBusy(v) { ov.querySelectorAll('button').forEach(b => b.disabled = !!v); }
    };
    ov.querySelector('.modal__close').onclick = api.close;
    if (closeOnBackdrop) ov.addEventListener('mousedown', e => { if (e.target === ov) api.close(); });
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    openModals.push(api);
    setTimeout(() => {
      const f = ov.querySelector('input:not([type=hidden]),select,textarea');
      if (f && !('ontouchstart' in window)) f.focus();
    }, 40);
    if (onMount) onMount(api);
    return api;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && openModals.length) openModals[openModals.length - 1].close();
  });

  function confirm(message, opts = {}) {
    return new Promise(resolve => {
      const m = modal({
        title: opts.title || 'Konfirmasi',
        body: `<p style="font-size:13.5px;line-height:1.6">${message}</p>`,
        footer: `<button class="btn" data-no>Batal</button>
                 <button class="btn ${opts.danger ? 'btn--danger' : 'btn--primary'}" data-yes>${U.esc(opts.okText || 'Ya, lanjutkan')}</button>`
      });
      m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
      m.el.querySelector('[data-yes]').onclick = () => { m.close(); resolve(true); };
    });
  }

  function prompt(label, opts = {}) {
    return new Promise(resolve => {
      const m = modal({
        title: opts.title || 'Masukkan data',
        body: `<div class="field"><label>${U.esc(label)}</label>
               <input class="input" id="p-val" type="${opts.type || 'text'}" value="${U.esc(opts.value ?? '')}" placeholder="${U.esc(opts.placeholder || '')}"></div>`,
        footer: `<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Simpan</button>`
      });
      const inp = m.el.querySelector('#p-val');
      const ok = () => { const v = inp.value; m.close(); resolve(v); };
      inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
      m.el.querySelector('[data-yes]').onclick = ok;
      m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(null); };
    });
  }

  /* Otorisasi PIN — dipakai untuk void, refund, diskon manual, dsb. */
  function authorize(reason, permission) {
    return new Promise(resolve => {
      const m = modal({
        title: 'Otorisasi Diperlukan',
        subtitle: reason,
        body: `<div class="field"><label>PIN Supervisor / Manager</label>
                 <input class="input" id="auth-pin" type="password" inputmode="numeric" maxlength="6" placeholder="••••" style="font-size:20px;letter-spacing:8px;text-align:center">
                 <div class="hint">Hanya pengguna dengan hak akses <b>${U.esc(permission || 'otorisasi')}</b>.</div>
               </div>
               <div id="auth-err" class="small" style="color:var(--rose)"></div>`,
        footer: `<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>Otorisasi</button>`
      });
      const inp = m.el.querySelector('#auth-pin');
      const err = m.el.querySelector('#auth-err');
      const check = () => {
        const u = App.DB.first('users', x => x.pin === inp.value && x.active !== false);
        if (!u) { err.textContent = 'PIN tidak dikenali.'; inp.value = ''; return; }
        if (permission && !App.Auth.can(permission, u)) { err.textContent = `${u.name} tidak memiliki hak akses ini.`; inp.value = ''; return; }
        App.DB.log('otorisasi', `${u.name} menyetujui: ${reason}`);
        m.close(); resolve(u);
      };
      inp.onkeydown = e => { if (e.key === 'Enter') check(); };
      m.el.querySelector('[data-yes]').onclick = check;
      m.el.querySelector('[data-no]').onclick = () => { m.close(); resolve(null); };
    });
  }

  /* ---------- Form builder ---------- */
  /* fields: [{name,label,type,value,options,required,col,hint,attrs,readonly}] */
  function formHTML(fields, values = {}) {
    const one = f => {
      const v = values[f.name] ?? f.value ?? '';
      const req = f.required ? 'required' : '';
      const ro = f.readonly ? 'readonly' : '';
      const attrs = f.attrs || '';
      let ctrl;
      switch (f.type) {
        case 'select':
          ctrl = `<select class="select" name="${f.name}" ${req} ${attrs}>
            ${(f.options || []).map(o => {
              const val = o.value ?? o, lab = o.label ?? o;
              return `<option value="${U.esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${U.esc(lab)}</option>`;
            }).join('')}</select>`;
          break;
        case 'textarea':
          ctrl = `<textarea class="textarea" name="${f.name}" ${req} ${ro} ${attrs} placeholder="${U.esc(f.placeholder || '')}">${U.esc(v)}</textarea>`;
          break;
        case 'checkbox':
          ctrl = `<label class="check"><input type="checkbox" name="${f.name}" ${v ? 'checked' : ''} ${attrs}> <span>${U.esc(f.checkLabel || f.label)}</span></label>`;
          break;
        case 'money':
          ctrl = `<input class="input input--num" name="${f.name}" type="number" step="1" min="0" value="${v === '' ? '' : Number(v)}" ${req} ${ro} ${attrs}>`;
          break;
        case 'number':
          ctrl = `<input class="input input--num" name="${f.name}" type="number" step="${f.step || 'any'}" value="${v === '' ? '' : v}" ${req} ${ro} ${attrs}>`;
          break;
        default:
          ctrl = `<input class="input" name="${f.name}" type="${f.type || 'text'}" value="${U.esc(v)}" ${req} ${ro} ${attrs} placeholder="${U.esc(f.placeholder || '')}">`;
      }
      const label = f.type === 'checkbox' ? '' : `<label>${U.esc(f.label)}${f.required ? ' *' : ''}</label>`;
      return `<div class="field" style="${f.col ? `grid-column:span ${f.col}` : ''}">${label}${ctrl}${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
    };
    return `<div class="form-row c2">${fields.map(one).join('')}</div>`;
  }
  function readForm(root) {
    const out = {};
    root.querySelectorAll('[name]').forEach(i => {
      if (i.type === 'checkbox') out[i.name] = i.checked;
      else if (i.type === 'number') out[i.name] = i.value === '' ? null : Number(i.value);
      else out[i.name] = i.value;
    });
    return out;
  }

  /* Modal form siap pakai */
  function formModal({ title, subtitle, fields, values = {}, size = '', okText = 'Simpan', extraHTML = '', onSubmit, validate }) {
    const m = modal({
      title, subtitle, size,
      body: formHTML(fields, values) + (extraHTML || ''),
      footer: `<button class="btn" data-no>Batal</button><button class="btn btn--primary" data-yes>${U.esc(okText)}</button>`
    });
    const submit = () => {
      const data = readForm(m.body);
      const missing = fields.filter(f => f.required && (data[f.name] === '' || data[f.name] === null || data[f.name] === undefined));
      if (missing.length) { toast('Lengkapi dahulu: ' + missing.map(f => f.label).join(', '), 'warn'); return; }
      if (validate) { const err = validate(data, m); if (err) { toast(err, 'warn'); return; } }
      const r = onSubmit(data, m);
      if (r !== false) m.close();
    };
    m.el.querySelector('[data-yes]').onclick = submit;
    m.el.querySelector('[data-no]').onclick = m.close;
    m.body.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') { e.preventDefault(); submit(); }
    });
    return m;
  }

  /* ---------- Tabel data ---------- */
  /* cols: [{key,label,align,width,render(row),sortValue(row),cls}] */
  function dataTable(opts) {
    const {
      rows = [], cols = [], search = true, searchKeys = null, pageSize = 15,
      empty = 'Belum ada data', emptyIcon = '📭', toolbar = '', onRowClick = null,
      exportName = null, footRow = null, sort = null, dense = false
    } = opts;

    const state = { q: '', page: 1, sortKey: sort ? sort.key : null, sortDir: sort ? sort.dir : 'asc' };
    const wrap = U.el('<div></div>');

    function filtered() {
      let out = rows;
      if (state.q) {
        const q = state.q.toLowerCase();
        const keys = searchKeys || cols.map(c => c.key).filter(Boolean);
        out = out.filter(r => keys.some(k => String(r[k] ?? '').toLowerCase().includes(q)));
      }
      if (state.sortKey) {
        const col = cols.find(c => c.key === state.sortKey);
        const getv = r => col && col.sortValue ? col.sortValue(r) : r[state.sortKey];
        out = U.sortBy(out, getv, state.sortDir);
      }
      return out;
    }

    function render() {
      const data = filtered();
      const pages = Math.max(1, Math.ceil(data.length / pageSize));
      if (state.page > pages) state.page = pages;
      const view = data.slice((state.page - 1) * pageSize, state.page * pageSize);

      wrap.innerHTML = `
        <div class="card">
          ${(search || toolbar || exportName) ? `
          <div class="tbl-toolbar">
            ${search ? `<div class="search"><input class="input" id="dt-q" placeholder="Cari…" value="${U.esc(state.q)}"></div>` : ''}
            ${toolbar}
            ${exportName ? `<button class="btn btn--sm" id="dt-x" style="margin-left:auto">⬇ Ekspor</button>` : ''}
          </div>` : ''}
          <div class="tbl-wrap">
            <table class="tbl">
              <thead><tr>${cols.map(c => `
                <th class="${c.align === 'right' ? 'num' : ''} ${c.key && c.sortable !== false ? 'sortable' : ''}"
                    data-sort="${c.key || ''}" style="${c.width ? 'width:' + c.width : ''}">
                  ${U.esc(c.label)}${state.sortKey === c.key ? (state.sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                </th>`).join('')}</tr></thead>
              <tbody>
                ${view.length ? view.map((r, i) => `
                  <tr data-i="${(state.page - 1) * pageSize + i}" class="${onRowClick ? 'row-click' : ''}">
                    ${cols.map(c => `<td class="${c.align === 'right' ? 'num' : ''} ${c.cls || ''}" style="${dense ? 'padding:7px 12px' : ''}">${c.render ? c.render(r, i) : U.esc(r[c.key] ?? '')}</td>`).join('')}
                  </tr>`).join('') : ''}
              </tbody>
              ${footRow ? `<tfoot><tr>${footRow(data)}</tr></tfoot>` : ''}
            </table>
            ${!view.length ? `<div class="empty"><div class="empty__icon">${emptyIcon}</div><h4>${U.esc(empty)}</h4><p class="small">Data akan muncul di sini.</p></div>` : ''}
          </div>
          ${data.length > pageSize ? `
          <div class="tbl-foot">
            <span>Menampilkan ${(state.page - 1) * pageSize + 1}–${Math.min(state.page * pageSize, data.length)} dari ${data.length}</span>
            <span class="spacer"></span>
            <button class="btn btn--sm" id="dt-prev" ${state.page === 1 ? 'disabled' : ''}>‹</button>
            <span>Hal. ${state.page}/${pages}</span>
            <button class="btn btn--sm" id="dt-next" ${state.page === pages ? 'disabled' : ''}>›</button>
          </div>` : (data.length ? `<div class="tbl-foot"><span>${data.length} baris</span></div>` : '')}
        </div>`;

      const q = wrap.querySelector('#dt-q');
      if (q) q.oninput = U.debounce(e => { state.q = e.target.value; state.page = 1; render(); const n = wrap.querySelector('#dt-q'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 220);
      const prev = wrap.querySelector('#dt-prev'); if (prev) prev.onclick = () => { state.page--; render(); };
      const next = wrap.querySelector('#dt-next'); if (next) next.onclick = () => { state.page++; render(); };
      const xp = wrap.querySelector('#dt-x');
      if (xp) xp.onclick = () => {
        const plain = data.map(r => {
          const o = {};
          cols.forEach(c => {
            if (!c.label || c.exclude) return;
            let v = c.export ? c.export(r) : (c.render ? String(c.render(r)).replace(/<[^>]*>/g, '').trim() : r[c.key]);
            o[c.label] = v;
          });
          return o;
        });
        U.exportTable(exportName, plain);
      };
      wrap.querySelectorAll('th[data-sort]').forEach(th => {
        const k = th.dataset.sort; if (!k) return;
        th.onclick = () => {
          if (state.sortKey === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
          else { state.sortKey = k; state.sortDir = 'asc'; }
          render();
        };
      });
      if (onRowClick) wrap.querySelectorAll('tbody tr[data-i]').forEach(tr => {
        tr.onclick = e => { if (e.target.closest('button,a,input,select')) return; onRowClick(filtered()[+tr.dataset.i]); };
      });
    }
    render();
    wrap.refresh = render;
    return wrap;
  }

  /* ---------- potongan HTML kecil ---------- */
  function stat({ label, value, sub, delta, icon, tone }) {
    const d = delta === undefined || delta === null ? '' :
      `<span class="delta ${delta >= 0 ? 'delta--up' : 'delta--down'}">${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1).replace('.', ',')}%</span>`;
    return `<div class="stat">
      <div class="stat__label">${icon ? icon + ' ' : ''}${U.esc(label)}</div>
      <div class="stat__value" ${tone ? `style="color:${tone}"` : ''}>${value}</div>
      <div class="stat__sub">${sub || ''} ${d}</div>
    </div>`;
  }
  function emptyState(title, sub, icon = '📭') {
    return `<div class="empty"><div class="empty__icon">${icon}</div><h4>${U.esc(title)}</h4><p class="small">${U.esc(sub || '')}</p></div>`;
  }
  function badge(text, tone = '') { return `<span class="badge ${tone ? 'badge--' + tone : ''}">${U.esc(text)}</span>`; }
  function tabs(items, active, onPick) {
    const el = U.el(`<div class="tabs">${items.map(t =>
      `<button data-k="${t.key}" class="${t.key === active ? 'is-active' : ''}">${U.esc(t.label)}${t.count !== undefined ? ` <span class="muted">(${t.count})</span>` : ''}</button>`).join('')}</div>`);
    el.querySelectorAll('button').forEach(b => b.onclick = () => onPick(b.dataset.k));
    return el;
  }

  /* ---------- cetak ---------- */
  function print(html) {
    let area = document.getElementById('print-area');
    if (!area) { area = U.el('<div id="print-area"></div>'); document.body.appendChild(area); }
    area.innerHTML = html;
    window.print();
  }

  return { toast, modal, confirm, prompt, authorize, formHTML, readForm, formModal, dataTable, stat, emptyState, badge, tabs, print };
})();
