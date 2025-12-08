// frontend/app.js — интеграция OpenPlayerJS и логика страницы (под styles.css)
(async function () {
  // DOM элементы
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

  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  let tracks = [];
  let albums = [];
  let currentIndex = -1;
  let hasPlayedOnce = false;
  let openPlayerInstance = null;

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
    if (t.audioUrl) return t.audioUrl;
    if (t.downloadUrl) return t.downloadUrl;
    if (t.filename) return '/media/' + t.filename;
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

  function render() {
    if (!tracksContainer || !albumsContainer) return;

    // Альбомы
    albumsContainer.innerHTML = '';
    albums.forEach(a => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<strong>${escapeHtml(a.name || '')}</strong>`;
      albumsContainer.appendChild(el);
    });

    // Треки
    tracksContainer.innerHTML = '';
    tracks.forEach((t, idx) => {
      const cover = t.coverUrl || (t.cover ? '/uploads/' + t.cover : '');
      const stream = getStreamUrl(t) || '';
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        ${cover ? `<img class="track-cover" src="${cover}" alt="${escapeHtml(t.title)}">` : ''}
        <div class="track-info">
          <h4>${escapeHtml(t.title)}</h4>
          <div>${escapeHtml(t.artist || '')}</div>
        </div>
        <div class="track-actions">
          <button class="btn-play" data-idx="${idx}" data-src="${stream}">▶</button>
          <button class="btn-download" data-src="${stream}">ჩამოტვირთვა</button>
          <button class="btn-like" data-id="${t.id}">❤ <span>${t.likes || 0}</span></button>
          <button class="btn-lyrics" data-idx="${idx}">ტექსტი</button>
        </div>
      `;

      tracksContainer.appendChild(el);
    });

    // Слушатели (после рендера)
    tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-idx'));
        const src = e.currentTarget.getAttribute('data-src');
        if (!src) return;
        playTrackByIndex(idx, src);
      });
    });

    tracksContainer.querySelectorAll('.btn-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const src = e.currentTarget.getAttribute('data-src');
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    });

    tracksContainer.querySelectorAll('.btn-like').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (!id) return;
        try {
          const res = await fetch(`/api/tracks/${id}/like`, { method: 'POST' });
          const json = await res.json();
          const span = e.currentTarget.querySelector('span');
          if (span && json.likes !== undefined) span.textContent = String(json.likes);
        } catch (err) {
          console.error('Like error', err);
        }
      });
    });

    tracksContainer.querySelectorAll('.btn-lyrics').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = Number(e.currentTarget.getAttribute('data-idx'));
        const t = tracks[idx];
        if (!t) return;
        modalTitle.textContent = t.title || 'ლირიკა';
        modalLyrics.textContent = t.lyrics || 'ლირიკა არ არის';
        lyricsModal.classList.remove('hidden');
      });
    });
  }

  function initOpenPlayer() {
    try {
      if (typeof OpenPlayerJS === 'function' || window.OpenPlayerJS) {
        // Инициализация OpenPlayerJS на существующем audio элементе
        openPlayerInstance = new (window.OpenPlayerJS || OpenPlayerJS)('#audio');
      } else {
        console.warn('OpenPlayerJS не найден — плеер будет работать без стилизованных контролов');
      }
    } catch (err) {
      console.error('Ошибка инициализации OpenPlayerJS:', err);
    }
  }

  function showPlayerForTrack(t) {
    titleEl.textContent = t.title || '';
    artistEl.textContent = t.artist || '';
    if (t.coverUrl) coverImg.src = t.coverUrl;
    else if (t.cover) coverImg.src = '/uploads/' + t.cover;
    else coverImg.src = '';

    playerEl.classList.remove('hidden');
  }

  function playTrackByIndex(idx, src) {
    if (idx < 0 || idx >= tracks.length) return;
    currentIndex = idx;
    const t = tracks[idx];
    const url = src || getStreamUrl(t);
    if (!url) return;

    audio.pause();
    audio.src = url;
    audio.load();
    audio.play().catch(() => {});
    downloadBtn.setAttribute('href', url);
    showPlayerForTrack(t);
  }

  // Плеер: кнопки prev/next/play
  playBtn?.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  prevBtn?.addEventListener('click', () => {
    if (!tracks.length) return;
    currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    playTrackByIndex(currentIndex, getStreamUrl(tracks[currentIndex]));
  });

  nextBtn?.addEventListener('click', () => {
    if (!tracks.length) return;
    currentIndex = (currentIndex + 1) % tracks.length;
    playTrackByIndex(currentIndex, getStreamUrl(tracks[currentIndex]));
  });

  volume?.addEventListener('input', () => { audio.volume = Number(volume.value); });

  // Прогресс и время
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && !isNaN(audio.duration)) timeDuration.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      progress.value = (audio.currentTime / audio.duration) * 100;
      timeCurrent.textContent = formatTime(audio.currentTime);
    }
  });

  progress.addEventListener('input', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      audio.currentTime = (Number(progress.value) / 100) * audio.duration;
    }
  });

  audio.addEventListener('play', () => {
    playBtn.textContent = '⏸';
    hasPlayedOnce = true;
  });
  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
  });
  audio.addEventListener('ended', () => {
    playBtn.textContent = '▶';
  });

  // Модальное окно для лирики
  modalClose?.addEventListener('click', () => lyricsModal.classList.add('hidden'));
  lyricsModal?.addEventListener('click', (e) => { if (e.target === lyricsModal) lyricsModal.classList.add('hidden'); });

  // Инициализация
  document.addEventListener('DOMContentLoaded', async () => {
    initOpenPlayer();
    await load();
  });
})();
