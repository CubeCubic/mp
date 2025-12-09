// admin.js — показываем панель только после явного логина, корректная отправка parentId,
// и безопасное поведение при загрузке страницы
(function () {
  // Если это не страница админки — выходим
  if (!document.getElementById('admin-app')) return;

  // Элементы
  const loginForm = document.getElementById('login-form');
  const adminPanel = document.getElementById('admin-panel');
  const loginBtn = document.getElementById('login-btn');
  const loginMsg = document.getElementById('login-msg');
  const passwordInput = document.getElementById('admin-password');

  const addForm = document.getElementById('add-track-form');
  const adminTracks = document.getElementById('admin-tracks');
  const logoutBtn = document.getElementById('logout-btn');

  const albumName = document.getElementById('album-name');
  const albumParent = document.getElementById('album-parent');
  const btnCreateAlbum = document.getElementById('btn-create-album');
  const btnRefreshAlbums = document.getElementById('btn-refresh-albums');
  const albumsList = document.getElementById('albums-list');

  const trackAlbumSelect = document.getElementById('track-album-select');
  const btnRefreshTracks = document.getElementById('btn-refresh-tracks');

  const albumEditModal = document.getElementById('album-edit-modal');
  const modalAlbumName = document.getElementById('modal-album-name');
  const modalAlbumParent = document.getElementById('modal-album-parent');
  const modalSaveBtn = document.getElementById('modal-save');
  const modalCancelBtn = document.getElementById('modal-cancel');

  // Состояние
  let albums = [];
  let tracks = [];
  let albumBeingEdited = null;
  let loggedIn = false;

  // Утилиты
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c === null || c === undefined) return;
      if (typeof c === 'string') e.appendChild(document.createTextNode(c));
      else e.appendChild(c);
    });
    return e;
  }
  function escapeHtml(s){ return (s||'').toString().replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

  function getAdminCoverUrl(t) {
    const fallback = '/images/midcube.png';
    if (!t) return fallback;
    if (t.coverUrl) return t.coverUrl;
    if (t.cover) return '/uploads/' + t.cover;
    return fallback;
  }

  // --- Работа с альбомами: построение дерева для селектов ---
  function buildTreeOptions(selectEl, includeEmpty = true, excludeIds = []) {
    if (!selectEl) return;
    selectEl.innerHTML = '';
    if (includeEmpty) selectEl.appendChild(el('option', { value: '' }, '— none —'));

    const map = {};
    albums.forEach(a => map[a.id] = { ...a, children: [] });
    const roots = [];
    albums.forEach(a => {
      if (a.parentId) {
        if (map[a.parentId]) map[a.parentId].children.push(map[a.id]);
        else roots.push(map[a.id]);
      } else roots.push(map[a.id]);
    });

    function appendNode(node, depth = 0) {
      if (excludeIds && excludeIds.includes(node.id)) return;
      const prefix = depth === 0 ? '' : '— '.repeat(depth);
      const opt = el('option', { value: node.id }, `${prefix}${node.name}`);
      selectEl.appendChild(opt);
      if (node.children && node.children.length) {
        node.children.sort((x,y) => x.name.localeCompare(y.name));
        node.children.forEach(c => appendNode(c, depth + 1));
      }
    }

    roots.sort((a,b) => a.name.localeCompare(b.name));
    roots.forEach(r => appendNode(r, 0));
  }

  // --- Fetch helpers ---
  async function fetchAlbums() {
    const res = await fetch('/api/albums');
    if (!res.ok) throw new Error('albums fetch failed');
    albums = await res.json();
    return albums;
  }
  async function fetchTracks() {
    const res = await fetch('/api/tracks');
    if (!res.ok) throw new Error('tracks fetch failed');
    tracks = await res.json();
    return tracks;
  }

  // --- Descendants helper для исключения циклов при выборе parent ---
  function getDescendantIds(rootId) {
    const map = {};
    albums.forEach(a => map[a.id] = { ...a, children: [] });
    albums.forEach(a => {
      if (a.parentId && map[a.parentId]) map[a.parentId].children.push(map[a.id]);
    });
    const result = [];
    function dfs(node) {
      if (!node) return;
      result.push(node.id);
      if (node.children) node.children.forEach(c => dfs(c));
    }
    if (map[rootId]) map[rootId].children.forEach(c => dfs(c));
    return result;
  }

  // --- Рендер списка альбомов (иерархия) ---
  function renderAlbumsList() {
    if (!albumsList) return;
    albumsList.innerHTML = '';
    const map = {};
    albums.forEach(a => map[a.id] = { ...a, children: [] });
    const roots = [];
    albums.forEach(a => {
      if (a.parentId) {
        if (map[a.parentId]) map[a.parentId].children.push(map[a.id]);
        else roots.push(map[a.id]);
      } else roots.push(map[a.id]);
    });

    function renderNode(node, depth = 0) {
      const item = el('div', { class: 'item' });
      const meta = el('div', { class: 'meta' });
      const title = el('div', { class: depth ? 'indent' : '' }, el('strong', {}, `${'— '.repeat(depth)}${escapeHtml(node.name)}`));
      const info = el('div', { class: 'muted' }, `id: ${node.id}`);
      meta.appendChild(title);
      meta.appendChild(info);

      const actions = el('div', {});
      const btnEdit = el('button', {}, 'Edit');
      const btnDelete = el('button', {}, 'Delete');
      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);

      btnEdit.addEventListener('click', () => openEditAlbumModal(node));
      btnDelete.addEventListener('click', async () => {
        if (!confirm('Delete album?')) return;
        const r = await fetch(`/api/albums/${node.id}`, { method: 'DELETE' });
        if (r.ok) { await refreshAlbums(); await refreshTracks(); }
        else alert('Delete failed');
      });

      item.appendChild(meta);
      item.appendChild(actions);
      albumsList.appendChild(item);

      if (node.children && node.children.length) {
        node.children.sort((a,b) => a.name.localeCompare(b.name));
        node.children.forEach(c => renderNode(c, depth + 1));
      }
    }

    roots.sort((a,b) => a.name.localeCompare(b.name));
    roots.forEach(r => renderNode(r, 0));
  }

  // --- Модал редактирования альбома ---
  function openEditAlbumModal(node) {
    if (!albumEditModal || !modalAlbumName || !modalAlbumParent) {
      // fallback to prompt if modal not present
      const newName = prompt('New album name', node.name);
      if (newName === null) return;
      const parentName = prompt('Parent album name (leave empty for main album)', node.parentId ? (albums.find(a => a.id === node.parentId) || {}).name : '');
      let parentId = null;
      if (parentName && parentName.trim()) {
        const found = albums.find(a => a.name === parentName.trim());
        if (!found) { alert('Parent not found'); return; }
        parentId = found.id;
        if (parentId === node.id) { alert('Cannot set self as parent'); return; }
      }
      fetch(`/api/albums/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), parentId: parentId || null })
      }).then(r => {
        if (!r.ok) throw new Error('update failed');
        return r.json();
      }).then(() => refreshAlbums()).catch(() => alert('Update failed'));
      return;
    }

    albumBeingEdited = node;
    modalAlbumName.value = node.name || '';

    const descendants = getDescendantIds(node.id);
    const exclude = [node.id, ...descendants];
    buildTreeOptions(modalAlbumParent, true, exclude);
    modalAlbumParent.value = node.parentId || '';

    albumEditModal.style.display = 'flex';
    albumEditModal.setAttribute('aria-hidden', 'false');
    albumEditModal.classList.remove('hidden');
    setTimeout(() => { try { modalAlbumName.focus(); } catch (e) {} }, 0);
  }

  function closeAlbumModal() {
    albumBeingEdited = null;
    if (!albumEditModal) return;
    albumEditModal.style.display = 'none';
    albumEditModal.classList.add('hidden');
    albumEditModal.setAttribute('aria-hidden', 'true');
  }

  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', async () => {
      if (!albumBeingEdited) return closeAlbumModal();
      const newName = (modalAlbumName.value || '').trim();
      const newParent = modalAlbumParent.value || null;
      if (!newName) return alert('Enter album name');
      if (newParent === albumBeingEdited.id) return alert('Invalid parent');
      try {
        const res = await fetch(`/api/albums/${albumBeingEdited.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, parentId: newParent || null })
        });
        if (!res.ok) throw new Error('update failed');
        await refreshAlbums();
        closeAlbumModal();
      } catch (err) {
        alert('Update failed');
      }
    });
  }
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => closeAlbumModal());
  if (albumEditModal) {
    albumEditModal.addEventListener('click', (e) => { if (e.target === albumEditModal) closeAlbumModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAlbumModal(); });
  }

  // --- Создание альбома: отправляем parentId только если выбран ---
  if (btnCreateAlbum) {
    btnCreateAlbum.addEventListener('click', async () => {
      const name = (albumName.value || '').trim();
      const parentVal = albumParent ? albumParent.value : '';
      if (!name) return alert('Enter album name');

      const payload = { name };
      if (parentVal !== undefined && parentVal !== null && parentVal !== '') {
        const maybeNum = Number(parentVal);
        payload.parentId = Number.isNaN(maybeNum) ? parentVal : maybeNum;
      }

      try {
        const res = await fetch('/api/albums', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.status === 409) {
          const j = await res.json().catch(()=>({}));
          alert('Album exists: ' + (j.album && j.album.name));
          return;
        }
        if (!res.ok) throw new Error('create failed');
        albumName.value = '';
        await refreshAlbums();
      } catch (err) {
        alert('Create album error');
      }
    });
  }

  // --- Создание/загрузка трека ---
  if (addForm) {
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const title = form.elements['title'].value || 'Untitled';
      const artist = form.elements['artist'].value || '';
      const lyrics = form.elements['lyrics'].value || '';
      const albumId = form.elements['album'] ? form.elements['album'].value : '';
      const audioUrl = form.elements['audioUrl'] ? form.elements['audioUrl'].value.trim() : '';
      const coverUrl = form.elements['coverUrl'] ? form.elements['coverUrl'].value.trim() : '';
      const audioFile = form.elements['audio'].files[0];
      const coverFile = form.elements['cover'].files[0];

      try {
        let res;
        if (audioFile || coverFile) {
          const fd = new FormData();
          fd.append('title', title);
          fd.append('artist', artist);
          fd.append('lyrics', lyrics);
          if (albumId) fd.append('album', albumId);
          if (audioFile) fd.append('audio', audioFile);
          if (coverFile) fd.append('cover', coverFile);
          res = await fetch('/api/tracks', { method: 'POST', body: fd });
        } else if (audioUrl) {
          const payload = { title, artist, lyrics, album: albumId || '', audioUrl, coverUrl };
          res = await fetch('/api/tracks/json', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        } else {
          alert('Choose file or provide Audio URL');
          return;
        }

        if (res.ok) {
          alert('Track added');
          form.reset();
          await refreshTracks();
        } else {
          const j = await res.json().catch(()=>({}));
          alert('Error: ' + (j.error || JSON.stringify(j)));
        }
      } catch (err) {
        alert('Upload error: ' + err.message);
      }
    });
  }

  // --- Рендер треков в админке ---
  function renderTracks() {
    if (!adminTracks) return;
    adminTracks.innerHTML = '';
    if (!tracks.length) { adminTracks.innerHTML = '<div class="muted">No tracks</div>'; return; }
    tracks.forEach(t => {
      const item = el('div', { class: 'item' });
      const meta = el('div', { class: 'meta' });

      const img = el('img', { src: getAdminCoverUrl(t), alt: t.title || '' });
      img.style.width = '80px';
      img.style.height = '80px';
      img.style.objectFit = 'cover';
      img.style.marginRight = '8px';

      const title = el('div', {}, el('strong', {}, escapeHtml(t.title || 'Untitled')));
      const artist = el('div', { class: 'muted' }, escapeHtml(t.artist || ''));
      const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '(no album)';
      const info = el('div', { class: 'muted' }, `album: ${escapeHtml(albumName)} • likes: ${t.likes || 0}`);

      meta.appendChild(img);
      meta.appendChild(title);
      meta.appendChild(artist);
      meta.appendChild(info);

      const actions = el('div', {});
      const btnEdit = el('button', {}, 'Edit');
      const btnDelete = el('button', {}, 'Delete');
      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);

      btnEdit.addEventListener('click', () => openEditDialog(t));
      btnDelete.addEventListener('click', async () => {
        if (!confirm('Delete track?')) return;
        const r = await fetch(`/api/tracks/${t.id}`, { method: 'DELETE' });
        if (r.ok) { await refreshTracks(); } else alert('Delete failed');
      });

      item.appendChild(meta);
      item.appendChild(actions);
      adminTracks.appendChild(item);
    });
  }

  // --- Редактирование трека (диалог) ---
  function openEditDialog(track) {
    const dlg = el('div', { class: 'panel' });
    const titleInput = el('input', { type: 'text', value: track.title || '' });
    const artistInput = el('input', { type: 'text', value: track.artist || '' });
    const albumSelect = el('select');
    const lyricsInput = el('textarea', {}, track.lyrics || '');
    const audioUrlInput = el('input', { type: 'text', value: track.audioUrl || '' });
    const coverUrlInput = el('input', { type: 'text', value: track.coverUrl || '' });
    const audioFileInput = el('input', { type: 'file' });
    audioFileInput.accept = '.mp3,.wav,.flac';
    const coverFileInput = el('input', { type: 'file' });
    coverFileInput.accept = '.jpg,.jpeg,.png';

    buildTreeOptions(albumSelect, true);
    if (track.albumId) albumSelect.value = track.albumId;

    dlg.appendChild(el('h3', {}, 'Edit track'));
    dlg.appendChild(el('label', {}, 'Title')); dlg.appendChild(titleInput);
    dlg.appendChild(el('label', {}, 'Artist')); dlg.appendChild(artistInput);
    dlg.appendChild(el('label', {}, 'Album / Subalbum')); dlg.appendChild(albumSelect);
    dlg.appendChild(el('label', {}, 'Lyrics')); dlg.appendChild(lyricsInput);
    dlg.appendChild(el('label', {}, 'Audio URL (optional)')); dlg.appendChild(audioUrlInput);
    dlg.appendChild(el('label', {}, 'Cover URL (optional)')); dlg.appendChild(coverUrlInput);
    dlg.appendChild(el('div', {}, 'Or upload files:'));
    dlg.appendChild(el('label', {}, ['Audio: ', audioFileInput]));
    dlg.appendChild(el('label', {}, ['Cover: ', coverFileInput]));

    const saveBtn = el('button', {}, 'Save');
    const cancelBtn = el('button', {}, 'Cancel');
    const actions = el('div', {}, [saveBtn, cancelBtn]);
    actions.style.marginTop = '8px';
    dlg.appendChild(actions);

    adminTracks.prepend(dlg);

    cancelBtn.addEventListener('click', () => dlg.remove());

    saveBtn.addEventListener('click', async () => {
      const newTitle = titleInput.value.trim();
      const newArtist = artistInput.value.trim();
      const newLyrics = lyricsInput.value;
      const newAlbumId = albumSelect.value || '';
      const newAudioUrl = audioUrlInput.value.trim();
      const newCoverUrl = coverUrlInput.value.trim();
      const newAudioFile = audioFileInput.files[0];
      const newCoverFile = coverFileInput.files[0];

      try {
        let res;
        if (newAudioFile || newCoverFile) {
          const fd = new FormData();
          if (newTitle) fd.append('title', newTitle);
          if (newArtist) fd.append('artist', newArtist);
          if (newLyrics) fd.append('lyrics', newLyrics);
          if (newAlbumId) fd.append('album', newAlbumId);
          if (newAudioFile) fd.append('audio', newAudioFile);
          if (newCoverFile) fd.append('cover', newCoverFile);
          res = await fetch(`/api/tracks/${track.id}`, { method: 'PUT', body: fd });
        } else {
          const payload = {};
          if (newTitle) payload.title = newTitle;
          if (newArtist) payload.artist = newArtist;
          if (newLyrics) payload.lyrics = newLyrics;
          if (newAlbumId !== undefined) payload.album = newAlbumId || '';
          if (newAudioUrl) payload.audioUrl = newAudioUrl;
          if (newCoverUrl) payload.coverUrl = newCoverUrl;
          res = await fetch(`/api/tracks/${track.id}/json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        }

        if (res.ok) {
          alert('Saved');
          dlg.remove();
          await refreshTracks();
        } else {
          alert('Save failed');
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  }

  // --- Refresh helpers ---
  async function refreshAlbums() {
    try {
      await fetchAlbums();
      buildTreeOptions(albumParent, true);
      buildTreeOptions(trackAlbumSelect, true);
      renderAlbumsList();
    } catch (err) {
      console.error(err);
      alert('Failed to load albums');
    }
  }
  async function refreshTracks() {
    try {
      await fetchTracks();
      renderTracks();
    } catch (err) {
      console.error(err);
      alert('Failed to load tracks');
    }
  }

  // --- Login / Logout ---
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const password = (passwordInput && passwordInput.value) ? passwordInput.value : '';
      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
        if (!res.ok) throw new Error('auth failed');

        // Успешный логин — показываем панель и загружаем данные
        loggedIn = true;
        if (loginForm) loginForm.style.display = 'none';
        if (adminPanel) { adminPanel.style.display = ''; adminPanel.classList.remove('hidden'); }
        if (passwordInput) passwordInput.value = '';
        await refreshAlbums();
        await refreshTracks();
      } catch (err) {
        if (loginMsg) {
          loginMsg.textContent = 'პაროლი არასწორია';
          setTimeout(()=> { loginMsg.textContent = ''; }, 3000);
        } else {
          alert('Login failed');
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/admin/logout', { method: 'POST' });
      loggedIn = false;
      if (adminPanel) { adminPanel.style.display = 'none'; adminPanel.classList.add('hidden'); }
      if (loginForm) loginForm.style.display = '';
    });
  }

  if (btnRefreshAlbums) btnRefreshAlbums.addEventListener('click', async () => { if (loggedIn) await refreshAlbums(); else alert('Please login first'); });
  if (btnRefreshTracks) btnRefreshTracks.addEventListener('click', async () => { if (loggedIn) await refreshTracks(); else alert('Please login first'); });

  // --- При загрузке страницы: гарантированно скрываем панель (не делаем автозапросов) ---
  document.addEventListener('DOMContentLoaded', () => {
    if (adminPanel) { adminPanel.style.display = 'none'; adminPanel.classList.add('hidden'); }
    if (loginForm) loginForm.style.display = '';
  });

})();
