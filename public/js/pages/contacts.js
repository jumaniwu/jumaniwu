'use strict';

const ContactsPage = (() => {
  async function render(container, setTitle, setActions) {
    setTitle('Kontak');
    setActions('');

    container.innerHTML = `
      <div class="card">
        <div style="display:flex;gap:8px;margin-bottom:16px;">
          <input type="text" id="contact-search" placeholder="Cari nama atau nomor..." style="max-width:300px;"
            oninput="ContactsPage.search(this.value)">
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>Nomor</th>
                <th>Session</th>
                <th>Bergabung</th>
              </tr>
            </thead>
            <tbody id="contacts-tbody">
              <tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Memuat...</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;

    await loadContacts();
  }

  let _sessions = {};
  async function loadContacts(q = '') {
    try {
      const [contacts, sessions] = await Promise.all([
        API.get('/contacts' + (q ? `?q=${encodeURIComponent(q)}` : '')),
        API.get('/sessions'),
      ]);
      sessions.forEach(s => { _sessions[s.id] = s.name; });
      renderTable(contacts);
    } catch (e) {
      const tb = document.getElementById('contacts-tbody');
      if (tb) tb.innerHTML = `<tr><td colspan="4" class="text-red">${e.message}</td></tr>`;
    }
  }

  function renderTable(contacts) {
    const tb = document.getElementById('contacts-tbody');
    if (!tb) return;
    if (!contacts.length) {
      tb.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);">Belum ada kontak</td></tr>`;
      return;
    }
    tb.innerHTML = contacts.map(c => `
      <tr>
        <td>${escHtml(c.name || '-')}</td>
        <td>${escHtml(c.phone || c.jid)}</td>
        <td>${escHtml(_sessions[c.session_id] || c.session_id)}</td>
        <td>${new Date(c.created_at * 1000).toLocaleDateString('id-ID')}</td>
      </tr>`).join('');
  }

  let _searchTimer;
  function search(q) {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => loadContacts(q), 300);
  }

  return { render, search };
})();
