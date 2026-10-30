import * as THREE from 'three';
import { GeoBuilder } from './GeoBuilder.js';

/**
 * Ground built from the OSM land polygons (play area minus the River Niger), the river surface,
 * and laterite banks where land meets water. River polygons are added as colliders.
 */
export function buildTerrain(map, tex, collision) {
  const group = new THREE.Group(); group.name = 'Terrain';
  const toShape = (outer, holes) => {
    const shape = new THREE.Shape(outer.map(([x, z]) => new THREE.Vector2(x, -z)));
    for (const h of holes ?? []) shape.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))));
    return shape;
  };

  // ground
  const land = map.land?.length ? map.land : [{ outer: rectAround(map.fullBounds ?? map.bounds, 500), holes: [] }];
  const geos = land.map((l) => {
    const g = new THREE.ShapeGeometry(toShape(l.outer, l.holes));
    g.rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 14, uv.getY(i) / 14);
    return g;
  });
  const groundMat = new THREE.MeshStandardMaterial({ map: tex.ground, roughness: 1 });
  for (const g of geos) { const m = new THREE.Mesh(g, groundMat); m.receiveShadow = true; m.name = 'ground'; group.add(m); }

  // banks: steep laterite skirt down to the water along every land edge that borders water
  const bank = new GeoBuilder();
  // v0.49: a bounding box per water polygon first (exact same answer, far fewer full polygon tests)
  const wbox = map.water.map((w) => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; for (const [x, z] of w.outer) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, z); d = Math.max(d, z); } return { w, a, b, c, d }; });
  const waterTest = (x, z) => wbox.some((q) => x >= q.a && x <= q.b && z >= q.c && z <= q.d && inPoly(x, z, q.w.outer));
  const col = new THREE.Color('#ffffff');
  const skirt = (ring) => {
    for (let i = 0; i < ring.length; i++) {
      const [ax, az] = ring[i], [bx, bz] = ring[(i + 1) % ring.length];
      const L = Math.hypot(bx - ax, bz - az); if (L < 0.1) continue;
      const mx = (ax + bx) / 2, mz = (az + bz) / 2;
      let nx = (bz - az) / L, nz = -(bx - ax) / L;
      if (!waterTest(mx + nx * 3, mz + nz * 3)) { if (waterTest(mx - nx * 3, mz - nz * 3)) { nx = -nx; nz = -nz; } else continue; }
      const sl = 2.2; // bank slopes out into the water
      bank.quad([[ax, 0.02, az], [bx, 0.02, bz], [bx + nx * sl, -1.6, bz + nz * sl], [ax + nx * sl, -1.6, az + nz * sl]],
        [[0, 0], [L / 6, 0], [L / 6, 0.4], [0, 0.4]], [nx * 0.6, 0.8, nz * 0.6], col);
    }
  };
  for (const l of land) { skirt(l.outer); for (const h of l.holes ?? []) skirt(h); }
  if (bank.vertexCount) {
    const m = new THREE.Mesh(bank.build(), new THREE.MeshStandardMaterial({ map: tex.dirtRoad, roughness: 1, color: '#b08a6a' }));
    m.receiveShadow = true; m.name = 'riverbank'; group.add(m);
  }

  // river surface: one big plane below ground level; land covers it everywhere except the river
  const b = map.fullBounds ?? map.bounds, pad = 3000;
  const wGeo = new THREE.PlaneGeometry(b.maxX - b.minX + pad * 2, b.maxZ - b.minZ + pad * 2, 1, 1);
  wGeo.rotateX(-Math.PI / 2); wGeo.translate((b.minX + b.maxX) / 2, -0.75, (b.minZ + b.maxZ) / 2);
  const normal = tex.waterNormal; normal.repeat.set(220, 220);
  const waterMat = new THREE.MeshStandardMaterial({ color: '#3e7780', roughness: 0.27, metalness: 0.12, normalMap: normal, normalScale: new THREE.Vector2(0.5, 0.5) });
  const water = new THREE.Mesh(wGeo, waterMat); water.name = 'river'; water.receiveShadow = true;
  group.add(water);

  for (const w of map.water) collision.addPolygon(w.outer, 0);

  let t = 0;
  return {
    group,
    update(dt) { t += dt; normal.offset.set(t * 0.004, t * 0.0025); },
    isWater: waterTest,
  };
}

function rectAround(b, pad) { return [[b.minX - pad, b.minZ - pad], [b.maxX + pad, b.minZ - pad], [b.maxX + pad, b.maxZ + pad], [b.minX - pad, b.maxZ + pad]]; }
export function inPoly(x, z, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
