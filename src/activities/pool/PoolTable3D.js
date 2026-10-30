import * as THREE from 'three';
import { TABLE, POCKETS } from './PoolGame.js';

const _q = new THREE.Quaternion(), _v = new THREE.Vector3();
export const BED_Y = 0.79; // cloth height
export const BALL_COLORS = { 1: '#f2c12e', 2: '#1f4fbf', 3: '#c8322b', 4: '#5b2a86', 5: '#e8742a', 6: '#1d7a3e', 7: '#7a1f24', 8: '#111111' };
const colorOf = (n) => BALL_COLORS[n > 8 ? n - 8 : n] ?? '#f4f1e8';

function ballTexture(n) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  if (n === 0) { x.fillStyle = '#f6f3ea'; x.fillRect(0, 0, 256, 128); x.fillStyle = '#c33'; x.beginPath(); x.arc(64, 64, 5, 0, 7); x.fill(); }
  else {
    const stripe = n > 8; x.fillStyle = stripe ? '#f6f3ea' : colorOf(n); x.fillRect(0, 0, 256, 128);
    if (stripe) { x.fillStyle = colorOf(n); x.fillRect(0, 34, 256, 60); }
    for (const cx of [64, 192]) { x.fillStyle = '#f6f3ea'; x.beginPath(); x.arc(cx, 64, 20, 0, 7); x.fill(); x.fillStyle = '#111'; x.font = 'bold 24px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), cx, 65); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/**
 * A 7-ft bar table in table space (x along the length, z across; cloth surface at y = BED_Y), plus 16 ball
 * meshes. The parent group's position/rotation places it in the world.
 */
export function buildPoolTable(parent, { cloth = '#1f6b46', wood = '#5a3a24' } = {}) {
  const g = new THREE.Group(); g.name = 'pool-table'; parent.add(g);
  const L = TABLE.L, W = TABLE.W, rail = 0.06, frame = 0.11;
  const m = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, ...o });
  const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; g.add(o); return o; };
  add(new THREE.BoxGeometry(L, 0.04, W), m(cloth, { roughness: 1 }), 0, BED_Y - 0.02, 0);
  const cush = m('#195a3a', { roughness: 1 }), woodM = m(wood, { roughness: 0.55 });
  // cushions (split at the middle pockets) and wooden rails
  const cl = (L / 2) - 0.13;
  for (const s of [-1, 1]) {
    for (const x of [-L / 4, L / 4]) add(new THREE.BoxGeometry(cl, 0.04, rail), cush, x, BED_Y + 0.02, s * (W / 2 + rail / 2));
    add(new THREE.BoxGeometry(rail, 0.04, W - 0.12), cush, s * (L / 2 + rail / 2), BED_Y + 0.02, 0);
    add(new THREE.BoxGeometry(L + 2 * rail + 2 * frame, 0.07, frame), woodM, 0, BED_Y + 0.015, s * (W / 2 + rail + frame / 2));
    add(new THREE.BoxGeometry(frame, 0.07, W + 2 * rail), woodM, s * (L / 2 + rail + frame / 2), BED_Y + 0.015, 0);
  }
  add(new THREE.BoxGeometry(L + 0.3, 0.2, W + 0.3), woodM, 0, BED_Y - 0.14, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.13, BED_Y - 0.2, 0.13), woodM, sx * (L / 2 - 0.05), (BED_Y - 0.2) / 2, sz * (W / 2 - 0.05));
  const hole = m('#090909', { roughness: 1 });
  for (const p of POCKETS) add(new THREE.CylinderGeometry(p.corner ? 0.06 : 0.055, p.corner ? 0.05 : 0.048, 0.06, 16), hole, p.x, BED_Y + 0.005, p.z);
  // spots
  add(new THREE.CylinderGeometry(0.008, 0.008, 0.002, 8), m('#e9e4d0'), L / 4, BED_Y + 0.001, 0);
  // balls
  const geo = new THREE.SphereGeometry(TABLE.R, 20, 14), balls = [];
  for (let n = 0; n < 16; n++) { const b = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: ballTexture(n), roughness: 0.25, metalness: 0.05 })); b.castShadow = true; b.rotation.set(Math.random() * 6, Math.random() * 6, 0); g.add(b); balls[n] = b; }
  return { group: g, balls };
}

/** Put meshes where the game's balls are (pocketed balls hidden), rolling them by the distance moved. */
export function syncBalls(meshes, game, last = null) {
  for (const b of game.balls) {
    const mesh = meshes[b.n]; if (!mesh) continue;
    mesh.visible = !b.pocketed;
    if (last) { const p = last[b.n]; if (p) { const dx = b.x - p.x, dz = b.z - p.z, d = Math.hypot(dx, dz); if (d > 1e-5 && d < 0.5) mesh.quaternion.premultiply(_q.setFromAxisAngle(_v.set(dz, 0, -dx).normalize(), d / TABLE.R)); } } // roll in table space
    mesh.position.set(b.x, BED_Y + TABLE.R, b.z);
  }
}
