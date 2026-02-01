// node.js — lightweight static server for Render (Express)
// Save as server.js in project root and set "start": "node server.js" in package.json

const express = require('express');
const path = require('path');
const fs = require('fs');
const compression = require('compression');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '.');

// Security & performance
app.use(helmet());
app.use(compression());

// Simple request logger (short)
app.use((req, res, next) => {
  const now = new Date().toISOString();
  console.log(`[${now}] ${req.method} ${req.url}`);
  next();
});

// Serve static assets with sensible caching
app.use(express.static(PUBLIC_DIR, {
  index: false,
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    // Ensure JSON and HTML are not aggressively cached
    if (filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// CORS for external audio fetches (if you use fetch() in client)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // adjust if you need stricter policy
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Range request handler for local media files (supports streaming/resume)
app.get('/media/*', (req, res) => {
  const filePath = path.join(PUBLIC_DIR, req.path);
  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  const stat = fs.statSync(filePath);
  const total = stat.size;
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      'Content-Length': total,
      'Content-Type': getMimeType(filePath),
      'Accept-Ranges': 'bytes'
    });
    fs.createReadStream(filePath).pipe(res);
    return;
  }

  const parts = range.replace(/bytes=/, '').split('-');
  const start = parseInt(parts[0], 10);
  const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
  if (isNaN(start) || isNaN(end) || start > end || end >= total) {
    res.status(416).set('Content-Range', `bytes */${total}`).end();
    return;
  }

  const chunkSize = (end - start) + 1;
  const stream = fs.createReadStream(filePath, { start, end });
  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${total}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunkSize,
    'Content-Type': getMimeType(filePath)
  });
  stream.pipe(res);
});

// Serve tracks.json explicitly with no-cache header
app.get('/tracks.json', (req, res) => {
  const file = path.join(PUBLIC_DIR, 'tracks.json');
  if (!fs.existsSync(file)) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  fs.createReadStream(file).pipe(res);
});

// Fallback to index.html for SPA / direct navigation
app.get('*', (req, res) => {
  const indexPath = path.join(PUBLIC_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Not found');
  }
});

// Helper: minimal mime types
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.m4a': return 'audio/mp4';
    case '.json': return 'application/json';
    case '.html': return 'text/html; charset=utf-8';
    case '.css': return 'text/css; charset=utf-8';
    case '.js': return 'application/javascript; charset=utf-8';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.svg': return 'image/svg+xml';
    default: return 'application/octet-stream';
  }
}

// Start server
app.listen(PORT, () => {
  console.log(`Cube Cubic server listening on port ${PORT}`);
});
