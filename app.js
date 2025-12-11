// app.js — полный файл с плеером: плеер показывается при воспроизведении и скрывается при паузе/стопе
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
  let currentTrackId = null;
  let defaultAlbumId = null;
  let isPlaying = false;

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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

    const def = albums.find(a => a && a.name === 'სინგლი');
    if (def) defaultAlbumId = def.id;
  }

  function optionEl(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }

  function onAlbumChange() {
    if (!albumSelect) return;
    const currentAlbumId = (albumSelect.value || '').toString();

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

  function onSubalbumChange() {
    renderTracks();
  }

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
        if (albumObj && (albumObj.parentId || '') === selAlbum) return true;
        return false;
      });
    }

    if (!visible.length) {
      tracksContainer.innerHTML = '<div class="muted">No tracks</div>';
      return;
    }

    visible.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'card';

      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = t.title || 'cover';

      const info = document.createElement('div');
      info.className = 'track-info';
      const h4 = document.createElement('h4');
      h4.textContent = t.title || 'Untitled';
      const meta = document.createElement('div');
      meta.textContent = (t.artist || '') + ' • ' + (albums.find(a => a.id === t.albumId)?.name || '');

      info.appendChild(h4);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'track-actions';

      const btnPlay = document.createElement('button');
      btnPlay.textContent = 'Play';
      btnPlay.addEventListener('click', () => {
        const globalIndex = tracks.findIndex(x => x.id === t.id);
        playTrackByIndex(globalIndex);
      });

      const aDownload = document.createElement('a');
      const stream = getStreamUrl(t);
      if (stream) {
        aDownload.href = stream;
        aDownload.textContent = 'Download';
        aDownload.download = '';
      } else {
        aDownload.textContent = 'No file';
        aDownload.href = '#';
      }

      actions.appendChild(btnPlay);
      actions.appendChild(aDownload);

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
    currentTrackId = t.id;
    const src = getStreamUrl(t);
    if (!src) {
      alert('No audio source for this track');
      return;
    }

    audio.src = src;
    audio.currentTime = 0;
    titleEl.textContent = t.title || '';
    artistEl.textContent = t.artist || '';
    coverImg.src = getCoverUrl(t);
    downloadBtn.href = src;
    downloadBtn.style.display = src ? '' : 'none';
    showLyricsBtn.style.display = (t.lyrics && t.lyrics.trim()) ? '' : 'none';
    modalTitle.textContent = t.title || 'Lyrics';
    modalLyrics.textContent = t.lyrics || '';

    audio.play().then(() => {
      isPlaying = true;
      if (playerEl) playerEl.classList.add('visible');
      updatePlayButton();
    }).catch(err => {
      console.error('Playback error', err);
      isPlaying = false;
      updatePlayButton();
    });
  }

  function updatePlayButton() {
    if (!playBtn) return;
    playBtn.textContent = isPlaying ? '⏸' : '▶';
  }

  function playPrev() {
    if (currentTrackIndex > 0) playTrackByIndex(currentTrackIndex - 1);
  }
  function playNext() {
    if (currentTrackIndex < tracks.length - 1) playTrackByIndex(currentTrackIndex + 1);
  }

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
      if (!audio.duration || !progress) return;
      const pct = (audio.currentTime / audio.duration) * 100;
      progress.value = pct || 0;
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
        const firstVisibleIndex = tracks.findIndex(t => true);
        if (firstVisibleIndex >= 0) playTrackByIndex(firstVisibleIndex);
        return;
      }
      if (audio.paused) audio.play();
      else audio.pause();
    });
  }
  if (prevBtn) prevBtn.addEventListener('click', playPrev);
  if (nextBtn) nextBtn.addEventListener('click', playNext);
  if (volumeEl) {
    volumeEl.addEventListener('input', () => {
      audio.volume = parseFloat(volumeEl.value);
    });
  }
  if (progress) {
    progress.addEventListener('input', () => {
      if (!audio.duration) return;
      const pct = parseFloat(progress.value);
      audio.currentTime = (pct / 100) * audio.duration;
    });
  }

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
      const res = await fetch('tracks.json');
      if (!res.ok) throw new Error('tracks.json not found');
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];

      buildAlbumSelectors();

      if (defaultAlbumId && albumSelect) albumSelect.value = defaultAlbumId;
      else if (albumSelect && albumSelect.options.length > 1) albumSelect.selectedIndex = 1;

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
      if (tracksContainer) tracksContainer.innerHTML = '<div>Не удалось загрузить треки</div>';
    }
  }

  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => loadData());

  document.addEventListener('DOMContentLoaded', loadData);
})();
