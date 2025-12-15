(function () {
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  const globalSearchInput = document.getElementById('global-search');
  const albumListContainer = document.getElementById('album-list');

  // Вертикальный плеер
  const playerSidebar = document.getElementById('player-sidebar');
  const playerCoverImg = document.getElementById('player-cover-img');
  const playerTitleSidebar = document.getElementById('player-title-sidebar');
  const playerArtistSidebar = document.getElementById('player-artist-sidebar');
  const playBtnSidebar = document.getElementById('play-sidebar');
  const prevBtnSidebar = document.getElementById('prev-sidebar');
  const nextBtnSidebar = document.getElementById('next-sidebar');
  const progressSidebar = document.getElementById('progress-sidebar');
  const timeCurrentSidebar = document.getElementById('time-current-sidebar');
  const timeDurationSidebar = document.getElementById('time-duration-sidebar');
  const volumeSidebar = document.getElementById('volume-sidebar');
  const showLyricsSidebar = document.getElementById('show-lyrics-sidebar');
  const downloadSidebar = document.getElementById('download-sidebar');

  const audio = document.getElementById('audio');

  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  const contactBtn = document.getElementById('contact-btn');
  const contactModal = document.getElementById('contact-modal');
  const contactClose = document.getElementById('contact-close');
  const contactForm = document.getElementById('contact-form');
  const contactStatus = document.getElementById('contact-status');

  const shareModal = document.getElementById('share-modal');
  const shareModalClose = document.getElementById('share-modal-close');
  const shareUrlInput = document.getElementById('share-url-input');
  const shareCopyBtn = document.getElementById('share-copy-btn');
  const toast = document.getElementById('toast');

  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let filteredTracks = [];
  let pendingTrackToOpen = null;

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

  function safeStr(v) { return (v == null) ? '' : String(v); }

  // Обновление плеера
  function updateSidebarPlayer(t = null) {
    if (!t) {
      playerTitleSidebar.textContent = 'Выберите трек';
      playerArtistSidebar.textContent = '';
      playerCoverImg.src = 'images/midcube.png';
      playBtnSidebar.textContent = '▶';
      playerSidebar.classList.remove('playing');
      showLyricsSidebar.style.display = 'none';
      downloadSidebar.style.display = 'none';
      return;
    }

    playerTitleSidebar.textContent = safeStr(t.title);
    playerArtistSidebar.textContent = safeStr(t.artist);
    playerCoverImg.src = getCoverUrl(t);
    playerSidebar.classList.add('playing');

    if (t.lyrics) {
      showLyricsSidebar.style.display = 'block';
    } else {
      showLyricsSidebar.style.display = 'none';
    }

    const stream = getStreamUrl(t);
    if (stream) {
      downloadSidebar.href = stream;
      downloadSidebar.style.display = 'inline-flex';
      let suggested = '';
      try {
        const u = new URL(stream);
        suggested = u.pathname.split('/').pop() || '';
      } catch {}
      downloadSidebar.download = suggested;
    } else {
      downloadSidebar.style.display = 'none';
    }
  }

  // Рендер альбомов с счётчиком
  function renderAlbumList() {
    if (!albumListContainer) return;
    albumListContainer.innerHTML = '';

    if (!albums || !albums.length) return;

    let mains = albums.filter(a => !a.parentId);

    mains.sort((a, b) => {
      if (a.name === 'Georgian') return -1;
      if (b.name === 'Georgian') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    mains.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-list-button';
      btn.setAttribute('data-album-id', a.id || '');

      const nameSpan = document.createElement('span');
      nameSpan.textContent = a.name || 'Unnamed';
      btn.appendChild(nameSpan);

      const subIds = albums.filter(sub => String(sub.parentId || '') === String(a.id)).map(sub => sub.id);
      const trackCount = tracks.filter(t => {
        const albumId = String(t.albumId || '');
        return albumId === String(a.id) || subIds.includes(albumId);
      }).length;

      const countSpan = document.createElement('span');
      countSpan.className = 'track-count';
      countSpan.textContent = `(${trackCount})`;
      btn.appendChild(countSpan);

      if (String(albumSelect.value || '') === String(a.id || '')) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        albumSelect.value = String(a.id || '');
        renderAlbumList();
        onAlbumChange();
      });

      albumListContainer.appendChild(btn);
    });
  }

  // Остальные функции (buildAlbumSelectors, onAlbumChange, renderTracks, loadData и т.д.) — оставьте как в предыдущей версии

  // Плеер
  function playTrackByIndex(idx) {
    if (idx < 0 || idx >= filteredTracks.length) {
      updateSidebarPlayer(null);
      audio.pause();
      return;
    }
    currentTrackIndex = idx;
    const t = filteredTracks[idx];
    updateSidebarPlayer(t);
    audio.src = getStreamUrl(t) || '';
    audio.load();
    audio.play().catch(e => console.error(e));
    playBtnSidebar.textContent = '❚❚';
  }

  function togglePlayPause() {
    if (audio.paused || audio.ended) {
      audio.play().catch(e => console.error(e));
    } else {
      audio.pause();
    }
  }

  function playNext() {
    if (filteredTracks.length <= 1) return;
    let next = currentTrackIndex + 1;
    if (next >= filteredTracks.length) next = 0;
    playTrackByIndex(next);
  }

  function playPrev() {
    if (filteredTracks.length <= 1) return;
    let prev = currentTrackIndex - 1;
    if (prev < 0) prev = filteredTracks.length - 1;
    playTrackByIndex(prev);
  }

  audio.addEventListener('playing', () => playBtnSidebar.textContent = '❚❚');
  audio.addEventListener('pause', () => playBtnSidebar.textContent = '▶');
  audio.addEventListener('ended', playNext);
  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      progressSidebar.value = audio.currentTime;
      progressSidebar.max = audio.duration;
      timeCurrentSidebar.textContent = formatTime(audio.currentTime);
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    timeDurationSidebar.textContent = formatTime(audio.duration);
    progressSidebar.max = audio.duration || 0;
  });
  audio.addEventListener('volumechange', () => volumeSidebar.value = audio.volume);

  playBtnSidebar.addEventListener('click', togglePlayPause);
  prevBtnSidebar.addEventListener('click', playPrev);
  nextBtnSidebar.addEventListener('click', playNext);
  progressSidebar.addEventListener('input', () => audio.currentTime = progressSidebar.value);
  volumeSidebar.addEventListener('input', () => audio.volume = parseFloat(volumeSidebar.value));
  showLyricsSidebar.addEventListener('click', () => {
    const t = filteredTracks[currentTrackIndex];
    if (t && t.lyrics) {
      modalTitle.textContent = t.title || 'Lyrics';
      modalLyrics.textContent = t.lyrics;
      lyricsModal.classList.remove('hidden');
      lyricsModal.setAttribute('aria-hidden', 'false');
    }
  });

  // Инициализация
  document.addEventListener('DOMContentLoaded', () => {
    parseDeepLink();
    loadData();
    if (volumeSidebar) audio.volume = parseFloat(volumeSidebar.value || 1);
    updateSidebarPlayer(null);
  });

  // ... (все остальные функции: loadData, renderTracks, модалки, шаринг — без изменений из предыдущей версии)
})();