// Run with: npm test   (plain Node, no test framework needed)
import assert from 'node:assert/strict';
import { Economy } from '../src/economy/Economy.js';
import { Inventory } from '../src/economy/Inventory.js';
import { ShopSession } from '../src/economy/Shop.js';
import { JobSystem } from '../src/jobs/JobSystem.js';
import { ITEMS } from '../src/data/catalogue.js';
import { StockBook } from '../src/economy/Stock.js';
import { Needs } from '../src/player/Needs.js';
import { MAX_JOBS } from '../src/jobs/JobSystem.js';
import { migrate, SAVE_VERSION } from '../src/save/SaveSystem.js';

let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.message); process.exitCode = 1; } };

console.log('Economy');
test('credits and debits whole naira', () => {
  const e = new Economy({ balance: 1000 });
  assert.equal(e.transact({ key: 'a', amount: 500, reason: 't' }).balance, 1500);
  assert.equal(e.transact({ key: 'b', amount: -200, reason: 't' }).balance, 1300);
});
test('refuses insufficient funds with no change', () => {
  const s = { balance: 100 }; const e = new Economy(s);
  const r = e.transact({ key: 'x', amount: -101, reason: 't' });
  assert.equal(r.ok, false); assert.equal(r.error, 'insufficient-funds'); assert.equal(s.balance, 100); assert.equal(s.ledger.length, 0);
});
test('idempotency: the same key is never applied twice', () => {
  const s = { balance: 0 }; const e = new Economy(s);
  assert.ok(e.transact({ key: 'reward:1', amount: 800, reason: 'job' }).ok);
  const again = e.transact({ key: 'reward:1', amount: 800, reason: 'job' });
  assert.equal(again.ok, false); assert.equal(again.error, 'duplicate'); assert.equal(s.balance, 800);
});
test('idempotency survives a save/load round trip', () => {
  const s = { balance: 0 }; new Economy(s).transact({ key: 'k1', amount: 50, reason: 't' });
  const loaded = JSON.parse(JSON.stringify(s)); const e2 = new Economy(loaded);
  assert.equal(e2.transact({ key: 'k1', amount: 50, reason: 't' }).error, 'duplicate'); assert.equal(loaded.balance, 50);
});
test('rejects fractional, zero and non-numeric amounts', () => {
  const e = new Economy({ balance: 100 });
  for (const amount of [0, 1.5, NaN, Infinity, '50']) assert.equal(e.transact({ key: 'z' + amount, amount, reason: 't' }).error, 'invalid-amount');
});

console.log('Shop');
const trader = { id: 'stall:1', name: 'Mama Test', role: 'trader', goods: 'provisions' };
test('asking price is at least base and bargaining never goes below the floor', () => {
  const shop = new ShopSession({ trader, rel: { familiarity: 0 }, economy: new Economy({ balance: 1e6 }), inventory: new Inventory({}), visit: 1 });
  const item = shop.items[0];
  const ask = shop.asking(item); assert.ok(ask >= item.price);
  for (let i = 0; i < 5; i++) shop.haggle(item.id);
  assert.ok(shop.asking(item) >= shop.floor(item)); assert.ok(shop.asking(item) <= ask);
});
test('buying debits once and adds to the bag', () => {
  const ws = { balance: 5000 }, inv = new Inventory({});
  const shop = new ShopSession({ trader, rel: { familiarity: 0 }, economy: new Economy(ws), inventory: inv, visit: 2 });
  const item = shop.items.find((i) => i.id === 'malt');
  const r = shop.buy('malt'); assert.ok(r.ok);
  assert.equal(ws.balance, 5000 - r.total); assert.equal(inv.count('malt'), 1); assert.equal(ws.ledger.length, 1);
  void item;
});
test('cannot buy what you cannot afford — no money moves, nothing added', () => {
  const ws = { balance: 100 }, inv = new Inventory({});
  const shop = new ShopSession({ trader, rel: { familiarity: 0 }, economy: new Economy(ws), inventory: inv, visit: 3 });
  const r = shop.buy('noodles'); assert.equal(r.ok, false); assert.equal(r.error, 'insufficient-funds');
  assert.equal(ws.balance, 100); assert.equal(inv.count('noodles'), 0);
});
test('full bag blocks the purchase before payment', () => {
  const ws = { balance: 99999 }, inv = new Inventory({ slots: 1 });
  inv.add({ id: 'x', name: 'X' });
  const shop = new ShopSession({ trader, rel: { familiarity: 0 }, economy: new Economy(ws), inventory: inv, visit: 4 });
  const r = shop.buy('malt'); assert.equal(r.error, 'bag-full'); assert.equal(ws.balance, 99999);
});

console.log('Jobs');
const residents = [
  { id: 'stall:1', role: 'trader', name: 'Mama A', goods: 'provisions', x: 0, z: 0, schedule: [7, 19.5] },
  { id: 'stall:2', role: 'trader', name: 'Oga B', goods: 'fabrics', x: 400, z: 0, schedule: [7, 19.5] },
  { id: 'stall:3', role: 'trader', name: 'Madam C', goods: 'foodstuff', x: 0, z: 600, schedule: [7, 19.5] },
];
const clock = { now: 0 };
const mk = (bal = 0) => { const wallet = { balance: bal }, inv = new Inventory({}); const eco = new Economy(wallet); return { wallet, inv, eco, jobs: new JobSystem({}, { economy: eco, inventory: inv, residents, now: () => clock.now }) }; };
// offers made at 09:00 on their day; the test clock is set to that moment
const findOffer = (jobs, type, giver = residents[0], skip = new Set()) => { for (let d = 1; d < 400; d++) { const o = jobs.offerFor(giver, d, d * 1440 + 540); if (o && o.type === type && !skip.has(o.id)) { clock.now = d * 1440 + 540; return o; } } return null; };
test('delivery: parcel goes in the bag, reward paid once on delivery', () => {
  const { wallet, inv, jobs } = mk();
  const job = findOffer(jobs, 'deliver'); assert.ok(job);
  assert.ok(jobs.accept(job).ok); assert.ok(inv.has(job.package.id));
  assert.equal(jobs.doStep(residents[0].id).ok, false);           // wrong person
  const done = jobs.doStep(job.target); assert.ok(done.completed); assert.equal(wallet.balance, job.reward);
  assert.equal(inv.has(job.package.id), false); assert.equal(jobs.list.length, 0);
  assert.equal(jobs.offerFor(residents[0], job.day, clock.now), null); // can't repeat the same job
});
test('collect: pick up then return; reward only at the end', () => {
  const { wallet, inv, jobs } = mk();
  const job = findOffer(jobs, 'collect'); assert.ok(job);
  jobs.accept(job); assert.equal(inv.has(job.package.id), false);
  assert.ok(jobs.doStep(job.target).advanced); assert.equal(wallet.balance, 0); assert.ok(inv.has(job.package.id));
  assert.ok(jobs.doStep(job.giver).completed); assert.equal(wallet.balance, job.reward);
});
test('errand: refuses without the item, pays item price + tip with it', () => {
  const { wallet, inv, jobs } = mk();
  const job = findOffer(jobs, 'errand'); assert.ok(job);
  jobs.accept(job);
  assert.equal(jobs.doStep(job.giver).error, 'missing-item'); assert.equal(wallet.balance, 0);
  inv.add(ITEMS[job.item], 1);
  const r = jobs.doStep(job.giver); assert.ok(r.completed); assert.equal(wallet.balance, ITEMS[job.item].price + job.tip);
});
test('several jobs at once, up to the limit; abandoning removes the parcel and pays nothing', () => {
  const { wallet, inv, jobs } = mk();
  const taken = new Set();
  for (let k = 0; k < MAX_JOBS; k++) {
    const giver = residents[k % residents.length];
    const job = findOffer(jobs, k === 0 ? 'deliver' : 'collect', giver, taken) ?? findOffer(jobs, 'errand', giver, taken);
    assert.ok(job, 'offer ' + k); taken.add(job.id);
    assert.ok(jobs.accept(job).ok, 'accept ' + k);
  }
  assert.equal(jobs.list.length, MAX_JOBS);
  const extra = findOffer(jobs, 'errand', residents[2], taken);
  assert.equal(jobs.accept(extra).error, 'too-many');
  const first = jobs.list[0];
  assert.ok(jobs.abandon(first.id).ok); assert.equal(inv.has(first.package.id), false); assert.equal(wallet.balance, 0);
  assert.equal(jobs.list.length, MAX_JOBS - 1);
});
test('deadlines: a job past its deadline fails, the parcel goes back, nothing is paid', () => {
  const { wallet, inv, jobs } = mk();
  const job = findOffer(jobs, 'deliver'); assert.ok(Number.isFinite(job.deadline) && job.deadline > clock.now);
  assert.ok(job.deadline <= job.day * 1440 + 19.5 * 60, 'never after the shop closes');
  jobs.accept(job); assert.ok(inv.has(job.package.id));
  clock.now = job.deadline + 1;
  const r = jobs.doStep(job.target); assert.equal(r.error, 'expired');
  assert.equal(inv.has(job.package.id), false); assert.equal(wallet.balance, 0); assert.equal(jobs.list.length, 0);
  assert.ok(jobs.state.log.at(-1).missed);
});
test('deadlines: update() expires overdue jobs; on-time hand-in still pays', () => {
  const { wallet, jobs } = mk();
  const a = findOffer(jobs, 'deliver'); jobs.accept(a);
  clock.now = a.deadline - 1; jobs.update(); assert.equal(jobs.list.length, 1);
  assert.ok(jobs.doStep(a.target).completed); assert.equal(wallet.balance, a.reward);
  const b = findOffer(jobs, 'collect', residents[1]); jobs.accept(b);
  clock.now = b.deadline + 5; jobs.update(); assert.equal(jobs.list.length, 0); assert.equal(wallet.balance, a.reward);
});
test('no offer late in the day when there is no time left before closing', () => {
  const { jobs } = mk();
  let offered = 0;
  for (let d = 1; d < 60; d++) if (jobs.offerFor(residents[0], d, d * 1440 + 19.3 * 60)) offered++;
  assert.equal(offered, 0);
});

console.log('Stock, selling and using goods');
test('stock is limited: buying runs it down and refuses when sold out', () => {
  const ws = { balance: 1e6 }, inv = new Inventory({ slots: 40 });
  const stock = { 'bread': 2 };
  const shop = new ShopSession({ trader, rel: { familiarity: 0 }, economy: new Economy(ws), inventory: inv, visit: 9, stock });
  assert.ok(shop.buy('bread').ok); assert.ok(shop.buy('bread').ok);
  const bal = ws.balance;
  const r = shop.buy('bread'); assert.equal(r.error, 'sold-out'); assert.equal(ws.balance, bal); assert.equal(inv.count('bread'), 2);
});
test('opening stock is deterministic per trader and day, and restocks the next day', () => {
  const book = new StockBook({});
  const a = book.forTrader(trader, 3); const copy = { ...a };
  a.malt = 0;
  assert.equal(book.forTrader(trader, 3).malt, 0);
  assert.deepEqual(StockBook.opening(trader.id, 'provisions', 3), copy);
  assert.ok(book.forTrader(trader, 4).malt >= 0); assert.equal(Object.keys(book.state).length, 1);
});
test('selling: credits once, removes the item, always below the buying floor', () => {
  const ws = { balance: 0 }, inv = new Inventory({});
  inv.add(ITEMS.malt, 2); inv.add({ id: 'pkg:x', name: 'Parcel', kind: 'package', unique: true });
  const shop = new ShopSession({ trader, rel: { familiarity: 8 }, economy: new Economy(ws), inventory: inv, visit: 10, stock: {} });
  const price = shop.sellPrice('malt');
  assert.ok(price > 0 && price < shop.floor(ITEMS.malt));
  const r = shop.sell('malt'); assert.ok(r.ok); assert.equal(ws.balance, price); assert.equal(inv.count('malt'), 1); assert.equal(shop.stock.malt, 1);
  assert.equal(shop.sell('pkg:x').error, 'not-buying');
  assert.equal(shop.sell('ankara-6y').error, 'not-buying');   // a provisions trader doesn't buy fabric
  assert.ok(!shop.sellable().some((s) => s.id === 'pkg:x'));
});
test('eating restores energy and uses up the item; raw foodstuff cannot be eaten', () => {
  const inv = new Inventory({}); const needs = new Needs({ energy: 20 });
  inv.add(ITEMS.gala, 1); inv.add(ITEMS.garri, 1);
  const r = needs.use(inv, 'gala'); assert.ok(r.ok); assert.equal(needs.energy, 35); assert.equal(inv.count('gala'), 0);
  assert.equal(needs.use(inv, 'garri').error, 'not-usable'); assert.equal(inv.count('garri'), 1);
  assert.equal(needs.use(inv, 'gala').error, 'missing-item');
});
test('opening a bag of pure water gives 20 sachets', () => {
  const inv = new Inventory({}); const needs = new Needs({ energy: 50 });
  inv.add(ITEMS['pure-water'], 1);
  assert.ok(needs.use(inv, 'pure-water').ok); assert.equal(inv.count('sachet-water'), 20); assert.equal(inv.count('pure-water'), 0);
});
test('energy drains faster when running, recovers while riding, and low energy slows running', () => {
  const a = new Needs({ energy: 50 }), b = new Needs({ energy: 50 }), c = new Needs({ energy: 50 });
  a.update(10, { moving: true }); b.update(10, { running: true }); c.update(10, { riding: true });
  assert.ok(b.energy < a.energy && a.energy < 50 && c.energy > 50);
  assert.equal(new Needs({ energy: 60 }).runFactor(), 1); assert.ok(new Needs({ energy: 5 }).runFactor() < 0.6);
});

console.log('Save migration');
test('a v3 save moves its single job into the list and gains energy, transit and stock', () => {
  const v3 = { version: 3, character: { name: 'A', gender: 'male' }, clock: { day: 2, minutes: 600 }, wallet: { balance: 1234, ledger: [], processed: ['k'] },
    inventory: { slots: 16, items: [] }, jobs: { active: { id: 'job:x:d2', steps: [], step: 0 }, completed: [], log: [] }, relationships: { 'stall:1': { talks: 3 } }, world: { heard: ['ote'] } };
  const m = migrate(v3);
  assert.equal(m.version, SAVE_VERSION); assert.equal(m.wallet.balance, 1234); assert.equal(m.jobs.list.length, 1); assert.equal(m.jobs.active, undefined);
  assert.equal(m.jobs.tracked, 'job:x:d2'); assert.equal(m.needs.energy, 85); assert.deepEqual(m.transit.log, []);
  assert.deepEqual(m.world.stock, {}); assert.deepEqual(m.world.heard, ['ote']); assert.equal(m.relationships['stall:1'].talks, 3);
  // the migrated job has no deadline and survives JobSystem loading
  const js = new JobSystem(m.jobs, { economy: new Economy(m.wallet), inventory: new Inventory(m.inventory), residents, now: () => 1e9 });
  js.update(); assert.equal(js.list.length, 1);
});

await import('./transport.test.mjs').then((m) => { passed += m.passed; });
await import('./m6.test.mjs').then((m) => { passed += m.passed; });
await import('./m7.test.mjs').then((m) => { passed += m.passed; });
await import('./m9.test.mjs').then((m) => { passed += m.passed; });
await import('./m10.test.mjs').then((m) => { passed += m.passed; });
await import('./clockfix.test.mjs').then((m) => { passed += m.passed; });
await import('./wardrobe.test.mjs').then((m) => { passed += m.passed; });
await import('./lifestart.test.mjs').then((m) => { passed += m.passed; });
await import('./story.test.mjs').then((m) => { passed += m.passed; });
await import('./career-progression.test.mjs').then((m) => { passed += m.passed; });
await import('./audit.test.mjs').then((m) => { passed += m.passed; });
await import('./shoprite.test.mjs').then((m) => { passed += m.passed; });
console.log(`\n${passed} passed${process.exitCode ? ', some FAILED' : ''}`);
