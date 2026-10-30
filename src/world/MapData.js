import { ROAD_DISPLAY_NAMES } from '../config.js';
import { segDistSq } from '../core/utils.js';

/**
 * Read-only access to the extracted OSM map (public/data/onitsha_core.json).
 * Also exposes the road graph that NPC navigation and transport routes will use later.
 */
const EMPTY = Object.freeze([]);
export class MapData {
  static async load(url, onProgress) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Map data failed to load (${res.status}) from ${url}`);
    onProgress?.(0.15);
    const json = await res.json();
    return new MapData(json);
  }

  constructor(json) {
    this.meta = json.meta;
    this.spawn = json.spawn;
    this.nodes = json.graph.nodes;
    this.junctions = new Set(json.graph.junctions);
    this.roads = json.roads;
    // These are mall parking/access aisles, not ambient through routes. Keep them walkable.
    const mallAisles = new Set(['784975156','784975157','784975158','784975160','784975161','784975162','784975163','784975164','784975165','784975166','1230235225']);
    for (const r of this.roads) if (mallAisles.has(String(r.id))) r.noTraffic = true;
    this.buildings = json.buildings;
    this.areas = json.areas ?? [];
    this.water = json.water ?? [];
    this.land = json.land ?? [];
    this.pois = json.pois ?? [];
    // v0.48: while the world is generated, everything of the earlier map is placed inside the bounds it had then
    // (so it comes out exactly as before); Game switches to the full bounds once everything is placed.
    this.fullBounds = json.meta.playBounds;
    this.bounds = json.meta.extensions?.[0]?.before?.playBounds ?? json.meta.playBounds;

    // road segment grid for "what street am I on" queries
    this.cell = 40;
    this.grid = new Map();
    this.segments = [];
    for (const road of this.roads) {
      const pts = road.nodes.map((i) => this.nodes[i]);
      road.points = pts;
      road.displayName = ROAD_DISPLAY_NAMES[road.name] ?? road.name;
      let len = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
        len += Math.hypot(bx - ax, bz - az);
        const si = this.segments.length;
        this.segments.push({ ax, az, bx, bz, road });
        const c = this.cell;
        for (let gx = Math.floor(Math.min(ax, bx) / c); gx <= Math.floor(Math.max(ax, bx) / c); gx++)
          for (let gz = Math.floor(Math.min(az, bz) / c); gz <= Math.floor(Math.max(az, bz) / c); gz++) {
            const k = gx + ',' + gz;
            if (!this.grid.has(k)) this.grid.set(k, []);
            this.grid.get(k).push(si);
          }
      }
      road.length = len;
    }
  }

  /**
   * Is (x, z) on the carriageway of any road (within its half-width + margin)? Footpaths and raised decks
   * (you can stand under a flyover) don't count. Used to keep stalls, kiosks and parked cars off roads.
   */
  /** v0.54.4: the segment list of one grid cell, looked up by number (no string building in hot loops). Same arrays as `grid`. */
  cellSegs(gx, gz) {
    const n = (gx + 32768) * 65536 + (gz + 32768), m = (this._gridN ??= new Map());
    let l = m.get(n); if (l === undefined) { l = this.grid.get(gx + ',' + gz) ?? EMPTY; m.set(n, l); } return l;
  }
  /** v0.54.4: a fresh "seen" mark for de-duplicating segments without allocating a Set. */
  segMark() { if (!this._stamp || this._stamp.length < this.segments.length) { this._stamp = new Uint32Array(this.segments.length + 64); this._mk = 0; } if (++this._mk >= 0xffffffff) { this._stamp.fill(0); this._mk = 1; } return this._mk; }

  onCarriageway(x, z, margin = 0, skip = null) {
    const c = this.cell, gx = Math.floor(x / c), gz = Math.floor(z / c);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const si of this.cellSegs(gx + dx, gz + dz)) {
        const s = this.segments[si], r = s.road;
        if (r.elevated || r.type === 'footway' || r.type === 'path' || r.type === 'steps' || r.type === 'pedestrian' || skip?.(r)) continue;
        const lim = r.width / 2 + margin;
        if (segDistSq(x, z, s.ax, s.az, s.bx, s.bz) < lim * lim) return r;
      }
    }
    return null;
  }

  /** Nearest road (optionally only named roads) within maxDist metres. */
  nearestRoad(x, z, { named = false, maxDist = 30 } = {}) {
    const c = this.cell;
    const gx = Math.floor(x / c), gz = Math.floor(z / c);
    let best = null, bestD = maxDist * maxDist;
    const seen = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const list = this.grid.get(gx + dx + ',' + (gz + dz));
      if (!list) continue;
      for (const si of list) {
        if (seen.has(si)) continue; seen.add(si);
        const s = this.segments[si];
        if (named && !s.road.name) continue;
        const d = segDistSq(x, z, s.ax, s.az, s.bx, s.bz);
        if (d < bestD) { bestD = d; best = s.road; }
      }
    }
    return best ? { road: best, dist: Math.sqrt(bestD) } : null;
  }

  isJunction(nodeIndex) { return this.junctions.has(nodeIndex); }
  useFullBounds() { this.bounds = this.fullBounds; }
}
