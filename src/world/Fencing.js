import { obb } from './BuildingBounds.js';
import { roadConflict } from './StreetLayout.js';
import { mulberry32 } from '../core/utils.js';
import { compoundColliders, GATE_COLORS, WALL_COLORS } from './buildings/CompoundKit.js';

/**
 * v0.49: every house and small business building gets a walled compound with a gate (the Onitsha way). Runs
 * once the whole city is placed. For each building that has no wall yet, a wall ring is tried at 3 m, 2.2 m and
 * 1.6 m round it; the gate sits on the street side in front of the door. A ring is used only if it crosses no
 * road, water, wall, tree or prop, and leaves every door, counter, person and parked car either outside or right
 * in line with the gate. Nothing is moved; only walls are added.
 */
const SKIP_LM = ['market', 'mall', 'interchange', 'park', 'stadium', 'plaza', 'bridgehead'];
function inPoly(x, z, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }

export function fenceCity(g, keep) {
  const t0 = performance.now(), w = g.world, city = w.city, col = w.collision, map = w.map, pa = w.playArea;
  let n = 0; const touched = new Set();
  for (const ch of city.chunks.values()) for (const it of ch.items) {
    const b = it.b; if (!b?.pts || it.infill || it.fenced || b.layoutHidden || b.unfinished || b.front < 0) continue;
    if (!['residential', 'commercial'].includes(it.kind) || it.levels > 4 || it.area > 900 || it.area < 30) continue;
    if (city.inLandmark(it.cx, it.cz, SKIP_LM) || pa?.lockedFast(it.cx, it.cz)) continue;
    const box = obb(b.pts); if (!box) continue;
    const [ax, az] = b.pts[b.front], [bx, bz] = b.pts[(b.front + 1) % b.pts.length], fm = [(ax + bx) / 2, (az + bz) / 2];
    // the box axis that faces the street, and its sign
    let fx = (bz - az), fz = -(bx - ax); const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl; if (inPoly(fm[0] + fx * 0.4, fm[1] + fz * 0.4, b.pts)) { fx = -fx; fz = -fz; }
    const alongV = Math.abs(fx * box.vx + fz * box.vz) > Math.abs(fx * box.ux + fz * box.uz);
    // local frame: F = towards the street, S = along the front
    const F = alongV ? [box.vx, box.vz] : [box.ux, box.uz], sgn = (F[0] * fx + F[1] * fz) >= 0 ? 1 : -1; F[0] *= sgn; F[1] *= sgn;
    const S = [-F[1], F[0]], halfF = (alongV ? box.d : box.w) / 2, halfS = (alongV ? box.w : box.d) / 2;
    const P = (s, f) => [box.cx + S[0] * s + F[0] * f, box.cz + S[1] * s + F[1] * f];
    const doorS = (fm[0] - box.cx) * S[0] + (fm[1] - box.cz) * S[1];
    const commercial = it.kind === 'commercial', gw = commercial ? 5 : 3.4;
    let done = null;
    for (const m of [3, 2.2, 1.6]) {
      const hs = halfS + m, hf = halfF + m, gs = Math.max(-hs + gw / 2 + 0.6, Math.min(hs - gw / 2 - 0.6, doorS));
      const c0 = P(-hs, hf), c1 = P(-hs, -hf), c2 = P(hs, -hf), c3 = P(hs, hf), g0 = P(gs - gw / 2, hf), g1 = P(gs + gw / 2, hf), ring = [c0, c1, c2, c3];
      if (roadConflict(map, ring, 0.6)) continue;
      let ok = true;
      const segs = [[c0, g0], [g1, c3], [c0, c1], [c1, c2], [c2, c3]];
      for (const [p, q] of segs) { const L = Math.hypot(q[0] - p[0], q[1] - p[1]); for (let t = 0; t <= L && ok; t += 1) { const x = p[0] + (q[0] - p[0]) * t / L, z = p[1] + (q[1] - p[1]) * t / L; if (!col.isFree(x, z, 0.3) || map.onCarriageway(x, z, 0.8)) ok = false; } if (!ok) break; }
      if (ok && ring.some(([x, z]) => w.terrain.isWater(x, z) || pa?.lockedFast(x, z))) ok = false;
      if (!ok) continue;
      // doors, counters, people and cars: outside the ring, or in line with the gate
      if (keep && keep.hits(ring, 0.35)) {
        const lane = [P(gs - gw / 2 - 0.3, hf + 1), P(gs - gw / 2 - 0.3, halfF - 0.5), P(gs + gw / 2 + 0.3, halfF - 0.5), P(gs + gw / 2 + 0.3, hf + 1)];
        const band = [[c0, c1, P(-halfS, -halfF), P(-halfS, halfF)], [c1, c2, P(halfS, -halfF), P(-halfS, -halfF)], [c2, c3, P(halfS, halfF), P(halfS, -halfF)], [c3, P(gs + gw / 2 + 0.3, hf), P(gs + gw / 2 + 0.3, halfF), P(halfS, halfF)], [P(gs - gw / 2 - 0.3, hf), c0, P(-halfS, halfF), P(gs - gw / 2 - 0.3, halfF)]];
        if (band.some((q) => keep.hits(q, 0.35))) continue; void lane;
      }
      done = { segs, gate: [g0, g1], ring, F, m };
      break;
    }
    if (!done) continue;
    const rng = mulberry32(Math.floor((b.seed ?? 0.5) * 1e9) + 5151), gra = (w.districts?.premiumAt(it.cx, it.cz) ?? 0) > 0.5;
    const yaw = Math.atan2(done.F[0], done.F[1]);
    const c = { x: it.cx, z: it.cz, yaw, tier: gra ? 'premium' : 'standard', h: gra ? 2.8 : commercial ? 2 : 2.2, segs: done.segs, gate: done.gate, ring: done.ring,
      wallColor: gra ? '#efe9de' : WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)], gateColor: gra ? '#151719' : GATE_COLORS[Math.floor(rng() * GATE_COLORS.length)], features: [], fence: true, item: it, paint: it.paint };
    const gm = done.gate[1]; c.features.push({ kind: 'light', p: [gm[0] + done.F[0] * -0.15 + (done.gate[1][0] - done.gate[0][0]) * 0.15, gm[1] + done.F[1] * -0.15 + (done.gate[1][1] - done.gate[0][1]) * 0.15], yaw });
    for (const q of compoundColliders(c)) col.addPolygon(q, 2.4);
    ch.compounds ??= []; ch.compounds.push(c); it.fenced = true; it.ring = done.ring; touched.add(ch); n++;
  }
  for (const ch of touched) if (ch.group) city.disposeChunk(ch);
  w.stats.fencedBuildings = { n, ms: Math.round(performance.now() - t0) };
  return n;
}
