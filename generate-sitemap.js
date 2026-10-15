// generate-sitemap.js
// Usage:  node generate-sitemap.js
// Reads visible tracks from Firebase RTDB (public read, same as the site) and
// writes sitemap.xml with the home page + one URL per track page.
// Requires Node >= 18 (built-in fetch).

const fs = require('fs');
const path = require('path');

const DB_URL = 'https://cube-cubic-default-rtdb.firebaseio.com';
const SITE = 'https://cubecubic.github.io/mp/';

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

(async () => {
  const res = await fetch(`${DB_URL}/tracks.json`);
  if (!res.ok) throw new Error(`Firebase responded ${res.status}`);
  const data = await res.json();
  // RTDB returns either an array or an object keyed by index
  const list = Array.isArray(data) ? data : Object.values(data || {});
  const tracks = list.filter(t => t && t.id && !t.hidden);

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: SITE, changefreq: 'weekly', priority: '1.0' },
    ...tracks.map(t => ({
      loc: `${SITE}track.html?id=${encodeURIComponent(t.id)}`,
      changefreq: 'monthly',
      priority: '0.6'
    }))
  ];

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u =>
      '  <url>\n' +
      `    <loc>${esc(u.loc)}</loc>\n` +
      `    <lastmod>${today}</lastmod>\n` +
      `    <changefreq>${u.changefreq}</changefreq>\n` +
      `    <priority>${u.priority}</priority>\n` +
      '  </url>\n'
    ).join('') +
    '</urlset>\n';

  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml, 'utf8');
  console.log(`sitemap.xml written: ${urls.length} URLs (${tracks.length} tracks)`);
})().catch(e => { console.error(e); process.exit(1); });
