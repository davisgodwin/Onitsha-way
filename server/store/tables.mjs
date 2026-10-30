/**
 * How the server's in-memory world maps onto database tables.
 * Every table keeps the full record as JSON in `data` (so nothing is lost when the record grows),
 * plus a few plain columns you can read and search in phpMyAdmin.
 * `seq` (auto-increment) keeps list order exactly as the server had it.
 */
export const SCHEMA_VERSION = 2; // 2: v0.43 adds the `authority` table

export const TABLES = [
  { table: 'users', field: 'users', list: true, key: 'id', cols: {
    username: ['VARCHAR(32) NOT NULL', (u) => u.username], name: ['VARCHAR(64) NULL', (u) => u.name], created_at: ['BIGINT NULL', (u) => u.createdAt] },
    indexes: ['UNIQUE KEY username (username)'] },
  { table: 'sessions', field: 'sessions', list: false, key: 'key_hash', cols: {
    user_id: ['VARCHAR(64) NOT NULL', (s) => s.id], until: ['BIGINT NOT NULL', (s) => s.until] }, indexes: ['KEY user_id (user_id)'] },
  { table: 'requests', field: 'requests', list: true, key: 'id', cols: {
    from_id: ['VARCHAR(64) NULL', (r) => r.from], to_id: ['VARCHAR(64) NULL', (r) => r.to], kind: ['VARCHAR(32) NULL', (r) => r.kind],
    status: ['VARCHAR(32) NULL', (r) => r.status], expires_at: ['BIGINT NULL', (r) => r.expiresAt] } },
  { table: 'ads', field: 'ads', list: true, key: 'id', cols: {
    owner_id: ['VARCHAR(64) NULL', (a) => a.owner], status: ['VARCHAR(32) NULL', (a) => a.status], area: ['VARCHAR(32) NULL', (a) => a.area],
    board_id: ['VARCHAR(64) NULL', (a) => a.boardId], starts_at: ['BIGINT NULL', (a) => a.startsAt], ends_at: ['BIGINT NULL', (a) => a.endsAt] } },
  { table: 'reports', field: 'reports', list: true, key: 'id', cols: {
    from_id: ['VARCHAR(64) NULL', (r) => r.from], target_id: ['VARCHAR(64) NULL', (r) => r.target], at: ['BIGINT NULL', (r) => r.at] } },
  { table: 'mail_threads', field: 'mailThreads', list: true, key: 'id', cols: {
    members: ['VARCHAR(160) NULL', (t) => (t.members ?? []).join(',')], status: ['VARCHAR(32) NULL', (t) => t.status] } },
  { table: 'group_mail', field: 'groupMail', list: false, key: 'team_id', cols: {} },
  // v0.43 server authority: each account's books (balances, verified property, record, reputation limits)
  { table: 'authority', field: 'authority', list: false, key: 'user_id', cols: { life_id: ['VARCHAR(80) NULL', (a) => a.lifeId], updated_at: ['BIGINT NULL', (a) => a.updated] } },
];
/** Fields stored as simple key/value rows in `meta` (mailSeq and anything added later). */
export const KNOWN_FIELDS = new Set(TABLES.map((t) => t.field));

const clip = (v, def) => {
  if (v == null) return null;
  const m = /^VARCHAR\((\d+)\)/.exec(def[0]);
  return m ? String(v).slice(0, Number(m[1])) : Number.isFinite(Number(v)) ? Math.round(Number(v)) : null;
};

/** Current rows of one table as Map(key → { cols:[...], data:string }). */
export function rowsOf(db, t) {
  const out = new Map(), src = db[t.field];
  const entries = t.list ? (Array.isArray(src) ? src : []).map((item) => [item?.id, item]) : Object.entries(src && typeof src === 'object' ? src : {});
  for (const [k, item] of entries) {
    if (k == null || item == null) continue;
    out.set(String(k), { cols: Object.values(t.cols).map((def) => clip(def[1](item), def)), data: JSON.stringify(item) });
  }
  return out;
}

/** Everything that is not a table becomes a meta row (value as JSON). */
export function metaOf(db) {
  const out = new Map();
  for (const [k, v] of Object.entries(db)) if (!KNOWN_FIELDS.has(k) && v !== undefined) out.set(k, JSON.stringify(v));
  return out;
}

/** Rebuild the in-memory world from loaded rows (rows already in seq order). */
export function assemble(tableRows, metaRows) {
  const db = { users: [], requests: [], ads: [], reports: [] };
  for (const t of TABLES) {
    const rows = tableRows.get(t.table) ?? [];
    if (t.list) db[t.field] = rows.map((r) => JSON.parse(r.data));
    else db[t.field] = Object.fromEntries(rows.map((r) => [r.k, JSON.parse(r.data)]));
  }
  for (const r of metaRows ?? []) db[r.k] = JSON.parse(r.value);
  return db;
}
