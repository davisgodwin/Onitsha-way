/*
  Traffic police (Milestone 7 follow-up, game rules). Pure logic — the controller supplies positions.

  - A few checkpoints on main roads (deterministic). Officers are there by day, Monday to Saturday, and
    Sunday afternoon; they shelter in heavy rain.
  - Offences are only noticed near a manned checkpoint (within SEE metres): speeding over the road's
    limit, driving the wrong way down a one-way street, knocking someone down.
  - When they flag you down you have STOP_SECONDS to stop at the checkpoint. Then you pay the fine (one
    Economy.transact, keyed per case), or explain yourself (a respected name may get a warning, once).
  - Drive off and you're "wanted": the next checkpoint stops you on sight and the fine is doubled, plus the
    one you ran from. If you can't pay, your vehicle is held at the checkpoint until you do.
  State in the save (police): { seq, wanted, owed: [{id, offence, amount}], warned: day|null, held: {vehicleId: postId} }
*/
export const POLICE = {
  checkpointDemand: 200, cooldownSeconds: 75, see: 80, stopRadius: 16, stopSeconds: 25, fleeDistance: 170,
  hours: [8, 18], sundayHours: [12, 18], heavyRain: 0.6,
  fines: { speeding: 3000, 'wrong-way': 5000, 'hit-person': 10000 },
  limits: { trunk: 50, primary: 50, secondary: 40, tertiary: 40, trunk_link: 40, primary_link: 40, secondary_link: 40, tertiary_link: 40 }, // km/h; others 30
  tolerance: 8,
};
export const OFFENCE_LABEL = { speeding: 'speeding', 'wrong-way': 'driving against a one-way street', 'hit-person': 'knocking someone down' };

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Speed limit (km/h) on a road. */
export function speedLimit(road) { return POLICE.limits[road?.type] ?? 30; }

/** Checkpoint posts beside main roads near these landmarks: [{id, x, z, nx, nz, heading, road, name}] */
export function pickCheckpoints(graph, landmarks, ids = ['upper-iweka', 'bridgehead', 'main-market', 'ochanja', 'fegge', 'shoprite']) {
  const posts = [];
  for (const id of ids) {
    const l = landmarks.get(id); if (!l) continue;
    const edges = graph.edgesNear(l.x, l.z, 520, 90, (e) => e.drivable && !e.road.elevated && e.len > 75 && ['trunk', 'primary', 'secondary'].includes(e.road.type))
      .sort((a, b) => (hash(id + a.id) % 997) - (hash(id + b.id) % 997));
    const e = edges.find((ed) => posts.every((p) => Math.hypot(p.x - graph.nodes[ed.a][0], p.z - graph.nodes[ed.a][1]) > 300));
    if (!e) continue;
    const [ax, az] = graph.nodes[e.a];
    const s = e.len / 2, side = e.road.width / 2 + 1.6;
    const nx = -e.dz, nz = e.dx; // right of the edge direction
    posts.push({ id: `post:${id}`, name: `${l.name} checkpoint`, x: ax + e.dx * s + nx * side, z: az + e.dz * s + nz * side, nx, nz, heading: Math.atan2(e.dx, e.dz), road: e.road, cx:ax+e.dx*s, cz:az+e.dz*s, edgeId:e.id });
  }
  return posts;
}

export function manned(weekday, hour, rain = 0) {
  if (rain > POLICE.heavyRain) return false;
  const [o, c] = weekday === 6 ? POLICE.sundayHours : POLICE.hours;
  return hour >= o && hour < c;
}

export class PoliceSystem {
  constructor(state, { economy, posts, bus = null }) {
    state.seq ??= 0; state.wanted ??= 0; state.owed ??= []; state.warned ??= null; state.held ??= {};
    this.state = state; this.economy = economy; this.posts = posts; this.bus = bus;
    this.stop = null; // the current stop: {post, offence, amount, deadline (s)}
  }

  /** The manned post that can see (x, z), or null. */
  watching(x, z, open) {
    if (!open) return null;
    let best = null, bd = POLICE.see;
    for (const p of this.posts) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
    return best;
  }

  /**
   * An offence was committed at (x, z) (or you're wanted and drove up to a post). Starts a stop if an
   * open post sees it. Returns the stop or null.
   */
  notice(offence, x, z, { open, nowS }) {
    if (this.stop) return null;
    const post = this.watching(x, z, open); if (!post) return null;
    const base = offence === 'checkpoint' ? POLICE.checkpointDemand : offence === 'wanted' ? 0 : POLICE.fines[offence];
    const amount = offence==='checkpoint' ? POLICE.checkpointDemand : (base + this.owedTotal()) * (this.state.wanted ? 2 : 1) || POLICE.fines.speeding * 2;
    this.stop = { post, offence, amount, deadline: nowS + POLICE.stopSeconds, started: nowS };
    return this.stop;
  }

  owedTotal() { return this.state.owed.reduce((s, o) => s + o.amount, 0); }

  /** Where you are relative to the stop: 'stopped' (at the post, still), 'fled', or 'pending'. */
  progress(x, z, speed, nowS) {
    const s = this.stop; if (!s) return null;
    const d = Math.hypot((s.post.cx??s.post.x) - x, (s.post.cz??s.post.z) - z);
    if (d < POLICE.stopRadius && Math.abs(speed) < 1) return 'stopped';
    if (d > POLICE.fleeDistance || nowS > s.deadline) return 'fled';
    return 'pending';
  }

  /** You drove off: you're wanted, and the fine you ran from is owed. */
  flee() {
    const s = this.stop; if (!s) return null;
    this.state.wanted++;
    if (s.offence !== 'wanted') this.state.owed.push({ id: `case:${++this.state.seq}`, offence: s.offence, amount: POLICE.fines[s.offence] ?? POLICE.checkpointDemand });
    this.stop = null;
    this.bus?.emit('police:fled', s);
    return s;
  }

  /** Pay the fine: clears what you owe and the wanted mark. All-or-nothing. */
  pay() {
    const s = this.stop; if (!s) return { ok: false, error: 'no-stop' };
    const id = `fine:${++this.state.seq}`;
    const tx = this.economy.transact({ key: id, amount: -s.amount, reason: `Police fine at ${s.post.name}: ${OFFENCE_LABEL[s.offence] ?? 'outstanding fines'}`, ref: { post: s.post.id, offence: s.offence } });
    if (!tx.ok) { this.state.seq--; return { ok: false, error: tx.error, amount: s.amount }; }
    this.state.owed = []; this.state.wanted = 0; this.stop = null;
    this.bus?.emit('police:paid', { key: id, amount: s.amount, offence: OFFENCE_LABEL[s.offence] ?? s.offence, post: s.post.name });
    return { ok: true, amount: s.amount, balance: tx.balance };
  }

  /** Explain yourself: a respected name (reputation level ≥ 3) gets one warning a day for a first offence. */
  plead(repLevel, day) {
    const s = this.stop; if (!s) return { ok: false };
    if (repLevel >= 3 && !this.state.wanted && this.state.warned !== day && s.offence !== 'hit-person') {
      this.state.warned = day; this.stop = null; return { ok: true, warned: true };
    }
    return { ok: false };
  }

  /** You can't pay: the vehicle is held at the post until the fine is paid there. */
  hold(vehicleId) {
    const s = this.stop; if (!s) return null;
    this.state.held[vehicleId] = { post: s.post.id, amount: s.amount, offence: s.offence };
    this.bus?.emit('police:held', { vehicle: vehicleId, post: s.post.name, amount: s.amount });
    if (s.offence !== 'wanted') this.state.owed.push({ id: `case:${++this.state.seq}`, offence: s.offence, amount: POLICE.fines[s.offence] ?? POLICE.checkpointDemand });
    this.stop = null;
    return this.state.held[vehicleId];
  }

  /** Pay to release a held vehicle. */
  release(vehicleId) {
    const h = this.state.held[vehicleId]; if (!h) return { ok: false, error: 'not-held' };
    const tx = this.economy.transact({ key: `release:${vehicleId}:${++this.state.seq}`, amount: -h.amount, reason: `Police: released your vehicle (${OFFENCE_LABEL[h.offence] ?? 'fines'})`, ref: { vehicle: vehicleId } });
    if (!tx.ok) { this.state.seq--; return { ok: false, error: tx.error, amount: h.amount }; }
    delete this.state.held[vehicleId]; this.state.owed = []; this.state.wanted = 0;
    return { ok: true, amount: h.amount };
  }
}
