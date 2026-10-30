/**
 * The playable area (v0.48). Onitsha only. Anything outside the approved Onitsha boundary is COMING SOON:
 * it may stay visible (its buildings are kept) but players, their vehicles, traffic, public transport and
 * the GPS can't go there.
 *
 * Today's boundary: the River Niger. Everything west of the middle of the main channel is the Asaba bank (Delta
 * State). The middle of the channel is found from the river polygon of the OSM export, row by row (every 5 m
 * north–south): at each row the widest stretch of water is the main channel, and its midpoint is the line.
 * When the map is extended from a new OSM export with LGA boundaries, `polygons` (Onitsha North + South) is
 * used as well: outside them is COMING SOON too.
 *
 * Pure: no Three.js, no DOM (unit-tested).
 */
// lat/lon are approximate town centres read off the OpenStreetMap map (only used to name the signs at the map edge)
export const COMING_SOON = [
  { id: 'asaba', name: 'Asaba', state: 'Delta State', lat: 6.1855, lon: 6.7309 },
  { id: 'nkpor', name: 'Nkpor', state: 'Anambra State', lat: 6.1456, lon: 6.8331 },
  { id: 'obosi', name: 'Obosi', state: 'Anambra State', lat: 6.1164, lon: 6.8331 },
  { id: 'okpoko', name: 'Okpoko', state: 'Anambra State', lat: 6.1202, lon: 6.7861 },
  // (Awada is not listed: in the OpenStreetMap boundaries it lies inside Onitsha North, so it is open)
  // parts of Onitsha that aren't in the map yet (they open when the map is extended)
  { id: 'gra', name: 'GRA', state: 'Onitsha', lat: 6.1787, lon: 6.7885, onitsha: true },
  { id: 'gra2', name: 'GRA Phase II', state: 'Onitsha', lat: 6.1705, lon: 6.8122, onitsha: true },
];
/** Same projection as the OSM extractor (x east, z south, metres from the map origin). */
export function project(meta, lat, lon) { return { x: (lon - meta.origin.lon) * meta.metresPerDegree.lon, z: -(lat - meta.origin.lat) * meta.metresPerDegree.lat }; }
/** The COMING SOON place a road leaving the map at (x, z) heads towards (direction dx, dz). */
export function placeBeyond(meta, x, z, dx, dz) {
  // the place most nearly straight ahead along the road (within 8 km)
  let best = null, ba = Infinity;
  for (const p of COMING_SOON) {
    if (p.id === 'asaba' || (p.onitsha && meta.extensions?.length)) continue; const q = project(meta, p.lat, p.lon), vx = q.x - x, vz = q.z - z, d = Math.hypot(vx, vz); if (d > 8000 || d < 1) continue;
    const ang = Math.acos(Math.max(-1, Math.min(1, (vx * dx + vz * dz) / d))); if (ang < ba) { ba = ang; best = p; }
  }
  return ba < 1.2 ? best : null;
}

function crossings(poly, z) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x1, z1] = poly[i], [x2, z2] = poly[j];
    if ((z1 > z) !== (z2 > z)) xs.push(x1 + ((z - z1) * (x2 - x1)) / (z2 - z1));
  }
  return xs.sort((a, b) => a - b);
}
function inPoly(x, z, pts) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}

export class PlayArea {
  /** map: {water:[{outer}], bounds}; polygons: optional Onitsha LGA outlines [[x,z]...] */
  constructor(map, { polygons = map.meta?.playPolygons?.map((p) => p.pts) ?? null, outside = map.meta?.playPolygonsOutside ?? null } = {}) {
    this.bounds = map.fullBounds ?? map.bounds; this.polygons = polygons?.length ? polygons : null; this.outside = outside; this.meta = map.meta ?? null;
    this.step = 5; this.rows = new Map();
    const river = (map.water ?? []).filter((w) => /niger/i.test(w.name ?? '') || w.kind === 'river');
    const b = map.fullBounds ?? map.bounds;
    if (river.length) for (let z = Math.floor(b.minZ / this.step) * this.step; z <= b.maxZ + this.step; z += this.step) {
      let best = null;
      for (const w of river) { const xs = crossings(w.outer, z); for (let i = 0; i + 1 < xs.length; i += 2) { const L = xs[i + 1] - xs[i]; if (!best || L > best.L) best = { L, mid: (xs[i] + xs[i + 1]) / 2 }; } }
      if (best && best.L > 60) this.rows.set(z, best.mid);
    }
    const keys = [...this.rows.keys()].sort((a, b) => a - b); this.zs = keys;
  }
  /** x of the boundary line (middle of the Niger) at row z, or null when there's no river line. */
  lineX(z) {
    if (!this.zs.length) return null;
    const k = Math.round(z / this.step) * this.step;
    if (this.rows.has(k)) return this.rows.get(k);
    // beyond the river's rows: the nearest row
    const near = z < this.zs[0] ? this.zs[0] : z > this.zs[this.zs.length - 1] ? this.zs[this.zs.length - 1] : this.zs.reduce((a, q) => (Math.abs(q - z) < Math.abs(a - z) ? q : a));
    return this.rows.get(near);
  }
  /** Which COMING SOON place (x, z) is in, or null if it's playable Onitsha. */
  lockedAt(x, z, margin = 0) {
    const lx = this.lineX(z);
    if (lx != null && x < lx + margin) return COMING_SOON[0];
    const o = this.outside, inOld = o && x >= o.minX && x <= o.maxX && z >= o.minZ && z <= o.maxZ;
    if (this.polygons && !inOld && !this.polygons.some((p) => inPoly(x, z, p))) return this.nearestOutside(x, z);
    return null;
  }
  locked(x, z) { return !!this.lockedAt(x, z); }
  /** The same answer from a 10 m raster (filled as it is asked), for code that asks millions of times (v0.49). */
  lockedFast(x, z) {
    const k = Math.floor(x / 10) * 100003 + Math.floor(z / 10); const m = (this._fast ??= new Map()); let v = m.get(k);
    if (v === undefined) { v = this.locked((Math.floor(x / 10) + 0.5) * 10, (Math.floor(z / 10) + 0.5) * 10); m.set(k, v); }
    return v;
  }
  nearestOutside(x, z) {
    let best = null, bd = Infinity;
    if (this.meta) for (const p of COMING_SOON) { if (p.onitsha || p.id === 'asaba') continue; const q = project(this.meta, p.lat, p.lon), d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = p; } }
    return best ?? { id: 'outside', name: 'Beyond Onitsha', state: 'Anambra State' };
  }
  /** A playable point near (x, z): east of the river line (used to move a saved player out). */
  clamp(x, z, margin = 6) { const lx = this.lineX(z); return lx != null && x < lx + margin ? { x: lx + margin, z } : { x, z }; }
}
