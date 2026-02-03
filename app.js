(function () {
  /* ═══════════════════════════════════════════════════
     Cube Cubic — Main App Logic  v3.0
     - Loads tracks.json
     - Renders album sidebar + track cards
     - Plays audio via <audio> element
     - Lyrics modal, download, toast notifications
     ═══════════════════════════════════════════════════ */

  // ─── DOM refs ───
  const albumSelect       = document.getElementById('album-select');
  const subalbumSelect    = document.getElementById('subalbum-select');
  const subalbumLabel     = document.getElementById('subalbum-label');
  const tracksContainer   = document.getElementById('tracks');
  const globalSearchInput = document.getElementById('global-search');
  const albumListContainer= document.getElementById('album-list');
  const refreshBtn        = document.getElementById('refresh-btn');
  const audio             = document.getElementById('audio');

  // Player refs (match IDs in index.html)
  const headerPlayer      = document.getElementById('header-player');
  const playerCoverImg    = document.getElementById('player-cover-img');
  const playerTitle       = document.getElementById('player-title-header');
  const playerArtist      = document.getElementById('player-artist-header');
  const playBtn           = document.getElementById('play-sidebar');
  const prevBtn           = document.getElementById('prev-sidebar');
  const nextBtn           = document.getElementById('next-sidebar');

  // Modal
  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose  = document.getElementById('modal-close');
  const modalTitle  = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  // Toast
  const toast = document.getElementById('toast');

  // ─── State ───
  let albums           = [];
  let tracks           = [];
  let filteredTracks   = [];
  let currentTrackIndex= -1;
  let userInteracted   = false;

  // ════════════════════════════════
  //  Utilities
  // ════════════════════════════════

  function formatTime(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2,'0')}`;
  }

  function getStreamUrl(t) {
    if (!t) return null;
    return t.audioUrl || t.downloadUrl || (t.filename ? 'media/' + t.filename : null);
  }

  function getCoverUrl(t) {
    const fallback = 'images/midcube.png';
    if (!t) return fallback;
    return t.coverUrl || (t.cover ? 'uploads/' + t.cover : fallback);
  }

  function safeStr(v) { return v == null ? '' : String(v); }

  // Toast: show a message for 3 seconds
  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 350);
    }, 3000);
  }

  // Download a file via fetch → blob → click
  async function triggerDownload(url, filename) {
    if (!url || !url.trim()) {
      showToast('ფაილი არ არის ხელმისაწვდომი');
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob  = await res.blob();
      const objUrl= URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href     = objUrl;
      a.download = filename || 'track.mp3';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 12000);
    } catch (e) {
      console.error('Download error:', e);
      showToast('შეცდომა ჩამოტვირთვისად');
    }
  }

  // Get album name string for a track
  function getAlbumName(t) {
    if (!t || !t.albumId) return '';
    const a = albums.find(x => String(x.id) === String(t.albumId));
    return a ? (a.name || '') : '';
  }

  // ════════════════════════════════
  //  Album sidebar rendering
  // ════════════════════════════════

  function renderAlbumList() {
    if (!albumListContainer) return;
    albumListContainer.innerHTML = '';
    if (!albums.length) return;

    // Only top-level albums in sidebar
    const mains = albums
      .filter(a => !a.parentId)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    mains.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-list-button';
      btn.setAttribute('data-album-id', a.id || '');

      // Name span
      const nameSpan = document.createElement('span');
      nameSpan.textContent = a.name || 'Unnamed';
      btn.appendChild(nameSpan);

      // Count: tracks in this album + its sub-albums
      const subIds = albums
        .filter(s => String(s.parentId || '') === String(a.id))
        .map(s => s.id);
      const count = tracks.filter(t => {
        const tid = String(t.albumId || '');
        return tid === String(a.id) || subIds.includes(tid);
      }).length;

      const countSpan = document.createElement('span');
      countSpan.className = 'track-count';
      countSpan.textContent = `(${count})`;
      btn.appendChild(countSpan);

      // Highlight if selected
      if (albumSelect && String(albumSelect.value) === String(a.id || '')) {
        btn.classList.add('selected');
      }

      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (albumSelect) albumSelect.value = String(a.id || '');
        renderAlbumList();
        onAlbumChange();
      });

      albumListContainer.appendChild(btn);
    });
  }

  function onAlbumChange() {
    const currentAlbumId = albumSelect ? albumSelect.value : '';

    // Populate sub-album dropdown
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

  // ════════════════════════════════
  //  Search
  // ════════════════════════════════

  function matchesQuery(track, q) {
    if (!q) return true;
    const low = q.toLowerCase();
    return (
      safeStr(track.title).toLowerCase().includes(low)  ||
      safeStr(track.artist).toLowerCase().includes(low) ||
      safeStr(track.lyrics).toLowerCase().includes(low) ||
      getAlbumName(track).toLowerCase().includes(low)
    );
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', () => {
      renderTracks();
      renderAlbumList();
      currentTrackIndex = -1;
      updatePlayer(null);
    });
  }

  // ════════════════════════════════
  //  Track cards rendering
  // ════════════════════════════════

  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    let toRender = tracks.slice();

    // 1) global search filter
    const searchQ = globalSearchInput ? globalSearchInput.value.trim() : '';
    if (searchQ) toRender = toRender.filter(t => matchesQuery(t, searchQ));

    // 2) album / sub-album filter
    const selAlbum    = albumSelect    ? albumSelect.value    : '';
    const selSubalbum = subalbumSelect ? subalbumSelect.value : '';

    if (selSubalbum) {
      toRender = toRender.filter(t => String(t.albumId || '') === selSubalbum);
    } else if (selAlbum) {
      const subIds = albums
        .filter(a => String(a.parentId || '') === selAlbum)
        .map(a => a.id);
      toRender = toRender.filter(t => {
        const tid = String(t.albumId || '');
        return tid === selAlbum || subIds.includes(tid);
      });
    }

    // 3) sort newest first
    toRender.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));

    if (!toRender.length) {
      tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
      filteredTracks = [];
      return;
    }

    toRender.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-track-id', t.id || '');

      // ── Cover image ──
      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = safeStr(t.title);
      card.appendChild(img);

      // ── Info ──
      const info = document.createElement('div');
      info.className = 'track-info';

      const h4 = document.createElement('h4');
      h4.textContent = safeStr(t.title);
      info.appendChild(h4);

      const albumDiv = document.createElement('div');
      albumDiv.textContent = getAlbumName(t);
      info.appendChild(albumDiv);

      card.appendChild(info);

      // ── Action buttons ──
      const actions = document.createElement('div');
      actions.className = 'track-actions';

      // Lyrics button (only if lyrics exist)
      if (t.lyrics && t.lyrics.trim()) {
        const lyrBtn = document.createElement('button');
        lyrBtn.type = 'button';
        lyrBtn.className = 'btn-has-lyrics';
        lyrBtn.textContent = 'ტექსტი';
        lyrBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          openLyricsModal(t);
        });
        actions.appendChild(lyrBtn);
      }

      // Download button
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'download-button';
      dlBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>';

      const streamUrl = getStreamUrl(t);
      if (streamUrl && streamUrl.trim()) {
        dlBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          // Show downloading state
          const origHTML = dlBtn.innerHTML;
          let sec = 0;
          dlBtn.textContent = '0s…';
          dlBtn.disabled = true;
          const timer = setInterval(() => { sec++; dlBtn.textContent = `${sec}s…`; }, 1000);

          // Guess filename from URL
          let fname = 'track.mp3';
          try { fname = decodeURIComponent(new URL(streamUrl).pathname.split('/').pop()) || fname; } catch(e){}

          await triggerDownload(streamUrl, fname);
          clearInterval(timer);
          dlBtn.innerHTML = origHTML;
          dlBtn.disabled = false;
        });
      } else {
        dlBtn.disabled = true;
        dlBtn.style.opacity = '.4';
      }
      actions.appendChild(dlBtn);
      card.appendChild(actions);

      // ── Card click → play ──
      card.addEventListener('click', () => {
        userInteracted = true;
        const idx = toRender.indexOf(t);
        playByIndex(idx);
      });

      tracksContainer.appendChild(card);
    });

    filteredTracks = toRender;
    highlightCurrent();
  }

  // ════════════════════════════════
  //  Highlight playing card
  // ════════════════════════════════

  function highlightCurrent() {
    if (!tracksContainer) return;
    tracksContainer.querySelectorAll('.card').forEach(c => c.classList.remove('playing-track'));
    if (currentTrackIndex >= 0 && currentTrackIndex < filteredTracks.length) {
      const id = filteredTracks[currentTrackIndex].id;
      const card = tracksContainer.querySelector(`[data-track-id="${id}"]`);
      if (card) {
        card.classList.add('playing-track');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }

  // ════════════════════════════════
  //  Lyrics Modal
  // ════════════════════════════════

  function openLyricsModal(t) {
    if (!lyricsModal) return;
    modalTitle.textContent  = safeStr(t.title);
    modalLyrics.textContent = t.lyrics || '';
    lyricsModal.classList.remove('hidden');
    lyricsModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeLyricsModal() {
    if (!lyricsModal) return;
    lyricsModal.classList.add('hidden');
    lyricsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
  }

  if (modalClose) modalClose.addEventListener('click', closeLyricsModal);
  if (lyricsModal) {
    lyricsModal.addEventListener('click', (ev) => {
      if (ev.target === lyricsModal) closeLyricsModal();
    });
  }
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && lyricsModal && !lyricsModal.classList.contains('hidden')) {
      closeLyricsModal();
    }
  });

  // ════════════════════════════════
  //  Player
  // ════════════════════════════════

  function updatePlayer(t) {
    if (!t) {
      if (playerTitle)  playerTitle.textContent  = 'აირჩიეთ ტრეკი';
      if (playerArtist) playerArtist.textContent = '';
      if (playerCoverImg) playerCoverImg.src = 'images/midcube.png';
      if (playBtn) playBtn.textContent = '▶';
      if (headerPlayer) headerPlayer.classList.remove('playing');
      return;
    }
    if (playerTitle)    playerTitle.textContent    = safeStr(t.title);
    if (playerArtist)   playerArtist.textContent   = safeStr(t.artist);
    if (playerCoverImg) playerCoverImg.src         = getCoverUrl(t);
    if (headerPlayer)   headerPlayer.classList.add('playing');
  }

  function playByIndex(idx) {
    if (idx < 0 || idx >= filteredTracks.length) {
      audio.pause();
      currentTrackIndex = -1;
      updatePlayer(null);
      highlightCurrent();
      return;
    }
    currentTrackIndex = idx;
    const t = filteredTracks[idx];
    updatePlayer(t);
    audio.src = getStreamUrl(t) || '';
    audio.load();
    audio.play().catch(e => {
      if (e.name === 'NotAllowedError') {
        if (playBtn) playBtn.textContent = '▶';
        showToast('დამhelsinki ▶ დაკვის');
      }
    });
    highlightCurrent();
  }

  function togglePlay() {
    userInteracted = true;
    if (audio.paused || audio.ended) audio.play().catch(console.error);
    else audio.pause();
  }

  function playNext() {
    if (!filteredTracks.length) return;
    let n = currentTrackIndex + 1;
    if (n >= filteredTracks.length) n = 0;
    playByIndex(n);
  }

  function playPrev() {
    if (!filteredTracks.length) return;
    let p = currentTrackIndex - 1;
    if (p < 0) p = filteredTracks.length - 1;
    playByIndex(p);
  }

  // Audio events
  audio.addEventListener('playing',  () => { if (playBtn) playBtn.textContent = '❚❚'; });
  audio.addEventListener('pause',    () => { if (playBtn) playBtn.textContent = '▶';  });
  audio.addEventListener('ended',    playNext);
  audio.addEventListener('error',    () => { updatePlayer(null); showToast('შეცდომა: ტრეკი ვერ ჩაიტვირთა'); });

  // Player button listeners
  if (playBtn) playBtn.addEventListener('click', togglePlay);
  if (prevBtn) prevBtn.addEventListener('click', playPrev);
  if (nextBtn) nextBtn.addEventListener('click', playNext);

  // Sub-album change
  if (subalbumSelect) {
    subalbumSelect.addEventListener('change', () => {
      renderTracks();
      currentTrackIndex = -1;
      updatePlayer(null);
    });
  }

  // ════════════════════════════════
  //  Data loading
  // ════════════════════════════════

  async function loadData() {
    try {
      const res  = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('tracks.json not found');
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];
      renderAlbumList();
      renderTracks();
    } catch (e) {
      console.error('Error loading tracks.json:', e);
      if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">ტრეკები ვერ ჩამოტვირთécole</div>';
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', loadData);

  // ─── Init ───
  document.addEventListener('DOMContentLoaded', () => {
    updatePlayer(null);
    loadData();
  });

})();
