import * as THREE from 'three';
/**
 * v0.53: compound gates that open. Every compound's sliding gate is drawn here (instanced, the ones near you), and
 * it slides open when you walk or drive up to it, then closes behind you. Before, the gate was painted shut and you
 * walked (or drove) straight through it.
 */
const DRAW = 140, OPEN_AT = 7.5, MAX = 900;
export class CompoundGates {
  constructor(g) {
    this.g = g; this.group = new THREE.Group(); this.group.name = 'CompoundGates'; g.renderer.scene.add(this.group);
    this.gates = []; this.grid = new Map(); this.near = []; this.timer = 0; this.opened = 0;
    const leaf = new THREE.BoxGeometry(1, 1, 0.08); leaf.translate(0, 0.5, 0);
    this.leaves = new THREE.InstancedMesh(leaf, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.45 }), MAX); this.leaves.count = 0; this.leaves.frustumCulled = false; this.leaves.castShadow = true;
    const rail = new THREE.BoxGeometry(1, 0.15, 0.12); rail.translate(0, 0, 0);
    this.rails = new THREE.InstancedMesh(rail, new THREE.MeshStandardMaterial({ color: '#2c2c2c', roughness: 0.6 }), MAX); this.rails.count = 0; this.rails.frustumCulled = false;
    this.group.add(this.leaves, this.rails); this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3(); this.c = new THREE.Color(); this.up = new THREE.Vector3(0, 1, 0);
  }
  /** Collect every compound gate once the city is built. */
  setup() {
    const w = this.g.world, set = new Set();
    for (const ch of w.city?.chunks?.values() ?? []) for (const c of ch.compounds ?? []) set.add(c);
    for (const c of w.infill?.compounds ?? []) if (!c.removed) set.add(c);
    for (const h of w.orderly?.houses ?? []) if (h.compound) set.add(h.compound);
    for (const c of set) {
      if (!c.gate || c.removed || !c.ring) continue; const [a, b] = c.gate, gl = Math.hypot(b[0] - a[0], b[1] - a[1]); if (gl < 0.5) continue;
      const ux = (b[0] - a[0]) / gl, uz = (b[1] - a[1]) / gl, cx = c.ring.reduce((s, p) => s + p[0], 0) / c.ring.length, cz = c.ring.reduce((s, p) => s + p[1], 0) / c.ring.length;
      let nx = -uz, nz = ux; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if ((cx - mx) * nx + (cz - mz) * nz < 0) { nx = -nx; nz = -nz; } // n points into the compound
      const gate = { x: mx, z: mz, a, ux, uz, nx, nz, gl, h: (c.h ?? 2.2) + 0.05, color: c.gateColor ?? '#2f2f33', open: 0, yaw: Math.atan2(-uz, ux) };
      this.gates.push(gate); const k = Math.floor(mx / 64) + ',' + Math.floor(mz / 64); (this.grid.get(k) ?? this.grid.set(k, []).get(k)).push(gate);
    }
    return this.gates.length;
  }
  update(dt) {
    const g = this.g; if (!this.gates.length) return;
    const inside = !!(g.homes?.inside || g.club?.inside || g.civic?.inside); this.group.visible = !inside; if (inside) return;
    const D = g.vehicles?.driving, P = D && Number.isFinite(D.x) ? { x: D.x, z: D.z } : g.player?.position; if (!P) return;
    if ((this.timer -= dt) <= 0) { this.timer = 0.4; const out = [], gx = Math.floor(P.x / 64), gz = Math.floor(P.z / 64), R = Math.ceil(DRAW / 64);
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (const q of this.grid.get(gx + i + ',' + (gz + j)) ?? []) if (Math.hypot(q.x - P.x, q.z - P.z) < DRAW) out.push(q);
      this.near = out.slice(0, MAX); }
    // who is near a gate: you (on foot or driving) and the people walking nearby
    const movers = [P], reach = D ? OPEN_AT + 3 : OPEN_AT;
    let k = 0;
    for (const q of this.near) {
      const close = movers.some((m) => Math.hypot(m.x - q.x, m.z - q.z) < reach), was = q.open;
      q.open = Math.max(0, Math.min(1, q.open + (close ? dt * 0.8 : -dt * 0.6))); if (was < 0.5 && q.open >= 0.5) this.opened++;
      // the leaf slides along the gate line towards post a, just inside the wall
      const slide = q.open * q.gl * 0.92, x = q.x - q.ux * slide + q.nx * 0.2, z = q.z - q.uz * slide + q.nz * 0.2;
      this.q.setFromAxisAngle(this.up, q.yaw);
      this.m.compose(this.v.set(x, 0, z), this.q, this.s.set(q.gl, q.h, 1)); this.leaves.setMatrixAt(k, this.m); this.leaves.setColorAt(k, this.c.set(q.color));
      this.m.compose(this.v.set(x, q.h - 0.18, z), this.q, this.s.set(q.gl, 1, 1)); this.rails.setMatrixAt(k, this.m);
      k++;
    }
    this.leaves.count = this.rails.count = k; this.leaves.instanceMatrix.needsUpdate = this.rails.instanceMatrix.needsUpdate = true; if (this.leaves.instanceColor) this.leaves.instanceColor.needsUpdate = true;
  }
  /** for tests: the gate nearest a point */
  nearest(x, z) { let best = null, bd = 1e9; for (const q of this.gates) { const d = Math.hypot(q.x - x, q.z - z); if (d < bd) { bd = d; best = q; } } return best; }
}
