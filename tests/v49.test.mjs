// v0.49: traffic lights and wardens (timing), the play area's fast lookup, the "keep clear" points used when the city
// is filled, and the map's categories.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { MapData } from '../src/world/MapData.js';
import { RoadGraph } from '../src/sim/RoadGraph.js';
import { TrafficControl } from '../src/sim/TrafficControl.js';
import { PlayArea } from '../src/world/PlayArea.js';
import { KeepClear } from '../src/world/OrderlyFill.js';
import { rect } from '../src/world/StreetLayout.js';

const raw = JSON.parse(fs.readFileSync(new URL('../public/data/onitsha_core.json', import.meta.url)));
const map = new MapData(raw);
const graph = new RoadGraph(map);

test('traffic lights: the two directions of a junction are never green together, and red follows amber', () => {
  const tc = new TrafficControl(graph, {});
  const st = tc.stats();
  assert.ok(st.junctions >= 150, `junctions ${st.junctions}`);
  assert.ok(st.wardens >= 0);
  for (const n of [...tc.nodes.values()].slice(0, 60)) {
    assert.ok(n.approaches.some((a) => a.group === 0) && n.approaches.some((a) => a.group === 1), 'each junction has two directions');
    let prev = null, sawAmberBeforeRed = true;
    for (let t = 0; t < 80; t += 0.25) {
      tc.time = t; const a = tc.phase(n, 0), b = tc.phase(n, 1);
      assert.ok(!(a === 'green' && b === 'green') && !(a !== 'red' && b !== 'red'), `both directions moving at t=${t}`);
      if (prev === 'green' && a === 'red') sawAmberBeforeRed = false; prev = a;
    }
    assert.ok(sawAmberBeforeRed, 'green goes to amber before red');
  }
});

test('traffic lights: a driver gets the light of the junction it is driving towards, and none elsewhere', () => {
  const tc = new TrafficControl(graph, {});
  const n = [...tc.nodes.values()][0], a = n.approaches[0];
  const s = tc.state(n.node, a.e, a.fwd); assert.ok(s && ['green', 'amber', 'red'].includes(s.light) && s.stop > 4);
  assert.equal(tc.state(n.node, a.e, !a.fwd), null, 'driving away from the junction: no light');
  const plain = [...graph.adj.keys()].find((k) => !tc.nodes.has(k)); const o = graph.adj.get(plain)[0];
  assert.equal(tc.state(plain, o.edge, !o.fwd), null);
});

test('the play area: the fast lookup gives the same answer as the exact one in the middle of its cells', () => {
  const pa = new PlayArea(map);
  const B = map.fullBounds ?? map.bounds; let n = 0;
  for (let x = B.minX + 5; x < B.maxX; x += 470) for (let z = B.minZ + 5; z < B.maxZ; z += 430) {
    const cx = (Math.floor(x / 10) + 0.5) * 10, cz = (Math.floor(z / 10) + 0.5) * 10;
    assert.equal(pa.lockedFast(x, z), pa.locked(cx, cz)); n++;
  }
  assert.ok(n > 200);
});

test('keep clear: doors, counters, people and parked cars inside a plot are found', () => {
  const g = { interactions: { items: new Set([{ x: 10, z: 10, radius: 2 }, { get x() { return 1e9; }, get z() { return 1e9; } }]) }, npcs: { residents: [{ x: 40, z: 40 }] }, vehicles: { spots: [{ x: 80, z: 0 }] }, homes: { listings: [] } };
  const k = new KeepClear(g);
  assert.equal(k.hits(rect(10, 10, 4, 4)), true);
  assert.equal(k.hits(rect(12.5, 10, 2, 2)), true, 'within the radius of a use point');
  assert.equal(k.hits(rect(12.5, 10, 2, 2), 0.2), false, 'smaller radius when asked');
  assert.equal(k.hits(rect(40, 40, 3, 3)), true);
  assert.equal(k.hits(rect(80, 2, 4, 2)), true, 'a car for sale');
  assert.equal(k.hits(rect(200, 200, 10, 10)), false);
});
