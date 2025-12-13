// Cube Cubic — главная страница.
// Источник данных: tracks.json (в корне репозитория).
// Реализовано:
// - Альбомы/треки без Artist;
// - Колонка маленького кавера перед Title;
// - Модалка увеличенного кавера;
// - Модалка текста (кнопка «ტექსტი» подсвечивается при наличии);
// - Поиск по текущему альбому;
// - Скачивание по конкретному URL (downloadUrl);
// - Проигрыватель: воспроизведение/пауза, prev/next, прогресс, время, громкость;
// - Устойчивость к отсутствующим файлам: onerror + fallback.

document.addEventListener('DOMContentLoaded', () => {
  // DOM refs
  const albumsContainer = document.getElementById('albums');
  const tracksTableBody = document.querySelector('#tracks tbody');
  const searchInput = document.getElementById('search');

  const coverModal = document.getElementById('cover-modal');
  const coverModalImg = document.getElementById('cover-modal-img');
  const coverModalClose = document.getElementById('cover-modal-close');

  const lyricsModal = document.getElementById('lyrics-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');
  const closeLyrics = document.getElementById('close-lyrics');

  // Player refs
  const playerTitle = document.getElementById('player-title');
  const playerProgressBar = document.getElementById('player-progress');
  const playerHandle = document.getElementById('player-handle');
  const playerCurrentTimeEl = document.getElementById('player-current');
  const playerDurationEl = document.getElementById('player-duration');
  const btnPrev = document.getElementById('btn-prev');
  const btnPlay = document.getElementById('btn-play');
  const btnNext = document.getElementById('btn-next');
  const volumeRange = document.getElementById('volume');

  // Fallbacks
  const FALLBACK = {
    cover: 'images/placeholder-cover.png', // создай этот файл для красивой заглушки
    audio: 'tracks/silence.mp3'            // короткая тишина, если аудио не найдено
  };

  // Audio
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';

  // State
  let albums = [];
  let currentAlbumIndex = 0;
  let currentTrackIndex = 0;
  let filteredTracks = null;

  // Load data
  fetch('tracks.json', { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error('tracks.json not found');
      const data = await res.json();
      validateDataShape(data);
      albums = data.albums || [];
      renderAlbums();
      renderTracks(getCurrentTracks());
      selectTrack(0, false);
    })
    .catch((err) => {
      console.error('Ошибка загрузки tracks.json:', err);
      // Минимальный fallback, если файл отсутствует
      albums = [
        {
          title: 'Cube Cubic',
          cover: 'images/midcube.png',
          tracks: [
            { title: 'Cube Cubic', cover: 'images/midcube.png', lyrics: 'Cube Cubic lyrics...', downloadUrl: 'tracks/cube-cubic.mp3' }
          ]
        }
      ];
      renderAlbums();
      renderTracks(getCurrentTracks());
      selectTrack(0, false);
    });

  // Search
  searchInput.addEventListener('input', () => {
    const q = (searchInput.value || '').trim().toLowerCase();
    const tracks = getCurrentTracks();
    if (!q) {
      filteredTracks = null;
      renderTracks(tracks);
      return;
    }
    filteredTracks = tracks.filter(t => (t.title || '').toLowerCase().includes(q));
    renderTracks(filteredTracks);
  });

  // Cover modal
  coverModalClose.addEventListener('click', () => {
    coverModal.setAttribute('aria-hidden', 'true');
  });
  coverModal.addEventListener('click', (e) => {
    if (e.target === coverModal) coverModal.setAttribute('aria-hidden', 'true');
  });

  // Lyrics modal
  closeLyrics.addEventListener('click', () => {
    lyricsModal.classList.add('hidden');
    lyricsModal.setAttribute('aria-hidden', 'true');
  });
  lyricsModal.addEventListener('click', (e) => {
    const content = e.target.closest('.lyrics-content');
    if (!content) {
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    }
  });

  // Player controls
  btnPlay.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => btnPlay.textContent = '⏸').catch(() => {});
    } else {
      audio.pause();
      btnPlay.textContent = '⏯';
    }
  });
  btnPrev.addEventListener('click', () => {
    const list = getActiveTrackList();
    if (!list.length) return;
    currentTrackIndex = (currentTrackIndex - 1 + list.length) % list.length;
    selectTrack(currentTrackIndex, true);
  });
  btnNext.addEventListener('click', () => {
    const list = getActiveTrackList();
    if (!list.length) return;
    currentTrackIndex = (currentTrackIndex + 1) % list.length;
    selectTrack(currentTrackIndex, true);
  });
  volumeRange.addEventListener('input', () => {
    audio.volume = clamp(volumeRange.value / 100, 0, 1);
  });

  audio.addEventListener('timeupdate', updateProgressUI);
  audio.addEventListener('loadedmetadata', () => {
    playerDurationEl.textContent = formatTime(audio.duration);
    updateProgressUI();
  });
  audio.addEventListener('ended', () => {
    const list = getActiveTrackList();
    if (!list.length) return;
    currentTrackIndex = (currentTrackIndex + 1) % list.length;
    selectTrack(currentTrackIndex, true);
  });
  audio.addEventListener('error', () => {
    // Fallback на тишину, чтобы UI не ломался
    audio.src = FALLBACK.audio;
    audio.play().catch(() => {});
  });

  playerProgressBar.addEventListener('click', (e) => {
    const rect = playerProgressBar.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    if (isFinite(audio.duration)) {
      audio.currentTime = audio.duration * ratio;
    }
  });

  // Render albums
  function renderAlbums() {
    albumsContainer.innerHTML = '';
    albums.forEach((album, idx) => {
      const card = document.createElement('div');
      card.className = 'album-card' + (idx === currentAlbumIndex ? ' selected' : '');

      const img = document.createElement('img');
      img.className = 'album-thumb';
      img.src = album.cover;
      img.alt = album.title;
      img.onerror = () => { img.src = FALLBACK.cover; };

      const title = document.createElement('div');
      title.className = 'album-title';
      title.textContent = album.title;

      card.appendChild(img);
      card.appendChild(title);

      card.addEventListener('click', () => {
        currentAlbumIndex = idx;
        document.querySelectorAll('.album-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        filteredTracks = null;
        searchInput.value = '';
        renderTracks(getCurrentTracks());
        selectTrack(0, false);
      });

      albumsContainer.appendChild(card);
    });
  }

  // Render tracks
  function renderTracks(tracks) {
    tracksTableBody.innerHTML = '';

    tracks.forEach((t, i) => {
      const tr = document.createElement('tr');

      const tdNum = document.createElement('td');
      tdNum.className = 'col-num';
      tdNum.textContent = i + 1;
      tr.appendChild(tdNum);

      const tdCover = document.createElement('td');
      tdCover.className = 'col-cover';
      const coverImg = document.createElement('img');
      coverImg.className = 'track-cover';
      coverImg.src = t.cover;
      coverImg.alt = t.title || 'Cover';
      coverImg.onerror = () => { coverImg.src = FALLBACK.cover; };
      coverImg.addEventListener('click', (ev) => {
        ev.stopPropagation();
        coverModalImg.src = coverImg.src;
        coverModal.setAttribute('aria-hidden', 'false');
      });
      tdCover.appendChild(coverImg);
      tr.appendChild(tdCover);

      const tdTitle = document.createElement('td');
      tdTitle.className = 'col-title';
      tdTitle.textContent = t.title || '—';
      tdTitle.style.cursor = 'pointer';
      tdTitle.addEventListener('click', () => {
        const list = getActiveTrackList();
        const idxInList = list.indexOf(t);
        if (idxInList !== -1) {
          currentTrackIndex = idxInList;
          selectTrack(currentTrackIndex, true);
        }
      });
      tr.appendChild(tdTitle);

      const tdActions = document.createElement('td');
      tdActions.className = 'col-actions';

      const btnLyrics = document.createElement('button');
      btnLyrics.type = 'button';
      btnLyrics.className = 'btn btn-lyrics';
      btnLyrics.textContent = 'ტექსტი';
      if (t.lyrics && String(t.lyrics).trim().length) {
        btnLyrics.classList.add('btn-has-lyrics');
      }
      btnLyrics.addEventListener('click', (ev) => {
        ev.stopPropagation();
        modalTitle.textContent = t.title || 'Lyrics';
        modalLyrics.textContent = t.lyrics || '';
        lyricsModal.classList.remove('hidden');
        lyricsModal.setAttribute('aria-hidden', 'false');
      });
      tdActions.appendChild(btnLyrics);

      const btnDownload = document.createElement('button');
      btnDownload.type = 'button';
      btnDownload.className = 'btn btn-icon';
      btnDownload.textContent = '⬇';
      btnDownload.title = 'Download';
      btnDownload.addEventListener('click', (ev) => {
        ev.stopPropagation();
        triggerDownload(t);
      });
      tdActions.appendChild(btnDownload);

      tr.appendChild(tdActions);
      tracksTableBody.appendChild(tr);
    });
  }

  // Player: select track
  function selectTrack(trackIndex, autoplay) {
    const list = getActiveTrackList();
    if (!list.length) return;
    currentTrackIndex = clamp(trackIndex, 0, list.length - 1);
    const track = list[currentTrackIndex];

    playerTitle.textContent = track.title || '—';

    const url = track.downloadUrl || FALLBACK.audio;
    audio.src = url;
    audio.currentTime = 0;

    if (autoplay) {
      audio.play().then(() => {
        btnPlay.textContent = '⏸';
      }).catch(() => {
        btnPlay.textContent = '⏯';
      });
    } else {
      audio.pause();
      btnPlay.textContent = '⏯';
    }

    playerCurrentTimeEl.textContent = '0:00';
    playerDurationEl.textContent = '0:00';
    updateProgressUI();
  }

  // Helpers
  function getActiveTrackList() {
    return Array.isArray(filteredTracks) ? filteredTracks : getCurrentTracks();
  }

  function getCurrentTracks() {
    const album = albums[currentAlbumIndex];
    return album ? album.tracks || [] : [];
  }

  function updateProgressUI() {
    const duration = audio.duration || 0;
    const current = audio.currentTime || 0;
    playerCurrentTimeEl.textContent = formatTime(current);
    playerDurationEl.textContent = isFinite(duration) ? formatTime(duration) : '0:00';

    const barRect = playerProgressBar.getBoundingClientRect();
    const ratio = duration ? clamp(current / duration, 0, 1) : 0;
    const x = ratio * (barRect.width || 0);
    playerHandle.style.left = Math.max(0, Math.floor(x)) + 'px';
  }

  function triggerDownload(track) {
    if (!track || !track.downloadUrl) return;
    const a = document.createElement('a');
    a.href = track.downloadUrl;
    a.download = ''; // можно задать имя: `${track.title}.mp3`
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  function formatTime(sec) {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }

  function validateDataShape(data) {
    if (!data || typeof data !== 'object' || !Array.isArray(data.albums)) {
      console.warn('Неверный формат tracks.json: ожидался объект { albums: [...] }');
    }
  }
});
