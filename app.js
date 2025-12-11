(function () {
  const albumSelect = document.getElementById('album-select'); // видимый селект для альбомов
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  // global search input (перемещённый поисковик)
  const globalSearchInput = document.getElementById('global-search');

  // блок миниатюр главных альбомов
  const albumThumbsContainer = document.getElementById('album-thumbs');

  const playerEl = document.getElementById('player');
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const volumeEl = document.getElementById('volume');
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

  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let isPlaying = false;

  // Поиск
  let searchQuery = '';
  let filteredTracks = [];

  // Лайки (localStorage)
  const LIKES_KEY = 'trackLikes';
  const LIKED_KEY = 'likedTracks';

  function loadLikes() {
    try {
      const raw = localStorage.getItem(LIKES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveLikes(obj) {
    try { localStorage.setItem(LIKES_KEY, JSON.stringify(obj)); } catch {}
  }
  function getLikesFor(id) {
    const map = loadLikes();
    return map[id] || 0;
  }
  function incrementLikesFor(id) {
    const map = loadLikes();
    map[id] = (map[id] || 0) + 1;
    saveLikes(map);
    return map[id];
  }
  function loadLikedSet() {
    try {
      const raw = localStorage.getItem(LIKED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }
  function saveLikedSet(obj) {
    try { localStorage.setItem(LIKED_KEY, JSON.stringify(obj)); } catch {}
  }
  function hasLiked(id) {
    const set = loadLikedSet();
    return !!set[id];
  }
  function markLiked(id) {
    const set = loadLikedSet();
    set[id] = true;
    saveLikedSet(set);
  }

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
  function optionEl(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }
  function safeStr(v) { return (v == null) ? '' : String(v); }

  // --- Логика миниатюр только для главных альбомов (без parentId) ---
  function albumImageForName(name) {
    if (!name) return 'images/default-album.jpeg';
    const n = name.toLowerCase();
    if (n.includes('instrumental')) return 'images/instrumental.jpeg';
    if (n.includes('georgian')) return 'images/georgian.jpeg';
    if (n.includes('jazz')) return 'images/jazz.jpeg';
    if (n.includes('rock')) return 'images/rock.jpeg';
    return 'images/default-album.jpeg';
  }

  // Рендер миниатюр только для главных альбомов (albums без parentId)
  function renderAlbumThumbs() {
    if (!albumThumbsContainer) return;
    albumThumbsContainer.innerHTML = '';
    if (!albums || !albums.length) return;

    const mains = albums.filter(a => !a.parentId);
    mains.forEach(a => {
      const thumb = document.createElement('div');
      thumb.className = 'album-thumb';
      thumb.setAttribute('data-album-id', a.id || '');
      thumb.setAttribute('role', 'button');
      thumb.setAttribute('tabindex', '0');

      const img = document.createElement('img');
      img.src = albumImageForName(a.name);
      img.alt = a.name || 'album';
      thumb.appendChild(img);

      const label = document.createElement('div');
      label.className = 'album-name';
      label.textContent = a.name || '';
      thumb.appendChild(label);

      // Клик по миниатюре — устанавливаем значение видимого селекта album-select и вызываем onAlbumChange
      thumb.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (albumSelect) {
          albumSelect.value = String(a.id || '');
          // визуально отметить выбранную миниатюру
          updateThumbSelection();
          // вызвать обработчик как при выборе в селекте
          onAlbumChange();
        }
      });
      thumb.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          if (albumSelect) {
            albumSelect.value = String(a.id || '');
            updateThumbSelection();
            onAlbumChange();
          }
        }
      });

      albumThumbsContainer.appendChild(thumb);
    });

    // Обновить выделение, если уже выбран альбом
    updateThumbSelection();
  }

  function updateThumbSelection() {
    if (!albumThumbsContainer) return;
    const thumbs = Array.from(albumThumbsContainer.querySelectorAll('.album-thumb'));
    const current = albumSelect ? String(albumSelect.value || '') : '';
    thumbs.forEach(t => {
      if (t.getAttribute('data-album-id') === current) t.classList.add('selected');
      else t.classList.remove('selected');
    });
  }

  // Селекторы альбомов — восстановлено поведение: album-select заполняется главными альбомами,
  // subalbum-select работает как раньше (подальбомы).
  function buildAlbumSelectors() {
    if (!albumSelect) return;
    albumSelect.innerHTML = '';
    albumSelect.appendChild(optionEl('', '— ყველა ალბომი —'));
    const mains = albums.filter(a => !a.parentId);
    mains.forEach(a => albumSelect.appendChild(optionEl(a.id, a.name)));

    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      subalbumSelect.disabled = true;
      subalbumSelect.style.display = 'none';
      if (subalbumLabel) subalbumLabel.style.display = 'none';
    }

    // Отрисовать миниатюры только для главных альбомов
    renderAlbumThumbs();
  }

  function onAlbumChange() {
    const currentAlbumId = (albumSelect.value || '').toString();
    if (subalbumSelect) {
      const subs = albums.filter(a => (a.parentId || '').toString() === currentAlbumId);
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      if (subs.length) {
        subs.forEach(s => subalbumSelect.appendChild(optionEl(s.id, s.name)));
        subalbumSelect.disabled = false;
        subalbumSelect.style.display = '';
        subalbumLabel.style.display = '';
      } else {
        subalbumSelect.disabled = true;
        subalbumSelect.style.display = 'none';
        subalbumLabel.style.display = 'none';
      }
      subalbumSelect.value = '';
    }
    renderTracks();
  }
  function onSubalbumChange() { renderTracks(); }

  // Поиск (локальный)
  function matchesQuery(t, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
    const haystack = [
      safeStr(t.title),
      safeStr(t.artist),
      safeStr(albumName),
      safeStr(t.id),
      safeStr(t.filename),
      safeStr(t.audioUrl),
      safeStr(t.downloadUrl)
    ].join(' ').toLowerCase();
    return haystack.includes(q);
  }
  function applySearch() {
    const query = (searchQuery || '').trim();
    filteredTracks = query ? tracks.filter(t => matchesQuery(t, query)) : [];
  }

  // Глобальный поисковик (альбомы, подальбомы, треки)
  function applyGlobalSearch(query) {
    const q = (query || '').trim().toLowerCase();
    searchQuery = q;
    if (!q) {
      filteredTracks = [];
      renderTracks();
      return;
    }
    filteredTracks = tracks.filter(t => {
      const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
      const haystack = [
        safeStr(t.title),
        safeStr(t.artist),
        safeStr(albumName),
        safeStr(t.id),
        safeStr(t.audioUrl)
      ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    renderTracks();
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', () => {
      applyGlobalSearch(globalSearchInput.value);
    });
  }

  // Рендер треков
  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    const selAlbum = albumSelect ? (albumSelect.value || '') : '';
    const selSub = subalbumSelect ? (subalbumSelect.value || '') : '';

    let visible = filteredTracks.length ? filteredTracks.slice() : tracks.slice();

    if (selSub) {
      visible = visible.filter(t => (t.albumId || '') === selSub);
    } else if (selAlbum) {
      visible = visible.filter(t => {
        if (!t.albumId) return false;
        if (t.albumId === selAlbum) return true;
        const albumObj = albums.find(a => a.id === t.albumId);
        return albumObj && (albumObj.parentId || '') === selAlbum;
      });
    }

    if (!visible.length) {
      const msg = document.createElement('div');
      msg.className = 'muted';
      msg.textContent = searchQuery ? 'По запросу ничего не найдено' : 'Нет треков';
      tracksContainer.appendChild(msg);
      return;
    }

    visible.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'card';

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = t.title || 'cover';
      img.addEventListener('click', () => {
        const globalIndex = tracks.findIndex(x => x.id === t.id);
        if (globalIndex === currentTrackIndex) {
          if (audio.paused) audio.play();
          else audio.pause();
        } else {
          playTrackByIndex(globalIndex);
        }
      });

      const info = document.createElement('div');
      info.className = 'track-info';
      const h4 = document.createElement('h4');
      h4.textContent = t.title || 'Untitled';
      const meta = document.createElement('div');
      const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
      meta.textContent = (t.artist || '') + (albumName ? ' • ' + albumName : '');
      info.appendChild(h4);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'track-actions';

      // Кнопка текста
      const btnLyrics = document.createElement('button');
      btnLyrics.type = 'button';
      btnLyrics.textContent = 'ტექსტი';
      btnLyrics.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (modalTitle) modalTitle.textContent = t.title || 'Lyrics';
        if (modalLyrics) modalLyrics.textContent = t.lyrics || '';
        if (lyricsModal) {
          lyricsModal.classList.remove('hidden');
          lyricsModal.setAttribute('aria-hidden', 'false');
        }
      });
      actions.appendChild(btnLyrics);

      // Download
      const aDownload = document.createElement('a');
      const stream = getStreamUrl(t);
      if (stream) {
        aDownload.href = stream;
        aDownload.textContent = 'Download';
        aDownload.download = '';
      } else {
        aDownload.textContent = 'No file';
        aDownload.href = '#';
        aDownload.className = 'disabled';
      }
      actions.appendChild(aDownload);

      // Like
      const likeBtn = document.createElement('button');
      likeBtn.type = 'button';
      likeBtn.className = 'like-button';
      likeBtn.setAttribute('aria-label', 'Like track');

      const heartSpan = document.createElement('span');
      heartSpan.className = 'heart';
      heartSpan.textContent = '❤';

      const countSpan = document.createElement('span');
      countSpan.className = 'like-count';

      const key = String(t.id || t.filename || t.title);
      countSpan.textContent = getLikesFor(key);

      likeBtn.appendChild(heartSpan);
      likeBtn.appendChild(countSpan);

      if (hasLiked(key)) likeBtn.classList.add('liked');

      likeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (hasLiked(key)) {
          likeBtn.classList.add('animate');
          setTimeout(() => likeBtn.classList.remove('animate'), 380);
          return;
        }
        const newCount = incrementLikesFor(key);
        countSpan.textContent = newCount;
        markLiked(key);
        likeBtn.classList.add('liked');
        likeBtn.classList.add('animate');
        setTimeout(() => likeBtn.classList.remove('animate'), 380);
      });

      actions.appendChild(likeBtn);

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(actions);
      tracksContainer.appendChild(card);
    });
  }

  // Плеер
  function playTrackByIndex(index) {
    if (index < 0 || index >= tracks.length) return;
    currentTrackIndex = index;
    const t = tracks[currentTrackIndex];
    if (!t) return;
    const src = getStreamUrl(t);
    if (!src) { alert('Аудиофайл не найден'); return; }

    audio.src = src;
    audio.currentTime = 0;
    if (titleEl) titleEl.textContent = t.title || '';
    if (artistEl) artistEl.textContent = t.artist || '';
    if (coverImg) coverImg.src = getCoverUrl(t);
    if (downloadBtn) {
      downloadBtn.href = src;
      downloadBtn.style.display = src ? '' : 'none';
    }
    if (showLyricsBtn) showLyricsBtn.style.display = (t.lyrics && t.lyrics.trim()) ? '' : 'none';
    if (modalTitle) modalTitle.textContent = t.title || 'Lyrics';
    if (modalLyrics) modalLyrics.textContent = t.lyrics || '';

    audio.play().then(() => {
      isPlaying = true;
      if (playerEl) playerEl.classList.add('visible');
      updatePlayButton();
    }).catch(err => {
      console.error('Ошибка воспроизведения', err);
      isPlaying = false;
      updatePlayButton();
    });
  }

  function updatePlayButton() {
    if (!playBtn) return;
    playBtn.textContent = isPlaying ? '⏸' : '▶';
  }
  function playPrev() { if (currentTrackIndex > 0) playTrackByIndex(currentTrackIndex - 1); }
  function playNext() { if (currentTrackIndex < tracks.length - 1) playTrackByIndex(currentTrackIndex + 1); }

  if (audio) {
    audio.addEventListener('play', () => {
      isPlaying = true;
      if (playerEl) playerEl.classList.add('visible');
      updatePlayButton();
    });
    audio.addEventListener('pause', () => {
      isPlaying = false;
      updatePlayButton();
      if (playerEl) playerEl.classList.remove('visible');
    });
    audio.addEventListener('ended', () => {
      isPlaying = false;
      updatePlayButton();
      if (playerEl) playerEl.classList.remove('visible');
    });
    audio.addEventListener('timeupdate', () => {
      if (!audio.duration) return;
      if (progress) progress.value = (audio.currentTime / audio.duration) * 100;
      if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
      if (timeDuration) timeDuration.textContent = formatTime(audio.duration);
    });
    audio.addEventListener('loadedmetadata', () => {
      if (timeDuration) timeDuration.textContent = formatTime(audio.duration);
    });
  }

  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!audio.src) {
        const firstIndex = tracks.findIndex(() => true);
        if (firstIndex >= 0) playTrackByIndex(firstIndex);
        return;
      }
      if (audio.paused) audio.play();
      else audio.pause();
    });
  }
  if (prevBtn) prevBtn.addEventListener('click', playPrev);
  if (nextBtn) nextBtn.addEventListener('click', playNext);
  if (volumeEl) volumeEl.addEventListener('input', () => { audio.volume = parseFloat(volumeEl.value); });
  if (progress) progress.addEventListener('input', () => {
    if (!audio.duration) return;
    const pct = parseFloat(progress.value);
    audio.currentTime = (pct / 100) * audio.duration;
  });

  if (showLyricsBtn) {
    showLyricsBtn.addEventListener('click', () => {
      if (!lyricsModal) return;
      lyricsModal.classList.remove('hidden');
      lyricsModal.setAttribute('aria-hidden', 'false');
    });
  }
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      if (!lyricsModal) return;
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    });
  }

  // Загрузка данных
  async function loadData() {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('tracks.json not found');
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];
      buildAlbumSelectors();

      if (albumSelect && !albumSelect._hasHandler) {
        albumSelect.addEventListener('change', onAlbumChange);
        albumSelect._hasHandler = true;
      }
      if (subalbumSelect && !subalbumSelect._hasHandler) {
        subalbumSelect.addEventListener('change', onSubalbumChange);
        subalbumSelect._hasHandler = true;
      }

      applySearch();
      renderTracks();
    } catch (err) {
      console.error('Ошибка загрузки tracks.json:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>';
    }
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadData());

  // Поиск — обработчик глобального поля
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', () => {
      applyGlobalSearch(globalSearchInput.value);
    });
  }

  // Инициализация
  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    if (volumeEl && audio) audio.volume = parseFloat(volumeEl.value || 1);
    if (progress) progress.value = 0;
  });
})();
