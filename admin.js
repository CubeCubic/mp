// admin.js — статическая версия for GitHub Pages
// Поддержка подальбомов (создание и редактирование), пароль 230470,
// батч-режим (скачивание tracks.json вручную),
// + вход по Enter
// + редактирование треков (модалка)
// + новая кнопка сохранения под шапкой
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
  const btnSaveAll = document.getElementById('btn-save-all'); // новая кнопка
  const albumsList = document.getElementById('albums-list');
  const addForm = document.getElementById('add-track-form');
  const trackAlbumSelect = document.getElementById('track-album-select');
  const btnRefreshTracks = document.getElementById('btn-refresh-tracks');
  const adminTracks = document.getElementById('admin-tracks');
  const trackSearchInput = document.getElementById('track-search');
  const trackSearchClear = document.getElementById('track-search-clear');
  const logoutBtn = document.getElementById('logout-btn');

  // Modal elements
  const albumModal = document.getElementById('album-edit-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalAlbumName = document.getElementById('modal-album-name');
  const modalAlbumParent = document.getElementById('modal-album-parent');
  const modalCancel = document.getElementById('modal-cancel');
  const modalSave = document.getElementById('modal-save');

  let loggedIn = false;
  let albums = [];
  let tracks = [];
  let editingAlbumId = null;

  // --- Login ---
  function tryLogin() {
    const pass = passwordInput.value.trim();
    if (pass === '230470') {
      loggedIn = true;
      loginForm.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      loadData();
    } else {
      loginMsg.textContent = 'არასწორი პაროლი';
    }
  }

  // --- Data load ---
  async function loadData() {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      albums = data.albums || [];
      tracks = data.tracks || [];
      renderAlbums();
      renderAlbumSelects();
      renderTracks();
    } catch (err) {
      console.error(err);
      alert('tracks.json არ მოიძებნა');
    }
  }

  // --- Render albums ---
  function renderAlbums() {
    albumsList.innerHTML = '';
    const mains = albums.filter(a => !a.parentId);
    mains.forEach(a => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span>${a.name} ${a.parentId ? '(ქვეალბომი)' : ''}</span>
        <div>
          <button data-id="${a.id}" class="edit-album">რედაქტირება</button>
          <button data-id="${a.id}" class="delete-album">წაშლა</button>
        </div>
      `;
      albumsList.appendChild(item);
    });

    albumsList.querySelectorAll('.edit-album').forEach(btn => {
      btn.addEventListener('click', () => editAlbum(btn.dataset.id));
    });
    albumsList.querySelectorAll('.delete-album').forEach(btn => {
      btn.addEventListener('click', () => deleteAlbum(btn.dataset.id));
    });
  }

  function renderAlbumSelects() {
    [albumParent, trackAlbumSelect, modalAlbumParent].forEach(sel => {
      sel.innerHTML = '<option value="">— ძირითადი —</option>';
      albums.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = a.name + (a.parentId ? ' (ქვეალბომი)' : '');
        sel.appendChild(opt);
      });
    });
  }

  // --- Album CRUD ---
  btnCreateAlbum.addEventListener('click', () => {
    const name = albumName.value.trim();
    if (!name) return alert('შეიყვანეთ სახელი');
    const parentId = albumParent.value || null;
    const newAlbum = { id: Date.now(), name, parentId };
    albums.push(newAlbum);
    albumName.value = '';
    renderAlbums();
    renderAlbumSelects();
  });

  function editAlbum(id) {
    const album = albums.find(a => a.id == id);
    if (!album) return;
    editingAlbumId = id;
    modalTitle.textContent = 'ალბომის რედაქტირება';
    modalAlbumName.value = album.name;
    modalAlbumParent.value = album.parentId || '';
    albumModal.classList.remove('hidden');
  }

  function deleteAlbum(id) {
    if (!confirm('დარწმუნებული ხართ?')) return;
    albums = albums.filter(a => a.id != id);
    tracks = tracks.filter(t => t.albumId != id);
    renderAlbums();
    renderAlbumSelects();
    renderTracks();
  }

  modalCancel.addEventListener('click', () => {
    albumModal.classList.add('hidden');
    editingAlbumId = null;
  });

  modalSave.addEventListener('click', () => {
    const name = modalAlbumName.value.trim();
    if (!name) return alert('შეიყვანეთ სახელი');
    const album = albums.find(a => a.id === editingAlbumId);
    if (album) {
      album.name = name;
      album.parentId = modalAlbumParent.value || null;
    }
    albumModal.classList.add('hidden');
    editingAlbumId = null;
    renderAlbums();
    renderAlbumSelects();
    renderTracks();
  });

  // --- Track add ---
  document.getElementById('btn-add-track').addEventListener('click', () => {
    const title = document.getElementById('track-title').value.trim();
    const artist = document.getElementById('track-artist').value.trim();
    const albumId = trackAlbumSelect.value;
    const audioUrl = document.getElementById('track-audio').value.trim();
    const coverUrl = document.getElementById('track-cover').value.trim();
    const lyrics = document.getElementById('track-lyrics').value.trim();

    if (!title || !artist || !albumId || !audioUrl) {
      return alert('შეავსეთ საჭირო ველები');
    }

    const newTrack = {
      id: Date.now(),
      title,
      artist,
      albumId,
      audioUrl,
      coverUrl: coverUrl || null,
      lyrics: lyrics || null
    };

    tracks.push(newTrack);
    document.getElementById('track-title').value = '';
    document.getElementById('track-artist').value = '';
    document.getElementById('track-audio').value = '';
    document.getElementById('track-cover').value = '';
    document.getElementById('track-lyrics').value = '';

    renderTracks();
  });

  // --- Render tracks ---
  function renderTracks(query = '') {
    adminTracks.innerHTML = '';
    let filtered = tracks;
    if (query) {
      const q = query.toLowerCase();
      filtered = tracks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
      );
    }
    filtered.forEach(t => {
      const album = albums.find(a => a.id == t.albumId);
      const albumName = album ? album.name : 'უცნობი';
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div>
          <strong>${t.title}</strong> — ${t.artist}<br>
          <small>${albumName}</small>
        </div>
        <div>
          <button data-id="${