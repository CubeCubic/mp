// frontend/app.js — полный файл с fallback-обложкой (/images/midcube.png)
(function () {
  // DOM элементы
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  const playerEl = document.getElementById('player');
  const audio = document.getElementById('audio');
  const playBtn = document.getElementById('play');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const volume = document.getElementById('volume');
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

  // State
  let albums = []; // плоский список {id, name, parentId}
  let tracks = []; // список треков (enhanced from backend)
  let currentTrackId = null;
  let defaultAlbumId = null;

  // Helpers
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
    if (t.filename) return '/media/' + t.filename;
    return null;
  }

  // NEW: helper для обложки с fallback
  function getCoverUrl(t) {
    // fallback path: /images/midcube.png (frontend/images/midcube.png -> /images/midcube.png)
    const fallback = '/images/midcube.png';
    if (!t) return fallback;
    if (t.coverUrl) return t.coverUrl;
    if (t.cover) return '/uploads/' + t.cover;
    return fallback;
  }

  // Load data from API
  async function loadData() {
    try {
      const [tracksRes, albumsRes] = await Promise.all([
        fetch('/api/tracks'),
        fetch('/api/albums')
      ]);
      tracks = await tracksRes.json();
      albums = await albumsRes.json();

      // find default album (სინგლი) if exists
      const def = albums.find(a => a && (a.name === 'სინგლი'));
      if (def) defaultAlbumId = def.id;

      buildAlbumSelectors();
      // auto-select default if present, otherwise first main album
      if (defaultAlbumId) {
        albumSelect.value = defaultAlbumId;
      } else {
        const mains = albums.filter(a => !a.parentId);
        if (mains.length) albumSelect.value = mains[0].id;
      }
      onAlbumChange();
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      tracksContainer.innerHTML = '<div>Не удалось загрузить треки</div>';
    }
  }

  // Build album select (main albums only)
  function buildAlbumSelectors() {
    if (!albumSelect) return;
    albumSelect.innerHTML = '';
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Выберите альбом';
    albumSelect.appendChild(placeholder);

    const mainAlbums = albums.filter(a => !a.parentId);
    mainAlbums.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      albumSelect.appendChild(opt);
    });

    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      subalbumSelect.style.display = 'none';
    }
    if (subalbumLabel) subalbumLabel.style.display = 'none';
  }

  // When main album changes
  function onAlbumChange() {
    const mainId = albumSelect ? albumSelect.value : '';
    if (!mainId) {
      if (tracksContainer) tracksContainer.innerHTML = '<div>Выберите альбом, чтобы увидеть треки</div>';
      if (subalbumSelect) subalbumSelect.style.display = 'none';
      if (subalbumLabel) subalbumLabel.style.display = 'none';
      return;
    }

    // build subalbum list
    const children = albums.filter(a => String(a.parentId) === String(mainId));
    if (children.length && subalbumSelect && subalbumLabel) {
      subalbumSelect.style.display = '';
      subalbumLabel.style.display = '';
      subalbumSelect.innerHTML = '';
      const allOpt = document.createElement('option');
      allOpt.value = '';
      allOpt.textContent = 'All';
      subalbumSelect.appendChild(allOpt);
      children.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id;
        o.textContent = c.name;
        subalbumSelect.appendChild(o);
      });
    } else {
      if (subalbumSelect) subalbumSelect.style.display = 'none';
      if (subalbumLabel) subalbumLabel.style.display = 'none';
    }

    // show tracks for main album (including tracks in subalbums)
    renderTracksForMain(mainId);
  }

  // When subalbum changes
  function onSubalbumChange() {
    const subId = subalbumSelect ? subalbumSelect.value : '';
    const mainId = albumSelect ? albumSelect.value : '';
    if (!mainId) return;
    if (!subId) {
      renderTracksForMain(mainId);
    } else {
      const list = tracks.filter(t => String(t.albumId) === String(subId));
      renderTrackList(list);
    }
  }

  // Render tracks for main album (direct + children)
  function renderTracksForMain(mainId) {
    const direct = tracks.filter(t => String(t.albumId) === String(mainId));
    const childIds = albums.filter(a => String(a.parentId) === String(mainId)).map(a => a.id);
    const fromChildren = tracks.filter(t => childIds.includes(String(t.albumId)));
    const merged = [...direct, ...fromChildren];
    renderTrackList(merged);
  }

  // Render a list of track objects
  function renderTrackList(list) {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';
    if (!list.length) {
      tracksContainer.innerHTML = '<div>Треков нет</div>';
      return;
    }

    list.forEach(t => {
      const cover = getCoverUrl(t);
      const stream = getStreamUrl(t) || '';
      const el = document.createElement('div');
      el.className = 'card';
      el.dataset.trackId = t.id;
      el.innerHTML = `
        ${cover ? `<img class="track-cover" src="${escapeHtml(cover)}" alt="${escapeHtml(t.title)}" loading="lazy" data-track-id="${t.id}">` : ''}
        <div class="track-info">
          <h4 class="track-title" data-track-id="${t.id}">${escapeHtml(t.title)}</h4>
          <div class="track-artist">${escapeHtml(t.artist || '')}</div>
        </div>
        <div class="track-actions">
          <button class="btn-play" data-id="${t.id}" data-src="${escapeHtml(stream)}">▶</button>
          <button class="btn-download" data-src="${escapeHtml(stream)}">ჩამოტვირთვა</button>
          <button class="btn-like" data-id="${t.id}">❤ <span>${t.likes || 0}</span></button>
          <button class="btn-lyrics" data-id="${t.id}">ტექსტი</button>
        </div>
      `;
      tracksContainer.appendChild(el);
    });

    // Attach listeners: play buttons, download, like, lyrics
    tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const src = e.currentTarget.getAttribute('data-src');
        togglePlayByTrackId(id, src);
      });
    });

    tracksContainer.querySelectorAll('.btn-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const src = e.currentTarget.getAttribute('data-src');
        if (!src) return;
        const a = document.createElement('a');
        a.href = src;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      });
    });

    tracksContainer.querySelectorAll('.btn-like').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        try {
          const res = await fetch(`/api/tracks/${id}/like`, { method: 'POST' });
          const json = await res.json();
          const span = e.currentTarget.querySelector('span');
          if (span && json.likes !== undefined) span.textContent = String(json.likes);
        } catch (err) {
          console.error('Like error', err);
        }
      });
    });

    tracksContainer.querySelectorAll('.btn-lyrics').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        const t = tracks.find(x => x.id === id);
        if (!t) return;
        modalTitle.textContent = t.title || 'ლირიკა';
        modalLyrics.textContent = t.lyrics || 'ლირიკა არ არის';
        lyricsModal.classList.remove('hidden');
      });
    });

    // Title and cover click: toggle play/pause or start new track
    tracksContainer.querySelectorAll('.track-title').forEach(el => {
      el.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-track-id');
        const t = tracks.find(x => x.id === id);
        if (!t) return;
        togglePlayByTrackId(id, getStreamUrl(t));
      });
    });
    tracksContainer.querySelectorAll('.track-cover').forEach(img => {
      img.addEventListener('click', (e) => {
        const id = e.currentTarget.getAttribute('data-track-id');
        const t = tracks.find(x => x.id === id);
        if (!t) return;
        togglePlayByTrackId(id, getStreamUrl(t));
      });
    });
  }

  // Toggle play/pause by track id (click on title/cover or play button)
  function togglePlayByTrackId(id, src) {
    if (!id) return;
    // if same track is playing
    if (currentTrackId === id) {
      if (audio.paused) {
        audio.play().catch(() => {});
      } else {
        audio.pause(); // pause will hide player via event listener
      }
      return;
    }
    // different track: load and play
    playByTrackId(id, src);
  }

  // Play a track by id (load src, update UI, show player)
  function playByTrackId(id, src) {
    const t = tracks.find(x => x.id === id);
    if (!t) return;
    const url = src || getStreamUrl(t);
    if (!url) return;

    currentTrackId = id;
    audio.pause();
    audio.src = url;
    audio.load();
    audio.play().catch(() => {});
    titleEl.textContent = t.title || '';
    artistEl.textContent = t.artist || '';
    coverImg.src = getCoverUrl(t);
    coverImg.alt = t.title ? `Cover for ${t.title}` : 'Cover';
    downloadBtn.setAttribute('href', url);
    // player will be shown on audio.play event
  }

  // Player controls
  playBtn?.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });

  prevBtn?.addEventListener('click', () => {
    const list = getCurrentFilteredList();
    if (!list.length) return;
    const idx = list.findIndex(x => x.id === currentTrackId);
    const prev = list[(idx - 1 + list.length) % list.length];
    playByTrackId(prev.id, getStreamUrl(prev));
  });

  nextBtn?.addEventListener('click', () => {
    const list = getCurrentFilteredList();
    if (!list.length) return;
    const idx = list.findIndex(x => x.id === currentTrackId);
    const next = list[(idx + 1) % list.length];
    playByTrackId(next.id, getStreamUrl(next));
  });

  volume?.addEventListener('input', () => { audio.volume = Number(volume.value); });

  // Progress/time
  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && !isNaN(audio.duration)) timeDuration.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      progress.value = (audio.currentTime / audio.duration) * 100;
      timeCurrent.textContent = formatTime(audio.currentTime);
    }
  });

  progress.addEventListener('input', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      audio.currentTime = (Number(progress.value) / 100) * audio.duration;
    }
  });

  // Show player on play; hide on pause or ended (with smooth animation via CSS)
  audio.addEventListener('play', () => {
    playerEl.classList.add('visible');
    playBtn.textContent = '⏸';
  });

  audio.addEventListener('pause', () => {
    playBtn.textContent = '▶';
    // hide player with animation
    playerEl.classList.remove('visible');
  });

  audio.addEventListener('ended', () => {
    playBtn.textContent = '▶';
    playerEl.classList.remove('visible');
    currentTrackId = null;
    audio.src = '';
    progress.value = 0;
    timeCurrent.textContent = formatTime(0);
    timeDuration.textContent = formatTime(0);
  });

  // Lyrics modal
  modalClose?.addEventListener('click', () => lyricsModal.classList.add('hidden'));
  lyricsModal?.addEventListener('click', (e) => { if (e.target === lyricsModal) lyricsModal.classList.add('hidden'); });

  // Utility: get currently filtered list (main + sub selection)
  function getCurrentFilteredList() {
    const mainId = albumSelect ? albumSelect.value : '';
    if (!mainId) return [];
    const subId = subalbumSelect ? subalbumSelect.value : '';
    if (subId) return tracks.filter(t => String(t.albumId) === String(subId));
    // main + children
    const direct = tracks.filter(t => String(t.albumId) === String(mainId));
    const childIds = albums.filter(a => String(a.parentId) === String(mainId)).map(a => a.id);
    const fromChildren = tracks.filter(t => childIds.includes(String(t.albumId)));
    return [...direct, ...fromChildren];
  }

  // Album/subalbum handlers
  albumSelect?.addEventListener('change', onAlbumChange);
  subalbumSelect?.addEventListener('change', onSubalbumChange);

  // Init
  document.addEventListener('DOMContentLoaded', loadData);
})();
