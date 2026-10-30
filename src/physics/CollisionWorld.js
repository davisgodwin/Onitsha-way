import { pointInPolygon } from '../core/utils.js';

/**
 * 2D (top-down) collision world. The city is effectively flat, so walls are line segments and
 * characters / props are circles. A uniform grid keeps queries O(nearby) — cheap enough to run
 * for the player plus dozens of NPCs per frame in later milestones.
 */
export class CollisionWorld {
  constructor(cellSize = 8) {
    this.cs = cellSize;
    this.grid = new Map();
    this.edges = [];      // {ax, az, bx, bz, nx, nz, poly}
    this.polys = [];      // {pts, height, minX, maxX, minZ, maxZ}
    this.circles = [];    // {x, z, r}
    this.circleGrid = new Map();
    this.bounds = null;
  }

  _key(gx, gz) { return gx * 73856093 ^ gz * 19349663; }
  _cellsFor(minX, minZ, maxX, maxZ, cb) {
    const cs = this.cs;
    for (let gx = Math.floor(minX / cs); gx <= Math.floor(maxX / cs); gx++)
      for (let gz = Math.floor(minZ / cs); gz <= Math.floor(maxZ / cs); gz++) cb(this._key(gx, gz));
  }

  setBounds(b) { this.bounds = b; }
  /** Extra rectangles outside the play bounds where movement is allowed (home interiors). */
  addZone(z) { (this.zones ??= []).push(z); }
  inZone(x, z) { return !!this.zones?.some((q) => x >= q.minX && x <= q.maxX && z >= q.minZ && z <= q.maxZ); }

  /** pts: [[x,z],...] counter-clockwise (positive signed area). */
  addPolygon(pts, height = 3) {
    const pi = this.polys.length;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    this.polys.push({ pts, height, minX, maxX, minZ, maxZ, tag: this.tag ?? 0, e0: this.edges.length, en: pts.length }); // tag: v0.48 map-extension phase; e0/en: its walls (v0.54.2)
    for (let i = 0; i < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
      const L = Math.hypot(bx - ax, bz - az) || 1;
      const ei = this.edges.length;
      this.edges.push({ ax, az, bx, bz, nx: (bz - az) / L, nz: -(bx - ax) / L, poly: pi });
      this._cellsFor(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), (k) => {
        if (!this.grid.has(k)) this.grid.set(k, []);
        this.grid.get(k).push(ei);
      });
    }
    return pi;
  }

  addCircle(x, z, r) {
    const ci = this.circles.length;
    this.circles.push({ x, z, r, tag: this.tag ?? 0 });
    this._cellsFor(x - r, z - r, x + r, z + r, (k) => {
      if (!this.circleGrid.has(k)) this.circleGrid.set(k, []);
      this.circleGrid.get(k).push(ci);
    });
    return ci;
  }

  /** Take a circle out again (a prop that turned out to stand on a road). */
  removeCircle(ci) {
    const c = this.circles[ci]; if (!c) return;
    this._cellsFor(c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r, (k) => { const l = this.circleGrid.get(k); if (l) { const i = l.indexOf(ci); if (i >= 0) l.splice(i, 1); } });
  }

  /** Take a polygon (and its walls) out again. */
  removePolygon(pi) {
    const p = this.polys[pi]; if (!p) return;
    // v0.54.2: only this polygon's own walls (they were added together), not a scan of every wall in the city
    const from = p.e0 ?? 0, to = p.e0 != null ? p.e0 + p.en : this.edges.length;
    for (let ei = from; ei < to; ei++) { const e = this.edges[ei];
      if (e.poly !== pi) continue;
      this._cellsFor(Math.min(e.ax, e.bx), Math.min(e.az, e.bz), Math.max(e.ax, e.bx), Math.max(e.az, e.bz), (k) => { const l = this.grid.get(k); if (l) { const i = l.indexOf(ei); if (i >= 0) l.splice(i, 1); } });
    }
    p.minX = p.minZ = Infinity; p.maxX = p.maxZ = -Infinity; // never "inside" it again
  }

  _nearbyEdges(minX, minZ, maxX, maxZ) {
    // v0.54.4: same edges in the same order as before, de-duplicated with a stamp array instead of a Set
    const out = [], cs = this.cs, n = this.edges.length;
    if (!this._stamp || this._stamp.length < n) { this._stamp = new Uint32Array(n + 4096); this._mk = 0; }
    if (++this._mk >= 0xffffffff) { this._stamp.fill(0); this._mk = 1; }
    const st = this._stamp, mk = this._mk;
    for (let gx = Math.floor(minX / cs); gx <= Math.floor(maxX / cs); gx++)
      for (let gz = Math.floor(minZ / cs); gz <= Math.floor(maxZ / cs); gz++) {
        const l = this.grid.get(this._key(gx, gz)); if (l) for (let i = 0; i < l.length; i++) { const e = l[i]; if (st[e] !== mk) { st[e] = mk; out.push(e); } }
      }
    return out;
  }

  /** Is the point inside any building footprint? */
  insidePolygon(x, z, ignoreTag = null) {
    for (const ei of this._nearbyEdges(x, z, x, z)) {
      const p = this.polys[this.edges[ei].poly];
      if (ignoreTag != null && p.tag === ignoreTag) continue;
      if (x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ && pointInPolygon(x, z, p.pts)) return p;
    }
    return null;
  }

  /** True when a circle at (x,z) touches nothing. */
  /** ignoreTag (v0.48): leave out colliders added with that tag (the map extension), to place things of the earlier map exactly as before. */
  isFree(x, z, r, ignoreTag = null) {
    if (this.insidePolygon(x, z, ignoreTag)) return false;
    for (const ei of this._nearbyEdges(x - r, z - r, x + r, z + r)) {
      const e = this.edges[ei];
      if (ignoreTag != null && this.polys[e.poly]?.tag === ignoreTag) continue;
      if (distToSeg(x, z, e) < r) return false;
    }
    for (const ci of this.circleGrid.get(this._key(Math.floor(x / this.cs), Math.floor(z / this.cs))) ?? []) {
      const c = this.circles[ci];
      if (ignoreTag != null && c.tag === ignoreTag) continue;
      if (Math.hypot(x - c.x, z - c.z) < r + c.r) return false;
    }
    return true;
  }

  /** Push a circle out of walls and props. Mutates and returns pos {x, z}. */
  resolveCircle(pos, r) {
    // escaped inside a footprint (e.g. bad spawn / teleport)? move to nearest outside point
    const inside = this.insidePolygon(pos.x, pos.z);
    if (inside) this._ejectFromPolygon(pos, inside, r);
    for (let iter = 0; iter < 3; iter++) {
      let moved = false;
      for (const ei of this._nearbyEdges(pos.x - r, pos.z - r, pos.x + r, pos.z + r)) {
        const e = this.edges[ei];
        const [cx, cz] = closestOnSeg(pos.x, pos.z, e);
        let dx = pos.x - cx, dz = pos.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < r) {
          if (d < 1e-5) { dx = e.nx; dz = e.nz; } else { dx /= d; dz /= d; }
          pos.x = cx + dx * r; pos.z = cz + dz * r;
          moved = true;
        }
      }
      const cs = this.cs;
      const seen = new Set();
      this._cellsFor(pos.x - r, pos.z - r, pos.x + r, pos.z + r, (k) => {
        for (const ci of this.circleGrid.get(k) ?? []) {
          if (seen.has(ci)) continue; seen.add(ci);
          const c = this.circles[ci];
          const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
          if (d < m && d > 1e-5) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; moved = true; }
        }
      });
      void cs;
      if (!moved) break;
    }
    if (this.bounds && !this.inZone(pos.x, pos.z)) {
      const b = this.bounds;
      pos.x = Math.min(b.maxX - r, Math.max(b.minX + r, pos.x));
      pos.z = Math.min(b.maxZ - r, Math.max(b.minZ + r, pos.z));
    }
    return pos;
  }

  _ejectFromPolygon(pos, poly, r) {
    let best = null, bestD = Infinity;
    const p = poly.pts;
    for (let i = 0; i < p.length; i++) {
      const e = { ax: p[i][0], az: p[i][1], bx: p[(i + 1) % p.length][0], bz: p[(i + 1) % p.length][1] };
      const [cx, cz] = closestOnSeg(pos.x, pos.z, e);
      const d = Math.hypot(pos.x - cx, pos.z - cz);
      if (d < bestD) {
        const L = Math.hypot(e.bx - e.ax, e.bz - e.az) || 1;
        bestD = d; best = { cx, cz, nx: (e.bz - e.az) / L, nz: -(e.bx - e.ax) / L };
      }
    }
    if (best) { pos.x = best.cx + best.nx * (r + 0.05); pos.z = best.cz + best.nz * (r + 0.05); }
  }

  /** First hit along a→b against walls. Returns fraction 0..1 (1 = clear). */
  raycast(ax, az, bx, bz) {
    let best = 1;
    for (const ei of this._nearbyEdges(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz))) {
      const e = this.edges[ei];
      const t = segIntersect(ax, az, bx, bz, e.ax, e.az, e.bx, e.bz);
      if (t !== null && t < best) best = t;
    }
    return best;
  }
}

function closestOnSeg(px, pz, e) {
  const dx = e.bx - e.ax, dz = e.bz - e.az;
  const L = dx * dx + dz * dz;
  let t = L ? ((px - e.ax) * dx + (pz - e.az) * dz) / L : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return [e.ax + t * dx, e.az + t * dz];
}
function distToSeg(px, pz, e) { const [cx, cz] = closestOnSeg(px, pz, e); return Math.hypot(px - cx, pz - cz); }
function segIntersect(p0x, p0z, p1x, p1z, q0x, q0z, q1x, q1z) {
  const rx = p1x - p0x, rz = p1z - p0z, sx = q1x - q0x, sz = q1z - q0z;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = q0x - p0x, qz = q0z - p0z;
  const t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}
