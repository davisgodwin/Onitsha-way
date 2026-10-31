import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hashString, mulberry32 } from '../core/utils.js';

/*
  v0.48: real bus stops. Every platform gets a built stop that suits its street, instead of a sign on a pole:
  - small (quiet streets): a raised concrete pad, a small steel-and-zinc shelter, one bench, the stop sign;
  - medium (busier roads): a longer pad and shelter, two benches, a bin, a route panel, a painted stopping bay;
  - large (the named stops: markets, Upper Iweka, Bridgehead, the mall, Fegge…): a big double shelter with three
    benches, a lit information board with the lines and where they go, queue rails, a light, a kiosk where there is
    room, and a long painted bay so minibuses and buses can pull in out of the traffic.
  Designs vary per stop (roof shape and colour, paint, wear) so no two streets look the same.
  Every sign plate shows "BUS STOP" and the stop's own name (one shared texture atlas).
  Built after the whole city, only where the ground is clear (falls back to a smaller design, then to the sign).
  All of it is merged into three meshes.
*/
const ROOFS = [['#2d6a4f', '#e9edc9'], ['#1d4e89', '#dbe7f3'], ['#9b2226', '#f1e3d3'], ['#b08900', '#fff3c4'], ['#5c6770', '#e5e5e5'], ['#7f5539', '#ede0d4']];
const col = (geo, hex) => { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const darken = (hex, k) => { const c = new THREE.Color(hex); c.multiplyScalar(k); return '#' + c.getHexString(); };

/** Which design a platform gets. Pure (unit-tested). */
export function stopTier(stop, road) {
  if (stop.named) return 'large';
  const t = road?.type ?? 'residential';
  if (['trunk', 'primary', 'secondary'].includes(t) || (road?.width ?? 0) >= 9) return 'medium';
  return 'small';
}
const SIZE = { large: { w: 8.4, d: 2.6, pad: [11, 3.4], bay: 22 }, medium: { w: 5.2, d: 2, pad: [7, 2.6], bay: 15 }, small: { w: 3.2, d: 1.5, pad: [4.2, 2], bay: 0 }, mini: { w: 2.2, d: 1.05, pad: [3, 1.5], bay: 0 } };

export function buildStopShelters(g) {
  const net = g.transport.net, world = g.world, col2 = world.collision, map = world.map;
  const frame = [], plates = [], boards = [];
  const nPlates = net.stops.reduce((a, s) => a + s.platforms.length, 0), per = 8, PW = 256, PH = 112, rows = Math.ceil(nPlates / per);
  const atlas = document.createElement('canvas'); atlas.width = per * PW; atlas.height = Math.max(PH, rows * PH); const ac = atlas.getContext('2d');
  let slot = 0; const stats = { large: 0, medium: 0, small: 0, mini: 0, signOnly: 0, kiosks: 0 };
  const plateUV = (geo, k) => { const cx = k % per, cy = Math.floor(k / per), u0 = cx * PW / atlas.width, u1 = (cx + 1) * PW / atlas.width, v1 = 1 - cy * PH / atlas.height, v0 = 1 - (cy + 1) * PH / atlas.height, uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0); return geo; };
  const lineNames = (stop) => [...stop.lines].map((l) => (typeof l === 'string' ? net.lines.find((q) => q.id === l) : l)).filter(Boolean);
  for (const stop of net.stops) {
    for (const p of stop.platforms) {
      const rng = mulberry32(hashString(`${stop.id}:${p.index}`)), road = p.road;
      const yaw = Math.atan2(p.dx, p.dz), rx = -p.dz, rz = p.dx; // (rx, rz): away from the road
      const ignore = new Set(p.oldCi ?? []);
      const free = (x, z, r) => { if (map.onCarriageway(x, z, 0.3) || world.terrain.isWater(x, z) || col2.insidePolygon(x, z)) return false; for (const ci of col2.circleGrid.get(col2._key(Math.floor(x / col2.cs), Math.floor(z / col2.cs))) ?? []) { if (ignore.has(ci)) continue; const c = col2.circles[ci]; if (Math.hypot(x - c.x, z - c.z) < c.r + r) return false; } for (const ei of col2._nearbyEdges(x - r, z - r, x + r, z + r)) { const e = col2.edge(ei), P = col2.polys[e.poly]; if (!P || P.minX === Infinity) continue; const dx = e.bx - e.ax, dz = e.bz - e.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - e.ax) * dx + (z - e.az) * dz) / L2)); if (Math.hypot(e.ax + dx * t - x, e.az + dz * t - z) < r) return false; } return true; };
      const at = (a, b) => ({ x: p.x + p.dx * a + rx * b, z: p.z + p.dz * a + rz * b }); // a along the kerb, b away from the road
      const box = (a, b, y, w, h, d, hex) => { const q = at(a, b), geo = new THREE.BoxGeometry(d, h, w); geo.rotateY(yaw); geo.translate(q.x, y, q.z); frame.push(col(geo, hex)); };
      const post = (a, b, h, r, hex, solid = true) => { const q = at(a, b), geo = new THREE.CylinderGeometry(r, r, h, 6); geo.translate(q.x, h / 2, q.z); frame.push(col(geo, hex)); if (solid) col2.addCircle(q.x, q.z, r + 0.03); };
      // pick the biggest design that fits behind the kerb
      let tier = stopTier(stop, road), Z = null, A0 = -2;
      const order = ['large', 'medium', 'small', 'mini'];
      search: for (const t of order.slice(order.indexOf(tier))) for (const off of [-2, -5, 1, -8, 4, -11]) {
        const S = SIZE[t], back = 0.5 + S.d; let ok = true;
        for (let a = -S.w / 2; a <= S.w / 2 + 0.01 && ok; a += Math.max(0.7, S.w / 6)) for (const b of [0.6, back / 2 + 0.3, back]) { const q = at(a + off, b); if (!free(q.x, q.z, 0.3)) { ok = false; break; } }
        if (ok) { tier = t; Z = S; A0 = off; break search; }
      }
      // the sign: a pole with a plate (both faces) showing BUS STOP and the stop's name
      const k = slot++, cx = (k % per) * PW, cy = Math.floor(k / per) * PH;
      ac.fillStyle = '#f2c200'; ac.fillRect(cx, cy, PW, PH); ac.strokeStyle = '#1b1b1b'; ac.lineWidth = 7; ac.strokeRect(cx + 5, cy + 5, PW - 10, PH - 10);
      ac.fillStyle = '#1b1b1b'; ac.textAlign = 'center'; ac.textBaseline = 'middle'; ac.font = '900 38px "Bricolage Grotesque", system-ui, sans-serif'; ac.fillText('BUS STOP', cx + PW / 2, cy + 38, PW - 24);
      ac.font = '700 19px "DM Sans", system-ui, sans-serif'; ac.fillText(String(stop.name ?? '').replace(/,.*$/, '').toUpperCase(), cx + PW / 2, cy + 80, PW - 22);
      const sp = Z ? at(Z.w / 2 + A0 + 0.6, 0.35) : { x: p.poleX, z: p.poleZ };
      { const geo = new THREE.CylinderGeometry(0.045, 0.045, 2.7, 8); geo.translate(sp.x, 1.35, sp.z); frame.push(col(geo, '#4b4f52')); }
      for (const side of [1, -1]) { const pl = new THREE.PlaneGeometry(0.86, 0.38); plateUV(pl, k); pl.translate(0, 0, 0.022); pl.rotateY(side > 0 ? Math.PI : 0); pl.rotateY(yaw); pl.translate(sp.x, 2.42, sp.z); plates.push(pl); }
      { const geo = new THREE.BoxGeometry(0.9, 0.42, 0.03); geo.rotateY(yaw); geo.translate(sp.x, 2.42, sp.z); frame.push(col(geo, '#2a2a2a')); }
      if (!Z) { stats.signOnly++; continue; }
      stats[tier]++;
      const [roofHex, paneHex] = ROOFS[Math.floor(rng() * ROOFS.length)], worn = rng() < (tier === 'small' ? 0.45 : 0.2), steel = worn ? '#6b5b4b' : '#5a5f63', roofC = worn ? darken(roofHex, 0.7) : roofHex, gable = rng() < 0.5;
      const S = Z, h = tier === 'large' ? 2.75 : 2.5;
      // raised concrete pad with a kerb edge
      box(A0, (0.5 + S.d) / 2, 0.08, S.pad[0], 0.16, S.pad[1], worn ? '#a39d92' : '#c9c4b8'); box(A0, 0.12, 0.17, S.pad[0], 0.04, 0.22, '#e8e3d6');
      // posts, back panel, roof
      const back = 0.5 + S.d - 0.15;
      for (let a = -S.w / 2; a <= S.w / 2 + 0.01; a += S.w / Math.max(1, Math.round(S.w / 2.6))) { post(A0 + a, back, h, 0.06, steel); if (!['small', 'mini'].includes(tier) || Math.abs(a) > S.w / 2 - 0.1) post(A0 + a, 0.75, h - 0.15, 0.05, steel); }
      box(A0, back + 0.02, 1.3, S.w, 1.7, 0.04, paneHex);
      if (gable) { for (const sgn of [-1, 1]) { const geo = new THREE.BoxGeometry(S.d / 2 + 0.5, 0.05, S.w + 0.5); geo.rotateZ(sgn * 0.22); const q = at(A0, (0.75 + back) / 2 + sgn * (S.d / 4 + 0.1)); geo.rotateY(yaw); geo.translate(q.x, h + 0.12, q.z); frame.push(col(geo, roofC)); } }
      else { const geo = new THREE.BoxGeometry(S.d + 1, 0.06, S.w + 0.4); geo.rotateZ(-0.08); const q = at(A0, (0.75 + back) / 2); geo.rotateY(yaw); geo.translate(q.x, h, q.z); frame.push(col(geo, roofC)); }
      // benches facing the road
      const nb = tier === 'large' ? 3 : tier === 'medium' ? 2 : 1, bw = Math.min(2.2, (S.w - 0.6) / nb - 0.3);
      for (let i = 0; i < nb; i++) { const a = A0 - S.w / 2 + (i + 0.5) * S.w / nb; box(a, back - 0.4, 0.45, bw, 0.07, 0.42, worn ? '#6f5a40' : '#8b6f4e'); for (const e of [-bw / 2 + 0.1, bw / 2 - 0.1]) box(a + e, back - 0.4, 0.22, 0.06, 0.44, 0.38, '#3a3a3a'); }
      if (!['small', 'mini'].includes(tier)) { const q = at(A0 + S.w / 2 + 0.5, 0.9); { const geo = new THREE.CylinderGeometry(0.22, 0.2, 0.75, 10); geo.translate(q.x, 0.38, q.z); frame.push(col(geo, '#2d6a4f')); col2.addCircle(q.x, q.z, 0.24); } }
      // route panel / information board with the lines that stop here
      if (!['small', 'mini'].includes(tier)) {
        const lines = lineNames(stop), c = document.createElement('canvas'); c.width = 384; c.height = tier === 'large' ? 384 : 192; const x = c.getContext('2d');
        x.fillStyle = '#10161c'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#f2c200'; x.font = '800 30px "Bricolage Grotesque", system-ui, sans-serif'; x.fillText(String(stop.name).replace(/,.*$/, '').toUpperCase(), 16, 40, c.width - 30);
        x.font = '600 21px "DM Sans", system-ui, sans-serif'; x.fillStyle = '#fff';
        (lines.length ? lines : [{ id: '', name: 'Keke and buses stop here' }]).slice(0, tier === 'large' ? 7 : 3).forEach((l, i) => x.fillText(`${l.id ? l.id + '  ' : ''}${l.name}`, 16, 80 + i * 38, c.width - 30));
        if (tier === 'large') { x.fillStyle = '#9aa3a8'; x.font = '600 17px "DM Sans", system-ui, sans-serif'; x.fillText('Wait here and choose where you are going.', 16, c.height - 18, c.width - 30); }
        const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
        const bwid = tier === 'large' ? 1.3 : 1.1, bh = tier === 'large' ? 1.3 : 0.55, q = at(A0 - S.w / 2 + 0.2, back - 0.06);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(bwid, bh), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.25 })); m.position.set(q.x - rx * 0.03, 1.55, q.z - rz * 0.03); m.rotation.y = Math.atan2(-rx, -rz); boards.push(m);
      }
      if (tier === 'large') {
        // queue rails along the kerb, a street light, and a kiosk where there is room
        for (let a = A0 - S.w / 2 + 1; a <= A0 + S.w / 2 - 1; a += 1.6) post(a, 0.35, 1, 0.03, '#9aa3a8', false);
        box(A0, 0.35, 0.98, S.w - 2, 0.05, 0.05, '#9aa3a8');
        post(A0 - S.w / 2 - 0.8, 0.5, 6, 0.08, '#6c757d'); box(A0 - S.w / 2 - 0.8, 0.9, 6, 0.3, 0.12, 0.9, '#d8d8d8');
        const kq = at(A0 + S.w / 2 + 2.2, 1.6);
        if (free(kq.x, kq.z, 1.5) && free(at(A0 + S.w / 2 + 2.2, 2.6).x, at(A0 + S.w / 2 + 2.2, 2.6).z, 1)) { box(A0 + S.w / 2 + 2.2, 1.6, 1.05, 2.2, 2.1, 1.8, '#f1efe8'); box(A0 + S.w / 2 + 2.2, 1.6, 2.2, 2.7, 0.1, 2.4, ['#c1121f', '#2b9348', '#1d4e89'][Math.floor(rng() * 3)]); col2.addCircle(kq.x, kq.z, 1.2); stats.kiosks++; }
      }
      // painted stopping bay on the road surface (yellow box along the kerb)
      if (S.bay) { const L = S.bay, w = 2.6, y = 0.035; for (const b of [-0.6, -0.6 - w]) box(A0 - L / 2 + 4, b, y, L, 0.012, 0.16, '#f2c200'); for (const a of [A0 - L + 4, A0 + 4]) box(a, -0.6 - w / 2, y, 0.16, 0.012, w, '#f2c200'); for (let a = A0 - L + 6; a < A0 + 3; a += 3) box(a, -0.6 - w / 2, y, 1.2, 0.012, 0.12, '#f2c200'); }
      p.shelter = { tier, x: at(A0, (0.5 + S.d) / 2).x, z: at(A0, (0.5 + S.d) / 2).z };
    }
  }
  const group = new THREE.Group(); group.name = 'BusStops';
  if (frame.length) { const m = new THREE.Mesh(mergeGeometries(frame, false), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.25 })); m.castShadow = true; m.receiveShadow = true; m.name = 'stop-structures'; group.add(m); }
  if (plates.length) { const tex = new THREE.CanvasTexture(atlas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4; const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0 }); group.add(new THREE.Mesh(mergeGeometries(plates.map((q) => q.toNonIndexed()), false), mat)); group.userData.nightMaterials = [{ mat, max: 0.35 }]; }
  for (const b of boards) group.add(b);
  group.userData.stats = { platforms: nPlates, ...stats };
  return group;
}
