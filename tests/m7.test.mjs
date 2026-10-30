// Milestone 7 tests: calendar, weather and power; weekday hours; reputation; keke business; wholesale and
// supply orders; vehicle wear/repair/sale; NPC home picks; save v6. Pure logic, on the real map where it
// matters (no WebGL). Imported by economy.test.mjs.
import assert from 'node:assert/strict';
import { loadWorld } from './helpers/loadWorld.mjs';
import { Economy } from '../src/economy/Economy.js';
import { Inventory } from '../src/economy/Inventory.js';
import { ShopSession } from '../src/economy/Shop.js';
import { calendar, weekdayOf, weatherAt, stormOn, powerAt, outagesOn, trafficFactor, crowdFactor, RAIN_CHANCE } from '../src/sim/Calendar.js';
import { hoursFor, isOpen } from '../src/data/schedule.js';
import { reputation } from '../src/sim/Reputation.js';
import { KekeBusiness, KEKE_BIZ } from '../src/vehicles/KekeBusiness.js';
import { Wholesale, WHOLESALE_LOTS, lotPrice } from '../src/economy/Wholesale.js';
import { VehicleSystem, pickSaleSpots } from '../src/vehicles/VehicleSystem.js';
import { pickHostHome, pickListings } from '../src/housing/HousingSystem.js';
import { TransitNetwork } from '../src/transport/TransitNetwork.js';
import { fareFor } from '../src/transport/transportConfig.js';
import { ITEMS } from '../src/data/catalogue.js';
import { WEAR, VEHICLE_MODELS } from '../src/data/housing.js';
import { migrate, SAVE_VERSION, defaultSave } from '../src/save/SaveSystem.js';

export let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.stack.split('\n').slice(0, 3).join('\n    ')); process.exitCode = 1; } };

const { map, landmarks, graph } = loadWorld();

console.log('Calendar, weather, power');
test('day 1 is a Monday in mid-October; each game day moves the season on a week', () => {
  assert.equal(calendar(1).weekdayName, 'Monday'); assert.equal(calendar(7).weekdayName, 'Sunday'); assert.equal(calendar(8).weekdayName, 'Monday');
  assert.equal(calendar(1).monthName, 'October'); assert.equal(calendar(1).date, 15);
  assert.equal(calendar(4).monthName, 'November'); assert.equal(calendar(1).season, 'rainy');
  assert.equal(calendar(10).season, 'harmattan'); // mid-December
  assert.equal(weekdayOf(15), 0);
  assert.match(calendar(3).label, /^Wednesday · (early|mid|late) (October|November)$/);
});
test('weather is deterministic, ramps smoothly and follows the seasons', () => {
  for (let d = 1; d < 30; d++) for (const m of [0, 400, 900, 1300]) assert.deepEqual(weatherAt(d, m, 42), weatherAt(d, m, 42));
  // rainy days in the rainy months, almost none in harmattan; no harmattan in the rains
  const rainyDays = (from, to) => { let n = 0; for (let d = from; d < to; d++) if (stormOn(d, 7)) n++; return n; };
  let wet = 0, dry = 0;
  for (let s = 0; s < 20; s++) { for (let d = 30; d < 50; d++) if (stormOn(d, s)) wet++; for (let d = 9; d < 16; d++) if (stormOn(d, s)) dry++; } // ~May–Sep vs Dec–Jan
  assert.ok(wet / (20 * 20) > 0.45, `rains in the rainy season (${wet})`); assert.ok(dry / (20 * 7) < 0.12, `dry in harmattan (${dry})`);
  void rainyDays; void RAIN_CHANCE;
  for (let m = 0; m < 1440; m += 30) assert.equal(weatherAt(35, m, 3).harmattan, 0); // June: no harmattan
  const jan = weatherAt(13, 8 * 60, 3); assert.ok(jan.harmattan > 0.4, 'thick haze on a January morning');
  // a storm ramps in: no jump of more than 0.2 a minute
  let found = false;
  for (let d = 1; d < 60 && !found; d++) {
    const s = stormOn(d, 5); if (!s || s.end > 1430) continue; found = true;
    for (let m = s.start - 40; m < s.end + 40; m++) assert.ok(Math.abs(weatherAt(d, m + 1, 5).rain - weatherAt(d, m, 5).rain) < 0.2);
    assert.ok(weatherAt(d, Math.round((s.start + s.end) / 2), 5).rain > 0.3); assert.equal(weatherAt(d, s.end + 60, 5).rain, 0);
  }
  assert.ok(found);
});
test('power cuts: 1–3 a day, back on afterwards, deterministic', () => {
  for (let d = 1; d < 40; d++) {
    const o = outagesOn(d, 9); assert.ok(o.length >= 1 && o.length <= 3);
    for (const c of o) { assert.equal(powerAt(d, c.start, 9).on, false); assert.equal(powerAt(d, c.start, 9).until >= c.end, true); }
  }
  let on = 0; for (let m = 0; m < 1440; m += 10) if (powerAt(5, m, 9).on) on++;
  assert.ok(on > 30, 'there is power for much of the day');
});
test('rush hours, quiet Sunday mornings and rain thin the streets', () => {
  assert.ok(trafficFactor(1, 8) > 1.3 && trafficFactor(1, 17) > 1.3 && trafficFactor(1, 13) === 1);
  assert.ok(trafficFactor(6, 9) < 0.6); assert.ok(trafficFactor(1, 13, 1) < trafficFactor(1, 13, 0));
  assert.ok(crowdFactor(6, 9) < 1 && crowdFactor(2, 12, 1) < 0.4);
});

console.log('Weekday opening hours');
test('markets close on Sunday, shops open after church, Saturday runs late', () => {
  const stall = { kind: 'stall', schedule: [7, 19.5] }, shop = { kind: 'shop', schedule: [7.5, 19] }, rank = { kind: 'rank', schedule: [6, 21] };
  assert.equal(hoursFor(stall, 6), null); assert.equal(isOpen(stall, 6, 12), false); assert.equal(isOpen(stall, 2, 12), true);
  assert.deepEqual(hoursFor(shop, 6), [13, 18.5]); assert.equal(isOpen(shop, 6, 10), false); assert.equal(isOpen(shop, 6, 14), true);
  assert.deepEqual(hoursFor(stall, 5), [7, 20]); assert.deepEqual(hoursFor(rank, 6), [9, 20]);
});

console.log('Reputation');
test('reputation grows with friends and jobs, falls with trouble, and sets discounts', () => {
  assert.equal(reputation({}, []).label, 'New face');
  const rels = {}; for (let i = 0; i < 4; i++) rels['stall:' + i] = { talks: 6, positive: 4, negative: 0 };
  const r = reputation(rels, Array.from({ length: 6 }, () => ({ reward: 500 })));
  assert.ok(r.score >= 35 && r.label === 'Respected' && r.discount > 0 && r.jobBonus > 0, JSON.stringify(r));
  const bad = reputation({ a: { talks: 1, negative: 6, bumps: 5 } }, [{ missed: true }, { missed: true }]);
  assert.equal(bad.label, 'Bad name'); assert.ok(bad.discount < 0);
});
test('a known face pays less in shops (never below the old 82% floor less the discount); hawkers stay fixed', () => {
  const trader = { id: 'stall:5', goods: 'fabrics', role: 'trader' };
  const mk = (discount) => new ShopSession({ trader, rel: { familiarity: 0 }, economy: new Economy({ balance: 1e6 }), inventory: new Inventory({}), discount });
  const item = ITEMS['ankara-6y'];
  assert.ok(mk(0.06).asking(item) < mk(0).asking(item)); assert.ok(mk(0.06).floor(item) < mk(0).floor(item));
  assert.ok(mk(0.06).floor(item) >= Math.round(item.price * 0.82 * 0.94 / 50) * 50 - 50);
  const hawker = new ShopSession({ trader: { id: 'walk:1', role: 'hawker' }, rel: {}, economy: new Economy({ balance: 1e6 }), inventory: new Inventory({}), discount: 0.06 });
  assert.equal(hawker.asking(ITEMS['sachet-water']), ITEMS['sachet-water'].price);
});

console.log('Keke business');
const net = new TransitNetwork({ map, graph, landmarks });
for (const s of net.stops) for (const p of s.platforms) p.queue = [];
const busyPlat = net.stops.find((s) => s.name && s.platforms.length)?.platforms[0];
const mkBiz = (bal = 0, surge = 1) => { const wallet = { balance: bal }, economy = new Economy(wallet), state = {}; return { wallet, state, biz: new KekeBusiness(state, { economy, network: net, surge: () => surge }) }; };
test('pick up from a queue (max 3), each with a real destination stop and the standard keke fare', () => {
  const { biz } = mkBiz();
  busyPlat.queue = [11, 12, 13, 14, 15];
  assert.equal(biz.platformNear(busyPlat.x + 3, busyPlat.z), busyPlat);
  const got = biz.pickUp(busyPlat, 1000);
  assert.equal(got.length, KEKE_BIZ.seats); assert.deepEqual(busyPlat.queue, [14, 15]);
  for (const r of got) {
    const dest = net.stops.find((s) => s.id === r.dest);
    const d = Math.hypot(dest.x - busyPlat.stop.x, dest.z - busyPlat.stop.z);
    assert.ok(d >= KEKE_BIZ.minTrip && d <= KEKE_BIZ.maxTrip);
    assert.equal(r.fare, fareFor('keke', d * 1.3)); assert.ok(r.deadline > 1000);
  }
  assert.equal(biz.pickUp(busyPlat, 1000).length, 0, 'full');
});
test('drop-off pays each passenger exactly once; the rain surge raises fares; late passengers leave unpaid', () => {
  const { biz, wallet, state } = mkBiz(0, 1.3);
  busyPlat.queue = [21, 22];
  const [a, b] = biz.pickUp(busyPlat, 2000);
  const base = fareFor('keke', Math.hypot(net.stops.find((s) => s.id === a.dest).x - busyPlat.stop.x, net.stops.find((s) => s.id === a.dest).z - busyPlat.stop.z) * 1.3);
  assert.ok(a.fare >= base);
  assert.equal(biz.dropOff(a.x + 500, a.z + 500).length, 0, 'nobody gets down in the wrong place');
  const paid = biz.dropOff(a.x, a.z);
  assert.ok(paid.some((p) => p.rider.id === a.id && p.ok));
  const after = wallet.balance;
  state.riders.push({ ...a }); // replayed rider: the key is spent
  const again = biz.dropOff(a.x, a.z).find((p) => p.rider.id === a.id);
  assert.equal(again.ok, false); assert.equal(wallet.balance, after);
  if (state.riders.includes(b)) { const gone = biz.expire(b.deadline + 1); assert.deepEqual(gone.map((r) => r.id), [b.id]); assert.equal(state.riders.length, 0); }
  assert.equal(wallet.balance, state.earned);
});

console.log('Wholesale and supply orders');
const traders = [
  { id: 'stall:2', name: 'Madam Ada', goods: 'fabrics', kind: 'stall', schedule: [7, 19.5], x: 0, z: 0 },
  { id: 'shop:3', name: 'Oga Emeka', goods: 'provisions', kind: 'shop', schedule: [7.5, 19], x: 100, z: 0 },
  { id: 'stall:4', name: 'Mama Uche', goods: 'foodstuff', kind: 'stall', schedule: [7, 19.5], x: 200, z: 0 },
];
const mkW = (bal) => { const wallet = { balance: bal }, inv = new Inventory({ slots: 16, items: [] }), economy = new Economy(wallet), state = {}; return { wallet, inv, state, w: new Wholesale(state, { economy, inventory: inv, traders }) }; };
test('lots cost under half the shop price per piece, a few a day, all-or-nothing', () => {
  for (const l of WHOLESALE_LOTS) assert.ok(lotPrice(l) / l.qty < ITEMS[l.item].price * 0.5, l.id);
  const { w, inv, wallet } = mkW(500000);
  const lot = WHOLESALE_LOTS[0];
  for (let i = 0; i < 3; i++) assert.equal(w.buy(lot.id, 4).ok, true);
  assert.equal(w.buy(lot.id, 4).error, 'sold-out'); assert.equal(inv.count(lot.item), lot.qty * 3);
  assert.equal(w.buy(lot.id, 5).ok, true, 'restocked the next day');
  const poor = mkW(100); assert.equal(poor.w.buy(lot.id, 4).error, 'insufficient-funds'); assert.equal(poor.inv.count(lot.item), 0);
  void wallet;
});
test('wholesale → sell to a trader is a small honest margin (no money loop beyond that)', () => {
  for (const l of WHOLESALE_LOTS) {
    const shop = new ShopSession({ trader: { id: 'stall:1', goods: l.goods, role: 'trader' }, rel: { familiarity: 8 }, economy: new Economy({ balance: 1e6 }), inventory: new Inventory({}) });
    const unit = lotPrice(l) / l.qty, back = shop.sellPrice(l.item);
    assert.ok(back > unit && back < ITEMS[l.item].price, `${l.id}: ${unit} → ${back}`);
  }
});
test('supply orders: posted by traders who sell those goods; deliver once, in time, with the full quantity', () => {
  const { w, inv, wallet } = mkW(0);
  const board = w.board(3); assert.ok(board.length >= 1);
  for (const o of board) { const t = traders.find((x) => x.id === o.trader); assert.ok(WHOLESALE_LOTS.some((l) => l.item === o.item && l.goods === t.goods)); }
  assert.deepEqual(w.board(3), board, 'deterministic');
  const o = board[0];
  assert.equal(w.accept(o).ok, true); assert.equal(w.accept(o).error, 'taken');
  assert.ok(!w.board(3).some((x) => x.id === o.id), 'taken orders leave the board');
  assert.equal(w.deliver(o.id, o.due - 10).error, 'missing-item');
  inv.add(ITEMS[o.item], o.qty);
  const r = w.deliver(o.id, o.due - 10);
  assert.equal(r.ok, true); assert.equal(wallet.balance, o.total); assert.equal(inv.count(o.item), 0);
  assert.equal(w.deliver(o.id, o.due - 10).error, 'no-order');
  // a sunday board only has traders who are open
  const sunday = w.board(7, (t) => isOpen(t, 6, 14));
  for (const x of sunday) assert.equal(traders.find((t) => t.id === x.trader).kind, 'shop');
  // lapsing
  const o2 = w.board(3)[0]; w.accept(o2); assert.deepEqual(w.expire(o2.due + 1).map((x) => x.id), [o2.id]); assert.equal(w.state.orders.length, 0);
});

console.log('Vehicle wear, repair and sale');
const spots = pickSaleSpots(graph, landmarks);
test('crashes dent the car and cut top speed; mechanics fix it; parts fix some; dealers buy back once', () => {
  const wallet = { balance: 500000 }, economy = new Economy(wallet), inv = new Inventory({ slots: 16, items: [] });
  const vs = new VehicleSystem([], { soldVehicles: [] }, { economy, inventory: inv, spots });
  const sp = spots.find((s) => s.model === 'toyota_corolla');
  const v = vs.buy(sp.id).vehicle;
  assert.equal(vs.crash(v, WEAR.crashSpeed - 1), 0, 'a nudge leaves no mark');
  const add = vs.crash(v, 15); assert.ok(add > 0 && v.damage === add);
  assert.ok(vs.maxSpeed(v) < VEHICLE_MODELS.toyota_corolla.maxSpeed);
  for (let i = 0; i < 20; i++) vs.crash(v, 30); assert.equal(v.damage, 100);
  assert.ok(Math.abs(vs.maxSpeed(v) - VEHICLE_MODELS.toyota_corolla.maxSpeed * (1 - WEAR.maxSpeedLoss)) < 1e-9);
  inv.add(ITEMS['spark-plug'], 1); inv.add(ITEMS['engine-oil'], 1);
  assert.deepEqual(vs.partsFor(v).map((p) => p.id), ['engine-oil'], 'spark plugs are for kekes');
  assert.equal(vs.fitPart(v, 'engine-oil').ok, true); assert.equal(v.damage, 100 - WEAR.parts['engine-oil'].fix);
  const lot = vs.standAt(sp.x, sp.z); assert.ok(lot);
  assert.equal(vs.repair(v, null).error, 'no-mechanic');
  const cost = vs.repairQuote(v), bal = wallet.balance;
  assert.equal(vs.repair(v, lot).ok, true); assert.equal(v.damage, 0); assert.equal(bal - wallet.balance, cost);
  assert.equal(vs.repair(v, lot).error, 'no-damage');
  const price = vs.sellQuote(v); assert.equal(price, Math.round(VEHICLE_MODELS.toyota_corolla.price * WEAR.buyBack / 500) * 500);
  assert.equal(vs.sell(v.id, null).error, 'no-buyer');
  const b2 = wallet.balance; assert.equal(vs.sell(v.id, lot).ok, true); assert.equal(wallet.balance - b2, price);
  assert.equal(vs.get(v.id), null); assert.equal(vs.sell(v.id, lot).error, 'no-such-vehicle');
  assert.equal(vs.standAt(sp.x + 2000, sp.z + 2000), null);
});

console.log('Visiting people');
test('an NPC home is a real house near where you met, not a listing, with a reachable door; deterministic', () => {
  const listings = pickListings(map);
  const exclude = new Set(listings.map((l) => l.buildingId));
  const l = landmarks.get('main-market');
  const a = pickHostHome(map, l.x, l.z, { seed: 'stall:12', exclude });
  const b = pickHostHome(map, l.x, l.z, { seed: 'stall:12', exclude });
  assert.ok(a); assert.deepEqual(a, b);
  const bld = map.buildings.find((x) => x.id === a.buildingId);
  assert.equal(bld.kind, 'residential'); assert.ok(!exclude.has(a.buildingId));
  const d = Math.hypot(bld.pts[0][0] - l.x, bld.pts[0][1] - l.z); assert.ok(d >= 40 && d <= 260);
  assert.ok(['selfcon', 'roomparlour', 'flat'].includes(a.interior));
  const c = pickHostHome(map, l.x, l.z, { seed: 'stall:13', exclude });
  assert.ok(c && c.buildingId !== undefined);
});

console.log('Saves');
test('a v5 save migrates to v6: stable weather seed, business and wholesale added, vehicles get damage 0', () => {
  const v5 = { version: 5, createdAt: '2026-01-01', character: { name: 'Ada', gender: 'female' }, clock: { day: 3, minutes: 700 }, wallet: { balance: 5000, ledger: [], processed: [] },
    inventory: { slots: 16, items: [] }, jobs: { list: [], completed: [], log: [], tracked: null }, needs: { energy: 60 }, transit: { seq: 0, log: [] },
    housing: { rentals: {}, storage: {}, lamps: {} }, vehicles: [{ id: 'veh:x', model: 'keke', x: 1, z: 2, heading: 0, fuel: 3 }], relationships: { 'stall:1': { talks: 2 } }, world: { stock: {}, soldVehicles: ['x'] } };
  const a = migrate(structuredClone(v5)), b = migrate(structuredClone(v5));
  assert.equal(a.version, SAVE_VERSION); assert.ok(SAVE_VERSION >= 6);
  assert.ok(Number.isInteger(a.world.weatherSeed)); assert.equal(a.world.weatherSeed, b.world.weatherSeed);
  assert.deepEqual(a.business.riders, []); assert.deepEqual(a.wholesale.orders, []);
  assert.equal(a.vehicles[0].damage, 0); assert.equal(a.wallet.balance, 5000); assert.deepEqual(a.world.soldVehicles, ['x']);
  const fresh = defaultSave({ name: 'B', gender: 'male' }); assert.ok(Number.isInteger(fresh.world.weatherSeed) && fresh.world.weatherSeed >= 0);
});

console.log('Police, church, roads (Milestone 7 follow-ups)');
import { PoliceSystem, pickCheckpoints, manned, speedLimit, POLICE } from '../src/sim/Police.js';
import { inService, isOpen as open2 } from '../src/data/schedule.js';
import { CollisionWorld } from '../src/physics/CollisionWorld.js';
test('checkpoints sit beside real main roads, apart from each other; manned by day, not in heavy rain', () => {
  const posts = pickCheckpoints(graph, landmarks);
  assert.ok(posts.length >= 4);
  for (const p of posts) {
    assert.ok(['trunk', 'primary', 'secondary'].includes(p.road.type));
    assert.ok(!map.onCarriageway(p.x, p.z, 0), 'the post is off the carriageway');
    for (const q of posts) if (q !== p) assert.ok(Math.hypot(q.x - p.x, q.z - p.z) > 300);
  }
  assert.equal(manned(1, 10), true); assert.equal(manned(1, 20), false); assert.equal(manned(6, 10), false); assert.equal(manned(6, 14), true); assert.equal(manned(1, 10, 0.9), false);
  assert.equal(speedLimit({ type: 'primary' }), 50); assert.equal(speedLimit({ type: 'residential' }), 30);
});
test('police: only seen near a post; pay once; flee → wanted, doubled; cannot pay → vehicle held until released', () => {
  const wallet = { balance: 20000 }, economy = new Economy(wallet);
  const posts = [{ id: 'post:a', name: 'A checkpoint', x: 0, z: 0 }];
  const P = new PoliceSystem({}, { economy, posts });
  assert.equal(P.notice('speeding', 500, 0, { open: true, nowS: 0 }), null, 'too far to be seen');
  assert.equal(P.notice('speeding', 10, 0, { open: false, nowS: 0 }), null, 'nobody at the post');
  const s = P.notice('speeding', 10, 0, { open: true, nowS: 0 });
  assert.equal(s.amount, POLICE.fines.speeding);
  assert.equal(P.progress(10, 0, 5, 1), 'pending'); assert.equal(P.progress(3, 0, 0, 1), 'stopped'); assert.equal(P.progress(400, 0, 9, 1), 'fled');
  assert.equal(P.pay().ok, true); assert.equal(wallet.balance, 20000 - POLICE.fines.speeding); assert.equal(P.pay().error, 'no-stop');
  P.notice('wrong-way', 10, 0, { open: true, nowS: 0 }); P.flee();
  assert.equal(P.state.wanted, 1); assert.equal(P.owedTotal(), POLICE.fines['wrong-way']);
  const s2 = P.notice('wanted', 20, 0, { open: true, nowS: 10 });
  assert.equal(s2.amount, POLICE.fines['wrong-way'] * 2);
  wallet.balance = 100;
  assert.equal(P.pay().error, 'insufficient-funds'); assert.equal(wallet.balance, 100);
  const h = P.hold('veh:1'); assert.equal(h.post, 'post:a');
  assert.equal(P.release('veh:1').ok, false); wallet.balance = 50000;
  assert.equal(P.release('veh:1').ok, true); assert.equal(P.state.wanted, 0); assert.equal(P.release('veh:1').error, 'not-held');
  // a respected name gets one warning a day, never for hurting someone
  P.notice('speeding', 10, 0, { open: true, nowS: 20 }); assert.equal(P.plead(3, 5).warned, true);
  P.notice('speeding', 10, 0, { open: true, nowS: 30 }); assert.equal(P.plead(3, 5).ok, false); P.pay();
  P.notice('hit-person', 10, 0, { open: true, nowS: 40 }); assert.equal(P.plead(4, 6).ok, false);
});
test('reputation counts running from the police against you', () => {
  const rels = {}; for (let i = 0; i < 4; i++) rels['s' + i] = { talks: 6, positive: 4 };
  assert.ok(reputation(rels, [], { wanted: 2, owed: [{}, {}] }).score < reputation(rels, []).score);
});
test('Sunday Mass: churchgoers outside before and after, inside during it', () => {
  const c = { kind: 'church', schedule: [7.5, 12.5] };
  assert.equal(open2(c, 6, 8), true); assert.equal(open2(c, 6, 10), false); assert.equal(open2(c, 6, 11.5), true); assert.equal(open2(c, 2, 8), false);
  assert.equal(inService(6, 10), true); assert.equal(inService(6, 8), false); assert.equal(inService(3, 10), false);
});
test('the carriageway test finds roads (and not footpaths or flyover decks); collision shapes can be removed', () => {
  const r = map.roads.find((x) => !x.elevated && x.type === 'primary');
  const [x, z] = r.points[1];
  assert.ok(map.onCarriageway(x, z)); assert.equal(map.onCarriageway(x + 5000, z + 5000), null);
  const col = new CollisionWorld();
  const ci = col.addCircle(0, 0, 1); assert.equal(col.isFree(0, 0, 0.5), false); col.removeCircle(ci); assert.equal(col.isFree(0, 0, 0.5), true);
  const pi = col.addPolygon([[-1, -1], [1, -1], [1, 1], [-1, 1]]); assert.equal(col.isFree(0, 0, 0.2), false); col.removePolygon(pi); assert.equal(col.isFree(0, 0, 0.2), true);
});
test('a v6 save gains a clean police record (v7)', () => {
  const m = migrate({ version: 6, character: { name: 'A', gender: 'male' }, clock: { day: 2, minutes: 600 }, wallet: { balance: 10, ledger: [], processed: [] }, vehicles: [], world: { weatherSeed: 5 } });
  assert.equal(m.version, SAVE_VERSION); assert.deepEqual(m.police, { seq: 0, wanted: 0, owed: [], warned: null, held: {} }); assert.equal(m.world.weatherSeed, 5);
});
