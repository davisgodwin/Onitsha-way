import * as THREE from 'three';
import {safePoleSite, wirePin} from './UtilitySafety.js';
import {inPoly} from './Terrain.js';
import { mulberry32, hashString } from '../core/utils.js';
import { isMajorRoad, offsetPolyline } from './RoadBuilder.js';
import { buildKekeGeometry } from '../vehicles/KekeModel.js';
import { executiveSedan, compactSedan, luxurySuv, PAINTS } from '../vehicles/CarModels.js';

/*
  Street furniture placed from the real road network:
  - concrete electric poles with sagging cables (NEPA/PHCN lines are everywhere)
  - umbrella stalls with goods along the market roads
  - shade trees inside blocks
  - a keke waiting point near the spawn junction (static decoration until Milestone 5)
  Everything is instanced; colliders are registered in the CollisionWorld.
*/

function sampleAlong(pts, spacing, startOffset, cb) {
  let acc = -startOffset;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
    const dx = (bx - ax) / L, dz = (bz - az) / L;
    let d = spacing - acc;
    while (d <= L) { cb(ax + dx * d, az + dz * d, dx, dz); d += spacing; }
    acc = (acc + L) % spacing;
  }
}

/**
 * `extra: false` builds the street furniture of the Milestone 2–5 area exactly as before (same roads,
 * same random sequence, same tree area); `extra: true` builds the new area (Asaba bank, the strip south
 * of Bridgehead) afterwards with its own seed, so the old area's stalls — and the traders at them — keep their ids.
 */
export function buildProps(map, collision, { density = 1, umbrellaTex = null, landmarks = null, spawn = null, extra = false, ext = false } = {}) {
  // v0.48 `ext: true`: the area added by a map extension (GRA, the east). The earlier phases use exactly the roads and
  // the area they had before, so their random sequences (and every stall, tree and keke) stay the same.
  const EX = map.meta.extensions?.[0]?.before, extRoads = EX?.roads ?? Infinity, extBounds = EX?.playBounds ?? map.bounds;
  if (ext) extra = true;
  const group = new THREE.Group(); group.name = ext ? 'Props (extension)' : extra ? 'Props (new area)' : 'Props';
  const nightMaterials = [];
  const inStadium=(x,z)=>map.stadiumSite&&inPoly(x,z,map.stadiumSite.pts);
  const rng = mulberry32(ext ? 7070 : extra ? 4048 : 2024);
  const legacyRoads = map.meta.legacy?.roads ?? Infinity;
  const roads = map.roads.filter((r, i) => ext ? i >= extRoads : extra ? i >= legacyRoads && i < extRoads : i < legacyRoads);
  const oldBounds = map.meta.legacy?.playBounds ?? map.bounds;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const stats = {};

  // ------------------------------------------------------------ poles + cables
  const poles = [];
  const wire = [];
  for (const road of roads) {
    if (road.elevated || ['footway', 'path', 'steps', 'track', 'construction'].includes(road.type) || road.length < 25) continue;
    const side = hashString(road.id) % 2 ? 1 : -1;
    const off = road.width / 2 + 3.2;
    const line = offsetPolyline(road.points, side * off);
    let prev = null;
    sampleAlong(line, isMajorRoad(road) ? 30 : 34, 6, (x, z, dx, dz) => {
      if (!safePoleSite(map, collision, x, z, .55)) { prev = null; return; }
      const pole = { x, z, dx, dz, toRoad: side > 0 ? 1 : -1 };
      poles.push(pole);
      collision.addCircle(x, z, 0.16);
      if (prev && Math.hypot(prev.x - x, prev.z - z) < 48) wire.push([prev, pole]);
      prev = pole;
    });
  }
  if (poles.length) {
    const poleGeo = new THREE.CylinderGeometry(0.1, 0.14, 9, 7); poleGeo.translate(0, 4.5, 0);
    const armGeo = new THREE.BoxGeometry(1.7, 0.1, 0.1); armGeo.translate(0, 8.5, 0);
    const insGeo = new THREE.CylinderGeometry(0.04, 0.05, 0.16, 6);
    const poleMesh = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#a9a49a', roughness: 0.95 }), poles.length);
    const armMesh = new THREE.InstancedMesh(armGeo, new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.9 }), poles.length);
    const lampGeo = new THREE.BoxGeometry(0.22, 0.12, 0.5); lampGeo.translate(0, 7.6, 0.45);
    const lampMat = new THREE.MeshStandardMaterial({ color: '#d9d4c0', emissive: '#ffd27a', emissiveIntensity: 0, roughness: 0.4 });
    const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, poles.length);
    const insMesh = new THREE.InstancedMesh(insGeo, new THREE.MeshStandardMaterial({ color: '#e8e2d0', roughness: 0.4 }), poles.length * 3);
    poles.forEach((pl, i) => {
      const yaw = Math.atan2(pl.dx, pl.dz); // local X is perpendicular to road travel
      q.setFromAxisAngle(up, yaw);
      m4.compose(p.set(pl.x, 0, pl.z), q, s.set(1, 1, 1));
      poleMesh.setMatrixAt(i, m4); armMesh.setMatrixAt(i, m4);
      const lq = new THREE.Quaternion().setFromAxisAngle(up, yaw + Math.PI / 2 + (pl.toRoad > 0 ? 0 : Math.PI)); // lamp arm faces the road
      m4.compose(p.set(pl.x, 0, pl.z), lq, s.set(1, 1, 1)); lampMesh.setMatrixAt(i, m4);
      for (let k = 0; k < 3; k++) {
        const o = (k - 1) * 0.7;
        m4.compose(p.set(pl.x + Math.cos(yaw) * o, 8.63, pl.z - Math.sin(yaw) * o), q, s.set(1, 1, 1));
        insMesh.setMatrixAt(i * 3 + k, m4);
      }
      pl.yaw = yaw;
    });
    poleMesh.castShadow = true; armMesh.castShadow = true;
    group.add(poleMesh, armMesh, insMesh, lampMesh);
    nightMaterials.push({ mat: lampMat, max: 2.2, grid: true }); // street lights: off in a power cut

    const pos = [];
    for (const [a, b] of wire) for (let k = 0; k < 3; k++) {
      const oa = (k - 1) * 0.7;
      const A=wirePin(a,oa),B=wirePin(b,oa);
      const ax=A.x,az=A.z,bx=B.x,bz=B.z;
      const N = 8, sag = 0.55 + k * 0.08;
      for (let j = 0; j < N; j++) {
        const t0 = j / N, t1 = (j + 1) / N;
        const y0 = 8.7 - sag * 4 * t0 * (1 - t0), y1 = 8.7 - sag * 4 * t1 * (1 - t1);
        pos.push(ax + (bx - ax) * t0, y0, az + (bz - az) * t0, ax + (bx - ax) * t1, y1, az + (bz - az) * t1);
      }
    }
    const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const wires = new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ color: '#1a1a1a', transparent: true, opacity: 0.85 }));
    wires.name = 'cables';
    group.add(wires);
  }
  stats.poles = poles.length; group.userData.utilityPoles=poles; group.userData.wireSpans=wire.length;

  // ------------------------------------------------------------ market stalls with umbrellas
  const stalls = [];
  const markets = landmarks ? landmarks.list.filter((l) => l.kind === 'market' || l.kind === 'bridgehead') : [];
  const inMarket = (x, z) => markets.some((l) => Math.hypot(x - l.x, z - l.z) < l.radius);
  for (const road of roads) {
    if (road.elevated || road.type === 'construction' || ['footway', 'path', 'steps'].includes(road.type)) continue;
    const major = isMajorRoad(road);
    const nearMarket = road.points.some(([x, z]) => inMarket(x, z));
    if (!major && !nearMarket) continue;
    for (const side of [1, -1]) {
      const line = offsetPolyline(road.points, side * (road.width / 2 + 1.55));
      sampleAlong(line, nearMarket ? 5 : 7, rng() * 5, (x, z, dx, dz) => {
        const m = inMarket(x, z);
        if (!major && !m) return;
        if (rng() > (m ? 0.62 : 0.2) * density) return;
        if (inStadium(x,z)||!collision.isFree(x, z, 1.0)) return;
        const st = { x, z, yaw: Math.atan2(dx, dz) + (side > 0 ? 0 : Math.PI), variant: Math.floor(rng() * 4), r: rng(), nx: -dz * side, nz: dx * side };
        st.ci = collision.addCircle(x, z, 0.75);
        // beside this road but on another one (a junction, the far carriageway): not drawn, no trader; its
        // collider is taken out once everything is placed, so the placement of everything else is unchanged
        st.hidden = !!map.onCarriageway(x, z, 0.5) || inMarket(x,z);
        stalls.push(st);
      });
    }
  }
  if (stalls.length) {
    const canopyGeos = [0, 1, 2, 3].map((k) => {
      const g = new THREE.ConeGeometry(1.3, 0.5, 8, 1, true);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - (k + 1) / 4 + 0.01 + uv.getY(i) * 0.23);
      g.translate(0, 2.35, 0);
      return g;
    });
    const canopyMat = new THREE.MeshStandardMaterial({ map: umbrellaTex, roughness: 0.8, side: THREE.DoubleSide });
    const byVar = [0, 1, 2, 3].map((k) => stalls.filter((st) => st.variant === k));
    byVar.forEach((list, k) => {
      if (!list.length) return;
      const mesh = new THREE.InstancedMesh(canopyGeos[k], canopyMat, list.length);
      list.forEach((st, i) => { q.setFromAxisAngle(up, st.r * 6); const k = st.hidden ? 0 : 1; m4.compose(p.set(st.x, 0, st.z), q, s.set(k, k, k)); mesh.setMatrixAt(i, m4); });
      mesh.castShadow = true; group.add(mesh);
    });
    const poleGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.4, 5); poleGeo.translate(0, 1.2, 0);
    const tableGeo = new THREE.BoxGeometry(1.3, 0.08, 0.75); tableGeo.translate(0, 0.82, 0);
    const goodsGeo = new THREE.BoxGeometry(0.28, 0.2, 0.22); goodsGeo.translate(0, 0.96, 0);
    const basinGeo = new THREE.CylinderGeometry(0.26, 0.2, 0.14, 8); basinGeo.translate(0, 0.93, 0);
    const pole = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: '#777' }), stalls.length);
    const table = new THREE.InstancedMesh(tableGeo, new THREE.MeshStandardMaterial({ color: '#8b6a4a', roughness: 0.95 }), stalls.length);
    const legGeo = new THREE.BoxGeometry(0.06, 0.8, 0.06);
    const legs = new THREE.InstancedMesh(legGeo, new THREE.MeshStandardMaterial({ color: '#4a3826' }), stalls.length * 4);
    const goods = new THREE.InstancedMesh(goodsGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), stalls.length * 3);
    const basins = new THREE.InstancedMesh(basinGeo, new THREE.MeshStandardMaterial({ roughness: 0.5 }), stalls.length);
    const gcols = ['#d62828', '#f77f00', '#fcbf49', '#2a9d8f', '#ffffff', '#1d3557', '#6a994e', '#e76f51'];
    const bcols = ['#c1121f', '#e85d04', '#2b9348', '#ffba08']; // tomatoes, peppers, greens, garri
    const col = new THREE.Color();
    const hide = (mesh, n) => { m4.makeScale(0, 0, 0); for (let k = 0; k < n.length; k++) mesh.setMatrixAt(n[k], m4); };
    stalls.forEach((st, i) => {
      q.setFromAxisAngle(up, st.yaw);
      m4.compose(p.set(st.x, 0, st.z), q, s.set(1, 1, 1));
      pole.setMatrixAt(i, m4); table.setMatrixAt(i, m4);
      const fx = Math.sin(st.yaw), fz = Math.cos(st.yaw), rx = fz, rz = -fx;
      [[-0.6, -0.33], [0.6, -0.33], [-0.6, 0.33], [0.6, 0.33]].forEach(([a, c], k) => {
        m4.compose(p.set(st.x + rx * a + fx * c, 0.4, st.z + rz * a + fz * c), q, s.set(1, 1, 1));
        legs.setMatrixAt(i * 4 + k, m4);
      });
      for (let k = 0; k < 3; k++) {
        const o = (k - 1) * 0.38;
        m4.compose(p.set(st.x + rx * o + fx * 0.12, 0, st.z + rz * o + fz * 0.12), q, s.set(1, 1, 1));
        goods.setMatrixAt(i * 3 + k, m4);
        goods.setColorAt(i * 3 + k, col.set(gcols[Math.floor(rng() * gcols.length)]));
      }
      m4.compose(p.set(st.x - fx * 0.18, 0, st.z - fz * 0.18), q, s.set(1, 1, 1));
      basins.setMatrixAt(i, m4); basins.setColorAt(i, col.set(bcols[Math.floor(rng() * bcols.length)]));
      if (st.hidden) { hide(pole, [i]); hide(table, [i]); hide(basins, [i]); hide(legs, [i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 3]); hide(goods, [i * 3, i * 3 + 1, i * 3 + 2]); }
    });
    for (const m of [pole, table, legs, goods, basins]) { m.castShadow = true; group.add(m); }
  }
  stats.stalls = stalls.length;

  // ------------------------------------------------------------ trees
  const trees = [];
  const b = ext ? (map.fullBounds ?? map.bounds) : extra ? extBounds : oldBounds;
  const inExt = (x, z) => x > extBounds.minX && x < extBounds.maxX && z > extBounds.minZ && z < extBounds.maxZ;
  const inOld = (x, z) => x > oldBounds.minX && x < oldBounds.maxX && z > oldBounds.minZ && z < oldBounds.maxZ;
  for (let k = 0; k < 40000 && trees.length < (ext ? 700 : extra ? 260 : 1100) * density; k++) {
    const x = b.minX + rng() * (b.maxX - b.minX), z = b.minZ + rng() * (b.maxZ - b.minZ);
    if (extra && inOld(x, z)) continue;
    if (ext && inExt(x, z)) continue;
    const nr = map.nearestRoad(x, z, { maxDist: 12 });
    if (nr && nr.dist < nr.road.width / 2 + 2.6) continue;
    if (inStadium(x,z)||!collision.isFree(x, z, 2.2)) continue;
    trees.push({ x, z, s: 0.75 + rng() * 0.6, r: rng() });
    trees[trees.length-1].ci = collision.addCircle(x, z, 0.3);
  }
  // A large water polygon's interior is not indexed by the edge-only collision grid.
  // Filter explicitly, after generation so legacy random sequences stay stable.
  for(let i=trees.length-1;i>=0;i--){const t=trees[i];if([[0,0],[-2,-2],[2,-2],[-2,2],[2,2]].some(([a,b])=>map.water.some(w=>inPoly(t.x+a,t.z+b,w.outer)))){collision.removeCircle(t.ci);trees.splice(i,1);}}
  if (trees.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.24, 2.6, 7); trunkGeo.translate(0, 1.3, 0);
    const crownGeo = new THREE.IcosahedronGeometry(2.4, 1);
    const cp = crownGeo.attributes.position, tr = mulberry32(77);
    for (let i = 0; i < cp.count; i++) { const k = 0.85 + tr() * 0.3; cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k * 0.72, cp.getZ(i) * k); }
    crownGeo.computeVertexNormals(); crownGeo.translate(0, 3.9, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: '#5b4636', roughness: 1 }), trees.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), trees.length);
    const col = new THREE.Color();
    trees.forEach((t, i) => {
      q.setFromAxisAngle(up, t.r * 6.28);
      m4.compose(p.set(t.x, 0, t.z), q, s.set(t.s, t.s, t.s));
      trunks.setMatrixAt(i, m4); crowns.setMatrixAt(i, m4);
      crowns.setColorAt(i, col.setHSL(0.27 + t.r * 0.06, 0.45, 0.2 + t.r * 0.08));
    });
    trunks.castShadow = crowns.castShadow = true;
    group.add(trunks, crowns);
  }
  stats.trees = trees.length;group.userData.treeSites=trees.map(t=>({x:t.x,z:t.z}));

  // ------------------------------------------------------------ keke waiting point(s)
  const kekes = [];
  const spots = extra ? [] : pickKekeSpots(map, landmarks, spawn, roads);
  for (const sp of spots) {
    for (let k = 0; k < sp.count; k++) {
      const d = k * 3.1;
      const x = sp.x + sp.dx * d, z = sp.z + sp.dz * d;
      if (inStadium(x,z)||!collision.isFree(x, z, 1.0)) continue;
      const kk = { x, z, yaw: Math.atan2(sp.dx, sp.dz) + (rng() - 0.5) * 0.15, c: k % 4, first: k === 0, nx: -sp.dz, nz: sp.dx };
      kk.ci = [collision.addCircle(x + sp.dx * 0.7, z + sp.dz * 0.7, 0.7), collision.addCircle(x - sp.dx * 0.7, z - sp.dz * 0.7, 0.7)];
      kk.hidden = !!map.onCarriageway(x, z, 0.2);
      kekes.push(kk);
    }
  }
  if (kekes.length) {
    const geo = buildKekeGeometry();
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }), kekes.length);
    kekes.forEach((kk, i) => { q.setFromAxisAngle(up, kk.yaw); const k = kk.hidden ? 0 : 1; m4.compose(p.set(kk.x, 0, kk.z), q, s.set(k, k, k)); mesh.setMatrixAt(i, m4); });
    mesh.castShadow = true; mesh.name = 'parkedKeke';
    group.add(mesh);
  }
  stats.kekes = kekes.length;
  // No standalone decorative cars along roads or scattered through the city.
  // Marked mall parking is built separately by MallPrecinct; owned vehicles and moving traffic remain.
  const parked=[]; stats.parkedCars=0;

  const cells = cellify(group, 300);
  stats.onRoadsHidden = [...stalls, ...kekes, ...parked].filter((o) => o.hidden).length;
  return { group, stats, nightMaterials, cells, stallSpots: stalls, kekeSpots: kekes, parked, update: (x, z, radius) => {
    for (const c of cells.values()) c.visible = Math.hypot(c.userData.cx - x, c.userData.cz - z) - 212 < radius;
  } };
}

/**
 * Split every whole-map InstancedMesh / LineSegments into per-cell objects so the GPU only draws
 * props near the camera (frustum + distance culling). Geometry and materials are shared.
 */
function cellify(group, cell) {
  const cells = new Map();
  const get = (x, z) => {
    const gx = Math.floor(x / cell), gz = Math.floor(z / cell), k = gx + ',' + gz;
    if (!cells.has(k)) {
      const g = new THREE.Group(); g.name = 'props:' + k; g.userData = { cx: (gx + 0.5) * cell, cz: (gz + 0.5) * cell };
      cells.set(k, g); group.add(g);
    }
    return cells.get(k);
  };
  const m4 = new THREE.Matrix4(), col = new THREE.Color();
  for (const obj of [...group.children]) {
    if (obj.isInstancedMesh) {
      const by = new Map();
      const a = obj.instanceMatrix.array;
      for (let i = 0; i < obj.count; i++) {
        const x = a[i * 16 + 12], z = a[i * 16 + 14];
        const k = Math.floor(x / cell) + ',' + Math.floor(z / cell);
        if (!by.has(k)) by.set(k, { x, z, ids: [] }); by.get(k).ids.push(i);
      }
      for (const { x, z, ids } of by.values()) {
        const m = new THREE.InstancedMesh(obj.geometry, obj.material, ids.length);
        ids.forEach((src, j) => {
          obj.getMatrixAt(src, m4); m.setMatrixAt(j, m4);
          if (obj.instanceColor) { obj.getColorAt(src, col); m.setColorAt(j, col); }
        });
        m.castShadow = obj.castShadow; m.receiveShadow = obj.receiveShadow; m.name = obj.name;
        m.computeBoundingSphere();
        get(x, z).add(m);
      }
      group.remove(obj);
    } else if (obj.isLineSegments) {
      const pa = obj.geometry.attributes.position.array, by = new Map();
      for (let i = 0; i < pa.length; i += 6) {
        const mx = (pa[i] + pa[i + 3]) / 2, mz = (pa[i + 2] + pa[i + 5]) / 2;
        const k = Math.floor(mx / cell) + ',' + Math.floor(mz / cell);
        if (!by.has(k)) by.set(k, { x: mx, z: mz, v: [] });
        by.get(k).v.push(pa[i], pa[i + 1], pa[i + 2], pa[i + 3], pa[i + 4], pa[i + 5]);
      }
      for (const { x, z, v } of by.values()) {
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
        get(x, z).add(new THREE.LineSegments(g, obj.material));
      }
      group.remove(obj); obj.geometry.dispose();
    }
  }
  return cells;
}

/** Kerbside spots on major roads near the spawn junction and two other busy junctions. */
function pickKekeSpots(map, landmarks, spawn, roads = map.roads) {
  const out = [];
  const majors = roads.filter((r) => isMajorRoad(r) && !r.elevated && r.type !== 'construction' && r.name);
  const centres = [spawn ? [spawn.x, spawn.z] : map.spawn];
  for (const id of ['main-market', 'bridgehead', 'ochanja', 'upper-iweka', 'shoprite']) { const l = landmarks?.get(id); if (l) centres.push([l.x, l.z]); }
  for (const [sx, sz] of centres) {
  const cand = [];
  for (const r of majors) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const [ax, az] = r.points[i], [bx, bz] = r.points[i + 1];
      const L = Math.hypot(bx - ax, bz - az); if (L < 22) continue;
      const dx = (bx - ax) / L, dz = (bz - az) / L;
      const mx = ax + dx * 6, mz = az + dz * 6;
      const off = r.width / 2 - 1.1; // on the carriageway edge, where kekes actually wait
      cand.push({ x: mx + -dz * off, z: mz + dx * off, dx, dz, d: Math.hypot(mx - sx, mz - sz) });
    }
  }
  cand.sort((a, b) => a.d - b.d);
  const c = cand.find((cc) => out.every((o) => Math.hypot(o.x - cc.x, o.z - cc.z) > 120));
  if (c && c.d < 400) out.push({ ...c, count: out.length === 0 ? 5 : 4 });
  }
  return out;
}
