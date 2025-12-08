// frontend/app.js — Cube Cubic frontend logic
(function() {
  // DOM refs
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

  // State
  let tracks = [];
  let albums = [];
  let currentIndex = -1;
  let hasPlayedOnce = false;

  // Helpers
  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
      .replace(/&/g, '&amp;')
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
    // Prefer direct audioUrl; else use server media route; else uploads
    if (t.audioUrl) return t.audioUrl;
    if (t.filename) return `/media/${t.filename}`; // ensure backend serves this
    if (t.file) return `/uploads/${t.file}`;
    return null;
  }

  async function load() {
    // Ensure containers exist; if not, do nothing.
    if (!tracksContainer || !albumsContainer) return;

    try {
      const [tracksRes, albumsRes] = await Promise.all([
        fetch('/api/tracks'),
        fetch('/api/albums')
      ]);

      if (!tracksRes.ok) throw new Error(`Tracks fetch failed: ${tracksRes.status}`);
      if (!albumsRes.ok) throw new Error(`Albums fetch failed: ${albumsRes.status}`);

      tracks = await tracksRes.json();
      albums = await albumsRes.json();
      render();
    } catch (err) {
      console.error('Load error:', err);
      // Minimal fallback UI
      albumsContainer.innerHTML = '';
      tracksContainer.innerHTML = `<div class="card"><div>ტრეკების ჩატვირთვა ვერ მოხერხდა</div></div>`;
    }
  }

  function render() {
    // Albums
    albumsContainer.innerHTML = '';
    albums.forEach(a => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<strong>${escapeHtml(a.name || '')}</strong>`;
      albumsContainer.appendChild(el);
    });

    // Tracks — vertical cards (cover top, title/artist, buttons)
    tracksContainer.innerHTML = '';
    tracks.forEach(t => {
      const coverSrc =
        t.coverUrl ? t.coverUrl :
        t.cover ? `/uploads/${t.cover}` : '';

      const downloadUrl =
        t.audioUrl ? t.audioUrl :
        t.filename ? `/uploads/${t.filename}` : '';

      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        ${coverSrc ? `<img class="track-cover" src="${coverSrc}" alt="">` : ''}
        <h4 class="track-title">${escapeHtml(t.title || '')}</h4>
        <div>${escapeHtml(t.artist || '')}</div>
        <div class="track-actions">
          <button data-download="${downloadUrl}">ჩამოტვირთვა</button>
          <button data-like="${t.id}">❤ <span>${t.likes || 0}</span></button>
        </div>
      `;

      // Play on cover/title click
      const img = el.querySelector('.track-cover');
      if (img) img.addEventListener('click', () => playTrack(t));
      const title = el.querySelector('.track-title');
      if (title) title.addEventListener('click', () => playTrack(t));

      // Like
      el.querySelector('[data-like]')?.addEventListener('click', async (e) => {
        try {
          const res = await fetch(`/api/tracks/${t.id}/like`, { method: 'POST' });
          if (!res.ok) return;
          const json = await res.json();
          e.currentTarget.querySelector('span').textContent = json.likes;
        } catch {}
      });

      // Download without navigation
      el.querySelector('[data-download]')?.addEventListener('click', (e) => {
        const url = e.currentTarget.getAttribute('data-download');
        if (!url) return;
        const a = document.createElement('a');
        a.href = url;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });

      tracksContainer.appendChild(el);
    });
  }

  function playTrack(t) {
    const url = getTrackStreamUrl(t);
    if (!url) return;

    currentIndex = tracks.findIndex(x => x.id === t.id);
    audio.src = url;

    titleEl && (titleEl.textContent = t.title || '');
    artistEl && (artistEl.textContent = t.artist || '');

    if (coverImg) {
      if (t.coverUrl) coverImg.src = t.coverUrl;
      else if (t.cover) coverImg.src = `/uploads/${t.cover}`;
      else coverImg.removeAttribute('src');
    }

    if (downloadBtn) downloadBtn.setAttribute('data-download', url);

    audio.play().catch(() => {});
  }

  // Player controls
  playBtn?.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  prevBtn?.addEventListener('click', () => {
    if (!tracks.length) return;
    currentIndex = currentIndex <= 0 ? tracks.length - 1 : currentIndex - 1;
    playTrack(tracks[currentIndex]);
  });

  nextBtn?.addEventListener('click', () => {
    if (!tracks.length) return;
    currentIndex = (currentIndex + 1) % tracks.length;
    playTrack(tracks[currentIndex]);
  });

  volume?.addEventListener('input', () => {
    audio.volume = Number(volume.value);
  });

  miniResumeBtn?.addEventListener('click', () => {
    audio.play().catch(() => {});
  });

  showLyricsBtn?.addEventListener('click', () => {
    if (currentIndex === -1 || !lyricsModal) return;
    const t = tracks[currentIndex];
    modalTitle && (modalTitle.textContent = t.title || 'ლირიკა');
    modalLyrics && (modalLyrics.textContent = t.lyrics || 'ლირიკა არ არის');
    lyricsModal.classList.remove('hidden');
  });

  modalClose?.addEventListener('click', () => lyricsModal?.classList.add('hidden'));
  lyricsModal?.addEventListener('click', (e) => {
    if (e.target === lyricsModal) lyricsModal.classList.add('hidden');
  });

  // Audio events
  audio.addEventListener('play', () => {
    playerEl?.classList.remove('hidden');
    mini?.classList.add('hidden');
    if (playBtn) playBtn.textContent = '⏸';
    hasPlayedOnce = true;
  });

  audio.addEventListener('pause', () => {
    if (playBtn) playBtn.textContent = '▶';
    if (hasPlayedOnce) {
      playerEl?.classList.add('hidden');
      mini?.classList.remove('hidden');
    }
  });

  audio.addEventListener('ended', () => {
    playerEl?.classList.add('hidden');
    mini?.classList.add('hidden');
    lyricsModal?.classList.add('hidden');
    audio.src = '';
    currentIndex = -1;
    hasPlayedOnce = false;
    if (progress) progress.value = 0;
    if (timeCurrent) timeCurrent.textContent = formatTime(0);
    if (timeDuration) timeDuration.textContent = formatTime(0);
  });

  audio.addEventListener('loadedmetadata', () => {
    if (timeDuration && isFinite(audio.duration)) {
      timeDuration.textContent = formatTime(audio.duration);
    }
  });

  audio.addEventListener('timeupdate', () => {
    if (!isFinite(audio.duration)) return;
    if (progress) progress.value = (audio.currentTime / audio.duration) * 100;
    if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
  });

  progress?.addEventListener('input', () => {
    if (!isFinite(audio.duration)) return;
    audio.currentTime = (progress.value / 100) * audio.duration;
  });

  // Download from player without navigation
  downloadBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const url = downloadBtn.getAttribute('data-download');
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // Start after DOM is ready
  document.addEventListener('DOMContentLoaded', load);
})();
