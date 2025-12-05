// Admin UI logic
(async function() {
  if (!document.getElementById('admin-app')) return;
  const loginForm = document.getElementById('login-form');
  const adminPanel = document.getElementById('admin-panel');
  const loginBtn = document.getElementById('login-btn');
  const loginMsg = document.getElementById('login-msg');
  const passwordInput = document.getElementById('admin-password');

  const addForm = document.getElementById('add-track-form');
  const adminTracks = document.getElementById('admin-tracks');
  const logoutBtn = document.getElementById('logout-btn');

  async function checkAuth() {
    // We don't have endpoint to check session; attempt to fetch tracks for admin operations will return 401 if not authed.
    // Try to list albums (public) and show login anyway.
  }

  loginBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      loginForm.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      loadAdminData();
    } else {
      loginMsg.textContent = 'პაროლი არასწორია';
    }
  });

  logoutBtn.addEventListener('click', async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    adminPanel.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const res = await fetch('/api/tracks', { method: 'POST', body: fd });
    if (res.ok) {
      alert('ტრეკი დამატებულია');
      addForm.reset();
      loadAdminData();
    } else {
      const j = await res.json();
      alert('საფუძველი: ' + (j.error || 'unknown'));
    }
  });

  async function loadAdminData() {
    const tracks = await (await fetch('/api/tracks')).json();
    adminTracks.innerHTML = '';
    tracks.forEach(t => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        ${t.cover ? `<img src="/uploads/${t.cover}">` : ''}
        <h4>${escapeHtml(t.title)}</h4>
        <div>${escapeHtml(t.artist || '')}</div>
        <div>
          <button data-edit="${t.id}">რედაქტირება</button>
          <button data-delete="${t.id}">წაშლა</button>
        </div>
      `;
      el.querySelector('[data-delete]') && el.querySelector('[data-delete]').addEventListener('click', async () => {
        if (!confirm('ნამდვილად წაშლა?')) return;
        const res = await fetch(`/api/tracks/${t.id}`, { method: 'DELETE' });
        if (res.ok) loadAdminData();
        else alert('შეცდომა');
      });
      el.querySelector('[data-edit]') && el.querySelector('[data-edit]').addEventListener('click', () => {
        openEditDialog(t);
      });
      adminTracks.appendChild(el);
    });
  }

  function openEditDialog(track) {
    const dlg = document.createElement('div');
    dlg.className = 'card';
    dlg.innerHTML = `
      <h3>რედაქტირება</h3>
      <input id="e-title" value="${escapeHtml(track.title)}">
      <input id="e-artist" value="${escapeHtml(track.artist || '')}">
      <input id="e-album" placeholder="ალბომი">
      <textarea id="e-lyrics">${escapeHtml(track.lyrics || '')}</textarea>
      <label>აუდიო (გაჩუქება): <input id="e-audio" type="file" accept=".mp3,.wav,.flac"></label>
      <label>ობლო (გაჩუქება): <input id="e-cover" type="file" accept=".jpg,.jpeg,.png"></label>
      <button id="e-save">შენახვა</button>
      <button id="e-cancel">გაუქმება</button>
    `;
    adminTracks.prepend(dlg);
    dlg.querySelector('#e-cancel').addEventListener('click', () => dlg.remove());
    dlg.querySelector('#e-save').addEventListener('click', async () => {
      const fd = new FormData();
      fd.append('title', dlg.querySelector('#e-title').value);
      fd.append('artist', dlg.querySelector('#e-artist').value);
      fd.append('lyrics', dlg.querySelector('#e-lyrics').value);
      const albumVal = dlg.querySelector('#e-album').value;
      if (albumVal) fd.append('album', albumVal);
      const audioFile = dlg.querySelector('#e-audio').files[0];
      const coverFile = dlg.querySelector('#e-cover').files[0];
      if (audioFile) fd.append('audio', audioFile);
      if (coverFile) fd.append('cover', coverFile);
      const res = await fetch(`/api/tracks/${track.id}`, { method: 'PUT', body: fd });
      if (res.ok) {
        alert('შენახულია');
        dlg.remove();
        loadAdminData();
      } else {
        alert('შეცდომა შენახვის დროს');
      }
    });
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

})();
