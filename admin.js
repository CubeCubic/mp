// admin.js — статическая версия для GitHub Pages с автоматическим обновлением tracks.json в GitHub
(async function() {
  if (!document.getElementById('admin-app')) return;

  // === НАСТРОЙКИ GITHUB ===
  const GITHUB_USER = 'CubeCubic';
  const GITHUB_REPO = 'mp';
  const GITHUB_BRANCH = 'main';
  const FILE_PATH = 'tracks.json';

  // Токен из localStorage
  function getToken() {
    return localStorage.getItem('github_token');
  }

  function setToken(token) {
    localStorage.setItem('github_token', token.trim());
  }

  function removeToken() {
    localStorage.removeItem('github_token');
  }

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

  // === Сохранение в GitHub ===
  async function saveToGitHub() {
    if (!isDirty) {
      alert('Нет несохранённых изменений');
      return;
    }

    let token = getToken();
    if (!token) {
      token = prompt('Введите ваш GitHub Personal Access Token (с scope repo):');
      if (!token) return alert('Сохранение отменено');
      setToken(token);
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
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'CubeCubic-Admin'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        if (err.message.includes('Bad credentials') || res.status === 401) {
          removeToken();
          alert('Токен неверный или истёк. Введите новый.');
          return saveToGitHub();
        }
        throw new Error(err.message || 'GitHub API error');
      }

      const data = await res.json();
      currentSha = data.content.sha;
      clearDirty();
      alert('Изменения успешно сохранены в GitHub!');
    } catch (err) {
      console.error(err);
      alert('Ошибка: ' + (err.message || 'Неизвестная ошибка'));
    }
  }

  async function loadCurrentSha() {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_USER}/${GITHUB_REPO}/contents/${FILE_PATH}?ref=${GITHUB_BRANCH}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (res.ok) {
        const data = await res.json();
        currentSha = data.sha;
      }
    } catch (e) {
      console.warn('Не удалось получить SHA');
    }
  }

  // Helpers и функции рендера (все перемещены вверх)
  function escapeHtml(s) {
    return (s || '').toString().replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
  }

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

  // ... (остальные функции: модалки, создание альбомов/треков и т.д. — как в вашем оригинале) ...

  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', saveToGitHub);
  }

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
