import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/utils.js';

/*
  v0.48: the street-level differences between neighbourhoods (Districts.js), visible at driving speed:
  - middle-income streets: shade trees (mango, neem, umbrella trees) along the verges;
  - the dense old districts: open concrete drains along the edges of the side streets, no verge trees;
  - main roads through ordinary areas: painted black-and-white kerbs;
  - GRA: palms and lawns along both verges, tall lamp posts, and good cars parked in front of the houses.
  The markets keep their own dressing. Placed after the whole city, only on clear verges (no road, door, stop,
  wall or water), so nothing that already exists moves. Instanced or merged: a handful of draw calls in all.
*/
export function buildDistrictDressing(g) {
  const w = g.world, map = w.map, D = w.districts, col = w.collision, rng = mulberry32(4848);
  const doors = []; for (const it of g.interactions.items) { try { if (Number.isFinite(it.x) && Number.isFinite(it.z)) doors.push([it.x, it.z]); } catch { /* an item that moves */ } }
  const dgrid = new Map(); for (const [x, z] of doors) { const k = Math.floor(x / 20) + ',' + Math.floor(z / 20); if (!dgrid.has(k)) dgrid.set(k, []); dgrid.get(k).push([x, z]); }
  const nearDoor = (x, z, r) => { const gx = Math.floor(x / 20), gz = Math.floor(z / 20); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const [a, b] of dgrid.get((gx + i) + ',' + (gz + j)) ?? []) if (Math.hypot(a - x, b - z) < r) return true; return false; };
  const verge = (x, z, r) => !map.onCarriageway(x, z, r + 0.2) && col.isFree(x, z, r) && !w.terrain.isWater(x, z) && !map.inHomeAccess?.(x, z, 1.2) && !nearDoor(x, z, 3) && !w.playArea?.locked(x, z);
  const trees = [], palms = [], drains = [], kerbs = [], lawns = [], lamps = [], cars = [];
  const stats = { middle: 0, dense: 0, mixed: 0, gra: 0, market: 0 };
  for (const s of map.segments) {
    const r = s.road; if (r.elevated || r.noTraffic || ['footway', 'path', 'steps', 'pedestrian', 'track', 'construction'].includes(r.type)) continue;
    const dx = s.bx - s.ax, dz = s.bz - s.az, L = Math.hypot(dx, dz); if (L < 6) continue;
    const ux = dx / L, uz = dz / L, nx = -uz, nz = ux, mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, kind = D.at(mx, mz, r); stats[kind] = (stats[kind] ?? 0) + 1;
    const along = (t, side, off) => [s.ax + ux * t + nx * side * off, s.az + uz * t + nz * side * off];
    if (kind === 'middle' || kind === 'gra') {
      const step = kind === 'gra' ? 13 : 21, off = r.width / 2 + (kind === 'gra' ? 2.4 : 2.7);
      for (let t = step / 2 + (rng() * 4); t < L - 2; t += step) for (const side of [-1, 1]) {
        if (kind === 'middle' && rng() > 0.4) continue;
        const [x, z] = along(t, side, off); if (!verge(x, z, kind === 'gra' ? 0.9 : 1.6)) continue;
        if (kind === 'gra') { palms.push({ x, z, s: 0.9 + rng() * 0.3, r: rng() }); col.addCircle(x, z, 0.25); if (rng() < 0.4) { lamps.push({ x: x + ux * step / 2, z: z + uz * step / 2, yaw: Math.atan2(-nx * side, -nz * side) }); } }
        else { trees.push({ x, z, s: 0.7 + rng() * 0.45, r: rng() }); col.addCircle(x, z, 0.3); }
      }
      if (kind === 'gra') for (const side of [-1, 1]) { const [x, z] = along(L / 2, side, r.width / 2 + 3.1); if (verge(x, z, 0.4)) lawns.push({ x, z, len: L - 1, yaw: Math.atan2(ux, uz) }); }
    }
    if (kind === 'dense' && ['residential', 'unclassified', 'living_street', 'service', 'tertiary'].includes(r.type)) for (const side of [-1, 1]) { const [x, z] = along(L / 2, side, r.width / 2 + 0.45); if (!map.onCarriageway(x, z, 0.1)) drains.push({ x, z, len: L, yaw: Math.atan2(ux, uz) }); }
    if (kind === 'mixed') for (const side of [-1, 1]) { const [x, z] = along(L / 2, side, r.width / 2 + 0.15); kerbs.push({ x, z, len: L, yaw: Math.atan2(ux, uz) }); }
  }
  // GRA: good cars parked in front of the houses (premium and everyday mix)
  if (D.premium.length) {
    const prem = (g.vehicles?.spots ?? []).filter((sp) => sp.lot === 'lot-premium').map((sp) => sp.model), every = ['toyota_camry', 'lexus_rx350', 'toyota_highlander', 'honda_accord', 'toyota_sienna'];
    for (const b of map.buildings) {
      if (b.layoutHidden || b.front < 0 || !b.pts?.length) continue; const cx = b.pts.reduce((a, q) => a + q[0], 0) / b.pts.length, cz = b.pts.reduce((a, q) => a + q[1], 0) / b.pts.length; if (D.premiumAt(cx, cz) < 0.8) continue;
      const [ax, az] = b.pts[b.front], [bx, bz] = b.pts[(b.front + 1) % b.pts.length], L = Math.hypot(bx - ax, bz - az); if (L < 6) continue;
      let ex = (bz - az) / L, ez = -(bx - ax) / L; const fx = (ax + bx) / 2, fz = (az + bz) / 2; if (Math.hypot(fx + ex - cx, fz + ez - cz) < Math.hypot(fx - cx, fz - cz)) { ex = -ex; ez = -ez; }
      const x = fx + ex * 3.6, z = fz + ez * 3.6; if (rng() > 0.55 || !verge(x, z, 2.2)) continue;
      const model = rng() < 0.55 && prem.length ? prem[Math.floor(rng() * prem.length)] : every[Math.floor(rng() * every.length)];
      cars.push({ x, z, yaw: Math.atan2(ex, ez) + (rng() < 0.5 ? 0 : Math.PI), model, paint: ['#0e0f12', '#f2f2f0', '#9aa1a6', '#1f2a44', '#5a1d22'][Math.floor(rng() * 5)] });
      col.addCircle(x + ex * 1.2, z + ez * 1.2, 1.1); col.addCircle(x - ex * 1.2, z - ez * 1.2, 1.1);
    }
  }
  // ------------------------------------------------------------------ meshes
  const group = new THREE.Group(); group.name = 'DistrictDressing';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color();
  // everything is grouped per 400 m cell (trees and palms instanced), so only the cells near you are drawn (update() below)
  const cells = new Map(), cellOf = (x, z) => Math.floor(x / 400) + ',' + Math.floor(z / 400);
  const cellList = (list) => { const m = new Map(); for (const t of list) { const k = cellOf(t.x, t.z); if (!m.has(k)) m.set(k, []); m.get(k).push(t); } return m; };
  const cellAt = (k) => { if (!cells.has(k)) { const [cx, cz] = k.split(',').map(Number); cells.set(k, { x: (cx + 0.5) * 400, z: (cz + 0.5) * 400, meshes: [], lazy: [], built: [] }); } return cells.get(k); };
  const addCell = (k, mesh) => { cellAt(k).meshes.push(mesh); };
  // v0.54.4: drains, kerbs, lawns and lamp posts are made only for the cells near you (made again if you come back)
  const lazy = (k, make) => { cellAt(k).lazy.push(make); };
  if (trees.length) {
    const trunk = new THREE.CylinderGeometry(0.14, 0.22, 2.4, 6); trunk.translate(0, 1.2, 0);
    const crown = new THREE.IcosahedronGeometry(2.6, 0); const cp = crown.attributes.position, tr = mulberry32(48); for (let i = 0; i < cp.count; i++) { const k = 0.82 + tr() * 0.32; cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k * 0.66, cp.getZ(i) * k); } crown.computeVertexNormals(); crown.translate(0, 3.7, 0);
    const tm = new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 1 }), cm = new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true });
    for (const [k, list] of cellList(trees)) {
      const a = new THREE.InstancedMesh(trunk, tm, list.length), b = new THREE.InstancedMesh(crown, cm, list.length);
      list.forEach((t, i) => { q.setFromAxisAngle(up, t.r * 6.28); m4.compose(P.set(t.x, 0, t.z), q, S.set(t.s, t.s, t.s)); a.setMatrixAt(i, m4); b.setMatrixAt(i, m4); b.setColorAt(i, C.setHSL(0.25 + t.r * 0.08, 0.42, 0.2 + t.r * 0.09)); });
      a.computeBoundingSphere(); b.computeBoundingSphere(); a.castShadow = b.castShadow = true; a.name = 'district-trees'; group.add(a, b); addCell(k, a); addCell(k, b);
    }
  }
  if (palms.length) {
    const trunk = new THREE.CylinderGeometry(0.13, 0.2, 6.5, 7); trunk.translate(0, 3.25, 0);
    const fronds = []; for (let k = 0; k < 7; k++) { const f = new THREE.BoxGeometry(0.42, 0.04, 2.6); f.translate(0, 0, 1.25); f.rotateX(0.38); f.rotateY(k / 7 * Math.PI * 2); f.translate(0, 6.5, 0); fronds.push(f); }
    const crown = mergeGeometries(fronds.map((f) => f.toNonIndexed()));
    const pm = new THREE.MeshStandardMaterial({ color: '#8a7559', roughness: 1 }), fm = new THREE.MeshStandardMaterial({ color: '#3f7a3a', roughness: 0.9, side: THREE.DoubleSide });
    for (const [k, list] of cellList(palms)) {
      const a = new THREE.InstancedMesh(trunk, pm, list.length), b = new THREE.InstancedMesh(crown, fm, list.length);
      list.forEach((t, i) => { q.setFromAxisAngle(up, t.r * 6.28); m4.compose(P.set(t.x, 0, t.z), q, S.set(t.s, t.s, t.s)); a.setMatrixAt(i, m4); b.setMatrixAt(i, m4); });
      a.computeBoundingSphere(); b.computeBoundingSphere(); a.castShadow = b.castShadow = true; a.name = 'gra-palms'; group.add(a, b); addCell(k, a); addCell(k, b);
    }
  }
  // strips along the road edge, cut into short pieces; a piece that would lie on another road (junctions) is left out
  const strips = (list, width, y, hex, name, { piece = 2.5, alt = null, h = 0.02 } = {}) => {
    if (!list.length) return; const c1 = new THREE.Color(hex), c2 = alt ? new THREE.Color(alt) : c1;
    for (const [ck, cl] of cellList(list)) lazy(ck, () => { const parts = [];
    for (const d of cl) {
      const n = Math.max(1, Math.floor(d.len / piece)), len = d.len / n, ux = Math.sin(d.yaw), uz = Math.cos(d.yaw);
      for (let i = 0; i < n; i++) {
        const off = -d.len / 2 + (i + 0.5) * len, cx = d.x + ux * off, cz = d.z + uz * off;
        if (map.onCarriageway(cx, cz, width / 2) || col.insidePolygon(cx, cz)) continue;
        const gg = new THREE.PlaneGeometry(width, len * (alt ? 0.98 : 1.02)).rotateX(-Math.PI / 2).toNonIndexed(), cc = alt && i % 2 ? c2 : c1, a = new Float32Array(gg.attributes.position.count * 3);
        for (let k = 0; k < a.length; k += 3) cc.toArray(a, k); gg.setAttribute('color', new THREE.BufferAttribute(a, 3)); gg.deleteAttribute('uv'); gg.translate(0, y, 0); gg.rotateY(d.yaw); gg.translate(cx, 0, cz); parts.push(gg);
      }
    }
    if (!parts.length) return null; const m = new THREE.Mesh(mergeGeometries(parts), mat(name)); m.name = name; m.receiveShadow = true; for (const p of parts) p.dispose(); return m; });
  };
  const mats = new Map(), mat = (name) => { if (!mats.has(name)) mats.set(name, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })); return mats.get(name); };
  strips(drains, 0.6, 0.02, '#2c2a26', 'drains', { piece: 4 });
  strips(kerbs, 0.18, 0.197, '#f2f2ee', 'kerbs', { piece: 1.2, alt: '#1b1b1b' }); // on top of the kerb (0.19 m)
  strips(lawns, 1.6, 0.035, '#5d8f3a', 'gra-lawns', { piece: 4 });
  if (lamps.length) { const lm = new THREE.MeshStandardMaterial({ color: '#3a3f44', roughness: 0.6, metalness: 0.4 }); for (const [ck, cl] of cellList(lamps)) { for (const l of cl) col.addCircle(l.x, l.z, 0.12); lazy(ck, () => { const parts = []; for (const l of cl) { const pole = new THREE.CylinderGeometry(0.07, 0.09, 7, 8); pole.translate(l.x, 3.5, l.z); parts.push(pole.toNonIndexed()); const head = new THREE.BoxGeometry(0.35, 0.14, 1.1); head.translate(0, 0, 0.45); head.rotateY(l.yaw); head.translate(l.x, 7, l.z); parts.push(head.toNonIndexed()); } for (const p of parts) p.deleteAttribute('uv'); const m = new THREE.Mesh(mergeGeometries(parts), lm); m.name = 'gra-lamps'; return m; }); } }
  if (cars.length) {
    const byModel = new Map(), cm2 = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.35 }); for (const c of cars) { const key = c.model + '|' + cellOf(c.x, c.z); if (!byModel.has(key)) byModel.set(key, []); byModel.get(key).push(c); }
    for (const [key, list] of byModel) { const [model, ck] = key.split('|'), T = g.traffic?.typeInfo(model); if (!T) continue; const geo = T.geo(); const im = new THREE.InstancedMesh(geo, cm2, list.length); list.forEach((c, i) => { q.setFromAxisAngle(up, c.yaw); m4.compose(P.set(c.x, 0, c.z), q, S.set(1, 1, 1)); im.setMatrixAt(i, m4); im.setColorAt(i, C.set(c.paint)); }); im.castShadow = true; im.name = 'gra-cars'; im.computeBoundingSphere(); group.add(im); addCell(ck, im); }
  }
  let lazyLeft = 0; for (const c of cells.values()) lazyLeft += c.lazy.length;
  group.userData.update = (f, range = 650) => { let made = 0;
    for (const c of cells.values()) { const d = Math.hypot(c.x - f.x, c.z - f.z), v = d < range; for (const m of c.meshes) m.visible = v;
      if (v && c.lazy.length && !c.built.length && made < 1) { made++; for (const make of c.lazy) { const m = make(); if (m) { group.add(m); c.built.push(m); } } }
      else if (!v && c.built.length && d > range + 300) { for (const m of c.built) { group.remove(m); m.geometry.dispose(); } c.built = []; } }
  };
  group.userData.buildAll = () => { for (const c of cells.values()) if (c.lazy.length && !c.built.length) for (const make of c.lazy) { const m = make(); if (m) { group.add(m); c.built.push(m); } } };
  group.userData.stats = { ...stats, trees: trees.length, palms: palms.length, drains: drains.length, kerbs: kerbs.length, lawns: lawns.length, lamps: lamps.length, cars: cars.length };
  return group;
}
