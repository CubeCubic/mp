// Общий frontend скрипт для публичной страницы и простых admin-взаимодействий
(async function() {
  if (document.getElementById('tracks')) {
    const tracksContainer = document.getElementById('tracks');
    const albumsContainer = document.getElementById('albums');

    const playerEl = document.getElementById('player');
    const audio = document.getElementById('audio');
    const playBtn = document.getElementById('play');
    const prevBtn = document.getElementById('prev');
    const nextBtn = document.getElementById('next');
    const volume = document.getElementById('volume');
    const downloadLink = document.getElementById('download');
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
    let userSeeking = false;
    let hasPlayedOnce = false;

    playerEl.classList.add('hidden');
    mini.classList.add('hidden');
    lyricsModal && lyricsModal.classList.add('hidden');

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
        el.innerHTML = `<strong>${escapeHtml(a.name)}</strong>`;
        albumsContainer.appendChild(el);
      });

      tracksContainer.innerHTML = '';
      tracks.forEach((t, idx) => {
        const el = document.createElement('div');
        el.className = 'card';
        el.innerHTML = `
          ${t.coverUrl ? `<img class="track-cover" src="${t.coverUrl}" data-id="${t.id}">` : (t.cover ? `<img class="track-cover" src="/uploads/${t.cover}" data-id="${t.id}">` : '')}
          <div class="track-info">
            <h4 class="track-title" data-id="${t.id}">${escapeHtml(t.title)}</h4>
            <div>${escapeHtml(t.artist || '')}</div>
          </div>
          <div class="track-actions">
            <button data-download="${t.audioUrl ? t.audioUrl : (t.filename ? '/uploads/' + t.filename : '')}">ჩამოტვირთვა</button>
            <button data-like="${t.id}">❤ <span>${t.likes||0}</span></button>
          </div>
        `;

        const img = el.querySelector('.track-cover');
        if (img) img.addEventListener('click', () => togglePlayById(t.id));
        const title = el.querySelector('.track-title');
        if (title) title.addEventListener('click', () => togglePlayById(t.id));

        el.querySelector('[data-like]')?.addEventListener('click', async (e) => {
          const res = await fetch(`/api/tracks/${t.id}/like`, { method: 'POST' });
          const json = await res.json();
          e.currentTarget.querySelector('span').textContent = json.likes;
        });

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

    function getTrackStreamUrl(t) {
      if (t.audioUrl) return t.audioUrl;
      if (t.filename) return `/media/${t.filename}`;
      return null;
    }

    function togglePlayById(id) {
      const idx = tracks.findIndex(x => x.id === id);
      if (idx === -1) return;
      if (currentIndex === idx) {
        if (audio.paused) {
          audio.play().catch(err => console.warn('Play failed', err));
        } else {
          audio.pause();
        }
      } else {
        currentIndex = idx;
        const t = tracks[currentIndex];
        const url = getTrackStreamUrl(t);
        if (!url) {
          alert('Audio not available for this track');
          return;
        }
        audio.src = url;
        titleEl.textContent = t.title;
        artistEl.textContent = t.artist || '';
        if (t.coverUrl) coverImg.src = t.coverUrl; else if (t.cover) coverImg.src = `/uploads/${t.cover}`; else coverImg.src = '';
        downloadLink.setAttribute('data-download', url);
        audio.play().catch(err => console.warn('play failed', err));
      }
    }

    playBtn?.addEventListener('click', () => {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
    });

    prevBtn?.addEventListener('click', () => {
      if (tracks.length === 0) return;
      currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
      const t = tracks[currentIndex];
      const url = getTrackStreamUrl(t);
      if (!url) return;
      audio.src = url;
      titleEl.textContent = t.title;
      artistEl.textContent = t.artist || '';
      if (t.coverUrl) coverImg.src = t.coverUrl; else if (t.cover) coverImg.src = `/uploads/${t.cover}`; else coverImg.src = '';
      downloadLink.setAttribute('data-download', url);
      audio.play().catch(() => {});
    });

    nextBtn?.addEventListener('click', () => {
      if (tracks.length === 0) return;
      currentIndex = (currentIndex + 1) % tracks.length;
      const t = tracks[currentIndex];
      const url = getTrackStreamUrl(t);
      if (!url) return;
      audio.src = url;
      titleEl.textContent = t.title;
      artistEl.textContent = t.artist || '';
      if (t.coverUrl) coverImg.src = t.coverUrl; else if (t.cover) coverImg.src = `/uploads/${t.cover}`; else coverImg.src = '';
      downloadLink.setAttribute('data-download', url);
      audio.play().catch(() => {});
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
      } else {
        playerEl.classList.add('hidden');
        mini.classList.add('hidden');
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
      load();

