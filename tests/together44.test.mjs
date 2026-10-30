// v0.44 players together: payments and crime between players on the real server, with every safeguard.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createService } from '../server/service.mjs';
import { PVP, serverMove, openAuthority, applySync } from '../src/authority/Policy.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('serverMove: both books change, the payer must have it, each browser sees one ordinary entry', () => {
 const a = openAuthority('A', { wallet: { balance: 3000 } }, Date.now(), 'browser'), b = openAuthority('B', { wallet: { balance: 0 } }, Date.now(), 'browser');
 assert.equal(serverMove(a, b, 'p2p:x', 5000, Date.now()), false);
 assert.equal(serverMove(a, b, 'p2p:x', 2000, Date.now(), { out: 'Paid B', into: 'From A' }), true);
 assert.equal(a.ledgers.wallet.balance, 1000); assert.equal(b.ledgers.wallet.balance, 2000);
 const rb = applySync(b, { entries: [{ ledger: 'wallet', key: 'p2p:x:in', amount: 2000, reason: 'From A' }] }, Date.now());
 assert.equal(rb.balances.wallet, 2000, 'the browser applying the same move is not counted twice'); assert.deepEqual(rb.incoming.map((x) => [x.key, x.amount, x.reason]), [['p2p:x:in', 2000, 'From A']]);
 assert.equal(applySync(b, {}, Date.now()).incoming.length, 0, 'delivered once');
});

test('players together on the real server: pay, rob, report, and every safeguard', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow44-pvp-')); const s = createService({ dataDir: dir }); await s.listen(0);
 const base = `http://127.0.0.1:${s.server.address().port}`, sockets = [], realRandom = Math.random;
 const register = async (username) => (await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'pvp-qa-password', name: username, adult: true }) })).json());
 const books = async (a, wallet) => (await (await fetch(base + '/api/authority/sync', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lifeId: `life-${a.me.id}`, snapshot: { wallet: { balance: wallet } } }) })).json());
 const balance = async (a) => (await (await fetch(base + '/api/authority', { headers: { Authorization: `Bearer ${a.token}` } })).json()).authority.balances.wallet;
 const connect = async (a) => { const ws = new WebSocket(base.replace('http:', 'ws:') + '/socket'); sockets.push(ws); const q = [], wait = new Map(); ws.on('message', (b) => { const m = JSON.parse(b); q.push(m); if (wait.has(m.requestId)) { wait.get(m.requestId)(m); wait.delete(m.requestId); } }); await new Promise((r) => ws.once('open', r)); ws.send(JSON.stringify({ type: 'auth', token: a.token })); for (let i = 0; i < 100 && !q.some((m) => m.me); i++) await sleep(5);
  return { q, ws, act: (action, args = {}) => new Promise((resolve, reject) => { const requestId = crypto.randomUUID(), timer = setTimeout(() => reject(Error('Reply timeout')), 5000); wait.set(requestId, (m) => { clearTimeout(timer); resolve(m); }); ws.send(JSON.stringify({ type: 'action', action, ...args, requestId })); }) }; };
 const at = (c, x, z, extra = {}) => { c.ws.send(JSON.stringify({ type: 'presence', p: { x, y: 0, z, heading: 0, scene: 'city', speed: 0, appearance: { gender: 'male', ageGroup: 'adult' }, voice: 'off', safe: false, ...extra } })); };
 try {
  const ada = await register('pvp_ada'), obi = await register('pvp_obi'), eve = await register('pvp_eve');
  for (const a of [ada, obi, eve]) assert.equal((await books(a, 50000)).ok, true);
  const A = await connect(ada), B = await connect(obi), E = await connect(eve);
  at(A, 0, 0); at(B, 1, 0); at(E, 40, 0); await sleep(40);
  // too far, safe areas
  let r = await E.act('pvpCrime', { target: obi.me.id, kind: 'pickpocket' }); assert.match(r.error, /closer/);
  at(B, 1, 0, { safe: true }); await sleep(20); r = await A.act('pvpCrime', { target: obi.me.id, kind: 'pickpocket' }); assert.match(r.error, /safe area/); at(B, 1, 0); await sleep(20);
  // peace mode
  await B.act('pvpPeace', { on: true }); r = await A.act('pvpCrime', { target: obi.me.id, kind: 'pickpocket' }); assert.match(r.error, /peace mode/); await B.act('pvpPeace', { on: false });
  // it works: money moves on the server, the victim is told
  Math.random = () => 0.01;
  r = await A.act('pvpCrime', { target: obi.me.id, kind: 'pickpocket' }); assert.equal(r.ok, true); assert.equal(r.amount, PVP.kinds.pickpocket.max);
  await sleep(30); assert.equal(await balance(ada), 55000); assert.equal(await balance(obi), 45000);
  const told = B.q.find((m) => m.type === 'pvp'); assert.ok(told && told.role === 'victim' && told.amount === 5000 && told.name === 'pvp_ada');
  // the attacker waits; the victim is shielded; the attacker can't hide behind peace mode straight away
  r = await A.act('pvpCrime', { target: obi.me.id, kind: 'rob' }); assert.match(r.error, /Wait a few minutes/);
  at(E, 1.5, 0.5); await sleep(20); r = await E.act('pvpCrime', { target: obi.me.id, kind: 'rob' }); assert.match(r.error, /targeted a short while ago/);
  r = await A.act('pvpPeace', { on: true }); assert.match(r.error, /30 minutes/);
  // the victim reports it: the attacker hears; offline attackers hear when they come back
  r = await B.act('pvpReport', { id: told.id }); assert.equal(r.ok, true); await sleep(30); assert.ok(A.q.some((m) => m.type === 'pvpReported' && m.id === told.id));
  assert.match((await B.act('pvpReport', { id: told.id })).error, /Already/);
  // a second incident with a reported attacker offline
  s.db.users.find((u) => u.id === ada.me.id).pvp.nextCrime = 0; Math.random = () => 0.99; // it goes wrong
  r = await A.act('pvpCrime', { target: eve.me.id, kind: 'rob' }); assert.equal(r.ok, false); assert.equal(r.amount, 0); await sleep(20);
  const failed = E.q.find((m) => m.type === 'pvp'); A.ws.close(); await sleep(30); await E.act('pvpReport', { id: failed.id });
  const A2 = await connect(ada); await sleep(30); assert.ok(A2.q.some((m) => m.type === 'pvpReported' && m.id === failed.id), 'delivered on reconnect');
  // three a day at most
  const au = s.db.users.find((u) => u.id === ada.me.id); au.pvp.nextCrime = 0; au.pvp.count = PVP.perDay; at(A2, 0, 0); await sleep(20);
  s.db.users.find((u) => u.id === obi.me.id).pvp.shieldUntil = 0; r = await A2.act('pvpCrime', { target: obi.me.id, kind: 'rob' }); assert.match(r.error, /one day/);
  // paying: nearby or friends, within limits, from what the server says you have
  r = await B.act('pay', { target: ada.me.id, amount: 1000 }); assert.equal(r.ok, true); await sleep(20); assert.equal(await balance(obi), 44000); assert.equal(await balance(ada), 56000);
  assert.ok(A2.q.some((m) => m.type === 'paid' && m.amount === 1000));
  assert.match((await B.act('pay', { target: eve.me.id, amount: 600000 })).error, /between/);
  at(E, 300, 0); await sleep(20); assert.match((await B.act('pay', { target: eve.me.id, amount: 100 })).error, /friend/);
  assert.match((await B.act('pay', { target: ada.me.id, amount: 400000 })).error, /don't have that much/);
  // blocked players can't touch each other
  await B.act('block', { target: ada.me.id }); assert.ok((await A2.act('pay', { target: obi.me.id, amount: 100 })).error);
  const st = await A2.act('pvpStatus'); assert.ok(st.incidents.length >= 2 && st.peaceLock > 0);
 } finally { Math.random = realRandom; for (const ws of sockets) ws.terminate(); await s.close(); }
});
