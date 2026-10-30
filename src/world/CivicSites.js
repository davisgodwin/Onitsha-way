import * as THREE from 'three';
import { GeoBuilder } from './GeoBuilder.js';
import { rect, roadConflict, frontageCandidates } from './StreetLayout.js';
import { pointInPolygon } from '../core/utils.js';
/**
 * v0.46: purpose-built landmark buildings. Until now the cathedrals, the palace, CKC and Shanahan University were a
 * label on the map (the basilica a generic OSM church you couldn't get into). Each now gets its own building on its
 * own grounds, facing a real road, with a door you walk up to.
 *
 * The plots are reserved BEFORE the city's houses and street props are placed (so nothing is built on them), and no
 * existing building is removed to make room — except the basilica's own generic footprint, which is replaced by the
 * new basilica on the same spot. That keeps every rentable home, flat and shop exactly where saves expect them.
 *
 * The designs are stylised from what could be checked (dates, a rectangular bell tower and concrete arches at All
 * Saints, a 1930s basilica on raised ground); they are game buildings, not surveyed replicas.
 *
 * Local frame of a site: x across the front, z towards the road (the front edge is z = +d/2).
 */
export const CIVIC_SITES = [
 { id: 'basilica', landmark: 'basilica', w: 30, d: 60, fromFootprint: true, style: 'basilica' },
 { id: 'all-saints', landmark: 'all-saints', w: 40, d: 52, style: 'anglican' },
 { id: 'ime-obi', landmark: 'ime-obi', w: 48, d: 42, style: 'palace' },
 { id: 'ckc', landmark: 'ckc', w: 60, d: 50, style: 'school', reach: 420 },
 { id: 'shanahan', landmark: /^osm:/, match: /shanah?a[mn]/i, w: 84, d: 66, style: 'university' },
];
const C = (c) => new THREE.Color(c);
const corners = (pts) => pts;
function overlapsBuilding(map, pts) {
 const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), minX = Math.min(...xs) - 2, maxX = Math.max(...xs) + 2, minZ = Math.min(...zs) - 2, maxZ = Math.max(...zs) + 2;
 for (const b of map.buildings) {
  if (b.layoutHidden) continue; const bp = b.pts; let inBox = false;
  for (const [x, z] of bp) if (x > minX && x < maxX && z > minZ && z < maxZ) { inBox = true; break; }
  if (!inBox) continue;
  if (bp.some(([x, z]) => pointInPolygon(x, z, pts)) || pts.some(([x, z]) => pointInPolygon(x, z, bp))) return b;
  const cx = bp.reduce((a, p) => a + p[0], 0) / bp.length, cz = bp.reduce((a, p) => a + p[1], 0) / bp.length; if (pointInPolygon(cx, cz, pts)) return b;
 }
 return null;
}
/** Oriented box of a footprint, its front edge facing the road. */
function footprintBox(b) {
 const pts = b.pts, e = b.front >= 0 ? b.front : 0, [ax, az] = pts[e], [bx, bz] = pts[(e + 1) % pts.length], L = Math.hypot(bx - ax, bz - az) || 1;
 const ux = (bx - ax) / L, uz = (bz - az) / L; let nx = uz, nz = -ux;
 const cx = pts.reduce((a, p) => a + p[0], 0) / pts.length, cz = pts.reduce((a, p) => a + p[1], 0) / pts.length;
 if ((ax - cx) * nx + (az - cz) * nz < 0) { nx = -nx; nz = -nz; }
 let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const [x, z] of pts) { const a = (x - cx) * ux + (z - cz) * uz, bb = (x - cx) * nx + (z - cz) * nz; a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, bb); b1 = Math.max(b1, bb); }
 const mx = cx + ux * (a0 + a1) / 2 + nx * (b0 + b1) / 2, mz = cz + uz * (a0 + a1) / 2 + nz * (b0 + b1) / 2;
 return { x: mx, z: mz, yaw: Math.atan2(nx, nz), w: a1 - a0, d: b1 - b0 };
}
/**
 * Before the city is built: find each site a clear, road-fronting plot near its landmark and reserve it.
 * Returns the plans; buildCivicSites() puts the buildings up later.
 */
export function planCivicSites(w) {
 const map = w.map, plans = [], bounds = map.bounds;
 for (const def of CIVIC_SITES) {
  const L = typeof def.landmark === 'string' ? w.landmarks.get(def.landmark) : w.landmarks.list.find((l) => def.landmark.test(l.id) && def.match.test(l.name));
  if (!L) continue;
  let plan = null;
  if (def.fromFootprint && L.osmBuilding) {
   const b = map.buildings.find((bb) => String(bb.id) === L.osmBuilding);
   if (b) { const fb = footprintBox(b); const W = Math.max(26, Math.min(36, fb.w)), D = Math.max(48, Math.min(66, fb.d)); b.layoutHidden = true; plan = { x: fb.x, z: fb.z, yaw: fb.yaw, w: W, d: D, replaced: b.id }; }
  }
  if (!plan) for (const scale of [1, 0.85, 0.72, 0.6]) {
   const W = Math.round(def.w * scale), D = Math.round(def.d * scale);
   for (const c of frontageCandidates(map, { x: L.x, z: L.z }, { w: W, d: D, maxDistance: def.reach ?? 260 })) {
    const pts = c.pts;
    if (pts.some(([px, pz]) => px < bounds.minX + 4 || px > bounds.maxX - 4 || pz < bounds.minZ + 4 || pz > bounds.maxZ - 4)) continue;
    if (plans.some((q) => Math.hypot(q.x - c.x, q.z - c.z) < Math.hypot(q.w, q.d) / 2 + Math.hypot(W, D) / 2 + 2)) continue;
    if (roadConflict(map, pts, 1.6)) continue;
    let ok = true; const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw);
    for (let a = -W / 2; a <= W / 2 + 0.1 && ok; a += 4) for (let bb = -D / 2; bb <= D / 2 + 0.1; bb += 4) { const px = c.x + cs * a + sn * bb, pz = c.z - sn * a + cs * bb; if (w.terrain.isWater(px, pz) || !w.collision.isFree(px, pz, 0.5) || map.inHomeAccess?.(px, pz, 1)) { ok = false; break; } }
    if (!ok || overlapsBuilding(map, pts)) continue;
    plan = { x: c.x, z: c.z, yaw: c.yaw, w: W, d: D, road: c.road?.displayName || c.road?.name || null }; break;
   }
   if (plan) break;
  }
  if (!plan) { console.warn('[civic] no plot for', def.id); continue; }
  plan.pts = rect(plan.x, plan.z, plan.w, plan.d, plan.yaw); plan.pi = w.collision.addPolygon(plan.pts, 0.01); plan.def = def; plan.landmark = L;
  (w.venuePlots ??= []).push({ x: plan.x, z: plan.z, w: plan.w, d: plan.d, yaw: plan.yaw, pi: plan.pi, pts: plan.pts, civic: def.id }); // houses and other venues keep off it
  plans.push(plan);
 }
 w.civicPlans = plans; return plans;
}

/** A small kit of local-frame shapes that end up in one merged mesh per site. */
class Kit {
 constructor(w, plan, group) { this.w = w; this.plan = plan; this.group = group; this.gb = new GeoBuilder(); this.glow = new GeoBuilder(); this.solids = []; }
 wp(a, b) { const { x, z, yaw } = this.plan, c = Math.cos(yaw), s = Math.sin(yaw); return [x + c * a + s * b, z - s * a + c * b]; }
 box(wd, h, dp, x, y0, z, col, { solid = false, lit = false, yaw = 0 } = {}) { (lit ? this.glow : this.gb).box(x, z, y0, y0 + h, wd, dp, yaw, C(col)); if (solid) this.solid(x, z, wd, dp, y0 + h, yaw); }
 solid(x, z, wd, dp, h = 3, yaw = 0) { const pts = rect(x, z, wd, dp, yaw).map(([a, b]) => this.wp(a, b)); this.solids.push(this.w.collision.addPolygon(pts, h)); }
 cyl(x, z, y0, y1, r, col, { solid = false, seg = 14, lit = false } = {}) { (lit ? this.glow : this.gb).cylinder(x, z, y0, y1, r, C(col), seg); if (solid) this.solids.push(this.w.collision.addCircle(...this.wp(x, z), r)); }
 /** A pitched roof over (x, z) w × d from height y, ridge along z (or along x when alongX). */
 gable(x, z, wd, dp, y, rise, col, { alongX = false, overhang = 0.6, ends = '#f1e9d6' } = {}) {
  const g = this.gb, c = C(col), e = C(ends), hw = wd / 2 + overhang, hd = dp / 2 + overhang;
  if (!alongX) {
   g.quad([[x - hw, y, z - hd], [x, y + rise, z - hd], [x, y + rise, z + hd], [x - hw, y, z + hd]], [[0, 0], [1, 0], [1, 1], [0, 1]], [-rise, hw, 0].map((v) => v / Math.hypot(rise, hw)), c);
   g.quad([[x + hw, y, z - hd], [x + hw, y, z + hd], [x, y + rise, z + hd], [x, y + rise, z - hd]], [[0, 0], [1, 0], [1, 1], [0, 1]], [rise, hw, 0].map((v) => v / Math.hypot(rise, hw)), c);
   for (const s of [-1, 1]) g.tri([x - wd / 2, y, z + s * dp / 2], [x + wd / 2, y, z + s * dp / 2], [x, y + rise, z + s * dp / 2], [0, 0], [1, 0], [0.5, 1], [0, 0, s], e);
  } else {
   g.quad([[x - hw, y, z - hd], [x + hw, y, z - hd], [x + hw, y + rise, z], [x - hw, y + rise, z]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, hd, -rise].map((v) => v / Math.hypot(rise, hd)), c);
   g.quad([[x - hw, y, z + hd], [x - hw, y + rise, z], [x + hw, y + rise, z], [x + hw, y, z + hd]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, hd, rise].map((v) => v / Math.hypot(rise, hd)), c);
   for (const s of [-1, 1]) g.tri([x + s * wd / 2, y, z - dp / 2], [x + s * wd / 2, y, z + dp / 2], [x + s * wd / 2, y + rise, z], [0, 0], [1, 0], [0.5, 1], [s, 0, 0], e);
  }
 }
 /** A four-sided pyramid (spires, tower caps). */
 pyramid(x, z, y, size, h, col) { const g = this.gb, c = C(col), s = size / 2, top = [x, y + h, z], P = [[x - s, y, z - s], [x + s, y, z - s], [x + s, y, z + s], [x - s, y, z + s]]; for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4], mx = (a[0] + b[0]) / 2 - x, mz = (a[2] + b[2]) / 2 - z, l = Math.hypot(mx, mz) || 1; g.tri(a, b, top, [0, 0], [1, 0], [0.5, 1], [mx / l, s / h, mz / l], c); } }
 /** A round arch in a vertical plane facing +z (or +x when faceX): an arched band from radius r1 to r2, depth deep. */
 arch(x, z, y, r1, r2, deep, col, { faceX = false, seg = 10 } = {}) {
  const g = this.gb, c = C(col);
  const P = (r, a, off) => faceX ? [x + off, y + Math.sin(a) * r, z + Math.cos(a) * r] : [x + Math.cos(a) * r, y + Math.sin(a) * r, z + off];
  for (let i = 0; i < seg; i++) { const a0 = (i / seg) * Math.PI, a1 = ((i + 1) / seg) * Math.PI;
   for (const off of [deep / 2, -deep / 2]) g.quad([P(r1, a0, off), P(r2, a0, off), P(r2, a1, off), P(r1, a1, off)], [[0, 0], [1, 0], [1, 1], [0, 1]], faceX ? [Math.sign(off), 0, 0] : [0, 0, Math.sign(off)], c);
   const am = (a0 + a1) / 2; g.quad([P(r1, a0, deep / 2), P(r1, a1, deep / 2), P(r1, a1, -deep / 2), P(r1, a0, -deep / 2)], [[0, 0], [1, 0], [1, 1], [0, 1]], faceX ? [0, -Math.sin(am), -Math.cos(am)] : [-Math.cos(am), -Math.sin(am), 0], c);
   g.quad([P(r2, a0, deep / 2), P(r2, a1, deep / 2), P(r2, a1, -deep / 2), P(r2, a0, -deep / 2)], [[0, 0], [1, 0], [1, 1], [0, 1]], faceX ? [0, Math.sin(am), Math.cos(am)] : [Math.cos(am), Math.sin(am), 0], c);
  }
 }
 /** A pointed (lancet) window: lit glass, facing +z (or ±x). */
 lancet(x, z, y, wd, h, col, { face = 'z', sign = 1 } = {}) {
  const g = this.glow, c = C(col), hw = wd / 2, top = y + h, peak = top + wd * 0.75, o = 0.02 * sign;
  if (face === 'z') { g.quad([[x - hw, y, z + o], [x + hw, y, z + o], [x + hw, top, z + o], [x - hw, top, z + o]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, sign], c); g.tri([x - hw, top, z + o], [x + hw, top, z + o], [x, peak, z + o], [0, 0], [1, 0], [0.5, 1], [0, 0, sign], c); }
  else { g.quad([[x + o, y, z - hw], [x + o, y, z + hw], [x + o, top, z + hw], [x + o, top, z - hw]], [[0, 0], [1, 0], [1, 1], [0, 1]], [sign, 0, 0], c); g.tri([x + o, top, z - hw], [x + o, top, z + hw], [x + o, peak, z], [0, 0], [1, 0], [0.5, 1], [sign, 0, 0], c); }
 }
 /** A painted board (signs, crests): text or a paint(ctx, W, H) function. Faces +z unless rot. */
 board(content, x, y, z, wd, h, { bg = '#ffffff', fg = '#123', rot = 0, sub = null, glow = 0.35 } = {}) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.max(64, Math.round(1024 * h / wd)); const c = cv.getContext('2d');
  if (typeof content === 'function') content(c, cv.width, cv.height); else { c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; const fs = Math.min(cv.height * (sub ? 0.42 : 0.6), 120); c.font = `800 ${fs}px Arial`; c.fillText(content, 512, sub ? cv.height * 0.36 : cv.height / 2, 980); if (sub) { c.font = `600 ${fs * 0.48}px Arial`; c.fillText(sub, 512, cv.height * 0.76, 980); } }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(wd, h), new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: glow, roughness: 0.7 })); m.position.set(x, y, z); m.rotation.y = rot; this.group.add(m);
 }
 palm(x, z, h = 7) { this.cyl(x, z, 0, h, 0.22, '#7a6248', { seg: 8 }); for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; this.gb.beam([x, h, z], [x + Math.cos(a) * 2.4, h - 0.9, z + Math.sin(a) * 2.4], 0.35, C('#3d7a35')); } this.solids.push(this.w.collision.addCircle(...this.wp(x, z), 0.35)); }
 tree(x, z) { this.cyl(x, z, 0, 2.6, 0.25, '#6b4f36', { seg: 8 }); this.gb.box(x, z, 2.2, 5.2, 3.4, 3.4, 0.4, C('#3f7d3a')); this.gb.box(x, z, 4.6, 6.2, 2.2, 2.2, 0.9, C('#4b8c43')); this.solids.push(this.w.collision.addCircle(...this.wp(x, z), 0.4)); }
 /** A perimeter wall with a gap at the front for the gate. */
 fence(wd, dp, h, col, gate = 8, { cap = null } = {}) {
  const hw = wd / 2, hd = dp / 2, t = 0.3, side = (wd - gate) / 2;
  this.box(t, h, dp, -hw + t / 2, 0, 0, col, { solid: true }); this.box(t, h, dp, hw - t / 2, 0, 0, col, { solid: true }); this.box(wd, h, t, 0, 0, -hd + t / 2, col, { solid: true });
  for (const s of [-1, 1]) this.box(side, h, t, s * (gate / 2 + side / 2), 0, hd - t / 2, col, { solid: true });
  if (cap) { for (const [a, b, ww, dd] of [[-hw + t / 2, 0, t + 0.1, dp], [hw - t / 2, 0, t + 0.1, dp], [0, -hd + t / 2, wd, t + 0.1]]) this.box(ww, 0.15, dd, a, h, b, cap); for (const s of [-1, 1]) this.box(side, 0.15, t + 0.1, s * (gate / 2 + side / 2), h, hd - t / 2, cap); }
 }
 finish() {
  const mesh = new THREE.Mesh(this.gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, side: THREE.DoubleSide })); mesh.castShadow = true; mesh.receiveShadow = true; this.group.add(mesh);
  if (this.glow.vertexCount) this.group.add(new THREE.Mesh(this.glow.build(), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.45, roughness: 0.3, side: THREE.DoubleSide })));
 }
}
const GLASS = ['#3f6fb5', '#c0392b', '#f2c14e', '#2f8f5a', '#8e44ad', '#e67e22'];

// ── the buildings ──────────────────────────────────────────────────────────────────────────────────
/** Holy Trinity: a 1930s cathedral on raised ground: twin west towers with spires, a long nave and aisles, lancet
 *  windows, buttresses, a rose window over the great door, an apse. Cream walls, red roofs. */
function basilica(K, W, D) {
 const cream = '#efe5cc', trim = '#d9c9a3', roof = '#8d2f28', hd = D / 2, front = hd - 2;
 K.box(W, 0.9, D - 2, 0, 0, -1, '#cdbf9f', { solid: false }); // the raised ground
 for (let i = 0; i < 4; i++) K.box(12 - i * 0.6, 0.9 - i * 0.22, 1.2, 0, 0, hd - 0.6 - i * 1.0, '#d6cab0');
 const nW = W - 12, nL = D - 14, z0 = front - 7, zc = z0 - nL / 2;
 K.box(nW, 14, nL, 0, 0.9, zc, cream, { solid: true }); K.gable(0, zc, nW, nL, 14.9, 5.5, roof);
 for (const s of [-1, 1]) { K.box(4.5, 8.5, nL - 4, s * (nW / 2 + 2.25), 0.9, zc - 1, cream, { solid: true }); K.box(4.8, 0.3, nL - 3.6, s * (nW / 2 + 2.25), 9.4, zc - 1, roof);
  for (let z = z0 - 4; z > z0 - nL + 4; z -= 5) { K.box(0.9, 7, 1.0, s * (nW / 2 + 4.9), 0.9, z, trim, { solid: true }); K.lancet(s * (nW / 2 + 4.52), z - 2.5, 3, 1.3, 3.6, GLASS[Math.abs(Math.round(z)) % GLASS.length], { face: 'x', sign: s }); K.lancet(s * (nW / 2 + 0.02), z - 2.5, 10.4, 1.1, 2.2, GLASS[(Math.abs(Math.round(z)) + 2) % GLASS.length], { face: 'x', sign: s }); } }
 K.cyl(0, z0 - nL + 1, 0.9, 12, nW / 2, cream, { solid: true, seg: 18 }); K.cyl(0, z0 - nL + 1, 12, 13.2, nW / 2 + 0.3, roof, { seg: 18 }); // the apse
 // the west front: gable wall, great door, rose window, two towers
 K.box(nW, 15, 1.4, 0, 0.9, z0 + 0.7, cream, { solid: true }); K.gable(0, z0 + 0.7, nW, 1.4, 15.9, 5.5, cream, { overhang: 0.1, ends: cream });
 K.box(4.6, 6.4, 0.5, 0, 0.9, z0 + 1.45, trim); K.box(3.4, 5.4, 0.3, 0, 0.9, z0 + 1.75, '#4a2c1a'); K.arch(0, z0 + 1.55, 6.3, 1.7, 2.4, 0.5, trim, { seg: 8 });
 K.board((c, w, h) => { c.fillStyle = '#efe5cc'; c.fillRect(0, 0, w, h); const cx = w / 2, cy = h / 2, R = w * 0.46; c.fillStyle = '#6b4a2a'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill(); for (let i = 0; i < 12; i++) { c.fillStyle = GLASS[i % GLASS.length]; c.beginPath(); c.moveTo(cx, cy); c.arc(cx, cy, R * 0.92, (i / 12) * 6.283, ((i + 1) / 12) * 6.283 - 0.05); c.fill(); } c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(cx, cy, R * 0.25, 0, 7); c.fill(); }, 0, 10.6, z0 + 1.45, 3.6, 3.6, { glow: 0.5 });
 for (const s of [-1, 1]) {
  const tx = s * (nW / 2 + 1.5), tz = z0 - 1.0, T = 27;
  K.box(7, T, 7, tx, 0.9, tz, cream, { solid: true }); for (const y of [9, 17.5, 25]) K.box(7.4, 0.5, 7.4, tx, 0.9 + y, tz, trim);
  for (const [fx, fz] of [[0, 3.52], [0, -3.52], [3.52, 0], [-3.52, 0]]) { if (fz) { K.lancet(tx, tz + fz, 20, 1.6, 4, '#2a2a35', { sign: Math.sign(fz) }); K.lancet(tx, tz + fz, 11, 1.1, 3.5, GLASS[2], { sign: Math.sign(fz) }); } else { K.lancet(tx + fx, tz, 20, 1.6, 4, '#2a2a35', { face: 'x', sign: Math.sign(fx) }); } }
  for (const [px, pz] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) { K.box(0.8, 3, 0.8, tx + px, 0.9 + T, tz + pz, trim); K.pyramid(tx + px, tz + pz, 3.9 + T, 0.8, 2, trim); }
  K.box(5, 2.2, 5, tx, 0.9 + T, tz, cream); K.pyramid(tx, tz, 3.1 + T, 5.4, 11, roof);
  K.box(0.22, 2.6, 0.22, tx, 14.1 + T, tz, '#d4af37'); K.box(1.3, 0.22, 0.22, tx, 15.6 + T, tz, '#d4af37');
 }
 K.box(0.3, 3, 0.3, 0, 21.4, z0 + 0.7, '#d4af37'); K.box(1.6, 0.3, 0.3, 0, 23.2, z0 + 0.7, '#d4af37'); // cross on the gable
 K.board('CATHEDRAL BASILICA OF THE MOST HOLY TRINITY', 0, 3, hd - 0.2, 11, 1, { bg: '#5a2620', fg: '#f6e7b0', sub: 'ARCHDIOCESE OF ONITSHA · VISITORS WELCOME' });
 for (const s of [-1, 1]) { K.box(0.4, 4.2, 0.4, s * 6.2, 0, hd - 0.4, '#d6cab0', { solid: true }); K.palm(s * (W / 2 - 2), hd - 4); K.tree(s * (W / 2 - 2.5), -hd + 6); }
 return { door: [0, z0 + 2.6], stand: [0, hd + 1.4] };
}
/** All Saints: a big modernist block with a portico of tall concrete arches, coloured glass, and a tall rectangular
 *  bell tower with an open belfry. */
function anglican(K, W, D) {
 const white = '#f3f1ea', conc = '#d8d5cc', hd = D / 2, front = hd - 9, nW = W - 10, nL = D - 16, zc = front - nL / 2;
 K.box(W - 2, 0.3, D - 2, 0, 0, 0, '#cfc9bb');
 K.box(nW, 15, nL, 0, 0, zc, white, { solid: true }); K.gable(0, zc, nW, nL, 15, 3.2, '#5d6f7d', { ends: white });
 for (const s of [-1, 1]) for (let z = front - 4; z > front - nL + 3; z -= 4.6) { K.arch(s * (nW / 2 + 0.1), z, 9, 1.4, 1.9, 0.5, conc, { faceX: true, seg: 8 }); K.box(0.5, 9, 0.5, s * (nW / 2 + 0.1), 0, z - 1.65, conc); K.box(0.5, 9, 0.5, s * (nW / 2 + 0.1), 0, z + 1.65, conc); K.box(0.06, 8.6, 2.6, s * (nW / 2 + 0.05), 0.3, z, GLASS[Math.abs(Math.round(z)) % GLASS.length], { lit: true }); K.box(0.06, 2.2, 2.4, s * (nW / 2 + 0.05), 11.3, z, GLASS[(Math.abs(Math.round(z)) + 3) % GLASS.length], { lit: true }); }
 // the portico: five tall arches on piers, coloured glass behind
 K.box(nW + 2, 0.5, 7, 0, 0, front + 3.5, conc); const n = 5, span = (nW + 2) / n;
 for (let i = 0; i <= n; i++) K.box(1.1, 10, 1.1, -(nW + 2) / 2 + i * span, 0.5, front + 6.4, conc, { solid: true });
 for (let i = 0; i < n; i++) { const cx = -(nW + 2) / 2 + span * (i + 0.5); K.arch(cx, front + 6.4, 10.5, span / 2 - 0.55, span / 2 + 0.2, 1.1, conc, { seg: 10 }); }
 K.box(nW + 2.4, 1.6, 1.3, 0, 13.7, front + 6.4, conc);
 for (let i = 0; i < 9; i++) K.box((nW - 2) / 9 - 0.1, 9, 0.08, -(nW - 2) / 2 + (nW - 2) / 9 * (i + 0.5), 0.8, front + 0.06, GLASS[i % GLASS.length], { lit: true });
 K.box(3.8, 5.6, 0.12, 0, 0.5, front + 0.14, '#3c2a1c');
 // the bell tower (front left): tall, rectangular, vertical slots, an open belfry, a cross
 const tx = -(W / 2 - 4.5), tz = front + 4, TH = 34; K.box(6, TH, 8, tx, 0, tz, white, { solid: true });
 for (const s of [-1, 1]) for (let k = 0; k < 3; k++) K.box(0.06, TH - 12, 0.5, tx + s * 3.02, 2, tz - 2.5 + k * 2.5, conc);
 K.box(6.4, 0.6, 8.4, tx, TH, tz, conc); for (const [a, b] of [[-2.7, -3.7], [2.7, -3.7], [-2.7, 3.7], [2.7, 3.7]]) K.box(0.6, 5, 0.6, tx + a, TH + 0.6, tz + b, white);
 K.arch(tx, tz + 4.0, TH + 4.2, 1.4, 2.0, 0.4, white, { seg: 8 }); K.cyl(tx, tz, TH + 0.6, TH + 3.6, 0.7, '#b9a35a', { seg: 10 });
 K.box(7, 0.8, 9, tx, TH + 5.6, tz, white); K.box(0.35, 5, 0.35, tx, TH + 6.4, tz, '#f2f0e6'); K.box(2.6, 0.35, 0.35, tx, TH + 9.3, tz, '#f2f0e6');
 K.board("ALL SAINTS' CATHEDRAL", 6, 2.6, hd - 0.4, 12, 1.1, { bg: '#2d3f6b', fg: '#ffffff', sub: 'CHURCH OF NIGERIA (ANGLICAN COMMUNION) · DIOCESE ON THE NIGER' });
 for (const s of [-1, 1]) K.palm(s * (W / 2 - 1.8), hd - 2.5); K.tree(W / 2 - 3, -hd + 4); K.tree(-(W / 2 - 3), -hd + 4);
 return { door: [0, front + 1.6], stand: [0, front + 9.5] };
}
/** Ime Obi (stylised): a walled compound in red and white, a gatehouse, a courtyard, and the palace hall with a deep
 *  veranda of white columns under a red roof. */
function palace(K, W, D) {
 const red = '#9b1d22', white = '#f4efe2', gold = '#d4a73c', hd = D / 2;
 K.fence(W, D, 2.8, white, 7, { cap: red }); K.box(W - 1, 0.03, D - 1, 0, 0, 0, '#c6b28b');
 for (const s of [-1, 1]) { K.box(1.6, 5.6, 1.6, s * 4.4, 0, hd - 0.4, white, { solid: true }); K.box(1.9, 0.6, 1.9, s * 4.4, 5.6, hd - 0.4, red); K.pyramid(s * 4.4, hd - 0.4, 6.2, 1.9, 1.4, gold); }
 K.box(10.4, 1.3, 1.2, 0, 5.2, hd - 0.4, red); K.board('IME OBI ONITSHA', 0, 5.85, hd + 0.22, 7.6, 1.0, { bg: '#9b1d22', fg: '#f6dc8c', sub: 'PALACE OF THE OBI OF ONITSHA' });
 K.box(W - 6, 0.04, 3.6, 0, 0.02, hd - 9, '#b8a37c'); K.box(3.4, 0.04, D / 2 - 6, 0, 0.03, hd / 2 - 4, '#b8a37c'); // paths
 for (const s of [-1, 1]) { K.box(10, 0.05, 9, s * 13, 0.02, hd - 10, '#4f8a45'); K.palm(s * 9, hd - 6); K.palm(s * 17, hd - 6); }
 // the hall
 const hW = W - 12, hD = 14, hz = -hd + 4 + hD / 2;
 K.box(hW, 7.2, hD, 0, 0.6, hz, white, { solid: true }); K.box(hW + 1, 0.6, hD + 5, 0, 0, hz + 2.5, '#d8cfbd');
 for (let i = 0; i < 12; i++) { const x = -hW / 2 + 1 + i * ((hW - 2) / 11); K.cyl(x, hz + hD / 2 + 3.6, 0.6, 7.2, 0.32, white, { solid: true, seg: 10 }); K.box(0.8, 0.3, 0.8, x, 7.2, hz + hD / 2 + 3.6, gold); }
 K.box(hW + 1.2, 0.7, hD + 6.4, 0, 7.5, hz + 2.5, red); K.gable(0, hz + 2.5, hW + 1.2, hD + 6.4, 8.2, 3.4, red, { alongX: true, ends: red });
 K.box(9, 4, 2.4, 0, 8.2, hz + hD / 2 + 3.6, white); K.gable(0, hz + hD / 2 + 3.6, 9, 2.6, 12.2, 2.6, red, { ends: white }); K.board((c, w, h) => { c.fillStyle = '#9b1d22'; c.fillRect(0, 0, w, h); c.strokeStyle = '#f6dc8c'; c.lineWidth = 10; c.beginPath(); c.arc(w / 2, h / 2, h * 0.35, 0, 7); c.stroke(); c.beginPath(); for (let a = 0; a < 15; a += 0.15) { const r = (h * 0.3 * a) / 15; c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } c.stroke(); }, 0, 10, hz + hD / 2 + 4.82, 3.2, 2.4);
 for (let i = 0; i < 6; i++) { const x = -hW / 2 + 4 + i * ((hW - 8) / 5); if (Math.abs(x) < 3) continue; K.box(1.4, 2.2, 0.06, x, 2.4, hz + hD / 2 + 0.04, '#5d8aa0'); }
 K.box(3.2, 4.2, 0.12, 0, 0.6, hz + hD / 2 + 0.07, '#5a2a14'); K.box(3.6, 0.3, 0.2, 0, 4.8, hz + hD / 2 + 0.1, gold);
 for (const s of [-1, 1]) { K.box(8, 5.5, 10, s * (hW / 2 + 1.5), 0, hz - 1, white, { solid: true }); K.gable(s * (hW / 2 + 1.5), hz - 1, 8, 10, 5.5, 2.4, red, { ends: white }); }
 return { door: [0, hz + hD / 2 + 1.2], stand: [0, hz + hD / 2 + 6] };
}
/** CKC (stylised): a walled school with a gatehouse, an administration block, two-storey classroom blocks with
 *  verandas round a quadrangle, a flagpole, an assembly hall and a football field. */
function school(K, W, D, name = 'CHRIST THE KING COLLEGE', sub = 'ONITSHA · FOUNDED 1933') {
 const cream = '#efe6cf', maroon = '#7d1d28', hd = D / 2, hw = W / 2;
 K.fence(W, D, 2.4, cream, 8, { cap: maroon }); K.box(W - 1, 0.03, D - 1, 0, 0, 0, '#bfa983');
 for (const s of [-1, 1]) K.box(1.2, 4, 1.2, s * 4.6, 0, hd - 0.4, maroon, { solid: true }); K.board(name, 0, 4.4, hd + 0.05, 13, 1.3, { bg: '#7d1d28', fg: '#ffffff', sub }); K.box(10.4, 0.25, 0.4, 0, 3.9, hd - 0.4, maroon);
 // administration block (front, centre) with a pediment
 const az = hd - 12; K.box(18, 7, 8, 0, 0, az, cream, { solid: true }); K.box(18.6, 0.4, 8.6, 0, 7, az, maroon); K.gable(0, az, 18.6, 8.6, 7.4, 2.2, '#7a2a22', { alongX: true, ends: cream });
 for (const x of [-3, -1, 1, 3]) K.box(0.5, 6.6, 0.5, x * 1.4, 0, az + 4.6, '#f6f3ec', { solid: true }); K.box(7.2, 0.6, 1.2, 0, 6.4, az + 4.6, cream);
 for (const x of [-7, -5, 5, 7]) for (const y of [1.4, 4.4]) K.box(1.3, 1.3, 0.06, x, y, az + 4.04, '#5d8aa0');
 K.box(2, 2.6, 0.08, 0, 0, az + 4.05, '#4a2a18');
 // classroom blocks: two storeys, corridor veranda with railing, round the quad
 const block = (x, z, len, rot) => { const along = rot ? 8 : len, across = rot ? len : 8; K.box(along, 6.6, across, x, 0, z, cream, { solid: true }); K.box(along + 0.4, 0.3, across + 0.4, x, 6.6, z, maroon); K.gable(x, z, along + 0.4, across + 0.4, 6.9, 1.8, '#7a2a22', { alongX: !rot, ends: cream });
  const n = Math.floor(len / 3.4); for (let i = 0; i < n; i++) for (const y of [1.2, 4.4]) { const t = -len / 2 + 1.7 + i * 3.4; if (rot) K.box(0.06, 1.2, 2.2, x + (x < 0 ? 4.04 : -4.04), y, z + t, '#3d5a6b'); else K.box(2.2, 1.2, 0.06, x + t, y, z + 4.04, '#3d5a6b'); }
  if (!rot) { K.box(len, 0.15, 1.6, x, 3.2, z + 4.8, '#d7ccb2'); K.box(len, 0.9, 0.08, x, 3.35, z + 5.55, maroon); for (let i = 0; i <= n; i++) K.box(0.3, 3.2, 0.3, x - len / 2 + i * (len / n), 0, z + 5.5, cream); } };
 block(-hw + 7, -2, 30, true); block(hw - 7, -2, 30, true); block(0, -hd + 9, 34, false);
 K.box(0.12, 9, 0.12, 0, 0, az - 9, '#cfcfcf'); for (const [i, c] of ['#167b46', '#f2f0df', '#167b46'].entries()) K.box(0.6, 1.0, 0.03, 0.35 + i * 0.6, 7.6, az - 9, c);
 K.box(14, 0.03, 12, 0, 0.02, -4, '#5a9a4a'); for (const s of [-1, 1]) { K.box(0.12, 2.2, 0.12, s * 3.6, 0, -9.8, '#ffffff'); K.box(0.12, 2.2, 0.12, s * 3.6, 0, 1.8, '#ffffff'); } K.box(7.3, 0.12, 0.12, 0, 2.2, -9.8, '#ffffff'); K.box(7.3, 0.12, 0.12, 0, 2.2, 1.8, '#ffffff');
 for (const s of [-1, 1]) { K.tree(s * (hw - 3), hd - 4); K.tree(s * 12, hd - 4); }
 return { door: [0, az + 5.2], stand: [0, az + 9] };
}
/** Shanahan University (stylised): a gated campus: an entrance arch, a four-storey senate building with a columned
 *  portico and a glass front, two faculty blocks round a lawn with a fountain, a chapel, and palms. */
function university(K, W, D) {
 const stone = '#f1ece0', blue = '#1d3f73', gold = '#c9a227', glass = '#7fb3c8', hd = D / 2, hw = W / 2;
 K.fence(W, D, 2.2, stone, 12, { cap: blue }); K.box(W - 1, 0.03, D - 1, 0, 0, 0, '#c9bea6');
 for (const s of [-1, 1]) { K.box(2.2, 8, 2.2, s * 7.4, 0, hd - 0.6, stone, { solid: true }); K.box(2.6, 0.5, 2.6, s * 7.4, 8, hd - 0.6, blue); }
 K.arch(0, hd - 0.6, 7.4, 6.3, 7.6, 1.6, stone, { seg: 14 }); K.board('SHANAHAN UNIVERSITY', 0, 10.4, hd + 0.25, 11, 1.4, { bg: '#1d3f73', fg: '#ffffff', sub: 'ONITSHA · ARCHDIOCESE OF ONITSHA' });
 // the senate building
 const sz = -hd + 13, sW = 34, sD = 14, H = 15.2; K.box(sW, H, sD, 0, 0, sz, stone, { solid: true }); K.box(sW + 0.8, 0.8, sD + 0.8, 0, H, sz, blue);
 for (let f = 0; f < 4; f++) for (let i = 0; i < 9; i++) { const x = -sW / 2 + 2 + i * ((sW - 4) / 8); if (Math.abs(x) < 6) continue; K.box(2, 2.4, 0.06, x, 0.9 + f * 3.7, sz + sD / 2 + 0.04, '#41657c'); }
 K.box(10, H - 0.6, 0.1, 0, 0.3, sz + sD / 2 + 0.06, glass, { lit: true }); for (let i = 0; i <= 5; i++) K.box(0.18, H - 0.6, 0.18, -5 + i * 2, 0.3, sz + sD / 2 + 0.12, '#dfe6ea'); for (let f = 1; f < 4; f++) K.box(10, 0.2, 0.2, 0, f * 3.7, sz + sD / 2 + 0.12, '#dfe6ea');
 K.box(16, 0.8, 6, 0, 0, sz + sD / 2 + 3, '#ddd6c5'); for (let i = 0; i < 6; i++) K.cyl(-6.5 + i * 2.6, sz + sD / 2 + 5.2, 0.8, 11.5, 0.45, '#fbfaf5', { solid: true, seg: 12 }); K.box(16.6, 1.2, 6.6, 0, 11.5, sz + sD / 2 + 3, stone); K.gable(0, sz + sD / 2 + 3, 16.6, 6.6, 12.7, 2.8, stone, { alongX: true, ends: '#e8e0cc' });
 K.board('SENATE BUILDING', 0, 12.0, sz + sD / 2 + 6.35, 9, 0.7, { bg: '#f1ece0', fg: '#1d3f73' });
 K.cyl(0, sz, H + 0.8, H + 3.4, 2.4, stone, { seg: 16 }); K.cyl(0, sz, H + 3.4, H + 4.2, 2.7, blue, { seg: 16 }); // a drum and a dome-ish cap
 // faculty blocks round the lawn
 for (const s of [-1, 1]) { const fx = s * (hw - 11), fz = 2; K.box(14, 11.4, 26, fx, 0, fz, stone, { solid: true }); K.box(14.6, 0.6, 26.6, fx, 11.4, fz, blue);
  for (let f = 0; f < 3; f++) for (let i = 0; i < 7; i++) K.box(0.06, 2.2, 2.4, fx - s * 7.04, 1 + f * 3.6, fz - 11 + i * 3.6, '#41657c');
  K.board(s < 0 ? 'FACULTY OF NATURAL & APPLIED SCIENCES' : 'FACULTY OF SOCIAL & MANAGEMENT SCIENCES', fx - s * 7.1, 9.8, fz, 12, 0.8, { bg: '#1d3f73', fg: '#ffffff', rot: -s * Math.PI / 2 }); }
 K.box(30, 0.04, 22, 0, 0.02, 4, '#4f8f45'); K.box(3, 0.05, D - 26, 0, 0.03, 4, '#d8cfbb'); K.box(30, 0.05, 3, 0, 0.03, 4, '#d8cfbb');
 K.cyl(0, 4, 0, 0.7, 3, '#cfc8b8', { solid: true, seg: 18 }); K.cyl(0, 4, 0.5, 0.75, 2.6, '#6fb2d6', { seg: 18, lit: true }); K.cyl(0, 4, 0.7, 2.6, 0.3, '#e9e4d8', { seg: 10 });
 // a small chapel (back right) and palms
 const cx = hw - 9, cz = -hd + 9; K.box(8, 6, 12, cx, 0, cz, '#f6f3ec', { solid: true }); K.gable(cx, cz, 8, 12, 6, 3.4, blue, { ends: '#f6f3ec' }); K.box(0.25, 2.6, 0.25, cx, 9.4, cz + 6, gold); K.box(1.4, 0.25, 0.25, cx, 10.7, cz + 6, gold);
 for (const z of [-4, 6, 16]) for (const s of [-1, 1]) K.palm(s * 17, z, 7.5);
 for (const s of [-1, 1]) K.palm(s * 11, hd - 3, 7);
 return { door: [0, sz + sD / 2 + 1.2], stand: [0, sz + sD / 2 + 8] };
}
const BUILD = { basilica, anglican, palace, school, university };

/** After the city is built: put the buildings up, take the reservations down, give each landmark its door. */
export function buildCivicSites(w) {
 const out = [];
 for (const plan of w.civicPlans ?? []) {
  w.collision.removePolygon(plan.pi);
  const group = new THREE.Group(); group.name = `civic:${plan.def.id}`; group.position.set(plan.x, 0, plan.z); group.rotation.y = plan.yaw;
  const K = new Kit(w, plan, group); let r;
  try { r = BUILD[plan.def.style](K, plan.w, plan.d); } catch (e) { console.warn('[civic] could not build', plan.def.id, e); continue; }
  K.finish(); w.root.add(group);
  const [dx, dz] = K.wp(...r.door), [sx, sz] = K.wp(...r.stand), L = plan.landmark;
  L.site = { id: plan.def.id, style: plan.def.style, x: plan.x, z: plan.z, yaw: plan.yaw, w: plan.w, d: plan.d, door: { x: dx, z: dz, stand: { x: sx, z: sz } }, group };
  if (plan.def.style === 'university') { L.name = 'Shanahan University'; L.university = true; L.blurb = 'Catholic university of the Archdiocese of Onitsha (licensed 2023). Campus buildings here are stylised for the game.'; }
  if (Math.hypot(L.x - plan.x, L.z - plan.z) > 40) { L.mapped = { x: L.x, z: L.z }; L.x = plan.x; L.z = plan.z; } // the map pin goes where the building is
  out.push(L.site);
 }
 w.civicSites = out; return out;
}
