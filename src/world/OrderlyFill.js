import { rect, roadConflict } from './StreetLayout.js';
import { mulberry32 } from '../core/utils.js';
import { oldCoreWeight } from './buildings/ResidentialKit.js';
import { planCompound, compoundColliders } from './buildings/CompoundKit.js';
import { isMajorRoad } from './RoadBuilder.js';

/**
 * v0.49: fill the empty land, in rows and columns.
 * Along every street, plots of one standard width are laid side by side (columns) and one standard depth behind
 * each other (rows), squared to the street. A plot is used when all of it is clear: no road, water, building,
 * wall, prop, tree, home door, shop counter, parked car or person standing there, nothing COMING SOON, and not
 * the open ground of a market, park, pitch, stadium, school or church. Each plot gets a house of the street's
 * standard size the same distance back from the street, and a walled compound with a gate facing the street.
 *   - GRA: big plots, villas and two-storey houses, tall finished walls and black gates.
 *   - The old districts: narrow plots, closer together, more two-storey houses.
 *   - Everywhere else: ordinary family plots.
 * Placed after everything else, so nothing already in the city (or in a save) moves; the new houses are numbered
 * `lot:N` in a fixed order.
 */
export const KEEP_OPEN = ['market', 'mall', 'monument', 'church', 'stadium', 'park', 'interchange', 'school', 'public', 'plaza'];
const OPEN_AREAS = ['parking', 'park', 'pitch', 'garden', 'wood', 'meadow', 'farmland', 'construction'];
const TIER = {
  gra: { W: 22, D: 30, house: [12.5, 11.5], front: 5.5, levels: 0.55, tier: 'premium' },
  old: { W: 14, D: 21, house: [9.5, 10], front: 3.5, levels: 0.6, tier: 'standard' },
  std: { W: 19, D: 26, house: [11.5, 11], front: 4.6, levels: 0.3, tier: 'standard' },
};
function inPoly(x, z, pts) { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; }

/** Points that must stay clear (doors, counters, people, parked cars, interactions), in a 20 m grid. */
export class KeepClear {
  constructor(g) {
    this.grid = new Map(); const add = (x, z, r = 1.2) => { if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 1e5) return; const k = Math.floor(x / 20) + ',' + Math.floor(z / 20); if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push([x, z, r]); };
    for (const it of g.interactions?.items ?? []) { let x, z; try { x = it.x; z = it.z; } catch { continue; } add(x, z, Math.min(3, it.radius ?? 1.5)); }
    for (const r of g.npcs?.residents ?? []) add(r.x, r.z, 0.8);
    for (const s of g.vehicles?.spots ?? []) add(s.x, s.z, 3);
    for (const h of g.homes?.listings ?? []) add(h.door.stand.x, h.door.stand.z, 2);
    this.add = add;
  }
  /** is any kept point inside the polygon (grown by its radius)? */
  hits(pts, k = 1) {
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity; for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    for (let gx = Math.floor((x0 - 3) / 20); gx <= Math.floor((x1 + 3) / 20); gx++) for (let gz = Math.floor((z0 - 3) / 20); gz <= Math.floor((z1 + 3) / 20); gz++)
      for (const [x, z, r0] of this.grid.get(gx + ',' + gz) ?? []) { const r = r0 * k; if (x < x0 - r || x > x1 + r || z < z0 - r || z > z1 + r) continue; if (inPoly(x, z, pts)) return true; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)); if (Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz) < r) return true; } }
    return false;
  }
}

export class OrderlyFill {
  constructor(g, { cap = 14000, keep = null } = {}) {
    const t0 = performance.now(), w = g.world, map = w.map, col = w.collision, pa = w.playArea, D = w.districts;
    this.houses = []; this.lots = 0; const keepClear = keep ?? new KeepClear(g), B = map.fullBounds ?? map.bounds;
    const open = (map.areas ?? []).filter((a) => OPEN_AREAS.includes(a.kind) && a.pts?.length > 2);
    const keepLm = w.landmarks.list.filter((l) => KEEP_OPEN.includes(l.kind));
    const jgrid = new Map(); for (const i of map.junctions) { const n = map.nodes[i]; if (!n) continue; const k = Math.floor(n[0] / 40) + ',' + Math.floor(n[1] / 40); if (!jgrid.has(k)) jgrid.set(k, []); jgrid.get(k).push(n); }
    const nearJunction = (x, z, r) => { const gx = Math.floor(x / 40), gz = Math.floor(z / 40); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const n of jgrid.get((gx + i) + ',' + (gz + j)) ?? []) if (Math.hypot(x - n[0], z - n[1]) < r) return true; return false; };
    const taken = new Map(), tk = (x, z) => Math.floor(x / 40) + ',' + Math.floor(z / 40);
    const overlaps = (x, z, r, pts) => { const gx = Math.floor(x / 40), gz = Math.floor(z / 40); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const q of taken.get((gx + i) + ',' + (gz + j)) ?? []) if (Math.hypot(q.x - x, q.z - z) < q.r + r) { for (const p of pts) if (inPoly(p[0], p[1], q.pts)) return true; for (const p of q.pts) if (inPoly(p[0], p[1], pts)) return true; if (Math.hypot(q.x - x, q.z - z) < (q.r + r) * 0.6) return true; } return false; };
    const venues = (w.venuePlots ?? []).map((v) => v.pts).filter(Boolean);
    // bridge decks and flyovers are left out of the road checks (things stand under them): keep plots out from under them
    const decks = map.segments.filter((q) => q.road.elevated), nearDeck = (x, z) => decks.some((q) => { const dx = q.bx - q.ax, dz = q.bz - q.az, L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - q.ax) * dx + (z - q.az) * dz) / L)); return Math.hypot(x - q.ax - t * dx, z - q.az - t * dz) < q.road.width / 2 + 2; });
    const underDeck = (pts, x, z) => nearDeck(x, z) || pts.some(([a, b], i) => { const [c, d] = pts[(i + 1) % pts.length]; return nearDeck(a, b) || nearDeck((a + c) / 2, (b + d) / 2); });
    // streets in a fixed order: longest first, so the main streets get the first, most regular rows. Plots are
    // laid along the whole street (round its bends), each squared to the street where it stands.
    const SKIP = ['footway', 'path', 'steps', 'pedestrian', 'construction', 'track', 'service', 'proposed', 'cycleway'];
    const roads = map.roads.map((r, i) => { if (r.elevated || r.width < 4 || SKIP.includes(r.type) || r.points.length < 2) return null; const cum = [0]; for (let k = 1; k < r.points.length; k++) cum.push(cum[k - 1] + Math.hypot(r.points[k][0] - r.points[k - 1][0], r.points[k][1] - r.points[k - 1][1])); return { r, i, cum, L: cum[cum.length - 1] }; })
      .filter((q) => q && q.L >= 20).sort((a, b) => b.L - a.L || a.i - b.i);
    const pointAt = (q, t) => { const P = q.r.points, c = q.cum; t = Math.max(0, Math.min(q.L, t)); let k = 1; while (k < c.length - 1 && c[k] < t) k++; const f = (t - c[k - 1]) / ((c[k] - c[k - 1]) || 1); return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f]; };
    for (const row of [0, 1, 2, 3, 4]) for (const q of roads) {
      if (this.houses.length >= cap) break;
      const s = { road: q.r }, L = q.L, [mx, mz] = pointAt(q, L / 2);
      const gra = (D?.premiumAt(mx, mz) ?? 0) > 0.5, tierId = gra ? 'gra' : oldCoreWeight(w.landmarks, mx, mz) > 0.5 ? 'old' : 'std', T = TIER[tierId];
      if (row >= (gra ? 3 : 5)) continue;
      // full-width plots first; where they don't fit, narrower plots on the same grid
      for (const narrow of tierId === 'gra' ? [0] : [0, 1]) {
      const PW = narrow ? T.W * 0.7 : T.W, n = Math.floor((L - 8) / PW); if (n < 1) continue;
      const s0 = (L - n * PW) / 2;
      for (const side of [-1, 1]) {
        for (let k = 0; k < n; k++) {
          if (this.houses.length >= cap) break;
          const t = s0 + (k + 0.5) * PW, [cx, cz] = pointAt(q, t), [ax, az] = pointAt(q, t - PW / 2), [bx, bz] = pointAt(q, t + PW / 2), dl = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / dl, uz = (bz - az) / dl;
          if (dl < PW * 0.8) continue; // too sharp a bend here
          const nx = -uz * side, nz = ux * side, setback = s.road.width / 2 + (isMajorRoad(s.road) ? 4.5 : 4) + row * T.D + T.D / 2;
          const x = cx + nx * setback, z = cz + nz * setback;
          const yaw = Math.atan2(-nx, -nz); // the plot's +v (front) points back to the street
          const hw = PW / 2 - 0.15, hd = T.D / 2 - 0.15, pts = rect(x, z, hw * 2, hd * 2, yaw), r = Math.hypot(hw, hd);
          if (pts.some(([px, pz]) => px < B.minX + 5 || px > B.maxX - 5 || pz < B.minZ + 5 || pz > B.maxZ - 5)) continue;
          if (!col.isFree(x, z, 2.5)) continue;
          if (pa && (pa.lockedFast(x, z) || pts.some(([px, pz]) => pa.lockedFast(px, pz)))) continue;
          if (overlaps(x, z, r, pts)) continue;
          if (row === 0 && nearJunction(x + (-nx) * hd, z + (-nz) * hd, T.W / 2 + 7)) continue;
          if (keepLm.some((l) => Math.hypot(x - l.x, z - l.z) < Math.min((l.radius ?? 60) + 20, 200))) continue;
          if (open.some((a) => inPoly(x, z, a.pts) || pts.some(([px, pz]) => inPoly(px, pz, a.pts)))) continue;
          if (venues.some((v) => inPoly(x, z, v) || v.some(([px, pz]) => inPoly(px, pz, pts)))) continue;
          if (map.stadiumSite && (inPoly(x, z, map.stadiumSite.pts) || pts.some(([px, pz]) => inPoly(px, pz, map.stadiumSite.pts)))) continue;
          if (roadConflict(map, pts, 1.2) || underDeck(pts, x, z)) continue;
          // the whole plot clear: a grid of small circles
          let ok = !w.terrain.isWater(x, z) && !pts.some(([px, pz]) => w.terrain.isWater(px, pz)) && !map.inHomeAccess?.(x, z, Math.max(hw, hd));
          const nu = Math.ceil(hw * 2 / 3), nv = Math.ceil(hd * 2 / 3);
          for (let i = 0; i <= nu && ok; i++) for (let j = 0; j <= nv; j++) { const u = -(hw - 1.7) + (hw - 1.7) * 2 * i / nu, v = -(hd - 1.7) + (hd - 1.7) * 2 * j / nv, px = x + Math.cos(yaw) * u + Math.sin(yaw) * v, pz = z - Math.sin(yaw) * u + Math.cos(yaw) * v; if (!col.isFree(px, pz, 1.55)) { ok = false; break; } }
          if (!ok || keepClear.hits(pts)) continue;
          // the house: the street's standard size, the same distance back from the street; a wall and a gate
          const id = this.houses.length, rng = mulberry32(9049 + id * 7919), HW = Math.min(T.house[0], hw * 2 - 3.2), HD = T.house[1], levels = rng() < T.levels ? 2 : 1;
          const at = (u, v) => [x + Math.cos(yaw) * u + Math.sin(yaw) * v, z - Math.sin(yaw) * u + Math.cos(yaw) * v];
          const front = hd - T.front, hz = front - HD / 2, [hx, hzz] = at(0, hz), house = rect(hx, hzz, HW, HD, yaw);
          let fi = 0, best = -Infinity; for (let i = 0; i < 4; i++) { const a = house[i], b = house[(i + 1) % 4], f = ((a[0] + b[0]) / 2 - hx) * Math.sin(yaw) + ((a[1] + b[1]) / 2 - hzz) * Math.cos(yaw); if (f > best) { best = f; fi = i; } }
          const c = planCompound({ x, z, yaw, hw, hd, house: { w: HW, d: HD, z: hz, front: T.front, back: hd + hz - HD / 2 }, rng, tier: T.tier });
          const h = { id: 'lot:' + id, x: hx, z: hzz, yaw, w: HW, d: HD, levels, pts: house, front: fi, seed: rng(), old: tierId === 'old', registered: true, compound: c, lot: true, tier: tierId, plot: { x, z, hw, hd } };
          h.polys = [col.addPolygon(house, levels * 3 + 1)]; for (const q of compoundColliders(c)) h.polys.push(col.addPolygon(q, 2.4));
          this.houses.push(h); const key = tk(x, z); if (!taken.has(key)) taken.set(key, []); taken.get(key).push({ x, z, r, pts });
        }
      }
      }
    }
    const t1 = performance.now(); this.items = this.houses.length ? w.city.addBuildings(this.houses) : [];
    w.stats.orderlyFill = { houses: this.houses.length, ms: Math.round(t1 - t0), buildMs: Math.round(performance.now() - t1) };
  }
}
