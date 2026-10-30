/**
 * Floor plans (v0.39). Every rentable home gets its own plan, generated from its id, so no two homes are laid out
 * the same. The room programmes follow how Nigerian homes are let and described (self-contain, room and parlour,
 * 2-bedroom flat, duplex): a sitting room ("parlour") at the front with the entrance, bedrooms, a kitchen and store,
 * a toilet & bath, a dining area in bigger homes, and upstairs in a duplex a family lounge with the bedrooms and an
 * en-suite. Homes come empty: the only fittings are a ceiling bulb and its switch in each room, which the player
 * can take out.
 *
 * The plan is a guillotine subdivision of the W × D room (front wall at z = D, back wall at z = 0): every split wall
 * gets one doorway, so every room can be reached. Pure (no three.js), so it is unit-tested.
 */
export const ROOM_LABELS = {
  parlour: 'Sitting room', bedroom: 'Bedroom', master: 'Master bedroom', kitchen: 'Kitchen', store: 'Store',
  bath: 'Toilet & bath', ensuite: 'Bathroom', wc: "Visitors' toilet", dining: 'Dining', studio: 'Room',
  kitchenette: 'Kitchenette', lounge: 'Family lounge', stairs: 'Stairs', guest: 'Guest room', passage: 'Passage',
};
/** Room programmes per home type: role and a target share of the floor area. Variants are picked per home. */
const PROGRAMMES = {
  selfcon: [
    [['studio', 0.68], ['bath', 0.17], ['kitchenette', 0.15]],
    [['studio', 0.74], ['bath', 0.26]],
    [['studio', 0.6], ['kitchenette', 0.2], ['bath', 0.2]],
  ],
  roomparlour: [
    [['parlour', 0.4], ['bedroom', 0.32], ['kitchen', 0.16], ['bath', 0.12]],
    [['parlour', 0.44], ['bedroom', 0.34], ['bath', 0.12], ['kitchen', 0.1]],
    [['parlour', 0.36], ['bedroom', 0.3], ['kitchen', 0.14], ['store', 0.08], ['bath', 0.12]],
  ],
  flat: [
    [['parlour', 0.28], ['dining', 0.12], ['master', 0.2], ['bedroom', 0.16], ['kitchen', 0.1], ['bath', 0.07], ['ensuite', 0.07]],
    [['parlour', 0.3], ['master', 0.22], ['bedroom', 0.18], ['kitchen', 0.12], ['store', 0.06], ['bath', 0.12]],
    [['parlour', 0.26], ['passage', 0.08], ['master', 0.2], ['bedroom', 0.17], ['kitchen', 0.11], ['wc', 0.06], ['bath', 0.12]],
    [['parlour', 0.32], ['dining', 0.1], ['bedroom', 0.18], ['bedroom', 0.17], ['kitchen', 0.11], ['bath', 0.12]],
  ],
  duplex: [
    [['parlour', 0.34], ['dining', 0.14], ['kitchen', 0.14], ['store', 0.06], ['guest', 0.16], ['wc', 0.05], ['stairs', 0.11]],
    [['parlour', 0.38], ['dining', 0.12], ['kitchen', 0.15], ['wc', 0.06], ['stairs', 0.11], ['guest', 0.18]],
    [['parlour', 0.3], ['dining', 0.16], ['kitchen', 0.13], ['store', 0.07], ['stairs', 0.12], ['wc', 0.06], ['passage', 0.16]],
  ],
  duplexUp: [
    [['lounge', 0.22], ['master', 0.24], ['ensuite', 0.08], ['bedroom', 0.17], ['bedroom', 0.17], ['bath', 0.12]],
    [['lounge', 0.26], ['master', 0.26], ['ensuite', 0.08], ['bedroom', 0.2], ['bath', 0.2]],
    [['lounge', 0.2], ['master', 0.22], ['ensuite', 0.07], ['bedroom', 0.16], ['bedroom', 0.15], ['bath', 0.1], ['store', 0.1]],
  ],
};
const WET = new Set(['bath', 'ensuite', 'wc']);
export function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Make the plan for one home. `type` is the layout id (selfcon, roomparlour, flat, duplex, duplexUp).
 * Returns {rooms:[{role,label,x0,z0,x1,z1}], walls:[{x0,z0,x1,z1,gap:[a,b]|null}], door:{x}, spawn:{x,z}, stairs,
 * lamps:[{room, x, z, sx, sz, rot}], windows:[{x,z,rot,len}]}.
 */
export function generatePlan(homeId, type, W, D) {
  const rng = rngFrom(hashSeed(`plan:${homeId}:${type}`));
  const variants = PROGRAMMES[type] ?? PROGRAMMES.roomparlour;
  const programme = variants[Math.floor(rng() * variants.length)].map(([role, share]) => ({ role, share: share * (0.85 + rng() * 0.3) }));
  const rooms = [], walls = [];
  const MIN = 1.7;
  // order: the front-door room first; wet rooms tend to the back
  const split = (x0, z0, x1, z1, list) => {
    if (list.length === 1) { rooms.push({ role: list[0].role, x0, z0, x1, z1 }); return; }
    const w = x1 - x0, d = z1 - z0, total = list.reduce((s, r) => s + r.share, 0);
    let vertical = w > d * (0.8 + rng() * 0.5);
    if (w < MIN * 2) vertical = false; if (d < MIN * 2) vertical = true;
    // keep the front-door room (index 0) in the group nearest the front wall (z = D)
    // split the room list where the two groups' areas are closest to half each (a little randomness)
    let k = 1, bestDiff = Infinity;
    for (let j = 1; j < list.length; j++) { const f = list.slice(0, j).reduce((s, r) => s + r.share, 0) / total, diff = Math.abs(f - 0.5) + rng() * 0.12; if (diff < bestDiff) { bestDiff = diff; k = j; } }
    let A = list.slice(0, k), B = list.slice(k);
    const share = A.reduce((s, r) => s + r.share, 0) / total;
    if (vertical) {
      let leftShare = share;
      if (rng() < 0.5) { [A, B] = [B, A]; leftShare = 1 - share; } // mirror: either group may take the left side
      const x = Math.max(x0 + MIN, Math.min(x1 - MIN, Math.round((x0 + w * leftShare) * 10) / 10));
      walls.push({ x0: x, z0, x1: x, z1, split: true });
      split(x0, z0, x, z1, A); split(x, z0, x1, z1, B);
    } else {
      // front group (containing the entrance room) takes the front strip
      let z = z1 - d * share; z = Math.max(z0 + MIN, Math.min(z1 - MIN, Math.round(z * 10) / 10));
      walls.push({ x0, z0: z, x1, z1: z, split: true });
      split(x0, z, x1, z1, A); split(x0, z0, x1, z, B);
    }
  };
  // the entrance room is listed first; the rest are lightly shuffled but wet rooms stay late
  const head = programme[0], rest = programme.slice(1).sort((a, b) => (WET.has(a.role) - WET.has(b.role)) || (rng() - 0.5));
  split(0, 0, W, D, [head, ...rest]);
  // doorways: one per split wall, away from the T-junctions where other walls meet it
  for (const wl of walls) {
    const horizontal = wl.z0 === wl.z1, a = horizontal ? wl.x0 : wl.z0, b = horizontal ? wl.x1 : wl.z1;
    const blocked = walls.filter((o) => o !== wl).map((o) => {
      if (horizontal && o.x0 === o.x1 && o.x0 > a && o.x0 < b && (Math.abs(o.z0 - wl.z0) < 0.01 || Math.abs(o.z1 - wl.z0) < 0.01)) return o.x0;
      if (!horizontal && o.z0 === o.z1 && o.z0 > a && o.z0 < b && (Math.abs(o.x0 - wl.x0) < 0.01 || Math.abs(o.x1 - wl.x0) < 0.01)) return o.z0;
      return null;
    }).filter((v) => v != null);
    const sideRooms = rooms.filter((r) => horizontal ? (Math.abs(r.z0 - wl.z0) < 0.01 || Math.abs(r.z1 - wl.z0) < 0.01) : (Math.abs(r.x0 - wl.x0) < 0.01 || Math.abs(r.x1 - wl.x0) < 0.01));
    const wide = sideRooms.some((r) => r.role === 'dining') && sideRooms.some((r) => r.role === 'parlour' || r.role === 'kitchen');
    const gw = wide ? 1.6 : sideRooms.some((r) => WET.has(r.role)) ? 0.9 : 1.0; // room for the player (0.64 m across) to pass easily
    let best = null;
    for (let t = 0; t < 24; t++) {
      const c = a + 0.35 + gw / 2 + rng() * Math.max(0, b - a - gw - 0.7);
      if (blocked.every((v) => Math.abs(v - c) > gw / 2 + 0.25)) { best = c; break; }
    }
    if (best == null) best = (a + b) / 2;
    wl.gap = [best - a - gw / 2, best - a + gw / 2];
  }
  // entrance: in the front room's stretch of the front wall
  const front = rooms.find((r) => r.role === head.role);
  const doorX = Math.round((front.x0 + 0.85 + rng() * Math.max(0, front.x1 - front.x0 - 1.7)) * 100) / 100;
  for (const r of rooms) r.label = ROOM_LABELS[r.role] ?? r.role;
  // number repeated bedrooms
  const counts = {}; for (const r of rooms) if (r.role === 'bedroom' || r.role === 'guest') counts[r.role] = (counts[r.role] ?? 0) + 1;
  const seen = {}; for (const r of rooms) if (counts[r.role] > 1) r.label += ' ' + (seen[r.role] = (seen[r.role] ?? 0) + 1);
  // a bulb in the middle of every room, its switch on the wall beside the room's first doorway
  const lamps = rooms.map((r, i) => {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    let sw = null;
    for (const wl of walls) {
      const horizontal = wl.z0 === wl.z1;
      if (horizontal && (Math.abs(wl.z0 - r.z0) < 0.01 || Math.abs(wl.z0 - r.z1) < 0.01)) {
        const g0 = wl.x0 + wl.gap[0], g1 = wl.x0 + wl.gap[1]; if (g1 <= r.x0 || g0 >= r.x1) continue;
        const sx = Math.max(r.x0 + 0.45, Math.min(r.x1 - 0.45, g1 + 0.3 < r.x1 - 0.45 ? g1 + 0.3 : g0 - 0.3)), inward = Math.abs(wl.z0 - r.z0) < 0.01 ? 1 : -1;
        sw = { sx, sz: wl.z0 + inward * 0.1, rot: inward > 0 ? 0 : Math.PI }; break;
      }
      if (!horizontal && (Math.abs(wl.x0 - r.x0) < 0.01 || Math.abs(wl.x0 - r.x1) < 0.01)) {
        const g0 = wl.z0 + wl.gap[0], g1 = wl.z0 + wl.gap[1]; if (g1 <= r.z0 || g0 >= r.z1) continue;
        const sz = Math.max(r.z0 + 0.45, Math.min(r.z1 - 0.45, g1 + 0.3 < r.z1 - 0.45 ? g1 + 0.3 : g0 - 0.3)), inward = Math.abs(wl.x0 - r.x0) < 0.01 ? 1 : -1;
        sw = { sx: wl.x0 + inward * 0.1, sz, rot: inward > 0 ? Math.PI / 2 : -Math.PI / 2 }; break;
      }
    }
    if (r === front) sw = { sx: doorX + (doorX + 1 < front.x1 ? 0.8 : -0.8), sz: D - 0.1, rot: Math.PI }; // by the front door
    if (!sw) sw = { sx: r.x0 + 0.3, sz: r.z1 - 0.1, rot: Math.PI };
    return { room: i, x: cx, z: cz, ...sw };
  });
  // windows on outside walls (not where the front door is)
  const windows = [];
  for (const r of rooms) {
    const segs = [];
    if (r.x0 < 0.01) segs.push({ x: 0.09, z: (r.z0 + r.z1) / 2, len: r.z1 - r.z0, rot: Math.PI / 2 });
    if (r.x1 > W - 0.01) segs.push({ x: W - 0.09, z: (r.z0 + r.z1) / 2, len: r.z1 - r.z0, rot: -Math.PI / 2 });
    if (r.z0 < 0.01) segs.push({ x: (r.x0 + r.x1) / 2, z: 0.09, len: r.x1 - r.x0, rot: 0 });
    if (r.z1 > D - 0.01 && Math.abs((r.x0 + r.x1) / 2 - doorX) > 1.6) segs.push({ x: (r.x0 + r.x1) / 2, z: D - 0.09, len: r.x1 - r.x0, rot: Math.PI });
    for (const s of segs) if (s.len >= 1.6) windows.push({ ...s, w: WET.has(r.role) ? 0.6 : Math.min(1.4, s.len - 0.6), h: WET.has(r.role) ? 0.5 : 1.0, y: WET.has(r.role) ? 1.85 : 1.55 });
  }
  const stairsRoom = rooms.find((r) => r.role === 'stairs' || r.role === 'lounge') ?? null;
  return { type, W, D, rooms, walls, door: { x: doorX }, spawn: { x: doorX, z: D - 0.9 }, lamps, windows, stairs: stairsRoom ? { x: (stairsRoom.x0 + stairsRoom.x1) / 2, z: (stairsRoom.z0 + stairsRoom.z1) / 2, room: rooms.indexOf(stairsRoom) } : null };
}
/** A short signature of a plan's room layout (for checking that homes differ). */
export const planSignature = (p) => `door ${p.door.x.toFixed(1)} ` + p.rooms.map((r) => `${r.role}@${r.x0.toFixed(1)},${r.z0.toFixed(1)},${r.x1.toFixed(1)},${r.z1.toFixed(1)}`).sort().join('|');
