// admin.js — статическая версия для GitHub Pages с поддержкой подальбомов
(async function() {
  if (!document.getElementById('admin-app')) return;

  // Elements
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

  // Modal elements
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

  // Рендер альбомов
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

      // редактирование альбома/подальбома
      btnEdit.addEventListener('click', () => {
        albumBeingEdited = a;
        modalAlbumName.value = a.name;
        modalAlbumParent.innerHTML = '';
        modalAlbumParent.appendChild(el('option', { value: '' }, '— нет родителя —'));
        albums.forEach(al => {
          if (al.id !== a.id) {
            modalAlbumParent.appendChild(el('option', { value: al.id }, al.name));
          }
        });
        modalAlbumParent.value = a.parentId || '';
        albumEditModal.style.display = 'flex';
        albumEditModal.classList.remove('hidden');
      });

      btnDelete.addEventListener('click', () => {
        if (!confirm('Delete album?')) return;
        albums = albums.filter(x => x.id !== a.id);
        renderAlbumsList();
        downloadJson();
      });

      item.appendChild(meta);
      item.appendChild(actions);
      albumsList.appendChild(item);
    });
  }

  // сохранение изменений альбома/подальбома
  if (modalSaveBtn) {
    modalSaveBtn.addEventListener('click', () => {
      if (!albumBeingEdited) return;
      const newName = (modalAlbumName.value || '').trim();
      const newParent = modalAlbumParent.value || null;
      if (!newName) return alert('Введите название альбома');
      if (newParent === albumBeingEdited.id) return alert('Нельзя назначить самого себя родителем');
      albumBeingEdited.name = newName;
      albumBeingEdited.parentId = newParent;
      renderAlbumsList();
      downloadJson();
      albumEditModal.style.display = 'none';
      albumBeingEdited = null;
    });
  }
  if (modalCancelBtn) modalCancelBtn.addEventListener('click', () => {
    albumEditModal.style.display = 'none';
    albumBeingEdited = null;
  });

  // Добавление альбома/подальбома
  if (btnCreateAlbum) {
    btnCreateAlbum.addEventListener('click', () => {
      const name = albumName.value.trim();
      if (!name) return alert('Введите название альбома');
      const id = Date.now().toString();
      const parentId = albumParent.value || null; // если выбран родитель → создаём подальбом
      albums.push({ id, name, parentId });
      albumName.value = '';
      renderAlbumsList();
      downloadJson();
    });
  }

  // Добавление трека
  if (addForm) {
    addForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const title = form.elements['title'].value || 'Untitled';
      const artist = form.elements['artist'].value || '';
      const lyrics = form.elements['lyrics'].value || '';
      const albumId = form.elements['album'] ? form.elements['album'].value : '';
      const audioUrl = form.elements['audioUrl'].value.trim();
      const coverUrl = form.elements['coverUrl'].value.trim();

      const id = Date.now().toString();
      tracks.push({ id, title, artist, lyrics, albumId, audioUrl, coverUrl });
      form.reset();
      renderTracks();
      downloadJson();
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
      const meta = el('div', { class: 'meta' }, [
        el('strong', {}, escapeHtml(t.title || 'Untitled')),
        el('div', { class: 'muted' }, escapeHtml(t.artist || '')),
        el('div', { class: 'muted' }, `album: ${escapeHtml(t.albumId || '')}`)
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

  // Login / logout
  if (loginBtn) {
  loginBtn.addEventListener('click', () => {
    const password = passwordInput.value || '';
    if (password === 'admin') {   // здесь можно поставить свой пароль
      loggedIn = true;
      loginForm.classList.add('hidden');
      adminPanel.classList.remove('hidden');
      passwordInput.value = '';
      fetchTracksJson().then(() => {
        renderAlbumsList();
        renderTracks();
      });
    } else {
      loginMsg.textContent = 'პაროლი არასწორია';
      setTimeout(() => loginMsg.textContent = '', 3000);
    }
  });
}

