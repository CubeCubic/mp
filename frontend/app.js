// frontend/app.js — полный файл: альбомы, подальбомы, фильтрация, плеер
(function () {
  // DOM элементы
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  const playerEl = document.getElementById('player');
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const volume = document.getElementById('volume');
  const downloadBtn = document.getElementById('download');
  const showLyricsBtn = document.getElementById('show-lyrics');
  const coverImg = document.getElementById('player-cover-img');
  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');

  const progress = document.getElementById('progress');
  const timeCurrent = document.getElementById('time-current');
  const timeDuration = document.getElementById('time-duration');

  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  // State
  let albums = []; // плоский список {id, name, parentId}
  let tracks = []; // список треков (enhanced from backend)
  let currentTrackId = null;
  let defaultAlbumId = null;

  // Helpers
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatTime(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function getStreamUrl(t) {
    if (!t) return null;
    if (t.audioUrl) return t.audioUrl;
    if (t.downloadUrl) return t.downloadUrl;
    if (t.filename) return '/media/' + t.filename;
    return null;
  }

  // Load data from API
  async function loadData() {
    try {
      const [tracksRes, albumsRes] = await Promise.all([
        fetch('/api/tracks'),
        fetch('/api/albums')
      ]);
      tracks = await tracksRes.json();
      albums = await albumsRes.json();

      // find default album (სინგლი) if exists
      const def = albums.find(a => a && (a.name === 'სინგლი'));
      if (def) defaultAlbumId = def.id;

      buildAlbumSelectors();
      // auto-select default if present, otherwise first main album
      if (defaultAlbumId) {
        albumSelect.value = defaultAlbumId;
      } else {
        const mains = albums.filter(a => !a.parentId);
        if (mains.length) albumSelect.value = mains[0].id;
      }
      onAlbumChange();
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      tracksContainer.innerHTML = '<div>Не удалось загрузить треки</div>';
    }
  }

  // Build album select (main albums only)
  function buildAlbumSelectors() {
    albumSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Выберите альбом';
    albumSelect.appendChild(placeholder);

    const mainAlbums = albums.filter(a => !a.parentId);
    mainAlbums.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      albumSelect.appendChild(opt);
    });

    subalbumSelect.innerHTML = '';
    subalbumSelect.style.display = 'none';
    subalbumLabel.style.display = 'none';
  }

  // When main album changes
  function onAlbumChange() {
    const mainId = albumSelect.value;
    if (!mainId) {
      tracksContainer.innerHTML = '<div>Выберите альбом, чтобы увидеть треки</div>';
      subalbumSelect.style.display = 'none';
      subalbumLabel.style.display = 'none';
      return;
    }

    // build subalbum list
    const children = albums.filter(a => String(a.parentId) === String(mainId));
    if (children.length) {
      subalbumSelect.style.display = '';
      subalbumLabel.style.display = '';
      subalbumSelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = 'All';
      subalbumSelect.appendChild(allOpt);
      children.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.name;
        subalbumSelect.appendChild(o);
      });
    } else {
      subalbumSelect.style.display = 'none';
      subalbumLabel.style.display = 'none';
    }

    // show tracks for main album (including tracks in subalbums)
    renderTracksForMain(mainId);
  }

  // When subalbum changes
  function onSubalbumChange() {
    const subId = subalbumSelect.value;
    const mainId = albumSelect.value;
    if (!mainId) return;
    if (!subId) {
      renderTracksForMain(mainId);
    } else {
      const list = tracks.filter(t => String(t.albumId) === String(subId));
      renderTrackList(list);
    }
  }

  // Render tracks for main album (direct + children)
  function renderTracksForMain(mainId) {
    const direct = tracks.filter(t => String(t.albumId) === String(mainId));
    const childIds = albums.filter(a => String(a.parentId) === String(mainId)).map(a => a.id);
    const fromChildren = tracks.filter(t => childIds.includes(String(t.albumId)));
    const merged = [...direct, ...fromChildren];
    renderTrackList(merged);
  }

  // Render a list of track objects
  function renderTrackList(list) {
    tracksContainer.innerHTML = '';
    if (!list.length) {
      tracksContainer.innerHTML = '<div>Треков нет</div>';
      return;
    }

    list.forEach(t => {
      const cover = t.coverUrl || (t.cover ? '/uploads/' + t.cover : '');
      const stream = getStreamUrl(t) || '';
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        ${cover ? `<img class="track-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(t.title)}" loading="lazy">` : ''}
        <div class="track-info">
          <h4>${escapeHtml
