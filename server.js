/**
 * Simple File Sharing Server v2.0
 * Modernized with Express.js
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
require('dotenv').config();
const { createStorage } = require('./storage');
const meta = require('./metadata');
const storageBackend = createStorage();

const app = express();
const PORT = process.env.PORT || 3000;
const FILES_DIR = path.resolve(process.env.FILES_DIR || path.join(__dirname, 'files'));
const FILES_DIR_RESOLVED = path.resolve(FILES_DIR);
function parseUsers() {
  const map = new Map();
  if (process.env.AUTH_USERS) {
    process.env.AUTH_USERS.split(',').forEach((entry) => {
      const idx = entry.indexOf(':');
      if (idx > 0) map.set(entry.slice(0, idx).trim(), entry.slice(idx + 1));
    });
  } else {
    map.set(process.env.AUTH_USER || 'admin', process.env.AUTH_PASS || 'changeme');
  }
  if (map.size === 0) map.set('admin', 'changeme');
  return map;
}
const USERS = parseUsers();
const FIRST_USER = [...USERS.keys()][0];
const FIRST_PASS = USERS.get(FIRST_USER);

const BLOCKED_EXTENSIONS = (process.env.BLOCKED_EXTENSIONS || '.exe,.bat,.sh,.cmd,.msi,.scr,.com,.pif,.dll')
  .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const ALLOWED_EXTENSIONS = (process.env.ALLOWED_EXTENSIONS || '')
  .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
const MAX_STORAGE_BYTES = (Number(process.env.MAX_STORAGE_MB) || 0) * 1024 * 1024;
const SHARE_DEFAULT_HOURS = Number(process.env.SHARE_DEFAULT_HOURS) || 24;

function isAllowedUploadName(name) {
  const ext = path.extname(name || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.length) return ALLOWED_EXTENSIONS.includes(ext);
  return !BLOCKED_EXTENSIONS.includes(ext);
}

if (USERS.size === 1 && FIRST_USER === 'admin' && FIRST_PASS === 'changeme') {
  console.warn('WARNING: using default credentials (admin/changeme). Set AUTH_USERS or AUTH_USER/AUTH_PASS in production.');
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to start with default credentials in production.');
    process.exit(1);
  }
}

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Trust proxy (set TRUST_PROXY=1 or a trusted subnet when behind a reverse proxy)
if (process.env.TRUST_PROXY) {
  const raw = process.env.TRUST_PROXY;
  app.set('trust proxy', /^\d+$/.test(raw) ? Number(raw) : raw);
}

// Security headers
app.use(helmet({
  frameguard: { action: 'deny' },
  hsts: process.env.COOKIE_SECURE === 'true' ? undefined : false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const c = parseBasicAuth(req.headers.authorization);
    return (c && USERS.has(c.username)) ? `user:${c.username}` : req.ip;
  },
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Parse form data
app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 1000 }));

// Constant-time string comparison
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Parse Basic Auth credentials
function parseBasicAuth(header) {
  if (typeof header !== 'string' || !header.startsWith('Basic ')) return null;
  let decoded;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch (e) {
    return null;
  }
  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) return null;
  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

// Basic Auth middleware
function basicAuth(req, res, next) {
  const credentials = parseBasicAuth(req.headers.authorization);
  if (!credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="File Server"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (USERS.has(credentials.username) && safeEqual(credentials.password, USERS.get(credentials.username))) {
    req.user = credentials.username;
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="File Server"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Multer config
const uploadStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FILES_DIR),
  filename: (req, file, cb) => {
    const safeName = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
    if (safeName === '.' || safeName === '..') {
      const unique = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      return cb(null, `file_${unique}`);
    }
    const filePath = path.join(FILES_DIR, safeName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(safeName);
      const base = path.basename(safeName, ext);
      const unique = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      cb(null, `${base}_${unique}${ext}`);
    } else {
      cb(null, safeName);
    }
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/[\\/]/.test(file.originalname || '')) return cb(new Error('Invalid filename'));
    if (!isAllowedUploadName(file.originalname || '')) return cb(new Error('File type not allowed'));
    cb(null, true);
  },
});

// Helpers
function sanitizeFilename(filename) {
  if (typeof filename !== 'string') return '';
  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!sanitized || sanitized === '.' || sanitized === '..') return '';
  return sanitized;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function parseCookies(header) {
  const cookies = {};
  if (typeof header !== 'string') return cookies;
  header.split(';').forEach(part => {
    const trimmed = part.trim();
    if (!trimmed) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex < 0) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1);
    if (key) {
      try { cookies[key] = decodeURIComponent(value); }
      catch (e) { cookies[key] = value; }
    }
  });
  return cookies;
}

function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('hex');
  const secureFlag = process.env.COOKIE_SECURE === 'true' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `csrf_token=${token}; Path=/; SameSite=Strict; HttpOnly=false${secureFlag}`);
  return token;
}

// Health / readiness (unauthenticated)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', version: '2.3.0', uptime: process.uptime() });
});

app.get('/ready', async (req, res) => {
  try {
    await fs.promises.access(FILES_DIR, fs.constants.W_OK);
    res.json({ status: 'ready' });
  } catch (e) {
    res.status(503).json({ status: 'not-ready' });
  }
});

// GET /
app.get('/', basicAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const entries = (await fs.promises.readdir(FILES_DIR))
      .filter((f) => !f.startsWith('.'))
      .filter((f) => !search || f.toLowerCase().includes(search));
    const items = await Promise.all(entries.map(async (file) => {
      try {
        const stats = await fs.promises.stat(path.join(FILES_DIR, file));
        return {
          name: file,
          size: stats.size,
          sizeFormatted: formatSize(stats.size),
          modified: stats.mtime,
        };
      } catch (e) {
        return null;
      }
    }));
    const fileList = items.filter(Boolean).sort((a, b) => b.modified - a.modified);
    const csrfToken = issueCsrfToken(res);

    const html = `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>File Server</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
            .container { max-width: 900px; margin: 0 auto; }
            h1 { color: #333; margin-bottom: 20px; text-align: center; }
            .upload-area { background: #fff; border: 2px dashed #ccc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px; }
            .upload-area:hover { border-color: #4CAF50; }
            .upload-btn { background: #4CAF50; color: #fff; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; }
            .upload-btn:hover { background: #45a049; }
            table { width: 100%; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
            th { background: #4CAF50; color: white; padding: 12px; text-align: left; }
            td { padding: 12px; border-bottom: 1px solid #eee; }
            tr:hover { background: #f9f9f9; }
            a { color: #4CAF50; text-decoration: none; font-weight: 500; }
            a:hover { text-decoration: underline; }
            .empty { text-align: center; padding: 40px; color: #999; }
            @media (max-width: 600px) { .hide-mobile { display: none; } }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>📁 File Server</h1>

            <form method="GET" action="/" style="margin-bottom:12px;text-align:center;">
              <input type="text" name="search" placeholder="Search files" value="${escapeHtml(req.query && req.query.search ? req.query.search : '')}" style="padding:6px;width:60%;">
              <button type="submit" class="upload-btn">Search</button>
            </form>

            <div class="upload-area" id="dropzone">
              <form id="uploadForm" action="/upload" method="POST" enctype="multipart/form-data">
                <input type="hidden" name="_csrf" value="${csrfToken}">
                <input type="file" name="file" id="fileInput" required>
                <br>
                <button type="submit" class="upload-btn" style="margin-top:8px;">Upload File</button>
              </form>
              <div id="progressWrap" style="display:none;margin-top:8px;">
                <progress id="progress" value="0" max="100" style="width:80%;"></progress>
                <span id="progressText">0%</span>
              </div>
              <p style="margin-top:8px;color:#666;font-size:12px;">Drag and drop files here</p>
            </div>

            ${fileList.length === 0 ? '<div class="empty">No files yet. Upload something!</div>' : `
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Size</th>
                  <th class="hide-mobile">Modified</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${fileList.map(f => `
                <tr>
                  <td>${escapeHtml(f.name)}</td>
                  <td>${f.sizeFormatted}</td>
                  <td class="hide-mobile">${escapeHtml(f.modified.toLocaleString())}</td>
                  <td>
                    <a href="/download/${encodeURIComponent(f.name)}">Download</a> |
                    <a href="/preview/${encodeURIComponent(f.name)}" target="_blank">Preview</a>
                    <form action="/delete/${encodeURIComponent(f.name)}" method="POST" style="display:inline;" onsubmit="return confirm('Delete this file?');">
                      <input type="hidden" name="_csrf" value="${csrfToken}">
                      <button type="submit" style="background:none;border:none;color:#c00;cursor:pointer;">Delete</button>
                    </form>
                    <details style="margin-top:4px;">
                      <summary>Rename</summary>
                      <form action="/rename/${encodeURIComponent(f.name)}" method="POST" style="margin-top:4px;">
                        <input type="text" name="newname" placeholder="New name" required style="width:120px;">
                        <input type="hidden" name="_csrf" value="${csrfToken}">
                        <button type="submit">OK</button>
                      </form>
                    </details>
                    <details style="margin-top:4px;">
                      <summary>Share</summary>
                      <form action="/share/${encodeURIComponent(f.name)}" method="POST" style="margin-top:4px;" class="share-form">
                        <input type="number" name="expires" value="24" min="1" style="width:60px;" title="hours">
                        <input type="password" name="password" placeholder="password (optional)" style="width:120px;">
                        <input type="hidden" name="_csrf" value="${csrfToken}">
                        <button type="submit">Link</button>
                      </form>
                      <div class="share-result" style="font-size:12px;margin-top:4px;word-break:break-all;"></div>
                    </details>
                  </td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>
        <script src="/app.js"></script>
        </body>
      </html>`;

    res.type('html').send(html);
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).send('Internal server error');
  }
});

// POST /upload
app.post('/upload', basicAuth, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (MAX_STORAGE_BYTES > 0 && (await storageBackend.totalSize()) > MAX_STORAGE_BYTES) {
    fs.unlink(req.file.path, () => {});
    return res.status(507).json({ error: 'Storage quota exceeded' });
  }

  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies.csrf_token;
  const submitted = req.body && req.body._csrf;
  if (typeof csrfCookie !== 'string' || typeof submitted !== 'string' || !safeEqual(csrfCookie, submitted)) {
    fs.unlink(req.file.path, () => {});
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  try {
    const checksum = await meta.sha256File(req.file.path);
    await meta.setFile(req.file.filename, {
      checksumSha256: checksum,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
      owner: req.user,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') console.error(e);
  }

  res.redirect('/');
});


// POST /rename/:filename — rename a shared file
app.post('/rename/:filename', basicAuth, async (req, res) => {
  const oldName = sanitizeFilename(req.params.filename);
  const newName = sanitizeFilename((req.body && req.body.newname) || '');
  if (!oldName || !newName) return res.status(400).json({ error: 'Invalid filename' });

  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies.csrf_token;
  const submitted = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  if (typeof csrfCookie !== 'string' || typeof submitted !== 'string' || !safeEqual(csrfCookie, submitted)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  if (!isAllowedUploadName(newName)) return res.status(400).json({ error: 'File type not allowed' });
  if (oldName === newName) return res.json({ success: true, renamed: oldName });

  const oldPath = path.resolve(FILES_DIR_RESOLVED, oldName);
  const newPath = path.resolve(FILES_DIR_RESOLVED, newName);
  if (!oldPath.startsWith(FILES_DIR_RESOLVED + path.sep) || !newPath.startsWith(FILES_DIR_RESOLVED + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await fs.promises.access(newPath);
    return res.status(409).json({ error: 'Target filename already exists' });
  } catch (e) {
    // expected when target does not exist
  }

  try {
    const realOld = await fs.promises.realpath(oldPath);
    if (!realOld.startsWith(FILES_DIR_RESOLVED + path.sep)) return res.status(403).json({ error: 'Access denied' });
    await fs.promises.rename(realOld, newPath);
    await meta.renameFile(oldName, newName);
    if (req.get('Accept') && req.get('Accept').includes('text/html')) return res.redirect('/');
    res.json({ success: true, from: oldName, to: newName });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    if (process.env.NODE_ENV !== 'production') console.error(e);
    res.status(500).json({ error: 'Rename failed' });
  }
});

// GET /preview/:filename — inline preview (authenticated)
app.get('/preview/:filename', basicAuth, async (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) return res.status(400).json({ error: 'Invalid filename' });
  const filePath = path.resolve(FILES_DIR_RESOLVED, filename);
  if (!filePath.startsWith(FILES_DIR_RESOLVED + path.sep)) return res.status(403).json({ error: 'Access denied' });
  try {
    const realPath = await fs.promises.realpath(filePath);
    if (!realPath.startsWith(FILES_DIR_RESOLVED + path.sep)) return res.status(403).json({ error: 'Access denied' });
    res.set('Cache-Control', 'private, max-age=300');
    res.set('Content-Disposition', `inline; filename="${filename}"`);
    res.sendFile(realPath);
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    res.status(500).json({ error: 'Preview failed' });
  }
});

// POST /share/:filename — create an expiring public download link
app.post('/share/:filename', basicAuth, async (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) return res.status(400).json({ error: 'Invalid filename' });

  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies.csrf_token;
  const submitted = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  if (typeof csrfCookie !== 'string' || typeof submitted !== 'string' || !safeEqual(csrfCookie, submitted)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  const expires = Number((req.body && req.body.expires) || SHARE_DEFAULT_HOURS);
  const password = (req.body && req.body.password) || null;
  try {
    await fs.promises.access(path.resolve(FILES_DIR_RESOLVED, filename));
  } catch (e) {
    return res.status(404).json({ error: 'File not found' });
  }
  const token = await meta.createShareToken(filename, expires, password);
  res.json({ token, url: `/share/${token}`, expiresInHours: expires });
});

// GET /share/:token — public download via expiring token
app.get('/share/:token', async (req, res) => {
  const rec = await meta.getShare(req.params.token);
  if (!rec) return res.status(404).json({ error: 'Link expired or not found' });

  const filename = sanitizeFilename(rec.file);
  if (!filename) return res.status(404).json({ error: 'File not found' });
  if (rec.passwordHash) {
    const provided = req.query.password || req.get('X-Share-Password') || '';
    if (!safeEqual(crypto.createHash('sha256').update(String(provided)).digest('hex'), rec.passwordHash)) {
      return res.status(401).json({ error: 'Password required or invalid' });
    }
  }

  const filePath = path.resolve(FILES_DIR_RESOLVED, filename);
  if (!filePath.startsWith(FILES_DIR_RESOLVED + path.sep)) return res.status(403).json({ error: 'Access denied' });
  try {
    const realPath = await fs.promises.realpath(filePath);
    if (!realPath.startsWith(FILES_DIR_RESOLVED + path.sep)) return res.status(403).json({ error: 'Access denied' });
    res.set('Cache-Control', 'private, max-age=300');
  res.download(realPath, filename, { dotfiles: 'deny' }, (err) => {
      if (err && !res.headersSent) res.status(500).json({ error: 'Download failed' });
    });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    res.status(500).json({ error: 'Download failed' });
  }
});

// GET /download/:filename
app.get('/download/:filename', basicAuth, async (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.resolve(FILES_DIR_RESOLVED, filename);
  if (!filePath.startsWith(FILES_DIR_RESOLVED + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  let realPath;
  try {
    realPath = await fs.promises.realpath(filePath);
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    return res.status(500).json({ error: 'Internal server error' });
  }

  if (!realPath.startsWith(FILES_DIR_RESOLVED + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.set('Cache-Control', 'private, max-age=300');
  res.download(realPath, filename, { dotfiles: 'deny' }, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  });
});

// GET /api/files — supports search, sort, order, page, limit
app.get('/api/files', basicAuth, async (req, res) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
    const sort = (['name', 'size', 'modified'].includes(req.query.sort) ? req.query.sort : 'modified');
    const order = (req.query.order === 'asc' ? 'asc' : 'desc');
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const entries = (await fs.promises.readdir(FILES_DIR)).filter((f) => !f.startsWith('.'));
    let items = (await Promise.all(entries.map(async (file) => {
      if (search && !file.toLowerCase().includes(search)) return null;
      try {
        const stats = await fs.promises.stat(path.join(FILES_DIR, file));
        return { name: file, size: stats.size, modified: stats.mtime };
      } catch (e) {
        return null;
      }
    }))).filter(Boolean);

    items.sort((a, b) => {
      const va = a[sort];
      const vb = b[sort];
      const cmp = (va < vb ? -1 : (va > vb ? 1 : 0));
      return order === 'asc' ? cmp : -cmp;
    });

    const total = items.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, pages);
    const start = (safePage - 1) * limit;
    const paged = items.slice(start, start + limit);

    res.json({ files: paged, count: paged.length, total, page: safePage, pages, sort, order, search });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /delete/:filename — delete a shared file
app.post('/delete/:filename', basicAuth, async (req, res) => {
  const filename = sanitizeFilename(req.params.filename);
  if (!filename) return res.status(400).json({ error: 'Invalid filename' });

  const cookies = parseCookies(req.headers.cookie);
  const csrfCookie = cookies.csrf_token;
  const submitted = (req.body && req.body._csrf) || req.get('X-CSRF-Token');
  if (typeof csrfCookie !== 'string' || typeof submitted !== 'string' || !safeEqual(csrfCookie, submitted)) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  const filePath = path.resolve(FILES_DIR_RESOLVED, filename);
  if (!filePath.startsWith(FILES_DIR_RESOLVED + path.sep)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const realPath = await fs.promises.realpath(filePath);
    if (!realPath.startsWith(FILES_DIR_RESOLVED + path.sep)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    await fs.promises.unlink(realPath);
    await meta.removeFile(filename);
    if (req.get('Accept') && req.get('Accept').includes('text/html')) return res.redirect('/');
    res.json({ success: true, deleted: filename });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ error: 'File not found' });
    if (process.env.NODE_ENV !== 'production') console.error(e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Static client bundle (authenticated)
app.get('/app.js', basicAuth, (req, res) => {
  res.type('application/javascript');
  res.sendFile(path.join(__dirname, 'public', 'app.js'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  if (err && err.message && (err.message === 'File type not allowed' || err.message === 'Invalid filename')) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const multerMessages = {
      LIMIT_FILE_SIZE: 'File too large (max 100MB)',
      LIMIT_FILE_COUNT: 'Too many files uploaded',
      LIMIT_FIELD_KEY: 'Field name too long',
      LIMIT_FIELD_VALUE: 'Field value too long',
      LIMIT_FIELD_COUNT: 'Too many fields',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
    };
    const message = multerMessages[err.code] || `Upload error: ${err.code}`;
    return res.status(err.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: message });
  }
  if (process.env.NODE_ENV !== 'production') console.error(err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server (only when run directly, not when imported by tests)
if (require.main === module) {
  const networkInterfaces = Object.values(os.networkInterfaces())
    .flat()
    .filter(({ family, address }) => family === 'IPv4' && address !== '127.0.0.1')
    .map(({ address }) => address);

  app.listen(PORT, () => {
    console.log(`📁 File Server v2.1`);
    console.log(`   Local:   http://localhost:${PORT}`);
    networkInterfaces.forEach(ip => {
      console.log(`   Network: http://${ip}:${PORT}`);
    });
    console.log(`   Auth:    enabled (Basic Auth)`);
  });
}

module.exports = { app, FILES_DIR };
