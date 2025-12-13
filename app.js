// Cube Cubic — фронт‑логика главной страницы.
// Что реализовано:
// - Альбомы и треки без столбца Artist.
// - Колонка маленького кавера перед Title.
// - Модалка увеличенного кавера.
// - Модалка текста трека (кнопка «ტექსტი» подсвечивается при наличии).
// - Поиск по текущему альбому.
// - Скачивание по конкретному URL (downloadUrl).
// - Проигрыватель: воспроизведение/пауза, prev/next, прогресс, время, громкость.
// Допуск: проигрыватель обновлён для лучшей интеграции, без внешних зависимостей.

document.addEventListener('DOMContentLoaded', () => {
  // ==== DOM ссылки ====
  const albumsContainer = document.getElementById('albums');
  const tracksTableBody = document.querySelector('#tracks tbody');
  const searchInput = document.getElementById('search');

  // Cover modal
  const coverModal = document.getElementById('cover-modal');
  const coverModalImg = document.getElementById('cover-modal-img');
  const coverModalClose = document.getElementById('cover-modal-close');

  // Lyrics modal
  const lyricsModal = document.getElementById('lyrics-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');
  const closeLyrics = document.getElementById('close-lyrics');

  // Player
  const playerTitle = document.getElementById('player-title');
  const playerProgressBar = document.getElementById('player-progress');
  const playerHandle = document.getElementById('player-handle');
  const playerCurrentTimeEl = document.getElementById('player-current');
  const playerDurationEl = document.getElementById('player-duration');
  const btnPrev = document.getElementById('btn-prev');
  const btnPlay = document.getElementById('btn-play');
  const btnNext = document.getElementById('btn-next');
  const volumeRange = document.getElementById('volume');

  // Внутренний audio элемент (скрытый)
  const audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous'; // если треки с другого домена и разрешён CORS

  // ==== Состояние ====
  let albums = [];
  let currentAlbumIndex = 0;
  let currentTrackIndex = 0;
  let filteredTracks = null; // массив треков после поиска, если активен

  // ==== Реальные данные альбомов/треков ====
  // Вставь свои пути к каверам и трекам. При необходимости расширь данные.
  albums = [
    {
      title: 'Cube Cubic',
      cover: 'covers/midcube.png',
      tracks: [
        {
          title: 'Cube Cubic',
          cover: 'covers/midcube.png',
          lyrics: 'Cube Cubic lyrics...',
          downloadUrl: 'tracks/cube-cubic.mp3'
        },
        {
          title: 'Tesseract',
          cover: 'covers/tesseract.png',
          lyrics: '',
          downloadUrl: 'tracks/tesseract.mp3'
        },
        {
          title: 'Silence',
          cover: 'covers/silence.png',
          lyrics: 'Silence lyrics...',
          downloadUrl: 'tracks/silence.mp3'
        },
        {
          title: 'Lowpoly',
          cover: 'covers/lowpoly.png',
          lyrics: '',
          downloadUrl: 'tracks/lowpoly.mp3'
        },
        {
          title: 'Neon',
          cover: 'covers/neon.png',
          lyrics: '',
          downloadUrl: 'tracks/neon.mp3'
        }
      ]
    },
    {
      title: 'Helio World',
      cover: 'covers/helio.png',
      tracks: [
        {
          title: 'Helio Intro',
          cover: 'covers/helio-intro.png',
          lyrics: '',
          downloadUrl: 'tracks/helio-intro.mp3'
        },
        {
          title: 'Helio Rise',
          cover: 'covers/helio-rise.png',
          lyrics: '',
          downloadUrl: 'tracks/helio-rise.mp3'
        }
      ]
    },
    {
      title: 'Alphx Wave',
      cover: 'covers/alphx.png',
      tracks: [
        {
          title: 'Wave 1',
          cover: 'covers/wave1.png',
          lyrics: '',
          downloadUrl: 'tracks/wave1.mp3'
        },
        {
          title: 'Wave 2',
          cover: 'covers/wave2.png',
          lyrics: 'Wave 2 lyrics...',
          downloadUrl: 'tracks/wave2.mp3'
        }
      ]
    },
    {
      title: 'Funky Friday',
      cover: 'covers/funky.png',
      tracks: [
        {
          title: 'Funk A',
          cover: 'covers/funka.png',
          lyrics: '',
          downloadUrl: 'tracks/funka.mp3'
        },
        {
          title: 'Funk B',
          cover: 'covers/funkb.png',
          lyrics: '',
          downloadUrl: 'tracks/funkb.mp3'
        }
      ]
    }
  ];

  // ==== Инициализация ====
  renderAlbums();
  renderTracks(getCurrentTracks());
  // Выставим первый трек в плеер (без автоплей)
  selectTrack(0, false);

  // ==== Поиск по текущему альбому ====
  searchInput.addEventListener('input', () => {
    const q = (searchInput.value || '').trim().toLowerCase();
    const tracks = getCurrentTracks();
    if (!q) {
      filteredTracks = null;
      renderTracks(tracks);
      return;
    }
    filteredTracks = tracks.filter(t => (t.title || '').toLowerCase().includes(q));
    renderTracks(filteredTracks);
  });

  // ==== Модалка кавера ====
  coverModalClose.addEventListener('click', () => {
    coverModal.setAttribute('aria-hidden', 'true');
  });
  coverModal.addEventListener('click', (e) => {
    // Закрытие по клику на фон
    if (e.target === coverModal) {
      coverModal.setAttribute('aria-hidden', 'true');
    }
  });

  // ==== Модалка текста ====
  closeLyrics.addEventListener('click', () => {
    lyricsModal.classList.add('hidden');
    lyricsModal.setAttribute('aria-hidden', 'true');
  });
  lyricsModal.addEventListener('click', (e) => {
    const content = e.target.closest('.lyrics-content');
    if (!content) {
      lyricsModal.classList.add('hidden');
      lyricsModal.setAttribute('aria-hidden', 'true');
    }
  });

  // ==== Управление плеером ====
  btnPlay.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(() => {});
      btnPlay.textContent = '⏸'; // визуально: пауза
    } else {
      audio.pause();
      btnPlay.textContent = '⏯'; // визуально: плей
    }
  });

  btnPrev.addEventListener('click', () => {
    const tracks = getActiveTrackList();
    if (!tracks.length) return;
    currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    selectTrack(currentTrackIndex, true);
  });

  btnNext.addEventListener('click', () => {
    const tracks = getActiveTrackList();
    if (!tracks.length) return;
    currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
    selectTrack(currentTrackIndex, true);
  });

  volumeRange.addEventListener('input', () => {
    audio.volume = clamp(volumeRange.value / 100, 0, 1);
  });

  // Обновление времени и прогресса
  audio.addEventListener('timeupdate', () => {
    updateProgressUI();
  });

  audio.addEventListener('loadedmetadata', () => {
    playerDurationEl.textContent = formatTime(audio.duration);
    updateProgressUI();
  });

  audio.addEventListener('ended', () => {
    // Автопереход к следующему треку
    const tracks = getActiveTrackList();
    if (!tracks.length) return;
    currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
    selectTrack(currentTrackIndex, true);
  });

  // Перемотка по клику на прогресс‑бар
  playerProgressBar.addEventListener('click', (e) => {
    const rect = playerProgressBar.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    if (isFinite(audio.duration)) {
      audio.currentTime = audio.duration * ratio;
    }
  });

  // ==== Рендер альбомов ====
  function renderAlbums() {
    albumsContainer.innerHTML = '';
    albums.forEach((album, idx) => {
      const card = document.createElement('div');
      card.className = 'album-card' + (idx === currentAlbumIndex ? ' selected' : '');

      const img = document.createElement('img');
      img.className = 'album-thumb';
      img.src = album.cover;
      img.alt = album.title;

      const title = document.createElement('div');
      title.className = 'album-title';
      title.textContent = album.title;

      card.appendChild(img);
      card.appendChild(title);

      card.addEventListener('click', () => {
        currentAlbumIndex = idx;
        document.querySelectorAll('.album-card').forEach(el => el.classList.remove('selected'));
        card.classList.add('selected');
        filteredTracks = null;
        searchInput.value = '';
        renderTracks(getCurrentTracks());
        // При переключении альбома сбрасываем текущий трек на первый
        selectTrack(0, false);
      });

      albumsContainer.appendChild(card);
    });
  }

  // ==== Рендер треков (без Artist; с маленьким Cover) ====
  function renderTracks(tracks) {
    tracksTableBody.innerHTML = '';

    tracks.forEach((t, i) => {
      const tr = document.createElement('tr');

      // #
      const tdNum = document.createElement('td');
      tdNum.className = 'col-num';
      tdNum.textContent = i + 1;
      tr.appendChild(tdNum);

      // Cover (маленький)
      const tdCover = document.createElement('td');
      tdCover.className = 'col-cover';

      const coverImg = document.createElement('img');
      coverImg.className = 'track-cover';
      coverImg.src = t.cover;
      coverImg.alt = t.title || 'Cover';
      coverImg.addEventListener('click', (ev) => {
        ev.stopPropagation();
        coverModalImg.src = t.cover;
        coverModal.setAttribute('aria-hidden', 'false');
      });
      tdCover.appendChild(coverImg);
      tr.appendChild(tdCover);

      // Title (клик по названию — воспроизведение)
      const tdTitle = document.createElement('td');
      tdTitle.className = 'col-title';
      tdTitle.textContent = t.title || '—';
      tdTitle.style.cursor = 'pointer';
      tdTitle.addEventListener('click', () => {
        const list = getActiveTrackList();
        const idxInList = list.indexOf(t);
        if (idxInList !== -1) {
          currentTrackIndex = idxInList;
          selectTrack(currentTrackIndex, true);
        }
      });
      tr.appendChild(tdTitle);

      // Actions
      const tdActions = document.createElement('td');
      tdActions.className = 'col-actions';

      // Lyrics
      const btnLyrics = document.createElement('button');
      btnLyrics.type = 'button';
      btnLyrics.className = 'btn btn-lyrics';
      btnLyrics.textContent = 'ტექსტი';
      if (t.lyrics && String(t.lyrics).trim().length) {
        btnLyrics.classList.add('btn-has-lyrics');
      }
      btnLyrics.addEventListener('click', (ev) => {
        ev.stopPropagation();
        modalTitle.textContent = t.title || 'Lyrics';
        modalLyrics.textContent = t.lyrics || '';
        lyricsModal.classList.remove('hidden');
        lyricsModal.setAttribute('aria-hidden', 'false');
      });
      tdActions.appendChild(btnLyrics);

      // Download
      const btnDownload = document.createElement('button');
      btnDownload.type = 'button';
      btnDownload.className = 'btn btn-icon';
      btnDownload.textContent = '⬇';
      btnDownload.title = 'Download';
      btnDownload.addEventListener('click', (ev) => {
        ev.stopPropagation();
        triggerDownload(t);
      });
      tdActions.appendChild(btnDownload);

      tr.appendChild(tdActions);
      tracksTableBody.appendChild(tr);
    });
  }

  // ==== Выбор трека в плеере ====
  function selectTrack(trackIndex, autoplay) {
    const list = getActiveTrackList();
    if (!list.length) return;
    currentTrackIndex = clamp(trackIndex, 0, list.length - 1);
    const track = list[currentTrackIndex];

    // Обновляем заголовок в плеере
    playerTitle.textContent = track.title || '—';

    // Устанавливаем источник и начинаем/останавливаем проигрывание
    audio.src = track.downloadUrl; // используем downloadUrl как реальный аудио‑URL
    audio.currentTime = 0;

    // Кнопка плей/пауза — согласно состоянию
    if (autoplay) {
      audio.play().then(() => {
        btnPlay.textContent = '⏸';
      }).catch(() => {
        btnPlay.textContent = '⏯';
      });
    } else {
      audio.pause();
      btnPlay.textContent = '⏯';
    }

    // Сброс прогресса/времени
    playerCurrentTimeEl.textContent = '0:00';
    playerDurationEl.textContent = isFinite(audio.duration) ? formatTime(audio.duration) : '0:00';
    updateProgressUI();
  }

  // ==== Активный список треков (учёт поиска) ====
  function getActiveTrackList() {
    return Array.isArray(filteredTracks) ? filteredTracks : getCurrentTracks();
  }

  // ==== Треки текущего альбома ====
  function getCurrentTracks() {
    const album = albums[currentAlbumIndex];
    return album ? album.tracks || [] : [];
  }

  // ==== Обновление прогресс‑UI ====
  function updateProgressUI() {
    const duration = audio.duration || 0;
    const current = audio.currentTime || 0;
    playerCurrentTimeEl.textContent = formatTime(current);
    playerDurationEl.textContent = isFinite(duration) ? formatTime(duration) : '0:00';

    const barRect = playerProgressBar.getBoundingClientRect();
    const ratio = duration ? clamp(current / duration, 0, 1) : 0;
    const x = ratio * (barRect.width || 0);
    playerHandle.style.left = Math.max(0, Math.floor(x)) + 'px';
  }

  // ==== Скачивание файла ====
  function triggerDownload(track) {
    // Если нужен программный «скачать» без перехода:
    // создаём временную ссылку и кликаем по ней
    if (!track || !track.downloadUrl) return;
    const a = document.createElement('a');
    a.href = track.downloadUrl;
    a.download = ''; // пусть браузер пытается скачать; можно задать имя
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // ==== Утилиты ====
  function clamp(n, min, max) {
    return Math.min(Math.max(n, min), max);
  }

  function formatTime(sec) {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, '0')}`;
  }
});
