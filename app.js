(function () {
  // --- Элементы DOM ---
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

  // Waveform
  const waveformContainer = document.getElementById('waveform');

  // Модалки
  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  const toast = document.getElementById('toast');
  const refreshBtn = document.getElementById('refresh-btn');

  // --- Состояние ---
  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let filteredTracks = [];
  let pendingTrackToOpen = null;
  let userHasInteracted = false;
  let wavesurfer = null; // объект wavesurfer

  // --- Утилиты ---
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

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 3000);
  }

  async function triggerDownload(url, filename = 'track.mp3') {
    if (!url || url.trim() === '') {
      showToast('ფაილი არ არის ხელმისაწვდომი');
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network error');

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch (err) {
      console.error('Download error:', err);
      showToast('შეცდომა ჩამოტვირთვისას');
    }
  }

  // --- Подсветка и автоскролл текущего трека ---
  function highlightCurrentTrack() {
    const allCards = tracksContainer.querySelectorAll('.card');
    allCards.forEach(card => card.classList.remove('playing-track'));

    if (currentTrackIndex >= 0 && currentTrackIndex < filteredTracks.length) {
      const currentTrack = filteredTracks[currentTrackIndex];
      const currentCard = tracksContainer.querySelector(`[data-track-id="${currentTrack.id}"]`);
      if (currentCard) {
        currentCard.classList.add('playing-track');
        currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // --- Рендер списка альбомов --- (оставляем как было)

  // --- Плеер с waveform ---
  function updateSidebarPlayer(t = null) {
    if (!t) {
      playerTitleSidebar.textContent = 'აირჩიეთ ტრეკი';
      playerArtistSidebar.textContent = '';
      playerCoverImg.src = 'images/midcube.png';
      playBtnSidebar.textContent = '▶';
      playerSidebar.classList.remove('playing');
      showLyricsSidebar.style.display = 'none';
      downloadSidebar.style.display = 'none';

      if (wavesurfer) {
        wavesurfer.destroy();
        wavesurfer = null;
      }
      return;
    }

    playerTitleSidebar.textContent = safeStr(t.title);
    playerArtistSidebar.textContent = safeStr(t.artist);
    playerCoverImg.src = getCoverUrl(t);
    playerSidebar.classList.add('playing');

    showLyricsSidebar.style.display = t.lyrics ? 'block' : 'none';

    const stream = getStreamUrl(t);
    if (stream && stream.trim() !== '') {
      downloadSidebar.href = stream;
      downloadSidebar.style.display = 'inline-flex';
      let suggested = 'track.mp3';
      try {
        const u = new URL(stream);
        suggested = decodeURIComponent(u.pathname.split('/').pop() || 'track.mp3');
      } catch {}
      downloadSidebar.download = suggested;
    } else {
      downloadSidebar.style.display = 'none';
    }

    // Инициализация или обновление waveform
    if (wavesurfer) {
      wavesurfer.load(stream);
    } else {
      wavesurfer = WaveSurfer.create({
        container: '#waveform',
        waveColor: '#ccc',
        progressColor: '#ffcc00',
        cursorColor: '#ffcc00',
        barWidth: 3,
        barRadius: 3,
        cursorWidth: 2,
        height: 80,
        barGap: 2,
        responsive: true,
        normalize: true,
        backend: 'MediaElement', // важно для совместимости с <audio>
      });

      wavesurfer.load(stream);

      // Синхронизация с основным аудио
      wavesurfer.on('ready', () => {
        wavesurfer.play();
      });

      audio.addEventListener('play', () => wavesurfer.play());
      audio.addEventListener('pause', () => wavesurfer.pause());
      audio.addEventListener('seek', () => {
        const percent = audio.currentTime / audio.duration;
        wavesurfer.seekTo(percent);
      });
    }
  }

  function playTrackByIndex(idx) {
    if (idx < 0 || idx >= filteredTracks.length) {
      updateSidebarPlayer(null);
      audio.pause();
      currentTrackIndex = -1;
      highlightCurrentTrack();
      return;
    }

    currentTrackIndex = idx;
    const t = filteredTracks[idx];
    updateSidebarPlayer(t);

    audio.src = getStreamUrl(t) || '';
    audio.load();

    audio.play().catch(e => {
      if (e.name === 'NotAllowedError' && userHasInteracted) {
        playBtnSidebar.textContent = '▶';
        showToast('დააჭირეთ ▶ დაკვრისთვის');
      } else if (e.name !== 'NotAllowedError') {
        console.error('Play error:', e);
      }
    });

    highlightCurrentTrack();
  }

  // ... остальной код (togglePlayPause, playNext, playPrev, обработчики и т.д.) остаётся без изменений ...

  document.addEventListener('DOMContentLoaded', () => {
    parseDeepLink();
    loadData();

    audio.volume = parseFloat(volumeSidebar?.value || 1);
    updateSidebarPlayer(null);
  });
})();