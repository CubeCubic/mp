// ═══════════════════════════════════════════════════
// Firebase Imports (MUST BE AT TOP LEVEL FOR MODULES)
// ═══════════════════════════════════════════════════
import { db, collection, addDoc, getDocs, query, orderBy, onSnapshot, serverTimestamp } from './firebase-config.js';

// ═══════════════════════════════════════════════════
// Main App Logic
// ═══════════════════════════════════════════════════
(function () {

/* ═══════════════════════════════════════════════════
Cube Cubic — Main App Logic v4.0 WITH FIREBASE COMMENTS
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
const playerCoverWrapper = document.querySelector('.player-cover-wrapper');
const playerCoverBlur = document.getElementById('player-cover-blur');

// Модалки
const lyricsModal = document.getElementById('lyrics-modal');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalLyrics = document.getElementById('modal-lyrics');
const toast = document.getElementById('toast');

// Contact Modal
const contactModal = document.getElementById('contact-modal');
const contactModalClose = document.getElementById('contact-modal-close');
const contactCancel = document.getElementById('contact-cancel');
const contactForm = document.getElementById('contact-form');
const contactStatus = document.getElementById('contact-status');

// Comments Modal
const commentsModal = document.getElementById('comments-modal');
const commentsModalClose = document.getElementById('comments-modal-close');
const commentsTrackTitle = document.getElementById('comments-track-title');
const commentsList = document.getElementById('comments-list');
const commentName = document.getElementById('comment-name');
const commentText = document.getElementById('comment-text');
const commentSubmit = document.getElementById('comment-submit');
const commentCancel = document.getElementById('comment-cancel');

// ─── Состояние ───
let albums = [];
let tracks = [];
let filteredTracks = [];
let currentTrackIndex = -1;
let currentTrackId = null;
let userInteracted = false;
let sortNewest = false;
let showLikedOnly = false;
let currentCommentTrackId = null;
let commentsUnsubscribe = null;
let allCommentsCache = {};

// ════════════════════════════════
//  Firebase Comments System
// ════════════════════════════════
async function loadAllComments() {
    try {
        const commentsRef = collection(db, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'asc'));
        const snapshot = await getDocs(q);
        allCommentsCache = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            const trackId = data.trackId;
            if (!allCommentsCache[trackId]) {
                allCommentsCache[trackId] = [];
            }
            allCommentsCache[trackId].push({ id: doc.id, ...data });
        });
        return allCommentsCache;
    } catch (e) {
        console.error('Error loading comments:', e);
        return {};
    }
}

function getTrackCommentsCount(trackId) {
    return allCommentsCache[trackId] ? allCommentsCache[trackId].length : 0;
}

function subscribeToComments(trackId, callback) {
    if (commentsUnsubscribe) {
        commentsUnsubscribe();
        commentsUnsubscribe = null;
    }
    
    const commentsRef = collection(db, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'asc'));
    
    commentsUnsubscribe = onSnapshot(q, (snapshot) => {
        const allComments = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.trackId === trackId) {
                allComments.push({ id: doc.id, ...data });
            }
        });
        allCommentsCache[trackId] = allComments;
        callback(allComments);
    });
}

async function addCommentToFirebase(trackId, author, text) {
    try {
        await addDoc(collection(db, 'comments'), {
            trackId: trackId,
            author: author || 'ანონიმი',
            text: text,
            timestamp: serverTimestamp()
        });
        return true;
    } catch (e) {
        console.error('Error adding comment:', e);
        return false;
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'ახლახან';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'ახლახან';
    if (minutes < 60) return `${minutes} წთ წინ`;
    if (hours < 24) return `${hours} სთ წინ`;
    if (days < 7) return `${days} დღე წინ`;
    
    return date.toLocaleDateString('ka-GE');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ════════════════════════════════
//  Comments Modal Functions
// ════════════════════════════════
function openCommentsModal(t) {
    if (!commentsModal) return;
    currentCommentTrackId = t.id;
    commentsTrackTitle.textContent = `კომენტარები: ${safeStr(t.title)}`;
    renderCommentsList(t.id);
    commentsModal.classList.remove('hidden');
    commentsModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    
    subscribeToComments(t.id, (comments) => {
        renderCommentsList(comments);
        updateCommentBadge(t.id, comments.length);
    });
    
    setTimeout(() => { if (commentText) commentText.focus(); }, 100);
}

function closeCommentsModal() {
    if (!commentsModal) return;
    commentsModal.classList.add('hidden');
    commentsModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    
    if (commentsUnsubscribe) {
        commentsUnsubscribe();
        commentsUnsubscribe = null;
    }
    
    currentCommentTrackId = null;
    if (commentName) commentName.value = '';
    if (commentText) commentText.value = '';
}

function renderCommentsList(comments) {
    if (!commentsList) return;
    
    const commentsArray = Array.isArray(comments) ? comments : getTrackComments(currentCommentTrackId);
    
    if (!commentsArray || commentsArray.length === 0) {
        commentsList.innerHTML = '<div class="no-comments">კომენტარები ჯერ არ არის. იყავით პირველი!</div>';
        return;
    }
    
    commentsList.innerHTML = commentsArray.map(c => `
        <div class="comment-item">
            <div class="comment-header">
                <span class="comment-author">${escapeHtml(c.author)}</span>
                <span class="comment-date">${formatDate(c.timestamp)}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
    `).join('');
}

function getTrackComments(trackId) {
    return allCommentsCache[trackId] || [];
}

function updateCommentBadge(trackId, count) {
    const badge = document.getElementById(`comment-count-${trackId}`);
    if (badge) {
        badge.textContent = count > 0 ? count : '0';
    }
}

if (commentsModalClose) {
    commentsModalClose.addEventListener('click', closeCommentsModal);
}

if (commentsModal) {
    commentsModal.addEventListener('click', (e) => {
        if (e.target === commentsModal) closeCommentsModal();
    });
}

if (commentCancel) {
    commentCancel.addEventListener('click', closeCommentsModal);
}

if (commentSubmit) {
    commentSubmit.addEventListener('click', async () => {
        if (!currentCommentTrackId) return;
        const text = (commentText.value || '').trim();
        if (!text) {
            showToast('კომენტარი ცარიელია');
            return;
        }
        
        const author = (commentName.value || '').trim() || 'მომხმარებელი';
        
        commentSubmit.disabled = true;
        commentSubmit.textContent = 'იგზავნება...';
        
        const success = await addCommentToFirebase(currentCommentTrackId, author, text);
        
        if (success) {
            if (commentText) commentText.value = '';
            if (commentName) commentName.value = '';
            showToast('კომენტარი დაემატა! 💬');
        } else {
            showToast('შეცდომა კომენტარის დამატებისას');
        }
        
        commentSubmit.disabled = false;
        commentSubmit.textContent = 'გაგზავნა';
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && commentsModal && !commentsModal.classList.contains('hidden')) {
        closeCommentsModal();
    }
});

// ════════════════════════════════
//  Like System (localStorage)
// ════════════════════════════════
const LIKES_STORAGE_KEY = 'cubeCubicLikes';
function getLikes() {
    try {
        const stored = localStorage.getItem(LIKES_STORAGE_KEY);
        return stored ? JSON.parse(stored) : {};
    } catch (e) {
        console.error('Error loading likes:', e);
        return {};
    }
}
function saveLikes(likes) {
    try {
        localStorage.setItem(LIKES_STORAGE_KEY, JSON.stringify(likes));
    } catch (e) {
        console.error('Error saving likes:', e);
    }
}
function getLikeCount(trackId) {
    const likes = getLikes();
    return likes[trackId] || 0;
}
function isLikedByUser(trackId) {
    const userLikesKey = `${LIKES_STORAGE_KEY}_user`;
    try {
        const stored = localStorage.getItem(userLikesKey);
        const userLikes = stored ? JSON.parse(stored) : {};
        return userLikes[trackId] === true;
    } catch (e) {
        return false;
    }
}
function toggleLike(trackId) {
    const likes = getLikes();
    const userLikesKey = `${LIKES_STORAGE_KEY}_user`;
    try {
        const stored = localStorage.getItem(userLikesKey);
        const userLikes = stored ? JSON.parse(stored) : {};
        
        if (userLikes[trackId]) {
            userLikes[trackId] = false;
            likes[trackId] = Math.max(0, (likes[trackId] || 0) - 1);
        } else {
            userLikes[trackId] = true;
            likes[trackId] = (likes[trackId] || 0) + 1;
        }
        
        localStorage.setItem(userLikesKey, JSON.stringify(userLikes));
        saveLikes(likes);
        
        return userLikes[trackId];
    } catch (e) {
        console.error('Error toggling like:', e);
        return false;
    }
}
function getUserLikedTracks() {
    const userLikesKey = `${LIKES_STORAGE_KEY}_user`;
    try {
        const stored = localStorage.getItem(userLikesKey);
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
                        !contactModal.classList.contains('hidden') ||
                        !commentsModal.classList.contains('hidden');
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

        const h4 = document.createElement('h4');
        h4.textContent = safeStr(t.title);
        info.appendChild(h4);

        const albumDiv = document.createElement('div');
        albumDiv.textContent = getAlbumName(t);
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
        
        const commentBtn = document.createElement('button');
        commentBtn.type = 'button';
        commentBtn.className = 'comment-button';
        const commentCount = getTrackCommentsCount(t.id);
        commentBtn.innerHTML = `
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>
            <span class="comment-count-badge" id="comment-count-${t.id}">${commentCount}</span>
        `;
        commentBtn.title = 'კომენტარები';
        commentBtn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openCommentsModal(t);
        });
        actions.appendChild(commentBtn);
        
        card.appendChild(actions);

        const progressEl = document.createElement('div');
        progressEl.className = 'card-progress-bar';
        card.appendChild(progressEl);

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
}

// ════════════════════════════════
//  Highlight playing card
// ════════════════════════════════
function highlightCurrent() {
    if (!tracksContainer) return;
    tracksContainer.querySelectorAll('.card').forEach(c => c.classList.remove('playing-track'));
    if (currentTrackId) {
        const card = tracksContainer.querySelector(`[data-track-id="${currentTrackId}"]`);
        if (card) {
            card.classList.add('playing-track');
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
        if (playerCoverBlur) playerCoverBlur.style.backgroundImage = 'none';
        if (playBtn) playBtn.textContent = '▶';
        return;
    }
    if (playerTitle) playerTitle.textContent = safeStr(t.title);
    if (playerArtist) playerArtist.textContent = safeStr(t.artist);
    const coverUrl = getCoverUrl(t);
    if (playerCoverImg) playerCoverImg.src = coverUrl;
    if (playerCoverBlur) playerCoverBlur.style.backgroundImage = `url(${coverUrl})`;
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
}
function togglePlay() {
    userInteracted = true;
    if (audio.paused || audio.ended) {
        audio.play().catch(console.error);
    } else {
        audio.pause();
    }
}
function playNext() {
    if (!filteredTracks.length) return;
    let idx = currentTrackIndex;
    if (currentTrackId) {
        const foundIdx = filteredTracks.findIndex(t => t.id === currentTrackId);
        if (foundIdx >= 0) {
            idx = foundIdx;
        }
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

// ════════════════════════════════
//  Кнопки плеера (ИСПРАВЛЕНО - работают с мыши!)
// ════════════════════════════════
if (playBtn) {
    playBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
    });
}

if (prevBtn) {
    prevBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playPrev();
    });
}

if (nextBtn) {
    nextBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        playNext();
    });
}

if (progressBar) {
    progressBar.addEventListener('input', () => {
        audio.currentTime = progressBar.value;
    });
}

if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
        audio.volume = parseFloat(volumeSlider.value);
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
        tracks = shuffleArray(tracks);
        
        // Load Firebase comments
        await loadAllComments();
        
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

const likedBtn = document.getElementById('liked-tracks-btn');
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
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// ════════════════════════════════
//  Contact Form Modal
// ════════════════════════════════
const contactBtn = document.getElementById('contact-btn');

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

if (contactBtn) {
    contactBtn.addEventListener('click', openContactModal);
}

if (contactModalClose) {
    contactModalClose.addEventListener('click', closeContactModal);
}

if (contactCancel) {
    contactCancel.addEventListener('click', closeContactModal);
}

if (contactModal) {
    contactModal.addEventListener('click', (e) => {
        if (e.target === contactModal) {
            closeContactModal();
        }
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

        if (contactStatus) {
            contactStatus.className = 'contact-status hidden';
        }

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
                
                setTimeout(() => {
                    closeContactModal();
                }, 2000);
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
//  Share Button
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

if (shareBtnHeader) {
    shareBtnHeader.addEventListener('click', handleShare);
}

// ════════════════════════════════
//  Header Logo & Title Refresh
// ════════════════════════════════
function refreshSite() {
    location.reload();
}

const headerBadge = document.getElementById('header-badge');
const headerTitle = document.querySelector('header h1');

if (headerBadge) {
    headerBadge.addEventListener('click', refreshSite);
}

if (headerTitle) {
    headerTitle.addEventListener('click', refreshSite);
}

// ════════════════════════════════
//  Handle shared track links
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
                setTimeout(() => {
                    card.style.boxShadow = '';
                }, 3000);
            }
        }, 500);
    }
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    updatePlayer(null);
    if (audio && volumeSlider) audio.volume = parseFloat(volumeSlider.value || 1);
    loadData().then(() => {
        handleSharedTrackLink();
    });
});

})();