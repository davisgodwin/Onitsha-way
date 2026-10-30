import { fareFor, MODES } from './transportConfig.js';

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const r50 = (n) => Math.max(50, Math.round(n / 50) * 50);
/** Keke and mini bus drivers bargain ("Kpaa ife"); bus and coaster fares are fixed. */
const HAGGLE = { keke: 0.65, minibus: 0.4 };

/*
  The player's journey on public transport, as a small state machine:

    idle ──choose(stop, destination)──▶ waiting ──board(vehicle)──▶ boarded ──vehicle departs──▶ riding
      ▲                                    │                          │  (fare charged once here)     │
      └──────────── cancel ────────────────┘◀──── get down before ────┘                               │
      └────────────────────────────── alight (vehicle stopped: destination, next stop, "drop me here") ┘

  - The fare is charged exactly once, by Economy.transact with a per-trip key, when the vehicle pulls
    away with the player on board. Getting down before it leaves costs nothing; there are no refunds
    for getting down early.
  - The player can only board a vehicle that is stopped at a stop on a line that goes to the chosen
    destination, with a free seat, and only if they can afford the fare.
  - The driver, not the player, drives: the player can ask for the next stop or "drop me here", and the
    driver pulls in at the next safe spot.
  Pure logic: the Game turns the events into camera, HUD and player position changes.
*/

export class TripSystem {
  constructor({ economy, fleet, network, bus = null, state = {}, nonce = Date.now().toString(36) }) {
    this.economy = economy; this.fleet = fleet; this.net = network; this.bus = bus;
    this.state = state; state.seq ??= 0; state.log ??= [];
    this.nonce = nonce;
    this.trip = null;
    this.off = fleet.on((type, v, occ) => this.onFleet(type, v, occ));
  }

  get active() { return this.trip; }
  get riding() { return this.trip && (this.trip.state === 'boarded' || this.trip.state === 'riding') ? this.trip : null; }

  /** Destinations from a stop, each with its options and fares. */
  destinationsFrom(stop) {
    return this.net.destinationsFrom(stop).map((d) => ({ ...d, options: d.options.map((o) => ({ ...o, fare: this.surgeFare(o.line.mode, fareFor(o.line.mode, o.dist)) })) }));
  }
  /** Destinations for one vehicle standing at a stop (board first, then say where you're going). */
  destinationsOnVehicle(v) {
    const st = v.transit.stopped; if (!st?.occ) return [];
    const line = v.transit.line, from = st.occ;
    const out = [];
    for (const to of line.occ) {
      if (to === from) continue;
      const dist = this.net.rideDistance(line, from, to);
      if (dist < 60) continue;
      const stops = line.occ.filter((o) => { const dd = this.net.rideDistance(line, from, o); return dd > 0 && dd <= dist; }).length;
      out.push({ stop: to.stop, options: [{ line, from, to, dist, stops, fare: this.surgeFare(line.mode, fareFor(line.mode, dist)) }] });
    }
    return out.sort((a, b) => a.options[0].dist - b.options[0].dist);
  }

  newId() { this.state.seq += 1; return `trip:${this.state.seq}:${this.nonce}`; }

  /** Start waiting at a stop for anything that goes to `entry.stop`. */
  choose(stop, entry) {
    if (this.riding) return { ok: false, error: 'already-riding' };
    const occs = new Set(entry.options.map((o) => o.from));
    this.trip = { id: this.newId(), state: 'waiting', stop, dest: entry.stop, options: entry.options, occs };
    this.fleet.playerWait = { occs };
    this.bus?.emit('trip:changed', this.trip);
    return { ok: true, trip: this.trip };
  }

  cancel() {
    if (!this.trip || this.trip.state !== 'waiting') return { ok: false };
    this.trip = null; this.fleet.playerWait = null;
    this.bus?.emit('trip:changed', null);
    return { ok: true };
  }

  /** Which of the waiting trip's options this stopped vehicle serves, or null. */
  optionFor(v) {
    const t = this.trip;
    if (!t || t.state !== 'waiting' || !v.transit) return null;
    const occ = v.transit.stopped?.occ;
    if (!occ || !t.occs.has(occ)) return null;
    return t.options.find((o) => o.from === occ && o.line === v.transit.line) ?? null;
  }

  /**
   * Rain surge (M7): keke and minibus drivers charge more while it rains (bus and coaster fares stay
   * fixed). `surge` is set by the game from the weather: 1 normally, up to 1.3 in a downpour.
   */
  surgeFare(mode, fare) {
    const k = this.surge ?? 1;
    if (k <= 1 || !HAGGLE[mode]) return fare;
    return Math.round((fare * k) / 50) * 50;
  }

  /** The fare this driver will take from you: the standard fare, or what you agreed after bargaining. */
  fareWith(v, opt = this.optionFor(v)) { return this.trip?.deals?.[v.id]?.fare ?? opt?.fare ?? null; }

  /** What you can do about the fare at this vehicle's door. */
  fareOffer(v) {
    const opt = this.optionFor(v); if (!opt) return null;
    const deal = this.trip.deals?.[v.id];
    return { standard: opt.fare, fare: this.fareWith(v, opt), canHaggle: !!HAGGLE[opt.line.mode] && !deal?.tried, fixed: !HAGGLE[opt.line.mode], deal: deal ?? null };
  }

  /**
   * "Kpaa ife" — ask the driver for a reduction, once per vehicle. Deterministic for this trip and
   * vehicle (asking again changes nothing). Never below the mode's minimum fare.
   */
  haggle(v) {
    const opt = this.optionFor(v);
    if (!opt) return { ok: false, error: 'wrong-vehicle' };
    const t = this.trip; t.deals ??= {};
    if (!HAGGLE[opt.line.mode]) return { ok: true, moved: false, reply: 'fixed', fare: opt.fare };
    if (t.deals[v.id]?.tried) return { ok: true, moved: false, reply: 'already', fare: t.deals[v.id].fare };
    const r = hash(`${t.id}:${v.id}`) / 4294967296;
    const min = MODES[opt.line.mode].fare.min;
    const cut = r50(opt.fare * (0.8 + 0.08 * ((r * 7) % 1)));
    const ok = r < HAGGLE[opt.line.mode] && cut < opt.fare && cut >= min;
    t.deals[v.id] = { tried: true, fare: ok ? cut : opt.fare };
    return { ok: true, moved: ok, reply: ok ? 'reduced' : 'refused', fare: t.deals[v.id].fare, from: opt.fare };
  }

  /** Check boarding without changing anything. */
  canBoard(v) {
    const opt = this.optionFor(v);
    if (!opt) return { ok: false, error: 'wrong-vehicle' };
    const fare = this.fareWith(v, opt);
    if (this.fleet.free(v) < 1) return { ok: false, error: 'full', opt, fare };
    if (!this.economy.canAfford(fare)) return { ok: false, error: 'insufficient-funds', opt, fare };
    return { ok: true, opt, fare };
  }

  board(v) {
    const c = this.canBoard(v);
    if (!c.ok) return c;
    const t = this.trip, opt = c.opt;
    Object.assign(t, { state: 'boarded', v, option: opt, line: opt.line, fare: c.fare, standardFare: opt.fare, paid: 0, mode: opt.line.mode });
    v.transit.player = { trip: t, destOcc: opt.to, destIdx: opt.line.occ.indexOf(opt.to) };
    v.transit.boardHold = v.transit.dwellT + 2.5; // a moment to sit down
    this.fleet.playerWait = null;
    this.bus?.emit('trip:boarded', t);
    return { ok: true, trip: t };
  }

  onFleet(type, v, occ) {
    const t = this.trip;
    if (!t || t.v !== v) return;
    if (type === 'depart' && t.state === 'boarded') {
      // the one and only fare charge for this trip
      const tx = this.economy.transact({ key: `fare:${t.id}`, amount: -t.fare, reason: `Fare: ${MODES[t.mode].short} to ${t.dest.name}`, ref: { trip: t.id, line: t.line.id } });
      if (!tx.ok && tx.error !== 'duplicate') {
        // cannot pay: the driver asks the player to get down before pulling away
        this.endTrip('unpaid');
        this.bus?.emit('trip:ejected', { trip: t, v, reason: tx.error });
        return;
      }
      t.paid = tx.ok ? t.fare : t.paid;
      t.state = 'riding';
      this.bus?.emit('trip:departed', t);
      return;
    }
    if (type === 'arrive' && t.state === 'riding') {
      const atDest = occ && occ === t.option.to;
      if (atDest || (!occ && t.dropHere) || (occ && t.nextRequested)) this.bus?.emit('trip:arrived', { trip: t, v, occ, atDest });
    }
  }

  /** Ask the driver for the next stop. */
  requestNextStop() {
    const t = this.riding; if (!t || t.state !== 'riding') return { ok: false };
    t.nextRequested = true; t.v.transit.nextRequested = true;
    return { ok: true };
  }
  /** "Driver, drop me here" — pull in at the next safe spot (never on a bridge or in a junction). */
  requestHere() {
    const t = this.riding; if (!t || t.state !== 'riding') return { ok: false };
    const v = t.v, D = this.fleet.D(v);
    const at = this.net.nextSafeStop(t.line, D, 12 + v.speed * 2.5);
    if (at === null) return { ok: false, error: 'nowhere-safe' };
    v.transit.adhoc = at; t.dropHere = true;
    return { ok: true };
  }

  /** Get down. Only while the vehicle is standing still at the kerb. */
  alight() {
    const t = this.riding;
    if (!t) return { ok: false, error: 'not-riding' };
    const v = t.v;
    if (!(v.transit.dwell > 0) && v.speed > 0.3) return { ok: false, error: 'moving' };
    this.endTrip(t.state === 'boarded' ? 'got-down' : 'arrived');
    return { ok: true, v, trip: t };
  }

  endTrip(outcome) {
    const t = this.trip; if (!t) return;
    if (t.v?.transit?.player?.trip === t) t.v.transit.player = null;
    if (t.v) { t.v.transit.nextRequested = false; if (t.dropHere) t.v.transit.adhoc = null; }
    if (t.paid) {
      this.state.log.push({ id: t.id, line: t.line.id, mode: t.mode, from: t.stop.name, to: t.dest.name, fare: t.paid, outcome });
      if (this.state.log.length > 30) this.state.log.shift();
    }
    t.state = 'done'; t.outcome = outcome;
    this.trip = null; this.fleet.playerWait = null;
    this.bus?.emit('trip:ended', t);
  }
}
