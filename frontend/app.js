// frontend/app.js — альбомы как выпадающий список, фильтрация треков, Default album
(async function () {
  const albumSelect = document.getElementById('album-select');
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

  let tracks = [];
  let albums = [];
  let currentIndex = -1;
  let defaultAlbumId = null;

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
    if (t.audioUrl) return t.audioUrl;
    if (t.downloadUrl) return t.downloadUrl;
    if (t.filename) return '/media/' + t.filename;
    return null;
  }

  async function loadData() {
    try {
      const [tracksRes, albumsRes] = await Promise.all([
        fetch('/api/tracks'),
        fetch('/api/albums')
      ]);
      tracks = await tracksRes.json();
      albums = await albumsRes.json();

      // Найдём альбом Default (по имени "Default") — если нет, frontend всё равно обработает
      const def = albums.find(a => a.name === 'Default' || a.name === 'Дефолт');
      if (def) defaultAlbumId = def.id;

      renderAlbums();
      // По умолчанию выбираем Default, если он есть; иначе первый альбом
      if (defaultAlbumId) albumSelect.value = defaultAlbumId;
      else if (albums.length) albumSelect.value = albums[0].id;
      // Показываем треки для выбранного альбома
      renderTracksForSelectedAlbum();
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      tracksContainer.innerHTML = '<div>Не удалось загрузить треки</div>';
    }
  }

  function renderAlbums() {
    albumSelect.innerHTML = '';
    // Пустой плейсхолдер
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Выберите альбом';
    albumSelect.appendChild(placeholder);

    // Сортируем альбомы по имени (или по дате, если нужно)
    albums.forEach(a => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      albumSelect.appendChild(opt);
    });
  }

  function renderTracksForSelectedAlbum() {
    const selected = albumSelect.value;
    if (!selected) {
      // Если ничего не выбрано — не показываем все треки (по требованию)
      tracksContainer.innerHTML = '<div>Выберите альбом, чтобы увидеть треки</div>';
      return;
    }

    // Фильтрация: трек принадлежит альбому, если t.albumId === selected
    // Для треков без albumId (null/undefined) считаем их принадлежащими defaultAlbumId
    const filtered = tracks.filter(t => {
      const tid = t.albumId || defaultAlbumId || null;
      return String(tid) === String(selected);
    });

    if (!filtered.length) {
      tracksContainer.innerHTML = '<div>Треков в этом альбоме нет</div>';
      return;
    }

    tracksContainer.innerHTML = '';
    filtered.forEach((t, idx) => {
      const cover = t.coverUrl || (t.cover ? '/uploads/' + t.cover : '');
      const stream = getStreamUrl(t) || '';
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `
        ${cover ? `<img class="track-cover" src="${cover}" alt="${escapeHtml(t.title)}" loading="lazy">` : ''}
        <div class="track-info">
          <h4>${escapeHtml(t.title)}</h4>
          <div>${escapeHtml(t.artist || '')}</div>
        </div>
        <div class="track-actions">
          <button class="btn-play" data-src="${stream}" data-id="${t.id}">▶</button>
          <button class="btn-download" data-src="${stream}">ჩამოტვირთვა</button>
          <button class="btn-like" data-id="${t.id}">❤ <span>${t.likes || 0}</span></button>
          <button class="btn-lyrics" data-id="${t.id}">ტექსტი</button>
        </div>
      `;
      tracksContainer.appendChild(el);
    });

    // Навешиваем слушатели
    tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const src = e.currentTarget.getAttribute('data-src');
        const id = e.currentTarget.getAttribute('data-id');
        playByTrackId(id, src);
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
  }

  function playByTrackId(id, src) {
    const idx = tracks.findIndex(x => x.id === id);
    if (idx === -1) return;
    const t = tracks[idx];
    const url = src || getStreamUrl(t);
    if (!url) return;
    audio.pause();
    audio.src = url;
    audio.load();
    audio.play().catch(() => {});
    titleEl.textContent = t.title || '';
    artistEl.textContent = t.artist || '';
    if (t.coverUrl) coverImg.src = t.coverUrl;
    else if (t.cover) coverImg.src = '/uploads/' + t.cover;
    else coverImg.src = '';
    downloadBtn.setAttribute('href', url);
    playerEl.classList.remove('hidden');
  }

  // Слушатели UI
  albumSelect.addEventListener('change', () => renderTracksForSelectedAlbum());

  playBtn?.addEventListener('click', () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  prevBtn?.addEventListener('click', () => {
    // prev в пределах текущего отфильтрованного списка
    const selected = albumSelect.value;
    const filtered = tracks.filter(t => String((t.albumId || defaultAlbumId || '')) === String(selected));
    if (!filtered.length) return;
    const curId = audio.src ? audio.src.split('/').pop() : null;
    let i = filtered.findIndex(x => getStreamUrl(x) === audio.src || x.id === currentIndex);
    if (i === -1) i = 0;
    const prev = filtered[(i - 1 + filtered.length) % filtered.length];
    playByTrackId(prev.id, getStreamUrl(prev));
  });
  nextBtn?.addEventListener('click', () => {
    const selected = albumSelect.value;
    const filtered = tracks.filter(t => String((t.albumId || defaultAlbumId || '')) === String(selected));
    if (!filtered.length) return;
    const curId = audio.src ? audio.src.split('/').pop() : null;
    let i = filtered.findIndex(x => getStreamUrl(x) === audio.src || x.id === currentIndex);
    if (i === -1) i = 0;
    const next = filtered[(i + 1) % filtered.length];
    playByTrackId(next.id, getStreamUrl(next));
  });

  volume?.addEventListener('input', () => { audio.volume = Number(volume.value); });

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

  modalClose?.addEventListener('click', () => lyricsModal.classList.add('hidden'));
  lyricsModal?.addEventListener('click', (e) => { if (e.target === lyricsModal) lyricsModal.classList.add('hidden'); });

  // Инициализация
  document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
  });
})();
