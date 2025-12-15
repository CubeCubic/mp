(function () {
  // --- Настройки ---
  const HIDE_PLAYER_ON_PAUSE = true; // опция: скрывать плеер при паузе

  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  const globalSearchInput = document.getElementById('global-search');
  const albumListContainer = document.getElementById('album-list'); // новый контейнер

  // Share site button
  const siteShareBtn = document.getElementById('site-share-btn');

  // Плеер
  const playerEl = document.getElementById('player');
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const volumeEl = document.getElementById('volume');
  const downloadBtn = document.getElementById('download');
  const showLyricsBtn = document.getElementById('show-lyrics');
  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');

  const progress = document.getElementById('progress');
  const timeCurrent = document.getElementById('time-current');
  const timeDuration = document.getElementById('time-duration');

  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  // Share modal & toast
  const shareModal = document.getElementById('share-modal');
  const shareModalClose = document.getElementById('share-modal-close');
  const shareUrlInput = document.getElementById('share-url-input');
  const shareCopyBtn = document.getElementById('share-copy-btn');
  const shareTwitter = document.getElementById('share-twitter');
  const shareTelegram = document.getElementById('share-telegram');
  const shareMail = document.getElementById('share-mail');
  const toast = document.getElementById('toast');

  // Контакты
  const contactBtn = document.getElementById('contact-btn');
  const contactModal = document.getElementById('contact-modal');
  const contactClose = document.getElementById('contact-close');
  const contactForm = document.getElementById('contact-form');
  const contactStatus = document.getElementById('contact-status');

  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let isPlaying = false;

  let searchQuery = '';
  let filteredTracks = [];

  // Для deep-link: если при загрузке есть trackId, сохраняем и применим после рендера
  let pendingTrackToOpen = null;

  // Лайки (localStorage)
  const LIKES_KEY = 'trackLikes';
  const LIKED_KEY = 'likedTracks';

  function loadLikes() {
    try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveLikes(obj) { try { localStorage.setItem(LIKES_KEY, JSON.stringify(obj)); } catch {} }
  function getLikesFor(id) { return loadLikes()[id] || 0; }
  function incrementLikesFor(id) {
    const map = loadLikes();
    map[id] = (map[id] || 0) + 1;
    saveLikes(map);
    return map[id];
  }
  function loadLikedSet() {
    try { return JSON.parse(localStorage.getItem(LIKED_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveLikedSet(obj) { try { localStorage.setItem(LIKED_KEY, JSON.stringify(obj)); } catch {} }
  function hasLiked(id) { return !!loadLikedSet()[id]; }
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

  // --- Обновлённый рендер списка альбомов с счётчиком треков ---
  function renderAlbumList() {
    if (!albumListContainer) return;
    albumListContainer.innerHTML = '';

    if (!albums || !albums.length) return;

    // Только основные альбомы (без parentId)
    let mains = albums.filter(a => !a.parentId);

    // Georgian всегда первым
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

      // Название альбома
      const nameSpan = document.createElement('span');
      nameSpan.textContent = a.name || 'Unnamed';
      btn.appendChild(nameSpan);

      // Подсчёт треков в альбоме (включая все субальбомы)
      const subIds = albums
        .filter(sub => String(sub.parentId || '') === String(a.id))
        .map(sub => sub.id);

      const trackCount = tracks.filter(t => {
        const albumId = String(t.albumId || '');
        return albumId === String(a.id) || subIds.includes(albumId);
      }).length;

      // Счётчик
      const countSpan = document.createElement('span');
      countSpan.className = 'track-count';
      countSpan.textContent = `(${trackCount})`;
      btn.appendChild(countSpan);

      // Подсветка выбранного
      if (String(albumSelect.value || '') === String(a.id || '')) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', () => {
        albumSelect.value = String(a.id || '');
        renderAlbumList(); // обновляем подсветку и счётчики
        onAlbumChange();
      });

      albumListContainer.appendChild(btn);
    });
  }

  // Album selectors
  function buildAlbumSelectors() {
    if (albumSelect) {
      albumSelect.value = '';
    }

    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      subalbumSelect.disabled = true;
      subalbumSelect.style.display = 'none';
      if (subalbumLabel) subalbumLabel.style.display = 'none';
    }

    renderAlbumList();
  }

  function onAlbumChange() {
    const currentAlbumId = (albumSelect ? (albumSelect.value || '') : '').toString();
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
    renderAlbumList(); // обновляем подсветку и счётчики после смены
  }
  function onSubalbumChange() { renderTracks(); }

  // Поиск
  function matchesQuery(track, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      safeStr(track.title).toLowerCase().includes(q) ||
      safeStr(track.artist).toLowerCase().includes(q) ||
      safeStr(track.lyrics).toLowerCase().includes(q) ||
      getAlbumName(track.albumId).toLowerCase().includes(q)
    );
  }

  function getAlbumName(albumId) {
    const album = albums.find(a => String(a.id) === String(albumId));
    return album ? album.name : '';
  }

  function applySearch() {
    const query = globalSearchInput ? globalSearchInput.value.trim() : '';
    searchQuery = query;
    filteredTracks = tracks.filter(t => matchesQuery(t, query));
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', () => {
      applySearch();
      renderTracks();
      renderAlbumList(); // обновляем счётчики после поиска
    });
  }

  // --- Рендер треков ---
  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    let toRender = filteredTracks;

    // Фильтр по альбому
    const selectedAlbumId = albumSelect ? albumSelect.value : '';
    const selectedSubalbumId = subalbumSelect ? subalbumSelect.value : '';

    if (selectedAlbumId || selectedSubalbumId) {
      const targetAlbumId = selectedSubalbumId || selectedAlbumId;
      toRender = toRender.filter(t => String(t.albumId || '') === targetAlbumId);

      // Если выбран основной альбом (не субальбом), включаем все треки из его субальбомов
      if (selectedAlbumId && !selectedSubalbumId) {
        const subIds = albums
          .filter(a => String(a.parentId || '') === selectedAlbumId)
          .map(a => a.id);
        const allTracksInAlbum = filteredTracks.filter(t =>
          String(t.albumId || '') === selectedAlbumId ||
          subIds.includes(t.albumId)
        );
        toRender = allTracksInAlbum;
      }
    }

    if (!toRender.length) {
      tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
      return;
    }

    toRender.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-track-id', t.id || '');

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = `${safeStr(t.title)} cover`;
      card.appendChild(img);

      const info = document.createElement('div');
      info.className = 'track-info';

      const title = document.createElement('h4');
      title.textContent = safeStr(t.title);
      info.appendChild(title);

      const artist = document.createElement('div');
      artist.textContent = safeStr(t.artist);
      info.appendChild(artist);

      const actions = document.createElement('div');
      actions.className = 'track-actions';

      // Кнопка текста (если есть lyrics)
      if (t.lyrics) {
        const lyricsBtn = document.createElement('button');
        lyricsBtn.type = 'button';
        lyricsBtn.className = 'btn-has-lyrics';
        lyricsBtn.textContent = 'ტექსტი';
        lyricsBtn.setAttribute('aria-label', `ტექსტი: ${t.title || ''}`);
        lyricsBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          modalTitle.textContent = t.title || 'Lyrics';
          modalLyrics.textContent = t.lyrics;
          lyricsModal.classList.remove('hidden');
          lyricsModal.setAttribute('aria-hidden', 'false');
        });
        actions.appendChild(lyricsBtn);
      }

      // Скачивание (иконка)
      const stream = getStreamUrl(t);
      const downloadBtnCard = document.createElement('button');
      downloadBtnCard.type = 'button';
      downloadBtnCard.className = 'download-button';
      downloadBtnCard.setAttribute('aria-label', `ჩამოტვირთვა: ${t.title || ''}`);
      downloadBtnCard.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/>
        </svg>
      `;
      if (stream) {
        downloadBtnCard.addEventListener('click', (ev) => {
          ev.stopPropagation();
          let suggested = '';
          try {
            const u = new URL(stream);
            const parts = u.pathname.split('/');
            suggested = parts[parts.length - 1] || '';
          } catch (e) { suggested = ''; }
          triggerDownload(stream, suggested);
        });
      } else {
        downloadBtnCard.disabled = true;
        downloadBtnCard.title = 'No file';
        downloadBtnCard.style.opacity = '0.5';
      }
      actions.appendChild(downloadBtnCard);

      // Share (per-track)
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'share-button';
      shareBtn.textContent = 'Share';
      shareBtn.setAttribute('aria-label', `Share track ${t.title || ''}`);
      shareBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const url = buildShareUrlForTrack(t.id);
        const title = t.title || document.title;
        const text = `${t.title || ''} — ${t.artist || ''}`;
        await doShare({ title, text, url });
      });
      actions.appendChild(shareBtn);

      // Like (скрыто через CSS)
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

      // Клик по карточке — воспроизведение
      card.addEventListener('click', () => {
        const idx = tracks.findIndex(tr => String(tr.id) === String(t.id));
        if (idx >= 0) playTrackByIndex(idx);
      });

      tracksContainer.appendChild(card);
    });

    // После рендера — если есть pendingTrackToOpen, прокрутить и/или воспроизвести
    if (pendingTrackToOpen) {
      const id = String(pendingTrackToOpen);
      const el = tracksContainer.querySelector(`[data-track-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const idx = tracks.findIndex(t => String(t.id) === id);
        if (idx >= 0) {
          playTrackByIndex(idx);
        }
      }
      pendingTrackToOpen = null;
    }
  }

  // --- Load data ---
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

  // --- Плеер логика ---
  function playTrackByIndex(idx) {
    if (idx < 0 || idx >= filteredTracks.length) return;
    currentTrackIndex = idx;
    const t = filteredTracks[idx];

    titleEl.textContent = safeStr(t.title);
    artistEl.textContent = safeStr(t.artist);

    if (t.lyrics) {
      showLyricsBtn.style.display = '';
    } else {
      showLyricsBtn.style.display = 'none';
    }

    const stream = getStreamUrl(t);
    if (stream) {
      downloadBtn.href = stream;
      downloadBtn.style.display = '';
      let suggested = '';
      try {
        const u = new URL(stream);
        const parts = u.pathname.split('/');
        suggested = parts[parts.length - 1] || '';
      } catch (e) {}
      downloadBtn.download = suggested;
    } else {
      downloadBtn.style.display = 'none';
    }

    audio.src = stream || '';
    audio.load();
    audio.play().catch(e => {
      console.error('Play error:', e);
      playerEl.classList.remove('visible');
      updatePlayerPadding();
    });

    playerEl.classList.add('visible');
    updatePlayerPadding();
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

  // Обработчики аудио
  audio.addEventListener('playing', () => {
    isPlaying = true;
    playBtn.textContent = '❚❚';
    playerEl.classList.add('visible');
    updatePlayerPadding();
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    playBtn.textContent = '▶';
    if (HIDE_PLAYER_ON_PAUSE) {
      playerEl.classList.remove('visible');
      updatePlayerPadding();
    }
  });

  audio.addEventListener('ended', playNext);

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      progress.value = audio.currentTime;
      progress.max = audio.duration;
      timeCurrent.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    timeDuration.textContent = formatTime(audio.duration);
    progress.max = audio.duration || 0;
  });

  audio.addEventListener('volumechange', () => {
    volumeEl.value = audio.volume;
  });

  audio.addEventListener('error', (e) => {
    console.error('Audio error:', e);
    playerEl.classList.remove('visible');
    updatePlayerPadding();
  });

  // UI плеера
  if (playBtn) playBtn.addEventListener('click', togglePlayPause);
  if (prevBtn) prevBtn.addEventListener('click', playPrev);
  if (nextBtn) nextBtn.addEventListener('click', playNext);

  if (progress) {
    progress.addEventListener('input', () => {
      audio.currentTime = progress.value;
    });
  }

  if (volumeEl) {
    volumeEl.addEventListener('input', () => {
      audio.volume = parseFloat(volumeEl.value);
    });
  }

  if (showLyricsBtn) {
    showLyricsBtn.addEventListener('click', () => {
      const t = filteredTracks[currentTrackIndex];
      if (t && t.lyrics) {
        modalTitle.textContent = t.title || 'Lyrics';
        modalLyrics.textContent = t.lyrics;
        lyricsModal.classList.remove('hidden');
        lyricsModal.setAttribute('aria-hidden', 'false');
      }
    });
  }

  // Закрытие модалки текстов
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    });
  }

  if (lyricsModal) {
    lyricsModal.addEventListener('click', (ev) => {
      if (ev.target === lyricsModal) {
        lyricsModal.classList.add('hidden');
        lyricsModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && lyricsModal && !lyricsModal.classList.contains('hidden')) {
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    }
  });

  // Padding под плеер
  function updatePlayerPadding() {
    const wrapper = document.querySelector('.site-wrapper');
    if (!wrapper) return;
    if (playerEl.classList.contains('visible')) {
      wrapper.style.paddingBottom = 'var(--player-compact-height, 64px)';
    } else {
      wrapper.style.paddingBottom = '';
    }
  }

  // --- Остальные модалки и функции ---
  if (contactBtn && contactModal && contactClose) {
    contactBtn.addEventListener('click', () => {
      contactModal.classList.remove('hidden');
      contactModal.setAttribute('aria-hidden', 'false');
    });
    contactClose.addEventListener('click', () => {
      contactModal.classList.add('hidden');
      contactModal.setAttribute('aria-hidden', 'true');
    });

    contactModal.addEventListener('click', (ev) => {
      if (ev.target === contactModal) {
        contactModal.classList.add('hidden');
        contactModal.setAttribute('aria-hidden', 'true');
      }
    });

    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && contactModal && !contactModal.classList.contains('hidden')) {
        contactModal.classList.add('hidden');
        contactModal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!contactForm.action) return;
      if (contactStatus) contactStatus.textContent = 'Отправка...';
      const formData = new FormData(contactForm);
      try {
        const res = await fetch(contactForm.action, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          if (contactStatus) contactStatus.textContent = 'Спасибо! Ваше сообщение отправлено.';
          contactForm.reset();
          setTimeout(() => {
            if (contactModal) {
              contactModal.classList.add('hidden');
              contactModal.setAttribute('aria-hidden', 'true');
            }
            if (contactStatus) contactStatus.textContent = '';
          }, 1800);
        } else {
          const data = await res.json().catch(() => ({}));
          if (contactStatus) contactStatus.textContent = data.error || 'Ошибка отправки. Попробуйте позже.';
        }
      } catch (err) {
        if (contactStatus) contactStatus.textContent = 'Ошибка сети. Попробуйте позже.';
      }
    });
  }

  if (shareModalClose) {
    shareModalClose.addEventListener('click', () => {
      shareModal.classList.add('hidden');
      shareModal.setAttribute('aria-hidden', 'true');
    });
  }
  if (shareCopyBtn) {
    shareCopyBtn.addEventListener('click', async () => {
      const url = shareUrlInput.value || '';
      if (!url) return;
      const ok = await copyToClipboard(url);
      if (ok) showToast('Ссылка скопирована');
    });
  }

  if (siteShareBtn) {
    siteShareBtn.addEventListener('click', async () => {
      const url = buildShareUrlForPage();
      const title = document.title;
      const text = 'Послушай Cube Cubic';
      await doShare({ title, text, url });
    });
  }

  function buildShareUrlForTrack(trackId) {
    const base = location.origin + location.pathname;
    return `${base}?track=${encodeURIComponent(trackId)}`;
  }

  function buildShareUrlForPage() {
    return location.href.split('?')[0];
  }

  async function doShare({ title, text, url }) {
    if (navigator.share && navigator.canShare && navigator.canShare({ url })) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {}
    }
    shareUrlInput.value = url;
    shareTwitter.href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    shareTelegram.href = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
    shareMail.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + url)}`;
    shareModal.classList.remove('hidden');
    shareModal.setAttribute('aria-hidden', 'false');
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      return false;
    }
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    setTimeout(() => toast.classList.remove('visible'), 2000);
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    a.click();
  }

  // Deep-link parsing on load
  function parseDeepLink() {
    const params = new URLSearchParams(location.search);
    const track = params.get('track') || null;
    if (track) {
      pendingTrackToOpen = track;
    } else {
      const h = location.hash || '';
      const m = h.match(/track-([^\s]+)/);
      if (m) pendingTrackToOpen = m[1];
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    parseDeepLink();
    loadData();
    if (volumeEl && audio) audio.volume = parseFloat(volumeEl.value || 1);
    if (progress) progress.value = 0;
    setTimeout(updatePlayerPadding, 60);
  });
})();