(function () {
  // --- Элементы DOM ---
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');
  const globalSearchInput = document.getElementById('global-search');
  const albumListContainer = document.getElementById('album-list');

  // --- Элементы для "последних треков" ---
  const latestTracksBtn = document.getElementById('latest-tracks-btn');
  const latestTracksCountEl = document.getElementById('latest-tracks-count');
  // ---


  // Плеер элементы — поддерживаем старые и новые id (fallback)
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

  // Модалки
  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  const toast = document.getElementById('toast');
  const refreshBtn = document.getElementById('refresh-btn');
  const tracksCountEl = document.getElementById('tracks-count');

  // --- Состояние ---
  let albums = [];
  let tracks = []; // Теперь это глобальный список всех треков
  let currentTrackIndex = -1;
  let filteredTracks = []; // Этот массив будет содержать отфильтрованные/отсортированные треки для отображения
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
    tracksCountEl.textContent = `სულ ტრეკი: ${total}`;
    // --- НОВОЕ: Добавлен атрибут aria-live ---
    tracksCountEl.setAttribute('aria-live', 'polite');
    // ---
  }

  // --- ИЗМЕНЕНО: Функция для получения последних N треков (или всех, если n не указан или null) ---
  function getLatestTracks(n = null) {
    // Сортируем треки по ID в порядке убывания (предполагаем, что ID - timestamp)
    const sortedTracks = tracks.slice().sort((a, b) => parseInt(b.id) - parseInt(a.id));
    // Если n не указано или null, возвращаем все отсортированные треки
    if (n === null || typeof n === 'undefined') {
        return sortedTracks;
    }
    // Иначе возвращаем первые n треков из отсортированного массива
    return sortedTracks.slice(0, n);
  }
  // ---


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

  // НОВАЯ ФУНКЦИЯ: получить название альбома/подальбома для трека
  function getAlbumNameForTrack(t) {
    if (!t || !t.albumId) return '';
    const album = albums.find(a => String(a.id) === String(t.albumId));
    return album ? album.name || '' : '';
  }

  // === Модальное окно с текстом и обложкой ===
  // Улучшенная версия: показывает модалку корректно, ждёт загрузки обложки и предотвращает смещения
  function openLyricsModal(track) {
    if (!lyricsModal) return;

    const modalTitleEl = document.getElementById('modal-title');
    const modalLyricsEl = document.getElementById('modal-lyrics');
    const modalCoverImg = document.getElementById('modal-cover-img');
    const modalBox = lyricsModal.querySelector('.modal-box');

    // Заполняем текстовые поля
    modalTitleEl.textContent = track.title || 'Untitled';
    modalLyricsEl.textContent = track.lyrics || 'Текст отсутствует';

    // Подготовка к загрузке обложки
    if (modalCoverImg) {
      modalCoverImg.style.visibility = 'hidden';
      modalCoverImg.src = ''; // сброс старого src
      // --- ИЗМЕНЕНО: Более осмысленный alt для обложек в модалке ---
      modalCoverImg.alt = safeStr(track.title) + ' - ' + getAlbumNameForTrack(track) + ' ალბომის გარეკანი';
      // ---
      // --- lazy loading для обложки в модалке ---
      modalCoverImg.loading = 'lazy';
      // ---
    }

    // Показываем модалку (фон и контейнер)
    lyricsModal.classList.remove('hidden');
    lyricsModal.setAttribute('aria-hidden', 'false');

    // Если есть coverSrc — устанавливаем и ждём onload/onerror
    if (modalCoverImg) {
      modalCoverImg.onload = function() {
        modalCoverImg.style.visibility = 'visible';
      };
      modalCoverImg.onerror = function() {
        modalCoverImg.style.visibility = 'hidden';
        console.warn('Cover image failed to load:', track.coverSrc || track.coverUrl || track.cover);
      };

      if (track.coverSrc) {
        modalCoverImg.src = track.coverSrc;
      } else {
        // Попробуем получить через getCoverUrl
        const url = getCoverUrl(track);
        if (url) {
          modalCoverImg.src = url;
        } else {
          modalCoverImg.style.visibility = 'hidden';
        }
      }
    }
  }

  // Закрытие модалки (единственный обработчик, используется в нескольких местах)
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

  // --- Рендер списка альбомов ---
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

      // --- Удаление класса 'selected' при отображении альбомов ---
      btn.classList.remove('selected');
      // ---

      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (albumSelect) albumSelect.value = String(a.id || '');
        renderAlbumList();
        onAlbumChange();
      });

      albumListContainer.appendChild(btn);
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

    renderTracks();
    renderAlbumList();

    currentTrackIndex = -1;
    updateSidebarPlayer(null);
  }

  // --- Поиск ---
  function matchesQuery(track, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      safeStr(track.title).toLowerCase().includes(q) ||
      safeStr(track.artist).toLowerCase().includes(q) ||
      safeStr(track.lyrics).toLowerCase().includes(q) || // <-- Добавлена эта строка
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
      currentTrackIndex = -1;
      updateSidebarPlayer(null);
    });
  }

  // --- Рендер треков (ИЗМЕНЕНО: теперь учитывает фильтрацию, поиск и "последние треки") ---
  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    // Начинаем с массива всех треков
    let toRender = tracks.slice();

    // Применяем фильтрацию по поисковому запросу
    const searchQuery = globalSearchInput ? globalSearchInput.value.trim() : '';
    if (searchQuery) {
      toRender = toRender.filter(t => matchesQuery(t, searchQuery));
    }

    // Применяем фильтрацию по альбому/подальбому
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

    // --- ИЗМЕНЕНО: Проверяем, отображаются ли "последние треки" ---
    // Это состояние нужно как-то отслеживать. Добавим глобальную переменную.
    if (window.showingLatestTracks) {
        toRender = getLatestTracks(); // Получаем ВСЕ последние треки, отсортированные по ID
    }
    // ---


    if (!toRender.length) {
      tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
      filteredTracks = []; // Обновляем глобальный фильтрованный массив
      return;
    }

    // Перемешиваем треки только если НЕ отображаются "последние треки" и НЕ производится поиск
    if (!window.showingLatestTracks && !searchQuery) {
      toRender = shuffle(toRender);
    }

    // Сохраняем отфильтрованный и отсортированный массив в глобальной переменной
    filteredTracks = toRender;

    filteredTracks.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-track-id', t.id || '');

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      // --- ИЗМЕНЕНО: Более осмысленный alt для обложек в списке треков ---
      img.alt = safeStr(t.title) + ' - ' + getAlbumNameForTrack(t) + ' ალბომის გარეკანი';
      // ---
      // --- lazy loading для обложки трека ---
      img.loading = 'lazy';
      // ---
      card.appendChild(img);

      const info = document.createElement('div');
      info.className = 'track-info';

      const title = document.createElement('h4');
      title.textContent = safeStr(t.title);
      // --- Индикация "Идет воспроизведение" ---
      if (currentTrackIndex >= 0 && filteredTracks[currentTrackIndex]?.id === t.id) {
        const playingIcon = document.createElement('span');
        playingIcon.textContent = ' 🔊'; // Или используйте SVG-иконку
        title.appendChild(playingIcon);
      }
      // ---
      info.appendChild(title);

      // ИЗМЕНЕНО: вместо artist — название альбома/подальбома
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
            const u = new URL(stream);
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
        const idx = filteredTracks.indexOf(t);
        playTrackByIndex(idx);
      });

      tracksContainer.appendChild(card);
    });

    // highlightCurrentTrack вызывается в playTrackByIndex, но можно вызвать и здесь при смене списка
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

      // Обновляем счётчик треков рядом с кнопкой Refresh
      updateTracksCount();

      buildAlbumSelectors();
      applySearch(); // Применяем поиск, если он был
      renderTracks(); // Отображаем треки (в зависимости от текущего состояния)
    } catch (err) {
      console.error('Ошибка загрузки tracks.json:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>';
    }
  }

  // --- Обработчик кнопки Refresh с перемешиванием ---
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        loadData(); // Загружаем данные заново
        // renderTracks(); // Перемешивание происходит внутри renderTracks, вызывается из loadData
        // --- Сброс состояния "последние треки" при обновлении ---
        window.showingLatestTracks = false;
        if (latestTracksBtn) latestTracksBtn.classList.remove('selected');
        // ---
    });
  }
  // ---


  // --- Плеер ---
  function updateSidebarPlayer(t = null) {
    if (!t) {
      if (playerTitleSidebar) playerTitleSidebar.textContent = 'აირჩიეთ ტრეკი';
      if (playerArtistSidebar) playerArtistSidebar.textContent = '';
      if (playerCoverImg) {
        playerCoverImg.src = 'images/midcube.png';
        // --- ИЗМЕНЕНО: Более осмысленный alt для логотипа в плеере ---
        playerCoverImg.alt = 'Cube Cubic ლოგო';
        // ---
        // --- lazy loading для обложки в плеере ---
        playerCoverImg.loading = 'lazy';
        // ---
      }
      if (playBtnSidebar) playBtnSidebar.textContent = '▶';
      if (headerPlayer) headerPlayer.classList.remove('playing');
      return;
    }

    if (playerTitleSidebar) playerTitleSidebar.textContent = safeStr(t.title);
    if (playerArtistSidebar) playerArtistSidebar.textContent = safeStr(t.artist);
    if (playerCoverImg) {
      playerCoverImg.src = getCoverUrl(t);
      // --- ИЗМЕНЕНО: Более осмысленный alt для обложек в плеере ---
      playerCoverImg.alt = safeStr(t.title) + ' - ' + getAlbumNameForTrack(t) + ' ალბომის გარეკანი';
      // ---
      // --- lazy loading для обложки в плеере ---
      playerCoverImg.loading = 'lazy';
      // ---
    }
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

    audio.src = getStreamUrl(t) || '';
    audio.load();

    audio.play().catch(e => {
      if (e && e.name === 'NotAllowedError' && userHasInteracted) {
        if (playBtnSidebar) playBtnSidebar.textContent = '▶';
        showToast('დააჭირეთ ▶ დაკვრისთვის');
      } else if (e && e.name !== 'NotAllowedError') {
        console.error('Play error:', e);
      }
    });

    highlightCurrentTrack();
  }

  function togglePlayPause() {
    userHasInteracted = true;
    if (audio.paused || audio.ended) {
      audio.play().catch(console.error);
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
    audio.addEventListener('ended', playNext);
    audio.addEventListener('timeupdate', () => {
      if (audio.duration && progressSidebar) {
        progressSidebar.value = audio.currentTime;
        progressSidebar.max = audio.duration;
        // --- Обновление aria-valuenow для прогресса ---
        progressSidebar.setAttribute('aria-valuenow', audio.currentTime);
        // ---
        if (timeCurrentSidebar) timeCurrentSidebar.textContent = formatTime(audio.currentTime);
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (timeDurationSidebar) timeDurationSidebar.textContent = formatTime(audio.duration);
      if (progressSidebar) {
        progressSidebar.max = audio.duration || 0;
        // --- Обновление aria-valuemax для прогресса ---
        progressSidebar.setAttribute('aria-valuemax', audio.duration || 0);
        // ---
      }
    });
    audio.addEventListener('volumechange', () => {
      if (volumeSidebar) {
        volumeSidebar.value = audio.volume;
        // --- Обновление aria-valuenow для громкости ---
        volumeSidebar.setAttribute('aria-valuenow', audio.volume);
        // ---
      }
    });
    audio.addEventListener('error', (e) => {
      console.error('Audio error:', e);
      updateSidebarPlayer(null);
    });
  }

  // Управление плеером
  if (playBtnSidebar) playBtnSidebar.addEventListener('click', togglePlayPause);
  if (prevBtnSidebar) prevBtnSidebar.addEventListener('click', playPrev);
  if (nextBtnSidebar) nextBtnSidebar.addEventListener('click', playNext);
  if (progressSidebar) progressSidebar.addEventListener('input', () => audio.currentTime = progressSidebar.value);
  if (volumeSidebar) volumeSidebar.addEventListener('input', () => audio.volume = parseFloat(volumeSidebar.value));

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
      currentTrackIndex = -1;
      updateSidebarPlayer(null);
    });
  }

  // --- Обработчик кнопки "უახლესი ტრეკები" ---
  if (latestTracksBtn) {
    // Изначально кнопка не выбрана
    latestTracksBtn.classList.remove('selected');

    latestTracksBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        // Сбрасываем выбор альбома
        if (albumSelect) albumSelect.value = '';
        // Сбрасываем подальбом
        if (subalbumSelect) {
             subalbumSelect.value = '';
             subalbumSelect.style.display = 'none';
             if (subalbumLabel) subalbumLabel.style.display = 'none';
        }
        // Сбрасываем поиск
        if (globalSearchInput) globalSearchInput.value = '';

        // Устанавливаем флаг "показываются последние треки"
        window.showingLatestTracks = true;

        // Обновляем отображение альбомов (убираем выделение)
        renderAlbumList();
        // Обновляем отображение треков
        renderTracks();
        // Сбрасываем индекс текущего трека
        currentTrackIndex = -1;
        // Обновляем плеер
        updateSidebarPlayer(null);

         // Добавляем класс 'selected' к кнопке "უახლესი ტრეკები"
        latestTracksBtn.classList.add('selected');
        // Убираем класс 'selected' с других кнопок альбомов (уже в renderAlbumList)
    });
  }
  // ---


  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', () => {
    loadData();

    // --- Обработчик клавиш ---
    document.addEventListener('keydown', (e) => {
      // Проверяем, что фокус не на поле ввода (чтобы не мешать вводу)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      switch(e.key) {
        case ' ':
          e.preventDefault(); // Предотвратить прокрутку страницы
          togglePlayPause();
          break;
        case 'ArrowRight':
          if (e.ctrlKey) { // Ctrl + ->
            e.preventDefault();
            playNext();
          }
          break;
        case 'ArrowLeft':
          if (e.ctrlKey) { // Ctrl + <-
            e.preventDefault();
            playPrev();
          }
          break;
        // Можно добавить и другие, например '+' для увеличения громкости
        default:
          break;
      }
    });
    // ---

    if (audio && volumeSidebar) audio.volume = parseFloat(volumeSidebar.value || 1);
    updateSidebarPlayer(null);
  });

})();