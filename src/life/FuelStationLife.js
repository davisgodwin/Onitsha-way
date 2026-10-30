import * as THREE from 'three';
import { buildHuman, defaultAppearance, OUTFITS } from '../characters/HumanRig.js';
import { CharacterAnimator } from '../characters/CharacterAnimator.js';
import { compactSedan, executiveSedan, luxurySuv, PAINTS } from '../vehicles/CarModels.js';

/**
 * v0.53: life at the filling stations. At the stations near you (all the game's stations share one forecourt
 * layout), cars turn in from the road, drive round to a pump, stop; a pump attendant walks over with the nozzle and
 * fills up; then the car drives out. Two attendants at the islands and one at the mini-mart door.
 * Only the nearest few stations are animated; the cars are for show (they don't collide).
 *
 * Station frame (VenueArchitecture 'fuel'): x across, z negative into the plot, the road in front (z > 0).
 * Islands at x = ±4 (pumps at z −6.2 and −9.8), canopy pillars at x = ±6.4, mini mart at z ≈ −17.
 */
const LANES = [
  // enter along the left edge, round the back, stop at the pump facing the road, drive straight out
  { stop: [0, -8], path: [[-10.2, 9], [-10.2, -14.2], [0, -14.2], [0, -8], [0, 9]], att: 0 },
  { stop: [8.4, -8], path: [[-10.2, 9], [-10.2, -14.8], [8.4, -14.8], [8.4, -8], [8.4, 9]], att: 1 },
];
const ATTENDANTS = [{ home: [-3.1, -6.9], serve: [-1.15, -7.3], pump: [-4, -6.2] }, { home: [5, -9.5], serve: [7.25, -7.3], pump: [4, -9.8] }];
const NEAR = 170, MAX_ACTIVE = 3;

function cumul(path) { const c = [0]; for (let i = 1; i < path.length; i++) c.push(c[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1])); return c; }
function along(path, cum, d) { for (let i = 1; i < path.length; i++) if (d <= cum[i] || i === path.length - 1) { const L = cum[i] - cum[i - 1] || 1, t = Math.max(0, Math.min(1, (d - cum[i - 1]) / L)), a = path[i - 1], b = path[i]; return { x: a[0] + (b[0] - a[0]) * t, z: a[1] + (b[1] - a[1]) * t, dx: (b[0] - a[0]) / L, dz: (b[1] - a[1]) / L }; } return { x: path.at(-1)[0], z: path.at(-1)[1], dx: 0, dz: 1 }; }

export class FuelStationLife {
  constructor(g) { this.g = g; this.group = new THREE.Group(); this.group.name = 'FuelStationLife'; g.renderer.scene.add(this.group); this.active = new Map(); this.t = 0; this.check = 0; this.geos = null; this.served = 0; }
  stations() { return (this.g.story?.city?.services ?? []).filter((v) => v.kind === 'fuel' && Number.isFinite(v.x)); }
  carGeos() { if (!this.geos) { this.geos = []; for (const f of [compactSedan, compactSedan, executiveSedan, luxurySuv]) { try { this.geos.push(f()); } catch { /* model library missing: no cars */ } } } return this.geos; }
  update(dt) {
    const g = this.g; if (!g.saveData || g.homes?.inside || g.club?.inside || g.civic?.inside) { this.group.visible = false; return; }
    this.group.visible = true; this.t += dt;
    const P = g.player?.position; if (!P) return;
    if ((this.check -= dt) <= 0) { this.check = 1;
      const near = this.stations().map((v) => ({ v, d: Math.hypot(v.x - P.x, v.z - P.z) })).filter((q) => q.d < NEAR).sort((a, b) => a.d - b.d).slice(0, MAX_ACTIVE);
      for (const [id, s] of this.active) if (!near.some((q) => q.v.id === id)) { s.root.removeFromParent(); this.active.delete(id); }
      for (const { v } of near) if (!this.active.has(v.id)) this.active.set(v.id, this.build(v));
    }
    const hour = (g.clock?.minutes ?? 720) / 60, busy = hour >= 6 && hour < 21 ? 1 : hour >= 21 || hour < 1 ? 0.45 : 0.15;
    for (const s of this.active.values()) this.tick(s, dt, busy);
  }
  build(v) {
    const root = new THREE.Group(); root.name = 'fuel-life:' + v.id; root.position.set(v.x, 0, v.z); root.rotation.y = v.yaw ?? 0; this.group.add(root);
    const people = [];
    const uniform = (i, role) => { const female = (v.id.length + i) % 3 === 0, app = defaultAppearance(female ? 'female' : 'male'); app.skin = (v.id.length * 3 + i) % 6; app.outfit = OUTFITS[app.gender][0].id; app.color = role === 'cashier' ? 3 : 7; app.palette = 1; const h = buildHuman(app); root.add(h.group); return h; };
    ATTENDANTS.forEach((a, i) => { const h = uniform(i, 'pump'); h.group.position.set(a.home[0], 0, a.home[1]); h.group.rotation.y = Math.PI / 2 * (i ? -1 : 1);
      const nozzle = new THREE.Mesh(new THREE.BoxGeometry(.06, .07, .22), new THREE.MeshStandardMaterial({ color: '#1b1b1b' })); nozzle.position.set(0, -.05, .1); nozzle.visible = false; h.bones['hand.R'].add(nozzle);
      const hose = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#111' })); hose.visible = false; hose.frustumCulled = false; root.add(hose);
      people.push({ h, anim: new CharacterAnimator(h, {}), a, state: 'idle', nozzle, hose, phase: i * 1.7 }); });
    const cashier = uniform(2, 'cashier'); cashier.group.position.set(1.6, 0, -16.2); cashier.group.rotation.y = 0; people.push({ h: cashier, anim: new CharacterAnimator(cashier, {}), cashier: true, phase: 3 });
    const lanes = LANES.map((L, i) => ({ ...L, cum: cumul(L.path), car: null, wait: 2 + i * 5 + (v.id.length % 4) }));
    return { v, root, people, lanes };
  }
  spawnCar(s, lane) {
    const geos = this.carGeos(); if (!geos.length) return null;
    const k = Math.floor(Math.random() * geos.length), paints = [...(PAINTS.sedan ?? ['#c9ccd0', '#1f1f1f', '#8b0000', '#f4f4f4', '#2a4d8f'])];
    const mesh = new THREE.Mesh(geos[k], new THREE.MeshStandardMaterial({ vertexColors: true, color: paints[Math.floor(Math.random() * paints.length)], metalness: .3, roughness: .4 }));
    mesh.castShadow = true; mesh.position.y = .08; s.root.add(mesh);
    const stopD = (() => { const i = lane.path.findIndex((p) => p[0] === lane.stop[0] && p[1] === lane.stop[1]); return lane.cum[i]; })();
    return { mesh, d: 0, stopD, total: lane.cum.at(-1), fuelled: false, timer: 0, speed: 0 };
  }
  tick(s, dt, busy) {
    for (const lane of s.lanes) {
      if (!lane.car) { lane.wait -= dt * busy; if (lane.wait <= 0) { lane.car = this.spawnCar(s, lane); lane.wait = 6 + Math.random() * 14; } continue; }
      const c = lane.car, att = s.people[lane.att];
      // drive: slow into the bay, wait while the attendant fills up, then away
      let target = 5.2; if (!c.fuelled) { const left = c.stopD - c.d; target = left < 6 ? Math.max(0, left * 0.9) : 5.2; if (left < 0.05) { target = 0; c.d = c.stopD; } }
      c.speed += Math.max(-6 * dt, Math.min(3 * dt, target - c.speed));
      if (!c.fuelled && c.d >= c.stopD - 0.01) {
        c.speed = 0; c.timer += dt;
        if (att.state === 'idle') { att.state = 'going'; att.lane = lane; }
        if (att.state === 'filling' && (att.fillT -= dt) <= 0) { att.state = 'back'; c.fuelled = true; this.served++; }
      } else c.d += c.speed * dt;
      const p = along(lane.path, lane.cum, c.d); c.mesh.position.set(p.x, .08, p.z);
      const want = Math.atan2(p.dx, p.dz); let dy = want - c.mesh.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.mesh.rotation.y += dy * Math.min(1, dt * 6);
      if (c.d >= c.total - 0.05) { c.mesh.removeFromParent(); c.mesh.material.dispose(); lane.car = null; }
    }
    // attendants walk to the car, fill up (nozzle in hand, hose from the pump), walk back
    for (const p of s.people) {
      if (p.cashier) { p.anim.update(dt, { speed: 0, grounded: true, turnRate: 0 }); const b = p.h.bones; b['upperArm.R'].rotation.x = -.5 - .1 * Math.sin(this.t * 1.3); b['foreArm.R'].rotation.x = -1; continue; }
      const pos = p.h.group.position, goTo = p.state === 'going' || p.state === 'filling' ? p.a.serve : p.a.home;
      const dx = goTo[0] - pos.x, dz = goTo[1] - pos.z, dist = Math.hypot(dx, dz);
      let speed = 0; if (dist > 0.05 && p.state !== 'filling') { speed = 1.4; const step = Math.min(dist, speed * dt); pos.x += dx / dist * step; pos.z += dz / dist * step; p.h.group.rotation.y = Math.atan2(dx, dz); }
      if (p.state === 'going' && dist <= 0.06) { p.state = 'filling'; p.fillT = 7 + Math.random() * 6; const car = p.lane.car?.mesh; if (car) p.h.group.rotation.y = Math.atan2(car.position.x - pos.x, car.position.z - pos.z); }
      if (p.state === 'back' && dist <= 0.06) { p.state = 'idle'; p.h.group.rotation.y = Math.atan2(p.a.serve[0] - pos.x, p.a.serve[1] - pos.z); }
      p.anim.update(dt, { speed, grounded: true, turnRate: 0 });
      const holding = p.state === 'filling' || p.state === 'going';
      p.nozzle.visible = holding; p.hose.visible = holding;
      if (holding) { const b = p.h.bones; b['upperArm.R'].rotation.set(-1.1, 0, -.15); b['foreArm.R'].rotation.set(-.35, 0, 0);
        const hand = p.nozzle.getWorldPosition(this._v ??= new THREE.Vector3()); s.root.worldToLocal(hand); const arr = p.hose.geometry.attributes.position; arr.setXYZ(0, p.a.pump[0], 1.05, p.a.pump[1]); arr.setXYZ(1, hand.x, hand.y, hand.z); arr.needsUpdate = true; }
      else if (p.state === 'idle') { const b = p.h.bones; b['upperArm.L'].rotation.x = -.15 + .05 * Math.sin(this.t + p.phase); b['upperArm.R'].rotation.x = -.15; }
    }
  }
  stats() { let cars = 0, people = 0; for (const s of this.active.values()) { cars += s.lanes.filter((l) => l.car).length; people += s.people.length; } return { active: this.active.size, cars, people, served: this.served }; }
}
