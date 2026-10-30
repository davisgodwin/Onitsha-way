import * as THREE from 'three';
import { VenueSite, openAt } from '../VenueKit.js';
import { HOOP, SPOTS, sweetSpot, ShootoutRound } from './Basketball.js';
import { SportSounds } from '../../audio/SportSounds.js';
import { recordGame, ensureActivities } from '../ActivityRecords.js';

export const COURT_HOURS = [6, 21];
const METER_SPAN = 0.25; // the meter covers ±0.125 power around each spot's ideal release

/**
 * Public half-court near CKC: concrete, painted lines, one hoop. "60-second shootout": pick spots around the arc,
 * hold to charge and release on the green; the ball flies with real physics (rim, backboard, net).
 */
export class BasketballCourt {
  constructor(g) { this.g = g; }
  setup() {
    const g = this.g, l = g.world.landmarks.get('ckc') ?? g.world.landmarks.get('basilica');
    const s = this.site = new VenueSite(g, 'ckc-court', { x: l.x + 40, z: l.z + 30 }, { w: 16, d: 13 });
    // the court: hoop at the back (local z = −12.3), shooting area towards the street
    const f = this.frame = new THREE.Group(); f.position.set(0, 0, -12.3); s.group.add(f);
    s.box(16, 0.1, 13, 0, 0.05, -6.5, '#8f9295');
    const line = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), s.mat('#f2f2ea')); m.position.set(x, 0.106, z); f.add(m); };
    line(4.9, 0.06, 0, 5.8 + HOOP.rimZ - 0.4); for (const x of [-2.45, 2.45]) line(0.06, 5.8, x, 2.9); line(15, 0.06, 0, 0.06);
    const arc = new THREE.Mesh(new THREE.RingGeometry(HOOP.arc - 0.03, HOOP.arc + 0.03, 64, 1, 0, Math.PI), s.mat('#f2f2ea', { side: THREE.DoubleSide })); arc.rotation.x = Math.PI / 2; arc.position.set(0, 0.107, HOOP.rimZ); f.add(arc);
    for (const sp of SPOTS) { const dot = new THREE.Mesh(new THREE.CircleGeometry(0.22, 16), s.mat(sp.points === 3 ? '#e8742a' : '#1f4fbf')); dot.rotation.x = -Math.PI / 2; dot.position.set(sp.x, 0.11, sp.z); f.add(dot); }
    // hoop: pole, board, rim, net
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.4, 10), s.mat('#3a4a5a')); pole.position.set(0, 1.7, -0.9); f.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.9), s.mat('#3a4a5a')); arm.position.set(0, 3.3, -0.45); f.add(arm);
    const board = new THREE.Mesh(new THREE.BoxGeometry(HOOP.boardHalfW * 2, HOOP.boardTop - HOOP.boardBottom, 0.04), s.mat('#f4f7f8', { transparent: true, opacity: 0.85 })); board.position.set(0, (HOOP.boardTop + HOOP.boardBottom) / 2, -0.02); f.add(board);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.59, 0.45, 0.01), s.mat('#c8322b')); box.position.set(0, HOOP.rimY + 0.25, 0.005); f.add(box);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(HOOP.rimR, 0.012, 8, 32), s.mat('#e8742a', { metalness: 0.4 })); rim.rotation.x = Math.PI / 2; rim.position.set(0, HOOP.rimY, HOOP.rimZ); f.add(rim);
    const net = new THREE.Mesh(new THREE.CylinderGeometry(HOOP.rimR, HOOP.rimR * 0.65, 0.42, 12, 3, true), new THREE.MeshBasicMaterial({ color: '#ffffff', wireframe: true, transparent: true, opacity: 0.8 })); net.position.set(0, HOOP.rimY - 0.21, HOOP.rimZ); f.add(net); this.net = net;
    const p = s.at(0, -13.2); g.world.collision.addCircle(p.x, p.z, 0.2);
    // benches and players hanging out
    for (const u of [-6.5, 6.5]) s.box(0.45, 0.45, 2.2, u, 0.23, -4, '#6e4a2f', true);
    s.person(0, -6.5, -4.4, Math.PI / 2, { name: 'Ebube', activity: 'drink', seatY: 0.45, schedule: [15, 20] });
    s.person(1, 6.5, -3.6, -Math.PI / 2, { name: 'Chidera', gender: 'female', activity: 'drink', seatY: 0.45, schedule: [15, 20] });
    s.sign('CKC COMMUNITY COURT · OPEN 6AM–9PM', 6, 0.5, 0, 1.2, -0.2, '#1f4fbf', '#ffffff');
    for (const u of [-3.1, 3.1]) s.box(0.08, 1.4, 0.08, u, 0.7, -0.2, '#555');
    s.interact(0, -5.0, () => 'Basketball — 60-second shootout', () => g.openChoice(() => this.view()), { radius: 3 });
    this.spots = SPOTS.map((sp) => ({ ...sp, sweet: sweetSpot(sp) }));
  }
  /** Court (frame) coordinates → world. */
  toWorld(x, y, z) { this.frame.updateMatrixWorld(true); return this.frame.localToWorld(new THREE.Vector3(x, y, z)); }
  open() { return openAt(this.g.clock.minutes / 60, COURT_HOURS); }
  view() {
    const g = this.g, r = ensureActivities(g.saveData).games.basketball ?? { best: 0, played: 0 };
    const why = !this.open() ? 'The court is open 6am–9pm (Onitsha time).' : (g.needs?.energy ?? 100) < 15 ? 'You are too tired to play (Energy 15+).' : g.activities.blocked();
    return { title: 'CKC Community Court', kicker: 'BASKETBALL · FREE TO PLAY',
      text: `60 seconds. Shoot from the marked spots: blue = 2 points, orange = 3 points. Hold to charge, release on the green. Your best: ${r.best || 0} points (${r.played ?? 0} rounds).`,
      note: why ?? 'Earns Fitness XP. Your best score is saved.',
      options: [{ label: 'Start the clock', primary: true, disabled: !!why, why: why ?? '', act: () => this.start() }, { label: 'Not now', ghost: true, act: () => g.closeChoice() }] };
  }
  start() { if (!this.open()) { this.g.ui.toast('The court is closed.'); return false; } return this.g.activities.start(new ShootoutActivity(this.g, this)); }
  places() { return this.site ? [{ ...this.site.at(0, -0.8), kind: 'venue', label: 'CKC Community Court' }] : []; }
}

export class ShootoutActivity {
  constructor(g, court) {
    Object.assign(this, { g, court, kind: 'basketball', title: 'Basketball shootout' });
    this.spot = 0; this.charge = 0; this.dir = 1; this.charging = false; this.flight = null; this.recorded = null;
    this.controls = { desktop: 'A/D change spot · hold Space to charge, release on the green · Esc pause', touchHint: 'Hold Shoot, release on the green',
      desktopHelp: 'A/D or ←/→ moves to another marked spot. Hold Space: the meter rises and falls; release in the green zone. Blue spots score 2, orange spots 3. Release too early or late and the shot falls short, goes long or drifts.',
      touchHelp: '◀ ▶ move to another marked spot. Hold Shoot: the meter rises and falls; release in the green zone. Blue spots score 2, orange 3.',
      touch: [{ act: 'left', label: '◀' }, { act: 'right', label: '▶' }, { act: 'shoot', label: 'Shoot' }] };
  }
  begin(mgr) {
    const g = this.g; this.mgr = mgr; this.round = new ShootoutRound({ seconds: 60, seed: (Math.random() * 1e9) | 0 }); this.sounds = new SportSounds(g.audio);
    const tex = (() => { const c = document.createElement('canvas'); c.width = 128; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#d9662a'; x.fillRect(0, 0, 128, 64); x.strokeStyle = '#2a140a'; x.lineWidth = 3; for (const y of [32]) { x.beginPath(); x.moveTo(0, y); x.lineTo(128, y); x.stroke(); } for (const xx of [32, 96]) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, 64); x.stroke(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 })); this.ball.castShadow = true; this.court.frame.add(this.ball);
    // a meter marker for the green zone
    const meter = mgr.slots.meter; this.zone = document.createElement('b'); this.zone.className = 'act-meter-zone'; meter.appendChild(this.zone);
    this.goSpot(0, true); this.status();
  }
  goSpot(i, snap = false) {
    this.spot = (i + SPOTS.length) % SPOTS.length; const sp = this.court.spots[this.spot], g = this.g;
    const w = this.court.toWorld(sp.x, 0, sp.z + 0.35), face = this.court.toWorld(0, 0, HOOP.rimZ);
    g.player.teleport(w.x, w.z, Math.atan2(face.x - w.x, face.z - w.z));
    this.ballHome();
    const half = (sp.sweet.window / METER_SPAN + 0.035); this.zone.style.left = `${(0.5 - half) * 100}%`; this.zone.style.width = `${half * 200}%`;
    this.mgr.setStatus(`${sp.label} · ${sp.points} points`); this.statusT = 1.4;
    if (snap) this.camera(1, true);
  }
  ballHome() { const sp = this.court.spots[this.spot]; this.ball.position.set(sp.x + 0.25, 1.15, sp.z + 0.1); }
  update(dt) {
    const mgr = this.mgr, r = this.round, held = mgr.held('shoot', 'Space');
    r.tick(dt);
    if (!this.flight && !r.over) {
      if (mgr.pressed('act:left') || this.edge('KeyA') || this.edge('ArrowLeft')) this.goSpot(this.spot - 1);
      if (mgr.pressed('act:right') || this.edge('KeyD') || this.edge('ArrowRight')) this.goSpot(this.spot + 1);
      if (held) { this.charging = true; this.charge += this.dir * dt / 0.9; if (this.charge >= 1) { this.charge = 1; this.dir = -1; } if (this.charge <= 0) { this.charge = 0; this.dir = 1; } }
      else if (this.charging) { this.charging = false; this.release(); }
    }
    if (this.flight) {
      this.flight.t += dt * 60; const i = Math.min(this.flight.path.length - 1, Math.floor(this.flight.t)), p = this.flight.path[i];
      this.ball.position.set(p[0], p[1], p[2]); this.ball.rotation.x -= dt * 9;
      if (!this.flight.netDone && this.flight.res.made && p[1] < HOOP.rimY - 0.1 && Math.hypot(p[0], p[2] - HOOP.rimZ) < 0.3) { this.flight.netDone = true; this.sounds.bounce(0.2, 3); this.net.scale.y = 1.25; }
      if (i >= this.flight.path.length - 1 || this.flight.t > 140) { this.flight = null; this.ballHome(); }
    }
    this.court.net.scale.y += (1 - this.court.net.scale.y) * Math.min(1, dt * 6);
    this.mgr.setMeter(this.charging ? Math.max(0.02, this.charge) : 0);
    if (this.statusT > 0) this.statusT -= dt; else this.status();
    this.hud(); this.g.player.idle(dt); this.pose(); this.camera(dt);
    if (r.over && !this.flight && !this.recorded) this.finish();
    mgr.pressed('jump', 'primary', 'act:shoot');
  }
  get net() { return this.court.net; }
  edge(code) { const k = this.g.input.keys.has(code), was = (this._k ??= {})[code]; this._k[code] = k; return k && !was; }
  release() {
    const sp = this.court.spots[this.spot], power = sp.sweet.power + (this.charge - 0.5) * METER_SPAN;
    const res = this.round.shoot(sp, power, sp.sweet); this.flight = { res, path: res.path, t: 0 };
    this.sounds.kick(0.15, 4);
    const off = this.charge - 0.5, zone = sp.sweet.window / METER_SPAN + 0.035;
    this.mgr.setStatus(res.made ? (res.rim ? `Rattled in! +${sp.points}` : `Swish! +${sp.points}`) : Math.abs(off) <= zone ? 'Unlucky — off the rim' : off < 0 ? 'Short — release a bit later' : 'Long — release a bit earlier'); this.statusT = 1.6;
    if (res.made) setTimeout(() => this.sounds.cheer(0.25, false), 700);
    this.charge = 0; this.dir = 1;
  }
  pose() { if (!this.charging) return; const b = this.g.player.human?.bones; if (!b) return; const k = 0.6 + this.charge * 0.4; b['upperArm.L'].rotation.set(-2.6 * k, 0, 0.25); b['upperArm.R'].rotation.set(-2.6 * k, 0, -0.25); b['foreArm.L'].rotation.x = -0.9; b['foreArm.R'].rotation.x = -0.9; }
  status() { this.mgr.setStatus(this.round.over ? 'Time!' : `${this.court.spots[this.spot].label} · hold to shoot`); }
  hud() {
    const r = this.round, key = `${r.score}|${Math.ceil(r.time)}|${r.makes}/${r.shots}`; if (key === this.lastKey) return; this.lastKey = key;
    const span = (cls, t) => { const e = document.createElement('span'); e.className = cls; e.textContent = t; return e; };
    this.mgr.setScore([span('team home', `Makes ${r.makes}/${r.shots}`), span('goals', `${r.score} pts`), span('clock', `0:${String(Math.ceil(r.time)).padStart(2, '0')}`)]);
  }
  camera(dt, snap = false) {
    const sp = this.court.spots[this.spot], dx = sp.x, dz = sp.z - HOOP.rimZ, d = Math.hypot(dx, dz) || 1;
    const pos = this.court.toWorld(sp.x + dx / d * 2.6 + 0.6, 2.4, sp.z + dz / d * 2.6), look = this.court.toWorld(0, 2.6, HOOP.rimZ);
    this.camPos ??= pos.clone(); this.camLook ??= look.clone(); const k = snap ? 1 : 1 - Math.exp(-dt * 5);
    this.camPos.lerp(pos, k); this.camLook.lerp(look, k); const cam = this.g.renderer.camera; cam.position.copy(this.camPos); cam.lookAt(this.camLook);
  }
  idle() {}
  onPause(on) { this.paused = on; }
  finish() {
    const g = this.g, r = this.round, mgr = this.mgr, rec = recordGame(g.saveData, 'basketball', mgr.matchId, { score: r.score }); this.recorded = rec;
    if (rec.ok && !rec.duplicate) { g.skills?.add('fitness', 10 + Math.min(10, r.makes)); g.needs?.adjust({ energy: -8, hygiene: -6, fun: 12 }); mgr.finished(); g.saveGameNow(); }
    mgr.panel({ kicker: '60-SECOND SHOOTOUT', title: `${r.score} points`, text: rec.newBest ? 'New personal best!' : `Your best: ${rec.record?.best ?? r.score} points.`,
      lines: [{ label: 'Makes', value: `${r.makes} of ${r.shots}` }, { label: 'Best streak', value: String(r.bestStreak) }, { label: 'Reward', value: rec.duplicate ? 'Already recorded' : `+${10 + Math.min(10, r.makes)} Fitness XP` }],
      buttons: [{ label: 'Go again', primary: true, act: () => { const c = this.court; mgr.end(); c.start(); } }, { label: 'Leave the court', act: () => mgr.end() }] });
  }
  pauseText() { return `${this.round.score} points with ${Math.ceil(this.round.time)} seconds left. Leaving now records no score.`; }
  focus() { return this.court.site.at(0, -6); }
  end() { this.ball?.parent?.remove(this.ball); this.ball?.geometry.dispose(); this.zone?.remove(); }
}
