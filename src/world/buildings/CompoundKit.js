import * as THREE from 'three';
/**
 * Residential compounds (v0.38): a perimeter wall with a gate facing the road, and a few of the things every
 * Onitsha compound has — an elevated water tank, a generator house, a clothesline, a security light — chosen
 * per compound from its seed and its size. Drawn into the chunk's merged meshes.
 *
 * A compound is planned in local "plot" space: centre (x, z), yaw (front = +z towards the road), half-sizes
 * hw/hd of the wall ring, and the house rectangle inside it.
 */
const R = (cx, cz, yaw) => { const c = Math.cos(yaw), s = Math.sin(yaw); return (u, w) => [cx + c * u + s * w, cz - s * u + c * w]; };
export const GATE_COLORS = ['#1f3b5a', '#2f2f33', '#6b1f1f', '#1d4d3a', '#5a4630'];
export const WALL_COLORS = ['#e9e1cf', '#d9cfb8', '#e3d9c3', '#cfc8b6', '#efe6d2'];
const PREMIUM_WALLS = ['#f4f2ec', '#e7e2d6', '#d9d3c4', '#efe9de'];
/** Plan the wall ring and features. Returns {segs:[[a,b]], gate:[a,b], features, ...}. Pure. */
export function planCompound({ x, z, yaw, hw, hd, house, rng, tier = 'standard' }) {
  const at = R(x, z, yaw), gw = tier === 'premium' ? 4.8 : tier === 'large' ? 4.2 : 3.4, gu = (rng() - 0.5) * Math.max(0, hw * 2 - gw - 3);
  const c = { x, z, yaw, hw, hd, tier, h: tier === 'premium' ? 2.8 : tier === 'large' ? 2.4 : 2.1, gate: [at(gu - gw / 2, hd), at(gu + gw / 2, hd)], gateU: gu, gateW: gw,
    wallColor: WALL_COLORS[Math.floor(rng() * WALL_COLORS.length)], gateColor: GATE_COLORS[Math.floor(rng() * GATE_COLORS.length)], features: [] };
  if (tier === 'premium') { c.wallColor = PREMIUM_WALLS[Math.floor(c.x * 7 + c.z * 13) & 3]; c.gateColor = '#151719'; } // GRA: tall finished walls, black steel gates
  const corners = [at(-hw, hd), at(-hw, -hd), at(hw, -hd), at(hw, hd)];
  c.ring = corners; // the wall's outline (the maps draw it)
  c.segs = [[corners[0], c.gate[0]], [c.gate[1], corners[3]], [corners[0], corners[1]], [corners[1], corners[2]], [corners[2], corners[3]]].filter(([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.3);
  // front yard (between gate wall and house) and back yard (behind the house) hold the features
  const far = gu >= 0 ? -1 : 1, frontYard = house.front ?? 3.5, backYard = house.back ?? 2.2;
  if (rng() < 0.75 && frontYard >= 3.2) c.features.push({ kind: 'tank', p: at(far * (hw - 1.05), hd - 1.15), yaw });
  if (rng() < 0.55 && frontYard >= 3.6) c.features.push({ kind: 'generator', p: at(far * (hw - 1.0), hd - 2.75), yaw });
  if (rng() < 0.7 && backYard >= 2 && hw > 4) c.features.push({ kind: 'clothesline', a: at(-hw + 0.6, -hd + backYard / 2), b: at(hw - 0.6, -hd + backYard / 2), yaw });
  if (rng() < 0.7) c.features.push({ kind: 'light', p: at(gu + gw / 2 + 0.5, hd - 0.15), yaw });
  return c;
}
/** Collider rectangles (thin walls) for a planned compound. */
export function compoundColliders(c, t = 0.22) {
  return c.segs.map(([a, b]) => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz * t / 2, nz = ux * t / 2; return [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]; });
}
const C = (h) => new THREE.Color(h);
export function drawCompound(c, { misc, walls, glow }, { plainUV }) {
  const wall = C(c.wallColor), cap = wall.clone().multiplyScalar(0.82), gate = C(c.gateColor), dark = C('#2c2c2c');
  for (const [a, b] of c.segs) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(-(b[1] - a[1]) / L, (b[0] - a[0]) / L), mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    misc.box(mx, mz, -0.1, c.h, L, 0.22, yaw, wall);
    misc.box(mx, mz, c.h, c.h + 0.1, L + 0.05, 0.3, yaw, cap);
    for (let t = 0; t <= L; t += 6) { const px = a[0] + (b[0] - a[0]) * t / L, pz = a[1] + (b[1] - a[1]) * t / L; misc.box(px, pz, -0.1, c.h + 0.25, 0.36, 0.36, yaw, cap); }
  }
  // sliding metal gate across the opening, with gate posts
  const [g0, g1] = c.gate, gl = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]), gy = Math.atan2(-(g1[1] - g0[1]) / gl, (g1[0] - g0[0]) / gl), gm = [(g0[0] + g1[0]) / 2, (g0[1] + g1[1]) / 2];
  // v0.53: the sliding gate itself is drawn by CompoundGates (it opens as you come up to it); the posts stay here
  void gate;
  for (const p of c.gate) misc.box(p[0], p[1], -0.1, c.h + 0.45, 0.45, 0.45, gy, cap);
  for (const f of c.features) {
    if (f.kind === 'tank') { const [x, z] = f.p; for (const [u, w] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) misc.box(x + u * Math.cos(f.yaw) + w * Math.sin(f.yaw), z - u * Math.sin(f.yaw) + w * Math.cos(f.yaw), 0, 2.6, 0.12, 0.12, f.yaw, C('#7c868e')); misc.box(x, z, 2.6, 2.7, 1.3, 1.3, f.yaw, C('#7c868e')); misc.cylinder(x, z, 2.7, 3.85, 0.6, C('#1f2226'), 14); }
    if (f.kind === 'generator') { const [x, z] = f.p; misc.box(x, z, 0, 1.3, 1.4, 1.1, f.yaw, C('#bdb6a6')); misc.box(x, z, 1.3, 1.42, 1.6, 1.3, f.yaw, C('#7a7f84')); misc.box(x, z, 0, 0.9, 0.7, 1.12, f.yaw, dark); }
    if (f.kind === 'clothesline') { const [a, b] = [f.a, f.b]; for (const p of [a, b]) misc.box(p[0], p[1], 0, 1.9, 0.07, 0.07, f.yaw, C('#6c6f72')); const L = Math.hypot(b[0] - a[0], b[1] - a[1]), yaw = Math.atan2(-(b[1] - a[1]) / L, (b[0] - a[0]) / L);
      misc.box((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1.82, 1.84, L, 0.02, yaw, C('#dddddd'));
      const cloths = ['#c0453c', '#f2c14e', '#3f74b8', '#f4f2ec', '#45705a', '#7a2e8a'];
      for (let i = 1; i < 6; i++) { const t = i / 6; if ((i * 37 + Math.round(a[0])) % 3 === 0) continue; misc.box(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 1.1, 1.82, 0.55, 0.03, yaw, C(cloths[(i + Math.round(a[1])) % cloths.length])); } }
    if (f.kind === 'light') { const [x, z] = f.p; misc.box(x, z, c.h + 0.1, c.h + 0.9, 0.08, 0.08, f.yaw, dark); misc.box(x, z, c.h + 0.85, c.h + 1.05, 0.3, 0.22, f.yaw, C('#f6f0d8')); glow?.box(x, z, c.h + 0.84, c.h + 1.06, 0.34, 0.26, f.yaw, C('#fff6dc')); }
  }
  void walls; void plainUV;
}
