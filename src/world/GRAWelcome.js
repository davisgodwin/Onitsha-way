import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
  v0.50: big "WELCOME TO GRA" gateways where the main roads enter each GRA (the premium areas named in the map data).
  An arch over the road on two cream-and-gold pillars, a green board on both faces, lit a little at night, plus lamps on
  the pillar tops. Up to three per GRA, on the biggest roads that cross into it; a pillar is only placed on free land.
*/
const RANK = { trunk: 6, primary: 5, secondary: 4, tertiary: 3, unclassified: 2, residential: 2, trunk_link: 4, primary_link: 4, secondary_link: 3, tertiary_link: 2 };
function boardTex(name) {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 320; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 320); gr.addColorStop(0, '#0f5b35'); gr.addColorStop(1, '#0a4127'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 320);
  g.strokeStyle = '#d4af37'; g.lineWidth = 10; g.strokeRect(10, 10, 1004, 300); g.lineWidth = 3; g.strokeRect(24, 24, 976, 272);
  g.fillStyle = '#f5e7b8'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '700 40px "DM Sans", system-ui, sans-serif'; g.fillText('WELCOME TO', 512, 70);
  g.fillStyle = '#ffffff'; g.font = '900 104px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText(name.toUpperCase(), 512, 160, 940);
  g.fillStyle = '#d4af37'; g.fillRect(250, 222, 524, 4); g.fillStyle = '#f5e7b8'; g.font = '600 32px "DM Sans", system-ui, sans-serif'; g.fillText('ONITSHA · ANAMBRA STATE', 512, 262, 900);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const col = (geo, hex) => { const g = geo.toNonIndexed(), c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv'); return g; };

/** Pure: where each gateway goes. `inside(x,z)` says whether a point is in that GRA. */
export function findGateways(roads, area, inside, { perArea = 3, spacing = 260 } = {}) {
  const found = [];
  for (const r of roads) {
    const rank = RANK[r.type] ?? 0; if (!rank || r.elevated) continue;
    const P = r.points;
    for (let i = 0; i + 1 < P.length; i++) {
      const [ax, az] = P[i], [bx, bz] = P[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1) continue;
      const a = inside(ax, az), b = inside(bx, bz); if (a === b) continue;
      let lo = 0, hi = 1; for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; (inside(ax + (bx - ax) * m, az + (bz - az) * m) === a ? (lo = m) : (hi = m)); }
      const dir = b ? 1 : -1, dx = (bx - ax) / L * dir, dz = (bz - az) / L * dir; // pointing into GRA
      const x = ax + (bx - ax) * lo + dx * 12, z = az + (bz - az) * lo + dz * 12; // a few metres inside
      found.push({ x, z, dx, dz, rank, w: Math.max(6, r.width ?? 7), road: r.displayName ?? r.name ?? '', area: area.name });
    }
  }
  found.sort((p, q) => q.rank - p.rank || q.w - p.w);
  const out = []; for (const f of found) { if (out.length >= perArea) break; if (out.some((o) => Math.hypot(o.x - f.x, o.z - f.z) < spacing)) continue; out.push(f); }
  return out;
}

export function buildGRAWelcome(world) {
  const D = world.districts, group = new THREE.Group(); group.name = 'GRAWelcome'; const frame = [], boards = [], lamps = [], gates = [];
  if (!D?.premium?.length) return { group, gates };
  const put = (geo, x, y, z, yaw) => { geo.rotateY(yaw); geo.translate(x, y, z); return geo; };
  const named = (a) => /phase\s*(ii|2)\b/i.test(a.name) ? 'GRA Phase II' : /phase\s*(i|1)\b/i.test(a.name) ? 'GRA Phase I' : a.name.replace(/\s*\(.*\)/, '');
  const texs = new Map(), boardMat = (name) => { if (!texs.has(name)) { const t = boardTex(name); texs.set(name, new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.3, roughness: 0.5 })); } return texs.get(name); };
  for (const area of D.premium) {
    if (area.preview) continue;
    const inside = (x, z) => { if (area.pts) { let c = false; const pts = area.pts; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c; } return c; } return Math.hypot(x - area.x, z - area.z) < area.r - 60; };
    const name = named(area);
    for (const s of findGateways(world.map.roads, area, inside)) {
      if (gates.some((o) => Math.hypot(o.x - s.x, o.z - s.z) < 200)) continue;
      const yaw = Math.atan2(s.dx, s.dz), half = s.w / 2 + 2.4, H = 7.5, bw = Math.max(11, Math.min(20, s.w + 6)), bh = bw * 0.3125;
      const px = Math.cos(yaw), pz = -Math.sin(yaw);
      // keep pillars off buildings; if a side is blocked, push it out a little, else skip this road
      let ok = true; for (const side of [-1, 1]) { const x = s.x + px * side * half, z = s.z + pz * side * half; if (!world.collision.isFree(x, z, 1.1) || world.map.onCarriageway?.(x, z, 0.8)) ok = false; }
      if (!ok) continue;
      for (const side of [-1, 1]) {
        const x = s.x + px * side * half, z = s.z + pz * side * half;
        frame.push(col(put(new THREE.BoxGeometry(1.6, 0.8, 1.6), x, 0.4, z, yaw), '#8a7f6a'));
        frame.push(col(put(new THREE.BoxGeometry(1.2, H + bh + 0.6, 1.2), x, (H + bh + 0.6) / 2, z, yaw), '#efe6cf'));
        for (const y of [1.2, 3, H + bh + 0.3]) frame.push(col(put(new THREE.BoxGeometry(1.32, 0.18, 1.32), x, y, z, yaw), '#d4af37'));
        frame.push(col(put(new THREE.ConeGeometry(0.8, 1.1, 4), x, H + bh + 1.15, z, yaw + Math.PI / 4), '#d4af37'));
        lamps.push(put(new THREE.SphereGeometry(0.28, 10, 8), x, H + bh + 2, z, 0));
        world.collision.addCircle(x, z, 0.85);
      }
      frame.push(col(put(new THREE.BoxGeometry(half * 2 + 1.2, 0.5, 0.8), s.x, H - 0.25, s.z, yaw), '#efe6cf'));
      frame.push(col(put(new THREE.BoxGeometry(half * 2 + 1.2, 0.5, 0.8), s.x, H + bh + 0.25, s.z, yaw), '#efe6cf'));
      frame.push(col(put(new THREE.BoxGeometry(half * 2 + 1.3, 0.12, 0.9), s.x, H + bh + 0.55, s.z, yaw), '#d4af37'));
      // one board facing the traffic coming in, one facing out (single-sided so neither reads mirrored)
      for (const [off, ry] of [[-0.06, yaw + Math.PI], [0.06, yaw]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), boardMat(name)); m.position.set(s.x + s.dx * off, H + bh / 2, s.z + s.dz * off); m.rotation.y = ry; m.name = 'gra-welcome'; boards.push(m); }
      gates.push({ x: s.x, z: s.z, yaw, name, road: s.road });
    }
  }
  if (frame.length) { const mesh = new THREE.Mesh(mergeGeometries(frame), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 })); mesh.name = 'gra-welcome-frames'; group.add(mesh); }
  if (lamps.length) { const mesh = new THREE.Mesh(mergeGeometries(lamps), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 1.2 })); mesh.name = 'gra-welcome-lamps'; group.add(mesh); }
  for (const b of boards) group.add(b);
  return { group, gates };
}
