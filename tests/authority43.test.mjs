// v0.43 server authority: the rules the account server applies (pure), and the real server with the browser's client.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const store = new Map();
const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
globalThis.window = { localStorage: ls }; globalThis.localStorage = ls;
const { openAuthority, applySync, normaliseSave, INCOME_RULES, watDate, AUTH } = await import('../src/authority/Policy.js');
const { Economy } = await import('../src/economy/Economy.js');
const { AuthorityClient } = await import('../src/authority/AuthorityClient.js');
const { CloudSave } = await import('../src/save/CloudSave.js');
const { SaveSystem, defaultSave } = await import('../src/save/SaveSystem.js');
const { createService } = await import('../server/service.mjs');
const T0 = Date.UTC(2026, 9, 24, 9, 0, 0), DAY = 86_400_000;
const e = (ledger, key, amount, reason = 'Shift pay: Developer') => ({ ledger, key, amount, reason });
const open = (wallet = 10000, extra = {}) => openAuthority('life-1', { wallet: { balance: wallet }, ...extra }, T0, 'browser');

test('the server keeps the balance: spending needs the money; the same transaction never counts twice', () => {
 const a = open(10000);
 let r = applySync(a, { entries: [e('wallet', 'buy:1', -4000, 'Shoprite: rice'), e('wallet', 'buy:1', -4000, 'Shoprite: rice'), e('wallet', 'buy:2', -9000, 'Shoprite: tv')] }, T0);
 assert.equal(r.balances.wallet, 6000); assert.equal(r.accepted, 1); assert.equal(r.rejected.length, 1); assert.match(r.rejected[0].why, /not enough money/);
 r = applySync(a, { entries: [e('wallet', 'buy:1', -4000)] }, T0); assert.equal(r.balances.wallet, 6000, 'replayed: ignored');
 r = applySync(a, { entries: [{ ledger: 'nowhere', key: 'x', amount: 5 }, e('wallet', 'y', 1.5)] }, T0); assert.equal(r.rejected.length, 2);
});

test('moving money between your own accounts is never earnings, and is never capped', () => {
 const a = open(5_000_000, { bank: { open: true, account: { balance: 0 } } });
 const r = applySync(a, { entries: [e('wallet', 'dep:1:out', -4_000_000, 'Deposit'), e('bank', 'dep:1:in', 4_000_000, 'Deposit'), e('bank', 'k:fund', -100_000, 'Escrow for: x'), e('escrow:k', 'k:fund', 100_000, 'Funded'), e('wallet', 'w:9:out', -1000, 'x'), e('wallet', 'w:9:undo', 1000, 'x reversed')] }, T0);
 assert.equal(r.rejected.length, 0); assert.deepEqual([r.balances.wallet, r.balances.bank, r.balances['escrow:k']], [1_000_000, 3_900_000, 100_000]);
 const fake = applySync(a, { entries: [e('bank', 'magic:in', 500_000, 'Deposit')] }, T0); assert.equal(fake.rejected.length, 1, 'a credit with no matching debit is not a transfer');
});

test('earnings must be possible: within what the work pays at once and in a day', () => {
 const shift = INCOME_RULES.find((r) => r.id === 'wages');
 const a = open(0);
 let r = applySync(a, { entries: [e('wallet', 's1', shift.max), e('wallet', 's2', 5_000_000)] }, T0); assert.equal(r.balances.wallet, shift.max); assert.match(r.rejected[0].why, /shift pay/);
 r = applySync(a, { entries: [1, 2, 3, 4].map((i) => e('wallet', `s${i + 2}`, shift.max)) }, T0); assert.ok(r.rejected.some((x) => /in a day/.test(x.why)));
 const next = applySync(a, { entries: [e('wallet', 's9', shift.max)] }, T0 + DAY); assert.equal(next.rejected.length, 0, 'a new day in Onitsha, a new day\'s pay');
 r = applySync(a, { entries: [e('wallet', 'odd', 60_000, 'Free money'), e('wallet', 'loot', 900_000, 'Robbery proceeds'), e('wallet', 'loot2', 9_000_000, 'Robbery proceeds')] }, T0 + DAY);
 assert.deepEqual(r.rejected.map((x) => x.key), ['odd', 'loot2']);
 r = applySync(a, { entries: [e('wallet', 'st1', 1000, 'Starting funds: Trader')] }, T0 + DAY); assert.match(r.rejected[0].why, /only come once/);
 assert.equal(watDate(Date.UTC(2026, 9, 24, 23, 30)), '2026-10-25', 'days follow Onitsha time (WAT)');
});

test('property: you can only sell what you paid for on this account, once, for no more than it cost', () => {
 const a = open(3_000_000);
 let r = applySync(a, { entries: [e('wallet', 'sell-vehicle:veh:ghost', 900_000, 'Sold your car at Iweka')] }, T0); assert.match(r.rejected[0].why, /never paid for/);
 r = applySync(a, { entries: [e('wallet', 'buy-vehicle:lot1', -1_000_000, 'Bought car'), e('wallet', 'sell-vehicle:veh:lot1', 2_000_000, 'Sold your car')] }, T0); assert.match(r.rejected[0].why, /more than the vehicle cost/);
 r = applySync(a, { entries: [e('wallet', 'sell-vehicle:veh:lot1', 700_000, 'Sold your car'), e('wallet', 'sell-vehicle:veh:lot1#2', 700_000, 'Sold your car')] }, T0);
 assert.equal(r.accepted, 1); assert.equal(r.rejected.length, 1);
 const b = open(0, { vehicles: [{ id: 'veh:mine', model: 'keke' }] }); assert.deepEqual(applySync(b, { property: { vehicles: ['veh:mine', 'veh:edited-in'] } }, T0).unverified.vehicles, ['veh:edited-in']);
});

test('the legal record is append-only; convictions never go down; reputation moves at most 30 a day', () => {
 const rec = [{ id: 'rec:1', day: 1, kind: 'fine', text: 'Fine', status: 'closed' }, { id: 'rec:2', day: 2, kind: 'conviction', text: 'Convicted', status: 'closed' }];
 const a = openAuthority('life-1', { wallet: { balance: 0 }, life: { record: { entries: rec }, standing: { public: 10, integrity: 0, notoriety: 0, business: 0, social: 0, prof: {} } }, justice: { convictions: 1 } }, T0, 'browser');
 let r = applySync(a, { record: [rec[0]], convictions: 0, standing: { public: 95, integrity: -90, notoriety: 0, business: 0, social: 0, prof: { tech: 80 } } }, T0);
 assert.deepEqual(r.record.map((x) => x.id), ['rec:2'], 'the deleted conviction comes back'); assert.equal(r.convictions, 1);
 assert.equal(r.standing.public, 40); assert.equal(r.standing.integrity, -30); assert.equal(r.standing.prof.tech, 30);
 r = applySync(a, { record: rec, standing: { public: 95, integrity: 0, notoriety: 0, business: 0, social: 0, prof: {} } }, T0 + DAY); assert.equal(r.standing.public, 70, 'the next day it can move again');
});

test('a save sent to the server is corrected to its books before it is stored; nothing you own is removed', () => {
 const a = open(5000, { vehicles: [{ id: 'veh:a', model: 'keke' }] });
 const d = defaultSave({ name: 'A', gender: 'male', ageGroup: 'adult' }); d.wallet.balance = 9_999_999; d.vehicles = [{ id: 'veh:a', model: 'keke' }, { id: 'veh:b', model: 'keke' }]; d.justice.convictions = 0; a.convictions = 2;
 const out = normaliseSave(a, d); assert.equal(out.data.wallet.balance, 5000); assert.equal(out.data.vehicles.length, 2); assert.equal(out.data.justice.convictions, 2); assert.ok(out.corrected.includes('wallet'));
 assert.ok(AUTH.dayTotal > 0);
});

test('the real account server with the browser\'s client: earnings counted, tampering corrected, offline untouched', async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow43-auth-')); const s = createService({ dataDir: dir }); await s.listen(0);
 const base = `http://127.0.0.1:${s.server.address().port}`; CloudSave.fetcher = (url, o) => fetch(base + url, o);
 try {
  const reg = await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'auth_ada', password: 'auth-qa-password', adult: true }) })).json();
  const id = reg.me.id; SaveSystem.setScope(id);
  const d = defaultSave({ name: 'Ada', gender: 'female', ageGroup: 'adult' }); d.wallet.balance = 20000; d.createdAt = 'life-ada';
  const toasts = [], g = { saveData: d, bus: { emit() {} }, ui: { toast: (t) => toasts.push(t) }, clock: { day: 1 }, saveGame() {} };
  const client = new AuthorityClient(g); clearInterval(client.interval);
  const wallet = new Economy(d.wallet);
  // offline: nothing is sent, nothing changes
  CloudSave.userId = null; wallet.transact({ key: 'off:1', amount: 500, reason: 'Shift pay: x' }); assert.equal(await client.sync(), false); assert.equal(d.wallet.balance, 20500);
  // signed in: the first sync opens the books from this game
  CloudSave.attach(id, reg.token); CloudSave.state = 'synced';
  assert.equal(await client.sync(), true); assert.equal(d.authority.opened, 'life-ada');
  wallet.transact({ key: 'shift:1', amount: 3000, reason: 'Shift pay: Developer' }); wallet.transact({ key: 'buy:1', amount: -1500, reason: 'Shoprite: rice' });
  assert.equal(d.authority.queue.length, 2); await client.sync(); assert.equal(d.wallet.balance, 22000); assert.equal(d.authority.queue.length, 0);
  // tampering with the save directly: corrected back
  d.wallet.balance = 9_000_000; await client.sync(); assert.equal(d.wallet.balance, 22000); assert.match(d.wallet.ledger.at(-1).reason, /account server/);
  // an impossible payment: refused, and the money taken back out
  wallet.transact({ key: 'cheat:1', amount: 5_000_000, reason: 'Shift pay: Developer' }); await client.sync();
  assert.equal(d.wallet.balance, 22000); assert.ok(toasts.some((t) => /didn't accept/.test(t))); assert.equal(d.authority.rejected.at(-1).key, 'cheat:1');
  // a tampered save uploaded to the cloud is stored as the server's books say
  d.wallet.balance = 7_777_777; SaveSystem.save(d); const up = await CloudSave.doPush({ always: true }); assert.equal(up, true);
  const stored = JSON.parse((await s.store.getSave(id)).raw); assert.equal(stored.wallet.balance, 22000);
  const view = await (await fetch(base + '/api/authority', { headers: { Authorization: `Bearer ${reg.token}` } })).json(); assert.equal(view.authority.balances.wallet, 22000); assert.ok(view.authority.stats.rejected >= 1);
 } finally { CloudSave.userId = null; await s.close?.(); s.server?.close?.(); }
});
