import * as THREE from 'three';
/**
 * Onitsha residential building kit (v0.38). Every residential footprint from the map keeps its real outline and
 * collider; this kit decides *what kind of building* stands there and adds the parts that make it read as one:
 * verandas with pillars, porches, balconies, dado bands, roof style and paint. Everything is deterministic from
 * the building's seed, planned once at load (so colliders are complete) and drawn into the chunk's merged meshes
 * (no extra draw calls).
 *
 * Types (from the brief): older bungalow · tenement ("face-me-I-face-you") · modern bungalow · duplex ·
 * storey building with flats · apartment block · shops with rooms above · self-contained units.
 */
export const BUILDING_TYPES = {
  oldbungalow: { label: 'Older bungalow', paints: ['#e8d9b0', '#d9c79a', '#cfe0d6', '#e7cfae', '#d6dfb8', '#efe4c8'], dado: ['#7b6a52', '#5e7064', '#8a4f3a'], roof: { pitched: true, tiles: ['RUST', 'RUST', 'ZINC'], gable: 0.7 }, veranda: 0.75, verandaWall: true },
  tenement: { label: 'Tenement (face-me-I-face-you)', paints: ['#e3d3a6', '#d8cdb2', '#c9d8cf', '#e2c4a2', '#ddd5bd'], dado: ['#6d5c48', '#55665c', '#7c4a3a'], roof: { pitched: true, tiles: ['RUST', 'ZINC'], gable: 0.85 }, veranda: 0.9, verandaWall: true, manyDoors: true },
  modernbungalow: { label: 'Modern bungalow', paints: ['#f4f1ea', '#efe6d4', '#e9e4dc', '#f3e3cf', '#e6ece9', '#efe9dd'], accent: ['#8b6f4e', '#5d6d7e', '#9c4f3f', '#3f6b5c'], roof: { pitched: true, tiles: ['LONGSPAN'], gable: 0.15 }, porch: 0.85 },
  duplex: { label: 'Duplex', paints: ['#f4efe6', '#eadfcb', '#f1e4d6', '#e4e7e1', '#efe2c9', '#f6f0e4'], accent: ['#7f5539', '#4a5d6e', '#8c3f37', '#2f5d50'], roof: { pitched: true, tiles: ['LONGSPAN'], gable: 0.2 }, porch: 0.8, balcony: 0.9 },
  storeyflats: { label: 'Storey building with flats', paints: ['#efe3c4', '#e6d6b8', '#d8e2dc', '#f0d8c0', '#e7e1cf', '#dfe6d0'], accent: ['#6c5a45', '#4d5f69', '#7b4536'], roof: { pitched: false }, balcony: 1, tanks: 0.8 },
  apartment: { label: 'Apartment block', paints: ['#f1ece2', '#e5e1d6', '#e9dccb', '#dde4e2', '#efe6d2'], accent: ['#5b6670', '#7a5c44', '#3f5f6e'], roof: { pitched: false }, balcony: 1, tanks: 1 },
  shopsrooms: { label: 'Shops with rooms above', paints: ['#efe1c0', '#e4d3b4', '#e8dcc9', '#d9e1d2'], accent: ['#6b4f3a', '#3f5866'], roof: { pitched: false }, balcony: 0.85, tanks: 0.6 },
  // v0.48 GRA: detached houses on big plots, finished in white, cream and stone with dark trim
  villa: { label: 'Detached villa', paints: ['#f7f6f2', '#f1ede4', '#ece6da', '#e9ecee', '#f5efe3'], accent: ['#2b2f33', '#5a4632', '#1f3b4d', '#6b6f73'], roof: { pitched: true, tiles: ['LONGSPAN'], gable: 0.1 }, porch: 1, balcony: 1 },
  mansion: { label: 'Mansion', paints: ['#fbfaf7', '#efe9dc', '#e6e1d6', '#f4efe6'], accent: ['#1b1d20', '#8a6d3b', '#2e3b30'], roof: { pitched: true, tiles: ['LONGSPAN'], gable: 0.05 }, porch: 1, balcony: 1 },
  selfcon: { label: 'Self-contained units', paints: ['#efe7d3', '#e8dcc0', '#dfe5dc', '#efd9c5', '#e7e2d2'], dado: ['#6f6f6f', '#7b6a52'], roof: { pitched: true, tiles: ['ZINC', 'LONGSPAN', 'RUST'], gable: 0.9 }, veranda: 0.55, manyDoors: true },
};
const OLD_CORES = ['main-market', 'ochanja', 'fegge', 'bridgehead'];
/** Which kind of building a footprint becomes. Pure (unit-tested): same building → same type every time. */
export function classifyBuilding({ kind, levels, area, box, rect }, rng, { oldCore = 0, premium = 0 } = {}) {
  if (kind === 'commercial') return levels >= 2 && levels <= 3 && rect > 0.75 && rng() < 0.5 ? 'shopsrooms' : null;
  if (kind !== 'residential') return null;
  if (premium > 0.5) { // GRA (v0.48): roomy detached houses, some mansions, a few good apartment blocks; never tenements
    const r = rng();
    if (levels >= 4) return 'apartment';
    if (area > 300) return r < 0.7 ? 'mansion' : 'villa';
    if (area > 110) return r < 0.6 ? 'villa' : r < 0.85 ? 'duplex' : 'modernbungalow';
    return r < 0.6 ? 'modernbungalow' : 'duplex';
  }
  const aspect = box ? Math.max(box.w, box.d) / Math.max(0.1, Math.min(box.w, box.d)) : 1, r = rng();
  if (levels >= 4) return 'apartment';
  if (levels === 3) return area > 240 ? 'apartment' : 'storeyflats';
  if (levels === 2) return area > 280 && aspect > 1.3 ? 'storeyflats' : r < 0.62 ? 'duplex' : 'storeyflats';
  if (area < 75) return r < 0.6 ? 'selfcon' : 'oldbungalow';
  if (aspect > 2.1 && area < 420) return r < 0.55 ? 'tenement' : 'selfcon';
  const oldShare = 0.35 + 0.4 * oldCore; // older bungalows dominate the old trading districts
  return r < oldShare ? 'oldbungalow' : r < oldShare + 0.12 ? 'tenement' : 'modernbungalow';
}
export function oldCoreWeight(landmarks, x, z) {
  let w = 0; for (const id of OLD_CORES) { const l = landmarks.get(id); if (l) w = Math.max(w, 1 - Math.min(1, Math.hypot(x - l.x, z - l.z) / 1100)); }
  return w;
}
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
/** The front edge with its outward normal (pointing away from the building). */
export function frontEdge(pts, front, inPoly) {
  const [ax, az] = pts[front], [bx, bz] = pts[(front + 1) % pts.length];
  const L = Math.hypot(bx - ax, bz - az); if (L < 0.5) return null;
  let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  if (inPoly(mx + nx * 0.4, mz + nz * 0.4, pts)) { nx = -nx; nz = -nz; }
  return { ax, az, bx, bz, L, ux: (bx - ax) / L, uz: (bz - az) / L, nx, nz };
}
/**
 * Plan a building's look and its front parts. `clear(pts)` says whether a ground polygon is free of roads and
 * other buildings. Returns {type, paint, dado, accent, roof, veranda, porch, balconies} (parts may be null).
 */
export function planBuilding(it, rng, { clear, inPoly, oldCore = 0, premium = 0, gh = 3, fh = 3 }) {
  const type = classifyBuilding(it, rng, { oldCore, premium }); if (!type) return null;
  const st = BUILDING_TYPES[type], plan = { type, paint: pick(rng, st.paints), dado: st.dado ? pick(rng, st.dado) : null, accent: st.accent ? pick(rng, st.accent) : null };
  if (st.roof.pitched) plan.roof = { pitched: true, tile: pick(rng, st.roof.tiles), gable: rng() < st.roof.gable };
  else plan.roof = { pitched: false, tank: rng() < (st.tanks ?? 0) ? rng() : -1 };
  const b = it.b, e = b.front >= 0 ? frontEdge(b.pts, b.front, inPoly) : null;
  if (!e) return plan;
  const P = (t, out) => [e.ax + e.ux * t + e.nx * out, e.az + e.uz * t + e.nz * out];
  const strip = (t0, t1, d) => [P(t0, 0.05), P(t1, 0.05), P(t1, d), P(t0, d)];
  if (st.veranda && rng() < st.veranda && e.L >= 5) {
    const inset = Math.min(1, e.L * 0.08), t0 = inset, t1 = e.L - inset;
    for (const d of [2.2, 1.7]) if (clear(strip(t0, t1, d + 0.3))) {
      const n = Math.max(2, Math.round((t1 - t0) / 2.6) + 1), pillars = [];
      for (let i = 0; i < n; i++) pillars.push(P(t0 + 0.15 + (t1 - t0 - 0.3) * i / (n - 1), d - 0.18));
      plan.veranda = { edge: e, t0, t1, d, h: gh, pillars, wall: !!st.verandaWall && rng() < 0.7, gap: (t0 + t1) / 2 };
      break;
    }
  }
  if (!plan.veranda && st.porch && rng() < st.porch && e.L >= 6) {
    const tc = e.L / 2, w = Math.min(3.2, e.L * 0.38), d = 1.9;
    if (clear(strip(tc - w / 2, tc + w / 2, d + 0.3))) plan.porch = { edge: e, tc, w, d, h: gh, pillars: [P(tc - w / 2 + 0.2, d - 0.2), P(tc + w / 2 - 0.2, d - 0.2)] };
  }
  if (st.balcony && it.levels >= 2 && rng() < st.balcony && e.L >= 5) {
    const w = Math.min(e.L - 1.2, Math.max(3, e.L * (type === 'apartment' || type === 'storeyflats' ? 0.8 : 0.5))), tc = e.L / 2, d = 1.15;
    if (clear(strip(tc - w / 2, tc + w / 2, d + 0.2)) || plan.veranda || plan.porch) {
      plan.balconies = [];
      for (let f = 1; f < it.levels; f++) plan.balconies.push({ edge: e, tc, w, d, y: gh + (f - 1) * fh });
    }
  }
  if (st.manyDoors) plan.manyDoors = true;
  return plan;
}
const C = (hex) => new THREE.Color(hex);
const yawOf = (e) => Math.atan2(-e.uz, e.ux); // GeoBuilder.box: width along the edge, depth along its normal
/** Draw the planned parts into the chunk builders. `roofQuad(corners, tile, col)` draws a sloped sheet. */
export function drawParts(it, plan, { misc, roofs, walls }, { roofQuad, plainUV }) {
  const paint = C(plan.paint), slab = C('#cfc9bd'), pillar = paint.clone().lerp(C('#ffffff'), 0.35), dark = C('#3b3a36');
  // dado band (painted lower wall) on every edge of older buildings
  if (plan.dado) {
    const col = C(plan.dado), pts = it.b.pts;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
      let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (it._inPoly(mx + nx * 0.3, mz + nz * 0.3, pts)) { nx = -nx; nz = -nz; }
      walls.quad([[ax + nx * 0.025, -0.2, az + nz * 0.025], [bx + nx * 0.025, -0.2, bz + nz * 0.025], [bx + nx * 0.025, 0.9, bz + nz * 0.025], [ax + nx * 0.025, 0.9, az + nz * 0.025]], plainUV, [nx, 0, nz], col);
    }
  }
  const v = plan.veranda;
  if (v) {
    const e = v.edge, yaw = yawOf(e), tm = (v.t0 + v.t1) / 2, w = v.t1 - v.t0;
    const at = (t, out) => [e.ax + e.ux * t + e.nx * out, e.az + e.uz * t + e.nz * out];
    const [fx, fz] = at(tm, v.d / 2);
    misc.box(fx, fz, -0.2, 0.2, w, v.d, yaw, slab); // raised floor
    const [sx, sz] = at(tm, 0.55);
    misc.box(sx, sz, 0.2 - 0.12, 0.2, Math.min(2.2, w * 0.3), 1.1, yaw, slab, undefined, 'all');
    for (const [px, pz] of v.pillars) misc.box(px, pz, 0.2, v.h, 0.26, 0.26, yaw, pillar);
    if (v.wall) { // low veranda wall between the pillars, open at the entrance
      for (let i = 0; i < v.pillars.length - 1; i++) {
        const [ax, az] = v.pillars[i], [bx, bz] = v.pillars[i + 1], mx = (ax + bx) / 2, mz = (az + bz) / 2;
        const tMid = (mx - e.ax) * e.ux + (mz - e.az) * e.uz; if (Math.abs(tMid - v.gap) < 1.4) continue;
        misc.box(mx, mz, 0.2, 1.0, Math.hypot(bx - ax, bz - az) - 0.26, 0.2, yaw, plan.dado ? C(plan.dado) : pillar);
      }
    }
    if (it.roof.pitched) { // lean-to sheet roof over the veranda
      const y0 = v.h + 0.15, y1 = v.h - 0.25, o = 0.25;
      const c = [[...withY(at(v.t0 - o, 0), y0)], [...withY(at(v.t1 + o, 0), y0)], [...withY(at(v.t1 + o, v.d + o), y1)], [...withY(at(v.t0 - o, v.d + o), y1)]];
      roofQuad(c, it.roof.tile, it.roof.color ? C(it.roof.color) : new THREE.Color().setScalar(it.roof.shade ?? 0.9));
    } else misc.box(fx, fz, v.h - 0.05, v.h + 0.15, w + 0.3, v.d + 0.2, yaw, slab);
  }
  const p = plan.porch;
  if (p) {
    const e = p.edge, yaw = yawOf(e), at = (t, out) => [e.ax + e.ux * t + e.nx * out, e.az + e.uz * t + e.nz * out];
    const [fx, fz] = at(p.tc, p.d / 2); misc.box(fx, fz, -0.2, 0.18, p.w + 0.4, p.d, yaw, slab);
    for (const [px, pz] of p.pillars) misc.box(px, pz, 0.18, p.h, 0.3, 0.3, yaw, pillar);
    const acc = C(plan.accent ?? '#7f5539');
    misc.box(fx, fz, p.h, p.h + 0.3, p.w + 0.5, p.d + 0.3, yaw, pillar); // porch beam / POP fascia
    // small gable roof over the porch, ridge running out from the wall
    const top = p.h + 1.1, half = p.w / 2 + 0.35, out = p.d + 0.35;
    for (const s of [-1, 1]) {
      const c = [withY(at(p.tc + s * half, 0), p.h + 0.3), withY(at(p.tc + s * half, out), p.h + 0.3), withY(at(p.tc, out), top), withY(at(p.tc, 0), top)];
      roofQuad(c, 'LONGSPAN', acc);
    }
    const tri = [withY(at(p.tc - half + 0.1, out - 0.02), p.h + 0.3), withY(at(p.tc + half - 0.1, out - 0.02), p.h + 0.3), withY(at(p.tc, out - 0.02), top - 0.05)];
    walls.tri(tri[0], tri[1], tri[2], plainUV[0], plainUV[1], [(plainUV[0][0] + plainUV[1][0]) / 2, plainUV[2][1]], [e.nx, 0, e.nz], paint);
  }
  for (const bc of plan.balconies ?? []) {
    const e = bc.edge, yaw = yawOf(e), at = (t, out) => [e.ax + e.ux * t + e.nx * out, e.az + e.uz * t + e.nz * out];
    const [fx, fz] = at(bc.tc, bc.d / 2), acc = C(plan.accent ?? '#5b6670');
    misc.box(fx, fz, bc.y - 0.12, bc.y + 0.06, bc.w, bc.d, yaw, slab);
    const [rx, rz] = at(bc.tc, bc.d - 0.06);
    misc.box(rx, rz, bc.y + 0.06, bc.y + 1.0, bc.w, 0.1, yaw, pillar); // balustrade
    misc.box(rx, rz, bc.y + 0.95, bc.y + 1.05, bc.w + 0.04, 0.16, yaw, acc); // handrail
    for (const s of [-1, 1]) { const [qx, qz] = at(bc.tc + s * (bc.w / 2 - 0.05), bc.d / 2); misc.box(qx, qz, bc.y + 0.06, bc.y + 1.0, 0.1, bc.d - 0.1, yaw, pillar); }
  }
  void dark;
}
const withY = ([x, z], y) => [x, y, z];

/**
 * v0.39: uncompleted buildings — a common Onitsha sight. A concrete frame (columns with rusty starter bars,
 * floor slabs), blockwork that stops part-way up, no roof, and blocks and a sand heap in front. Drawn into the
 * chunk's merged meshes. `blockUV` is the atlas rectangle for bare blockwork.
 */
export function drawUnfinished(it, { misc, walls }, { blockUV, fh = 3 }) {
  const b = it.b, pts = b.pts, box = it.box, rnd = (() => { let s = Math.floor(b.seed * 1e9) + 991; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
  const conc = new THREE.Color('#a9a59b'), dark = new THREE.Color('#8f8b82'), rust = new THREE.Color('#6e3b22'), block = new THREE.Color('#d6d2c8');
  const floors = Math.max(1, it.levels), done = floors - (rnd() < 0.6 ? 0 : 1); // the top floor is often just columns
  const colsAt = [];
  for (let i = 0; i < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
    const n = Math.max(1, Math.round(L / 3.4));
    for (let k = 0; k < n; k++) colsAt.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]);
    // blockwork part-way up on the ground floor (and some of the first floor)
    let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (it._inPoly?.(mx + nx * 0.3, mz + nz * 0.3, pts)) { nx = -nx; nz = -nz; }
    for (let f = 0; f < Math.min(2, done); f++) {
      const y0 = f * fh, top = y0 + (f === 0 ? 0.6 + rnd() * 2.2 : rnd() < 0.5 ? 0 : 0.4 + rnd() * 1.2); if (top - y0 < 0.3) continue;
      const v1 = blockUV[1] + (blockUV[3] - blockUV[1]) * Math.min(1, (top - y0) / fh);
      for (const s of [1, -1]) walls.quad([[ax + nx * 0.1 * s, y0, az + nz * 0.1 * s], [bx + nx * 0.1 * s, y0, bz + nz * 0.1 * s], [bx + nx * 0.1 * s, top, bz + nz * 0.1 * s], [ax + nx * 0.1 * s, top, az + nz * 0.1 * s]], [[blockUV[2], blockUV[1]], [blockUV[0], blockUV[1]], [blockUV[0], v1], [blockUV[2], v1]], [nx * s, 0, nz * s], block);
    }
  }
  const yaw = box ? Math.atan2(-box.uz, box.ux) : 0;
  for (const [x, z] of colsAt) {
    misc.box(x, z, -0.1, floors * fh, 0.32, 0.32, yaw, conc);
    for (const [dx, dz] of [[0.08, 0.08], [-0.08, 0.08], [0.08, -0.08], [-0.08, -0.08]]) misc.box(x + dx, z + dz, floors * fh, floors * fh + 0.7 + rnd() * 0.3, 0.03, 0.03, yaw, rust);
  }
  if (box) for (let f = 1; f <= done; f++) misc.box(box.cx, box.cz, f * fh - 0.2, f * fh, box.w + 0.1, box.d + 0.1, yaw, f % 2 ? conc : dark);
  // building materials in front: stacked blocks and a sand heap
  if (box && b.front >= 0) {
    const [ax, az] = pts[b.front], [bx, bz] = pts[(b.front + 1) % pts.length], L = Math.hypot(bx - ax, bz - az) || 1;
    let nx = (bz - az) / L, nz = -(bx - ax) / L; const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (it._inPoly?.(mx + nx * 0.3, mz + nz * 0.3, pts)) { nx = -nx; nz = -nz; }
    if (it.yardClear) {
      const px = mx + nx * 2.2 + (bx - ax) / L * 1.6, pz = mz + nz * 2.2 + (bz - az) / L * 1.6;
      for (let i = 0; i < 3; i++) misc.box(px + (bx - ax) / L * i * 0.5, pz + (bz - az) / L * i * 0.5, 0, 0.9 - i * 0.15, 0.45, 1.0, yaw, new THREE.Color('#c9c4b8'));
      const sx = mx + nx * 2.4 - (bx - ax) / L * 1.8, sz = mz + nz * 2.4 - (bz - az) / L * 1.8;
      for (let i = 0; i < 4; i++) misc.cylinder(sx, sz, i * 0.18, (i + 1) * 0.18, 1.1 - i * 0.25, new THREE.Color('#c79a5b'), 10);
    }
  }
}
