'use strict';

const KnowledgePage = (() => {
  let _sessionId = null;

  async function render(container, setTitle, setActions) {
    setTitle('Knowledge Base');
    setActions('');

    try {
      const sessions = await API.get('/sessions');
      if (!sessions.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📱</div><h3>Buat session dulu</h3><p>Knowledge base terhubung dengan session WhatsApp</p></div>`;
        return;
      }

      _sessionId = _sessionId || sessions[0].id;

      const sessionOptions = sessions.map(s =>
        `<option value="${s.id}" ${s.id === _sessionId ? 'selected' : ''}>${escHtml(s.name)}</option>`
      ).join('');

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <label style="margin:0;white-space:nowrap;">Session:</label>
            <select id="kb-session-select" onchange="KnowledgePage.switchSession(this.value)" style="width:200px;">
              ${sessionOptions}
            </select>
          </div>
          <button class="btn btn-primary" onclick="KnowledgePage.showAddModal()">+ Tambah Knowledge</button>
        </div>
        <div id="knowledge-list">Memuat...</div>`;

      await loadKnowledge();
    } catch (e) {
      container.innerHTML = `<p class="text-red">${e.message}</p>`;
    }
  }

  async function loadKnowledge() {
    if (!_sessionId) return;
    try {
      const entries = await API.get(`/knowledge?session_id=${_sessionId}`);
      renderList(entries);
    } catch (e) {
      const el = document.getElementById('knowledge-list');
      if (el) el.innerHTML = `<p class="text-red">${e.message}</p>`;
    }
  }

  function renderList(entries) {
    const el = document.getElementById('knowledge-list');
    if (!el) return;
    if (!entries.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧠</div>
          <h3>Belum ada knowledge</h3>
          <p>Tambahkan informasi bisnis agar AI bisa menjawab lebih tepat</p>
        </div>`;
      return;
    }
    el.innerHTML = entries.map(e => `
      <div class="knowledge-item">
        <div class="knowledge-item-header">
          <div class="knowledge-title">${escHtml(e.title)}</div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="KnowledgePage.showEditModal(${e.id}, ${JSON.stringify(escHtml(e.title))}, ${JSON.stringify(escHtml(e.content))})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="KnowledgePage.remove(${e.id})">Hapus</button>
          </div>
        </div>
        <div class="knowledge-content">${escHtml(e.content)}</div>
      </div>`).join('');
  }

  function switchSession(id) {
    _sessionId = id;
    loadKnowledge();
  }

  function showAddModal() {
    showModal(`
      <div class="modal">
        <div class="modal-title">Tambah Knowledge</div>
        <div class="form-group">
          <label>Judul</label>
          <input type="text" id="kb-title" placeholder="Contoh: Produk yang dijual">
        </div>
        <div class="form-group">
          <label>Konten</label>
          <textarea id="kb-content" rows="6" placeholder="Tuliskan informasi bisnis, produk, layanan, FAQ, dll..."></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="KnowledgePage.create()">Simpan</button>
        </div>
      </div>`);
    setTimeout(() => document.getElementById('kb-title')?.focus(), 50);
  }

  function showEditModal(id, title, content) {
    showModal(`
      <div class="modal">
        <div class="modal-title">Edit Knowledge</div>
        <div class="form-group">
          <label>Judul</label>
          <input type="text" id="kb-edit-title" value="${title}">
        </div>
        <div class="form-group">
          <label>Konten</label>
          <textarea id="kb-edit-content" rows="6">${content}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="closeModal()">Batal</button>
          <button class="btn btn-primary" onclick="KnowledgePage.update(${id})">Simpan</button>
        </div>
      </div>`);
  }

  async function create() {
    const title = document.getElementById('kb-title')?.value?.trim();
    const content = document.getElementById('kb-content')?.value?.trim();
    if (!title || !content) return toast('Judul dan konten harus diisi', 'error');
    try {
      await API.post('/knowledge', { session_id: _sessionId, title, content });
      closeModal();
      toast('Knowledge berhasil ditambahkan', 'success');
      loadKnowledge();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function update(id) {
    const title = document.getElementById('kb-edit-title')?.value?.trim();
    const content = document.getElementById('kb-edit-content')?.value?.trim();
    if (!title || !content) return toast('Judul dan konten harus diisi', 'error');
    try {
      await API.put(`/knowledge/${id}`, { title, content });
      closeModal();
      toast('Knowledge diperbarui', 'success');
      loadKnowledge();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function remove(id) {
    if (!confirm('Hapus knowledge ini?')) return;
    try {
      await API.del(`/knowledge/${id}`);
      toast('Knowledge dihapus', 'success');
      loadKnowledge();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return { render, switchSession, showAddModal, showEditModal, create, update, remove };
})();
