import fs from 'node:fs';
import path from 'node:path';
import { planPut, BACKUPS_KEPT } from './saves.mjs';

const writeAtomic = (file, text) => { const temp = file + '.tmp'; fs.writeFileSync(temp, text, { mode: 0o600 }); fs.renameSync(temp, file); };
const safeId = (id) => { if (!/^[a-zA-Z0-9-]{1,64}$/.test(String(id))) throw Error('Invalid account id.'); return String(id); };

/**
 * The original file storage: the whole world in server/data/world.json, written on every change.
 * Cloud saves go in server/data/saves/<account id>.json, older copies in server/data/saves/backups/.
 */
export class JsonStore {
  constructor(dataDir) {
    this.driver = 'json'; this.dataDir = dataDir;
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.file = path.join(dataDir, 'world.json');
    this.savesDir = path.join(dataDir, 'saves');
  }
  load() { return fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : { users: [], requests: [], ads: [], reports: [] }; }
  /** Called after every change: write now (as before). */
  persist(db) { writeAtomic(this.file, JSON.stringify(db)); }
  async flush() {}
  status() { return { driver: 'json', ok: true, pending: false, where: this.file }; }
  async close() {}

  saveFile(id) { return path.join(this.savesDir, `${safeId(id)}.json`); }
  readSave(userId) { const f = this.saveFile(userId); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
  async getSave(userId) { return this.readSave(userId); }
  /** Synchronous from read to write, so two uploads can never interleave. */
  async putSave(userId, body, now) {
    const current = this.readSave(userId), plan = planPut(current, body, now);
    if (plan.conflict) return plan;
    fs.mkdirSync(path.join(this.savesDir, 'backups'), { recursive: true, mode: 0o700 });
    if (plan.backup) {
      writeAtomic(path.join(this.savesDir, 'backups', `${safeId(userId)}-${String(current.rev).padStart(6, '0')}.json`), JSON.stringify({ ...current, replacedAt: now }));
      const mine = this.backupFiles(userId);
      for (const f of mine.slice(0, Math.max(0, mine.length - BACKUPS_KEPT))) fs.unlinkSync(path.join(this.savesDir, 'backups', f));
    }
    writeAtomic(this.saveFile(userId), JSON.stringify(plan.next));
    return plan;
  }
  backupFiles(userId) { const dir = path.join(this.savesDir, 'backups'), p = `${safeId(userId)}-`; return fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.startsWith(p) && f.endsWith('.json')).sort() : []; }
  async listBackups(userId) { return this.backupFiles(userId).reverse().map((f) => JSON.parse(fs.readFileSync(path.join(this.savesDir, 'backups', f), 'utf8'))); }
  async allSaves() { return fs.existsSync(this.savesDir) ? fs.readdirSync(this.savesDir).filter((f) => f.endsWith('.json')).map((f) => ({ userId: f.slice(0, -5), ...JSON.parse(fs.readFileSync(path.join(this.savesDir, f), 'utf8')) })) : []; }
}
