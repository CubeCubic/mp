// admin.js — статическая версия для GitHub Pages с автоматическим обновлением tracks.json в GitHub
(async function() {
  if (!document.getElementById('admin-app')) return;

  // === НАСТРОЙКИ GITHUB ===
  const GITHUB_TOKEN = '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';
  const GITHUB_USER = 'CubeCubic';
  const GITHUB_REPO = 'mp';
  const GITHUB_BRANCH = 'main';
  const FILE_PATH = 'tracks.json';

  // Elements
  const loginForm = document.getElementById('login-form');
  const adminPanel = document.getElementById('admin-panel');
  const loginBtn = document.getElementById('login-btn');
  const loginMsg = document.getElementById('login-msg');
  const passwordInput = document.getElementById('admin-password');
  const albumName = document.getElementById('album-name');
  const albumParent = document.getElementById('album-parent');
  const btnCreateAlbum = document.getElementById('btn-create-album');
  const btnRefreshAlbums = document.getElementById('btn-refresh-albums');
  const btnSaveAll = document.getElementById('btn-save-all');
  const albumsList = document.getElementById('albums-list');
  const addForm = document.getElementById('add-track-form');
  const trackAlbumSelect = document.getElementById('track-album-select');
  const btnRefreshTracks = document.getElementById('btn-refresh-tracks');
  const adminTracks = document.getElementById('admin-tracks');
  const logoutBtn = document.getElementById('logout-btn');
  const albumEditModal = document.getElementById('album-edit-modal');
  const modalAlbumName = document.getElementById('modal-album-name');
  const modalAlbumParent = document.getElementById('modal-album-parent');
  const modalSaveBtn = document.getElementById('modal-save');
  const modalCancelBtn = document.getElementById('modal-cancel');

  let trackEditModalBackdrop = null;
  let trackEditRefs = null;
  let trackBeingEdited = null;

  let albums = [];
  let tracks = [];
  let albumBeingEdited = null;
  let loggedIn = false;
  let isDirty = false;
  let currentSha = null;

  function markDirty() {
    isDirty = true;
    if (loginMsg) loginMsg.textContent = 'Есть несохранённые изменения';
  }

  function clearDirty() {
    isDirty = false;
    if (loginMsg) loginMsg.textContent = '';
  }

  // === Автоматическое сохранение в GitHub ===
  async function saveToGitHub() {
    if (!isDirty) {
      alert('Нет несохранённых изменений');
      return;
    }

    const content = btoa(unescape(encodeURIComponent(JSON.stringify({ albums, tracks }, null, 2))));
    const message = `Update tracks.json — ${new Date().toLocaleString('ka-GE')}`;

    const payload = {
      message,
      content,
      branch: GITHUB_BRANCH
    };
    if (currentSha) payload.sha = currentSha;

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CubeCubic-Admin'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'GitHub API error');
      }

      const data = await res.json();
      currentSha = data.content.sha;
      clearDirty();
      alert('Изменения успешно сохранены в GitHub! Файл tracks.json обновлён.');
    } catch (err) {
      console.error(err);
      alert('Ошибка сохранения в GitHub: ' + (err.message || 'Неизвестная ошибка'));
    }
  }

  async function loadCurrentSha() {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${GITHUB_BRANCH}`);
      if (res.ok) {
        const data = await res.json();
        currentSha = data.sha;
      }
    } catch (e) {
      console.warn('Не удалось получить SHA файла');
    }
  }

  // Helpers
  function escapeHtml(s){ return (s||'').toString().replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

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

  async function fetchTracksJson() {
    const res = await fetch('tracks.json');
    if (!res.ok) throw new Error('Не удалось загрузить tracks.json');
    const data = await res.json();
    tracks = data.tracks || [];
    albums = data.albums || [];
    return data;
  }

  function getDescendantIds(rootId) {
    const map = {};
    albums.forEach(a => { map[a.id] = { ...a, children: [] }; });
    albums.forEach(a => {
      if (a.parentId && map[a.parentId]) {
        map[a.parentId].children.push(map[a.id]);
      }
    });
    const result = [];
    function dfs(node) {
      if (!node) return;
      node.children.forEach(child => {
        result.push(child.id);
        dfs(child);
      });
    }
    if (map[rootId]) dfs(map[rootId]);
    return result;
  }

  function fillAlbumSelects() {
    if (albumParent) {
      albumParent.innerHTML = '';
      albumParent.appendChild(el('option', { value: '' }, '— главный альбом —'));
      albums.slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(a => albumParent.appendChild(el('option', { value: a.id }, a.name)));
    }
    if (trackAlbumSelect) {
      trackAlbumSelect.innerHTML = '';
      trackAlbumSelect.appendChild(el('option', { value: '' }, '— без альбома —'));
      albums.slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(a => trackAlbumSelect.appendChild(el('option', { value: a.id }, a.name)));
    }
    if (trackEditRefs && trackEditRefs.album) {
      trackEditRefs.album.innerHTML = '';
      trackEditRefs.album.appendChild(el('option', { value: '' }, '— без альбома —'));
      albums.slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(a => trackEditRefs.album.appendChild(el('option', { value: a.id }, a.name)));
    }
  }

  function renderAlbumsList() {
    if (!albumsList) return;
    albumsList.innerHTML = '';
    albums.forEach(a => {
      const item = el('div', { class: 'item' });
      const meta = el('div', { class: 'meta' }, [
        el('strong', {}, escapeHtml(a.name)),
        el('div', { class: 'muted' }, `id: ${a.id} • parent: ${a.parentId || '—'}`)
      ]);
      const actions = el('div', {});
      const btnEdit = el('button', {}, 'Edit');
      const btnDelete = el('button', {}, 'Delete');
      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);

      btnEdit.addEventListener('click', () => {
        albumBeingEdited = a;
        modalAlbumName.value = a.name || '';
        const descendants = getDescendantIds(a.id);
        const exclude = new Set([a.id, ...descendants]);
        modalAlbumParent.innerHTML = '';
        modalAlbumParent.appendChild(el('option', { value: '' }, '— нет родителя —'));
        albums.filter(al => !exclude.has(al.id)).slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(al => modalAlbumParent.appendChild(el('option', { value: al.id }, al.name)));
        modalAlbumParent.value = a.parentId || '';
        albumEditModal.style.display = 'flex';
        albumEditModal.classList.remove('hidden');
        albumEditModal.setAttribute('aria-hidden', 'false');
        setTimeout(() => { try { modalAlbumName.focus(); } catch (e) {} }, 0);
      });

      btnDelete.addEventListener('click', () => {
        if (!confirm('Delete album?')) return;
        albums = albums.filter(x => x.id !== a.id);
        albums = albums.map(x => {
          if (x.parentId === a.id) return { ...x, parentId: null };
          return x;
        });
        renderAlbumsList();
        fillAlbumSelects();
        markDirty();
      });

      item.appendChild(meta);
      item.appendChild(actions);
      albumsList.appendChild(item);
    });
  }

  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', () => {
      if (!albumBeingEdited) return;
      const newName = (modalAlbumName.value || '').trim();
      const newParent = modalAlbumParent.value || null;
      if (!newName) return alert('Введите название альбома');
      if (newParent === albumBeingEdited.id) return alert('Нельзя назначить самого себя родителем');
      const duplicate = albums.find(a =>
        a.id !== albumBeingEdited.id &&
        a.name === newName &&
        ((a.parentId || null) === (newParent || null))
      );
      if (duplicate) {
        alert('Альбом с таким именем уже существует в выбранном разделе');
        return;
      }
      albumBeingEdited.name = newName;
      albumBeingEdited.parentId = newParent;
      renderAlbumsList();
      fillAlbumSelects();
      markDirty();
      albumEditModal.style.display = 'none';
      albumEditModal.classList.add('hidden');
      albumEditModal.setAttribute('aria-hidden', 'true');
      albumBeingEdited = null;
    });
  }

  if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', () => {
      albumEditModal.style.display = 'none';
      albumEditModal.classList.add('hidden');
      albumEditModal.setAttribute('aria-hidden', 'true');
      albumBeingEdited = null;
    });
  }

  if (albumEditModal) {
    albumEditModal.addEventListener('click', (e) => { if (e.target === albumEditModal) {
      albumEditModal.style.display = 'none';
      albumEditModal.classList.add('hidden');
      albumEditModal.setAttribute('aria-hidden', 'true');
      albumBeingEdited = null;
    }});
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') {
      albumEditModal.style.display = 'none';
      albumEditModal.classList.add('hidden');
      albumEditModal.setAttribute('aria-hidden', 'true');
      albumBeingEdited = null;
    }});
  }

  function ensureTrackEditModal() {
    if (trackEditModalBackdrop) return;
    trackEditModalBackdrop = el('div', { class: 'modal-backdrop hidden', id: 'track-edit-dynamic' });
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
    trackEditModalBackdrop.appendChild(modal);
    document.body.appendChild(trackEditModalBackdrop);
    trackEditModalBackdrop.addEventListener('click', (e) => {
      if (e.target === trackEditModalBackdrop) closeTrackEditModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !trackEditModalBackdrop.classList.contains('hidden')) {
        closeTrackEditModal();
      }
    });
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
      renderTracks();
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
    trackEditModalBackdrop.classList.remove('hidden');
    trackEditModalBackdrop.setAttribute('aria-hidden', 'false');
    setTimeout(() => { try { trackEditRefs.title.focus(); } catch(e){} }, 0);
  }

  function closeTrackEditModal() {
    if (!trackEditModalBackdrop) return;
    trackEditModalBackdrop.classList.add('hidden');
    trackEditModalBackdrop.setAttribute('aria-hidden', 'true');
    trackBeingEdited = null;
  }

  if (btnCreateAlbum) {
    btnCreateAlbum.addEventListener('click', () => {
      const name = (albumName.value || '').trim();
      if (!name) return alert('Введите название альбома');
      const parentId = albumParent.value || null;
      const id = Date.now().toString();
      const duplicate = albums.find(a => a.name === name && ((a.parentId || null) === (parentId || null)));
      if (duplicate) {
        alert('Альбом с таким именем уже существует в этом разделе');
        return;
      }
      albums.push({ id, name, parentId });
      albumName.value = '';
      albumParent.value = '';
      renderAlbumsList();
      fillAlbumSelects();
      markDirty();
    });
  }

  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const title = form.elements['title'].value || 'Untitled';
      const artist = form.elements['artist'].value || '';
      const lyrics = form.elements['lyrics'].value || '';
      const albumId = form.elements['album'] ? form.elements['album'].value : '';
      const audioUrl = form.elements['audioUrl'] ? form.elements['audioUrl'].value.trim() : '';
      const coverUrl = form.elements['coverUrl'] ? form.elements['coverUrl'].value.trim() : '';
      const id = Date.now().toString();
      tracks.push({ id, title, artist, lyrics, albumId, audioUrl, coverUrl });
      form.reset();
      renderTracks();
      markDirty();
    });
  }

  function renderTracks() {
    if (!adminTracks) return;
    adminTracks.innerHTML = '';
    if (!tracks.length) {
      adminTracks.innerHTML = '<div class="muted">No tracks</div>';
      return;
    }
    tracks.forEach(t => {
      const item = el('div', { class: 'item' });
      const albumNameForTrack = (albums.find(a => a.id === t.albumId) || {}).name || '(no album)';
      const meta = el('div', { class: 'meta' }, [
        el('strong', {}, escapeHtml(t.title || 'Untitled')),
        el('div', { class: 'muted' }, escapeHtml(t.artist || '')),
        el('div', { class: 'muted' }, `album: ${escapeHtml(albumNameForTrack)}`)
      ]);
      const actions = el('div', {});
      const btnEdit = el('button', {}, 'Edit');
      const btnDelete = el('button', {}, 'Delete');
      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);
      btnEdit.addEventListener('click', () => {
        openTrackEditModal(t);
      });
      btnDelete.addEventListener('click', () => {
        if (!confirm('Delete track?')) return;
        tracks = tracks.filter(x => x.id !== t.id);
        renderTracks();
        markDirty();
      });
      item.appendChild(meta);
      item.appendChild(actions);
      adminTracks.appendChild(item);
    });
  }

  if (btnRefreshAlbums) {
    btnRefreshAlbums.addEventListener('click', () => {
      if (loggedIn) {
        renderAlbumsList();
        fillAlbumSelects();
      } else {
        alert('Сначала войдите');
      }
    });
  }

  if (btnRefreshTracks) {
    btnRefreshTracks.addEventListener('click', () => {
      if (loggedIn) {
        renderTracks();
      } else {
        alert('Сначала войдите');
      }
    });
  }

  // Кнопка Save All — теперь сохраняет в GitHub
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', saveToGitHub);
  }

  // Login
  function tryLogin() {
    const password = (passwordInput.value || '').toString();
    if (password === '230470') {
      loggedIn = true;
      loginForm.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      passwordInput.value = '';
      loadCurrentSha();
      fetchTracksJson().then(() => {
        renderAlbumsList();
        renderTracks();
        fillAlbumSelects();
        clearDirty();
      }).catch(err => {
        console.error(err);
        alert('Не удалось загрузить tracks.json');
      });
    } else {
      loginMsg.textContent = 'პაროლი არასწორია';
      setTimeout(() => { loginMsg.textContent = ''; }, 3000);
    }
  }

  if (loginBtn) loginBtn.addEventListener('click', tryLogin);

  if (passwordInput) {
    passwordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        tryLogin();
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      loggedIn = false;
      adminPanel.classList.add('hidden');
      loginForm.classList.remove('hidden');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    adminPanel.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });
})();
