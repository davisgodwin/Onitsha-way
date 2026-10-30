import mysql from 'mysql2/promise';
import zlib from 'node:zlib';
import { TABLES, SCHEMA_VERSION, rowsOf, metaOf, assemble } from './tables.mjs';
import { planPut, BACKUPS_KEPT } from './saves.mjs';

const q = (name) => '`' + String(name).replace(/`/g, '') + '`';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WANT_PACKET = 64 * 1024 * 1024;

/** Turn driver errors into something a person running XAMPP can act on. */
export function explainMysqlError(e, cfg = {}) {
  const where = `${cfg.host ?? '127.0.0.1'}:${cfg.port ?? 3306}`;
  switch (e?.code) {
    case 'ECONNREFUSED': case 'ETIMEDOUT': case 'EHOSTUNREACH':
      return `Could not reach MySQL at ${where}. Open the XAMPP Control Panel and press Start next to MySQL, then try again.`;
    case 'ER_ACCESS_DENIED_ERROR': case 'ER_DBACCESS_DENIED_ERROR':
      return `MySQL refused the login for user "${cfg.user}". Check the user and password in server/data/database.json (XAMPP's default is user "root" with no password).`;
    case 'ER_BAD_DB_ERROR':
      return `The database "${cfg.database}" does not exist yet. Run: npm run db:setup`;
    case 'ER_NO_SUCH_TABLE':
      return `The game tables are missing in "${cfg.database}". Run: npm run db:setup`;
    case 'ER_NET_PACKET_TOO_LARGE':
      return 'MySQL rejected a record as too large (max_allowed_packet). In XAMPP open MySQL → Config → my.ini, set max_allowed_packet=64M under [mysqld], save and restart MySQL.';
    default: return `MySQL error: ${e?.sqlMessage || e?.message || e}`;
  }
}

/** CREATE statements for every table (safe to run again: IF NOT EXISTS). */
export function schemaSql() {
  const opts = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
  const out = TABLES.map((t) => `CREATE TABLE IF NOT EXISTS ${q(t.table)} (
  ${q(t.key)} VARCHAR(64) NOT NULL,
  seq BIGINT NOT NULL AUTO_INCREMENT,
${Object.entries(t.cols).map(([c, [def]]) => `  ${q(c)} ${def},\n`).join('')}  data LONGTEXT NOT NULL,
  written_at BIGINT NOT NULL,
  PRIMARY KEY (${q(t.key)}), UNIQUE KEY seq (seq)${(t.indexes ?? []).map((i) => `, ${i}`).join('')}
) ${opts}`);
  out.push(`CREATE TABLE IF NOT EXISTS meta (k VARCHAR(64) NOT NULL, value LONGTEXT NOT NULL, PRIMARY KEY (k)) ${opts}`);
  const saveCols = `rev INT NOT NULL, save_version INT NULL, character_name VARCHAR(64) NULL, day INT NULL, saved_at BIGINT NULL,
  life_id VARCHAR(64) NULL, size INT NOT NULL, updated_at BIGINT NOT NULL, last_backup_at BIGINT NULL, data LONGBLOB NOT NULL`;
  out.push(`CREATE TABLE IF NOT EXISTS game_saves (user_id VARCHAR(64) NOT NULL, ${saveCols}, PRIMARY KEY (user_id)) ${opts}`);
  out.push(`CREATE TABLE IF NOT EXISTS game_save_backups (id BIGINT NOT NULL AUTO_INCREMENT, user_id VARCHAR(64) NOT NULL, ${saveCols},
  replaced_at BIGINT NOT NULL, PRIMARY KEY (id), KEY user_id (user_id, id)) ${opts}`);
  return out;
}

const SAVE_FIELDS = 'rev, save_version, character_name, day, saved_at, life_id, size, updated_at, last_backup_at, data';
const fromSaveRow = (r) => r && ({ rev: r.rev, saveVersion: r.save_version, character: r.character_name, day: r.day, savedAt: r.saved_at, lifeId: r.life_id,
  size: r.size, updatedAt: r.updated_at, lastBackupAt: r.last_backup_at, raw: zlib.gunzipSync(r.data).toString('utf8'), ...(r.replaced_at ? { replacedAt: r.replaced_at } : {}) });
const toSaveRow = (s) => [s.rev, s.saveVersion, s.character, s.day, s.savedAt, s.lifeId?.slice(0, 64), s.size, s.updatedAt, s.lastBackupAt, zlib.gzipSync(s.raw)];

/**
 * MySQL / MariaDB storage (XAMPP). The whole world is loaded into memory at start — the game server
 * keeps working exactly as before — and every change is written back as a small transaction holding
 * only the rows that changed. Writes are queued in order and retried if MySQL is briefly unavailable.
 */
export class MysqlStore {
  static async open(cfg, { log = console } = {}) {
    const base = { host: cfg.host ?? '127.0.0.1', port: Number(cfg.port ?? 3306), user: cfg.user ?? 'root', password: cfg.password ?? '', database: cfg.database ?? 'onitsha_way',
      charset: 'utf8mb4', supportBigNumbers: true, connectTimeout: 6000 };
    // Raise max_allowed_packet first when we're allowed to (XAMPP's my.ini ships with 1 MB; flyers and saves can be bigger).
    const first = await mysql.createConnection(base).catch((e) => { throw Object.assign(Error(explainMysqlError(e, base)), { cause: e }); });
    let packet;
    try {
      [[{ packet }]] = await first.query('SELECT @@max_allowed_packet AS packet');
      if (packet < WANT_PACKET) { try { await first.query(`SET GLOBAL max_allowed_packet=${WANT_PACKET}`); } catch { log.warn?.(`MySQL max_allowed_packet is ${Math.round(packet / 1048576)} MB. Large flyers or saves may fail; set max_allowed_packet=64M in XAMPP's my.ini.`); } }
    } finally { await first.end(); }
    const pool = mysql.createPool({ ...base, connectionLimit: 4, enableKeepAlive: true });
    const store = new MysqlStore(pool, base, log);
    try {
      [[{ packet: store.packet }]] = await pool.query('SELECT @@max_allowed_packet AS packet');
      const [ver] = await pool.query("SELECT value FROM meta WHERE k='__schemaVersion'");
      if (!ver.length) throw Object.assign(Error('missing schema'), { code: 'ER_NO_SUCH_TABLE' });
      // tables added by later versions (e.g. v0.43 `authority`) are created here; CREATE TABLE IF NOT EXISTS never touches existing data
      if (Number(ver[0].value) < SCHEMA_VERSION) { for (const sql of schemaSql()) await pool.query(sql); await pool.query("UPDATE meta SET value=? WHERE k='__schemaVersion'", [String(SCHEMA_VERSION)]); log.info?.(`MySQL tables updated to schema ${SCHEMA_VERSION}.`); }
      await store.loadAll();
    } catch (e) { await pool.end().catch(() => {}); throw e.code ? Object.assign(Error(explainMysqlError(e, base)), { cause: e }) : e; }
    return store;
  }
  constructor(pool, cfg, log) {
    this.driver = 'mysql'; this.pool = pool; this.cfg = cfg; this.log = log;
    this.last = new Map(); this.lastMeta = new Map(); this.waiters = []; this.locks = new Map();
    this.dirty = false; this.running = false; this.timer = null; this.lastError = null; this.failures = 0; this.writes = 0;
  }
  async loadAll() {
    const tableRows = new Map();
    for (const t of TABLES) {
      const [rows] = await this.pool.query(`SELECT ${q(t.key)} AS k, data FROM ${q(t.table)} ORDER BY seq`);
      tableRows.set(t.table, rows); this.last.set(t.table, new Map(rows.map((r) => [String(r.k), r.data])));
    }
    const [meta] = await this.pool.query("SELECT k, value FROM meta WHERE k NOT LIKE '\\_\\_%'");
    this.lastMeta = new Map(meta.map((r) => [r.k, r.value]));
    this.db = assemble(tableRows, meta);
  }
  load() { return this.db; }

  /** Queue a write of whatever changed. Cheap to call often: changes made close together go in one transaction. */
  persist(db) { this.db = db; this.dirty = true; if (!this.timer && !this.running) this.timer = setTimeout(() => this.run(), 40); }
  /** Resolves when everything changed so far is in MySQL; rejects if the next attempt fails. */
  flush() {
    if (!this.dirty && !this.running) return Promise.resolve();
    const p = new Promise((res, rej) => this.waiters.push({ res, rej }));
    if (this.timer) { clearTimeout(this.timer); this.timer = null; this.run(); }
    return p;
  }
  async run() {
    this.timer = null; if (this.running) return; this.running = true;
    try {
      while (this.dirty) {
        this.dirty = false;
        try {
          await this.writeChanges();
          if (this.lastError) this.log.info?.('MySQL writes are working again.');
          this.lastError = null; this.failures = 0;
          if (!this.dirty) this.waiters.splice(0).forEach((w) => w.res());
        } catch (e) {
          this.dirty = true; this.failures++;
          const msg = explainMysqlError(e, this.cfg);
          if (msg !== this.lastError) this.log.error?.(`Could not save to MySQL (will keep retrying): ${msg}`);
          this.lastError = msg;
          this.waiters.splice(0).forEach((w) => w.rej(Error(msg)));
          if (this.closing && this.failures >= 3) break;
          await sleep(Math.min(30000, 500 * 2 ** Math.min(this.failures, 6)));
        }
      }
    } finally { this.running = false; }
  }
  async writeChanges() {
    const now = Date.now(), plan = [], nextLast = new Map();
    for (const t of TABLES) {
      const rows = rowsOf(this.db, t), last = this.last.get(t.table) ?? new Map(), changed = [];
      for (const [k, r] of rows) if (last.get(k) !== r.data) changed.push([k, ...r.cols, r.data, now]);
      const removed = [...last.keys()].filter((k) => !rows.has(k));
      nextLast.set(t.table, new Map([...rows].map(([k, r]) => [k, r.data])));
      if (changed.length || removed.length) plan.push({ t, changed, removed });
    }
    const meta = metaOf(this.db), metaChanged = [...meta].filter(([k, v]) => this.lastMeta.get(k) !== v), metaRemoved = [...this.lastMeta.keys()].filter((k) => !meta.has(k));
    if (!plan.length && !metaChanged.length && !metaRemoved.length) return;
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const { t, changed, removed } of plan) {
        const cols = [t.key, ...Object.keys(t.cols), 'data', 'written_at'];
        const sql = `INSERT INTO ${q(t.table)} (${cols.map(q).join(', ')}) VALUES ? ON DUPLICATE KEY UPDATE ${cols.slice(1).map((c) => `${q(c)}=VALUES(${q(c)})`).join(', ')}`;
        for (const chunk of this.chunks(changed)) await conn.query(sql, [chunk]);
        for (let i = 0; i < removed.length; i += 500) await conn.query(`DELETE FROM ${q(t.table)} WHERE ${q(t.key)} IN (?)`, [removed.slice(i, i + 500)]);
      }
      for (const chunk of this.chunks(metaChanged)) await conn.query('INSERT INTO meta (k, value) VALUES ? ON DUPLICATE KEY UPDATE value=VALUES(value)', [chunk]);
      if (metaRemoved.length) await conn.query('DELETE FROM meta WHERE k IN (?)', [metaRemoved]);
      await conn.commit();
    } catch (e) { await conn.rollback().catch(() => {}); throw e; } finally { conn.release(); }
    this.last = nextLast; this.lastMeta = meta; this.writes++;
  }
  /** Split rows so each INSERT stays under MySQL's packet limit. */
  chunks(rows) {
    const limit = Math.max(256 * 1024, (this.packet ?? 1048576) - 64 * 1024), out = []; let cur = [], size = 0;
    for (const r of rows) {
      const n = r.reduce((s, v) => s + (typeof v === 'string' ? Buffer.byteLength(v) * 1.1 + 8 : 24), 16);
      if (n > limit) throw Object.assign(Error('record too large'), { code: 'ER_NET_PACKET_TOO_LARGE' });
      if (size + n > limit && cur.length) { out.push(cur); cur = []; size = 0; }
      cur.push(r); size += n;
    }
    if (cur.length) out.push(cur);
    return out;
  }
  status() { return { driver: 'mysql', ok: !this.lastError, pending: this.dirty || this.running, database: this.cfg.database, host: `${this.cfg.host}:${this.cfg.port}`, writes: this.writes, ...(this.lastError ? { error: this.lastError } : {}) }; }
  async close() {
    this.closing = true;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.dirty || this.running) { this.run(); await Promise.race([new Promise((r) => { const w = () => (this.dirty || this.running ? setTimeout(w, 50) : r()); w(); }), sleep(15000)]); }
    await this.pool.end().catch(() => {});
  }

  // ---------- cloud saves (read/written directly; never held in memory) ----------
  /** One save request at a time per account, in arrival order. */
  locked(userId, fn) { const prev = this.locks.get(userId) ?? Promise.resolve(); const p = prev.then(fn, fn); this.locks.set(userId, p.catch(() => {})); return p; }
  async getSave(userId) {
    try { const [rows] = await this.pool.query(`SELECT ${SAVE_FIELDS} FROM game_saves WHERE user_id=?`, [userId]); return fromSaveRow(rows[0]) ?? null; }
    catch (e) { throw Error(explainMysqlError(e, this.cfg)); }
  }
  putSave(userId, body, now) {
    return this.locked(userId, async () => {
      const conn = await this.pool.getConnection();
      try {
        await conn.beginTransaction();
        const [rows] = await conn.query(`SELECT ${SAVE_FIELDS} FROM game_saves WHERE user_id=? FOR UPDATE`, [userId]);
        const current = fromSaveRow(rows[0]) ?? null, plan = planPut(current, body, now);
        if (plan.conflict) { await conn.rollback(); return plan; }
        if (plan.backup) {
          await conn.query(`INSERT INTO game_save_backups (user_id, ${SAVE_FIELDS}, replaced_at) SELECT user_id, ${SAVE_FIELDS}, ? FROM game_saves WHERE user_id=?`, [now, userId]);
          const [old] = await conn.query('SELECT id FROM game_save_backups WHERE user_id=? ORDER BY id DESC LIMIT 1000 OFFSET ?', [userId, BACKUPS_KEPT]);
          if (old.length) await conn.query('DELETE FROM game_save_backups WHERE id IN (?)', [old.map((r) => r.id)]);
        }
        const vals = toSaveRow(plan.next);
        if (current) await conn.query('UPDATE game_saves SET rev=?, save_version=?, character_name=?, day=?, saved_at=?, life_id=?, size=?, updated_at=?, last_backup_at=?, data=? WHERE user_id=?', [...vals, userId]);
        else await conn.query(`INSERT INTO game_saves (user_id, ${SAVE_FIELDS}) VALUES (?)`, [[userId, ...vals]]);
        await conn.commit();
        return plan;
      } catch (e) {
        await conn.rollback().catch(() => {});
        if (e.code === 'ER_DUP_ENTRY') return { conflict: await this.getSave(userId) };
        throw e instanceof Error && !e.code ? e : Error(explainMysqlError(e, this.cfg));
      } finally { conn.release(); }
    });
  }
  async listBackups(userId) { const [rows] = await this.pool.query(`SELECT ${SAVE_FIELDS}, replaced_at FROM game_save_backups WHERE user_id=? ORDER BY id DESC`, [userId]); return rows.map(fromSaveRow); }
  async allSaves() { const [rows] = await this.pool.query(`SELECT user_id, ${SAVE_FIELDS} FROM game_saves`); return rows.map((r) => ({ userId: r.user_id, ...fromSaveRow(r) })); }
}

/** Create the database and tables (used by npm run db:setup). Returns a connection to it. */
export async function createSchema(cfg) {
  const conn = await mysql.createConnection({ host: cfg.host, port: Number(cfg.port), user: cfg.user, password: cfg.password, charset: 'utf8mb4', connectTimeout: 6000, multipleStatements: false });
  await conn.query(`CREATE DATABASE IF NOT EXISTS ${q(cfg.database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.changeUser({ database: cfg.database });
  for (const sql of schemaSql()) await conn.query(sql);
  await conn.query("INSERT INTO meta (k, value) VALUES ('__schemaVersion', ?) ON DUPLICATE KEY UPDATE value=VALUES(value)", [String(SCHEMA_VERSION)]);
  return conn;
}
