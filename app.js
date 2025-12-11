(function () {
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');
  const searchInput = document.getElementById('search-input');

  const playerEl = document.getElementById('player');
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const volumeEl = document.getElementById('volume');
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

  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let isPlaying = false;

  // Поиск
  let searchQuery = '';
  let filteredTracks = [];

  // Лайки (localStorage)
  const LIKES_KEY = 'trackLikes';
  const LIKED_KEY = 'likedTracks';

  function loadLikes() {
    try {
      const raw = localStorage.getItem(LIKES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveLikes(obj) {
    try { localStorage.setItem(LIKES_KEY, JSON.stringify(obj)); } catch {}
  }
  function getLikesFor(id) {
    const map = loadLikes();
    return map[id] || 0;
  }
  function incrementLikesFor(id) {
    const map = loadLikes();
    map[id] = (map[id] || 0) + 1;
    saveLikes(map);
    return map[id];
  }
  function loadLikedSet() {
    try {
      const raw = localStorage.getItem(LIKED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveLikedSet(obj) {
    try { localStorage.setItem(LIKED_KEY, JSON.stringify(obj)); } catch {}
  }
  function hasLiked(id) {
    const set = loadLikedSet();
    return !!set[id];
  }
  function markLiked(id) {
    const set = loadLikedSet();
    set[id] = true;
    saveLikedSet(set);
  }

  // Утилиты
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
    if (t.filename) return 'media/' + t.filename;
    return null;
  }
  function getCoverUrl(t) {
    const fallback = 'images/midcube.png';
    if (!t) return fallback;
    if (t.coverUrl) return t.coverUrl;
    if (t.cover) return 'uploads/' + t.cover;
    return fallback;
  }
  function optionEl(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }
  function safeStr(v) { return (v == null) ? '' : String(v); }

  // Селекторы альбомов
  function buildAlbumSelectors() {
    if (!albumSelect) return;
    albumSelect.innerHTML = '';
    albumSelect.appendChild(optionEl('', '— ყველა ალბომი —'));
    const mains = albums.filter(a => !a.parentId);
    mains.forEach(a => albumSelect.appendChild(optionEl(a.id, a.name)));

    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      subalbumSelect.disabled = true;
      subalbumSelect.style.display = 'none';
      if (subalbumLabel) subalbumLabel.style.display = 'none';
    }
  }

  function onAlbumChange() {
    const currentAlbumId = (albumSelect.value || '').toString();
    if (subalbumSelect) {
      const subs = albums.filter(a => (a.parentId || '').toString() === currentAlbumId);
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      if (subs.length) {
        subs.forEach(s => subalbumSelect.appendChild(optionEl(s.id, s.name)));
        subalbumSelect.disabled = false;
        subalbumSelect.style.display = '';
        subalbumLabel.style.display = '';
      } else {
        subalbumSelect.disabled = true;
        subalbumSelect.style.display = 'none';
        subalbumLabel.style.display = 'none';
      }
      subalbumSelect.value = '';
    }
    renderTracks();
  }
  function onSubalbumChange() { renderTracks(); }

  // Поиск
  function matchesQuery(t, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
    const haystack = [
      safeStr(t.title),
      safeStr(t.artist),
      safeStr(albumName),
      safeStr(t.id),
      safeStr(t.filename),
      safeStr(t.audioUrl),
      safeStr(t.downloadUrl)
      // исключаем: cover, coverUrl, lyrics
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  }
  function applySearch() {
    const query = (searchQuery || '').trim();
    filteredTracks = query ? tracks.filter(t => matchesQuery(t, query)) : [];
  }

  // Рендер треков
  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    const selAlbum = albumSelect ? (albumSelect.value || '') : '';
    const selSub = subalbumSelect ? (subalbumSelect.value || '') : '';

    let visible = filteredTracks.length ? filteredTracks.slice() : tracks.slice();

    if (selSub) {
      visible = visible.filter(t => (t.albumId || '') === selSub);
    } else if (selAlbum) {
      visible = visible.filter(t => {
        if (!t.albumId) return false;
        if (t.albumId === selAlbum) return true;
        const albumObj = albums.find(a => a.id === t.albumId);
        return albumObj && (albumObj.parentId || '') === selAlbum;
      });
    }

    if (!visible.length) {
      const msg = document.createElement('div');
      msg.className = 'muted';
      msg.textContent = searchQuery ? 'По запросу ничего не найдено' : 'Нет треков';
      tracksContainer.appendChild(msg);
      return;
    }

    visible.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'card';

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = t.title || 'cover';
      img.addEventListener('click', () => {
        const globalIndex = tracks.findIndex(x => x.id === t.id);
        if (globalIndex === currentTrackIndex) {
          if (audio.paused) audio.play();
          else audio.pause();
        } else {
          playTrackByIndex(globalIndex);
        }
      });

      const info = document.createElement('div');
      info.className = 'track-info';
      const h4 = document.createElement('h4');
      h4.textContent = t.title || 'Untitled';
      const meta = document.createElement('div');
      const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
      meta.textContent = (t.artist || '') + (albumName ? ' • ' + albumName : '');
      info.appendChild(h4);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'track-actions';

      // Кнопка текста
      const btnLyrics = document.createElement('button');
      btnLyrics.type = 'button';
      btnLyrics.textContent = 'ტექსტი';
      btnLyrics.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (modal
