/**
 * Basketball shooting: ball flight with gravity, backboard and rim collisions, and a make detected when the ball
 * drops through the ring. Pure JavaScript, tested in Node.
 *
 * Court space: backboard face at z = 0 (x across, y up), the shooter stands at z > 0.
 */
export const HOOP = { rimY: 3.05, rimR: 0.2286, rimZ: 0.15 + 0.2286, tube: 0.012, ballR: 0.12, boardHalfW: 0.915, boardBottom: 2.9, boardTop: 3.95, arc: 6.75 };
export const SPOTS = [
  { id: 'ft', label: 'Free-throw line', x: 0, z: 4.6 + HOOP.rimZ, points: 2 },
  { id: 'lw', label: 'Left wing', x: -3.6, z: 3.2 + HOOP.rimZ, points: 2 },
  { id: 'rw', label: 'Right wing', x: 3.6, z: 3.2 + HOOP.rimZ, points: 2 },
  { id: 'lc', label: 'Left corner three', x: -6.65, z: 1.2, points: 3 },
  { id: 'top', label: 'Top of the key three', x: 0, z: 7.25 + HOOP.rimZ, points: 3 },
  { id: 'rc', label: 'Right corner three', x: 6.65, z: 1.2, points: 3 },
];
const G = 9.81, ANGLE = 52 * Math.PI / 180, RELEASE_Y = 2.25, VMIN = 5, VMAX = 11.5;
export const speedFor = (power) => VMIN + (VMAX - VMIN) * Math.max(0, Math.min(1, power));

/**
 * Simulate one shot from (x, z). `aimError` (radians) rotates the aim sideways. Returns
 * { made, rim, board, path: [[x,y,z]…] at 60 Hz until the ball settles or 3.5 s pass }.
 */
export function simulateShot(x, z, power, aimError = 0) {
  const tx = 0, tz = HOOP.rimZ, dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz) || 1;
  const yaw = Math.atan2(dz, dx) + aimError, v = speedFor(power), vh = v * Math.cos(ANGLE);
  const b = { x: x + dx / d * 0.3, y: RELEASE_Y, z: z + dz / d * 0.3, vx: Math.cos(yaw) * vh, vy: v * Math.sin(ANGLE), vz: Math.sin(yaw) * vh };
  const out = { made: false, rim: 0, board: false, path: [] }, h = 1 / 480; let t = 0, sample = 0, aboveRim = b.y > HOOP.rimY;
  while (t < 3.5) {
    b.vy -= G * h; b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h; t += h;
    // backboard
    if (b.z - HOOP.ballR < 0 && b.vz < 0 && Math.abs(b.x) < HOOP.boardHalfW && b.y > HOOP.boardBottom && b.y < HOOP.boardTop) { b.z = HOOP.ballR; b.vz = -b.vz * 0.62; b.vx *= 0.9; b.vy *= 0.9; out.board = true; }
    // rim (a torus around the ring centre)
    const rx = b.x, rz = b.z - HOOP.rimZ, hr = Math.hypot(rx, rz) || 1e-6;
    const qx = rx / hr * HOOP.rimR, qz = rz / hr * HOOP.rimR, nx = rx - qx, ny = b.y - HOOP.rimY, nz = rz - qz, nd = Math.hypot(nx, ny, nz);
    if (nd < HOOP.ballR + HOOP.tube) {
      const ux = nx / nd, uy = ny / nd, uz = nz / nd, vn = b.vx * ux + b.vy * uy + b.vz * uz;
      if (vn < 0) { const k = 1.55 * vn; b.vx -= k * ux; b.vy -= k * uy; b.vz -= k * uz; b.vx *= 0.92; b.vz *= 0.92; out.rim++; }
      const push = HOOP.ballR + HOOP.tube - nd; b.x += ux * push; b.y += uy * push; b.z += uz * push;
    }
    // through the ring, downwards
    const nowAbove = b.y > HOOP.rimY;
    if (aboveRim && !nowAbove && b.vy < 0 && hr < HOOP.rimR - HOOP.ballR * 0.25) out.made = true;
    aboveRim = nowAbove;
    // floor
    if (b.y < HOOP.ballR) { b.y = HOOP.ballR; if (b.vy < 0) b.vy = -b.vy * 0.62; b.vx *= 0.85; b.vz *= 0.85; }
    if ((t - sample) >= 1 / 60) { sample = t; out.path.push([b.x, b.y, b.z]); }
    if (out.made && t > 0.4 && b.y < 1.2) break;
  }
  return out;
}

/** Best release power for a spot: the middle of the widest band of makes (searched with the physics). */
export function sweetSpot(spot) {
  let best = null, run = null;
  for (let p = 0; p <= 1.0001; p += 0.004) {
    const made = simulateShot(spot.x, spot.z, p).made;
    if (made) { if (!run) run = { a: p, b: p }; else run.b = p; }
    if ((!made || p >= 1) && run) { if (!best || run.b - run.a > best.b - best.a) best = run; run = null; }
  }
  return best ? { power: (best.a + best.b) / 2, window: Math.max(0.006, (best.b - best.a) / 2) } : { power: 0.5, window: 0.01 };
}

/** A timed "around the court" round: shots from any spot, 2 or 3 points per make. */
export class ShootoutRound {
  constructor({ seconds = 60, seed = 1 } = {}) {
    this.time = seconds; this.score = 0; this.shots = 0; this.makes = 0; this.streak = 0; this.bestStreak = 0; this.over = false;
    let s = seed >>> 0 || 5; this.rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }
  tick(dt) { if (this.over) return; this.time = Math.max(0, this.time - dt); if (this.time <= 0) this.over = true; }
  /** Release at `power` from `spot`; sideways error grows with distance from the sweet spot. */
  shoot(spot, power, sweet) {
    const off = power - sweet.power, sideways = (this.rand() - 0.5) * 0.012 + Math.sign(this.rand() - 0.5) * Math.max(0, Math.abs(off) - sweet.window) * 0.12;
    const r = simulateShot(spot.x, spot.z, power, sideways); this.shots++;
    if (r.made) { this.makes++; this.score += spot.points; this.streak++; this.bestStreak = Math.max(this.bestStreak, this.streak); } else this.streak = 0;
    return r;
  }
}
