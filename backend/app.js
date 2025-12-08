const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

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
app.use(cookieParser());

// Multer setup for local uploads
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

// Streaming route with Range support for local uploads
app.get('/media/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
  const contentType = 'audio/' + path.extname(filePath).slice(1) || 'audio/mpeg';

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (start >= fileSize) {
      res.status(416).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
      return;
    }
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// Helper to add downloadUrl
function enhanceTrack(t) {
  let downloadUrl = null;
  if (t.audioUrl) {
    downloadUrl = t.audioUrl;
  } else if (t.filename) {
    downloadUrl = '/uploads/' + t.filename;
  }
  return { ...t, downloadUrl };
}

// API: List tracks
app.get('/api/tracks', (req, res) => {
  res.json(db.tracks.map(enhanceTrack));
});

// API: Get single track
app.get('/api/tracks/:id', (req, res) => {
  const t = db.tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  res.json(enhanceTrack(t));
});

// API: Like track
app.post('/api/tracks/:id/like', (req, res) => {
  const t = db.tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });
  t.likes = (t.likes || 0) + 1;
  saveDB();
  res.json({ likes: t.likes });
});

// Helper: check admin via JWT cookie
function checkAdmin(req, res, next) {
  const token = req.cookies && req.cookies.admin_token;
  if (!token) return res.status(401).json({ error: 'unauthorized' });
  try {
    const secret = process.env.SESSION_SECRET || 'change_this_secret';
    const payload = jwt.verify(token, secret);
    if (payload && payload.admin) return next();
    return res.status(401).json({ error: 'unauthorized' });
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized' });
  }
}

// Admin login (creates signed cookie)
app.post('/api/admin/login', (req, res) => {
  const pass = req.body.password || '';
  const ADMIN_PASS = process.env.ADMIN_PASS || '230470';
  if (pass === ADMIN_PASS) {
    const secret = process.env.SESSION_SECRET || 'change_this_secret';
    const token = jwt.sign({ admin: true }, secret, { expiresIn: '7d' });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('admin_token', token, { httpOnly: true, sameSite: 'lax', secure: isProd });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'invalid' });
  }
});

// Admin logout
app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ ok: true });
});

/*
  Create track (local upload)
*/
app.post('/api/tracks', checkAdmin, upload.fields([{ name: 'audio' }, { name: 'cover' }]), (req, res) => {
  const { title = 'Untitled', artist = '', lyrics = '', album = '' } = req.body;
  const audioFile = req.files['audio'] && req.files['audio'][0];
  if (!audioFile) return res.status(400).json({ error: 'audio required' });
  const coverFile = req.files['cover'] && req.files['cover'][0];

  let albumId = null;
  if (album) {
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
    audioUrl: null,
    cover: coverFile ? coverFile.filename : null,
    coverUrl: null,
    lyrics,
    albumId,
    likes: 0,
    createdAt: new Date().toISOString()
  };
  db.tracks.push(track);
  saveDB();
  res.json(enhanceTrack(track));
});

/*
  Create track (external URLs / JSON)
*/
app.post('/api/tracks/json', checkAdmin, (req, res) => {
  const { title = 'Untitled', artist = '', lyrics = '', album = '', audioUrl = '', coverUrl = '' } = req.body;
  if (!audioUrl) return res.status(400).json({ error: 'audioUrl required' });

  let albumId = null;
  if (album) {
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
    filename: null,
    originalName: null,
    audioUrl,
    cover: null,
    coverUrl: coverUrl || null,
    lyrics,
    albumId,
    likes: 0,
    createdAt: new Date().toISOString()
  };
  db.tracks.push(track);
  saveDB();
  res.json(enhanceTrack(track));
});

// Update track (local upload)
app.put('/api/tracks/:id', checkAdmin, upload.fields([{ name:
