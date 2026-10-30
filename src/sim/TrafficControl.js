import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hashString } from '../core/utils.js';

/**
 * v0.49: traffic lights and traffic wardens at the busy junctions.
 * - A controlled junction lets one direction through at a time: its approaches are split into two groups (the road
 *   and the road crossing it); each group gets green, then amber, then an all-red clearance, in turn. Junctions are
 *   offset in time, so the city doesn't change all at once.
 * - Lights stand on poles at the approaches, facing the drivers, lit red / amber / green.
 * - At the busiest junctions (by the markets, the parks and the main interchanges) a traffic warden stands in the
 *   middle on a raised stand under an umbrella and waves each direction through (the same timing as lights).
 * Traffic (TrafficSystem) asks `state(node, edge, fwd)` for the light a driver is approaching; a driver stops at
 * the line on red, and on amber if it can still stop in time. Pure apart from the meshes.
 */
const GREEN = 13, AMBER = 3, CLEAR = 2.5, CYCLE = 2 * (GREEN + AMBER + CLEAR);
const HUBS = ['main-market', 'ochanja', 'upper-iweka', 'upper-iweka-park', 'bridgehead', 'shoprite', 'fegge', 'ike-dunkofia'];

export class TrafficControl {
  constructor(graph, { landmarks = null, locked = null, wardens = 12, maxLights = 220 } = {}) {
    this.g = graph; this.nodes = new Map(); this.time = 0;
    const cand = [];
    for (const [node, list] of graph.adj) {
      const drive = list.filter((o) => o.edge.drivable && !o.walkOnly);
      const inc = new Map(); for (const o of list) if (o.edge.drivable && !o.edge.road.elevated) inc.set(o.edge.id, o.edge);
      if (inc.size < 3 || drive.length < 2) continue;
      const edges = [...inc.values()]; if (!edges.some((e) => e.major)) continue;
      const [x, z] = graph.nodes[node]; if (locked?.(x, z)) continue;
      const score = edges.reduce((a, e) => a + (e.road.width ?? 6), 0) + edges.filter((e) => e.major).length * 6;
      cand.push({ node, x, z, edges, score });
    }
    cand.sort((a, b) => b.score - a.score || a.node - b.node);
    const chosen = [];
    for (const c of cand) { if (chosen.length >= maxLights) break; if (chosen.some((q) => Math.hypot(q.x - c.x, q.z - c.z) < 55)) continue; chosen.push(c); }
    // wardens at the most important ones near the hubs
    const hubs = HUBS.map((id) => landmarks?.get(id)).filter(Boolean);
    const near = (c) => Math.min(...hubs.map((h) => Math.hypot(h.x - c.x, h.z - c.z)), 9999);
    const byHub = [...chosen].sort((a, b) => (near(a) - a.score * 4) - (near(b) - b.score * 4));
    const warden = new Set(); for (const c of byHub) { if (warden.size >= wardens) break; if ([...warden].some((q) => Math.hypot(q.x - c.x, q.z - c.z) < 380)) continue; warden.add(c); }
    for (const c of chosen) this.add(c, warden.has(c));
  }
  add(c, warden) {
    const g = this.g, approaches = [];
    for (const e of c.edges) {
      const into = e.b === c.node; // driving towards the node along the edge
      const dx = into ? e.dx : -e.dx, dz = into ? e.dz : -e.dz; // direction of travel into the node
      approaches.push({ e, fwd: into, dx, dz, width: e.road.width ?? 6, oneway: e.road.oneway && !into });
    }
    // two groups: the approaches roughly along the first (widest) road, and the others
    approaches.sort((a, b) => b.width - a.width);
    const d0 = approaches[0]; for (const a of approaches) a.group = Math.abs(a.dx * d0.dx + a.dz * d0.dz) > 0.7 ? 0 : 1;
    if (!approaches.some((a) => a.group === 1)) { let worst = null, wd = 2; for (const a of approaches.slice(1)) { const d = Math.abs(a.dx * d0.dx + a.dz * d0.dz); if (d < wd) { wd = d; worst = a; } } if (worst) worst.group = 1; }
    const box = Math.max(...approaches.map((a) => a.width)) * 0.55 + 4;
    const n = { node: c.node, x: c.x, z: c.z, approaches, byEdge: new Map(approaches.map((a) => [a.e.id, a])), box, offset: (hashString(String(c.node)) % 1000) / 1000 * CYCLE, warden };
    this.nodes.set(c.node, n);
    void g;
  }
  /** 'green' | 'amber' | 'red' for group k of junction n at the current time */
  phase(n, k) {
    const t = (this.time + n.offset) % CYCLE, half = GREEN + AMBER + CLEAR, u = k === 0 ? t : (t + half) % CYCLE;
    return u < GREEN ? 'green' : u < GREEN + AMBER ? 'amber' : 'red';
  }
  /** The light a vehicle on (edge, fwd) sees at the node it is driving towards, or null if that junction has none. */
  state(node, edge, fwd) {
    const n = this.nodes.get(node); if (!n) return null; const a = n.byEdge.get(edge.id); if (!a || a.fwd !== fwd) return null;
    return { light: this.phase(n, a.group), stop: n.box, n };
  }
  update(dt) { this.time += dt; }

  // ------------------------------------------------------------------ meshes
  build(scene, npcs = null, collision = null) {
    this.collision = collision;
    const lights = [...this.nodes.values()].filter((n) => !n.warden), heads = [];
    for (const n of lights) for (const a of n.approaches) {
      if (a.oneway) continue;
      // on the driver's right, a little before the stop line, facing the driver
      const rx = -a.dz, rz = a.dx, back = n.box + 1.5, off = a.width / 2 + 0.9;
      heads.push({ n, a, x: n.x - a.dx * back + rx * off, z: n.z - a.dz * back + rz * off, yaw: Math.atan2(-a.dx, -a.dz) });
      collision?.addCircle(heads[heads.length - 1].x, heads[heads.length - 1].z, 0.12);
    }
    this.heads = heads;
    const group = new THREE.Group(); group.name = 'TrafficControl'; this.group = group;
    const N = heads.length;
    if (N) {
      // a pole on the kerb with a mast arm out over the lane; the signal head hangs from the arm, facing the driver
      const pole = mergeGeometries([new THREE.CylinderGeometry(0.1, 0.13, 6, 6).translate(0, 3, 0), new THREE.BoxGeometry(0.1, 0.1, 3.4).rotateY(Math.PI / 2).translate(-1.7, 5.85, 0)].map((q) => q.toNonIndexed()));
      const box = new THREE.BoxGeometry(0.55, 1.5, 0.4); box.translate(-3.1, 5.05, 0);
      const lamp = new THREE.BoxGeometry(0.3, 0.3, 0.06);
      const dark = new THREE.MeshStandardMaterial({ color: '#2a2d30', roughness: 0.6, metalness: 0.3 }), M = Math.min(N, 90);
      // only the lights near you are drawn: the instanced meshes are refilled with them (render())
      this.poles = new THREE.InstancedMesh(pole, dark, M); this.boxes = new THREE.InstancedMesh(box, dark, M);
      this.lamps = new THREE.InstancedMesh(lamp, new THREE.MeshBasicMaterial({ toneMapped: false }), M * 3); this.cap = M;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
      heads.forEach((h) => {
        q.setFromAxisAngle(up, h.yaw); h.m = m.compose(p.set(h.x, 0, h.z), q, one).clone(); h.lm = [];
        for (let k = 0; k < 3; k++) { const ox = -3.1, fz = 0.22, cx = h.x + Math.cos(h.yaw) * ox + Math.sin(h.yaw) * fz, cz = h.z - Math.sin(h.yaw) * ox + Math.cos(h.yaw) * fz; h.lm.push(m.compose(p.set(cx, 5.5 - k * 0.45, cz), q, one).clone()); }
      });
      for (const im of [this.poles, this.boxes, this.lamps]) { im.count = 0; im.frustumCulled = false; group.add(im); }
      this.lamps.setColorAt(0, new THREE.Color('#222'));
      this.poles.castShadow = true;
    }
    // wardens: a round stand and an umbrella in the middle of the junction, and the warden on it
    const wardens = [...this.nodes.values()].filter((n) => n.warden);
    if (wardens.length) {
      const stand = new THREE.CylinderGeometry(0.8, 0.9, 0.16, 16); stand.translate(0, 0.08, 0);
      const stem = new THREE.CylinderGeometry(0.04, 0.04, 2.6, 6); stem.translate(0, 1.5, 0);
      const brolly = new THREE.ConeGeometry(1.4, 0.55, 12); brolly.translate(0, 3, 0);
      const mk = (geo, color) => new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), wardens.length);
      const s1 = mk(stand, '#e9e3d4'), s2 = mk(stem, '#3b3b3b'), s3 = mk(brolly, '#d62828'), m = new THREE.Matrix4();
      wardens.forEach((n, i) => {
        // on the corner between the first approach and the one to its right, just off the carriageway, facing the junction
        const a = n.approaches[0], rx = -a.dz, rz = a.dx, d = n.box + 0.8, x = n.x - a.dx * d + rx * (a.width / 2 + 1.6), z = n.z - a.dz * d + rz * (a.width / 2 + 1.6);
        n.stand = { x, z }; m.makeTranslation(x, 0, z); s1.setMatrixAt(i, m); s2.setMatrixAt(i, m); s3.setMatrixAt(i, m);
        this.collision?.addCircle(x, z, 0.85);
        try { npcs?.addAnchored({ id: `warden:${n.node}`, kind: 'police', role: 'police', name: 'Traffic warden', x: x + 0.3, z, nx: n.x - x, nz: n.z - z, schedule: [6.5, 21], activity: 'idle' }); } catch { /* */ }
      });
      for (const im of [s1, s2, s3]) { im.computeBoundingSphere(); group.add(im); }
    }
    scene.add(group);
    this.colorT = 0;
    return group;
  }
  /** Lamp colours (every 0.25 s, for the lights within `range` of the focus). */
  render(dt, focus, range = 300) {
    if (!this.lamps) return; this.colorT -= dt; if (this.colorT > 0) return; this.colorT = 0.25;
    const C = this._c ??= { red: new THREE.Color('#ff2a1a'), amber: new THREE.Color('#ffb000'), green: new THREE.Color('#2bdc4a'), off: new THREE.Color('#2b2b2b') };
    let k = 0;
    for (const h of this.heads) {
      if (k >= this.cap) break;
      if (Math.abs(h.x - focus.x) > range || Math.abs(h.z - focus.z) > range) continue;
      this.poles.setMatrixAt(k, h.m); this.boxes.setMatrixAt(k, h.m);
      const st = this.phase(h.n, h.a.group);
      for (let j = 0; j < 3; j++) { this.lamps.setMatrixAt(k * 3 + j, h.lm[j]); this.lamps.setColorAt(k * 3 + j, (j === 0 ? st === 'red' : j === 1 ? st === 'amber' : st === 'green') ? (j === 0 ? C.red : j === 1 ? C.amber : C.green) : C.off); }
      k++;
    }
    this.poles.count = this.boxes.count = k; this.lamps.count = k * 3;
    for (const im of [this.poles, this.boxes, this.lamps]) im.instanceMatrix.needsUpdate = true;
    if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
  }
  stats() { const v = [...this.nodes.values()]; return { junctions: v.length, lights: v.filter((n) => !n.warden).length, wardens: v.filter((n) => n.warden).length, heads: this.heads?.length ?? 0 }; }
}
