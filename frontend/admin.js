// Admin UI logic (supports archive.org URLs and automatic upload)
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

  const uploadToArchiveCheckbox = document.getElementById('uploadToArchive');
  const archiveFields = document.getElementById('archive-fields');

  uploadToArchiveCheckbox && uploadToArchiveCheckbox.addEventListener('change', (e) => {
    archiveFields.style.display = e.target.checked ? 'block' : 'none';
  });

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
      loginMsg.textContent = 'არასწორი პაროლი';
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
    const audioFile = form.elements['audio'].files[0];
    const coverFile = form.elements['cover'].files[0];
    const uploadToArchive = form.elements['uploadToArchive'].checked;
    const archiveIdentifier = form.elements['archiveIdentifier'] ? form.elements['archiveIdentifier'].value.trim() : '';

    try {
      let res;
      if (uploadToArchive) {
        // require archive identifier and an audio file
        if (!archiveIdentifier) { alert('Укажите identifier для archive.org'); return; }
        if (!audioFile) { alert('Для загрузки на archive.org нужно выбрать аудио-файл'); return; }
        const fd = new FormData();
        fd.append('title', title);
        fd.append('artist', artist);
        fd.append('album', album);
        fd.append('lyrics', lyrics);
        fd.append('archiveIdentifier', archiveIdentifier);
        fd.append('audio', audioFile);
        if (coverFile) fd.append('cover', coverFile);
        res = await fetch('/api/upload-archive', { method: 'POST', body: fd });
      } else {
        // previous logic: if audioFile present -> local upload; else if audioUrl provided earlier (not in this simplified form) use JSON route
        if (audioFile || coverFile) {
          const fd = new FormData();
          fd.append('title', title);
          fd.append('artist', artist);
          fd.append('album', album);
          fd.append('lyrics', lyrics);
          if (audioFile) fd.append('audio', audioFile);
          if (coverFile) fd.append('cover', coverFile);
          res = await fetch('/api/tracks', { method: 'POST', body: fd });
        } else {
          alert('Выберите файл или используйте поля URL (в старой версии).');
          return;
        }
      }

      if (res.ok) {
        alert('ტრეკი დამატებულია');
        addForm.reset();
        archiveFields.style.display = 'none';
        loadAdminData();
      } else {
        const j = await res.json();
        alert('შეცდომა: ' + (j.error || JSON.stringify(j)));
      }
    } catch (err) {
      alert('შეიძლა პრობლემა: ' + err.message);
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
      <h4>Archive.org (optional auto-upload)</h4>
      <label>Identifier (item id): <input id="e-archiveIdentifier" placeholder="cube-mp-2025-album1"></label>
      <div style="margin-top:8px">Or provide external URLs:</div>
      <input id="e-audioUrl" placeholder="https://archive.org/download/.../file.mp3" value="${escapeHtml(track.audioUrl || '')}">
      <input id="e-coverUrl" placeholder="https://archive.org/download/.../cover.jpg" value="${escapeHtml(track.coverUrl || '')}">
      <div style="margin-top:8px">Or upload files:</div>
      <label>აუდიო (upload): <input id="e-audio" type="file" accept=".mp3,.wav,.flac"></label>
      <label>ობლო (upload): <input id="e-cover" type="file" accept=".jpg,.jpeg,.png"></label>
      <button id="e-upload-archive">Upload files to archive.org & save</button>
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

      try {
        const payload = {};
        if (title) payload.title = title;
        if (artist) payload.artist = artist;
        if (lyrics) payload.lyrics = lyrics;
        if (album) payload.album = album;
        if (audioUrl) payload.audioUrl = audioUrl;
        if (coverUrl) payload.coverUrl = coverUrl;
        const res = await fetch(`/api/tracks/${track.id}/json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (res.ok) {
          alert('შენახულია');
          dlg.remove();
          loadAdminData();
        } else {
          alert('შეცდომა შენახვის დროს');
        }
      } catch (err) {
        alert('შესაძლო პრობლემაა: ' + err.message);
      }
    });

    // Upload files to archive.org and save
    dlg.querySelector('#e-upload-archive').addEventListener('click', async () => {
      const archiveIdentifier = dlg.querySelector('#e-archiveIdentifier').value.trim();
      const audioFile = dlg.querySelector('#e-audio').files[0];
      const coverFile = dlg.querySelector('#e-cover').files[0];
      if (!archiveIdentifier) { alert('Укажите identifier для archive.org'); return; }
      if (!audioFile) { alert('Выберите аудио для загрузки'); return; }
      const fd = new FormData();
      fd.append('title', dlg.querySelector('#e-title').value);
      fd.append('artist', dlg.querySelector('#e-artist').value);
      fd.append('album', dlg.querySelector('#e-album').value);
      fd.append('lyrics', dlg.querySelector('#e-lyrics').value);
      fd.append('archiveIdentifier', archiveIdentifier);
      fd.append('audio', audioFile);
      if (coverFile) fd.append('cover', coverFile);
      const res = await fetch(`/api/upload-archive`, { method: 'POST', body: fd });
      if (res.ok) {
        alert('Uploaded and saved');
        dlg.remove();
        loadAdminData();
      } else {
        const j = await res.json();
        alert('Error: ' + (j.error || JSON.stringify(j)));
      }
    });
  }

  function escapeHtml(s){ return (s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

})();
