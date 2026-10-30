#!/usr/bin/env node
/**
 * Database tools for the local account server.
 *   npm run db:setup              create the MySQL database + tables, move world.json in, switch the server to MySQL
 *   npm run db:status             show which storage is in use and what is in it
 *   npm run db:backup             copy everything (accounts, mail, ads, cloud saves) to server/data/backups/
 *   npm run db:saves -- <name>    list a player's cloud save and its older copies
 *   npm run db:saves -- <name> --restore <n>   put older copy <n> back as the current save (the current one is kept)
 * Options for setup: --host 127.0.0.1 --port 3306 --user root --password "" --database onitsha_way
 * Nothing here deletes accounts or saves.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDbConfig, configPath, openStore, XAMPP_DEFAULTS } from '../server/store/index.mjs';
import { TABLES } from '../server/store/tables.mjs';

const dataDir = process.env.DATA_DIR || fileURLToPath(new URL('../server/data', import.meta.url));
const [cmd = 'help', ...rest] = process.argv.slice(2);
const flags = {}, args = [];
for (let i = 0; i < rest.length; i++) { const a = rest[i]; if (a.startsWith('--')) { const k = a.slice(2), v = rest[i + 1]; if (v === undefined || v.startsWith('--')) flags[k] = true; else { flags[k] = v; i++; } } else args.push(a); }
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').replace(/\..+/, '');
const fail = (msg) => { console.error(`\n✗ ${msg}\n`); process.exit(1); };
const kb = (n) => (n < 1024 ? `${n} B` : `${Math.round(n / 1024)} KB`);
const counts = (db) => TABLES.map((t) => `${t.table}: ${Array.isArray(db[t.field]) ? db[t.field].length : Object.keys(db[t.field] ?? {}).length}`).join(' · ');

async function setup() {
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  let saved = {};
  try { saved = readDbConfig(dataDir, {}); } catch { /* rewritten below */ }
  const cfg = { ...XAMPP_DEFAULTS, ...(saved.driver === 'mysql' ? saved : {}) };
  for (const k of ['host', 'port', 'user', 'password', 'database']) if (flags[k] !== undefined) cfg[k] = flags[k] === true ? '' : flags[k];
  for (const [k, e] of [['host', 'MYSQL_HOST'], ['port', 'MYSQL_PORT'], ['user', 'MYSQL_USER'], ['password', 'MYSQL_PASSWORD'], ['database', 'MYSQL_DATABASE']]) if (process.env[e] != null && flags[k] === undefined) cfg[k] = process.env[e];
  cfg.port = Number(cfg.port);
  if (!/^[A-Za-z0-9_]{1,64}$/.test(cfg.database)) fail('The database name may only use letters, numbers and underscores.');
  console.log(`\nONITSHA WAY · database setup\nMySQL: ${cfg.user}@${cfg.host}:${cfg.port} · database "${cfg.database}"`);

  const { createSchema, explainMysqlError, MysqlStore } = await import('../server/store/mysqlStore.mjs');
  let conn;
  try { conn = await createSchema(cfg); } catch (e) { fail(explainMysqlError(e, cfg)); }
  const [[{ v }]] = await conn.query('SELECT VERSION() AS v');
  const [[{ n: existing }]] = await conn.query('SELECT COUNT(*) AS n FROM users');
  await conn.end();
  console.log(`✓ Connected (${v}). Database and tables are ready.`);

  let store;
  try { store = await MysqlStore.open(cfg, { log: console }); } catch (e) { fail(e.message); }
  const worldFile = path.join(dataDir, 'world.json');
  if (fs.existsSync(worldFile)) {
    const world = JSON.parse(fs.readFileSync(worldFile, 'utf8'));
    if (existing > 0) {
      console.log(`! MySQL already holds ${existing} account(s), so world.json was NOT imported again (it is left untouched).`);
    } else {
      // Copy every record across in one go, then keep the original file under a new name.
      store.persist(world);
      try { await store.flush(); } catch (e) { await store.close(); fail(`Import failed, nothing was changed in world.json: ${e.message}`); }
      const moved = `${worldFile}.migrated-${stamp()}`;
      fs.renameSync(worldFile, moved);
      console.log(`✓ Imported world.json → ${counts(world)}`);
      console.log(`  The original file is kept as ${path.relative(process.cwd(), moved)}`);
    }
  } else if (!existing) console.log('· No world.json found — starting with an empty database.');
  else console.log(`· MySQL already holds ${existing} account(s); nothing to import.`);

  // Cloud saves made while the server ran on files (server/data/saves) move in too.
  const savesDir = path.join(dataDir, 'saves');
  if (fs.existsSync(savesDir)) {
    let n = 0;
    for (const f of fs.readdirSync(savesDir).filter((f) => f.endsWith('.json'))) {
      const userId = f.slice(0, -5), s = JSON.parse(fs.readFileSync(path.join(savesDir, f), 'utf8'));
      if (await store.getSave(userId)) continue;
      await store.putSave(userId, { raw: s.raw, baseRev: 0 }, s.updatedAt ?? Date.now()); n++;
    }
    if (n) console.log(`✓ Imported ${n} cloud save(s) from server/data/saves (the files are left in place).`);
  }
  const packet = store.packet; await store.close();

  fs.writeFileSync(configPath(dataDir), JSON.stringify({ driver: 'mysql', host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password, database: cfg.database }, null, 2) + '\n', { mode: 0o600 });
  console.log(`✓ Saved the connection settings in server/data/database.json — the game server now uses MySQL.`);
  if (packet < 16 * 1048576) console.log(`! MySQL's max_allowed_packet is ${Math.round(packet / 1048576)} MB. The server raises it while it runs, but to make it permanent:\n  XAMPP Control Panel → MySQL → Config → my.ini → under [mysqld] set  max_allowed_packet=64M  → save → Stop/Start MySQL.`);
  console.log('\nNext: npm run dev   (keep MySQL running in XAMPP while you play)\n');
}

async function status() {
  let cfg; try { cfg = readDbConfig(dataDir); } catch (e) { fail(e.message); }
  let store; try { store = await openStore(dataDir); } catch (e) { fail(e.message); }
  const db = store.load(), st = store.status(), saves = await store.allSaves();
  console.log(`\nStorage: ${cfg.driver === 'mysql' ? `MySQL "${cfg.database}" on ${cfg.host}:${cfg.port}` : `file ${st.where}`}`);
  console.log(counts(db));
  console.log(`cloud saves: ${saves.length}${saves.length ? ` (largest ${kb(Math.max(...saves.map((s) => s.size)))})` : ''}`);
  await store.close();
}

async function backup() {
  let store; try { store = await openStore(dataDir); } catch (e) { fail(e.message); }
  const dir = path.join(dataDir, 'backups', `backup-${stamp()}`);
  fs.mkdirSync(path.join(dir, 'saves'), { recursive: true, mode: 0o700 });
  const db = store.load();
  fs.writeFileSync(path.join(dir, 'world.json'), JSON.stringify(db), { mode: 0o600 });
  const saves = await store.allSaves();
  for (const s of saves) fs.writeFileSync(path.join(dir, 'saves', `${s.userId}.json`), JSON.stringify(s), { mode: 0o600 });
  await store.close();
  console.log(`\n✓ Backup written to ${path.relative(process.cwd(), dir)}\n  ${counts(db)} · cloud saves: ${saves.length}\n  world.json there has the same format the server used before MySQL.\n`);
}

async function saves() {
  const name = String(args[0] ?? '').toLowerCase();
  if (!name) fail('Give a username, e.g. npm run db:saves -- ada_obi');
  let store; try { store = await openStore(dataDir); } catch (e) { fail(e.message); }
  const u = store.load().users.find((x) => x.username === name);
  if (!u) { await store.close(); fail(`No account called "${name}".`); }
  const cur = await store.getSave(u.id), old = await store.listBackups(u.id);
  const line = (s) => `${s.character || '?'} · day ${s.day ?? '?'} · ${kb(s.size)} · saved ${new Date(s.savedAt ?? s.updatedAt).toLocaleString()} · rev ${s.rev}`;
  if (flags.restore !== undefined) {
    const pick = old[Number(flags.restore) - 1];
    if (!pick) { await store.close(); fail(`There is no older copy number ${flags.restore}.`); }
    const d = JSON.parse(pick.raw); d.updatedAt = new Date().toISOString();
    await store.putSave(u.id, { raw: JSON.stringify(d), force: true }, Date.now());
    console.log(`\n✓ Restored copy ${flags.restore} (${line(pick)}) for ${name}. The save it replaced is kept in the list.\n  Log in on any browser to load it.\n`);
  } else {
    console.log(`\n${name} (${u.name})\nCurrent: ${cur ? line(cur) : 'no cloud save yet'}`);
    old.forEach((s, i) => console.log(`  ${i + 1}. ${line(s)}`));
    if (old.length) console.log(`\nTo bring one back: npm run db:saves -- ${name} --restore <number>`);
    console.log('');
  }
  await store.close();
}

const run = { setup, status, backup, saves }[cmd];
if (!run) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(2, 10).map((l) => l.replace(/^ \* ?/, '')).join('\n')); process.exit(cmd === 'help' ? 0 : 1); }
await run();
