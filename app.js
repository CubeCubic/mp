(function () {
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  const globalSearchInput = document.getElementById('global-search');
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

  const LIKES_KEY = 'trackLikes';
  const LIKED_KEY = 'likedTracks';

  function loadLikes() { try { return JSON.parse(localStorage.getItem(LIKES_KEY) || '{}'); } catch { return {}; } }
  function saveLikes(obj) { try { localStorage.setItem(LIKES_KEY, JSON.stringify(obj)); } catch {} }
  function getLikesFor(id) { return loadLikes()[id] || 0; }
  function incrementLikesFor(id) { const map = loadLikes(); map[id] = (map[id] || 0) + 1; saveLikes(map); return map[id]; }
  function loadLikedSet() { try { return JSON.parse(localStorage.getItem(LIKED_KEY) || '{}'); } catch { return {}; } }
  function saveLikedSet(obj) { try { localStorage.setItem(LIKED_KEY, JSON.stringify(obj)); } catch {} }
  function hasLiked(id) { return !!loadLikedSet()[id]; }
  function markLiked(id) { const set = loadLikedSet(); set[id] = true; saveLikedSet(set); }

  function formatTime(sec) { if (!isFinite(sec)) return '0:00'; const m = Math.floor(sec / 60); const s = Math.floor(sec % 60); return `${m}:${s.toString().padStart(2, '0')}`; }
  function getStreamUrl(t) { if (!t) return null; if (t.audioUrl) return t.audioUrl; if (t.downloadUrl) return t.downloadUrl; if (t.filename) return 'media/' + t.filename; return null; }
  function getCoverUrl(t) { const fallback = 'images/midcube.png'; if (!t) return fallback; if (t.coverUrl) return t.coverUrl; if (t.cover) return 'uploads/' + t.cover; return fallback; }
  function optionEl(value, text) { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; }
  function safeStr(v) { return (v == null) ? '' : String(v); }

  function normalizeData(raw) {
    let outAlbums = [];
    let outTracks = [];
    if (!raw) return { albums: [], tracks: [] };
    if (Array.isArray(raw)) {
      outAlbums = raw.map(a => ({ id: a.id || (Date.now()+Math.random()).toString(), name: a.name || '', parentId: a.parentId || null, cover: a.cover || '' }));
      raw.forEach(a => { if (Array.isArray(a.tracks)) a.tracks.forEach(t => outTracks.push({ id: t.id || (Date.now()+Math.random()).toString(), title: t.title || '', artist: t.artist || '', lyrics: t.lyrics || '', albumId: a.id || '', audioUrl: t.audioUrl || t.downloadUrl || t.filename || '', coverUrl: t.coverUrl || t.cover || '' })); });
    } else {
      outAlbums = Array.isArray(raw.albums) ? raw.albums.map(a => ({ id: a.id || (Date.now()+Math.random()).toString(), name: a.name || '', parentId: a.parentId || null, cover: a.cover || '' })) : [];
      outTracks = Array.isArray(raw.tracks) ? raw.tracks.map(t => ({ id: t.id || (Date.now()+Math.random()).toString(), title: t.title || '', artist: t.artist || '', lyrics: t.lyrics || '', albumId: t.albumId || '', audioUrl: t.audioUrl || t.downloadUrl || t.filename || '', coverUrl: t.coverUrl || t.cover || '' })) : [];
    }
    return { albums: outAlbums, tracks: outTracks };
  }

  function albumImageForName(name) {
    if (!name) return 'images/default-album.jpeg';
    const n = name.toLowerCase();
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
    const mains = albums.filter(a => !a.parentId).slice(0, 8);
    mains.forEach(a => {
      const thumb = document.createElement('div');
      thumb.className = 'album-thumb';
      thumb.setAttribute('data-album-id', a.id || '');
      thumb.setAttribute('role', 'button');
      thumb.setAttribute('tabindex', '0');
      thumb.setAttribute('aria-label', a.name || 'album');
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
        if (albumSelect) { albumSelect.value = String(a.id || ''); updateThumbSelection(); onAlbumChange(); }
      });
      thumb.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); if (albumSelect) { albumSelect.value = String(a.id || ''); updateThumbSelection(); onAlbumChange(); } } });
      albumThumbsContainer.appendChild(thumb);
    });
    updateThumbSelection();
  }

  function updateThumbSelection() {
    if (!albumThumbsContainer) return;
    const thumbs = Array.from(albumThumbsContainer.querySelectorAll('.album-thumb'));
    const current = albumSelect ? String(albumSelect.value || '') : '';
    thumbs.forEach(t => { if (t.getAttribute('data-album-id') === current) t.classList.add('selected'); else t.classList.remove('selected'); });
  }

  function buildAlbumSelectors() {
    if (albumSelect) albumSelect.value = '';
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

  function matchesQuery(t, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
    const haystack = [ safeStr(t.title), safeStr(t.artist), safeStr(albumName), safeStr(t.id), safeStr(t.filename), safeStr(t.audioUrl), safeStr(t.downloadUrl) ].join(' ').toLowerCase();
    return haystack.includes(q);
  }
  function applySearch() {
    const query = (searchQuery || '').trim();
    filteredTracks = query ? tracks.filter(t => matchesQuery(t, query)) : [];
  }

  function applyGlobalSearch(query) {
    const q = (query || '').trim().toLowerCase();
    searchQuery = q;
    if (!q) { filteredTracks = []; renderTracks(); return; }
    filteredTracks = tracks.filter(t => {
      const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
      const haystack = [ safeStr(t.title), safeStr(t.artist), safeStr(albumName), safeStr(t.id), safeStr(t.audioUrl) ].join(' ').toLowerCase();
      return haystack.includes(q);
    });
    renderTracks();
  }
  if (globalSearchInput) globalSearchInput.addEventListener('input', () => applyGlobalSearch(globalSearchInput.value));

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
    if (downloadBtn) { downloadBtn.href = src; downloadBtn.style.display = src ? '' : 'none'; }
    if (showLyricsBtn) showLyricsBtn.style.display = (t.lyrics && t.lyrics.trim()) ? '' : 'none';
    if (modalTitle) modalTitle.textContent = t.title || 'Lyrics';
    if (modalLyrics) modalLyrics.textContent = t.lyrics || '';
    audio.play().then(() => { isPlaying = true; if (playerEl) playerEl.classList.remove('hidden'); playerEl.classList.add('visible'); updatePlayButton(); }).catch(() => { isPlaying = false; updatePlayButton(); });
  }

  function updatePlayButton() { if (!playBtn) return; playBtn.textContent = isPlaying ? '⏸' : '▶'; }
  function playPrev() { if (currentTrackIndex > 0) playTrackByIndex(currentTrackIndex - 1); }
  function playNext() { if (currentTrackIndex < tracks.length - 1) playTrackByIndex(currentTrackIndex + 1); }

  if (audio) {
    audio.addEventListener('play', () => { isPlaying = true; if (playerEl) playerEl.classList.remove('hidden'); updatePlayButton(); });
    audio.addEventListener('pause', () => { isPlaying = false; updatePlayButton(); });
    audio.addEventListener('ended', () => { isPlaying = false; updatePlayButton(); });
    audio.addEventListener('timeupdate', () => { if (!audio.duration) return; if (progress) progress.value = (audio.currentTime / audio.duration) * 100; if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime); if (timeDuration) timeDuration.textContent = formatTime(audio.duration); });
    audio.addEventListener('loadedmetadata', () => { if (timeDuration) timeDuration.textContent = formatTime(audio.duration); });
  }

  if (playBtn) playBtn.addEventListener('click', () => {
    if (!audio.src) {
      const firstIndex = tracks.findIndex(() => true);
      if (firstIndex >= 0) playTrackByIndex(firstIndex);
      return;
    }
    if (audio.paused) audio.play(); else audio.pause();
  });
  if (prevBtn) prevBtn.addEventListener('click', playPrev);
  if (nextBtn) nextBtn.addEventListener('click', playNext);
  if (volumeEl) volumeEl.addEventListener('input', () => { if (audio) audio.volume = parseFloat(volumeEl.value); });
  if (progress) progress.addEventListener('input', () => { if (!audio.duration) return; const pct = parseFloat(progress.value); audio.currentTime = (pct / 100) * audio.duration; });

  if (showLyricsBtn) showLyricsBtn.addEventListener('click', () => { if (!lyricsModal) return; lyricsModal.classList.remove('hidden'); lyricsModal.setAttribute('aria-hidden', 'false'); });
  if (modalClose) modalClose.addEventListener('click', () => { if (!lyricsModal) return; lyricsModal.classList.add('hidden'); lyricsModal.setAttribute('aria-hidden', 'true'); });

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

    // Build table with Covers column (Artist column removed)
    const table = document.createElement('table');
    table.className = 'table';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['#','Covers','Title','Action'].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    visible.forEach((t, idx) => {
      const tr = document.createElement('tr');

      // Index
      const tdIndex = document.createElement('td');
      tdIndex.textContent = (idx + 1).toString();
      tr.appendChild(tdIndex);

      // Covers column: small thumbnail(s) in one row
      const tdCovers = document.createElement('td');
      tdCovers.className = 'covers-cell';
      const coverImgEl = document.createElement('img');
      coverImgEl.className = 'cover-thumb';
      coverImgEl.src = getCoverUrl(t);
      coverImgEl.alt = t.title || 'cover';
      coverImgEl.onerror = () => { coverImgEl.src = 'images/midcube.png'; };
      tdCovers.appendChild(coverImgEl);
      tr.appendChild(tdCovers);

      // Title column (title + artist/album meta)
      const tdTitle = document.createElement('td');
      const titleWrap = document.createElement('div');
      titleWrap.className = 'track-title';
      titleWrap.textContent = t.title || 'Untitled';
      const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
      const meta = document.createElement('div');
      meta.className = 'track-artist';
      meta.textContent = albumName ? albumName : '';
      tdTitle.appendChild(titleWrap);
      tdTitle.appendChild(meta);
      tr.appendChild(tdTitle);

      // Action column: lyrics button (if present) and download
      const tdAction = document.createElement('td');

      // Lyrics button (visible only when lyrics exist)
      if (t.lyrics && t.lyrics.trim()) {
        const btnLyrics = document.createElement('button');
        btnLyrics.className = 'action-btn lyrics';
        btnLyrics.type = 'button';
        btnLyrics.textContent = 'Lyrics';
        btnLyrics.addEventListener('click', (ev) => {
          ev.stopPropagation();
          if (modalTitle) modalTitle.textContent = t.title || 'Lyrics';
          if (modalLyrics) modalLyrics.textContent = t.lyrics || '';
          if (lyricsModal) {
            lyricsModal.classList.remove('hidden');
            lyricsModal.setAttribute('aria-hidden', 'false');
          }
        });
        tdAction.appendChild(btnLyrics);
      }

      // Download anchor (always shown; disabled if no stream)
      const stream = getStreamUrl(t);
      const aDownload = document.createElement('a');
      aDownload.className = 'action-btn download';
      aDownload.textContent = 'Download';
      if (stream) {
        aDownload.href = stream;
        aDownload.setAttribute('download', '');
        aDownload.setAttribute('rel', 'noopener noreferrer');
        aDownload.setAttribute('target', '_blank');
      } else {
        aDownload.href = '#';
        aDownload.classList.add('disabled');
      }
      tdAction.appendChild(aDownload);

      // Like button (kept as before)
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
      tdAction.appendChild(likeBtn);

      // Row click: play/pause or play new
      tr.addEventListener('click', () => {
        const globalIndex = tracks.findIndex(x => x.id === t.id);
        if (globalIndex === currentTrackIndex) {
          if (!audio.paused) audio.pause();
          else audio.play();
        } else {
          playTrackByIndex(globalIndex);
        }
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tracksContainer.appendChild(table);
  }

  async function loadData() {
    try {
      const res = await fetch('tracks.json?_=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('tracks.json not found');
      const raw = await res.json();
      const normalized = normalizeData(raw);
      tracks = normalized.tracks;
      albums = normalized.albums;
      buildAlbumSelectors();
      if (albumSelect && !albumSelect._hasHandler) { albumSelect.addEventListener('change', onAlbumChange); albumSelect._hasHandler = true; }
      if (subalbumSelect && !subalbumSelect._hasHandler) { subalbumSelect.addEventListener('change', onSubalbumChange); subalbumSelect._hasHandler = true; }
      applySearch();
      renderTracks();
    } catch (err) {
      console.error('Ошибка загрузки tracks.json:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>';
    }
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadData());

  if (contactBtn && contactModal && contactClose) {
    contactBtn.addEventListener('click', () => { contactModal.classList.remove('hidden'); contactModal.setAttribute('aria-hidden', 'false'); });
    contactClose.addEventListener('click', () => { contactModal.classList.add('hidden'); contactModal.setAttribute('aria-hidden', 'true'); });
    contactModal.addEventListener('click', (ev) => { if (ev.target === contactModal) { contactModal.classList.add('hidden'); contactModal.setAttribute('aria-hidden', 'true'); } });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && contactModal && !contactModal.classList.contains('hidden')) { contactModal.classList.add('hidden'); contactModal.setAttribute('aria-hidden', 'true'); } });
  }

  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!contactForm.action) return;
      if (contactStatus) contactStatus.textContent = 'Отправка...';
      const formData = new FormData(contactForm);
      try {
        const res = await fetch(contactForm.action, { method: 'POST', body: formData, headers: { 'Accept': 'application/json' } });
        if (res.ok) {
          if (contactStatus) contactStatus.textContent = 'Спасибо! Ваше сообщение отправлено.';
          contactForm.reset();
          setTimeout(() => { if (contactModal) { contactModal.classList.add('hidden'); contactModal.setAttribute('aria-hidden', 'true'); } if (contactStatus) contactStatus.textContent = ''; }, 1800);
        } else {
          const data = await res.json().catch(() => ({}));
          if (contactStatus) contactStatus.textContent = data.error || 'Ошибка отправки. Попробуйте позже.';
        }
      } catch (err) {
        if (contactStatus) contactStatus.textContent = 'Ошибка сети. Попробуйте позже.';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    if (volumeEl && audio) audio.volume = parseFloat(volumeEl.value || 1);
    if (progress) progress.value = 0;
  });
})();
