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
    tracks = await (await fetch('/api/tracks')).json();
    albums = await (await fetch('/api/albums')).json();
    render();
  }

  function render() {
    albumsContainer.innerHTML = '';
    albums.forEach(a => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<strong>${escapeHtml(a.name || '')}</strong>`;
      albumsContainer.appendChild(el);
    });

    tracksContainer.innerHTML = '';
    tracks.forEach(t => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        ${t.coverUrl ? `<img class="track-cover" src="${t.coverUrl}" data-id="${t.id}">` : (t.cover ? `<img class="track-cover" src="/uploads/${t.cover}" data-id="${t.id}">` : '')}
        <h4 class="track-title" data-id="${t.id}">${escapeHtml(t.title)}</h4>
        <div>${escapeHtml(t.artist || '')}</div>
        <div class="track-actions">
          <button data-download="${t.audioUrl ? t.audioUrl : (t.filename ? '/uploads/' + t.filename : '')}">ჩამოტვირთვა</button>
          <button data-like="${t.id}">❤ <span>${t.likes||0}</span></button>
        </div>
      `;

      // запуск трека по клику
      const img = el.querySelector('.track-cover');
      if (img) img.addEventListener('click', () => togglePlayById(t.id));
      const title = el.querySelector('.track-title');
      if (title) title.addEventListener('click', () => togglePlayById(t.id));

      // лайки
      el.querySelector('[data-like]')?.addEventListener('click', async (e) => {
        const res = await fetch(`/api/tracks/${t.id}/like`, { method: 'POST' });
        const json = await res.json();
        e.currentTarget.querySelector('span').textContent = json.likes;
      });

      // ✅ исправленный обработчик для кнопки скачивания в карточке трека
      el.querySelector('[data-download]')?.addEventListener('click', (e) => {
        e.preventDefault();
        const url = e.currentTarget.getAttribute('data-download');
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = ''; // заставляет браузер скачать файл
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });

      tracksContainer.appendChild(el);
    });
  }

  function togglePlayById(id) {
    const idx = tracks.findIndex(x => x.id === id);
    if (idx === -1) return;
    currentIndex = idx;
    const t = tracks[currentIndex];
    const url = getTrackStreamUrl(t);
    if (!url) return;
    audio.src = url;
    titleEl.textContent = t.title;
    artistEl.textContent = t.artist || '';
    if (t.coverUrl) coverImg.src = t.coverUrl;
    else if (t.cover) coverImg.src = `/uploads/${t.cover}`;
    else coverImg.src = '';
    downloadBtn.setAttribute('data-download', url);
    audio.play().catch(() => {});
  }

  // управление плеером
  playBtn?.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  prevBtn?.addEventListener('click', () => {
    if (!tracks.length) return;
    currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
    togglePlayById(tracks[currentIndex].id);
  });

  nextBtn?.addEventListener('click', () => {
    if (!tracks.length) return;
    currentIndex = (currentIndex + 1) % tracks.length;
    togglePlayById(tracks[currentIndex].id);
  });

  volume?.addEventListener('input', () => { audio.volume = volume.value; });

  miniResumeBtn?.addEventListener('click', () => { audio.play().catch(() => {}); });

  showLyricsBtn?.addEventListener('click', () => {
    if (currentIndex === -1) return;
    const t = tracks[currentIndex];
    modalTitle.textContent = t.title || 'ლირიკა';
    modalLyrics.textContent = t.lyrics || 'ლირიკა არ არის';
    lyricsModal?.classList.remove('hidden');
  });

  modalClose?.addEventListener('click', () => lyricsModal?.classList.add('hidden'));
  lyricsModal?.addEventListener('click', (e) => { if (e.target === lyricsModal) lyricsModal.classList.add('hidden'); });

  // события плеера
  audio.addEventListener('play', () => {
    playerEl.classList.remove('hidden');
    mini.classList.add('hidden');
    playBtn.textContent = '⏸';
    hasPlayedOnce = true;
  });
  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
    if (hasPlayedOnce) {
      playerEl.classList.add('hidden');
      mini.classList.remove('hidden');
    }
  });
  audio.addEventListener('ended', () => {
    playerEl.classList.add('hidden');
    mini.classList.add('hidden');
    lyricsModal?.classList.add('hidden');
    audio.src = '';
    currentIndex = -1;
    hasPlayedOnce = false;
    progress.value = 0;
    timeCurrent.textContent = formatTime(0);
    timeDuration.textContent = formatTime(0);
  });

  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && !isNaN(audio.duration)) timeDuration.textContent = formatTime(audio.duration);
  });
  audio.addEventListener('timeupdate', () => {
    if (!isNaN(audio.duration)) {
      progress.value = (audio.currentTime / audio.duration) * 100;
      timeCurrent.textContent = formatTime(audio.currentTime);
    }
  });

  progress.addEventListener('input', () => {
    if (!isNaN(audio.duration)) {
      audio.currentTime = (progress.value / 100) * audio.duration;
    }
  });

  // ✅ исправленный обработчик для кнопки скачивания в плеере
  downloadBtn.add
