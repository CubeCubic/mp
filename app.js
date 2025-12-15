(function () {
  // --- Настройки ---
  const HIDE_PLAYER_ON_PAUSE = true; // опция: скрывать плеер при паузе

  // Элементы управления
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  const globalSearchInput = document.getElementById('global-search');
  const albumThumbsContainer = document.getElementById('album-thumbs');

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

  // Download modal elements
  const downloadModal = document.getElementById('download-modal');
  const downloadModalClose = document.getElementById('download-modal-close');
  const downloadModalTitle = document.getElementById('download-modal-title');
  const downloadModalFilename = document.getElementById('download-modal-filename');
  const downloadProgress = document.getElementById('download-progress');
  const downloadProgressText = document.getElementById('download-progress-text');
  const downloadModalStatus = document.getElementById('download-modal-status');

  // Контакты
  const contactBtn = document.getElementById('contact-btn');
  const contactModal = document.getElementById('contact-modal');
  const contactClose = document.getElementById('contact-close');
  const contactForm = document.getElementById('contact-form');
  const contactStatus = document.getElementById('contact-status');

  // Данные
  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let isPlaying = false;

  let searchQuery = '';
  let filteredTracks = [];

  // Для deep-link
  let pendingTrackToOpen = null;

  // Лайки (localStorage) — код остаётся, кнопки скрыты через CSS
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

  // --- Миниатюры альбомов ---
  function albumImageForName(name) {
    if (!name) return 'images/default-album.jpeg';
    const n = String(name).toLowerCase();
    if (n.includes('instrumental')) return 'images/instrumental.jpeg';
    if (n.includes('georgian')) return 'images/georgian.jpeg';
    if (n.includes('jazz')) return 'images/jazz.jpeg';
    if (n.includes('rock')) return 'images/rock.jpeg';
    return 'images/default-album.jpeg';
  }

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

      thumb.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (albumSelect) {
          albumSelect.value = String(a.id || '');
          updateThumbSelection();
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

  // Селекторы альбомов
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

    renderAlbumThumbs();
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
        if (subalbumLabel) subalbumLabel.style.display = '';
      } else {
        subalbumSelect.disabled = true;
        subalbumSelect.style.display = 'none';
        if (subalbumLabel) subalbumLabel.style.display = 'none';
      }
      subalbumSelect.value = '';
    }
    renderTracks();
  }
  function onSubalbumChange() { renderTracks(); }

  // Поиск
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

  // Глобальный поиск
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

  // --- Динамический отступ для .site-wrapper ---
  const siteWrapper = document.querySelector('.site-wrapper');
  let resizeTimer = null;
  function getSafeAreaInsetBottom() { return 0; }
  function updatePlayerPadding() {
    if (!siteWrapper) return;
    const isVisible = playerEl && playerEl.classList.contains('visible');
    if (isVisible) {
      const rect = playerEl.getBoundingClientRect();
      const h = Math.ceil(rect.height || 0);
      const safe = getSafeAreaInsetBottom();
      siteWrapper.style.paddingBottom = (h + safe + 8) + 'px';
    } else {
      siteWrapper.style.paddingBottom = '';
    }
  }
  function debounceUpdatePlayerPadding() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updatePlayerPadding();
      resizeTimer = null;
    }, 120);
  }
  window.addEventListener('resize', debounceUpdatePlayerPadding);
  window.addEventListener('orientationchange', debounceUpdatePlayerPadding);

  function setPlayerVisible(visible) {
    if (!playerEl) return;
    if (visible) {
      playerEl.classList.add('visible');
      playerEl.setAttribute('aria-hidden', 'false');
    } else {
      playerEl.classList.remove('visible');
      playerEl.setAttribute('aria-hidden', 'true');
    }
    setTimeout(updatePlayerPadding, 40);
  }

  // --- Share utilities ---
  function buildShareUrlForTrack(trackId) {
    const base = location.origin + location.pathname;
    return `${base}?track=${encodeURIComponent(trackId)}`;
  }
  function buildShareUrlForPage() {
    return location.href;
  }

  async function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        showToast('Ссылка скопирована');
        return true;
      } catch (e) {
        return false;
      }
    } else {
      try {
        const tmp = document.createElement('input');
        tmp.value = text;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand('copy');
        document.body.removeChild(tmp);
        showToast('Ссылка скопирована');
        return true;
      } catch (e) {
        return false;
      }
    }
  }

  function openShareModal(url, title, text) {
    if (!shareModal) return;
    shareUrlInput.value = url;
    shareModal.classList.remove('hidden');
    shareModal.setAttribute('aria-hidden', 'false');

    const encodedUrl = encodeURIComponent(url);
    const encodedText = encodeURIComponent((text || title || '') + ' ' + url);
    if (shareTwitter) shareTwitter.href = `https://twitter.com/intent/tweet?text=${encodedText}`;
    if (shareTelegram) shareTelegram.href = `https://t.me/share/url?url=${encodedUrl}&text=${encodeURIComponent(text || title || '')}`;
    if (shareMail) shareMail.href = `mailto:?subject=${encodeURIComponent(title || 'Share')}&body=${encodeURIComponent((text || '') + '\n\n' + url)}`;
  }

  async function doShare({ title, text, url }) {
    if (navigator.share) {
      try {
        await navigator.share({ title: title || document.title, text: text || '', url });
        return;
      } catch (err) {
        // отмена или ошибка — идём в fallback
      }
    }
    const copied = await copyToClipboard(url);
    if (!copied) {
      openShareModal(url, title, text);
    } else {
      if (!navigator.share && window.innerWidth > 800) {
        setTimeout(() => openShareModal(url, title, text), 600);
      }
    }
  }

  // --- Toast ---
  let toastTimer = null;
  function showToast(msg, ms = 1600) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('visible');
    toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove('visible');
      toast.classList.add('hidden');
      toastTimer = null;
    }, ms);
  }

  // --- Download modal helpers ---
  function showDownloadModal(filename, statusText) {
    if (!downloadModal) return;
    if (downloadModalTitle) downloadModalTitle.textContent = 'Скачивание';
    if (downloadModalFilename) downloadModalFilename.textContent = filename || 'Файл';
    if (downloadModalStatus) downloadModalStatus.textContent = statusText || '';
    if (downloadProgress) downloadProgress.value = 0;
    if (downloadProgressText) downloadProgressText.textContent = '0%';
    downloadModal.classList.remove('hidden');
    downloadModal.setAttribute('aria-hidden', 'false');
  }
  function hideDownloadModal() {
    if (!downloadModal) return;
    downloadModal.classList.add('hidden');
    downloadModal.setAttribute('aria-hidden', 'true');
  }
  if (downloadModalClose) {
    downloadModalClose.addEventListener('click', () => {
      hideDownloadModal();
    });
  }

  // --- Download logic with File System Access API fallback ---
  async function downloadWithPickerOrFallback(url, suggestedName) {
    if (!url) {
      showToast('Файл не найден');
      return;
    }

    showDownloadModal(suggestedName || 'Файл', 'Подготовка...');

    // Попытка использовать File System Access API (Chromium)
    if (window.showSaveFilePicker) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Network error');
        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength, 10) : NaN;

        const opts = {
          suggestedName: suggestedName || (new URL(url)).pathname.split('/').pop() || 'file',
          types: [{
            description: 'Audio',
            accept: { 'audio/*': ['.mp3', '.wav', '.ogg', '.m4a'] }
          }]
        };
        const handle = await window.showSaveFilePicker(opts);
        const writable = await handle.createWritable();

        const reader = response.body.getReader();
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          await writable.write(value);
          received += value.length;
          if (!isNaN(total)) {
            const pct = Math.round((received / total) * 100);
            if (downloadProgress) downloadProgress.value = pct;
            if (downloadProgressText) downloadProgressText.textContent = pct + '%';
            if (downloadModalStatus) downloadModalStatus.textContent = `Скачано ${Math.round(received / 1024)} KB`;
          } else {
            if (downloadProgressText) downloadProgressText.textContent = `${Math.round(received / 1024)} KB`;
            if (downloadModalStatus) downloadModalStatus.textContent = 'Скачивание...';
          }
        }
        await writable.close();
        if (downloadProgress) downloadProgress.value = 100;
        if (downloadProgressText) downloadProgressText.textContent = '100%';
        if (downloadModalStatus) downloadModalStatus.textContent = 'Сохранено';
        showToast('Сохранено в выбранном месте');
        setTimeout(hideDownloadModal, 900);
        return;
      } catch (err) {
        console.warn('FS API download failed, fallback to anchor download', err);
        // Переходим к фолбеку ниже
      }
    }

    // Фолбек: fetch → blob → временный <a download>
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Network error');
      const contentLength = response.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : NaN;

      if (response.body && response.body.getReader) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          if (!isNaN(total)) {
            const pct = Math.round((received / total) * 100);
            if (downloadProgress) downloadProgress.value = pct;
            if (downloadProgressText) downloadProgressText.textContent = pct + '%';
            if (downloadModalStatus) downloadModalStatus.textContent = `Скачано ${Math.round(received / 1024)} KB`;
          } else {
            if (downloadProgressText) downloadProgressText.textContent = `${Math.round(received / 1024)} KB`;
            if (downloadModalStatus) downloadModalStatus.textContent = 'Скачивание...';
          }
        }
        const blob = new Blob(chunks);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        if (suggestedName) a.download = suggestedName;
        else {
          try {
            a.download = (new URL(url)).pathname.split('/').pop() || 'file';
          } catch (e) { a.download = 'file'; }
        }
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        if (downloadProgress) downloadProgress.value = 100;
        if (downloadProgressText) downloadProgressText.textContent = '100%';
        if (downloadModalStatus) downloadModalStatus.textContent = 'Скачивание началось';
        showToast('Скачивание началось');
        setTimeout(hideDownloadModal, 900);
        return;
      } else {
        // Без потокового API — просто инициируем скачивание
        const a = document.createElement('a');
        a.href = url;
        if (suggestedName) a.download = suggestedName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (downloadModalStatus) downloadModalStatus.textContent = 'Скачивание началось';
        showToast('Скачивание началось');
        setTimeout(hideDownloadModal, 900);
        return;
      }
    } catch (err) {
      console.error('Download failed', err);
      if (downloadModalStatus) downloadModalStatus.textContent = 'Ошибка скачивания';
      showToast('Ошибка скачивания');
    }
  }

  // --- Плеер ---
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
    if (downloadBtn) {
      downloadBtn.href = src;
      downloadBtn.style.display = src ? '' : 'none';
    }
    if (showLyricsBtn) showLyricsBtn.style.display = (t.lyrics && t.lyrics.trim()) ? '' : 'none';
    if (modalTitle) modalTitle.textContent = t.title || 'Lyrics';
    if (modalLyrics) modalLyrics.textContent = t.lyrics || '';

    audio.play().then(() => {
      isPlaying = true;
      setPlayerVisible(true);
      updatePlayButton();
      // Обновляем URL под текущий трек (без перезагрузки)
      const newUrl = buildShareUrlForTrack(t.id);
      try {
        history.replaceState(null, '', newUrl);
      } catch (e) {}
    }).catch(() => {
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
      setPlayerVisible(true);
      updatePlayButton();
    });

    audio.addEventListener('pause', () => {
      isPlaying = false;
      updatePlayButton();
      if (HIDE_PLAYER_ON_PAUSE) {
        setPlayerVisible(false);
      } else {
        setTimeout(updatePlayerPadding, 40);
      }
    });

    audio.addEventListener('ended', () => {
      isPlaying = false;
      updatePlayButton();
      setPlayerVisible(false);
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

  // --- Рендер треков (включая share и download-иконку) ---
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
      card.setAttribute('data-track-id', String(t.id || ''));

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = t.title || 'cover';

      img.addEventListener('click', () => {
        const globalIndex = tracks.findIndex(x => x.id === t.id);
        if (globalIndex === currentTrackIndex) {
          if (!audio.paused) {
            audio.pause();
            if (!HIDE_PLAYER_ON_PAUSE) setTimeout(updatePlayerPadding, 40);
          } else {
            audio.play();
          }
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

      // Lyrics button
      const btnLyrics = document.createElement('button');
      btnLyrics.type = 'button';
      btnLyrics.textContent = 'ტექსტი';
      if (t.lyrics && t.lyrics.trim()) btnLyrics.classList.add('btn-has-lyrics');
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

      // Download icon button (вместо текста "Download")
      const stream = getStreamUrl(t);
      const downloadBtnCard = document.createElement('button');
      downloadBtnCard.type = 'button';
      downloadBtnCard.className = 'download-button';
      downloadBtnCard.setAttribute('aria-label', `Download ${t.title || ''}`);
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
          } catch (e) { suggested = (t.title || 'track') + '.mp3'; }
          downloadWithPickerOrFallback(stream, suggested);
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

      // Like (код остаётся, кнопка скрыта через CSS)
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

    // После рендера — deep-link (если есть)
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

  // --- Загрузка данных ---
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

  // --- Contact modal ---
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

  // Contact form submit
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

  // --- Share modal handlers ---
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

  // Site-wide share button
  if (siteShareBtn) {
    siteShareBtn.addEventListener('click', async () => {
      const url = buildShareUrlForPage();
      const title = document.title;
      const text = 'Послушай Cube Cubic';
      await doShare({ title, text, url });
    });
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

  // Инициализация
  document.addEventListener('DOMContentLoaded', () => {
    parseDeepLink();
    loadData();
    if (volumeEl && audio) audio.volume = parseFloat(volumeEl.value || 1);
    if (progress) progress.value = 0;
    setTimeout(updatePlayerPadding, 60);
  });
})();
