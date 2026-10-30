import { fareFor } from '../transport/transportConfig.js';

/*
  Keke business (Milestone 7): with a keke of your own you can carry passengers for money.
  - Stop next to a bus/keke stop where people are queueing and pick them up (up to 3). Each passenger
    tells you where they're going — another stop, 400 m to 2.6 km away — and what they'll pay: the
    standard keke fare for the distance (more in the rain, like every other keke).
  - Stop near their stop and they get down and pay: one Economy.transact per passenger, keyed on the
    passenger, so nobody ever pays twice.
  - Take too long and they get down where you are without paying.
  State in the save (business): { riders: [{id, dest, destName, x, z, fare, deadline, from}], trips, earned, seq }
  Times are absolute game minutes.
*/
export const KEKE_BIZ = { seats: 3, pickupRadius: 11, dropRadius: 18, minTrip: 400, maxTrip: 2600, minutesPerKm: 4, patience: 12 };

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export class KekeBusiness {
  constructor(state, { economy, network, bus = null, surge = () => 1 }) {
    state.riders ??= []; state.trips ??= 0; state.earned ??= 0; state.seq ??= 0;
    this.state = state; this.economy = economy; this.net = network; this.bus = bus; this.surge = surge;
  }

  get riders() { return this.state.riders; }
  get free() { return (this.seats ?? KEKE_BIZ.seats) - this.state.riders.length; }
  /**
   * v0.41: the same business with a minibus or a bus. mode = 'keke' | 'minibus' | 'cbus' | 'coaster'; seats from the
   * vehicle; line = a route id (passengers only board for stops on that route) or null (anywhere, keke-style).
   * A conductor (hired for the day) calls passengers from the whole stop and collects fares as they board.
   */
  setVehicle({ mode = 'keke', seats = KEKE_BIZ.seats, line = null } = {}) { this.mode = mode; this.seats = seats; this.line = line; }
  get conductor() { return this.state.conductorDay != null && this.state.conductorDay === this.today?.(); }

  /** The nearest platform with people waiting, within reach of (x, z). */
  platformNear(x, z) {
    let best = null, bd = KEKE_BIZ.pickupRadius;
    if (this.conductor) bd += 8; // the conductor calls people from across the stop
    for (const s of this.net.stops) for (const p of s.platforms) {
      if (this.line && !s.lines?.has(this.line)) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd && p.queue?.length) { bd = d; best = p; }
    }
    return best;
  }

  /** Where someone boarding at `platform` wants to go (deterministic for that passenger). */
  destinationFor(platform, seq) {
    const from = platform.stop;
    const bus = this.mode && this.mode !== 'keke', [lo, hi] = bus ? [500, 6000] : [KEKE_BIZ.minTrip, KEKE_BIZ.maxTrip];
    const cands = this.net.stops.filter((s) => {
      if (s === from) return false;
      if (this.line && !s.lines?.has(this.line)) return false;
      const d = Math.hypot(s.x - from.x, s.z - from.z);
      return d >= (this.line ? 300 : lo) && d <= (this.line ? 99999 : hi);
    });
    if (!cands.length) return null;
    return cands[hash(`${from.id}:${seq}`) % cands.length];
  }

  fareTo(from, to) {
    const metres = Math.hypot(to.x - from.x, to.z - from.z) * 1.3; // streets aren't straight
    const base = fareFor(this.mode && this.mode !== 'keke' ? this.mode : 'keke', metres), k = this.surge();
    return { metres, fare: k > 1 ? Math.round((base * k) / 50) * 50 : base };
  }

  /** Take people from the platform's queue into the keke. Returns the new riders. */
  pickUp(platform, now) {
    const out = [];
    while (this.free > 0 && platform.queue.length) {
      const seq = this.state.seq + 1;
      const dest = this.destinationFor(platform, seq);
      if (!dest) break;
      this.state.seq = seq;
      const serial = platform.queue.shift();
      const { metres, fare } = this.fareTo(platform.stop, dest);
      const pl = dest.platforms[0] ?? dest;
      const r = { id: `kb:${seq}`, serial, from: platform.stop.name, dest: dest.id, destName: dest.name, x: pl.x, z: pl.z, fare, mode: this.mode ?? 'keke',
        deadline: now + Math.max(KEKE_BIZ.patience, Math.round((metres / 1000) * KEKE_BIZ.minutesPerKm * 2.5)) };
      // with a conductor, fares are collected as people board
      if (this.conductor && this.economy.transact({ key: `keke-biz:${r.id}`, amount: r.fare, reason: `${this.mode === 'keke' ? 'Keke' : 'Bus'} fare collected by your conductor: ${r.from} → ${r.destName}`, ref: { rider: r.id } }).ok) { r.paid = true; this.state.trips++; this.state.earned += r.fare; this.bus?.emit('keke-biz:paid', { rider: r, paid: r.fare }); }
      this.state.riders.push(r); out.push(r);
    }
    return out;
  }

  /** Riders whose stop is here get down and pay. Returns [{rider, ok, paid}]. */
  dropOff(x, z) {
    const out = [];
    for (const r of [...this.state.riders]) {
      if (Math.hypot(r.x - x, r.z - z) > KEKE_BIZ.dropRadius) continue;
      this.state.riders.splice(this.state.riders.indexOf(r), 1);
      if (r.paid) { out.push({ rider: r, ok: true, paid: 0, prepaid: r.fare }); continue; }
      const tx = this.economy.transact({ key: `keke-biz:${r.id}`, amount: r.fare, reason: `${r.mode && r.mode !== 'keke' ? 'Bus' : 'Keke'} passenger: ${r.from} → ${r.destName}`, ref: { rider: r.id } });
      if (tx.ok) { this.state.trips++; this.state.earned += r.fare; }
      out.push({ rider: r, ok: tx.ok, paid: tx.ok ? r.fare : 0 });
      this.bus?.emit('keke-biz:paid', { rider: r, paid: tx.ok ? r.fare : 0 });
    }
    return out;
  }

  /** Riders who ran out of patience get down without paying. */
  expire(now) {
    const gone = this.state.riders.filter((r) => now > r.deadline);
    if (gone.length) this.state.riders = this.state.riders.filter((r) => now <= r.deadline);
    return gone;
  }

  /** Everyone gets down (you left the keke, sold it…): nobody pays for an unfinished ride. */
  dropAll() { const all = this.state.riders; this.state.riders = []; return all; }

  /** The nearest drop-off from (x, z). */
  nextDrop(x, z) {
    let best = null, bd = Infinity;
    for (const r of this.state.riders) { const d = Math.hypot(r.x - x, r.z - z); if (d < bd) { bd = d; best = r; } }
    return best ? { rider: best, dist: bd } : null;
  }
}
