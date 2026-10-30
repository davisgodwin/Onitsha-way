import * as THREE from 'three';
import { VenueSite, openAt } from './VenueKit.js';
import { ensureActivities } from './ActivityRecords.js';
import { naira } from '../economy/Economy.js';

export const WASH_HOURS = [8, 19];
export const WASH_SERVICES = [
  { id: 'wash', label: 'Exterior wash', price: 1500, note: 'Washed, rinsed and wiped dry.' },
  { id: 'polish', label: 'Wash & polish', price: 3500, note: 'Washed and polished — dust builds up half as fast for 3 days.' },
];
const DUST = new THREE.Color('#8a7a62'), shown = new WeakMap();

/** Paint dust: blend each painted material of the vehicle towards road dust by its dirt level. */
export function tintVehicle(mesh, paint, dirt) {
  if (!mesh) return;
  const base = new THREE.Color(paint), k = Math.max(0, Math.min(1, dirt)) * 0.5;
  mesh.traverse((o) => { const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []; for (const m of ms) { if (!m.color || !m.vertexColors) continue; m.userData.basePaint ??= m.color.getHex(); if (m.userData.basePaint !== base.getHex()) continue; m.color.copy(base).lerp(DUST, k); m.roughness = 0.4 + k * 0.6; } });
}
/** Wash one owned vehicle: pay once (unique key), dirt to zero; polish slows new dust for 3 days. */
export function washVehicle(g, v, serviceId) {
  const svc = WASH_SERVICES.find((s) => s.id === serviceId); if (!svc || !v) return { ok: false, error: 'Unknown service' };
  const rec = (ensureActivities(g.saveData).games.carwash ??= { played: 0, seq: 0, finished: [] });
  const tx = g.economy.transact({ key: `carwash:${v.id}:${(rec.seq = (rec.seq ?? 0) + 1)}`, amount: -svc.price, reason: `Sparkle Car Wash: ${svc.label}` });
  if (!tx.ok) return { ok: false, error: 'Not enough money' };
  rec.played = (rec.played ?? 0) + 1;
  v.dirt = 0; if (svc.id === 'polish') v.polished = g.clock.day + 3; else delete v.polished;
  return { ok: true, svc };
}

/**
 * Sparkle Car Wash: park your own car in the bay (or anywhere close), walk to the attendant, pick a service.
 * Owned cars collect road dust as you drive (shown on the paint); washing restores the colour.
 */
export class CarWash {
  constructor(g) { this.g = g; this.t = 0; }
  setup() {
    const g = this.g, l = g.world.landmarks.get('fegge') ?? g.world.landmarks.get('main-market');
    const s = this.site = new VenueSite(g, 'sparkle-car-wash', { x: l.x + 20, z: l.z - 30 }, { w: 10, d: 10 });
    s.box(10, 0.1, 10, 0, 0.05, -5, '#9aa0a2');
    for (const u of [-4.6, 4.6]) for (const w of [-0.6, -9.4]) s.box(0.18, 3.6, 0.18, u, 1.8, w, '#2b5d8c');
    s.box(9.8, 0.08, 9.4, 0, 3.6, -5, '#3d7bb5', false, { transparent: true, opacity: 0.85 });
    s.box(10.2, 0.6, 0.12, 0, 3.3, -0.55, '#2b5d8c'); s.sign('SPARKLE CAR WASH · ₦1,500', 7, 0.5, 0, 3.3, -0.48, '#2b5d8c', '#ffffff');
    // hose reel, buckets, drain stripe
    s.cyl(0.35, 0.5, -4.3, 0.3, -8.5, '#f2c12e', true); for (let i = 0; i < 3; i++) s.cyl(0.18, 0.32, -3.2 + i * 0.45, 0.16, -9, ['#c8322b', '#1f4fbf', '#1d7a3e'][i]);
    s.box(0.3, 0.02, 9, 0, 0.11, -5, '#555c60');
    this.bay = s.at(0, -5);
    s.person(0, -3.5, -2.5, Math.PI / 2, { name: 'Emeka (washer)', activity: 'serve', schedule: WASH_HOURS, role: 'trader' });
    s.person(1, 3.2, -7.5, -Math.PI / 2, { name: 'Tochi (washer)', activity: 'serve', schedule: WASH_HOURS, role: 'trader' });
    s.interact(-3.5, -1.6, () => 'Sparkle Car Wash — wash your car', () => g.openChoice(() => this.view()), { radius: 2.4 });
  }
  /** Your parked cars within 18 m of the bay. */
  nearby() { const g = this.g; return (g.vehicles?.sys?.list ?? []).filter((v) => !v.garaged && Math.hypot(v.x - this.bay.x, v.z - this.bay.z) < 18); }
  view() {
    const g = this.g, open = openAt(g.clock.minutes / 60, WASH_HOURS), cars = this.nearby();
    return { title: 'Sparkle Car Wash', kicker: `OPEN ${WASH_HOURS[0]}AM–${WASH_HOURS[1] - 12}PM · WALLET ${naira(g.economy.balance)}`,
      text: cars.length ? 'Choose which of your cars to wash.' : 'Park your own car in the bay (or close by), then come and talk to the washers.',
      note: open ? 'Dust builds up on your car as you drive; you can see it on the paint.' : 'Closed now (8am–7pm, Onitsha time).',
      sections: cars.map((v) => ({ heading: `${g.vehicles.sys.model(v).label} · ${Math.round((1 - (v.dirt ?? 0)) * 100)}% clean${v.polished && v.polished >= g.clock.day ? ' · polished' : ''}`,
        options: WASH_SERVICES.map((svc) => ({ label: `${svc.label} · ${naira(svc.price)}`, sub: svc.note, disabled: !open || !g.economy.canAfford(svc.price), why: !open ? 'Closed' : 'Not enough money',
          act: () => { const r = washVehicle(g, v, svc.id); if (r.ok) { tintVehicle(g.vehicles.meshes.get(v.id), v.paint, 0); g.saveGameNow(); g.ui.toast(`${r.svc.label} done — shining!`); } else g.ui.toast(r.error); g.renderChoice(); } })) })),
      options: [{ label: 'Done', ghost: true, act: () => g.closeChoice() }] };
  }
  /** Keep paint dust in step with each owned car's dirt (cheap; twice a second). */
  update(dt) {
    this.t += dt; if (this.t < 0.5) return; this.t = 0;
    const g = this.g; if (!g.saveData) return;
    for (const v of g.vehicles?.sys?.list ?? []) {
      if (v.polished && v.polished < g.clock.day) delete v.polished;
      const d = Math.round((v.dirt ?? 0) * 20) / 20; if (shown.get(v) === d) continue; shown.set(v, d);
      tintVehicle(g.vehicles.meshes.get(v.id), v.paint, d);
    }
  }
  places() { return this.site ? [{ ...this.site.at(0, -0.5), kind: 'venue', label: 'Sparkle Car Wash' }] : []; }
}
