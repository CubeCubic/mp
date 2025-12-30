(function () {
  // --- DOM элементы ---
  const els = {
    albumSelect: document.getElementById('album-select'),
    subalbumSelect: document.getElementById('subalbum-select'),
    subalbumLabel: document.getElementById('subalbum-label'),
    tracksContainer: document.getElementById('tracks'),
    globalSearch: document.getElementById('global-search'),
    albumList: document.getElementById('album-list'),

    headerPlayer: document.getElementById('header-player') || document.getElementById('player-sidebar'),
    coverImg: document.getElementById('player-cover-img'),
    title: document.getElementById('player-title-sidebar') || document.getElementById('player-title-header'),
    artist: document.getElementById('player-artist-sidebar') || document.getElementById('player-artist-header'),
    playBtn: document.getElementById('play-sidebar'),
    prevBtn: document.getElementById('prev-sidebar'),
    nextBtn: document.getElementById('next-sidebar'),
    progress: document.getElementById('progress-sidebar'),
    timeCurrent: document.getElementById('time-current-sidebar'),
    timeDuration: document.getElementById('time-duration-sidebar'),
    volume: document.getElementById('volume-sidebar'),

    audio: document.getElementById('audio'),
    lyricsModal: document.getElementById('lyrics-modal'),
    modalClose: document.getElementById('modal-close'),
    modalTitle: document.getElementById('modal-title'),
    modalLyrics: document.getElementById('modal-lyrics'),
    toast: document.getElementById('toast'),
    refreshBtn: document.getElementById('refresh-btn')
  };

  // --- Состояние ---
  let albums = [], tracks = [], currentTrackIndex = -1, pendingTrackToOpen = null, userHasInteracted = false;

  // --- Утилиты ---
  const formatTime = sec => isFinite(sec) ? `${Math.floor(sec / 60)}:${Math.floor(sec % 60).toString().padStart(2, '0')}` : '0:00';

  const getStreamUrl = t => t?.audioUrl || t?.downloadUrl || (t?.filename ? 'media/' + t.filename : null);
  const getCoverUrl = t => t?.coverUrl || (t?.cover ? 'uploads/' + t.cover : 'images/midcube.png');
  const safeStr = v => v == null ? '' : String(v);

  const showToast = msg => {
    if (els.toast) {
      els.toast.textContent = msg;
      els.toast.classList.add('visible');
      setTimeout(() => els.toast.classList.remove('visible'), 3000);
    }
  };

  // --- Рендер альбомов ---
  const renderAlbumList = () => {
    if (!els.albumList) return;
    els.albumList.innerHTML = '';

    const mains = albums.filter(a => !a.parentId).sort((a, b) => {
      if (a.name === 'Georgian') return -1;
      if (b.name === 'Georgian') return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    mains.forEach(a => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'album-list-button';
      btn.dataset.albumId = a.id || '';

      btn.innerHTML = `<span>${a.name || 'Unnamed'}</span><span class="track-count">(${tracks.filter(t => {
        const tid = String(t.albumId || '');
        const subIds = albums.filter(s => String(s.parentId || '') === String(a.id)).map(s => s.id);
        return tid === String(a.id) || subIds.includes(tid);
      }).length})</span>`;

      if (els.albumSelect?.value === String(a.id)) btn.classList.add('selected');

      btn.addEventListener('click', () => {
        els.albumSelect.value = a.id || '';
        onAlbumChange();
      });

      els.albumList.appendChild(btn);
    });
  };

  const onAlbumChange = () => {
    const mainId = els.albumSelect?.value || '';
    const subs = albums.filter(a => String(a.parentId || '') === mainId);

    if (els.subalbumSelect) {
      els.subalbumSelect.innerHTML = '<option value="">— ყველა ქვეალბომი —</option>';
      subs.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        els.subalbumSelect.appendChild(opt);
      });
      els.subalbumSelect.disabled = !subs.length;
      els.subalbumSelect.style.display = subs.length ? '' : 'none';
      if (els.subalbumLabel) els.subalbumLabel.style.display = subs.length ? '' : 'none';
      els.subalbumSelect.value = '';
    }

    renderTracks();
    renderAlbumList();
    currentTrackIndex = -1;
    updatePlayer(null);
  };

  // --- Поиск ---
  const matchesQuery = (track, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return safeStr(track.title).toLowerCase().includes(q) ||
           safeStr(track.artist).toLowerCase().includes(q) ||
           safeStr(track.lyrics).toLowerCase().includes(q) ||
           (albums.find(a => String(a.id) === String(track.albumId))?.name || '').toLowerCase().includes(q);
  };

  if (els.globalSearch) {
    els.globalSearch.addEventListener('input', () => renderTracks());
  }

  // --- Рендер треков ---
  const renderTracks = () => {
    if (!els.tracksContainer) return;
    els.tracksContainer.innerHTML = '';

    let list = tracks.slice();

    const searchQuery = els.globalSearch?.value.trim() || '';
    if (searchQuery) list = list.filter(t => matchesQuery(t, searchQuery));

    const mainId = els.albumSelect?.value || '';
    const subId = els.subalbumSelect?.value || '';

    if (subId) {
      list = list.filter(t => String(t.albumId || '') === subId);
    } else if (mainId) {
      const subIds = albums.filter(a => String(a.parentId || '') === mainId).map(a => a.id);
      list = list.filter(t => {
        const tid = String(t.albumId || '');
        return tid === mainId || subIds.includes(tid);
      });
    }

    if (!list.length) {
      els.tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
      return;
    }

    // Новые сверху
    list.sort((a, b) => (b.id || 0) - (a.id || 0));

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
        const lyricsBtn = document.createElement('button');
        lyricsBtn.type = 'button';
        lyricsBtn.className = 'btn-has-lyrics';
        lyricsBtn.textContent = 'ტექსტი';
        lyricsBtn.addEventListener('click', e => {
          e.stopPropagation();
          els.modalTitle.textContent = t.title || 'Lyrics';
          els.modalLyrics.textContent = t.lyrics;
          els.lyricsModal.classList.remove('hidden');
          els.lyricsModal.setAttribute('aria-hidden', 'false');
        });
        actions.appendChild(lyricsBtn);
      }

      const stream = getStreamUrl(t);
      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'download-button';
      downloadBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>';
      if (stream && stream.trim()) {
        downloadBtn.addEventListener('click', e => {
          e.stopPropagation();
          let filename = 'track.mp3';
          try { filename = decodeURIComponent(new URL(stream).pathname.split('/').pop()); } catch {}
          triggerDownload(stream, filename);
        });
      } else {
        downloadBtn.disabled = true;
        downloadBtn.style.opacity = '0.5';
      }
      actions.appendChild(downloadBtn);

      card.addEventListener('click', () => {
        userHasInteracted = true;
        playTrackByIndex(list.indexOf(t));
      });

      els.tracksContainer.appendChild(card);
    });

    highlightCurrentTrack();
  };

  const highlightCurrentTrack = () => {
    els.tracksContainer?.querySelectorAll('.card').forEach(c => c.classList.remove('playing-track'));
    if (currentTrackIndex >= 0 && currentTrackIndex < list.length) {
      const card = els.tracksContainer?.querySelector(`[data-track-id="${list[currentTrackIndex].id}"]`);
      if (card) {
        card.classList.add('playing-track');
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  // --- Плеер ---
  const updatePlayer = t => {
    if (!t) {
      els.title && (els.title.textContent = 'აირჩიეთ ტრეკი');
      els.artist && (els.artist.textContent = '');
      els.coverImg && (els.coverImg.src = 'images/midcube.png');
      els.playBtn && (els.playBtn.textContent = '▶');
      els.headerPlayer && els.headerPlayer.classList.remove('playing');
      return;
    }
    els.title && (els.title.textContent = safeStr(t.title));
    els.artist && (els.artist.textContent = safeStr(t.artist));
    els.coverImg && (els.coverImg.src = getCoverUrl(t));
    els.headerPlayer && els.headerPlayer.classList.add('playing');
  };

  const playTrackByIndex = idx => {
    if (idx < 0 || idx >= list.length) {
      updatePlayer(null);
      els.audio.pause();
      currentTrackIndex = -1;
      return;
    }
    currentTrackIndex = idx;
    const t = list[idx];
    updatePlayer(t);
    els.audio.src = getStreamUrl(t) || '';
    els.audio.load();
    els.audio.play().catch(e => {
      if (e.name === 'NotAllowedError' && userHasInteracted) {
        els.playBtn && (els.playBtn.textContent = '▶');
        showToast('დააჭირეთ ▶ დაკვრისთვის');
      }
    });
    highlightCurrentTrack();
  };

  const togglePlayPause = () => {
    userHasInteracted = true;
    els.audio.paused ? els.audio.play() : els.audio.pause();
  };

  const playNext = () => playTrackByIndex((currentTrackIndex + 1) % list.length || 0);
  const playPrev = () => playTrackByIndex((currentTrackIndex - 1 + list.length) % list.length);

  // --- Аудио события ---
  els.audio.addEventListener('playing', () => els.playBtn && (els.playBtn.textContent = '❚❚'));
  els.audio.addEventListener('pause', () => els.playBtn && (els.playBtn.textContent = '▶'));
  els.audio.addEventListener('ended', playNext);
  els.audio.addEventListener('timeupdate', () => {
    if (els.audio.duration && els.progress) {
      els.progress.value = els.audio.currentTime;
      els.progress.max = els.audio.duration;
      els.timeCurrent && (els.timeCurrent.textContent = formatTime(els.audio.currentTime));
    }
  });
  els.audio.addEventListener('loadedmetadata', () => {
    els.timeDuration && (els.timeDuration.textContent = formatTime(els.audio.duration));
    els.progress && (els.progress.max = els.audio.duration || 0);
  });
  els.audio.addEventListener('volumechange', () => els.volume && (els.volume.value = els.audio.volume));

  // --- Управление ---
  els.playBtn && els.playBtn.addEventListener('click', togglePlayPause);
  els.prevBtn && els.prevBtn.addEventListener('click', playPrev);
  els.nextBtn && els.nextBtn.addEventListener('click', playNext);
  els.progress && els.progress.addEventListener('input', () => els.audio.currentTime = els.progress.value);
  els.volume && els.volume.addEventListener('input', () => els.audio.volume = parseFloat(els.volume.value));

  // --- Модалка ---
  els.modalClose && els.modalClose.addEventListener('click', () => {
    els.lyricsModal.classList.add('hidden');
    els.lyricsModal.setAttribute('aria-hidden', 'true');
  });
  els.lyricsModal && els.lyricsModal.addEventListener('click', e => e.target === els.lyricsModal && els.lyricsModal.classList.add('hidden'));
  document.addEventListener('keydown', e => e.key === 'Escape' && els.lyricsModal && !els.lyricsModal.classList.contains('hidden') && els.lyricsModal.classList.add('hidden'));

  // --- Подальбомы ---
  els.subalbumSelect && els.subalbumSelect.addEventListener('change', () => {
    renderTracks();
    currentTrackIndex = -1;
    updatePlayer(null);
  });

  // --- Загрузка ---
  const loadData = async () => {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];
      renderAlbumList();
      renderTracks();
    } catch (err) {
      console.error(err);
      els.tracksContainer && (els.tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>');
    }
  };

  els.refreshBtn && els.refreshBtn.addEventListener('click', loadData);

  // --- Инициализация ---
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(location.search);
    pendingTrackToOpen = params.get('track');
    loadData();
    els.audio.volume = parseFloat(els.volume?.value || 1);
    updatePlayer(null);
  });
})();