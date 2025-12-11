// app.js — полный и завершённый файл
// Особенности: 4 колонки, проигрывание по клику на обложку, кнопка "ტექსტი" на карточке, компактный плеер

(function () {
  // DOM элементы (безопасно — проверяем наличие)
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

  const refreshBtn = document.getElementById('refresh-btn');

  // Состояние
  let albums = [];
  let tracks = [];
  let currentTrackIndex = -1;
  let isPlaying = false;

  // Утилиты
  function safeText(s) { return (s === null || s === undefined) ? '' : String(s); }
  function formatTime(sec) {
    if (!isFinite(sec) || sec <= 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  function optionEl(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }

  // Пути/ресурсы
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

  // Построение селекторов альбомов
  function buildAlbumSelectors() {
    if (!albumSelect) return;
    albumSelect.innerHTML = '';
    albumSelect.appendChild(optionEl('', '— ყველა ალბომი —'));
    const mains = albums.filter(a => !a.parentId);
    mains.forEach(a => albumSelect.appendChild(optionEl(a.id, safeText(a.name))));

    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      subalbumSelect.disabled = true;
      subalbumSelect.style.display = 'none';
      if (subalbumLabel) subalbumLabel.style.display = 'none';
    }
  }

  // Обработчики выбора альбома/подальбома
  function onAlbumChange() {
    if (!albumSelect) return;
    const currentAlbumId = (albumSelect.value || '').toString();

    if (subalbumSelect) {
      const subs = albums.filter(a => (a.parentId || '').toString() === currentAlbumId);
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      if (subs.length) {
        subs.forEach(s => subalbumSelect.appendChild(optionEl(s.id, safeText(s.name))));
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

  // Рендер карточек треков (4 колонки — CSS отвечает за сетку)
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
      const empty = document.createElement('div');
      empty.className = 'muted';
      empty.textContent = 'Нет треков';
      tracksContainer.appendChild(empty);
      return;
    }

    visible.forEach((t) => {
      const card = document.createElement('div');
      card.className = 'card';

      // Обложка — клик по ней запускает/пауза
      const img = document.createElement('img');
      img.className = 'track-cover';
      img.src = getCoverUrl(t);
      img.alt = safeText(t.title) || 'cover';
      img.addEventListener('click', () => {
        const idx = tracks.findIndex(x => x.id === t.id);
        if (idx === -1) return;
        // Если клик по уже проигрываемому треку — переключаем паузу/воспроизведение
        if (idx === currentTrackIndex) {
          if (audio.paused) audio.play();
          else audio.pause();
        } else {
          playTrackByIndex(idx);
        }
      });

      // Информация
      const info = document.createElement('div');
      info.className = 'track-info';
      const h4 = document.createElement('h4');
      h4.textContent = safeText(t.title) || 'Untitled';
      const meta = document.createElement('div');
      const albumName = (albums.find(a => a.id === t.albumId) || {}).name || '';
      meta.textContent = (t.artist || '') + (albumName ? ' • ' + albumName : '');
      info.appendChild(h4);
      info.appendChild(meta);

      // Действия: кнопка "ტექსტი" и download
      const actions = document.createElement('div');
      actions.className = 'track-actions';

      const btnLyrics = document.createElement('button');
      btnLyrics.type = 'button';
      btnLyrics.textContent = 'ტექსტი';
      btnLyrics.addEventListener('click', (ev) => {
        ev.stopPropagation();
        modalTitle.textContent = safeText(t.title) || 'ტექსტი';
        modalLyrics.textContent = t.lyrics || '';
        if (lyricsModal) {
          lyricsModal.classList.remove('hidden');
          lyricsModal.setAttribute('aria-hidden', 'false');
        }
      });
      actions.appendChild(btnLyrics);

      const aDownload = document.createElement('a');
      const stream = getStreamUrl(t);
      if (stream) {
        aDownload.href = stream;
        aDownload.textContent = 'Download';
        aDownload.download = '';
        aDownload.className = 'download-link';
      } else {
        aDownload.textContent = 'No file';
        aDownload.href = '#';
        aDownload.className = 'download-link disabled';
      }
      actions.appendChild(aDownload);

      // Сборка карточки
      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(actions);
      tracksContainer.appendChild(card);
    });
  }

  // Воспроизведение трека по индексу
  function playTrackByIndex(index) {
    if (index < 0 || index >= tracks.length) return;
    currentTrackIndex = index;
    const t = tracks[currentTrackIndex];
    if (!t) return;
    const src = getStreamUrl(t);
    if (!src) {
      alert('Аудиофайл не найден');
      return;
    }

    // Обновляем UI плеера
    audio.src = src;
    audio.currentTime = 0;
    titleEl && (titleEl.textContent = safeText(t.title) || '');
    artistEl && (artistEl.textContent = safeText(t.artist) || '');
    coverImg && (coverImg.src = getCoverUrl(t));
    downloadBtn && (downloadBtn.href = src);
    if (downloadBtn) downloadBtn.style.display = src ? '' : 'none';
    if (showLyricsBtn) showLyricsBtn.style.display = (t.lyrics && t.lyrics.trim()) ? '' : 'none';
    if (modalTitle) modalTitle.textContent = safeText(t.title) || 'ტექსტი';
    if (modalLyrics) modalLyrics.textContent = t.lyrics || '';

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

  // События audio
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

  // Контролы плеера
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!audio.src) {
        // запустить первый трек, если ничего не загружено
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

  // Модалка текста
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

  // Загрузка tracks.json
  async function loadData() {
    try {
      const res = await fetch('tracks.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('tracks.json not found');
      const data = await res.json();
      tracks = Array.isArray(data.tracks) ? data.tracks : (data.tracks || []);
      albums = Array.isArray(data.albums) ? data.albums : (data.albums || []);
      buildAlbumSelectors();

      // Подключаем обработчики селектов (один раз)
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
      if (tracksContainer) {
        tracksContainer.innerHTML = '<div class="muted">Не удалось загрузить треки</div>';
      }
    }
  }

  if (refreshBtn) refreshBtn.addEventListener('click', () => loadData());

  // Инициализация
  document.addEventListener('DOMContentLoaded', () => {
    loadData();
    // Установим начальные значения громкости и прогресса
    if (volumeEl && audio) audio.volume = parseFloat(volumeEl.value || 1);
    if (progress) progress.value = 0;
  });
})();
