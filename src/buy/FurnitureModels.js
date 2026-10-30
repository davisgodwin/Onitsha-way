import * as THREE from 'three';
import { GOOD_BY_ID, PALETTES } from './Goods.js';
import { kitModel, hasKitModel, KIT_BOUNDS, KIT_SCALE } from './FurnitureLibrary.js';
/**
 * Furniture models. Items whose model is 'k:<name>' use the Kenney Furniture Kit (CC0); the rest are drawn here.
 * Every material carries a role name (wood, fabric, body, metal, frame, plastic, ceramic, shade…) so colour
 * variants recolour the right parts on both kinds of model. The same function draws thumbnails, previews and
 * placed pieces, so what the player buys is what appears in the room.
 */
const WOOD = '#b58b60', METAL = '#46545b', CREAM = '#f2eee4';
const ROLE_OF = { [WOOD]: 'wood', '#9b7655': 'woodDark', '#ba9873': 'wood', [METAL]: 'metal', [CREAM]: 'body', '#5c7b73': 'fabric', '#78978d': 'fabric', '#c4ced0': 'body' };
function kit() {
  const g = new THREE.Group();
  const mats = new Map();
  const mat = (color, role, extra = {}) => {
    const r = role ?? ROLE_OF[color] ?? 'detail', key = r + color + JSON.stringify(extra);
    if (!mats.has(key)) { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra }); m.name = r; mats.set(key, m); }
    return mats.get(key);
  };
  const add = (geo, x, y, z, color, role, extra) => { const m = new THREE.Mesh(geo, mat(color, role, extra)); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
  const box = (w, h, d, x, y, z, c, role, extra) => add(new THREE.BoxGeometry(w, h, d), x, y, z, c, role, extra);
  const cyl = (r, h, x, y, z, c, role, extra, r2 = r, seg = 18) => add(new THREE.CylinderGeometry(r, r2, h, seg), x, y, z, c, role, extra);
  const sphere = (r, x, y, z, c, role, extra) => add(new THREE.SphereGeometry(r, 14, 10), x, y, z, c, role, extra);
  const torus = (r, t, x, y, z, c, role) => add(new THREE.TorusGeometry(r, t, 8, 24), x, y, z, c, role);
  const legs = (w, d, h = 0.7, c = WOOD, role = 'wood') => { for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.06, d / 2 - 0.06]) box(0.06, h, 0.06, x, h / 2, z, c, role); };
  const tabletop = (w, d, h = 0.75, c = WOOD) => { box(w, 0.07, d, 0, h, 0, c, 'wood'); legs(w, d, h); };
  const glow = (c) => ({ emissive: c, emissiveIntensity: 0.6 });
  const part = (name, s = KIT_SCALE, x = 0, y = 0, z = 0, ry = 0) => { const m = kitModel(name); if (!m) return null; m.scale.setScalar(s); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  return { g, box, cyl, sphere, torus, legs, tabletop, glow, part, add, mat };
}
/** Simple stand-in for a kit model before the kit has loaded (or in tests without files). */
function kitFallback(name, s) {
  const k = kit(), b = KIT_BOUNDS[name];
  const [w, h, d] = b ? b.s.map((v) => v * s) : [0.6, 0.6, 0.6];
  k.box(w, h, d, 0, h / 2, 0, '#c9b79c', /bed|sofa|lounge|pillow|rug|chair|bench/i.test(name) ? 'fabric' : /kitchen|washer|fridge|toilet|bath|sink/i.test(name) ? 'body' : 'wood');
  return k.g;
}
function kitOrFallback(name, s = KIT_SCALE) {
  if (hasKitModel(name)) { const m = kitModel(name); m.scale.setScalar(s); const g = new THREE.Group(); g.add(m); return g; }
  return kitFallback(name, s);
}

const BUILD = {
  // ── old code-drawn models (kept, now with material roles) ──
  cooker(k) { k.box(0.65, 0.85, 0.6, 0, 0.44, 0, CREAM, 'body'); k.box(0.5, 0.42, 0.03, 0, 0.4, 0.315, METAL); k.box(0.68, 0.04, 0.64, 0, 0.88, 0, METAL); for (const x of [-0.17, 0.17]) for (const z of [-0.16, 0.16]) k.cyl(0.1, 0.025, x, 0.91, z, '#1f2a30', 'metalDark'); },
  shower(k) { k.box(0.82, 0.1, 0.82, 0, 0.06, 0, CREAM, 'body'); k.box(0.06, 1.9, 0.06, 0, 1, -0.35, METAL); k.box(0.36, 0.04, 0.3, 0, 1.95, -0.22, METAL); for (const x of [-0.4, 0.4]) k.box(0.035, 1.9, 0.035, x, 1, 0.35, METAL); k.box(0.76, 1.6, 0.025, 0, 0.95, 0.38, '#b8dce4', 'glass', { transparent: true, opacity: 0.45 }); },
  fan(k) { k.cyl(0.18, 0.04, 0, 0.02, 0, METAL); k.cyl(0.025, 0.85, 0, 0.46, 0, '#bbc5c2', 'body'); k.torus(0.23, 0.025, 0, 1, 0, METAL); const rotor = new THREE.Group(); rotor.name = 'fan-rotor'; rotor.position.y = 1; k.g.add(rotor); for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) { const b = k.box(0.4, 0.025, 0.025, 0, 0, 0, METAL); rotor.add(b); b.rotation.z = a; } },
  rechfan(k) { BUILD.fan(k); k.box(0.34, 0.12, 0.26, 0, 0.06, 0, '#2f6b8f', 'body'); k.box(0.06, 0.03, 0.01, 0.1, 0.09, 0.135, '#7be08f', 'led', k.glow('#5fd47a')); },
  desk(k) { k.box(0.95, 0.07, 0.55, 0, 0.74, 0, WOOD); for (const x of [-0.4, 0.4]) k.box(0.05, 0.7, 0.4, x, 0.35, 0, METAL); k.box(0.4, 0.27, 0.025, 0, 0.93, -0.1, METAL); k.box(0.4, 0.025, 0.25, 0, 0.8, 0.04, METAL); },
  wardrobe(k) { k.box(1, 1.95, 0.58, 0, 0.98, 0, WOOD, 'wood'); for (const x of [-0.245, 0.245]) { k.box(0.46, 1.83, 0.025, x, 0.98, 0.306, '#9b7655', 'woodDark'); k.box(0.025, 0.2, 0.035, x + (x < 0 ? 0.16 : -0.16), 1, 0.33, METAL); } },
  cabinet(k) { k.box(0.9, 0.92, 0.5, 0, 0.46, 0, '#ba9873', 'wood'); k.box(0.94, 0.04, 0.54, 0, 0.94, 0, CREAM, 'body'); for (const x of [-0.22, 0.22]) { k.box(0.4, 0.8, 0.025, x, 0.45, 0.265, WOOD, 'woodDark'); k.box(0.12, 0.025, 0.03, x, 0.7, 0.285, METAL); } },
  diningtable(k) { k.tabletop(1.1, 0.75); for (const z of [-0.5, 0.5]) { k.box(0.46, 0.07, 0.35, 0, 0.44, z, WOOD); for (const x of [-0.18, 0.18]) k.box(0.04, 0.42, 0.28, x, 0.21, z, WOOD); k.box(0.46, 0.4, 0.05, 0, 0.67, z + Math.sign(z) * 0.16, WOOD); } },
  roundtable(k) { k.cyl(0.4, 0.07, 0, 0.48, 0, WOOD, 'wood'); k.cyl(0.06, 0.45, 0, 0.23, 0, METAL); k.cyl(0.3, 0.04, 0, 0.02, 0, METAL); },
  console(k) { k.tabletop(1, 0.5, 0.5, METAL); k.box(0.88, 0.53, 0.06, 0, 0.86, -0.12, METAL); k.box(0.79, 0.43, 0.02, 0, 0.87, -0.08, '#71679c', 'screen').name = 'appliance-screen'; k.box(0.15, 0.32, 0.2, 0.35, 0.69, 0.08, CREAM, 'body'); for (const x of [-0.17, 0.04]) k.box(0.15, 0.04, 0.09, x, 0.57, 0.1, METAL); },
  radio(k) { k.box(0.6, 0.3, 0.25, 0, 0.62, 0, WOOD); for (const x of [-0.19, 0.19]) { const m = k.cyl(0.09, 0.02, x, 0.62, 0.14, '#46515b', 'metal'); m.rotation.x = Math.PI / 2; } k.tabletop(0.64, 0.35, 0.42); k.box(0.18, 0.07, 0.02, 0, 0.67, 0.14, '#bfd5cd', 'screen'); },
  boardtable(k) { k.tabletop(0.85, 0.85, 0.65); for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) k.box(0.095, 0.01, 0.095, -0.24 + x * 0.096, 0.695, -0.24 + z * 0.096, (x + z) % 2 ? '#533d34' : '#eee4ce', 'board'); for (const x of [-0.19, 0.1]) k.cyl(0.035, 0.055, x, 0.73, -0.15, '#ae6654', 'piece'); },
  aquarium(k) { k.box(0.85, 0.65, 0.4, 0, 0.33, 0, WOOD, 'wood'); k.box(0.8, 0.44, 0.36, 0, 0.88, 0, '#7fc6ce', 'glass', { transparent: true, opacity: 0.4 }); k.box(0.84, 0.045, 0.4, 0, 1.12, 0, METAL); k.box(0.78, 0.035, 0.35, 0, 0.67, 0, '#c5bb8a', 'sand'); for (const x of [-0.2, 0.13]) { const f = k.sphere(0.06, x, 0.88, 0.19, x < 0 ? '#dc9850' : '#6393a5', 'fish'); f.scale.x = 1.8; } k.box(0.04, 0.2, 0.04, -0.27, 0.78, 0, '#4c9568', 'plant'); },
  writingdesk(k) { k.tabletop(0.95, 0.6); for (const [i, c] of ['#6b879e', '#bd9771', '#637e68'].entries()) k.box(0.32, 0.035, 0.24, -0.21, 0.81 + i * 0.04, 0, c, 'book'); k.box(0.22, 0.02, 0.27, 0.19, 0.8, 0.06, CREAM, 'paper'); },
  sewing(k) { k.tabletop(0.95, 0.6); k.box(0.42, 0.06, 0.25, 0, 0.82, 0, METAL); k.box(0.1, 0.3, 0.22, 0.15, 1, 0, CREAM, 'body'); k.box(0.35, 0.09, 0.22, 0, 1.16, 0, CREAM, 'body'); k.box(0.025, 0.18, 0.025, -0.14, 1.03, 0, METAL); k.cyl(0.035, 0.1, 0.14, 1.26, 0, '#b37165', 'thread'); k.box(0.4, 0.015, 0.25, -0.18, 0.86, 0.17, '#b8a0bd', 'fabric'); },
  easel(k) { for (const x of [-0.26, 0.26]) { const m = k.box(0.04, 1.48, 0.04, x, 0.76, 0, WOOD); m.rotation.z = -Math.sign(x) * 0.12; } const back = k.box(0.04, 1.1, 0.04, 0, 0.55, -0.23, WOOD); back.rotation.x = -0.3; k.box(0.64, 0.8, 0.045, 0, 1.03, 0, WOOD); k.box(0.57, 0.7, 0.02, 0, 1.03, 0.036, CREAM, 'canvas'); k.box(0.38, 0.2, 0.01, -0.04, 1, 0.052, '#729d95', 'paint'); k.box(0.2, 0.22, 0.01, 0.12, 1.2, 0.053, '#dbb270', 'paint'); k.box(0.72, 0.04, 0.16, 0, 0.6, 0.02, WOOD); },
  guitar(k) { k.cyl(0.2, 0.05, 0, 0.025, 0, METAL); for (const x of [-0.15, 0.15]) k.box(0.03, 0.4, 0.03, x, 0.2, 0, METAL); const body = k.sphere(0.22, 0, 0.55, 0, '#c19660', 'wood'); body.scale.set(1, 1.35, 0.28); k.box(0.075, 0.52, 0.045, 0, 0.99, 0, WOOD); k.box(0.1, 0.15, 0.05, 0, 1.3, 0, WOOD); const hole = k.cyl(0.065, 0.015, 0, 0.59, 0.075, '#3c352e', 'hole'); hole.rotation.x = Math.PI / 2; for (const x of [-0.018, 0, 0.018]) k.box(0.003, 0.95, 0.003, x, 0.83, 0.085, '#c4b9a2', 'string'); },
  tablelamp(k) { k.tabletop(0.45, 0.45, 0.45); k.cyl(0.12, 0.03, 0, 0.5, 0, METAL); k.cyl(0.02, 0.32, 0, 0.67, 0, METAL); k.add(new THREE.ConeGeometry(0.2, 0.25, 20, 1, true), 0, 0.91, 0, '#d9b883', 'shade', { emissive: '#ffdf94', emissiveIntensity: 0.25, side: THREE.DoubleSide }); },
  lantern(k) { k.box(0.24, 0.06, 0.23, 0, 0.04, 0, METAL); k.box(0.22, 0.3, 0.2, 0, 0.22, 0, '#f4e0aa', 'shade', k.glow('#f4c661')); k.box(0.26, 0.05, 0.23, 0, 0.4, 0, METAL); k.torus(0.12, 0.018, 0, 0.5, 0, METAL); },
  archedlamp(k) { k.cyl(0.23, 0.05, -0.25, 0.03, 0, METAL); k.cyl(0.025, 1.6, -0.25, 0.83, 0, METAL); const arm = k.box(0.64, 0.035, 0.035, 0.06, 1.65, 0, METAL); arm.rotation.z = -0.12; k.add(new THREE.ConeGeometry(0.21, 0.23, 20, 1, true), 0.35, 1.53, 0, '#ddc5a1', 'shade', { emissive: '#f1ce86', emissiveIntensity: 0.25, side: THREE.DoubleSide }); },
  tripodlamp(k) { for (const a of [0, 2.094, 4.189]) { const leg = k.box(0.035, 1.2, 0.035, Math.cos(a) * 0.12, 0.6, Math.sin(a) * 0.12, WOOD); leg.rotation.z = Math.sin(a) * 0.2; leg.rotation.x = Math.cos(a) * 0.2; } k.cyl(0.23, 0.4, 0, 1.36, 0, '#ceb997', 'shade', { emissive: '#f1ce86', emissiveIntensity: 0.25 }, 0.32); },
  fern(k) { k.cyl(0.22, 0.4, 0, 0.2, 0, '#b07e61', 'ceramic'); k.cyl(0.025, 0.9, 0, 0.8, 0, '#617954', 'plant'); for (let i = 0; i < 8; i++) { const leaf = k.sphere(0.18, Math.sin(i) * 0.22, 0.75 + (i % 3) * 0.17, Math.cos(i) * 0.22, i % 2 ? '#52846b' : '#679475', 'plant'); leaf.scale.set(0.5, 1.8, 0.35); leaf.rotation.z = Math.sin(i) * 0.8; } },
  mirror(k) { k.box(0.66, 1.65, 0.07, 0, 0.86, 0, WOOD); k.box(0.55, 1.52, 0.025, 0, 0.86, 0.05, '#b7d0db', 'glass', { metalness: 0.6, roughness: 0.1 }); k.box(0.56, 0.035, 0.3, 0, 0.04, 0, WOOD); },
  vase(k) { k.cyl(0.18, 0.36, 0, 0.18, 0, '#bb805d', 'ceramic'); k.cyl(0.12, 0.2, 0, 0.46, 0, '#bb805d', 'ceramic'); k.cyl(0.14, 0.035, 0, 0.58, 0, '#d0a284', 'ceramic'); for (const x of [-0.08, 0.04, 0.1]) { k.box(0.012, 0.48, 0.012, x, 0.81, 0, '#71936e', 'plant'); k.sphere(0.07, x, 1.07, 0, '#d7b96b', 'flower'); } },
  divider(k) { for (const x of [-0.5, 0, 0.5]) { k.box(0.46, 1.65, 0.05, x, 0.85, 0, WOOD); k.box(0.39, 1.52, 0.025, x, 0.85, 0.035, '#c3ab83', 'weave'); for (const y of [0.3, 0.55, 0.8, 1.05, 1.3, 1.55]) k.box(0.4, 0.018, 0.015, x, y, 0.054, '#9a805e', 'weave'); } for (const x of [-0.6, 0.6]) k.box(0.045, 0.07, 0.4, x, 0.035, 0, WOOD); },
  generator(k) { k.box(0.9, 0.08, 0.65, 0, 0.06, 0, METAL); k.box(0.66, 0.44, 0.45, 0, 0.32, 0, '#b74a39', 'body'); k.box(0.75, 0.14, 0.5, 0, 0.6, 0, '#dfc47b', 'tank'); for (const x of [-0.43, 0.43]) k.box(0.04, 0.72, 0.04, x, 0.38, 0, METAL); k.box(0.9, 0.04, 0.04, 0, 0.74, 0, METAL); },
  inverter(k) { k.box(0.45, 0.45, 0.35, 0, 0.23, 0, CREAM, 'body'); k.box(0.48, 0.25, 0.38, 0, 0.59, 0, METAL); },
  powerstation(k) { k.box(0.52, 0.43, 0.34, 0, 0.23, 0, '#4c6677', 'body'); k.box(0.3, 0.14, 0.025, 0, 0.3, 0.185, '#91b9ad', 'screen'); for (const x of [-0.13, 0.13]) k.box(0.07, 0.07, 0.02, x, 0.13, 0.19, CREAM); for (const x of [-0.16, 0.16]) k.box(0.025, 0.1, 0.025, x, 0.5, 0, METAL); k.box(0.35, 0.025, 0.025, 0, 0.56, 0, METAL); },
  batterybank(k) { k.box(0.6, 1.05, 0.5, 0, 0.54, 0, '#b9c7cc', 'body'); for (const y of [0.2, 0.5, 0.8]) { k.box(0.52, 0.22, 0.025, 0, y, 0.265, METAL); k.box(0.06, 0.03, 0.025, 0.18, y, 0.285, '#8bbb99', 'led'); } k.box(0.4, 0.03, 0.35, 0, 1.1, 0, METAL); },
  battery(k) { k.box(0.45, 0.55, 0.3, 0, 0.28, 0, '#2f3640', 'body'); k.box(0.45, 0.05, 0.3, 0, 0.58, 0, '#d24a3a', 'cap'); for (const x of [-0.12, 0.12]) k.cyl(0.03, 0.06, x, 0.63, 0, x < 0 ? '#c83a32' : '#2a2a2a', 'terminal'); k.box(0.3, 0.12, 0.01, 0, 0.32, 0.155, '#e3c25c', 'label'); },

  // ── living room ──
  tvwallunit(k) {
    k.box(2.2, 0.45, 0.45, 0, 0.225, 0, WOOD, 'wood');
    for (const x of [-0.75, 0.75]) { k.box(0.45, 0.42, 0.02, x, 0.23, 0.235, '#9b7655', 'woodDark'); }
    for (const x of [-0.95, 0.95]) k.box(0.3, 1.9, 0.4, x, 0.95, -0.02, WOOD, 'wood');
    k.box(2.2, 0.06, 0.4, 0, 1.9, -0.02, WOOD, 'wood'); k.box(1.6, 0.04, 0.3, 0, 1.45, -0.05, WOOD, 'wood');
    k.box(1.4, 0.8, 0.06, 0, 0.95, -0.12, '#1c2226', 'metalDark'); k.box(1.32, 0.72, 0.01, 0, 0.95, -0.085, '#111b20', 'screen').name = 'appliance-screen';
    for (const [i, c] of ['#b8473a', '#4c5d92', '#c99b3a', '#45705a'].entries()) k.box(0.05, 0.24, 0.17, -0.3 + i * 0.07, 1.59, -0.05, c, 'book');
  },
  displaycabinet(k) {
    k.box(1, 1.85, 0.45, 0, 0.925, 0, WOOD, 'wood'); k.box(0.9, 1.6, 0.02, 0, 1.0, 0.23, '#cfe3e8', 'glass', { transparent: true, opacity: 0.3 });
    for (const y of [0.55, 1.0, 1.42]) k.box(0.9, 0.025, 0.4, 0, y, 0, '#e8e2d6', 'glassShelf');
    for (const [x, y, c] of [[-0.25, 0.62, '#efeae2'], [0.1, 0.62, '#bb805d'], [0.28, 1.07, '#3f8c8a'], [-0.2, 1.07, '#efeae2'], [0, 1.49, '#c9a24b']]) k.cyl(0.06, 0.14, x, y + 0.07, 0, c, 'ceramic');
  },
  shoerack(k) { for (const x of [-0.38, 0.38]) k.box(0.04, 0.5, 0.3, x, 0.25, 0, WOOD, 'wood'); for (const y of [0.08, 0.26, 0.45]) for (let i = 0; i < 4; i++) k.box(0.72, 0.02, 0.05, 0, y, -0.11 + i * 0.075, WOOD, 'wood'); for (const [x, y, c] of [[-0.22, 0.12, '#2f2f33'], [0.05, 0.12, '#7d5537'], [0.25, 0.3, '#c0453c'], [-0.15, 0.3, '#eee']]) k.box(0.12, 0.08, 0.26, x, y, 0, c, 'shoe'); },
  tvonstand(k) { k.box(0.98, 0.48, 0.38, 0, 0.24, 0, WOOD, 'wood'); k.box(0.42, 0.36, 0.02, -0.24, 0.24, 0.19, '#9b7655', 'woodDark'); k.box(0.42, 0.36, 0.02, 0.24, 0.24, 0.19, '#9b7655', 'woodDark'); k.box(0.3, 0.03, 0.2, 0, 0.495, 0, METAL); k.box(0.05, 0.08, 0.05, 0, 0.54, 0, METAL); k.box(0.96, 0.58, 0.05, 0, 0.87, 0, '#1c2226', 'metalDark'); k.box(0.9, 0.52, 0.01, 0, 0.87, 0.027, '#111b20', 'screen').name = 'appliance-screen'; },

  // ── bedroom ──
  slidewardrobe(k) { k.box(1.8, 2.05, 0.6, 0, 1.025, 0, WOOD, 'wood'); k.box(0.9, 1.95, 0.02, -0.44, 1.02, 0.305, '#9b7655', 'woodDark'); k.box(0.9, 1.95, 0.02, 0.44, 1.02, 0.315, '#d9e4e8', 'glass', { metalness: 0.5, roughness: 0.12 }); k.box(1.8, 0.04, 0.05, 0, 2.02, 0.3, METAL); for (const x of [-0.06, 0.06]) k.box(0.02, 0.3, 0.03, x, 1.05, 0.33, METAL); },
  drawers(k) { k.box(0.9, 0.95, 0.48, 0, 0.475, 0, WOOD, 'wood'); for (let i = 0; i < 4; i++) { const y = 0.14 + i * 0.22; k.box(0.84, 0.19, 0.02, 0, y, 0.245, '#9b7655', 'woodDark'); k.box(0.16, 0.025, 0.03, 0, y + 0.03, 0.265, METAL); } },
  dressingtable(k) { k.box(1.1, 0.06, 0.48, 0, 0.75, 0, WOOD, 'wood'); for (const x of [-0.4, 0.4]) k.box(0.3, 0.72, 0.45, x, 0.36, 0, WOOD, 'wood'); k.box(0.42, 0.14, 0.02, 0, 0.66, 0.235, '#9b7655', 'woodDark'); k.box(0.8, 0.85, 0.04, 0, 1.25, -0.2, WOOD, 'wood'); k.box(0.7, 0.75, 0.015, 0, 1.25, -0.175, '#c8dce4', 'glass', { metalness: 0.6, roughness: 0.1 }); for (const [x, c] of [[-0.3, '#c0453c'], [-0.22, '#efeae2'], [0.28, '#c9a24b']]) k.cyl(0.03, 0.12, x, 0.84, 0.05, c, 'bottle'); },
  stool(k) { k.cyl(0.21, 0.12, 0, 0.42, 0, '#c9b28f', 'fabric'); for (const a of [0.8, 2.4, 3.9, 5.5]) k.box(0.035, 0.38, 0.035, Math.cos(a) * 0.15, 0.19, Math.sin(a) * 0.15, WOOD, 'wood'); },

  // ── electronics ──
  walltv(k) { k.box(1.3, 0.76, 0.05, 0, 0.38, 0, '#1c2226', 'metalDark'); k.box(1.24, 0.7, 0.01, 0, 0.38, 0.027, '#111b20', 'screen').name = 'appliance-screen'; k.box(0.2, 0.2, 0.03, 0, 0.38, -0.035, METAL); },
  freezer(k) { k.box(1.1, 0.82, 0.68, 0, 0.41, 0, '#eef0ee', 'body'); k.box(1.12, 0.06, 0.7, 0, 0.85, 0, '#e2e6e4', 'body'); k.box(0.5, 0.04, 0.03, 0, 0.78, 0.35, METAL); k.box(0.12, 0.05, 0.01, 0.4, 0.68, 0.345, '#5fd47a', 'led', k.glow('#5fd47a')); k.box(1.1, 0.06, 0.68, 0, 0.03, 0, '#7d8790', 'metalDark'); },
  tablefan(k) { k.cyl(0.12, 0.04, 0, 0.02, 0, '#eef0ee', 'body'); k.cyl(0.02, 0.2, 0, 0.13, 0, '#eef0ee', 'body'); k.torus(0.13, 0.012, 0, 0.32, 0, METAL); const rotor = new THREE.Group(); rotor.name = 'fan-rotor'; rotor.position.y = 0.32; k.g.add(rotor); for (const a of [0, 2.1, 4.2]) { const b = k.box(0.22, 0.012, 0.012, 0, 0, 0, '#a9c4d8', 'blade'); b.rotation.z = a; rotor.add(b); } },
  aircon(k) { k.box(0.95, 0.3, 0.22, 0, 0.15, 0, '#f4f5f2', 'body'); k.box(0.88, 0.04, 0.02, 0, 0.05, 0.112, '#c8ccc9', 'vent'); k.box(0.12, 0.03, 0.01, 0.35, 0.22, 0.112, '#5fd47a', 'led', k.glow('#5fd47a')); },
  kettle(k) { k.cyl(0.09, 0.03, 0, 0.015, 0, '#2f3236', 'metalDark'); k.cyl(0.075, 0.2, 0, 0.13, 0, '#eef0ee', 'body', {}, 0.085); k.box(0.03, 0.15, 0.03, 0.1, 0.15, 0, '#2f3236', 'handle'); k.box(0.05, 0.025, 0.025, -0.1, 0.18, 0, '#eef0ee', 'body'); },
  dispenser(k) { k.box(0.34, 0.95, 0.34, 0, 0.475, 0, '#eef0ee', 'body'); k.cyl(0.14, 0.4, 0, 1.15, 0, '#8fc4e0', 'water', { transparent: true, opacity: 0.6 }); for (const [x, c] of [[-0.06, '#3f74b8'], [0.06, '#c0453c']]) k.box(0.03, 0.05, 0.04, x, 0.65, 0.18, c, 'tap'); k.box(0.2, 0.02, 0.1, 0, 0.45, 0.14, '#9aa3a8', 'metal'); },
  ironboard(k) { const board = k.box(1.2, 0.03, 0.36, 0, 0.88, 0, '#c7d3e0', 'fabric'); board.scale.z = 1; for (const s of [-1, 1]) { const leg = k.box(0.03, 1.0, 0.03, s * 0.25, 0.45, 0, METAL); leg.rotation.z = s * 0.5; } k.box(0.24, 0.1, 0.12, 0.35, 0.95, 0, '#eef0ee', 'body'); k.box(0.12, 0.06, 0.04, 0.33, 1.02, 0, '#3f74b8', 'handle'); },
  hometheatre(k) { for (const x of [-0.82, 0.82]) { k.box(0.24, 1.05, 0.26, x, 0.525, 0, '#25282c', 'body'); for (const y of [0.3, 0.6, 0.88]) { const c = k.cyl(0.07, 0.02, x, y, 0.135, '#4d545c', 'metal'); c.rotation.x = Math.PI / 2; } } k.box(0.42, 0.42, 0.4, -0.35, 0.21, 0, '#25282c', 'body'); const w = k.cyl(0.13, 0.02, -0.35, 0.21, 0.205, '#4d545c', 'metal'); w.rotation.x = Math.PI / 2; k.box(0.45, 0.12, 0.33, 0.3, 0.06, 0, '#1b1d20', 'body'); k.box(0.12, 0.03, 0.01, 0.3, 0.07, 0.17, '#5fb7e0', 'led', k.glow('#5fb7e0')); },
  gameconsole(k) { k.box(0.38, 0.08, 0.3, 0, 0.04, 0, '#f2f2f0', 'body'); k.box(0.38, 0.02, 0.3, 0, 0.09, 0, '#1b1d20', 'metalDark'); for (const x of [-0.12, 0.12]) { k.box(0.13, 0.03, 0.07, x, 0.015, 0.12, '#1b1d20', 'controller'); } },
  router(k) { k.box(0.24, 0.05, 0.15, 0, 0.025, 0, '#1b1d20', 'body'); for (const x of [-0.09, 0, 0.09]) k.box(0.015, 0.18, 0.015, x, 0.14, -0.06, '#1b1d20', 'body'); for (let i = 0; i < 4; i++) k.box(0.015, 0.01, 0.005, -0.07 + i * 0.03, 0.035, 0.077, '#5fd47a', 'led', k.glow('#5fd47a')); },

  // ── lighting ──
  ceilinglight(k) { k.cyl(0.1, 0.05, 0, 0.3, 0, '#eef0ee', 'body'); k.cyl(0.012, 0.18, 0, 0.18, 0, '#333', 'cable'); k.sphere(0.07, 0, 0.06, 0, '#fff4d6', 'shade', k.glow('#ffe3a1')); },
  modernlight(k) { k.cyl(0.3, 0.06, 0, 0.12, 0, '#f4f4f1', 'body'); k.cyl(0.27, 0.01, 0, 0.085, 0, '#fffaf0', 'shade', k.glow('#fff0c8')); k.cyl(0.02, 0.06, 0, 0.18, 0, METAL); },
  chandelier(k) { k.cyl(0.05, 0.4, 0, 0.75, 0, '#c9a24b', 'metal'); k.torus(0.38, 0.02, 0, 0.42, 0, '#c9a24b', 'metal').rotation.x = Math.PI / 2; k.torus(0.24, 0.02, 0, 0.6, 0, '#c9a24b', 'metal').rotation.x = Math.PI / 2; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; k.add(new THREE.OctahedronGeometry(0.035), Math.cos(a) * 0.38, 0.3, Math.sin(a) * 0.38, '#e8f4fa', 'crystal', { transparent: true, opacity: 0.85, emissive: '#fff4d6', emissiveIntensity: 0.4 }); if (i % 2 === 0) k.add(new THREE.OctahedronGeometry(0.03), Math.cos(a) * 0.24, 0.5, Math.sin(a) * 0.24, '#e8f4fa', 'crystal', { transparent: true, opacity: 0.85, emissive: '#fff4d6', emissiveIntensity: 0.4 }); if (i % 3 === 0) k.sphere(0.04, Math.cos(a) * 0.38, 0.47, Math.sin(a) * 0.38, '#fff4d6', 'shade', k.glow('#ffe3a1')); } k.add(new THREE.OctahedronGeometry(0.07), 0, 0.2, 0, '#e8f4fa', 'crystal', { transparent: true, opacity: 0.85, emissive: '#fff4d6', emissiveIntensity: 0.4 }); },
  spotlights(k) { for (const x of [-0.45, 0.45]) for (const z of [-0.45, 0.45]) { k.cyl(0.06, 0.02, x, 0.01, z, '#d8dad6', 'body'); k.cyl(0.04, 0.012, x, 0.0, z, '#fff6dc', 'shade', k.glow('#fff0c8')); } },
  ledstrip(k) { k.box(2, 0.02, 0.025, 0, 0.01, 0, '#f6f6f6', 'body'); k.box(1.96, 0.012, 0.01, 0, 0.005, 0.015, '#fff0c8', 'shade', k.glow('#fff0c8')); },
  rgblight(k) { for (const [x, c] of [[-0.22, '#7a5cff'], [0.22, '#22d3ee']]) { k.box(0.08, 0.04, 0.08, x, 0.02, 0, '#1b1d20', 'body'); k.box(0.05, 0.5, 0.05, x, 0.29, 0, c, 'shade', { emissive: c, emissiveIntensity: 0.9 }); } },
  emergencylight(k) { k.box(0.45, 0.1, 0.08, 0, 0.05, 0, '#eef0ee', 'body'); for (const x of [-0.14, 0.14]) k.box(0.13, 0.05, 0.02, x, 0.05, 0.045, '#fff6dc', 'shade', k.glow('#fff0c8')); k.box(0.03, 0.015, 0.01, 0, 0.08, 0.042, '#5fd47a', 'led', k.glow('#5fd47a')); },

  // ── wall décor ── (wall items: back at -z, front facing +z, base at y = 0)
  art(k) { k.box(1, 0.7, 0.04, 0, 0.35, 0, '#8d6947', 'frame'); k.box(0.84, 0.54, 0.02, 0, 0.35, 0.025, '#4b8e93', 'canvas'); k.box(0.3, 0.22, 0.01, -0.16, 0.37, 0.04, '#e5b666', 'paint'); },
  painting(k) { k.box(0.9, 0.65, 0.04, 0, 0.325, 0, '#c9a24b', 'frame'); k.box(0.8, 0.55, 0.015, 0, 0.325, 0.025, '#e9d9b6', 'canvas'); k.box(0.8, 0.2, 0.01, 0, 0.15, 0.035, '#5d8a5f', 'paint'); k.sphere(0.07, 0.2, 0.45, 0.03, '#e6a23c', 'paint').scale.z = 0.15; k.box(0.12, 0.25, 0.01, -0.18, 0.3, 0.036, '#6e4a35', 'paint'); },
  africanart(k) { k.box(0.8, 1.0, 0.04, 0, 0.5, 0, '#2f2f33', 'frame'); k.box(0.7, 0.9, 0.015, 0, 0.5, 0.025, '#d9a441', 'canvas'); for (let i = 0; i < 5; i++) k.box(0.7, 0.05, 0.01, 0, 0.15 + i * 0.17, 0.035, i % 2 ? '#7a2e1f' : '#1f1f22', 'paint'); const head = k.sphere(0.13, 0, 0.62, 0.04, '#5a3a24', 'paint'); head.scale.set(0.8, 1.2, 0.15); k.box(0.24, 0.3, 0.01, 0, 0.35, 0.04, '#5a3a24', 'paint'); },
  ulicanvas(k) { k.box(1.4, 0.8, 0.04, 0, 0.4, 0, '#8a5f3c', 'frame'); k.box(1.3, 0.7, 0.015, 0, 0.4, 0.025, '#efe4cf', 'canvas'); for (let i = 0; i < 6; i++) { const t = k.torus(0.07 + i * 0.012, 0.006, -0.35 + i * 0.14, 0.4 + Math.sin(i) * 0.12, 0.035, '#3a2a20'); t.scale.z = 0.2; } for (let i = 0; i < 9; i++) k.box(0.01, 0.5, 0.005, 0.25 + i * 0.04, 0.4, 0.034, '#3a2a20', 'paint').rotation.z = Math.sin(i) * 0.4; },
  photoframes(k) { for (const [x, y, w, h] of [[-0.3, 0.3, 0.28, 0.36], [0.05, 0.38, 0.32, 0.24], [0.33, 0.22, 0.22, 0.28]]) { k.box(w, h, 0.03, x, y, 0, '#c9a24b', 'frame'); k.box(w - 0.06, h - 0.06, 0.01, x, y, 0.017, ['#a87f62', '#7d9bb0', '#c4a587'][Math.round((x + 0.3) * 3) % 3], 'photo'); } },
  portrait(k) { k.box(1, 1.25, 0.05, 0, 0.625, 0, '#c9a24b', 'frame'); k.box(0.88, 1.12, 0.015, 0, 0.625, 0.03, '#d7cbb4', 'canvas'); for (const [x, s, c] of [[-0.25, 1, '#5a3a24'], [0, 1.1, '#4a2f1f'], [0.25, 0.9, '#5a3a24'], [-0.12, 0.7, '#6b4630'], [0.13, 0.7, '#6b4630']]) { const y = s < 0.8 ? 0.38 : 0.62; k.sphere(0.07 * s, x, y + 0.16 * s, 0.04, c, 'paint').scale.z = 0.15; k.box(0.18 * s, 0.3 * s, 0.01, x, y - 0.03, 0.04, ['#b8473a', '#3f74b8', '#c99b3a', '#45705a', '#efe4cf'][Math.round(x * 8 + 2) % 5], 'paint'); } },
  wallclock(k) { const f = k.cyl(0.2, 0.04, 0, 0.2, 0, '#2f2f33', 'frame'); f.rotation.x = Math.PI / 2; const d = k.cyl(0.18, 0.01, 0, 0.2, 0.022, '#f7f4ec', 'face'); d.rotation.x = Math.PI / 2; const h1 = k.box(0.012, 0.1, 0.005, 0, 0.24, 0.03, '#1b1d20', 'hand'); const h2 = k.box(0.012, 0.14, 0.005, 0.05, 0.2, 0.032, '#1b1d20', 'hand'); h2.rotation.z = -1.2; h1.position.y = 0.245; for (let i = 0; i < 12; i++) k.box(0.01, 0.025, 0.005, Math.sin(i / 12 * Math.PI * 2) * 0.155, 0.2 + Math.cos(i / 12 * Math.PI * 2) * 0.155, 0.03, '#1b1d20', 'tick'); },
  roundmirror(k) { const f = k.torus(0.34, 0.035, 0, 0.375, 0, '#c9a24b', 'frame'); const gl = k.cyl(0.33, 0.01, 0, 0.375, 0.005, '#cfe1e8', 'glass', { metalness: 0.6, roughness: 0.08 }); gl.rotation.x = Math.PI / 2; f.userData.keep = true; },
  statementmirror(k) { k.box(1.1, 1.9, 0.06, 0, 0.95, 0, '#c9a24b', 'frame'); k.box(0.98, 1.78, 0.015, 0, 0.95, 0.035, '#cfe1e8', 'glass', { metalness: 0.6, roughness: 0.08 }); },
  wallshelves(k) { for (const [x, y, w] of [[-0.25, 0.05, 0.5], [0.2, 0.4, 0.6], [-0.15, 0.75, 0.55]]) { k.box(w, 0.04, 0.22, x, y, 0, WOOD, 'wood'); } k.cyl(0.05, 0.14, -0.35, 0.14, 0, '#3f8c8a', 'ceramic'); for (const [i, c] of ['#b8473a', '#4c5d92', '#c99b3a'].entries()) k.box(0.04, 0.2, 0.15, 0.05 + i * 0.05, 0.52, 0, c, 'book'); k.sphere(0.06, 0, 0.83, 0, '#45705a', 'plant'); },
  wallpanels(k) { for (let i = 0; i < 3; i++) { k.box(0.48, 1.6, 0.03, -0.5 + i * 0.5, 0.8, 0, WOOD, 'wood'); for (let j = 0; j < 5; j++) k.box(0.4, 0.04, 0.02, -0.5 + i * 0.5, 0.2 + j * 0.3, 0.02, '#9b7655', 'woodDark'); } },
  flowers(k) { k.cyl(0.07, 0.18, 0, 0.09, 0, '#efeae2', 'ceramic', {}, 0.05); for (let i = 0; i < 5; i++) { const a = i * 1.26; k.box(0.008, 0.25, 0.008, Math.cos(a) * 0.03, 0.3, Math.sin(a) * 0.03, '#4f7a4c', 'plant'); k.sphere(0.04, Math.cos(a) * 0.06, 0.43 + (i % 2) * 0.04, Math.sin(a) * 0.06, ['#d94f6a', '#f2c14e', '#f6f1ea'][i % 3], 'flower'); } },
  vases(k) { k.cyl(0.07, 0.3, -0.08, 0.15, 0, '#bb805d', 'ceramic', {}, 0.09); k.cyl(0.06, 0.2, 0.1, 0.1, 0, '#bb805d', 'ceramic', {}, 0.08); },
  decobowl(k) { const b = k.add(new THREE.SphereGeometry(0.16, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, 0.12, 0, '#bb805d', 'ceramic', { side: THREE.DoubleSide }); b.scale.y = 0.7; for (const [x, c] of [[-0.05, '#c9a24b'], [0.05, '#8a5f3c']]) k.sphere(0.045, x, 0.07, 0, c, 'ornament'); },
  centrepiece(k) { k.box(0.42, 0.03, 0.2, 0, 0.015, 0, '#8a5f3c', 'wood'); for (const x of [-0.13, 0, 0.13]) k.cyl(0.025, 0.18 + Math.abs(x), x, 0.12 + Math.abs(x) / 2, 0, '#f6efe0', 'candle'); k.sphere(0.05, 0.07, 0.06, 0.03, '#45705a', 'plant'); },
  sculpture(k) { k.box(0.4, 0.5, 0.4, 0, 0.25, 0, '#efeae2', 'plinth'); const s = k.add(new THREE.TorusKnotGeometry(0.12, 0.035, 64, 8), 0, 0.72, 0, '#8a5f3c', 'wood'); s.scale.y = 1.3; },
  candles(k) { for (const [x, h] of [[-0.09, 0.18], [0, 0.26], [0.09, 0.14]]) { k.cyl(0.04, 0.02, x, 0.01, 0, '#c9a24b', 'metal'); k.cyl(0.025, h, x, 0.02 + h / 2, 0, '#f6efe0', 'candle'); k.sphere(0.012, x, 0.04 + h, 0, '#ffcf6b', 'flame', k.glow('#ffb84d')); } },
  carving(k) { k.box(0.32, 0.08, 0.32, 0, 0.04, 0, '#5a3a24', 'wood'); k.cyl(0.08, 0.9, 0, 0.53, 0, '#6e4528', 'wood', {}, 0.1); const head = k.sphere(0.12, 0, 1.08, 0, '#6e4528', 'wood'); head.scale.set(0.8, 1.35, 0.8); for (const y of [0.35, 0.6, 0.85]) k.torus(0.095, 0.015, 0, y, 0, '#3e2616', 'woodDark').rotation.x = Math.PI / 2; k.box(0.16, 0.04, 0.05, 0, 1.2, 0, '#3e2616', 'woodDark'); },

  // ── textiles ──
  throwpillows(k) { for (const [x, c] of [[-0.15, '#b8473a'], [0.15, '#c99b3a']]) { const p = k.box(0.26, 0.24, 0.1, x, 0.13, 0, c, 'fabric'); p.rotation.x = -0.25; } },
  ankaracushions(k) { const cols = [['#d94f2a', '#2a5bd9'], ['#f2b705', '#0c7a43'], ['#7a2e8a', '#f28c28']]; for (let i = 0; i < 3; i++) { const x = -0.22 + i * 0.22; const p = k.box(0.22, 0.22, 0.09, x, 0.12, 0, cols[i][0], 'print'); p.rotation.x = -0.25; const s = k.box(0.12, 0.12, 0.01, x, 0.125, 0.05, cols[i][1], 'print'); s.rotation.x = -0.25; s.rotation.z = 0.785; } },
  sofathrow(k) { k.box(0.7, 0.03, 0.5, 0, 0.015, 0, '#c9b28f', 'fabric'); for (let i = 0; i < 6; i++) k.box(0.7, 0.032, 0.02, 0, 0.016, -0.2 + i * 0.08, '#a8916f', 'fabricStripe'); },
  bedsheets(k) { k.box(1, 0.02, 1, 0, 0.01, 0, '#e6dac2', 'fabric'); },
  duvet(k) { k.box(1.02, 0.07, 0.72, 0, 0.035, 0.14, '#e6dac2', 'fabric'); k.box(1.02, 0.072, 0.1, 0, 0.036, -0.17, '#f6f1ea', 'sheet'); },
  bedpillows(k) { for (const x of [-0.22, 0.22]) { const p = k.box(0.38, 0.1, 0.2, x, 0.05, -0.38, '#f6f1ea', 'sheet'); p.scale.x = 1; } },
  curtains(k) { k.box(1.4, 0.03, 0.03, 0, 1.55, 0, METAL); for (const x of [-0.5, 0.5]) for (let i = 0; i < 4; i++) k.box(0.1, 1.5, 0.05, x - 0.15 + i * 0.1, 0.78, (i % 2) * 0.03, '#ba7958', 'fabric'); },
  sheercurtains(k) { k.box(1.6, 0.03, 0.03, 0, 1.55, 0, METAL); k.box(1.56, 1.5, 0.015, 0, 0.78, 0.02, '#f6f1ea', 'fabric', { transparent: true, opacity: 0.55 }); },
  blackout(k) { k.box(1.6, 0.03, 0.03, 0, 1.55, 0, METAL); for (const x of [-0.5, 0.5]) for (let i = 0; i < 5; i++) k.box(0.12, 1.52, 0.06, x - 0.24 + i * 0.12, 0.77, (i % 2) * 0.035, '#4c5d92', 'fabric'); },
  curtainrod(k) { k.cyl(0.015, 1.7, 0, 0.03, 0, '#c9a24b', 'metal').rotation.z = Math.PI / 2; for (const x of [-0.85, 0.85]) k.sphere(0.035, x, 0.03, 0, '#c9a24b', 'metal'); for (const x of [-0.6, 0.6]) k.box(0.02, 0.06, 0.06, x, 0.03, -0.03, '#c9a24b', 'metal'); },
  blinds(k) { k.box(1.2, 0.05, 0.06, 0, 1.0, 0, '#ecebe6', 'body'); for (let i = 0; i < 18; i++) { const s = k.box(1.18, 0.008, 0.05, 0, 0.95 - i * 0.052, 0.005, '#f4f2ec', 'slat'); s.rotation.x = 0.4; } },

  // ── kitchen ──
  dining4(k) { if (!k.part('table', 2, 0, 0, 0)) k.tabletop(1.6, 0.9); for (const [x, z, r] of [[-0.42, 0.68, Math.PI], [0.42, 0.68, Math.PI], [-0.42, -0.68, 0], [0.42, -0.68, 0]]) { if (!k.part('chairCushion', 2, x, 0, z, r)) { k.box(0.42, 0.06, 0.42, x, 0.46, z, WOOD); } } },
  dining6(k) { const t = k.part('tableCloth', 2, 0, 0, 0); if (t) t.scale.set(2.75, 2, 2); else k.tabletop(2.3, 0.9); for (const [x, z, r] of [[-0.75, 0.68, Math.PI], [0, 0.68, Math.PI], [0.75, 0.68, Math.PI], [-0.75, -0.68, 0], [0, -0.68, 0], [0.75, -0.68, 0]]) { if (!k.part('chairCushion', 2, x, 0, z, r)) k.box(0.42, 0.06, 0.42, x, 0.46, z, WOOD); } },
  kitchenunit(k) { const parts = [['kitchenCabinetDrawer', -0.57], ['kitchenCabinet', 0], ['kitchenCabinetDrawer', 0.57]]; let ok = true; for (const [n, x] of parts) { const p = k.part(n, 2, x, 0, 0); if (!p) ok = false; else p.scale.set(1.33, 2, 1.4); } if (!ok) { k.box(1.72, 0.88, 0.62, 0, 0.44, 0, WOOD, 'wood'); k.box(1.74, 0.04, 0.64, 0, 0.9, 0, '#e0dcd2', 'body'); } },
  kitchenshelf(k) { for (const y of [0.05, 0.42]) k.box(0.9, 0.035, 0.24, 0, y, 0, WOOD, 'wood'); for (const x of [-0.42, 0.42]) k.box(0.02, 0.1, 0.2, x, 0.0, 0, METAL); for (const [x, c] of [[-0.3, '#c0453c'], [-0.15, '#f2c14e'], [0, '#efeae2']]) k.cyl(0.05, 0.14, x, 0.14, 0, c, 'jar'); for (const x of [0.15, 0.3]) k.cyl(0.07, 0.04, x, 0.47, 0, '#efeae2', 'ceramic'); },
  trolley(k) { for (const y of [0.12, 0.45, 0.8]) k.box(0.58, 0.03, 0.38, 0, y, 0, '#3a4148', 'metalDark'); for (const x of [-0.27, 0.27]) for (const z of [-0.17, 0.17]) { k.box(0.025, 0.8, 0.025, x, 0.44, z, METAL); k.sphere(0.035, x, 0.035, z, '#1b1d20', 'wheel'); } for (const [x, c] of [[-0.15, '#f2c14e'], [0.1, '#c0453c']]) k.sphere(0.06, x, 0.52, 0, c, 'fruit'); },
  microshelf(k) { for (const y of [0.08, 0.45, 0.9]) k.box(0.62, 0.03, 0.4, 0, y, 0, '#3a4148', 'metalDark'); for (const x of [-0.3, 0.3]) for (const z of [-0.18, 0.18]) k.box(0.025, 0.92, 0.025, x, 0.46, z, METAL); },
  spicerack(k) { k.box(0.5, 0.03, 0.1, 0, 0.0, 0, WOOD, 'wood'); k.box(0.5, 0.03, 0.1, 0, 0.18, 0, WOOD, 'wood'); k.box(0.5, 0.36, 0.02, 0, 0.17, -0.045, WOOD, 'wood'); for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) k.cyl(0.028, 0.1, -0.2 + i * 0.08, 0.065 + r * 0.18, 0.01, ['#c0453c', '#f2c14e', '#7a4b2a', '#45705a', '#d9862b', '#efeae2'][(i + r) % 6], 'jar'); },
  dinnerset(k) { for (let i = 0; i < 6; i++) k.cyl(0.13, 0.012, -0.08, 0.008 + i * 0.014, 0, '#efeae2', 'ceramic'); for (let i = 0; i < 4; i++) k.cyl(0.08, 0.04, 0.12, 0.02 + i * 0.035, 0.02, '#efeae2', 'ceramic', {}, 0.06); },
  cupset(k) { for (let i = 0; i < 4; i++) { const x = -0.12 + i * 0.08; k.cyl(0.035, 0.08, x, 0.04, 0, '#efeae2', 'ceramic'); k.torus(0.022, 0.006, x + 0.04, 0.045, 0, '#efeae2', 'ceramic').rotation.y = Math.PI / 2; } },
  cutlery(k) { k.box(0.28, 0.06, 0.18, 0, 0.03, 0, '#8a5f3c', 'wood'); for (let i = 0; i < 6; i++) k.box(0.012, 0.16, 0.012, -0.08 + i * 0.03, 0.12, 0, '#c8cdd0', 'metal'); },
  potset(k) { for (const [x, r, h] of [[-0.14, 0.13, 0.14], [0.12, 0.11, 0.12]]) { k.cyl(r, h, x, h / 2, 0, '#b9c1c6', 'metal'); k.cyl(r + 0.005, 0.015, x, h + 0.008, 0, '#a9b1b6', 'metal'); k.box(0.06, 0.02, 0.03, x + r + 0.02, h * 0.8, 0, '#1b1d20', 'handle'); } },
  tray(k) { k.box(0.44, 0.015, 0.3, 0, 0.008, 0, '#8a5f3c', 'wood'); for (const [w, d, x, z] of [[0.44, 0.02, 0, -0.14], [0.44, 0.02, 0, 0.14], [0.02, 0.3, -0.21, 0], [0.02, 0.3, 0.21, 0]]) k.box(w, 0.04, d, x, 0.03, z, '#8a5f3c', 'wood'); },
  fruitbowl(k) { const b = k.add(new THREE.SphereGeometry(0.15, 18, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0, 0.11, 0, '#8a5f3c', 'wood', { side: THREE.DoubleSide }); b.scale.y = 0.65; for (const [x, z, c, r] of [[-0.05, 0, '#e86a2c', 0.045], [0.05, 0.02, '#f2c14e', 0.04], [0, -0.05, '#3d8a3a', 0.04], [0.02, 0.05, '#c0453c', 0.04]]) k.sphere(r, x, 0.1, z, c, 'fruit'); },
  dishrack(k) { k.box(0.44, 0.02, 0.28, 0, 0.01, 0, '#c8cdd0', 'metal'); for (let i = 0; i < 8; i++) k.box(0.005, 0.12, 0.26, -0.18 + i * 0.05, 0.07, 0, '#c8cdd0', 'metal'); for (let i = 0; i < 4; i++) { const p = k.cyl(0.1, 0.01, -0.12 + i * 0.07, 0.12, 0, '#efeae2', 'ceramic'); p.rotation.x = Math.PI / 2; p.rotation.z = Math.PI / 2; } },

  // ── bathroom ──
  bathtub(k) { if (!k.part('bathtub', 2, 0, 0, 0, Math.PI / 2)) { k.box(0.86, 0.45, 1.72, 0, 0.27, 0, CREAM, 'body'); k.box(0.64, 0.02, 1.42, 0, 0.51, 0, '#9fbdc8', 'water'); } },
  towelrack(k) { k.cyl(0.012, 0.66, 0, 0.0, 0.06, '#c8cdd0', 'metal').rotation.z = Math.PI / 2; for (const x of [-0.32, 0.32]) k.box(0.02, 0.04, 0.12, x, 0, 0, '#c8cdd0', 'metal'); k.box(0.42, 0.55, 0.03, 0, -0.27, 0.07, '#e6dac2', 'fabric'); },
  bathmat(k) { k.box(0.8, 0.015, 0.5, 0, 0.008, 0, '#e6dac2', 'fabric'); },
  soapdispenser(k) { k.cyl(0.035, 0.12, 0, 0.06, 0, '#efeae2', 'ceramic'); k.box(0.015, 0.04, 0.015, 0, 0.14, 0, '#c8cdd0', 'metal'); k.box(0.04, 0.012, 0.012, 0.02, 0.16, 0, '#c8cdd0', 'metal'); },
  toothbrush(k) { k.cyl(0.035, 0.1, 0, 0.05, 0, '#efeae2', 'ceramic'); for (const [x, c] of [[-0.012, '#3f74b8'], [0.012, '#d94f6a']]) { const b = k.box(0.008, 0.16, 0.008, x, 0.13, 0, c, 'brush'); b.rotation.z = x * 8; } },
  showershelf(k) { k.box(0.4, 0.02, 0.15, 0, 0, 0, '#c8cdd0', 'metal'); for (const [x, c, h] of [[-0.12, '#3f8c8a', 0.18], [0, '#efeae2', 0.14], [0.12, '#d94f6a', 0.16]]) k.cyl(0.03, h, x, h / 2 + 0.01, 0, c, 'bottle'); },
  hamper(k) { k.cyl(0.21, 0.55, 0, 0.275, 0, '#c9b28f', 'weave', {}, 0.18); k.cyl(0.22, 0.03, 0, 0.56, 0, '#a8916f', 'weave'); },
  bathshelf(k) { for (const x of [-0.28, 0.28]) k.box(0.03, 1.5, 0.03, x, 0.75, 0.1, '#f4f2ec', 'body'); for (const [y, z] of [[0.3, 0], [0.75, 0.04], [1.2, 0.08]]) k.box(0.56, 0.025, 0.28 - z, 0, y, -z / 2, '#f4f2ec', 'body'); for (const [y, c] of [[0.34, '#e6dac2'], [0.79, '#3f8c8a']]) k.box(0.3, 0.08, 0.2, -0.05, y + 0.04, 0, c, 'fabric'); },

  // ── essentials ──
  monobloc(k) { const c = '#f1f1ee'; k.box(0.46, 0.04, 0.44, 0, 0.44, 0, c, 'plastic'); for (const x of [-0.2, 0.2]) for (const z of [-0.19, 0.19]) { const l = k.box(0.045, 0.45, 0.045, x, 0.22, z, c, 'plastic'); l.rotation.z = x * 0.25; l.rotation.x = -z * 0.25; } const back = k.box(0.44, 0.42, 0.035, 0, 0.68, -0.22, c, 'plastic'); back.rotation.x = -0.15; for (const x of [-0.22, 0.22]) k.box(0.035, 0.04, 0.4, x, 0.62, -0.02, c, 'plastic'); },
  compoundchairs(k) { for (const [x, z, r] of [[-0.4, -0.35, 0.4], [0.4, -0.35, -0.4], [-0.4, 0.45, Math.PI - 0.4], [0.4, 0.45, Math.PI + 0.4]]) { const s = kit(); BUILD.monobloc(s); s.g.position.set(x, 0, z); s.g.rotation.y = r; k.g.add(s.g); } },
  solar(k) { for (const x of [-0.6, 0.6]) { const p = k.box(1.0, 0.04, 1.6, x, 1.0, 0, '#1e2b4a', 'panel'); p.rotation.x = -0.25; for (let i = 0; i < 5; i++) { const l = k.box(1.0, 0.045, 0.01, x, 1.0, -0.64 + i * 0.32, '#b8c4d6', 'grid'); l.rotation.x = -0.25; } k.box(0.05, 0.9, 0.05, x - 0.4, 0.45, 0.5, METAL); k.box(0.05, 1.35, 0.05, x - 0.4, 0.67, -0.5, METAL); k.box(0.05, 0.9, 0.05, x + 0.4, 0.45, 0.5, METAL); k.box(0.05, 1.35, 0.05, x + 0.4, 0.67, -0.5, METAL); } k.box(0.35, 0.45, 0.2, 1.4, 0.6, 0, '#eef0ee', 'body'); k.box(0.04, 0.6, 0.04, 1.4, 0.3, 0, METAL); },
  watertank(k) { for (const x of [-0.55, 0.55]) for (const z of [-0.55, 0.55]) k.box(0.1, 2.6, 0.1, x, 1.3, z, '#7c868e', 'metal'); for (const y of [0.9, 1.8]) { k.box(1.2, 0.06, 0.06, 0, y, -0.55, '#7c868e', 'metal'); k.box(1.2, 0.06, 0.06, 0, y, 0.55, '#7c868e', 'metal'); } k.box(1.3, 0.08, 1.3, 0, 2.6, 0, '#7c868e', 'metal'); k.cyl(0.62, 1.2, 0, 3.24, 0, '#1f2226', 'tank', {}, 0.6, 24); k.cyl(0.25, 0.08, 0, 3.88, 0, '#1f2226', 'tank'); k.cyl(0.04, 2.6, 0.5, 1.3, 0.5, '#d8dad6', 'pipe'); },

  // ── outdoor ──
  gardenchair(k) { k.box(0.55, 0.05, 0.55, 0, 0.42, 0, WOOD, 'wood'); k.legs(0.55, 0.55, 0.42); for (let i = 0; i < 4; i++) k.box(0.55, 0.08, 0.03, 0, 0.55 + i * 0.12, -0.27 - i * 0.02, WOOD, 'wood'); for (const x of [-0.27, 0.27]) k.box(0.05, 0.05, 0.55, x, 0.65, 0, WOOD, 'wood'); },
  gardentable(k) { k.cyl(0.45, 0.04, 0, 0.72, 0, WOOD, 'wood'); k.cyl(0.04, 0.72, 0, 0.36, 0, METAL); k.cyl(0.25, 0.04, 0, 0.02, 0, METAL); },
  flowerpots(k) { for (const [x, z, r, c] of [[-0.3, 0, 0.16, '#d94f6a'], [0, 0.1, 0.13, '#f2c14e'], [0.28, -0.05, 0.18, '#e86a2c']]) { k.cyl(r, r * 1.6, x, r * 0.8, z, '#b06a48', 'ceramic', {}, r * 0.75); k.sphere(r * 0.9, x, r * 1.75, z, '#3d7a3a', 'plant'); for (let i = 0; i < 4; i++) k.sphere(0.035, x + Math.cos(i * 1.6) * r * 0.6, r * 2.1, z + Math.sin(i * 1.6) * r * 0.6, c, 'flower'); } },
  planters(k) { for (const x of [-0.45, 0.45]) { k.box(0.6, 0.45, 0.35, x, 0.225, 0, '#8d949a', 'concrete'); const p = k.sphere(0.3, x, 0.55, 0, '#3d7a3a', 'plant'); p.scale.set(1, 0.6, 0.6); } },
  gardenlights(k) { for (const x of [-0.6, 0, 0.6]) { k.cyl(0.015, 0.45, x, 0.225, 0, '#2f3236', 'metalDark'); k.cyl(0.06, 0.1, x, 0.5, 0, '#fff4d6', 'shade', k.glow('#ffd88a')); k.cyl(0.07, 0.02, x, 0.56, 0, '#2f3236', 'metalDark'); } },
  porchlight(k) { k.box(0.12, 0.2, 0.05, 0, 0.1, 0, '#2f3236', 'metalDark'); k.box(0.12, 0.18, 0.12, 0, 0.12, 0.08, '#fff4d6', 'shade', k.glow('#ffd88a')); k.box(0.16, 0.03, 0.16, 0, 0.23, 0.08, '#2f3236', 'metalDark'); },
  securitylight(k) { k.box(0.1, 0.1, 0.06, 0, 0.05, 0, '#2f3236', 'metalDark'); const h = k.box(0.3, 0.2, 0.08, 0, 0.0, 0.12, '#2f3236', 'metalDark'); h.rotation.x = 0.5; const l = k.box(0.26, 0.16, 0.01, 0, -0.02, 0.165, '#fffaf0', 'shade', k.glow('#fff6dc')); l.rotation.x = 0.5; },
  walllight(k) { k.box(0.14, 0.26, 0.04, 0, 0.13, 0, '#2f3236', 'metalDark'); k.cyl(0.06, 0.18, 0, 0.13, 0.08, '#fff4d6', 'shade', k.glow('#ffd88a')); },
  housesign(k) { k.box(0.4, 0.25, 0.03, 0, 0.125, 0, '#1f4d7a', 'sign'); k.box(0.34, 0.19, 0.01, 0, 0.125, 0.017, '#f4f2ec', 'face'); k.box(0.06, 0.12, 0.01, -0.06, 0.125, 0.024, '#1f4d7a', 'digit'); k.box(0.06, 0.12, 0.01, 0.06, 0.125, 0.024, '#1f4d7a', 'digit'); },
  outdoorrug(k) { k.box(1.8, 0.012, 1.2, 0, 0.006, 0, '#b0634c', 'fabric'); for (let i = 0; i < 5; i++) k.box(1.8, 0.014, 0.06, 0, 0.007, -0.48 + i * 0.24, '#e8d9b6', 'stripe'); },
  umbrella(k) { k.cyl(0.25, 0.08, 0, 0.04, 0, '#3a4148', 'metalDark'); k.cyl(0.025, 2.3, 0, 1.15, 0, '#e8e2d6', 'metal'); const c = k.add(new THREE.ConeGeometry(1.25, 0.45, 8, 1, true), 0, 2.15, 0, '#c0453c', 'fabric', { side: THREE.DoubleSide }); c.userData.keep = true; },
};
// Aliases kept from the first catalogue.
BUILD.bed = (k) => { k.part('bedDouble') || k.box(1.6, 0.5, 2, 0, 0.25, 0, WOOD, 'wood'); };

function buildBase(spec) {
  const model = spec?.model ?? spec?.id;
  if (typeof model === 'string' && model.startsWith('k:')) return kitOrFallback(model.slice(2), spec.s ?? KIT_SCALE);
  const k = kit(), fn = BUILD[model];
  if (fn) fn(k); else k.box(0.6, 0.6, 0.6, 0, 0.3, 0, '#c9b79c', 'body');
  return k.g;
}
/** Give the piece its own materials (kit materials are shared), then apply the item tint and the chosen colour. */
function paint(group, spec, color) {
  const palette = spec?.variants ? PALETTES[spec.variants] : null;
  group.traverse((o) => {
    if (!o.isMesh) return;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    const out = list.map((m) => {
      const c = m.clone(); c.userData = { ...m.userData, shared: false };
      const name = m.userData.kitName ?? m.name;
      if (spec?.tint?.[name]) c.color.set(spec.tint[name]);
      if (color && palette?.mat.test(name)) { c.color.set(color); if (/Dark|Darker/.test(name)) c.color.multiplyScalar(0.72); }
      return c;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
}
/** The model for a catalogue item, centred on its footprint with its base at y = 0. */
export function furnitureModel(id, color = null) {
  const spec = GOOD_BY_ID[id];
  const base = buildBase(spec ?? { model: id });
  const g = new THREE.Group(); g.name = `Furniture:${id}`; g.add(base);
  if (spec?.scale) base.scale.multiply(new THREE.Vector3(...spec.scale));
  // Backup power units show a status light (red off, green supplying, amber charging).
  if (spec?.power && spec.mount !== 'outdoor') { const k = kit(); const led = k.box(0.055, 0.035, 0.02, 0.12, spec.power === 'battery' ? 0.35 : 0.5, spec.power === 'battery' ? 0.19 : 0.235, '#d75548', 'led'); led.name = 'power-indicator'; base.add(k.g); }
  paint(g, spec, color);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g, true);
  if (!box.isEmpty()) {
    if (spec?.fit) {
      const s = box.getSize(new THREE.Vector3()), [w, d, h] = spec.fit;
      const k = Math.min(w / s.x, d / s.z, h ? h / s.y : Infinity);
      base.scale.multiplyScalar(k); g.updateMatrixWorld(true); box.setFromObject(g, true);
    }
    const c = box.getCenter(new THREE.Vector3());
    if (spec?.mount === 'wall') base.position.add(new THREE.Vector3(-c.x, -box.min.y, -box.min.z - (spec.size?.[1] ?? 0.05) / 2));
    else base.position.add(new THREE.Vector3(-c.x, -box.min.y, -c.z));
  }
  g.userData.height = box.isEmpty() ? 0.5 : box.max.y - box.min.y;
  return g;
}
export function disposeModel(g) {
  g.traverse((o) => {
    if (o.geometry && !o.geometry.userData?.shared) o.geometry.dispose();
    const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of list) if (!m.userData?.shared) m.dispose();
  });
  g.removeFromParent();
}
export function catalogueThumbnails(ids) {
  const result = new Map(); let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(192, 128); renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor('#eef2f3', 1);
    const scene = new THREE.Scene(); scene.add(new THREE.HemisphereLight('#ffffff', '#9d927f', 2.6));
    const sun = new THREE.DirectionalLight('#fff2d9', 2.6); sun.position.set(3, 5, 4); scene.add(sun);
    const camera = new THREE.PerspectiveCamera(35, 1.5, 0.01, 30);
    for (const id of ids) {
      const model = furnitureModel(id); scene.add(model);
      const bounds = new THREE.Box3().setFromObject(model), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3()), d = Math.max(size.x, size.y, size.z) * 2.15;
      camera.position.set(center.x + d * 0.8, center.y + d * 0.6, center.z + d); camera.lookAt(center);
      renderer.render(scene, camera); result.set(id, renderer.domElement.toDataURL('image/png')); disposeModel(model);
    }
  } catch (e) { console.warn('Catalogue thumbnails unavailable:', e.message); } finally { renderer?.dispose(); renderer?.forceContextLoss(); }
  return result;
}
