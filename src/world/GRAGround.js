import * as THREE from 'three';
/*
  v0.52: GRA looks different underfoot. Inside both GRAs (where the map's premium area is at least half "in"):
  - every road that cars use is tarred (asphalt), even where the map data says dirt;
  - the open land is poured concrete in 3 m slabs instead of red earth.
  Pure data changes first (pave), then one flat mesh per GRA (ground).
*/
const FOOT = new Set(['footway', 'path', 'steps', 'pedestrian', 'cycleway', 'bridleway', 'construction', 'proposed']);
/** Mark the roads inside GRA as tarred. Returns how many were changed from dirt. */
export function paveGRARoads(map, districts) {
  let n = 0;
  for (const r of map.roads) {
    if (r.elevated || FOOT.has(r.type)) continue;
    const P = r.points; let inside = 0; for (const [x, z] of P) if (districts.premiumAt(x, z) > 0.5) inside++;
    const mid = P[Math.floor(P.length / 2)];
    if (inside * 2 < P.length && !(districts.premiumAt(mid[0], mid[1]) > 0.5)) continue;
    if (r.surface === 'dirt' || r.type === 'track') n++;
    r.surface = 'asphalt'; r.graPaved = true;
  }
  return n;
}
/** The concrete ground of each GRA: a flat disc (or the GRA polygon) just above the earth, under roads and buildings. */
export function buildGRAGround(districts, texture) {
  const group = new THREE.Group(); group.name = 'GRAGround';
  const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const areas = [];
  for (const a of districts.premium ?? []) {
    if (a.preview) continue;
    const ring = a.pts ?? Array.from({ length: 128 }, (_, i) => { const q = i / 128 * Math.PI * 2, r = a.r - 60; return [a.x + Math.cos(q) * r, a.z + Math.sin(q) * r]; });
    const geo = new THREE.ShapeGeometry(new THREE.Shape(ring.map(([x, z]) => new THREE.Vector2(x, -z))));
    geo.rotateX(-Math.PI / 2); geo.translate(0, 0.02, 0);
    const pos = geo.attributes.position, uv = geo.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 3, pos.getZ(i) / 3);
    const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; m.name = 'gra-concrete'; group.add(m); areas.push({ name: a.name, ring });
  }
  return { group, areas };
}
