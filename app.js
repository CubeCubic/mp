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
const subalbumLabel = document.getElementById('subalbum-label');
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
let sortNewest = false; // toggle для кнопки"უახლესი ტრეკები"
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
  .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

mains.forEach(a => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'album-list-button';
  btn.setAttribute('data-album-id', a.id || '');

  const nameSpan = document.createElement('span');
  nameSpan.textContent = a.name || 'Unnamed';
  btn.appendChild(nameSpan);

  const subIds = albums
    .filter(s => String(s.parentId || '') === String(a.id))
    .map(s => s.id);
  const count = tracks.filter(t => {
    const tid = String(t.albumId || '');
    return tid === String(a.id) || subIds.includes(tid);
  }).length;

  const countSpan = document.createElement('span');
  countSpan.className = 'track-count';
  countSpan.textContent = `(${count})`;
  btn.appendChild(countSpan);

  if (albumSelect && String(albumSelect.value) === String(a.id || '')) {
    btn.classList.add('selected');
  }

  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (albumSelect) albumSelect.value = String(a.id || '');
    renderAlbumList();
    onAlbumChange();
  });

  albumListContainer.appendChild(btn);
});
}
function onAlbumChange() {
const currentAlbumId = albumSelect ? albumSelect.value : '';
if (subalbumSelect) {
  const subs = albums.filter(a => String(a.parentId || '') === currentAlbumId);
  subalbumSelect.innerHTML = '';
  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = '— ყველა ქვეალბომები —';
  subalbumSelect.appendChild(opt);

  if (subs.length) {
    subs.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id;
      o.textContent = s.name;
      subalbumSelect.appendChild(o);
    });
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
renderAlbumList();
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
if (searchQ) toRender = toRender.filter(t = > matchesQuery(t, searchQ));

// Album filter
const selAlbum = albumSelect ? albumSelect.value : '';
const selSubalbum = subalbumSelect ? subalbumSelect.value : '';

if (selSubalbu m) {
  toRender = toRender.filter(t = > String(t.albumId || '') === selSubalbum);
} else if (selAlbum) {
  const subIds = albums
    .filter(a = > String(a.parentId || '') === selAlbum)
    .map(a = > a.id);
  toRender = toRender.filter(t = > {
    const tid = String(t.albumId || '');
    return tid === selAlbum || subIds.includes(tid);
  });
}

if (!toRender.length) {
  tracksContainer.innerHTML = ' <div class= "muted " >ტრეკები არ მოიძებნა </div >';
  filteredTracks = [];
  return;
}

// Сортировка
if (sortNewest) {
  toRender.sort((a, b) = > (Number(b.id) || 0) - (Number(a.id) || 0));
}
// Иначе порядок как есть (random при загрузке)

toRender.forEach(t = > {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-track-id', t.id || '');

  const img = document.createElement('img');
  img.c lassName = 'track-cover';
  img.src = getCoverUrl(t);
  img.alt = safeStr(t.title);
  card.appendChild(img);

  const info = document.createElement('div');
  info.className = 'trac k-info';

  const h4 = document.createElement('h4');
  h4.textContent = safeStr(t.title);
  info.appendChild(h4);

  const albumDiv = document.createElement('div');
  albumDiv.text Content = getAlbumName(t);
  info.appendChild(albumDiv);

  card.appendChild(info);

  const actions = document.createElement('div');
  actions.className = 'track-actions';

  if ( t.lyrics  & & t.lyrics.trim()) {
    const lyrBtn = document.createElement('button');
    lyrBtn.type = 'button';
    lyrBtn.className = 'btn-has-lyrics';
    lyrBtn.textContent = 'ტექსტი';
     lyrBtn.addEventListener('click', (ev) = > {
      ev.stopPropagation();
      openLyricsModal(t);
    });
    actions.appendChild(lyrBtn);
  }

  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
   dlBtn.className = 'download-button';
  dlBtn.innerHTML = ' <svg viewBox= "0 0 24 24 " > <path d= "M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z "/ > </svg >';

  const streamUrl = getStreamUrl(t);
  if (streamUrl  & & streamUrl.trim()) {
    dlBtn.addEventListener('click', async (ev) = > {
      ev.preventDefault();
      ev.stopPropagation();
      const origHTML = dlBtn.innerHTML;
      let sec = 0;
      dlBtn.textContent = '0s…';
      dlBtn.disabled = true;
       const timer = setInterval(() = > { sec++; dlBtn.textContent = `${sec}s…`; }, 1000);

      let fname = 'track.mp3';
      try { fname = decodeURIComponent(new URL(streamUrl).pathname.split('/').pop()) || fname;  } catch (e) {}

      await triggerDownload(streamUrl, fname);
      clearInterval(timer);
      dlBtn.innerHTML = origHTML;
      dlBtn.disabled = false;
    });
  } else {
    dl Btn.disabled = true;
    dlBtn.style.opacity = '.4';
  }
  actions.appendChild(dlBtn);
  card.appendChild(actions);

  card.addEventListener('click', () = > {
    userInteracted = true;
    const idx = toRender.indexOf(t);
    playByIndex(idx);
  });

  tracksContainer.appendChild(card);
});

filteredTracks = toRender;
highlightCurre nt();
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
audio.addEventListener('playing', () => { if (playBtn) playBtn.textContent = '❚❚'; });
audio.addEventListener('pause', () => { if (playBtn) playBtn.textContent = '▶'; });
audio.addEventListener('ended', playNext);
audio.addEventListener('error', () => { updatePlayer(null); showToast('შეცდომა: ტრეკი ვერ ჩაიტვირთა'); });
audio.addEventListener('timeupdate', () => {
if (audio.duration && progressBar) {
progressBar.value = audio.currentTime;
progressBar.max = audio.duration;
if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
}
});
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
if (subalbumSelect) {
subalbumSelect.addEventListener('change', () => {
renderTracks();
});
}
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
if (subalbumSelect) {
subalbumSelect.innerHTML = '— ყველა ქვეალბომები —';
subalbumSelect.disabled = true;
subalbumSelect.style.display = 'none';
}
if (subalbumLabel) subalbumLabel.style.display = 'none';
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
//  Share Button (Web Share API)
// ════════════════════════════════
const shareBtn = document.getElementById('share-btn');

function canShare() {
  return typeof navigator.share !== 'undefined';
}

function showToastShare(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.remove('hidden');
  toast.classList.add('visible');
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.classList.add('hidden'), 350);
  }, 3000);
}

if (shareBtn) {
  // Update button text based on support
  if (!canShare()) {
    shareBtn.innerHTML = `
      <svg class="footer-icon" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
      </svg>
      <span>კოპირება</span>
    `;
  }

  shareBtn.addEventListener('click', async () => {
    const shareData = {
      title: 'Cube Cubic',
      text: 'Cube Cubic — მუსიკალური საიტი',
      url: window.location.href
    };

    try {
      if (canShare()) {
        await navigator.share(shareData);
        showToastShare('გაზიარებულია!');
      } else {
        // Fallback: copy URL to clipboard
        await navigator.clipboard.writeText(window.location.href);
        showToastShare('ლინკი დაკოპირებულია!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        showToastShare('შეცდომა გაზიარებისას');
      }
    }
  });
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
updatePlayer(null);
if (audio && volumeSlider) audio.volume = parseFloat(volumeSlider.value || 1);
loadData();
});
})();