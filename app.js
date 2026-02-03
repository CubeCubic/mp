(function () {
  // --- Элементы DOM ---
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');
  const globalSearchInput = document.getElementById('global-search');
  const albumListContainer = document.getElementById('album-list');

  // Плеер элементы
  const headerPlayer = document.getElementById('header-player') || document.getElementById('player-sidebar') || null;
  const playerCoverImg = document.getElementById('player-cover-img') || null;
  const playerTitleSidebar = document.getElementById('player-title-sidebar') || document.getElementById('player-title-header') || null;
  const playerArtistSidebar = document.getElementById('player-artist-sidebar') || document.getElementById('player-artist-header') || null;
  const playBtnSidebar = document.getElementById('play-sidebar') || null;
  const prevBtnSidebar = document.getElementById('prev-sidebar') || null;
  const nextBtnSidebar = document.getElementById('next-sidebar') || null;
  const progressSidebar = document.getElementById('progress-sidebar') || null;
  const timeCurrentSidebar = document.getElementById('time-current-sidebar') || null;
  const timeDurationSidebar = document.getElementById('time-duration-sidebar') || null;
  const volumeSidebar = document.getElementById('volume-sidebar') || null;

  const audio = document.getElementById('audio');

  // Модалки и уведомления
  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  const toast = document.getElementById('toast');
  const refreshBtn = document.getElementById('refresh-btn');
  const tracksCountEl = document.getElementById('tracks-count');

  // --- Состояние ---
  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let filteredTracks = [];
  let pendingTrackToOpen = null;
  let userHasInteracted = false;

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

  // Fisher-Yates shuffle
  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  function updateTracksCount() {
    if (!tracksCountEl) return;
    const total = Array.isArray(tracks) ? tracks.length : 0;
    tracksCountEl.textContent = `სულ ${total}`;
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

  function getAlbumNameForTrack(t) {
    if (!t || !t.albumId) return '';
    const album = albums.find(a => String(a.id) === String(t.albumId));
    return album ? album.name || '' : '';
  }

  // --- Модалка с текстом ---
  function openLyricsModal(track) {
    if (!lyricsModal) return;

    const modalTitleEl = document.getElementById('modal-title');
    const modalLyricsEl = document.getElementById('modal-lyrics');
    const modalCoverImg = document.getElementById('modal-cover-img');

    modalTitleEl.textContent = track.title || 'Untitled';
    modalLyricsEl.textContent = track.lyrics || 'Текст отсутствует';

    if (modalCoverImg) {
      modalCoverImg.style.visibility = 'hidden';
      modalCoverImg.src = '';
      modalCoverImg.alt = track.title || 'Cover';
    }

    lyricsModal.classList.remove('hidden');
    lyricsModal.setAttribute('aria-hidden', 'false');

    if (modalCoverImg) {
      modalCoverImg.onload = function() {
        modalCoverImg.style.visibility = 'visible';
      };
      modalCoverImg.onerror = function() {
        modalCoverImg.style.visibility = 'hidden';
        console.warn('Cover image failed to load:', track.coverSrc || track.coverUrl || track.cover);
      };

      const url = getCoverUrl(track);
      if (url) modalCoverImg.src = url;
    }
  }

  function closeLyricsModal() {
    if (!lyricsModal) return;
    lyricsModal.classList.add('hidden');
    lyricsModal.setAttribute('aria-hidden', 'true');
  }

  // --- Подсветка и автоскролл текущего трека ---
  function highlightCurrentTrack() {
    const allCards = tracksContainer ? tracksContainer.querySelectorAll('.card') : [];
    allCards.forEach(card => card.classList.remove('playing-track'));

    if (currentTrackIndex >= 0 && currentTrackIndex < filteredTracks.length) {
      const currentTrack = filteredTracks[currentTrackIndex];
      const currentCard = tracksContainer ? tracksContainer.querySelector(`[data-track-id="${currentTrack.id}"]`) : null;
      if (currentCard) {
        currentCard.classList.add('playing-track');
        currentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // --- Рендер списка альбомов (без привязки обработчиков) ---
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

      if (String(albumSelect ? albumSelect.value : '') === String(a.id || '')) {
        btn.classList.add('selected');
      }

      albumListContainer.appendChild(btn);
    });
  }

  // --- Делегирование кликов по списку альбомов (устойчиво к перерисовке) ---
  if (albumListContainer) {
    albumListContainer.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.album-list-button');
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();
      const albumId = btn.getAttribute('data-album-id') || '';
      if (albumSelect) albumSelect.value = String(albumId);
      renderAlbumList();
      onAlbumChange();
    });
  }

  function buildAlbumSelectors() {
    if (albumSelect) albumSelect.value = '';

    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— ყველა ქვეალბომი —';
      subalbumSelect.appendChild(opt);
      subalbumSelect.disabled = true;
      subalbumSelect.style.display = 'none';
      if (subalbumLabel) subalbumLabel.style.display = 'none';
    }

    renderAlbumList();
  }

  function onAlbumChange() {
    const currentAlbumId = albumSelect ? albumSelect.value : '';

    if (subalbumSelect) {
      const subs = albums.filter(a => String(a.parentId || '') === currentAlbumId);
      subalbumSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = '— ყველა ქვეალბომი —';
      subalbumSelect.appendChild(opt);
      if (subs.length) {
        subs.forEach(s => {
          const o = document.createElement('option');
          o.value = s.id;
          o.textContent = s.name;
          subalbumSelect.appendChild(o);
        });
        subalbumSelect.disabled = false;
        subalbumSelect.style.display = '';
        if (subalbumLabel) subalbumLabel.style.display = '';
      } else {
        subalbumSelect.disabled = true;
        subalbumSelect.style.display = 'none';
        if (subalbumLabel) subalbumLabel.style.display = 'none';
      }
      subalbumSelect.value = '';
    }

    // При смене альбома — рендерим треки, но сохраняем текущий трек, если он остаётся в новом наборе
    renderTracks();
    renderAlbumList();

    // Если текущий трек не входит в новый filteredTracks — останавливаем
    if (currentTrackIndex >= 0) {
      const cur = filteredTracks[currentTrackIndex];
      if (!cur) {
        currentTrackIndex = -1;
        updateSidebarPlayer(null);
      }
    }
  }

  // --- Поиск ---
  function matchesQuery(track, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      safeStr(track.title).toLowerCase().includes(q) ||
      safeStr(track.artist).toLowerCase().includes(q) ||
      safeStr(track.lyrics).toLowerCase().includes(q) ||
      (albums.find(a => String(a.id) === String(track.albumId)) || {}).name?.toLowerCase().includes(q)
    );
  }

  function applySearch() {
    const query = globalSearchInput ? globalSearchInput.value.trim() : '';
    filteredTracks = tracks.filter(t => matchesQuery(t, query));
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', () => {
      applySearch();
      renderTracks();
      renderAlbumList();
      // не сбрасываем currentTrackIndex автоматически — сохраняем воспроизведение, если возможно
      updateSidebarPlayer(filteredTracks[currentTrackIndex] || null);
    });
  }

  // --- Рендер треков (с сохранением текущего трека при перерисовке) ---
  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    // Сохраняем id текущего трека (если есть)
    const currentTrackId = (currentTrackIndex >= 0 && filteredTracks[currentTrackIndex]) ? String(filteredTracks[currentTrackIndex].id) : null;

    let toRender = tracks.slice();

    const searchQuery = globalSearchInput ? globalSearchInput.value.trim() : '';
    if (searchQuery) {
      toRender = toRender.filter(t => matchesQuery(t, searchQuery));
    }

    const selectedAlbumId = albumSelect ? albumSelect.value : '';
    const selectedSubalbumId = subalbumSelect ? subalbumSelect.value : '';

    if (selectedSubalbumId) {
      toRender = toRender.filter(t => String(t.albumId || '') === selectedSubalbumId);
    } else if (selectedAlbumId) {
      const subIds = albums.filter(a => String(a.parentId || '') === selectedAlbumId).map(a => a.id);
      toRender = toRender.filter(t => {
        const tid = String(t.albumId || '');
        return tid === selectedAlbumId || subIds.includes(tid);
      });
    }

    if (!toRender.length) {
      tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
      filteredTracks = [];
      currentTrackIndex = -1;
      updateSidebarPlayer(null);
      return;
    }

    // Перемешиваем треки случайным образом при каждой загрузке
    toRender = shuffle(toRender);

    toRender.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-track-id', t.id || '');

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = safeStr(t.title) + ' cover';

      const info = document.createElement('div');
      info.className = 'track-info';

      const title = document.createElement('h4');
      title.textContent = safeStr(t.title);
      info.appendChild(title);

      const albumDiv = document.createElement('div');
      albumDiv.textContent = getAlbumNameForTrack(t);
      info.appendChild(albumDiv);

      const actions = document.createElement('div');
      actions.className = 'track-actions';

      if (t.lyrics) {
        const lyricsBtn = document.createElement('button');
        lyricsBtn.type = 'button';
        lyricsBtn.className = 'btn-has-lyrics';
        lyricsBtn.textContent = 'ტექსტი';
        lyricsBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openLyricsModal(t);
        });
        actions.appendChild(lyricsBtn);
      }

      const stream = getStreamUrl(t);
      const downloadBtnCard = document.createElement('button');
      downloadBtnCard.type = 'button';
      downloadBtnCard.className = 'download-button';
      downloadBtnCard.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>';

      if (stream && stream.trim() !== '') {
        downloadBtnCard.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const originalHTML = downloadBtnCard.innerHTML;
          let sec = 0;
          downloadBtnCard.textContent = 'Downloading 0s';
          downloadBtnCard.disabled = true;
          const timer = setInterval(() => {
            sec++;
            downloadBtnCard.textContent = `Downloading ${sec}s`;
          }, 1000);
          let filename = 'track.mp3';
          try {
            const u = new URL(stream, window.location.href);
            filename = decodeURIComponent(u.pathname.split('/').pop() || 'track.mp3');
          } catch {}
          await triggerDownload(stream, filename);
          clearInterval(timer);
          downloadBtnCard.innerHTML = originalHTML;
          downloadBtnCard.disabled = false;
        });
      } else {
        downloadBtnCard.disabled = true;
        downloadBtnCard.style.opacity = '0.5';
      }
      actions.appendChild(downloadBtnCard);

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(actions);

      card.addEventListener('click', () => {
        userHasInteracted = true;
        // индекс в текущем toRender
        const idx = toRender.indexOf(t);
        playTrackByIndex(idx);
      });

      tracksContainer.appendChild(card);
    });

    // Обновляем filteredTracks и пытаемся восстановить текущий индекс по id
    filteredTracks = toRender;

    if (currentTrackId) {
      const newIdx = filteredTracks.findIndex(t => String(t.id) === currentTrackId);
      if (newIdx >= 0) {
        // Если трек был воспроизводим, обновляем индекс, но не перезапускаем источник
        currentTrackIndex = newIdx;
      } else {
        // Текущий трек больше не в списке — останавливаем
        currentTrackIndex = -1;
        audio.pause();
        updateSidebarPlayer(null);
      }
    }

    highlightCurrentTrack();

    if (pendingTrackToOpen) {
      const id = String(pendingTrackToOpen);
      const idx = filteredTracks.findIndex(t => String(t.id) === id);
      if (idx >= 0) {
        playTrackByIndex(idx);
      }
      pendingTrackToOpen = null;
    }
  }

  // --- Загрузка данных ---
  async function loadData() {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];

      updateTracksCount();
      buildAlbumSelectors();
      applySearch();
      renderTracks();
    } catch (err) {
      console.error('Ошибка загрузки tracks.json:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>';
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadData);

  // --- Плеер ---
  function updateSidebarPlayer(t = null) {
    if (!t) {
      if (playerTitleSidebar) playerTitleSidebar.textContent = 'აირჩიეთ ტრეკი';
      if (playerArtistSidebar) playerArtistSidebar.textContent = '';
      if (playerCoverImg) playerCoverImg.src = 'images/midcube.png';
      if (playBtnSidebar) playBtnSidebar.textContent = '▶';
      if (headerPlayer) headerPlayer.classList.remove('playing');
      return;
    }

    if (playerTitleSidebar) playerTitleSidebar.textContent = safeStr(t.title);
    if (playerArtistSidebar) playerArtistSidebar.textContent = safeStr(t.artist);
    if (playerCoverImg) playerCoverImg.src = getCoverUrl(t);
    if (headerPlayer) headerPlayer.classList.add('playing');
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

    const src = getStreamUrl(t) || '';
    if (!src) {
      showToast('Audio source not available');
      return;
    }

    // Если уже играет тот же src — просто продолжить/переключить время
    if (audio.src && audio.src.endsWith(src)) {
      audio.play().catch(e => {
        console.error('Play error:', e);
        showToast('Playback failed');
      });
      highlightCurrentTrack();
      return;
    }

    // Устанавливаем новый источник
    audio.src = src;
    audio.load();

    audio.play().catch(e => {
      console.error('Play error:', e);
      if (e && e.name === 'NotAllowedError') {
        if (playBtnSidebar) playBtnSidebar.textContent = '▶';
        showToast('დააჭირეთ ▶ დაკვრისთვის');
      } else if (e && e.name === 'NotSupportedError') {
        showToast('ფაილის ფორმატი არ მხარდაჭერილია, пропускаем трек');
        // Попробуем перейти к следующему треку
        setTimeout(playNext, 600);
      } else {
        // Общая обработка: попробуем перейти к следующему треку
        setTimeout(playNext, 800);
      }
    });

    highlightCurrentTrack();
  }

  function togglePlayPause() {
    userHasInteracted = true;
    if (audio.paused || audio.ended) {
      audio.play().catch(err => {
        console.error('Play error on toggle:', err);
        showToast('Playback failed');
      });
    } else {
      audio.pause();
    }
  }

  function playNext() {
    if (filteredTracks.length === 0) return;
    let next = currentTrackIndex + 1;
    if (next >= filteredTracks.length) next = 0;
    playTrackByIndex(next);
  }

  function playPrev() {
    if (filteredTracks.length === 0) return;
    let prev = currentTrackIndex - 1;
    if (prev < 0) prev = filteredTracks.length - 1;
    playTrackByIndex(prev);
  }

  // Обработчики аудио
  if (audio) {
    audio.addEventListener('playing', () => {
      if (playBtnSidebar) playBtnSidebar.textContent = '❚❚';
    });
    audio.addEventListener('pause', () => {
      if (playBtnSidebar) playBtnSidebar.textContent = '▶';
    });
    audio.addEventListener('ended', () => {
      // Нормальный конец трека — переходим к следующему
      playNext();
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration && progressSidebar) {
        progressSidebar.value = audio.currentTime;
        progressSidebar.max = audio.duration;
        if (timeCurrentSidebar) timeCurrentSidebar.textContent = formatTime(audio.currentTime);
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (timeDurationSidebar) timeDurationSidebar.textContent = formatTime(audio.duration);
      if (progressSidebar) progressSidebar.max = audio.duration || 0;
    });
    audio.addEventListener('volumechange', () => {
      if (volumeSidebar) volumeSidebar.value = audio.volume;
    });

    // Ошибка загрузки/воспроизведения — логируем и пытаемся перейти дальше
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      showToast('Ошибка воспроизведения, пропускаем трек');
      // Попробуем перейти к следующему треку через небольшую задержку
      setTimeout(() => {
        try {
          playNext();
        } catch (err) {
          console.error('Error while skipping to next after audio error:', err);
        }
      }, 700);
      updateSidebarPlayer(null);
    });

    // Событие stalled/suspend — тоже можно попытаться переподключиться или перейти дальше
    audio.addEventListener('stalled', () => {
      console.warn('Audio stalled');
      showToast('Загрузка трека прервана, пробуем следующий');
      setTimeout(playNext, 800);
    });
  }

  // Управление плеером
  if (playBtnSidebar) playBtnSidebar.addEventListener('click', togglePlayPause);
  if (prevBtnSidebar) prevBtnSidebar.addEventListener('click', playPrev);
  if (nextBtnSidebar) nextBtnSidebar.addEventListener('click', playNext);
  if (progressSidebar) progressSidebar.addEventListener('input', () => {
    try {
      audio.currentTime = progressSidebar.value;
    } catch (err) {
      console.error('Failed to set currentTime:', err);
    }
  });
  if (volumeSidebar) volumeSidebar.addEventListener('input', () => {
    try {
      audio.volume = parseFloat(volumeSidebar.value);
    } catch (err) {
      console.error('Failed to set volume:', err);
    }
  });

  // Закрытие модалки текстов
  if (modalClose) {
    modalClose.addEventListener('click', closeLyricsModal);
  }

  if (lyricsModal) {
    lyricsModal.addEventListener('click', (ev) => {
      if (ev.target === lyricsModal) {
        closeLyricsModal();
      }
    });
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && lyricsModal && !lyricsModal.classList.contains('hidden')) {
      closeLyricsModal();
    }
  });

  // Обработчик смены подальбома
  if (subalbumSelect) {
    subalbumSelect.addEventListener('change', () => {
      renderTracks();
      // Сохраняем воспроизведение, если текущий трек остался в списке
      if (currentTrackIndex >= 0 && filteredTracks[currentTrackIndex]) {
        updateSidebarPlayer(filteredTracks[currentTrackIndex]);
      } else {
        currentTrackIndex = -1;
        updateSidebarPlayer(null);
      }
    });
  }

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', () => {
    loadData();

    if (audio && volumeSidebar) audio.volume = parseFloat(volumeSidebar.value || 1);
    updateSidebarPlayer(null);
  });

})();
