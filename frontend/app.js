// Общий frontend скрипт для публичной страницы и простых admin-взаимодействий
(async function() {
  // Public page code only runs on index.html
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

    // Progress elements
    const progress = document.getElementById('progress');
    const timeCurrent = document.getElementById('time-current');
    const timeDuration = document.getElementById('time-duration');

    // Mini player
    const mini = document.getElementById('player-mini');
    const miniResumeBtn = document.getElementById('mini-resume');

    // Lyrics modal elements (modal HTML is in index.html)
    const lyricsModal = document.getElementById('lyrics-modal');
    const modalClose = document.getElementById('modal-close');
    const modalTitle = document.getElementById('modal-title');
    const modalLyrics = document.getElementById('modal-lyrics');

    let tracks = [];
    let albums = [];
    let currentIndex = -1;
    let userSeeking = false;
    let hasPlayedOnce = false; // чтобы не показывать мини до первого запуска

    // Initially ensure everything hidden
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
          <h4 class="track-title" data-id="${t.id}">${escapeHtml(t.title)}</h4>
          <div>${escapeHtml(t.artist || '')}</div>
          <div>
            <a href="${t.audioUrl ? t.audioUrl : (t.filename ? '/uploads/' + t.filename : '#')}" download>ჩამოტვირთვა</a>
            <button data-like="${t.id}">❤ <span>${t.likes||0}</span></button>
          </div>
        `;
        // click on image or title toggles playback for that track
        const img = el.querySelector('.track-cover');
        if (img) img.addEventListener('click', () => togglePlayById(t.id));
        const title = el.querySelector('.track-title');
        if (title) title.addEventListener('click', () => togglePlayById(t.id));

        el.querySelector('[data-like]') && el.querySelector('[data-like]').addEventListener('click', async (e) => {
          const res = await fetch(`/api/tracks/${t.id}/like`, { method: 'POST' });
          const json = await res.json();
          e.currentTarget.querySelector('span').textContent = json.likes;
        });
        tracksContainer.appendChild(el);
      });
    }

    function getTrackStreamUrl(t) {
      // prefer external URL (archive.org) if present; else fallback to local streaming route
      if (t.audioUrl) return t.audioUrl;
      if (t.filename) return `/media/${t.filename}`;
      return null;
    }

    function togglePlayById(id) {
      const idx = tracks.findIndex(x => x.id === id);
      if (idx === -1) return;
      // If clicking same track
      if (currentIndex === idx) {
        if (audio.paused) {
          audio.play().catch(err => console.warn('Play failed', err));
        } else {
          audio.pause();
        }
      } else {
        // different track: load and play
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
        downloadLink.href = url;
        // do NOT force-show player here; show on 'play' event
        audio.play().then(() => {
          // success -> 'play' event will fire and show player
        }).catch(err => {
          // if user-initiated click, play() should not be blocked; log but continue
          console.warn('play failed', err);
          hasPlayedOnce = true;
        });
      }
    }

    // Controls
    playBtn && playBtn.addEventListener('click', () => {
      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause();
      }
    });
    prevBtn && prevBtn.addEventListener('click', () => {
      if (tracks.length === 0) return;
      currentIndex = (currentIndex - 1 + tracks.length) % tracks.length;
      const t = tracks[currentIndex];
      const url = getTrackStreamUrl(t);
      if (!url) return;
      audio.src = url;
      titleEl.textContent = t.title;
      artistEl.textContent = t.artist || '';
      if (t.coverUrl) coverImg.src = t.coverUrl; else if (t.cover) coverImg.src = `/uploads/${t.cover}`; else coverImg.src = '';
      downloadLink.href = url;
      audio.play().catch(() => {});
    });
    nextBtn && nextBtn.addEventListener('click', () => {
      if (tracks.length === 0) return;
      currentIndex = (currentIndex + 1) % tracks.length;
      const t = tracks[currentIndex];
      const url = getTrackStreamUrl(t);
      if (!url) return;
      audio.src = url;
      titleEl.textContent = t.title;
      artistEl.textContent = t.artist || '';
      if (t.coverUrl) coverImg.src = t.coverUrl; else if (t.cover) coverImg.src = `/uploads/${t.cover}`; else coverImg.src = '';
      downloadLink.href = url;
      audio.play().catch(() => {});
    });
    volume && volume.addEventListener('input', () => { audio.volume = volume.value; });

    // Mini resume button click
    miniResumeBtn && miniResumeBtn.addEventListener('click', () => {
      audio.play().catch(() => {});
    });

    // Show lyrics modal (button in player)
    showLyricsBtn && showLyricsBtn.addEventListener('click', () => {
      if (currentIndex === -1) return;
      const t = tracks[currentIndex];
      modalTitle.textContent = t.title || 'ლირიკა';
      modalLyrics.textContent = t.lyrics || 'ლირიკა არ არის';
      lyricsModal && lyricsModal.classList.remove('hidden');
    });
    modalClose && modalClose.addEventListener('click', () => lyricsModal && lyricsModal.classList.add('hidden'));
    lyricsModal && lyricsModal.addEventListener('click', (e) => {
      if (e.target === lyricsModal) lyricsModal.classList.add('hidden');
    });

    // Audio events: play, pause, ended
    audio.addEventListener('play', () => {
      // Show full player when playback actually starts
      playerEl.classList.remove('hidden');
      mini.classList.add('hidden');
      playBtn.textContent = '⏸';
      hasPlayedOnce = true;
    });
    audio.addEventListener('pause', () => {
      playBtn.textContent = '▶';
      if (hasPlayedOnce) {
        // show mini on pause
        playerEl.classList.add('hidden');
        mini.classList.remove('hidden');
      } else {
        playerEl.classList.add('hidden');
        mini.classList.add('hidden');
      }
    });
    audio.addEventListener('ended', () => {
      // When track ends, hide all and reset
      playerEl.classList.add('hidden');
      mini.classList.add('hidden');
      lyricsModal && lyricsModal.classList.add('hidden');
      audio.src = '';
      currentIndex = -1;
      hasPlayedOnce = false;
      // reset progress
      progress.value = 0;
      timeCurrent.textContent = formatTime(0);
      timeDuration.textContent = formatTime(0);
    });

    // Progress handling
    audio.addEventListener('loadedmetadata', () => {
      if (audio.duration && !isNaN(audio.duration)) {
        timeDuration.textContent = formatTime(audio.duration);
      } else {
        timeDuration.textContent = '0:00';
      }
    });
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration || isNaN(audio.duration)) return;
      if (!userSeeking) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.value = percent;
        timeCurrent.textContent = formatTime(audio.currentTime);
      }
    });

    // Seeking via progress input
    progress.addEventListener('input', () => {
      userSeeking = true;
      if (audio.duration && !isNaN(audio.duration)) {
        const newTime = (progress.value / 100) * audio.duration;
        timeCurrent.textContent = formatTime(newTime);
      }
    });
    progress.addEventListener('change', () => {
      if (audio.duration && !isNaN(audio.duration)) {
        const newTime = (progress.value / 100) * audio.duration;
        audio.currentTime = newTime;
      }
      userSeeking = false;
    });

    // Escape helper
    function escapeHtml(s){ return (s||'').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]); }

    function formatTime(sec){
      sec = Math.floor(sec || 0);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2,'0')}`;
    }

    await load();
  }

  // Admin page admin.js is loaded separately (see admin.html)
})();
