// frontend/app.js — интеграция OpenPlayerJS и логика страницы
(async function () {
  const tracksContainer = document.getElementById('tracks');
  const albumsContainer = document.getElementById('albums');

  const lyricsModal = document.getElementById('lyrics-modal');
  const modalClose = document.getElementById('modal-close');
  const modalTitle = document.getElementById('modal-title');
  const modalLyrics = document.getElementById('modal-lyrics');

  const audioEl = document.getElementById('openplayer-audio');
  let openPlayer = null;

  let tracks = [];
  let albums = [];

  function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
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
      render();
    } catch (err) {
      console.error('Ошибка загрузки данных:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div>Не удалось загрузить треки</div>';
    }
  }

  function render() {
    if (!tracksContainer || !albumsContainer) return;

    albumsContainer.innerHTML = '';
    albums.forEach(a => {
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML = `<strong>${escapeHtml(a.name || '')}</strong>`;
      albumsContainer.appendChild(el);
    });

    tracksContainer.innerHTML = '';
    tracks.forEach((t, idx) => {
      const cover = t.coverUrl || (t.cover ? '/uploads/' + t.cover : '');
      const stream = getStreamUrl(t) || '';
      const el = document.createElement('div');
      el.className = 'card track-card';
      el.dataset.index = String(idx);
      el.innerHTML = `
        <div class="track-left">
          ${cover ? `<img class="track-cover" src="${cover}" alt="${escapeHtml(t.title)}">` : ''}
        </div>
        <div class="track-main">
          <h4 class="track-title">${escapeHtml(t.title)}</h4>
          <div class="track-artist">${escapeHtml(t.artist || '')}</div>
          <div class="track-actions">
            <button class="btn-play" data-src="${stream}">▶</button>
            <button class="btn-download" data-src="${stream}">ჩამოტვირთვა</button>
            <button class="btn-like" data-id="${t.id}">❤ <span>${t.likes || 0}</span></button>
            <button class="btn-lyrics" data-index="${idx}">ტექსტი</button>
          </div>
        </div>
      `;

      // делегируем события ниже (для безопасности — добавим слушатели после вставки)
      tracksContainer.appendChild(el);
    });

    // attach event listeners (delegation)
    tracksContainer.querySelectorAll('.btn-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const src = e.currentTarget.getAttribute('data-src');
        if (!src) return;
        playSource(src);
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
        if (!id) return;
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
        const idx = Number(e.currentTarget.getAttribute('data-index'));
        const t = tracks[idx];
        if (!t) return;
        modalTitle.textContent = t.title || 'ლირიკა';
        modalLyrics.textContent = t.lyrics || 'ლირიკა არ არის';
        lyricsModal.classList.remove('hidden');
      });
    });
  }

  function initOpenPlayer() {
    try {
      // Инициализируем OpenPlayerJS на audio элементе
      if (typeof OpenPlayerJS === 'function') {
        openPlayer = new OpenPlayerJS('#openplayer-audio');
      } else if (window.OpenPlayerJS) {
        openPlayer = new window.OpenPlayerJS('#openplayer-audio');
      } else {
        console.warn('OpenPlayerJS не найден в глобальной области');
      }
    } catch (err) {
      console.error('Ошибка инициализации OpenPlayerJS:', err);
    }
  }

  function playSource(src) {
    if (!src) return;
    // Если OpenPlayerJS инициализирован, меняем src у audio и запускаем
    audioEl.pause();
    audioEl.src = src;
    // если OpenPlayerJS предоставляет API для обновления, он будет работать с элементом
    audioEl.load();
    audioEl.play().catch(() => {});
    // показать плеер, если он скрыт
    const wrapper = document.getElementById('player-wrapper');
    if (wrapper) wrapper.classList.remove('hidden');
  }

  // modal handlers
  modalClose?.addEventListener('click', () => {
    lyricsModal.classList.add('hidden');
  });
  lyricsModal?.addEventListener('click', (e) => {
    if (e.target === lyricsModal) lyricsModal.classList.add('hidden');
  });

  // init on DOM ready
  document.addEventListener('DOMContentLoaded', async () => {
    initOpenPlayer();
    await loadData();
  });
})();
