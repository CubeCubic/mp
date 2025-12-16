// admin.js — статическая версия для GitHub Pages с автоматическим обновлением tracks.json в GitHub
(async function() {
  if (!document.getElementById('admin-app')) return;

  // === НАСТРОЙКИ GITHUB ===
  const GITHUB_USER = 'CubeCubic';
  const GITHUB_REPO = 'mp';
  const GITHUB_BRANCH = 'main';
  const FILE_PATH = 'tracks.json';

  // Токен хранится в localStorage (вводится один раз)
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
          return saveToGitHub(); // Рекурсивно запросить новый
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

  // Остальной код (helpers, render, модалки и т.д.) — без изменений
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

  // ... (весь ваш оригинальный код функций: getDescendantIds, fillAlbumSelects, renderAlbumsList, модалки, создание альбомов/треков, renderTracks, refresh кнопки и т.д.) ...

  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', saveToGitHub);
  }

  // Login и init
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
