import {completeCoach} from './VehicleGeometry.js';
import {modelGeometry} from '../render/ModelLibrary.js';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
  Procedural traffic vehicles. Body silhouettes are extruded side profiles with bevels; glass, tyres,
  lights and trim are separate coloured parts merged into one geometry per model (instancing-friendly).
  Body vertices are white so per-instance colour paints the car; glass/tyres are dark so the tint
  barely affects them. Shapes are generic — no manufacturer badges, grilles or logos are copied.
  Local axes: +Z forward, origin on the ground under the centre.
*/

function paint(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
/** Extrude a side profile ([[along, up], ...], along = +Z forward) across `width`. */
function profile(pts, width, hex, bevel = 0.06) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2); // shape x (length) -> +Z, extrusion -> X
  return paint(g, hex);
}
/** Keep the part of a profile polygon below (or above) height c (Sutherland–Hodgman against a horizontal line). */
function clipY(pts, c, below) {
  const inside = (p) => (below ? p[1] <= c : p[1] >= c);
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (c - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, c]); }
  }
  return out;
}
/**
 * A hollow body: the part below the windows and the roof above them, so the cabin is open behind the
 * (see-through) glass and the people inside show. `glass` is the window profile.
 */
function shell(body, glass, width, hex, bevel = 0.06) {
  const belt = Math.min(...glass.map((p) => p[1])) + 0.02, top = Math.max(...glass.map((p) => p[1])) - 0.03;
  return [profile(clipY(body, belt, true), width, hex, bevel), profile(clipY(body, top, false), width, hex, Math.min(bevel, 0.04))];
}
function box(w, h, d, x, y, z, hex) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, hex); }
function wheel(x, z, r, w = 0.24) {
  const t = new THREE.CylinderGeometry(r, r, w, 16); t.rotateZ(Math.PI / 2); t.translate(x, r, z);
  const h = new THREE.CylinderGeometry(r * 0.55, r * 0.55, w + 0.02, 12); h.rotateZ(Math.PI / 2); h.translate(x, r, z);
  const parts = [paint(t, '#121212'), paint(h, '#b9bcc0')];
  // Alloy spokes and tyre sidewalls remain merged/instanced for traffic performance.
  for (const side of [-1,1]) {
    const ring = new THREE.TorusGeometry(r * .8, .025, 5, 18); ring.rotateY(Math.PI/2); ring.translate(x + side*w/2, r, z); parts.push(paint(ring, '#33393d'));
    for(let i=0;i<5;i++) {const a=i*Math.PI*2/5;const spoke=new THREE.BoxGeometry(.025,r*.85,.035);spoke.rotateX(a);spoke.translate(x+side*(w/2+.015),r+Math.cos(a)*r*.18,z+Math.sin(a)*r*.18);parts.push(paint(spoke,'#d0d7db'));}
  }
  return parts;
}
const GLASS = '#1d2730', TRIM = '#2a2a2a', CHROME = '#c9ccd0', HEAD = '#f4f1e2', TAIL = '#9e0b0b';

function finish(parts) { const g = mergeGeometries(parts, false); g.computeVertexNormals(); g.computeBoundingSphere(); return g; }

/** Long executive saloon (the "big boy" car of Onitsha's business owners). */
export function executiveSedan() {const g=modelGeometry('car-executive');if(!g)throw Error('Model library must load before building car-executive');return g;}

/** Everyday family sedan (the imported "tokunbo" car). */
export function compactSedan() {const g=modelGeometry('car-sedan');if(!g)throw Error('Model library must load before building car-sedan');return g;}

/** Full-size luxury SUV. */
export function luxurySuv() {const g=modelGeometry('car-suv');if(!g)throw Error('Model library must load before building car-suv');return g;}

/** Tipper / goods lorry. */
export function lorry() {
  const W = 2.4, L = 7.2;
  return finish([
    box(W, 1.7, 1.9, 0, 1.55, L / 2 - 0.95, '#ffffff'),                  // cab (tinted)
    box(W - 0.1, 0.7, 0.05, 0, 1.95, L / 2 + 0.01, GLASS),
    box(W + 0.02, 0.6, 1.0, 0, 1.95, L / 2 - 1.0, GLASS),
    box(W, 0.25, L - 2.1, 0, 0.95, -0.95, '#2a2a2a'),                    // chassis
    box(W, 1.1, L - 2.3, 0, 1.65, -1.05, '#6b5a3a'),                     // wooden cargo body
    box(W - 0.2, 0.5, L - 2.5, 0, 2.3, -1.05, '#8b7a5a'),                // load
    box(0.4, 0.2, 0.05, 0.85, 1.0, L / 2 + 0.01, HEAD), box(0.4, 0.2, 0.05, -0.85, 1.0, L / 2 + 0.01, HEAD),
    ...wheel(1.05, L / 2 - 1.1, 0.5, 0.35), ...wheel(-1.05, L / 2 - 1.1, 0.5, 0.35),
    ...wheel(1.05, -2.0, 0.5, 0.35), ...wheel(-1.05, -2.0, 0.5, 0.35), ...wheel(1.05, -3.1, 0.5, 0.35), ...wheel(-1.05, -3.1, 0.5, 0.35),
  ]);
}

/** 30-seat coaster-style bus used on inter-city and long urban routes. */
/**
 * v0.48: the coaster bus is our own model (the supplied bus model had no licence notice, so it is no longer used):
 * a 7 m coach with a rounded nose, a long window band with pillars, a passenger door at the front, a belt stripe,
 * a roof hatch, bumpers, lamps and dual rear wheels.
 */
export function coasterBus() {
  const W = 2.08, L = 7.0, R = L / 2;
  const body = [[-R, 0.45], [-R, 2.5], [-R + 0.14, 2.72], [R - 0.14, 2.72], [R, 2.52], [R, 0.45]]; // a flat, upright front like the real coaster
  const glass = [[-R + 0.12, 1.55], [-R + 0.12, 2.52], [R - 0.16, 2.56], [R - 0.06, 2.44], [R - 0.06, 1.58]];
  const parts = [...shell(body, glass, W, '#ffffff', 0.08), profile(glass, W + 0.04, GLASS, 0.02)];
  for (let z = -R + 0.95; z < R - 1.0; z += 0.95) parts.push(box(W + 0.06, 0.88, 0.09, 0, 1.99, z, '#ffffff'));
  parts.push(box(W + 0.05, 0.16, L - 0.3, 0, 1.38, 0, '#1d4e89'), box(W + 0.05, 0.07, L - 0.3, 0, 1.18, 0, '#c1121f'));
  parts.push(box(0.03, 1.55, 0.9, W / 2 + 0.02, 1.25, R - 1.25, TRIM), box(0.03, 0.8, 0.86, W / 2 + 0.025, 1.95, R - 1.25, GLASS));
  parts.push(box(W - 0.3, 0.6, 0.05, 0, 2.05, R - 0.04, GLASS), box(W - 0.2, 0.32, 0.08, 0, 0.6, R + 0.03, TRIM), box(W - 0.2, 0.3, 0.08, 0, 0.6, -R - 0.03, TRIM));
  parts.push(box(0.36, 0.18, 0.05, 0.72, 0.95, R + 0.02, HEAD), box(0.36, 0.18, 0.05, -0.72, 0.95, R + 0.02, HEAD), box(0.2, 0.34, 0.05, 0.86, 1.05, -R - 0.02, TAIL), box(0.2, 0.34, 0.05, -0.86, 1.05, -R - 0.02, TAIL));
  parts.push(box(W - 0.4, 0.5, 0.04, 0, 2.1, -R - 0.02, GLASS), box(0.7, 0.1, 0.9, 0, 2.77, -0.6, '#d9d9d6'), box(0.5, 0.18, 0.04, 0, 2.55, R - 0.42, '#f2c200'));
  for (const x of [0.9, -0.9]) { parts.push(...wheel(x, R - 1.35, 0.42, 0.26), ...wheel(x, -R + 1.45, 0.42, 0.26), ...wheel(x * 0.82, -R + 1.45, 0.42, 0.22)); parts.push(box(0.05, 0.08, 0.2, x * (W / 2 + 0.05), 2.0, R - 0.35, TRIM)); }
  return finish(parts);
}

/** 18-seat high-roof commercial bus (the long intra-city passenger bus). Sliding door on the right (kerb) side. */
export function commercialBus() {
  const W = 1.98, L = 5.9;
  const body = [[-2.95, 0.42], [-2.95, 2.3], [-2.82, 2.47], [2.15, 2.47], [2.5, 2.2], [2.95, 1.32], [2.95, 0.42]];
  const glass = [[-2.8, 1.5], [-2.8, 2.24], [2.1, 2.26], [2.42, 2.04], [2.78, 1.5]];
  return finish([
    ...shell(body, glass, W, '#ffffff', 0.07),
    profile(glass, W + 0.04, GLASS, 0.02),
    box(W + 0.04, 0.2, L - 0.4, 0, 1.2, 0, '#1b1b1b'),                     // belt stripe
    box(0.03, 1.15, 1.0, -W / 2 - 0.02, 1.3, 0.85, TRIM),                    // sliding door outline (right side)
    box(W - 0.1, 0.3, 0.06, 0, 0.62, L / 2 + 0.02, TRIM),
    box(0.36, 0.14, 0.05, 0.68, 0.86, L / 2 + 0.02, HEAD), box(0.36, 0.14, 0.05, -0.68, 0.86, L / 2 + 0.02, HEAD),
    box(0.22, 0.26, 0.05, 0.8, 1.0, -L / 2 - 0.02, TAIL), box(0.22, 0.26, 0.05, -0.8, 1.0, -L / 2 - 0.02, TAIL),
    box(1.5, 0.12, 2.4, 0, 2.55, -0.6, '#3a3a3a'),                          // roof rack
    box(1.0, 0.32, 1.1, 0.1, 2.77, -0.9, '#6d4c2f'),
    ...wheel(0.88, 1.9, 0.36), ...wheel(-0.88, 1.9, 0.36), ...wheel(0.88, -1.85, 0.36), ...wheel(-0.88, -1.85, 0.36),
  ]);
}

/** Paint palettes: what you actually see on Onitsha roads. */
export const PAINTS = {
  executive: ['#0d0d0f', '#1a1c20', '#b8bcc2', '#e9e9e7', '#2b3440', '#5a1a1a', '#c7b48a'],
  sedan: ['#d9d9d6', '#a7aaae', '#1d1f22', '#f2f2ee', '#6c1d1d', '#203a5c', '#7d8a90', '#c9b38a', '#2e4a2e'],
  suv: ['#0b0b0c', '#f4f4f1', '#c9b48a', '#8f949a', '#2a2d33', '#4a3a2a'],
  lorry: ['#d6a419', '#1f5aa6', '#b3261e', '#e5e5e5', '#2c7a3b'],
  bus: ['#f2f2ec', '#e8e3d0', '#f4c430'],
  cbus: ['#e2b007', '#f2f2ec', '#e6dcc4', '#d9a404'],
};
