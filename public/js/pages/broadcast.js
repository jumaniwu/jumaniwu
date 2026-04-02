'use strict';

const BroadcastPage = (() => {
  let _contacts = [];
  let _sessionId = null;

  async function render(container, setTitle, setActions) {
    setTitle('Broadcast');
    setActions('');

    try {
      const sessions = await API.get('/sessions');
      const connected = sessions.filter(s => s.status === 'connected');

      if (!connected.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📢</div><h3>Tidak ada session aktif</h3><p>Hubungkan WhatsApp terlebih dahulu</p></div>`;
        return;
      }

      _sessionId = _sessionId || connected[0].id;
      const sessionOptions = connected.map(s =>
        `<option value="${s.id}" ${s.id === _sessionId ? 'selected' : ''}>${escHtml(s.name)} (${s.phone || '?'})</option>`
      ).join('');

      container.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px;">
          <div class="card">
            <div class="card-title">Pengaturan Broadcast</div>
            <div class="form-group">
              <label>Session WhatsApp</label>
              <select id="bc-session" onchange="BroadcastPage.loadContacts(this.value)">
                ${sessionOptions}
              </select>
            </div>
            <div class="form-group">
              <label>Pesan</label>
              <textarea id="bc-message" rows="6" placeholder="Ketik pesan broadcast..."></textarea>
            </div>
            <button class="btn btn-primary w-full" onclick="BroadcastPage.send()">Kirim Broadcast</button>
          </div>

          <div class="card">
            <div class="card-title">Pilih Penerima</div>
            <div style="display:flex;gap:8px;margin-bottom:10px;">
              <button class="btn btn-secondary btn-sm" onclick="BroadcastPage.selectAll()">Pilih Semua</button>
              <button class="btn btn-secondary btn-sm" onclick="BroadcastPage.deselectAll()">Batal Semua</button>
              <span id="bc-selected-count" style="margin-left:auto;color:var(--text-secondary);font-size:13px;">0 dipilih</span>
            </div>
            <div class="contact-checkbox-list" id="bc-contacts">
              <div style="color:var(--text-muted);text-align:center;padding:20px;">Memuat kontak...</div>
            </div>
          </div>
        </div>`;

      await loadContacts(_sessionId);
    } catch (e) {
      container.innerHTML = `<p class="text-red">${e.message}</p>`;
    }
  }

  async function loadContacts(sessionId) {
    _sessionId = sessionId;
    try {
      _contacts = await API.get(`/contacts?session_id=${sessionId}`);
      const el = document.getElementById('bc-contacts');
      if (!el) return;
      if (!_contacts.length) {
        el.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:20px;">Belum ada kontak</div>`;
        return;
      }
      el.innerHTML = _contacts.map(c => `
        <div class="contact-checkbox-item">
          <input type="checkbox" id="bc-c-${c.id}" value="${escHtml(c.jid)}" onchange="BroadcastPage.updateCount()">
          <label for="bc-c-${c.id}">${escHtml(c.name || c.phone || c.jid)}</label>
        </div>`).join('');
      updateCount();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function updateCount() {
    const checked = document.querySelectorAll('#bc-contacts input[type="checkbox"]:checked').length;
    const el = document.getElementById('bc-selected-count');
    if (el) el.textContent = `${checked} dipilih`;
  }

  function selectAll() {
    document.querySelectorAll('#bc-contacts input[type="checkbox"]').forEach(cb => cb.checked = true);
    updateCount();
  }

  function deselectAll() {
    document.querySelectorAll('#bc-contacts input[type="checkbox"]').forEach(cb => cb.checked = false);
    updateCount();
  }

  async function send() {
    const message = document.getElementById('bc-message')?.value?.trim();
    if (!message) return toast('Tulis pesan terlebih dahulu', 'error');

    const jids = [...document.querySelectorAll('#bc-contacts input[type="checkbox"]:checked')].map(cb => cb.value);
    if (!jids.length) return toast('Pilih minimal 1 penerima', 'error');

    if (!confirm(`Kirim pesan ke ${jids.length} kontak?`)) return;

    const btn = document.querySelector('[onclick="BroadcastPage.send()"]');
    if (btn) { btn.disabled = true; btn.textContent = 'Mengirim...'; }

    try {
      const res = await API.post('/broadcast', { session_id: _sessionId, jids, text: message });
      const ok = res.results.filter(r => r.ok).length;
      const fail = res.results.filter(r => !r.ok).length;
      toast(`Broadcast selesai: ${ok} berhasil${fail ? ', ' + fail + ' gagal' : ''}`, ok ? 'success' : 'error');
      document.getElementById('bc-message').value = '';
      deselectAll();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Kirim Broadcast'; }
    }
  }

  return { render, loadContacts, selectAll, deselectAll, updateCount, send };
})();
