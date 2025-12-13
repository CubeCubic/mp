// admin.js
// Unified admin script for static GitHub Pages deployment
// - Normalizes tracks.json formats
// - Temporary sessionStorage-based admin token (no secrets in code)
// - CRUD for albums and tracks with modals
// - Export (download) updated tracks.json
// - Resource checks using Audio element (CORS-friendly)
// - Accessibility: ARIA attributes and focus management

(function () {
  'use strict';
  if (!document.getElementById('admin-app')) return;

  // ====== Config ======
  const TRACKS_JSON_PATH = 'tracks.json';
  const AUDIO_CHECK_TIMEOUT = 8000;

  // ====== DOM ======
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const loginMsg = document.getElementById('login-msg');
  const passwordInput = document.getElementById('admin-password');

  const adminPanel = document.getElementById('admin-panel');
  const logoutBtn = document.getElementById('logout-btn');

  const albumNameInput = document.getElementById('album-name');
  const albumParentSelect = document.getElementById('album-parent');
  const btnCreateAlbum = document.getElementById('btn-create-album');
  const btnRefreshAlbums = document.getElementById('btn-refresh-albums');
  const btnSaveAll = document.getElementById('btn-save-all');
  const albumsListEl = document.getElementById('albums-list');

  const addTrackForm = document.getElementById('add-track-form');
  const trackAlbumSelect = document.getElementById('track-album-select');

  const btnRefreshTracks = document.getElementById('btn-refresh-tracks');
  const adminTracksEl = document.getElementById('admin-tracks');

  const albumEditModal = document.getElementById('album-edit-modal');
  const modalAlbumName = document.getElementById('modal-album-name');
  const modalAlbumParent = document.getElementById('modal-album-parent');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSave = document.getElementById('modal-save');

  const trackEditModalStatic = document.getElementById('track-edit-modal');

  // ====== State ======
  let albums = [];
  let tracks = [];
  let loggedIn = false;
  let isDirty = false;
  let albumBeingEdited = null;
  let trackBeingEdited = null;
  let trackEditRefs = null; // dynamic modal refs
  let trackEditBackdrop = null;

  // ====== Utilities ======
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
  function escapeHtml(s) { return (s || '').toString().replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }
  function markDirty() { isDirty = true; if (loginMsg) loginMsg.textContent = 'Есть несохранённые изменения'; }
  function clearDirty() { isDirty = false; if (loginMsg) loginMsg.textContent = ''; }

  // ====== Data normalization ======
  function normalizeData(raw) {
    let outAlbums = [];
    let outTracks = [];
    if (!raw) return { albums: [], tracks: [] };

    if (Array.isArray(raw)) {
      outAlbums = raw.map(a => ({
        id: a.id || (Date.now() + Math.random()).toString(),
        name: a.name || '',
        parentId: a.parentId || null,
        cover: a.cover || ''
      }));
      // extract tracks if present
      raw.forEach(a => {
        if (Array.isArray(a.tracks)) {
          a.tracks.forEach(t => {
            outTracks.push({
              id: t.id || (Date.now() + Math.random()).toString(),
              title: t.title || '',
              artist: t.artist || '',
              lyrics: t.lyrics || '',
              albumId: a.id || '',
              audioUrl: t.audioUrl || t.downloadUrl || t.filename || '',
              coverUrl: t.coverUrl || t.cover || ''
            });
          });
        }
      });
    } else {
      outAlbums = Array.isArray(raw.albums) ? raw.albums.map(a => ({
        id: a.id || (Date.now() + Math.random()).toString(),
        name: a.name || '',
        parentId: a.parentId || null,
        cover: a.cover || ''
      })) : [];
      outTracks = Array.isArray(raw.tracks) ? raw.tracks.map(t => ({
        id: t.id || (Date.now() + Math.random()).toString(),
        title: t.title || '',
        artist: t.artist || '',
        lyrics: t.lyrics || '',
        albumId: t.albumId || '',
        audioUrl: t.audioUrl || t.downloadUrl || t.filename || '',
        coverUrl: t.coverUrl || t.cover || ''
      })) : [];
    }
    return { albums: outAlbums, tracks: outTracks };
  }

  // ====== Load tracks.json ======
  async function loadTracksJson() {
    try {
      const res = await fetch(TRACKS_JSON_PATH + '?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      const normalized = normalizeData(raw);
      albums = normalized.albums;
      tracks = normalized.tracks;
      renderAll();
      clearDirty();
    } catch (err) {
      console.error('loadTracksJson error', err);
      albums = [];
      tracks = [];
      renderAll();
      if (albumsListEl) albumsListEl.innerHTML = '<div class="muted">Не удалось загрузить tracks.json</div>';
    }
  }

  // ====== Render helpers ======
  function fillAlbumSelects() {
    if (albumParentSelect) {
      albumParentSelect.innerHTML = '<option value="">— главный альбом —</option>';
      albums.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(a => {
        albumParentSelect.appendChild(el('option', { value: a.id }, a.name));
      });
    }
    if (trackAlbumSelect) {
      trackAlbumSelect.innerHTML = '<option value="">— без альбома —</option>';
      albums.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(a => {
        trackAlbumSelect.appendChild(el('option', { value: a.id }, a.name));
      });
    }
    // update dynamic modal select if exists
    if (trackEditRefs && trackEditRefs.album) {
      trackEditRefs.album.innerHTML = '<option value="">— без альбома —</option>';
      albums.slice().sort((a,b) => (a.name||'').localeCompare(b.name||'')).forEach(a => {
        trackEditRefs.album.appendChild(el('option', { value: a.id }, a.name));
      });
    }
  }

  function renderAlbumsList() {
    if (!albumsListEl) return;
    albumsListEl.innerHTML = '';
    albums.forEach(a => {
      const item = el('div', { class: 'item' });
      const thumb = el('img', { src: a.cover || 'images/placeholder-cover.png', alt: a.name || 'cover', width: 56, height: 56 });
      thumb.onerror = () => { thumb.src = 'images/placeholder-cover.png'; };
      const meta = el('div', { class: 'meta' }, [
        el('strong', {}, escapeHtml(a.name || 'Untitled')),
        el('div', { class: 'muted' }, `Tracks: ${tracks.filter(t => t.albumId === a.id).length}`)
      ]);
      const actions = el('div', {});
      const btnEdit = el('button', {}, 'Edit');
      const btnDelete = el('button', {}, 'Delete');
      btnEdit.addEventListener('click', () => openAlbumEditModal(a));
      btnDelete.addEventListener('click', () => {
        if (!confirm('Удалить альбом и переместить его подальбомы в корень?')) return;
        albums = albums.filter(x => x.id !== a.id);
        albums = albums.map(x => x.parentId === a.id ? { ...x, parentId: null } : x);
        renderAlbumsList();
        fillAlbumSelects();
        markDirty();
      });
      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);
      item.appendChild(thumb);
      item.appendChild(meta);
      item.appendChild(actions);
      albumsListEl.appendChild(item);
    });
  }

  function renderTracksList() {
    if (!adminTracksEl) return;
    adminTracksEl.innerHTML = '';
    if (!tracks.length) {
      adminTracksEl.innerHTML = '<div class="muted">No tracks</div>';
      return;
    }
    tracks.forEach(t => {
      const item = el('div', { class: 'item' });
      const thumb = el('img', { src: t.coverUrl || 'images/placeholder-cover.png', alt: t.title || 'cover', width: 56, height: 56 });
      thumb.onerror = () => { thumb.src = 'images/placeholder-cover.png'; };
      const meta = el('div', { class: 'meta' }, [
        el('strong', {}, escapeHtml(t.title || 'Untitled')),
        el('div', { class: 'muted' }, `${escapeHtml(t.artist || '')} • ${escapeHtml((albums.find(a => a.id === t.albumId) || {}).name || '')}`)
      ]);
      const actions = el('div', {});
      const btnEdit = el('button', {}, 'Edit');
      const btnDelete = el('button', {}, 'Delete');
      const btnCheck = el('button', {}, 'Check');
      btnEdit.addEventListener('click', () => openTrackEditModal(t));
      btnDelete.addEventListener('click', () => {
        if (!confirm('Удалить трек?')) return;
        tracks = tracks.filter(x => x.id !== t.id);
        renderTracksList();
        markDirty();
      });
      btnCheck.addEventListener('click', async () => {
        const res = await checkTrackResources(t);
        alert(`Cover: ${res.cover.ok ? 'OK' : 'FAIL'}\nAudio: ${res.audio.ok ? 'OK' : 'FAIL'}`);
      });
      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);
      actions.appendChild(btnCheck);
      item.appendChild(thumb);
      item.appendChild(meta);
      item.appendChild(actions);
      adminTracksEl.appendChild(item);
    });
  }

  function renderAll() {
    fillAlbumSelects();
    renderAlbumsList();
    renderTracksList();
  }

  // ====== Album edit modal ======
  function openAlbumEditModal(album) {
    albumBeingEdited = album;
    modalAlbumName.value = album.name || '';
    // exclude self and descendants from parent options
    const descendants = getDescendantIds(album.id);
    modalAlbumParent.innerHTML = '<option value="">— нет родителя —</option>';
    albums.filter(a => ![album.id, ...descendants].includes(a.id)).sort((x,y) => (x.name||'').localeCompare(y.name||'')).forEach(a => {
      modalAlbumParent.appendChild(el('option', { value: a.id }, a.name));
    });
    modalAlbumParent.value = album.parentId || '';
    albumEditModal.classList.remove('hidden');
    albumEditModal.style.display = 'flex';
    albumEditModal.setAttribute('aria-hidden', 'false');
    // focus management
    modalAlbumName.focus();
  }

  function getDescendantIds(rootId) {
    const map = {};
    albums.forEach(a => map[a.id] = { ...a, children: [] });
    albums.forEach(a => { if (a.parentId && map[a.parentId]) map[a.parentId].children.push(map[a.id]); });
    const res = [];
    function dfs(node) { if (!node) return; node.children.forEach(c => { res.push(c.id); dfs(c); }); }
    if (map[rootId]) dfs(map[rootId]);
    return res;
  }

  if (modalSave) {
    modalSave.addEventListener('click', () => {
      if (!albumBeingEdited) return;
      const newName = (modalAlbumName.value || '').trim();
      const newParent = modalAlbumParent.value || null;
      if (!newName) return alert('Введите название альбома');
      if (newParent === albumBeingEdited.id) return alert('Нельзя назначить самого себя родителем');
      const duplicate = albums.find(a => a.id !== albumBeingEdited.id && a.name === newName && ((a.parentId || null) === (newParent || null)));
      if (duplicate) return alert('Альбом с таким именем уже существует в выбранном разделе');
      albumBeingEdited.name = newName;
      albumBeingEdited.parentId = newParent;
      renderAll();
      markDirty();
      albumEditModal.classList.add('hidden');
      albumEditModal.style.display = 'none';
      albumEditModal.setAttribute('aria-hidden', 'true');
      albumBeingEdited = null;
    });
  }
  if (modalCancel) {
    modalCancel.addEventListener('click', () => {
      albumEditModal.classList.add('hidden');
      albumEditModal.style.display = 'none';
      albumEditModal.setAttribute('aria-hidden', 'true');
      albumBeingEdited = null;
    });
  }
  if (albumEditModal) {
    albumEditModal.addEventListener('click', (e) => { if (e.target === albumEditModal) { modalCancel.click(); } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !albumEditModal.classList.contains('hidden')) modalCancel.click(); });
  }

  // ====== Dynamic track edit modal ======
  function ensureTrackEditModal() {
    if (trackEditBackdrop) return;
    trackEditBackdrop = el('div', { class: 'modal-backdrop hidden', id: 'track-edit-dynamic' });
    const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
      el('h3', {}, 'Edit track'),
      el('label', {}, 'Title'),
      (trackEditRefs = trackEditRefs || {}).title = el('input', { type: 'text' }),
      el('label', {}, 'Artist'),
      (trackEditRefs.artist = el('input', { type: 'text' })),
      el('label', {}, 'Lyrics'),
      (trackEditRefs.lyrics = el('textarea', {})),
      el('label', {}, 'Album'),
      (trackEditRefs.album = el('select', {})),
      el('label', {}, 'Audio URL'),
      (trackEditRefs.audioUrl = el('input', { type: 'text' })),
      el('label', {}, 'Cover URL'),
      (trackEditRefs.coverUrl = el('input', { type: 'text' })),
      el('div', { class: 'actions' }, [
        (trackEditRefs.cancelBtn = el('button', { type: 'button' }, 'Cancel')),
        (trackEditRefs.saveBtn = el('button', { type: 'button' }, 'Save'))
      ])
    ]);
    trackEditBackdrop.appendChild(modal);
    document.body.appendChild(trackEditBackdrop);

    trackEditBackdrop.addEventListener('click', (e) => { if (e.target === trackEditBackdrop) closeTrackEditModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !trackEditBackdrop.classList.contains('hidden')) closeTrackEditModal(); });

    trackEditRefs.cancelBtn.addEventListener('click', closeTrackEditModal);
    trackEditRefs.saveBtn.addEventListener('click', () => {
      if (!trackBeingEdited) return;
      const newTitle = (trackEditRefs.title.value || '').trim();
      if (!newTitle) return alert('Введите Title');
      trackBeingEdited.title = newTitle;
      trackBeingEdited.artist = (trackEditRefs.artist.value || '').trim();
      trackBeingEdited.lyrics = (trackEditRefs.lyrics.value || '').toString();
      trackBeingEdited.albumId = trackEditRefs.album.value || '';
      trackBeingEdited.audioUrl = (trackEditRefs.audioUrl.value || '').trim();
      trackBeingEdited.coverUrl = (trackEditRefs.coverUrl.value || '').trim();
      markDirty();
      renderTracksList();
      closeTrackEditModal();
    });
  }

  function openTrackEditModal(track) {
    ensureTrackEditModal();
    trackBeingEdited = track;
    fillAlbumSelects();
    trackEditRefs.title.value = track.title || '';
    trackEditRefs.artist.value = track.artist || '';
    trackEditRefs.lyrics.value = track.lyrics || '';
    trackEditRefs.album.value = track.albumId || '';
    trackEditRefs.audioUrl.value = track.audioUrl || '';
    trackEditRefs.coverUrl.value = track.coverUrl || '';
    trackEditBackdrop.classList.remove('hidden');
    trackEditBackdrop.style.display = 'flex';
    trackEditBackdrop.setAttribute('aria-hidden', 'false');
    trackEditRefs.title.focus();
  }

  function closeTrackEditModal() {
    if (!trackEditBackdrop) return;
    trackEditBackdrop.classList.add('hidden');
    trackEditBackdrop.style.display = 'none';
    trackEditBackdrop.setAttribute('aria-hidden', 'true');
    trackBeingEdited = null;
  }

  // ====== Create album ======
  if (btnCreateAlbum) {
    btnCreateAlbum.addEventListener('click', () => {
      const name = (albumNameInput.value || '').trim();
      if (!name) return alert('Введите название альбома');
      const parentId = albumParentSelect.value || null;
      const id = Date.now().toString();
      const duplicate = albums.find(a => a.name === name && ((a.parentId || null) === (parentId || null)));
      if (duplicate) return alert('Альбом с таким именем уже существует в этом разделе');
      albums.push({ id, name, parentId, cover: '' });
      albumNameInput.value = '';
      albumParentSelect.value = '';
      renderAll();
      markDirty();
    });
  }

  // ====== Add track ======
  if (addTrackForm) {
    addTrackForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const title = (form.elements['title'].value || 'Untitled').trim();
      const artist = (form.elements['artist'].value || '').trim();
      const lyrics = (form.elements['lyrics'].value || '').trim();
      const albumId = form.elements['album'] ? form.elements['album'].value : '';
      const audioUrl = form.elements['audioUrl'] ? form.elements['audioUrl'].value.trim() : '';
      const coverUrl = form.elements['coverUrl'] ? form.elements['coverUrl'].value.trim() : '';
      const id = Date.now().toString();
      tracks.push({ id, title, artist, lyrics, albumId, audioUrl, coverUrl });
      form.reset();
      renderTracksList();
      markDirty();
    });
  }

  // ====== Export tracks.json ======
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', () => {
      if (!isDirty) { alert('Нет несохранённых изменений'); return; }
      const payload = { albums, tracks };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tracks.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      clearDirty();
      alert('Файл tracks.json скачан. Загрузите его в репозиторий или на сервер.');
    });
  }

  // ====== Resource checks ======
  function checkImage(url, timeout = 6000) {
    return new Promise((resolve) => {
      if (!url) return resolve({ ok: false, url, error: 'No URL' });
      const img = new Image();
      let settled = false;
      const t = setTimeout(() => { if (!settled) { settled = true; resolve({ ok: false, url, error: 'Timeout' }); img.src = ''; } }, timeout);
      img.onload = () => { if (!settled) { settled = true; clearTimeout(t); resolve({ ok: true, url }); img.src = ''; } };
      img.onerror = () => { if (!settled) { settled = true; clearTimeout(t); resolve({ ok: false, url, error: 'Image load error' }); img.src = ''; } };
      img.src = url;
    });
  }

  function checkAudioViaElement(url, timeout = AUDIO_CHECK_TIMEOUT) {
    return new Promise((resolve) => {
      if (!url) return resolve({ ok: false, url, error: 'No URL' });
      const a = new Audio();
      let settled = false;
      const t = setTimeout(() => { if (!settled) { settled = true; resolve({ ok: false, url, error: 'Timeout' }); a.src = ''; } }, timeout);
      a.preload = 'metadata';
      a.src = url;
      a.addEventListener('canplay', () => { if (!settled) { settled = true; clearTimeout(t); resolve({ ok: true, url }); a.src = ''; } });
      a.addEventListener('error', () => { if (!settled) { settled = true; clearTimeout(t); resolve({ ok: false, url, error: 'Error loading' }); a.src = ''; } });
    });
  }

  async function checkTrackResources(track) {
    const cover = await checkImage(track.coverUrl || '');
    const audio = await checkAudioViaElement(track.audioUrl || '');
    return { cover, audio };
  }

  // ====== Archive upload command generator ======
  function prepareArchiveUploadCommand(item) {
    const identifier = item.identifier || ('upload-' + Date.now());
    const endpoint = 'https://s3.us.archive.org';
    const accessKey = 'ACCESS_KEY';
    const secretKey = 'SECRET_KEY';
    const bucket = 's3';
    let cmd = '# aws-cli example (replace ACCESS_KEY/SECRET_KEY and run locally)\n';
    cmd += `aws configure set aws_access_key_id ${accessKey}\n`;
    cmd += `aws configure set aws_secret_access_key ${secretKey}\n`;
    cmd += `aws --endpoint-url ${endpoint} s3 sync ./files/ s3://${bucket}/${identifier}/\n\n`;
    cmd += `# or use ia tool if installed:\n`;
    cmd += `# ia upload ${identifier} files/* --metadata='collection:opensource' --metadata='title:My Upload'\n`;
    return cmd;
  }

  // ====== Login (temporary sessionStorage token) ======
  function tryLogin() {
    const password = (passwordInput.value || '').toString();
    const expected = sessionStorage.getItem('cube_admin_token') || '';
    if (!expected) {
      loginMsg.textContent = 'Admin token not set in sessionStorage. Set sessionStorage key "cube_admin_token" to a secret and reload.';
      return;
    }
    if (password === expected) {
      loggedIn = true;
      loginForm.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      passwordInput.value = '';
      loadTracksJson();
      clearDirty();
    } else {
      loginMsg.textContent = 'პაროლი არასწორია';
      setTimeout(() => { loginMsg.textContent = ''; }, 3000);
    }
  }

  if (loginBtn) loginBtn.addEventListener('click', tryLogin);
  if (passwordInput) passwordInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); tryLogin(); } });
  if (logoutBtn) logoutBtn.addEventListener('click', () => { loggedIn = false; adminPanel.classList.add('hidden'); loginForm.classList.remove('hidden'); });

  // ====== Refresh buttons ======
  if (btnRefreshAlbums) btnRefreshAlbums.addEventListener('click', () => { if (!loggedIn) return alert('Сначала войдите'); renderAlbumsList(); fillAlbumSelects(); });
  if (btnRefreshTracks) btnRefreshTracks.addEventListener('click', () => { if (!loggedIn) return alert('Сначала войдите'); renderTracksList(); });

  // ====== Init ======
  document.addEventListener('DOMContentLoaded', () => {
    adminPanel.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

  // Expose some helpers for debugging
  window._admin = {
    loadTracksJson,
    prepareArchiveUploadCommand,
    checkTrackResources,
    getState: () => ({ albums, tracks, isDirty })
  };
})();
