'use strict';

const SessionsPage = (() => {
  function statusBadge(status) {
    const map = {
      connected: ['badge-connected', 'Terhubung'],
      connecting: ['badge-connecting', 'Menghubungkan...'],
      qr: ['badge-qr', 'Scan QR'],
      disconnected: ['badge-disconnected', 'Terputus'],
    };
    const [cls, label] = map[status] || ['badge-disconnected', status];
    return `<span class="badge ${cls}">${label}</span>`;
  }

  function renderCard(s) {
    return `
    <div class="session-card" id="session-card-${s.id}">
      <div class="session-card-header">
        <div>
          <div class="session-name">${escHtml(s.name)}</div>
          <div class="session-phone">${s.phone ? '+' + s.phone : 'Belum terhubung'}</div>
        </div>
        <div id="status-badge-${s.id}">${statusBadge(s.status)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:13px;color:var(--text-secondary);">AI Auto-Reply</span>
        <label class="toggle">
          <input type="checkbox" ${s.ai_enabled ? 'checked' : ''} onchange="SessionsPage.toggleAI('${s.id}', this)">
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div id="qr-area-${s.id}" class="hidden"></div>
      <div class="session-card-actions">
        ${s.status === 'connected'
          ? `<button class="btn btn-secondary btn-sm" onclick="SessionsPage.disconnect('${s.id}')">Putuskan</button>`
          : `<button class="btn btn-primary btn-sm" onclick="SessionsPage.connect('${s.id}')">Hubungkan</button>`
        }
        <button class="btn btn-danger btn-sm" onclick="SessionsPage.remove('${s.id}')">Hapus</button>
      </div>
    </div>`;
  }

  async function render(container, setTitle, setActions) {
    setTitle('Sessions');
    setActions(`<button class="btn btn-primary" onclick="SessionsPage.showAddModal()">+ Tambah Nomor</button>`);

    try {
      const sessions = await API.get('/sessions');
      if (sessions.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">📱</div>
            <h3>Belum ada session</h3>
            <p>Tambahkan nomor WhatsApp untuk memulai</p>
          </div>`;
        return;
      }
      container.innerHTML = `<div class="sessions-grid" id="sessions-grid">${sessions.map(renderCard).join('')}</div>`;
    } catch (e) {
      container.innerHTML = `<p class="text-red">${e.message}</p>`;
    }
  }

  function showAddModal() {
    showModal(`
      <div class="modal">
        <div class="modal-title">Tambah Nomor WhatsApp</div>
        <div class="form-group">
          <label>Nama Session</label>
          <input type="text" id="new-session-name" placeholder="Contoh: CS Line 1">
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="SessionsPage.createSession()">Tambah</button>
        </div>
      </div>
    `);
    setTimeout(() => document.getElementById('new-session-name')?.focus(), 50);
  }

  async function createSession() {
    const name = document.getElementById('new-session-name')?.value?.trim();
    if (!name) return toast('Nama session harus diisi', 'error');
    try {
      await API.post('/sessions', { name });
      closeModal();
      toast('Session berhasil dibuat', 'success');
      App.navigate('sessions');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function connect(id) {
    try {
      const badge = document.getElementById(`status-badge-${id}`);
      if (badge) badge.innerHTML = statusBadge('connecting');
      await API.post(`/sessions/${id}/connect`);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function disconnect(id) {
    try {
      await API.post(`/sessions/${id}/disconnect`);
      toast('Session diputus', 'success');
      App.navigate('sessions');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(id) {
    if (!confirm('Hapus session ini? Semua data percakapan akan ikut terhapus.')) return;
    try {
      await API.del(`/sessions/${id}`);
      toast('Session dihapus', 'success');
      App.navigate('sessions');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function toggleAI(id, checkbox) {
    try {
      const res = await API.post(`/sessions/${id}/ai-toggle`);
      toast(res.ai_enabled ? 'AI diaktifkan' : 'AI dinonaktifkan', 'success');
    } catch (e) {
      checkbox.checked = !checkbox.checked;
      toast(e.message, 'error');
    }
  }

  // Socket.IO handlers called from app.js
  function onQR({ sessionId, qrDataUrl }) {
    const badge = document.getElementById(`status-badge-${sessionId}`);
    if (badge) badge.innerHTML = statusBadge('qr');

    const qrArea = document.getElementById(`qr-area-${sessionId}`);
    if (qrArea) {
      qrArea.classList.remove('hidden');
      qrArea.innerHTML = `
        <div class="qr-container">
          <img src="${qrDataUrl}" alt="QR Code">
          <div class="qr-instructions">Buka WhatsApp → Perangkat Tertaut → Tautkan Perangkat → Scan QR</div>
        </div>`;
    }
  }

  function onConnected({ sessionId, phone }) {
    const badge = document.getElementById(`status-badge-${sessionId}`);
    if (badge) badge.innerHTML = statusBadge('connected');
    const qrArea = document.getElementById(`qr-area-${sessionId}`);
    if (qrArea) qrArea.classList.add('hidden');

    const phoneEl = document.querySelector(`#session-card-${sessionId} .session-phone`);
    if (phoneEl && phone) phoneEl.textContent = '+' + phone;

    const actionsEl = document.querySelector(`#session-card-${sessionId} .session-card-actions`);
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-secondary btn-sm" onclick="SessionsPage.disconnect('${sessionId}')">Putuskan</button>
        <button class="btn btn-danger btn-sm" onclick="SessionsPage.remove('${sessionId}')">Hapus</button>`;
    }
    toast('WhatsApp terhubung!', 'success');
  }

  function onDisconnected({ sessionId }) {
    const badge = document.getElementById(`status-badge-${sessionId}`);
    if (badge) badge.innerHTML = statusBadge('disconnected');
    const qrArea = document.getElementById(`qr-area-${sessionId}`);
    if (qrArea) qrArea.classList.add('hidden');

    const actionsEl = document.querySelector(`#session-card-${sessionId} .session-card-actions`);
    if (actionsEl) {
      actionsEl.innerHTML = `
        <button class="btn btn-primary btn-sm" onclick="SessionsPage.connect('${sessionId}')">Hubungkan</button>
        <button class="btn btn-danger btn-sm" onclick="SessionsPage.remove('${sessionId}')">Hapus</button>`;
    }
  }

  return { render, showAddModal, createSession, connect, disconnect, remove, toggleAI, onQR, onConnected, onDisconnected };
})();
