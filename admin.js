// admin.js — статическая версия for GitHub Pages
// Поддержка подальбомов (создание и редактирование), пароль 230470,
// батч-режим (скачивание tracks.json вручную),
// + вход по Enter
// + редактирование треков (модалка)
// + новая кнопка сохранения под шапкой
(async function() {
  if (!document.getElementById('admin-app') && !document.querySelector('main')) {
    // If the page structure differs, still continue — we rely on element IDs present in admin.html
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
  const btnSaveAll = document.getElementById('btn-save-all'); // новая кнопка (теперь внутри admin-panel)
  const albumsList = document.getElementById('albums-list');
  const addFormBtn = document.getElementById('btn-add-track');
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
    const pass = (passwordInput && passwordInput.value || '').trim();
    if (pass === '230470') {
      loggedIn = true;
      if (loginForm) loginForm.classList.add('hidden');
      if (adminPanel) adminPanel.classList.remove('hidden');
      loadData();
    } else {
      if (loginMsg) loginMsg.textContent = 'არასწორი პაროლი';
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
    if (!albumsList) return;
    albumsList.innerHTML = '';
    const mains = albums.filter(a => !a.parentId);
    mains.forEach(a => {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <span>${escapeHtml(a.name)} ${a.parentId ? '(ქვეალბომი)' : ''}</span>
        <div>
          <button data-id="${a.id}" class="edit-album">რედაქტირება</button>
          <button data-id="${a.id}" class="delete-album">წაშლა</button>
        </div>
      `;
      albumsList.appendChild(item);
    });

    // Edit / Delete handlers
    albumsList.querySelectorAll('.edit-album').forEach(btn => {
      btn.addEventListener('click', () => editAlbum(btn.dataset.id));
    });
    albumsList.querySelectorAll('.delete-album').forEach(btn => {
      btn.addEventListener('click', () => deleteAlbum(btn.dataset.id));
    });
  }

  function renderAlbumSelects() {
    [albumParent, trackAlbumSelect, modalAlbumParent].forEach(sel => {
      if (!sel) return;
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
  if (btnCreateAlbum) {
    btnCreateAlbum.addEventListener('click', () => {
      const name = (albumName && albumName.value || '').trim();
      if (!name) return alert('შეიყვანეთ სახელი');
      const parentId = (albumParent && albumParent.value) || null;
      const newAlbum = { id: Date.now(), name, parentId };
      albums.push(newAlbum);
      if (albumName) albumName.value = '';
      renderAlbums();
      renderAlbumSelects();
    });
  }

  function editAlbum(id) {
    const album = albums.find(a => a.id == id);
    if (!album) return;
    editingAlbumId = id;
    if (modalTitle) modalTitle.textContent = 'ალბომის რედაქტირება';
    if (modalAlbumName) modalAlbumName.value = album.name;
    if (modalAlbumParent) modalAlbumParent.value = album.parentId || '';
    if (albumModal) albumModal.classList.remove('hidden');
  }

  function deleteAlbum(id) {
    if (!confirm('დარწმუნებული ხართ?')) return;
    albums = albums.filter(a => a.id != id);
    tracks = tracks.filter(t => t.albumId != id);
    renderAlbums();
    renderAlbumSelects();
    renderTracks();
  }

  if (modalCancel) {
    modalCancel.addEventListener('click', () => {
      if (albumModal) albumModal.classList.add('hidden');
      editingAlbumId = null;
    });
  }

  if (modalSave) {
    modalSave.addEventListener('click', () => {
      const name = (modalAlbumName && modalAlbumName.value || '').trim();
      if (!name) return alert('შეიყვანეთ სახელი');
      const album = albums.find(a => a.id == editingAlbumId);
      if (album) {
        album.name = name;
        album.parentId = (modalAlbumParent && modalAlbumParent.value) || null;
      }
      if (albumModal) albumModal.classList.add('hidden');
      editingAlbumId = null;
      renderAlbums();
      renderAlbumSelects();
      renderTracks();
    });
  }

  // --- Track add ---
  if (addFormBtn) {
    addFormBtn.addEventListener('click', () => {
      const title = (document.getElementById('track-title') && document.getElementById('track-title').value || '').trim();
      const artist = (document.getElementById('track-artist') && document.getElementById('track-artist').value || '').trim();
      const albumId = (trackAlbumSelect && trackAlbumSelect.value) || '';
      const audioUrl = (document.getElementById('track-audio') && document.getElementById('track-audio').value || '').trim();
      const coverUrl = (document.getElementById('track-cover') && document.getElementById('track-cover').value || '').trim();
      const lyrics = (document.getElementById('track-lyrics') && document.getElementById('track-lyrics').value || '').trim();

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
      const tTitle = document.getElementById('track-title');
      const tArtist = document.getElementById('track-artist');
      const tAudio = document.getElementById('track-audio');
      const tCover = document.getElementById('track-cover');
      const tLyrics = document.getElementById('track-lyrics');
      if (tTitle) tTitle.value = '';
      if (tArtist) tArtist.value = '';
      if (tAudio) tAudio.value = '';
      if (tCover) tCover.value = '';
      if (tLyrics) tLyrics.value = '';

      renderTracks(trackSearchInput ? trackSearchInput.value : '');
    });
  }

  // --- Render tracks ---
  function renderTracks(query = '') {
    if (!adminTracks) return;
    adminTracks.innerHTML = '';
    let filtered = tracks;
    if (query) {
      const q = query.toLowerCase();
      filtered = tracks.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.artist || '').toLowerCase().includes(q)
      );
    }
    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'No tracks';
      adminTracks.appendChild(empty);
      return;
    }
    filtered.forEach(t => {
      const album = albums.find(a => a.id == t.albumId);
      const albumName = album ? album.name : 'უცნობი';
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div>
          <strong>${escapeHtml(t.title)}</strong> — ${escapeHtml(t.artist)}<br>
          <small>${escapeHtml(albumName)}</small>
        </div>
        <div>
          <button data-id="${t.id}" class="delete-track">წაშლა</button>
        </div>
      `;
      adminTracks.appendChild(item);
    });

    adminTracks.querySelectorAll('.delete-track').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('წავშალოთ ტრეკი?')) return;
        tracks = tracks.filter(tr => tr.id != btn.dataset.id);
        renderTracks(trackSearchInput ? trackSearchInput.value : '');
      });
    });
  }

  // --- Save all (НОВАЯ КНОПКА) ---
  if (btnSaveAll) {
    btnSaveAll.addEventListener('click', async () => {
      if (!confirm('დაიმახსოვროთ ყველა ცვლილება tracks.json-ში?')) return;
      const data = { albums, tracks };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tracks.json';
      a.click();
      URL.revokeObjectURL(url);
      alert('ფაილი მზადაა ჩამოსატვირთად. ატვირთეთ GitHub-ზე.');
    });
  }

  // Refresh buttons
  if (btnRefreshAlbums) btnRefreshAlbums.addEventListener('click', loadData);
  if (btnRefreshTracks) btnRefreshTracks.addEventListener('click', () => renderTracks(trackSearchInput ? trackSearchInput.value : ''));

  // Login handlers
  if (loginBtn) {
    loginBtn.addEventListener('click', tryLogin);
  }
  // Enter to login
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
      if (adminPanel) adminPanel.classList.add('hidden');
      if (loginForm) loginForm.classList.remove('hidden');
    });
  }

  // --- Search logic (debounced) ---
  function debounce(fn, wait) {
    let t = null;
    return function(...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  if (trackSearchInput) {
    const onSearch = debounce(() => {
      const q = trackSearchInput.value || '';
      renderTracks(q);
    }, 200);
    trackSearchInput.addEventListener('input', onSearch);

    if (trackSearchClear) {
      trackSearchClear.addEventListener('click', () => {
        trackSearchInput.value = '';
        renderTracks('');
        trackSearchInput.focus();
      });
    }
  }

  // Utility: escape HTML
  function escapeHtml(s){ return (s||'').toString().replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    if (adminPanel) adminPanel.classList.add('hidden');
    if (loginForm) loginForm.classList.remove('hidden');
  });
})();
