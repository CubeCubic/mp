(async function() {
if (!document.getElementById('admin-app')) return;
// Elements
const loginForm = document.getElementById('login-form');
const adminPanel = document.getElementById('admin-panel');
const loginBtn = document.getElementById('login-btn');
const loginMsg = document.getElementById('login-msg');
const passwordInput = document.getElementById('admin-password');
const albumName = document.getElementById('album-name');
const albumParent = document.getElementById('album-parent');
const btnCreateAlbum = document.getElementById('btn-create-album');
const btnRefreshAlbums = document.getElementById('btn-refresh-albums');
const btnSaveAll = document.getElementById('btn-save-all');
const albumsList = document.getElementById('albums-list');
const addForm = document.getElementById('add-track-form');
const trackAlbumSelect = document.getElementById('track-album-select');
const btnRefreshTracks = document.getElementById('btn-refresh-tracks');
const adminTracks = document.getElementById('admin-tracks');
const logoutBtn = document.getElementById('logout-btn');
const albumEditModal = document.getElementById('album-edit-modal');
const modalAlbumName = document.getElementById('modal-album-name');
const modalAlbumParent = document.getElementById('modal-album-parent');
const modalSaveBtn = document.getElementById('modal-save');
const modalCancelBtn = document.getElementById('modal-cancel');
// Search elements (if present)
const trackSearchInput = document.getElementById('track-search');
const trackSearchClear = document.getElementById('track-search-clear');
// Dynamic track edit modal
let trackEditModalBackdrop = null;
let trackEditRefs = null;
let trackBeingEdited = null;
// State
let albums = [];
let tracks = [];
let albumBeingEdited = null;
let loggedIn = false;
// Dirty flag
let isDirty = false;
function markDirty() {
isDirty = true;
if (loginMsg) loginMsg.textContent = 'Есть несохранённые изменения';
}
function clearDirty() {
isDirty = false;
if (loginMsg) loginMsg.textContent = '';
}
// Helpers
function escapeHtml(s){ return (s||'').toString().replace(/[&<>'"]/g, c => ({'&':'&','<':'<','>':'>',"'":"'",'"':'"'})[c]); }
function el(tag, attrs = {}, children = []) {
const e = document.createElement(tag);
for (const k in attrs) {
if (k === 'class') e.className = attrs[k];
else if (k === 'text') e.textContent = attrs[k];
else e.setAttribute(k, attrs[k]);
}
(Array.isArray(children) ? children : [children]).forEach(c => {
if (c === null || c === undefined) return;
if (typeof c === 'string') e.appendChild(document.createTextNode(c));
else e.appendChild(c);
});
return e;
}
// === Apply visual changes to Save button ===
(function applySaveButtonVisuals() {
if (!btnSaveAll) return;
let inner = btnSaveAll.querySelector('.inner-text');
if (!inner) {
inner = document.createElement('span');
inner.className = 'inner-text';
btnSaveAll.textContent = '';
btnSaveAll.appendChild(inner);
}
inner.textContent = 'არ დაგავიწყდეს დამახსოვრება';
btnSaveAll.setAttribute('aria-label', 'არ დაგავიწყდეს დამახსოვრება');
btnSaveAll.classList.add('save-btn', 'blinking');
btnSaveAll.setAttribute('type', 'button');
btnSaveAll.addEventListener('click', () => {
btnSaveAll.classList.remove('blinking');
setTimeout(() => btnSaveAll.classList.add('blinking'), 700);
});
})();
// === Load from Firebase (instead of tracks.json) ===
async function loadFromFirebase() {
try {
const tracksSnapshot = await firebase.database().ref('tracks').once('value');
const albumsSnapshot = await firebase.database().ref('albums').once('value');
tracks = tracksSnapshot.val() || [];
albums = albumsSnapshot.val() || [];
return true;
} catch (error) {
console.error('Firebase load error:', error);
return false;
}
}
// === Save to Firebase ===
async function saveToFirebase() {
try {
await firebase.database().ref('tracks').set(tracks);
await firebase.database().ref('albums').set(albums);
return true;
} catch (error) {
console.error('Firebase save error:', error);
return false;
}
}
function downloadJson() {
const data = { albums, tracks };
const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'tracks.json';
a.click();
URL.revokeObjectURL(url);
}
function getDescendantIds(rootId) {
const map = {};
albums.forEach(a => { map[a.id] = { ...a, children: [] }; });
albums.forEach(a => {
if (a.parentId && map[a.parentId]) {
map[a.parentId].children.push(map[a.id]);
}
});
const result = [];
function dfs(node) {
if (!node) return;
node.children.forEach(child => {
result.push(child.id);
dfs(child);
});
}
if (map[rootId]) dfs(map[rootId]);
return result;
}
function fillAlbumSelects() {
if (albumParent) {
albumParent.innerHTML = '';
albumParent.appendChild(el('option', { value: '' }, '— მთავარი ალბომი —'));
albums.slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(a => albumParent.appendChild(el('option', { value: a.id }, a.name)));
}
if (trackAlbumSelect) {
trackAlbumSelect.innerHTML = '';
trackAlbumSelect.appendChild(el('option', { value: '' }, '— ალბომის გარეშე —'));
albums.slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(a => trackAlbumSelect.appendChild(el('option', { value: a.id }, a.name)));
}
if (trackEditRefs && trackEditRefs.album) {
trackEditRefs.album.innerHTML = '';
trackEditRefs.album.appendChild(el('option', { value: '' }, '— ალბომის გარეშე —'));
albums.slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(a => trackEditRefs.album.appendChild(el('option', { value: a.id }, a.name)));
}
}
function renderAlbumsList() {
if (!albumsList) return;
albumsList.innerHTML = '';
albums.forEach(a => {
const item = el('div', { class: 'item' });
const meta = el('div', { class: 'meta' }, [
el('strong', {}, escapeHtml(a.name)),
el('div', { class: 'muted' }, `id: ${a.id} • parent: ${a.parentId || '—'}`)
]);
const actions = el('div', {});
const btnEdit = el('button', {}, 'Edit');
const btnDelete = el('button', {}, 'Delete');
actions.appendChild(btnEdit);
actions.appendChild(btnDelete);
btnEdit.addEventListener('click', () => {
albumBeingEdited = a;
modalAlbumName.value = a.name || '';
const descendants = getDescendantIds(a.id);
const exclude = new Set([a.id, ...descendants]);
modalAlbumParent.innerHTML = '';
modalAlbumParent.appendChild(el('option', { value: '' }, '— მთავარი ალბომი —'));
albums.filter(al => !exclude.has(al.id)).slice().sort((x, y) => (x.name || '').localeCompare(y.name || '')).forEach(al => modalAlbumParent.appendChild(el('option', { value: al.id }, al.name)));
modalAlbumParent.value = a.parentId || '';
albumEditModal.style.display = 'flex';
albumEditModal.classList.remove('hidden');
albumEditModal.setAttribute('aria-hidden', 'false');
setTimeout(() => { try { modalAlbumName.focus(); } catch (e) {} }, 0);
});
btnDelete.addEventListener('click', () => {
if (!confirm('Delete album?')) return;
albums = albums.filter(x => x.id !== a.id);
albums = albums.map(x => {
if (x.parentId === a.id) return { ...x, parentId: null };
return x;
});
renderAlbumsList();
fillAlbumSelects();
markDirty();
});
item.appendChild(meta);
item.appendChild(actions);
albumsList.appendChild(item);
});
}
if (modalSaveBtn) {
modalSaveBtn.addEventListener('click', () => {
if (!albumBeingEdited) return;
const newName = (modalAlbumName.value || '').trim();
const newParent = modalAlbumParent.value || null;
if (!newName) return alert('Введите название альбома');
if (newParent === albumBeingEdited.id) return alert('Нельзя назначить самого себя родителем');
const duplicate = albums.find(a =>
a.id !== albumBeingEdited.id &&
a.name === newName &&
((a.parentId || null) === (newParent || null))
);
if (duplicate) {
alert('Альбом с таким именем уже существует в выбранном разделе');
return;
}
albumBeingEdited.name = newName;
albumBeingEdited.parentId = newParent;
renderAlbumsList();
fillAlbumSelects();
markDirty();
albumEditModal.style.display = 'none';
albumEditModal.classList.add('hidden');
albumEditModal.setAttribute('aria-hidden', 'true');
albumBeingEdited = null;
});
}
if (modalCancelBtn) {
modalCancelBtn.addEventListener('click', () => {
albumEditModal.style.display = 'none';
albumEditModal.classList.add('hidden');
albumEditModal.setAttribute('aria-hidden', 'true');
albumBeingEdited = null;
});
}
if (albumEditModal) {
albumEditModal.addEventListener('click', (e) => { if (e.target === albumEditModal) {
albumEditModal.style.display = 'none';
albumEditModal.classList.add('hidden');
albumEditModal.setAttribute('aria-hidden', 'true');
albumBeingEdited = null;
}});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') {
albumEditModal.style.display = 'none';
albumEditModal.classList.add('hidden');
albumEditModal.setAttribute('aria-hidden', 'true');
albumBeingEdited = null;
}});
}
function ensureTrackEditModal() {
if (trackEditModalBackdrop) return;
trackEditModalBackdrop = el('div', { class: 'modal-backdrop hidden', id: 'track-edit-dynamic' });
const modal = el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
el('h3', {}, 'Edit track'),
el('label', {}, 'Title'),
(trackEditRefs = trackEditRefs || {}).title = el('input', { type: 'text' }),
el('label', {}, 'Artist'),
(trackEditRefs.artist = el('input', { type: 'text' })),
el('label', {}, 'Lyrics'),
(trackEditRefs.lyrics = el('textarea', {})),
el('label', {}, 'Album'),
(trackEditRefs.album = el('select', {})),
el('label', {}, 'Audio URL'),
(trackEditRefs.audioUrl = el('input', { type: 'text' })),
el('label', {}, 'Cover URL'),
(trackEditRefs.coverUrl = el('input', { type: 'text' })),
el('div', { class: 'actions' }, [
(trackEditRefs.cancelBtn = el('button', { type: 'button' }, 'Cancel')),
(trackEditRefs.saveBtn = el('button', { type: 'button' }, 'Save'))
])
]);
trackEditModalBackdrop.appendChild(modal);
document.body.appendChild(trackEditModalBackdrop);
trackEditModalBackdrop.addEventListener('click', (e) => {
if (e.target === trackEditModalBackdrop) closeTrackEditModal();
});
document.addEventListener('keydown', (e) => {
if (e.key === 'Escape' && !trackEditModalBackdrop.classList.contains('hidden')) {
closeTrackEditModal();
}
});
trackEditRefs.cancelBtn.addEventListener('click', closeTrackEditModal);
trackEditRefs.saveBtn.addEventListener('click', () => {
if (!trackBeingEdited) return;
const newTitle = (trackEditRefs.title.value || '').trim();
if (!newTitle) return alert('Введите Title');
trackBeingEdited.title = newTitle;
trackBeingEdited.artist = (trackEditRefs.artist.value || '').trim();
trackBeingEdited.lyrics = (trackEditRefs.lyrics.value || '').toString();
trackBeingEdited.albumId = trackEditRefs.album.value || '';
trackBeingEdited.audioUrl = (trackEditRefs.audioUrl.value || '').trim();
trackBeingEdited.coverUrl = (trackEditRefs.coverUrl.value || '').trim();
markDirty();
renderTracks(trackSearchInput ? trackSearchInput.value : '');
closeTrackEditModal();
});
}
function openTrackEditModal(track) {
ensureTrackEditModal();
trackBeingEdited = track;
fillAlbumSelects();
trackEditRefs.title.value = track.title || '';
trackEditRefs.artist.value = track.artist || '';
trackEditRefs.lyrics.value = track.lyrics || '';
trackEditRefs.album.value = track.albumId || '';
trackEditRefs.audioUrl.value = track.audioUrl || '';
trackEditRefs.coverUrl.value = track.coverUrl || '';
trackEditModalBackdrop.classList.remove('hidden');
trackEditModalBackdrop.setAttribute('aria-hidden', 'false');
setTimeout(() => { try { trackEditRefs.title.focus(); } catch(e){} }, 0);
}
function closeTrackEditModal() {
if (!trackEditModalBackdrop) return;
trackEditModalBackdrop.classList.add('hidden');
trackEditModalBackdrop.setAttribute('aria-hidden', 'true');
trackBeingEdited = null;
}
if (btnCreateAlbum) {
btnCreateAlbum.addEventListener('click', () => {
const name = (albumName.value || '').trim();
if (!name) return alert('Введите название альбома');
const parentId = albumParent.value || null;
const id = Date.now().toString();
const duplicate = albums.find(a => a.name === name && ((a.parentId || null) === (parentId || null)));
if (duplicate) {
alert('Альбом с таким именем уже существует в этом разделе');
return;
}
albums.push({ id, name, parentId });
albumName.value = '';
albumParent.value = '';
renderAlbumsList();
fillAlbumSelects();
markDirty();
});
}
if (addForm) {
addForm.addEventListener('submit', (e) => {
e.preventDefault();
const form = e.currentTarget;
const title = form.elements['title'].value || 'Untitled';
const artist = form.elements['artist'].value || '';
const lyrics = form.elements['lyrics'].value || '';
const albumId = form.elements['album'] ? form.elements['album'].value : '';
const audioUrl = form.elements['audioUrl'] ? form.elements['audioUrl'].value.trim() : '';
const coverUrl = form.elements['coverUrl'] ? form.elements['coverUrl'].value.trim() : '';
const id = Date.now().toString();
tracks.push({ id, title, artist, lyrics, albumId, audioUrl, coverUrl, hidden: false });
form.reset();
renderTracks(trackSearchInput ? trackSearchInput.value : '');
markDirty();
});
}
function renderTracks(query = '') {
if (!adminTracks) return;
adminTracks.innerHTML = '';
if (!tracks.length) {
adminTracks.innerHTML = '<div class="muted">No tracks</div>';
return;
}
const q = (query || '').toString().trim().toLowerCase();
const albumNameById = id => (albums.find(a => a.id === id) || {}).name || '';
const filtered = q ? tracks.filter(t => {
const title = (t.title || '').toString().toLowerCase();
const artist = (t.artist || '').toString().toLowerCase();
const albumNameStr = albumNameById(t.albumId).toString().toLowerCase();
return title.includes(q) || artist.includes(q) || albumNameStr.includes(q);
}) : tracks;
if (!filtered.length) {
adminTracks.innerHTML = '<div class="muted">No tracks match your search</div>';
return;
}
filtered.forEach(t => {
const item = el('div', { class: 'item' });
const albumNameForTrack = albumNameById(t.albumId) || '(no album)';
const meta = el('div', { class: 'meta' }, [
el('strong', {}, escapeHtml(t.title || 'Untitled')),
el('div', { class: 'muted' }, escapeHtml(t.artist || '')),
el('div', { class: 'muted' }, `album: ${escapeHtml(albumNameForTrack)}`),
t.hidden ? el('div', { class: 'muted', style: 'color: #ff7a66;' }, '⚠ დამალულია') : null
]);
// Load and show likes count + who liked this track
const likesDiv = el('div', { class: 'muted', style: 'margin-top:4px;font-size:11px;color:#ff9a88;' });
meta.appendChild(likesDiv);
firebase.database().ref('likes/' + t.id).once('value').then(countSnap => {
  const count = countSnap.val() || 0;
  if (count === 0) { likesDiv.textContent = ''; return; }
  likesDiv.textContent = '❤ ' + count;
  firebase.database().ref('likes_users/' + t.id).once('value').then(snap => {
    const data = snap.val();
    if (!data) return;
    const names = Object.values(data).map(v => v.name || 'უცნობი');
    likesDiv.textContent = '❤ ' + count + ' — ' + names.join(', ');
  });
}).catch(() => {});
const actions = el('div', {});
const btnEdit = el('button', {}, 'Edit');
const btnDelete = el('button', {}, 'Delete');
// --- Hide/Show button ---
const btnHide = el('button', {}, t.hidden ? 'გამოჩენა' : 'დამალე');
btnHide.style.marginRight = '6px';
btnHide.addEventListener('click', () => {
t.hidden = !t.hidden;
markDirty();
renderTracks(trackSearchInput ? trackSearchInput.value : '');
});
actions.appendChild(btnHide);
// ------------------------
actions.appendChild(btnEdit);
actions.appendChild(btnDelete);
btnEdit.addEventListener('click', () => {
openTrackEditModal(t);
});
btnDelete.addEventListener('click', () => {
if (!confirm('Delete track?')) return;
tracks = tracks.filter(x => x.id !== t.id);
renderTracks(trackSearchInput ? trackSearchInput.value : '');
markDirty();
});
item.appendChild(meta);
item.appendChild(actions);
adminTracks.appendChild(item);
});
}
if (btnRefreshAlbums) {
btnRefreshAlbums.addEventListener('click', () => {
if (loggedIn) {
renderAlbumsList();
fillAlbumSelects();
} else {
alert('Сначала войдите');
}
});
}
if (btnRefreshTracks) {
btnRefreshTracks.addEventListener('click', () => {
if (loggedIn) {
renderTracks(trackSearchInput ? trackSearchInput.value : '');
} else {
alert('Сначала войдите');
}
});
}
if (btnSaveAll) {
btnSaveAll.addEventListener('click', async () => {
if (!isDirty) {
alert('Нет несохранённых изменений');
return;
}
const originalText = btnSaveAll.querySelector('.inner-text').textContent;
btnSaveAll.querySelector('.inner-text').textContent = 'იხსნება...';
btnSaveAll.disabled = true;
const success = await saveToFirebase();
if (success) {
clearDirty();
alert('✓ ცვლილებები შენახულია!');
downloadJson();
} else {
alert('✗ შეცდომა შენახვისას');
}
btnSaveAll.querySelector('.inner-text').textContent = originalText;
btnSaveAll.disabled = false;
});
}
function tryLogin() {
const password = (passwordInput.value || '').toString();
if (password === '230470') {
loggedIn = true;
loginForm.classList.add('hidden');
adminPanel.classList.remove('hidden');
passwordInput.value = '';
// Load from Firebase instead of tracks.json
loadFromFirebase().then(() => {
renderAlbumsList();
renderTracks(trackSearchInput ? trackSearchInput.value : '');
fillAlbumSelects();
clearDirty();
}).catch(err => {
console.error(err);
alert('Не удалось загрузить данные из Firebase');
});
} else {
loginMsg.textContent = 'პაროლი არასწორია';
setTimeout(() => { loginMsg.textContent = ''; }, 3000);
}
}
if (loginBtn) {
loginBtn.addEventListener('click', tryLogin);
}
if (passwordInput) {
passwordInput.addEventListener('keydown', (e) => {
if (e.key === 'Enter') {
e.preventDefault();
tryLogin();
}
});
}
if (logoutBtn) {
logoutBtn.addEventListener('click', () => {
loggedIn = false;
adminPanel.classList.add('hidden');
loginForm.classList.remove('hidden');
});
}
function debounce(fn, wait) {
let t = null;
return function(...args) {
clearTimeout(t);
t = setTimeout(() => fn.apply(this, args), wait);
};
}
if (trackSearchInput) {
const onSearch = debounce(() => {
const q = trackSearchInput.value || '';
renderTracks(q);
}, 200);
trackSearchInput.addEventListener('input', onSearch);
if (trackSearchClear) {
trackSearchClear.addEventListener('click', () => {
trackSearchInput.value = '';
renderTracks('');
trackSearchInput.focus();
});
}
}
// ════════════════════════════════
//  Stats Panel
// ════════════════════════════════
const statsSortSelect = document.getElementById('stats-sort-select');
const statsListEl = document.getElementById('admin-stats-list');
const btnRefreshStats = document.getElementById('btn-refresh-stats');

async function renderStatsList() {
  if (!statsListEl) return;
  statsListEl.innerHTML = '<div class="muted">იტვირთება...</div>';
  try {
    const [likesSnap, playsSnap, likesUsersSnap] = await Promise.all([
      firebase.database().ref('likes').once('value'),
      firebase.database().ref('plays').once('value'),
      firebase.database().ref('likes_users').once('value'),
    ]);
    const likeCounts = likesSnap.val() || {};
    const playCounts = playsSnap.val() || {};
    const likesUsers = likesUsersSnap.val() || {};

    const visibleTracks = tracks.filter(t => !t.hidden);
    if (!visibleTracks.length) { statsListEl.innerHTML = '<div class="muted">ტრეკები არ არის</div>'; return; }

    const mode = statsSortSelect ? statsSortSelect.value : 'most-liked';
    const sorted = [...visibleTracks];
    if (mode === 'most-liked')   sorted.sort((a,b) => (likeCounts[b.id]||0) - (likeCounts[a.id]||0));
    else if (mode === 'least-liked')  sorted.sort((a,b) => (likeCounts[a.id]||0) - (likeCounts[b.id]||0));
    else if (mode === 'most-played')  sorted.sort((a,b) => (playCounts[b.id]||0) - (playCounts[a.id]||0));
    else if (mode === 'least-played') sorted.sort((a,b) => (playCounts[a.id]||0) - (playCounts[b.id]||0));
    else if (mode === 'newest')  sorted.sort((a,b) => (Number(b.id)||0) - (Number(a.id)||0));
    else if (mode === 'oldest')  sorted.sort((a,b) => (Number(a.id)||0) - (Number(b.id)||0));

    statsListEl.innerHTML = '';
    sorted.forEach((t, idx) => {
      const likes = likeCounts[t.id] || 0;
      const plays = playCounts[t.id] || 0;
      const userMap = likesUsers[t.id] || {};
      const names = Object.values(userMap).map(v => v.name || 'უცნობი');

      const row = document.createElement('div');
      row.style.cssText = 'padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08);';

      // Top line: rank + title + likes count
      const topLine = document.createElement('div');
      topLine.style.cssText = 'display:flex;align-items:center;gap:8px;';

      const rank = document.createElement('span');
      rank.style.cssText = 'min-width:22px;color:rgba(255,255,255,.3);font-size:12px;text-align:right;flex-shrink:0;';
      rank.textContent = (idx + 1) + '.';

      const title = document.createElement('span');
      title.style.cssText = 'flex:1;font-weight:700;font-size:14px;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      title.textContent = t.title || 'Untitled';

      const likesBadge = document.createElement('span');
      likesBadge.style.cssText = 'font-size:15px;font-weight:700;color:#ff7a66;flex-shrink:0;';
      likesBadge.textContent = '❤ ' + likes;

      topLine.appendChild(rank);
      topLine.appendChild(title);
      topLine.appendChild(likesBadge);

      // Bottom line: artist + plays + names
      const bottomLine = document.createElement('div');
      bottomLine.style.cssText = 'display:flex;align-items:flex-start;gap:8px;margin-top:4px;padding-left:30px;';

      const artist = document.createElement('span');
      artist.style.cssText = 'font-size:11px;color:rgba(255,255,255,.4);flex-shrink:0;';
      artist.textContent = t.artist || '';

      const playsBadge = document.createElement('span');
      playsBadge.style.cssText = 'font-size:11px;color:rgba(255,255,255,.35);flex-shrink:0;margin-left:6px;';
      playsBadge.textContent = '▶ ' + plays;

      bottomLine.appendChild(artist);
      bottomLine.appendChild(playsBadge);

      // Names line
      if (names.length) {
        const namesLine = document.createElement('div');
        namesLine.style.cssText = 'margin-top:5px;padding-left:30px;padding:4px 8px 4px 30px;background:rgba(255,122,102,.08);border-left:3px solid #ff7a66;border-radius:0 4px 4px 0;font-size:12px;color:#ffb3a7;line-height:1.5;';
        namesLine.textContent = '❤ ' + names.join('  •  ');
        row.appendChild(topLine);
        row.appendChild(bottomLine);
        row.appendChild(namesLine);
      } else {
        row.appendChild(topLine);
        row.appendChild(bottomLine);
      }

      statsListEl.appendChild(row);
    });
  } catch(e) {
    statsListEl.innerHTML = '<div class="muted">შეცდომა: ' + e.message + '</div>';
  }
}

if (statsSortSelect) statsSortSelect.addEventListener('change', renderStatsList);
if (btnRefreshStats) btnRefreshStats.addEventListener('click', renderStatsList);

// Auto-render when admin panel becomes visible
const origLogin = document.getElementById('login-btn');
if (origLogin) {
  origLogin.addEventListener('click', () => {
    setTimeout(() => { if (!document.getElementById('admin-panel').classList.contains('hidden')) renderStatsList(); }, 500);
  });
}
document.addEventListener('DOMContentLoaded', () => {
adminPanel.classList.add('hidden');
loginForm.classList.remove('hidden');
});
})();