import * as THREE from 'three';
import { PoolGame, TABLE, groupOf } from './PoolGame.js';
import { BED_Y, syncBalls } from './PoolTable3D.js';
import { SportSounds } from '../../audio/SportSounds.js';
import { recordPool, POOL_ACHIEVEMENTS } from '../ActivityRecords.js';
import { naira } from '../../economy/Economy.js';

const groupLabel = (g) => (g === 'solids' ? 'Solids 1–7' : g === 'stripes' ? 'Stripes 9–15' : 'Open table');

/**
 * 8-ball pool at the parlour table. Rules, physics and AI are in PoolGame; this class handles controls,
 * camera, cue and aiming guide, the stake (taken once, at the start) and the payout (once, on a win).
 */
export class PoolActivity {
  constructor(g, venue, { opponent, difficulty = 'normal', stake = 0, payout = 0 }) {
    Object.assign(this, { g, venue, opponent, difficulty, stake, payout, kind: 'pool', title: '8-ball pool' });
    this.aim = 0; this.power = 0.45; this.view = 'aim'; this.aiT = 0; this.aiPlan = null; this.recorded = null; this.statusT = 0;
    this.controls = {
      desktop: 'A/D or ←/→ aim (Shift = fine) · drag mouse to aim · W/S power · Space shoot · C view · Esc pause',
      touchHint: 'Hold ◀ ▶ to aim, − + for power',
      desktopHelp: 'Aim: A/D or ←/→ (hold Shift for fine aiming), or click and drag the mouse left/right.\nPower: W/S or ↑/↓ — the bar shows it.\nShoot: Space.\nBall in hand: move the white ball with WASD, Space to place it.\nView: C switches between the cue view and the table view.\nThe dotted line shows where the white ball goes and which way the ball it hits will travel.',
      touchHelp: 'Aim: hold ◀ or ▶ (Fine slows it down).\nPower: hold − or +.\nShoot: tap Shoot.\nBall in hand: move the white ball with the joystick, then tap Shoot to place it.\nView: switches between the cue view and the table view.',
      touch: [{ act: 'left', label: '◀' }, { act: 'right', label: '▶' }, { act: 'down', label: '−' }, { act: 'up', label: '+' }, { act: 'fine', label: 'Fine', toggle: true }, { act: 'view', label: 'View' }, { act: 'shoot', label: 'Shoot' }],
    };
  }

  begin(mgr) {
    const g = this.g; this.mgr = mgr;
    if (this.stake > 0) {
      const tx = g.economy.transact({ key: `pool:stake:${mgr.matchId}`, amount: -this.stake, reason: `Pool stake v ${this.opponent.name} (${this.venue.name})` });
      if (!tx.ok) throw new Error('Could not pay the stake');
    }
    this.game = new PoolGame({ seed: (Math.random() * 4294967295) >>> 0, difficulty: this.difficulty, names: ['You', this.opponent.name], aiPlayers: [1] });
    this.table = this.venue.table; this.meshes = this.table.balls; this.tg = this.table.group;
    this.last = this.game.balls.map((b) => ({ x: b.x, z: b.z })); syncBalls(this.meshes, this.game);
    this.placeAt = { x: this.game.cue.x, z: this.game.cue.z };
    // cue stick, aiming line, ghost ball
    const cue = new THREE.Group(); const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.013, 1.45, 10), new THREE.MeshStandardMaterial({ color: '#c79a63', roughness: 0.5 }));
    stick.rotation.z = Math.PI / 2; stick.position.x = -0.725 - 0.04; cue.add(stick);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.02, 8), new THREE.MeshStandardMaterial({ color: '#3a6bb0' })); tip.rotation.z = Math.PI / 2; tip.position.x = -0.04; cue.add(tip);
    this.cueStick = cue; this.tg.add(cue);
    const lineMat = new THREE.LineDashedMaterial({ color: '#fff7de', dashSize: 0.025, gapSize: 0.018, transparent: true, opacity: 0.85 });
    this.aimLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat); this.tg.add(this.aimLine);
    this.objLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#ffd35a' })); this.tg.add(this.objLine);
    this.ghost = new THREE.Mesh(new THREE.RingGeometry(TABLE.R * 0.85, TABLE.R, 24), new THREE.MeshBasicMaterial({ color: '#fff7de', side: THREE.DoubleSide, transparent: true, opacity: 0.8 })); this.ghost.rotation.x = -Math.PI / 2; this.tg.add(this.ghost);
    this.lamp = new THREE.PointLight('#fff1d0', 6, 4, 2); this.lamp.position.set(0, BED_Y + 1.1, 0); this.tg.add(this.lamp);
    g.player.human.group.visible = false;
    this.sounds = new SportSounds(g.audio);
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3(); this.camera(1, true);
    this.say(this.stake ? `Stake ${naira(this.stake)} paid · Your break` : 'Your break — place the white ball behind the line', 3);
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, game = this.game, mgr = this.mgr, input = g.input;
    if (mgr.pressed('camera', 'act:view')) this.view = this.view === 'aim' ? 'top' : 'aim';
    const mine = game.turn === 0 && game.winner == null;
    if (game.phase === 'place' && mine) this.placeControls(dt);
    else if (game.phase === 'aim' && mine) this.aimControls(dt);
    else if ((game.phase === 'aim' || game.phase === 'place') && !mine) this.aiTurn(dt);
    if (game.phase === 'moving') game.update(dt);
    for (const e of game.drainEvents()) this.onEvent(e);
    if (game.phase === 'over' && !this.recorded) this.finish();
    mgr.pressed('jump', 'act:shoot', 'primary', 'act:left', 'act:right', 'act:up', 'act:down');
    this.sync(dt);
  }
  idle() { this.sync(0); }

  placeControls(dt) {
    const game = this.game, mv = this.g.input.getMove(), sp = 0.55 * dt;
    // table view: screen right = +x, up = −z
    const nx = this.placeAt.x + mv.x * sp, nz = this.placeAt.z - mv.y * sp;
    const lim = game.ballInHand === 'kitchen' ? -TABLE.L / 4 : TABLE.L / 2 - TABLE.R;
    this.placeAt.x = Math.max(-TABLE.L / 2 + TABLE.R, Math.min(lim, nx)); this.placeAt.z = Math.max(-TABLE.W / 2 + TABLE.R, Math.min(TABLE.W / 2 - TABLE.R, nz));
    Object.assign(game.cue, { x: this.placeAt.x, z: this.placeAt.z, pocketed: false });
    const ok = game.canPlace(this.placeAt.x, this.placeAt.z); this.meshes[0].material.opacity = ok ? 1 : 0.45; this.meshes[0].material.transparent = !ok;
    this.mgr.setStatus(game.ballInHand === 'kitchen' ? 'Ball in hand behind the line — move it, then Space / Shoot' : 'Ball in hand — move the white ball, then Space / Shoot'); this.statusT = 0.2;
    if (this.mgr.pressed('jump', 'act:shoot')) {
      if (ok) { game.place(this.placeAt.x, this.placeAt.z); this.meshes[0].material.transparent = false; this.meshes[0].material.opacity = 1; this.aimAtTarget(); }
      else this.say("Can't place it there", 1.2);
    }
  }

  aimControls(dt) {
    const mgr = this.mgr, input = this.g.input, fine = mgr.held('fine', 'ShiftLeft', 'ShiftRight') || !!mgr.hold.fine;
    const rate = fine ? 0.1 : 0.85, look = input.consumeLook();
    let turn = 0; if (mgr.held('left', 'KeyA', 'ArrowLeft')) turn -= 1; if (mgr.held('right', 'KeyD', 'ArrowRight')) turn += 1;
    // in the cue view, turning "right" swings the shot to the right as seen from behind the cue
    this.aim += turn * rate * dt + look.dx * (fine ? 0.0006 : 0.0025);
    if (mgr.held('up', 'KeyW', 'ArrowUp')) this.power = Math.min(1, this.power + 0.6 * dt);
    if (mgr.held('down', 'KeyS', 'ArrowDown')) this.power = Math.max(0.05, this.power - 0.6 * dt);
    if (this.statusT <= 0) this.mgr.setStatus(this.turnText());
    if (mgr.pressed('jump', 'act:shoot')) this.game.shoot(this.aim, this.power);
  }

  aiTurn(dt) {
    const game = this.game;
    if (!this.aiPlan) {
      this.aiT += dt; if (this.statusT <= 0) this.mgr.setStatus(`${this.opponent.name} is lining up a shot…`);
      if (this.aiT < 0.9) return;
      this.aiPlan = game.plan(); this.aiT = 0; this.aimFrom = this.aim;
      if (game.phase === 'place' && this.aiPlan.place) game.place(this.aiPlan.place.x, this.aiPlan.place.z);
      return;
    }
    this.aiT += dt; const k = Math.min(1, this.aiT / 0.9);
    let d = this.aiPlan.angle - this.aimFrom; d = Math.atan2(Math.sin(d), Math.cos(d)); this.aim = this.aimFrom + d * (1 - (1 - k) ** 3);
    this.power = this.aiPlan.power;
    if (this.aiT > 1.3) { game.shoot(this.aiPlan.angle, this.aiPlan.power); this.aiPlan = null; this.aiT = 0; }
  }

  aimAtTarget() { const t = this.game.targets().map((n) => this.game.ball(n)).sort((a, b) => Math.hypot(a.x - this.game.cue.x, a.z - this.game.cue.z) - Math.hypot(b.x - this.game.cue.x, b.z - this.game.cue.z))[0]; if (t) this.aim = Math.atan2(t.z - this.game.cue.z, t.x - this.game.cue.x); }

  turnText() {
    const game = this.game, g0 = game.groups[0];
    if (game.isBreak) return 'Your break — W/S power, Space to shoot';
    const t = game.targets(0); return t.length === 1 && t[0] === 8 ? 'Your shot — pot the 8 to win' : `Your shot — ${g0 ? groupLabel(g0).toLowerCase() : 'open table: any ball but the 8'}`;
  }

  onEvent(e) {
    const s = this.sounds, game = this.game, who = (p) => (p === 0 ? 'You' : this.opponent.name);
    switch (e.type) {
      case 'cue': s.kick(0.15 + e.power * 0.3, 2); break;
      case 'click': s.click(Math.min(1, e.speed / 4)); break;
      case 'rail': if (e.speed > 0.4) s.bounce(Math.min(0.6, e.speed / 8), 3); break;
      case 'pot': s.pocket(); break;
      case 'foul': this.say(`Foul by ${who(e.player)}: ${e.reason}. ${e.player === 0 ? `${this.opponent.name} has ball in hand` : 'Ball in hand — place the white ball'}`, 3.2); this.placeAt = { x: game.cue.x, z: game.cue.z }; break;
      case 'groups': this.say(`${who(e.player)} ${e.player === 0 ? 'are' : 'is'} on ${groupLabel(e.group).toLowerCase()}`, 2.4); break;
      case 'turn': if (e.player === 0) { this.aimAtTarget(); this.say('Your shot', 1.4); } break;
      case 'continue': if (e.player === 0) { this.aimAtTarget(); this.say('Good pot — shoot again', 1.4); } break;
      case 'respot': this.say('8 on the break — re-spotted', 2); break;
    }
  }
  say(text, secs = 1.6) { this.mgr.setStatus(text); this.statusT = secs; }

  sync(dt) {
    const game = this.game;
    if (this.statusT > 0) this.statusT -= dt;
    syncBalls(this.meshes, game, this.last); this.last = game.balls.map((b) => ({ x: b.x, z: b.z }));
    const aiming = (game.phase === 'aim') && game.winner == null, c = game.cue;
    // cue stick behind the white ball, pulled back with power
    this.cueStick.visible = aiming;
    if (aiming) { this.cueStick.position.set(c.x - Math.cos(this.aim) * (0.02 + this.power * 0.16), BED_Y + TABLE.R + 0.03, c.z - Math.sin(this.aim) * (0.02 + this.power * 0.16)); this.cueStick.rotation.set(0, -this.aim, -0.06); }
    // aiming guide
    const showGuide = aiming && game.turn === 0;
    this.aimLine.visible = this.ghost.visible = this.objLine.visible = false;
    if (showGuide) {
      const hit = game.aimLine(this.aim), y = BED_Y + TABLE.R * 0.3, end = hit.n == null ? hit.end : hit.ghost;
      this.aimLine.geometry.setFromPoints([new THREE.Vector3(c.x, y, c.z), new THREE.Vector3(end.x, y, end.z)]); this.aimLine.computeLineDistances(); this.aimLine.visible = true;
      if (hit.n != null) {
        this.ghost.position.set(hit.ghost.x, BED_Y + 0.002, hit.ghost.z); this.ghost.visible = true;
        const legal = game.targets(0).includes(hit.n); this.ghost.material.color.set(legal ? '#fff7de' : '#ff6a5c');
        const b = game.ball(hit.n), len = 0.12 + this.power * 0.25;
        this.objLine.geometry.setFromPoints([new THREE.Vector3(b.x, y, b.z), new THREE.Vector3(b.x + hit.objDir.x * len, y, b.z + hit.objDir.z * len)]); this.objLine.visible = true;
      }
    }
    this.mgr.setMeter(game.phase === 'aim' && game.turn === 0 ? this.power : 0);
    this.hud(); this.camera(dt);
  }

  hud() {
    const game = this.game, key = `${game.turn}|${game.groups}|${game.balls.filter((b) => b.pocketed).length}|${game.phase}`;
    if (key === this.lastHud) return; this.lastHud = key;
    const span = (cls, t) => { const e = document.createElement('span'); e.className = cls; e.textContent = t; return e; };
    const left = (p) => { const gg = game.groups[p]; return gg ? `${gg === 'solids' ? 'Solids' : 'Stripes'} · ${game.remaining(gg)} left` : 'Open'; };
    this.mgr.setScore([span(`team home${game.turn === 0 ? ' active' : ''}`, `${game.turn === 0 ? '▶ ' : ''}You · ${left(0)}`), span('goals', this.stake ? naira(this.stake) : 'Free'), span(`team away${game.turn === 1 ? ' active' : ''}`, `${game.turn === 1 ? '▶ ' : ''}${this.opponent.name} · ${left(1)}`)]);
  }

  camera(dt, snap = false) {
    const game = this.game, c = game.cue, mobile = this.g.renderer.camera.aspect < 0.9;
    let pos, look;
    const top = this.view === 'top' || game.phase === 'place' || game.phase === 'moving' || game.phase === 'over';
    if (top) { pos = new THREE.Vector3(0, BED_Y + (mobile ? 2.9 : 1.65), mobile ? 0.45 : 1.15); look = new THREE.Vector3(0, BED_Y, 0); }
    else { const back = 0.75; pos = new THREE.Vector3(c.x - Math.cos(this.aim) * back, BED_Y + 0.42, c.z - Math.sin(this.aim) * back); look = new THREE.Vector3(c.x + Math.cos(this.aim) * 0.6, BED_Y, c.z + Math.sin(this.aim) * 0.6); }
    this.tg.localToWorld(pos); this.tg.localToWorld(look);
    const k = snap ? 1 : 1 - Math.exp(-dt * (top ? 4 : 9));
    this.camPos.lerp(pos, k); this.camLook.lerp(look, k);
    const cam = this.g.renderer.camera; cam.position.copy(this.camPos); cam.lookAt(this.camLook);
  }

  pauseText() { const game = this.game; return `You: ${groupLabel(game.groups[0])} · ${this.opponent.name}: ${groupLabel(game.groups[1])}.${this.stake ? ` Leaving forfeits the game; the ${naira(this.stake)} stake is not refunded.` : ''}`; }

  finish() {
    const g = this.g, game = this.game, mgr = this.mgr, won = game.winner === 0;
    const clean = won && game.stats[0].bestRun >= 8;
    const rec = recordPool(g.saveData, mgr.matchId, { won, bestRun: game.stats[0].bestRun, cleanRun: clean, stake: this.stake, payout: this.payout, opponent: this.opponent.name, difficulty: this.difficulty, reason: game.reason, day: g.clock.day });
    this.recorded = rec;
    let paid = 0;
    if (rec.ok && !rec.duplicate) {
      if (won && this.payout > 0) { const tx = g.economy.transact({ key: `pool:win:${mgr.matchId}`, amount: this.payout, reason: `Pool winnings v ${this.opponent.name}` }); if (tx.ok) paid = this.payout; }
      g.needs?.adjust(rec.needs); mgr.finished(); g.saveGameNow();
    }
    this.sounds.cheer(won ? 0.5 : 0.25, !won);
    const st = game.stats[0], p = g.saveData.activities.pool;
    mgr.panel({ kicker: `8-BALL · ${this.difficulty.toUpperCase()}${this.stake ? ` · STAKE ${naira(this.stake)}` : ''}`, title: won ? 'You won!' : `${this.opponent.name} won`,
      text: game.reason,
      lines: [{ label: 'Your shots · balls potted · fouls', value: `${st.shots} · ${st.potted} · ${st.fouls}` }, { label: 'Best run', value: String(st.bestRun) }, { label: 'Money', value: this.stake ? (won ? `+${naira(paid)} (stake ${naira(this.stake)})` : `−${naira(this.stake)} stake`) : 'Free game' }, { label: 'Record', value: `${p.won}W ${p.lost}L` }],
      list: (rec.newAchievements ?? []).map((id) => `★ ${POOL_ACHIEVEMENTS[id].label} — ${POOL_ACHIEVEMENTS[id].note}`),
      buttons: [{ label: 'Rematch', primary: true, act: () => this.rematch() }, { label: 'Leave the table', act: () => mgr.end() }] });
  }
  rematch() { const v = this.venue, o = { ...v.poolOpts }; this.mgr.end(); v.startPool(o); }

  focus() { return this.venue.site.at(0, -4); }
  end() {
    const game = this.game;
    if (game && game.winner == null && this.mgr) { /* leaving mid-game: forfeit, no refund (stated before starting) */ game.forfeit(0); }
    for (const o of [this.cueStick, this.aimLine, this.objLine, this.ghost, this.lamp]) { if (!o) continue; o.parent?.remove(o); o.traverse?.((m) => { m.geometry?.dispose?.(); m.material?.dispose?.(); }); }
    this.meshes[0].material.transparent = false; this.meshes[0].material.opacity = 1;
    this.venue.rackIdle();
  }
}
