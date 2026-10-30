import * as THREE from 'three';
import { pickStoreBuilding } from '../buy/HomeStores.js';
import { buildVenue, venueNear, venueDoor } from '../world/VenueArchitecture.js';
import { naira } from '../economy/Economy.js';
/**
 * v0.39: hospitals and ambulances.
 * - Two hospitals take over existing large commercial buildings (fictional names: the real hospitals' exact sites
 *   couldn't be checked from here). Red-cross sign, a parked ambulance, a map pin, and a reception where you can be
 *   treated (check-up, or a night in a ward) to recover.
 * - Ambulances drive in the traffic with flashing lights and a siren.
 * - If a vehicle knocks you down, an ambulance comes for you with its siren on and takes you to the nearest hospital
 *   (you lose a few hours; treatment costs up to ₦3,000, free if you can't pay). If you knock someone down while
 *   driving, an ambulance comes for them.
 */
export const HOSPITALS = [
  { id: 'iweka-general', name: 'Iweka Road General Hospital', near: 'upper-iweka', min: 160 },
  { id: 'nkem-specialist', name: 'Nkem Memorial Specialist Hospital', near: 'main-market', min: 180 },
];
export const KNOCK_FEE = 3000, CHECKUP_FEE = 2500, WARD_FEE = 6000;
/** What the knock-down costs: the fee if you can pay it, otherwise whatever you have, otherwise free. Pure. */
export const knockFee = (balance) => Math.max(0, Math.min(KNOCK_FEE, Math.floor(balance)));
const TAU = Math.PI * 2;
function overlayFor() { // light bar, red stripes, AMBULANCE sides — positioned over a van body each frame
  const g = new THREE.Group(), red = new THREE.MeshBasicMaterial({ color: '#ff2a2a' }), white = new THREE.MeshBasicMaterial({ color: '#ffffff' }), blue = new THREE.MeshBasicMaterial({ color: '#2a7bff' });
  const box = (w, h, d, x, y, z, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); g.add(b); return b; };
  box(1.3, 0.1, 0.3, 0, 2.48, 1.6, new THREE.MeshStandardMaterial({ color: '#222' }));
  const lamps = [box(0.42, 0.16, 0.26, -0.42, 2.6, 1.6, red), box(0.42, 0.16, 0.26, 0, 2.6, 1.6, white), box(0.42, 0.16, 0.26, 0.42, 2.6, 1.6, blue)];
  const c = document.createElement('canvas'); c.width = 512; c.height = 96; const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, 512, 96); x.fillStyle = '#d4202a'; x.fillRect(0, 0, 512, 14); x.fillRect(0, 82, 512, 14); x.font = 'bold 56px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('AMBULANCE', 300, 50); x.fillRect(40, 24, 16, 48); x.fillRect(24, 40, 48, 16);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
  for (const side of [-1, 1]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), mat); m.position.set(side * 1.0, 1.35, 0); m.rotation.y = side * Math.PI / 2; g.add(m); }
  return { group: g, lamps };
}
export class Hospitals {
  constructor(g) { this.g = g; this.list = []; this.group = new THREE.Group(); this.group.name = 'Hospitals'; this.overlays = []; this.time = 0; this.knocked = null; this.run = null; this.seq = 0; }
  setup() {
    const g = this.g, w = g.world, taken = new Set([...g.homes.listings.map((h) => h.buildingId), ...(g.homeStores?.stores ?? []).map((s) => s.buildingId)]);
    const avoid = w.landmarks.list.filter((l) => ['market', 'mall', 'interchange'].includes(l.kind)).map((l) => ({ x: l.x, z: l.z, r: (l.radius ?? 60) + 10 }));
    // v0.43: each hospital is its own purpose-built building on a clear plot (it used to borrow a shop building, and one
    // ended up sharing a block with the furniture showroom). The old way is only a fallback if no plot fits.
    const stores = (g.homeStores?.stores ?? []).map((s) => ({ x: s.door?.stand?.x ?? s.x, z: s.door?.stand?.z ?? s.z, r: 40 })).filter((q) => Number.isFinite(q.x));
    for (const [i, def] of HOSPITALS.entries()) {
      const v = venueNear(w, def.near, 'hospital', { from: 60, avoid: [...stores, ...this.list.map((h) => ({ x: h.place.x, z: h.place.z, r: 120 }))], seed: i });
      if (v) { this.list.push(this.buildVenue(def, v)); continue; }
      const pick = pickStoreBuilding(w.map, w.landmarks, def, taken, (x, z, r) => w.collision.isFree(x, z, r), avoid);
      if (!pick) { console.warn('[hospitals] no building for', def.id); continue; }
      taken.add(pick.b.id); this.list.push(this.build(def, pick));
    }
    g.renderer.scene.add(this.group);
  }
  buildVenue(def, plot) {
    const g = this.g, v = { id: def.id, kind: 'hospital', name: def.name, ...plot }; buildVenue(g.world, v, this.group);
    const d = venueDoor(v, -1, -10.9, 4.6), bay = d.world(7.6, -4.6), h = { ...def, venue: true, door: d, place: { x: d.stand.x, z: d.stand.z } };
    h.parkAt = { x: bay.x, z: bay.z, yaw: v.yaw ?? 0, ax: Math.sin(v.yaw ?? 0), az: Math.cos(v.yaw ?? 0) };
    g.interactions.register({ x: d.stand.x, z: d.stand.z, radius: 3, priority: 2, enabled: () => !!g.saveData && !g.homes.inside && !g.vehicles.driving && !this.knocked && !g.civic?.inside, label: () => `${def.name} — go in`, onInteract: () => this.enter(h) });
    return h;
  }
  /** v0.44: walk in — reception, the consulting room, the ward and the pharmacy are inside (src/interiors). */
  enter(h) {
    const g = this.g, see = () => g.openChoice(() => this.view(h));
    h.civic ??= { id: `hospital-${h.id}`, kind: 'hospital', name: h.name, x: h.place.x, z: h.place.z, visitSpot: h.place, interior: { kind: 'hospital', hours: [0, 24], welcome: `${h.name} · reception is on your left`, counters: [
      { at: 'staff', label: 'Staff only — doctors and nurses', act: () => g.openChoice(() => g.occupationsCity?.staffView({ name: h.name }, ['doctor', 'nurse'])) },
      { at: 'reception', label: 'Reception — see a doctor', act: see }, { at: 'doctor', label: 'Consulting room — a check-up', act: see }, { at: 'ward', label: 'Ward — a bed for the night', act: see }, { at: 'pharmacy', label: 'Pharmacy', act: see }] } };
    return g.civic.enter(h.civic);
  }
  build(def, { b, door: d }) {
    const g = this.g, yaw = Math.atan2(d.nx, d.nz), h = { ...def, buildingId: b.id, door: d, place: { x: d.stand.x, z: d.stand.z } };
    const c = document.createElement('canvas'); c.width = 1024; c.height = 180; const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 1024, 180); x.fillStyle = '#d4202a'; x.fillRect(40, 60, 100, 60); x.fillRect(60, 40, 60, 100);
    x.fillStyle = '#123c69'; x.font = '800 60px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(def.name.toUpperCase(), 580, 70, 820); x.font = '600 38px Arial'; x.fillStyle = '#d4202a'; x.fillText('24-HOUR EMERGENCY · ACCIDENT & GENERAL CARE', 580, 135, 820);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.05), new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.4 }));
    sign.position.set(d.x + d.nx * 0.12, Math.min(3.4, (b.levels ?? 1) * 3 - 0.3), d.z + d.nz * 0.12); sign.rotation.y = yaw; sign.name = 'hospital-sign'; this.group.add(sign);
    // parked ambulance beside the entrance
    h.parkAt = this.parkingSpot(d, yaw); // the parked ambulance is added once the vehicle models have loaded (see update)
    g.interactions.register({ x: d.stand.x, z: d.stand.z, radius: 2.4, priority: 2, enabled: () => !!g.saveData && !g.homes.inside && !g.vehicles.driving && !this.knocked, label: () => `${def.name} — see a doctor`, onInteract: () => g.openChoice(() => this.view(h)) });
    return h;
  }
  /** Beside the entrance, clear of walls, posts and the carriageway (a little kerb overhang allowed if nothing else fits). */
  parkingSpot(d, yaw) {
    const g = this.g, ax = Math.sin(yaw + Math.PI / 2), az = Math.cos(yaw + Math.PI / 2);
    for (const margin of [0.4, -0.9]) for (const off of [4.5, -4.5, 7, -7, 10, -10, 13, -13]) for (const out of [2.2, 3.2, 4.2]) {
      const px = d.x + d.ux * off + d.nx * out, pz = d.z + d.uz * off + d.nz * out;
      if ([[0, 0], [ax * 2.4, az * 2.4], [-ax * 2.4, -az * 2.4]].every(([u, v]) => g.world.collision.isFree(px + u, pz + v, 1.05) && !g.world.map.onCarriageway(px + u, pz + v, margin))) return { x: px, z: pz, yaw: yaw + Math.PI / 2, ax, az };
    }
    return null;
  }
  vanMesh() { return this.g.vehicles.makeMesh('mercedes_sprinter', '#f4f4f2'); } // same white Sprinter body as the player's own vans
  park(h) {
    const g = this.g, s = h.parkAt; if (!s || h.parked) return;
    let van; try { van = this.vanMesh(); } catch { return; } // models still loading: try again later
    h.parkAt = null; van.position.set(s.x, 0, s.z); van.rotation.y = s.yaw; const o = overlayFor(); van.add(o.group); this.group.add(van); h.parked = { van, lamps: o.lamps };
    for (const k of [0, 1.6, -1.6]) g.world.collision.addCircle(s.x + s.ax * k, s.z + s.az * k, k ? 1.1 : 1.3);
  }
  view(h) {
    const g = this.g, bal = g.economy.balance;
    return { sheet: true, title: h.name, kicker: 'HOSPITAL', text: 'Reception: "Welcome. What can we do for you today?"', options: [
      { label: `Check-up & treatment · ${naira(CHECKUP_FEE)}`, sub: '1 hour · you leave rested', disabled: bal < CHECKUP_FEE, why: 'Not enough money', act: () => this.treat(h, 'checkup') },
      { label: `Rest in a ward bed · ${naira(WARD_FEE)}`, sub: '8 hours · fully rested', disabled: bal < WARD_FEE, why: 'Not enough money', act: () => this.treat(h, 'ward') },
      { label: 'Done', ghost: true, act: () => g.closeChoice() } ] };
  }
  treat(h, kind) {
    const g = this.g, fee = kind === 'ward' ? WARD_FEE : CHECKUP_FEE;
    const tx = g.economy.transact({ key: `hospital:${h.id}:${Date.now()}:${++this.seq}`, amount: -fee, reason: `${h.name}: ${kind === 'ward' ? 'ward bed' : 'check-up'}` });
    if (!tx.ok) { g.ui.toast('Not enough money.'); return; }
    g.closeChoice(); g.skipTime(kind === 'ward' ? 480 : 60);
    g.needs.adjust(kind === 'ward' ? { energy: 100, hygiene: 25, fun: 5 } : { energy: 35, hygiene: 10, fun: 5 });
    g.saveGame(); g.ui.toast(kind === 'ward' ? 'You slept in the ward and feel strong again.' : 'The doctor checked you over. You feel much better.');
  }
  nearest(x, z) { let best = null; for (const h of this.list) { const d = Math.hypot(h.place.x - x, h.place.z - z); if (!best || d < best.d) best = { h, d }; } return best?.h ?? null; }
  places() { return this.list.map((h) => ({ x: h.place.x, z: h.place.z, kind: 'hospital', id: 'hospital-' + h.id, label: h.name })); }

  // ── knock-downs and ambulance runs ──────────────────────────────────────
  /** A traffic vehicle hit the player on foot. */
  knockDown(vehicle) {
    const g = this.g; if (this.knocked || g.homes.inside || g.vehicles.driving || g.state !== 'playing' || !this.list.length) return false;
    if (performance.now() - (this.lastKnock ?? -1e9) < 20000) return false;
    this.lastKnock = performance.now();
    g.traffic.hit?.(vehicle, 'npc', 2);
    const p = g.player.position; this.knocked = { x: p.x, z: p.z, t: 0 };
    g.ui.toast('You were knocked down! Someone has called an ambulance.', 5000);
    this.flash(true);
    this.dispatch(p.x, p.z, 'player');
    return true;
  }
  /** You hit someone while driving: an ambulance comes for them (if one isn't already on a run). */
  npcHit(x, z) { if (!this.run && this.list.length) { this.dispatch(x, z, 'npc'); this.g.ui.toast('Someone called an ambulance for the person you hit.'); } }
  dispatch(x, z, who) {
    const g = this.g, nr = g.world.map.nearestRoad(x, z, { maxDist: 60 });
    let ux = 1, uz = 0, rx = x, rz = z;
    if (nr?.road?.points?.length > 1) { // nearest point on the nearest road: the ambulance comes along it
      const P = nr.road.points; let bd = Infinity;
      for (let i = 0; i < P.length - 1; i++) { const [ax, az] = P[i], [bx, bz] = P[i + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz); if (d < bd) { bd = d; rx = px; rz = pz; const L = Math.sqrt(L2); ux = dx / L; uz = dz / L; } }
    }
    if (!this.van) { try { this.van = this.vanMesh(); const o = overlayFor(); this.van.add(o.group); this.vanLamps = o.lamps; this.van.visible = false; this.group.add(this.van); } catch { this.van = null; } }
    const from = { x: rx - ux * 70, z: rz - uz * 70 }, to = { x: rx - ux * 5 + (x - rx) * 0.4, z: rz - uz * 5 + (z - rz) * 0.4 };
    this.run = { who, from, to, t: 0, dur: 8, yaw: Math.atan2(ux, uz), wait: 0 };
    if (this.van) { this.van.visible = true; this.van.position.set(from.x, 0, from.z); this.van.rotation.y = this.run.yaw; }
  }
  flash(on) { let el = document.getElementById('knock-flash'); if (!el) { el = document.createElement('div'); el.id = 'knock-flash'; el.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:60;background:radial-gradient(circle,rgba(120,0,0,0) 30%,rgba(140,0,0,.55));transition:opacity .6s;opacity:0'; document.body.append(el); } el.style.opacity = on ? '1' : '0'; }
  update(dt) {
    const g = this.g; this.time += dt;
    // ambient ambulances in the traffic: light bar + side signs over the van body
    const amb = g.traffic.near?.filter((v) => v.ambulance) ?? [];
    while (this.overlays.length < amb.length && this.overlays.length < 2) { const o = overlayFor(); this.group.add(o.group); this.overlays.push(o); }
    this.overlays.forEach((o, i) => { const v = amb[i]; o.group.visible = !!v; if (!v) return; o.group.position.set(v.x, v.y ?? 0, v.z); o.group.rotation.y = v.yaw; this.blink(o.lamps); });
    for (const h of this.list) { if (h.parkAt) this.park(h); if (h.parked) this.blink(h.parked.lamps, 0.4); }
    let near = Infinity; for (const v of amb) near = Math.min(near, Math.hypot(v.x - g.player.position.x, v.z - g.player.position.z));
    // the ambulance on its way
    // the rescue runs on the real clock (a slow device's capped frame step would leave you lying in the road for minutes)
    const now = performance.now(), rdt = Math.min(0.5, Math.max(dt, (now - (this.lastT ?? now)) / 1000)); this.lastT = now;
    const r = this.run;
    if (r && this.van) {
      r.t += rdt; const k = Math.min(1, r.t / r.dur), e = 1 - (1 - k) ** 2;
      this.van.position.set(r.from.x + (r.to.x - r.from.x) * e, 0, r.from.z + (r.to.z - r.from.z) * e); this.van.rotation.y = r.yaw;
      this.blink(this.vanLamps); near = Math.min(near, Math.hypot(this.van.position.x - g.player.position.x, this.van.position.z - g.player.position.z));
      if (k >= 1) { r.wait += rdt; if (r.wait > 2.5) { if (r.who === 'player' && this.knocked) this.toHospital(); this.van.visible = false; this.run = null; } }
    }
    if (this.knocked) { this.knocked.t += rdt; if (!this.run && this.knocked.t > 12) this.toHospital(); }
    this.siren(near, g.state === 'playing' && !document.hidden && !g.homes?.inside);
  }
  blink(lamps, slow = 1) { const ph = Math.floor(this.time * 7 * slow) % 3; lamps?.forEach((l, i) => { l.visible = i === ph || (i === 1 && ph === 2); }); }
  /** After the ambulance picks you up: the nearest hospital, a few hours later, treated. */
  toHospital() {
    const g = this.g, k = this.knocked; if (!k) return;
    const h = this.nearest(k.x, k.z), done = () => {
      this.knocked = null; this.flash(false); if (g.player.human) g.player.human.group.rotation.x = 0;
      if (h) g.player.teleport(h.place.x, h.place.z, Math.atan2(h.door.nx, h.door.nz));
      g.skipTime(180);
      const fee = knockFee(g.economy.balance);
      if (fee > 0) g.economy.transact({ key: `hospital-knock:${g.clock.day}:${Math.round(g.clock.minutes)}:${++this.seq}`, amount: -fee, reason: `${h?.name ?? 'Hospital'}: accident & emergency` });
      g.needs.adjust({ energy: 20, fun: -10 });
      g.saveGame();
      g.ui.toast(`You were treated at ${h?.name ?? 'the hospital'}. ${fee ? naira(fee) + ' paid for your treatment.' : 'They treated you free of charge.'} Watch the road!`, 6000);
    };
    g.ui.fade ? g.ui.fade(done) : done();
  }
  siren(distance, live) {
    const a = this.g.audio; if (!a?.ctx) return;
    if (!this.sound) { const ctx = a.ctx, osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'triangle'; gain.gain.value = 0; osc.connect(gain).connect(a.master); osc.start(); this.sound = { osc, gain }; }
    const t = a.ctx.currentTime; this.sound.osc.frequency.setTargetAtTime(Math.floor(this.time * 1.4) % 2 ? 960 : 720, t, 0.02); // hi-lo wail
    this.sound.gain.gain.setTargetAtTime(live && distance < 120 ? 0.09 * (1 - distance / 120) ** 2 : 0, t, 0.15);
  }
}
