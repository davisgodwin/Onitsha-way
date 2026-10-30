/**
 * Small-sided football (5-a-side) match simulation. Pure JavaScript: no Three.js, no DOM, so the rules,
 * ball physics and AI run (and are tested) in Node exactly as they run in the game.
 *
 * Pitch space: x runs along the length (goals at x = ±L/2), z across (touchlines at z = ±W/2), y up.
 * Team 0 is the player's side. In the first half team 0 attacks +x; ends swap at half-time.
 *
 * One human-controlled player (team 0, `userId`) is driven by setUserInput(); everyone else, both
 * goalkeepers included, is AI. The match advances in fixed 1/60 s steps; step() emits events
 * (kicks, saves, goals, whistles…) that the 3D view turns into sounds, crowd reactions and HUD.
 */

/** The pitch in play. v0.48: 5-a-side (40 × 25 m) or 11-a-side on the whole stadium field (100 × 64 m, full-size goals). */
export const PITCH5 = Object.freeze({ L: 40, W: 25, goalW: 4, goalH: 2, ballR: 0.11, postR: 0.06, boxDepth: 6, boxHalf: 5 });
export const PITCH11 = Object.freeze({ L: 100, W: 64, goalW: 7.32, goalH: 2.44, ballR: 0.11, postR: 0.06, boxDepth: 16.5, boxHalf: 20.16 });
export const PITCH = { ...PITCH5 };
export function setPitchFormat(format) { Object.assign(PITCH, format === '11' ? PITCH11 : PITCH5); return PITCH; }
export const DIFFICULTY = {
  easy:   { speed: 0.86, react: 0.34, tackle: 0.35, keeper: 0.7, think: 0.42, shootRange: 10, error: 1.35 },
  normal: { speed: 0.95, react: 0.25, tackle: 0.5,  keeper: 0.82, think: 0.3,  shootRange: 12, error: 1 },
  hard:   { speed: 1.02, react: 0.18, tackle: 0.62, keeper: 0.9, think: 0.22, shootRange: 14, error: 0.8 },
};
const DT = 1 / 60, G = 9.81;
const RUN = 6.2, SPRINT = 7.6, ACCEL = 16, DRIBBLE = 0.86;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hyp = Math.hypot;
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

/** Ground-ball speed model: ds/dt = -(ROLL_A + ROLL_B·s). Distance covered while slowing from s0 to s1. */
const ROLL_A = 1.0, ROLL_B = 0.35, ROLL_K = ROLL_A / ROLL_B;
export function rollDistance(s0, s1) { if (s0 <= s1) return 0; return ((s0 - s1) - ROLL_K * Math.log((s0 + ROLL_K) / (s1 + ROLL_K))) / ROLL_B; }
/** Speed to kick a ground ball so it arrives `d` metres away still moving at `arrive` m/s. */
export function passSpeed(d, arrive = 3.5) { let lo = arrive, hi = 40; for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (rollDistance(m, arrive) < d) lo = m; else hi = m; } return hi; }

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// Home positions (u = distance towards the opponents' goal, z across). Index 0 is the goalkeeper.
const SHAPE = [
  { role: 'gk', u: -19, z: 0, label: 'GK' },
  { role: 'def', u: -11, z: 0, label: 'DF' },
  { role: 'mid', u: -3, z: -7, label: 'LM' },
  { role: 'mid', u: -3, z: 7, label: 'RM' },
  { role: 'fwd', u: 6, z: 0, label: 'FW' },
];
// v0.48 11-a-side: 4-4-2 (the last slot is the striker who takes the kick-off, as in 5-a-side)
const SHAPE11 = [
  { role: 'gk', u: -48, z: 0, label: 'GK' },
  { role: 'def', u: -33, z: -21, label: 'LB' }, { role: 'def', u: -35, z: -7, label: 'CB' }, { role: 'def', u: -35, z: 7, label: 'CB' }, { role: 'def', u: -33, z: 21, label: 'RB' },
  { role: 'mid', u: -14, z: -22, label: 'LM' }, { role: 'mid', u: -17, z: -7, label: 'CM' }, { role: 'mid', u: -17, z: 7, label: 'CM' }, { role: 'mid', u: -14, z: 22, label: 'RM' },
  { role: 'fwd', u: 4, z: 7, label: 'FW' }, { role: 'fwd', u: 5, z: -5, label: 'ST' },
];

export class FootballMatch {
  /**
   * @param {object} o
   * @param {number} [o.seed]
   * @param {'easy'|'normal'|'hard'} [o.difficulty]
   * @param {number} [o.halfSeconds] real seconds per half
   * @param {string[]} [o.teamNames]
   * @param {string[][]} [o.playerNames] names per team (5 each)
   * @param {number} [o.userSlot] which team-0 slot the human controls (1–4)
   */
  constructor({ seed = 1, difficulty = 'normal', halfSeconds = 150, teamNames = ['Home', 'Away'], playerNames = null, userSlot = null, format = '5' } = {}) {
    setPitchFormat(format); this.format = format === '11' ? '11' : '5'; const shape = this.format === '11' ? SHAPE11 : SHAPE; this.N = shape.length; if (userSlot == null) userSlot = this.N - 1;
    this.passMax = this.format === '11' ? 38 : 26;
    this.rand = rng(seed);
    this.diff = DIFFICULTY[difficulty] ?? DIFFICULTY.normal; this.difficulty = DIFFICULTY[difficulty] ? difficulty : 'normal';
    this.halfSeconds = halfSeconds;
    this.teams = teamNames.slice(0, 2).map((name, t) => ({ name, score: 0, stats: { shots: 0, onTarget: 0, passes: 0, passesDone: 0, tackles: 0, fouls: 0, saves: 0, possession: 0 } }));
    this.half = 1; this.clock = 0; this.time = 0; this.phase = 'kickoff'; this.phaseT = 0; this.events = []; this.paused = false;
    this.ball = { x: 0, y: PITCH.ballR, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: false, lastTouch: null, lastTeam: null, pass: null, spin: 0 };
    this.players = [];
    for (let t = 0; t < 2; t++) shape.forEach((s, i) => this.players.push({
      id: t * this.N + i, team: t, slot: i, role: s.role, label: s.label, home: { u: s.u, z: s.z },
      name: playerNames?.[t]?.[i] ?? `${t ? 'Away' : 'Home'} ${i + 1}`,
      x: 0, z: 0, vx: 0, vz: 0, heading: 0, stunned: 0, cooldown: 0, think: this.rand() * 0.3, tackling: 0, tackleHit: false,
      kick: 0, dive: 0, diveDir: 0, user: t === 0 && i === userSlot, plan: null, holdT: 0,
      stats: { goals: 0, assists: 0, shots: 0, passes: 0, passesDone: 0, tackles: 0, saves: 0 },
    }));
    this.userId = this.players.find((p) => p.user)?.id ?? null;
    this.input = { mx: 0, mz: 0, sprint: false, pass: false, shootHeld: false, tackle: false };
    this.shootCharge = 0; this.stamina = 1; this.restart = null; this.result = null; this.kickoffTeam = 0; this.goalLog = [];
    this.setupKickoff(0);
  }

  // ---------------------------------------------------------------- helpers
  dir(team) { return (team === 0 ? 1 : -1) * (this.half === 1 ? 1 : -1); }
  /** Opponent goal centre for `team`. */
  goalOf(team) { return { x: this.dir(team) * PITCH.L / 2, z: 0 }; }
  ownGoal(team) { return { x: -this.dir(team) * PITCH.L / 2, z: 0 }; }
  toWorldU(team, u) { return u * this.dir(team); }
  get user() { return this.userId == null ? null : this.players[this.userId]; }
  owner() { return this.ball.owner == null ? null : this.players[this.ball.owner]; }
  emit(type, data = {}) { this.events.push({ type, t: this.time, ...data }); }
  drainEvents() { const e = this.events; this.events = []; return e; }
  mates(p) { return this.players.filter((q) => q.team === p.team && q !== p); }
  opps(p) { return this.players.filter((q) => q.team !== p.team); }
  nearestOpp(p) { let best = null, d = Infinity; for (const q of this.opps(p)) { const k = hyp(q.x - p.x, q.z - p.z); if (k < d) { d = k; best = q; } } return { q: best, d }; }
  remaining() { return Math.max(0, this.halfSeconds - this.clock); }

  setUserInput(i) { Object.assign(this.input, i); }
  /** One-shot presses are latched until the next step consumes them. */
  press(name) { if (name === 'pass') this.input.pass = true; else if (name === 'tackle') this.input.tackle = true; }

  setupKickoff(team) {
    this.kickoffTeam = team; this.phase = 'kickoff'; this.phaseT = 0; this.restart = null;
    const b = this.ball; Object.assign(b, { x: 0, y: PITCH.ballR, z: 0, vx: 0, vy: 0, vz: 0, owner: null, held: false, pass: null });
    for (const p of this.players) {
      const d = this.dir(p.team), s = p.home;
      let u = Math.min(s.u, -1.5), z = s.z;
      if (p.slot === this.N - 1) { u = p.team === team ? -0.6 : -9.5; z = p.team === team ? 0 : 0; }
      if (p.slot === 2 || p.slot === 3) u = Math.min(u, -4);
      p.x = u * d; p.z = z; p.vx = p.vz = 0; p.heading = d > 0 ? 0 : Math.PI; p.stunned = p.tackling = p.kick = p.dive = 0; p.cooldown = 0.2; p.holdT = 0;
    }
    // the kicking team's taker is the user when it is the user's side
    const taker = team === 0 && this.user ? this.user : this.players[team * this.N + this.N - 1];
    if (taker.slot !== this.N - 1) { const fw = this.players[team * this.N + this.N - 1]; fw.x = -4 * this.dir(team); fw.z = 3; }
    taker.x = -0.6 * this.dir(team); taker.z = 0;
    this.restart = { kind: 'kickoff', team, taker: taker.id, x: 0, z: 0, wait: taker.user ? 8 : 0.9 };
    b.owner = taker.id; b.lastTouch = taker.id; b.lastTeam = team;
  }

  // ---------------------------------------------------------------- main loop
  update(dt) {
    if (this.paused || this.phase === 'fulltime' || this.phase === 'halftime') return this.result;
    let left = Math.min(dt, 0.25);
    while (left > 1e-6) { const h = Math.min(DT, left); this.step(h); left -= h; if (this.phase === 'fulltime' || this.phase === 'halftime') break; }
    return this.result;
  }

  step(dt) {
    this.time += dt; this.phaseT += dt;
    if (this.phase === 'goal') { this.ballPhysics(dt, true); this.movePlayers(dt, true); if (this.phaseT > 3) this.setupKickoff(this.pendingKickoff); return; }
    // the match clock runs during play and restarts, like a real game clock
    if (this.phase === 'play' || this.phase === 'restart' || this.phase === 'kickoff') {
      this.clock += dt;
      const own = this.owner(); if (own) this.teams[own.team].stats.possession += dt;
      if (this.clock >= this.halfSeconds && this.phase === 'play') { this.endHalf(); return; }
      if (this.clock >= this.halfSeconds + 20) { this.endHalf(); return; } // never stall past time on a slow restart
    }
    this.userStamina(dt);
    if (this.phase === 'kickoff' || this.phase === 'restart') this.restartLogic(dt);
    this.think(dt);
    this.movePlayers(dt, false);
    this.ballPhysics(dt, false);
    if (this.phase === 'play') this.contacts(dt);
    this.input.pass = false; this.input.tackle = false;
  }

  endHalf() {
    this.emit('whistle', { long: true });
    if (this.half === 1) { this.phase = 'halftime'; this.phaseT = 0; this.emit('halftime'); }
    else { this.phase = 'fulltime'; this.result = this.summary(); this.emit('fulltime', { result: this.result }); }
  }
  /** Called by the view when the player continues from the half-time screen. */
  startSecondHalf() { if (this.phase !== 'halftime') return; this.half = 2; this.clock = 0; this.setupKickoff(1); this.emit('whistle', { long: false }); }

  userStamina(dt) {
    const u = this.user; if (!u) return;
    const moving = hyp(u.vx, u.vz) > RUN * 0.9;
    if (this.input.sprint && moving && this.stamina > 0) this.stamina = Math.max(0, this.stamina - 0.14 * dt);
    else this.stamina = Math.min(1, this.stamina + 0.07 * dt);
  }

  // ---------------------------------------------------------------- restarts (kick-off, kick-in, corner, goal kick, free kick)
  beginRestart(kind, team, x, z) {
    const b = this.ball; this.phase = 'restart'; this.phaseT = 0; this.emit('whistle', { long: false, kind });
    Object.assign(b, { x, z, y: PITCH.ballR, vx: 0, vy: 0, vz: 0, owner: null, held: false, pass: null });
    let taker;
    if (kind === 'goalkick') taker = this.players[team * this.N];
    else { const cands = this.players.filter((p) => p.team === team && p.slot !== 0); cands.sort((a, c) => hyp(a.x - x, a.z - z) - hyp(c.x - x, c.z - z)); taker = cands[0]; }
    // opponents give 3 m
    for (const p of this.players) if (p.team !== team) { const d = hyp(p.x - x, p.z - z); if (d < 3) { const k = 3 / Math.max(0.01, d); p.x = x + (p.x - x) * k; p.z = z + (p.z - z) * k; this.clampPlayer(p); } }
    taker.x = x - this.dir(team) * 0.5; taker.z = clamp(z, -PITCH.W / 2 + 0.2, PITCH.W / 2 - 0.2); taker.vx = taker.vz = 0; taker.cooldown = 0;
    if (kind === 'goalkick') { b.owner = taker.id; b.held = true; }
    else b.owner = taker.id;
    b.lastTouch = taker.id; b.lastTeam = team;
    this.restart = { kind, team, taker: taker.id, x, z, wait: taker.user ? 8 : 0.8 + this.rand() * 0.6 };
  }

  restartLogic(dt) {
    const r = this.restart; if (!r) { this.phase = 'play'; return; }
    const t = this.players[r.taker];
    r.wait -= dt;
    if (t.user) {
      if (this.input.pass) { this.userPass(t); this.afterRestartKick(); return; }
      if (!this.input.shootHeld && this.shootCharge > 0.05 && r.kind !== 'kickoff') { this.userShoot(t); this.afterRestartKick(); return; }
      if (r.wait <= 0) { this.aiPass(t, true); this.afterRestartKick(); }
      return;
    }
    if (r.wait <= 0) { if (r.kind === 'goalkick') this.keeperDistribute(t); else this.aiPass(t, true); this.afterRestartKick(); }
  }
  afterRestartKick() { if (this.phase === 'kickoff' && this.restart?.kind === 'kickoff') this.emit('whistle', { long: false, kind: 'kickoff' }); this.restart = null; this.phase = 'play'; this.phaseT = 0; }

  // ---------------------------------------------------------------- decisions
  think(dt) {
    const restarting = this.phase === 'kickoff' || this.phase === 'restart';
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt); p.stunned = Math.max(0, p.stunned - dt); p.kick = Math.max(0, p.kick - dt); p.dive = Math.max(0, p.dive - dt);
      if (p.tackling > 0) { p.tackling -= dt; continue; }
      if (p.user) { this.userControl(p, dt, restarting); continue; }
      p.think -= dt;
      if (p.role === 'gk') { this.keeperAI(p, dt, restarting); continue; }
      if (this.ball.owner === p.id && !restarting) { this.dribblePlan(p, dt); continue; }
      if (this.phase === 'kickoff') { p.plan = { x: p.x, z: p.z, speed: 0 }; continue; }
      if (restarting) { if (!this.restart || p.id !== this.restart.taker) p.plan = { x: this.supportSpot(p).x, z: this.supportSpot(p).z, speed: 0.6 }; else p.plan = { x: p.x, z: p.z, speed: 0 }; continue; }
      if (p.think <= 0) { p.think = this.diff.think * (0.7 + this.rand() * 0.6); this.outfieldAI(p); }
    }
  }

  userControl(p, dt, restarting) {
    const i = this.input, b = this.ball;
    const m = hyp(i.mx, i.mz), sprint = i.sprint && this.stamina > 0.03;
    const top = (sprint ? SPRINT : RUN) * (b.owner === p.id ? DRIBBLE + 0.04 : 1);
    if (restarting && this.restart?.taker === p.id) { p.plan = { x: p.x, z: p.z, speed: 0 }; if (m > 0.1) p.heading = Math.atan2(i.mz, i.mx); }
    else if (restarting && this.phase === 'kickoff') p.plan = { x: p.x, z: p.z, speed: 0 };
    else p.plan = m > 0.05 ? { vx: (i.mx / Math.max(1, m)) * top, vz: (i.mz / Math.max(1, m)) * top } : { vx: 0, vz: 0 };
    if (p.stunned > 0) return;
    if (restarting) { if (i.shootHeld && this.restart?.taker === p.id) this.shootCharge = Math.min(1, this.shootCharge + dt); return; }
    if (b.owner === p.id) {
      if (i.pass) { this.userPass(p); return; }
      if (i.shootHeld) this.shootCharge = Math.min(1, this.shootCharge + dt * 1.05);
      else if (this.shootCharge > 0.05) { this.userShoot(p); return; }
    } else {
      if (!i.shootHeld) this.shootCharge = 0;
      // pass button without the ball asks the teammate carrying it to pass to you
      if (i.pass) { const o = this.owner(); if (o && o.team === p.team && !o.user) o.callFor = 1.2; }
      if (i.tackle && p.cooldown <= 0) this.startTackle(p);
    }
  }

  supportSpot(p) {
    const b = this.ball, d = this.dir(p.team), ballU = b.x * d;
    const own = this.owner(), attacking = own ? own.team === p.team : b.lastTeam === p.team;
    let u = p.home.u + (attacking ? 5 : -1) + ballU * 0.45, z = p.home.z * (attacking ? 1.1 : 0.85) + b.z * (attacking ? 0.2 : 0.4);
    if (p.role === 'def') u = Math.min(u, attacking ? 2 : -6);
    if (p.role === 'fwd' && attacking) u = Math.max(u, ballU + 3);
    u = clamp(u, -PITCH.L / 2 + 3, PITCH.L / 2 - 2.5); z = clamp(z, -PITCH.W / 2 + 1.5, PITCH.W / 2 - 1.5);
    // keep a little space from the nearest opponent
    const pos = { x: u * d, z }; const n = this.nearestOpp({ ...p, x: pos.x, z: pos.z });
    if (attacking && n.q && n.d < 3) { pos.x += (pos.x - n.q.x) / n.d * (3 - n.d); pos.z += (pos.z - n.q.z) / n.d * (3 - n.d); }
    return pos;
  }

  timeTo(p, x, z) { return hyp(x - p.x, z - p.z) / (RUN * this.speedFor(p)); }
  speedFor(p) { return p.team === 0 ? Math.max(0.94, this.diff.speed) : this.diff.speed; }

  outfieldAI(p) {
    const b = this.ball, own = this.owner();
    if (own && own.id === p.id) return; // dribblePlan + carrierDecision handle the carrier
    const look = { x: b.x + b.vx * 0.35, z: b.z + b.vz * 0.35 };
    // who on each team is nearest the (moving) ball
    const team = this.players.filter((q) => q.team === p.team && q.role !== 'gk' && q.stunned <= 0);
    team.sort((a, c) => this.timeTo(a, look.x, look.z) - this.timeTo(c, look.x, look.z));
    const first = team[0], second = team[1];
    if (!own) {
      // loose ball: the nearest two chase; a pass meant for this player is met
      if (b.pass && b.pass.to === p.id) { const lead = this.intercept(p); p.plan = { x: lead.x, z: lead.z, speed: 1 }; return; }
      if (p === first || (p === second && first?.user)) { const lead = this.intercept(p); p.plan = { x: lead.x, z: lead.z, speed: 1 }; return; }
      const s = this.supportSpot(p); p.plan = { x: s.x, z: s.z, speed: 0.75 }; return;
    }
    if (own.team === p.team) { const s = this.supportSpot(p); p.plan = { x: s.x, z: s.z, speed: 0.8 }; return; }
    // defending: nearest presses, second covers between ball and goal, rest hold shape
    const presser = first?.user ? second : first;
    if (p === presser) {
      const g = this.ownGoal(p.team), dx = g.x - own.x, dz = g.z - own.z, l = hyp(dx, dz) || 1;
      const dist = hyp(own.x - p.x, own.z - p.z);
      p.plan = { x: own.x + dx / l * 0.7, z: own.z + dz / l * 0.7, speed: 1 };
      if (dist < 1.5 && p.cooldown <= 0 && this.rand() < 0.55 + this.diff.tackle * 0.4) this.startTackle(p);
      return;
    }
    if (p === second || (p === first && first !== presser)) {
      const g = this.ownGoal(p.team); p.plan = { x: own.x + (g.x - own.x) * 0.38, z: own.z + (g.z - own.z) * 0.38, speed: 0.9 }; return;
    }
    const s = this.supportSpot(p); p.plan = { x: s.x, z: s.z, speed: 0.7 };
  }

  /** Where `p` can meet the ball soonest (simple forward prediction along the ball's roll). */
  intercept(p) {
    const b = this.ball; let bx = b.x, bz = b.z, s = hyp(b.vx, b.vz); const ux = s > 0.01 ? b.vx / s : 0, uz = s > 0.01 ? b.vz / s : 0;
    for (let t = 0; t < 3; t += 0.1) {
      if (hyp(bx - p.x, bz - p.z) / (RUN * this.speedFor(p)) <= t) break;
      const ns = Math.max(0, s - (ROLL_A + ROLL_B * s) * 0.1); bx += ux * (s + ns) / 2 * 0.1; bz += uz * (s + ns) / 2 * 0.1; s = ns;
    }
    return { x: clamp(bx, -PITCH.L / 2, PITCH.L / 2), z: clamp(bz, -PITCH.W / 2, PITCH.W / 2) };
  }

  dribblePlan(p, dt) {
    if (p.user || p.role === 'gk') return;
    const g = this.goalOf(p.team), n = this.nearestOpp(p);
    let tx = g.x - p.x, tz = g.z * 0.6 - p.z; const l = hyp(tx, tz) || 1; tx /= l; tz /= l;
    if (n.q && n.d < 4) { // swerve away from the nearest opponent
      const ax = (p.x - n.q.x) / n.d, az = (p.z - n.q.z) / n.d, w = (4 - n.d) / 4 * 0.9;
      tx += ax * w; tz += az * w * 1.4; const k = hyp(tx, tz) || 1; tx /= k; tz /= k;
    }
    // stay on the pitch
    if (Math.abs(p.z) > PITCH.W / 2 - 2) tz -= Math.sign(p.z) * 0.6;
    const sp = RUN * DRIBBLE * this.speedFor(p);
    p.plan = { vx: tx * sp, vz: tz * sp };
    p.holdT += dt; p.callFor = Math.max(0, (p.callFor ?? 0) - dt);
    if (p.think <= 0) { p.think = this.diff.think * (0.6 + this.rand() * 0.5); this.carrierDecision(p); }
  }

  carrierDecision(p) {
    const g = this.goalOf(p.team), dG = hyp(g.x - p.x, g.z - p.z), n = this.nearestOpp(p);
    const angleOk = Math.abs(p.z) < 7 || dG < 7;
    const shotLane = this.laneOpen(p.x, p.z, g.x, clamp(p.z * 0.3, -1.5, 1.5), p.team, 0.9);
    if (dG < this.diff.shootRange && angleOk && (shotLane || dG < 7) && this.rand() < (dG < 7 ? 0.8 : 0.4)) { this.aiShoot(p); return; }
    const pressured = n.d < 2.2, waited = p.holdT > 1.4 + this.rand() * 1.8;
    if (p.callFor > 0 || pressured || waited) { if (this.aiPass(p, false, p.callFor > 0)) { p.callFor = 0; return; } }
  }

  /** Is the straight lane from (x,z) to (tx,tz) clear of opponents of `team` (within `w` m)? */
  laneOpen(x, z, tx, tz, team, w = 1) {
    const dx = tx - x, dz = tz - z, L2 = dx * dx + dz * dz || 1;
    for (const q of this.players) {
      if (q.team === team || (q.role === 'gk' && hyp(q.x - tx, q.z - tz) < 3)) continue;
      const t = clamp(((q.x - x) * dx + (q.z - z) * dz) / L2, 0, 1); if (t <= 0.02) continue;
      if (hyp(x + dx * t - q.x, z + dz * t - q.z) < w) return false;
    }
    return true;
  }

  /** Score each teammate as a pass target. `dirX/dirZ` (optional) is the direction the passer wants. */
  bestPass(p, dirX = 0, dirZ = 0, preferUser = false) {
    let best = null, bestS = -Infinity;
    const d = this.dir(p.team);
    for (const q of this.mates(p)) {
      if (q.role === 'gk' && !(dirX || dirZ)) continue;
      const dx = q.x - p.x, dz = q.z - p.z, dist = hyp(dx, dz); if (dist < 2.5 || dist > this.passMax) continue;
      let s = (dx * d) * 0.25 - Math.abs(dist - 10) * 0.12;
      const open = this.laneOpen(p.x, p.z, q.x + q.vx * 0.4, q.z + q.vz * 0.4, p.team, 1.1); s += open ? 2.5 : -3;
      const n = this.nearestOpp(q); s += clamp(n.d, 0, 6) * 0.35;
      if (dirX || dirZ) { const c = (dx * dirX + dz * dirZ) / (dist * (hyp(dirX, dirZ) || 1)); s += c * 6; if (c < 0.2) s -= 4; }
      if (preferUser && q.user) s += 3;
      if (q.role === 'gk') s -= 3;
      if (s > bestS) { bestS = s; best = q; }
    }
    return best ? { q: best, score: bestS } : null;
  }

  aiPass(p, forced = false, preferUser = false) {
    const user = this.user, want = preferUser || (user && user.team === p.team && this.rand() < 0.45);
    const opt = this.bestPass(p, 0, 0, want);
    if (!opt || (!forced && opt.score < 0.5)) return false;
    this.passTo(p, opt.q, this.diff.error);
    return true;
  }

  userPass(p) {
    const i = this.input; let dx = i.mx, dz = i.mz; if (hyp(dx, dz) < 0.1) { dx = Math.cos(p.heading); dz = Math.sin(p.heading); }
    const opt = this.bestPass(p, dx, dz);
    if (opt) this.passTo(p, opt.q, 0.8);
    else { // pass into space in the chosen direction
      const l = hyp(dx, dz) || 1; this.kickBall(p, dx / l * 11, 0.2, dz / l * 11); this.teams[p.team].stats.passes++; p.stats.passes++; this.ball.pass = { from: p.id, to: null, t: this.time };
    }
  }

  passTo(p, q, errScale = 1) {
    const lead = 0.45, tx = q.x + q.vx * lead, tz = q.z + q.vz * lead, d = hyp(tx - p.x, tz - p.z);
    const sp = passSpeed(d, d > 14 ? 5 : 3.5), err = (this.rand() - 0.5) * 0.09 * errScale;
    const a = Math.atan2(tz - p.z, tx - p.x) + err;
    this.kickBall(p, Math.cos(a) * sp, d > 16 ? 1.6 : 0.15, Math.sin(a) * sp);
    this.ball.pass = { from: p.id, to: q.id, t: this.time };
    this.teams[p.team].stats.passes++; p.stats.passes++;
  }

  aiShoot(p) {
    const g = this.goalOf(p.team), keeper = this.players[(1 - p.team) * this.N];
    // aim for the side the keeper is not covering
    const side = keeper.z > 0.2 ? -1 : keeper.z < -0.2 ? 1 : (this.rand() < 0.5 ? -1 : 1);
    const z = side * (0.4 + this.rand() * 1.25), dG = hyp(g.x - p.x, g.z - p.z);
    const power = clamp(0.45 + dG / 25 + this.rand() * 0.2, 0.45, 0.95);
    this.shoot(p, g.x, z, power, this.diff.error);
  }

  userShoot(p) {
    const power = clamp(this.shootCharge, 0.2, 1); this.shootCharge = 0;
    const g = this.goalOf(p.team), i = this.input;
    let hx = Math.cos(p.heading), hz = Math.sin(p.heading); if (hyp(i.mx, i.mz) > 0.2) { const l = hyp(i.mx, i.mz); hx = i.mx / l; hz = i.mz / l; }
    const towards = Math.sign(g.x - p.x) === Math.sign(hx) && Math.abs(hx) > 0.25;
    let z;
    if (towards) { const t = (g.x - p.x) / hx; z = clamp(p.z + hz * t, -PITCH.goalW / 2 + 0.3, PITCH.goalW / 2 - 0.3); }
    else { this.kickBall(p, hx * (12 + 14 * power), 1 + power * 2, hz * (12 + 14 * power)); this.teams[p.team].stats.shots++; p.stats.shots++; this.emit('shot', { by: p.id, team: p.team }); return; }
    this.shoot(p, g.x, z, power, 0.9);
  }

  shoot(p, gx, gz, power, errScale) {
    const n = this.nearestOpp(p), pressure = n.d < 1.8 ? 0.05 : 0;
    const err = (this.rand() - 0.5) * 2 * (0.025 + 0.07 * power * power + pressure) * errScale;
    const a = Math.atan2(gz - p.z, gx - p.x) + err, sp = 13 + 15 * power;
    const d = hyp(gx - p.x, gz - p.z), t = d / sp;
    // rise so the ball reaches a chosen height at the goal line; too much power can send it over
    const targetY = 0.3 + this.rand() * 1.3 + Math.max(0, power - 0.82) * this.rand() * 3 * errScale;
    const vy = clamp((targetY - PITCH.ballR + 0.5 * G * t * t) / Math.max(0.1, t), 0.5, 9);
    this.kickBall(p, Math.cos(a) * sp, vy, Math.sin(a) * sp);
    this.ball.pass = null; this.ball.shot = { by: p.id, team: p.team, t: this.time };
    this.teams[p.team].stats.shots++; p.stats.shots++;
    this.emit('shot', { by: p.id, team: p.team, power });
  }

  kickBall(p, vx, vy, vz) {
    const b = this.ball; b.owner = null; b.held = false; b.vx = vx; b.vy = vy; b.vz = vz; b.y = Math.max(b.y, PITCH.ballR);
    b.x = p.x + Math.cos(p.heading) * 0.45; b.z = p.z + Math.sin(p.heading) * 0.45;
    b.lastTouch = p.id; b.lastTeam = p.team; b.shot = null; p.cooldown = 0.35; p.kick = 0.32; p.holdT = 0;
    p.heading = Math.atan2(vz, vx);
    this.emit('kick', { by: p.id, strength: clamp(hyp(vx, vy, vz) / 26, 0.15, 1) });
  }

  startTackle(p) {
    const own = this.owner(); p.cooldown = 1.1; p.tackling = 0.45; p.tackleHit = false;
    const tx = this.ball.x + (own ? own.vx * 0.15 : 0), tz = this.ball.z + (own ? own.vz * 0.15 : 0); p.heading = Math.atan2(tz - p.z, tx - p.x);
    p.plan = { vx: Math.cos(p.heading) * 7.2, vz: Math.sin(p.heading) * 7.2 };
    this.emit('tackle-start', { by: p.id });
  }

  // ---------------------------------------------------------------- goalkeepers
  keeperAI(k, dt, restarting) {
    const b = this.ball, g = this.ownGoal(k.team), d = this.dir(k.team);
    if (b.owner === k.id) {
      k.plan = { x: k.x, z: k.z, speed: 0 };
      if (!restarting) { k.holdT += dt; if (k.holdT > 1.1 + this.rand() * 0.02) this.keeperDistribute(k); }
      return;
    }
    // reacting to a shot or a ball heading for goal
    const towards = (b.vx * -d) > 4 && !b.owner;
    if (towards && k.dive <= 0) {
      const t = (g.x - b.x) / (b.vx || 1e-6);
      if (t > 0 && t < 1.6) { const cz = b.z + b.vz * t; if (Math.abs(cz) < PITCH.goalW / 2 + 0.8) {
        k.react = (k.react ?? 0) + dt;
        if (k.react >= this.diff.react * (k.team === 0 ? 0.9 : 1)) { k.dive = 0.7; k.diveDir = Math.sign(cz - k.z); k.plan = { x: g.x + d * 0.6, z: cz, speed: 1.15 }; }
        else k.plan = { x: k.x, z: cz, speed: 0.45 }; // set feet towards the shot while reading it
        return;
      } }
    } else if (!towards) k.react = 0;
    if (k.dive > 0) return;
    // positioning: on the line between ball and goal centre, coming out a little as the ball approaches
    const dx = b.x - g.x, dz = b.z - g.z, dist = hyp(dx, dz) || 1, out = clamp(dist * 0.18, 0.6, 3);
    let x = g.x + dx / dist * out, z = clamp(g.z + dz / dist * out, -2.6, 2.6);
    // a loose ball inside the area is claimed
    if (!b.owner && dist < PITCH.boxDepth && hyp(b.vx, b.vz) < 9 && Math.abs(b.z) < PITCH.boxHalf) { x = b.x; z = b.z; }
    k.plan = { x, z, speed: 0.9 };
  }

  keeperDistribute(k) {
    const opt = this.bestPass(k, this.dir(k.team), 0, true) ?? this.bestPass(k);
    this.ball.held = false;
    if (opt) this.passTo(k, opt.q, 0.7);
    else this.kickBall(k, this.dir(k.team) * 14, 2.5, (this.rand() - 0.5) * 6);
    k.holdT = 0;
  }

  // ---------------------------------------------------------------- movement
  movePlayers(dt, celebrate) {
    for (const p of this.players) {
      let tvx = 0, tvz = 0; const plan = p.plan;
      const top = (p.user ? RUN : RUN * this.speedFor(p)) * (p.role === 'gk' && p.dive > 0 ? 1.15 : 1);
      if (celebrate || p.stunned > 0) { tvx = 0; tvz = 0; }
      else if (plan && plan.vx !== undefined) { tvx = plan.vx; tvz = plan.vz; }
      else if (plan) { const dx = plan.x - p.x, dz = plan.z - p.z, d = hyp(dx, dz); const sp = top * (plan.speed ?? 1) * clamp(d / 1.2, 0, 1); if (d > 0.05) { tvx = dx / d * sp; tvz = dz / d * sp; } }
      const ax = tvx - p.vx, az = tvz - p.vz, a = hyp(ax, az), maxA = (p.tackling > 0 ? 30 : ACCEL) * dt;
      if (a > maxA) { p.vx += ax / a * maxA; p.vz += az / a * maxA; } else { p.vx = tvx; p.vz = tvz; }
      p.x += p.vx * dt; p.z += p.vz * dt; this.clampPlayer(p);
      const s = hyp(p.vx, p.vz);
      if (s > 0.4 && p.kick <= 0) p.heading += clamp(angDiff(p.heading, Math.atan2(p.vz, p.vx)), -12 * dt, 12 * dt);
      else if (!p.user && s <= 0.4 && p.role !== 'gk' && p.kick <= 0) p.heading += clamp(angDiff(p.heading, Math.atan2(this.ball.z - p.z, this.ball.x - p.x)), -5 * dt, 5 * dt);
      else if (p.role === 'gk' && s <= 0.4) p.heading += clamp(angDiff(p.heading, Math.atan2(this.ball.z - p.z, this.ball.x - p.x)), -6 * dt, 6 * dt);
    }
    // players don't overlap
    for (let i = 0; i < this.players.length; i++) for (let j = i + 1; j < this.players.length; j++) {
      const a = this.players[i], c = this.players[j], dx = c.x - a.x, dz = c.z - a.z, d = hyp(dx, dz), m = 0.62;
      if (d < m && d > 1e-4) { const push = (m - d) / 2; a.x -= dx / d * push; a.z -= dz / d * push; c.x += dx / d * push; c.z += dz / d * push; }
    }
  }
  clampPlayer(p) { p.x = clamp(p.x, -PITCH.L / 2 - 1.2, PITCH.L / 2 + 1.2); p.z = clamp(p.z, -PITCH.W / 2 - 1.2, PITCH.W / 2 + 1.2); }

  // ---------------------------------------------------------------- ball
  ballPhysics(dt, frozen) {
    const b = this.ball, R = PITCH.ballR;
    if (b.owner != null) {
      const p = this.players[b.owner];
      if (b.held) { b.x = p.x + Math.cos(p.heading) * 0.3; b.z = p.z + Math.sin(p.heading) * 0.3; b.y = 1.0; b.vx = p.vx; b.vz = p.vz; b.vy = 0; return; }
      const tx = p.x + Math.cos(p.heading) * 0.55, tz = p.z + Math.sin(p.heading) * 0.55, k = Math.min(1, 18 * dt);
      b.x += (tx - b.x) * k; b.z += (tz - b.z) * k; b.y = R; b.vx = p.vx; b.vz = p.vz; b.vy = 0; b.spin += hyp(p.vx, p.vz) * dt / R;
      return;
    }
    if (frozen && this.phase === 'goal') { // settle in the net
      b.vx *= Math.exp(-5 * dt); b.vz *= Math.exp(-5 * dt); b.vy -= G * dt;
    } else b.vy -= G * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y <= R) {
      b.y = R; if (b.vy < -1.2) { b.vy = -b.vy * 0.5; this.emit('bounce', { strength: clamp(-b.vy / 8, 0, 1) }); } else b.vy = 0;
      const s = hyp(b.vx, b.vz); if (s > 0) { const ns = Math.max(0, s - (ROLL_A + ROLL_B * s) * dt); b.vx *= ns / s; b.vz *= ns / s; }
    } else { const k = Math.exp(-0.1 * dt); b.vx *= k; b.vz *= k; }
    b.spin += hyp(b.vx, b.vz) * dt / R;
    if (frozen) { const gx = Math.sign(b.x) * (PITCH.L / 2 + 1.1); if (Math.abs(b.x) > Math.abs(gx)) { b.x = gx; b.vx = 0; } if (Math.abs(b.z) > PITCH.goalW / 2 - R) { b.z = Math.sign(b.z) * (PITCH.goalW / 2 - R); b.vz = 0; } return; }
    this.goalFrame();
    if (this.phase !== 'play') return;
    // goal?
    const half = PITCH.L / 2;
    if (Math.abs(b.x) > half + R) {
      const end = Math.sign(b.x);
      if (Math.abs(b.z) < PITCH.goalW / 2 - R && b.y < PITCH.goalH - R) { this.scoreGoal(end); return; }
      // over the goal line elsewhere: corner or goal kick
      const defending = this.dir(0) * end > 0 ? 1 : 0; // team defending this end
      if (b.lastTeam === defending) this.beginRestart('corner', 1 - defending, end * (half - 0.3), Math.sign(b.z || 1) * (PITCH.W / 2 - 0.3));
      else this.beginRestart('goalkick', defending, end * (half - 2.5), 0);
      this.emit('out', { kind: b.lastTeam === defending ? 'corner' : 'goalkick' });
      return;
    }
    if (Math.abs(b.z) > PITCH.W / 2 + R) {
      this.emit('out', { kind: 'kickin' });
      this.beginRestart('kickin', 1 - (b.lastTeam ?? 0), clamp(b.x, -half + 1, half - 1), Math.sign(b.z) * (PITCH.W / 2));
    }
  }

  /** Posts and crossbar. */
  goalFrame() {
    const b = this.ball, R = PITCH.ballR, half = PITCH.L / 2, hw = PITCH.goalW / 2, rr = R + PITCH.postR;
    for (const end of [-1, 1]) {
      const px = end * half;
      if (Math.abs(b.x - px) > 0.6) continue;
      for (const pz of [-hw, hw]) {
        const dx = b.x - px, dz = b.z - pz, d = hyp(dx, dz);
        if (d < rr && b.y < PITCH.goalH + rr) {
          const nx = dx / (d || 1), nz = dz / (d || 1), vn = b.vx * nx + b.vz * nz;
          if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; b.x = px + nx * rr; b.z = pz + nz * rr; this.emit('post', { strength: clamp(-vn / 20, 0.2, 1) }); }
        }
      }
      // crossbar (a horizontal cylinder along z at height goalH)
      if (Math.abs(b.z) < hw) {
        const dx = b.x - px, dy = b.y - PITCH.goalH, d = hyp(dx, dy);
        if (d < rr) { const nx = dx / (d || 1), ny = dy / (d || 1), vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; b.x = px + nx * rr; b.y = PITCH.goalH + ny * rr; this.emit('post', { strength: clamp(-vn / 20, 0.2, 1), bar: true }); } }
      }
    }
  }

  scoreGoal(end) {
    const b = this.ball, team = this.dir(0) * end > 0 ? 0 : 1; // team attacking that end scores
    const scorer = b.lastTouch != null ? this.players[b.lastTouch] : null;
    const own = scorer && scorer.team !== team;
    this.teams[team].score++;
    let assist = null;
    if (scorer && !own) {
      scorer.stats.goals++;
      const pass = b.lastPass; if (pass && pass.team === team && pass.to === scorer.id && this.time - pass.t < 8 && pass.from !== scorer.id) { assist = this.players[pass.from]; assist.stats.assists++; }
    }
    if (b.shot) this.teams[b.shot.team].stats.onTarget++;
    this.goalLog.push({ team, scorer: scorer?.id ?? null, own: !!own, assist: assist?.id ?? null, half: this.half, clock: Math.round(this.clock) });
    this.phase = 'goal'; this.phaseT = 0; this.pendingKickoff = 1 - team; b.shot = null;
    this.emit('goal', { team, scorer: scorer?.id ?? null, own: !!own, assist: assist?.id ?? null, score: this.teams.map((t) => t.score) });
  }

  // ---------------------------------------------------------------- touches, tackles, saves
  contacts() {
    const b = this.ball;
    // tackles resolve a short time into the lunge
    for (const p of this.players) {
      if (p.tackling <= 0 || p.tackleHit) continue;
      const own = this.owner();
      if (!own || own.team === p.team || b.held) { p.tackleHit = true; continue; }
      const d = hyp(b.x - p.x, b.z - p.z);
      if (d > 0.95) { if (p.tackling < 0.08) { p.tackleHit = true; p.stunned = 0.35; this.emit('tackle', { by: p.id, won: false }); } continue; }
      p.tackleHit = true;
      const fromBehind = Math.abs(angDiff(own.heading, Math.atan2(p.z - own.z, p.x - own.x))) > 2.4;
      const skill = p.user ? 0.68 : this.diff.tackle; const chance = skill * (own.user ? 0.85 : 1);
      if (fromBehind && this.rand() < 0.55) { this.foul(p, own); continue; }
      if (this.rand() < chance) {
        b.owner = null; const a = p.heading + (this.rand() - 0.5) * 0.8; b.vx = Math.cos(a) * 5; b.vz = Math.sin(a) * 5; b.vy = 0.5;
        b.lastTouch = p.id; b.lastTeam = p.team; b.pass = null; own.stunned = 0.55; own.cooldown = 0.6; p.cooldown = 0.15;
        this.teams[p.team].stats.tackles++; p.stats.tackles++; this.emit('tackle', { by: p.id, won: true });
      } else { p.stunned = 0.6; this.emit('tackle', { by: p.id, won: false }); }
    }
    if (b.owner != null) return;
    const speed = hyp(b.vx, b.vz);
    // goalkeeper saves (hands): wide reach when diving
    for (const k of [this.players[0], this.players[5]]) {
      const g = this.ownGoal(k.team); if (hyp(k.x - g.x, k.z - g.z) > PITCH.boxDepth + 1) continue;
      const reach = k.dive > 0 ? 1.45 : 0.85, d = hyp(b.x - k.x, b.z - k.z), prev = k.prevD ?? Infinity; k.prevD = d;
      if (d > reach || b.y > 2.35 || k.cooldown > 0) continue;
      // attempt the save at the ball's closest approach, not the instant it enters reach
      if (d > 0.55 && d < prev - 1e-4 && speed > 3) continue;
      if (b.lastTeam === k.team && !b.shot) { if (speed < 12) this.gain(k, true); continue; }
      const skill = k.team === 0 ? 0.84 : this.diff.keeper; let p = 0.98 - clamp((d - 0.45) / 1.0, 0, 1) * 0.45 - clamp((speed - 16) / 40, 0, 0.3); p = clamp(p, 0.15, 0.98) * (0.72 + 0.32 * skill);
      if (this.rand() < p) {
        if (b.shot) { this.teams[k.team].stats.saves++; k.stats.saves++; this.teams[b.shot.team].stats.onTarget++; b.shot = null; }
        if (speed < 15 && b.y < 1.9) this.gain(k, true);
        else { const out = -Math.sign(b.vx) * (3 + this.rand() * 3); b.vx = out; b.vz = (this.rand() - 0.5) * 9; b.vy = 2 + this.rand() * 2; b.lastTouch = k.id; b.lastTeam = k.team; k.cooldown = 0.5; }
        this.emit('save', { by: k.id, caught: b.owner === k.id });
      } else { k.cooldown = 0.6; b.vx *= 0.55 + this.rand() * 0.35; b.vz += (this.rand() < 0.5 ? -1 : 1) * (1.5 + this.rand() * 4); b.vy += 0.8; b.lastTeam = k.team; this.emit('fumble', { by: k.id }); }
      return;
    }
    // outfield touches
    let best = null, bestD = 0.75;
    for (const p of this.players) {
      if (p.stunned > 0 || p.cooldown > 0) continue;
      if (p.role === 'gk' && hyp(p.x - this.ownGoal(p.team).x, p.z) <= PITCH.boxDepth + 1) continue; // keepers use their hands (above)
      const d = hyp(b.x - p.x, b.z - p.z); if (d < bestD && b.y < 0.9) { best = p; bestD = d; }
    }
    if (!best) return;
    if (speed > 14 && !(b.pass && b.pass.to === best.id)) { // too hot to control: deflects off the player
      const a = Math.atan2(b.z - best.z, b.x - best.x); b.vx = Math.cos(a) * speed * 0.35; b.vz = Math.sin(a) * speed * 0.35; b.vy = 0.8;
      b.lastTouch = best.id; b.lastTeam = best.team; best.cooldown = 0.25; if (b.shot && best.team !== b.shot.team) this.emit('block', { by: best.id }); b.shot = null; this.emit('kick', { by: best.id, strength: 0.4 }); return;
    }
    this.gain(best, false);
  }

  gain(p, hands) {
    const b = this.ball, pass = b.pass;
    if (pass && pass.from != null) {
      const from = this.players[pass.from];
      if (from.team === p.team && from.id !== p.id) { this.teams[p.team].stats.passesDone++; from.stats.passesDone++; b.lastPass = { from: from.id, to: p.id, team: p.team, t: this.time }; }
      else if (from.team !== p.team) b.lastPass = null;
    } else if (b.lastTeam !== p.team) b.lastPass = null;
    b.owner = p.id; b.held = !!hands; b.pass = null; b.shot = null; b.lastTouch = p.id; b.lastTeam = p.team; p.holdT = 0; p.think = 0;
    b.vx = p.vx; b.vz = p.vz; b.vy = 0;
    if (hands) { p.plan = { x: p.x, z: p.z, speed: 0 }; }
    this.emit('control', { by: p.id, hands: !!hands });
  }

  foul(p, victim) {
    this.teams[p.team].stats.fouls++; p.stunned = 0.6; this.emit('foul', { by: p.id, on: victim.id });
    const half = PITCH.L / 2, x = clamp(victim.x, -half + 2, half - 2), z = clamp(victim.z, -PITCH.W / 2 + 0.5, PITCH.W / 2 - 0.5);
    this.beginRestart('freekick', victim.team, x, z);
  }

  // ---------------------------------------------------------------- results
  summary() {
    const [a, b] = this.teams.map((t) => t.score), u = this.user;
    const total = this.teams[0].stats.possession + this.teams[1].stats.possession || 1;
    return {
      score: [a, b], teams: this.teams.map((t) => t.name),
      outcome: a > b ? 'win' : a < b ? 'loss' : 'draw',
      possession: [Math.round(this.teams[0].stats.possession / total * 100), Math.round(this.teams[1].stats.possession / total * 100)],
      stats: this.teams.map((t) => ({ ...t.stats, possession: undefined })),
      user: u ? { ...u.stats } : null,
      goals: this.goalLog.map((g) => ({ ...g, scorerName: g.scorer != null ? this.players[g.scorer].name : null })),
      difficulty: this.difficulty,
    };
  }

  /** Snapshot for the view (positions are read directly from players/ball). */
  get status() {
    return { phase: this.phase, half: this.half, clock: this.clock, remaining: this.remaining(), score: this.teams.map((t) => t.score), restart: this.restart?.kind ?? null, stamina: this.stamina, charge: this.shootCharge, userHasBall: this.ball.owner === this.userId, userTakes: !!(this.restart && this.restart.taker === this.userId) };
  }
}
