const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function driverName() { return (process.env.METADATA_DRIVER || 'file').toLowerCase(); }
function metaFile() {
  const dir = path.resolve(process.env.FILES_DIR || path.join(__dirname, 'files'));
  return path.join(path.dirname(dir), '.file-metadata.json');
}
function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha256');
    fs.createReadStream(filePath).on('error', reject).on('data', (c) => h.update(c)).on('end', () => resolve(h.digest('hex')));
  });
}

/* file backend */
async function fRead() {
  try { return JSON.parse(await fs.promises.readFile(metaFile(), 'utf8')); } catch (e) { return { files: {}, shares: {} }; }
}
async function fWrite(data) { const t = metaFile(); const tmp = `${t}.${process.pid}.tmp`; await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2)); await fs.promises.rename(tmp, t); }
async function fGetFile(name) { const d = await fRead(); return (d.files && d.files[name]) || null; }
async function fSetFile(name, info) {
  const d = await fRead(); d.files = d.files || {};
  d.files[name] = Object.assign({}, d.files[name] || {}, info);
  await fWrite(d);
}
async function fRemoveFile(name) { const d = await fRead(); if (d.files) delete d.files[name]; await fWrite(d); }
async function fRenameFile(o, n) {
  const d = await fRead(); if (d.files && d.files[o]) { d.files[n] = d.files[o]; delete d.files[o]; await fWrite(d); }
}
async function fCreateShare(file, hrs, pw) {
  const token = crypto.randomBytes(24).toString('hex');
  const d = await fRead(); d.shares = d.shares || {};
  d.shares[token] = { file, expiresAt: Date.now() + (Number(hrs) || 24) * 3600000, passwordHash: pw ? crypto.createHash('sha256').update(pw).digest('hex') : null };
  await fWrite(d); return token;
}
async function fGetShare(token) {
  const d = await fRead(); const r = d.shares && d.shares[token];
  if (!r) return null;
  if (Date.now() > r.expiresAt) { delete d.shares[token]; await fWrite(d); return null; }
  return r;
}
async function fRemoveShare(token) { const d = await fRead(); if (d.shares) delete d.shares[token]; await fWrite(d); }

/* sqlite backend */
let sqlDb = null;
function sql() {
  if (sqlDb) return sqlDb;
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = process.env.SQLITE_PATH || path.join(path.dirname(path.resolve(process.env.FILES_DIR || path.join(__dirname, 'files'))), 'file-metadata.sqlite');
  sqlDb = new DatabaseSync(dbPath);
  sqlDb.exec('CREATE TABLE IF NOT EXISTS files (name TEXT PRIMARY KEY, checksum TEXT, size INTEGER, uploaded_at TEXT, owner TEXT)');
  sqlDb.exec('CREATE TABLE IF NOT EXISTS shares (token TEXT PRIMARY KEY, file TEXT NOT NULL, expires_at INTEGER NOT NULL, password_hash TEXT)');
  return sqlDb;
}
const stmts = new Map();
function st(sqlText) {
  const db = sql();
  if (!stmts.has(sqlText)) stmts.set(sqlText, db.prepare(sqlText));
  return stmts.get(sqlText);
}
async function sGetFile(name) {
  const row = st('SELECT checksum, size, uploaded_at, owner FROM files WHERE name = ?').get(name);
  if (!row) return null;
  return { checksumSha256: row.checksum, size: row.size, uploadedAt: row.uploaded_at, owner: row.owner };
}
async function sSetFile(name, info) {
  const ex = await sGetFile(name);
  const checksum = (info && info.checksumSha256) || (ex && ex.checksumSha256) || null;
  const size = (info && info.size) || (ex && ex.size) || 0;
  const uploadedAt = (info && info.uploadedAt) || (ex && ex.uploadedAt) || new Date().toISOString();
  const owner = (info && info.owner) || (ex && ex.owner) || null;
  st('INSERT INTO files (name, checksum, size, uploaded_at, owner) VALUES (?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET checksum=excluded.checksum, size=excluded.size, uploaded_at=excluded.uploaded_at, owner=excluded.owner').run(name, checksum, size, uploadedAt, owner);
}
async function sRemoveFile(name) { st('DELETE FROM files WHERE name = ?').run(name); }
async function sRenameFile(o, n) { const r = await sGetFile(o); if (r) { await sSetFile(n, r); await sRemoveFile(o); } }
async function sCreateShare(file, hrs, pw) {
  const token = crypto.randomBytes(24).toString('hex');
  const hash = pw ? crypto.createHash('sha256').update(pw).digest('hex') : null;
  st('INSERT INTO shares (token, file, expires_at, password_hash) VALUES (?,?,?,?)').run(token, file, Date.now() + (Number(hrs) || 24) * 3600000, hash);
  return token;
}
async function sGetShare(token) {
  const row = st('SELECT file, expires_at, password_hash FROM shares WHERE token = ?').get(token);
  if (!row) return null;
  if (Date.now() > row.expires_at) { st('DELETE FROM shares WHERE token = ?').run(token); return null; }
  return { file: row.file, expiresAt: row.expires_at, passwordHash: row.password_hash };
}
async function sRemoveShare(token) { st('DELETE FROM shares WHERE token = ?').run(token); }

function useSqlite() { return driverName() === 'sqlite'; }
async function getFile(name) { return useSqlite() ? sGetFile(name) : fGetFile(name); }
async function setFile(name, info) { return useSqlite() ? sSetFile(name, info) : fSetFile(name, info); }
async function removeFile(name) { return useSqlite() ? sRemoveFile(name) : fRemoveFile(name); }
async function renameFile(o, n) { return useSqlite() ? sRenameFile(o, n) : fRenameFile(o, n); }
async function createShareToken(file, hrs, pw) { return useSqlite() ? sCreateShare(file, hrs, pw) : fCreateShare(file, hrs, pw); }
async function getShare(token) { return useSqlite() ? sGetShare(token) : fGetShare(token); }
async function removeShare(token) { return useSqlite() ? sRemoveShare(token) : fRemoveShare(token); }

module.exports = { read: fRead, write: fWrite, sha256File, getFile, setFile, removeFile, renameFile, createShareToken, getShare, removeShare };
