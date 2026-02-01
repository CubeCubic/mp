(function () {
  const albumsAdmin = document.getElementById('albums-admin');
  const tracksAdmin = document.getElementById('tracks-admin');
  const btnAddAlbum = document.getElementById('btn-add-album');
  const btnAddTrack = document.getElementById('btn-add-track');
  const btnSaveAll = document.getElementById('btn-save-all');

  let albums = [];
  let tracks = [];

  // --- Загрузка данных ---
  async function loadData() {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      albums = data.albums || [];
      tracks = data.tracks || [];
      renderAlbums();
      renderTracks();
    } catch (err) {
      console.error('Ошибка загрузки tracks.json:', err);
    }
  }

  // --- Рендер альбомов ---
  function renderAlbums() {
    albumsAdmin.innerHTML = '';
    albums.forEach((a, idx) => {
      const div = document.createElement('div');
      div.className = 'admin-album';
      div.innerHTML = `
        <input type="text" value="${a.name || ''}" data-idx="${idx}" class="album-name-input">
        <button type="button" class="btn-delete-album" data-idx="${idx}">Delete</button>
      `;
      albumsAdmin.appendChild(div);
    });
  }

  // --- Рендер треков ---
  function renderTracks() {
    tracksAdmin.innerHTML = '';
    tracks.forEach((t, idx) => {
      const div = document.createElement('div');
      div.className = 'admin-track';
      div.innerHTML = `
        <input type="text" value="${t.title || ''}" data-idx="${idx}" class="track-title-input">
        <input type="text" value="${t.artist || ''}" data-idx="${idx}" class="track-artist-input">
        <button type="button" class="btn-delete-track" data-idx="${idx}">Delete</button>
      `;
      tracksAdmin.appendChild(div);
    });
  }

  // --- Добавление альбома ---
  btnAddAlbum.addEventListener('click', () => {
    albums.push({ id: Date.now(), name: 'New Album' });
    renderAlbums();
  });

  // --- Добавление трека ---
  btnAddTrack.addEventListener('click', () => {
    tracks.push({ id: Date.now(), title: 'New Track', artist: '' });
    renderTracks();
  });

  // --- Удаление альбома ---
  albumsAdmin.addEventListener('click', (ev) => {
    if (ev.target.classList.contains('btn-delete-album')) {
      const idx = parseInt(ev.target.dataset.idx, 10);
      albums.splice(idx, 1);
      renderAlbums();
    }
  });

  // --- Удаление трека ---
  tracksAdmin.addEventListener('click', (ev) => {
    if (ev.target.classList.contains('btn-delete-track')) {
      const idx = parseInt(ev.target.dataset.idx, 10);
      tracks.splice(idx, 1);
      renderTracks();
    }
  });

  // --- Сохранение всех изменений ---
  btnSaveAll.addEventListener('click', async () => {
    btnSaveAll.classList.add('blinking');
    const payload = { albums, tracks };
    try {
      await fetch('tracks.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload, null, 2)
      });
      btnSaveAll.classList.remove('blinking');
      alert('Changes saved!');
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      btnSaveAll.classList.remove('blinking');
      alert('Save failed!');
    }
  });

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', loadData);
})();
