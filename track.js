(function() {
  // ════════════════════════════════
  //  Config (from app.js)
  // ════════════════════════════════
  const ALLOWED_DOWNLOAD_IPS = [
    '188.169.181.187',
    '194.60.250.61'
  ];
  const LIKES_STORAGE_KEY = 'cubeCubicLikes';
  const USER_LIKES_KEY = LIKES_STORAGE_KEY + '_user';
  const PLAYLIST_KEY = 'cubicMyPlaylist';

  // ════════════════════════════════
  //  State
  // ════════════════════════════════
  let downloadAllowed = false;
  let firebaseLikeCounts = {};
  let playCounts = {};
  let currentTrack = null;

  // ════════════════════════════════
  //  Helpers
  // ════════════════════════════════
  function getParam(name) {
    return new URL(window.location.href).searchParams.get(name);
  }
  function safeStr(v) { return v == null ? '' : String(v); }
  function getCoverUrl(t) {
    const fallback = 'images/midcube.png';
    if (!t) return fallback;
    return t.coverUrl || (t.cover ? 'uploads/' + t.cover : fallback);
  }
  function getStreamUrl(t) {
    if (!t) return null;
    return t.audioUrl || t.downloadUrl || (t.filename ? 'media/' + t.filename : null);
  }
  function getAlbumName(albums, albumId) {
    if (!albumId) return '';
    const a = albums.find(x => String(x.id) === String(albumId));
    return a ? (a.name || '') : '';
  }

  // ════════════════════════════════
  //  Like System
  // ════════════════════════════════
  function getLikeCount(trackId) {
    return firebaseLikeCounts[trackId] || 0;
  }
  function isLikedByUser(trackId) {
    try {
      const stored = localStorage.getItem(USER_LIKES_KEY);
      const userLikes = stored ? JSON.parse(stored) : {};
      return userLikes[trackId] === true;
    } catch (e) { return false; }
  }
  function toggleLike(trackId) {
    try {
      const stored = localStorage.getItem(USER_LIKES_KEY);
      const userLikes = stored ? JSON.parse(stored) : {};
      const nowLiked = !userLikes[trackId];
      userLikes[trackId] = nowLiked;
      localStorage.setItem(USER_LIKES_KEY, JSON.stringify(userLikes));
      firebase.database().ref('likes/' + trackId).transaction((current) => {
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

  // ════════════════════════════════
  //  Play Count
  // ════════════════════════════════
  function getPlayCount(trackId) {
    return playCounts[trackId] || 0;
  }
  function incrementPlayCount(trackId) {
    firebase.database().ref('plays/' + trackId).transaction(val => (val || 0) + 1);
  }

  // ════════════════════════════════
  //  Playlist
  // ════════════════════════════════
  function getPlaylistIds() {
    try {
      const raw = localStorage.getItem(PLAYLIST_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
  }
  function isInPlaylist(trackId) {
    return getPlaylistIds().includes(trackId);
  }
  function togglePlaylist(trackId) {
    const ids = getPlaylistIds();
    const idx = ids.indexOf(trackId);
    if (idx >= 0) ids.splice(idx, 1);
    else ids.push(trackId);
    localStorage.setItem(PLAYLIST_KEY, JSON.stringify(ids));
    return idx < 0;
  }

  // ════════════════════════════════
  //  Download
  // ════════════════════════════════
  async function checkDownloadAccess() {
    if (!ALLOWED_DOWNLOAD_IPS.length) return;
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      if (ALLOWED_DOWNLOAD_IPS.includes(data.ip || '')) downloadAllowed = true;
    } catch (e) {}
  }
  async function triggerDownload(url, filename) {
    if (!downloadAllowed) {
      showToast('ჩამოტვირთვა შეზღუდულია');
      openContactModal();
      return;
    }
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

  // ════════════════════════════════
  //  Toast
  // ════════════════════════════════
  function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.remove('hidden');
    toast.classList.add('visible');
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.classList.add('hidden'), 350);
    }, 3000);
  }

  // ════════════════════════════════
  //  Contact Modal
  // ════════════════════════════════
  function openContactModal() {
    const m = document.getElementById('contact-modal');
    if (!m) return;
    m.classList.remove('hidden');
    m.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
    const inp = document.getElementById('contact-name');
    if (inp) setTimeout(() => inp.focus(), 100);
  }
  function closeContactModal() {
    const m = document.getElementById('contact-modal');
    const f = document.getElementById('contact-form');
    const s = document.getElementById('contact-status');
    if (!m) return;
    m.classList.add('hidden');
    m.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    if (f) f.reset();
    if (s) { s.textContent = ''; s.className = 'contact-status hidden'; }
  }

  // ════════════════════════════════
  //  Share
  // ════════════════════════════════
  async function handleShare(t) {
    const trackUrl = window.location.href;
    const shareData = {
      title: safeStr(t.title),
      text: safeStr(t.title) + (t.artist ? ' - ' + safeStr(t.artist) : ''),
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
        } catch (e) {
          showToast('შეცდომა გაზიარებისას');
        }
      }
    }
  }

  // ════════════════════════════════
  //  Update UI
  // ════════════════════════════════
  function updateStats() {
    if (!currentTrack) return;
    const id = currentTrack.id;
    const likeBtn = document.getElementById('track-like-btn');
    if (likeBtn) {
      const heart = likeBtn.querySelector('.heart-icon');
      const count = likeBtn.querySelector('.like-count');
      if (heart) heart.classList.toggle('liked', isLikedByUser(id));
      if (count) count.textContent = getLikeCount(id) > 0 ? getLikeCount(id) : '';
    }
    const playEl = document.getElementById('track-play-count');
    if (playEl) {
      const pc = getPlayCount(id);
      playEl.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg><span>' + (pc > 0 ? pc : '') + '</span>';
      playEl.style.display = pc > 0 ? 'flex' : 'none';
    }
    const likeCountEl = document.getElementById('track-like-count');
    if (likeCountEl) {
      const lc = getLikeCount(id);
      likeCountEl.textContent = '❤ ' + lc;
      likeCountEl.style.display = lc > 0 ? 'inline' : 'none';
    }
  }

  // ════════════════════════════════
  //  Main Load
  // ════════════════════════════════
  const trackId = getParam('id');
  const container = document.getElementById('track-page');

  if (!trackId) {
    container.innerHTML = '<div class="track-page-not-found">ტრეკი ვერ მოიძებნა</div>';
    return;
  }

  async function load() {
    try {
      const [tracksSnap, albumsSnap] = await Promise.all([
        firebase.database().ref('tracks').once('value'),
        firebase.database().ref('albums').once('value')
      ]);
      const tracks = tracksSnap.val() || [];
      const albums = albumsSnap.val() || [];
      const track = tracks.find(t => String(t.id) === String(trackId));

      if (!track || track.hidden) {
        container.innerHTML = '<div class="track-page-not-found">ტრეკი ვერ მოიძებნა</div>';
        return;
      }

      currentTrack = track;
      document.title = safeStr(track.title) + ' — Cubic';

      const streamUrl = getStreamUrl(track);
      const coverUrl = getCoverUrl(track);
      const albumName = getAlbumName(albums, track.albumId);
      const isLiked = isLikedByUser(track.id);
      const likeCount = getLikeCount(track.id);
      const inPlaylist = isInPlaylist(track.id);
      const pc = getPlayCount(track.id);

      let html = '<div class="track-page-card">' +
        '<img class="track-page-cover" src="' + coverUrl + '" alt="' + safeStr(track.title) + '">' +
        '<div class="track-page-title">' + safeStr(track.title) + '</div>';
      if (track.artist) html += '<div class="track-page-artist">' + safeStr(track.artist) + '</div>';
      if (albumName)    html += '<div class="track-page-album">' + safeStr(albumName) + '</div>';

      html += '<div class="track-page-stats" style="display:flex;gap:10px;justify-content:center;margin:8px 0 12px;font-size:12px;color:rgba(255,255,255,0.5);">' +
        '<span id="track-play-count" style="display:' + (pc > 0 ? 'flex' : 'none') + ';align-items:center;gap:4px;">' +
          '<svg viewBox="0 0 24 24" style="width:14px;height:14px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg><span>' + (pc > 0 ? pc : '') + '</span>' +
        '</span>' +
        '<span id="track-like-count" style="display:' + (likeCount > 0 ? 'inline' : 'none') + ';">❤ ' + likeCount + '</span>' +
      '</div>';

      if (streamUrl) {
        html += '<audio class="track-page-audio" controls preload="metadata" src="' + streamUrl + '"></audio>';
      }

      html += '<div class="track-actions" style="justify-content:center;margin:12px 0;">' +
        '<button id="track-pl-btn" class="playlist-track-btn ' + (inPlaylist ? 'in-playlist' : '') + '" ' +
          'title="' + (inPlaylist ? 'პლეილისტიდან წაშლა' : 'პლეილისტში დამატება') + '">' +
          '<svg viewBox="0 0 24 24"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zM2 16h8v-2H2v2zm19.5-4.5L23 13l-6.99 7-4.51-4.5L13 14l3.01 3 5.49-5.5z"/></svg>' +
        '</button>' +
        '<button id="track-like-btn" class="like-button">' +
          '<svg viewBox="0 0 24 24" class="heart-icon ' + (isLiked ? 'liked' : '') + '">' +
            '<path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>' +
          '</svg>' +
          '<span class="like-count">' + (likeCount > 0 ? likeCount : '') + '</span>' +
        '</button>' +
        '<button id="track-dl-btn" class="download-button" title="' + (downloadAllowed ? 'ჩამოტვირთვა' : 'ჩამოტვირთვა შეზღუდულია') + '" ' +
          'style="' + (!downloadAllowed ? 'opacity:.4;' : '') + '">' +
          '<svg viewBox="0 0 24 24"><path d="M5 20h14a1 1 0 0 0 0-2H5a1 1 0 0 0 0 2zM12 3a1 1 0 0 0-1 1v8.59L8.7 10.3a1 1 0 0 0-1.4 1.4l4 4a1 1 0 0 0 1.4 0l4-4a1 1 0 0 0-1.4-1.4L13 12.59V4a1 1 0 0 0-1-1z"/></svg>' +
        '</button>' +
        '<button id="track-share-btn" class="share-button" title="გაზიარება">' +
          '<svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C 7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92 1.61 0 2.92-1.31 2.92-2.92s-1.31-2.92-2.92-2.92z"/></svg>' +
        '</button>' +
      '</div>';

      if (track.lyrics && track.lyrics.trim()) {
        html += '<div class="track-page-lyrics-label">ტექსტი</div>' +
                '<pre class="track-page-lyrics">' + safeStr(track.lyrics) + '</pre>';
      }
      html += '<a href="index.html" class="track-page-back">← მთავარზე დაბრუნება</a></div>';

      container.innerHTML = html;

      // Playlist button
      const plBtn = document.getElementById('track-pl-btn');
      if (plBtn) {
        plBtn.addEventListener('click', () => {
          const added = togglePlaylist(track.id);
          plBtn.classList.toggle('in-playlist', added);
          plBtn.title = added ? 'პლეილისტიდან წაშლა' : 'პლეილისტში დამატება';
          showToast(added ? 'პლეილისტში დაემატა ✓' : 'პლეილისტიდან წაიშალა');
        });
      }

      // Like button
      const likeBtn = document.getElementById('track-like-btn');
      if (likeBtn) {
        likeBtn.addEventListener('click', () => {
          const nowLiked = toggleLike(track.id);
          const heartIcon = likeBtn.querySelector('.heart-icon');
          const countSpan = likeBtn.querySelector('.like-count');
          const newCount = getLikeCount(track.id);
          if (nowLiked) {
            heartIcon.classList.add('liked');
            likeBtn.classList.add('liked-animation');
            setTimeout(() => likeBtn.classList.remove('liked-animation'), 600);
          } else {
            heartIcon.classList.remove('liked');
          }
          countSpan.textContent = newCount > 0 ? newCount : '';
          updateStats();
        });
      }

      // Download button
      const dlBtn = document.getElementById('track-dl-btn');
      if (dlBtn && streamUrl) {
        dlBtn.addEventListener('click', async () => {
          if (!downloadAllowed) {
            openContactModal();
            return;
          }
          const origHTML = dlBtn.innerHTML;
          let sec = 0;
          dlBtn.textContent = '0s…';
          dlBtn.disabled = true;
          const timer = setInterval(() => { sec++; dlBtn.textContent = sec + 's…'; }, 1000);
          let fname = 'track.mp3';
          try { fname = decodeURIComponent(new URL(streamUrl).pathname.split('/').pop()) || fname; } catch (e) {}
          await triggerDownload(streamUrl, fname);
          clearInterval(timer);
          dlBtn.innerHTML = origHTML;
          dlBtn.disabled = false;
        });
      }

      // Share button
      const shareBtn = document.getElementById('track-share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', () => handleShare(track));
      }

      // Firebase real-time listeners
      firebase.database().ref('likes/' + track.id).on('value', (snap) => {
        firebaseLikeCounts[track.id] = snap.val() || 0;
        updateStats();
      });
      firebase.database().ref('plays/' + track.id).on('value', (snap) => {
        playCounts[track.id] = snap.val() || 0;
        updateStats();
      });

    } catch (e) {
      console.error(e);
      container.innerHTML = '<div class="track-page-not-found">შეცდომა ჩატვირთვისას</div>';
    }
  }

  // ════════════════════════════════
  //  Modal event listeners
  // ════════════════════════════════
  (function setupModalListeners() {
    const contactModalClose = document.getElementById('contact-modal-close');
    const contactCancel = document.getElementById('contact-cancel');
    const contactModal = document.getElementById('contact-modal');
    const contactForm = document.getElementById('contact-form');

    if (contactModalClose) contactModalClose.addEventListener('click', closeContactModal);
    if (contactCancel) contactCancel.addEventListener('click', closeContactModal);
    if (contactModal) {
      contactModal.addEventListener('click', (e) => { if (e.target === contactModal) closeContactModal(); });
    }
    if (contactForm) {
      contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('contact-submit');
        const contactStatus = document.getElementById('contact-status');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'იგზავნება...'; }
        if (contactStatus) contactStatus.className = 'contact-status hidden';
        try {
          const response = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            body: new FormData(contactForm)
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
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'გაგზავნა'; }
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const cm = document.getElementById('contact-modal');
        if (cm && !cm.classList.contains('hidden')) closeContactModal();
      }
    });
  })();

  // Init
  checkDownloadAccess();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();