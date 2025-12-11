(function () {
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

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

  // Работа с локальным хранилищем лайков
  const LIKES_KEY = 'trackLikes';
  function loadLikes() {
    try {
      const raw = localStorage.getItem(LIKES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function saveLikes(obj) {
    try {
      localStorage.setItem(LIKES_KEY, JSON.stringify(obj));
    } catch {}
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

  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    const selAlbum = albumSelect ? (albumSelect.value || '') : '';
    const selSub = subalbumSelect ? (subalbumSelect.value || '') : '';

    let visible = tracks.slice();

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
      tracksContainer.innerHTML = '<div class="muted">Нет треков</div>';
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

      // 1) Кнопка открытия модалки с текстом (ტექსტი) — на своём месте
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

      // 2) Download — рядом с кнопкой текста
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

      // 3) Кнопка оценки (сердечко) — рядом с Download
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

      likeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const newCount = incrementLikesFor(key);
        countSpan.textContent = newCount;
      });

      actions.appendChild(likeBtn);

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(actions);
      tracksContainer.appendChild(card);
    });
  }

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
    if (downloadBtn) downloadBtn.href = src;
    if (downloadBtn) downloadBtn.style.display = src ? '' : 'none';
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

      renderTracks();
    } catch (err) {
      console.error('Ошибка загрузки tracks.json:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>';
    }
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadData());

  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    if (volumeEl && audio) audio.volume = parseFloat(volumeEl.value || 1);
    if (progress) progress.value = 0;
  });
})();
