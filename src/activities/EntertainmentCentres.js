import * as THREE from 'three';
import { VenueSite, openAt } from './VenueKit.js';
import { FootballMatch } from './football/FootballMatch.js';
import { drawPitch2D } from './football/Pitch2D.js';
import { SportSounds } from '../audio/SportSounds.js';
import { recordGame, ensureActivities } from './ActivityRecords.js';
import { naira } from '../economy/Economy.js';

export const GAMEZONE_HOURS = [10, 22], VIEWING_HOURS = [12, 24];
export const GAME_FEE = 300, VIEW_FEE = 100;
const hoursText = ([a, b]) => `${a}:00–${b % 24}:00`;
// Fictional league sides for the viewing-centre broadcasts (not real clubs).
export const LEAGUE = [
  { name: 'Awka Royals', color: '#6a2c91' }, { name: 'Nnewi Motors United', color: '#1f4fbf' }, { name: 'Asaba Riverside', color: '#0f8a8a' },
  { name: 'Onitsha Lions', color: '#d4a017' }, { name: 'Ekwulobia Stars', color: '#c8322b' }, { name: 'Ogidi Hill FC', color: '#1d7a3e' },
];
const BANTER = ['"Ref, open your eye!"', '"Na offside be that!"', '"This keeper dey sleep?"', '"Pass am, pass am!"', '"Haa, see as e miss am!"', '"Our defence go kill me today."', '"Make una calm down, match never finish."', '"Who get charger? My phone don die."'];

/** Simple seated crowd made of two instanced meshes (cheap), able to jump on goals. */
function seatedCrowd(site, seats, rnd = Math.random) {
  const body = new THREE.CylinderGeometry(0.19, 0.23, 0.6, 7); body.translate(0, 0.3, 0);
  const head = new THREE.SphereGeometry(0.12, 8, 6); head.translate(0, 0.76, 0);
  const b = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: 0.85 }), seats.length), h = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ roughness: 0.7 }), seats.length);
  const cols = ['#2f8a4a', '#f1ead8', '#7a1f2b', '#1d2b4f', '#c9a227', '#b75b36', '#87a8bf', '#3b3b3b'], skins = ['#5a3825', '#6b4630', '#7c5236', '#4a2e1f'], c = new THREE.Color();
  seats.forEach((s, i) => { b.setColorAt(i, c.set(cols[Math.floor(rnd() * cols.length)])); h.setColorAt(i, c.set(skins[Math.floor(rnd() * skins.length)])); s.phase = rnd() * 6; });
  site.group.add(b, h);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0);
  const pose = (t, excite) => { seats.forEach((s, i) => { const hop = excite ? Math.max(0, Math.sin(t * 9 + s.phase)) * 0.22 : Math.sin(t * 1.2 + s.phase) * 0.015; q.setFromAxisAngle(up, s.yaw ?? Math.PI); m.compose(p.set(s.u, s.y + hop, s.w), q, one); b.setMatrixAt(i, m); h.setMatrixAt(i, m); }); b.instanceMatrix.needsUpdate = h.instanceMatrix.needsUpdate = true; };
  pose(0, false);
  return { body: b, head: h, pose, set visible(v) { b.visible = h.visible = v; } };
}

export class EntertainmentCentres {
  constructor(g) { this.g = g; }
  setup() {
    const g = this.g, L = (id) => g.world.landmarks.get(id);
    const a = L('upper-iweka') ?? L('upper-iweka-park'), b = L('upper-iweka-park') ?? a;
    try { this.buildGameZone({ x: a.x - 45, z: a.z + 40 }); } catch (err) { console.warn('[activities] no plot for game zone', err.message); }
    try { this.buildViewing({ x: b.x + 70, z: b.z - 10 }); } catch (err) { console.warn('[activities] no plot for viewing centre', err.message); }
  }

  // ------------------------------------------------------------------ game zone
  buildGameZone(near) {
    const g = this.g, s = this.zone = new VenueSite(g, 'obis-game-zone', near, { w: 7, d: 6 });
    s.shed({ w: 6.6, d: 5.6, h: 2.9, wall: '#2a2f45', roof: '#40465c', trim: '#7b2ff2', sign: "OBI'S GAME ZONE · PS5 · FIFA", signBg: '#1b1036', signFg: '#7fffd4' });
    const attract = this.attract = document.createElement('canvas'); attract.width = 256; attract.height = 160;
    const x = attract.getContext('2d'); const fake = new FootballMatch({ seed: 5, userSlot: -1 }); for (let i = 0; i < 300; i++) fake.update(1 / 30);
    drawPitch2D(x, fake, { w: 256, h: 160, names: ['HOME', 'AWAY'] });
    const tex = new THREE.CanvasTexture(attract); tex.colorSpace = THREE.SRGBColorSpace;
    this.zoneScreens = [];
    for (const [i, u] of [-2.1, 0, 2.1].entries()) {
      s.box(1.5, 0.75, 0.5, u, 0.38, -4.9, '#1b1b1f', true);
      const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.75), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); tv.position.set(u, 1.35, -4.95); s.group.add(tv); this.zoneScreens.push(tv);
      s.box(1.33, 0.83, 0.05, u, 1.35, -5.0, '#111');
      s.box(0.3, 0.06, 0.2, u - 0.4, 0.79, -4.8, '#f4f4f4'); // console
      for (const k of [-0.35, 0.35]) s.box(0.38, 0.45, 0.38, u + k, 0.23, -3.6, '#7b2ff2');
    }
    s.person(0, -2.45, -3.6, Math.PI, { name: 'Somto', activity: 'drink', seatY: 0.45, schedule: GAMEZONE_HOURS });
    s.person(1, 2.45, -3.6, Math.PI, { name: 'Kene', activity: 'drink', seatY: 0.45, schedule: GAMEZONE_HOURS });
    s.person(2, 1.6, -1.0, 0, { name: 'Obi (attendant)', activity: 'serve', schedule: GAMEZONE_HOURS, role: 'trader' });
    s.interact(0, -2.6, () => `Obi's Game Zone — play FIFA (${naira(GAME_FEE)})`, () => g.openChoice(() => this.zoneView()), { radius: 2.4 });
  }
  zoneView() {
    const g = this.g, r = ensureActivities(g.saveData).games.gaming ?? { won: 0, drawn: 0, lost: 0 }, open = openAt(g.clock.minutes / 60, GAMEZONE_HOURS), lv = this.zoneLevel ?? 1, names = ['Easy', 'Normal', 'Hard'];
    const why = !open ? `Closed. Open ${hoursText(GAMEZONE_HOURS)} (Onitsha time).` : g.economy.balance < GAME_FEE ? `You need ${naira(GAME_FEE)}.` : g.activities.blocked();
    return { title: "Obi's Game Zone", kicker: `${naira(GAME_FEE)} PER MATCH · ${hoursText(GAMEZONE_HOURS)}`,
      text: `Grab a pad and play a quick football match against the console: 2 × 75 seconds, 5-a-side. Your record here: ${r.won}W ${r.drawn}D ${r.lost}L.`,
      note: why ?? `${naira(GAME_FEE)} is paid once when the match starts (no refund if you leave early). Same controls as the stadium.`,
      options: [
        { label: `Pay ${naira(GAME_FEE)} & play`, primary: true, disabled: !!why, why: why ?? '', act: () => this.startGaming(['easy', 'normal', 'hard'][lv]) },
        { label: `Console difficulty: ${names[lv]}`, sub: 'Tap to change', act: () => { this.zoneLevel = (lv + 1) % 3; g.openChoice(() => this.zoneView()); } },
        { label: 'Not now', ghost: true, act: () => g.closeChoice() }] };
  }
  startGaming(difficulty = 'normal') {
    const g = this.g;
    if (!openAt(g.clock.minutes / 60, GAMEZONE_HOURS)) { g.ui.toast('The game zone is closed.'); return false; }
    if (g.economy.balance < GAME_FEE) { g.ui.toast(`You need ${naira(GAME_FEE)}.`); return false; }
    return g.activities.start(new GamingActivity(g, this, { difficulty }));
  }

  // ------------------------------------------------------------------ viewing centre
  buildViewing(near) {
    const g = this.g, s = this.view = new VenueSite(g, 'iweka-viewing-centre', near, { w: 10, d: 9 });
    s.shed({ w: 9.6, d: 8.6, h: 3.2, wall: '#d9cdb4', roof: '#7a8a8e', trim: '#1d3b2f', sign: 'IWEKA VIEWING CENTRE · LIVE FOOTBALL', signBg: '#1d3b2f', signFg: '#ffd35a' });
    this.screenCanvas = document.createElement('canvas'); this.screenCanvas.width = 512; this.screenCanvas.height = 300;
    this.screenTex = new THREE.CanvasTexture(this.screenCanvas); this.screenTex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2), new THREE.MeshBasicMaterial({ map: this.screenTex, toneMapped: false })); scr.position.set(0, 1.85, -8.45); s.group.add(scr); this.screen = scr;
    s.box(3.6, 2.2, 0.08, 0, 1.85, -8.5, '#111');
    const seats = [];
    for (let row = 0; row < 4; row++) { const w = -6.6 + row * 1.35; s.box(7.6, 0.08, 0.42, 0, 0.45, w, '#6e4a2f'); for (const k of [-3.6, 0, 3.6]) s.box(0.08, 0.42, 0.38, k, 0.21, w, '#4b3220'); for (let u = -3.4; u <= 3.4; u += 0.62) if (Math.random() < 0.6) seats.push({ u, y: 0.42, w: w + 0.05, yaw: Math.PI }); }
    this.crowd = seatedCrowd(s, seats); this.crowdSeats = seats;
    this.idleMatch = new FootballMatch({ seed: 21, userSlot: -1, halfSeconds: 600 }); this.idleTeams = [LEAGUE[0], LEAGUE[1]];
    s.interact(0, -1.4, () => `Iweka Viewing Centre — watch football (${naira(VIEW_FEE)})`, () => g.openChoice(() => this.viewingView()), { radius: 2.5 });
  }
  /** Keep the big screen alive for passers-by while open (a cheap, low-rate redraw). */
  update(dt) {
    if (!this.view || this.g.activities?.current?.kind === 'viewing') return;
    const near = Math.hypot(this.g.player.position.x - this.view.x, this.g.player.position.z - this.view.z) < 45, open = openAt(this.g.clock.minutes / 60, VIEWING_HOURS);
    this.crowd.visible = open; if (!near) return;
    this.tick = (this.tick ?? 0) + dt; if (this.tick < 0.2) return; const step = this.tick; this.tick = 0;
    const ctx = this.screenCanvas.getContext('2d');
    if (!open) { ctx.fillStyle = '#05080a'; ctx.fillRect(0, 0, 512, 300); this.screenTex.needsUpdate = true; return; }
    this.idleMatch.update(step); this.idleMatch.drainEvents(); if (this.idleMatch.phase === 'halftime') this.idleMatch.startSecondHalf(); if (this.idleMatch.phase === 'fulltime') this.idleMatch = new FootballMatch({ seed: (Math.random() * 1e9) | 0, userSlot: -1, halfSeconds: 600 });
    drawPitch2D(ctx, this.idleMatch, { w: 512, h: 300, colors: this.idleTeams.map((t) => t.color), names: this.idleTeams.map((t) => t.name) }); this.screenTex.needsUpdate = true;
    this.crowd.pose(performance.now() / 1000, false);
  }
  viewingView() {
    const g = this.g, open = openAt(g.clock.minutes / 60, VIEWING_HOURS), r = ensureActivities(g.saveData).games.viewing ?? { played: 0 };
    const why = !open ? `Closed. Open ${hoursText(VIEWING_HOURS)} (Onitsha time).` : g.economy.balance < VIEW_FEE ? `You need ${naira(VIEW_FEE)}.` : g.activities.blocked();
    return { title: 'Iweka Viewing Centre', kicker: `${naira(VIEW_FEE)} GATE FEE · ${hoursText(VIEWING_HOURS)}`,
      text: `The room is full and the generator is humming. Tonight: a league match between two fictional local sides, shown as a simulated broadcast (not a real TV feed). Matches watched: ${r.played ?? 0}.`,
      note: why ?? `${naira(VIEW_FEE)} is paid once at the door. Stay as long as you like; watching a full match lifts your fun and social needs.`,
      options: [{ label: `Pay ${naira(VIEW_FEE)} & find a seat`, primary: true, disabled: !!why, why: why ?? '', act: () => this.startViewing() }, { label: 'Not now', ghost: true, act: () => g.closeChoice() }] };
  }
  startViewing() {
    const g = this.g;
    if (!openAt(g.clock.minutes / 60, VIEWING_HOURS)) { g.ui.toast('The viewing centre is closed.'); return false; }
    if (g.economy.balance < VIEW_FEE) { g.ui.toast(`You need ${naira(VIEW_FEE)}.`); return false; }
    return g.activities.start(new ViewingActivity(g, this));
  }

  places() {
    const out = [];
    if (this.zone) out.push({ ...this.zone.at(0, -0.5), kind: 'venue', label: "Obi's Game Zone" });
    if (this.view) out.push({ ...this.view.at(0, -0.5), kind: 'venue', label: 'Iweka Viewing Centre' });
    return out;
  }
}

/** Console football in the game zone: the FootballMatch engine drawn on a TV-style canvas, played with the stadium controls. */
export class GamingActivity {
  constructor(g, centre, { difficulty = 'normal' } = {}) {
    Object.assign(this, { g, centre, difficulty, kind: 'gaming', title: 'Console football' });
    this.controls = {
      desktop: 'WASD move · Shift sprint · Space/click pass · hold F shoot · E tackle · Esc pause',
      touchHint: 'Joystick to move', desktopHelp: 'Same controls as the stadium: WASD move, Shift sprint, Space or click to pass, hold F to charge and release to shoot, E to tackle.', touchHelp: 'Joystick to move, Pass, hold Shoot, Tackle, Sprint.',
      touch: [{ act: 'pass', label: 'Pass' }, { act: 'shoot', label: 'Shoot' }, { act: 'tackle', label: 'Tackle' }, { act: 'sprint', label: 'Sprint', toggle: true }],
    };
  }
  begin(mgr) {
    const g = this.g; this.mgr = mgr;
    const tx = g.economy.transact({ key: `gaming:fee:${mgr.matchId}`, amount: -GAME_FEE, reason: "Obi's Game Zone: one match" }); if (!tx.ok) throw new Error('fee');
    this.match = new FootballMatch({ seed: (Math.random() * 4294967295) >>> 0, difficulty: this.difficulty, halfSeconds: 75, teamNames: ['YOU', 'CPU'], userSlot: 4 });
    const wrap = this.el = document.createElement('div'); wrap.className = 'console-wrap';
    const c = this.canvas = document.createElement('canvas'); c.className = 'console-screen'; wrap.appendChild(c); mgr.el.appendChild(wrap);
    this.sounds = new SportSounds(g.audio); g.player.human.group.visible = false;
    const cam = g.renderer.camera, s = this.centre.zone, p = s.at(0, -2.4), t = s.at(0, -4.95); cam.position.set(p.x, 1.4, p.z); cam.lookAt(t.x, 1.35, t.z);
    this.banner = 'KICK OFF'; this.bannerT = 1.5; this.sounds.blip(880, 0.15);
  }
  update(dt) {
    const g = this.g, m = this.match, mgr = this.mgr, mv = g.input.getMove();
    m.setUserInput({ mx: mv.x, mz: -mv.y, sprint: g.input.isRunning() || !!mgr.hold.sprint, shootHeld: mgr.held('shoot', 'KeyF') });
    if (mgr.pressed('jump', 'primary', 'act:pass')) m.press('pass');
    if (mgr.pressed('interact', 'act:tackle')) m.press('tackle');
    m.update(dt);
    for (const e of m.drainEvents()) {
      if (e.type === 'kick') this.sounds.blip(300 + e.strength * 500, 0.05, 0.03);
      else if (e.type === 'goal') { this.banner = e.team === 0 ? 'GOAL!' : 'CPU SCORES'; this.bannerT = 2.2; this.sounds.blip(e.team === 0 ? 1046 : 220, 0.4, 0.06); }
      else if (e.type === 'whistle') this.sounds.blip(1400, 0.12, 0.03);
    }
    if (m.phase === 'halftime') { m.startSecondHalf(); this.banner = 'SECOND HALF'; this.bannerT = 1.6; }
    if (m.phase === 'fulltime' && !this.recorded) this.finish();
    this.bannerT = Math.max(0, (this.bannerT ?? 0) - dt);
    this.draw(); mgr.setMeter(m.status.charge); mgr.setStamina(m.status.stamina);
  }
  draw() {
    const c = this.canvas, r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(320, Math.round(r.width * dpr)), h = Math.max(200, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    drawPitch2D(c.getContext('2d'), this.match, { w, h, colors: ['#2f8a4a', '#1f4fbf'], keeper: ['#c9a227', '#3b3b3b'], names: ['YOU', `CPU · ${this.difficulty.toUpperCase()}`], userId: this.match.userId, banner: this.bannerT > 0 ? this.banner : null });
  }
  idle() { this.draw(); }
  onPause(on) { this.match.paused = on; }
  finish() {
    const g = this.g, r = this.match.result, mgr = this.mgr, won = r.outcome === 'win' ? true : r.outcome === 'loss' ? false : 'draw';
    const rec = recordGame(g.saveData, 'gaming', mgr.matchId, { won }); this.recorded = rec;
    if (rec.ok && !rec.duplicate) { g.needs?.adjust({ fun: 15, social: 3, energy: -2 }); mgr.finished(); g.saveGameNow(); }
    const rr = rec.record ?? {};
    mgr.panel({ kicker: `CONSOLE · ${this.difficulty.toUpperCase()}`, title: won === true ? 'You won!' : won === false ? 'CPU won' : 'Draw', text: `Final score ${r.score[0]} – ${r.score[1]}.`,
      lines: [{ label: 'Your goals · shots', value: `${r.user.goals} · ${r.user.shots}` }, { label: 'Record at the zone', value: `${rr.won ?? 0}W ${rr.drawn ?? 0}D ${rr.lost ?? 0}L` }],
      buttons: [{ label: `Play again (${naira(GAME_FEE)})`, primary: true, act: () => { const c = this.centre, d = this.difficulty; mgr.end(); c.startGaming(d); } }, { label: 'Leave', act: () => mgr.end() }] });
  }
  pauseText() { return `Leaving now ends the match with no result. The ${naira(GAME_FEE)} fee is not refunded.`; }
  focus() { return this.centre.zone.at(0, -3); }
  end() { this.el?.remove(); }
}

/** Watching a simulated match on the big screen with a full room. */
export class ViewingActivity {
  constructor(g, centre) {
    Object.assign(this, { g, centre, kind: 'viewing', title: 'Viewing centre' });
    this.controls = { desktop: 'Z zooms to the screen · Esc to leave', touchHint: 'Zoom shows the screen full size', desktopHelp: 'Sit back and watch. Z (or the Zoom button) shows the screen full size. Leave from the pause menu any time.', touchHelp: 'Sit back and watch. Zoom shows the screen full size. Leave from the pause menu any time.', touch: [{ act: 'zoom', label: 'Zoom', toggle: true }] };
  }
  begin(mgr) {
    const g = this.g; this.mgr = mgr;
    const tx = g.economy.transact({ key: `viewing:fee:${mgr.matchId}`, amount: -VIEW_FEE, reason: 'Iweka Viewing Centre gate fee' }); if (!tx.ok) throw new Error('fee');
    const pick = [...LEAGUE].sort(() => Math.random() - 0.5); this.teams = [pick[0], pick[1]];
    this.match = new FootballMatch({ seed: (Math.random() * 4294967295) >>> 0, halfSeconds: 120, userSlot: -1, teamNames: this.teams.map((t) => t.name) });
    this.sounds = new SportSounds(g.audio); this.sounds.crowd(0.35); g.player.human.group.visible = false;
    const wrap = this.el = document.createElement('div'); wrap.className = 'console-wrap viewing'; wrap.hidden = true;
    this.bigCanvas = document.createElement('canvas'); this.bigCanvas.className = 'console-screen'; wrap.appendChild(this.bigCanvas); mgr.el.appendChild(wrap);
    this.banterT = 6; this.excite = 0; this.zoom = false;
    const s = this.centre.view, p = s.at(0.4, -3.3), t = s.at(0, -8.45); g.renderer.camera.position.set(p.x, 1.35, p.z); g.renderer.camera.lookAt(t.x, 1.75, t.z);
    this.big = g.events?.active('big-match'); if (this.big) { this.teams = [LEAGUE[3], LEAGUE[0]]; this.match.teams.forEach((t, i) => (t.name = this.teams[i].name)); }
    mgr.setStatus(`${this.big ? 'BIG MATCH NIGHT · ' : ''}${this.teams[0].name} v ${this.teams[1].name} — kick-off`); this.statusT = 3;
  }
  update(dt) {
    const m = this.match, mgr = this.mgr;
    const z = this.g.input.keys.has('KeyZ'); if (z && !this.zHeld) this.kz = !this.kz; this.zHeld = z;
    this.zoom = !!this.kz !== !!mgr.hold.zoom;
    m.update(dt);
    for (const e of m.drainEvents()) {
      if (e.type === 'goal') { const t = this.teams[e.team].name; this.say(`GOAL! ${t} · ${e.score[0]}–${e.score[1]} — the whole room is on its feet`, 3.5); this.sounds.cheer(1, false); this.excite = 3; }
      else if (e.type === 'save') { this.say('What a save!', 1.6); this.sounds.cheer(0.4, true); }
      else if (e.type === 'post') { this.say('Off the post! Everybody hold head', 2); this.sounds.cheer(0.6, true); }
      else if (e.type === 'whistle' && e.long) this.sounds.whistle(true);
    }
    if (m.phase === 'halftime') { this.say('Half-time. Somebody is selling groundnut at the door', 3); m.startSecondHalf(); }
    if (m.phase === 'fulltime' && !this.recorded) this.finish();
    this.banterT -= dt; if (this.banterT <= 0 && this.statusT <= 0) { this.say(BANTER[Math.floor(Math.random() * BANTER.length)], 2.6); this.banterT = 9 + Math.random() * 8; }
    this.statusT = Math.max(0, (this.statusT ?? 0) - dt); if (this.statusT <= 0) mgr.setStatus('');
    this.excite = Math.max(0, this.excite - dt);
    this.render();
  }
  render() {
    const c = this.centre, ctx = c.screenCanvas.getContext('2d'), st = this.match.status;
    drawPitch2D(ctx, this.match, { w: 512, h: 300, colors: this.teams.map((t) => t.color), names: this.teams.map((t) => t.name) }); c.screenTex.needsUpdate = true;
    c.crowd.pose(performance.now() / 1000, this.excite > 0);
    this.el.hidden = !this.zoom;
    if (this.zoom) { const r = this.bigCanvas.getBoundingClientRect(), w = Math.max(320, Math.round(r.width)), h = Math.max(200, Math.round(r.height)); if (this.bigCanvas.width !== w) { this.bigCanvas.width = w; this.bigCanvas.height = h; } drawPitch2D(this.bigCanvas.getContext('2d'), this.match, { w, h, colors: this.teams.map((t) => t.color), names: this.teams.map((t) => t.name) }); }
    const span = (cls, t) => { const e = document.createElement('span'); e.className = cls; e.textContent = t; return e; };
    const key = st.score.join() + st.half + Math.ceil(st.remaining); if (key !== this.lastKey) { this.lastKey = key; this.mgr.setScore([span('team home', this.teams[0].name), span('goals', `${st.score[0]} – ${st.score[1]}`), span('team away', this.teams[1].name), span('clock', `${st.half === 1 ? '1st' : '2nd'} · ${Math.floor(st.remaining / 60)}:${String(Math.ceil(st.remaining % 60)).padStart(2, '0')}`)]); }
  }
  idle() { this.render(); }
  say(t, secs) { this.mgr.setStatus(t); this.statusT = secs; }
  onPause(on) { this.match.paused = on; }
  finish() {
    const g = this.g, r = this.match.result, mgr = this.mgr, rec = recordGame(g.saveData, 'viewing', mgr.matchId, {}); this.recorded = rec;
    if (rec.ok && !rec.duplicate) { g.needs?.adjust({ fun: this.big ? 20 : 12, social: this.big ? 15 : 10, energy: -2 }); mgr.finished(); g.saveGameNow(); }
    this.sounds.whistle(true);
    mgr.panel({ kicker: 'FULL TIME', title: `${this.teams[0].name} ${r.score[0]} – ${r.score[1]} ${this.teams[1].name}`, text: r.score[0] === r.score[1] ? 'A draw. The argument outside will continue till morning.' : `${this.teams[r.score[0] > r.score[1] ? 0 : 1].name} take the win. Half the room is happy.`,
      lines: [{ label: 'Shots', value: `${r.stats[0].shots} – ${r.stats[1].shots}` }, { label: 'Possession', value: `${r.possession[0]}% – ${r.possession[1]}%` }, { label: 'Matches watched', value: String(rec.record?.played ?? 1) }],
      buttons: [{ label: `Watch another (${naira(VIEW_FEE)})`, primary: true, act: () => { const c = this.centre; mgr.end(); c.startViewing(); } }, { label: 'Leave', act: () => mgr.end() }] });
  }
  pauseText() { return 'You can leave at any time; the gate fee is not refunded.'; }
  focus() { return this.centre.view.at(0, -4); }
  end() { this.el?.remove(); this.sounds?.stopCrowd(); setTimeout(() => this.sounds?.dispose(), 800); }
}
