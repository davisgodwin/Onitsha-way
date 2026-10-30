import { HOME_TYPES } from '../data/housing.js';
import { doorOf } from './HousingSystem.js';
/**
 * v0.38: flats in multi-unit buildings. Storey buildings with flats and apartment blocks (from the building kit)
 * offer two rentable units each, with their own entrance door on the front (Flat A on the left, Flat B on the
 * right). Ids are `home:<building id>:<unit>`, so they never collide with the 46 original homes. Deterministic.
 */
const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const FLAT_UNITS_TARGET = 44;
export function pickFlatUnits(city, { doorOk = () => true, streetAt = () => null, existing = [], target = FLAT_UNITS_TARGET, minSpacing = 70 } = {}) {
  const items = [];
  for (const ch of city.chunks.values()) for (const it of ch.items) if (['storeyflats', 'apartment'].includes(it.plan?.type) && it.b.front >= 0 && !it.b.synthetic) items.push(it);
  // v0.48: buildings added by a map extension come after those of the earlier map, so the same flats are chosen
  const ext = (it) => (it.phase === 2 ? 1 : 0);
  items.sort((a, b) => ext(a) - ext(b) || hash('flat:' + a.b.id) - hash('flat:' + b.b.id));
  const out = [], taken = new Set(existing.map((h) => String(h.buildingId)));
  for (const it of items) {
    if (out.length >= target) break;
    const b = it.b; if (taken.has(String(b.id))) continue;
    const d = doorOf(b); if (!d) continue;
    const [ax, az] = b.pts[b.front], [bx, bz] = b.pts[(b.front + 1) % b.pts.length]; if (Math.hypot(bx - ax, bz - az) < 7.5) continue;
    if ([...existing, ...out].some((o) => Math.hypot(o.door.x - d.x, o.door.z - d.z) < minSpacing)) continue;
    const units = [];
    for (const [unit, off, type] of [['A', -1.7, it.plan.type === 'apartment' ? 'flat' : 'roomparlour'], ['B', 1.7, it.plan.type === 'apartment' ? 'roomparlour' : 'selfcon']]) {
      const door = { ...d, x: d.x + d.ux * off, z: d.z + d.uz * off, stand: { x: d.stand.x + d.ux * off, z: d.stand.z + d.uz * off } };
      if (!doorOk(door)) { units.length = 0; break; }
      const T = HOME_TYPES[type];
      units.push({ id: `home:${b.id}:${unit}`, buildingId: b.id, unit, type, label: `${T.label} · Flat ${unit}`, blurb: `${T.blurb} In a ${it.plan.type === 'apartment' ? 'block of flats' : 'storey building with flats'}.`, rent: T.rent, days: T.days, interior: T.interior, door, area: Math.round(Math.min(it.area / 2, T.area[1])), street: streetAt(door.x, door.z), levels: it.levels, multiUnit: true });
    }
    if (units.length === 2) { out.push(...units); taken.add(String(b.id)); }
  }
  return out;
}
