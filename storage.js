const fs = require('fs');
const path = require('path');

class StorageBackend {
  async list() { throw new Error('not implemented'); }
  async stat(name) { throw new Error('not implemented'); }
  async remove(name) { throw new Error('not implemented'); }
  async totalSize() { throw new Error('not implemented'); }
  resolvePath(name) { throw new Error('not implemented'); }
}

class LocalStorage extends StorageBackend {
  constructor(dir) {
    super();
    this.dir = path.resolve(dir || process.env.FILES_DIR || path.join(__dirname, 'files'));
    if (!fs.existsSync(this.dir)) fs.mkdirSync(this.dir, { recursive: true });
  }
  resolvePath(name) { return path.resolve(this.dir, name); }
  async list() {
    try { return await fs.promises.readdir(this.dir); }
    catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  }
  async stat(name) {
    return await fs.promises.stat(this.resolvePath(name));
  }
  async remove(name) {
    const p = this.resolvePath(name);
    await fs.promises.unlink(p);
  }
  async totalSize() {
    const entries = (await this.list()).filter((name) => !String(name).startsWith('.'));
    let total = 0;
    for (const name of entries) {
      try { total += (await this.stat(name)).size; } catch (e) {  }
    }
    return total;
  }
}

function createStorage() {
  return new LocalStorage(process.env.FILES_DIR);
}

module.exports = { StorageBackend, LocalStorage, createStorage };
