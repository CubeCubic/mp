// Admin UI logic (simplified: no auto-upload to archive.org)
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

    // read fields
    const form = e.currentTarget;
    const title = form.elements['title'].value;
    const artist = form.elements['artist'].value;
    const album = form.elements['album'].value;
    const lyrics = form.elements['lyrics'].value;
    const audioUrl = form.elements['audioUrl'].value.trim();
    const coverUrl = form.elements['coverUrl'].value.trim();
    const audioFile = form.elements['audio'].files[0];
    const coverFile = form.elements['cover'].files[0];

    try {
      let res;
      if (audioFile || coverFile) {
        // If user uploaded a file, use FormData and local upload route
        const fd = new FormData();
        fd.append('title', title);
        fd.append('artist', artist);
        fd.append('album', album);
        fd.append('lyrics', lyrics);
        if (audioFile) fd.append('audio', audioFile);
        if (coverFile) fd.append('cover', coverFile);
        res = await fetch('/api/tracks', { method: 'POST', body: fd });
      } else if (audioUrl) {
        // Use external URLs (JSON route)
        const payload = { title, artist, album, lyrics, audioUrl, coverUrl };
        res = await fetch('/api/tracks/json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        alert('Выберите файл или укажите Audio URL.');
        return;
      }

      if (res.ok) {
        alert('ტრეკი დამატებულია');
        addForm.reset();
        loadAdminData();
      } else {
        const j = await res.json();
        alert('შეცდომა: ' + (j.error || JSON.stringify(j)));
      }
    } catch (err) {
      alert('შესაძლოა პრობლემაა: ' + err.message);
    }
  });

  async function loadAdminData() {
    const tracks = await (await fetch('/api/tracks')).json();
    adminTracks.innerHTML = '';
    tracks.forEach(t => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        ${t.coverUrl ? `<img src="${t.coverUrl}">` : (t.cover ? `<img src="/uploads/${t.cover}">` : '')}
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
      <div style="margin-top:8px">External URLs (optional):</div>
      <input id="e-audioUrl" placeholder="https://.../file.mp3" value="${escapeHtml(track.audioUrl || '')}">
      <input id="e-coverUrl" placeholder="https://.../cover.jpg" value="${escapeHtml(track.coverUrl || '')}">
      <div style="margin-top:8px">Or upload files:</div>
      <label>აუდიო (upload): <input id="e-audio" type="file" accept=".mp3,.wav,.flac"></label>
      <label>ობლო (upload): <input id="e-cover" type="file" accept=".jpg,.jpeg,.png"></label>
      <button id="e-save">შენახვა</button>
      <button id="e-cancel">გაუქმება</button>
    `;
    adminTracks.prepend(dlg);
    dlg.querySelector('#e-cancel').addEventListener('click', () => dlg.remove());
    dlg.querySelector('#e-save').addEventListener('click', async () => {
      const title = dlg.querySelector('#e-title').value;
      const artist = dlg.querySelector('#e-artist').value;
      const lyrics = dlg.querySelector('#e-lyrics').value;
      const album = dlg.querySelector('#e-album').value;
      const audioUrl = dlg.querySelector('#e-audioUrl').value.trim();
      const coverUrl = dlg.querySelector('#e-coverUrl').value.trim();
      const audioFile = dlg.querySelector('#e-audio').files[0];
      const coverFile = dlg.querySelector('#e-cover').files[0];

      try {
        let res;
        if (audioFile || coverFile) {
          const fd = new FormData();
          if (title) fd.append('title', title);
          if (artist) fd.append('artist', artist);
          if (lyrics) fd.append('lyrics', lyrics);
          if (album) fd.append('album', album);
          if (audioFile) fd.append('audio', audioFile);
          if (coverFile) fd.append('cover', coverFile);
          res = await fetch(`/api/tracks/${track.id}`, { method: 'PUT', body: fd });
        } else {
          // update via JSON (external URLs)
          const payload = {};
          if (title) payload.title = title;
          if (artist) payload.artist = artist;
          if (lyrics) payload.lyrics = lyrics;
          if (album) payload.album = album;
          if (audioUrl) payload.audioUrl = audioUrl;
          if (coverUrl) payload.coverUrl = coverUrl;
          res = await fetch(`/api/tracks/${track.id}/json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        }

        if (res.ok) {
          alert('შენახულია');
          dlg.remove();
          loadAdminData();
        } else {
          alert('შეცდომა შენახვის დროს');
        }
      } catch (err) {
        alert('შეიძლა პრობლემა: ' + err.message);
      }
    });
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

})();
