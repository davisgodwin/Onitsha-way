// v0.39 unit tests: crash reactions, per-home floor plans, walkable surfaces, invented flyovers/stairs/footbridges,
// hospital knock-down fee.
import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { obbOverlap, CRASH_LINES, TrafficSystem } from '../src/sim/TrafficSystem.js';
import { generatePlan, planSignature } from '../src/housing/FloorPlans.js';
import { Walkways, STEP } from '../src/world/Walkways.js';
import { MapData } from '../src/world/MapData.js';
import { Landmarks } from '../src/world/Landmarks.js';
import { markElevated } from '../src/world/Bridges.js';
import { addRoadFlyovers } from '../src/world/Flyovers.js';
import { RoadGraph } from '../src/sim/RoadGraph.js';
import { pointInPolygon } from '../src/core/utils.js';
import { knockFee, KNOCK_FEE } from '../src/life/Hospitals.js';

const car = (x, z, dx, dz, o = {}) => ({ x, z, y: 0, dx, dz, speed: 8, T: { len: 4.6, wid: 1.8 }, ...o });
test('vehicle bodies overlap only when they really touch (oriented boxes)', () => {
  assert.ok(obbOverlap(car(0, 0, 0, 1), car(0, 4, 0, 1)));       // nose to tail, 4 m apart (4.6 m cars)
  assert.ok(!obbOverlap(car(0, 0, 0, 1), car(0, 5, 0, 1)));
  assert.ok(!obbOverlap(car(0, 0, 0, 1), car(2.2, 0, 0, 1)));     // side by side in two lanes
  assert.ok(obbOverlap(car(0, 0, 0, 1), car(2, 1, 1, 0)));         // T-bone
});
test('a hit driver brakes, shouts a line and does not react twice to the same bump', () => {
  const T = { time: 10, rng: () => 0.3, crashEvents: [] }, v = car(0, 0, 0, 1);
  assert.equal(TrafficSystem.prototype.hit.call(T, v, 'player', 2), true);
  assert.ok(v.speed < 2 && CRASH_LINES.player.includes(v.crash.line) && v.crash.until > 14);
  assert.equal(TrafficSystem.prototype.hit.call(T, v, 'player', 2), false);
  assert.equal(T.crashEvents.length, 1);
  // two NPC cars overlapping both react
  const S = { time: 50, rng: () => 0.6, crashEvents: [] }; S.hit = TrafficSystem.prototype.hit.bind(S);
  const a = car(0, 0, 0, 1), b = car(0.5, 3.8, 0, 1, { speed: 3 });
  TrafficSystem.prototype.detectCrashes.call(S, [a, b]);
  assert.ok(a.crash && b.crash && CRASH_LINES.npc.includes(a.crash.line));
});

const SIZES = { selfcon: [6.5, 7], roomparlour: [8, 8], flat: [11, 9.5], duplex: [11, 10], duplexUp: [11, 10] };
test('every home gets its own floor plan, entered from the front, all rooms reachable, a bulb and switch in each', () => {
  for (const [type, [W, D]] of Object.entries(SIZES)) {
    const sigs = new Set();
    for (let i = 0; i < 60; i++) {
      const p = generatePlan('home:' + i, type, W, D); sigs.add(planSignature(p));
      assert.deepEqual(generatePlan('home:' + i, type, W, D), p, 'same home, same plan');
      const front = p.rooms.find((r) => r.x0 <= p.door.x && r.x1 >= p.door.x && Math.abs(r.z1 - D) < 0.01);
      assert.ok(front, `${type} ${i}: door opens into a room on the front wall`);
      for (const r of p.rooms) assert.ok(r.x1 - r.x0 >= 1.5 && r.z1 - r.z0 >= 1.5, `${type} ${i}: ${r.role} is at least 1.5 m across`);
      // rooms joined by doorways: BFS from the front room
      const on = (r, x, z) => x >= r.x0 - 0.01 && x <= r.x1 + 0.01 && z >= r.z0 - 0.01 && z <= r.z1 + 0.01;
      const links = p.walls.map((w) => { const h = w.z0 === w.z1, c = (h ? w.x0 : w.z0) + (w.gap[0] + w.gap[1]) / 2, x = h ? c : w.x0, z = h ? w.z0 : c; return p.rooms.filter((r) => on(r, x, z)); });
      const seen = new Set([front]), q = [front];
      while (q.length) { const r = q.pop(); for (const l of links) if (l.includes(r)) for (const o of l) if (!seen.has(o)) { seen.add(o); q.push(o); } }
      assert.equal(seen.size, p.rooms.length, `${type} ${i}: every room can be reached`);
      assert.equal(p.lamps.length, p.rooms.length);
    }
    assert.ok(sigs.size >= 58, `${type}: ${sigs.size}/60 distinct plans`);
  }
});

test('walkways: climb a stair, blocked by its side, kept on the deck by the edge', () => {
  const map = { roads: [] }, hs = [0, 6];
  const road = { walkDeck: true, footbridge: true, width: 2, points: [[0, 0], [0, 12]], heightAt: (s) => Math.max(0, Math.min(12, s)) / 12 * 6 };
  map.roads.push(road, { walkDeck: true, footbridge: true, width: 4, points: [[0, 12], [0, 30]], heightAt: () => 6 });
  const W = new Walkways(map);
  assert.equal(W.groundAt(0, 0.5, 0), 0.25);
  assert.equal(W.groundAt(0, 11, 0), 0, 'from the street you are under the high end');
  assert.ok(Math.abs(W.groundAt(0, 11, 5.4) - 5.5) < 1e-9, 'on the stair you stand on it');
  assert.equal(W.canMove(0.5, 4, 0), false, 'the side of the stair blocks you at street level');
  assert.equal(W.canMove(0.5, 9, 0), true, 'the high part you walk under');
  assert.equal(W.canMove(3, 20, 6), false, 'you cannot step off the deck edge');
  assert.equal(W.canMove(1, 20, 6), true);
  assert.ok(STEP > 0.5 && STEP < 1);
});

test('invented flyovers near Upper Iweka join the street at both ramps; ground lanes under them carry no through traffic', () => {
  const json = JSON.parse(readFileSync(new URL('../public/data/onitsha_core.json', import.meta.url)));
  const map = new MapData(json), landmarks = new Landmarks(map), isWater = (x, z) => map.water.some((w) => pointInPolygon(x, z, w.outer));
  const roads0 = map.roads.length, fl = addRoadFlyovers(map, landmarks); markElevated(map, isWater);
  assert.ok(fl.length >= 1 && map.roads.length === roads0 + fl.length);
  const ui = landmarks.get('upper-iweka');
  for (const { road: F, under: R } of fl) {
    assert.ok(F.elevated && F.walkDeck && F.heightAt && F.invented, F.name);
    assert.ok(R.nodes.includes(F.nodes[0]) && R.nodes.includes(F.nodes.at(-1)), 'ramps join the street');
    assert.ok(F.nodes.slice(1, -1).every((n) => !R.nodes.includes(n)), 'the deck does not touch the junction below');
    assert.ok(F.heightAt(F.length / 2) > 6 && F.heightAt(0) < 0.5 && F.heightAt(F.length) < 0.5);
    const d = Math.hypot(F.points[0][0] - ui.x, F.points[0][1] - ui.z); assert.ok(d < 1500, 'near Upper Iweka');
  }
  const g = new RoadGraph(map);
  const fe = g.edges.filter((e) => e.road.invented), under = g.edges.filter((e) => fl.some((f) => f.under === e.road) && e.road.noTrafficSpans.some(([a, b]) => e.s0 >= a - 0.5 && e.s0 + e.len <= b + 0.5));
  assert.ok(fe.length && fe.every((e) => e.drivable && e.walkable));
  assert.ok(under.length && under.every((e) => !e.drivable && e.walkable));
  // the real Niger Bridge stays a traffic-only deck
  assert.ok(map.roads.filter((r) => r.overWater && r.elevated).every((r) => !r.walkDeck));
});

test('hospital fee after a knock-down: up to ₦3,000, never more than you have', () => {
  assert.equal(knockFee(100000), KNOCK_FEE); assert.equal(knockFee(1200.7), 1200); assert.equal(knockFee(0), 0); assert.equal(knockFee(-50), 0);
});

test('in every generated home the player can reach every light switch, the stairs and the door (empty and NPC-furnished)', async () => {
  const T = await import('three'), ctx = new Proxy({ createLinearGradient: () => ({ addColorStop() {} }) }, { get: (o, k) => o[k] ?? (() => {}) });
  const old = globalThis.document; globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  try {
    const { buildInteriors, LAYOUT_SIZE } = await import('../src/housing/Interiors.js'), { CollisionWorld } = await import('../src/physics/CollisionWorld.js');
    let checked = 0;
    for (let h = 0; h < 25; h++) {
      const col = new CollisionWorld(), interiors = buildInteriors(new T.Scene(), col);
      for (const [id, S] of Object.entries(LAYOUT_SIZE)) for (const n of [0, 1]) for (const bare of [true, false]) {
        interiors.resize(id, S.W[n], S.D[n], bare, 'home:' + h); const lay = interiors.layouts[id], b = lay.bounds, step = 0.1, w = Math.ceil((b.maxX - b.minX) / step), hh = Math.ceil((b.maxZ - b.minZ) / step);
        const queue = [[Math.round((lay.spawn.x - b.minX) / step), Math.round((lay.spawn.z - b.minZ) / step)]], seen = new Set();
        for (let j = 0; j < queue.length; j++) { const [x, z] = queue[j]; for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = x + dx, c = z + dz, k = a + c * w; if (a <= 0 || c <= 0 || a >= w || c >= hh || seen.has(k)) continue; if (!col.isFree(b.minX + a * step, b.minZ + c * step, 0.325)) continue; seen.add(k); queue.push([a, c]); } }
        for (const it of lay.items.filter((i) => ['switch', 'stairs', 'door'].includes(i.kind))) {
          checked++;
          assert.ok(queue.some(([x, z]) => Math.hypot(b.minX + x * step - it.x, b.minZ + z * step - it.z) < (it.radius ?? 1) * 0.6), `home:${h} ${id} ${n ? 'max' : 'min'} ${bare ? 'empty' : 'furnished'} ${it.kind} at ${(it.x - b.minX).toFixed(2)},${(it.z - b.minZ).toFixed(2)}`);
        }
      }
    }
    assert.ok(checked > 1500);
  } finally { globalThis.document = old; }
});
