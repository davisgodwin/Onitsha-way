import * as THREE from 'three';
import { GeoBuilder } from './GeoBuilder.js';
import { gateSignTexture } from '../render/WorldTextures.js';
import { buildMinibusGeometry } from '../vehicles/MinibusModel.js';
import { mulberry32 } from '../core/utils.js';

/**
 * Landmark-specific set dressing:
 * - gateway arches across the main approach road (markets, Upper Iweka, Bridgehead, motor park)
 * - parked inter-city buses filling the Upper Iweka motor park
 * - the Onitsha Mall (ShopRite) frontage sign
 * Everything is placed relative to real OSM roads/footprints near each landmark.
 */
export function buildLandmarkDressing(map, landmarks, collision) {
  const group = new THREE.Group(); group.name = 'LandmarkDressing';
  const misc = new GeoBuilder();
  const placed = [];

  for (const lm of landmarks.list) {
    if (!lm.gate) continue;
    if (lm.kind === 'mall') { mallSign(lm); continue; }
    const g = findGateSpot(map, collision, lm);
    if (!g) { console.warn('[Landmarks] no gate spot for', lm.id); continue; }
    buildGate(g, lm);
    placed.push({ id: lm.id, x: g.x, z: g.z });
    lm.gatePos = { x: g.x, z: g.z };
  }

  const park = landmarks.get('upper-iweka-park');
  if (park) parkBuses(park);

  const m = new THREE.Mesh(misc.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  m.castShadow = true; m.receiveShadow = true;
  group.add(m);
  return { group, placed };

  // ---------------------------------------------------------------- gates
  function buildGate(g, lm) {
    const { x, z, dx, dz, span } = g;
    const nx = -dz, nz = dx;              // across the road
    const half = span / 2;
    const pA = [x + nx * half, z + nz * half], pB = [x - nx * half, z - nz * half];
    const yaw = Math.atan2(dx, dz);
    const pillar = new THREE.Color('#f1ead8'), trim = new THREE.Color('#0f5132'), gold = new THREE.Color('#d4a017');
    for (const p of [pA, pB]) {
      misc.box(p[0], p[1], 0, 6.8, 1.1, 1.1, yaw, pillar);
      misc.box(p[0], p[1], 0, 0.6, 1.4, 1.4, yaw, trim);
      misc.box(p[0], p[1], 6.8, 7.3, 1.4, 1.4, yaw, gold);
      collision.addCircle(p[0], p[1], 0.8);
    }
    // beam across the road
    // sign panel (both faces) — own texture per landmark
    const texSign = gateSignTexture(lm.gate, '');
    const w = Math.min(span - 1.8, 14), h = w * (192 / 1024);
    const topY = 5.2 + h + 0.75;
    misc.beam([pA[0], topY, pA[1]], [pB[0], topY, pB[1]], 0.6, trim);
    misc.beam([pA[0], 5.2, pA[1]], [pB[0], 5.2, pB[1]], 0.35, trim);
    for (const p of [pA, pB]) { misc.box(p[0], p[1], 6.8, topY + 0.3, 1.1, 1.1, yaw, pillar); misc.box(p[0], p[1], topY + 0.3, topY + 0.8, 1.4, 1.4, yaw, gold); }
    const geo = new THREE.PlaneGeometry(w, h);
    const mat = new THREE.MeshStandardMaterial({ map: texSign, roughness: 0.6, emissive: '#ffffff', emissiveMap: texSign, emissiveIntensity: 0 });
    // two single-sided panels back to back so the text reads correctly from both directions
    const sign = new THREE.Group();
    const front = new THREE.Mesh(geo, mat); front.position.z = 0.03;
    const back = new THREE.Mesh(geo, mat); back.rotation.y = Math.PI; back.position.z = -0.03;
    sign.add(front, back);
    sign.position.set(x, 5.2 + h / 2 + 0.25, z);
    sign.rotation.y = yaw;
    sign.name = 'gate:' + lm.id;
    group.add(sign);
    group.userData.nightMaterials ??= [];
    group.userData.nightMaterials.push({ mat, max: 0.7 });
  }

  // ---------------------------------------------------------------- motor park buses
  function parkBuses(lm) {
    const rng = mulberry32(77);
    const spots = [];
    for (let r = 8; r < lm.radius && spots.length < 18; r += 4) {
      for (let k = 0; k < 24 && spots.length < 18; k++) {
        const a = (k / 24) * Math.PI * 2 + r * 0.37;
        const x = lm.x + Math.cos(a) * r, z = lm.z + Math.sin(a) * r;
        const nr = map.nearestRoad(x, z, { maxDist: 30 });
        if (nr && nr.dist < nr.road.width / 2 + 2.5) continue;
        if (!collision.isFree(x, z, 2.9)) continue;
        if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 6)) continue;
        // align with the nearest road
        let yaw = rng() * Math.PI * 2;
        if (nr) {
          const pts = nr.road.points; let best = null;
          for (let i = 0; i < pts.length - 1; i++) {
            const mx = (pts[i][0] + pts[i + 1][0]) / 2, mz = (pts[i][1] + pts[i + 1][1]) / 2, d = Math.hypot(mx - x, mz - z);
            if (!best || d < best.d) best = { d, dx: pts[i + 1][0] - pts[i][0], dz: pts[i + 1][1] - pts[i][1] };
          }
          yaw = Math.atan2(best.dx, best.dz) + Math.PI / 2;
        }
        spots.push({ x, z, yaw });
      }
    }
    if (!spots.length) return;
    const liveries = [['#f1efe8', '#1d4e89'], ['#f4f1e6', '#c1121f'], ['#e9e5d6', '#2b9348'], ['#fbfaf5', '#f2a20c']];
    liveries.forEach(([body, stripe], li) => {
      const list = spots.filter((_, i) => i % liveries.length === li);
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(buildMinibusGeometry({ body, stripe }), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }), list.length);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
      list.forEach((s, i) => {
        q.setFromAxisAngle(up, s.yaw);
        m4.compose(new THREE.Vector3(s.x, 0, s.z), q, new THREE.Vector3(1, 1, 1));
        mesh.setMatrixAt(i, m4);
        const fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
        s.ci = [collision.addCircle(s.x + fx * 1.4, s.z + fz * 1.4, 1.1), collision.addCircle(s.x - fx * 1.4, s.z - fz * 1.4, 1.1)];
        s.mesh = mesh; s.index = i; // v0.48: the terminal takes over the buses parked where its yard goes
      });
      mesh.castShadow = true; mesh.name = 'parkBuses';
      group.add(mesh);
    });
    group.userData.buses = spots.length; group.userData.parkBusSpots = spots;
  }

  // ---------------------------------------------------------------- mall frontage
  function mallSign(lm) {
    const b = map.buildings.find((bb) => String(bb.id) === lm.osmBuilding);
    if (!b) return;
    const pts = b.pts;
    // longest edge facing a road becomes the frontage
    let best = null;
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      const L = Math.hypot(bx - ax, bz - az);
      const nr = map.nearestRoad((ax + bx) / 2, (az + bz) / 2, { maxDist: 80 });
      const score = L - (nr ? nr.dist : 80) * 0.5 + (i === b.front ? 20 : 0);
      if (!best || score > best.score) best = { score, ax, az, bx, bz, L };
    }
    const { ax, az, bx, bz, L } = best;
    const nx = (bz - az) / L, nz = -(bx - ax) / L;
    const w = Math.min(L * 0.6, 22), h = w * (192 / 1024);
    const texSign = gateSignTexture('SHOPRITE ONITSHA MALL', '', '#c8102e', '#ffffff');
    const mat = new THREE.MeshStandardMaterial({ map: texSign, roughness: 0.5, emissive: '#ffffff', emissiveMap: texSign, emissiveIntensity: 0 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    sign.position.set((ax + bx) / 2 + nx * 0.15, 6.4 + h / 2, (az + bz) / 2 + nz * 0.15);
    sign.rotation.y = Math.atan2(nx, nz);
    sign.name = 'mallSign';
    group.add(sign);
    group.userData.nightMaterials ??= [];
    group.userData.nightMaterials.push({ mat, max: 0.9 });
    // canopy over the entrance
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, yaw = Math.atan2(nx, nz);
    misc.box(mx + nx * 2.2, mz + nz * 2.2, 3.6, 3.9, 10, 4.4, yaw, new THREE.Color('#d9dcdf'));
    for (const t of [-4.5, 4.5]) {
      const px = mx + nx * 4.1 + nz * t, pz = mz + nz * 4.1 - nx * t;
      misc.box(px, pz, 0, 3.6, 0.3, 0.3, yaw, new THREE.Color('#8a8f93'));
      collision.addCircle(px, pz, 0.3);
    }
  }
}

/** Find a point on a real road near the landmark where both gate pillars fit. */
function findGateSpot(map, collision, lm) {
  const wanted = lm.kind === 'bridgehead' ? ['trunk', 'trunk_link', 'primary'] : lm.kind === 'interchange' ? ['trunk', 'primary', 'trunk_link'] : null;
  const cands = [];
  for (const r of map.roads) {
    if (r.elevated || ['footway', 'path', 'steps', 'track', 'service'].includes(r.type)) continue;
    if (wanted && !wanted.includes(r.type)) continue;
    const pts = r.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1)];
      const L = Math.hypot(bx - ax, bz - az); if (L < 12) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let s = 6; s < L - 6; s += 4) {
        const x = ax + dx * s, z = az + dz * s;
        const d = Math.hypot(x - lm.x, z - lm.z);
        if (d > lm.radius) continue;
        cands.push({ x, z, dx, dz, road: r, d: Math.abs(d - lm.radius * (lm.kind === 'market' ? 0.55 : 0.35)) - (r.name ? 15 : 0) });
      }
    }
  }
  cands.sort((a, b) => a.d - b.d);
  for (const c of cands.slice(0, 300)) {
    const span = c.road.width + 3.2;
    const nx = -c.dz, nz = c.dx;
    const okA = collision.isFree(c.x + nx * span / 2, c.z + nz * span / 2, 0.9);
    const okB = collision.isFree(c.x - nx * span / 2, c.z - nz * span / 2, 0.9);
    if (okA && okB) return { ...c, span };
  }
  return null;
}
