// frontend/app.js — полный файл с fallback-обложкой (/images/midcube.png)
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
  let albums = []; 
  let tracks = []; 
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

  function getCoverUrl(t) {
    const fallback = '/images/midcube.png';
    if (!t) return fallback;
    if (t.coverUrl) return t.coverUrl;
    if (t.cover) return '/uploads/' + t.cover;
    return fallback;
  }

  // Load data from external JSON (archive.org)
  async function loadData() {
    try {
     const tracksRes = await fetch("tracks.json");
      const data = await tracksRes.json();
      tracks = data.tracks || [];
      albums = data.albums || [];

      const def = albums.find(a => a && (a.name === 'სინგლი'));
      if (def) defaultAlbumId = def.id;

      buildAlbumSelectors();
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

  // ... остальной код без изменений (рендеринг треков, обработчики, плеер, модалки)

  albumSelect?.addEventListener('change', onAlbumChange);
  subalbumSelect?.addEventListener('change', onSubalbumChange);

  document.addEventListener('DOMContentLoaded', loadData);
})();
