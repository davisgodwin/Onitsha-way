import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createService } from '../server/service.mjs';
import { readDbConfig } from '../server/store/index.mjs';
import { planPut, inspectSave } from '../server/store/saves.mjs';

/*
 * v0.33 database: the same behaviour on the file store and on MySQL/MariaDB.
 * The MySQL half runs when a server answers on MYSQL_HOST/MYSQL_PORT (default 127.0.0.1:3306, user root, no password —
 * XAMPP's defaults). It uses a throwaway database (ow_test_…) and drops it afterwards. Set OW_SKIP_MYSQL=1 to skip.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MY = { host: process.env.MYSQL_HOST || '127.0.0.1', port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || 'root', password: process.env.MYSQL_PASSWORD || '' };
let mysql = null;
if (!process.env.OW_SKIP_MYSQL) {
  try { mysql = (await import('mysql2/promise')).default; const c = await mysql.createConnection({ ...MY, connectTimeout: 1500 }); await c.end(); }
  catch { mysql = null; }
}
const mysqlNote = mysql ? false : 'no MySQL/MariaDB server on ' + `${MY.host}:${MY.port}`;

const save = (over = {}) => JSON.stringify({ version: 16, createdAt: 'life-1', updatedAt: new Date().toISOString(), character: { name: 'Ada', gender: 'female' }, clock: { day: 3, minutes: 600 }, wallet: { balance: 5000 }, ...over });

function harness(svcFactory) {
  const h = { sockets: [] };
  h.start = async () => { h.s = await svcFactory(); await h.s.listen(0); h.base = `http://127.0.0.1:${h.s.server.address().port}`; };
  h.stop = async () => { for (const ws of h.sockets) ws.terminate(); h.sockets = []; await h.s.close(); };
  h.post = async (route, body, token) => { const r = await fetch(h.base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  h.register = (username) => h.post('/api/register', { username, password: 'database-qa-password', name: username, adult: true });
  h.login = (username) => h.post('/api/login', { username, password: 'database-qa-password' });
  h.getSave = async (token, meta = false) => { const r = await fetch(h.base + '/api/save' + (meta ? '?meta=1' : ''), { headers: token ? { Authorization: `Bearer ${token}` } : {} }); return { status: r.status, body: await r.json() }; };
  h.putSave = async (token, body) => { const r = await fetch(h.base + '/api/save', { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  h.connect = async (token) => {
    const ws = new WebSocket(h.base.replace('http:', 'ws:') + '/socket'); h.sockets.push(ws);
    const q = [], wait = new Map();
    ws.on('message', (b) => { const m = JSON.parse(b); q.push(m); if (wait.has(m.requestId)) { wait.get(m.requestId)(m); wait.delete(m.requestId); } });
    await new Promise((r) => ws.once('open', r)); ws.send(JSON.stringify({ type: 'auth', token }));
    for (let i = 0; i < 200 && !q.some((m) => m.me); i++) await sleep(5);
    return { q, act: (action, args = {}) => new Promise((resolve, reject) => { const requestId = crypto.randomUUID(), t = setTimeout(() => reject(Error('Reply timeout')), 5000); wait.set(requestId, (m) => { clearTimeout(t); resolve(m); }); ws.send(JSON.stringify({ type: 'action', action, ...args, requestId })); }) };
  };
  return h;
}

/** The checks both storage drivers must pass. */
async function sharedChecks(t, h, label) {
  await h.start();
  const a = (await h.register('db_ada')).body, b = (await h.register('db_obi')).body;
  assert.ok(a.ok && b.ok, `${label}: accounts register`);
  assert.equal((await h.register('db_ada')).status, 400, `${label}: duplicate usernames refused`);

  // cloud saves
  assert.equal((await h.getSave(null)).status, 401, `${label}: saves need a login`);
  let r = await h.getSave(a.token); assert.equal(r.body.save, null, `${label}: no save at first`);
  r = await h.putSave(a.token, { raw: save(), baseRev: 0 }); assert.equal(r.status, 200); assert.equal(r.body.save.rev, 1, `${label}: first upload is rev 1`);
  r = await h.putSave(a.token, { raw: save({ clock: { day: 4, minutes: 0 } }), baseRev: 1 }); assert.equal(r.body.save.rev, 2);
  r = await h.putSave(a.token, { raw: save({ clock: { day: 9, minutes: 0 } }), baseRev: 1 });
  assert.equal(r.status, 409, `${label}: a copy based on an old revision is refused`); assert.equal(r.body.save.rev, 2); assert.equal(JSON.parse(r.body.save.raw).clock.day, 4, `${label}: conflict reply carries the server copy`);
  r = await h.putSave(a.token, { raw: save({ clock: { day: 9, minutes: 0 } }), baseRev: 1, force: true }); assert.equal(r.status, 200); assert.equal(r.body.backedUp, true, `${label}: a forced overwrite keeps the replaced copy`);
  assert.equal((await h.putSave(a.token, { raw: '{"version":16}', baseRev: 3 })).status, 400, `${label}: non-saves refused`);
  assert.equal((await h.putSave(a.token, { raw: 'x'.repeat(4.2 * 1024 * 1024), baseRev: 3 })).status, 400, `${label}: over 4 MB refused`);
  r = await h.getSave(a.token); assert.equal(r.body.save.rev, 3); assert.equal(JSON.parse(r.body.save.raw).clock.day, 9);
  r = await h.getSave(a.token, true); assert.equal(r.body.save.raw, undefined, `${label}: ?meta=1 leaves the save out`); assert.equal(r.body.save.day, 9);
  assert.equal((await h.getSave(b.token)).body.save, null, `${label}: each account sees only its own save`);
  // two devices racing on the same revision: exactly one wins
  const race = await Promise.all([h.putSave(a.token, { raw: save({ clock: { day: 10, minutes: 0 } }), baseRev: 3 }), h.putSave(a.token, { raw: save({ clock: { day: 11, minutes: 0 } }), baseRev: 3 })]);
  assert.deepEqual(race.map((x) => x.status).sort(), [200, 409], `${label}: simultaneous uploads → one saved, one told to reconcile`);
  // a unicode-heavy save round-trips exactly
  const fancy = save({ character: { name: 'Ọ̀bị́ Nwáńnè 🇳🇬', gender: 'male' }, clock: { day: 12, minutes: 1 } });
  r = await h.putSave(a.token, { raw: fancy, baseRev: 4 }); assert.equal(r.status, 200);
  assert.equal((await h.getSave(a.token)).body.save.raw, fancy, `${label}: save text comes back byte-for-byte`);

  // world data through the normal game actions
  const ca = await h.connect(a.token), cb = await h.connect(b.token);
  r = await ca.act('mailSend', { target: b.me.id, text: 'Ọ́ dị mma? See you at Upper Iweka', key: 'db-mail-1' }); assert.ok(r.ok, `${label}: mail sent`);
  const thread = r.thread.id; await cb.act('mailRespond', { id: thread, accept: true });
  await h.s.store.flush();

  // restart: accounts, sessions, mail and saves survive
  await h.stop(); await h.start();
  r = await fetch(h.base + '/api/session', { headers: { Authorization: `Bearer ${a.token}` } }); assert.equal(r.status, 200, `${label}: login session survives a restart`);
  assert.equal((await h.login('db_obi')).body.me.id, b.me.id, `${label}: password login after restart`);
  const cb2 = await h.connect(b.token); r = await cb2.act('mailOpen', { id: thread });
  assert.ok(r.ok && r.thread.messages[0].text.startsWith('Ọ́ dị mma'), `${label}: mail survives a restart`);
  assert.equal(JSON.parse((await h.getSave(a.token)).body.save.raw).character.name, 'Ọ̀bị́ Nwáńnè 🇳🇬', `${label}: cloud save survives a restart`);
  const backups = await h.s.store.listBackups(a.me.id); assert.equal(backups.length, 2, `${label}: first replacement and the forced one are kept, routine autosaves are not`);
  assert.equal(JSON.parse(backups[0].raw).clock.day, 4, `${label}: the copy replaced by force is the one kept`);
  const health = await (await fetch(h.base + '/api/health')).json(); assert.equal(health.database.ok, true); assert.equal(health.database.driver, label);
  await h.stop();
}

test('save rules: revisions, backups and validation', () => {
  assert.throws(() => inspectSave('nope'), /not readable/);
  assert.throws(() => inspectSave(JSON.stringify({ version: 16, clock: {} })), /no character/);
  const first = planPut(null, { raw: save(), baseRev: 0 }, 1000);
  assert.equal(first.next.rev, 1); assert.equal(first.backup, false);
  assert.ok(planPut(first.next, { raw: save(), baseRev: 0 }, 2000).conflict, 'stale base revision conflicts');
  assert.equal(planPut(first.next, { raw: save(), baseRev: 1 }, 2000).backup, true, 'first replacement is backed up');
  const second = planPut({ ...first.next, lastBackupAt: 2000 }, { raw: save(), baseRev: 1 }, 3000);
  assert.equal(second.backup, false, 'routine autosaves within the hour are not each backed up');
  assert.equal(planPut({ ...first.next, lastBackupAt: 2000 }, { raw: save({ createdAt: 'life-2' }), baseRev: 1 }, 3000).backup, true, 'a new life always keeps the old one');
  assert.equal(planPut({ ...first.next, lastBackupAt: 2000 }, { raw: save(), baseRev: 1 }, 2000 + 3600000).backup, true, 'hourly copies kept');
});

test('config: files by default; database.json switches to MySQL with XAMPP defaults', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow33-cfg-'));
  assert.deepEqual(readDbConfig(dir, {}), { driver: 'json' });
  fs.writeFileSync(path.join(dir, 'database.json'), JSON.stringify({ driver: 'mysql' }));
  assert.deepEqual(readDbConfig(dir, {}), { driver: 'mysql', host: '127.0.0.1', port: 3306, user: 'root', password: '', database: 'onitsha_way' });
  assert.equal(readDbConfig(dir, { MYSQL_PASSWORD: 'x', MYSQL_PORT: '3307' }).port, 3307);
  assert.equal(readDbConfig(dir, { DB_DRIVER: 'json' }).driver, 'json');
  fs.writeFileSync(path.join(dir, 'database.json'), JSON.stringify({ driver: 'mysql', database: 'bad-name;' }));
  assert.throws(() => readDbConfig(dir, {}), /letters, numbers/);
});

test('file storage (world.json): accounts, mail and cloud saves', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow33-json-'));
  await sharedChecks(t, harness(() => createService({ dataDir: dir })), 'json');
  assert.ok(fs.existsSync(path.join(dir, 'world.json')) && fs.existsSync(path.join(dir, 'saves')), 'files written where they always were');
});

test('MySQL storage: import, the same game behaviour, row-level writes, retry when MySQL drops out', { skip: mysqlNote }, async (t) => {
  const { MysqlStore, createSchema } = await import('../server/store/mysqlStore.mjs');
  const database = `ow_test_${process.pid}_${Date.now() % 100000}`, cfg = { ...MY, database };
  const admin = await mysql.createConnection(MY);
  try {
    (await createSchema(cfg)).end();
    // import an existing world.json the way db:setup does (fixture with a v0.30-style account and a mail thread)
    const legacy = { users: [{ id: 'legacy-1', username: 'old_timer', name: 'Old Timer', salt: 's', hash: 'h', friends: [], blocks: [], partner: null, credits: [{ id: 'team:x', amount: 1000, claimed: false }], createdAt: 1 }],
      requests: [], ads: [], reports: [{ id: 'r1', from: 'legacy-1', target: 'legacy-1', reason: 'fixture', at: 2 }], sessions: { abc: { id: 'legacy-1', until: 9e15 } },
      mailThreads: [{ id: 'th1', members: ['legacy-1', 'x'], status: 'accepted', messages: [{ id: 'm', seq: 1, from: 'x', text: 'ndewo', time: 3 }], read: {} }], groupMail: { team1: { messages: [] } }, mailSeq: 7, futureField: { kept: true } };
    let store = await MysqlStore.open(cfg); store.persist(structuredClone(legacy)); await store.flush(); await store.close();
    store = await MysqlStore.open(cfg);
    assert.deepEqual(store.load(), { authority: {}, ...legacy }, // v0.43+: the authority table (empty for an old world.json) loads as {}, as the server defaults it anyway
      'every field of world.json comes back exactly, including fields the server adds later');
    await store.close();

    await sharedChecks(t, harness(() => MysqlStore.open(cfg).then((store) => createService({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ow33-my-')), store }))), 'mysql');
    const db = await mysql.createConnection(cfg);
    const [[u]] = await db.query("SELECT username, name FROM users WHERE username='db_ada'");
    assert.equal(u.name, 'db_ada', 'accounts are real rows you can see in phpMyAdmin');
    const [[sv]] = await db.query('SELECT character_name, day, rev FROM game_saves WHERE character_name LIKE ?', ['Ọ̀bị́%']);
    assert.equal(sv.day, 12, 'cloud save summary columns are filled');

    // only changed rows are written
    store = await MysqlStore.open(cfg);
    const [[before]] = await db.query("SELECT written_at FROM users WHERE id='legacy-1'");
    await sleep(5); store.load().users.find((x) => x.username === 'db_obi').name = 'Obi changed'; store.persist(store.load()); await store.flush();
    const [[after]] = await db.query("SELECT written_at FROM users WHERE id='legacy-1'"), [[obi]] = await db.query("SELECT name FROM users WHERE username='db_obi'");
    assert.equal(after.written_at, before.written_at, 'untouched rows are not rewritten'); assert.equal(obi.name, 'Obi changed');
    // removed list entries are deleted (e.g. old requests trimmed by the server)
    store.load().reports = []; store.persist(store.load()); await store.flush();
    assert.equal((await db.query('SELECT COUNT(*) AS n FROM reports'))[0][0].n, 0);

    // MySQL unavailable for a moment: the write fails, is retried, and lands — nothing is lost
    const real = store.pool.getConnection.bind(store.pool); let failuresLeft = 2;
    store.pool.getConnection = () => (failuresLeft-- > 0 ? Promise.reject(Object.assign(Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' })) : real());
    store.load().mailSeq = 99; store.persist(store.load());
    await assert.rejects(store.flush(), /XAMPP Control Panel/, 'the caller is told MySQL is down, in plain words');
    assert.equal(store.status().ok, false);
    for (let i = 0; i < 100 && !store.status().ok; i++) await sleep(50);
    assert.equal(store.status().ok, true, 'recovered on its own');
    assert.equal(JSON.parse((await db.query("SELECT value FROM meta WHERE k='mailSeq'"))[0][0].value), 99, 'the change made while MySQL was down is saved');
    await store.close();

    // registering while MySQL is down: refused clearly, and the account doesn't half-exist
    store = await MysqlStore.open(cfg); const svc = createService({ dataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'ow33-my-')), store }); await svc.listen(0);
    const base = `http://127.0.0.1:${svc.server.address().port}`, real2 = store.pool.getConnection.bind(store.pool);
    store.pool.getConnection = () => Promise.reject(Object.assign(Error('x'), { code: 'ECONNREFUSED' }));
    const reg = await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'db_down', password: 'database-qa-password', adult: true }) });
    assert.equal(reg.status, 503); assert.match((await reg.json()).error, /could not be saved to the database/);
    assert.ok(!svc.db.users.some((x) => x.username === 'db_down'), 'no half-made account');
    store.pool.getConnection = real2;
    const reg2 = await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'db_down', password: 'database-qa-password', adult: true }) });
    assert.equal(reg2.status, 200, 'the same username works once MySQL is back');
    await svc.close();
    await db.end();
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); await admin.end();
  }
});
