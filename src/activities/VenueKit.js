import * as THREE from 'three';
import { venuePlot, rect } from '../world/StreetLayout.js';

/**
 * Small helper for the walk-in activity places (pool corner, gaming centre, viewing centre, barbershop,
 * food stalls, basketball court). Everything stays in the real city: places sit on road-fronting plots found
 * the same way as the existing venues, open to the street, with real colliders — no teleporting.
 *
 * Local space follows the existing venues: origin 1.5 m behind the street edge, +z faces the road,
 * the place extends back into −z.
 */
export class VenueSite {
  constructor(g, id, near, { w = 10, d = 10 } = {}) {
    const world = g.world; this.g = g; this.id = id;
    const p = venuePlot(world, near, { w, d });
    world.collision.removePolygon(p.plot.pi); // the reservation; real walls are added below
    Object.assign(this, { x: p.x, z: p.z, yaw: p.yaw, w, d, frontage: p.frontage });
    this.group = new THREE.Group(); this.group.name = `activity-place:${id}`; this.group.position.set(p.x, 0, p.z); this.group.rotation.y = p.yaw;
    g.renderer.scene.add(this.group); this.mats = new Map();
  }
  /** Local (u, w) → world {x, z}. */
  at(u, w) { const c = Math.cos(this.yaw), s = Math.sin(this.yaw); return { x: this.x + c * u + s * w, z: this.z - s * u + c * w }; }
  mat(color, opts = {}) { const k = color + JSON.stringify(opts); if (!this.mats.has(k)) this.mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...opts })); return this.mats.get(k); }
  box(w, h, d, u, y, z, color, solid = false, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, opts)); m.position.set(u, y, z); m.castShadow = h > 0.2; m.receiveShadow = true; this.group.add(m);
    if (solid) this.solid(u, z, w, d, h);
    return m;
  }
  solid(u, z, w, d, h = 1) { const pts = rect(u, z, w, d).map(([a, b]) => { const p = this.at(a, b); return [p.x, p.z]; }); this.g.world.collision.addPolygon(pts, h); }
  cyl(r, h, u, y, z, color, solid = false) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), this.mat(color)); m.position.set(u, y, z); m.castShadow = true; this.group.add(m); if (solid) { const p = this.at(u, z); this.g.world.collision.addCircle(p.x, p.z, r + 0.05); } return m; }
  sign(text, w, h, u, y, z, bg = '#143e36', fg = '#fff2cc', rotY = 0) {
    const c = document.createElement('canvas'); c.width = 1024; c.height = Math.max(64, Math.round(1024 * h / w)); const x = c.getContext('2d');
    x.fillStyle = bg; x.fillRect(0, 0, c.width, c.height); x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `800 ${Math.round(c.height * 0.5)}px Arial`; x.fillText(text, 512, c.height / 2 + 2, 990);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })); m.position.set(u, y, z); m.rotation.y = rotY; this.group.add(m); return m;
  }
  /** Open-fronted shop: floor, back and side walls (solid), roof, fascia sign facing the street. */
  shed({ w = this.w - 1, d = this.d - 1, h = 3.1, wall = '#e3d6bd', roof = '#7a8a8e', trim = '#254b55', floor = '#bdb5a3', sign = null, signBg = '#143e36', signFg = '#fff2cc', front = 'open', door = 2.4 } = {}) {
    this.box(w, 0.1, d, 0, 0.05, -d / 2, floor);
    this.box(w, h, 0.18, 0, h / 2, -d, wall, true);
    for (const s of [-1, 1]) this.box(0.18, h, d, s * w / 2, h / 2, -d / 2, wall, true);
    if (front === 'door') for (const s of [-1, 1]) { const seg = (w - door) / 2; this.box(seg, h, 0.18, s * (door / 2 + seg / 2), h / 2, 0, wall, true); }
    this.box(w + 0.6, 0.18, d + 0.8, 0, h + 0.09, -d / 2 + 0.2, roof);
    this.box(w + 0.6, 0.5, 0.12, 0, h - 0.1, 0.55, trim);
    if (sign) this.sign(sign, Math.min(w, 9), 0.7, 0, h + 0.55, 0.62, signBg, signFg);
    this.inner = { w, d, h };
  }
  /** Register a walk-up interaction at local (u, w). */
  interact(u, w, label, onInteract, { radius = 2.2, priority = 1, enabled = () => true } = {}) {
    const g = this.g, p = this.at(u, w);
    return g.interactions.register({ x: p.x, z: p.z, radius, priority, label,
      enabled: () => !!g.saveData && !g.activities?.active && !g.homes.inside && !g.club.inside && !g.civic.inside && !g.vehicles.driving && !g.transport.riding && !g.story?.s?.arrest && !g.story?.s?.pending && enabled(),
      onInteract });
  }
  /** A seated/standing extra drawn from the existing NPC system (they keep their own schedules). */
  person(i, u, w, faceYaw, { name, gender = 'male', activity = 'idle', schedule = [8, 22], seatY = null, role = 'neighbour' } = {}) {
    const p = this.at(u, w), yaw = this.yaw + faceYaw;
    return this.g.npcs.addAnchored({ id: `${this.id}:${i}`, kind: 'activity', role, name, ...p, nx: Math.sin(yaw), nz: Math.cos(yaw), schedule, gender, activity, ...(seatY != null ? { seatY } : {}) });
  }
  get place() { return { x: this.x, z: this.z }; }
}

/** Opening hours check with overnight support. */
export const openAt = (h, [a, b]) => (a > b ? h >= a || h < b : h >= a && h < b);
export const fmtHours = ([a, b]) => `${a % 24}:00–${b % 24}:00`;
