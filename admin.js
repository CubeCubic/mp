// admin.js — статическая версия для GitHub Pages
// Включает поддержку подальбомов (создание и редактирование) и пароль 230470
(async function() {
  if (!document.getElementById('admin-app')) return;

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

  // State
  let albums = [];
  let tracks = [];
  let albumBeingEdited = null;
  let loggedIn = false;

  // Helpers
  function escapeHtml(s) {
    return (s || '').toString().replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
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

  // Загрузка tracks.json
  async function fetchTracksJson() {
    const res = await fetch('tracks.json');
    if (!res.ok) throw new Error('Не удалось загрузить tracks.json');
    const data = await res.json();
    tracks = data.tracks || [];
    albums = data.albums || [];
    return data;
  }

  // Скачивание обновлённого JSON
  function downloadJson() {
    const data = { albums, tracks };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tracks.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // Получить всех потомков альбома (id списка)
  function getDescendantIds(rootId) {
    // Построим карту и дерево
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

  // Заполнить селекты альбомов (для создания альбома и для выбора альбома у трека)
  function fillAlbumSelects() {
    if (albumParent) {
      albumParent.innerHTML = '';
      albumParent.appendChild(el('option', { value: '' }, '— главный альбом —'));
      albums
        .slice()
        .sort((x, y) => (x.name || '').localeCompare(y.name || ''))
        .forEach(a => albumParent.appendChild(el('option', { value: a.id }, a.name)));
    }
    if (trackAlbumSelect) {
      trackAlbumSelect.innerHTML = '';
      trackAlbumSelect.appendChild(el('option', { value: '' }, '— без альбома —'));
      albums
        .slice()
        .sort((x, y) => (x.name || '').localeCompare(y.name || ''))
        .forEach(a => trackAlbumSelect.appendChild(el('option', { value: a.id }, a.name)));
    }
  }

  // Рендер списка альбомов
  function renderAlbumsList() {
    if (!albumsList) return;
    albumsList.innerHTML = '';
    // Отобразим в простом списке; структура вложенности не обязательна для админки,
    // главное — возможность редактировать parentId
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

      // Редактирование: заполняем modal, исключая себя и потомков из списка родителей
      btnEdit.addEventListener('click', () => {
        albumBeingEdited = a;
        modalAlbumName.value = a.name || '';

        // исключаем текущий альбом и всех его потомков, чтобы избежать циклов
        const descendants = getDescendantIds(a.id);
        const exclude = new Set([a.id, ...descendants]);

        modalAlbumParent.innerHTML = '';
        modalAlbumParent.appendChild(el('option', { value: '' }, '— нет родителя —'));
        albums
          .filter(al => !exclude.has(al.id))
          .slice()
          .sort((x, y) => (x.name || '').localeCompare(y.name || ''))
          .forEach(al => modalAlbumParent.appendChild(el('option', { value: al.id }, al.name)));

        modalAlbumParent.value = a.parentId || '';
        albumEditModal.style.display = 'flex';
        albumEditModal.classList.remove('hidden');
        albumEditModal.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
          try { modalAlbumName.focus(); } catch (e) {}
        }, 0);
      });

      btnDelete.addEventListener('click', () => {
        if (!confirm('Delete album?')) return;
        // При удалении альбома — переместим его детей в корень (parentId = null)
        albums = albums.map(x => x.id === a.id ? null : x).filter(Boolean);
        albums = albums.map(x => {
          if (x.parentId === a.id) return { ...x, parentId: null };
          return x;
        });
        renderAlbumsList();
        fillAlbumSelects();
        downloadJson();
      });

      item.appendChild(meta);
      item.appendChild(actions);
      albumsList.appendChild(item);
    });
  }

  // Сохранение изменений альбома из модалки
  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', () => {
      if (!albumBeingEdited) return;
      const newName = (modalAlbumName.value || '').trim();
      const newParent = modalAlbumParent.value || null;
      if (!newName) return alert('Введите название альбома');
      if (newParent === albumBeingEdited.id) return alert('Нельзя назначить самого себя родителем');

      // Защита от дублей в рамках одного родителя
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
      downloadJson();

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

  // Создание альбома / подальбома
  if (btnCreateAlbum) {
    btnCreateAlbum.addEventListener('click', () => {
      const name = (albumName.value || '').trim();
      if (!name) return alert('Введите название альбома');

      const parentId = albumParent.value || null; // если выбран — подальбом, иначе корень
      const id = Date.now().toString();

      // Защита от дублей в рамках одного родителя
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
      downloadJson();
    });
  }

  // Добавление трека (упрощённо — без загрузки файлов на сервер)
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
      downloadJson();
    });
  }

  // Рендер треков
  function renderTracks() {
    if (!adminTracks) return;
    adminTracks.innerHTML = '';
    if (!tracks.length) {
      adminTracks.innerHTML = '<div class="muted">No tracks</div>';
      return;
    }
    tracks.forEach(t => {
      const item = el('div', { class: 'item' });
      const meta = el('div', { class: 'meta' }, [
        el('strong', {}, escapeHtml(t.title || 'Untitled')),
        el('div', { class: 'muted' }, escapeHtml(t.artist || '')),
        el('div', { class: 'muted' }, `album: ${escapeHtml((albums.find(a => a.id === t.albumId) || {}).name || '(no album)')}`)
      ]);
      const actions = el('div', {});
      const btnDelete = el('button', {}, 'Delete');
      actions.appendChild(btnDelete);
      btnDelete.addEventListener('click', () => {
        if (!confirm('Delete track?')) return;
        tracks = tracks.filter(x => x.id !== t.id);
        renderTracks();
        downloadJson();
      });
      item.appendChild(meta);
      item.appendChild(actions);
      adminTracks.appendChild(item);
    });
  }

  // Кнопки обновления списков
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

  // Login / logout (пароль 230470)
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      const password = (passwordInput.value || '').toString();
      if (password === '230470') {
        loggedIn = true;
        loginForm.classList.add('hidden');
        adminPanel.classList.remove('hidden');
        passwordInput.value = '';
        fetchTracksJson().then(() => {
          renderAlbumsList();
          renderTracks();
          fillAlbumSelects();
        }).catch(err => {
          console.error(err);
          alert('Не удалось загрузить tracks.json');
        });
      } else {
        loginMsg.textContent = 'პაროლი არასწორია';
        setTimeout(() => { loginMsg.textContent = ''; }, 3000);
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

  // Инициализация: показываем форму входа
  document.addEventListener('DOMContentLoaded', () => {
    adminPanel.classList.add('hidden');
    loginForm.classList.remove('hidden');
  });

})(); // конец IIFE
