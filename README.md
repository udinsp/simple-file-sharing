# Simple File Sharing Server v2.1

A simple file sharing server built with Express.js. Supports file uploads, downloads, and comes with basic security features.

## ✨ Features

- 📁 **File listing** — Clean and responsive file list view
- ⬆️ **File upload** — Upload files directly from the browser (max 100MB)
- ⬇️ **File download** — Secure file downloads
- 🔐 **Basic Auth** — Protected with username & password
- 🛡️ **Path Traversal Protection** — Safe against directory traversal attacks
- ⏱️ **Rate Limiting** — DDoS protection (100 requests / 15 minutes)
- 📊 **JSON API** — `/api/files` endpoint for integrations
- 🐳 **Docker Support** — Ready to deploy with Docker

## 🚀 Installation

### Manual
```bash
git clone https://github.com/udinsp/simple-file-sharing.git
cd simple-file-sharing
npm install
cp .env.example .env
# Edit .env and set AUTH_USER and AUTH_PASS
npm start
```

### Docker
```bash
git clone https://github.com/udinsp/simple-file-sharing.git
cd simple-file-sharing
docker compose up -d
```

## ⚙️ Configuration

Create a `.env` file from `.env.example`:

```env
PORT=3000           # Server port (default: 3000)
AUTH_USER=admin     # Login username (change in production)
AUTH_PASS=changeme  # Login password (change in production)
TRUST_PROXY=        # Set when behind a reverse proxy (e.g. 1)
COOKIE_SECURE=false # Set true when served over HTTPS
AUTH_USERS=         # Optional: user:pass,user2:pass2 (overrides AUTH_USER/AUTH_PASS)
MAX_STORAGE_MB=     # Optional storage quota (0 = unlimited)
ALLOWED_EXTENSIONS= # Optional comma list, e.g. .pdf,.txt,.png
BLOCKED_EXTENSIONS= # Optional comma list of blocked extensions
SHARE_DEFAULT_HOURS=24
```

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | File listing (HTML) |
| POST | `/upload` | ✅ | Upload file |
| GET | `/download/:filename` | ✅ | Download file |
| GET | `/api/files` | ✅ | File listing (JSON) |

## 🛡️ Security

- Path traversal protection — `../../etc/passwd` is blocked
- Basic authentication — All endpoints are protected
- Rate limiting — 100 requests per 15 minutes
- File size limit — Max 100MB per file
- Safe filename — Dangerous characters are sanitized
- XSS protection — HTML output is properly escaped
- Credentials are never logged to console

## 📦 Dependencies

- **express** — Web framework
- **multer** — File upload handling
- **express-rate-limit** — Rate limiting
- **dotenv** — Environment config

## 📝 Changelog

### v2.2.0 (phase 1: tests, health, delete)
- Added `/health` and `/ready` endpoints
- Added file delete endpoint/UI with CSRF protection
- Added search/sort/pagination query params to `/api/files`
- Added Jest/Supertest-free Node test suite (10 tests) and Docker hardening
- Bumped version to 2.2.0

### v2.1.0 (security hardening)
- Upgraded multer to 2.x and express to 4.22+
- Added Helmet security headers (CSP, X-Frame-Options, nosniff)
- Replaced string password comparison with constant-time comparison
- Embedded CSRF protection for browser uploads (double-submit + SameSite cookie)
- Added safer filename/path handling (realpath + traversal guard)
- Async filesystem operations and safer error handling
- Conditional HSTS, configurable trust proxy for reverse proxies
- Default-credential warning / production guard

### v2.0.0
- Migrated from `http` to Express.js
- Added file upload support
- Added Basic Auth
- Added rate limiting
- Fixed path traversal vulnerability
- Fixed file size calculation
- Added Docker support
- Added JSON API endpoint
- Responsive UI
- Fixed XSS vulnerability in file listing
- Fixed credentials leak in startup logs
- Fixed filename collision handling on upload
- Improved multer error handling

### v1.0.0
- Initial release (raw http)
- File listing & download
