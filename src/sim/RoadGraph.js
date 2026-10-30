import { isMajorRoad } from '../world/RoadBuilder.js';

const DRIVABLE = new Set(['trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'living_street', 'service']);
const WALKABLE_EXTRA = new Set(['footway', 'path', 'steps', 'pedestrian', 'track']);

/**
 * Navigation graph built from the OSM road network. Each straight OSM segment is an edge.
 * Vehicles use `drivable` edges (right-hand traffic, lane offset applied by the caller);
 * pedestrians use every ground-level edge and walk along the road edges.
 */
export class RoadGraph {
  constructor(map) {
    this.map = map;
    this.nodes = map.nodes;
    this.edges = [];
    this.adj = new Map(); // node -> [{edge, fwd}]
    for (const road of map.roads) {
      // decks (Niger Bridge, Upper Iweka flyover) carry traffic but no pedestrians
      const drivable = DRIVABLE.has(road.type) && !road.noTraffic;
      // v0.39: flyover decks, their stairs and footbridges are walkable too (not the Niger Bridge)
      const walkable = (!road.elevated || road.walkDeck) && (DRIVABLE.has(road.type) || WALKABLE_EXTRA.has(road.type));
      if (!walkable && !drivable) continue;
      let s0 = 0;
      for (let i = 0; i < road.nodes.length - 1; i++) {
        const a = road.nodes[i], b = road.nodes[i + 1];
        const [ax, az] = this.nodes[a], [bx, bz] = this.nodes[b];
        const len = Math.hypot(bx - ax, bz - az);
        if (len < 0.5) { s0 += len; continue; }
        // ground lanes under an invented flyover carry no through traffic (it goes over the deck)
        const under = road.noTrafficSpans?.some(([p, q]) => s0 >= p - 0.5 && s0 + len <= q + 0.5);
        const e = { id: this.edges.length, a, b, road, len, s0, dx: (bx - ax) / len, dz: (bz - az) / len, drivable: drivable && !under, walkable, major: isMajorRoad(road) };
        s0 += len;
        this.edges.push(e);
        this.link(a, e, true);
        if (!road.oneway) this.link(b, e, false);
        else this.linkWalk(b, e);
      }
    }
    // spatial index for "edges near a point"
    this.cell = 60; this.grid = new Map();
    for (const e of this.edges) {
      const [ax, az] = this.nodes[e.a], [bx, bz] = this.nodes[e.b];
      const k = Math.floor((ax + bx) / 2 / this.cell) + ',' + Math.floor((az + bz) / 2 / this.cell);
      if (!this.grid.has(k)) this.grid.set(k, []); this.grid.get(k).push(e);
    }
  }

  link(node, edge, fwd) { if (!this.adj.has(node)) this.adj.set(node, []); this.adj.get(node).push({ edge, fwd, walkOnly: false }); }
  linkWalk(node, edge) { if (!this.adj.has(node)) this.adj.set(node, []); this.adj.get(node).push({ edge, fwd: false, walkOnly: true }); }

  /** v0.48: edges in COMING SOON places carry no traffic and no walkers (set after the world is built). */
  setLock(locked) { for (const e of this.edges) { const [ax, az] = this.nodes[e.a], [bx, bz] = this.nodes[e.b]; e.locked = locked((ax + bx) / 2, (az + bz) / 2); } }

  degree(node) { return this.adj.get(node)?.length ?? 0; }

  /** Outgoing options from `node`, excluding going straight back along `fromEdge`. */
  options(node, fromEdge, { vehicle = false } = {}) {
    const list = (this.adj.get(node) ?? []).filter((o) => (o.edge === fromEdge || !o.edge.locked) && (vehicle ? (o.edge.drivable && !o.walkOnly) : o.edge.walkable));
    const fwd = list.filter((o) => o.edge !== fromEdge);
    return fwd.length ? fwd : list;
  }

  /** Edges whose midpoint lies in the ring [rMin, rMax] around (x, z). */
  edgesNear(x, z, rMax, rMin = 0, filter = null) {
    const out = [];
    const c = this.cell;
    for (let gx = Math.floor((x - rMax) / c); gx <= Math.floor((x + rMax) / c); gx++)
      for (let gz = Math.floor((z - rMax) / c); gz <= Math.floor((z + rMax) / c); gz++) {
        for (const e of this.grid.get(gx + ',' + gz) ?? []) {
          const [ax, az] = this.nodes[e.a], [bx, bz] = this.nodes[e.b];
          const d = Math.hypot((ax + bx) / 2 - x, (az + bz) / 2 - z);
          if (d <= rMax && d >= rMin && !e.locked && (!filter || filter(e))) out.push(e);
        }
      }
    return out;
  }

  /** Point along an edge travelled in direction fwd at distance s from its start, with lateral offset (+ = right). */
  pointAt(edge, fwd, s, lateral = 0, out = {}) {
    const [ax, az] = this.nodes[fwd ? edge.a : edge.b];
    const dx = fwd ? edge.dx : -edge.dx, dz = fwd ? edge.dz : -edge.dz;
    // right-hand normal for travel direction (x east, z south): right = (-dz, dx)
    out.x = ax + dx * s + -dz * lateral;
    out.z = az + dz * s + dx * lateral;
    out.dx = dx; out.dz = dz;
    return out;
  }

  endNode(edge, fwd) { return fwd ? edge.b : edge.a; }

  /** Surface height along an edge (non-zero only on bridge decks). */
  heightAt(edge, fwd, s) {
    const h = edge.road.heightAt;
    return h ? h(edge.s0 + (fwd ? s : edge.len - s)) : 0;
  }
}
