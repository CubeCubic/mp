// frontend/app.js — логика главной страницы Cube Cubic
(async function() {
  const tracksContainer = document.getElementById('tracks');
  const albumsContainer = document.getElementById('albums');

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

  const mini = document.getElementById('player-mini');
  const miniResumeBtn = document.getElementById('mini-resume');

  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  let tracks = [];
  let albums = [];
  let currentIndex = -1;
  let hasPlayedOnce = false;

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

  function getTrackStreamUrl(t) {
    if (t.audioUrl) return t.audioUrl;
    if (t.filename) return `/media/${t.filename}`;
    return null;
  }

  async function load() {
    try {
      tracks = await (await fetch('/api/tracks')).json();
      albums = await (await fetch('/api/albums')).json();
      render();
    } catch (err) {
      console.error('Ошибка загрузки треков:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div>Не удалось загрузить треки</div>';
    }
  }

  function render
