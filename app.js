(function () {
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const tracksContainer = document.getElementById('tracks');
  const globalSearchInput = document.getElementById('global-search');
  const albumListContainer = document.getElementById('album-list');

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
  const toast = document.getElementById('toast');
  const refreshBtn = document.getElementById('refresh-btn');

  let albums = [], tracks = [], currentTrackIndex = -1, filteredTracks = [], pendingTrackToOpen = null, userHasInteracted = false;

  const formatTime = sec => isFinite(sec) ? `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}` : '0:00';

  const getStreamUrl = t => t ? (t.audioUrl || t.downloadUrl || (t.filename ? 'media/' + t.filename : null)) : null;

  const getCoverUrl = t => t ? (t.coverUrl || (t.cover ? 'uploads/' + t.cover : 'images/midcube.png')) : 'images/midcube.png';

  const safeStr = v => v == null ? '' : String(v);

  const showToast = msg => {
    if (toast) {
      toast.textContent = msg;
      toast.classList.add('visible');
      setTimeout(() => toast.classList.remove('visible'), 3000);
    }
  };

  const triggerDownload = async (url, filename = 'track.mp3') => {
    if (!url || !url.trim()) return showToast('ფაილი არ არის ხელმისაწვდომი');
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      showToast('შეცდომა ჩამოტვირთვისას');
    }
  };

  const highlightCurrentTrack = () => {
    tracksContainer.querySelectorAll('.card').forEach(c => c.classList.remove('playing-track'));
    if (currentTrackIndex >= 0 && currentTrackIndex < filteredTracks.length) {
      const card = tracksContainer.querySelector(`[data-track-id="${filteredTracks[currentTrackIndex].id}"]`);
      if (card) {
        card.classList.add('playing-track');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const renderAlbumList = () => {
    albumListContainer.innerHTML = '';
    if (!albums.length) return;
    let mains = albums.filter(a => !a.parentId);
    mains.sort((a, b) => a.name === 'Georgian' ? -1 : b.name === 'Georgian' ? 1 : (a.name || '').localeCompare(b.name || ''));
    mains.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-list-button';
      btn.dataset.albumId = a.id || '';
      btn.innerHTML = `<span>${a.name || 'Unnamed'}</span><span class="track-count">(${tracks.filter(t => {
        const id = String(t.albumId || '');
        return id === String(a.id) || albums.filter(s => String(s.parentId || '') === String(a.id)).some(s => s.id === id);
      }).length})</span>`;
      if (albumSelect.value === String(a.id)) btn.classList.add('selected');
      btn.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        albumSelect.value = String(a.id || '');
        renderAlbumList();
        onAlbumChange();
      });
      albumListContainer.appendChild(btn);
    });
  };

  const buildAlbumSelectors = () => {
    albumSelect.value = '';
    subalbumSelect.innerHTML = '<option value="">— ყველა ქვეალბომი —</option>';
    subalbumSelect.disabled = true;
    subalbumSelect.style.display = subalbumLabel.style.display = 'none';
    renderAlbumList();
  };

  const onAlbumChange = () => {
    const id = albumSelect.value;
    const subs = albums.filter(a => String(a.parentId || '') === id);
    subalbumSelect.innerHTML = '<option value="">— ყველა ქვეალბომი —</option>';
    subs.forEach(s => subalbumSelect.add(new Option(s.name, s.id)));
    subalbumSelect.disabled = !subs.length;
    subalbumSelect.style.display = subalbumLabel.style.display = subs.length ? '' : 'none';
    renderTracks();
    renderAlbumList();
    currentTrackIndex = -1;
    updateSidebarPlayer(null);
  };

  const matchesQuery = (t, q) => !q || [t.title, t.artist, t.lyrics, (albums.find(a => a.id == t.albumId) || {}).name].some(s => (s || '').toLowerCase().includes(q.toLowerCase()));

  const applySearch = () => filteredTracks = tracks.filter(t => matchesQuery(t, globalSearchInput.value.trim()));

  globalSearchInput?.addEventListener('input', () => {
    applySearch();
    renderTracks();
    renderAlbumList();
    currentTrackIndex = -1;
    updateSidebarPlayer(null);
  });

  const renderTracks = () => {
    tracksContainer.innerHTML = '';
    let list = filteredTracks;
    const albumId = albumSelect.value;
    const subId = subalbumSelect.value;

    if (albumId || subId) {
      const target = subId || albumId;
      list = list.filter(t => String(t.albumId || '') === target);
      if (albumId && !subId) {
        const subs = albums.filter(a => String(a.parentId || '') === albumId).map(a => a.id);
        list = filteredTracks.filter(t => String(t.albumId || '') === albumId || subs.includes(t.albumId));
      }
    } else if (!globalSearchInput.value.trim()) list = tracks;

    if (!list.length) return tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';

    list.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.trackId = t.id || '';

      card.innerHTML = `
        <img class="track-cover" src="${getCoverUrl(t)}" alt="${safeStr(t.title)} cover">
        <div class="track-info">
          <h4>${safeStr(t.title)}</h4>
          <div>${safeStr(t.artist)}</div>
        </div>
        <div class="track-actions"></div>
      `;

      const actions = card.querySelector('.track-actions');

      if (t.lyrics) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-has-lyrics';
        btn.textContent = 'ტექსტი';
        btn.addEventListener('click', ev => {
          ev.stopPropagation();
          modalTitle.textContent = t.title || 'Lyrics';
          modalLyrics.textContent = t.lyrics;
          lyricsModal.classList.remove('hidden');
          lyricsModal.setAttribute('aria-hidden', 'false');
        });
        actions.appendChild(btn);
      }

      const stream = getStreamUrl(t);
      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'download-button';
      dlBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>';
      if (stream && stream.trim()) {
        dlBtn.addEventListener('click', async ev => {
          ev.preventDefault();
          ev.stopPropagation();
          let fn = 'track.mp3';
          try { fn = decodeURIComponent(new URL(stream).pathname.split('/').pop() || 'track.mp3'); } catch {}
          await triggerDownload(stream, fn);
        });
      } else {
        dlBtn.disabled = true;
        dlBtn.style.opacity = '0.5';
      }
      actions.appendChild(dlBtn);

      card.addEventListener('click', () => {
        userHasInteracted = true;
        playTrackByIndex(list.indexOf(t));
      });

      tracksContainer.appendChild(card);
    });

    highlightCurrentTrack();

    if (pendingTrackToOpen) {
      const idx = list.findIndex(t => String(t.id) === String(pendingTrackToOpen));
      if (idx >= 0) playTrackByIndex(idx);
      pendingTrackToOpen = null;
    }
  };

  const loadData = async () => {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];
      buildAlbumSelectors();
      applySearch();
      renderTracks();
    } catch {
      tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>';
    }
  };

  refreshBtn?.addEventListener('click', loadData);

  const updateSidebarPlayer = t => {
    if (!t) {
      playerTitleSidebar.textContent = 'აირჩიეთ ტრეკი';
      playerArtistSidebar.textContent = '';
      playerCoverImg.src = 'images/midcube.png';
      playBtnSidebar.textContent = '▶';
      playerSidebar.classList.remove('playing');
      showLyricsSidebar.style.display = downloadSidebar.style.display = 'none';
      return;
    }
    playerTitleSidebar.textContent = safeStr(t.title);
    playerArtistSidebar.textContent = safeStr(t.artist);
    playerCoverImg.src = getCoverUrl(t);
    playerSidebar.classList.add('playing');
    showLyricsSidebar.style.display = t.lyrics ? 'block' : 'none';

    const stream = getStreamUrl(t);
    if (stream && stream.trim()) {
      downloadSidebar.href = stream;
      downloadSidebar.style.display = 'inline-flex';
      let fn = 'track.mp3';
      try { fn = decodeURIComponent(new URL(stream).pathname.split('/').pop() || 'track.mp3'); } catch {}
      downloadSidebar.download = fn;
    } else {
      downloadSidebar.style.display = 'none';
    }
  };

  const playTrackByIndex = idx => {
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
      }
    });
    highlightCurrentTrack();
  };

  const togglePlayPause = () => {
    userHasInteracted = true;
    audio.paused ? audio.play().catch(console.error) : audio.pause();
  };

  const playNext = () => {
    if (!filteredTracks.length) return;
    playTrackByIndex(currentTrackIndex + 1 >= filteredTracks.length ? 0 : currentTrackIndex + 1);
  };

  const playPrev = () => {
    if (!filteredTracks.length) return;
    playTrackByIndex(currentTrackIndex - 1 < 0 ? filteredTracks.length - 1 : currentTrackIndex - 1);
  };

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
    if (t?.lyrics) {
      modalTitle.textContent = t.title || 'Lyrics';
      modalLyrics.textContent = t.lyrics;
      lyricsModal.classList.remove('hidden');
      lyricsModal.setAttribute('aria-hidden', 'false');
    }
  });

  modalClose?.addEventListener('click', () => {
    lyricsModal.classList.add('hidden');
    lyricsModal.setAttribute('aria-hidden', 'true');
  });

  lyricsModal?.addEventListener('click', ev => {
    if (ev.target === lyricsModal) {
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    }
  });

  document.addEventListener('keydown', ev => {
    if (ev.key === 'Escape' && lyricsModal && !lyricsModal.classList.contains('hidden')) {
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    }
  });

  const parseDeepLink = () => {
    const track = new URLSearchParams(location.search).get('track');
    if (track) pendingTrackToOpen = track;
  };

  document.addEventListener('DOMContentLoaded', () => {
    parseDeepLink();
    loadData();
    audio.volume = parseFloat(volumeSidebar?.value || 1);
    updateSidebarPlayer(null);
  });
})();