import * as THREE from 'three';
import { GeoBuilder } from './GeoBuilder.js';
import { isMajorRoad } from './RoadBuilder.js';

/**
 * Elevated roads from OSM bridge=yes ways: the Niger Bridge (steel truss over the river) and the
 * Upper Iweka flyover (and, from v0.39, the invented flyovers in Flyovers.js). Short bridge ways (culverts over drains)
 * stay at ground level and are drawn by the RoadBuilder instead. Flyover decks are walkable (see Walkways.js).
 */
export function markElevated(map, isWater) {
  for (const r of map.roads) {
    if (!r.bridge) continue;
    const pts = r.points;
    let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const overWater = pts.some(([x, z], i) => i > 0 && isWater((x + pts[i - 1][0]) / 2, (z + pts[i - 1][1]) / 2));
    r.overWater = overWater;
    r.elevated = overWater || (L > 35 && isMajorRoad(r));
    r.length = L;
    if (!r.elevated || r.footbridge) continue;
    // deck height along the road (distance from its first node); ramps only at ends that land on solid ground
    const H = overWater ? 12 : 6.6, ramp = overWater ? Math.min(L * 0.18, 120) : Math.min(L * 0.42, 48);
    const startOnLand = !isWater(pts[0][0], pts[0][1]), endOnLand = !isWater(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    const k = (x) => { const t = Math.min(1, Math.max(0, x / ramp)); return t * t * (3 - 2 * t); };
    r.deckH = (s) => H * Math.min(startOnLand ? k(s) : 1, endOnLand ? k(L - s) : 1);
    r.deckTop = H;
    r.heightAt = (s) => r.deckH(Math.max(0, Math.min(L, s))) + 0.08;
    r.walkDeck = !overWater; // v0.39: people can walk on the flyovers (not on the Niger Bridge)
  }
}

export function buildBridges(map, tex, collision, isWater) {
  const group = new THREE.Group(); group.name = 'Bridges';
  const deck = new GeoBuilder(), concrete = new GeoBuilder(), steel = new GeoBuilder();
  const cCol = new THREE.Color('#b9b4aa'), cDark = new THREE.Color('#8f8a80'), sCol = new THREE.Color('#5f6f63');
  const b = map.fullBounds ?? map.bounds;
  const inPlay = (x, z) => x > b.minX && x < b.maxX && z > b.minZ && z < b.maxZ;
  let count = 0;

  for (const road of map.roads) {
    if (!road.elevated || road.footbridge) continue;
    count++;
    const pts = road.points;
    const L = road.length, hAt = road.deckH;
    // resample the polyline every ~5 m
    const samples = [];
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const segL = Math.hypot(bx - ax, bz - az); if (segL < 1e-3) continue;
      const n = Math.max(1, Math.ceil(segL / 5));
      for (let k = 0; k < n; k++) samples.push({ x: ax + (bx - ax) * (k / n), z: az + (bz - az) * (k / n), s: acc + segL * (k / n), dx: (bx - ax) / segL, dz: (bz - az) / segL });
      acc += segL;
    }
    const last = pts[pts.length - 1], prev = samples[samples.length - 1];
    samples.push({ x: last[0], z: last[1], s: acc, dx: prev.dx, dz: prev.dz });
    // v0.39: openings in the parapet where stairs come up (extra samples at the edges of each opening)
    const gaps = road.parapetGaps ?? [];
    for (const gp of gaps) for (const cut of [gp.s0, gp.s1]) {
      const i = samples.findIndex((q, j) => j < samples.length - 1 && q.s < cut && samples[j + 1].s > cut); if (i < 0) continue;
      const a = samples[i], c = samples[i + 1], t = (cut - a.s) / (c.s - a.s);
      samples.splice(i + 1, 0, { x: a.x + (c.x - a.x) * t, z: a.z + (c.z - a.z) * t, s: cut, dx: a.dx, dz: a.dz });
    }
    const inGap = (s0, s1, side) => gaps.some((gp) => gp.side === side && s0 >= gp.s0 - 1e-3 && s1 <= gp.s1 + 1e-3);
    const hw = road.width / 2;
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i], c = samples[i + 1];
      const ha = hAt(a.s) + 0.08, hc = hAt(c.s) + 0.08;
      const anx = -a.dz, anz = a.dx, cnx = -c.dz, cnz = c.dx;
      const AL = [a.x + anx * hw, a.z + anz * hw], AR = [a.x - anx * hw, a.z - anz * hw];
      const CL = [c.x + cnx * hw, c.z + cnz * hw], CR = [c.x - cnx * hw, c.z - cnz * hw];
      const v0 = a.s / 7, v1 = c.s / 7;
      deck.quad([[AL[0], ha, AL[1]], [AR[0], ha, AR[1]], [CR[0], hc, CR[1]], [CL[0], hc, CL[1]]], [[0, v0], [1, v0], [1, v1], [0, v1]], [0, 1, 0]);
      // slab sides and underside
      const th = 1.1;
      for (const [P, Q, s] of [[AL, CL, 1], [AR, CR, -1]]) {
        const n = [anx * s, 0, anz * s];
        concrete.quad([[P[0], ha - th, P[1]], [Q[0], hc - th, Q[1]], [Q[0], hc, Q[1]], [P[0], ha, P[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]], n, cDark);
        if (!road.overWater && !inGap(a.s, c.s, s)) { // concrete parapet on the flyover
          const pn = [anx * s * 0.25, 0, anz * s * 0.25];
          const Pi = [P[0] - pn[0], P[1] - pn[2]], Qi = [Q[0] - pn[0], Q[1] - pn[2]];
          concrete.quad([[P[0], ha, P[1]], [Q[0], hc, Q[1]], [Q[0], hc + 1, Q[1]], [P[0], ha + 1, P[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]], n, cCol);
          concrete.quad([[Pi[0], ha, Pi[1]], [Qi[0], hc, Qi[1]], [Qi[0], hc + 1, Qi[1]], [Pi[0], ha + 1, Pi[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]], [-n[0], 0, -n[2]], cCol);
          concrete.quad([[P[0], ha + 1, P[1]], [Q[0], hc + 1, Q[1]], [Qi[0], hc + 1, Qi[1]], [Pi[0], ha + 1, Pi[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 1, 0], cCol);
        } else if (road.overWater) { // steel railing
          steel.beam([P[0], ha + 1.05, P[1]], [Q[0], hc + 1.05, Q[1]], 0.1, sCol);
        }
      }
      concrete.quad([[AL[0], ha - th, AL[1]], [AR[0], ha - th, AR[1]], [CR[0], hc - th, CR[1]], [CL[0], hc - th, CL[1]]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0], cDark);
    }
    // piers
    const spacing = road.overWater ? 55 : 22;
    for (let s = spacing / 2; s < L; s += spacing) {
      const sm = samples.reduce((best, p) => (Math.abs(p.s - s) < Math.abs(best.s - s) ? p : best), samples[0]);
      const h = hAt(s);
      if (h < 2.5) continue;
      const yaw = Math.atan2(sm.dx, sm.dz) + Math.PI / 2;
      if (road.overWater) {
        concrete.box(sm.x, sm.z, -4, h - 1.1, road.width * 0.9, 3.2, yaw, cDark);
      } else {
        concrete.box(sm.x, sm.z, 0, h - 1.1, 1.3, 1.3, 0, cCol);
        concrete.box(sm.x, sm.z, h - 1.9, h - 1.1, road.width * 0.8, 1.4, yaw, cCol);
        if (inPlay(sm.x, sm.z) && !isWater(sm.x, sm.z)) collision.addCircle(sm.x, sm.z, 0.9);
      }
    }
    // Niger Bridge steel trusses
    if (road.overWater && L > 250) {
      const panel = 16, th = 8.5;
      for (const side of [1, -1]) {
        let prevTop = null, prevBot = null, k = 0;
        for (let s = 0; s <= L; s += panel, k++) {
          const sm = samples.reduce((best, p) => (Math.abs(p.s - s) < Math.abs(best.s - s) ? p : best), samples[0]);
          const h = hAt(s);
          if (h < road.deckTop * 0.97) { prevTop = prevBot = null; continue; }
          const ox = -sm.dz * (hw + 0.4) * side, oz = sm.dx * (hw + 0.4) * side;
          const bot = [sm.x + ox, h + 0.1, sm.z + oz], top = [sm.x + ox, h + th, sm.z + oz];
          steel.beam(bot, top, 0.45, sCol);
          if (prevTop) {
            steel.beam(prevTop, top, 0.55, sCol);
            steel.beam(prevBot, bot, 0.55, sCol);
            steel.beam(k % 2 ? prevBot : prevTop, k % 2 ? top : bot, 0.35, sCol);
          }
          if (side === 1) { // cross bracing over the deck
            const top2 = [sm.x - ox, h + th, sm.z - oz];
            if (k % 2 === 0) steel.beam(top, top2, 0.3, sCol);
          }
          prevTop = top; prevBot = bot;
        }
      }
    }
  }
  const add = (gb, mat) => { if (!gb.vertexCount) return; const m = new THREE.Mesh(gb.build(), mat); m.castShadow = true; m.receiveShadow = true; group.add(m); };
  add(deck, new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.9 }));
  add(concrete, new THREE.MeshStandardMaterial({ map: tex.concrete, vertexColors: true, roughness: 0.95 }));
  add(steel, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.5 }));
  return { group, count };
}
