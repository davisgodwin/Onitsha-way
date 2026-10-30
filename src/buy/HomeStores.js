import * as THREE from 'three';
import { doorOf } from '../housing/HousingSystem.js';
import { SHOPS, goodsForShop } from './Goods.js';
import { furnitureModel } from './FurnitureModels.js';
import { openAt, fmtHours } from '../activities/VenueKit.js';
/**
 * The four home stores. Each one takes over an existing commercial building in town (no new buildings, nothing
 * moved): a fascia sign over its door, a few pieces set out on the pavement the way Onitsha furniture and
 * electronics shops display stock, a shopkeeper, a map pin, and a walk-up counter that opens the store's
 * catalogue. Store purchases are delivered free to the storage of a home you rent or own.
 */
export const STORES = [
  { shop: 'furniture', near: 'upper-iweka', min: 90, keeper: 'Mr Emeka', gender: 'male', display: ['sofa', 'armchair', 'dining4'], bg: '#5a3a24', fg: '#ffe9c2' },
  { shop: 'electronics', near: 'ochanja', min: 70, keeper: 'Chidi', gender: 'male', display: ['fridge', 'freezer', 'washer'], bg: '#123c69', fg: '#ffffff' },
  { shop: 'lighting', near: 'bridgehead', min: 80, keeper: 'Mama Uche', gender: 'female', display: ['generator', 'lamp', 'inverter'], bg: '#3b3b3b', fg: '#ffd84d' },
  { shop: 'decor', near: 'shoprite', min: 140, keeper: 'Adaeze', gender: 'female', display: ['plant', 'carving', 'vase'], bg: '#7a2e45', fg: '#fff3e6' },
];
export const STORE_HOURS = [8, 20];
const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a) / 2; };

/** Pick the store's building: a mid-sized commercial building near its landmark whose front door faces a road. Pure, so it is unit-tested. */
export function pickStoreBuilding(map, landmarks, def, taken = new Set(), isFree = () => true, avoid = []) {
  const l = landmarks.get(def.near); if (!l) return null;
  let best = null;
  for (const b of map.buildings) {
    if (b.kind !== 'commercial' || b.front < 0 || taken.has(b.id)) continue;
    const cx = b.pts.reduce((s, p) => s + p[0], 0) / b.pts.length, cz = b.pts.reduce((s, p) => s + p[1], 0) / b.pts.length, dist = Math.hypot(cx - l.x, cz - l.z);
    if (dist < def.min || dist > 520) continue;
    const a = area(b.pts); if (a < 70 || a > 700) continue;
    if (avoid.some((r) => Math.hypot(cx - r.x, cz - r.z) < r.r)) continue;
    const d = doorOf(b); if (!d) continue;
    const road = map.nearestRoad(d.stand.x, d.stand.z, { maxDist: 16 }); if (!road || road.dist < 3) continue;
    if (map.onCarriageway?.(d.stand.x, d.stand.z, 0.8)) continue;
    if (!isFree(d.stand.x, d.stand.z, 0.6)) continue;
    const score = dist + Math.abs(a - 220) * 0.15 + road.dist * 4;
    if (!best || score < best.score) best = { b, door: d, score, road: road.dist };
  }
  return best;
}

export class HomeStores {
  constructor(g) { this.g = g; this.stores = []; this.group = new THREE.Group(); this.group.name = 'HomeStores'; }
  setup() {
    const g = this.g, w = g.world, taken = new Set();
    const homes = new Set(g.homes.listings.map((h) => String(h.buildingId)));
    for (const h of g.homes.listings) taken.add(h.buildingId);
    const avoid = w.landmarks.list.filter((l) => ['market', 'mall', 'interchange'].includes(l.kind)).map((l) => ({ x: l.x, z: l.z, r: (l.radius ?? 60) + 10 }));
    for (const def of STORES) {
      try {
        const pick = pickStoreBuilding(w.map, w.landmarks, def, taken, (x, z, r) => w.collision.isFree(x, z, r), avoid);
        if (!pick || homes.has(String(pick.b.id))) { console.warn('[stores] no building for', def.shop); continue; }
        taken.add(pick.b.id); this.stores.push(this.build(def, pick));
      } catch (err) { console.warn('[stores] could not set up', def.shop, err.message); }
    }
    g.renderer.scene.add(this.group);
  }
  build(def, { b, door: d }) {
    const g = this.g, shop = SHOPS[def.shop], store = { ...def, name: shop.name, buildingId: b.id, door: d, offs: [] };
    const yaw = Math.atan2(d.nx, d.nz);
    // fascia sign over the door
    const c = document.createElement('canvas'); c.width = 1024; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = def.bg; x.fillRect(0, 0, 1024, 160); x.fillStyle = def.fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '800 66px Arial'; x.fillText(shop.name.toUpperCase(), 512, 66, 980); x.font = '600 34px Arial'; x.fillText(shop.short + ' · free delivery', 512, 126, 980);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.82), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75 }));
    const lv = Math.max(1, b.levels ?? 1), sy = Math.min(3.25, lv * 3 - 0.4);
    sign.position.set(d.x + d.nx * 0.12, sy, d.z + d.nz * 0.12); sign.rotation.y = yaw; sign.name = `store-sign:${def.shop}`; this.group.add(sign);
    const board = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.95, 0.08), new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.8 })); board.position.set(d.x + d.nx * 0.07, sy, d.z + d.nz * 0.07); board.rotation.y = yaw; this.group.add(board);
    // stock on display along the frontage (each piece is solid)
    const slots = [-2.6, 2.6, -4.6];
    def.display.forEach((id, i) => {
      const off = slots[i], px = d.x + d.ux * off + d.nx * 1.1, pz = d.z + d.uz * off + d.nz * 1.1;
      if (!g.world.collision.isFree(px, pz, 0.7) || g.world.map.onCarriageway?.(px, pz, 0.6)) return;
      const m = furnitureModel(id); m.position.set(px, 0, pz); m.rotation.y = yaw; this.group.add(m); g.world.collision.addCircle(px, pz, 0.6);
    });
    const stand = d.stand, open = () => openAt(g.clock.hour, STORE_HOURS);
    store.offs.push(g.interactions.register({
      x: stand.x, z: stand.z, radius: 2.4, priority: 2,
      enabled: () => !!g.saveData && !g.homes.inside && !g.vehicles.driving && !g.transport?.riding && !g.activities?.active && !g.civic?.inside,
      label: () => open() ? `${shop.name} — go in` : `${shop.name} — closed (opens ${STORE_HOURS[0]}:00)`,
      onInteract: () => { if (!open()) { g.ui.toast(`${shop.name} is closed. Open ${fmtHours(STORE_HOURS)}. You can still order from home in Buy mode (delivery fee).`, 5000); return; } this.enter(store, def, shop); },
    }));
    try { store.keeper = g.npcs.addAnchored({ id: `store:${def.shop}`, kind: 'activity', role: 'trader', name: def.keeper, x: stand.x - d.nx * 0.2 + d.ux * 1.2, z: stand.z - d.nz * 0.2 + d.uz * 1.2, nx: d.nx, nz: d.nz, schedule: STORE_HOURS, gender: def.gender, activity: 'serve' }); } catch { /* the store still works without its keeper */ }
    store.place = { x: stand.x, z: stand.z };
    return store;
  }
  /** v0.44: walk into the showroom; the shopkeeper's counter opens the catalogue (free delivery from here). */
  enter(store, def, shop) {
    const g = this.g, who = typeof def.keeper === 'string' ? def.keeper : def.keeper?.name ?? 'The shopkeeper';
    store.civic ??= { id: `store-${def.shop}`, kind: 'store', name: shop.name, x: store.place.x, z: store.place.z, visitSpot: store.place, interior: { kind: 'showroom', opts: { shop: def.shop, bg: def.bg, fg: def.fg, name: shop.name }, hours: STORE_HOURS, welcome: `${shop.name} · ${who} is at the counter`, counters: [{ at: 'counter', label: `${who} — browse & buy (free delivery)`, act: () => g.buy.openShop(def.shop) }] } };
    return g.civic.enter(store.civic);
  }
  places() { return this.stores.map((s) => ({ x: s.place.x, z: s.place.z, kind: 'mall', id: 'store-' + s.shop, label: s.name })); }
  get(shop) { return this.stores.find((s) => s.shop === shop) ?? null; }
}
export { goodsForShop };
