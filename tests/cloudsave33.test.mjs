import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createService } from '../server/service.mjs';

// Two "browsers" = two separate localStorage maps, swapped under the same page code.
const browsers = { laptop: new Map(), phone: new Map() };
let current = browsers.laptop;
const ls = { getItem: (k) => (current.has(k) ? current.get(k) : null), setItem: (k, v) => current.set(k, String(v)), removeItem: (k) => current.delete(k) };
globalThis.window = { localStorage: ls }; globalThis.localStorage = ls;
const { SaveSystem, defaultSave } = await import('../src/save/SaveSystem.js');
const { CloudSave, plan, saveHash } = await import('../src/save/CloudSave.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mk = (day, at) => JSON.stringify({ ...defaultSave({ name: 'Ada', gender: 'female' }), clock: { day, minutes: 600 }, updatedAt: new Date(at).toISOString(), createdAt: 'life-ada' });

test('plan(): which copy wins', () => {
  const a = mk(2, 1000), b = mk(5, 2000);
  assert.equal(plan(null, null, null).action, 'none');
  assert.deepEqual(plan(a, null, null), { action: 'upload', baseRev: 0 });
  assert.equal(plan(null, { rev: 3, raw: b }, null).action, 'download');
  assert.equal(plan(a, { rev: 3, raw: a }, null).action, 'adopt', 'identical copies just record the revision');
  assert.equal(plan(a, { rev: 3, raw: b }, { rev: 3, hash: saveHash(a) }).action, 'none', 'nothing changed on either side');
  assert.deepEqual(plan(b, { rev: 3, raw: a }, { rev: 3, hash: saveHash(a) }), { action: 'upload', baseRev: 3 }, 'only this browser moved on');
  assert.equal(plan(a, { rev: 4, raw: b }, { rev: 3, hash: saveHash(a) }).action, 'download', 'only the server moved on');
  const both = plan(b, { rev: 4, raw: a }, { rev: 3, hash: 'old' });
  assert.equal(both.conflict, 'kept-local', 'both changed: the most recently played copy (this browser) wins'); assert.equal(both.force, true);
  assert.equal(plan(a, { rev: 4, raw: b }, null).conflict, 'kept-server', 'first visit with an older local copy: the account copy wins');
  assert.deepEqual(plan(b, { rev: 4, raw: a }, { rev: 3, hash: 'old', yielded: true }), { action: 'download', conflict: 'kept-server' }, 'a tab that stepped aside for another device never wins, even with later autosaves');
  assert.deepEqual(plan(b, { rev: 3, raw: a }, { rev: 3, hash: 'old', yielded: true }), { action: 'upload', baseRev: 3 }, '…unless the other device saved nothing new');
});

test('two browsers, one account: progress follows the player and nothing is lost', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow33-cloud-'));
  let s = createService({ dataDir: dir }); await s.listen(0);
  const base = `http://127.0.0.1:${s.server.address().port}`;
  CloudSave.fetcher = (url, o) => fetch(base + url, o); CloudSave.DEBOUNCE = 30; CloudSave.MAX_WAIT = 200; CloudSave.retryMs = 50;
  try {
    const reg = await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'cloud_ada', password: 'cloud-qa-password', adult: true }) })).json();
    const id = reg.me.id, open = async (name) => { current = browsers[name]; SaveSystem.setScope(id); CloudSave.attach(id, reg.token); return CloudSave.reconcile(); };

    // 1. the laptop already had a save from before v0.33: first login uploads it
    current = browsers.laptop; SaveSystem.setScope(id); current.set(`onitshaway:account:${id}:save`, mk(7, Date.now() - 60000));
    let r = await open('laptop'); assert.equal(r.action, 'upload'); assert.equal(r.ok, true);
    assert.equal(CloudSave.status().state, 'synced'); assert.equal((await s.store.getSave(id)).day, 7);

    // 2. playing on: every local save uploads shortly after (debounced)
    const d = SaveSystem.load().data; d.clock.day = 8; SaveSystem.save(d);
    assert.equal(CloudSave.status().pending, true);
    for (let i = 0; i < 100 && (await s.store.getSave(id)).day !== 8; i++) await sleep(20);
    assert.equal((await s.store.getSave(id)).day, 8, 'autosave reached the server');
    assert.equal(CloudSave.status().pending, false);

    // 3. a brand-new phone: the game arrives from the account
    r = await open('phone'); assert.equal(r.action, 'download'); assert.equal(SaveSystem.load().data.clock.day, 8);
    assert.match(CloudSave.notice, /loaded from your account/); CloudSave.notice = '';
    const p = SaveSystem.load().data; p.clock.day = 9; SaveSystem.save(p); assert.equal(await CloudSave.flush(), true);

    // 4. back on the laptop (unchanged since its last sync): it picks up the phone's day 9
    r = await open('laptop'); assert.equal(r.action, 'download'); assert.equal(SaveSystem.load().data.clock.day, 9);

    // 5. both devices played offline-ish: laptop saves locally, phone uploads meanwhile → most recent play wins
    const l = SaveSystem.load().data; l.clock.day = 10; CloudSave.detach(); SaveSystem.save(l); // laptop not syncing (closed tab)
    await sleep(5);
    await open('phone'); const ph = SaveSystem.load().data; ph.clock.day = 11; SaveSystem.save(ph); await CloudSave.flush();
    r = await open('laptop');
    assert.equal(r.conflict, 'kept-server', 'the phone played later, so its game is used'); assert.equal(SaveSystem.load().data.clock.day, 11);
    assert.equal(JSON.parse(current.get(`onitshaway:account:${id}:save:backup`)).clock.day, 10, 'the laptop\'s own game is kept in its backup slot');

    // 6. two devices saving at the same time while playing: this browser keeps its game, the other copy goes to history
    await open('phone'); const ph2 = SaveSystem.load().data; ph2.clock.day = 12; SaveSystem.save(ph2); await CloudSave.flush();
    current = browsers.laptop; // laptop still believes it is on the older revision
    SaveSystem.setScope(id); CloudSave.attach(id, reg.token);
    const lp = SaveSystem.load().data; lp.clock.day = 13; SaveSystem.save(lp); assert.equal(await CloudSave.flush(), true);
    assert.equal((await s.store.getSave(id)).day, 13); assert.match(CloudSave.notice, /other copy is in your account/);
    const hist = await s.store.listBackups(id); assert.ok(hist.some((b) => b.day === 12), 'the phone\'s day 12 is in the save history');

    // 7. server unreachable: the browser keeps playing and uploads when it is back
    await s.close();
    const q = SaveSystem.load().data; q.clock.day = 14; SaveSystem.save(q); await CloudSave.flush();
    assert.equal(CloudSave.status().state, 'offline'); assert.match(CloudSave.describe(), /safe in this browser/);
    s = createService({ dataDir: dir }); await s.listen(0); const base2 = `http://127.0.0.1:${s.server.address().port}`; CloudSave.fetcher = (url, o) => fetch(base2 + url, o);
    for (let i = 0; i < 100 && CloudSave.status().state !== 'synced'; i++) await sleep(20);
    assert.equal((await s.store.getSave(id)).day, 14, 'uploaded after the server came back');

    // 7b. the account is opened on the phone while the laptop tab stays open: the laptop steps aside
    CloudSave.yieldToOtherDevice(); assert.equal(CloudSave.status().state, 'elsewhere'); assert.match(CloudSave.describe(), /open on another device/);
    const y = SaveSystem.load().data; y.clock.day = 20; SaveSystem.save(y); assert.equal(await CloudSave.flush(), false); await sleep(120);
    assert.equal((await s.store.getSave(id)).day, 14, 'the stepped-aside tab uploads nothing, even as it keeps autosaving');
    await open('phone'); const ph3 = SaveSystem.load().data; ph3.clock.day = 15; SaveSystem.save(ph3); await CloudSave.flush();
    r = await open('laptop'); assert.equal(r.action, 'download'); assert.equal(SaveSystem.load().data.clock.day, 15, 'reloading the laptop loads the phone\'s game, not its own later autosave');
    await CloudSave.flush();

    // 8. signing out: no more uploads for that account
    CloudSave.detach(); const z = SaveSystem.load().data; z.clock.day = 30; SaveSystem.save(z); await sleep(120);
    assert.equal((await s.store.getSave(id)).day, 15);
  } finally { CloudSave.detach(); await s.close().catch(() => {}); }
});

test('a "200 OK" that is not the account server\'s answer never crashes the upload; the save stays in the browser', async () => {
  const saved = { fetcher: CloudSave.fetcher, userId: CloudSave.userId, token: CloudSave.token, state: CloudSave.state, meta: CloudSave.meta, schedule: CloudSave.schedule };
  current = new Map(); SaveSystem.writeRaw(mk(3, 3000));
  CloudSave.userId = 'u-x'; CloudSave.token = 't'; CloudSave.state = 'synced'; CloudSave.meta = null; CloudSave.schedule = () => {};
  try {
    for (const body of ['<!doctype html><p>Vite</p>', '{}', '{"ok":true}', '{"ok":true,"save":null}']) {
      CloudSave.fetcher = async () => new Response(body, { status: 200 });
      const ok = await CloudSave.push({ always: true });
      assert.equal(ok, false, `upload reported as not done for ${body.slice(0, 20)}`);
      assert.equal(CloudSave.state, 'offline');
      assert.ok(SaveSystem.raw(), 'the save is still in this browser');
    }
  } finally { Object.assign(CloudSave, saved); }
});
