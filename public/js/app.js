'use strict';

// ── Utility functions (global) ───────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function showModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });
  document.getElementById('modal-container').appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

// ── App router ───────────────────────────────────────
const App = (() => {
  const pages = {
    overview: { title: 'Overview', render: renderOverview },
    sessions: { title: 'Sessions', render: SessionsPage.render },
    conversations: { title: 'Percakapan', render: ConversationsPage.render },
    contacts: { title: 'Kontak', render: ContactsPage.render },
    knowledge: { title: 'Knowledge Base', render: KnowledgePage.render },
    broadcast: { title: 'Broadcast', render: BroadcastPage.render },
  };

  let _current = null;

  function navigate(page) {
    if (!pages[page]) page = 'overview';
    _current = page;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });

    const container = document.getElementById('page-content');
    const setTitle = (t) => { document.getElementById('page-title').textContent = t; };
    const setActions = (html) => { document.getElementById('topbar-actions').innerHTML = html; };

    // Reset container styles
    container.style.padding = '24px';
    container.style.overflow = 'auto';
    container.style.height = '';

    pages[page].render(container, setTitle, setActions);
  }

  function init() {
    // Nav click handlers
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', () => navigate(el.dataset.page));
    });

    // Socket.IO
    initSocket();

    // Start on overview
    navigate('overview');
  }

  return { navigate, init };
})();

// ── Overview page ────────────────────────────────────
async function renderOverview(container, setTitle, setActions) {
  setTitle('Overview');
  setActions('');

  container.innerHTML = `<div style="color:var(--text-muted)">Memuat...</div>`;

  try {
    const [sessions, conversations] = await Promise.all([
      API.get('/sessions'),
      API.get('/conversations'),
    ]);

    const connected = sessions.filter(s => s.status === 'connected').length;
    const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const todayTs = Math.floor(new Date().setHours(0, 0, 0, 0) / 1000);
    const todayConvs = conversations.filter(c => (c.last_message_at || 0) >= todayTs).length;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Sessions Aktif</div>
          <div class="stat-value text-green">${connected}</div>
          <div class="stat-sub">${sessions.length} total session</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Total Percakapan</div>
          <div class="stat-value">${conversations.length}</div>
          <div class="stat-sub">${todayConvs} aktif hari ini</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pesan Belum Dibaca</div>
          <div class="stat-value ${totalUnread > 0 ? 'text-red' : ''}">${totalUnread}</div>
          <div class="stat-sub">dari semua percakapan</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div class="card">
          <div class="card-title">Sessions WhatsApp</div>
          ${sessions.length === 0 ? '<p style="color:var(--text-muted)">Belum ada session</p>' : `
          <div class="table-wrap">
            <table>
              <thead><tr><th>Nama</th><th>Nomor</th><th>Status</th><th>AI</th></tr></thead>
              <tbody>
                ${sessions.map(s => `
                <tr>
                  <td>${escHtml(s.name)}</td>
                  <td>${s.phone ? '+' + s.phone : '-'}</td>
                  <td><span class="badge badge-${s.status}">${s.status}</span></td>
                  <td>${s.ai_enabled ? '<span class="badge badge-ai-on">ON</span>' : '<span class="badge badge-ai-off">OFF</span>'}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>`}
        </div>

        <div class="card">
          <div class="card-title">Percakapan Terbaru</div>
          ${conversations.length === 0 ? '<p style="color:var(--text-muted)">Belum ada percakapan</p>' : `
          ${conversations.slice(0, 6).map(c => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light);">
              <div>
                <div style="font-weight:500;font-size:14px;">${escHtml(c.contact_name || c.contact_jid)}</div>
                <div style="font-size:12px;color:var(--text-secondary);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(c.last_message || '')}</div>
              </div>
              ${c.unread_count > 0 ? `<span class="conv-unread">${c.unread_count}</span>` : ''}
            </div>`).join('')}
          `}
        </div>
      </div>`;
  } catch (e) {
    container.innerHTML = `<p class="text-red">${e.message}</p>`;
  }
}

// ── Socket.IO ─────────────────────────────────────────
function initSocket() {
  const socket = io();

  socket.on('connect', () => {
    console.log('Socket connected');
  });

  socket.on('qr', (data) => {
    SessionsPage.onQR(data);
  });

  socket.on('session:connected', (data) => {
    SessionsPage.onConnected(data);
    toast(`Session terhubung: +${data.phone}`, 'success');
  });

  socket.on('session:disconnected', (data) => {
    SessionsPage.onDisconnected(data);
  });

  socket.on('message:new', (data) => {
    ConversationsPage.onNewMessage(data);
  });

  socket.on('conversation:updated', (data) => {
    ConversationsPage.onConversationUpdated(data);
  });
}

// ── Boot ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
