// Public transport tests on the real Onitsha map (pure logic, no WebGL). Imported by economy.test.mjs.
import assert from 'node:assert/strict';
import { loadWorld } from './helpers/loadWorld.mjs';
import { TransitNetwork } from '../src/transport/TransitNetwork.js';
import { TransitFleet } from '../src/transport/TransitFleet.js';
import { TripSystem } from '../src/transport/TripSystem.js';
import { fareFor, MODES, LINES } from '../src/transport/transportConfig.js';
import { Economy } from '../src/economy/Economy.js';
import { EventBus } from '../src/core/EventBus.js';
import { mulberry32 } from '../src/core/utils.js';

export let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('  ✓', name); } catch (e) { console.error('  ✗', name, '\n   ', e.stack.split('\n').slice(0, 3).join('\n    ')); process.exitCode = 1; } };

console.log('Public transport');
const { map, landmarks, graph, isWater } = loadWorld();
const net = new TransitNetwork({ map, graph, landmarks });

/** A minimal driver for fleet vehicles (what TrafficSystem.updateFar does, without three.js). */
function makeFleet(seed = 7) {
  const fleet = new TransitFleet(net, { rng: mulberry32(seed) });
  const place = (v, line, D) => {
    const { i, s } = net.locate(line, D); const { edge, fwd } = line.path[i];
    Object.assign(v, { edge, fwd, s, speed: 0 }); const p = graph.pointAt(edge, fwd, s, 0); v.x = p.x; v.z = p.z;
    if (v.transit) v.transit.leg = i;
  };
  fleet.populate((line, D) => { const v = { id: Math.random(), T: { len: 3 } }; place(v, line, D); return v; });
  fleet.place = (v, D) => place(v, v.transit.line, D);
  return fleet;
}
function step(fleet, dt = 0.25) {
  for (const v of fleet.vehicles) {
    const want = fleet.control(v, dt, 9);
    v.speed = want; v.s += want * dt;
    while (v.s > v.edge.len) { v.s -= v.edge.len; const t = v.transit; t.leg = (t.leg + 1) % t.line.path.length; v.edge = t.line.path[t.leg].edge; v.fwd = t.line.path[t.leg].fwd; }
    const p = graph.pointAt(v.edge, v.fwd, Math.min(v.s, v.edge.len), 0); v.x = p.x; v.z = p.z;
  }
}
const run = (fleet, seconds, until = () => false, dt = 0.25) => { for (let t = 0; t < seconds; t += dt) { step(fleet, dt); if (until()) return true; } return false; };

test('every planned line is routed on real roads, with stops', () => {
  assert.equal(net.lines.length, LINES.length);
  for (const l of net.lines) {
    assert.ok(l.length > 2000, `${l.id} length`);
    assert.ok(l.occ.length >= 4, `${l.id} stops`);
    // the loop is continuous: each edge starts where the previous one ended
    for (let i = 0; i < l.path.length; i++) {
      const a = l.path[i], b = l.path[(i + 1) % l.path.length];
      assert.equal(a.fwd ? a.edge.b : a.edge.a, b.fwd ? b.edge.a : b.edge.b, `${l.id} breaks at ${i}`);
    }
    if (l.mode === 'keke') assert.ok(!l.path.some((p) => p.edge.road.overWater), `${l.id} keke on the Niger Bridge`);
  }
});
test('all lines still route when landmarks use their gateway positions, as they do in the game', () => {
  // the game moves some anchors to the gateway arches (LandmarkDressing); the Bridgehead gate stands on the one-way
  // slip onto the Niger Bridge, which town lines can reach but not leave
  const w = loadWorld();
  const gates = { bridgehead: [-1065, 1738], 'upper-iweka': [1438, 1534], 'main-market': [-489, -537], ochanja: [96, 238], 'upper-iweka-park': [1485, 1243] };
  for (const [id, [x, z]] of Object.entries(gates)) w.landmarks.get(id).gatePos = { x, z };
  const n2 = new TransitNetwork(w);
  assert.equal(n2.lines.length, LINES.length, `routed: ${n2.lines.map((l) => l.id).join(',')}`);
});
test('stops are on the kerb at ground level, never on bridges, in water, in junctions or on another road', () => {
  for (const s of net.stops) {
    assert.ok(s.name && s.name.length > 2);
    for (const p of s.platforms) {
      assert.ok(!p.road.elevated && !p.road.bridge); assert.ok(!isWater(p.x, p.z), `${s.name} platform in water`);
      assert.ok(!net.onCarriageway(p.x, p.z) && !net.onCarriageway(p.poleX, p.poleZ), `${s.name} sign or kerb on a carriageway`);
    }
  }
  for (const l of net.lines) for (const o of l.occ) assert.ok(net.validAt(l, o.d), `${l.id} stop ${o.stop.name} invalid`);
});
test('the known places are served and connected', () => {
  const find = (n) => net.stops.find((s) => s.name === n);
  const mm = find('Onitsha Main Market'), ui = find('Upper Iweka');
  assert.ok(mm && ui && find('Bridgehead (Head Bridge)') && find('Shoprite Onitsha Mall') && find('Ochanja Market'));
  const dests = net.destinationsFrom(mm);
  assert.ok(dests.some((d) => d.stop === ui));
  assert.ok(dests.find((d) => d.stop === ui).options.length >= 2, 'keke and mini bus both go Main Market → Upper Iweka');
});
test('fares: whole naira in ₦50 steps, within each mode’s range, longer costs more', () => {
  for (const m of Object.keys(MODES)) {
    let prev = 0;
    for (const d of [100, 800, 2000, 5000, 20000]) {
      const f = fareFor(m, d); assert.ok(Number.isInteger(f) && f % 50 === 0); assert.ok(f >= MODES[m].fare.min && f <= MODES[m].fare.max); assert.ok(f >= prev); prev = f;
    }
  }
});

function setupTrip(balance = 5000, seed = 7) {
  const fleet = makeFleet(seed); const bus = new EventBus();
  const wallet = { balance }; const eco = new Economy(wallet, { bus });
  const trips = new TripSystem({ economy: eco, fleet, network: net, bus, state: {}, nonce: 'test' });
  const events = []; for (const e of ['trip:boarded', 'trip:departed', 'trip:arrived', 'trip:ejected', 'trip:ended']) bus.on(e, (p) => events.push(e));
  const from = net.stops.find((s) => s.name === 'Onitsha Main Market');
  const entry = trips.destinationsFrom(from).find((d) => d.stop.name === 'Upper Iweka');
  return { fleet, bus, wallet, eco, trips, events, from, entry };
}
/** Wait at the stop (standing next to the platform) until a vehicle for the trip is stopped there. */
function waitForVehicle(s) {
  const { fleet, trips } = s;
  fleet.ensureService(trips.trip.occs, 1e6, 1e6, (v, D) => fleet.place(v, D));
  let found = null;
  run(fleet, 600, () => {
    for (const v of fleet.vehicles) if (trips.optionFor(v)) { found = v; fleet.player = { x: v.x, z: v.z }; return true; }
    return false;
  });
  return found;
}

test('full trip: wait → board → fare charged once on departure → ride → arrive → get down', () => {
  const s = setupTrip();
  assert.ok(s.trips.choose(s.from, s.entry).ok);
  const v = waitForVehicle(s); assert.ok(v, 'a vehicle came');
  const c = s.trips.canBoard(v); assert.ok(c.ok, c.error);
  assert.ok(s.trips.board(v).ok); assert.equal(s.wallet.balance, 5000, 'nothing charged at boarding');
  const seatsBefore = s.fleet.load(v);
  assert.ok(seatsBefore <= v.transit.line.M.seats);
  run(s.fleet, 60, () => s.trips.trip?.state === 'riding');
  assert.equal(s.trips.trip.state, 'riding');
  const fare = s.trips.trip.fare;
  assert.equal(s.wallet.balance, 5000 - fare); assert.equal(s.wallet.ledger.length, 1);
  let arrived = false; s.bus.on('trip:arrived', () => { arrived = true; });
  run(s.fleet, 1500, () => arrived);
  assert.ok(arrived, 'reached Upper Iweka');
  assert.equal(v.transit.stopped.occ.stop.name, 'Upper Iweka');
  const r = s.trips.alight(); assert.ok(r.ok);
  assert.equal(s.trips.trip, null); assert.equal(v.transit.player, null);
  run(s.fleet, 200);
  assert.equal(s.wallet.balance, 5000 - fare, 'charged exactly once'); assert.equal(s.wallet.ledger.length, 1);
  assert.equal(s.trips.state.log.length, 1);
});
test('getting down before the vehicle leaves costs nothing', () => {
  const s = setupTrip();
  s.trips.choose(s.from, s.entry); const v = waitForVehicle(s);
  s.trips.board(v); assert.ok(s.trips.alight().ok);
  run(s.fleet, 120);
  assert.equal(s.wallet.balance, 5000); assert.equal(s.wallet.ledger.length, 0);
});
test('cannot board without the fare; no money moves', () => {
  const s = setupTrip(100);
  s.trips.choose(s.from, s.entry); const v = waitForVehicle(s);
  const r = s.trips.board(v); assert.equal(r.ok, false); assert.equal(r.error, 'insufficient-funds');
  assert.equal(s.wallet.balance, 100); assert.equal(v.transit.player, null);
});
test('if the money is gone by departure, the driver puts you down at the stop — never a negative balance', () => {
  const s = setupTrip(1000);
  s.trips.choose(s.from, s.entry); const v = waitForVehicle(s);
  assert.ok(s.trips.board(v).ok);
  s.eco.transact({ key: 'spent', amount: -950, reason: 'spent elsewhere' });
  run(s.fleet, 60, () => s.events.includes('trip:ejected'));
  assert.ok(s.events.includes('trip:ejected')); assert.equal(s.wallet.balance, 50); assert.equal(s.trips.trip, null); assert.equal(v.transit.player, null);
});
test('“drop me here”: the driver pulls in at the next safe spot (not a bridge or junction)', () => {
  const s = setupTrip();
  s.trips.choose(s.from, s.entry); const v = waitForVehicle(s); s.trips.board(v);
  run(s.fleet, 60, () => s.trips.trip?.state === 'riding');
  run(s.fleet, 20);
  assert.ok(s.trips.requestHere().ok);
  const at = v.transit.adhoc; assert.ok(at !== null && net.validAt(v.transit.line, at));
  let stopped = false; s.bus.on('trip:arrived', () => { stopped = true; });
  run(s.fleet, 120, () => stopped);
  assert.ok(stopped); assert.ok(s.trips.alight().ok);
});
test('seats are never over-filled across a long run of the whole fleet', () => {
  const fleet = makeFleet(3);
  for (let k = 0; k < 120; k++) { fleet.updatePlatforms(5, 10, () => 1.5); run(fleet, 5); for (const v of fleet.vehicles) assert.ok(fleet.load(v) <= v.transit.line.M.seats, 'over capacity'); }
  const carried = fleet.vehicles.reduce((a, v) => a + v.transit.riders.length, 0);
  assert.ok(carried > 0);
});

export default passed;
