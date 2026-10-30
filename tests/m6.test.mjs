// Milestone 6 tests: homes, cooking, vehicles, fuel, skip-drive routing, fare bargaining, clock skips, save v5.
// Pure logic on the real Onitsha map (no WebGL). Imported by economy.test.mjs.
import assert from 'node:assert/strict';
import { loadWorld } from './helpers/loadWorld.mjs';
import { Economy } from '../src/economy/Economy.js';
import { Inventory } from '../src/economy/Inventory.js';
import { HousingSystem, pickListings } from '../src/housing/HousingSystem.js';
import { cook, recipeStatus } from '../src/housing/Kitchen.js';
import { VehicleSystem, pickSaleSpots, planDrive } from '../src/vehicles/VehicleSystem.js';
import { TransitNetwork } from '../src/transport/TransitNetwork.js';
import { TransitFleet } from '../src/transport/TransitFleet.js';
import { TripSystem } from '../src/transport/TripSystem.js';
import { MODES } from '../src/transport/transportConfig.js';
import { HOME_TYPES, RENT_GRACE_DAYS, VEHICLE_MODELS, FUEL } from '../src/data/housing.js';
import { ITEMS } from '../src/data/catalogue.js';
import { SimClock } from '../src/sim/SimClock.js';
import { migrate, SAVE_VERSION } from '../src/save/SaveSystem.js';
import { mulberry32, pointInPolygon } from '../src/core/utils.js';

export let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.stack.split('\n').slice(0, 3).join('\n    ')); process.exitCode = 1; } };

const { map, landmarks, graph } = loadWorld();
const DAY = 1440;

console.log('Homes');
const listings = pickListings(map);
const mkHousing = (balance = 100000, now = { t: DAY + 600 }) => {
  const wallet = { balance }; const economy = new Economy(wallet);
  return { wallet, economy, now, h: new HousingSystem({}, { economy, listings, now: () => now.t }) };
};
test('listings: real residential houses of each type, deterministic, doors on the front edge facing out', () => {
  const again = pickListings(map);
  assert.deepEqual(again.map((l) => l.id), listings.map((l) => l.id));
  for (const [type, T] of Object.entries(HOME_TYPES)) assert.ok(listings.filter((l) => l.type === type).length >= 2, `${type} listed`);
  const byId = new Map(map.buildings.map((b) => [`home:${b.id}`, b]));
  for (const l of listings) {
    const b = byId.get(l.id); assert.ok(b && b.kind === 'residential');
    assert.ok(!pointInPolygon(l.door.stand.x, l.door.stand.z, b.pts), 'you stand outside the door');
    assert.ok(l.area >= HOME_TYPES[l.type].area[0] && l.area <= HOME_TYPES[l.type].area[1]);
  }
});
test('rent: one charge per period, no double charge, renew extends from the end of the period', () => {
  const { wallet, h, now } = mkHousing(20000);
  const home = listings.find((l) => l.type === 'selfcon');
  const r = h.rent(home.id); assert.ok(r.ok);
  assert.equal(wallet.balance, 20000 - home.rent); assert.equal(h.status(home.id), 'tenant');
  assert.equal(h.state.rentals[home.id].until, now.t + home.days * DAY);
  // paying again right away (a double tap) renews once for the next period — it can't stack further ahead
  const r2 = h.rent(home.id); assert.ok(r2.ok); assert.equal(wallet.balance, 20000 - 2 * home.rent);
  const r3 = h.rent(home.id); assert.equal(r3.error, 'paid-ahead'); assert.equal(wallet.balance, 20000 - 2 * home.rent);
  assert.equal(h.state.rentals[home.id].until, now.t + 2 * home.days * DAY);
  assert.equal(wallet.ledger.length, 2);
});
test('rent: refused without the money — nothing changes', () => {
  const { wallet, h } = mkHousing(1000);
  const home = listings.find((l) => l.type === 'flat');
  const r = h.rent(home.id); assert.equal(r.error, 'insufficient-funds');
  assert.equal(wallet.balance, 1000); assert.equal(h.status(home.id), 'vacant');
});
test('access: tenant uses everything; vacant can be viewed, not used; expired → due (locked) → back on the market', () => {
  const { h, now } = mkHousing();
  const home = listings[0];
  assert.deepEqual([h.access(home.id).enter, h.access(home.id).use], [true, false]);       // viewing
  h.rent(home.id);
  assert.deepEqual([h.access(home.id).enter, h.access(home.id).use], [true, true]);
  now.t += home.days * DAY + 1;
  assert.equal(h.status(home.id), 'due'); assert.equal(h.access(home.id).enter, false);
  now.t += RENT_GRACE_DAYS * DAY;
  assert.equal(h.status(home.id), 'vacant');
  assert.equal(h.access('home:does-not-exist').enter, false);
});
test('renewing during the grace period continues the old period (no free days, no gap)', () => {
  const { h, now } = mkHousing();
  const home = listings[1];
  h.rent(home.id); const until = h.state.rentals[home.id].until;
  now.t = until + 300; assert.equal(h.status(home.id), 'due');
  assert.ok(h.rent(home.id).ok);
  assert.equal(h.state.rentals[home.id].until, until + home.days * DAY);
  assert.equal(h.status(home.id), 'tenant');
});
test('the cupboard keeps its things across rent periods', () => {
  const { h, now } = mkHousing();
  const home = listings[2]; h.rent(home.id);
  const store = new Inventory(h.storage(home.id)); store.add(ITEMS.bread, 2);
  now.t += 30 * DAY; // long gone
  assert.equal(h.status(home.id), 'vacant'); h.rent(home.id);
  assert.equal(new Inventory(h.storage(home.id)).count('bread'), 2);
});

console.log('Kitchen');
test('cooking uses the ingredients only when everything is there, and the meal goes into the bag', () => {
  const inv = new Inventory({});
  inv.add(ITEMS['rice-mudu']); inv.add(ITEMS.pepper);
  assert.equal(cook(inv, 'rice-stew').error, 'missing'); assert.equal(inv.count('rice-mudu'), 1);
  inv.add(ITEMS['palm-oil']);
  assert.ok(recipeStatus(inv).find((r) => r.recipe.id === 'rice-stew').ok);
  const r = cook(inv, 'rice-stew'); assert.ok(r.ok);
  assert.equal(inv.count('rice-mudu') + inv.count('pepper') + inv.count('palm-oil'), 0);
  assert.equal(inv.count('rice-stew'), 5); assert.ok(ITEMS['rice-stew'].use.energy > 0);
});
test('a full bag blocks cooking unless the ingredients free a slot', () => {
  const inv = new Inventory({ slots: 3 });
  inv.add(ITEMS.noodles); inv.add(ITEMS.bread); inv.add(ITEMS.malt);
  assert.ok(cook(inv, 'noodles').ok); // the noodles carton slot becomes the meal slot
  const inv2 = new Inventory({ slots: 3 });
  inv2.add(ITEMS.garri, 2); inv2.add(ITEMS.sugar, 2); inv2.add(ITEMS.malt);
  assert.equal(cook(inv2, 'garri').error, 'bag-full'); assert.equal(inv2.count('garri'), 2);
});

console.log('Vehicles');
const spots = pickSaleSpots(graph, landmarks);
const mkVeh = (balance = 500000) => {
  const wallet = { balance }, inv = new Inventory({}), economy = new Economy(wallet), saved = { vehicles: [], world: {} };
  return { wallet, inv, saved, vs: new VehicleSystem(saved.vehicles, saved.world, { economy, inventory: inv, spots }) };
};
test('vehicles are catalogued at six off-road car stands, not individual kerb sale spots', () => {
 assert.equal(spots.length,228); // v0.48: 38 cars at each of the six stands (the premium ones are at the showroom)assert.equal(new Set(spots.map(s=>s.lot)).size,6);
 for(const s of spots){assert.ok(s.plot&&s.desk);assert.equal(s.x,s.plot.delivery.x);assert.equal(s.z,s.plot.delivery.z);assert.ok(map.nearestRoad(s.x,s.z,{maxDist:50}));}
});
test('buying: one charge, the vehicle is yours and no longer for sale; can’t buy it twice', () => {
  const { wallet, vs, saved } = mkVeh();
  const sp = spots.find((s) => s.model === 'toyota_corolla');
  const r = vs.buy(sp.id); assert.ok(r.ok);
  assert.equal(wallet.balance, 500000 - sp.price); assert.equal(saved.vehicles.length, 1);
  assert.ok(!vs.forSale().some((s) => s.id === sp.id));
  assert.equal(vs.buy(sp.id).error, 'sold'); assert.equal(wallet.balance, 500000 - sp.price);
  assert.equal(r.vehicle.fuel, VEHICLE_MODELS.toyota_corolla.tank / 2);
});
test('buying without the money: refused, nothing changes', () => {
  const { wallet, vs, saved } = mkVeh(1000);
  assert.equal(vs.buy(spots[0].id).error, 'insufficient-funds');
  assert.equal(wallet.balance, 1000); assert.equal(saved.vehicles.length, 0);
});
test('fuel: driving burns it by distance; filling pays only for whole litres you can afford', () => {
  const { wallet, vs } = mkVeh();
  const v = vs.buy(spots.find((s) => s.model === 'keke').id).vehicle;
  const f0 = v.fuel; vs.burn(v, 2000); assert.ok(Math.abs(f0 - v.fuel - 2 * VEHICLE_MODELS.keke.use) < 1e-9);
  wallet.balance = FUEL.pricePerLitre * 2 + 10; // enough for 2 litres only
  const r = vs.refuel(v, 'Conoil'); assert.ok(r.ok); assert.equal(r.litres, 2); assert.equal(wallet.balance, 10);
  assert.equal(vs.refuel(v, 'Conoil').error, 'insufficient-funds'); assert.equal(wallet.balance, 10);
});
test('a jerrycan from the bag tops up the tank (only if it fits)', () => {
  const { vs, inv } = mkVeh();
  const v = vs.buy(spots.find((s) => s.model === 'keke').id).vehicle;
  v.fuel = 0; inv.add(ITEMS.jerrycan, 2);
  assert.ok(vs.pourJerrycan(v).ok); assert.equal(v.fuel, FUEL.jerrycanLitres); assert.equal(inv.count('jerrycan'), 1);
  v.fuel = VEHICLE_MODELS.keke.tank; assert.equal(vs.pourJerrycan(v).error, 'full'); assert.equal(inv.count('jerrycan'), 1);
});
test('skip-drive route: real roads between two places, longer than the straight line, ends at a kerb', () => {
  const a = landmarks.get('main-market'), b = landmarks.get('upper-iweka');
  const plan = planDrive(graph, a, b);
  assert.ok(plan, 'route found');
  assert.ok(plan.metres > Math.hypot(a.x - b.x, a.z - b.z));
  // the route is continuous and never goes the wrong way down a one-way street
  for (let i = 0; i < plan.path.length; i++) {
    const p = plan.path[i]; if (p.edge.road.oneway) assert.ok(p.fwd, 'one-way respected');
    if (i) { const q = plan.path[i - 1]; assert.equal(q.fwd ? q.edge.b : q.edge.a, p.fwd ? p.edge.a : p.edge.b); }
  }
  assert.ok(Math.hypot(plan.stop.x - b.x, plan.stop.z - b.z) < 260);
});
test('skip-drive across the Niger Bridge to Asaba and back', () => {
  const asaba = landmarks.get('asaba'), bh = landmarks.get('bridgehead');
  const there = planDrive(graph, bh, asaba), back = planDrive(graph, asaba, bh);
  assert.ok(there && back);
  assert.ok(there.path.some((p) => p.edge.road.overWater) && back.path.some((p) => p.edge.road.overWater));
});

console.log('Public transport (Milestone 5 follow-ups)');
const net = new TransitNetwork({ map, graph, landmarks });
test('v0.48: Asaba is COMING SOON, so the coaster turns at Bridgehead and no bus crosses the Niger Bridge', () => {
  const c = net.lines.find((l) => l.id === 'C1');
  assert.ok(!c.path.some((p) => p.edge.road.overWater));
  assert.ok(c.occ.some((o) => /Bridgehead/.test(o.stop.name)));
  assert.ok(!net.stops.some((s) => s.name.startsWith('Asaba')));
});
test('fare bargaining: keke drivers may knock something off, once; never below the minimum; the agreed fare is what you pay', () => {
  let tried = 0, moved = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const wallet = { balance: 100000 }, economy = new Economy(wallet);
    const fleet = new TransitFleet(net, { rng: mulberry32(seed) });
    fleet.populate((line, D) => { const { i, s } = net.locate(line, D); const { edge, fwd } = line.path[i]; const v = { id: seed * 1000 + Math.random(), T: { len: 3 }, edge, fwd, s, speed: 0, x: 0, z: 0 }; return v; });
    const trips = new TripSystem({ economy, fleet, network: net, state: {}, nonce: 'n' + seed });
    const line = net.lines.find((l) => l.id === 'K1'), from = line.occ[2], to = line.occ[5];
    const stop = from.stop, entry = trips.destinationsFrom(stop).find((e) => e.stop === to.stop && e.options.some((o) => o.line === line));
    if (!entry) continue;
    trips.choose(stop, { ...entry, options: entry.options.filter((o) => o.line === line) });
    const v = fleet.vehicles.find((x) => x.transit.line === line);
    v.transit.stopped = { occ: trips.trip.options[0].from }; v.transit.dwell = 5;
    const std = trips.fareOffer(v).standard;
    const r = trips.haggle(v); tried++;
    assert.ok(r.fare <= std && r.fare >= MODES.keke.fare.min);
    const again = trips.haggle(v); assert.equal(again.reply, 'already'); assert.equal(again.fare, r.fare);
    if (r.moved) moved++;
    const b = trips.board(v); assert.ok(b.ok); assert.equal(trips.trip.fare, r.fare);
    fleet.depart(v);
    assert.equal(wallet.balance, 100000 - r.fare); assert.equal(wallet.ledger.length, 1);
  }
  assert.ok(tried >= 10 && moved > 0 && moved < tried, `bargaining sometimes works (${moved}/${tried})`);
});
test('bus and coaster fares are fixed', () => {
  const fleet = new TransitFleet(net, { rng: mulberry32(3) });
  fleet.populate((line, D) => ({ id: Math.random(), T: { len: 6 }, x: 0, z: 0 }));
  const trips = new TripSystem({ economy: new Economy({ balance: 9999 }), fleet, network: net, state: {} });
  const line = net.lines.find((l) => l.id === 'B1'), from = line.occ[1], to = line.occ[3];
  trips.choose(from.stop, { stop: to.stop, options: [{ line, from, to, dist: net.rideDistance(line, from, to), stops: 2, fare: 300 }] });
  const v = fleet.vehicles.find((x) => x.transit.line === line); v.transit.stopped = { occ: from }; v.transit.dwell = 5;
  assert.equal(trips.fareOffer(v).fixed, true); assert.equal(trips.haggle(v).reply, 'fixed');
});

console.log('Clock & save');
test('skipping time rolls over days and fires day events', () => {
  const days = []; const bus = { emit: (e, d) => { if (e === 'clock:day') days.push(d); } };
  const c = new SimClock(bus, { day: 1, minutes: 22 * 60 });
  c.advance(9 * 60); // sleep until 07:00
  assert.equal(c.day, 2); assert.equal(Math.round(c.minutes), 7 * 60); assert.deepEqual(days, [2]);
  c.advance(3 * DAY); assert.equal(c.day, 5);
});
test(`a v4 save migrates to v${SAVE_VERSION}: homes, vehicles and sold spots added, everything else kept`, () => {
  const v4 = { version: 4, character: { gender: 'female', name: 'Ada' }, player: { x: 1, z: 2 }, clock: { day: 3, minutes: 500 },
    wallet: { balance: 777, ledger: [], processed: [] }, inventory: { slots: 16, items: [] }, jobs: { list: [], completed: [], log: [], tracked: null },
    needs: { energy: 50 }, transit: { seq: 2, log: [] }, relationships: { 'stall:2': { talks: 4 } }, world: { stock: {} } };
  const out = migrate(JSON.parse(JSON.stringify(v4)));
  assert.equal(out.version, SAVE_VERSION);
  assert.deepEqual(out.housing, { rentals: {}, storage: {}, lamps: {}, upgrades: {}, owned: {} });
  assert.deepEqual(out.vehicles, []); assert.deepEqual(out.world.soldVehicles, []);
  assert.equal(out.wallet.balance, 777); assert.equal(out.relationships['stall:2'].talks, 4); assert.equal(out.needs.energy, 50);
});
test('the map keeps the earlier area first and unchanged (resident ids depend on that order)', () => {
  const L = map.meta.legacy;
  assert.ok(L && L.roads > 800 && L.buildings > 13000);
  const inOld = (x, z) => x >= L.playBounds.minX - 100 && x <= L.playBounds.maxX + 100 && z >= L.playBounds.minZ - 100 && z <= L.playBounds.maxZ + 100;
  for (let i = 0; i < L.buildings; i += 97) { const [x, z] = map.buildings[i].pts[0]; assert.ok(inOld(x, z), `building ${i} inside the old area`); }
  const E = map.meta.extensions?.[0]?.before, cut = E?.buildings ?? map.buildings.length;
  assert.ok(map.buildings.slice(L.buildings, cut).every((b) => !inOld(...b.pts[0]) || b.pts[0][1] > L.playBounds.maxZ - 300), 'new buildings are in the new area');
  // v0.48 extension: appended after everything else, outside the earlier play area
  if (E) { const B = E.playBounds, inB = (x, z) => x > B.minX + 1 && x < B.maxX - 1 && z > B.minZ + 1 && z < B.maxZ - 1; assert.ok(map.buildings.slice(cut).every((b) => b.pts.some(([x, z]) => !inB(x, z))), 'v0.48 buildings are outside the earlier map'); assert.equal(map.roads.length > E.roads, true); }
});
