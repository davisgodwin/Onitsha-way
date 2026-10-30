import * as THREE from 'three';
import { buildHuman, HAIR_STYLES } from '../characters/HumanRig.js';
import { CharacterAnimator } from '../characters/CharacterAnimator.js';
import { recordGame, ensureActivities } from './ActivityRecords.js';
import { openAt } from './VenueKit.js';

/** Lap of the stadium running track: a rectangle with rounded corners in stadium-local space. */
const TRACK = { hx: 60, hz: 38.5, r: 4.5 }; // between the pitch and the stands
export const TRACK_LENGTH = 2 * (2 * (TRACK.hx - TRACK.r) + 2 * (TRACK.hz - TRACK.r)) + 2 * Math.PI * TRACK.r;
const CHECKPOINTS = [[0, TRACK.hz], [TRACK.hx, 0], [0, -TRACK.hz], [-TRACK.hx, 0]]; // in order: near side, right end, far side, left end
export const JOG_HOURS = [5, 21];
const XP_PER_LAP = 8, XP_LAPS_PER_DAY = 5, MIN_LAP = 30; // world-class 400 m is ~43 s; the lap is ~390 m

/** Point on the lap at distance s (0…TRACK_LENGTH) and its direction, stadium-local. */
export function trackPoint(s) {
  const { hx, hz, r } = TRACK, sx = 2 * (hx - r), sz = 2 * (hz - r), q = Math.PI * r / 2;
  const segs = [['line', [-(hx - r), hz], [1, 0], sx], ['arc', [hx - r, hz - r], Math.PI / 2, q], ['line', [hx, hz - r], [0, -1], sz], ['arc', [hx - r, -(hz - r)], 0, q], ['line', [hx - r, -hz], [-1, 0], sx], ['arc', [-(hx - r), -(hz - r)], -Math.PI / 2, q], ['line', [-hx, -(hz - r)], [0, 1], sz], ['arc', [-(hx - r), hz - r], Math.PI, q]];
  s = ((s % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
  for (const [kind, a, b, len] of segs) {
    if (s > len) { s -= len; continue; }
    if (kind === 'line') return { x: a[0] + b[0] * s, z: a[1] + b[1] * s, dx: b[0], dz: b[1] };
    const ang = b - s / r; return { x: a[0] + Math.cos(ang) * r, z: a[1] + Math.sin(ang) * r, dx: Math.sin(ang), dz: -Math.cos(ang) };
  }
  return { x: 0, z: hz, dx: 1, dz: 0 };
}

/** Pure lap bookkeeping: pass the four checkpoints in order; a lap counts when you return to the start. */
export class LapCounter {
  constructor(now = 0) { this.next = 1; this.laps = 0; this.lapStart = now; this.best = null; this.lastLap = null; this.times = []; }
  /** p: stadium-local position; returns 'lap' | 'checkpoint' | null. */
  step(p, now) {
    const [cx, cz] = CHECKPOINTS[this.next % 4];
    if (Math.hypot(p.x - cx, p.z - cz) > 12) return null;
    if (this.next % 4 === 0) {
      const t = now - this.lapStart; this.laps++; this.lastLap = t; this.times.push(t); this.best = this.best == null ? t : Math.min(this.best, t); this.lapStart = now; this.next = 1; return 'lap';
    }
    this.next++; return 'checkpoint';
  }
}

/**
 * Jogging laps around the stadium track. Unlike the seated activities this keeps normal walking/running control:
 * start at the track, run (Shift) through the four marked checkpoints; each lap is timed. Stop by pressing E at the
 * start board again or by leaving the track. A few local joggers use the track in the cool hours.
 */
export class Jogging {
  constructor(g) { this.g = g; this.session = null; this.joggers = []; }
  setup() {
    const g = this.g, st = g.world.stadium; if (!st) return;
    this.st = st;
    this.toWorld = (x, z) => { const s = st.site; return { x: s.x + Math.cos(s.yaw) * x + Math.sin(s.yaw) * z, z: s.z - Math.sin(s.yaw) * x + Math.cos(s.yaw) * z }; };
    this.toLocal = (x, z) => { const s = st.site, dx = x - s.x, dz = z - s.z; return { x: Math.cos(s.yaw) * dx - Math.sin(s.yaw) * dz, z: Math.sin(s.yaw) * dx + Math.cos(s.yaw) * dz }; };
    // checkpoint cones and a start board
    const mat = new THREE.MeshStandardMaterial({ color: '#f2a20c' }), cone = new THREE.ConeGeometry(0.25, 0.6, 10);
    for (const [cx, cz] of CHECKPOINTS) for (const o of [-3, 3]) { const m = new THREE.Mesh(cone, mat); const horiz = Math.abs(cz) > Math.abs(cx); m.position.set(cx + (horiz ? 0 : o), 0.4, cz + (horiz ? o : 0)); st.group.add(m); }
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#1d3b2f'; x.fillRect(0, 0, 512, 128); x.fillStyle = '#ffd35a'; x.font = '800 44px Arial'; x.textAlign = 'center'; x.fillText('RUNNING TRACK · START', 256, 58); x.fillStyle = '#e6efe9'; x.font = '600 26px Arial'; x.fillText(`1 lap ≈ ${Math.round(TRACK_LENGTH)} m · 5am–9pm`, 256, 100);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const board = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), new THREE.MeshStandardMaterial({ map: t })); board.position.set(-3, 1.3, TRACK.hz + 2.4); board.rotation.y = 0; st.group.add(board);
    const start = this.toWorld(-3, TRACK.hz + 1.4); this.startSpot = start;
    g.interactions.register({ x: start.x, z: start.z, radius: 2.6, priority: 2,
      enabled: () => !!g.saveData && !g.activities?.active && !g.vehicles.driving && !g.transport.riding,
      label: () => (this.session ? 'Stop jogging and see your times' : 'Running track — start jogging laps'),
      onInteract: () => (this.session ? this.stop('Stopped at the start board') : g.openChoice(() => this.view())) });
    this.hud = document.createElement('div'); this.hud.className = 'jog-hud'; this.hud.hidden = true; document.body.appendChild(this.hud);
  }
  view() {
    const g = this.g, r = ensureActivities(g.saveData).games.jogging ?? {}, open = openAt(g.clock.minutes / 60, JOG_HOURS);
    const fmt = (s) => (s ? `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}` : '—');
    return { title: 'Stadium running track', kicker: `ABOUT ${Math.round(TRACK_LENGTH)} M A LAP · ${JOG_HOURS[0]}AM–${JOG_HOURS[1] - 12}PM`,
      text: `Run laps of the track through the four orange gates, in order (the arrow points to the next one). Hold Shift to run. Your best lap: ${fmt(r.best)} · laps run: ${r.laps ?? 0}.`,
      note: open ? `Each lap earns ${XP_PER_LAP} Fitness XP (up to ${XP_LAPS_PER_DAY} laps a day count). Running uses energy, so eat and drink.` : 'The track is closed now (5am–9pm, Onitsha time).',
      options: [{ label: 'Start jogging', primary: true, disabled: !open || (g.needs?.energy ?? 100) < 15, why: !open ? 'Closed' : 'Too tired (Energy 15+)', act: () => { g.closeChoice(); this.start(); } }, { label: 'Not now', ghost: true, act: () => g.closeChoice() }] };
  }
  start() {
    const g = this.g, id = `jogging-${Date.now().toString(36)}`;
    this.session = { id, counter: new LapCounter(performance.now() / 1000), started: performance.now() / 1000, xpLaps: 0 };
    this.hud.hidden = false; g.ui.toast('Go! Pass through the orange gates in order. Hold Shift to run.');
  }
  stop(reason = '') {
    const g = this.g, s = this.session; if (!s) return; this.session = null; this.hud.hidden = true;
    const c = s.counter; if (!c.laps) { g.ui.toast(`Jogging stopped${reason ? ` — ${reason.toLowerCase()}` : ''}. No full lap this time.`); return; }
    const rec = recordGame(g.saveData, 'jogging', s.id, { score: Math.round(c.best * 10) / 10, best: 'min' }), r = rec.record;
    r.laps = (r.laps ?? 0) + c.laps;
    const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
    g.saveGameNow();
    g.openChoice(() => ({ title: 'Jogging session', kicker: reason.toUpperCase(), text: `${c.laps} lap${c.laps > 1 ? 's' : ''} · best ${fmt(c.best)}${rec.newBest ? ' — new personal best!' : ''} · laps: ${c.times.map(fmt).join(', ')}`,
      note: `Fitness XP earned: ${s.xpLaps * XP_PER_LAP}. All-time laps: ${r.laps}.`, options: [{ label: 'OK', primary: true, act: () => g.closeChoice() }] }));
  }
  update(dt) {
    const g = this.g; if (!this.st) return;
    this.updateJoggers(dt);
    const s = this.session; if (!s) return;
    if (g.state !== 'playing' && g.state !== 'overlay') return;
    if (g.vehicles.driving || g.transport.riding || g.activities?.active) { this.stop('You left the track'); return; }
    const p = this.toLocal(g.player.position.x, g.player.position.z), now = performance.now() / 1000;
    if (Math.abs(p.x) > TRACK.hx + 25 || Math.abs(p.z) > TRACK.hz + 25) { this.stop('You left the stadium'); return; }
    // laps must follow the track: cutting across the pitch voids the lap in progress
    if (Math.abs(p.x) < TRACK.hx - 9 && Math.abs(p.z) < TRACK.hz - 9 && !s.counter.cut) { s.counter.cut = true; g.ui.toast('Stay on the track — this lap will not count'); }
    const ev = s.counter.step(p, now);
    if (ev === 'lap' && (s.counter.cut || s.counter.lastLap < MIN_LAP)) {
      const c = s.counter; c.laps--; c.times.pop(); c.best = c.times.length ? Math.min(...c.times) : null; c.cut = false;
      g.ui.toast(c.lastLap < MIN_LAP ? 'That lap was impossibly fast — not counted' : 'Lap not counted (you left the track). Next lap starts now.');
    } else if (ev === 'lap') {
      const c = s.counter, day = g.clock.day, rec = ensureActivities(g.saveData).games.jogging ??= { played: 0, finished: [] }, dayKey = `d${day}`;
      rec.daily ??= {}; const done = rec.daily[dayKey] ?? 0;
      if (done < XP_LAPS_PER_DAY) { rec.daily[dayKey] = done + 1; g.skills?.add('fitness', XP_PER_LAP); s.xpLaps++; }
      for (const k of Object.keys(rec.daily)) if (k !== dayKey) delete rec.daily[k];
      g.needs?.adjust({ hygiene: -4, fun: 3 }); g.saveGame();
      g.ui.toast(`Lap ${c.laps}: ${c.lastLap.toFixed(1)} s${c.best === c.lastLap && c.laps > 1 ? ' — best lap!' : ''}${done < XP_LAPS_PER_DAY ? ` · +${XP_PER_LAP} Fitness XP` : ''}`);
    }
    const c = s.counter, [nx, nz] = CHECKPOINTS[c.next % 4], ang = Math.atan2(nx - p.x, nz - p.z) * 180 / Math.PI, t = now - c.lapStart;
    this.hud.replaceChildren(document.createTextNode(`Lap ${c.laps + 1} · ${t.toFixed(1)} s${c.best ? ` · best ${c.best.toFixed(1)} s` : ''}`));
    const small = document.createElement('small'); small.textContent = `Next gate ${c.next % 4 === 0 ? 'START' : c.next}/4 · ${Math.round(Math.hypot(nx - p.x, nz - p.z))} m · E at the start board to stop`; this.hud.appendChild(small);
  }
  /** Morning and evening joggers on the track while the player is nearby. */
  updateJoggers(dt) {
    const g = this.g, h = g.clock.minutes / 60, active = (h >= 6 && h < 9) || (h >= 16 && h < 19);
    const near = Math.hypot(g.player.position.x - this.st.site.x, g.player.position.z - this.st.site.z) < 220;
    if (!(active && near)) { if (this.joggers.length) { for (const j of this.joggers) { j.h.group.parent?.remove(j.h.group); j.h.dispose?.(); } this.joggers = []; } return; }
    if (!this.joggers.length) for (let i = 0; i < 3; i++) {
      const gender = i === 1 ? 'female' : 'male', h2 = buildHuman({ gender, ageGroup: 'adult', skin: (i * 2) % 5, hair: HAIR_STYLES[gender][i % 3].id, outfit: 'tracksuit', color: [3, 1, 7][i], bottomColor: 11 });
      this.st.group.add(h2.group); this.joggers.push({ h: h2, anim: new CharacterAnimator(h2, { runSpeed: 3.6 }), s: i * TRACK_LENGTH / 3, v: 3.0 + i * 0.35, lane: 1 + i * 0.9 });
    }
    for (const j of this.joggers) {
      j.s += j.v * dt; const p = trackPoint(j.s);
      j.h.group.position.set(p.x - p.dz * j.lane, 0.05, p.z + p.dx * j.lane); j.h.group.rotation.y = Math.atan2(p.dx, p.dz);
      j.anim.update(dt, { speed: j.v, grounded: true, turnRate: 0 });
    }
  }
  places() { return this.startSpot ? [{ x: this.startSpot.x, z: this.startSpot.z, kind: 'venue', label: 'Stadium running track' }] : []; }
}
