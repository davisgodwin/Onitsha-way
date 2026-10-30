import * as THREE from 'three';
import { FootballMatch, PITCH } from './FootballMatch.js';
import { buildHuman, HAIR_STYLES } from '../../characters/HumanRig.js';
import { CharacterAnimator } from '../../characters/CharacterAnimator.js';
import { SportSounds } from '../../audio/SportSounds.js';
import { recordFootball, FOOTBALL_ACHIEVEMENTS } from '../ActivityRecords.js';

const MEN = ['Chidi', 'Emeka', 'Obinna', 'Ikenna', 'Nnamdi', 'Tobenna', 'Uche', 'Kelechi', 'Somto', 'Ifeanyi', 'Chukwudi', 'Ebuka', 'Kosi', 'Arinze', 'Dozie', 'Nonso', 'Tochi', 'Jide', 'Femi', 'Musa'];
const WOMEN = ['Adaeze', 'Chiamaka', 'Ngozi', 'Amaka', 'Ifeoma', 'Nkechi', 'Uju', 'Ebele'];
const SURFACE = 0.165; // top of the stadium grass
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/**
 * A 5-a-side match at the stadium, played in the real city (the stadium is not copied elsewhere and the
 * player is not teleported away). The rules, ball and AI live in FootballMatch; this class draws it:
 * players as the game's own human rigs, ball, broadcast camera, crowd, floodlights, sounds and HUD.
 */
export class FootballActivity {
  constructor(g, venue, { opponent, difficulty = 'normal', halfSeconds = 180, cup = null, format = '5' }) {
    this.format = format === '11' ? '11' : '5';
    this.g = g; this.venue = venue; this.kind = 'football'; this.title = cup ? 'Community Cup match' : this.format === '11' ? '11-a-side league match' : '5-a-side football'; this.cup = cup;
    this.opponent = opponent; this.difficulty = difficulty; this.halfSeconds = halfSeconds;
    this.statusT = 0; this.lastClock = ''; this.celebrate = 0; this.recorded = null;
    this.controls = {
      desktop: 'WASD / arrows move · Shift sprint · Space or click pass · hold F shoot · E tackle · Esc pause',
      touchHint: 'Joystick to move',
      desktopHelp: 'Move: WASD or arrow keys (right = towards the right of the screen, up = away from you).\nSprint: hold Shift (uses stamina).\nPass: Space or left click — passes to the team-mate in the direction you are pushing. Without the ball it calls for a pass.\nShoot: hold F to charge power, release to shoot towards where you are heading.\nTackle: E when an opponent has the ball. Tackles from behind can give away a free kick.\nPause: Esc, P or the ❚❚ button.',
      touchHelp: 'Move with the joystick on the left (up = away from you).\nSprint: toggle Sprint, or push the joystick all the way.\nPass: tap Pass — to the team-mate in the direction you are pushing. Without the ball it calls for a pass.\nShoot: hold Shoot to charge power, release to shoot.\nTackle: tap Tackle when an opponent has the ball.\nPause: ❚❚ at the top.',
      touch: [{ act: 'pass', label: 'Pass' }, { act: 'shoot', label: 'Shoot' }, { act: 'tackle', label: 'Tackle' }, { act: 'sprint', label: 'Sprint', toggle: true }],
    };
  }

  // ------------------------------------------------------------------ start
  begin(mgr) {
    const g = this.g, venue = this.venue; this.mgr = mgr;
    if (this.cup) { const tx = g.economy.transact({ key: `football:cup-entry:${mgr.matchId}`, amount: -this.cup.entry, reason: 'Community 5-a-side Cup entry' }); if (!tx.ok) throw new Error('Could not pay the cup entry'); }
    const seed = (Math.random() * 4294967295) >>> 0, rnd = mulberry(seed);
    const me = g.saveData.character?.name || 'You';
    venue.useFormat?.(this.format); const N = this.format === '11' ? 11 : 5;
    this.homeName = this.format === '11' ? (this.g.ventures?.clubName?.() ?? 'Onitsha City FC') : `${me.split(' ')[0]}'s Five`;
    const names = [[], []];
    const used = new Set();
    const pick = () => { for (let k = 0; k < 20; k++) { const pool = rnd() < 0.2 ? WOMEN : MEN, n = pool[Math.floor(rnd() * pool.length)]; if (!used.has(n)) { used.add(n); return n; } } return MEN[Math.floor(rnd() * MEN.length)]; };
    for (let t = 0; t < 2; t++) for (let i = 0; i < N; i++) names[t].push(t === 0 && i === N - 1 ? me : pick());
    this.match = new FootballMatch({ seed, difficulty: this.difficulty, halfSeconds: this.halfSeconds, teamNames: [this.homeName, this.opponent.name], playerNames: names, userSlot: N - 1, format: this.format });
    this.root = new THREE.Group(); this.root.name = 'FootballMatch'; venue.frame.add(this.root);
    // players: the user keeps their own look in the home kit; others get local names and looks
    this.bodies = this.match.players.map((p) => {
      let app;
      if (p.user) app = { ...g.player.appearance, outfit: 'tee_shorts', color: 3, bottomColor: 10 };
      else {
        const female = WOMEN.includes(p.name), gender = female ? 'female' : 'male', hair = HAIR_STYLES[gender];
        const gk = p.role === 'gk', home = p.team === 0;
        app = { gender, ageGroup: 'adult', bodyType: rnd() < 0.7 ? 'average' : 'slim', skin: Math.floor(rnd() * 6), hair: hair[Math.floor(rnd() * hair.length)].id, palette: 0,
          outfit: gk ? 'tracksuit' : 'tee_shorts', color: gk ? (home ? 5 : 4) : home ? 3 : this.opponent.shirt, bottomColor: gk ? 11 : home ? 10 : this.opponent.shorts };
      }
      const h = buildHuman(app); h.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      this.root.add(h.group);
      return { h, anim: new CharacterAnimator(h, { walkSpeed: 1.75, runSpeed: 6.2 }), lastHeading: p.heading };
    });
    this.ref = buildHuman({ gender: 'male', ageGroup: 'adult', skin: 2, hair: 'lowcut', outfit: 'tracksuit', color: 11, bottomColor: 11 });
    this.ref.group.traverse((o) => { if (o.isMesh) o.castShadow = true; }); this.root.add(this.ref.group); this.refAnim = new CharacterAnimator(this.ref); this.refPos = new THREE.Vector3(0, SURFACE, -PITCH.W / 2 - 1);
    // ball
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const c = cv.getContext('2d'); c.fillStyle = '#f7f7f2'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#1d1d1d';
    for (let i = 0; i < 12; i++) { const x = (i % 6) * 43 + (i > 5 ? 21 : 0) + 10, y = i > 5 ? 92 : 36; c.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 - Math.PI / 2; c.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } c.fill(); }
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(PITCH.ballR, 18, 12), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 })); this.ball.castShadow = true; this.root.add(this.ball);
    this.ballShadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 16), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.32, depthWrite: false })); this.ballShadow.rotation.x = -Math.PI / 2; this.root.add(this.ballShadow);
    // user marker
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.55, 28), new THREE.MeshBasicMaterial({ color: '#ffd35a', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide })); this.ring.rotation.x = -Math.PI / 2; this.root.add(this.ring);
    this.crowdBuild(rnd);
    // floodlights after dark (decided once, so lighting shaders don't recompile mid-match)
    this.lights = [];
    if ((g.atmosphere?.nightK ?? 0) > 0.2) for (const z of [-1, 1]) {
      const l = new THREE.SpotLight('#fff4dc', 2300, 90, 0.75, 0.6, 2); l.castShadow = false; l.position.set(0, 22, z * 26); l.target.position.set(0, 0, 0);
      this.root.add(l, l.target); this.lights.push(l);
    }
    // hide the walking player (the match body is used instead)
    g.player.human.group.visible = false;
    const camStart = this.venue.toWorld(0, PITCH.W / 2 + 16, 11); g.renderer.camera.position.copy(camStart); this.camPos = camStart.clone(); this.camLook = this.venue.toWorld(0, 0, 0.5);
    this.sounds = new SportSounds(g.audio); this.sounds.crowd(0.5);
    document.documentElement.style.setProperty('--kit-away', this.opponent.css);
    this.mgr.setStatus('Kick-off! You start with the ball');
    this.statusT = 3;
    this.sounds.whistle(false);
    this.sync(0);
  }

  crowdBuild(rnd) {
    // simple low-cost spectators in the stands nearest the 5-a-side pitch (stadium-local coordinates)
    const st = this.venue.stadium.group, seats = [];
    for (const side of [-1, 1]) for (let row = 0; row < 7; row++) for (let x = -48; x <= -4; x += 1.05) { if (rnd() < 0.45) seats.push({ x, y: 0.6 + row * 0.6 + 0.42, z: side * (43 + row * 1.6), side }); }
    this.seats = seats;
    const body = new THREE.CylinderGeometry(0.2, 0.24, 0.62, 7); body.translate(0, 0.31, 0);
    const head = new THREE.SphereGeometry(0.12, 8, 6); head.translate(0, 0.78, 0);
    this.crowdBody = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.85 }), seats.length);
    this.crowdHead = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: '#6b4630', roughness: 0.7 }), seats.length);
    const cols = ['#2f8a4a', '#f1ead8', '#7a1f2b', '#1d2b4f', '#c9a227', '#b75b36', '#87a8bf', '#3b3b3b', '#e4c5b3'], col = new THREE.Color();
    const skins = ['#5a3825', '#6b4630', '#7c5236', '#4a2e1f', '#8a5d3b'];
    seats.forEach((s, i) => { this.crowdBody.setColorAt(i, col.set(cols[Math.floor(rnd() * cols.length)])); this.crowdHead.setColorAt(i, col.set(skins[Math.floor(rnd() * skins.length)])); s.phase = rnd() * 6; });
    this.crowdMat = new THREE.Matrix4(); this.crowdBody.name = 'match-crowd'; this.crowdBody.frustumCulled = this.crowdHead.frustumCulled = false;
    st.add(this.crowdBody, this.crowdHead); this.crowdPose(0, 0);
  }
  crowdPose(t, excite) {
    const m = this.crowdMat, q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
    this.seats.forEach((s, i) => { const hop = excite > 0 ? Math.max(0, Math.sin(t * 9 + s.phase)) * 0.25 * excite : Math.sin(t * 1.3 + s.phase) * 0.02; q.setFromAxisAngle(up, s.side > 0 ? Math.PI : 0); m.compose(p.set(s.x, s.y + hop, s.z), q, one); this.crowdBody.setMatrixAt(i, m); this.crowdHead.setMatrixAt(i, m); });
    this.crowdBody.instanceMatrix.needsUpdate = this.crowdHead.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ per frame
  update(dt) {
    const g = this.g, m = this.match, mgr = this.mgr, input = g.input;
    const mv = input.getMove();
    // camera sits on the +z touchline looking across: screen right = +x, joystick up = away (−z)
    m.setUserInput({ mx: mv.x, mz: -mv.y, sprint: input.isRunning() || !!mgr.hold.sprint, shootHeld: mgr.held('shoot', 'KeyF') });
    if (mgr.pressed('jump', 'primary', 'act:pass')) m.press('pass');
    if (mgr.pressed('interact', 'act:tackle')) m.press('tackle');
    mgr.pressed('act:shoot', 'act:sprint');
    m.update(dt);
    for (const e of m.drainEvents()) this.onEvent(e);
    if (m.phase === 'halftime' && !this.halfShown) { this.halfShown = true; this.halfTime(); }
    if (m.phase === 'fulltime' && !this.recorded) this.fullTime();
    this.sync(dt);
  }
  idle(dt) { this.sync(0); }
  onPause(on) { this.match.paused = on; if (on) this.sounds.crowd(0.15); else this.sounds.crowd(0.5); }
  pauseText() { const s = this.match.status; return `${this.homeName} ${s.score[0]} – ${s.score[1]} ${this.opponent.name} · ${s.half === 1 ? '1st' : '2nd'} half, ${fmt(s.remaining)} left.`; }

  onEvent(e) {
    const m = this.match, s = this.sounds, name = (id) => (id == null ? '' : m.players[id].user ? 'You' : m.players[id].name);
    const ballDist = this.camPos ? this.camPos.distanceTo(this.ball.getWorldPosition(new THREE.Vector3())) : 15;
    switch (e.type) {
      case 'kick': s.kick(e.strength, ballDist); break;
      case 'bounce': s.bounce(e.strength, ballDist); break;
      case 'post': s.post(e.strength); s.cheer(0.5, true); this.say(e.bar ? 'Off the crossbar!' : 'Off the post!'); break;
      case 'whistle': s.whistle(e.long); if (e.kind === 'freekick') this.say('Foul — free kick'); else if (e.kind === 'corner') this.say('Corner'); else if (e.kind === 'kickin') this.say('Kick-in'); else if (e.kind === 'goalkick') this.say('Goal kick'); break;
      case 'save': this.say(`Saved by ${name(e.by) === 'You' ? 'your keeper' : name(e.by)}!`); s.cheer(0.4, true); break;
      case 'goal': {
        const mine = e.team === 0, who = e.own ? 'Own goal' : `${name(e.scorer)}${name(e.scorer) === 'You' ? ' scored' : ''}`;
        this.say(`GOAL! ${who}${e.assist != null ? ` · assist ${name(e.assist)}` : ''} · ${e.score[0]}–${e.score[1]}`, 3);
        s.cheer(mine ? 1 : 0.75, false); this.celebrate = 3.2; this.celebrateTeam = e.team; s.whistle(false);
        break;
      }
      case 'tackle': if (e.won && m.players[e.by].user) this.say('Good tackle!', 1.2); break;
      case 'shot': if (m.players[e.by].user) this.say('Shot!', 0.8); break;
    }
  }
  say(text, secs = 1.6) { this.mgr.setStatus(text); this.statusT = secs; }

  /** Place every body, the ball, the camera and the HUD from the match state. */
  sync(dt) {
    const m = this.match, g = this.g, t = performance.now() / 1000;
    if (this.statusT > 0) { this.statusT -= dt; if (this.statusT <= 0) this.mgr.setStatus(this.restartHint()); }
    else this.mgr.setStatus(this.restartHint());
    this.celebrate = Math.max(0, this.celebrate - dt);
    m.players.forEach((p, i) => {
      const b = this.bodies[i], grp = b.h.group, speed = Math.hypot(p.vx, p.vz);
      grp.position.set(p.x, SURFACE, p.z);
      grp.rotation.set(0, Math.atan2(Math.cos(p.heading), Math.sin(p.heading)), 0);
      const turn = dt > 0 ? (p.heading - b.lastHeading) / dt : 0; b.lastHeading = p.heading;
      b.anim.update(dt, { speed, grounded: true, turnRate: Math.max(-6, Math.min(6, turn)) });
      this.pose(p, b.h, t);
    });
    // referee keeps up with play from a short distance
    const ball = m.ball;
    const rx = ball.x * 0.7, rz = Math.max(-PITCH.W / 2 + 1, Math.min(PITCH.W / 2 - 1, ball.z - 5));
    const target = new THREE.Vector3(rx, SURFACE, rz), d = target.clone().sub(this.refPos); const dl = d.length();
    const rs = dl > 0.6 ? Math.min(dl, 5 * dt) : 0; if (dl > 1e-3) this.refPos.addScaledVector(d.normalize(), rs);
    this.ref.group.position.copy(this.refPos); this.ref.group.rotation.y = Math.atan2(ball.x - this.refPos.x, ball.z - this.refPos.z);
    this.refAnim.update(dt, { speed: dt > 0 ? rs / dt : 0, grounded: true, turnRate: 0 });
    // ball and its spin
    this.ball.position.set(ball.x, ball.y + SURFACE, ball.z);
    const v = Math.hypot(ball.vx, ball.vz); if (v > 0.05 && dt > 0) { const axis = new THREE.Vector3(ball.vz, 0, -ball.vx).normalize(); this.ball.rotateOnWorldAxis(axis, v * dt / PITCH.ballR); }
    this.ballShadow.position.set(ball.x, SURFACE + 0.012, ball.z); this.ballShadow.scale.setScalar(Math.max(0.4, 1 - ball.y * 0.25));
    const u = m.user; this.ring.position.set(u.x, SURFACE + 0.014, u.z); this.ring.material.color.set(m.ball.owner === u.id ? '#ffe680' : '#ffd35a');
    this.crowdPose(t, this.celebrate > 0 ? 1 : 0);
    this.camera(dt);
    // HUD
    const s = m.status, clock = `${s.half === 1 ? '1st' : '2nd'} · ${fmt(s.remaining)}`;
    if (clock !== this.lastClock || s.score.join() !== this.lastScore) {
      this.lastClock = clock; this.lastScore = s.score.join();
      const span = (cls, text) => { const e = document.createElement('span'); e.className = cls; e.textContent = text; return e; };
      this.mgr.setScore([span('team home', this.homeName), span('goals', `${s.score[0]} – ${s.score[1]}`), span('team away', this.opponent.name), span('clock', clock)]);
      this.venue.scoreboard({ home: this.homeName, away: this.opponent.name, score: s.score, clock: fmt(s.remaining), half: s.half === 1 ? '1ST HALF' : '2ND HALF' });
    }
    this.mgr.setMeter(s.charge); this.mgr.setStamina(s.stamina);
    this.sounds.crowd(m.paused ? 0.15 : 0.45 + Math.min(0.4, Math.abs(ball.x) / PITCH.L));
  }

  restartHint() {
    const s = this.match.status;
    if (this.match.phase === 'kickoff' && s.userTakes) return this.g.touch ? 'Kick-off — tap Pass' : 'Kick-off — press Space to pass';
    if (s.userTakes) return this.g.touch ? `${({ kickin: 'Kick-in', corner: 'Corner', freekick: 'Free kick' })[s.restart] ?? 'Restart'} — Pass, or hold Shoot` : `${({ kickin: 'Kick-in', corner: 'Corner', freekick: 'Free kick' })[s.restart] ?? 'Restart'} — Space to pass, hold F to shoot`;
    return '';
  }

  /** Small procedural pose layers on top of the run cycle: kick, tackle, keeper dive/hold, celebration. */
  pose(p, h, t) {
    const b = h.bones, grp = h.group;
    if (p.kick > 0) { const k = 1 - p.kick / 0.32, wind = k < 0.35;
      b['thigh.R'].rotation.x = wind ? 0.7 * k / 0.35 : 0.7 - 1.9 * (k - 0.35) / 0.65;
      b['shin.R'].rotation.x = wind ? 1.2 * k / 0.35 : 1.2 - 1.1 * (k - 0.35) / 0.65;
      b['upperArm.L'].rotation.x = -0.6; b['upperArm.L'].rotation.z = 0.7; }
    if (p.tackling > 0) { b['thigh.R'].rotation.x = -1.2; b['shin.R'].rotation.x = 0.15; b['thigh.L'].rotation.x = 0.5; b['shin.L'].rotation.x = 1.1; grp.position.y -= 0.18; }
    if (p.role === 'gk') {
      if (p.dive > 0) { const k = Math.min(1, (0.7 - p.dive) * 4);
        const lateral = p.diveDir * (Math.cos(p.heading) > 0 ? -1 : 1);
        grp.rotation.z = lateral * 1.25 * k; grp.position.y += 0.35 * Math.sin(Math.min(1, k) * Math.PI) ;
        b['upperArm.L'].rotation.set(-2.9, 0, 0.2); b['upperArm.R'].rotation.set(-2.9, 0, -0.2); }
      else if (this.match.ball.owner === p.id) { b['upperArm.L'].rotation.set(-1.25, 0, 0.15); b['upperArm.R'].rotation.set(-1.25, 0, -0.15); b['foreArm.L'].rotation.x = -0.5; b['foreArm.R'].rotation.x = -0.5; }
    }
    if (this.celebrate > 0 && p.team === this.celebrateTeam) { const w = Math.sin(t * 8 + p.slot) * 0.3; b['upperArm.L'].rotation.set(-2.7 + w, 0, 0.3); b['upperArm.R'].rotation.set(-2.7 - w, 0, -0.3); }
  }

  camera(dt) {
    const m = this.match, ball = m.ball, mobile = this.g.renderer.camera.aspect < 0.9;
    const fx = mobile ? Math.max(-PITCH.L / 2 + 2, Math.min(PITCH.L / 2 - 2, ball.x)) : Math.max(-PITCH.L / 2 + 6, Math.min(PITCH.L / 2 - 6, ball.x * 0.9));
    const back = mobile ? 18 : 9.5, high = mobile ? 14 : 7.8;
    const pos = this.venue.toWorld(fx, PITCH.W / 2 + back - Math.max(-4, Math.min(4, -ball.z * 0.25)), high);
    const look = this.venue.toWorld(ball.x * 0.95, 0.4, ball.z * 0.55 - (mobile ? 1 : 0));
    const k = dt > 0 ? 1 - Math.exp(-dt * 3.2) : 1;
    this.camPos.lerp(pos, k); this.camLook.lerp(look, Math.min(1, k * 1.4));
    const cam = this.g.renderer.camera;
    if (this.camOverride) { cam.position.copy(this.venue.toWorld(...this.camOverride.pos)); cam.lookAt(this.venue.toWorld(...this.camOverride.look)); return; } // QA close-ups
    cam.position.copy(this.camPos); cam.lookAt(this.camLook);
  }

  // ------------------------------------------------------------------ half-time and full time
  halfTime() {
    const r = this.match.summary(), st = r.stats;
    this.sounds.cheer(0.4, false);
    this.mgr.panel({ kicker: 'HALF-TIME', title: `${this.homeName} ${r.score[0]} – ${r.score[1]} ${this.opponent.name}`, text: 'Teams switch ends for the second half.',
      lines: [{ label: 'Possession', value: `${r.possession[0]}% – ${r.possession[1]}%` }, { label: 'Shots (on target)', value: `${st[0].shots} (${st[0].onTarget}) – ${st[1].shots} (${st[1].onTarget})` }, { label: 'Passes completed', value: `${st[0].passesDone} – ${st[1].passesDone}` }, { label: 'Your goals · shots', value: `${r.user.goals} · ${r.user.shots}` }],
      buttons: [{ label: 'Start second half', primary: true, act: () => { this.mgr.closePanel(); this.halfShown = false; this.match.startSecondHalf(); this.say('Second half — teams have switched ends', 2.5); } }, { label: 'Leave (no result)', danger: true, act: () => this.mgr.confirmLeave() }] });
  }

  fullTime() {
    const g = this.g, r = this.match.result, mgr = this.mgr;
    const rec = recordFootball(g.saveData, mgr.matchId, r, { opponent: this.opponent.name, day: g.clock.day, difficulty: this.difficulty });
    this.recorded = rec;
    let prize = 0;
    if (rec.ok && !rec.duplicate) {
      g.skills?.add('fitness', rec.xp); g.needs?.adjust(rec.needs);
      if (this.cup && r.outcome === 'win') { const p = g.events?.payPrize('cup', `football:cup-prize:${mgr.matchId}`, this.cup.prize, 'Community Cup prize'); if (p?.ok) prize = this.cup.prize; }
      g.ventures?.footballResult({ matchId: mgr.matchId, outcome: r.outcome, score: r.score }); // v0.47: a league match for Onitsha City FC
      mgr.finished(); g.saveGameNow();
    }
    this.sounds.cheer(r.outcome === 'win' ? 1 : 0.5, r.outcome === 'loss');
    const st = r.stats, f = g.saveData.activities.football;
    const head = r.outcome === 'win' ? 'You won!' : r.outcome === 'loss' ? 'You lost' : 'A draw';
    const scorers = r.goals.filter((x) => x.team === 0).map((x) => (x.own ? 'own goal' : this.match.players[x.scorer].user ? 'You' : x.scorerName)).join(', ');
    const ach = (rec.newAchievements ?? []).map((id) => `★ ${FOOTBALL_ACHIEVEMENTS[id].label} — ${FOOTBALL_ACHIEVEMENTS[id].note}`);
    mgr.panel({ kicker: `FULL TIME · ${this.difficulty.toUpperCase()}`, title: `${head} ${r.score[0]} – ${r.score[1]}`,
      text: `${this.homeName} v ${this.opponent.name}${scorers ? `\nYour side's goals: ${scorers}` : ''}`,
      lines: [
        { label: 'Possession', value: `${r.possession[0]}% – ${r.possession[1]}%` },
        { label: 'Shots (on target)', value: `${st[0].shots} (${st[0].onTarget}) – ${st[1].shots} (${st[1].onTarget})` },
        { label: 'Passes completed', value: `${st[0].passesDone}/${st[0].passes} – ${st[1].passesDone}/${st[1].passes}` },
        { label: 'You: goals · assists · tackles', value: `${r.user.goals} · ${r.user.assists} · ${r.user.tackles}` },
        { label: 'Rewards', value: rec.ok && !rec.duplicate ? `+${rec.xp} Fitness XP${this.cup ? (prize ? ` · cup prize ₦${prize.toLocaleString()}` : ` · entry ₦${this.cup.entry.toLocaleString()} spent`) : ''}` : 'Already recorded' },
        { label: 'Record', value: `${f.won}W ${f.drawn}D ${f.lost}L · ${rec.standing?.label ?? ''}` },
      ],
      list: ach,
      buttons: [{ label: 'Rematch', primary: true, act: () => this.rematch() }, { label: 'Leave the pitch', act: () => mgr.end() }] });
  }

  rematch() {
    const venue = this.venue, opts = { ...venue.opts }, cup = !!this.cup;
    this.mgr.end();
    const why = venue.why(); if (why) { this.g.ui.toast(why); return; }
    venue.startMatch(opts, { cup });
  }

  // ------------------------------------------------------------------ cleanup
  focus() { return this.venue.toWorld(0, 0); }
  end() {
    for (const b of this.bodies ?? []) b.h.dispose?.();
    this.ref?.dispose?.();
    if (this.root) { this.root.traverse((o) => { if (!o.isSkinnedMesh) { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); } }); this.root.parent?.remove(this.root); }
    for (const m of [this.crowdBody, this.crowdHead]) if (m) { m.parent?.remove(m); m.geometry.dispose(); m.material.dispose(); }
    this.sounds?.stopCrowd(); setTimeout(() => this.sounds?.dispose(), 800);
    this.venue.scoreboard(null);
    this.venue.useFormat?.('5'); // back to the 5-a-side pitch
  }
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
