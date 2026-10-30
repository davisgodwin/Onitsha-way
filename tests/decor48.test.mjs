// v0.48: hiring a friend to decorate your home, on the real server: offer, accept, suggestions relayed, fee paid.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { createService } from '../server/service.mjs';
import { proposalCost, pieceCost } from '../src/online/DecorJobs.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('suggestion cost = price + delivery for each piece', () => { assert.equal(proposalCost([{ id: 'sofa', qty: 2 }]), pieceCost('sofa') * 2); assert.ok(pieceCost('sofa') > 18000); });

test('decorating jobs on the real server', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow48-decor-')); const s = createService({ dataDir: dir }); await s.listen(0);
 const base = `http://127.0.0.1:${s.server.address().port}`, sockets = [];
 const register = async (username) => (await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'pvp-qa-password', name: username, adult: true }) })).json());
 const books = async (a, wallet) => (await (await fetch(base + '/api/authority/sync', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ lifeId: `life-${a.me.id}`, snapshot: { wallet: { balance: wallet } } }) })).json());
 const connect = async (a) => { const ws = new WebSocket(base.replace('http:', 'ws:') + '/socket'); sockets.push(ws); const q = [], wait = new Map(); ws.on('message', (b) => { const m = JSON.parse(b); q.push(m); if (wait.has(m.requestId)) { wait.get(m.requestId)(m); wait.delete(m.requestId); } }); await new Promise((r) => ws.once('open', r)); ws.send(JSON.stringify({ type: 'auth', token: a.token })); for (let i = 0; i < 100 && !q.some((m) => m.me); i++) await sleep(5);
  return { q, ws, act: (action, args = {}) => new Promise((resolve, reject) => { const requestId = crypto.randomUUID(), timer = setTimeout(() => reject(Error('Reply timeout')), 5000); wait.set(requestId, (m) => { clearTimeout(timer); resolve(m); }); ws.send(JSON.stringify({ type: 'action', action, ...args, requestId })); }) }; };
 const at = (c, scene, home = null, extra = {}) => { c.ws.send(JSON.stringify({ type: 'presence', p: { x: 0, y: 0, z: 0, heading: 0, scene, speed: 0, home, appearance: { gender: 'male', ageGroup: 'adult' }, voice: 'off', safe: true, ...extra } })); };
 try {
  const ada = await register('decor_ada'), obi = await register('decor_obi'), eve = await register('decor_eve');
  for (const a of [ada, obi]) assert.equal((await books(a, 100000)).ok, true);
  const A = await connect(ada), B = await connect(obi), E = await connect(eve);
  at(A, 'city'); at(B, 'city'); at(E, 'city'); await sleep(40);
  let r = await A.act('request', { target: obi.me.id, kind: 'decorate', budget: 50000, fee: 5000 }); assert.match(r.error, /friends first/);
  await A.act('request', { target: obi.me.id, kind: 'friend' }); const fr = (await (async () => { await sleep(40); return B.q.filter((m) => m.type === 'state').at(-1).requests.find((x) => x.kind === 'friend'); })()); await B.act('respond', { id: fr.id, accept: true });
  r = await A.act('request', { target: obi.me.id, kind: 'decorate', budget: 50000, fee: 5000 }); assert.match(r.error, /inside your home/, 'only from inside your own home');
  const home = { id: 'home:123', label: 'Self-contain', floor: 'down' }; at(A, `home:${ada.me.id}:home:123:selfcon`, home); await sleep(40);
  r = await A.act('request', { target: obi.me.id, kind: 'decorate', budget: 999, fee: 5000 }); assert.match(r.error, /budget between/);
  r = await A.act('request', { target: obi.me.id, kind: 'decorate', budget: 50000, fee: 5000 }); assert.equal(r.ok, true);
  await sleep(40); const offer = B.q.filter((m) => m.type === 'state').at(-1).requests.find((x) => x.kind === 'decorate'); assert.equal(offer.budget, 50000); assert.equal(offer.fee, 5000);
  r = await E.act('decorPropose', { items: [{ id: 'sofa', qty: 1 }], estimate: 20000 }); assert.match(r.error, /no decorating job/, 'a stranger can\'t suggest');
  await B.act('respond', { id: offer.id, accept: true }); await sleep(40);
  const visit = B.q.find((m) => m.type === 'visit'); assert.equal(visit.decorate.budget, 50000); assert.equal(visit.decorate.hostName, 'decor_ada');
  assert.ok(A.q.some((m) => m.type === 'decorStart' && m.decorator === obi.me.id));
  r = await B.act('decorPropose', { items: [{ id: 'sofa', qty: 1 }], estimate: 60000 }); assert.match(r.error, /over the budget/);
  r = await B.act('decorPropose', { items: [{ id: 'sofa', qty: 9 }, { id: '../hack', qty: 1 }], estimate: 20000 }); assert.equal(r.ok, true);
  await sleep(40); const prop = A.q.find((m) => m.type === 'decorProposal'); assert.deepEqual(prop.items, [{ id: 'sofa', qty: 4 }], 'quantities are capped and odd ids dropped');
  r = await E.act('decorAnswer', { to: obi.me.id, accepted: true, spent: 20000 }); assert.match(r.error, /No decorator/, 'only the owner answers');
  await A.act('decorAnswer', { to: obi.me.id, accepted: true, spent: 20000 }); await sleep(40);
  const ans = B.q.find((m) => m.type === 'decorAnswer'); assert.equal(ans.left, 30000);
  r = await B.act('decorPropose', { items: [{ id: 'sofa', qty: 1 }], estimate: 35000 }); assert.match(r.error, /over the budget/, 'the budget left is enforced');
  await B.act('decorFinish'); await sleep(40); const fin = A.q.find((m) => m.type === 'decorFinished'); assert.equal(fin.fee, 5000); assert.equal(fin.spent, 20000);
  r = await A.act('pay', { target: obi.me.id, amount: 5000 }); assert.equal(r.ok, true); await sleep(40); assert.ok(B.q.some((m) => m.type === 'paid' && m.amount === 5000));
  r = await B.act('decorPropose', { items: [{ id: 'sofa' }], estimate: 1000 }); assert.match(r.error, /no decorating job/, 'finished means finished');
 } finally { for (const w of sockets) w.close(); await s.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
