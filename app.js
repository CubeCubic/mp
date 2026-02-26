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
// Player cover for vinyl spinning effect
const playerCoverWrapper = document.querySelector('.player-cover-wrapper');
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
let currentTrackId = null;
let userInteracted = false;
let sortNewest = false;
let shuffleMode = false;
let playCounts = {};
// ════════════════════════════════
//  Like System (Firebase global + localStorage personal)
// ════════════════════════════════
const LIKES_STORAGE_KEY = 'cubeCubicLikes';
const USER_LIKES_KEY = `${LIKES_STORAGE_KEY}_user`;
let firebaseLikeCounts = {};
const dbRef = firebase.database().ref('likes');
dbRef.on('value', (snapshot) => {
firebaseLikeCounts = snapshot.val() || {};
renderTracks();
});
const playsRef = firebase.database().ref('plays');
playsRef.on('value', (snapshot) => {
playCounts = snapshot.val() || {};
renderTracks();
});
function incrementPlayCount(trackId) {
firebase.database().ref('plays/' + trackId).transaction(val => (val || 0) + 1);
}
function getPlayCount(trackId) {
return playCounts[trackId] || 0;
}
function getLikeCount(trackId) {
return firebaseLikeCounts[trackId] || 0;
}
function isLikedByUser(trackId) {
try {
const stored = localStorage.getItem(USER_LIKES_KEY);
const userLikes = stored ? JSON.parse(stored) : {};
return userLikes[trackId] === true;
} catch (e) {
return false;
}
}
function toggleLike(trackId) {
try {
const stored = localStorage.getItem(USER_LIKES_KEY);
const userLikes = stored ? JSON.parse(stored) : {};
const nowLiked = !userLikes[trackId];
userLikes[trackId] = nowLiked;
localStorage.setItem(USER_LIKES_KEY, JSON.stringify(userLikes));
const trackRef = firebase.database().ref('likes/' + trackId);
trackRef.transaction((current) => {
const val = current || 0;
if (nowLiked) return val + 1;
return Math.max(0, val - 1);
});
return nowLiked;
} catch (e) {
console.error('Error toggling like:', e);
return false;
}
}
function getUserLikedTracks() {
try {
const stored = localStorage.getItem(USER_LIKES_KEY);
const userLikes = stored ? JSON.parse(stored) : {};
return Object.keys(userLikes).filter(trackId => userLikes[trackId] === true);
} catch (e) {
return [];
}
}
// ════════════════════════════════
//  Vinyl Spinning Effect
// ════════════════════════════════
function startVinylSpin() {
if (playerCoverWrapper && audio && !audio.paused) {
playerCoverWrapper.classList.add('spinning');
document.body.classList.add('audio-playing');
}
}
function stopVinylSpin() {
if (playerCoverWrapper) {
playerCoverWrapper.classList.remove('spinning');
document.body.classList.remove('audio-playing');
}
}
// ════════════════════════════════
//  Keyboard Shortcuts
// ════════════════════════════════
document.addEventListener('keydown', (e) => {
if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
const isModalOpen = !lyricsModal.classList.contains('hidden') || 
                    !document.getElementById('contact-modal').classList.contains('hidden');
if (isModalOpen) return;
switch(e.key) {
  case ' ':
    e.preventDefault();
    if (playBtn) playBtn.click();
    break;
  case 'ArrowLeft':
    e.preventDefault();
    if (prevBtn) prevBtn.click();
    break;
  case 'ArrowRight':
    e.preventDefault();
    if (nextBtn) nextBtn.click();
    break;
  case 'ArrowUp':
    e.preventDefault();
    if (audio.volume < 1) {
      audio.volume = Math.min(1, audio.volume + 0.1);
      if (volumeSlider) volumeSlider.value = audio.volume;
    }
    break;
  case 'ArrowDown':
    e.preventDefault();
    if (audio.volume > 0) {
      audio.volume = Math.max(0, audio.volume - 0.1);
      if (volumeSlider) volumeSlider.value = audio.volume;
    }
    break;
  case 'l':
  case 'L':
    if (currentTrackId) {
      toggleLike(currentTrackId);
      renderTracks();
      showToast(isLikedByUser(currentTrackId) ? 'ლაიქი დაემატა ❤️' : 'ლაიქი წაიშალა');
    }
    break;
}
});
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
  .sort((a, b) => {
    const order = {
      'Songs in Georgian': 1,
      'Songs in English': 2,
      'Instrumental Music': 3
    };
    const orderA = order[a.name] || 999;
    const orderB = order[b.name] || 999;
    if (orderA !== orderB) return orderA - orderB;
    return (a.name || '').localeCompare(b.name || '');
  });
const currentAlbumId = albumSelect ? albumSelect.value : '';
const currentSubalbumId = subalbumSelect ? subalbumSelect.value : '';
mains.forEach(album => {
  const albumId = String(album.id || '');
  const subalbums = albums
    .filter(s => String(s.parentId || '') === albumId)
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const hasSubalbums = subalbums.length > 0;
  const isSelected = currentAlbumId === albumId;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'album-list-button';
  btn.setAttribute('data-album-id', albumId);
  const nameSpan = document.createElement('span');
  if (hasSubalbums) {
    const arrow = document.createElement('span');
    arrow.className = 'album-arrow';
    arrow.textContent = isSelected ? '▼ ' : '▶ ';
    nameSpan.appendChild(arrow);
  }
  const nameText = document.createTextNode(album.name || 'Unnamed');
  nameSpan.appendChild(nameText);
  btn.appendChild(nameSpan);
  const subIds = subalbums.map(s => s.id);
  const count = tracks.filter(t => {
    const tid = String(t.albumId || '');
    return tid === albumId || subIds.includes(tid);
  }).length;
  const countSpan = document.createElement('span');
  countSpan.className = 'track-count';
  countSpan.textContent = `(${count})`;
  btn.appendChild(countSpan);
  if (isSelected && !currentSubalbumId) {
    btn.classList.add('selected');
  }
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    if (hasSubalbums) {
      if (currentAlbumId === albumId) {
        if (albumSelect) albumSelect.value = '';
        if (subalbumSelect) subalbumSelect.value = '';
      } else {
        if (albumSelect) albumSelect.value = albumId;
        if (subalbumSelect) subalbumSelect.value = '';
      }
    } else {
      if (albumSelect) albumSelect.value = albumId;
      if (subalbumSelect) subalbumSelect.value = '';
    }
    renderAlbumList();
    renderTracks();
  });
  albumListContainer.appendChild(btn);
  if (isSelected && hasSubalbums) {
    const allSubBtn = document.createElement('button');
    allSubBtn.type = 'button';
    allSubBtn.className = 'album-list-button subalbum-button';
    allSubBtn.setAttribute('data-subalbum-id', '');
    const allNameSpan = document.createElement('span');
    allNameSpan.textContent = '— ყველა ქვეალბომები —';
    allSubBtn.appendChild(allNameSpan);
    const allCountSpan = document.createElement('span');
    allCountSpan.className = 'track-count';
    allCountSpan.textContent = `(${count})`;
    allSubBtn.appendChild(allCountSpan);
    if (!currentSubalbumId) {
      allSubBtn.classList.add('selected');
    }
    allSubBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (subalbumSelect) subalbumSelect.value = '';
      renderAlbumList();
      renderTracks();
    });
    albumListContainer.appendChild(allSubBtn);
    subalbums.forEach(sub => {
      const subBtn = document.createElement('button');
      subBtn.type = 'button';
      subBtn.className = 'album-list-button subalbum-button';
      subBtn.setAttribute('data-subalbum-id', sub.id || '');
      const subNameSpan = document.createElement('span');
      subNameSpan.textContent = sub.name || 'Unnamed';
      subBtn.appendChild(subNameSpan);
      const subCount = tracks.filter(t => String(t.albumId || '') === String(sub.id)).length;
      const subCountSpan = document.createElement('span');
      subCountSpan.className = 'track-count';
      subCountSpan.textContent = `(${subCount})`;
      subBtn.appendChild(subCountSpan);
      if (currentSubalbumId === String(sub.id || '')) {
        subBtn.classList.add('selected');
      }
      subBtn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (subalbumSelect) subalbumSelect.value = String(sub.id || '');
        renderAlbumList();
        renderTracks();
      });
      albumListContainer.appendChild(subBtn);
    });
  }
});
}
function onAlbumChange() {
renderAlbumList();
renderTracks();
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
// --- NEW: Filter out hidden tracks ---
toRender = toRender.filter(t => !t.hidden);
// -------------------------------------
const searchQ = globalSearchInput ? globalSearchInput.value.trim() : '';
if (searchQ) toRender = toRender.filter(t => matchesQuery(t, searchQ));
const selAlbum = albumSelect ? albumSelect.value : '';
const selSubalbum = subalbumSelect ? subalbumSelect.value : '';
if (selSubalbum) {
  toRender = toRender.filter(t => String(t.albumId || '') === selSubalbum);
} else if (selAlbum) {
  const subIds = albums
    .filter(a => String(a.parentId || '') === selAlbum)
    .map(a => a.id);
  toRender = toRender.filter(t => {
    const tid = String(t.albumId || '');
    return tid === selAlbum || subIds.includes(tid);
  });
}
if (showLikedOnly) {
  const likedTrackIds = getUserLikedTracks();
  toRender = toRender.filter(t => likedTrackIds.includes(t.id));
  toRender.sort((a, b) => (firebaseLikeCounts[b.id] || 0) - (firebaseLikeCounts[a.id] || 0));
}
if (!toRender.length) {
  tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
  filteredTracks = [];
  return;
}
if (sortNewest) {
  toRender.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}
toRender.forEach(t => {
  const card = document.createElement('div');
  card.className = 'card';
  card.setAttribute('data-track-id', t.id || '');
  const img = document.createElement('img');
  img.className = 'track-cover';
  img.src = getCoverUrl(t);
  img.alt = safeStr(t.title);
  card.appendChild(img);
  const info = document.createElement('div');
  info.className = 'track-info';
  const titleRow = document.createElement('div');
  titleRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
  const h4 = document.createElement('h4');
  h4.textContent = safeStr(t.title);
  h4.style.flex = '1';
  h4.style.minWidth = '0';
  titleRow.appendChild(h4);
  const eq = document.createElement('div');
  eq.className = 'equalizer';
  eq.innerHTML = '<span></span><span></span><span></span>';
  eq.style.display = 'none';
  titleRow.appendChild(eq);
  info.appendChild(titleRow);
  const albumDiv = document.createElement('div');
  albumDiv.style.cssText = 'display:flex;align-items:center;gap:8px;';
  const albumName = document.createElement('span');
  albumName.textContent = getAlbumName(t);
  albumName.style.flex = '1';
  albumDiv.appendChild(albumName);
  const playCountEl = document.createElement('div');
  playCountEl.className = 'play-count';
  const pc = getPlayCount(t.id);
  playCountEl.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><span>${pc > 0 ? pc : ''}</span>`;
  playCountEl.style.display = pc > 0 ? 'flex' : 'none';
  albumDiv.appendChild(playCountEl);
  info.appendChild(albumDiv);
  card.appendChild(info);
  const actions = document.createElement('div');
  actions.className = 'track-actions';
  if (t.lyrics && t.lyrics.trim()) {
    const lyrBtn = document.createElement('button');
    lyrBtn.type = 'button';
    lyrBtn.className = 'btn-has-lyrics';
    lyrBtn.textContent = 'ტექსტი';
    lyrBtn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      openLyricsModal(t);
    });
    actions.appendChild(lyrBtn);
  }
  const likeBtn = document.createElement('button');
  likeBtn.type = 'button';
  likeBtn.className = 'like-button';
  const likeCount = getLikeCount(t.id);
  const isLiked = isLikedByUser(t.id);
  likeBtn.innerHTML = `
     <svg viewBox="0 0 24 24" class="heart-icon ${isLiked ? 'liked' : ''}">
       <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
     </svg>
     <span class="like-count">${likeCount > 0 ? likeCount : ''}</span>
  `;
  likeBtn.addEventListener('click', (ev) => {
    ev.stopPropagation();
    const nowLiked = toggleLike(t.id);
    const heartIcon = likeBtn.querySelector('.heart-icon');
    const countSpan = likeBtn.querySelector('.like-count');
    const newCount = getLikeCount(t.id);
    if (nowLiked) {
      heartIcon.classList.add('liked');
      likeBtn.classList.add('liked-animation');
      setTimeout(() => likeBtn.classList.remove('liked-animation'), 600);
    } else {
      heartIcon.classList.remove('liked');
    }
    countSpan.textContent = newCount > 0 ? newCount : '';
  });
  actions.appendChild(likeBtn);
  const dlBtn = document.createElement('button');
  dlBtn.type = 'button';
  dlBtn.className = 'download-button';
  dlBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>';
  const streamUrl = getStreamUrl(t);
  if (streamUrl && streamUrl.trim()) {
    dlBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const origHTML = dlBtn.innerHTML;
      let sec = 0;
      dlBtn.textContent = '0s…';
      dlBtn.disabled = true;
      const timer = setInterval(() => { sec++; dlBtn.textContent = `${sec}s…`; }, 1000);
      let fname = 'track.mp3';
      try { fname = decodeURIComponent(new URL(streamUrl).pathname.split('/').pop()) || fname; } catch (e) {}
      await triggerDownload(streamUrl, fname);
      clearInterval(timer);
      dlBtn.innerHTML = origHTML;
      dlBtn.disabled = false;
    });
  } else {
    dlBtn.disabled = true;
    dlBtn.style.opacity = '.4';
  }
  actions.appendChild(dlBtn);
  const shareBtn = document.createElement('button');
  shareBtn.type = 'button';
  shareBtn.className = 'share-button';
  shareBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C 7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>';
  shareBtn.title = 'გაზიარება';
  shareBtn.addEventListener('click', async (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const trackUrl = `${window.location.origin}${window.location.pathname}#track-${t.id}`;
    const shareData = {
       title: safeStr(t.title),
      text: `${safeStr(t.title)}${t.artist ? ` - ${safeStr(t.artist)}` : ''}`,
      url: trackUrl
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        showToast('გაზიარებულია!');
      } else {
        await navigator.clipboard.writeText(trackUrl);
        showToast('ბმული დაკოპირებულია!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(trackUrl);
          showToast('ბმული დაკოპირებულია!');
        } catch (clipErr) {
           showToast('შეცდომა გაზიარებისას');
        }
      }
    }
  });
  actions.appendChild(shareBtn);
  card.appendChild(actions);
  const progressBarEl = document.createElement('div');
  progressBarEl.className = 'card-progress-bar';
  card.appendChild(progressBarEl);
  card.addEventListener('click', () => {
    userInteracted = true;
    const idx = toRender.indexOf(t);
    playByIndex(idx);
  });
  tracksContainer.appendChild(card);
});
filteredTracks = toRender;
if (currentTrackId) {
  const newIdx = filteredTracks.findIndex(t => t.id === currentTrackId);
  currentTrackIndex = newIdx;
}
highlightCurrent();
scrollToCurrentTrack();
}
// ════════════════════════════════
//  Highlight playing card
// ════════════════════════════════
function highlightCurrent() {
if (!tracksContainer) return;
tracksContainer.querySelectorAll('.card').forEach(c => {
c.classList.remove('playing-track');
const eq = c.querySelector('.equalizer');
if (eq) eq.style.display = 'none';
});
if (currentTrackId) {
const card = tracksContainer.querySelector(`[data-track-id="${currentTrackId}"]`);
if (card) {
card.classList.add('playing-track');
const eq = card.querySelector('.equalizer');
if (eq) eq.style.display = 'flex';
}
}
}
// ════════════════════════════════
//  Scroll to playing track
// ════════════════════════════════
function scrollToCurrentTrack() {
if (!currentTrackId || !tracksContainer) return;
setTimeout(() => {
const card = tracksContainer.querySelector(`[data-track-id="${currentTrackId}"]`);
if (card) {
card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
}, 120);
}
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
function setMarqueeTitle(el, text) {
if (!el) return;
el.classList.remove('marquee');
el.textContent = text;
requestAnimationFrame(() => {
if (el.scrollWidth > el.clientWidth) {
el.classList.add('marquee');
el.innerHTML = `<span>${text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${text}</span>`;
}
});
}
function updatePlayer(t) {
if (!t) {
setMarqueeTitle(playerTitle, 'აირჩიეთ ტრეკი');
if (playerArtist) playerArtist.textContent = '';
if (playerCoverImg) playerCoverImg.src = 'images/midcube.png';
if (playBtn) playBtn.textContent = '▶';
updateMiniPlayer(null);
return;
}
setMarqueeTitle(playerTitle, safeStr(t.title));
if (playerArtist) playerArtist.textContent = safeStr(t.artist);
if (playerCoverImg) playerCoverImg.src = getCoverUrl(t);
updateMiniPlayer(t);
}
function playByIndex(idx) {
if (idx < 0 || idx >= filteredTracks.length) {
audio.pause();
currentTrackIndex = -1;
currentTrackId = null;
updatePlayer(null);
highlightCurrent();
return;
}
currentTrackIndex = idx;
const t = filteredTracks[idx];
currentTrackId = t.id;
incrementPlayCount(t.id);
updatePlayer(t);
const streamUrl = getStreamUrl(t);
if (!streamUrl) {
console.error('No stream URL for track:', t.id);
showToast('ტრეკი ვერ მოიძებნა');
return;
}
audio.src = streamUrl;
audio.play().catch(e => {
console.error('Play error:', e);
if (e.name === 'NotAllowedError') {
if (playBtn) playBtn.textContent = '▶';
showToast('დააჭირეთ ▶ დასაკრავად');
} else {
showToast('შეცდომა: ვერ დაიწყო ტრეკი');
}
});
highlightCurrent();
scrollToCurrentTrack();
}
function togglePlay() {
userInteracted = true;
if (audio.paused || audio.ended) audio.play().catch(console.error);
else audio.pause();
}
function playNext() {
if (!filteredTracks.length) return;
if (shuffleMode) {
  let n;
  if (filteredTracks.length === 1) {
    n = 0;
  } else {
    do { n = Math.floor(Math.random() * filteredTracks.length); }
    while (n === currentTrackIndex);
  }
  playByIndex(n);
  return;
}
let idx = currentTrackIndex;
if (currentTrackId) {
  const foundIdx = filteredTracks.findIndex(t => t.id === currentTrackId);
  if (foundIdx >= 0) idx = foundIdx;
}
let n = idx + 1;
if (n >= filteredTracks.length) n = 0;
playByIndex(n);
}
function playPrev() {
if (!filteredTracks.length) return;
let idx = currentTrackIndex;
if (currentTrackId) {
  const foundIdx = filteredTracks.findIndex(t => t.id === currentTrackId);
  if (foundIdx >= 0) {
    idx = foundIdx;
  }
}
let p = idx - 1;
if (p < 0) p = filteredTracks.length - 1;
playByIndex(p);
}
audio.addEventListener('playing', () => {
if (playBtn) playBtn.textContent = '❚❚';
startVinylSpin();
});
audio.addEventListener('pause', () => {
if (playBtn) playBtn.textContent = '▶';
stopVinylSpin();
});
audio.addEventListener('ended', () => {
stopVinylSpin();
playNext();
});
audio.addEventListener('error', () => {
updatePlayer(null);
showToast('შეცდომა: ტრეკი ვერ ჩაიტვირთა');
stopVinylSpin();
});
audio.addEventListener('timeupdate', () => {
if (audio.duration && progressBar) {
progressBar.value = audio.currentTime;
progressBar.max = audio.duration;
if (timeCurrent) timeCurrent.textContent = formatTime(audio.currentTime);
}
updateCardProgress();
});
function updateCardProgress() {
if (!tracksContainer || !currentTrackId || !audio.duration) return;
const card = tracksContainer.querySelector(`[data-track-id="${currentTrackId}"]`);
if (card) {
  const cardProgressBar = card.querySelector('.card-progress-bar');
  if (cardProgressBar) {
    const progress = (audio.currentTime / audio.duration) * 100;
    cardProgressBar.style.width = `${progress}%`;
  }
}
}
audio.addEventListener('loadedmetadata', () => {
if (timeDuration) timeDuration.textContent = formatTime(audio.duration);
if (progressBar) progressBar.max = audio.duration || 0;
});
audio.addEventListener('volumechange', () => {
if (volumeSlider) volumeSlider.value = audio.volume;
});
const shuffleBtn = document.getElementById('shuffle-sidebar');
if (shuffleBtn) {
shuffleBtn.addEventListener('click', () => {
shuffleMode = !shuffleMode;
shuffleBtn.classList.toggle('active', shuffleMode);
});
}
const repeatBtn = document.getElementById('repeat-sidebar');
if (repeatBtn) {
repeatBtn.addEventListener('click', () => {
audio.loop = !audio.loop;
repeatBtn.classList.toggle('active', audio.loop);
});
}
if (playerCoverWrapper) {
playerCoverWrapper.style.cursor = 'pointer';
playerCoverWrapper.title = 'გადასვლა მიმდინარე ტრეკზე';
playerCoverWrapper.addEventListener('click', () => scrollToCurrentTrack());
}
if (playerTitle) {
playerTitle.style.cursor = 'pointer';
playerTitle.title = 'გადასვლა მიმდინარე ტრეკზე';
playerTitle.addEventListener('click', () => scrollToCurrentTrack());
}
if (playBtn) playBtn.addEventListener('click', togglePlay);
if (prevBtn) prevBtn.addEventListener('click', playPrev);
if (nextBtn) nextBtn.addEventListener('click', playNext);
if (progressBar) progressBar.addEventListener('input', () => audio.currentTime = progressBar.value);
if (volumeSlider) volumeSlider.addEventListener('input', () => audio.volume = parseFloat(volumeSlider.value));
// ════════════════════════════════
//  Data loading
// ════════════════════════════════
function showSkeleton() {
if (!tracksContainer) return;
tracksContainer.innerHTML = '';
for (let i = 0; i < 8; i++) {
tracksContainer.innerHTML += `<div class="skeleton-card"><div class="skeleton-cover"></div><div class="skeleton-info"><div class="skeleton-line"></div><div class="skeleton-line short"></div></div></div>`;
}
}
async function loadData() {
showSkeleton();
try {
const res = await fetch('tracks.json', { cache: 'no-store' });
if (!res.ok) throw new Error('tracks.json not found');
const data = await res.json();
tracks = data.tracks || [];
albums = data.albums || [];
tracks = shuffleArray(tracks);
updateTrackCount();
renderAlbumList();
renderTracks();
} catch (e) {
console.error('Error loading tracks.json:', e);
if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">ტრეკები ვერ ჩაიტვირთა</div>';
}
}
if (refreshBtn) {
refreshBtn.addEventListener('click', () => {
if (albumSelect) albumSelect.value = '';
if (subalbumSelect) subalbumSelect.value = '';
loadData();
});
}
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
//  Liked Tracks Button
// ════════════════════════════════
const likedBtn = document.getElementById('liked-tracks-btn');
let showLikedOnly = false;
if (likedBtn) {
likedBtn.addEventListener('click', () => {
showLikedOnly = !showLikedOnly;
if (showLikedOnly) {
likedBtn.classList.add('active');
sortNewest = false;
if (newestBtn) newestBtn.classList.remove('active');
} else {
likedBtn.classList.remove('active');
}
renderTracks();
});
}
// ════════════════════════════════
//  Scroll to Top Button
// ════════════════════════════════
const scrollToTopBtn = document.getElementById('scroll-to-top');
if (scrollToTopBtn) {
window.addEventListener('scroll', () => {
if (window.scrollY > 300) {
scrollToTopBtn.classList.add('visible');
} else {
scrollToTopBtn.classList.remove('visible');
}
});
scrollToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
}
// ════════════════════════════════
//  Contact Form Modal (NEW)
// ════════════════════════════════
const contactBtn = document.getElementById('contact-btn');
const contactModal = document.getElementById('contact-modal');
const contactModalClose = document.getElementById('contact-modal-close');
const contactCancel = document.getElementById('contact-cancel');
const contactForm = document.getElementById('contact-form');
const contactStatus = document.getElementById('contact-status');
function openContactModal() {
if (contactModal) {
contactModal.classList.remove('hidden');
contactModal.setAttribute('aria-hidden', 'false');
document.body.classList.add('modal-open');
const firstInput = contactForm.querySelector('input[type="text"]');
if (firstInput) setTimeout(() => firstInput.focus(), 100);
}
}
function closeContactModal() {
if (contactModal) {
contactModal.classList.add('hidden');
contactModal.setAttribute('aria-hidden', 'true');
document.body.classList.remove('modal-open');
if (contactForm) contactForm.reset();
if (contactStatus) {
contactStatus.textContent = '';
contactStatus.className = 'contact-status hidden';
}
}
}
if (contactBtn) contactBtn.addEventListener('click', openContactModal);
if (contactModalClose) contactModalClose.addEventListener('click', closeContactModal);
if (contactCancel) contactCancel.addEventListener('click', closeContactModal);
if (contactModal) {
contactModal.addEventListener('click', (e) => {
if (e.target === contactModal) closeContactModal();
});
}
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape') {
if (contactModal && !contactModal.classList.contains('hidden')) {
closeContactModal();
}
}
});
if (contactForm) {
contactForm.addEventListener('submit', async (e) => {
e.preventDefault();
  const submitBtn = document.getElementById('contact-submit');
  const formData = new FormData(contactForm);
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'იგზავნება...';
  }
  if (contactStatus) contactStatus.className = 'contact-status hidden';
  try {
    const response = await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      body: formData
    });
    const result = await response.json();
    if (result.success) {
      if (contactStatus) {
        contactStatus.textContent = '✓ შეტყობინება გაგზავნილია!';
        contactStatus.className = 'contact-status success';
      }
      showToast('შეტყობინება გაგზავნილია!');
      setTimeout(() => closeContactModal(), 2000);
    } else {
      throw new Error('Form submission failed');
    }
  } catch (error) {
    console.error('Contact form error:', error);
    if (contactStatus) {
      contactStatus.textContent = '✗ შეცდომა. გთხოვთ სცადოთ თავიდან.';
      contactStatus.className = 'contact-status error';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'გაგზავნა';
    }
  }
});
}
// ════════════════════════════════
//  Share Button (NEW)
// ════════════════════════════════
const shareBtnHeader = document.getElementById('share-btn');
async function handleShare() {
const shareData = {
title: 'Cube Cubic',
text: 'შეამოწმე ეს მუსიკალური საიტი! 🎵',
url: window.location.href.split('#')[0]
};
try {
  if (navigator.share) {
    await navigator.share(shareData);
    showToast('გაზიარება წარმატებული იყო!');
  } else {
    await navigator.clipboard.writeText(shareData.url);
    showToast('ბმული დაკოპირდა! 🔗');
  }
} catch (error) {
  if (error.name !== 'AbortError') {
    console.error('Share error:', error);
    try {
      const textArea = document.createElement('textarea');
      textArea.value = shareData.url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      showToast('ბმული დაკოპირდა! 🔗');
    } catch (fallbackError) {
      console.error('Fallback share error:', fallbackError);
      showToast('გაზიარება ვერ მოხერხდა');
    }
  }
}
}
if (shareBtnHeader) shareBtnHeader.addEventListener('click', handleShare);
// ════════════════════════════════
//  Header Logo & Title Refresh
// ════════════════════════════════
function refreshSite() {
location.reload();
}
const headerBadge = document.getElementById('header-badge');
const headerTitle = document.querySelector('header h1');
if (headerBadge) headerBadge.addEventListener('click', refreshSite);
if (headerTitle) headerTitle.addEventListener('click', refreshSite);
// ════════════════════════════════
//  Handle shared track links (#track-id)
// ════════════════════════════════
function handleSharedTrackLink() {
const hash = window.location.hash;
if (hash && hash.startsWith('#track-')) {
const trackId = hash.replace('#track-', '');
setTimeout(() => {
const card = tracksContainer?.querySelector(`[data-track-id="${trackId}"]`);
if (card) {
card.scrollIntoView({ behavior: 'smooth', block: 'center' });
card.style.boxShadow = '0 0 0 3px rgba(15,179,166,0.5)';
setTimeout(() => { card.style.boxShadow = ''; }, 3000);
}
}, 500);
}
}
// ════════════════════════════════
//  Mobile Mini Player
// ════════════════════════════════
const miniPlayer = document.getElementById('mini-player');
const miniCover = document.getElementById('mini-player-cover');
const miniTitle = document.getElementById('mini-player-title');
const miniArtist = document.getElementById('mini-player-artist');
const miniPlay = document.getElementById('mini-play');
const miniPrev = document.getElementById('mini-prev');
const miniNext = document.getElementById('mini-next');
const miniProgressBar = document.getElementById('mini-player-progress-bar');
function updateMiniPlayer(t) {
if (!miniPlayer) return;
if (!t) {
miniPlayer.classList.remove('visible');
miniPlayer.setAttribute('aria-hidden', 'true');
document.body.classList.remove('mini-player-visible');
return;
}
if (miniCover) miniCover.src = getCoverUrl(t);
if (miniTitle) miniTitle.textContent = safeStr(t.title);
if (miniArtist) miniArtist.textContent = safeStr(t.artist);
miniPlayer.classList.add('visible');
miniPlayer.setAttribute('aria-hidden', 'false');
document.body.classList.add('mini-player-visible');
}
audio.addEventListener('playing', () => { if (miniPlay) miniPlay.textContent = '❚❚'; });
audio.addEventListener('pause', () => { if (miniPlay) miniPlay.textContent = '▶'; });
audio.addEventListener('timeupdate', () => {
if (miniProgressBar && audio.duration) {
miniProgressBar.style.width = `${(audio.currentTime / audio.duration) * 100}%`;
}
});
if (miniPlay) miniPlay.addEventListener('click', togglePlay);
if (miniPrev) miniPrev.addEventListener('click', playPrev);
if (miniNext) miniNext.addEventListener('click', playNext);
// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
updatePlayer(null);
if (audio && volumeSlider) audio.volume = parseFloat(volumeSlider.value || 1);
loadData().then(() => { handleSharedTrackLink(); });
});
})();