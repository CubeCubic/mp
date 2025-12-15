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

  // Модалки
  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');
  /* 
  const contactBtn = document.getElementById('contact-btn');
  const contactModal = document.getElementById('contact-modal');
  const contactClose = document.getElementById('contact-close');
  const contactForm = document.getElementById('contact-form');
  const contactStatus = document.getElementById('contact-status');
  */

  const shareModal = document.getElementById('share-modal');
  const shareModalClose = document.getElementById('share-modal-close');
  const shareUrlInput = document.getElementById('share-url-input');
  const shareCopyBtn = document.getElementById('share-copy-btn');
  const shareTwitter = document.getElementById('share-twitter');
  const shareTelegram = document.getElementById('share-telegram');
  const shareMail = document.getElementById('share-mail');

  const toast = document.getElementById('toast');
  const refreshBtn = document.getElementById('refresh-btn');

  // --- Состояние ---
  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let filteredTracks = [];
  let pendingTrackToOpen = null;

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

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    a.click();
  }

  function buildShareUrlForTrack(trackId) {
    const base = location.origin + location.pathname;
    return `${base}?track=${encodeURIComponent(trackId)}`;
  }

  async function doShare({ title, text, url }) {
    if (navigator.share && navigator.canShare && navigator.canShare({ url })) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {}
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
    } catch {
      return false;
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

      if (String(albumSelect.value || '') === String(a.id || '')) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        albumSelect.value = String(a.id || '');
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
  }

  function onSubalbumChange() {
    renderTracks();
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
    });
  }

  // --- Рендер треков ---
  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    let toRender = filteredTracks;

    const selectedAlbumId = albumSelect ? albumSelect.value : '';
    const selectedSubalbumId = subalbumSelect ? subalbumSelect.value : '';

    if (selectedAlbumId || selectedSubalbumId) {
      const targetAlbumId = selectedSubalbumId || selectedAlbumId;
      toRender = toRender.filter(t => String(t.albumId || '') === targetAlbumId);

      if (selectedAlbumId && !selectedSubalbumId) {
        const subIds = albums.filter(a => String(a.parentId || '') === selectedAlbumId).map(a => a.id);
        toRender = filteredTracks.filter(t => String(t.albumId || '') === selectedAlbumId || subIds.includes(t.albumId));
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
      img.alt = safeStr(t.title) + ' cover';
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

      if (t.lyrics) {
        const lyricsBtn = document.createElement('button');
        lyricsBtn.type = 'button';
        lyricsBtn.className = 'btn-has-lyrics';
        lyricsBtn.textContent = 'ტექსტი';
        lyricsBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          modalTitle.textContent = t.title || 'Lyrics';
          modalLyrics.textContent = t.lyrics;
          lyricsModal.classList.remove('hidden');
          lyricsModal.setAttribute('aria-hidden', 'false');
        });
        actions.appendChild(lyricsBtn);
      }

      const stream = getStreamUrl(t);
      const downloadBtnCard = document.createElement('button');
      downloadBtnCard.type = 'button';
      downloadBtnCard.className = 'download-button';
      downloadBtnCard.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>';
      if (stream) {
        downloadBtnCard.addEventListener('click', (ev) => {
          ev.stopPropagation();
          let suggested = '';
          try {
            const u = new URL(stream);
            suggested = u.pathname.split('/').pop() || '';
          } catch {}
          triggerDownload(stream, suggested);
        });
      } else {
        downloadBtnCard.disabled = true;
        downloadBtnCard.style.opacity = '0.5';
      }
      actions.appendChild(downloadBtnCard);

      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'share-button';
      shareBtn.textContent = 'Share';
      shareBtn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const url = buildShareUrlForTrack(t.id);
        const title = t.title || 'Cube Cubic';
        const text = `${t.title || ''} — ${t.artist || ''}`;
        await doShare({ title, text, url });
      });
      actions.appendChild(shareBtn);

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(actions);

      card.addEventListener('click', () => {
        const idx = tracks.findIndex(tr => String(tr.id) === String(t.id));
        if (idx >= 0) playTrackByIndex(idx);
      });

      tracksContainer.appendChild(card);
    });

    if (pendingTrackToOpen) {
      const id = String(pendingTrackToOpen);
      const el = tracksContainer.querySelector(`[data-track-id="${id}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const idx = tracks.findIndex(t => String(t.id) === id);
        if (idx >= 0) playTrackByIndex(idx);
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

    showLyricsSidebar.style.display = t.lyrics ? 'block' : 'none';

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

  function playTrackByIndex(idx) {
    if (idx < 0 || idx >= filteredTracks.length) {
      updateSidebarPlayer(null);
      audio.pause();
      currentTrackIndex = -1;
      return;
    }

    currentTrackIndex = idx;
    const t = filteredTracks[idx];
    updateSidebarPlayer(t);

    audio.src = getStreamUrl(t) || '';
    audio.load();

    audio.play().catch(e => {
      if (e.name === 'NotAllowedError') {
        playBtnSidebar.textContent = '▶';
        showToast('Нажмите ▶ для воспроизведения');
      } else {
        console.error('Play error:', e);
      }
    });
  }

  function togglePlayPause() {
    if (audio.paused || audio.ended) {
      audio.play().catch(console.error);
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
  audio.addEventListener('error', (e) => {
    console.error('Audio error:', e);
    updateSidebarPlayer(null);
  });

  // Управление плеером
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

  // --- Модалки ---
  if (modalClose) {
    modalClose.addEventListener('click', () => {
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    });
  }

  if (contactClose) {
    contactClose.addEventListener('click', () => {
      contactModal.classList.add('hidden');
      contactModal.setAttribute('aria-hidden', 'true');
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
      const ok = await copyToClipboard(shareUrlInput.value);
      if (ok) showToast('Ссылка скопирована');
    });
  }

  // --- Инициализация ---
  function parseDeepLink() {
    const params = new URLSearchParams(location.search);
    const track = params.get('track');
    if (track) pendingTrackToOpen = track;
  }

  document.addEventListener('DOMContentLoaded', () => {
    parseDeepLink();
    loadData();

    audio.volume = parseFloat(volumeSidebar?.value || 1);
    updateSidebarPlayer(null);

    // Кнопка Contact в меню
    if (contactBtn) {
      contactBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        contactModal.classList.remove('hidden');
        contactModal.setAttribute('aria-hidden', 'false');
      });
    }

    // Закрытие модалок по клику на overlay
    [lyricsModal, contactModal, shareModal].forEach(modal => {
      if (modal) {
        modal.addEventListener('click', (ev) => {
          if (ev.target === modal) {
            modal.classList.add('hidden');
            modal.setAttribute('aria-hidden', 'true');
          }
        });
      }
    });

    // Escape для всех модалок
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        [lyricsModal, contactModal, shareModal].forEach(m => {
          if (m && !m.classList.contains('hidden')) {
            m.classList.add('hidden');
            m.setAttribute('aria-hidden', 'true');
          }
        });
      }
    });
  });

})();
