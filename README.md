# Simple File Sharing Server v2.0

Server sederhana untuk sharing file, dibangun dengan Express.js. Mendukung upload, download, dan dilengkapi keamanan dasar.

## ✨ Fitur

- 📁 **File listing** — Tampilan daftar file yang rapi & responsive
- ⬆️ **File upload** — Upload file langsung dari browser (max 100MB)
- ⬇️ **File download** — Download file dengan aman
- 🔐 **Basic Auth** — Proteksi dengan username & password
- 🛡️ **Path Traversal Protection** — Aman dari serangan directory traversal
- ⏱️ **Rate Limiting** — Proteksi dari DDoS (100 request/15 menit)
- 📊 **JSON API** — Endpoint `/api/files` untuk integrasi
- 🐳 **Docker Support** — Siap deploy dengan Docker

## 🚀 Install

### Manual
```bash
git clone https://github.com/udinsp/simple-file-sharing.git
cd simple-file-sharing
npm install
cp .env.example .env
# Edit .env, ganti AUTH_USER dan AUTH_PASS
npm start
```

### Docker
```bash
git clone https://github.com/udinsp/simple-file-sharing.git
cd simple-file-sharing
docker compose up -d
```

## ⚙️ Konfigurasi

Buat file `.env` dari `.env.example`:

```env
PORT=3000           # Port server (default: 3000)
AUTH_USER=admin     # Username untuk login
AUTH_PASS=changeme  # Password untuk login
```

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | ✅ | File listing (HTML) |
| POST | `/upload` | ✅ | Upload file |
| GET | `/download/:filename` | ✅ | Download file |
| GET | `/api/files` | ✅ | File listing (JSON) |

## 🛡️ Security

- Path traversal protection — `../../etc/passwd` diblokir
- Basic authentication — Semua endpoint dilindungi
- Rate limiting — 100 request per 15 menit
- File size limit — Max 100MB per file
- Safe filename — Karakter berbahaya di-sanitize

## 📦 Dependencies

- **express** — Web framework
- **multer** — File upload handling
- **express-rate-limit** — Rate limiting
- **dotenv** — Environment config

## 📝 Changelog

### v2.0.0
- Migrasi dari `http` ke Express.js
- Tambah fitur upload file
- Tambah Basic Auth
- Tambah rate limiting
- Fix path traversal vulnerability
- Fix file size calculation
- Tambah Docker support
- Tambah JSON API endpoint
- Responsive UI

### v1.0.0
- Initial release (raw http)
- File listing & download
