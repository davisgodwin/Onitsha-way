import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
  Commercial minibus (the 14–18 seat "bus" seen at every Nigerian motor park), primitives only,
  vertex-coloured, +Z forward. Static here; Milestone 5 reuses it as the mini-bus transport class.
*/
function part(geo, hex) {
  const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo.toNonIndexed();
}
const box = (w, h, d, x, y, z, hex) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return part(g, hex); };
const wheel = (x, z) => { const g = new THREE.CylinderGeometry(0.34, 0.34, 0.24, 14); g.rotateZ(Math.PI / 2); g.translate(x, 0.34, z); return part(g, '#141414'); };

export function buildMinibusGeometry({ body = '#f1efe8', stripe = '#1d4e89' } = {}) {
  const L = 5.3, W = 1.9;
  const parts = [
    box(W, 1.15, L, 0, 1.0, 0, body),                        // lower body
    box(W - 0.04, 0.62, L - 0.6, 0, 1.88, -0.15, '#22313a'), // window band
    box(W, 0.12, L - 0.4, 0, 2.25, -0.1, body),               // roof
    box(W + 0.02, 0.14, L + 0.02, 0, 1.05, 0, stripe),         // livery stripe
    box(W - 0.1, 0.55, 0.06, 0, 1.75, L / 2 - 0.05, '#2b3a44'),// windscreen
    box(W - 0.2, 0.25, 0.1, 0, 0.55, L / 2 + 0.02, '#2a2a2a'), // bumper
    box(W - 0.2, 0.25, 0.1, 0, 0.55, -L / 2 - 0.02, '#2a2a2a'),
    box(0.25, 0.14, 0.04, 0.7, 0.9, L / 2 + 0.03, '#fff6d0'),  // headlights
    box(0.25, 0.14, 0.04, -0.7, 0.9, L / 2 + 0.03, '#fff6d0'),
    box(0.2, 0.2, 0.04, 0.75, 1.0, -L / 2 - 0.03, '#a00000'),
    box(0.2, 0.2, 0.04, -0.75, 1.0, -L / 2 - 0.03, '#a00000'),
    box(1.4, 0.18, 2.6, 0, 2.4, -0.4, '#3a3a3a'),             // roof rack with luggage
    box(0.9, 0.35, 1.2, 0.15, 2.65, -0.6, '#7b4b2a'),
    box(0.6, 0.3, 0.7, -0.3, 2.62, 0.4, '#264653'),
    wheel(0.88, 1.6), wheel(-0.88, 1.6), wheel(0.88, -1.6), wheel(-0.88, -1.6),
  ];
  const g = mergeGeometries(parts, false);
  g.computeVertexNormals();
  return g;
}
