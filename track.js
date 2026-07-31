(function() {
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

      const streamUrl = getStreamUrl(track);
      const coverUrl = getCoverUrl(track);
      const albumName = getAlbumName(albums, track.albumId);

      let html = '<div class="track-page-card">' +
        '<img class="track-page-cover" src="' + coverUrl + '" alt="' + safeStr(track.title) + '">' +
        '<div class="track-page-title">' + safeStr(track.title) + '</div>';

      if (track.artist) html += '<div class="track-page-artist">' + safeStr(track.artist) + '</div>';
      if (albumName)    html += '<div class="track-page-album">' + safeStr(albumName) + '</div>';
      if (streamUrl)    html += '<audio class="track-page-audio" controls preload="metadata" src="' + streamUrl + '"></audio>';
      if (track.lyrics && track.lyrics.trim()) {
        html += '<div class="track-page-lyrics-label">ტექსტი</div>' +
                '<pre class="track-page-lyrics">' + safeStr(track.lyrics) + '</pre>';
      }
      html += '<a href="index.html" class="track-page-back">← მთავარზე დაბრუნება</a></div>';

      container.innerHTML = html;
    } catch (e) {
      console.error(e);
      container.innerHTML = '<div class="track-page-not-found">შეცდომა ჩატვირთვისას</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();