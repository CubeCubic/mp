#!/usr/bin/env node
// Generates static per-track preview pages into t/<id>.html.
//
// Why this exists: cubecubic.github.io is plain static hosting (GitHub Pages),
// so it cannot generate different Open Graph meta tags per request based on a
// ?id= query string — the same track.html bytes are always served, and social
// media crawlers (Facebook, Twitter, etc.) never run our client-side JS, so
// they only ever see track.html's static placeholder title.
//
// The fix: for every track, pre-generate a tiny standalone HTML file with the
// correct og:title / og:image / og:url for THAT track, plus an instant
// redirect to the real, interactive track.html?id=<id> page. Crawlers read
// the static tags; real visitors get redirected straight through.
//
// Run manually:  node scripts/generate-share-pages.js
// Run automatically: see .github/workflows/generate-share-pages.yml

const fs = require('fs');
const path = require('path');

const DB_URL = 'https://cube-cubic-default-rtdb.firebaseio.com';
const SITE_URL = 'https://cubecubic.github.io/mp/';
const OUT_DIR = path.join(__dirname, '..', 't');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCoverUrl(t) {
  if (t.coverUrl) return t.coverUrl;
  if (t.cover) return SITE_URL + 'uploads/' + t.cover;
  return SITE_URL + 'images/midcube.png';
}

function getAlbumName(albums, albumId) {
  if (!albumId || !albums) return '';
  const a = albums.find(x => x && String(x.id) === String(albumId));
  return a ? (a.name || '') : '';
}

function pageHtml(track, albumName) {
  const title = track.title || 'Cubic';
  const artist = track.artist || '';
  const description = artist
    ? (artist + (albumName ? ' · ' + albumName : ''))
    : (albumName || 'Cubic — მუსიკალური პლატფორმა');
  const cover = getCoverUrl(track);
  const pageUrl = SITE_URL + 't/' + track.id + '.html';
  const targetUrl = SITE_URL + 'track.html?id=' + encodeURIComponent(track.id);

  return `<!doctype html>
<html lang="ka">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} — Cubic</title>
<meta property="og:type" content="music.song">
<meta property="og:site_name" content="Cubic">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(cover)}">
<meta property="og:url" content="${esc(pageUrl)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(cover)}">
<meta http-equiv="refresh" content="0; url=${esc(targetUrl)}">
<script>location.replace(${JSON.stringify(targetUrl)});</script>
</head>
<body>
<p><a href="${esc(targetUrl)}">${esc(title)}${artist ? ' — ' + esc(artist) : ''} — Cubic</a></p>
</body>
</html>
`;
}

async function main() {
  const [tracksRes, albumsRes] = await Promise.all([
    fetch(DB_URL + '/tracks.json'),
    fetch(DB_URL + '/albums.json')
  ]);
  if (!tracksRes.ok) throw new Error('Failed to fetch tracks.json: ' + tracksRes.status);
  const tracks = (await tracksRes.json()) || [];
  const albums = albumsRes.ok ? ((await albumsRes.json()) || []) : [];

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const validFiles = new Set();
  let written = 0;
  for (const t of tracks) {
    if (!t || t.id == null || t.hidden) continue;
    const fileName = t.id + '.html';
    validFiles.add(fileName);
    const html = pageHtml(t, getAlbumName(albums, t.albumId));
    fs.writeFileSync(path.join(OUT_DIR, fileName), html, 'utf8');
    written++;
  }

  // Clean up pages for tracks that were deleted or hidden since the last run
  let removed = 0;
  for (const name of fs.readdirSync(OUT_DIR)) {
    if (name.endsWith('.html') && !validFiles.has(name)) {
      fs.unlinkSync(path.join(OUT_DIR, name));
      removed++;
    }
  }

  console.log(`Generated ${written} track preview page(s), removed ${removed} stale page(s).`);
}

main().catch(err => {
  console.error('Failed to generate share pages:', err);
  process.exit(1);
});
