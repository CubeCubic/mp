(function () {
/* ═══════════════════════════════════════════════════
Cube Cubic — Main App Logic v3.0 FIXED
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

// Player elements
const playerSidebar = document.getElementById('player-sidebar');
const playerCoverImg = document.getElementById('player-cover-img');
const playerTitle = document.getElementById('player-title-sidebar');
const playerArtist = document.getElementById('player-artist-sidebar');
const playBtn = document.getElementById('play-sidebar');
const prevBtn = document.getElementById('prev-sidebar');
const nextBtn = document.getElementById('next-sidebar');
const progressBar = document.getElementById('progress-sidebar');
const timeCurrent = document.getElementById('time-current-sidebar');
const timeTotal = document.getElementById('time-total-sidebar');
const volumeSlider = document.getElementById('volume-slider');
const toast = document.getElementById('toast');

// Modals
const lyricsModal = document.getElementById('lyrics-modal');
const lyricsContent = document.getElementById('lyrics-content');

// State
let albums = [];
let tracks = [];
let filteredTracks = []; // Tracks currently displayed after filtering/sorting
let currentTrackIndex = -1;
let userInteracted = false;
let sortNewest = false; // toggle for "უახლესი ტრეკები" button

// ════════════════════════════════
// Load Data
// ════════════════════════════════
async function loadData() {
    try {
        const res = await fetch('tracks.json');
        if (!res.ok) throw new Error('Failed to load tracks.json');
        const data = await res.json();
        tracks = data.tracks || [];
        albums = data.albums || [];

        // SHUFFLE ON LOAD
        tracks = shuffleArray(tracks);
        updateTrackCount();
        renderAlbumList();
        renderTracks();
    } catch (e) {
        console.error('Error loading tracks.json:', e);
        if (tracksContainer) tracksContainer.innerHTML = '<div class="muted">ტრეკები ვერ ჩაიტვირთა</div>';
    }
}

// ════════════════════════════════
// Album Select Handling
// ════════════════════════════════
if (albumSelect) {
    albumSelect.addEventListener('change', () => {
        const selectedAlbumId = albumSelect.value;
        updateSubalbumDropdown(selectedAlbumId);
        renderTracks();
        // Reset subalbum selection when main album changes
        if (subalbumSelect) subalbumSelect.value = '';
    });
}

function updateSubalbumDropdown(parentId) {
    if (!subalbumSelect) return;

    subalbumSelect.innerHTML = '<option value="">— ყველა ქვეალბომები —</option>';

    if (parentId) {
        const subalbums = albums.filter(a => String(a.parentId) === String(parentId));
        if (subalbums.length > 0) {
            subalbums.forEach(sa => {
                const option = document.createElement('option');
                option.value = sa.id;
                option.textContent = sa.name || `(no name)`;
                subalbumSelect.appendChild(option);
            });
            subalbumSelect.disabled = false;
            subalbumSelect.style.display = '';
            if (subalbumLabel) subalbumLabel.style.display = '';
        } else {
            subalbumSelect.disabled = true;
            subalbumSelect.style.display = 'none';
            if (subalbumLabel) subalbumLabel.style.display = 'none';
        }
    } else {
        subalbumSelect.disabled = true;
        subalbumSelect.style.display = 'none';
        if (subalbumLabel) subalbumLabel.style.display = 'none';
    }
    subalbumSelect.value = '';
}

// ════════════════════════════════
// Track cards rendering
// ════════════════════════════════
function renderTracks() {
    if (!tracksContainer) return;
    tracksContainer.innerHTML = '';

    let toRender = tracks;

    // Global search filter
    const searchQ = (globalSearchInput ? globalSearchInput.value : '').trim();
    if (searchQ) {
        toRender = toRender.filter(t => matchesQuery(t, searchQ));
    }

    // Album filter
    const selAlbum = albumSelect ? albumSelect.value : '';
    if (selAlbum) {
        const subIds = albums
            .filter(a => String(a.parentId) === String(selAlbum))
            .map(a => a.id);
        toRender = toRender.filter(t => {
            const tid = String(t.albumId || '');
            return tid === selAlbum || subIds.includes(tid);
        });
    }

    // Subalbum filter
    const selSubAlbum = subalbumSelect ? subalbumSelect.value : '';
    if (selSubAlbum) {
        toRender = toRender.filter(t => String(t.albumId || '') === selSubAlbum);
    }

    if (!toRender.length) {
        tracksContainer.innerHTML = '<div class="muted">ტრეკები არ მოიძებნა</div>';
        filteredTracks = [];
        return;
    }

    // Sorting
    if (sortNewest) {
        toRender.sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
    }
    // Else order is as is (random on load)

    // Store filtered tracks for player navigation
    filteredTracks = toRender;

    toRender.forEach(t => {
        const card = document.createElement('div');
        card.className = 'card';
        card.dataset.trackId = t.id; // Important for identifying track

        const coverImg = document.createElement('img');
        coverImg.src = getCoverUrl(t);
        coverImg.alt = t.title || 'Cover';
        coverImg.loading = 'lazy'; // Lazy load images
        card.appendChild(coverImg);

        const info = document.createElement('div');
        info.className = 'track-info';

        const titleEl = document.createElement('h3');
        titleEl.textContent = t.title || 'უსათაურო';
        info.appendChild(titleEl);

        const artistEl = document.createElement('p');
        artistEl.textContent = t.artist || '';
        info.appendChild(artistEl);

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
                dlBtn.disabled = true;
                dlBtn.innerHTML = '...';
                const fname = (t.title || 'track') + '.flac';
                const timer = setInterval(() => {
                    if (dlBtn.innerHTML === '...') dlBtn.innerHTML = '....';
                    else if (dlBtn.innerHTML === '....') dlBtn.innerHTML = '.....';
                    else dlBtn.innerHTML = '...';
                }, 500);

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

        card.appendChild(actions);

        // --- ADD RATING SECTION ---
        const ratingDiv = document.createElement('div');
        ratingDiv.className = 'rating-stars';
        ratingDiv.dataset.trackId = t.id; // Привязываем к ID трека

        // Создаём 5 звёзд
        for (let i = 1; i <= 5; i++) {
            const starSpan = document.createElement('span');
            starSpan.className = 'star';
            starSpan.dataset.value = i;
            starSpan.textContent = '★';
            ratingDiv.appendChild(starSpan);
        }

        // Элемент для отображения текущей оценки
        const ratingDisplay = document.createElement('span');
        ratingDisplay.className = 'rating-display';
        ratingDisplay.textContent = '--';
        ratingDiv.appendChild(ratingDisplay);

        // Загружаем сохранённую оценку из localStorage и отображаем её
        const savedRating = loadRating(t.id);
        updateStarDisplay(ratingDiv, savedRating);

        // Добавляем обработчик клика на звёзды
        ratingDiv.querySelectorAll('.star').forEach(star => {
            star.addEventListener('click', (ev) => {
                ev.stopPropagation(); // Не срабатывать на карточке
                const value = parseInt(ev.target.dataset.value);
                if (!isNaN(value)) {
                    saveRating(t.id, value);
                    updateStarDisplay(ratingDiv, value); // Обновляем отображение после клика
                }
            });
        });

        card.appendChild(ratingDiv); // Добавляем блок с оценкой в конец карточки
        // --- END ADD RATING SECTION ---


        card.addEventListener('click', () => {
            userInteracted = true;
            const idx = filteredTracks.indexOf(t);
            playByIndex(idx);
        });

        tracksContainer.appendChild(card);
    });
    highlightCurrent();
}

// ════════════════════════════════
// Search
// ════════════════════════════════
function matchesQuery(track, q) {
    if (!q) return true;
    const low = q.toLowerCase();
    return (
        safeStr(track.title).toLowerCase().includes(low) ||
        safeStr(track.artist).toLowerCase().includes(low) ||
        safeStr(getAlbumName(track)).toLowerCase().includes(low) ||
        safeStr(track.lyrics).toLowerCase().includes(low)
    );
}

if (globalSearchInput) {
    let searchTimeout;
    globalSearchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            renderTracks();
        }, 300); // Debounce search
    });
}

// ════════════════════════════════
// Highlight playing card
// ════════════════════════════════
function highlightCurrent() {
    if (!tracksContainer) return;
    tracksContainer.querySelectorAll('.card').forEach(c => c.classList.remove('playing-track'));
    if (currentTrackIndex >= 0 && currentTrackIndex < filteredTracks.length) {
        const id = filteredTracks[currentTrackIndex].id;
        const card = tracksContainer.querySelector(`[data-track-id="${id}"]`);
        if (card) {
            card.classList.add('playing-track');
            // Optionally scroll to the playing card
            // card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }
}

// ════════════════════════════════
// Player Controls
// ════════════════════════════════
function updatePlayer(track) {
    if (!playerSidebar || !track) {
        playerSidebar?.classList.add('hidden');
        return;
    }

    playerSidebar.classList.remove('hidden');
    playerCoverImg.src = getCoverUrl(track);
    playerTitle.textContent = track.title || 'უსათაურო';
    playerArtist.textContent = track.artist || 'უცნობი შემსრულებელი';

    // Update total time when metadata loads
    audio.onloadedmetadata = () => {
        timeTotal.textContent = formatTime(audio.duration);
        progressBar.max = audio.duration;
    };

    // Update progress bar
    audio.ontimeupdate = () => {
        progressBar.value = audio.currentTime;
        timeCurrent.textContent = formatTime(audio.currentTime);
    };

    // Handle playback ended
    audio.onended = () => {
        playNext();
    };

    // Handle errors
    audio.onerror = () => {
        showToast('შეცდომა აუდიოს დაკრავადან');
    };
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
    if (audio.paused) {
        audio.play().then(() => {
            if (playBtn) playBtn.textContent = '⏸';
        }).catch(e => {
            if (e.name === 'NotAllowedError') {
                showToast('დააჭირეთ ▶ დასაკრავად');
            }
        });
    } else {
        audio.pause();
        if (playBtn) playBtn.textContent = '▶';
    }
}

function playPrev() {
    userInteracted = true;
    if (currentTrackIndex > 0) {
        playByIndex(currentTrackIndex - 1);
    } else if (currentTrackIndex === 0 && filteredTracks.length > 0) {
        playByIndex(filteredTracks.length - 1); // Loop to end
    }
}

function playNext() {
    userInteracted = true;
    if (currentTrackIndex < filteredTracks.length - 1) {
        playByIndex(currentTrackIndex + 1);
    } else if (currentTrackIndex === filteredTracks.length - 1 && filteredTracks.length > 0) {
        playByIndex(0); // Loop to start
    }
}

// Event listeners for player controls
if (playBtn) playBtn.addEventListener('click', togglePlay);
if (prevBtn) prevBtn.addEventListener('click', playPrev);
if (nextBtn) nextBtn.addEventListener('click', playNext);

if (progressBar) {
    progressBar.addEventListener('input', () => {
        audio.currentTime = progressBar.value;
    });
}

if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
        audio.volume = volumeSlider.value;
    });
    // Set initial volume
    audio.volume = volumeSlider.value;
}

// ════════════════════════════════
// Album sidebar rendering
// ════════════════════════════════
function renderAlbumList() {
    if (!albumListContainer) return;
    albumListContainer.innerHTML = '';
    if (!albums.length) return;

    // Group albums by parent
    const rootAlbums = albums.filter(a => !a.parentId || a.parentId === '');
    const childAlbumsMap = {};
    albums.forEach(a => {
        if (a.parentId && a.parentId !== '') {
            if (!childAlbumsMap[a.parentId]) childAlbumsMap[a.parentId] = [];
            childAlbumsMap[a.parentId].push(a);
        }
    });

    // Recursive helper to build nested list
    function createAlbumElements(albumsToProcess, level = 0) {
        const frag = document.createDocumentFragment();
        albumsToProcess.forEach(a => {
            const link = document.createElement('a');
            link.href = '#';
            link.textContent = a.name || `(no name)`;

            const indent = '\u00A0'.repeat(level * 3); // Non-breaking space for indentation
            link.innerHTML = indent + link.textContent;

            link.addEventListener('click', (e) => {
                e.preventDefault();
                albumSelect.value = a.id;
                updateSubalbumDropdown(a.id);
                renderTracks();
                // Scroll to top of tracks
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            frag.appendChild(link);

            // Append child albums if any
            const children = childAlbumsMap[a.id];
            if (children && children.length > 0) {
                const childFrag = createAlbumElements(children, level + 1);
                frag.appendChild(childFrag);
            }
        });
        return frag;
    }

    const rootFrag = createAlbumElements(rootAlbums);
    albumListContainer.appendChild(rootFrag);
}

// ════════════════════════════════
// Modals
// ════════════════════════════════
function openLyricsModal(track) {
    if (!lyricsModal || !lyricsContent || !track.lyrics) return;
    lyricsContent.textContent = track.lyrics;
    lyricsModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
}

if (lyricsModal) {
    lyricsModal.addEventListener('click', (e) => {
        if (e.target === lyricsModal) {
            lyricsModal.classList.add('hidden');
            document.body.classList.remove('modal-open');
        }
    });
}

// ════════════════════════════════
// Buttons
// ════════════════════════════════
// REFRESH button — reset album selection and reload
if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
        // Сбросить выбор альбома
        if (albumSelect) albumSelect.value = '';
        if (subalbumSelect) {
            subalbumSelect.innerHTML = '<option value="">— ყველა ქვეალბომები —</option>';
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
        newestBtn.textContent = sortNewest ? 'ყველა ტრეკი' : 'უახლესი ტრეკები';
        renderTracks(); // Re-render with new sort order
    });
}


// ════════════════════════════════
// Rating Functions
// ════════════════════════════════

/**
 * Загружает оценку для трека из localStorage
 * @param {string} trackId - ID трека
 * @returns {number|null} - Оценка (1-5) или null, если нет
 */
function loadRating(trackId) {
    const ratings = JSON.parse(localStorage.getItem('trackRatings')) || {};
    return ratings[trackId] || null;
}

/**
 * Сохраняет оценку для трека в localStorage
 * @param {string} trackId - ID трека
 * @param {number} rating - Оценка (1-5)
 */
function saveRating(trackId, rating) {
    let ratings = JSON.parse(localStorage.getItem('trackRatings')) || {};
    ratings[trackId] = rating;
    localStorage.setItem('trackRatings', JSON.stringify(ratings));
}

/**
 * Обновляет отображение звёзд для конкретного блока ratingDiv
 * @param {HTMLElement} ratingDiv - DOM-элемент .rating-stars
 * @param {number|null} rating - Текущая оценка
 */
function updateStarDisplay(ratingDiv, rating) {
    const stars = ratingDiv.querySelectorAll('.star');
    const display = ratingDiv.querySelector('.rating-display');

    // Сброс классов
    stars.forEach(star => star.classList.remove('selected'));

    if (rating !== null && rating >= 1 && rating <= 5) {
        // Выделяем звёзды до текущей оценки
        for (let i = 0; i < rating; i++) {
            stars[i].classList.add('selected');
        }
        display.textContent = rating;
    } else {
        display.textContent = '--';
    }
}

// ════════════════════════════════
// Utilities
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
// Update track counter
// ════════════════════════════════
function updateTrackCount() {
    if (!trackCountDisplay) return;
    trackCountDisplay.textContent = `სულ ტრეკი: ${tracks.length}`;
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    updatePlayer(null);
    if (audio && volumeSlider) audio.volume = parseFloat(volumeSlider.value || 1);
    loadData();
});

})();