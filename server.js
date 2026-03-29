/**
 * Simple File Sharing Server v2.0
 * Modernized with Express.js
 */

const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const FILES_DIR = path.join(__dirname, 'files');
const AUTH_USER = process.env.AUTH_USER || 'admin';
const AUTH_PASS = process.env.AUTH_PASS || 'changeme';

// Ensure files directory exists
if (!fs.existsSync(FILES_DIR)) {
  fs.mkdirSync(FILES_DIR, { recursive: true });
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});
app.use(limiter);

// Parse form data
app.use(express.urlencoded({ extended: true }));

// Basic Auth middleware
function basicAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.setHeader('WWW-Authenticate', 'Basic realm="File Server"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  const base64Credentials = authHeader.split(' ')[1];
  if (!base64Credentials) {
    res.setHeader('WWW-Authenticate', 'Basic realm="File Server"');
    return res.status(401).json({ error: 'Malformed authorization header' });
  }
  const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
  const separatorIndex = credentials.indexOf(':');
  const username = credentials.substring(0, separatorIndex);
  const password = credentials.substring(separatorIndex + 1);

  if (username === AUTH_USER && password === AUTH_PASS) {
    return next();
  }

  res.setHeader('WWW-Authenticate', 'Basic realm="File Server"');
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, FILES_DIR),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = path.join(FILES_DIR, safeName);
    if (fs.existsSync(filePath)) {
      const ext = path.extname(safeName);
      const base = path.basename(safeName, ext);
      const unique = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      cb(null, `${base}_${unique}${ext}`);
    } else {
      cb(null, safeName);
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
});

// Helper: sanitize filename to prevent path traversal
function sanitizeFilename(filename) {
  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized;
}

// Helper: escape HTML entities to prevent XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper: format file size
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// GET / — File listing
app.get('/', basicAuth, (req, res) => {
  fs.readdir(FILES_DIR, (err, files) => {
    if (err) {
      return res.status(500).send('Internal server error');
    }

    const fileList = files.map(file => {
      try {
        const stats = fs.statSync(path.join(FILES_DIR, file));
        return {
          name: file,
          size: stats.size,
          sizeFormatted: formatSize(stats.size),
          modified: stats.mtime
        };
      } catch (e) {
        // File may have been deleted between readdir and stat
        return null;
      }
    }).filter(Boolean).sort((a, b) => b.modified - a.modified);

    const html = `
      <!DOCTYPE html>
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
            
            <div class="upload-area">
              <form action="/upload" method="POST" enctype="multipart/form-data">
                <input type="file" name="file" required style="margin-bottom: 10px;">
                <br>
                <button type="submit" class="upload-btn">⬆️ Upload File</button>
              </form>
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
                  <td class="hide-mobile">${f.modified.toLocaleDateString()}</td>
                  <td><a href="/download/${encodeURIComponent(f.name)}">⬇️ Download</a></td>
                </tr>
                `).join('')}
              </tbody>
            </table>
            `}
          </div>
        </body>
      </html>
    `;

    res.send(html);
  });
});

// POST /upload — Upload file
app.post('/upload', basicAuth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.redirect('/');
});

// GET /download/:filename — Download file (safe path)
app.get('/download/:filename', basicAuth, (req, res) => {
  const filename = sanitizeFilename(req.params.filename);

  if (!filename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = path.resolve(FILES_DIR, filename);

  // Security: prevent path traversal using resolved canonical paths
  if (!filePath.startsWith(path.resolve(FILES_DIR) + path.sep) && filePath !== path.resolve(FILES_DIR)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, filename, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ error: 'Download failed' });
    }
  });
});

// GET /api/files — JSON API for file listing
app.get('/api/files', basicAuth, (req, res) => {
  fs.readdir(FILES_DIR, (err, files) => {
    if (err) {
      return res.status(500).json({ error: 'Internal server error' });
    }

    const fileList = files.map(file => {
      try {
        const stats = fs.statSync(path.join(FILES_DIR, file));
        return {
          name: file,
          size: stats.size,
          modified: stats.mtime
        };
      } catch (e) {
        // File may have been deleted between readdir and stat
        return null;
      }
    }).filter(Boolean);

    res.json({ files: fileList, count: fileList.length });
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
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
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const networkInterfaces = Object.values(os.networkInterfaces())
  .flat()
  .filter(({ family, address }) => family === 'IPv4' && address !== '127.0.0.1')
  .map(({ address }) => address);

app.listen(PORT, () => {
  console.log(`📁 File Server v2.0`);
  console.log(`   Local:   http://localhost:${PORT}`);
  networkInterfaces.forEach(ip => {
    console.log(`   Network: http://${ip}:${PORT}`);
  });
  console.log(`   Auth:    enabled (Basic Auth)`);
});
