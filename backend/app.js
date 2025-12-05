const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const mime = require('mime-types');

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

// Multer setup for local uploads (temp storage)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    // keep original name on disk to preserve for archive upload
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// Configure S3 client for Internet Archive if keys are present (v3)
let s3client = null;
if (process.env.IA_ACCESS_KEY && process.env.IA_SECRET_KEY) {
  s3client = new S3Client({
    endpoint: 'https://s3.us.archive.org',
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.IA_ACCESS_KEY,
      secretAccessKey: process.env.IA_SECRET_KEY
    }
  });
}

// Serve uploaded files (local uploads)
app.use('/uploads', express.static(UPLOADS_DIR));

// Serve frontend static
app.use('/', express.static(path.join(__dirname, '..', 'frontend')));

// Legacy local streaming route (unchanged)
app.get('/media/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).end();

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;
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
  const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';
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

/* Existing local upload route (unchanged) */
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
  res.json(track);
});

/*
  New route: upload files to archive.org (S3 v3) and create track with external URLs.
  Expects multipart/form-data with possible files 'audio' and 'cover', and fields:
    title, artist, lyrics, album, archiveIdentifier (required), optional audioFilename/coverFilename to override names.
*/
app.post('/api/upload-archive', checkAdmin, upload.fields([{ name: 'audio' }, { name: 'cover' }]), async (req, res) => {
  if (!s3client) return res.status(500).json({ error: 'Archive.org keys not configured on server' });

  const { title = 'Untitled', artist = '', lyrics = '', album = '', archiveIdentifier = '' } = req.body;
  if (!archiveIdentifier) return res.status(400).json({ error: 'archiveIdentifier required' });

  const audioFile = req.files['audio'] && req.files['audio'][0];
  const coverFile = req.files['cover'] && req.files['cover'][0];
  if (!audioFile) return res.status(400).json({ error: 'audio required' });

  // Decide keys (use original file names or optional override)
  const audioKey = (req.body.audioFilename && req.body.audioFilename.trim()) ? req.body.audioFilename.trim() : audioFile.originalname;
  const coverKey = coverFile ? ((req.body.coverFilename && req.body.coverFilename.trim()) ? req.body.coverFilename.trim() : coverFile.originalname) : null;

  try {
    // Upload audio using @aws-sdk/lib-storage Upload (supports multipart)
    const audioStream = fs.createReadStream(audioFile.path);
    const audioContentType = mime.lookup(audioFile.originalname) || 'application/octet-stream';
    const audioUpload = new Upload({
      client: s3client,
      params: {
        Bucket: archiveIdentifier,
        Key: audioKey,
        Body: audioStream,
        ContentType: audioContentType,
        ACL: 'public-read'
      }
    });
    await audioUpload.done();

    // Upload cover if present
    if (coverFile) {
      const coverStream = fs.createReadStream(coverFile.path);
      const coverContentType = mime.lookup(coverFile.originalname) || 'application/octet-stream';
      const coverUpload = new Upload({
        client: s3client,
        params: {
          Bucket: archiveIdentifier,
          Key: coverKey,
          Body: coverStream,
          ContentType: coverContentType,
          ACL: 'public-read'
        }
      });
      await coverUpload.done();
    }

    // Build archive URLs
    const audioUrl = `https://archive.org/download/${archiveIdentifier}/${encodeURIComponent(audioKey)}`;
    const coverUrl = coverKey ? `https://archive.org/download/${archiveIdentifier}/${encodeURIComponent(coverKey)}` : null;

    // Create album if needed
    let albumId = null;
    if (album) {
      let a = db.albums.find(x => x.name === album);
      if (!a) {
        a = { id: uuidv4(), name: album };
        db.albums.push(a);
      }
      albumId = a.id;
    }

    // Create track entry with external URLs
    const track = {
      id: uuidv4(),
      title,
      artist,
      filename: null,
      originalName: null,
      audioUrl,
      cover: null,
      coverUrl,
      lyrics,
      albumId,
      likes: 0,
      createdAt: new Date().toISOString()
    };
    db.tracks.push(track);
    saveDB();

    // Clean up local temp files
    try { fs.unlinkSync(audioFile.path); } catch(e) { /* ignore */ }
    if (coverFile) try { fs.unlinkSync(coverFile.path); } catch(e) { /* ignore */ }

    res.json({ ok: true, track });
  } catch (err) {
    console.error('upload-archive error', err);
    res.status(500).json({ error: 'upload failed', details: err.message || String(err) });
  }
});

// Existing JSON and update routes (unchanged) ...
// Create track via JSON (external URL)
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
  res.json(track);
});

// Update routes (existing) ...
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
    t.filename = audioFile.filename;
    t.originalName = audioFile.originalname;
    t.audioUrl = null;
  }
  if (coverFile) {
    t.cover = coverFile.filename;
    t.coverUrl = null;
  }

  saveDB();
  res.json(t);
});

app.put('/api/tracks/:id/json', checkAdmin, (req, res) => {
  const t = db.tracks.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'not found' });

  const { title, artist, lyrics, album, audioUrl, coverUrl } = req.body;
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

  if (audioUrl) {
    t.audioUrl = audioUrl;
    t.filename = null;
    t.originalName = null;
  }
  if (coverUrl) {
    t.coverUrl = coverUrl;
    t.cover = null;
  }

  saveDB();
  res.json(t);
});

// Delete track (admin)
app.delete('/api/tracks/:id', checkAdmin, (req, res) => {
  const idx = db.tracks.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not found' });
  const [removed] = db.tracks.splice(idx, 1);
  saveDB();
  res.json({ ok: true, removed });
});

// Albums and album routes (unchanged)
app.get('/api/albums', (req, res) => {
  res.json(db.albums);
});
app.put('/api/albums/:id', checkAdmin, (req, res) => {
  const a = db.albums.find(x => x.id === req.params.id);
  if (!a) return res.status(404).json({ error: 'not found' });
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  a.name = name;
  saveDB();
  res.json(a);
});
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
