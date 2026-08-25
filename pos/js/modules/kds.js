window.App = window.App || {}; App.Views = App.Views || {};


/* =============================================================
   Kitchen Display System
   ============================================================= */
App.Views.kds = function (root) {
  const U = App.U, DB = App.DB;
  let station = 'all';
  let timer = null;

  function draw() {
    const oid = App.State.outletId();
    const orders = U.sortBy(DB.all('orders').filter(o =>
      o.status === 'open' && o.kitchenStatus !== 'served' && (oid === 'ALL' || o.outletId === oid)),
      o => o.createdAt);

    root.innerHTML = `
      <div class="page-head">
        <div><h2>Kitchen Display System</h2><p>Antrean pesanan dapur & bar — otomatis diperbarui</p></div>
        <div class="page-head__actions">
          <div class="pill-row">
            <button class="pill ${station==='all'?'is-active':''}" data-s="all">Semua</button>
            <button class="pill ${station==='dapur'?'is-active':''}" data-s="dapur">🍳 Dapur</button>
            <button class="pill ${station==='bar'?'is-active':''}" data-s="bar">☕ Bar</button>
          </div>
          <button class="btn" id="kds-refresh">🔄 Segarkan</button>
        </div>
      </div>
      <div class="grid g4 mb-16">
        ${App.UI.stat({ label:'Antrean Aktif', icon:'📋', value:U.num(orders.length), sub:'pesanan belum selesai' })}
        ${App.UI.stat({ label:'Item Dimasak', icon:'🍳', value:U.num(U.sum(orders, o => o.items.filter(i => i.kdsStatus !== 'done').length)), sub:'total item' })}
        ${App.UI.stat({ label:'Menunggu >15 mnt', icon:'⏰', value:U.num(orders.filter(o => U.minutesSince(o.createdAt) > 15).length), sub:'perlu percepatan', tone:'var(--rose)' })}
        ${App.UI.stat({ label:'Rata-rata Tunggu', icon:'⏱️', value:orders.length ? Math.round(U.sum(orders, o => U.minutesSince(o.createdAt)) / orders.length) + ' mnt' : '0 mnt', sub:'antrean saat ini' })}
      </div>
      <div class="kds" id="kds"></div>`;

    const box = root.querySelector('#kds');
    const visible = orders.map(o => ({
      o, items: o.items.filter(i => station === 'all' || i.station === station)
    })).filter(x => x.items.length);

    box.innerHTML = visible.length ? visible.map(({ o, items }) => {
      const mins = U.minutesSince(o.createdAt);
      const cls = mins > 15 ? 'late' : mins > 8 ? 'warn' : '';
      const ch = DB.settings().channels.find(c => c.key === o.channel) || {};
      return `<div class="kds-card ${cls}">
        <div class="kds-card__head">
          <div>
            <div class="kds-card__no">${o.tableName ? 'Meja ' + U.esc(o.tableName) : U.esc(App.POS.TYPE_LABEL[o.type] || o.type)}</div>
            <div class="small muted">${U.esc(o.no)} · ${ch.icon || ''} ${U.esc(ch.label || '')}</div>
          </div>
          <div class="kds-card__time">${mins} mnt</div>
        </div>
        <div class="kds-card__items">
          ${items.map((it, i) => `<div class="kds-item ${it.kdsStatus === 'done' ? 'done' : ''}" data-o="${o.id}" data-i="${o.items.indexOf(it)}">
            <span class="kds-item__q">${it.qty}</span>
            <div>
              <div class="kds-item__n">${U.esc(it.name)}</div>
              ${(it.variants||[]).length ? `<div class="kds-item__o">${U.esc(it.variants.map(v=>v.name).join(' · '))}</div>` : ''}
              ${(it.modifiers||[]).length ? `<div class="kds-item__o">+ ${U.esc(it.modifiers.map(m=>m.name).join(', '))}</div>` : ''}
              ${it.note ? `<div class="kds-item__o" style="color:var(--amber);font-weight:600">📝 ${U.esc(it.note)}</div>` : ''}
            </div>
          </div>`).join('')}
        </div>
        <div class="kds-card__foot">
          <button class="btn btn--sm" data-all="${o.id}">✔ Semua Selesai</button>
          <button class="btn btn--sm btn--primary" data-serve="${o.id}" style="margin-left:auto">🛎️ Sajikan</button>
        </div>
      </div>`;
    }).join('') : App.UI.emptyState('Tidak ada antrean', 'Semua pesanan sudah selesai diproses 🎉', '👨‍🍳');

    box.querySelectorAll('.kds-item').forEach(el => el.onclick = () => {
      const o = DB.find('orders', el.dataset.o);
      const i = +el.dataset.i;
      o.items[i].kdsStatus = o.items[i].kdsStatus === 'done' ? 'cooking' : 'done';
      DB.update('orders', o.id, { items:o.items,
        kitchenStatus: o.items.every(x => x.kdsStatus === 'done') ? 'ready' : 'cooking' });
      draw();
    });
    box.querySelectorAll('[data-all]').forEach(b => b.onclick = () => {
      const o = DB.find('orders', b.dataset.all);
      o.items.forEach(i => i.kdsStatus = 'done');
      DB.update('orders', o.id, { items:o.items, kitchenStatus:'ready' });
      App.UI.toast('Pesanan siap disajikan 🛎️', 'ok'); draw();
    });
    box.querySelectorAll('[data-serve]').forEach(b => b.onclick = () => {
      const o = DB.find('orders', b.dataset.serve);
      o.items.forEach(i => i.kdsStatus = 'done');
      DB.update('orders', o.id, { items:o.items, kitchenStatus:'served', servedAt:U.now() });
      draw();
    });
    root.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { station = b.dataset.s; draw(); });
    root.querySelector('#kds-refresh').onclick = draw;

    clearTimeout(timer);
    timer = setTimeout(() => { if (document.body.contains(root)) draw(); }, 30000);
  }
  draw();
};
