const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'tracks.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Load or init data
let db = { tracks: [], albums: [] };
try {
  db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (err) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple session-based admin auth
app.use(session({
  secret: process.env.SESSION_SECRET || 'change_this_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // In production on https set true
}));

function checkAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

// Multer setup for uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage });

// Serve uploaded files (public)
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve frontend static
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

// Streaming route with Range support
app.get('/media/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  if (range) {
    // Parse range
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    const contentType = 'audio/' + path.extname(filePath).slice(1);
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    const contentType = 'audio/' + path.extname(filePath).slice(1);
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// API: List tracks
app.get('/api/tracks', (req, res) => {
  res.json(db.tracks);
});

// API: Get single track
app.get('/api/tracks/:id', (req, res) => {
  const t = db.tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(t);
});

// API: Like track
app.post('/api/tracks/:id/like', (req, res) => {
  const t = db.tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  t.likes = (t.likes || 0) + 1;
  saveDB();
  res.json({ likes: t.likes });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const pass = req.body.password || '';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';
  if (pass === ADMIN_PASS) {
    req.session.admin = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'invalid' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Create track (admin)
app.post('/api/tracks', checkAdmin, upload.fields([{ name: 'audio' }, { name: 'cover' }]), (req, res) => {
  const { title = 'Untitled', artist = '', lyrics = '', album = '' } = req.body;
  const audioFile = req.files['audio'] && req.files['audio'][0];
  if (!audioFile) return res.status(400).json({ error: 'audio required' });
  const coverFile = req.files['cover'] && req.files['cover'][0];

  let albumId = null;
  if (album) {
    // find or create album
    let a = db.albums.find(x => x.name === album);
    if (!a) {
      a = { id: uuidv4(), name: album };
      db.albums.push(a);
    }
    albumId = a.id;
  }

  const track = {
    id: uuidv4(),
    title,
    artist,
    filename: audioFile.filename,
    originalName: audioFile.originalname,
    cover: coverFile ? coverFile.filename : null,
    lyrics,
    albumId,
    likes: 0,
    createdAt: new Date().toISOString()
  };
  db.tracks.push(track);
  saveDB();
  res.json(track);
});

// Update track (admin)
app.put('/api/tracks/:id', checkAdmin, upload.fields([{ name: 'audio' }, { name: 'cover' }]), (req, res) => {
  const t = db.tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });

  const { title, artist, lyrics, album } = req.body;
  if (title) t.title = title;
  if (artist) t.artist = artist;
  if (lyrics) t.lyrics = lyrics;

  if (album !== undefined) {
    if (album === '') t.albumId = null;
    else {
      let a = db.albums.find(x => x.name === album);
      if (!a) {
        a = { id: uuidv4(), name: album };
        db.albums.push(a);
      }
      t.albumId = a.id;
    }
  }

  const audioFile = req.files['audio'] && req.files['audio'][0];
  const coverFile = req.files['cover'] && req.files['cover'][0];
  if (audioFile) {
    // Optionally delete old audio file (not enforced)
    t.filename = audioFile.filename;
    t.originalName = audioFile.originalname;
  }
  if (coverFile) {
    t.cover = coverFile.filename;
  }

  saveDB();
  res.json(t);
});

// Delete track (admin)
app.delete('/api/tracks/:id', checkAdmin, (req, res) => {
  const idx = db.tracks.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const [removed] = db.tracks.splice(idx, 1);
  // Note: files remain on disk; you can delete them manually if you want
  saveDB();
  res.json({ ok: true, removed });
});

// Albums list
app.get('/api/albums', (req, res) => {
  res.json(db.albums);
});

// Update album name (admin)
app.put('/api/albums/:id', checkAdmin, (req, res) => {
  const a = db.albums.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  a.name = name;
  saveDB();
  res.json(a);
});

// Delete album (admin) — does not delete tracks, only clears albumId from tracks
app.delete('/api/albums/:id', checkAdmin, (req, res) => {
  const idx = db.albums.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const [removed] = db.albums.splice(idx, 1);
  db.tracks.forEach(t => { if (t.albumId === removed.id) t.albumId = null; });
  saveDB();
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server started on port ${PORT}`);
});
