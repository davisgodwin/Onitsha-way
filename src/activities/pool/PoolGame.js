/**
 * 8-ball pool on a 7-ft bar table. Pure JavaScript (no Three.js / DOM): ball physics, pockets, the rules
 * below and the AI opponent run identically in Node tests and in the game.
 *
 * Table space: x along the length (−L/2 … L/2), z across (−W/2 … W/2). The head string (break area) is
 * x < −L/4; the foot spot (apex of the rack) is (L/4, 0).
 *
 * Rules implemented (stated to the player before a match):
 *  - Break from behind the head string. The table is open after the break, even if balls drop.
 *    A scratch on the break is a foul (ball in hand). The 8 potted on the break is re-spotted.
 *  - Open table: the first legal pot (no foul) decides groups — that ball's type (solids 1–7 / stripes 9–15).
 *    Hitting the 8 first on an open table is a foul.
 *  - Every shot must hit one of your own balls first (any but the 8 on an open table; the 8 once your group
 *    is cleared), and after that contact a ball must be potted or some ball must reach a cushion.
 *  - Fouls: cue ball potted (scratch), wrong ball first, no ball hit, no cushion/pot after contact.
 *    Opponent gets ball in hand anywhere. Balls potted on a foul stay down.
 *  - You keep shooting while you legally pot one of your balls (any ball on an open table).
 *  - You win by potting the 8 legally after clearing your group. You lose by potting the 8 early,
 *    or potting it with a foul (e.g. scratching on the 8).
 */
export const TABLE = { L: 1.98, W: 0.99, R: 0.028575 };
const R = TABLE.R, D = 2 * R, HL = TABLE.L / 2, HW = TABLE.W / 2;
export const POCKETS = [
  { x: -HL - 0.012, z: -HW - 0.012, capture: 0.066, mouth: 0.11, corner: true },
  { x: 0, z: -HW - 0.03, capture: 0.062, mouth: 0.092, corner: false },
  { x: HL + 0.012, z: -HW - 0.012, capture: 0.066, mouth: 0.11, corner: true },
  { x: -HL - 0.012, z: HW + 0.012, capture: 0.066, mouth: 0.11, corner: true },
  { x: 0, z: HW + 0.03, capture: 0.062, mouth: 0.092, corner: false },
  { x: HL + 0.012, z: HW + 0.012, capture: 0.066, mouth: 0.11, corner: true },
];
export const AI_LEVELS = {
  easy: { error: 0.03, think: 0.55, safety: 0.2 },
  normal: { error: 0.014, think: 0.8, safety: 0.45 },
  hard: { error: 0.007, think: 1, safety: 0.7 },
};
export const MAX_SPEED = 6.5;
const ROLL = 0.18, DAMP = 0.08, CUSHION = 0.72, BALL_E = 0.94, STEP = 1 / 480;
export const groupOf = (n) => (n === 0 ? 'cue' : n === 8 ? 'eight' : n < 8 ? 'solids' : 'stripes');
const hyp = Math.hypot;
function rng(seed) { let s = seed >>> 0 || 7; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export class PoolGame {
  constructor({ seed = 1, difficulty = 'normal', names = ['You', 'Opponent'], aiPlayers = [1] } = {}) {
    this.rand = rng(seed); this.ai = AI_LEVELS[difficulty] ?? AI_LEVELS.normal; this.difficulty = AI_LEVELS[difficulty] ? difficulty : 'normal';
    this.names = names; this.aiPlayers = aiPlayers;
    this.balls = []; this.turn = 0; this.groups = [null, null]; this.phase = 'place'; this.ballInHand = 'kitchen';
    this.isBreak = true; this.winner = null; this.reason = ''; this.events = []; this.shotNo = 0; this.time = 0;
    this.stats = [{ shots: 0, potted: 0, fouls: 0, visits: 0, bestRun: 0 }, { shots: 0, potted: 0, fouls: 0, visits: 0, bestRun: 0 }];
    this.run = 0; this.rack();
  }

  rack() {
    const order = this.rackOrder(), apex = HL / 2; this.balls = [];
    this.balls.push({ n: 0, x: -HL / 2, z: 0, vx: 0, vz: 0, pocketed: false });
    let k = 0; const gap = D * 1.0005;
    for (let row = 0; row < 5; row++) for (let i = 0; i <= row; i++) {
      const x = apex + row * gap * Math.sqrt(3) / 2, z = (i - row / 2) * gap;
      this.balls.push({ n: order[k++], x, z, vx: 0, vz: 0, pocketed: false });
    }
  }
  /** Standard rack: 8 in the centre (third row, middle), a solid and a stripe in the back corners. */
  rackOrder() {
    const solids = [1, 2, 3, 4, 5, 6, 7], stripes = [9, 10, 11, 12, 13, 14, 15];
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    shuffle(solids); shuffle(stripes);
    const order = new Array(15).fill(0); order[4] = 8; // row index: 0 | 1 2 | 3 4 5 | 6 7 8 9 | 10..14
    order[10] = solids.pop(); order[14] = stripes.pop();
    const rest = shuffle([...solids, ...stripes]); for (let i = 0; i < 15; i++) if (!order[i]) order[i] = rest.pop();
    return order;
  }

  get cue() { return this.balls[0]; }
  ball(n) { return this.balls.find((b) => b.n === n); }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  isAI(player = this.turn) { return this.aiPlayers.includes(player); }
  moving() { return this.balls.some((b) => !b.pocketed && (b.vx !== 0 || b.vz !== 0)); }
  remaining(group) { return this.balls.filter((b) => !b.pocketed && groupOf(b.n) === group).length; }
  /** Which balls the current player may legally hit first. */
  targets(player = this.turn) {
    const g = this.groups[player];
    if (!g) return this.balls.filter((b) => !b.pocketed && b.n !== 0 && b.n !== 8).map((b) => b.n);
    if (this.remaining(g) === 0) return [8];
    return this.balls.filter((b) => !b.pocketed && groupOf(b.n) === g).map((b) => b.n);
  }

  // ------------------------------------------------------------ cue ball placement
  canPlace(x, z) {
    if (this.phase !== 'place') return false;
    if (Math.abs(x) > HL - R || Math.abs(z) > HW - R) return false;
    if (this.ballInHand === 'kitchen' && x > -HL / 2) return false;
    return this.balls.every((b) => b.n === 0 || b.pocketed || hyp(b.x - x, b.z - z) >= D + 0.002);
  }
  place(x, z) {
    if (!this.canPlace(x, z)) return false;
    Object.assign(this.cue, { x, z, vx: 0, vz: 0, pocketed: false }); this.phase = 'aim'; this.ballInHand = null; return true;
  }
  /** Nearest legal cue position to (x, z) — used when the player's chosen spot is blocked. */
  nearestPlace(x, z) {
    for (let r = 0; r < 0.6; r += 0.01) for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r; if (this.canPlace(px, pz)) return { x: px, z: pz };
    }
    return null;
  }

  // ------------------------------------------------------------ shooting
  /** angle: radians in table space; power 0..1. */
  shoot(angle, power) {
    if (this.phase !== 'aim' || this.winner != null) return false;
    const p = Math.max(0.02, Math.min(1, power)), s = 0.25 + (MAX_SPEED - 0.25) * p * p * 0.9 + p * 0.6;
    const c = this.cue; c.vx = Math.cos(angle) * s; c.vz = Math.sin(angle) * s;
    this.shot = { player: this.turn, firstHit: null, railAfter: false, potted: [], cueRail: false, break: this.isBreak, power: p };
    this.phase = 'moving'; this.shotNo++; this.stats[this.turn].shots++;
    this.emit('cue', { power: p });
    return true;
  }

  update(dt) {
    if (this.phase !== 'moving') return;
    let t = Math.min(dt, 0.1); this.time += t;
    while (t > 1e-9) { const h = Math.min(STEP, t); this.physics(h); t -= h; if (!this.moving()) break; }
    if (!this.moving()) this.resolve();
  }
  /** Run a shot to rest instantly (AI planning, tests). */
  settle(maxSeconds = 25) { let s = 0; while (this.phase === 'moving' && s < maxSeconds) { this.update(0.1); s += 0.1; } if (this.phase === 'moving') { for (const b of this.balls) { b.vx = b.vz = 0; } this.resolve(); } }

  physics(h) {
    const B = this.balls, shot = this.shot;
    for (const b of B) {
      if (b.pocketed || (b.vx === 0 && b.vz === 0)) continue;
      b.x += b.vx * h; b.z += b.vz * h;
      const s = hyp(b.vx, b.vz), ns = Math.max(0, s - (ROLL + DAMP * s) * h);
      if (ns < 0.004) { b.vx = b.vz = 0; } else { b.vx *= ns / s; b.vz *= ns / s; }
      // pockets
      let inMouth = false;
      for (const p of POCKETS) { const d = hyp(b.x - p.x, b.z - p.z); if (d < p.capture) { this.pot(b, p); break; } if (d < p.mouth) inMouth = true; }
      if (b.pocketed) continue;
      // cushions (not across a pocket mouth); anything leaving the bed through a mouth drops
      if (inMouth) { if (Math.abs(b.x) > HL - R * 0.4 || Math.abs(b.z) > HW - R * 0.4) { const p = POCKETS.reduce((a, c) => (hyp(b.x - c.x, b.z - c.z) < hyp(b.x - a.x, b.z - a.z) ? c : a)); this.pot(b, p); } continue; }
      let rail = false;
      if (b.x < -HL + R) { b.x = -HL + R; b.vx = -b.vx * CUSHION; b.vz *= 0.94; rail = true; }
      else if (b.x > HL - R) { b.x = HL - R; b.vx = -b.vx * CUSHION; b.vz *= 0.94; rail = true; }
      if (b.z < -HW + R) { b.z = -HW + R; b.vz = -b.vz * CUSHION; b.vx *= 0.94; rail = true; }
      else if (b.z > HW - R) { b.z = HW - R; b.vz = -b.vz * CUSHION; b.vx *= 0.94; rail = true; }
      if (rail && shot) { if (shot.firstHit != null) shot.railAfter = true; if (b.n === 0) shot.cueRail = true; this.emit('rail', { n: b.n, speed: s }); }
    }
    // ball–ball collisions (equal mass, nearly elastic)
    for (let i = 0; i < B.length; i++) {
      const a = B[i]; if (a.pocketed) continue;
      for (let j = i + 1; j < B.length; j++) {
        const b = B[j]; if (b.pocketed) continue;
        const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 >= D * D || d2 === 0) continue;
        const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        const overlap = D - d; a.x -= nx * overlap / 2; a.z -= nz * overlap / 2; b.x += nx * overlap / 2; b.z += nz * overlap / 2;
        if (rel <= 0) continue;
        const k = rel * (1 + BALL_E) / 2;
        a.vx -= k * nx; a.vz -= k * nz; b.vx += k * nx; b.vz += k * nz;
        if (shot && shot.firstHit == null && (a.n === 0 || b.n === 0)) shot.firstHit = a.n === 0 ? b.n : a.n;
        this.emit('click', { speed: rel });
      }
    }
  }

  pot(b, p) {
    b.pocketed = true; b.vx = b.vz = 0; b.pocket = POCKETS.indexOf(p);
    if (this.shot) this.shot.potted.push(b.n);
    this.emit('pot', { n: b.n, pocket: b.pocket });
  }

  // ------------------------------------------------------------ rules
  resolve() {
    const s = this.shot, me = s.player, opp = 1 - me; this.shot = null;
    const potted = s.potted, scratch = potted.includes(0), eight = potted.includes(8);
    const legalFirst = (() => {
      if (s.firstHit == null) return false;
      const g = this.groups[me];
      if (!g) return s.firstHit !== 8 || s.break; // the break may hit anything
      if (this.remaining(g) === 0 && !potted.some((n) => groupOf(n) === g)) return s.firstHit === 8;
      // group cleared during this very shot: the first hit had to be one of the group
      return groupOf(s.firstHit) === g;
    })();
    const objectPotted = potted.some((n) => n !== 0);
    let foul = null;
    if (scratch) foul = 'Scratch: the cue ball went in';
    else if (s.firstHit == null) foul = 'No ball hit';
    else if (!legalFirst) foul = s.firstHit === 8 ? 'Hit the 8 first' : 'Wrong ball hit first';
    else if (!objectPotted && !s.railAfter && !s.break) foul = 'No ball reached a cushion after contact';
    const wasBreak = s.break; this.isBreak = false;
    // the 8-ball
    if (eight) {
      if (wasBreak && !scratch) { this.respot(8); this.emit('respot', { n: 8 }); }
      else {
        const g = this.groups[me], clearedBefore = !!g && this.remaining(g) === 0 && !potted.some((n) => groupOf(n) === g);
        const legalWin = !foul && clearedBefore;
        return this.finish(legalWin ? me : opp, legalWin ? `${this.names[me]} potted the 8` : foul ? `8 potted with a foul (${foul.toLowerCase()})` : '8 potted before clearing the group');
      }
    }
    // groups: decided by the first legal pot after the break
    if (!foul && !wasBreak && !this.groups[me]) {
      const first = potted.find((n) => n !== 0 && n !== 8);
      if (first) { this.groups[me] = groupOf(first); this.groups[opp] = this.groups[me] === 'solids' ? 'stripes' : 'solids'; this.emit('groups', { player: me, group: this.groups[me] }); }
    }
    const mine = this.groups[me];
    const ownPotted = potted.filter((n) => n !== 0 && n !== 8 && (!mine || groupOf(n) === mine));
    this.stats[me].potted += potted.filter((n) => n !== 0 && n !== 8 && (!mine || groupOf(n) === mine)).length;
    if (scratch) { const c = this.cue; c.pocketed = true; }
    if (foul) {
      this.stats[me].fouls++; this.run = 0;
      this.emit('foul', { player: me, reason: foul });
      this.turn = opp; this.stats[opp].visits++; this.phase = 'place'; this.ballInHand = 'anywhere';
      this.cue.pocketed = false; const spot = this.nearestPlace(-HL / 2, 0); Object.assign(this.cue, { x: spot.x, z: spot.z, vx: 0, vz: 0 });
      return;
    }
    if (ownPotted.length > 0 || (wasBreak && objectPotted)) {
      this.run += ownPotted.length; this.stats[me].bestRun = Math.max(this.stats[me].bestRun, this.run);
      this.emit('continue', { player: me }); this.phase = 'aim'; return;
    }
    this.run = 0; this.turn = opp; this.stats[opp].visits++; this.phase = 'aim'; this.emit('turn', { player: opp });
  }
  respot(n) {
    const b = this.ball(n); let x = HL / 2, z = 0;
    while (this.balls.some((o) => o !== b && !o.pocketed && hyp(o.x - x, o.z - z) < D + 0.001)) x += 0.01;
    Object.assign(b, { x, z, vx: 0, vz: 0, pocketed: false });
  }
  finish(winner, reason) {
    this.winner = winner; this.reason = reason; this.phase = 'over';
    this.emit('over', { winner, reason });
  }
  forfeit(player, reason = 'Left the table') { if (this.winner == null) this.finish(1 - player, reason); }

  // ------------------------------------------------------------ aiming helpers
  /** First thing the cue ball meets along `angle`: { n, ghost:{x,z}, objDir } or a cushion point. */
  aimLine(angle, from = this.cue) {
    const dx = Math.cos(angle), dz = Math.sin(angle); let best = Infinity, hit = null;
    for (const b of this.balls) {
      if (b === from || b.pocketed) continue;
      const fx = b.x - from.x, fz = b.z - from.z, t = fx * dx + fz * dz; if (t <= 0) continue;
      const perp2 = fx * fx + fz * fz - t * t; if (perp2 >= D * D) continue;
      const tt = t - Math.sqrt(D * D - perp2); if (tt < best) { best = tt; hit = b; }
    }
    // cushion distance
    const tx = dx > 0 ? (HL - R - from.x) / dx : dx < 0 ? (-HL + R - from.x) / dx : Infinity;
    const tz = dz > 0 ? (HW - R - from.z) / dz : dz < 0 ? (-HW + R - from.z) / dz : Infinity;
    const tw = Math.min(tx, tz);
    if (!hit || best > tw) return { n: null, end: { x: from.x + dx * tw, z: from.z + dz * tw } };
    const gx = from.x + dx * best, gz = from.z + dz * best, ox = hit.x - gx, oz = hit.z - gz, ol = hyp(ox, oz) || 1;
    return { n: hit.n, ghost: { x: gx, z: gz }, objDir: { x: ox / ol, z: oz / ol }, dist: best };
  }

  /** Copy of the game state for planning (no events, same rules). */
  clone() {
    const c = Object.create(PoolGame.prototype);
    Object.assign(c, { ...this, balls: this.balls.map((b) => ({ ...b })), groups: [...this.groups], events: [], stats: this.stats.map((s) => ({ ...s })), shot: this.shot ? { ...this.shot, potted: [...this.shot.potted] } : null });
    c.rand = this.rand; return c;
  }

  /** Clear straight path for a ball of radius R from a to b (ignoring `skip` balls). */
  clear(ax, az, bx, bz, skip = []) {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    for (const o of this.balls) {
      if (o.pocketed || skip.includes(o.n)) continue;
      const t = Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / L2));
      if (hyp(ax + dx * t - o.x, az + dz * t - o.z) < D * 0.98) return false;
    }
    return true;
  }

  /**
   * AI: candidate pots (each target ball × pocket via the ghost-ball method), tried in a copy of the game with
   * the physics, scored on the outcome; aim error by difficulty is applied after choosing. Falls back to a
   * safety (soft hit on an own ball) when nothing pots.
   * Returns { place?:{x,z}, angle, power }.
   */
  plan() {
    const out = {}; let base = this;
    if (this.phase === 'place') {
      // ball in hand: try a few spots, pick the one with the best pot
      const spots = [];
      const kitchen = this.ballInHand === 'kitchen';
      for (let i = 0; i < (kitchen ? 5 : 8); i++) { const x = kitchen ? -HL / 2 - this.rand() * 0.3 : (this.rand() - 0.5) * (TABLE.L - 0.2), z = (this.rand() - 0.5) * (TABLE.W - 0.2); const p = this.nearestPlace(x, z); if (p) spots.push(p); }
      if (kitchen) spots.unshift(this.nearestPlace(-HL / 2, 0));
      let best = null;
      for (const s of spots) { const c = this.clone(); c.place(s.x, s.z); const pl = c.bestShot(kitchen ? 1 : 3); if (!best || pl.score > best.score) best = { ...pl, place: s }; }
      out.place = best.place; base = this.clone(); base.place(best.place.x, best.place.z);
      Object.assign(out, base === this ? {} : { angle: best.angle, power: best.power, score: best.score });
      return this.noisy(out);
    }
    const b = this.bestShot(4); return this.noisy({ angle: b.angle, power: b.power, score: b.score });
  }
  noisy(p) { const e = this.ai.error; p.angle += (this.rand() + this.rand() + this.rand() - 1.5) * e; p.power = Math.max(0.05, Math.min(1, p.power * (1 + (this.rand() - 0.5) * e * 6))); return p; }

  bestShot(depth = 3) {
    const me = this.turn, cands = [];
    if (this.isBreak) return { angle: Math.atan2(this.ball(this.rackApex()).z - this.cue.z, this.ball(this.rackApex()).x - this.cue.x) + (this.rand() - 0.5) * 0.01, power: 0.95, score: 1 };
    for (const n of this.targets()) {
      const t = this.ball(n);
      for (const p of POCKETS) {
        const px = p.x * 0.985, pz = p.z * 0.985, tx = px - t.x, tz = pz - t.z, tl = hyp(tx, tz) || 1;
        const gx = t.x - tx / tl * D, gz = t.z - tz / tl * D;
        const cx = gx - this.cue.x, cz = gz - this.cue.z, cl = hyp(cx, cz); if (cl < 0.01) continue;
        const cut = Math.acos(Math.max(-1, Math.min(1, (cx * tx + cz * tz) / (cl * tl)))); if (cut > 1.35) continue;
        if (!this.clear(this.cue.x, this.cue.z, gx, gz, [0, n]) || !this.clear(t.x, t.z, px, pz, [0, n])) continue;
        const need = (cl + tl / Math.max(0.2, Math.cos(cut))) ; const power = Math.max(0.18, Math.min(0.95, 0.15 + need * 0.22));
        cands.push({ angle: Math.atan2(cz, cx), power, est: -cut * 1.5 - cl * 0.4 - tl * 0.6, n });
      }
    }
    cands.sort((a, c) => c.est - a.est);
    let best = null;
    for (const c of cands.slice(0, Math.max(3, depth * 3))) {
      for (const pw of [c.power, Math.min(1, c.power * 1.35)]) {
        const sim = this.clone(); sim.shoot(c.angle, pw); sim.settle();
        let score = sim.winner === me ? 100 : sim.winner === 1 - me ? -100 : sim.turn === me && sim.phase !== 'place' ? 10 + c.est : -5;
        if (sim.turn === me && sim.phase === 'aim') score += sim.bestLeave(me) * this.ai.think;
        if (!best || score > best.score) best = { angle: c.angle, power: pw, score };
      }
      if (best && best.score > 12) break;
    }
    if (best && best.score > 0) return best;
    // safety: soft legal contact on the nearest own ball
    const own = this.targets().map((n) => this.ball(n)).sort((a, c) => hyp(a.x - this.cue.x, a.z - this.cue.z) - hyp(c.x - this.cue.x, c.z - this.cue.z));
    for (const t of own) {
      if (!this.clear(this.cue.x, this.cue.z, t.x, t.z, [0, t.n])) continue;
      const ang = Math.atan2(t.z - this.cue.z, t.x - this.cue.x);
      for (const pw of [0.3, 0.42]) { const sim = this.clone(); sim.shoot(ang, pw); sim.settle(); const ok = !sim.drainEvents().some((e) => e.type === 'foul'); if (ok) return { angle: ang, power: pw, score: best?.score ?? -1 }; }
    }
    if (best) return best;
    const t = own[0] ?? this.balls.find((b) => !b.pocketed && b.n !== 0);
    return { angle: Math.atan2(t.z - this.cue.z, t.x - this.cue.x), power: 0.4, score: -10 };
  }
  /** How many open pots the position leaves for `player` (cheap; no simulation). */
  bestLeave(player) {
    let k = 0;
    for (const n of this.targets(player)) { const t = this.ball(n); for (const p of POCKETS) { if (this.clear(this.cue.x, this.cue.z, t.x, t.z, [0, n]) && this.clear(t.x, t.z, p.x, p.z, [0, n])) { k++; break; } } }
    return Math.min(3, k);
  }
  rackApex() { return this.balls.filter((b) => b.n !== 0 && !b.pocketed).reduce((a, c) => (c.x < a.x ? c : a)).n; }
}
