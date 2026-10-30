import * as THREE from 'three';
import { GeoBuilder } from './GeoBuilder.js';
import { isMajorRoad } from './RoadBuilder.js';
/**
 * v0.39: flyovers you can climb.
 * - The real Upper Iweka flyover (the only one at the interchange) gets staircases up to its deck, through openings in
 *   the parapet.
 * - New road flyovers (invented for the game) carry through traffic over busy junctions near Upper Iweka: the deck
 *   is an extra elevated road joined to the street at both ramps; the ground lanes under it are left to turning
 *   traffic and pedestrians (no through cars under the deck). They get staircases too.
 * - Pedestrian footbridges with stairs at both ends cross the big roads around Upper Iweka.
 * Every deck, ramp, stair and footbridge is a walking route: the player walks up (Walkways.js) and NPC pedestrians use
 * them through the road graph (each stair / bridge is a 'steps' way with its own heights).
 */
const STAIR_W = 2.0, RISE = 0.17, RUN = 0.29, FOOT_H = 5.6, FOOT_W = 2.4;
const flightLen = (h) => Math.ceil(h / RISE) * RUN;
const lerp = (a, b, t) => a + (b - a) * t;
function polyLen(P) { let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); return L; }
function newNode(map, x, z) { map.nodes.push([x, z]); return map.nodes.length - 1; }
/** A walking way (stairs / footbridge / landing) with a height at each node. Linear between nodes. */
function walkway(map, pts, hs, name, extra = {}) {
  const nodes = pts.map((p) => (p.node != null ? p.node : newNode(map, p[0], p[1])));
  const points = nodes.map((i) => map.nodes[i]);
  const cum = [0]; for (let i = 1; i < points.length; i++) cum.push(cum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  const road = { id: 'walk:' + map.roads.length, name, displayName: name, type: 'steps', width: STAIR_W, surface: 'concrete', oneway: false, nodes, points, length: cum.at(-1), bridge: false, elevated: true, walkDeck: true, footbridge: true, noTraffic: true, synthetic: true, nodeH: hs, cum, ...extra };
  road.heightAt = (s) => { s = Math.max(0, Math.min(road.length, s)); let i = 1; while (i < cum.length - 1 && cum[i] < s) i++; const t = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]); return lerp(hs[i - 1], hs[i], t); };
  map.roads.push(road); return road;
}

/** Before markElevated: invented road flyovers over busy junctions near Upper Iweka. Deterministic. */
export function addRoadFlyovers(map, landmarks, { max = 2 } = {}) {
  const ui = landmarks.get('upper-iweka'); if (!ui) return [];
  const zik = landmarks.list.find((l) => /zik|dmgs/i.test(l.id + ' ' + l.name));
  const existing = map.roads.filter((r) => r.bridge);
  const out = [], cands = [];
  for (const R of map.roads) {
    if (R.bridge || R.synthetic || !isMajorRoad(R) || R.width < 9 || ['trunk_link', 'primary_link', 'secondary_link'].includes(R.type) || R.nodes.length < 3) continue;
    const P = R.nodes.map((i) => map.nodes[i]);
    for (let k = 1; k < R.nodes.length - 1; k++) {
      const J = R.nodes[k]; if (!map.junctions.has(J)) continue;
      const [jx, jz] = map.nodes[J], d = Math.hypot(jx - ui.x, jz - ui.z);
      if (d < 260 || d > 1300) continue;
      if (zik && Math.hypot(jx - zik.x, jz - zik.z) < 120) continue;
      // nearest existing node 55–105 m back and ahead along the road, no other junction in between
      const back = []; let acc = 0, ok = true; let i = k;
      while (i > 0) { acc += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]); i--; if (acc > 105) break; if (acc >= 55) { back.push(i); break; } if (map.junctions.has(R.nodes[i])) { ok = false; break; } }
      if (!ok || !back.length) continue;
      const ahead = []; acc = 0; i = k;
      while (i < R.nodes.length - 1) { acc += Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); i++; if (acc > 105) break; if (acc >= 55) { ahead.push(i); break; } if (map.junctions.has(R.nodes[i])) { ok = false; break; } }
      if (!ok || !ahead.length) continue;
      const i0 = back[0], i1 = ahead[0], span = P.slice(i0, i1 + 1);
      if (map.junctions.has(R.nodes[i0]) || map.junctions.has(R.nodes[i1])) continue;
      // straight enough for a deck
      const [ax, az] = span[0], [bx, bz] = span.at(-1), L = Math.hypot(bx - ax, bz - az);
      if (span.some(([x, z]) => Math.abs((x - ax) * (bz - az) - (z - az) * (bx - ax)) / L > 4)) continue;
      if (polyLen(span) > L * 1.04) continue;
      // keep clear of the real flyover / bridges
      if (existing.some((r) => r.nodes.some((n) => span.some(([x, z]) => Math.hypot(map.nodes[n][0] - x, map.nodes[n][1] - z) < 60)))) continue;
      cands.push({ R, i0, i1, k, d, L, jx, jz, major: ['trunk', 'primary'].includes(R.type) ? 0 : 1 });
    }
  }
  cands.sort((a, b) => a.major - b.major || a.d - b.d);
  for (const c of cands) {
    if (out.length >= max) break;
    if (out.some((o) => Math.hypot(o.jx - c.jx, o.jz - c.jz) < 350)) continue;
    const { R, i0, i1 } = c, nodes = [R.nodes[i0]];
    for (let i = i0 + 1; i < i1; i++) nodes.push(newNode(map, ...map.nodes[R.nodes[i]])); // its own deck nodes (not joined to the junction below)
    nodes.push(R.nodes[i1]);
    const base = R.displayName || R.name || 'Iweka Link';
    const F = { id: 'flyover:' + out.length, name: `${base} Flyover`, displayName: `${base} Flyover`, type: R.type, width: Math.max(7, R.width - 3), surface: 'asphalt', oneway: R.oneway, nodes, points: nodes.map((n) => map.nodes[n]), bridge: true, layer: 1, synthetic: true, invented: true };
    map.roads.push(F);
    // the ground lanes under the deck: no through traffic (cars take the flyover); people can still walk there
    let s0 = 0; for (let i = 0; i < i0; i++) s0 += Math.hypot(map.nodes[R.nodes[i + 1]][0] - map.nodes[R.nodes[i]][0], map.nodes[R.nodes[i + 1]][1] - map.nodes[R.nodes[i]][1]);
    (R.noTrafficSpans ??= []).push([s0, s0 + polyLen(R.nodes.slice(i0, i1 + 1).map((n) => map.nodes[n]))]);
    out.push({ road: F, under: R, jx: c.jx, jz: c.jz });
  }
  map.flyovers = out;
  return out;
}

/**
 * After markElevated (deck heights known), before the bridges are drawn and before houses fill empty land:
 * staircases on the walkable decks and footbridges over the main roads. Footprints are reserved in the collision
 * world (removed again after the houses are placed).
 */
export function planWalkways(map, collision, isWater, landmarks) {
  const ui = landmarks.get('upper-iweka'), plan = { stairs: [], footbridges: [], reservations: [], why: {} }, why = (k) => { plan.why[k] = (plan.why[k] ?? 0) + 1; };
  if (!ui) return plan;
  const sites = Object.values(map.monumentSites ?? {}), monR = (l) => { const st = sites.find((q) => Math.hypot(q.x - l.x, q.z - l.z) < 20); return st ? st.r + 4 : 14; };
  const keep = landmarks.list.filter((l) => ['market', 'monument', 'stadium', 'mall', 'church', 'school'].includes(l.kind));
  const onRoad = (x, z, m, allow) => { const r = map.onCarriageway(x, z, m); return r && !(allow && r === allow.road && Math.hypot(x - allow.jx, z - allow.jz) > allow.clear); };
  const clearGround = (x, z, r = 1.2, allow = null) => collision.isFree(x, z, r) && !onRoad(x, z, 0.6, allow) && !isWater(x, z) && x > map.bounds.minX + 5 && x < map.bounds.maxX - 5 && z > map.bounds.minZ + 5 && z < map.bounds.maxZ - 5 && !map.inHomeAccess?.(x, z, 1.5) && !keep.some((l) => Math.hypot(l.x - x, l.z - z) < (l.kind === 'monument' ? monR(l) : Math.min(l.radius ?? 40, 80)));
  const taken = [];
  const free = (pts, allow) => pts.every(([x, z]) => clearGround(x, z, 1.2, allow) && !taken.some((t) => Math.hypot(t[0] - x, t[1] - z) < 3));
  const reserve = (pts) => { for (const p of pts) taken.push(p); };
  // ── stairs on flyover decks ───────────────────────────────────────────
  const decks = map.roads.filter((r) => r.elevated && r.walkDeck && !r.footbridge && r.deckH && Math.hypot(r.points[0][0] - ui.x, r.points[0][1] - ui.z) < 1500);
  plan.decks = decks.map((r) => [r.id, Math.round(r.length), r.deckTop]);
  for (const road of decks) {
    const P = road.points, L = road.length, at = (s) => { let acc = 0; for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); if (acc + l >= s || i === P.length - 2) { const t = Math.min(1, (s - acc) / l); return { x: lerp(P[i][0], P[i + 1][0], t), z: lerp(P[i][1], P[i + 1][1], t), dx: (P[i + 1][0] - P[i][0]) / l, dz: (P[i + 1][1] - P[i][1]) / l }; } acc += l; } };
    // under an invented flyover the ground lanes carry no through traffic: its stairs may come down there (clear of the junction)
    const fo = map.flyovers?.find((f) => f.road === road), allow = fo ? { road: fo.under, jx: fo.jx, jz: fo.jz, clear: fo.under.width / 2 + 12 } : null;
    const want = L > 140 ? 2 : 1, got = [], W = (k) => why(road.id + ':' + k);
    const order = []; for (let s = 6; s < L - 6; s += 3) order.push(s); order.sort((a, b) => Math.abs(a - L / 2) - Math.abs(b - L / 2));
    for (const s of order) {
      if (got.length >= want) break;
      const h = road.deckH(s); if (h < 3.5) { W('low'); continue; }
      for (const side of [1, -1]) for (const dir of [1, -1]) {
        if (got.length >= want || got.some((g) => Math.abs(g.s - s) < 40 || (g.side === side && Math.abs(g.s - s) < 70))) continue;
        const run = flightLen(h), q = at(s), nx = -q.dz * side, nz = q.dx * side, off = road.width / 2 + 0.35 + STAIR_W / 2;
        // the top landing beside the opening, then the flight runs along the deck (dir) down to the ground
        const tx = q.x + nx * off, tz = q.z + nz * off, ux = q.dx * dir, uz = q.dz * dir;
        const lx = tx + ux * 1.2, lz = tz + uz * 1.2, bx = lx + ux * run, bz = lz + uz * run;
        // the deck above the flight must stay higher than the flight (no stair through a ramp): only where deck is flat
        const foot = []; for (let t = 0; t <= 1.0001; t += 0.1) { const y = h * (1 - t); if (y < 2.6) for (const w of [-0.8, 0, 0.8]) foot.push([lx + ux * run * t + nx * w, lz + uz * run * t + nz * w]); }
        foot.push([bx + ux * 1.2, bz + uz * 1.2]);
        // under the high part only the posts touch the ground
        const posts = [[tx, tz], [lx + ux * run * 0.5, lz + uz * run * 0.5]];
        if (!free(foot, allow)) { W('foot'); for (const [x, z] of foot) { if (!collision.isFree(x, z, 1.2)) W('f-coll'); else if (onRoad(x, z, 0.6, allow)) W('f-road'); else if (keep.some((l) => Math.hypot(l.x - x, l.z - z) < (l.kind === 'monument' ? monR(l) : Math.min(l.radius ?? 40, 80)))) W('f-keep'); else W('f-other'); } continue; }
        if (!posts.every(([x, z]) => collision.isFree(x, z, 0.4) && !onRoad(x, z, 0.4, allow))) { W('posts'); continue; }
        // nothing taller than the deck edge in the way of the flight (buildings)
        if (collision.raycast(tx, tz, bx, bz) < 0.99) { W('ray'); continue; }
        reserve(foot); reserve(posts);
        got.push({ s, side, dir, h });
        const gap = { s0: s - 1.05, s1: s + 1.05, side }; (road.parapetGaps ??= []).push(gap);
        const deckIn = [q.x + nx * (road.width / 2 - 1.4), q.z + nz * (road.width / 2 - 1.4)];
        const wr = walkway(map, [deckIn, [tx, tz], [lx, lz], [bx, bz], [bx + ux * 1.2, bz + uz * 1.2]], [road.heightAt(s), h + 0.08, h + 0.08, 0.02, 0.02], `${road.displayName || 'Flyover'} stairs`);
        plan.stairs.push({ road: wr, deck: road, s, h, edge: { x: q.x + nx * (road.width / 2 + 0.2), z: q.z + nz * (road.width / 2 + 0.2) }, top: { x: tx, z: tz, y: h + 0.08 }, landing: { x: lx, z: lz }, bottom: { x: bx + ux * 1.2, z: bz + uz * 1.2 }, ux, uz, nx, nz, run, yaw: Math.atan2(-ux, -uz), posts });
      }
    }
  }
  // ── pedestrian footbridges over the main roads ───────────────────────
  const elevated = map.roads.filter((r) => r.elevated && !r.footbridge);
  const segs = [];
  for (const r of map.roads) {
    if (r.elevated || r.synthetic || !isMajorRoad(r) || r.width < 9 || /_link$/.test(r.type)) continue;
    for (let i = 0; i < r.nodes.length - 1; i++) {
      const [ax, az] = map.nodes[r.nodes[i]], [bx, bz] = map.nodes[r.nodes[i + 1]], L = Math.hypot(bx - ax, bz - az); if (L < 46) continue;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2, d = Math.hypot(mx - ui.x, mz - ui.z); if (d < 150 || d > 1100) continue;
      if ([...map.junctions].length && [r.nodes[i], r.nodes[i + 1]].some((n) => map.junctions.has(n)) && L < 70) continue;
      if (elevated.some((e) => e.points.some(([x, z]) => Math.hypot(x - mx, z - mz) < 70))) continue;
      segs.push({ r, ax, az, bx, bz, L, mx, mz, d, dx: (bx - ax) / L, dz: (bz - az) / L });
    }
  }
  segs.sort((a, b) => a.d - b.d);
  for (const sg of segs) {
    if (plan.footbridges.length >= 4) break;
    if (plan.footbridges.some((f) => Math.hypot(f.x - sg.mx, f.z - sg.mz) < 220)) continue;
    const half = sg.r.width / 2 + 2.2, run = flightLen(FOOT_H), nx = -sg.dz, nz = sg.dx;
    // the span crosses the road square-on; on each side a flight runs along the pavement
    for (const dir of [1, -1]) {
      const ends = [1, -1].map((side) => { const ex = sg.mx + nx * half * side, ez = sg.mz + nz * half * side, ux = sg.dx * dir * side, uz = sg.dz * dir * side; return { side, ex, ez, ux, uz, lx: ex + ux * 1.4, lz: ez + uz * 1.4, bx: ex + ux * (1.4 + run), bz: ez + uz * (1.4 + run) }; });
      const foot = ends.flatMap((e) => { const pts = []; for (let t = 0; t <= 1.0001; t += 0.1) if (FOOT_H * (1 - t) < 2.6) for (const w of [-0.7, 0, 0.7]) pts.push([e.lx + e.ux * run * t + nx * w * e.side, e.lz + e.uz * run * t + nz * w * e.side]); pts.push([e.bx + e.ux * 1.2, e.bz + e.uz * 1.2], [e.ex, e.ez]); return pts; });
      if (!free(foot)) continue;
      if (ends.some((e) => collision.raycast(e.ex, e.ez, e.bx, e.bz) < 0.99)) continue;
      // the span itself must only cross this road (no buildings in the way at deck height)
      if (collision.raycast(ends[0].ex, ends[0].ez, ends[1].ex, ends[1].ez) < 0.99) continue;
      reserve(foot);
      const [A, B] = ends, nm = `${sg.r.displayName || sg.r.name || 'Road'} footbridge`;
      const wr = walkway(map, [[A.bx + A.ux * 1.2, A.bz + A.uz * 1.2], [A.bx, A.bz], [A.lx, A.lz], [A.ex, A.ez], [B.ex, B.ez], [B.lx, B.lz], [B.bx, B.bz], [B.bx + B.ux * 1.2, B.bz + B.uz * 1.2]], [0.02, 0.02, FOOT_H, FOOT_H, FOOT_H, FOOT_H, 0.02, 0.02], nm, { width: FOOT_W });
      plan.footbridges.push({ road: wr, x: sg.mx, z: sg.mz, ends, run, h: FOOT_H, nx, nz, over: sg.r });
      break;
    }
  }
  // NPC routes: join each stair foot to the nearest pavement node (when the way there is clear)
  const walkNodes = []; for (const r of map.roads) if (!r.elevated && !r.synthetic && !['trunk', 'motorway'].includes(r.type)) for (const n of r.nodes) walkNodes.push(n);
  const join = (x, z, name) => {
    let best = null, bd = 30; for (const n of walkNodes) { const [nx, nz] = map.nodes[n], d = Math.hypot(nx - x, nz - z); if (d < bd && collision.raycast(x, z, nx, nz) > 0.99) { bd = d; best = n; } }
    if (best != null && bd > 1) { const p = [x, z]; p.node = null; const q = [...map.nodes[best]]; q.node = best; walkway(map, [p, q], [0.02, 0], name, { joiner: true }); }
  };
  for (const s of plan.stairs) join(s.bottom.x, s.bottom.z, s.road.name);
  for (const f of plan.footbridges) for (const e of f.ends) join(e.bx + e.ux * 1.2, e.bz + e.uz * 1.2, f.road.name);
  // reserve footprints against houses on empty land
  for (const p of taken) plan.reservations.push(collision.addCircle(p[0], p[1], 1.4));
  return plan;
}

/** Concrete stairs with handrails, posts and landings; footbridge spans with railings and end towers. */
export function buildWalkwayGeometry(plan, tex, collision) {
  const group = new THREE.Group(); group.name = 'Flyover-walkways';
  const c = new GeoBuilder(), rail = new GeoBuilder();
  const cc = new THREE.Color('#bdb7ab'), cd = new THREE.Color('#8f8a80'), tread = new THREE.Color('#a8a397'), steel = new THREE.Color('#2f6b4f'), yellow = new THREE.Color('#d9b521');
  const flight = (lx, lz, ux, uz, nx, nz, h, run, w) => { // from the landing (h) down to the ground along u
    const n = Math.ceil(h / RISE), yaw = Math.atan2(ux, uz);
    for (let i = 0; i < n; i++) { const t0 = i / n, y = h * (1 - (i + 1) / n), cx = lx + ux * run * (t0 + 0.5 / n), cz = lz + uz * run * (t0 + 0.5 / n); c.box(cx, cz, Math.max(0, y - 0.22), y + RISE, w, run / n + 0.02, yaw, i % 2 ? tread : cc); }
    // stringers + handrails on both sides
    for (const sd of [-1, 1]) {
      const ox = nx * (w / 2 + 0.05) * sd, oz = nz * (w / 2 + 0.05) * sd, bx = lx + ux * run, bz = lz + uz * run;
      c.beam([lx + ox, h - 0.15, lz + oz], [bx + ox, 0.0, bz + oz], 0.3, cd);
      rail.beam([lx + ox, h + 1.0, lz + oz], [bx + ox, 1.0, bz + oz], 0.07, steel);
      for (let t = 0; t <= 1.0001; t += 0.2) rail.beam([lx + ox + ux * run * t, h * (1 - t) + 0.05, lz + oz + uz * run * t], [lx + ox + ux * run * t, h * (1 - t) + 1.0, lz + oz + uz * run * t], 0.05, steel);
    }
    // posts under the high half
    for (const t of [0.05, 0.5]) { const px = lx + ux * run * t, pz = lz + uz * run * t, y = h * (1 - t); if (y > 1.6) { c.box(px, pz, 0, y - 0.2, 0.45, 0.45, yaw, cd); collision?.addCircle(px, pz, 0.35); } }
  };
  const landing = (x, z, h, w, d, yaw) => { c.box(x, z, h - 0.35, h + 0.08, w, d, yaw, cc); };
  for (const s of plan.stairs) {
    const yaw = Math.atan2(s.ux, s.uz);
    landing((s.top.x + s.landing.x) / 2, (s.top.z + s.landing.z) / 2, s.h, STAIR_W + 0.1, 1.4 + 1.2, yaw);
    // railing round the landing's open side
    const ox = s.nx * (STAIR_W / 2 + 0.05), oz = s.nz * (STAIR_W / 2 + 0.05);
    rail.beam([s.top.x + ox - s.ux * 1.2, s.h + 1.05, s.top.z + oz - s.uz * 1.2], [s.landing.x + ox, s.h + 1.05, s.landing.z + oz], 0.07, steel);
    rail.beam([s.top.x - s.ux * 1.2 - ox, s.h + 1.05, s.top.z - s.uz * 1.2 - oz], [s.top.x - s.ux * 1.2 + ox, s.h + 1.05, s.top.z - s.uz * 1.2 + oz], 0.07, steel);
    c.box(s.top.x - s.ux * 0.6, s.top.z - s.uz * 0.6, 0, s.h - 0.35, 0.5, 0.5, yaw, cd); collision?.addCircle(s.top.x - s.ux * 0.6, s.top.z - s.uz * 0.6, 0.35);
    c.box(s.edge.x, s.edge.z, s.h - 0.35, s.h + 0.08, 0.9, 2.1, yaw, cc); // bridge from the deck edge to the landing
    flight(s.landing.x, s.landing.z, s.ux, s.uz, s.nx, s.nz, s.h, s.run, STAIR_W);
    c.box(s.bottom.x - s.ux * 0.6, s.bottom.z - s.uz * 0.6, 0, 0.05, STAIR_W, 1.2, yaw, yellow); // painted foot of the stairs
  }
  for (const f of plan.footbridges) {
    const [A, B] = f.ends, yaw = Math.atan2(f.nx, f.nz), span = Math.hypot(B.ex - A.ex, B.ez - A.ez);
    c.box((A.ex + B.ex) / 2, (A.ez + B.ez) / 2, f.h - 0.55, f.h + 0.02, FOOT_W, span + 0.2, yaw, cc);
    for (const sd of [-1, 1]) { // see-through steel railings with a top rail and a mesh of verticals
      const ox = Math.cos(yaw) * (FOOT_W / 2) * sd, oz = -Math.sin(yaw) * (FOOT_W / 2) * sd;
      rail.beam([A.ex + ox, f.h + 1.15, A.ez + oz], [B.ex + ox, f.h + 1.15, B.ez + oz], 0.08, steel);
      rail.beam([A.ex + ox, f.h + 0.1, A.ez + oz], [B.ex + ox, f.h + 0.1, B.ez + oz], 0.08, steel);
      const n = Math.ceil(span / 0.9); for (let i = 0; i <= n; i++) { const t = i / n; rail.beam([lerp(A.ex, B.ex, t) + ox, f.h + 0.1, lerp(A.ez, B.ez, t) + oz], [lerp(A.ex, B.ex, t) + ox, f.h + 1.15, lerp(A.ez, B.ez, t) + oz], 0.04, steel); }
    }
    for (const e of f.ends) {
      const ux = e.ux, uz = e.uz, nx = f.nx * e.side, nz = f.nz * e.side;
      landing((e.ex + e.lx) / 2 + nx * 0.0, (e.ez + e.lz) / 2, f.h, FOOT_W, 1.4 + FOOT_W, Math.atan2(ux, uz));
      for (const [px, pz] of [[e.ex - ux * 0.9, e.ez - uz * 0.9], [e.ex + ux * 1.6, e.ez + uz * 1.6]]) { c.box(px, pz, 0, f.h - 0.5, 0.55, 0.55, 0, cd); collision?.addCircle(px, pz, 0.38); }
      flight(e.lx, e.lz, ux, uz, Math.cos(Math.atan2(ux, uz)), -Math.sin(Math.atan2(ux, uz)), f.h, f.run, 1.8);
      c.box(e.bx + ux * 0.6, e.bz + uz * 0.6, 0, 0.05, 1.8, 1.2, Math.atan2(ux, uz), yellow);
    }
  }
  const add = (gb, mat) => { if (!gb.vertexCount) return; const m = new THREE.Mesh(gb.build(), mat); m.castShadow = true; m.receiveShadow = true; m.name = 'Walkways'; group.add(m); };
  add(c, new THREE.MeshStandardMaterial({ map: tex?.concrete ?? null, vertexColors: true, roughness: 0.95 }));
  add(rail, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }));
  return group;
}
