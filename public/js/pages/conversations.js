'use strict';

const ConversationsPage = (() => {
  let _activeConvId = null;
  let _allConvs = [];

  function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts * 1000);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  }

  function initials(name) {
    return (name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  function convItemHtml(c) {
    return `
    <div class="conv-item ${c.id === _activeConvId ? 'active' : ''}"
         id="conv-item-${c.id}" onclick="ConversationsPage.openConv('${c.id}')">
      <div class="conv-avatar">${initials(c.contact_name || c.contact_jid)}</div>
      <div class="conv-info">
        <div class="conv-name">${escHtml(c.contact_name || c.contact_jid)}</div>
        <div class="conv-last">${escHtml(c.last_message || '')}</div>
      </div>
      <div class="conv-meta">
        <div class="conv-time">${formatTime(c.last_message_at)}</div>
        ${c.unread_count > 0 ? `<div class="conv-unread">${c.unread_count}</div>` : ''}
      </div>
    </div>`;
  }

  function msgBubbleHtml(m) {
    const roleLabel = m.role === 'assistant' ? '🤖 AI' : m.role === 'human_agent' ? '👤 Agen' : '';
    return `
    <div class="msg-bubble ${m.role}" id="msg-${m.id}">
      ${m.role !== 'user' ? `<div style="font-size:11px;margin-bottom:3px;opacity:0.7;">${roleLabel}</div>` : ''}
      <div>${escHtml(m.content)}</div>
      <div class="msg-time">${formatTime(m.timestamp)}</div>
    </div>`;
  }

  async function render(container, setTitle, setActions) {
    setTitle('Percakapan');
    setActions('');

    container.style.padding = '0';
    container.style.overflow = 'hidden';
    container.style.height = '100%';

    container.innerHTML = `
      <div class="chat-layout">
        <div class="conversation-list">
          <div class="conversation-list-header">
            <span style="font-weight:600;">Inbox</span>
          </div>
          <div class="conversation-list-search">
            <input type="text" id="conv-search" placeholder="Cari percakapan..." oninput="ConversationsPage.filterConvs(this.value)">
          </div>
          <div class="conversation-list-items" id="conv-list-items">
            <div class="empty-state"><div class="empty-icon">💬</div><p>Belum ada percakapan</p></div>
          </div>
        </div>
        <div class="chat-window" id="chat-window">
          <div class="empty-state" style="flex:1;justify-content:center;">
            <div class="empty-icon">👈</div>
            <h3>Pilih percakapan</h3>
            <p>Klik percakapan di sebelah kiri</p>
          </div>
        </div>
      </div>`;

    await loadConvList();
  }

  async function loadConvList() {
    try {
      _allConvs = await API.get('/conversations');
      renderConvList(_allConvs);
    } catch (e) {
      console.error(e);
    }
  }

  function renderConvList(convs) {
    const el = document.getElementById('conv-list-items');
    if (!el) return;
    if (!convs.length) {
      el.innerHTML = `<div class="empty-state"><div class="empty-icon">💬</div><p>Belum ada percakapan</p></div>`;
      return;
    }
    el.innerHTML = convs.map(convItemHtml).join('');
  }

  function filterConvs(q) {
    const filtered = _allConvs.filter(c =>
      (c.contact_name || c.contact_jid || '').toLowerCase().includes(q.toLowerCase())
    );
    renderConvList(filtered);
  }

  async function openConv(id) {
    _activeConvId = id;
    // Highlight selected
    document.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`conv-item-${id}`)?.classList.add('active');

    const conv = _allConvs.find(c => c.id === id) || await API.get(`/conversations`).then(cs => cs.find(c => c.id === id));
    if (!conv) return;

    const win = document.getElementById('chat-window');
    if (!win) return;

    const aiOn = conv.ai_enabled === 1;
    win.innerHTML = `
      <div class="chat-header">
        <div class="chat-contact-info">
          <div class="conv-avatar" style="width:36px;height:36px;font-size:14px;">${initials(conv.contact_name)}</div>
          <div>
            <div class="chat-contact-name">${escHtml(conv.contact_name || conv.contact_jid)}</div>
            <div class="chat-contact-status">${conv.contact_jid}</div>
          </div>
        </div>
        <div class="chat-actions">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;color:var(--text-secondary);">AI</span>
            <label class="toggle">
              <input type="checkbox" id="ai-toggle-${id}" ${aiOn ? 'checked' : ''}
                onchange="ConversationsPage.toggleHandoff('${id}', this)">
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>
      <div class="chat-messages" id="chat-messages-${id}">
        <div style="text-align:center;color:var(--text-muted);font-size:12px;padding:8px;">Memuat pesan...</div>
      </div>
      <div class="chat-input-area">
        <textarea id="chat-input-${id}" placeholder="Ketik pesan..." rows="1"
          onkeydown="ConversationsPage.handleKey(event, '${id}')"></textarea>
        <button class="btn btn-primary" onclick="ConversationsPage.sendMessage('${id}')">Kirim</button>
      </div>`;

    // Load messages
    try {
      const msgs = await API.get(`/conversations/${id}/messages`);
      const msgsEl = document.getElementById(`chat-messages-${id}`);
      if (msgsEl) {
        msgsEl.innerHTML = msgs.length ? msgs.map(msgBubbleHtml).join('') : '<div style="text-align:center;color:var(--text-muted);font-size:12px;">Belum ada pesan</div>';
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }
      // Update unread in list
      const listItem = document.getElementById(`conv-item-${id}`);
      if (listItem) {
        const badge = listItem.querySelector('.conv-unread');
        if (badge) badge.remove();
      }
      // Update local data
      const c = _allConvs.find(x => x.id === id);
      if (c) c.unread_count = 0;
    } catch (e) {
      console.error(e);
    }
  }

  async function toggleHandoff(id, checkbox) {
    try {
      const res = await API.post(`/conversations/${id}/handoff`, { enabled: checkbox.checked });
      toast(res.ai_enabled ? 'AI diaktifkan untuk percakapan ini' : 'Mode human handoff aktif', 'success');
      const c = _allConvs.find(x => x.id === id);
      if (c) c.ai_enabled = res.ai_enabled;
    } catch (e) {
      checkbox.checked = !checkbox.checked;
      toast(e.message, 'error');
    }
  }

  async function sendMessage(convId) {
    const input = document.getElementById(`chat-input-${convId}`);
    const text = input?.value?.trim();
    if (!text) return;
    input.value = '';
    try {
      await API.post('/messages/send', { conversation_id: convId, text });
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function handleKey(event, convId) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage(convId);
    }
  }

  // Socket.IO handlers
  function onNewMessage({ conversationId, message }) {
    // Append to open chat
    const msgsEl = document.getElementById(`chat-messages-${conversationId}`);
    if (msgsEl) {
      // Remove "no messages" placeholder
      const placeholder = msgsEl.querySelector('[style*="color:var(--text-muted)"]');
      if (placeholder) placeholder.remove();

      msgsEl.insertAdjacentHTML('beforeend', msgBubbleHtml(message));
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
  }

  function onConversationUpdated({ conversation }) {
    const idx = _allConvs.findIndex(c => c.id === conversation.id);
    if (idx >= 0) _allConvs[idx] = conversation;
    else _allConvs.unshift(conversation);

    // Sort by last message
    _allConvs.sort((a, b) => (b.last_message_at || 0) - (a.last_message_at || 0));

    // Update the list item
    const existing = document.getElementById(`conv-item-${conversation.id}`);
    if (existing) {
      existing.outerHTML = convItemHtml(conversation);
    } else {
      const listEl = document.getElementById('conv-list-items');
      if (listEl) listEl.insertAdjacentHTML('afterbegin', convItemHtml(conversation));
    }

    // Update nav badge
    const totalUnread = _allConvs.reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const navBadge = document.getElementById('nav-unread-badge');
    if (navBadge) {
      navBadge.textContent = totalUnread;
      navBadge.classList.toggle('hidden', totalUnread === 0);
    }
  }

  return { render, filterConvs, openConv, toggleHandoff, sendMessage, handleKey, onNewMessage, onConversationUpdated };
})();
