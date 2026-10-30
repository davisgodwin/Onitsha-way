import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { frontageCandidates, rect } from '../world/StreetLayout.js';
import { pointInPolygon } from '../core/utils.js';

/*
  v0.48: motor-park terminals. Upper Iweka Motor Park (OSM bus_station "Peace Mass Transit Park") and Bridgehead
  Motor Park (the OSM car park at Bridgehead) become real terminals:
  - a walled yard on its own plot by the road, with an entry gate (name gantry over it) and an exit gate (guard
    post, barrier arm), a concrete yard, painted loading bays with bay boards, a covered waiting shed with benches,
    a ticket office, a park office, food kiosks, floodlights and a drain along the front;
  - minibuses, commercial buses and coasters come off the road, drive in, nose into a free bay, unload, load the
    people waiting under the shed, reverse out and leave through the exit, back into the traffic;
  - staff (ticket clerk, dispatcher, guard, food sellers) and passengers;
  - the ticket office tells you which city lines stop outside; intercity travel is COMING SOON (only Onitsha is open).
  The yard is placed after the whole city is built, on land clear of buildings, roads, homes, doors and people, so
  nothing that already exists moves. Buses that were parked as dressing where the yard goes are taken away.
  Everything static is one merged mesh per terminal plus a few signs.
*/

export const TERMINAL_SITES = [
  { id: 'upper-iweka-terminal', anchor: 'upper-iweka-park', name: 'Upper Iweka Motor Park', sizes: [[60, 38], [52, 34], [46, 30]],
    bays: ['Bridgehead (C1)', 'Lagos', 'Abuja', 'Enugu', 'Owerri', 'Port Harcourt', 'Benin', 'Kano', 'Aba'] },
  { id: 'bridgehead-terminal', anchor: 'bridgehead-park', name: 'Bridgehead Motor Park', sizes: [[52, 34], [46, 30], [42, 28], [38, 27]],
    bays: ['Upper Iweka (M2)', 'Main Market (B1)', 'Lagos', 'Benin', 'Warri', 'Ibadan', 'Abuja'], reach: 300 },
];
const INTERCITY_NOTE = 'Intercity travel is COMING SOON. Only Onitsha is open for now.';

const col = (geo, hex) => { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
function canvasTex(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
const font = (px, wt = 800) => `${wt} ${px}px "Bricolage Grotesque", system-ui, sans-serif`;

const segX = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
/** Is the rectangle (or a driveway strip) free? Ignores the dressing buses (they are moved away). */
export function yardClear(world, g, pts, ignore, why = null, { roadEnd = false } = {}) {
  const no = (r) => { if (why) why[r] = (why[r] ?? 0) + 1; return false; };
  const map = world.map, col = world.collision, b = map.bounds;
  if (pts.some(([x, z]) => x < b.minX + 4 || x > b.maxX - 4 || z < b.minZ + 4 || z > b.maxZ - 4)) return no('bounds');
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]), minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  // walls and buildings: any wall inside or crossing the rectangle
  for (const ei of col._nearbyEdges(minX, minZ, maxX, maxZ)) {
    const e = col.edges[ei], poly = col.polys[e.poly]; if (!poly || poly.height <= 0 || poly.minX === Infinity) continue;
    const A = [e.ax, e.az], B = [e.bx, e.bz];
    if (pointInPolygon(A[0], A[1], pts) || pointInPolygon(B[0], B[1], pts)) return no('wall');
    for (let i = 0; i < 4; i++) if (segX(A, B, pts[i], pts[(i + 1) % 4])) return no('wall');
  }
  const [a, bb, , d] = pts, ux = (bb[0] - a[0]), uz = (bb[1] - a[1]), vx = (d[0] - a[0]), vz = (d[1] - a[1]), Lu = Math.hypot(ux, uz), Lv = Math.hypot(vx, vz);
  const nu = Math.max(2, Math.ceil(Lu / 2.5)), nv = Math.max(2, Math.ceil(Lv / 2.5));
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
    const x = a[0] + ux * i / nu + vx * j / nv, z = a[1] + uz * i / nu + vz * j / nv;
    if (map.onCarriageway(x, z, 1.0) && !(roadEnd && j >= nv - 1)) return no('road');
    if (world.terrain.isWater(x, z) || world.playArea?.locked(x, z)) return no('water'); if (map.inHomeAccess?.(x, z, 1)) return no('access'); if (col.insidePolygon(x, z)) return no('inside');
    for (const ci of col.circleGrid.get(col._key(Math.floor(x / col.cs), Math.floor(z / col.cs))) ?? []) { if (ignore.has(ci)) continue; const c = col.circles[ci]; if (Math.hypot(x - c.x, z - c.z) < c.r + 0.5) return no('circle'); }
  }
  const inside = (x, z) => pointInPolygon(x, z, pts);
  for (const e of g.graph.edgesNear((minX + maxX) / 2, (minZ + maxZ) / 2, Math.hypot(maxX - minX, maxZ - minZ) / 2 + 5)) { if (roadEnd) break; const [ax, az] = g.graph.nodes[e.a], [bx2, bz2] = g.graph.nodes[e.b]; if (inside((ax + bx2) / 2, (az + bz2) / 2) || inside(ax, az) || inside(bx2, bz2)) return no('path'); }
  for (const it of g.interactions.items) { try { if (Number.isFinite(it.x) && inside(it.x, it.z)) return no('interaction'); } catch { /* moving item */ } }
  for (const r of g.npcs.residents ?? []) if (inside(r.x, r.z)) return no('resident');
  for (const v of world.venuePlots ?? []) if (v.pts && v.pts.some(([x, z]) => inside(x, z))) return no('venue');
  return true;
}
/** Nearest point on a drivable street (not a deck, not a footpath) to (x, z). */
function nearestStreet(map, x, z, maxD = 75) {
  let best = null; const c = map.cell;
  for (let gx = Math.floor((x - maxD) / c); gx <= Math.floor((x + maxD) / c); gx++) for (let gz = Math.floor((z - maxD) / c); gz <= Math.floor((z + maxD) / c); gz++) for (const si of map.grid.get(gx + ',' + gz) ?? []) {
    const sg = map.segments[si], r = sg.road; if (r.elevated || r.noTraffic || r.width < 5 || ['footway', 'path', 'steps', 'pedestrian', 'track', 'construction'].includes(r.type)) continue;
    const dx = sg.bx - sg.ax, dz = sg.bz - sg.az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - sg.ax) * dx + (z - sg.az) * dz) / L2)), px = sg.ax + dx * t, pz = sg.az + dz * t, d = Math.hypot(px - x, pz - z);
    if (d < maxD && (!best || d < best.d)) { const L = Math.sqrt(L2); best = { d, x: px, z: pz, road: r, dx: dx / L, dz: dz / L }; }
  }
  return best;
}

export class Terminals {
  constructor(g) { this.g = g; this.list = []; this.group = new THREE.Group(); this.group.name = 'Terminals'; this.t = 0; }

  setup() {
    const g = this.g, w = g.world, lm = w.landmarks;
    // Bridgehead Motor Park: by the OSM car park nearest Bridgehead
    const bh = lm.get('bridgehead'), parking = (w.map.areas ?? []).filter((a) => a.kind === 'parking').map((a) => ({ x: a.pts.reduce((s, p) => s + p[0], 0) / a.pts.length, z: a.pts.reduce((s, p) => s + p[1], 0) / a.pts.length })).sort((a, b) => Math.hypot(a.x - bh.x, a.z - bh.z) - Math.hypot(b.x - bh.x, b.z - bh.z))[0];
    const anchors = { 'upper-iweka-park': lm.get('upper-iweka-park'), 'bridgehead-park': parking && Math.hypot(parking.x - bh.x, parking.z - bh.z) < 400 ? parking : bh };
    const t0 = performance.now(), busSpots = w.dressing?.group.userData.parkBusSpots ?? [];
    const ignore = new Set(busSpots.flatMap((s) => s.ci ?? []));
    for (const site of TERMINAL_SITES) {
      const a = anchors[site.anchor]; if (!a) continue;
      const plot = this.findPlot(a, site, ignore);
      if (!plot) { console.warn('[terminals] no clear yard for', site.name, JSON.stringify(this.why)); continue; }
      this.list.push(this.build(site, plot, busSpots));
    }
    g.renderer.scene.add(this.group); this.ms = Math.round(performance.now() - t0);
    console.info('[terminals]', this.list.map((t) => `${t.name} ${t.W}x${t.D} bays ${t.bays.length} drive ${Math.round(t.drive)}m`).join(' · '));
  }

  /**
   * The nearest clear yard (largest size first) with a straight driveway from its gate to a street.
   * Yard frame: u along the front, v into the yard; the gate is at the front-left (u = -W/2 + 6).
   */
  findPlot(a, site, ignore) {
    const g = this.g, w = g.world; this.why = {};
    for (const [W, D] of site.sizes) {
      const cands = [];
      for (let dx = -300; dx <= 300; dx += 6) for (let dz = -300; dz <= 300; dz += 6) { const r = Math.hypot(dx, dz); if (r <= (site.reach ?? 210) && w.collision.isFree(a.x + dx, a.z + dz, 2.5)) cands.push({ x: a.x + dx, z: a.z + dz, r }); }
      cands.sort((p, q) => p.r - q.r);
      for (const c of cands) {
        if (this.list.some((t) => Math.hypot(t.x - c.x, t.z - c.z) < 150)) continue;
        for (let k = 0; k < 12; k++) {
          const ang = k * Math.PI / 6, n = { x: Math.sin(ang), z: Math.cos(ang) }, uAx = { x: n.z, z: -n.x }; // n: from the front into the yard
          const O = { x: c.x - n.x * D / 2, z: c.z - n.z * D / 2 }, P = (u, v) => [O.x + uAx.x * u + n.x * v, O.z + uAx.z * u + n.z * v];
          const gate = P(-W / 2 + 6, 0), st = nearestStreet(w.map, gate[0], gate[1], 70); if (!st) continue;
          const ox = st.x - gate[0], oz = st.z - gate[1], L = Math.hypot(ox, oz); if (L < 3) continue;
          if ((-n.x * ox - n.z * oz) / L < 0.82) continue; // the street is straight out in front of the gate
          const pts = [P(-W / 2, 0), P(W / 2, 0), P(W / 2, D), P(-W / 2, D)];
          if (!yardClear(w, g, pts, ignore, this.why)) continue;
          const dU = { x: -oz / L, z: ox / L }, kerb = L - st.road.width / 2, drv = [[gate[0] + dU.x * 4.5, gate[1] + dU.z * 4.5], [gate[0] - dU.x * 4.5, gate[1] - dU.z * 4.5], [gate[0] - dU.x * 4.5 + ox / L * kerb, gate[1] - dU.z * 4.5 + oz / L * kerb], [gate[0] + dU.x * 4.5 + ox / L * kerb, gate[1] + dU.z * 4.5 + oz / L * kerb]];
          if (kerb > 1 && !yardClear(w, g, drv, ignore, this.why, { roadEnd: true })) continue;
          return { x: c.x, z: c.z, W, D, n, uAx, O, pts, street: st, drive: Math.max(0, kerb), road: st.road };
        }
      }
    }
    return null;
  }

  /** Build one terminal on its plot. */
  build(site, plot, busSpots) {
    const g = this.g, w = g.world, cw = w.collision, { W, D, n, uAx: f, O } = plot;
    const yaw = Math.atan2(-f.z, f.x);
    const P = (u, v) => ({ x: O.x + f.x * u + n.x * v, z: O.z + f.z * u + n.z * v });
    const parts = [], signs = [];
    const box = (u, v, y, sw, sh, sd, hex, solid = false) => { const p = P(u, v), geo = new THREE.BoxGeometry(sw, sh, sd); geo.rotateY(yaw); geo.translate(p.x, y, p.z); parts.push(col(geo, hex)); if (solid) w.collision.addPolygon(rect(p.x, p.z, sw, sd, yaw), Math.max(1, sh)); };
    const post = (u, v, h, r, hex) => { const p = P(u, v), geo = new THREE.CylinderGeometry(r, r, h, 8); geo.translate(p.x, h / 2, p.z); parts.push(col(geo, hex)); cw.addCircle(p.x, p.z, r + 0.05); };
    const sign = (u, v, y, sw, sh, tex, face = 0) => { const p = P(u, v), m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide })); m.position.set(p.x, y, p.z); m.rotation.y = yaw + face; signs.push(m); return m; };
    const inYard = (x, z) => pointInPolygon(x, z, plot.pts.map((q) => [q[0], q[1]]));
    // take away the dressing buses parked where the yard and driveway go
    let removed = 0;
    for (const s of busSpots) if (inYard(s.x, s.z) || s.ci?.some((ci) => { const c = cw.circles[ci]; return c && inYard(c.x, c.z); })) { for (const ci of s.ci ?? []) cw.removeCircle(ci); s.mesh.setMatrixAt(s.index, new THREE.Matrix4().makeScale(0, 0, 0)); s.mesh.instanceMatrix.needsUpdate = true; removed++; }
    const gU = -W / 2 + 6, laneV = D - 15, bayV = D - 5.5, bayA = -W / 2 + 12, nb = Math.max(4, Math.min(site.bays.length, Math.floor((W / 2 - 2 - bayA) / 5.6))), bayW = (W / 2 - 2 - bayA) / nb;
    // ground: concrete yard, darker driving lane, painted bays, walkway, drain; the driveway out to the street
    box(0, D / 2, 0.03, W, 0.06, D, '#a9a59c');
    box(2, laneV, 0.065, W - 6, 0.01, 6.4, '#77736c'); box(gU, laneV / 2, 0.065, 8.4, 0.01, laneV, '#77736c');
    const bays = [];
    for (let i = 0; i < nb; i++) {
      const u = bayA + bayW * (i + 0.5); bays.push({ i, u, name: site.bays[i] ?? 'Intercity', vehicle: null, state: 'empty', t: 0 });
      for (const e of [-1, 1]) box(u + e * bayW / 2, D - 5.6, 0.075, 0.18, 0.01, 10.6, '#f4f1e6');
      box(u, D - 10.8, 0.075, bayW - 0.4, 0.01, 0.2, '#f2c200');
      const t = canvasTex(256, 160, (c, cw, ch) => { c.fillStyle = '#14365c'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#f2c200'; c.font = font(64); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(`BAY ${i + 1}`, cw / 2, 52); c.fillStyle = '#fff'; c.font = font(30, 700); c.fillText((site.bays[i] ?? 'Intercity').toUpperCase(), cw / 2, 122, cw - 16); });
      post(u + bayW / 2 - 0.3, D - 0.6, 3.2, 0.06, '#5c6770'); sign(u + bayW / 2 - 0.3, D - 0.75, 2.75, 1.3, 0.8, t, Math.PI);
    }
    const st = plot.street, kerbLen = plot.drive, gate = P(gU, 0), out = { x: (st.x - gate.x), z: (st.z - gate.z) }, oL = Math.hypot(out.x, out.z) || 1; out.x /= oL; out.z /= oL;
    if (kerbLen > 0.5) { const m = { x: gate.x + out.x * kerbLen / 2, z: gate.z + out.z * kerbLen / 2 }, geo = new THREE.BoxGeometry(9, 0.06, kerbLen); geo.rotateY(Math.atan2(out.x, out.z)); geo.translate(m.x, 0.035, m.z); parts.push(col(geo, '#8d8a83')); }
    box(0, laneV / 2 - 0.6, 0.07, 2, 0.01, 4.5, '#d9d4c7'); // pedestrian walkway from the front gate into the shed
    for (let u = -W / 2 + 11; u < W / 2 - 1; u += 2.4) box(u, 0.9, 0.07, 1.6, 0.01, 0.3, '#5f5b55'); // drain grating
    // walls: back and sides 2.2 m block walls with a coping; the front a low wall with railings, open at the gates
    const wallH = 2.2, paint = site.id === 'upper-iweka-terminal' ? '#e9e1cf' : '#dfe6dc';
    box(0, D, wallH / 2, W, wallH, 0.25, paint, true); box(0, D, wallH + 0.05, W + 0.2, 0.1, 0.4, '#8a8579');
    for (const e of [-1, 1]) { box(e * W / 2, D / 2, wallH / 2, 0.25, wallH, D, paint, true); box(e * W / 2, D / 2, wallH + 0.05, 0.4, 0.1, D + 0.2, '#8a8579'); }
    for (const [a, b] of [[-W / 2, gU - 4.5], [gU + 4.5, -1.2], [1.2, W / 2]]) { if (b - a < 0.4) continue; const m = (a + b) / 2, L = b - a; box(m, 0, 0.5, L, 1, 0.25, paint, true); for (let u = a + 0.3; u < b; u += 1.2) box(u, 0, 1.45, 0.05, 0.9, 0.05, '#2f3a40'); box(m, 0, 1.9, L, 0.06, 0.06, '#2f3a40'); }
    // the gate: pillars and a gantry with the park's name; a guard post with a barrier arm (raised)
    for (const e of [-1, 1]) box(gU + e * 4.8, 0, 3, 0.6, 6, 0.6, '#c9b48a', true);
    box(gU, 0, 6.1, 10.8, 0.5, 0.6, '#8a6d3b');
    const nameTex = canvasTex(1024, 192, (c, cw, ch) => { c.fillStyle = '#0f4c2a'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#f2c200'; c.lineWidth = 10; c.strokeRect(8, 8, cw - 16, ch - 16); c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = font(76); c.fillText(site.name.toUpperCase(), cw / 2, 78, cw - 60); c.font = font(30, 600); c.fillStyle = '#f2c200'; c.fillText('IN · OUT · TICKETS · LOADING BAYS', cw / 2, 150, cw - 60); });
    sign(gU, -0.35, 5.1, 9.6, 1.8, nameTex, Math.PI);
    box(gU + 6.3, 1.6, 1.25, 2, 2.5, 2, '#f1efe8', true); box(gU + 6.3, 1.6, 2.6, 2.4, 0.15, 2.4, '#7f5539');
    { const p = P(gU + 4.6, -0.2), arm = new THREE.BoxGeometry(0.12, 4.2, 0.12); arm.translate(0, 2.1, 0); arm.rotateZ(-0.12); arm.rotateY(yaw); arm.translate(p.x, 1, p.z); parts.push(col(arm, '#c1121f')); }
    // waiting shed: steel posts, a sloped roof, rows of benches; departures board
    const shedA = -W / 2 + 14, shedB = W / 2 - 14, shedL = shedB - shedA, shedM = (shedA + shedB) / 2, s0 = 3.8, s1 = Math.max(s0 + 4, laneV - 3.4), sM = (s0 + s1) / 2;
    const step = shedL / Math.max(1, Math.round(shedL / 4));
    for (let u = shedA; u <= shedB + 0.01; u += step) { post(u, s0, 3.1, 0.09, '#5c6770'); post(u, s1, 3.5, 0.09, '#5c6770'); }
    { const roof = new THREE.BoxGeometry(shedL + 1.2, 0.08, s1 - s0 + 1.2); roof.rotateX(0.07); const p = P(shedM, sM); roof.rotateY(yaw); roof.translate(p.x, 3.35, p.z); parts.push(col(roof, '#9aa3a8')); }
    const rows = Math.max(1, Math.floor((s1 - s0 - 1) / 1.5));
    const benches = [];
    for (let r = 0; r < rows; r++) for (let u = shedA + 2; u < shedB - 1.5; u += 4.2) { if (Math.abs(u) < 1.8) continue; benches.push([u, s0 + 1 + r * 1.5]); box(u, s0 + 1 + r * 1.5, 0.45, 3.2, 0.08, 0.45, '#2d6a4f'); box(u, s0 + 1.2 + r * 1.5, 0.75, 3.2, 0.45, 0.06, '#2d6a4f'); for (const e of [-1.4, 1.4]) box(u + e, s0 + 1 + r * 1.5, 0.22, 0.06, 0.44, 0.4, '#3a3a3a'); }
    const lines = this.linesOutside(gate);
    const boardTex = canvasTex(1024, 512, (c, cw, ch) => {
      c.fillStyle = '#10161c'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#f2c200'; c.font = font(44); c.textBaseline = 'top'; c.fillText('DEPARTURES · LOADING BAYS', 34, 24);
      c.font = font(30, 700); bays.forEach((b, i) => { const y = 92 + i * 40; c.fillStyle = '#ffffff'; c.fillText(`BAY ${i + 1}`, 34, y); const city = /\(/.test(b.name); c.fillStyle = city ? '#7ee081' : '#9aa3a8'; c.fillText(b.name.toUpperCase() + (city ? '' : '  ·  COMING SOON'), 190, y, cw - 220); });
      c.fillStyle = '#9aa3a8'; c.font = font(24, 600); c.fillText(lines.length ? `City lines at the stop outside: ${lines.join(' · ')}` : 'City lines stop on the road outside.', 34, ch - 44, cw - 60);
    });
    post(shedM - 2.4, s1 - 0.2, 3.4, 0.07, '#5c6770'); post(shedM + 2.4, s1 - 0.2, 3.4, 0.07, '#5c6770'); sign(shedM, s1 - 0.25, 2.2, 4.6, 2.3, boardTex, Math.PI);
    // ticket office at the front-right, park office behind it, food kiosks at the ends of the shed
    const office = (u, v, sw, sd, label, sub, hex) => { box(u, v, 1.4, sw, 2.8, sd, hex, true); box(u, v, 2.95, sw + 0.6, 0.18, sd + 0.6, '#7f5539'); box(u, v - sd / 2 - 0.02, 1.35, sw * 0.55, 0.9, 0.04, '#24333d');
      const t = canvasTex(512, 128, (c, cw, ch) => { c.fillStyle = '#1d4e89'; c.fillRect(0, 0, cw, ch); c.fillStyle = '#fff'; c.font = font(50); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, cw / 2, sub ? 48 : ch / 2, cw - 30); if (sub) { c.font = font(24, 600); c.fillText(sub, cw / 2, 102, cw - 30); } }); sign(u, v - sd / 2 - 0.08, 2.3, sw * 0.92, sw * 0.23, t, Math.PI); };
    office(W / 2 - 6, 3.6, 6, 3.8, 'TICKETS · BOOKING', 'Intercity: COMING SOON', '#f4efe2');
    office(W / 2 - 5, Math.min(laneV - 4, 9.4), 5, 3.6, 'PARK OFFICE', 'Staff only', '#efe6d4');
    const kiosks = [];
    for (const [u, hex, label] of [[shedA - 1.6, '#c1121f', 'MAMA PUT'], [shedB + 1.6, '#2b9348', 'DRINKS']]) {
      if (u > W / 2 - 10.5) continue; const v = 5.4; box(u, v, 1.1, 2.4, 2.2, 2.2, '#f1efe8', true); box(u, v, 2.35, 3, 0.12, 2.8, hex);
      const t = canvasTex(256, 64, (c, cw, ch) => { c.fillStyle = hex; c.fillRect(0, 0, cw, ch); c.fillStyle = '#fff'; c.font = font(32); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, cw / 2, ch / 2, cw - 10); }); sign(u, v - 1.15, 1.95, 2.3, 0.58, t, Math.PI); kiosks.push(P(u, v - 1.9));
    }
    for (const [u, v] of [[-W / 2 + 1.2, D - 1.2], [W / 2 - 1.2, D - 1.2], [-W / 2 + 1.2, 1.4], [W / 2 - 1.2, 1.4]]) { post(u, v, 9, 0.12, '#6c757d'); box(u, v, 9.05, 1.4, 0.3, 0.5, '#d8d8d8'); }
    const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.08 })); mesh.name = site.id; mesh.receiveShadow = true;
    const root = new THREE.Group(); root.name = site.id; root.add(mesh); for (const s of signs) root.add(s); this.group.add(root);
    // staff and passengers (the ordinary resident system: they keep their posts in working hours)
    const npc = (id, role, name, u, v, face, sched = [6, 21], extra = {}) => { const p = P(u, v), fx = Math.sin(yaw + face), fz = Math.cos(yaw + face); try { g.npcs.addAnchored({ id: `${site.id}:${id}`, kind: 'host', role, name, x: p.x, z: p.z, nx: fx, nz: fz, schedule: sched, ...extra }); } catch { /* */ } };
    npc('clerk', 'neighbour', 'Ticket clerk', W / 2 - 6, 1.2, Math.PI);
    npc('dispatcher', 'neighbour', 'Park dispatcher', 2, laneV - 2.6, 0);
    npc('guard', 'police', 'Park security', gU + 6.3, -0.4, Math.PI, [0, 24]);
    kiosks.forEach((p, i) => { try { g.npcs.addAnchored({ id: `${site.id}:food${i}`, kind: 'stall', role: 'trader', name: i ? 'Drinks seller' : 'Mama put', x: p.x, z: p.z, nx: -n.x, nz: -n.z, schedule: [6, 21] }); } catch { /* */ } });
    for (let i = 0; i < Math.min(6, benches.length); i++) { const [bu, bv] = benches[(i * 5) % benches.length], p = P(bu + (i % 2 ? 0.7 : -0.7), bv - 0.05); try { g.npcs.addAnchored({ id: `${site.id}:pax${i}`, kind: 'activity', role: 'neighbour', name: 'Traveller', x: p.x, z: p.z, nx: -n.x, nz: -n.z, schedule: [6, 20], activity: 'sit', seatY: 0.45 }); } catch { /* */ } }
    const counter = P(W / 2 - 6, 0.6);
    const t = { id: site.id, name: site.name, x: plot.x, z: plot.z, W, D, yaw, f, n, O, P, bays, shedV: sM, gU, laneV, bayV, lines, removedBuses: removed, root, pts: plot.pts, road: plot.road, street: st, out, drive: kerbLen, next: 6, active: false };
    g.interactions.register({ x: counter.x, z: counter.z, radius: 2.6, label: () => `Ticket office · ${site.name}`, onInteract: () => g.openChoice(() => this.ticketView(t)) });
    // the lane on the street: traffic heading so the yard is on its right
    let fl = { x: st.dx, z: st.dz }; if ((-fl.z) * (-out.x) + fl.x * (-out.z) < 0) fl = { x: -fl.x, z: -fl.z };
    const lat = Math.min(st.road.width / 4, 2.8), lane = { x: st.x - out.x * 0 + (-fl.z) * lat, z: st.z + fl.x * lat };
    t.lane = lane; t.fl = fl; t.mouth = { x: st.x - out.x * (st.road.width / 2 + 0.5), z: st.z - out.z * (st.road.width / 2 + 0.5) };
    return t;
  }

  /** City lines that stop at the transit stops just outside. */
  linesOutside(p) {
    const net = this.g.transport?.net; if (!net) return [];
    const near = net.stops.filter((s) => Math.hypot(s.x - p.x, s.z - p.z) < 240);
    return [...new Set(near.flatMap((s) => [...s.lines].map((l) => { const L = typeof l === 'string' ? net.lines.find((q) => q.id === l || q.def?.id === l) : l, id = typeof l === 'string' ? l : (l.id ?? l.def?.id), nm = L?.name ?? L?.def?.name ?? ''; return `${id} ${nm}`.trim(); })))].slice(0, 4);
  }

  ticketView(t) {
    const g = this.g;
    return { title: `${t.name} · Ticket office`, body: `${INTERCITY_NOTE} City buses, mini buses and keke to other parts of Onitsha stop on the road outside: walk to the bus stop and choose where you're going. ${t.lines.length ? 'Lines here: ' + t.lines.join(' · ') + '.' : ''}`,
      options: [{ label: 'Where do the loading bays go?', act: () => g.openChoice(() => ({ title: 'Loading bays', body: t.bays.map((b, i) => `Bay ${i + 1}: ${b.name}${/\(/.test(b.name) ? '' : ' (COMING SOON)'}`).join('\n'), options: [{ label: 'Back', ghost: true, act: () => g.openChoice(() => this.ticketView(t)) }] })) }, { label: 'Thank you', ghost: true, act: () => g.closeChoice() }] };
  }

  // ------------------------------------------------------------------ the yard at work
  /** Path through the yard in world coordinates: off the street, up the driveway, through the gate, into a bay. */
  pathIn(t, bay) {
    const { lane, fl, mouth, P } = t, L = (k) => ({ x: lane.x + fl.x * k, z: lane.z + fl.z * k });
    const gateOut = P(t.gU - 1.8, -1);
    return [L(-26), L(-8), mouth, { x: gateOut.x + t.out.x * 1.5, z: gateOut.z + t.out.z * 1.5 }, P(t.gU - 1.8, 1.5), P(t.gU - 1.8, t.laneV - 1.5), P(t.gU + 3, t.laneV), P(bay.u - 5, t.laneV), P(bay.u - 1, t.laneV + 3.2), P(bay.u, t.bayV - 2), P(bay.u, t.bayV)];
  }
  pathOut(t, bay) {
    const { lane, fl, P } = t, L = (k) => ({ x: lane.x + fl.x * k, z: lane.z + fl.z * k }), gateOut = P(t.gU + 1.8, -1);
    return { back: [P(bay.u, t.bayV), P(bay.u, t.laneV)], fwd: [P(bay.u, t.laneV), P(bay.u - 4, t.laneV + 0.6), P(t.gU + 4, t.laneV + 0.6), P(t.gU + 1.8, t.laneV - 2), P(t.gU + 1.8, 1.5), gateOut, { x: gateOut.x + t.out.x * (t.drive + 1), z: gateOut.z + t.out.z * (t.drive + 1) }, L(8), L(22)] };
  }

  makeVehicle(t, at) {
    const tr = this.g.traffic, types = ['minibus', 'minibus', 'cbus', 'bus'].filter((k) => tr.typeInfo(k)), type = types[Math.floor(Math.random() * types.length)], T = tr.typeInfo(type);
    const paint = T.paints ? T.paints[Math.floor(Math.random() * T.paints.length)] : '#ffffff';
    return { id: tr.nextId++, type, model: type, T, color: new THREE.Color(paint), ownership: 'npc', ownerId: `${t.id}:driver:${tr.nextId}`, edge: null, fwd: true, s: 0, lat: 0, latT: 0, speed: 0, limit: 0, x: at.x, y: 0, z: at.z, pitch: 0, dx: t.f.x, dz: t.f.z, yaw: Math.atan2(t.f.x, t.f.z), wait: 0, honkT: 0, prevNode: -1, passT: 0, terminal: t.id };
  }
  /** A vehicle follows `pts` (reverse: it backs along them) at `speed`; done() when it gets there. */
  drive(v, pts, { reverse = false, speed = 3.2, done }) { v.scripted = { pts, i: 1, reverse, speed, done, step: (vv, dt) => this.step(vv, dt) }; v.speed = 0; }
  remove(v) { const tr = this.g.traffic; tr.vehicles = tr.vehicles.filter((x) => x !== v); }
  step(v, dt) {
    const sc = v.scripted, tgt = sc.pts[sc.i]; if (!tgt) { const d = sc.done; v.scripted = null; d?.(v); return; }
    const dx = tgt.x - v.x, dz = tgt.z - v.z, L = Math.hypot(dx, dz), sp = Math.min(sc.speed, (v.speed ?? 0) + dt * 1.8);
    v.speed = sp; if (L < 0.6) { sc.i++; return; }
    const m = Math.min(L, sp * dt); v.x += dx / L * m; v.z += dz / L * m;
    const want = Math.atan2(dx, dz) + (sc.reverse ? Math.PI : 0); let d = want - v.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; v.yaw += d * Math.min(1, dt * 2.4);
    v.dx = Math.sin(v.yaw); v.dz = Math.cos(v.yaw); v.y = 0; v.pitch = 0;
  }
  /** Back into ordinary traffic at the end of the exit path. */
  handOff(v) {
    const tr = this.g.traffic, gph = this.g.graph, t = this.list.find((q) => q.id === v.terminal);
    const edges = gph.edgesNear(v.x, v.z, 40, 0, (e) => e.drivable && e.len > 6);
    let best = null, bd = Infinity;
    for (const e of edges) for (const fwd of [true, false]) {
      if (e.road.oneway && !fwd) continue; const dx = fwd ? e.dx : -e.dx, dz = fwd ? e.dz : -e.dz; if (t && dx * t.fl.x + dz * t.fl.z < 0.4) continue;
      const [ax, az] = gph.nodes[fwd ? e.a : e.b], s = Math.max(0, Math.min(e.len - 0.5, (v.x - ax) * dx + (v.z - az) * dz)), d = Math.hypot(ax + dx * s - v.x, az + dz * s - v.z);
      if (d < bd) { bd = d; best = { e, fwd, s }; }
    }
    if (!best) { this.remove(v); return; }
    v.edge = best.e; v.fwd = best.fwd; v.s = best.s; v.lat = v.latT = tr.laneOffset(best.e, v.type); v.limit = tr.limitFor(v, best.e); v.speed = 3; v.terminal = null;
  }

  update(dt) {
    const g = this.g, tr = g.traffic, focus = g.worldFocus?.() ?? g.player.position; this.t += dt;
    for (const t of this.list) {
      const near = Math.hypot(focus.x - t.x, focus.z - t.z) < 260; t.root.visible = Math.hypot(focus.x - t.x, focus.z - t.z) < 700;
      if (!near) { if (t.active) { for (const b of t.bays) { if (b.vehicle) this.remove(b.vehicle); b.vehicle = null; b.state = 'empty'; } t.active = false; } continue; }
      if (!t.active) { // arriving in the area: some buses are already loading
        t.active = true; t.next = 8;
        for (const b of t.bays) if (Math.random() < 0.55) { const at = t.P(b.u, t.bayV), v = this.makeVehicle(t, at); v.yaw = Math.atan2(t.n.x, t.n.z); b.vehicle = v; b.state = 'loading'; b.t = 20 + Math.random() * 80; tr.vehicles.push(v); v.scripted = { pts: [at], i: 1, speed: 0, done: null, parked: true }; }
      }
      // a bus arrives from the road every so often (if a bay is free)
      t.next -= dt;
      if (t.next <= 0) {
        t.next = 22 + Math.random() * 30; const b = t.bays.find((q) => q.state === 'empty' && !q.vehicle);
        if (b) { const pts = this.pathIn(t, b), v = this.makeVehicle(t, pts[0]); v.yaw = Math.atan2(t.fl.x, t.fl.z); b.vehicle = v; b.state = 'arriving'; tr.vehicles.push(v); this.drive(v, pts, { speed: 4, done: () => { b.state = 'unloading'; b.t = 6; const door = t.P(b.u - 1.3, t.bayV - 3.6), shed = t.P(Math.max(-t.W / 2 + 15, Math.min(t.W / 2 - 15, b.u)), t.shedV); g.npcs?.spawnAlighting(2 + Math.floor(Math.random() * 3), door, shed); v.scripted = { pts: [door], i: 1, speed: 0, done: null, parked: true }; } }); }
      }
      for (const b of t.bays) {
        const v = b.vehicle; if (!v) continue;
        if (!tr.vehicles.includes(v)) { b.vehicle = null; b.state = 'empty'; continue; }
        if (b.state === 'unloading' && (b.t -= dt) <= 0) { b.state = 'loading'; b.t = 25 + Math.random() * 35; this.board(t, b); }
        else if (b.state === 'loading' && (b.t -= dt) <= 0) {
          b.state = 'leaving'; const o = this.pathOut(t, b);
          this.drive(v, o.back, { reverse: true, speed: 1.6, done: () => this.drive(v, o.fwd, { speed: 3.6, done: () => { this.handOff(v); b.vehicle = null; b.state = 'empty'; } }) });
        }
      }
    }
  }
  /** People waiting under the shed walk to the bus and get in. */
  board(t, b) {
    const g = this.g, door = t.P(b.u - 1.3, t.bayV - 3.6);
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      const p = t.P(Math.max(-t.W / 2 + 15, Math.min(t.W / 2 - 15, b.u + (Math.random() - 0.5) * 6)), t.shedV + (Math.random() - 0.5) * 2), female = Math.random() < 0.5;
      const npc = g.npcs?.embody?.({ id: `${t.id}:board:${Math.floor(this.t * 10)}:${i}`, kind: 'wait', role: 'passenger', gender: female ? 'female' : 'male', name: female ? 'Traveller' : 'Traveller', template: Math.floor(Math.random() * 1000), x: p.x, z: p.z, yaw: 0 }, 'stand');
      if (npc) { npc.state = 'board'; npc.target = { x: door.x, z: door.z }; npc.stateT = 8 + i; }
    }
  }
  places() { return this.list.map((t) => ({ x: t.x, z: t.z, kind: 'park', id: t.id, label: t.name })); }
}
