// frontend/app.js — исправленная версия: добавлены buildAlbumSelectors, onAlbumChange, onSubalbumChange, renderTracks
(function () {
  // DOM элементы
  const albumSelect = document.getElementById('album-select');
  const subalbumSelect = document.getElementById('subalbum-select');
  const subalbumLabel = document.getElementById('subalbum-label');
  const tracksContainer = document.getElementById('tracks');

  // (если в HTML другие id — скорректируй их или добавь элементы)
  if (!tracksContainer) {
    console.warn('tracksContainer not found: элемент с id="tracks" отсутствует в HTML');
  }

  // State
  let albums = [];
  let tracks = [];
  let currentAlbumId = null;
  let currentSubalbumId = null;
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

  function getCoverUrl(t) {
    const fallback = 'images/midcube.png';
    if (!t) return fallback;
    if (t.coverUrl) return t.coverUrl;
    if (t.cover) return 'uploads/' + t.cover;
    return fallback;
  }

  // Построить селекты альбомов и подальбомов
  function buildAlbumSelectors() {
    if (!albumSelect) return;
    albumSelect.innerHTML = '';
    const mains = albums.filter(a => !a.parentId);
    // Добавим опцию "все" или "выбрать"
    albumSelect.appendChild(optionEl('', '— ყველა ალბომი —'));
    mains.forEach(a => {
      albumSelect.appendChild(optionEl(a.id, a.name));
    });

    // Если есть default (სინგლი), выберем его
    const def = albums.find(x => x && x.name === 'სინგლი');
    if (def) defaultAlbumId = def.id;

    // Сброс подальбомов
    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      subalbumSelect.disabled = true;
      if (subalbumLabel) subalbumLabel.style.display = 'none';
    }
  }

  // Вспомогательная функция для option
  function optionEl(value, text) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    return o;
  }

  // При смене альбома — заполнить подальбомы и отобразить треки
  function onAlbumChange() {
    if (!albumSelect) return;
    currentAlbumId = albumSelect.value || '';
    // собрать подальбомы для выбранного главного альбома
    if (subalbumSelect) {
      subalbumSelect.innerHTML = '';
      subalbumSelect.appendChild(optionEl('', '— ყველა ქვეალბომი —'));
      const subs = albums.filter(a => a.parentId === currentAlbumId);
      if (subs.length) {
        subs.forEach(s => subalbumSelect.appendChild(optionEl(s.id, s.name)));
        subalbumSelect.disabled = false;
        if (subalbumLabel) subalbumLabel.style.display = '';
      } else {
        subalbumSelect.disabled = true;
        if (subalbumLabel) subalbumLabel.style.display = 'none';
      }
      // сброс выбранного подальбома
      currentSubalbumId = '';
      if (subalbumSelect) subalbumSelect.value = '';
    }
    renderTracks();
  }

  // При смене подальбома — отобразить треки
  function onSubalbumChange() {
    if (!subalbumSelect) return;
    currentSubalbumId = subalbumSelect.value || '';
    renderTracks();
  }

  // Рендер списка треков в контейнере
  function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    // Фильтрация: если выбран подальбом — только его треки,
    // иначе если выбран главный альбом — треки с albumId == выбранный или с parentId == выбранный
    let visible = tracks.slice();

    if (currentSubalbumId) {
      visible = visible.filter(t => (t.albumId || '') === currentSubalbumId);
    } else if (currentAlbumId) {
      // треки, у которых albumId равен текущему главному альбому
      visible = visible.filter(t => {
        if (!t.albumId) return false;
        if (t.albumId === currentAlbumId) return true;
        // если трек привязан к подальбому, нужно проверить, что этот подальбом имеет parentId == currentAlbumId
        const albumObj = albums.find(a => a.id === t.albumId);
        if (albumObj && albumObj.parentId === currentAlbumId) return true;
        return false;
      });
    }

    if (!visible.length) {
      tracksContainer.innerHTML = '<div class="muted">No tracks</div>';
      return;
    }

    visible.forEach(t => {
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
      // play (если есть audioUrl)
      if (t.audioUrl) {
        const aPlay = document.createElement('a');
        aPlay.href = t.audioUrl;
        aPlay.textContent = 'Play';
        aPlay.target = '_blank';
        actions.appendChild(aPlay);
      }
      // download
      if (t.audioUrl) {
        const aDl = document.createElement('a');
        aDl.href = t.audioUrl;
        aDl.textContent = 'Download';
        aDl.download = '';
        actions.appendChild(aDl);
      }

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(actions);
      tracksContainer.appendChild(card);
    });
  }

  // Загрузка данных
  async function loadData() {
    try {
      const res = await fetch('tracks.json');
      if (!res.ok) throw new Error('tracks.json not found');
      const data = await res.json();
      tracks = data.tracks || [];
      albums = data.albums || [];

      buildAlbumSelectors();

      // Если есть defaultAlbumId (სინგლი), выбрать его
      if (defaultAlbumId && albumSelect) {
        albumSelect.value = defaultAlbumId;
      } else if (albumSelect && albumSelect.options.length > 1) {
        // выбрать первый реальный альбом
        albumSelect.selectedIndex = 1;
      }

      // Вешаем обработчики (если ещё не повешены)
      if (albumSelect && !albumSelect._hasHandler) {
        albumSelect.addEventListener('change', onAlbumChange);
        albumSelect._hasHandler = true;
      }
      if (subalbumSelect && !subalbumSelect._hasHandler) {
        subalbumSelect.addEventListener('change', onSubalbumChange);
        subalbumSelect._hasHandler = true;
      }

      // Инициализируем отображение
      onAlbumChange();
    } catch (err) {
      console.error('Ошибка загрузки tracks.json:', err);
      if (tracksContainer) tracksContainer.innerHTML = '<div>Не удалось загрузить треки</div>';
    }
  }

  // Запуск
  document.addEventListener('DOMContentLoaded', loadData);
})();
