import fs from 'node:fs';
import path from 'node:path';
import { JsonStore } from './jsonStore.mjs';

export const XAMPP_DEFAULTS = { driver: 'mysql', host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'onitsha_way' };
export const configPath = (dataDir) => path.join(dataDir, 'database.json');

/**
 * Which storage the server uses.
 * - server/data/database.json (written by `npm run db:setup`) → MySQL with those settings.
 * - Environment variables override it: DB_DRIVER=mysql|json, MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE.
 * - Nothing set → the original world.json file storage.
 */
export function readDbConfig(dataDir, env = process.env) {
  let file = {};
  const p = configPath(dataDir);
  if (fs.existsSync(p)) {
    try { file = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { throw Error(`server/data/database.json is not valid JSON (${e.message}). Fix it or run npm run db:setup again.`); }
  }
  const cfg = { ...(file.driver === 'mysql' ? XAMPP_DEFAULTS : {}), ...file };
  if (env.DB_DRIVER) cfg.driver = env.DB_DRIVER;
  if (cfg.driver === 'mysql') {
    for (const [k, e] of [['host', 'MYSQL_HOST'], ['port', 'MYSQL_PORT'], ['user', 'MYSQL_USER'], ['password', 'MYSQL_PASSWORD'], ['database', 'MYSQL_DATABASE']]) if (env[e] != null) cfg[k] = env[e];
    for (const [k, v] of Object.entries(XAMPP_DEFAULTS)) cfg[k] ??= v;
    cfg.port = Number(cfg.port);
    if (!/^[A-Za-z0-9_]{1,64}$/.test(cfg.database)) throw Error('The database name may only use letters, numbers and underscores.');
    return cfg;
  }
  if (cfg.driver && cfg.driver !== 'json') throw Error(`Unknown database driver "${cfg.driver}" (use "mysql" or "json").`);
  return { driver: 'json' };
}

/** Open the configured store. MySQL problems stop the server with a clear message (it never silently falls back). */
export async function openStore(dataDir, { env = process.env, log = console } = {}) {
  const cfg = readDbConfig(dataDir, env);
  if (cfg.driver !== 'mysql') return new JsonStore(dataDir);
  const { MysqlStore } = await import('./mysqlStore.mjs');
  return MysqlStore.open(cfg, { log });
}
