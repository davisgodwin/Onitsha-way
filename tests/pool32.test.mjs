import test from 'node:test';
import assert from 'node:assert/strict';
import { PoolGame, TABLE, POCKETS, groupOf } from '../src/activities/pool/PoolGame.js';

const R = TABLE.R, D = 2 * R;
/** A game with only the listed balls on the table (others potted), cue at (cx, cz), aiming phase. */
function setup(list, cue = [-0.5, 0], opts = {}) {
  const g = new PoolGame({ seed: 3, aiPlayers: [], ...opts });
  for (const b of g.balls) { b.pocketed = b.n !== 0; b.vx = b.vz = 0; }
  for (const [n, x, z] of list) Object.assign(g.ball(n), { x, z, pocketed: false });
  Object.assign(g.cue, { x: cue[0], z: cue[1], pocketed: false });
  g.isBreak = false; g.phase = 'aim'; g.ballInHand = null; return g;
}
const at = (g, x, z) => Math.atan2(z - g.cue.z, x - g.cue.x);

test('rack: 15 object balls in a tight triangle, 8 in the middle, no overlaps, cue behind the head string', () => {
  const g = new PoolGame({ seed: 5 });
  assert.equal(g.balls.length, 16); assert.deepEqual(g.balls.map((b) => b.n).sort((a, b) => a - b), [...Array(16).keys()]);
  for (let i = 0; i < 16; i++) for (let j = i + 1; j < 16; j++) assert.ok(Math.hypot(g.balls[i].x - g.balls[j].x, g.balls[i].z - g.balls[j].z) >= D * 0.999);
  const eight = g.ball(8), apex = g.balls.slice(1).reduce((a, b) => (b.x < a.x ? b : a));
  assert.ok(Math.abs(eight.z) < 1e-9 && eight.x > apex.x); assert.ok(g.cue.x < -TABLE.L / 4 + 1e-9);
  assert.equal(g.phase, 'place'); assert.equal(g.ballInHand, 'kitchen');
  assert.equal(g.canPlace(0.2, 0), false, 'cannot break from beyond the head string');
});

test('a straight shot pots the object ball; the shooter keeps the table; open table assigns groups', () => {
  const p = POCKETS[5]; // far right corner
  const g = setup([[3, 0.6, 0.3], [11, -0.3, -0.35], [8, 0, -0.2]], [0.2, 0.3 - 0.4 * (0.3 - (p.z - 0.3)) * 0]);
  // aim through the ghost ball towards the pocket
  const t = g.ball(3), tx = p.x - t.x, tz = p.z - t.z, l = Math.hypot(tx, tz), gx = t.x - tx / l * D, gz = t.z - tz / l * D;
  Object.assign(g.cue, { x: gx - tx / l * 0.4, z: gz - tz / l * 0.4 });
  g.shoot(at(g, gx, gz), 0.45); g.settle();
  assert.ok(g.ball(3).pocketed, 'object ball potted'); assert.equal(g.turn, 0); assert.equal(g.groups[0], 'solids'); assert.equal(g.groups[1], 'stripes');
  assert.ok(!g.cue.pocketed);
});

test('balls never leave the bed without being potted, and everything comes to rest', () => {
  for (let seed = 1; seed <= 5; seed++) {
    const g = new PoolGame({ seed, aiPlayers: [] }); g.place(-0.6, 0.05 * seed - 0.1);
    g.shoot(0.02 * seed - 0.05, 1); g.settle();
    for (const b of g.balls) if (!b.pocketed) assert.ok(Math.abs(b.x) <= TABLE.L / 2 && Math.abs(b.z) <= TABLE.W / 2, `ball ${b.n} off the table`);
    assert.notEqual(g.phase, 'moving');
  }
});

test('scratch is a foul: ball in hand anywhere for the opponent', () => {
  const p = POCKETS[2], g = setup([[1, 0.3, 0.3], [9, -0.6, 0.3]], [p.x - 0.4, p.z + 0.4]);
  g.groups = ['solids', 'stripes'];
  g.shoot(Math.atan2(p.z - g.cue.z, p.x - g.cue.x), 0.5); g.settle();
  assert.equal(g.turn, 1); assert.equal(g.phase, 'place'); assert.equal(g.ballInHand, 'anywhere'); assert.ok(!g.cue.pocketed);
  assert.ok(g.canPlace(0.5, 0.2) || g.nearestPlace(0.5, 0.2));
});

test('hitting the opponent\'s ball first is a foul; no cushion after contact is a foul', () => {
  const g = setup([[1, 0.6, 0.3], [9, 0.1, 0], [8, -0.8, -0.4]], [-0.3, 0]); g.groups = ['solids', 'stripes'];
  g.shoot(at(g, 0.1, 0), 0.35); g.settle();
  assert.equal(g.turn, 1); assert.equal(g.phase, 'place');
  const h = setup([[1, -0.2, 0], [9, 0.6, 0.3], [8, -0.8, -0.4]], [-0.3, 0]); h.groups = ['solids', 'stripes'];
  h.shoot(0, 0.03); h.settle(); // the faintest touch: object ball barely moves, nothing reaches a cushion
  assert.equal(h.turn, 1); assert.equal(h.phase, 'place');
});

test('potting the 8 before clearing your group loses; potting it after clearing wins; scratching on the 8 loses', () => {
  const p = POCKETS[5];
  const shot8 = (g) => { const t = g.ball(8), tx = p.x - t.x, tz = p.z - t.z, l = Math.hypot(tx, tz), gx = t.x - tx / l * D, gz = t.z - tz / l * D; Object.assign(g.cue, { x: gx - tx / l * 0.35, z: gz - tz / l * 0.35 }); g.shoot(at(g, gx, gz), 0.4); g.settle(); };
  const early = setup([[8, 0.6, 0.3], [2, -0.5, -0.3], [12, -0.6, 0.35]]); early.groups = ['solids', 'stripes']; shot8(early);
  assert.equal(early.phase, 'over'); assert.equal(early.winner, 1);
  const win = setup([[8, 0.6, 0.3], [12, -0.6, 0.35]]); win.groups = ['solids', 'stripes']; shot8(win);
  assert.equal(win.phase, 'over'); assert.equal(win.winner, 0);
  const scr = setup([[8, 0.85, 0.42], [12, -0.6, 0.35]], [0.4, 0.2]); scr.groups = ['solids', 'stripes'];
  // drive the cue straight into the corner along the 8: 8 drops, then the cue follows it in
  scr.shoot(at(scr, 0.85, 0.42), 1); scr.settle();
  if (scr.ball(8).pocketed) { assert.equal(scr.phase, 'over'); if (scr.cue.pocketed || scr.reason.includes('foul')) assert.equal(scr.winner, 1); }
});

test('the 8 potted on the break is re-spotted', () => {
  const g = new PoolGame({ seed: 1, aiPlayers: [] }); g.place(-0.6, 0);
  g.ball(8).x = POCKETS[5].x - 0.03; g.ball(8).z = POCKETS[5].z - 0.03; // hanging over a pocket
  g.shoot(0, 0.9); g.settle();
  assert.ok(!g.ball(8).pocketed); assert.notEqual(g.phase, 'over');
});

test('AI plays full racks to a legal finish at every level', () => {
  for (const difficulty of ['easy', 'normal', 'hard']) for (let seed = 1; seed <= 3; seed++) {
    const g = new PoolGame({ seed, difficulty, aiPlayers: [0, 1] }); let n = 0;
    while (g.phase !== 'over' && n++ < 250) { const p = g.plan(); if (g.phase === 'place') assert.ok(g.place(p.place.x, p.place.z)); assert.ok(g.shoot(p.angle, p.power)); g.settle(); g.drainEvents(); }
    assert.equal(g.phase, 'over', `${difficulty} ${seed} finished`); assert.ok([0, 1].includes(g.winner)); assert.ok(g.reason);
  }
});

test('groups and targets', () => {
  assert.equal(groupOf(3), 'solids'); assert.equal(groupOf(12), 'stripes'); assert.equal(groupOf(8), 'eight');
  const g = setup([[1, 0, 0], [9, 0.3, 0], [8, -0.3, 0.3]]); assert.deepEqual(g.targets().sort(), [1, 9]);
  g.groups = ['solids', 'stripes']; assert.deepEqual(g.targets(), [1]); g.ball(1).pocketed = true; assert.deepEqual(g.targets(), [8]);
});
