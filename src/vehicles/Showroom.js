import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rect } from '../world/StreetLayout.js';
import { SHOWROOM, SHOWROOM_LOT } from '../data/VehicleCatalogue.js';
import { VEHICLE_MODELS } from '../data/housing.js';

/*
  v0.48: Prestige Autos Onitsha (fictional), a premium showroom near Onitsha Mall. A glass showroom with cars on
  turntables inside, three cars on the forecourt, a pylon sign and a sales desk at the door. It sells the premium
  vehicles (G-Class, Range Rover, Land Cruiser, Escalade, X5/X7, GLS, S-Class, 7 Series, LS, A6/A8, Cayenne, M5,
  RS 7, and the dearest cars already in the game); bought cars come out in the marked bay on the forecourt.
  Placed after the whole city (on clear land with a straight driveway), so nothing already built moves.
*/
const col = (geo, hex) => { const g = geo.index ? geo.toNonIndexed() : geo, c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; };
const PAINTS = ['#0e0f12', '#f2f2f0', '#9aa1a6', '#1f2a44', '#5a1d22', '#2f3b33'];

export class Showroom {
  /** v0.49: more showrooms with their own name, stock and place (opts); with no opts, Prestige Autos as in v0.48. */
  constructor(g, opts = {}) { this.g = g; this.plot = null; this.lot = opts.lot ?? SHOWROOM_LOT; this.stock = opts.stock ?? SHOWROOM; this.anchor = opts.anchor ?? null; this.title = opts.title ?? 'PRESTIGE AUTOS'; this.sub = opts.sub ?? 'ONITSHA · PREMIUM VEHICLES'; this.premium = opts.premium ?? true; this.tag = opts.tag ?? 'showroom48'; this.show = opts.show ?? null; this.reach = opts.reach ?? 420; }
  setup() {
    const g = this.g, w = g.world, LOT = this.lot, mall = this.anchor ?? w.landmarks.get(SHOWROOM_LOT.near) ?? w.landmarks.get('shoprite');
    const plot = g.terminals?.findPlot(mall, { sizes: [[36, 28], [32, 26], [30, 24]], reach: this.reach }, new Set());
    if (!plot) { console.warn('[showroom] no clear plot near the mall'); return; }
    const { W, D, n, uAx: f, O } = plot, yaw = Math.atan2(-f.z, f.x), P = (u, v) => ({ x: O.x + f.x * u + n.x * v, z: O.z + f.z * u + n.z * v });
    const parts = [], glass = [], meshes = [];
    const box = (u, v, y, sw, sh, sd, hex, solid = false, into = parts) => { const p = P(u, v), geo = new THREE.BoxGeometry(sw, sh, sd); geo.rotateY(yaw); geo.translate(p.x, y, p.z); into.push(into === glass ? geo : col(geo, hex)); if (solid) w.collision.addPolygon(rect(p.x, p.z, sw, sd, yaw), Math.max(1, sh)); };
    // forecourt and the collection bay
    box(0, D / 2, 0.035, W, 0.07, D, '#d9d6cf'); const gU = -W / 2 + 6;
    for (const e of [-1.6, 1.6]) box(gU + e, 6, 0.08, 0.14, 0.01, 6, '#ffffff'); box(gU, 3, 0.08, 3.3, 0.01, 0.14, '#ffffff'); box(gU, 9, 0.08, 3.3, 0.01, 0.14, '#ffffff');
    // the glass showroom: white frame, glass walls, roof slab with a fascia; side and back walls solid
    const b0 = 12.5, b1 = D - 1, bm = (b0 + b1) / 2, bd = b1 - b0, H = 6.2;
    box(0, bm, 0.12, W - 2, 0.12, bd, '#ecebe7');
    box(0, bm, H, W - 1.4, 0.35, bd + 0.6, '#f4f4f2'); box(0, b0 - 0.25, H - 0.6, W - 1.4, 0.9, 0.12, '#1b1f22');
    for (let u = -W / 2 + 1; u <= W / 2 - 1 + 0.01; u += (W - 2) / 6) box(u, b0, H / 2, 0.22, H, 0.22, '#f4f4f2');
    for (const e of [-1, 1]) box(e * (W / 2 - 1), bm, H / 2, 0.25, H, bd, '#e6e3dc');
    box(0, b1, H / 2, W - 2, H, 0.25, '#e6e3dc');
    box(0, b0, H / 2 - 0.2, W - 2.2, H - 0.5, 0.05, null, false, glass);
    w.collision.addPolygon(rect(P(0, bm).x, P(0, bm).z, W - 2, bd, yaw), H);
    // pylon sign and fascia text
    const sign = (u, v, y, sw, sh, draw, face = Math.PI) => { const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * sh / sw); draw(c.getContext('2d'), c.width, c.height); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.2, side: THREE.DoubleSide })); const p = P(u, v); m.position.set(p.x, y, p.z); m.rotation.y = yaw + face; meshes.push(m); };
    const brand = (c, cw, ch, sub) => { c.fillStyle = '#121416'; c.fillRect(0, 0, cw, ch); c.strokeStyle = '#c8a24a'; c.lineWidth = Math.max(6, ch * 0.05); c.strokeRect(10, 10, cw - 20, ch - 20); c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `800 ${Math.round(ch * 0.36)}px "Bricolage Grotesque", system-ui, sans-serif`; c.fillText(this.title, cw / 2, ch * 0.4, cw - 60); c.fillStyle = '#c8a24a'; c.font = `600 ${Math.round(ch * 0.15)}px "DM Sans", system-ui, sans-serif`; c.fillText(sub, cw / 2, ch * 0.78, cw - 60); };
    sign(0, b0 - 0.33, H - 0.6, Math.min(16, W - 6), 0.85, (c, cw, ch) => brand(c, cw, ch, this.sub));
    box(W / 2 - 2.2, 1.6, 4, 0.5, 8, 0.5, '#2b2f31', true);
    sign(W / 2 - 2.2, 1.3, 7, 3.2, 2.4, (c, cw, ch) => brand(c, cw, ch, 'SALES · SHOWROOM'));
    // bollards along the front
    for (let u = gU + 3.5; u < W / 2 - 3; u += 2.2) { const p = P(u, 0.4), geo = new THREE.CylinderGeometry(0.12, 0.12, 0.9, 8); geo.translate(p.x, 0.45, p.z); parts.push(col(geo, '#2b2f31')); w.collision.addCircle(p.x, p.z, 0.15); }
    const mesh = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 })); mesh.name = 'prestige-autos';
    const gl = new THREE.Mesh(mergeGeometries(glass), new THREE.MeshStandardMaterial({ color: '#9fc4d6', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.5, depthWrite: false }));
    const root = new THREE.Group(); root.name = 'Showroom'; root.add(mesh, gl, ...meshes);
    // cars on display: three on the forecourt, three inside on turntables
    const vc = g.vehicles, sm = this.show ?? ['mercedes_g63', 'range_rover', 'porsche_cayenne', 'mercedes_sclass', 'cadillac_escalade', 'bmw_x7'], show = [[sm[0], -2, 6.5, 0.6], [sm[1], 5, 6.5, 0.6], [sm[2], 11.5, 6.5, 0.6], [sm[3], -8, bm, -0.5], [sm[4], 0, bm, -0.5], [sm[5], 8, bm, -0.5]];
    this.displays = [];
    show.forEach(([model, u, v, turn], i) => {
      if (!VEHICLE_MODELS[model] || u > W / 2 - 4 || u < -W / 2 + 4) return;
      const m = vc.makeMesh(model, PAINTS[i % PAINTS.length]), p = P(u, v); m.position.set(p.x, v === bm ? 0.2 : 0.05, p.z); m.rotation.y = yaw + Math.PI + turn; root.add(m); this.displays.push(m);
      if (v === bm) { const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.16, 32), new THREE.MeshStandardMaterial({ color: '#d0d3d6', roughness: 0.25, metalness: 0.5 })); t.position.set(p.x, 0.1, p.z); root.add(t); }
      else w.collision.addCircle(p.x, p.z, 1.6);
    });
    g.vehicles.group.add(root); this.root = root;
    // the dealer: a desk at the door; stock = the premium list; delivery to the bay
    const desk = P(W / 2 - 8, b0 - 1.2), delivery = P(gU, 6), heading = Math.atan2(-n.x, -n.z);
    this.plot = { id: LOT.id, name: LOT.name, premium: this.premium, x: P(0, D / 2).x, z: P(0, D / 2).z, desk, delivery, heading, entry: P(gU, -2), group: root };
    this.stock.forEach((M, k) => { const spec = VEHICLE_MODELS[M.id]; if (!spec) return; vc.spots.push({ id: `${LOT.id}:${this.tag}:${M.id}`, lot: LOT.id, lotName: LOT.name, model: M.id, label: spec.label, price: spec.price, paint: PAINTS[k % PAINTS.length], x: delivery.x, z: delivery.z, heading, desk, plot: this.plot }); });
    try { g.npcs.addAnchored({ id: LOT.id === SHOWROOM_LOT.id ? 'prestige:sales' : `${LOT.id}:sales`, kind: 'host', role: 'neighbour', name: 'Sales executive', x: desk.x + n.x * 0.8, z: desk.z + n.z * 0.8, nx: -n.x, nz: -n.z, schedule: [8, 19] }); } catch { /* */ }
    g.interactions.register({ x: desk.x, z: desk.z, radius: 3.2, enabled: () => !!vc.sys && !vc.driving, label: () => `${this.premium ? 'Premium vehicles' : 'Cars for sale'} · ${LOT.name}`, onInteract: () => g.openChoice(() => vc.dealerView(this.plot)) });
  }
  update(dt) { if (!this.root) return; const f = this.g.worldFocus?.() ?? this.g.player.position, near = Math.hypot(f.x - this.plot.x, f.z - this.plot.z) < 600; this.root.visible = near; if (near) for (const [i, m] of this.displays.entries()) if (i >= 3) m.rotation.y += dt * 0.15; }
  places() { return this.plot ? [{ x: this.plot.x, z: this.plot.z, kind: this.lot.id === SHOWROOM_LOT.id ? 'mall' : 'showroom', id: this.lot.id === SHOWROOM_LOT.id ? 'prestige-autos' : this.lot.id, label: this.lot.name }] : []; }
}
