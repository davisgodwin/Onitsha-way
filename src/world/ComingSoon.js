import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { placeBeyond } from './PlayArea.js';

/*
  v0.48: what a player sees where Onitsha ends.
  - On the Niger Bridge at mid-river: a closed red-and-white barrier with a gantry, "ASABA · COMING SOON".
  - Where a main road leaves the map: a roadside board, "TOWARDS NKPOR · COMING SOON" (named from the direction).
  Merged into a few meshes; the boards use canvas textures.
*/
function signTex(top, bottom, { bg = '#14365c', fg = '#ffffff', band = '#f2c200' } = {}) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 384; const g = c.getContext('2d'); g.scale(2, 2);
  g.fillStyle = bg; g.fillRect(0, 0, 512, 192); g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(8, 8, 496, 176);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '800 50px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText(top, 256, bottom ? 52 : 66, 470);
  g.fillStyle = band; g.fillRect(40, 122, 432, 50); g.fillStyle = '#1b1b1b'; g.font = '900 38px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText('COMING SOON', 256, 148, 420);
  if (bottom) { g.fillStyle = fg; g.font = '600 21px "DM Sans", system-ui, sans-serif'; g.fillText(bottom, 256, 98, 470); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const col = (geo, hex) => { const g = geo.toNonIndexed(), c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };

export function buildComingSoon(world) {
  const map = world.map, pa = world.playArea, group = new THREE.Group(); group.name = 'ComingSoon';
  const frame = [], boards = [];
  const put = (geo, x, y, z, yaw) => { geo.rotateY(yaw); geo.translate(x, y, z); return geo; };
  // 1) the barrier on the bridge deck where the boundary crosses it
  const barriers = [];
  for (const r of map.roads) {
    if (!r.elevated || !r.overWater) continue;
    const P = r.points; let s = 0;
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az);
      const la = pa.locked(ax, az), lb = pa.locked(bx, bz);
      if (la !== lb) {
        let lo = 0, hi = 1; for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; (pa.locked(ax + (bx - ax) * m, az + (bz - az) * m) === la ? (lo = m) : (hi = m)); }
        const t = lo, x = ax + (bx - ax) * t, z = az + (bz - az) * t, dx = (bx - ax) / L, dz = (bz - az) / L;
        // the barrier stands a few metres on the Onitsha side, facing Onitsha
        const toOn = la ? 1 : -1, bx2 = x + dx * toOn * 4, bz2 = z + dz * toOn * 4, y = r.heightAt ? r.heightAt(s + L * t + toOn * 4) : 12;
        barriers.push({ x: bx2, z: bz2, y, yaw: Math.atan2(dx * toOn, dz * toOn), w: r.width ?? 12, road: r });
      }
      s += L;
    }
  }
  for (const b of barriers) {
    const w = Math.max(8, b.w), half = w / 2;
    // two posts, a striped boom, the gantry and the board above the carriageway (the board faces Onitsha)
    for (const side of [-1, 1]) {
      const ox = Math.cos(b.yaw) * side * half, oz = -Math.sin(b.yaw) * side * half;
      frame.push(col(put(new THREE.BoxGeometry(0.35, 6.4, 0.35), b.x + ox, b.y + 3.2, b.z + oz, b.yaw), '#d8d8d8'));
      frame.push(col(put(new THREE.BoxGeometry(0.6, 1.1, 0.6), b.x + ox, b.y + 0.55, b.z + oz, b.yaw), '#c1121f'));
    }
    for (let k = 0; k < 8; k++) { const sx = -half + (k + 0.5) * w / 8; frame.push(col(put(new THREE.BoxGeometry(w / 8, 0.22, 0.14).translate(sx, 0, 0), b.x, b.y + 1.05, b.z, b.yaw), k % 2 ? '#ffffff' : '#c1121f')); }
    frame.push(col(put(new THREE.BoxGeometry(w + 0.6, 0.4, 0.4), b.x, b.y + 6.3, b.z, b.yaw), '#9aa0a6'));
    // jersey barriers across the lanes
    for (let k = 0; k < Math.floor(w / 2.2); k++) { const sx = -half + 1.1 + k * 2.2; frame.push(col(put(new THREE.BoxGeometry(2, 0.8, 0.6).translate(sx, 0, 0), b.x - Math.sin(b.yaw) * 1.6, b.y + 0.4, b.z - Math.cos(b.yaw) * 1.6, b.yaw), k % 2 ? '#e8e8e8' : '#d14b3a')); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w, 10), 3.6), new THREE.MeshStandardMaterial({ map: signTex('ASABA', 'DELTA STATE · ACROSS THE NIGER'), roughness: 0.5, side: THREE.DoubleSide }));
    m.position.set(b.x, b.y + 4.4, b.z); m.rotation.y = b.yaw; m.name = 'asaba-coming-soon'; boards.push(m);
  }
  // 2) v0.49: a big gantry across every road that leaves Onitsha (the LGA lines or the map edge), visible from far
  //    off, with a roadblock under it; and tall COMING SOON billboards along the boundary between the roads
  const bnd = map.fullBounds ?? map.bounds, edges = [], SKIP = new Set(['footway', 'path', 'steps', 'pedestrian', 'construction', 'proposed', 'cycleway']);
  const MAJOR = new Set(['trunk', 'primary', 'secondary', 'tertiary', 'trunk_link', 'primary_link']);
  const addEdge = (x, z, dx, dz, r) => {
    const near = Math.min(x - bnd.minX, bnd.maxX - x, z - bnd.minZ, bnd.maxZ - z);
    const beyond = pa.lockedAt(x + dx * 40, z + dz * 40) ?? (near < 40 ? { id: 'edge' } : null); if (!beyond || beyond.id === 'asaba') return;
    if (edges.some((e) => Math.hypot(e.x - x, e.z - z) < (MAJOR.has(r.type) ? 90 : 160))) return;
    const to = (beyond.id !== 'outside' && beyond.id !== 'edge' ? beyond : null) ?? placeBeyond(map.meta, x, z, dx, dz) ?? { id: 'outside', name: 'Beyond Onitsha', state: 'Anambra State' };
    edges.push({ x, z, dx, dz, to, road: r.displayName ?? r.name ?? '', w: Math.max(6, r.width ?? 6), major: MAJOR.has(r.type) });
  };
  for (const r of map.roads) {
    if (r.elevated || SKIP.has(r.type)) continue;
    const P = r.points;
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 0.5) continue;
      const n = Math.max(1, Math.ceil(L / 10)); let prev = pa.locked(ax, az);
      for (let k = 1; k <= n; k++) {
        const t = k / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, now = pa.locked(x, z);
        if (now !== prev) { const dir = now ? 1 : -1, dx = (bx - ax) / L * dir, dz = (bz - az) / L * dir; // heading out of Onitsha
          let lo = 0, hi = 1, x0 = ax + (bx - ax) * (k - 1) / n, z0 = az + (bz - az) * (k - 1) / n; for (let q = 0; q < 16; q++) { const m = (lo + hi) / 2, mx = x0 + (x - x0) * m, mz = z0 + (z - z0) * m; (pa.locked(mx, mz) === prev ? (lo = m) : (hi = m)); }
          const cx = x0 + (x - x0) * lo, cz = z0 + (z - z0) * lo; addEdge(cx - dx * 14, cz - dz * 14, dx, dz, r); }
        prev = now;
      }
    }
    // a road that simply ends at the edge of the map
    for (const [i, j] of [[0, 1], [P.length - 1, P.length - 2]]) {
      const [x, z] = P[i], [px, pz] = P[j] ?? P[i], L = Math.hypot(x - px, z - pz) || 1, dx = (x - px) / L, dz = (z - pz) / L;
      const near = Math.min(x - bnd.minX, bnd.maxX - x, z - bnd.minZ, bnd.maxZ - z);
      if (near <= 30 && !pa.locked(x, z)) addEdge(x - dx * 14, z - dz * 14, dx, dz, r);
    }
  }
  const texByName = new Map(), tex = (name, sub) => { if (!texByName.has(name)) texByName.set(name, signTex(name, sub)); return texByName.get(name); };
  for (const e of edges) {
    const yaw = Math.atan2(-e.dx, -e.dz), w = e.w + 3, half = w / 2, H = e.major ? 8 : 6.5, bw = Math.max(9, Math.min(16, w + 2)), bh = bw * 0.375;
    for (const side of [-1, 1]) { const ox = Math.cos(yaw) * side * half, oz = -Math.sin(yaw) * side * half;
      frame.push(col(put(new THREE.BoxGeometry(0.5, H + bh, 0.5), e.x + ox, (H + bh) / 2, e.z + oz, yaw), '#5f6b75'));
      frame.push(col(put(new THREE.BoxGeometry(1, 0.6, 1), e.x + ox, 0.3, e.z + oz, yaw), '#3d454c'));
      world.collision.addCircle(e.x + ox, e.z + oz, 0.45); }
    frame.push(col(put(new THREE.BoxGeometry(w + 0.8, 0.45, 0.5), e.x, H - 0.3, e.z, yaw), '#5f6b75'));
    // the roadblock: red-and-white boom and drums across the road
    for (let k = 0; k < 8; k++) { const sx = -half + (k + 0.5) * w / 8; frame.push(col(put(new THREE.BoxGeometry(w / 8, 0.25, 0.16).translate(sx, 0, 0), e.x + e.dx * 3, 1.05, e.z + e.dz * 3, yaw), k % 2 ? '#ffffff' : '#c1121f')); }
    for (let k = 0; k <= Math.floor(w / 2.4); k++) { const sx = -half + 0.6 + k * 2.4; if (sx > half) break; frame.push(col(put(new THREE.CylinderGeometry(0.32, 0.32, 0.95, 10).translate(sx, 0, 0), e.x + e.dx * 4.5, 0.48, e.z + e.dz * 4.5, yaw), k % 2 ? '#f2f2f2' : '#e8590c')); }
    const name = e.to.onitsha ? e.to.name.toUpperCase() : `TOWARDS ${e.to.name.toUpperCase()}`;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), new THREE.MeshStandardMaterial({ map: tex(name, e.to.onitsha ? 'ONITSHA · NOT IN THE MAP YET' : (e.to.state ?? '').toUpperCase() + ' · ONLY ONITSHA IS OPEN'), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.5, side: THREE.DoubleSide }));
    m.material.emissiveMap = m.material.map; m.position.set(e.x, H + bh / 2 - 0.1, e.z); m.rotation.y = yaw; m.name = 'edge-coming-soon'; boards.push(m); e.board = { x: e.x, z: e.z, yaw };
  }
  // tall billboards along the boundary, every ~700 m, on open ground inside Onitsha, facing in
  const bill = [];
  for (const P of pa.polygons ?? []) for (let i = 0; i < P.length; i++) {
    const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
    for (let s = 0; s < L; s += 50) {
      const x0 = ax + (bx - ax) * s / L, z0 = az + (bz - az) * s / L; if (bill.some((q) => Math.hypot(q.x - x0, q.z - z0) < 700) || edges.some((q) => Math.hypot(q.x - x0, q.z - z0) < 250)) continue;
      // step inward to open land
      let spot = null; for (const d of [25, 40, 60]) for (const sg of [1, -1]) { const nx = -(bz - az) / L * sg, nz = (bx - ax) / L * sg, x = x0 + nx * d, z = z0 + nz * d; if (spot || pa.locked(x, z) || !pa.locked(x - nx * (d + 30), z - nz * (d + 30))) continue; if (world.collision.isFree(x, z, 4) && !map.onCarriageway(x, z, 6) && !world.terrain?.isWater?.(x, z)) spot = { x, z, nx, nz }; }
      if (spot) bill.push(spot);
    }
  }
  for (const b of bill) {
    const yaw = Math.atan2(b.nx, b.nz), to = pa.nearestOutside(b.x - b.nx * 200, b.z - b.nz * 200), name = to.id === 'outside' ? 'BEYOND ONITSHA' : to.name.toUpperCase();
    for (const side of [-3.5, 3.5]) { const ox = Math.cos(yaw) * side, oz = -Math.sin(yaw) * side; frame.push(col(put(new THREE.BoxGeometry(0.45, 12, 0.45), b.x + ox, 6, b.z + oz, yaw), '#5f6b75')); world.collision.addCircle(b.x + ox, b.z + oz, 0.4); }
    const m = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.9), new THREE.MeshStandardMaterial({ map: tex(name, 'ONITSHA ENDS HERE'), emissive: '#ffffff', emissiveIntensity: 0.25, roughness: 0.5, side: THREE.DoubleSide }));
    m.material.emissiveMap = m.material.map; m.position.set(b.x, 9.6, b.z); m.rotation.y = yaw; m.name = 'boundary-coming-soon'; boards.push(m);
  }
  if (frame.length) { const mesh = new THREE.Mesh(mergeGeometries(frame), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.2 })); mesh.name = 'coming-soon-frames'; group.add(mesh); }
  for (const m of boards) group.add(m);
  return { group, barriers: barriers.map(({ x, z, y, yaw }) => ({ x, z, y, yaw })), edges: edges.map((e) => ({ x: e.x, z: e.z, to: e.to.id, name: e.to.name, road: e.road, board: e.board })), billboards: bill.length };
}
