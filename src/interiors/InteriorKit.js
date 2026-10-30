import * as THREE from 'three';
import { GeoBuilder } from '../world/GeoBuilder.js';
import { buildHuman, defaultAppearance } from '../characters/HumanRig.js';
import { CharacterAnimator } from '../characters/CharacterAnimator.js';
/**
 * v0.44 interiors: a small kit for walk-in rooms (walls, counters, desks, chairs, shelves, beds, signs, people), and
 * the layouts of the city's establishments. Everything solid is merged into one mesh per room (plus one for lit
 * panels), so a full supermarket costs about the same to draw as a single building. Rooms are built when you walk in
 * and thrown away when you leave.
 *
 * Coordinates: the room spans x 0..w, z 0..d (metres) from its origin; the entrance is in the middle of the z = d
 * wall, and you face towards z = 0 as you come in.
 */
const C = (c) => new THREE.Color(c);
export class Room {
 constructor(g, parent, ox, oz = 0) { this.g = g; this.parent = parent; this.ox = ox; this.oz = oz; this.gb = new GeoBuilder(); this.glow = new GeoBuilder(); this.glassGb = new GeoBuilder(); this.polys = []; this.objects = []; this.rigs = []; this.h = 4; this.seats = []; }
 /** v0.45: somewhere to sit or lie (world coordinates). heading = the way you face when seated; for a bed, the way your feet point. */
 seat(x, z, y, heading, kind = 'seat') { this.seats.push({ x: this.ox + x, z: this.oz + z, y, heading, kind }); }
 /** A box centred at (x, y, z). solid: you can't walk through it. glow: lit (screens, lamps, fridge doors). */
 box(w, h, d, x, y, z, color, solid = false, glow = false) {
  (glow ? this.glow : this.gb).box(this.ox + x, this.oz + z, y - h / 2, y + h / 2, w, d, 0, C(color));
  if (solid) this.polys.push(this.g.world.collision.addPolygon([[this.ox + x - w / 2, this.oz + z - d / 2], [this.ox + x + w / 2, this.oz + z - d / 2], [this.ox + x + w / 2, this.oz + z + d / 2], [this.ox + x - w / 2, this.oz + z + d / 2]], h));
 }
 /** See-through glass (screens at a counter, partitions). */
 glass(w, h, d, x, y, z, color = '#bfe0ee') { this.glassGb.box(this.ox + x, this.oz + z, y - h / 2, y + h / 2, w, d, 0, C(color)); }
 cyl(x, z, y0, y1, r, color, glow = false) { (glow ? this.glow : this.gb).cylinder(this.ox + x, this.oz + z, y0, y1, r, C(color), 12); }
 /** The shell: floor, ceiling, four walls (a doorway in the front wall), a skirting and a band of colour. */
 shell({ w, d, h = 4, floor = '#cfc8b8', wall = '#ece6d8', band = null, ceiling = '#f4f2ec', door = 3 }) {
  Object.assign(this, { w, d, h });
  this.box(w, 0.12, d, w / 2, -0.06, d / 2, floor); this.box(w, 0.1, d, w / 2, h + 0.05, d / 2, ceiling);
  const X = (x) => this.ox + x, Z = (z) => this.oz + z; this.gb.quad([[X(0), h, Z(0)], [X(w), h, Z(0)], [X(w), h, Z(d)], [X(0), h, Z(d)]], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, -1, 0], C(ceiling)); // seen from below
  for (const [x, z, ww, dd] of [[0, d / 2, 0.2, d], [w, d / 2, 0.2, d], [w / 2, 0, w, 0.2]]) this.box(ww, h, dd, x, h / 2, z, wall, true);
  const side = (w - door) / 2; this.box(side, h, 0.2, side / 2, h / 2, d, wall, true); this.box(side, h, 0.2, w - side / 2, h / 2, d, wall, true); this.box(door, h - 2.6, 0.2, w / 2, 2.6 + (h - 2.6) / 2, d, wall);
  this.box(door + 0.3, 0.12, 0.3, w / 2, 2.62, d - 0.05, '#5b5048'); // door frame
  if (band) for (const [x, z, ww, dd] of [[0.12, d / 2, 0.04, d], [w - 0.12, d / 2, 0.04, d], [w / 2, 0.12, w, 0.04]]) this.box(ww, 1.1, dd, x, 0.55, z, band);
  for (const [x, z, ww, dd] of [[0.13, d / 2, 0.03, d], [w - 0.13, d / 2, 0.03, d], [w / 2, 0.13, w, 0.03]]) this.box(ww, 0.12, dd, x, 0.06, z, '#5a5249');
 }
 /** Ceiling lights in a grid (lit panels). */
 lights(nx, nz, color = '#fffbea') { for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) this.box(1.2, 0.05, 0.35, (this.w * (i + 0.5)) / nx, this.h - 0.04, (this.d * (k + 0.5)) / nz, color, false, true); }
 /** A sign: a painted panel facing +z (into the room from the back wall) unless rot is given. */
 sign(text, x, y, z, w, h, bg = '#1f3a4a', fg = '#ffffff', rot = 0, sub = null) {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.max(64, Math.round(1024 * h / w)); const c = cv.getContext('2d');
  c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
  const fs = Math.min(cv.height * (sub ? 0.46 : 0.62), 130); c.font = `800 ${fs}px Arial`; c.fillText(text, 512, sub ? cv.height * 0.38 : cv.height / 2, 980);
  if (sub) { c.font = `600 ${fs * 0.5}px Arial`; c.fillText(sub, 512, cv.height * 0.76, 980); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25, roughness: 0.8 }));
  m.position.set(this.ox + x, y, this.oz + z); m.rotation.y = rot; this.objects.push(m);
 }
 // ── furniture ───────────────────────────────────────────────────────────────────────────────────
 counter(x, z, w, { color = '#7a5a40', top = '#d9cbb0', depth = 0.8, glass = false } = {}) { this.box(w, 1.05, depth, x, 0.525, z, color, true); this.box(w + 0.1, 0.06, depth + 0.1, x, 1.08, z, top); if (glass) { this.glass(w, 0.8, 0.04, x, 1.52, z - depth / 2 + 0.05); for (let i = 0; i <= Math.round(w / 1.6); i++) this.box(0.05, 0.8, 0.06, x - w / 2 + (w * i) / Math.round(w / 1.6), 1.52, z - depth / 2 + 0.05, '#9aa4a8'); } }
 desk(x, z, { w = 1.4, d = 0.7, color = '#8a6a4a', monitor = true, face = 1 } = {}) { this.box(w, 0.06, d, x, 0.75, z, color, true); for (const sx of [-1, 1]) this.box(0.06, 0.72, d - 0.05, x + sx * (w / 2 - 0.05), 0.37, z, '#4a4a48'); if (monitor) { this.box(0.6, 0.38, 0.04, x, 1.05, z - face * 0.15, '#1b1f24'); this.box(0.54, 0.32, 0.02, x, 1.05, z - face * 0.12, '#5aa7d6', false, true); this.box(0.08, 0.2, 0.08, x, 0.86, z - face * 0.15, '#2a2a2a'); this.box(0.42, 0.02, 0.14, x, 0.79, z + face * 0.1, '#2e2e2e'); } }
 chair(x, z, { color = '#2f5d8a', face = 1 } = {}) { this.seat(x, z - face * 0.03, 0.49, face === 1 ? Math.PI : 0); this.box(0.46, 0.06, 0.46, x, 0.46, z, color); this.box(0.46, 0.5, 0.06, x, 0.72, z + face * 0.22, color); for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.04, 0.44, 0.04, x + sx * 0.2, 0.22, z + sz * 0.2, '#5c5c5c'); }
 chairRow(x0, z, n, { color = '#2f6fa8', face = 1, gap = 0.55 } = {}) { this.box(n * gap, 0.05, 0.08, x0 + ((n - 1) * gap) / 2, 0.42, z, '#707070'); for (let i = 0; i < n; i++) this.chair(x0 + i * gap, z, { color, face }); this.polys.push(this.g.world.collision.addPolygon([[this.ox + x0 - 0.3, this.oz + z - 0.3], [this.ox + x0 + (n - 1) * gap + 0.3, this.oz + z - 0.3], [this.ox + x0 + (n - 1) * gap + 0.3, this.oz + z + 0.3], [this.ox + x0 - 0.3, this.oz + z + 0.3]], 0.9)); }
 bench(x, z, w, color = '#6b4b33') { for (let k = -w / 2 + 0.4; k <= w / 2 - 0.3; k += 0.65) this.seat(x + k, z - 0.04, 0.49, Math.PI); this.box(w, 0.08, 0.45, x, 0.45, z, color, true); this.box(w, 0.5, 0.06, x, 0.75, z + 0.2, color); }
 shelf(x, z, w, { levels = 4, depth = 0.5, frame = '#e4e2dc', goods = ['#d94f3d', '#f2c14e', '#3f8f5a', '#2f6fa8', '#f5f1e6', '#8b4f9e', '#e07b39'], seed = 1, both = false } = {}) {
  const H = levels * 0.42 + 0.25, back = both ? z : z - depth / 2 + 0.03, D = both ? depth * 2 : depth;
  this.box(w, H, 0.05, x, H / 2, back, frame); for (const sx of [-1, 1]) this.box(0.05, H, D, x + sx * w / 2, H / 2, z, frame);
  this.polys.push(this.g.world.collision.addPolygon([[this.ox + x - w / 2, this.oz + z - D / 2], [this.ox + x + w / 2, this.oz + z - D / 2], [this.ox + x + w / 2, this.oz + z + D / 2], [this.ox + x - w / 2, this.oz + z + D / 2]], H));
  let s = seed * 9301; const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (const side of both ? [-1, 1] : [1]) for (let l = 0; l < levels; l++) { const y = 0.12 + l * 0.42, mid = back + side * (both ? depth / 2 : depth / 2 - 0.03); this.box(w - 0.1, 0.03, depth - 0.04, x, y, mid, '#c9c9c4'); this.box(w - 0.1, 0.06, 0.02, x, y + 0.02, back + side * (depth - 0.02), '#f2c14e'); for (let px = -w / 2 + 0.1; px < w / 2 - 0.12;) { const pw = 0.12 + r() * 0.16, ph = 0.16 + r() * 0.18, pd = 0.18 + r() * 0.12; this.box(pw, ph, pd, x + px + pw / 2, y + 0.015 + ph / 2, back + side * (depth - pd / 2 - 0.05), goods[Math.floor(r() * goods.length)]); px += pw + 0.025; } }
 }
 bed(x, z, { rot = 0, color = '#ffffff' } = {}) { this.seat(x + (rot ? 0.05 : 0), z + (rot ? 0 : 0.05), 0.72, rot ? Math.PI / 2 : 0, 'bed'); const [w, d] = rot ? [2, 0.95] : [0.95, 2]; this.box(w, 0.5, d, x, 0.35, z, '#9aa3a8', true); this.box(w - 0.05, 0.14, d - 0.05, x, 0.65, z, color); this.box(rot ? 0.4 : 0.7, 0.1, rot ? 0.7 : 0.4, x - (rot ? w / 2 - 0.3 : 0), 0.77, z - (rot ? 0 : d / 2 - 0.3), '#e8eef2'); this.box(rot ? 0.05 : w, 0.5, rot ? d : 0.05, x - (rot ? w / 2 : 0), 0.95, z - (rot ? 0 : d / 2), '#9aa3a8'); }
 /** v0.45: an invisible barrier (a rope line, a dais edge). */
 solid(x, z, w, d, h = 1) { this.polys.push(this.g.world.collision.addPolygon([[this.ox + x - w / 2, this.oz + z - d / 2], [this.ox + x + w / 2, this.oz + z - d / 2], [this.ox + x + w / 2, this.oz + z + d / 2], [this.ox + x - w / 2, this.oz + z + d / 2]], h)); }
 /** A painted panel: paint(ctx, W, H) draws it (patterns, menus, notice boards). */
 mural(x, y, z, w, h, rot, paint) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = Math.max(32, Math.round(512 * h / w)); const c = cv.getContext('2d'); paint(c, cv.width, cv.height);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.18, roughness: 0.85 })); m.position.set(this.ox + x, y, this.oz + z); m.rotation.y = rot; this.objects.push(m);
 }
 /** A sofa along x, its back towards +z (face = 1, you sit facing -z) or -z (face = -1). One seat every 0.62 m. */
 sofa(x, z, w, { color = '#7a4a3a', face = 1 } = {}) {
  this.box(w, 0.42, 0.85, x, 0.21, z, color, true); this.box(w, 0.5, 0.2, x, 0.67, z + face * 0.33, color); for (const s of [-1, 1]) this.box(0.18, 0.3, 0.85, x + s * (w / 2 - 0.09), 0.55, z, color);
  this.box(w - 0.4, 0.1, 0.62, x, 0.46, z - face * 0.06, '#e9dcc4');
  const n = Math.max(1, Math.floor((w - 0.36) / 0.62)); for (let i = 0; i < n; i++) this.seat(x - ((n - 1) * 0.62) / 2 + i * 0.62, z - face * 0.08, 0.5, face === 1 ? Math.PI : 0);
 }
 /** A table (solid) with a cloth colour; returns nothing — put chairs round it with chair(). */
 table(x, z, { w = 0.9, d = 0.9, color = '#7a5a3a', cloth = null, round = false } = {}) {
  if (round) { this.cyl(x, z, 0.72, 0.76, Math.max(w, d) / 2, cloth ?? color); this.cyl(x, z, 0, 0.72, 0.06, '#3a3a3a'); this.cyl(x, z, 0, 0.03, 0.3, '#3a3a3a'); }
  else { this.box(w, 0.05, d, x, 0.745, z, cloth ?? color); for (const sx of [-1, 1]) for (const sz of [-1, 1]) this.box(0.05, 0.72, 0.05, x + sx * (w / 2 - 0.06), 0.36, z + sz * (d / 2 - 0.06), color); }
  this.solid(x, z, w * 0.9, d * 0.9, 0.78);
 }
 drip(x, z) { this.box(0.04, 1.8, 0.04, x, 0.9, z, '#c0c4c8'); this.box(0.2, 0.25, 0.08, x, 1.7, z, '#dff2ff', false, true); this.box(0.4, 0.03, 0.4, x, 0.02, z, '#80868a'); }
 curtain(x, z, w, rot = false, color = '#7fb3c8') { this.box(rot ? 0.04 : w, 1.9, rot ? w : 0.04, x, 1.25, z, color); this.box(rot ? 0.05 : w, 0.04, rot ? w : 0.05, x, 2.25, z, '#c0c4c8'); }
 plant(x, z) { this.cyl(x, z, 0, 0.4, 0.22, '#8a5a3a'); this.box(0.5, 0.7, 0.5, x, 0.8, z, '#3e7d3f'); this.box(0.35, 0.4, 0.35, x, 1.3, z, '#4f9a4c'); }
 flag(x, z) { this.box(0.05, 2.4, 0.05, x, 1.2, z, '#b8b8b0'); for (const [i, c] of ['#167b46', '#f2f0df', '#167b46'].entries()) this.box(0.3, 0.6, 0.02, x + 0.17 + i * 0.3, 2.05, z, c); }
 fan(x, z) { this.cyl(x, z, this.h - 0.5, this.h, 0.03, '#d8d8d0'); this.cyl(x, z, this.h - 0.55, this.h - 0.45, 0.14, '#d8d8d0'); this.box(1.4, 0.02, 0.14, x, this.h - 0.5, z, '#e8e4da'); this.box(0.14, 0.02, 1.4, x, this.h - 0.5, z, '#e8e4da'); }
 /** A closed door on a wall with its label (wall: 'back' z=0, 'left' x=0, 'right' x=w). */
 door(wall, pos, label, color = '#6b4a32') {
  if (wall === 'back') { this.box(1, 2.2, 0.08, pos, 1.1, 0.14, color); this.box(0.1, 0.04, 0.06, pos + 0.35, 1.05, 0.2, '#d4b469'); if (label) this.sign(label, pos, 2.45, 0.16, 1.1, 0.25, '#2b3a45'); }
  else { const x = wall === 'left' ? 0.14 : this.w - 0.14, r = wall === 'left' ? Math.PI / 2 : -Math.PI / 2; this.box(0.08, 2.2, 1, x, 1.1, pos, color); if (label) this.sign(label, x + (wall === 'left' ? 0.02 : -0.02), 2.45, pos, 1.1, 0.25, '#2b3a45', '#fff', r); }
 }
 /** Someone working here: a standing figure facing `face` (radians; 0 = towards +z, the entrance). */
 person(x, z, face = 0, look = {}) {
  try { const { pose, y = 0, ...rest } = look; const app = { ...defaultAppearance(rest.gender ?? 'male'), outfit: 'shirt_trousers', color: 0, ...rest }; const r = buildHuman(app), a = new CharacterAnimator(r);
   if (pose) a.pose(pose, 0.016); else a.update(0, { speed: 0, grounded: true, turnRate: 0 });
   r.group.position.set(this.ox + x, y, this.oz + z); r.group.rotation.y = face; this.rigs.push(r); this.parent.add(r.group); return r; } catch { return null; /* people are decoration */ }
 }
 finish(lightColor = '#fff6e6') {
  const mesh = new THREE.Mesh(this.gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 })); mesh.receiveShadow = true; this.parent.add(mesh); this.objects.push(mesh);
  if (this.glow.vertexCount) { const m = new THREE.Mesh(this.glow.build(), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.55, roughness: 0.4 })); this.parent.add(m); this.objects.push(m); }
  if (this.glassGb.vertexCount) { const m = new THREE.Mesh(this.glassGb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false })); m.renderOrder = 2; this.parent.add(m); this.objects.push(m); }
  for (const o of this.objects) if (!o.parent) this.parent.add(o);
  const hemi = new THREE.HemisphereLight('#ffffff', '#8b8070', 1.9); this.parent.add(hemi); this.objects.push(hemi);
  for (const [fx, fz] of [[0.3, 0.35], [0.7, 0.65]]) { const p = new THREE.PointLight(lightColor, 26, Math.max(this.w, this.d) * 1.2); p.position.set(this.ox + this.w * fx, this.h - 0.4, this.oz + this.d * fz); this.parent.add(p); this.objects.push(p); }
  return this;
 }
 dispose() {
  for (const p of this.polys) this.g.world.collision.removePolygon(p); this.polys = [];
  for (const o of this.objects) { o.parent?.remove(o); o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); } this.objects = [];
  for (const r of this.rigs) { r.group.parent?.remove(r.group); r.dispose?.(); } this.rigs = [];
 }
}

// ── the establishments ──────────────────────────────────────────────────────────────────────────
const NAVY = 0, MAROON = 1, CREAM = 2, GREEN = 3, GREY = 4, WHITE = 10, BLACK = 11;
/** Each layout builds a room and returns where things are: spawn, exit and the counters you use. */
export const LAYOUTS = {
 police(R) {
  R.shell({ w: 20, d: 16, h: 4, floor: '#b9b5aa', wall: '#e9e3d3', band: '#24435c' }); R.lights(3, 3, '#f4fbff'); R.fan(6, 11); R.fan(14, 11);
  R.sign('NIGERIA POLICE FORCE', 10, 3.35, 0.13, 9, 0.7, '#14324a', '#ffffff', 0, 'ONITSHA DIVISION · CHARGE ROOM'); R.sign('POLICE IS YOUR FRIEND', 10, 2.55, 0.13, 4.5, 0.32, '#f2c14e', '#14324a');
  R.counter(9, 7.5, 9, { color: '#2a4a63', top: '#c9c2b0' }); R.sign('CHARGE ROOM · REPORTS', 9, 1.7, 7.92, 3, 0.3, '#14324a', '#fff', 0);
  R.desk(6.5, 5.5, { face: -1 }); R.desk(11.5, 5.5, { face: -1 }); R.box(0.6, 1.3, 0.5, 2.2, 0.65, 1.2, '#7c7f80', true); R.box(0.6, 1.3, 0.5, 3, 0.65, 1.2, '#7c7f80', true);
  R.person(7, 6.6, 0, { color: BLACK, bottomColor: BLACK }); R.person(11, 6.6, 0, { color: BLACK, bottomColor: BLACK, gender: 'female', outfit: 'shirt_trousers' });
  R.box(2.4, 1.4, 0.05, 1.5, 1.9, 9, '#c9a46a'); R.sign('WANTED', 1.53, 2.45, 9, 2, 0.3, '#7a1f1f', '#fff', Math.PI / 2); for (let i = 0; i < 3; i++) R.box(0.02, 0.6, 0.45, 0.16, 1.7, 8.3 + i * 0.7, '#efe7d4'); // notice board
  R.bench(2, 12, 2.6); R.bench(2, 14.4, 2.6); R.plant(5.5, 15.2); R.flag(18.6, 9.5);
  // the cells
  R.box(5.6, 0.1, 5.6, 17.1, 0.0, 2.9, '#9b968c'); for (let x = 14.4; x <= 19.9; x += 0.32) R.box(0.05, 3, 0.05, x, 1.5, 5.7, '#3a3a3a', true); R.box(5.6, 0.08, 0.08, 17.1, 3, 5.7, '#3a3a3a'); R.box(0.2, 4, 5.8, 14.3, 2, 2.9, '#d9d2c0', true); R.bench(17, 1, 4, '#6f6a60'); R.sign('CELL', 17.1, 3.3, 5.75, 1.4, 0.3, '#3a3a3a', '#fff', 0);
  R.door('back', 4.5, 'DPO'); R.door('back', 12.5, 'CID'); R.door('left', 4, 'INTERVIEW');
  return { spawn: { x: 10, z: 14.4 }, exit: { x: 10, z: 15.3 }, desk: { x: 9, z: 8.6 }, cell: { x: 17, z: 3 } };
 },
 efcc(R) {
  R.shell({ w: 20, d: 16, h: 4.2, floor: '#d8d6d0', wall: '#f1efea', band: '#8d2d32' }); R.lights(3, 3, '#ffffff');
  R.sign('ECONOMIC AND FINANCIAL CRIMES COMMISSION', 10, 3.4, 0.13, 12, 0.6, '#8d2d32', '#ffffff', 0, 'EFCC · ONITSHA FIELD OFFICE');
  R.counter(10, 9, 6, { color: '#3b3f45', top: '#f2f2f2' }); R.box(0.12, 1, 1.4, 6.3, 0.5, 11, '#9aa0a6', true); R.box(0.12, 1, 1.4, 13.7, 0.5, 11, '#9aa0a6', true); // turnstiles
  R.box(0.15, 2.4, 0.3, 8.2, 1.2, 12.6, '#bfc4c8', true); R.box(0.15, 2.4, 0.3, 11.8, 1.2, 12.6, '#bfc4c8', true); R.box(3.75, 0.25, 0.3, 10, 2.45, 12.6, '#bfc4c8'); // scanner arch
  R.person(9, 8.1, 0, { outfit: 'suit', color: GREY }); R.person(11.6, 8.1, 0, { outfit: 'suit_tie', color: NAVY, gender: 'female' });
  for (let x = 3; x <= 17; x += 2.8) R.box(2.2, 1.1, 0.04, x, 2.6, 0.16, '#16212c', false); for (let x = 3; x <= 17; x += 2.8) R.box(2.0, 0.9, 0.02, x, 2.6, 0.2, '#3f7fbf', false, true); // wall of screens
  for (const x of [2, 4.5]) R.shelf(x, 3.5, 2, { goods: ['#c9a46a', '#b38b55', '#e2c48f', '#9c7a49'], frame: '#6d6a64', seed: x }); R.sign('CASE FILES', 3.2, 2.6, 3.8, 1.6, 0.28, '#8d2d32', '#fff');
  // interview room behind glass
  R.box(0.15, 3, 5, 14, 1.5, 3.5, '#c9ced2', true); R.box(5.9, 0.9, 0.15, 17, 0.45, 6, '#2d3a44', true); R.glass(5.9, 2.1, 0.08, 17, 1.95, 6, '#33414c'); R.desk(17, 3.2, { monitor: false, color: '#5a5a5a' }); R.chair(17, 2.3, { color: '#333', face: -1 }); R.chair(17, 4.1, { color: '#333', face: 1 }); R.sign('INTERVIEW ROOM', 17, 3.1, 6.1, 2.4, 0.3, '#8d2d32', '#fff');
  R.box(2.4, 0.45, 0.9, 3.2, 0.25, 13.5, '#4a3f3a', true); R.box(2.4, 0.5, 0.15, 3.2, 0.6, 13.95, '#4a3f3a'); R.plant(1, 15); R.plant(19, 15); R.flag(18.6, 9.5);
  return { spawn: { x: 10, z: 14.6 }, exit: { x: 10, z: 15.4 }, desk: { x: 10, z: 10 } };
 },
 hospital(R) {
  R.shell({ w: 24, d: 18, h: 4, floor: '#e4e9e8', wall: '#f6f8f7', band: '#1f6f8b' }); R.lights(4, 3, '#f6fdff');
  R.sign('WELCOME · RECEPTION', 7, 3.3, 0.13, 6, 0.55, '#1f6f8b', '#ffffff', 0, 'CARD ROOM · TRIAGE'); R.sign('24-HOUR EMERGENCY', 18, 3.3, 0.13, 6, 0.55, '#d4202a', '#ffffff');
  R.counter(7, 8.5, 6, { color: '#ffffff', top: '#1f6f8b' }); R.person(6, 7.6, 0, { gender: 'female', outfit: 'blouse_skirt', color: WHITE, bottomColor: WHITE }); R.person(8.4, 7.6, 0, { gender: 'female', outfit: 'shirt_trousers', color: 7, bottomColor: 7 });
  R.desk(6, 6.6, { face: -1, color: '#d9dcdc' }); R.desk(8.6, 6.6, { face: -1, color: '#d9dcdc' });
  for (const z of [11.5, 13]) R.chairRow(3, z, 7, { color: '#2f6fa8' }); R.box(2, 1.1, 0.06, 6, 2.6, 17.85, '#111', false); R.box(1.85, 1, 0.03, 6, 2.6, 17.8, '#4a8fc4', false, true); // TV
  R.box(0.2, 4, 4, 0.2, 2, 4, '#f6f8f7'); R.box(0.1, 1, 1.6, 0.3, 1.5, 4, '#bcd8e4'); R.sign('PHARMACY', 0.36, 2.4, 4, 1.8, 0.35, '#2f8f5a', '#fff', Math.PI / 2); R.shelf(1, 2, 1.6, { goods: ['#ffffff', '#f5c0c0', '#c0d8f5', '#f5ecc0'], seed: 3 });
  // consulting room (right front)
  R.box(0.15, 3, 6, 15, 1.5, 12, '#e6edef', true); R.box(4, 3, 0.15, 17, 1.5, 9, '#e6edef', true); R.box(4, 3, 0.15, 22, 1.5, 9, '#e6edef', true);
  R.desk(19, 12.2, { face: 1, color: '#d9dcdc' }); R.person(19, 11.3, Math.PI, { outfit: 'suit', color: WHITE, bottomColor: NAVY }); R.bed(22.5, 13, { color: '#cfe8f2' }); R.curtain(21.5, 13, 2.2, true); R.sign('CONSULTING ROOM · OPD', 19, 3.1, 9.1, 3, 0.3, '#1f6f8b', '#fff', Math.PI);
  // ward at the back
  R.box(10, 3, 0.15, 19, 1.5, 6, '#e6edef', true); for (let i = 0; i < 4; i++) { const x = 14.6 + i * 2.4; R.bed(x, 2.2, { color: ['#cfe8f2', '#ffffff'][i % 2] }); R.drip(x + 0.75, 1.2); if (i < 3) R.curtain(x + 1.2, 2.2, 2.2, true); }
  R.sign('WARD A · RECOVERY', 19, 3.1, 6.1, 3, 0.3, '#1f6f8b', '#fff', 0); R.box(1.5, 1, 0.6, 12.2, 0.5, 5, '#ffffff', true); R.person(12.2, 4.4, 0, { gender: 'female', outfit: 'blouse_skirt', color: WHITE, bottomColor: WHITE }); R.sign('NURSES', 12.2, 1.2, 5.32, 1.2, 0.22, '#1f6f8b', '#fff');
  R.box(0.6, 0.85, 0.45, 23.4, 0.43, 16, '#ffffff', true); R.box(0.4, 0.06, 0.3, 23.4, 0.9, 16, '#c0c8cc'); R.sign('WASH YOUR HANDS', 23.75, 1.7, 16, 1.4, 0.25, '#2f8f5a', '#fff', -Math.PI / 2); R.plant(1, 16.8); R.fan(7, 12);
  R.door('left', 15.2, 'STAFF ONLY');
  return { spawn: { x: 12, z: 16.4 }, exit: { x: 12, z: 17.3 }, reception: { x: 7, z: 9.6 }, ward: { x: 15.5, z: 4.6 }, doctor: { x: 19, z: 13.6 }, pharmacy: { x: 1.4, z: 4.2 }, staff: { x: 1.0, z: 15.2 } };
 },
 bank(R, { colors = ['#0f3d63', '#f2c14e'], name = 'BANK' } = {}) {
  const [bg, fg] = colors;
  R.shell({ w: 20, d: 16, h: 4.6, floor: '#ddd8cc', wall: '#f3efe6', band: bg }); R.lights(3, 3, '#fffaf0');
  R.sign(name.toUpperCase(), 10, 3.75, 0.13, 10, 0.75, bg, fg); R.box(20, 0.25, 0.1, 10, 4.3, 0.16, fg);
  R.counter(10, 4.5, 14, { color: bg, top: '#e8e2d2', glass: true }); for (let i = 0; i < 4; i++) { R.sign(String(i + 1), 4.8 + i * 3.5, 2.15, 4.12, 0.4, 0.4, fg, bg, Math.PI); R.person(4.8 + i * 3.5, 3.4, 0, { outfit: 'suit_tie', color: [NAVY, GREY, NAVY, MAROON][i], gender: i % 2 ? 'female' : 'male' }); }
  for (let z = 6.5; z <= 9.5; z += 1.5) { for (let x = 4; x <= 13; x += 1.5) R.box(0.06, 1, 0.06, x, 0.5, z, '#c0c0c0'); R.box(9, 0.06, 0.04, 8.5, 0.9, z, bg); } // queue barriers
  R.sign('QUEUE HERE', 3, 1.4, 6.5, 1.2, 0.3, fg, bg, Math.PI);
  R.desk(2.5, 11.5, { face: -1 }); R.desk(2.5, 13.6, { face: -1 }); R.chair(3.4, 11.5, { face: 1 }); R.chair(3.4, 13.6, { face: 1 }); R.person(1.6, 11.5, -Math.PI / 2, { outfit: 'suit', color: NAVY, gender: 'female' }); R.sign('CUSTOMER SERVICE · LOANS', 0.16, 2.8, 12.5, 3, 0.35, bg, fg, Math.PI / 2);
  for (const z of [10.5, 12.3, 14.1]) { R.box(0.7, 1.9, 0.6, 19.5, 0.95, z, '#2b2f33', true); R.box(0.05, 0.4, 0.45, 19.17, 1.4, z, '#6fb0d8', false, true); } R.sign('ATM GALLERY', 19.84, 2.6, 12.3, 2.2, 0.3, bg, fg, -Math.PI / 2);
  R.box(2.4, 0.1, 0.4, 10, 3.2, 15.8, '#111'); R.box(2.3, 0.6, 0.05, 10, 3.2, 15.75, '#2a9d55', false, true); // rate board over the door
  R.chairRow(8, 12.5, 6, { color: '#3b3b3b' }); R.person(12.8, 14.8, Math.PI, { color: BLACK, bottomColor: BLACK }); R.plant(1, 15.3); R.plant(18, 15.3);
  return { spawn: { x: 10, z: 14.5 }, exit: { x: 10, z: 15.5 }, teller: { x: 9.8, z: 5.6 }, service: { x: 4.4, z: 12.5 }, atm: { x: 18.5, z: 12.3 } };
 },
 court(R) {
  R.shell({ w: 22, d: 18, h: 5, floor: '#a98a63', wall: '#efe6d2', band: '#6b4e33' }); R.lights(3, 3, '#fff3dc'); R.fan(7, 11); R.fan(15, 11);
  R.box(10, 0.6, 3, 11, 0.3, 2, '#5c4128', true); R.box(10, 1.2, 0.2, 11, 1.2, 3.5, '#6b4e33', true); R.box(1.1, 1.9, 0.9, 11, 1.55, 1.2, '#3b2a1c'); // the bench
  R.box(3, 1.8, 0.08, 11, 3.6, 0.15, '#167b46'); R.box(2, 1.2, 0.09, 11, 3.6, 0.17, '#f2f0df'); R.sign('MAGISTRATE COURT', 11, 4.55, 0.16, 6, 0.5, '#6b4e33', '#f9e7b8'); R.sign('SILENCE · COURT IN SESSION', 11, 2.65, 0.18, 4, 0.3, '#3b2a1c', '#f9e7b8');
  R.person(11, 1.6, 0, { outfit: 'suit', color: BLACK, bottomColor: BLACK }); R.desk(11, 4.6, { w: 3, monitor: false, color: '#6b4e33' }); R.person(11, 4.0, 0, { outfit: 'suit_tie', color: NAVY, gender: 'female' });
  R.box(1.6, 1.1, 1.6, 4, 0.55, 5, '#6b4e33', true); R.sign('WITNESS', 4, 1.3, 5.82, 1.2, 0.25, '#3b2a1c', '#f9e7b8'); // witness box
  for (const [x, z, w, d] of [[18, 4.2, 2.4, 0.1], [18, 5.8, 2.4, 0.1], [16.8, 5, 0.1, 1.6], [19.2, 5, 0.1, 1.6]]) R.box(w, 1.1, d, x, 0.55, z, '#6b4e33', true); R.sign('DOCK', 18, 1.3, 5.87, 1, 0.25, '#3b2a1c', '#f9e7b8');
  R.desk(7, 8, { w: 3, monitor: false, color: '#7a5a3a' }); R.desk(15, 8, { w: 3, monitor: false, color: '#7a5a3a' }); for (const x of [6, 8, 14, 16]) R.chair(x, 8.8, { color: '#3b2a1c' });
  R.person(7, 7.2, 0, { outfit: 'suit', color: BLACK }); R.sign('PROSECUTION', 7, 0.95, 8.37, 1.4, 0.2, '#3b2a1c', '#fff'); R.sign('DEFENCE', 15, 0.95, 8.37, 1.4, 0.2, '#3b2a1c', '#fff');
  for (let z = 11; z <= 15.5; z += 1.5) { R.bench(5.5, z, 7); R.bench(16.5, z, 7); }
  R.counter(19.5, 16.2, 3, { color: '#6b4e33' }); R.person(19.5, 15.4, 0, { outfit: 'shirt_trousers', color: CREAM, gender: 'female' }); R.sign('REGISTRY', 19.5, 2.4, 17.85, 2, 0.35, '#6b4e33', '#f9e7b8', Math.PI); R.flag(1.2, 2);
  R.door('left', 16.8, 'ROBING ROOM');
  return { spawn: { x: 11, z: 16.6 }, exit: { x: 11, z: 17.4 }, registry: { x: 19.5, z: 17 }, bench: { x: 11, z: 6.2 }, robing: { x: 1.0, z: 16.8 } };
 },
 supermarket(R) {
  R.shell({ w: 24, d: 20, h: 4.5, floor: '#eeeeea', wall: '#f7f6f2', band: '#c8102e' }); R.lights(4, 4, '#ffffff');
  R.sign('Shoprite', 12, 3.8, 0.13, 7, 0.9, '#c8102e', '#ffffff');
  const aisles = [['GROCERIES', ['#e7b93a', '#d94f3d', '#f5f1e6', '#8b5a2b', '#3f8f5a']], ['BEVERAGES', ['#c8102e', '#1d4fa3', '#2f8f5a', '#f2c14e', '#111111']], ['HOUSEHOLD', ['#2f6fa8', '#ffffff', '#7fc8e0', '#f2a33a', '#8b4f9e']], ['TOILETRIES', ['#ffffff', '#f5c0d8', '#c0e0f5', '#3f8f5a', '#f2c14e']]];
  aisles.forEach(([label, goods], i) => { const z = 3.8 + i * 2.75; R.shelf(7.5, z, 11, { both: true, depth: 0.45, goods, seed: i + 2, levels: 4 }); R.sign(label, 7.5, 3.4, z + 0.47, 2.6, 0.4, '#c8102e', '#fff'); });
  for (let i = 0; i < 6; i++) { R.box(1.2, 1.9, 0.7, 2 + i * 2.2, 0.95, 0.6, '#dfe8ec', true); R.box(1.1, 1.7, 0.03, 2 + i * 2.2, 1, 0.97, '#cfefff', false, true); } R.sign('CHILLED · FROZEN', 7.5, 2.4, 1.0, 3, 0.35, '#1d4fa3', '#fff');
  for (const [x, c] of [[17.5, '#3fae4a'], [19, '#f28c28'], [20.5, '#f2d43a'], [22, '#c8102e']]) { R.box(1.2, 0.8, 1.6, x, 0.4, 3.2, '#8b5a2b', true); for (let k = 0; k < 6; k++) R.box(0.22, 0.2, 0.22, x - 0.35 + (k % 3) * 0.35, 0.9, 2.8 + Math.floor(k / 3) * 0.6, c); } R.sign('FRESH PRODUCE', 19.75, 2.4, 1.0, 3.5, 0.35, '#3fae4a', '#fff');
  for (const x of [19, 21.5]) { R.box(0.05, 1.5, 1.6, x, 1.4, 9, '#9a9a96'); for (let k = 0; k < 5; k++) R.box(0.5, 0.9, 0.08, x, 1.3, 8.4 + k * 0.3, ['#c8102e', '#1d4fa3', '#f5f1e6', '#3f8f5a', '#111'][k]); } R.sign('CLOTHING', 20.2, 3.2, 7.6, 2, 0.35, '#c8102e', '#fff');
  for (let k = 0; k < 3; k++) { R.box(1.3, 0.8, 0.12, 21 + (k - 1) * 0, 1.6 + k * 0.85, 12.5, '#111'); } R.box(1.2, 0.72, 0.03, 21, 1.6, 12.44, '#3d7fc4', false, true); R.box(0.8, 1.7, 0.7, 22.8, 0.85, 12.6, '#e8e8e8', true); R.sign('APPLIANCES', 21.5, 3.2, 12.4, 2.2, 0.35, '#c8102e', '#fff', Math.PI);
  for (let i = 0; i < 4; i++) { const x = 4 + i * 3.2; R.box(0.7, 0.85, 2.2, x, 0.43, 15.5, '#c8c8c2', true); R.box(0.5, 0.02, 1.6, x, 0.87, 15.2, '#2a2a2a'); R.box(0.72, 0.04, 2.22, x, 0.88, 15.5, '#c8102e'); R.box(0.35, 0.3, 0.05, x - 0.2, 1.25, 14.6, '#1b1f24'); R.box(0.3, 0.24, 0.02, x - 0.2, 1.25, 14.57, '#5aa7d6', false, true); R.person(x - 0.75, 15.5, Math.PI / 2, { outfit: 'polo_chinos', color: MAROON, gender: i % 2 ? 'female' : 'male' }); R.sign(`TILL ${i + 1}`, x, 2.4, 15.5, 0.8, 0.25, '#c8102e', '#fff', Math.PI); }
  for (let k = 0; k < 4; k++) R.box(0.6, 0.9, 0.9, 21.5, 0.45, 15.5 + k * 0.15, '#9aa0a6'); R.box(0.6, 0.5, 0.4, 20.5, 0.25, 17, '#c8102e', true); // trolleys, baskets
  return { spawn: { x: 12, z: 18.6 }, exit: { x: 12, z: 19.4 }, checkout: { x: 13.6, z: 14 }, departments: { x: 15.5, z: 9.5 } };
 },
 showroom(R, { shop = 'furniture', bg = '#5a3a24', fg = '#ffe9c2', name = 'SHOWROOM' } = {}) {
  R.shell({ w: 18, d: 14, h: 4, floor: shop === 'decor' ? '#c9b49a' : '#d8d2c6', wall: '#f2ede4', band: bg }); R.lights(3, 3, '#fff4e0');
  R.sign(name.toUpperCase(), 9, 3.3, 0.13, 9, 0.65, bg, fg);
  R.counter(9, 3.2, 4, { color: bg, top: '#efe6d4' }); R.desk(9, 2.2, { face: -1 }); R.person(9, 2.5, 0, { outfit: 'shirt_trousers', color: CREAM });
  if (shop === 'furniture') { for (const [x, z] of [[3.5, 6.5], [3.5, 10.5]]) { R.box(2.4, 0.45, 0.9, x, 0.3, z, '#7a4a3a', true); R.box(2.4, 0.5, 0.2, x, 0.7, z - 0.4, '#7a4a3a'); for (const s of [-1, 1]) R.box(0.2, 0.35, 0.9, x + s * 1.1, 0.55, z, '#7a4a3a'); } R.box(1.8, 0.06, 1, 14, 0.75, 7, '#a07850', true); for (const [dx, dz] of [[-0.6, -0.7], [0.6, -0.7], [-0.6, 0.7], [0.6, 0.7]]) R.chair(14 + dx, 7 + dz, { color: '#8a5a3a', face: dz > 0 ? 1 : -1 }); R.bed(14, 11, { color: '#e8d8c4' }); R.box(1, 1.8, 0.5, 16.8, 0.9, 11, '#8a5a3a', true); }
  if (shop === 'electronics') { for (let i = 0; i < 4; i++) { R.box(1.6, 0.95, 0.08, 3 + i * 2.2, 2.2, 0.2, '#111'); R.box(1.5, 0.85, 0.03, 3 + i * 2.2, 2.2, 0.25, ['#3d7fc4', '#2a9d55', '#c4513d', '#8b4f9e'][i], false, true); } for (let i = 0; i < 3; i++) R.box(0.8, 1.8, 0.7, 2 + i * 1.1, 0.9, 8, '#e8e8e8', true); for (let i = 0; i < 3; i++) { R.box(0.7, 0.9, 0.7, 13 + i * 1, 0.45, 8, '#f2f2f2', true); R.cyl(13 + i * 1, 8.36, 0.3, 0.6, 0.22, '#5a6a72'); } for (const x of [4, 14]) { R.box(0.4, 1, 0.4, x, 0.5, 11.5, '#1b1b1b', true); R.cyl(x, 11.71, 0.55, 0.85, 0.12, '#444'); } }
  if (shop === 'lighting') { for (let i = 0; i < 3; i++) { R.box(1.2, 0.8, 0.7, 3 + i * 1.6, 0.4, 7.5, ['#c8102e', '#e8a33a', '#2f6fa8'][i], true); R.box(0.3, 0.2, 0.3, 3 + i * 1.6, 0.9, 7.5, '#333'); } for (let i = 0; i < 5; i++) { const x = 3 + i * 3; R.box(0.03, 0.8, 0.03, x, 3.6, 10, '#c0a060'); R.cyl(x, 10, 2.9, 3.2, 0.4, '#f6e7b0', true); } for (let i = 0; i < 4; i++) R.box(0.5, 0.7, 0.35, 12 + i * 0.8, 0.35, 6, '#2b2f33', true); }
  if (shop === 'decor') { for (let i = 0; i < 4; i++) R.plant(2 + i * 1.6, 6.5); for (let i = 0; i < 3; i++) { R.cyl(12 + i * 1.4, 7, 0, 0.7, 0.25, ['#c8a060', '#3f6f8f', '#a04040'][i]); R.box(0.3, 1.2, 0.3, 12 + i * 1.4, 0.6, 9.5, '#5a3a24', true); } R.box(4, 0.02, 3, 9, 0.02, 10.5, '#8b2f3f'); for (let i = 0; i < 4; i++) R.box(1, 0.8, 0.04, 3 + i * 3.6, 2.2, 0.17, ['#c4513d', '#2a7d8c', '#e0b040', '#5a3a6a'][i]); }
  R.plant(1, 13); R.plant(17, 13);
  return { spawn: { x: 9, z: 12.5 }, exit: { x: 9, z: 13.4 }, counter: { x: 9, z: 4.3 } };
 },
};
