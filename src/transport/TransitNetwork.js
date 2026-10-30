import { MODES, LINES } from './transportConfig.js';

/*
  Public transport network built from the OSM road graph.
  - Each line is a closed loop: terminal → … → last terminal and back again, found by Dijkstra on the
    drivable graph with per-mode road costs (buses keep to main roads; keke use side streets too and
    never go on the Niger Bridge).
  - Stops are placed along each loop near the line's named places and every few hundred metres,
    away from junctions and never on bridge decks. Stops from different lines that are close together
    are merged, so one sign can serve several lines.
  - A stop has a platform (kerb point) for each direction a line passes it.
  Pure logic: no rendering, so it can be unit-tested in Node.
*/

const BUS_TYPES = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link']);
const NAME_BY_TYPE = { trunk: 'Expressway', trunk_link: 'Expressway', primary: 'Main road', secondary: 'Main road', tertiary: 'Road' };
const POI_LABEL = { fuel: (n) => `${n} filling station`, hotel: (n) => `${n} Hotel`, university: (n) => n, bus_station: (n) => n };
const compass = (x, z, tx, tz) => ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][(Math.round(Math.atan2(tx - x, -(tz - z)) / (Math.PI / 4)) + 8) % 8];

export class TransitNetwork {
  constructor({ map, graph, landmarks }) {
    this.map = map; this.graph = graph; this.landmarks = landmarks;
    this.stops = []; this.lines = [];
    this.build();
  }

  // ------------------------------------------------------------------ routing
  edgeCost(e, mode, allowBridge) {
    const t = e.road.type;
    if (e.road.elevated && e.road.overWater && !allowBridge) return Infinity;
    if (mode === 'keke') {
      if (e.road.elevated && !e.road.overWater) return e.len * 1.1; // the flyover is fine
      if (t === 'service' || t === 'living_street') return e.len * 3;
      return e.len * (e.major ? 1 : 1.35);
    }
    if (BUS_TYPES.has(t)) return e.len * (t.startsWith('tertiary') ? 1.15 : 1);
    if (t === 'unclassified' || t === 'residential') return e.len * 4;
    return Infinity;
  }

  /** Shortest drivable path node → node as [{edge, fwd}], or null. */
  route(from, to, mode, allowBridge) {
    if (from === to) return [];
    const dist = new Map([[from, 0]]), prev = new Map();
    const heap = [[0, from]];
    const push = (item) => { heap.push(item); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    while (heap.length) {
      const [d, n] = pop();
      if (d > (dist.get(n) ?? Infinity)) continue;
      if (n === to) break;
      for (const o of this.graph.adj.get(n) ?? []) {
        if (o.walkOnly || !o.edge.drivable) continue;
        const c = this.edgeCost(o.edge, mode, allowBridge); if (c === Infinity) continue;
        const m = o.fwd ? o.edge.b : o.edge.a, nd = d + c;
        if (nd < (dist.get(m) ?? Infinity)) { dist.set(m, nd); prev.set(m, o); push([nd, m]); }
      }
    }
    if (!prev.has(to)) return null;
    const path = []; let n = to;
    while (n !== from) { const o = prev.get(n); path.push({ edge: o.edge, fwd: o.fwd }); n = o.fwd ? o.edge.a : o.edge.b; }
    return path.reverse();
  }

  /**
   * A graph node near a place that the mode can use — and can get both to and from the rest of the
   * network (a node on a one-way slip onto the Niger Bridge can be reached but not left by a town line).
   */
  anchorNode(ref, mode, allowBridge) {
    const cands = this.anchorCandidates(ref, mode, allowBridge);
    if (!cands.length) return null;
    const hub = this.hubNode(mode, allowBridge);
    for (const c of cands.slice(0, 12)) {
      if (hub === null || c.node === hub || (this.route(c.node, hub, mode, allowBridge) && this.route(hub, c.node, mode, allowBridge))) return c;
    }
    return cands[0];
  }

  /** A well-connected node in the middle of town (by Ochanja) used to test two-way reachability. */
  hubNode(mode, allowBridge) {
    this.hubs ??= new Map();
    const k = mode + (allowBridge ? ':b' : '');
    if (!this.hubs.has(k)) {
      const o = this.landmarks.get('ochanja');
      const c = o ? this.anchorCandidates({ x: o.x, z: o.z }, mode, allowBridge).find((cand) => this.graph.degree(cand.node) >= 3) : null;
      this.hubs.set(k, c ? c.node : null);
    }
    return this.hubs.get(k);
  }

  /** Candidate nodes near a place, best first. */
  anchorCandidates(ref, mode, allowBridge) {
    let x, z, special = null;
    if (typeof ref === 'string') { const l = this.landmarks.get(ref); x = l.gatePos?.x ?? l.x; z = l.gatePos?.z ?? l.z; special = l; }
    else ({ x, z } = ref);
    const edges = this.graph.edgesNear(x, z, 260, 0, (e) => e.drivable && !e.road.elevated && this.edgeCost(e, mode, allowBridge) < Infinity && e.len > 6);
    const best = new Map();
    for (const e of edges) for (const ni of [e.a, e.b]) {
      const [nx, nz] = this.map.nodes[ni];
      const d = Math.hypot(nx - x, nz - z) * (e.major ? 0.7 : 1);
      if (d < (best.get(ni) ?? Infinity)) best.set(ni, d);
    }
    return [...best].sort((a, b) => a[1] - b[1]).map(([node]) => ({ node, x, z, name: special?.name ?? null, landmark: special }));
  }

  // ------------------------------------------------------------------ build
  build() {
    const stopsByLine = [];
    for (const def of LINES) {
      const M = MODES[def.mode];
      const anchors = def.stops.map((s) => this.anchorNode(s, def.mode, def.bridge)).filter(Boolean);
      if (anchors.length < 2) continue;
      // loop: out through the anchors, then straight back
      const order = [...anchors, ...anchors.slice(0, -1).reverse()];
      const path = []; let ok = true;
      for (let i = 0; i < order.length - 1; i++) {
        const seg = this.route(order[i].node, order[i + 1].node, def.mode, def.bridge);
        if (!seg) { ok = false; break; }
        path.push(...seg);
      }
      // close the loop back to the first terminal
      if (ok && path.length) {
        const endNode = path[path.length - 1].fwd ? path[path.length - 1].edge.b : path[path.length - 1].edge.a;
        if (endNode !== order[0].node) { const seg = this.route(endNode, order[0].node, def.mode, def.bridge); if (seg) path.push(...seg); else ok = false; }
      }
      if (!ok || path.length < 3) { console.warn('[Transit] could not route line', def.id); continue; }
      const cum = []; let L = 0;
      for (const p of path) { cum.push(L); L += p.edge.len; }
      const line = { id: def.id, mode: def.mode, M, name: def.name, path, cum, length: L, anchors, occ: [], color: M.color };
      this.lines.push(line);
      stopsByLine.push(line);
    }
    // stop candidates along each line
    for (const line of stopsByLine) this.placeStops(line);
    // merge, name and index
    this.stops.forEach((s, i) => { s.index = i; });
    for (const line of this.lines) line.occ.sort((a, b) => a.d - b.d);
    this.byId = new Map(this.stops.map((s) => [s.id, s]));
  }

  /** Is this position along the loop a valid place to stop (straight bit, away from junctions, at ground level)? */
  validAt(line, d) {
    const { i, s } = this.locate(line, d);
    const { edge } = line.path[i];
    if (edge.road.elevated || edge.road.bridge) return false;
    // distance to nearest junction along the path, both directions
    const jd = 18;
    let back = s, k = i;
    while (back < jd) { const nodeBehind = line.path[k].fwd ? line.path[k].edge.a : line.path[k].edge.b; if (this.graph.degree(nodeBehind) >= 3) return false; k = (k - 1 + line.path.length) % line.path.length; back += line.path[k].edge.len; }
    let ahead = line.path[i].edge.len - s; k = i;
    while (ahead < jd) { const nodeAhead = line.path[k].fwd ? line.path[k].edge.b : line.path[k].edge.a; if (this.graph.degree(nodeAhead) >= 3) return false; k = (k + 1) % line.path.length; ahead += line.path[k].edge.len; }
    // the kerb and the sign must not land on another road's carriageway (parallel roads, dual carriageways)
    const half = edge.road.width / 2, major = BUS_TYPES.has(edge.road.type);
    const fwd = line.path[i].fwd;
    for (const lat of [half + (major ? 1.5 : 0.9), half + (major ? 2.0 : 1.3), half + 2.6]) {
      const q = this.graph.pointAt(edge, fwd, s, lat);
      if (this.onCarriageway(q.x, q.z)) return false;
    }
    return true;
  }

  /** Is (x, z) on the driving surface of any ground-level road? */
  onCarriageway(x, z) {
    const m = this.map, c = m.cell, gx = Math.floor(x / c), gz = Math.floor(z / c);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      for (const si of m.grid.get(gx + dx + ',' + (gz + dz)) ?? []) {
        const sg = m.segments[si];
        if (sg.road.elevated) continue;
        const ex = sg.bx - sg.ax, ez = sg.bz - sg.az, L2 = ex * ex + ez * ez || 1;
        const t = Math.max(0, Math.min(1, ((x - sg.ax) * ex + (z - sg.az) * ez) / L2));
        const ddx = sg.ax + ex * t - x, ddz = sg.az + ez * t - z;
        const w = sg.road.width / 2 - 0.2;
        if (ddx * ddx + ddz * ddz < w * w) return true;
      }
    }
    return false;
  }

  locate(line, d) {
    const L = line.length; d = ((d % L) + L) % L;
    let lo = 0, hi = line.cum.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (line.cum[m] <= d) lo = m; else hi = m - 1; }
    return { i: lo, s: d - line.cum[lo] };
  }

  /** Point on the loop at distance d with lateral offset (positive = right of travel). */
  pointOn(line, d, lateral = 0) {
    const { i, s } = this.locate(line, d);
    const { edge, fwd } = line.path[i];
    return this.graph.pointAt(edge, fwd, s, lateral);
  }

  nearestOnLine(line, x, z) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < line.path.length; i++) {
      const { edge, fwd } = line.path[i];
      const [ax, az] = this.map.nodes[fwd ? edge.a : edge.b];
      const dx = fwd ? edge.dx : -edge.dx, dz = fwd ? edge.dz : -edge.dz;
      const t = Math.max(0, Math.min(edge.len, (x - ax) * dx + (z - az) * dz));
      const d = Math.hypot(ax + dx * t - x, az + dz * t - z);
      if (d < bd) { bd = d; best = line.cum[i] + t; }
    }
    return { d: best, dist: bd };
  }

  /** First place at least `min` metres ahead where a vehicle may safely pull over (for "drop me here"). */
  nextSafeStop(line, d, min = 15, max = 400) {
    for (let k = min; k <= max; k += 4) if (this.validAt(line, d + k)) return (d + k) % line.length;
    return null;
  }

  findValid(line, d, span = 90) {
    for (let k = 0; k <= span; k += 6) for (const sgn of [1, -1]) { const t = d + sgn * k; if (this.validAt(line, t)) return t; }
    return null;
  }

  placeStops(line) {
    const L = line.length;
    const marks = [];
    // named anchors (terminals and vias): nearest point on the loop in each direction of travel
    for (const a of line.anchors) {
      if (a.turnaround) continue;
      // the loop passes an anchor up to twice (out and back); find the two passes
      const passes = [];
      for (let i = 0; i < line.path.length; i++) {
        const { edge, fwd } = line.path[i];
        const n = fwd ? edge.a : edge.b;
        if (n === a.node) passes.push(line.cum[i]);
      }
      if (!passes.length) passes.push(this.nearestOnLine(line, a.x, a.z).d);
      for (const p of passes) marks.push({ d: p, name: a.name, anchor: a });
    }
    // regular stops in between
    const sp = line.M.stopSpacing;
    marks.sort((a, b) => a.d - b.d);
    const all = [...marks];
    for (let k = 0; k < marks.length; k++) {
      const a = marks[k].d, b = k + 1 < marks.length ? marks[k + 1].d : marks[0].d + L;
      const gap = b - a, n = Math.floor(gap / sp);
      for (let j = 1; j <= n; j++) { const t = a + (gap * j) / (n + 1); if (gap / (n + 1) > 160) all.push({ d: t % L }); }
    }
    if (!marks.length) for (let t = 0; t < L; t += sp) all.push({ d: t });
    // snap to valid positions, drop near-duplicates along the loop
    const placed = [];
    for (const m of all.sort((a, b) => a.d - b.d)) {
      let d = this.findValid(line, m.d, m.anchor ? 140 : 90);
      if (d === null) continue;
      d = ((d % L) + L) % L;
      if (placed.some((p) => Math.abs(p.d - d) < 140 || Math.abs(p.d - d) > L - 140)) continue;
      placed.push({ d, name: m.name, anchor: m.anchor });
    }
    for (const p of placed) this.attach(line, p);
  }

  attach(line, p) {
    const { i, s } = this.locate(line, p.d);
    const { edge, fwd } = line.path[i];
    const road = edge.road, half = road.width / 2, major = BUS_TYPES.has(road.type);
    const centre = this.graph.pointAt(edge, fwd, s, 0);
    const kerb = this.graph.pointAt(edge, fwd, s, half + (major ? 1.5 : 0.9));
    const pole = this.graph.pointAt(edge, fwd, s + 2.5, half + (major ? 2.0 : 1.3));
    // reuse a stop within 70 m (another line or the other direction of this one)
    let stop = this.stops.find((st) => Math.hypot(st.x - centre.x, st.z - centre.z) < 70);
    if (!stop) {
      stop = { id: `stop:${this.stops.length}`, x: centre.x, z: centre.z, name: p.name ?? this.nameFor(centre.x, centre.z, road), named: !!p.name, platforms: [], lines: new Set() };
      this.stops.push(stop);
    } else if (p.name && !stop.named) { stop.name = p.name; stop.named = true; }
    // one platform per kerb side
    const dir = { dx: fwd ? edge.dx : -edge.dx, dz: fwd ? edge.dz : -edge.dz };
    let plat = stop.platforms.find((pl) => Math.hypot(pl.x - kerb.x, pl.z - kerb.z) < 12);
    if (!plat) { plat = { stop, index: stop.platforms.length, x: kerb.x, z: kerb.z, poleX: pole.x, poleZ: pole.z, dx: dir.dx, dz: dir.dz, road, waiting: 0 }; stop.platforms.push(plat); }
    stop.lines.add(line.id);
    // a line may only stop once per platform per loop
    if (line.occ.some((o) => o.platform === plat)) return;
    line.occ.push({ stop, platform: plat, d: p.d, line });
  }

  /** A readable stop name from what is really there: POIs, street names, cross streets, nearby places. */
  nameFor(x, z, road) {
    this.usedNames ??= new Map();
    const short = (l) => l.name.replace(/^Onitsha /, '').replace(/\s*\(.*\)$/, '').replace(/ · .*$/, '');
    const roadName = road.name ? road.displayName : null;
    let name = null;
    const poi = this.map.pois.find((p) => POI_LABEL[p.kind] && Math.hypot(p.x - x, p.z - z) < 90);
    if (poi) name = POI_LABEL[poi.kind](poi.name);
    // nearest named cross street, for "Iweka Road by Modebe Avenue"
    let cross = null, cd = 200;
    if (!name) for (const e of this.graph.edgesNear(x, z, 200, 0, (e) => e.road.name && e.road.name !== road.name && !e.road.elevated)) {
      for (const ni of [e.a, e.b]) { const [ax, az] = this.map.nodes[ni]; const d = Math.hypot(ax - x, az - z); if (d < cd) { cd = d; cross = e.road.displayName; } }
    }
    // nearest real place (not a district) for "Iweka Road, east of Ochanja Market"
    let near = null, nd = Infinity;
    for (const l of this.landmarks.list) { if (l.kind === 'district') continue; const d = Math.hypot(l.x - x, l.z - z); if (d < nd) { nd = d; near = l; } }
    const district = this.landmarks.list.find((l) => l.kind === 'district' && Math.hypot(l.x - x, l.z - z) < l.radius);
    if (!name && roadName && cross) name = `${roadName} by ${cross}`;
    else if (!name && roadName && near && nd < 1400) name = `${roadName}, ${compass(near.x, near.z, x, z)} of ${short(near)}`;
    else if (!name && roadName) name = roadName;
    else if (!name && cross) name = `Off ${cross}`;
    else if (!name && district) name = `${district.name}, ${compass(district.x, district.z, x, z)}`;
    else if (!name && near) name = `${NAME_BY_TYPE[road.type] ?? 'Road'}, ${compass(near.x, near.z, x, z)} of ${short(near)}`;
    name ??= `${NAME_BY_TYPE[road.type] ?? 'Street'} stop`;
    // two stops with the same description: say how far they are from the nearest real place
    const n = (this.usedNames.get(name) ?? 0) + 1; this.usedNames.set(name, n);
    if (n === 1) return name;
    if (near) {
      const alt = `${roadName ?? NAME_BY_TYPE[road.type] ?? 'Road'}, ${Math.max(100, Math.round(nd / 100) * 100)} m ${compass(near.x, near.z, x, z)} of ${short(near)}`;
      if (!this.usedNames.has(alt)) { this.usedNames.set(alt, 1); return alt; }
    }
    return `${name} (${n})`;
  }

  // ------------------------------------------------------------------ queries
  /** Ride distance along a line from one occurrence to another (always forward around the loop). */
  rideDistance(line, fromOcc, toOcc) { const L = line.length; return ((toOcc.d - fromOcc.d) % L + L) % L; }

  /**
   * Destinations reachable from a stop: for each other stop, the best line + boarding occurrence.
   * Returns [{stop, options:[{line, from, to, dist, stops}]}] sorted by name.
   */
  destinationsFrom(stop) {
    const out = new Map();
    for (const line of this.lines) {
      const froms = line.occ.filter((o) => o.stop === stop);
      for (const from of froms) {
        for (const to of line.occ) {
          if (to.stop === stop) continue;
          const dist = this.rideDistance(line, from, to);
          if (dist < 60) continue;
          const between = line.occ.filter((o) => { const dd = this.rideDistance(line, from, o); return dd > 0 && dd < dist; }).length;
          const e = out.get(to.stop) ?? { stop: to.stop, options: [] };
          const prev = e.options.find((o) => o.line === line);
          if (!prev) e.options.push({ line, from, to, dist, stops: between + 1 });
          else if (dist < prev.dist) Object.assign(prev, { from, to, dist, stops: between + 1 });
          out.set(to.stop, e);
        }
      }
    }
    for (const e of out.values()) e.options.sort((a, b) => a.dist - b.dist);
    return [...out.values()].sort((a, b) => (b.stop.named - a.stop.named) || a.stop.name.localeCompare(b.stop.name));
  }

  nearestPlatform(x, z, maxD) {
    let best = null, bd = maxD;
    for (const s of this.stops) {
      if (Math.abs(s.x - x) > maxD + 30 || Math.abs(s.z - z) > maxD + 30) continue;
      for (const p of s.platforms) { const d = Math.min(Math.hypot(p.x - x, p.z - z), Math.hypot(p.poleX - x, p.poleZ - z)); if (d < bd) { bd = d; best = p; } }
    }
    return best;
  }
}
