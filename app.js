(function () {
  /* ═══════════════════════════════════════════════════
     Cube Cubic — Main App Logic  v3.0 FIXED
     Исправлено:
     - Плеер в SIDEBAR (не в header)
     - Refresh работает
     - Показывает счётчик треков "სულ ტრეკი: N"
     - Кнопка "უახლესი ტრეკები" (сортировка newest first toggle)
     - Random сортировка при загрузке
     - Видимый subalbum dropdown (size=4)
     - Клик на карточку продолжает играть, не убирает плеер
     ═══════════════════════════════════════════════════ */

  // ─── DOM элементы ───
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const tracksContainer = document.getElementById('tracks');
  const globalSearchInput = document.getElementById('global-search');
  const albumListContainer = document.getElementById('album-list');
  const refreshBtn = document.getElementById('refresh-btn');
  const newestBtn = document.getElementById('newest-tracks-btn');
  const trackCountDisplay = document.getElementById('track-count-display');
  const audio = document.getElementById('audio');

  // Плеер (SIDEBAR)
  const playerSidebar = document.getElementById('player-sidebar');
  const playerCoverImg = document.getElementById('player-cover-img');
  const playerTitle = document.getElementById('player-title-sidebar');
  const playerArtist = document.getElementById('player-artist-sidebar');
  const playBtn = document.getElementById('play-sidebar');
  const prevBtn = document.getElementById('prev-sidebar');
  const nextBtn = document.getElementById('next-sidebar');
  const progressBar = document.getElementById('progress-sidebar');
  const timeCurrent = document.getElementById('time-current-sidebar');
  const timeDuration = document.getElementById('time-duration-sidebar');
  const volumeSlider = document.getElementById('volume-sidebar');

  // Audio Visualizer
  const visualizerCanvas = document.getElementById('audio-visualizer');
  const visualizerCtx = visualizerCanvas ? visualizerCanvas.getContext('2d') : null;

  // Модалка
  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  const toast = document.getElementById('toast');

  // ─── Состояние ───
  let albums = [];
  let tracks = [];
  let filteredTracks = [];
  let currentTrackIndex = -1;
  let userInteracted = false;
  let sortNewest = false; // toggle для кнопки "უახლესი ტრეკები"

  // ════════════════════════════════
  //  Like System (localStorage)
  // ════════════════════════════════
  
  const LIKES_STORAGE_KEY = 'cubeCubicLikes';
  
  function getLikes() {
    try {
      const stored = localStorage.getItem(LIKES_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Error loading likes:', e);
      return {};
    }
  }
  
  function saveLikes(likes) {
    try {
      localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(likes));
    } catch (e) {
      console.error('Error saving likes:', e);
    }
  }
  
  function getLikeCount(trackId) {
    const likes = getLikes();
    return likes[trackId] || 0;
  }
  
  function isLikedByUser(trackId) {
    const userLikesKey = `${LIKES_STORAGE_KEY}_user`;
    try {
      const stored = localStorage.getItem(userLikesKey);
      const userLikes = stored ? JSON.parse(stored) : {};
      return userLikes[trackId] === true;
    } catch (e) {
      return false;
    }
  }
  
  function toggleLike(trackId) {
    const likes = getLikes();
    const userLikesKey = `${LIKES_STORAGE_KEY}_user`;
    
    try {
      const stored = localStorage.getItem(userLikesKey);
      const userLikes = stored ? JSON.parse(stored) : {};
      
      if (userLikes[trackId]) {
        // Unlike
        userLikes[trackId] = false;
        likes[trackId] = Math.max(0, (likes[trackId] || 0) - 1);
      } else {
        // Like
        userLikes[trackId] = true;
        likes[trackId] = (likes[trackId] || 0) + 1;
      }
      
      localStorage.setItem(userLikesKey, JSON.stringify(userLikes));
      saveLikes(likes);
      
      return userLikes[trackId];
    } catch (e) {
      console.error('Error toggling like:', e);
      return false;
    }
  }

  // ════════════════════════════════
  //  Playlist System (localStorage)
  // ════════════════════════════════
  
  const PLAYLISTS_STORAGE_KEY = 'cubeCubicPlaylists';
  
  function getPlaylists() {
    try {
      const stored = localStorage.getItem(PLAYLISTS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error loading playlists:', e);
      return [];
    }
  }
  
  function savePlaylists(playlists) {
    try {
      localStorage.setItem(PLAYLISTS_STORAGE_KEY, JSON.stringify(playlists));
    } catch (e) {
      console.error('Error saving playlists:', e);
    }
  }
  
  function createPlaylist(name) {
    if (!name || !name.trim()) return null;
    const playlists = getPlaylists();
    const newPlaylist = {
      id: Date.now().toString(),
      name: name.trim(),
      tracks: []
    };
    playlists.push(newPlaylist);
    savePlaylists(playlists);
    return newPlaylist;
  }
  
  function deletePlaylist(playlistId) {
    const playlists = getPlaylists();
    const filtered = playlists.filter(p => p.id !== playlistId);
    savePlaylists(filtered);
  }
  
  function addTrackToPlaylist(playlistId, trackId) {
    const playlists = getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist && !playlist.tracks.includes(trackId)) {
      playlist.tracks.push(trackId);
      savePlaylists(playlists);
      return true;
    }
    return false;
  }
  
  function removeTrackFromPlaylist(playlistId, trackId) {
    const playlists = getPlaylists();
    const playlist = playlists.find(p => p.id === playlistId);
    if (playlist) {
      playlist.tracks = playlist.tracks.filter(id => id !== trackId);
      savePlaylists(playlists);
      return true;
    }
    return false;
  }
  
  function getUserLikedTracks() {
    const userLikesKey = `${LIKES_STORAGE_KEY}_user`;
    try {
      const stored = localStorage.getItem(userLikesKey);
      const userLikes = stored ? JSON.parse(stored) : {};
      return Object.keys(userLikes).filter(trackId => userLikes[trackId] === true);
    } catch (e) {
      return [];
    }
  }

  // ════════════════════════════════
  //  Keyboard Shortcuts
  // ════════════════════════════════
  
  document.addEventListener('keydown', (e) => {
    // Ignore if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Ignore if modal is open
    const isModalOpen = !lyricsModal.classList.contains('hidden') || 
                        !document.getElementById('contact-modal').classList.contains('hidden') ||
                        !document.getElementById('playlist-modal').classList.contains('hidden');
    if (isModalOpen) return;
    
    switch(e.key) {
      case ' ': // Space - play/pause
        e.preventDefault();
        if (playBtn) playBtn.click();
        break;
      
      case 'ArrowLeft': // Previous track
        e.preventDefault();
        if (prevBtn) prevBtn.click();
        break;
      
      case 'ArrowRight': // Next track
        e.preventDefault();
        if (nextBtn) nextBtn.click();
        break;
      
      case 'ArrowUp': // Volume up
        e.preventDefault();
        if (audio.volume < 1) {
          audio.volume = Math.min(1, audio.volume + 0.1);
          if (volumeSlider) volumeSlider.value = audio.volume;
        }
        break;
      
      case 'ArrowDown': // Volume down
        e.preventDefault();
        if (audio.volume > 0) {
          audio.volume = Math.max(0, audio.volume - 0.1);
          if (volumeSlider) volumeSlider.value = audio.volume;
        }
        break;
      
      case 'l':
      case 'L': // Like current track
        if (currentTrackIndex >= 0 && filteredTracks[currentTrackIndex]) {
          const track = filteredTracks[currentTrackIndex];
          toggleLike(track.id);
          // Re-render to update like button
          renderTracks();
          showToast(isLikedByUser(track.id) ? 'ლაიქი დაემატა ❤️' : 'ლაიქი წაიშალა');
        }
        break;
    }
  });

  // ════════════════════════════════
  //  Audio Visualizer (Pure Visual Animation)
  // ════════════════════════════════

  let animationId = null;
  let isVisualizerActive = false;

  function drawVisualizer() {
    if (!visualizerCanvas || !visualizerCtx || !isVisualizerActive) return;
    
    animationId = requestAnimationFrame(drawVisualizer);
    
    const width = visualizerCanvas.width;
    const height = visualizerCanvas.height;
    
    visualizerCtx.clearRect(0, 0, width, height);
    
    const barCount = 64;
    const barWidth = (width / barCount) * 2.5;
    let x = 0;
    
    const time = Date.now() / 1000;
    
    for (let i = 0; i < barCount; i++) {
      // Create pseudo-random but smooth bar heights
      const frequency = 0.5 + i * 0.05;
      const amplitude = Math.sin(time * frequency + i * 0.3) * 0.5 + 0.5;
      const barHeight = amplitude * height * 0.7;
      
      const gradient = visualizerCtx.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, `rgba(15, 179, 166, ${0.6 + amplitude * 0.4})`);
      gradient.addColorStop(1, `rgba(43, 183, 164, ${0.3 + amplitude * 0.3})`);
      
      visualizerCtx.fillStyle = gradient;
      visualizerCtx.fillRect(x, height - barHeight, barWidth - 1, barHeight);
      
      x += barWidth;
    }
  }

  function startVisualizer() {
    if (!audio.paused && !isVisualizerActive) {
      isVisualizerActive = true;
      if (visualizerCanvas) {
        visualizerCanvas.classList.add('active');
        // Set canvas size
        const rect = visualizerCanvas.getBoundingClientRect();
        visualizerCanvas.width = rect.width * window.devicePixelRatio || rect.width;
        visualizerCanvas.height = rect.height * window.devicePixelRatio || rect.height;
        if (visualizerCtx) {
          visualizerCtx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);
        }
      }
      document.body.classList.add('audio-playing');
      drawVisualizer();
    }
  }

  function stopVisualizer() {
    isVisualizerActive = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    if (visualizerCanvas) {
      visualizerCanvas.classList.remove('active');
      if (visualizerCtx) {
        visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
      }
    }
    document.body.classList.remove('audio-playing');
  }

  // ════════════════════════════════
  //  Утилиты
  // ════════════════════════════════

  function formatTime(sec) {
    if (!isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
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

  async function triggerDownload(url, filename) {
    if (!url || !url.trim()) {
      showToast('ფაილი არ არის ხელმისაწვდომი');
      return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('fetch failed');
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = filename || 'track.mp3';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objUrl), 12000);
    } catch (e) {
      console.error('Download error:', e);
      showToast('შეცდომა ჩამოტვირთვისას');
    }
  }

  function getAlbumName(t) {
    if (!t || !t.albumId) return '';
    const a = albums.find(x => String(x.id) === String(t.albumId));
    return a ? (a.name || '') : '';
  }

  // Random shuffle
  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // ════════════════════════════════
  //  Обновить счётчик треков
  // ════════════════════════════════

  function updateTrackCount() {
    if (!trackCountDisplay) return;
    trackCountDisplay.textContent = `სულ ტრეკი: ${tracks.length}`;
  }

  // ════════════════════════════════
  //  Album sidebar rendering
  // ════════════════════════════════

  function renderAlbumList() {
    if (!albumListContainer) return;
    albumListContainer.innerHTML = '';
    if (!albums.length) return;

    const mains = albums
      .filter(a => !a.parentId)
      .sort((a, b) => {
        // Custom order: Songs in Georgian, Songs in English, Instrumental Music
        const order = {
          'Songs in Georgian': 1,
          'Songs in English': 2,
          'Instrumental Music': 3
        };
        const orderA = order[a.name] || 999;
        const orderB = order[b.name] || 999;
        if (orderA !== orderB) return orderA - orderB;
        return (a.name || '').localeCompare(b.name || '');
      });

    const currentAlbumId = albumSelect ? albumSelect.value : '';
    const currentSubalbumId = subalbumSelect ? subalbumSelect.value : '';

    mains.forEach(album => {
      const albumId = String(album.id || '');
      
      // Get subalbums
      const subalbums = albums
        .filter(s => String(s.parentId || '') === albumId)
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      
      const hasSubalbums = subalbums.length > 0;
      const isSelected = currentAlbumId === albumId;

      // Main album button
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-list-button';
      btn.setAttribute('data-album-id', albumId);

      // Album name with arrow if has subalbums
      const nameSpan = document.createElement('span');
      if (hasSubalbums) {
        const arrow = document.createElement('span');
        arrow.className = 'album-arrow';
        arrow.textContent = isSelected ? '▼ ' : '▶ ';
        nameSpan.appendChild(arrow);
      }
      const nameText = document.createTextNode(album.name || 'Unnamed');
      nameSpan.appendChild(nameText);
      btn.appendChild(nameSpan);

      // Track count
      const subIds = subalbums.map(s => s.id);
      const count = tracks.filter(t => {
        const tid = String(t.albumId || '');
        return tid === albumId || subIds.includes(tid);
      }).length;

      const countSpan = document.createElement('span');
      countSpan.className = 'track-count';
      countSpan.textContent = `(${count})`;
      btn.appendChild(countSpan);

      if (isSelected && !currentSubalbumId) {
        btn.classList.add('selected');
      }

      // Click handler
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        
        if (hasSubalbums) {
          // Toggle accordion
          if (currentAlbumId === albumId) {
            // Close accordion
            if (albumSelect) albumSelect.value = '';
            if (subalbumSelect) subalbumSelect.value = '';
          } else {
            // Open accordion
            if (albumSelect) albumSelect.value = albumId;
            if (subalbumSelect) subalbumSelect.value = '';
          }
        } else {
          // No subalbums - just select
          if (albumSelect) albumSelect.value = albumId;
          if (subalbumSelect) subalbumSelect.value = '';
        }
        
        renderAlbumList();
        renderTracks();
      });

      albumListContainer.appendChild(btn);

      // Render subalbums if this album is selected (ACCORDION)
      if (isSelected && hasSubalbums) {
        // "All subalbums" button
        const allSubBtn = document.createElement('button');
        allSubBtn.type = 'button';
        allSubBtn.className = 'album-list-button subalbum-button';
        allSubBtn.setAttribute('data-subalbum-id', '');
        
        const allNameSpan = document.createElement('span');
        allNameSpan.textContent = '— ყველა ქვეალბომები —';
        allSubBtn.appendChild(allNameSpan);

        const allCountSpan = document.createElement('span');
        allCountSpan.className = 'track-count';
        allCountSpan.textContent = `(${count})`;
        allSubBtn.appendChild(allCountSpan);

        if (!currentSubalbumId) {
          allSubBtn.classList.add('selected');
        }

        allSubBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (subalbumSelect) subalbumSelect.value = '';
          renderAlbumList();
          renderTracks();
        });

        albumListContainer.appendChild(allSubBtn);

        // Individual subalbum buttons
        subalbums.forEach(sub => {
          const subBtn = document.createElement('button');
          subBtn.type = 'button';
          subBtn.className = 'album-list-button subalbum-button';
          subBtn.setAttribute('data-subalbum-id', sub.id || '');

          const subNameSpan = document.createElement('span');
          subNameSpan.textContent = sub.name || 'Unnamed';
          subBtn.appendChild(subNameSpan);

          const subCount = tracks.filter(t => String(t.albumId || '') === String(sub.id)).length;
          const subCountSpan = document.createElement('span');
          subCountSpan.className = 'track-count';
          subCountSpan.textContent = `(${subCount})`;
          subBtn.appendChild(subCountSpan);

          if (currentSubalbumId === String(sub.id || '')) {
            subBtn.classList.add('selected');
          }

          subBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            if (subalbumSelect) subalbumSelect.value = String(sub.id || '');
            renderAlbumList();
            renderTracks();
          });

          albumListContainer.appendChild(subBtn);
        });
      }
    });
  }

  function onAlbumChange() {
    renderAlbumList();
    renderTracks();
  }

  // ════════════════════════════════
  //  Search
  // ════════════════════════════════

  function matchesQuery(track, q) {
    if (!q) return true;
    const low = q.toLowerCase();
    return (
      safeStr(track.title).toLowerCase().includes(low) ||
      safeStr(track.artist).toLowerCase().includes(low) ||
      safeStr(track.lyrics).toLowerCase().includes(low) ||
      getAlbumName(track).toLowerCase().includes(low)
    );
  }

  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', () => {
      renderTracks();
      renderAlbumList();
    });
  }

  // ════════════════════════════════
  //  Track cards rendering
  // ════════════════════════════════

  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    let toRender = tracks.slice();

    // Search filter
    const searchQ = globalSearchInput ? globalSearchInput.value.trim() : '';
    if (searchQ) toRender = toRender.filter(t => matchesQuery(t, searchQ));

    // Album filter
    const selAlbum = albumSelect ? albumSelect.value : '';
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

    // Playlist filter
    if (selectedPlaylistId) {
      const playlist = getPlaylists().find(p => p.id === selectedPlaylistId);
      if (playlist) {
        toRender = toRender.filter(t => playlist.tracks.includes(t.id));
      }
    }

    // Liked tracks filter
    if (showLikedOnly) {
      const likedTrackIds = getUserLikedTracks();
      toRender = toRender.filter(t => likedTrackIds.includes(t.id));
    }

    if (!toRender.length) {
      tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
      filteredTracks = [];
      return;
    }

    // Сортировка
    if (sortNewest) {
      toRender.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }
    // Иначе порядок как есть (random при загрузке)

    toRender.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card';
      card.setAttribute('data-track-id', t.id || '');

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = safeStr(t.title);
      card.appendChild(img);

      const info = document.createElement('div');
      info.className = 'track-info';

      const h4 = document.createElement('h4');
      h4.textContent = safeStr(t.title);
      info.appendChild(h4);

      const albumDiv = document.createElement('div');
      albumDiv.textContent = getAlbumName(t);
      info.appendChild(albumDiv);

      card.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'track-actions';

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

      // Like button
      const likeBtn = document.createElement('button');
      likeBtn.type = 'button';
      likeBtn.className = 'like-button';
      
      const likeCount = getLikeCount(t.id);
      const isLiked = isLikedByUser(t.id);
      
      likeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" class="heart-icon ${isLiked ? 'liked' : ''}">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
        </svg>
        <span class="like-count">${likeCount > 0 ? likeCount : ''}</span>
      `;
      
      likeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const nowLiked = toggleLike(t.id);
        const heartIcon = likeBtn.querySelector('.heart-icon');
        const countSpan = likeBtn.querySelector('.like-count');
        const newCount = getLikeCount(t.id);
        
        if (nowLiked) {
          heartIcon.classList.add('liked');
          likeBtn.classList.add('liked-animation');
          setTimeout(() => likeBtn.classList.remove('liked-animation'), 600);
        } else {
          heartIcon.classList.remove('liked');
        }
        
        countSpan.textContent = newCount > 0 ? newCount : '';
      });
      
      actions.appendChild(likeBtn);

      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'download-button';
      dlBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>';

      const streamUrl = getStreamUrl(t);
      if (streamUrl && streamUrl.trim()) {
        dlBtn.addEventListener('click', async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          const origHTML = dlBtn.innerHTML;
          let sec = 0;
          dlBtn.textContent = '0s…';
          dlBtn.disabled = true;
          const timer = setInterval(() => { sec++; dlBtn.textContent = `${sec}s…`; }, 1000);

          let fname = 'track.mp3';
          try { fname = decodeURIComponent(new URL(streamUrl).pathname.split('/').pop()) || fname; } catch (e) {}

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
      
      // Share button
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'share-button';
      shareBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>';
      shareBtn.title = 'გაზიარება';
      shareBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        
        const trackUrl = `${window.location.origin}${window.location.pathname}#track-${t.id}`;
        const shareData = {
          title: safeStr(t.title),
          text: `${safeStr(t.title)}${t.artist ? ` - ${safeStr(t.artist)}` : ''}`,
          url: trackUrl
        };
        
        try {
          // Try Web Share API first (mobile devices)
          if (navigator.share) {
            await navigator.share(shareData);
            showToast('გაზიარებულია!');
          } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(trackUrl);
            showToast('ბმული დაკოპირებულია!');
          }
        } catch (err) {
          // If share cancelled or failed, try clipboard
          if (err.name !== 'AbortError') {
            try {
              await navigator.clipboard.writeText(trackUrl);
              showToast('ბმული დაკოპირებულია!');
            } catch (clipErr) {
              showToast('შეცდომა გაზიარებისას');
            }
          }
        }
      });
      actions.appendChild(shareBtn);
      
      // Add to playlist button
      const playlistBtn = document.createElement('button');
      playlistBtn.type = 'button';
      playlistBtn.className = 'playlist-add-button';
      playlistBtn.innerHTML = '+';
      playlistBtn.title = 'დაამატე პლეილისტში';
      playlistBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openPlaylistModal(t);
      });
      actions.appendChild(playlistBtn);
      
      card.appendChild(actions);

      // Add progress bar to card
      const progressBar = document.createElement('div');
      progressBar.className = 'card-progress-bar';
      card.appendChild(progressBar);

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
    modalTitle.textContent = safeStr(t.title);
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
      if (playerTitle) playerTitle.textContent = 'აირჩიეთ ტრეკი';
      if (playerArtist) playerArtist.textContent = '';
      if (playerCoverImg) playerCoverImg.src = 'images/midcube.png';
      if (playBtn) playBtn.textContent = '▶';
      return;
    }
    if (playerTitle) playerTitle.textContent = safeStr(t.title);
    if (playerArtist) playerArtist.textContent = safeStr(t.artist);
    if (playerCoverImg) playerCoverImg.src = getCoverUrl(t);
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
        showToast('დააჭირეთ ▶ დასაკრავად');
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

  audio.addEventListener('playing', () => { 
    if (playBtn) playBtn.textContent = '❚❚';
    startVisualizer();
  });
  
  audio.addEventListener('pause', () => { 
    if (playBtn) playBtn.textContent = '▶';
    stopVisualizer();
  });
  
  audio.addEventListener('ended', () => {
    stopVisualizer();
    playNext();
  });
  
  audio.addEventListener('error', () => { 
    updatePlayer(null); 
    showToast('შეცდომა: ტრეკი ვერ ჩაიტვირთა');
    stopVisualizer();
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration && progressBar) {
      progressBar.value = audio.currentTime;
      progressBar.max = audio.duration;
      if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
    }
    
    // Update card progress bar
    updateCardProgress();
  });
  
  function updateCardProgress() {
    if (!tracksContainer || currentTrackIndex < 0 || !audio.duration) return;
    
    const currentTrack = filteredTracks[currentTrackIndex];
    if (!currentTrack) return;
    
    const card = tracksContainer.querySelector(`[data-track-id="${currentTrack.id}"]`);
    if (card) {
      const cardProgressBar = card.querySelector('.card-progress-bar');
      if (cardProgressBar) {
        const progress = (audio.currentTime / audio.duration) * 100;
        cardProgressBar.style.width = `${progress}%`;
      }
    }
  }
  
  audio.addEventListener('loadedmetadata', () => {
    if (timeDuration) timeDuration.textContent = formatTime(audio.duration);
    if (progressBar) progressBar.max = audio.duration || 0;
  });
  audio.addEventListener('volumechange', () => {
    if (volumeSlider) volumeSlider.value = audio.volume;
  });

  if (playBtn) playBtn.addEventListener('click', togglePlay);
  if (prevBtn) prevBtn.addEventListener('click', playPrev);
  if (nextBtn) nextBtn.addEventListener('click', playNext);
  if (progressBar) progressBar.addEventListener('input', () => audio.currentTime = progressBar.value);
  if (volumeSlider) volumeSlider.addEventListener('input', () => audio.volume = parseFloat(volumeSlider.value));

  // ════════════════════════════════
  //  Data loading
  // ════════════════════════════════

  async function loadData() {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('tracks.json not found');
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];

      // RANDOM SHUFFLE при каждой загрузке
      tracks = shuffleArray(tracks);

      updateTrackCount();
      renderAlbumList();
      renderTracks();
    } catch (e) {
      console.error('Error loading tracks.json:', e);
      if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">ტრეკები ვერ ჩაიტვირთა</div>';
    }
  }

  // REFRESH button — reset album selection and reload
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      // Сбросить выбор альбома
      if (albumSelect) albumSelect.value = '';
      if (subalbumSelect) subalbumSelect.value = '';
      
      // Перезагрузить данные
      loadData();
    });
  }

  // NEWEST TRACKS button (toggle)
  if (newestBtn) {
    newestBtn.addEventListener('click', () => {
      sortNewest = !sortNewest;
      if (sortNewest) {
        newestBtn.classList.add('active');
      } else {
        newestBtn.classList.remove('active');
      }
      renderTracks();
    });
  }

  // ════════════════════════════════
  //  Liked Tracks Button
  // ════════════════════════════════

  const likedBtn = document.getElementById('liked-tracks-btn');
  let showLikedOnly = false;

  if (likedBtn) {
    likedBtn.addEventListener('click', () => {
      showLikedOnly = !showLikedOnly;
      if (showLikedOnly) {
        likedBtn.classList.add('active');
        sortNewest = false;
        if (newestBtn) newestBtn.classList.remove('active');
      } else {
        likedBtn.classList.remove('active');
      }
      renderTracks();
    });
  }

  // ════════════════════════════════
  //  Playlist Management
  // ════════════════════════════════

  const newPlaylistNameInput = document.getElementById('new-playlist-name');
  const createPlaylistBtn = document.getElementById('create-playlist-btn');
  const playlistsList = document.getElementById('playlists-list');
  let selectedPlaylistId = null;

  function renderPlaylists() {
    if (!playlistsList) return;
    playlistsList.innerHTML = '';
    
    const playlists = getPlaylists();
    
    if (playlists.length === 0) {
      playlistsList.innerHTML = '<div style="color:rgba(255,255,255,0.3);font-size:11px;padding:8px;">პლეილისტები არ არის</div>';
      return;
    }
    
    playlists.forEach(playlist => {
      const item = document.createElement('div');
      item.className = 'playlist-item';
      if (selectedPlaylistId === playlist.id) {
        item.classList.add('selected');
      }
      
      const name = document.createElement('span');
      name.className = 'playlist-name';
      name.textContent = playlist.name;
      item.appendChild(name);
      
      const count = document.createElement('span');
      count.className = 'playlist-count';
      count.textContent = `(${playlist.tracks.length})`;
      item.appendChild(count);
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'playlist-delete';
      deleteBtn.textContent = '✕';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`წაშალოთ პლეილისტი "${playlist.name}"?`)) {
          deletePlaylist(playlist.id);
          if (selectedPlaylistId === playlist.id) {
            selectedPlaylistId = null;
          }
          renderPlaylists();
          renderTracks();
        }
      });
      item.appendChild(deleteBtn);
      
      item.addEventListener('click', () => {
        if (selectedPlaylistId === playlist.id) {
          selectedPlaylistId = null;
          showLikedOnly = false;
          if (likedBtn) likedBtn.classList.remove('active');
        } else {
          selectedPlaylistId = playlist.id;
          showLikedOnly = false;
          if (likedBtn) likedBtn.classList.remove('active');
          sortNewest = false;
          if (newestBtn) newestBtn.classList.remove('active');
        }
        renderPlaylists();
        renderTracks();
      });
      
      playlistsList.appendChild(item);
    });
  }

  if (createPlaylistBtn) {
    createPlaylistBtn.addEventListener('click', () => {
      const name = newPlaylistNameInput.value.trim();
      if (name) {
        createPlaylist(name);
        newPlaylistNameInput.value = '';
        renderPlaylists();
        showToast('პლეილისტი შეიქმნა!');
      }
    });
  }

  if (newPlaylistNameInput) {
    newPlaylistNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        createPlaylistBtn.click();
      }
    });
  }

  // ════════════════════════════════
  //  Playlist Modal
  // ════════════════════════════════

  const playlistModal = document.getElementById('playlist-modal');
  const playlistModalClose = document.getElementById('playlist-modal-close');
  const playlistSelectList = document.getElementById('playlist-select-list');
  let currentTrackForPlaylist = null;

  function openPlaylistModal(track) {
    if (!playlistModal || !playlistSelectList) return;
    currentTrackForPlaylist = track;
    
    const playlists = getPlaylists();
    playlistSelectList.innerHTML = '';
    
    if (playlists.length === 0) {
      playlistSelectList.innerHTML = '<div style="padding:20px;text-align:center;color:#666;">პლეილისტები არ არის<br><small>შექმენით პირველი პლეილისტი სიდბარში</small></div>';
    } else {
      playlists.forEach(playlist => {
        const item = document.createElement('div');
        item.className = 'playlist-select-item';
        
        const isInPlaylist = playlist.tracks.includes(track.id);
        
        item.innerHTML = `
          <strong>${playlist.name}</strong>
          <span>(${playlist.tracks.length} ტრეკი)</span>
          ${isInPlaylist ? '<span style="color:green;margin-left:8px;">✓</span>' : ''}
        `;
        
        item.addEventListener('click', () => {
          if (isInPlaylist) {
            removeTrackFromPlaylist(playlist.id, track.id);
            showToast(`წაშლილია "${playlist.name}"-დან`);
          } else {
            addTrackToPlaylist(playlist.id, track.id);
            showToast(`დაემატა "${playlist.name}"-ში`);
          }
          renderPlaylists();
          closePlaylistModal();
        });
        
        playlistSelectList.appendChild(item);
      });
    }
    
    playlistModal.classList.remove('hidden');
    playlistModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closePlaylistModal() {
    if (!playlistModal) return;
    playlistModal.classList.add('hidden');
    playlistModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    currentTrackForPlaylist = null;
  }

  if (playlistModalClose) {
    playlistModalClose.addEventListener('click', closePlaylistModal);
  }

  if (playlistModal) {
    playlistModal.addEventListener('click', (e) => {
      if (e.target === playlistModal) {
        closePlaylistModal();
      }
    });
  }

  // ════════════════════════════════
  //  Scroll to Top Button
  // ════════════════════════════════

  const scrollToTopBtn = document.getElementById('scroll-to-top');
  
  if (scrollToTopBtn) {
    // Show/hide based on scroll position
    window.addEventListener('scroll', () => {
      if (window.scrollY > 300) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }
    });

    // Scroll to top on click
    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // ════════════════════════════════
  //  Contact Form Modal (NEW)
  // ════════════════════════════════

  const contactBtn = document.getElementById('contact-btn');
  const contactModal = document.getElementById('contact-modal');
  const contactModalClose = document.getElementById('contact-modal-close');
  const contactCancel = document.getElementById('contact-cancel');
  const contactForm = document.getElementById('contact-form');
  const contactStatus = document.getElementById('contact-status');

  function openContactModal() {
    if (contactModal) {
      contactModal.classList.remove('hidden');
      contactModal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('modal-open');
      // Focus on first input
      const firstInput = contactForm.querySelector('input[type="text"]');
      if (firstInput) setTimeout(() => firstInput.focus(), 100);
    }
  }

  function closeContactModal() {
    if (contactModal) {
      contactModal.classList.add('hidden');
      contactModal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('modal-open');
      // Reset form and status
      if (contactForm) contactForm.reset();
      if (contactStatus) {
        contactStatus.textContent = '';
        contactStatus.className = 'contact-status hidden';
      }
    }
  }

  // Open modal button
  if (contactBtn) {
    contactBtn.addEventListener('click', openContactModal);
  }

  // Close modal buttons
  if (contactModalClose) {
    contactModalClose.addEventListener('click', closeContactModal);
  }
  if (contactCancel) {
    contactCancel.addEventListener('click', closeContactModal);
  }

  // Close on backdrop click
  if (contactModal) {
    contactModal.addEventListener('click', (e) => {
      if (e.target === contactModal) {
        closeContactModal();
      }
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (contactModal && !contactModal.classList.contains('hidden')) {
        closeContactModal();
      }
    }
  });

  // Handle form submission
  if (contactForm) {
    contactForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitBtn = document.getElementById('contact-submit');
      const formData = new FormData(contactForm);

      // Disable submit button
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'იგზავნება...';
      }

      // Hide previous status
      if (contactStatus) {
        contactStatus.className = 'contact-status hidden';
      }

      try {
        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          body: formData
        });

        const result = await response.json();

        if (result.success) {
          // Success
          if (contactStatus) {
            contactStatus.textContent = '✓ შეტყობინება გაგზავნილია!';
            contactStatus.className = 'contact-status success';
          }
          showToast('შეტყობინება გაგზავნილია!');
          
          // Close modal after 2 seconds
          setTimeout(() => {
            closeContactModal();
          }, 2000);
        } else {
          throw new Error('Form submission failed');
        }
      } catch (error) {
        console.error('Contact form error:', error);
        if (contactStatus) {
          contactStatus.textContent = '✗ შეცდომა. გთხოვთ სცადოთ თავიდან.';
          contactStatus.className = 'contact-status error';
        }
      } finally {
        // Re-enable submit button
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'გაგზავნა';
        }
      }
    });
  }

  // ════════════════════════════════
  //  Share Button (NEW)
  // ════════════════════════════════

  const shareBtn = document.getElementById('share-btn');

  async function handleShare() {
    const shareData = {
      title: 'Cube Cubic',
      text: 'შეამოწმე ეს მუსიკალური საიტი! 🎵',
      url: window.location.href.split('#')[0] // Remove any hash from URL
    };

    try {
      // Check if Web Share API is supported
      if (navigator.share) {
        await navigator.share(shareData);
        showToast('გაზიარება წარმატებული იყო!');
      } else {
        // Fallback: Copy to clipboard
        await navigator.clipboard.writeText(shareData.url);
        showToast('ბმული დაკოპირდა! 🔗');
      }
    } catch (error) {
      // User cancelled share or clipboard failed
      if (error.name !== 'AbortError') {
        console.error('Share error:', error);
        // Try alternative clipboard method
        try {
          const textArea = document.createElement('textarea');
          textArea.value = shareData.url;
          textArea.style.position = 'fixed';
          textArea.style.opacity = '0';
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand('copy');
          document.body.removeChild(textArea);
          showToast('ბმული დაკოპირდა! 🔗');
        } catch (fallbackError) {
          console.error('Fallback share error:', fallbackError);
          showToast('გაზიარება ვერ მოხერხდა');
        }
      }
    }
  }

  // Share button click handler
  if (shareBtn) {
    shareBtn.addEventListener('click', handleShare);
  }

  // ════════════════════════════════
  //  Header Logo & Title Refresh
  // ════════════════════════════════

  function refreshSite() {
    // Full page reload (like pressing F5)
    location.reload();
  }

  // Header elements
  const headerBadge = document.getElementById('header-badge');
  const headerTitle = document.querySelector('header h1');

  if (headerBadge) {
    headerBadge.addEventListener('click', refreshSite);
  }

  if (headerTitle) {
    headerTitle.addEventListener('click', refreshSite);
  }

  // ════════════════════════════════
  //  Handle shared track links (#track-id)
  // ════════════════════════════════
  
  function handleSharedTrackLink() {
    const hash = window.location.hash;
    if (hash && hash.startsWith('#track-')) {
      const trackId = hash.replace('#track-', '');
      setTimeout(() => {
        const card = tracksContainer?.querySelector(`[data-track-id="${trackId}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the shared track
          card.style.boxShadow = '0 0 0 3px rgba(15,179,166,0.5)';
          setTimeout(() => {
            card.style.boxShadow = '';
          }, 3000);
        }
      }, 500);
    }
  }

  // ─── Init ───
  document.addEventListener('DOMContentLoaded', () => {
    updatePlayer(null);
    if (audio && volumeSlider) audio.volume = parseFloat(volumeSlider.value || 1);
    renderPlaylists(); // Initialize playlists UI
    loadData().then(() => {
      handleSharedTrackLink();
    });
  });

})();
