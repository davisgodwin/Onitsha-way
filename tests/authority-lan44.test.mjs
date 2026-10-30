// v0.44: the account server's books, and players together, through the LAN gateway (https + wss), as phones on the
// same Wi-Fi reach it — plus a long session: thousands of transactions over several days, with the network dropping.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import { WebSocket } from 'ws';
const store = new Map(); const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = { localStorage: ls }; globalThis.localStorage = ls;
const { createService } = await import('../server/service.mjs');
const { createGateway } = await import('../server/lanGateway.mjs');
const { ensureLanCert } = await import('../server/lanCert.mjs');
const { Economy } = await import('../src/economy/Economy.js');
const { AuthorityClient, SYNC } = await import('../src/authority/AuthorityClient.js');
const { CloudSave } = await import('../src/save/CloudSave.js');
const { defaultSave } = await import('../src/save/SaveSystem.js');
const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** fetch over https with the LAN certificate authority (what a phone that installed the CA does). */
const httpsFetch = (ca, port) => (url, o = {}) => new Promise((res, rej) => { const q = https.request({ host: '127.0.0.1', port, path: url, method: o.method ?? 'GET', ca, headers: { ...(o.headers ?? {}), Origin: `https://localhost:${port}` } }, (x) => { let b = ''; x.on('data', (c) => { b += c; }); x.on('end', () => res({ status: x.statusCode, json: async () => JSON.parse(b || '{}') })); }); q.on('error', rej); if (o.body) q.write(o.body); q.end(); });

test('the account server through the LAN gateway: books open, earnings counted, tampering corrected, players rob and pay over wss', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow44-lan-')), dist = fs.mkdtempSync(path.join(os.tmpdir(), 'ow44-dist-')); fs.writeFileSync(path.join(dist, 'index.html'), '<title>Onitsha Way</title>');
 const tls = await ensureLanCert(path.join(dir, 'lan-cert'), ['127.0.0.1']); const secret = 'y'.repeat(40);
 const svc = createService({ dataDir: dir, lan: { secret, joinCode: 'QWERTY' } }), backendPort = await listen(svc.server), gw = createGateway({ distDir: dist, backendPort, secret, tls }), port = await listen(gw);
 const F = httpsFetch(tls.caCert, port), sockets = [], realRandom = Math.random;
 try {
  const reg = async (username) => (await F('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'lan-auth-password', name: username, adult: true }) })).json();
  const ada = await reg('lanauth_ada'), obi = await reg('lanauth_obi'); assert.ok(ada.ok && obi.ok);
  // Ada's browser: the real client, over https
  CloudSave.fetcher = F; CloudSave.attach(ada.me.id, ada.token); CloudSave.state = 'synced';
  const d = defaultSave({ name: 'Ada', gender: 'female', ageGroup: 'adult' }); d.wallet.balance = 30000; d.createdAt = 'lan-life-ada';
  const g = { saveData: d, bus: { emit() {} }, ui: { toast() {} }, clock: { day: 1 }, saveGame() {} }, client = new AuthorityClient(g); clearInterval(client.interval);
  const wallet = new Economy(d.wallet);
  assert.equal(await client.sync(), true, 'books opened over https');
  wallet.transact({ key: 'lan:shift', amount: 4000, reason: 'Shift pay: Developer' }); await client.sync(); assert.equal(d.wallet.balance, 34000);
  d.wallet.balance = 1e8; await client.sync(); assert.equal(d.wallet.balance, 34000, 'corrected over the gateway too');
  // Obi's books (another phone), then both on wss
  const ob = await (await F('/api/authority/sync', { method: 'POST', headers: { Authorization: `Bearer ${obi.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lifeId: 'lan-life-obi', snapshot: { wallet: { balance: 20000 } } }) })).json(); assert.equal(ob.ok, true);
  const connect = async (a) => { const ws = new WebSocket(`wss://127.0.0.1:${port}/socket`, { ca: tls.caCert, headers: { Origin: `https://localhost:${port}` } }); sockets.push(ws); const q = [], wait = new Map(); ws.on('message', (b) => { const m = JSON.parse(b); q.push(m); if (wait.has(m.requestId)) { wait.get(m.requestId)(m); wait.delete(m.requestId); } }); await new Promise((r, j) => { ws.once('open', r); ws.once('error', j); }); ws.send(JSON.stringify({ type: 'auth', token: a.token })); for (let i = 0; i < 200 && !q.some((m) => m.me); i++) await sleep(10);
   return { q, ws, act: (action, args = {}) => new Promise((resolve, reject) => { const requestId = crypto.randomUUID(), timer = setTimeout(() => reject(Error('timeout')), 5000); wait.set(requestId, (m) => { clearTimeout(timer); resolve(m); }); ws.send(JSON.stringify({ type: 'action', action, ...args, requestId })); }) }; };
  const A = await connect(ada), B = await connect(obi);
  for (const [c, x] of [[A, 0], [B, 1]]) c.ws.send(JSON.stringify({ type: 'presence', p: { x, y: 0, z: 0, heading: 0, scene: 'city', speed: 0, appearance: { ageGroup: 'adult' }, voice: 'off', safe: false } }));
  await sleep(50); Math.random = () => 0.01;
  const r = await B.act('pvpCrime', { target: ada.me.id, kind: 'pickpocket' }); assert.equal(r.ok, true); assert.equal(r.amount, 5000);
  await sleep(30); await client.sync(); assert.equal(d.wallet.balance, 29000, 'Ada\'s browser records the theft as its own entry');
  assert.match(d.wallet.ledger.at(-1).reason, /Pickpocketed by lanauth_obi/);
  const p = await A.act('pay', { target: obi.me.id, amount: 2000 }); assert.equal(p.ok, true); await client.sync(); assert.equal(d.wallet.balance, 27000);
  assert.equal(d.authority.queue.length, 0); assert.equal(d.authority.corrections, 1, 'only the tampering needed a correction');
 } finally { Math.random = realRandom; CloudSave.userId = null; for (const ws of sockets) ws.terminate(); gw.close(); await svc.close(); }
});

test('a long online session: thousands of transactions over several days, the network dropping, nothing lost or counted twice', async () => {
 let T = Date.UTC(2026, 9, 26, 7, 0); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow44-soak-'));
 const svc = createService({ dataDir: dir, now: () => T }); await svc.listen(0); const base = `http://127.0.0.1:${svc.server.address().port}`;
 let down = false; CloudSave.fetcher = (url, o) => (down ? Promise.reject(Error('network down')) : fetch(base + url, o));
 try {
  const ada = await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'soak_ada', password: 'soak-qa-password', adult: true }) })).json();
  CloudSave.attach(ada.me.id, ada.token); CloudSave.state = 'synced';
  const d = defaultSave({ name: 'Ada', gender: 'female', ageGroup: 'adult' }); d.wallet.balance = 100000; d.createdAt = 'soak-life'; d.bank.open = true; d.orgs.list.push({ id: 'org1', name: 'Ada Provisions', kind: 'shop', type: 'provisions', account: { balance: 0, ledger: [], processed: [] }, staff: [], log: [], days: [], vehicles: [] });
  const g = { saveData: d, bus: { emit() {} }, ui: { toast() {} }, clock: { day: 1 }, saveGame() {} }, client = new AuthorityClient(g); clearInterval(client.interval);
  const wallet = new Economy(d.wallet), bank = new Economy(d.bank.account), shop = new Economy(d.orgs.list[0].account);
  assert.equal(await client.sync(), true);
  let n = 0, seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let day = 0; day < 4; day++) {
   for (let hour = 0; hour < 14; hour++) {
    T += 3_600_000; down = hour >= 4 && hour < 9; // five hours with no network every day
    for (let i = 0; i < 60; i++) {
     const k = `t${++n}`, x = rnd();
     if (x < 0.25) wallet.transact({ key: k, amount: 50 + Math.floor(rnd() * 40) * 50, reason: 'Job: errand' });
     else if (x < 0.5) wallet.transact({ key: k, amount: -(50 + Math.floor(rnd() * 20) * 50), reason: 'Street food' });
     else if (x < 0.65) { const a = 500 + Math.floor(rnd() * 10) * 100; if (wallet.transact({ key: `${k}:out`, amount: -a, reason: 'Deposit' }).ok) bank.transact({ key: `${k}:in`, amount: a, reason: 'Deposit' }); }
     else if (x < 0.75) { const a = 300 + Math.floor(rnd() * 10) * 50; if (bank.transact({ key: `${k}:out`, amount: -a, reason: 'Withdrawal' }).ok) wallet.transact({ key: `${k}:in`, amount: a, reason: 'Withdrawal' }); }
     else if (x < 0.9) shop.transact({ key: k, amount: 550 * (1 + Math.floor(rnd() * 8)), reason: 'Sales: 3 packs' });
     else { const a = 1000; if (shop.transact({ key: `${k}:out`, amount: -a, reason: 'Profit out' }).ok) wallet.transact({ key: `${k}:in`, amount: a, reason: 'Profit out' }); }
    }
    if (!down) { await client.sync(); while (d.authority.queue.length) await client.sync(); } else assert.equal(await client.sync(), false);
   }
   T += 10 * 3_600_000;
  }
  while (d.authority.queue.length) await client.sync();
  const view = (await (await fetch(base + '/api/authority', { headers: { Authorization: `Bearer ${ada.token}` } })).json()).authority;
  assert.ok(n >= 3000, `${n} transactions`);
  assert.equal(view.balances.wallet, d.wallet.balance); assert.equal(view.balances.bank, d.bank.account.balance); assert.equal(view.balances['org:org1'], d.orgs.list[0].account.balance);
  assert.equal(view.stats.rejected, 0, 'nothing honest was refused'); assert.equal(d.authority.corrections, 0, 'and nothing needed correcting');
  assert.ok(SYNC.queueMax >= 5 * 60 * 1, 'the queue holds a long time offline');
 } finally { CloudSave.userId = null; await svc.close(); }
});
