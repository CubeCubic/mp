/* admin.js
   Simple admin interface for albums and tracks.
   - Loads tracks.json
   - Allows creating/editing albums
   - Allows adding tracks
   - Allows editing/deleting tracks
   - Exports current data as tracks.json (download)
*/

(function () {
  // DOM elements
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const adminPanel = document.getElementById('admin-panel');
  const loginMsg = document.getElementById('login-msg');
  const adminPassword = document.getElementById('admin-password');
  const logoutBtn = document.getElementById('logout-btn');

  const albumNameInput = document.getElementById('album-name');
  const albumParentSelect = document.getElementById('album-parent');
  const btnCreateAlbum = document.getElementById('btn-create-album');
  const btnRefreshAlbums = document.getElementById('btn-refresh-albums');
  const btnSaveAll = document.getElementById('btn-save-all');
  const albumsList = document.getElementById('albums-list');

  const addTrackForm = document.getElementById('add-track-form');
  const trackAlbumSelect = document.getElementById('track-album-select');
  const adminTracksList = document.getElementById('admin-tracks');

  const trackSearchInput = document.getElementById('track-search');
  const trackSearchClear = document.getElementById('track-search-clear');
  const btnRefreshTracks = document.getElementById('btn-refresh-tracks');

  const albumEditModal = document.getElementById('album-edit-modal');
  const modalAlbumName = document.getElementById('modal-album-name');
  const modalAlbumParent = document.getElementById('modal-album-parent');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSave = document.getElementById('modal-save');

  // State
  let data = { albums: [], tracks: [] };
  let editingAlbumId = null;
  let isLoggedIn = false;

  // Simple password check (change as needed)
  const ADMIN_PASSWORD = 'admin'; // replace with secure check on server in production

  // Utilities
  function $(sel, ctx = document) { return ctx.querySelector(sel); }
  function createEl(tag, attrs = {}, text = '') {
    const el = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'dataset') {
        for (const d in attrs[k]) el.dataset[d] = attrs[k][d];
      } else el.setAttribute(k, attrs[k]);
    }
    if (text) el.textContent = text;
    return el;
  }

  function showLoginError(msg) {
    loginMsg.textContent = msg;
    setTimeout(() => { loginMsg.textContent = ''; }, 3000);
  }

  function downloadJSON(obj, filename = 'tracks.json') {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // Load tracks.json
  async function loadData() {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch tracks.json');
      const json = await res.json();
      data.albums = Array.isArray(json.albums) ? json.albums.slice() : [];
      data.tracks = Array.isArray(json.tracks) ? json.tracks.slice() : [];
      rebuildUI();
    } catch (err) {
      console.error('loadData error', err);
      albumsList.innerHTML = '<div class="muted">Не удалось загрузить albums</div>';
      adminTracksList.innerHTML = '<div class="muted">Не удалось загрузить tracks</div>';
    }
  }

  // UI rebuild
  function rebuildUI() {
    buildAlbumParentOptions();
    renderAlbumsList();
    buildTrackAlbumSelect();
    renderAdminTracks();
  }

  // Albums UI
  function buildAlbumParentOptions() {
    albumParentSelect.innerHTML = '<option value="">— მთავარი ალბომი —</option>';
    modalAlbumParent.innerHTML = '<option value="">— მთავარი ალბომი —</option>';
    data.albums.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name || '(unnamed)';
      albumParentSelect.appendChild(opt);

      const opt2 = opt.cloneNode(true);
      modalAlbumParent.appendChild(opt2);
    });
  }

  function renderAlbumsList() {
    albumsList.innerHTML = '';
    if (!data.albums.length) {
      albumsList.innerHTML = '<div class="muted">No albums</div>';
      return;
    }

    // sort by name
    const sorted = data.albums.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    sorted.forEach(a => {
      const item = createEl('div', { class: 'item' });
      const meta = createEl('div', { class: 'meta' });
      meta.innerHTML = `<strong>${a.name || '(no name)'}</strong><div class="muted">id: ${a.id}</div>`;
      item.appendChild(meta);

      const editBtn = createEl('button', {}, 'Edit');
      editBtn.addEventListener('click', () => openEditAlbum(a.id));
      const delBtn = createEl('button', {}, 'Delete');
      delBtn.addEventListener('click', () => deleteAlbum(a.id));

      const btnWrap = createEl('div', {});
      btnWrap.appendChild(editBtn);
      btnWrap.appendChild(delBtn);
      item.appendChild(btnWrap);

      albumsList.appendChild(item);
    });
  }

  function openEditAlbum(id) {
    const album = data.albums.find(a => String(a.id) === String(id));
    if (!album) return;
    editingAlbumId = album.id;
    modalAlbumName.value = album.name || '';
    modalAlbumParent.value = album.parentId || '';
    albumEditModal.classList.remove('hidden');
    albumEditModal.setAttribute('aria-hidden', 'false');
  }

  function saveEditedAlbum() {
    if (!editingAlbumId) return;
    const album = data.albums.find(a => String(a.id) === String(editingAlbumId));
    if (!album) return;
    album.name = modalAlbumName.value.trim() || album.name;
    album.parentId = modalAlbumParent.value || null;
    editingAlbumId = null;
    albumEditModal.classList.add('hidden');
    albumEditModal.setAttribute('aria-hidden', 'true');
    rebuildUI();
  }

  function deleteAlbum(id) {
    // prevent deleting if tracks reference it
    const used = data.tracks.some(t => String(t.albumId) === String(id));
    if (used) {
      alert('Cannot delete album: some tracks belong to it. Reassign or delete tracks first.');
      return;
    }
    data.albums = data.albums.filter(a => String(a.id) !== String(id));
    rebuildUI();
  }

  // Create album
  function createAlbum() {
    const name = (albumNameInput.value || '').trim();
    if (!name) {
      alert('Album name required');
      return;
    }
    const parentId = albumParentSelect.value || null;
    const id = String(Date.now()) + Math.floor(Math.random() * 1000);
    data.albums.push({ id, name, parentId: parentId || null });
    albumNameInput.value = '';
    rebuildUI();
  }

  // Tracks UI
  function buildTrackAlbumSelect() {
    trackAlbumSelect.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '— —';
    trackAlbumSelect.appendChild(opt);
    data.albums.forEach(a => {
      const o = document.createElement('option');
      o.value = a.id;
      o.textContent = a.name || '(no name)';
      trackAlbumSelect.appendChild(o);
    });
  }

  function renderAdminTracks(filter = '') {
    adminTracksList.innerHTML = '';
    const q = (filter || '').toLowerCase().trim();
    let list = data.tracks.slice();
    if (q) {
      list = list.filter(t => {
        return (t.title || '').toLowerCase().includes(q) ||
               (t.artist || '').toLowerCase().includes(q) ||
               (getAlbumName(t.albumId) || '').toLowerCase().includes(q);
      });
    }
    if (!list.length) {
      adminTracksList.innerHTML = '<div class="muted">No tracks</div>';
      return;
    }

    list.forEach(t => {
      const item = createEl('div', { class: 'item' });
      const meta = createEl('div', { class: 'meta' });
      meta.innerHTML = `<strong>${t.title || '(no title)'}</strong>
                        <div class="muted">${t.artist || ''} — ${getAlbumName(t.albumId) || '(no album)'}</div>
                        <div class="muted">id: ${t.id}</div>`;
      item.appendChild(meta);

      const editBtn = createEl('button', {}, 'Edit');
      editBtn.addEventListener('click', () => openEditTrack(t.id));
      const delBtn = createEl('button', {}, 'Delete');
      delBtn.addEventListener('click', () => deleteTrack(t.id));
      const btnWrap = createEl('div', {});
      btnWrap.appendChild(editBtn);
      btnWrap.appendChild(delBtn);
      item.appendChild(btnWrap);

      adminTracksList.appendChild(item);
    });
  }

  function getAlbumName(id) {
    const a = data.albums.find(x => String(x.id) === String(id));
    return a ? a.name : '';
  }

  // Add track
  function addTrack(ev) {
    ev.preventDefault();
    const form = addTrackForm;
    const formData = new FormData(form);
    const title = (formData.get('title') || '').trim();
    if (!title) {
      alert('Title is required');
      return;
    }
    const artist = (formData.get('artist') || '').trim();
    const lyrics = (formData.get('lyrics') || '').trim();
    const albumId = formData.get('album') || '';
    const audioUrl = (formData.get('audioUrl') || '').trim();
    const coverUrl = (formData.get('coverUrl') || '').trim();

    const id = String(Date.now()) + Math.floor(Math.random() * 1000);
    const track = { id, title, artist, lyrics, albumId: albumId || null, audioUrl, coverUrl };
    data.tracks.push(track);
    form.reset();
    renderAdminTracks();
  }

  // Edit track (simple prompt-based editor)
  function openEditTrack(id) {
    const t = data.tracks.find(x => String(x.id) === String(id));
    if (!t) return;
    // Build a quick edit form in a modal-like prompt sequence
    const newTitle = prompt('Title', t.title || '');
    if (newTitle === null) return;
    t.title = newTitle.trim();

    const newArtist = prompt('Artist', t.artist || '');
    if (newArtist === null) return;
    t.artist = newArtist.trim();

    const newAlbum = prompt('Album ID (leave empty for none)', t.albumId || '');
    if (newAlbum === null) return;
    t.albumId = newAlbum.trim() || null;

    const newAudio = prompt('Audio URL', t.audioUrl || '');
    if (newAudio === null) return;
    t.audioUrl = newAudio.trim();

    const newCover = prompt('Cover URL', t.coverUrl || '');
    if (newCover === null) return;
    t.coverUrl = newCover.trim();

    const newLyrics = prompt('Lyrics (short)', t.lyrics || '');
    if (newLyrics === null) return;
    t.lyrics = newLyrics;

    renderAdminTracks();
  }

  function deleteTrack(id) {
    if (!confirm('Delete this track?')) return;
    data.tracks = data.tracks.filter(t => String(t.id) !== String(id));
    renderAdminTracks();
  }

  // Save all (download)
  function saveAll() {
    const payload = { albums: data.albums, tracks: data.tracks };
    downloadJSON(payload, 'tracks.json');
  }

  // Login / logout
  function doLogin() {
    const pass = (adminPassword.value || '').trim();
    if (pass === ADMIN_PASSWORD) {
      isLoggedIn = true;
      loginForm.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      loadData();
    } else {
      showLoginError('პაროლი არასწორია');
    }
  }

  function doLogout() {
    isLoggedIn = false;
    adminPanel.classList.add('hidden');
    loginForm.classList.remove('hidden');
    adminPassword.value = '';
  }

  // Album modal handlers
  modalCancel.addEventListener('click', () => {
    editingAlbumId = null;
    albumEditModal.classList.add('hidden');
    albumEditModal.setAttribute('aria-hidden', 'true');
  });

  modalSave.addEventListener('click', () => {
    saveEditedAlbum();
  });

  // Search handlers
  trackSearchInput.addEventListener('input', () => {
    renderAdminTracks(trackSearchInput.value || '');
  });
  trackSearchClear.addEventListener('click', () => {
    trackSearchInput.value = '';
    renderAdminTracks();
  });

  // Buttons
  loginBtn.addEventListener('click', doLogin);
  logoutBtn.addEventListener('click', doLogout);
  btnCreateAlbum.addEventListener('click', createAlbum);
  btnRefreshAlbums.addEventListener('click', rebuildUI);
  btnRefreshTracks.addEventListener('click', () => renderAdminTracks());
  btnSaveAll.addEventListener('click', saveAll);
  addTrackForm.addEventListener('submit', addTrack);

  // Initial
  // If admin wants to auto-show panel in dev, uncomment:
  // isLoggedIn = true; loginForm.classList.add('hidden'); adminPanel.classList.remove('hidden'); loadData();

  // Load data only when logged in
  // But allow manual refresh button to attempt load even before login (useful for dev)
  // Provide a safe fallback: try to load once to populate UI for admin after login
  // Do not auto-login.

})();
