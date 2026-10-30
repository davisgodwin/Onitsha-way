import { TRANSPORT } from './transportConfig.js';

/*
  The public transport fleet: keke, mini buses, commercial buses and coasters running their lines.
  - Vehicles are ordinary TrafficSystem vehicles with a `transit` state, so they share the road with
    private cars (car-following, junction queues), but follow their line instead of random turns.
  - The whole fleet keeps running everywhere; only vehicles near the player are drawn.
  - At each stop a driver drops riders who want that stop and picks up people waiting there, within
    the seats available. Stops nobody needs are skipped, as real drivers do.
  - The player is one passenger among the others: a seat is kept free at the stop where the player is
    waiting, and the driver holds a little while the player walks up.
  Pure logic, no rendering. Events (arrive / depart) are delivered synchronously to listeners.
*/

export class TransitFleet {
  constructor(network, { rng = Math.random } = {}) {
    this.net = network; this.rng = rng;
    this.vehicles = [];
    this.listeners = [];
    this.playerWait = null;            // { platform, occs: Set(occ) } while the player waits at a stop
    this.player = { x: 1e9, z: 1e9 };  // player position (for the driver's patience)
    this.serial = 1;
    for (const s of network.stops) for (const p of s.platforms) { p.queue = []; p.acc = 0; }
  }

  on(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit(type, v, occ, info = {}) { for (const f of this.listeners) f(type, v, occ, info); }

  /** Spread vehicles evenly round each loop. make(line, D) returns a traffic vehicle placed at D. */
  populate(make) {
    for (const line of this.net.lines) {
      if (!line.occ.length) continue;
      const n = Math.max(2, Math.round(line.length / line.M.spacing));
      for (let k = 0; k < n; k++) {
        const D = ((line.length * (k + this.rng() * 0.35)) / n) % line.length;
        const v = make(line, D);
        v.transit = this.newState(line, D);
        const fill = Math.floor(line.M.seats * (0.2 + this.rng() * 0.5));
        for (let i = 0; i < fill; i++) v.transit.riders.push(this.randomDest(line, v.transit.occIdx - 1));
        this.vehicles.push(v);
      }
    }
  }

  newState(line, D) {
    const { i } = this.net.locate(line, D);
    let occIdx = line.occ.findIndex((o) => o.d > D); if (occIdx < 0) occIdx = 0;
    return { line, leg: i, occIdx, dwell: 0, dwellT: 0, stopped: null, riders: [], player: null, lastDD: Infinity, adhoc: null, nextRequested: false, boardHold: 0 };
  }

  D(v) { return v.transit.line.cum[v.transit.leg] + Math.min(v.s, v.edge.len); }
  load(v) { return v.transit.riders.length + (v.transit.player ? 1 : 0); }
  free(v) { return v.transit.line.M.seats - this.load(v); }
  isStopped(v) { return v.transit.dwell > 0; }

  /** Riders mostly travel a few stops. */
  randomDest(line, fromIdx) {
    const n = line.occ.length;
    const k = 1 + Math.floor(Math.pow(this.rng(), 1.6) * Math.min(n - 1, 8));
    return (((fromIdx + k) % n) + n) % n;
  }

  /** People arrive at stops over time; busier near markets and by day. */
  updatePlatforms(dt, hour, crowd) {
    for (const s of this.net.stops) {
      const c = crowd(s.x, s.z, hour);
      const cap = s.named ? 8 : 4;
      for (const p of s.platforms) {
        p.acc += dt * 0.02 * c * (0.6 + s.lines.size * 0.25);
        while (p.acc >= 1) { p.acc -= 1; if (p.queue.length < cap) p.queue.push(this.serial++); }
      }
    }
  }

  wantsStop(v, occ) {
    const t = v.transit;
    if (t.riders.includes(t.occIdx)) return true;
    if (t.player && (t.player.destIdx === t.occIdx || t.nextRequested)) return true;
    if (this.playerWait?.occs.has(occ)) return true;
    return occ.platform.queue.length > 0 && this.free(v) > 0;
  }

  /** Next place this vehicle must halt: {halt:{dd, occ, adhoc}|null, dd (to next stop), occ}. */
  nextHalt(v) {
    const t = v.transit, line = t.line, L = line.length, D = this.D(v);
    const occ = line.occ[t.occIdx];
    const dd = (((occ.d - D) % L) + L) % L;
    let halt = this.wantsStop(v, occ) ? { dd, occ } : null;
    if (t.adhoc !== null) {
      const ad = (((t.adhoc - D) % L) + L) % L;
      if (!halt || ad < halt.dd) halt = { dd: ad, occ: null, adhoc: true };
    }
    return { halt, dd, occ };
  }

  /** Is the vehicle pulling in to the kerb (approaching a halt or standing at one)? */
  pullingIn(v) {
    if (v.transit.dwell > 0) return true;
    const { halt } = this.nextHalt(v);
    return !!halt && halt.dd < 28;
  }

  /** Speed cap for this frame; handles arriving, dwelling and departing. */
  control(v, dt, want) {
    const t = v.transit;
    if (t.dwell > 0) {
      t.dwellT += dt;
      if (t.dwellT >= t.dwell && !this.holding(v)) this.depart(v);
      return 0;
    }
    const { halt, dd } = this.nextHalt(v);
    // drove past the next stop without needing it
    if (t.lastDD < 40 && dd > t.lastDD + 40) { t.occIdx = (t.occIdx + 1) % t.line.occ.length; t.lastDD = Infinity; return want; }
    t.lastDD = dd;
    if (halt) {
      const brake = Math.sqrt(2 * 2.4 * Math.max(0, halt.dd - 0.8));
      want = Math.min(want, Math.max(halt.dd > 3 ? 1.6 : 0.7, brake));
      if (halt.dd < 1.3 && v.speed < 3) { this.arrive(v, halt); return 0; }
    }
    return want;
  }

  /** The driver waits for a player who chose this line here and is walking up, and right after boarding. */
  holding(v) {
    const t = v.transit;
    if (t.boardHold > t.dwellT) return true;
    const st = t.stopped;
    if (!st?.occ || t.player) return false;
    if (!this.playerWait?.occs.has(st.occ)) return false;
    const d = Math.hypot(this.player.x - v.x, this.player.z - v.z);
    return d < 45 && t.dwellT < TRANSPORT.maxPlayerHold;
  }

  arrive(v, halt) {
    const t = v.transit, M = t.line.M;
    t.dwellT = 0;
    if (halt.adhoc) {
      t.adhoc = null; t.stopped = { adhoc: true, occ: null }; t.dwell = 2.5;
      this.emit('arrive', v, null, { up: 0, down: 0, serials: [] });
      return;
    }
    const occ = halt.occ, idx = t.occIdx;
    const before = t.riders.length;
    t.riders = t.riders.filter((r) => r !== idx);
    let down = before - t.riders.length;
    // the player is waiting here and every seat is taken: someone gets down for them
    const playerHere = this.playerWait?.occs.has(occ) && !t.player;
    if (playerHere && this.free(v) <= 0 && t.riders.length) { t.riders.pop(); down++; }
    const room = this.free(v) - (playerHere ? 1 : 0);
    const up = Math.max(0, Math.min(room, occ.platform.queue.length));
    const serials = occ.platform.queue.splice(0, up);
    for (let i = 0; i < up; i++) t.riders.push(this.randomDest(t.line, idx));
    t.stopped = { occ, idx };
    t.dwell = M.dwell[0] + this.rng() * (M.dwell[1] - M.dwell[0]) * Math.min(1, (up + down) / 4 + 0.3);
    t.nextRequested = false;
    this.emit('arrive', v, occ, { up, down, serials });
  }

  depart(v) {
    const t = v.transit, st = t.stopped;
    // listeners run first, while the vehicle is still at the kerb (fares are charged here)
    this.emit('depart', v, st?.occ ?? null, {});
    t.dwell = 0; t.dwellT = 0; t.stopped = null; t.boardHold = 0;
    if (st?.occ) { t.occIdx = (t.occIdx + 1) % t.line.occ.length; t.lastDD = Infinity; }
  }

  /** Vehicles of these lines heading for an occurrence, nearest first: [{v, dist}] (dist along the route). */
  approaching(occs) {
    const out = [];
    for (const v of this.vehicles) {
      for (const occ of occs) {
        if (v.transit.line !== occ.line) continue;
        const L = occ.line.length;
        let dist = (((occ.d - this.D(v)) % L) + L) % L;
        if (v.transit.stopped?.occ === occ) dist = 0;
        out.push({ v, dist, occ });
      }
    }
    return out.sort((a, b) => a.dist - b.dist);
  }

  /**
   * Keep waits short for the player: if nothing on the chosen lines is within reach, move one
   * vehicle that is far from the player (out of sight) to a point upstream of the stop.
   */
  ensureService(occs, playerX, playerZ, place) {
    const list = this.approaching(occs);
    const best = list[0];
    const limit = (o) => (o.line.mode === 'keke' ? 700 : 1100);
    if (best && best.dist <= limit(best.occ)) return false;
    const pick = list.filter((a) => !a.v.transit.player && Math.hypot(a.v.x - playerX, a.v.z - playerZ) > 320).pop();
    if (!pick) return false;
    const L = pick.occ.line.length;
    const D = (((pick.occ.d - 320) % L) + L) % L;
    place(pick.v, D);
    const t = pick.v.transit;
    Object.assign(t, { dwell: 0, dwellT: 0, stopped: null, lastDD: Infinity, adhoc: null, boardHold: 0 });
    const line = pick.occ.line;
    t.leg = this.net.locate(line, D).i;
    const next = line.occ.findIndex((o) => o.d > D);
    t.occIdx = next < 0 ? 0 : next;
    return true;
  }
}
