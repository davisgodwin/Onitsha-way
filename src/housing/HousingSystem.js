import { HOME_TYPES, RENT_GRACE_DAYS } from '../data/housing.js';
import { pointInPolygon } from '../core/utils.js';

/*
  Rentable homes in real OSM houses.
  - Listings are picked once, deterministically, from residential footprints of the right size whose
    front door can be reached from the street (no compound wall in the way).
  - Rent is paid per period through Economy.transact, one idempotency key per period, so a double tap
    or a replayed event never charges twice. No partial payments.
  - Access: a tenant can enter and use everything; anyone can view a vacant listing (the landlord
    lets you look round) but can't use the furniture or the cupboard; when the rent runs out you have
    RENT_GRACE_DAYS to renew before the place goes back on the market — your things stay in the
    cupboard and are yours again if you rent it again.
  Times are absolute game minutes (day * 1440 + minutes).
  State in the save: { rentals: { [homeId]: {from, until, periods} }, storage: { [homeId]: {slots, items} } }
*/

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const polyArea = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a) / 2; };

/**
 * Pick listings from the map. `doorOk(door)` (from the game: collision + line to the street) decides
 * whether a door is reachable; `streetAt(x, z)` names the street. Pure apart from those callbacks.
 */
export function pickListings(map, { doorOk = () => true, streetAt = () => null, minSpacing = 170 } = {}) {
  if(map.legacyListings){return map.legacyListings.map(h=>{const b=map.buildings.find(b=>b.id===h.buildingId);return {...h,door:b?doorOf(b)??h.door:h.door};});}
  const out = [];
  const byType = Object.entries(HOME_TYPES);
  // candidates in a stable pseudo-random order (by building id), so the same houses are listed every time
  const cands = map.buildings
    .filter((b) => b.kind === 'residential' && b.front >= 0 && b.pts.length >= 4)
    .map((b) => ({ b, h: hash('home:' + b.id), area: polyArea(b.pts) }))
    .sort((a, c) => a.h - c.h);
  const legacy = { selfcon: 6, roomparlour: 5, flat: 4 };
  for (const pass of [0, 1]) for (const [type, T] of byType) {
    let n = out.filter(h => h.type === type).length;
    const target = pass === 0 ? (legacy[type] ?? 0) : T.count;
    for (const { b, area } of cands) {
      if (n >= target) break;
      if (out.some(o => o.buildingId === b.id)) continue;
      if (type === 'duplex' && (b.levels ?? 1) < 2) continue;
      if (area < T.area[0] || area > T.area[1]) continue;
      const door = doorOf(b);
      if (!door) continue;
      if (out.some((o) => Math.hypot(o.door.x - door.x, o.door.z - door.z) < (pass === 0 ? minSpacing : 85))) continue;
      if (!doorOk(door)) continue;
      out.push({ id: `home:${b.id}`, buildingId: b.id, type, label: T.label, blurb: T.blurb, rent: T.rent, days: T.days, interior: T.interior, door, area: Math.round(area), street: streetAt(door.x, door.z), levels: b.levels });
      n++;
    }
  }
  return out;
}

/**
 * The house an NPC lives in, near where you met them: a residential footprint 40–260 m away that
 * isn't a listing, with a reachable door. Deterministic for the NPC (seeded by their id). Pure apart
 * from `doorOk`. Returns {buildingId, interior, area, door} or null.
 */
export function pickHostHome(map, x, z, { seed, doorOk = () => true, exclude = new Set() } = {}) {
  const near = [];
  for (const b of map.buildings) {
    if (b.layoutHidden || b.unfinished || b.kind !== 'residential' || b.front < 0 || b.pts.length < 4 || exclude.has(b.id)) continue;
    const [px, pz] = b.pts[0];
    const d = Math.hypot(px - x, pz - z);
    if (d < 40 || d > 260) continue;
    const area = polyArea(b.pts);
    if (area < 35 || area > 320) continue;
    near.push({ b, area, h: hash(seed + ':' + b.id) });
  }
  near.sort((a, c) => a.h - c.h);
  for (const { b, area } of near.slice(0, 40)) {
    const door = doorOf(b);
    if (!door || !doorOk(door)) continue;
    const type = Object.values(HOME_TYPES).find((T) => area >= T.area[0] && area <= T.area[1]) ?? HOME_TYPES.selfcon;
    return { buildingId: b.id, interior: type.interior, area: Math.round(area), door };
  }
  return null;
}

/** Door in the middle of the building's front edge, facing out, plus the spot where you stand to use it. */
export function doorOf(b) {
  const pts = b.pts, i = b.front;
  const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % pts.length];
  const L = Math.hypot(bx - ax, bz - az);
  if (L < 3.2) return null;
  let nx = (bz - az) / L, nz = -(bx - ax) / L;
  const mx = (ax + bx) / 2, mz = (az + bz) / 2;
  if (pointInPolygon(mx + nx * 0.4, mz + nz * 0.4, pts)) { nx = -nx; nz = -nz; } // make sure it points outside
  return { x: mx + nx * 0.06, z: mz + nz * 0.06, nx, nz, ux: (bx - ax) / L, uz: (bz - az) / L, stand: { x: mx + nx * 1.3, z: mz + nz * 1.3 } };
}

export class HousingSystem {
  constructor(state, { economy, listings, bus = null, now = () => 0 }) {
    this.state = state; state.rentals ??= {}; state.storage ??= {}; state.owned ??= {};
    this.economy = economy; this.bus = bus; this.now = now;
    this.listings = listings;
    this.byId = new Map(listings.map((l) => [l.id, l]));
  }

  get(homeId) { return this.byId.get(homeId) ?? null; }

  /** 'tenant' | 'due' (rent ran out, renew within the grace period) | 'vacant' */
  status(homeId, now = this.now()) {
    if(this.state.owned[homeId])return 'tenant';
    const r = this.state.rentals[homeId];
    if (!r) return 'vacant';
    if (now < r.until) return 'tenant';
    if (now < r.until + RENT_GRACE_DAYS * 1440) return 'due';
    return 'vacant';
  }

  /** What the player may do at this door: {enter, use, reason} */
  access(homeId, now = this.now()) {
    const home = this.get(homeId); if (!home) return { enter: false, use: false, reason: 'not-listed' };
    const s = this.status(homeId, now);
    if (s === 'tenant') return { enter: true, use: true, status: s };
    if (s === 'due') return { enter: false, use: false, status: s, reason: 'rent-due' };
    return { enter: true, use: false, status: s, reason: 'viewing' };
  }

  /** Time left on the rent in minutes (negative when due). */
  left(homeId, now = this.now()) { if(this.state.owned[homeId])return Infinity;const r = this.state.rentals[homeId]; return r ? r.until - now : -Infinity; }

  /** Pay one period. Renewing extends from the end of the current period; you can't pay more than one period ahead. */
  rent(homeId, now = this.now()) {
    const home = this.get(homeId); if (!home) return { ok: false, error: 'not-listed' };
    if(this.state.owned[homeId])return{ok:false,error:'already-owned'};
    const s = this.status(homeId, now);
    const r = this.state.rentals[homeId];
    const period = home.days * 1440;
    if (s === 'tenant' && r.until - now > period) return { ok: false, error: 'paid-ahead' };
    const start = s === 'vacant' ? Math.floor(now) : r.until;
    const key = `rent:${homeId}:${start}`;
    const tx = this.economy.transact({ key, amount: -home.rent, reason: `Rent: ${home.label}${home.street ? ', ' + home.street : ''} (${home.days} days)`, ref: { home: homeId, start } });
    if (!tx.ok) return { ok: false, error: tx.error, rent: home.rent };
    const rec = s === 'vacant' ? { from: start, until: start + period, periods: 1 } : { ...r, until: r.until + period, periods: r.periods + 1 };
    this.state.rentals[homeId] = rec;
    this.bus?.emit('housing:rented', { home, rental: rec });
    return { ok: true, rental: rec, balance: tx.balance };
  }

  purchasePrice(id){return (this.get(id)?.rent??0)*24;}
  buy(id){const home=this.get(id);if(!home)return{ok:false,error:'not-listed'};if(this.state.owned[id])return{ok:false,error:'already-owned'};const tx=this.economy.transact({key:`buy-home:${id}`,amount:-this.purchasePrice(id),reason:'Bought home: '+home.label});if(!tx.ok)return tx;this.state.owned[id]={boughtAt:this.now()};this.state.primaryHome=id;this.bus?.emit('housing:bought',{home});return{ok:true,home};}

  /** The cupboard of a home: an Inventory state (created on first use). */
  storage(homeId) { return (this.state.storage[homeId] ??= { slots: 30, items: [] }); }

  /** Homes you rent now (or must renew): [{home, status, left}] */
  mine(now = this.now()) {
    return [...new Set([...Object.keys(this.state.rentals),...Object.keys(this.state.owned)])].map((id) => ({ home: this.get(id), status: this.status(id, now), left: this.left(id, now) }))
      .filter((h) => h.home && h.status !== 'vacant');
  }
}
