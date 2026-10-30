import * as THREE from 'three';
import { PITCH, setPitchFormat } from './FootballMatch.js';
import { FootballActivity } from './FootballActivity.js';
import { footballStanding, ensureActivities, FOOTBALL_ACHIEVEMENTS } from '../ActivityRecords.js';
import { EVENTS } from '../CityEvents.js';

/** Fictional neighbourhood sides; kit colours are indices into the game's OUTFIT_COLORS. */
export const OPPONENTS = [
  { id: 'fegge', name: 'Fegge Rangers', shirt: 1, shorts: 10, css: '#7a1f2b' },
  { id: 'odoakpu', name: 'Odoakpu Stars', shirt: 0, shorts: 10, css: '#1d2b4f' },
  { id: 'woliwo', name: 'Woliwo United', shirt: 9, shorts: 11, css: '#b75b36' },
  { id: 'okpoko', name: 'Okpoko Warriors', shirt: 8, shorts: 2, css: '#60466e' },
  { id: 'gra', name: 'GRA Strikers', shirt: 7, shorts: 0, css: '#87a8bf' },
];
export const LENGTHS = [{ id: 'short', label: 'Short · 2 × 2 min', half: 120 }, { id: 'standard', label: 'Standard · 2 × 3 min', half: 180 }, { id: 'long', label: 'Long · 2 × 5 min', half: 300 }];
export const LEVELS = [{ id: 'easy', label: 'Easy' }, { id: 'normal', label: 'Normal' }, { id: 'hard', label: 'Hard' }];
export const PITCH_HOURS = [6, 22]; // floodlit after dark

/**
 * The 5-a-side pitch inside Chuba Ikpeazu Memorial Stadium: a marked 40 × 25 m area across the half nearest
 * the main entrance, with portable goals, a touchline board and a scoreboard. The existing stadium is reused,
 * not duplicated or moved. Talking to the pitch-side organiser starts the pre-match menu.
 */
export class StadiumFootball {
  constructor(g) { this.g = g; this.opts = { opp: 0, level: 1, length: 1 }; this.frame = null; }

  setup() {
    const g = this.g, st = g.world.stadium; if (!st) return;
    this.stadium = st;
    // pitch frame: engine x (length) runs along the stadium's local z; centred in the entrance half
    const f = this.frame = new THREE.Group(); f.name = 'FiveASidePitch'; f.position.set(-26, 0, 0); f.rotation.y = -Math.PI / 2;
    st.group.add(f); st.group.updateMatrixWorld(true);
    this.buildMarkings(); this.buildGoals(); this.buildFurniture();
    const org = this.toWorld(0, PITCH.W / 2 + 3.2);
    this.spot = org;
    g.interactions.register({ x: org.x, z: org.z, radius: 3.2, priority: 2,
      enabled: () => !!g.saveData && !g.activities?.active && !g.homes.inside && !g.club.inside && !g.civic.inside && !g.vehicles.driving && !g.transport.riding && !g.story?.s?.arrest && !g.story?.s?.pending,
      label: () => '5-a-side football — play a match',
      onInteract: () => g.openChoice(() => this.view()) });
  }

  /** Engine (pitch) coordinates → world position. */
  toWorld(x, z, y = 0) { const v = new THREE.Vector3(x, y, z); this.frame.updateMatrixWorld(true); return this.frame.localToWorld(v); }
  places() { return this.spot ? [{ x: this.spot.x, z: this.spot.z, kind: 'venue', label: '5-a-side football' }] : []; }

  buildMarkings() {
    const { L, W, boxDepth, boxHalf } = PITCH, pos = [], w = 0.09, y = 0.172;
    const seg = (x1, z1, x2, z2) => { const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, nx = -dz / l * w / 2, nz = dx / l * w / 2;
      pos.push(x1 + nx, y, z1 + nz, x2 + nx, y, z2 + nz, x2 - nx, y, z2 - nz, x1 + nx, y, z1 + nz, x2 - nx, y, z2 - nz, x1 - nx, y, z1 - nz); };
    const rect = (x1, z1, x2, z2) => { seg(x1, z1, x2, z1); seg(x2, z1, x2, z2); seg(x2, z2, x1, z2); seg(x1, z2, x1, z1); };
    rect(-L / 2, -W / 2, L / 2, W / 2); seg(0, -W / 2, 0, W / 2);
    const circle = (cx, cz, r, a0 = 0, a1 = Math.PI * 2, n = 40) => { for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n, b = a0 + (a1 - a0) * (i + 1) / n; seg(cx + Math.cos(a) * r, cz + Math.sin(a) * r, cx + Math.cos(b) * r, cz + Math.sin(b) * r); } };
    circle(0, 0, 3);
    for (const e of [-1, 1]) { const gx = e * L / 2, bx = gx - e * boxDepth; seg(gx, -boxHalf, bx, -boxHalf); seg(bx, -boxHalf, bx, boxHalf); seg(bx, boxHalf, gx, boxHalf); circle(gx - e * 6.5, 0, 0.12, 0, Math.PI * 2, 8); }
    circle(0, 0, 0.12, 0, Math.PI * 2, 8);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#fff3b8', roughness: 0.9, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; m.name = 'five-a-side-lines'; this.frame.add(m);
  }

  buildGoals() {
    const { L, goalW, goalH } = PITCH, white = new THREE.MeshStandardMaterial({ color: '#f4f4ee', roughness: 0.4 });
    const cv = document.createElement('canvas'); cv.width = cv.height = 64; const c = cv.getContext('2d'); c.strokeStyle = '#ffffffd0'; c.lineWidth = 2;
    for (let i = 0; i <= 64; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 64); c.stroke(); c.beginPath(); c.moveTo(0, i); c.lineTo(64, i); c.stroke(); }
    const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(12, 6);
    const net = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
    const post = new THREE.CylinderGeometry(PITCH.postR, PITCH.postR, goalH, 10), bar = new THREE.CylinderGeometry(PITCH.postR, PITCH.postR, goalW + 0.12, 10); bar.rotateX(Math.PI / 2);
    const depth = 1.2, c2 = this.g.world.collision;
    for (const e of [-1, 1]) {
      const gx = e * L / 2, grp = new THREE.Group(); grp.name = 'five-a-side-goal';
      for (const z of [-goalW / 2, goalW / 2]) { const m = new THREE.Mesh(post, white); m.position.set(gx, goalH / 2, z); m.castShadow = true; grp.add(m); const back = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, goalH, 6), white); back.position.set(gx + e * depth, goalH / 2, z); grp.add(back); }
      const b = new THREE.Mesh(bar, white); b.position.set(gx, goalH, 0); b.castShadow = true; grp.add(b);
      const backNet = new THREE.Mesh(new THREE.PlaneGeometry(goalW, goalH), net); backNet.rotation.y = Math.PI / 2; backNet.position.set(gx + e * depth, goalH / 2, 0); grp.add(backNet);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(depth, goalW), net); top.rotation.x = -Math.PI / 2; top.position.set(gx + e * depth / 2, goalH, 0); grp.add(top);
      for (const z of [-goalW / 2, goalW / 2]) { const side = new THREE.Mesh(new THREE.PlaneGeometry(depth, goalH), net); side.position.set(gx + e * depth / 2, goalH / 2, z); grp.add(side); }
      this.frame.add(grp);
      if (!this.noColliders) for (const z of [-goalW / 2, goalW / 2]) { const w = this.toWorld(gx, z); c2.addCircle(w.x, w.z, 0.12); const wb = this.toWorld(gx + e * depth, z); c2.addCircle(wb.x, wb.z, 0.08); }
    }
  }

  /** Touchline board, bench and a scoreboard whose face the match updates. */
  buildFurniture() {
    const { L, W } = PITCH, f = this.frame, wood = new THREE.MeshStandardMaterial({ color: '#7b5a3c', roughness: 0.8 }), steel = new THREE.MeshStandardMaterial({ color: '#59666a', metalness: 0.5, roughness: 0.6 });
    const sign = (text, w, h, bg, fg) => { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w); const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = fg; c.font = `800 ${Math.round(cv.height * 0.42)}px system-ui, Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, cv.width / 2, cv.height / 2, cv.width - 40); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }); };
    // pitch-side board where the organiser stands
    const board = new THREE.Mesh(new THREE.BoxGeometry(5, 0.9, 0.08), [steel, steel, steel, steel, sign('5-A-SIDE · FRIENDLIES · PLAY HERE', 5, 0.9, '#173f2c', '#ffe7a3'), steel]);
    board.position.set(-4.5, 0.75, W / 2 + 4.2); f.add(board); // text faces the main stand side and the camera
    for (const x of [-6.8, -2.2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), steel); leg.position.set(x, 0.3, W / 2 + 4.2); f.add(leg); }
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 0.45), wood); bench.position.set(4, 0.45, W / 2 + 3.6); f.add(bench);
    for (const x of [2.6, 5.4]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.4), steel); leg.position.set(x, 0.22, W / 2 + 3.6); f.add(leg); }
    // corner flags
    const flagMat = new THREE.MeshStandardMaterial({ color: '#f2a20c', side: THREE.DoubleSide });
    for (const x of [-L / 2, L / 2]) for (const z of [-W / 2, W / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.3, 5), steel); p.position.set(x, 0.65, z); f.add(p); const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), flagMat); fl.position.set(x + 0.17, 1.15, z); f.add(fl); }
    // scoreboard behind the far touchline, facing the main side
    this.sbCanvas = document.createElement('canvas'); this.sbCanvas.width = 512; this.sbCanvas.height = 160;
    this.sbTex = new THREE.CanvasTexture(this.sbCanvas); this.sbTex.colorSpace = THREE.SRGBColorSpace;
    const face = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 2), new THREE.MeshBasicMaterial({ map: this.sbTex, toneMapped: false }));
    face.position.set(0, 4.1, -W / 2 - 4.8); f.add(face);
    const back = new THREE.Mesh(new THREE.BoxGeometry(6.7, 2.3, 0.2), steel); back.position.set(0, 4.1, -W / 2 - 4.92); f.add(back);
    for (const x of [-2.6, 2.6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 3, 0.16), steel); leg.position.set(x, 1.5, -W / 2 - 4.95); f.add(leg); const w = this.toWorld(x, -W / 2 - 4.95); this.g.world.collision.addCircle(w.x, w.z, 0.15); }
    this.scoreboard(null);
  }

  /** Draw the scoreboard: idle text, or { home, away, score:[a,b], clock, half }. */
  scoreboard(s) {
    const c = this.sbCanvas.getContext('2d'), W = 512, H = 160;
    c.fillStyle = '#101512'; c.fillRect(0, 0, W, H); c.strokeStyle = '#f2a20c'; c.lineWidth = 6; c.strokeRect(3, 3, W - 6, H - 6);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if (!s) { c.fillStyle = '#ffd35a'; c.font = '800 42px system-ui, Arial'; c.fillText('5-A-SIDE', W / 2, 58); c.fillStyle = '#e6efe9'; c.font = '600 26px system-ui, Arial'; c.fillText('Friendlies · daily 6am–10pm', W / 2, 112); }
    else {
      c.fillStyle = '#e6efe9'; c.font = '700 26px system-ui, Arial'; c.fillText(s.home.slice(0, 14).toUpperCase(), 120, 42); c.fillText(s.away.slice(0, 14).toUpperCase(), 392, 42);
      c.fillStyle = '#ffd35a'; c.font = '800 72px system-ui, Arial'; c.fillText(String(s.score[0]), 120, 106); c.fillText(String(s.score[1]), 392, 106);
      c.fillStyle = '#9fe3b0'; c.font = '700 34px system-ui, Arial'; c.fillText(s.clock, W / 2, 84); c.font = '600 20px system-ui, Arial'; c.fillText(s.half, W / 2, 124);
    }
    this.sbTex.needsUpdate = true;
  }

  open() { const h = this.g.clock.minutes / 60; return h >= PITCH_HOURS[0] && h < PITCH_HOURS[1]; }
  why() {
    const g = this.g;
    if (!this.open()) return 'The pitch is open from 6am to 10pm (Onitsha time).';
    if ((g.needs?.energy ?? 100) < 20) return 'You are too tired to play. Rest or eat first (Energy 20+).';
    if ((g.needs?.state?.hunger ?? 100) < 15) return 'Eat something before you play (Hunger 15+).';
    return g.activities?.blocked() ?? null;
  }

  view() {
    const g = this.g, f = ensureActivities(g.saveData).football, st = footballStanding(f), o = this.opts;
    const opp = OPPONENTS[o.opp], lvl = LEVELS[o.level], len = LENGTHS[o.length], why = this.why();
    const cycle = (k, n) => () => { this.opts[k] = (this.opts[k] + 1) % n; g.openChoice(() => this.view()); };
    return {
      title: '5-a-side · Chuba Ikpeazu Memorial Stadium', kicker: g.events?.active('cup') ? 'COMMUNITY CUP DAY · FRIENDLIES ALSO OPEN' : 'FRIENDLY MATCH · NO ENTRY FEE',
      text: `You play for your own side against a local team. Friendlies pay no money: you earn Fitness XP, football standing and achievements. Record ${f.won}W ${f.drawn}D ${f.lost}L · ${f.goals} goals · ${st.label}.`,
      note: why ?? 'Controls are shown when the match starts. Esc or ❚❚ pauses; you can leave at any time (no result is recorded).',
      options: [
        { label: 'Kick off', primary: true, disabled: !!why, why: why ?? '', act: () => this.startMatch() },
        { label: `Opponents: ${opp.name}`, sub: 'Tap to change', act: cycle('opp', OPPONENTS.length) },
        { label: `Difficulty: ${lvl.label}`, sub: 'Tap to change', act: cycle('level', LEVELS.length) },
        { label: `Length: ${len.label}`, sub: 'Tap to change', act: cycle('length', LENGTHS.length) },
        ...(g.events?.active('cup') ? [{ label: `Community Cup match · ₦${EVENTS[0].entry.toLocaleString()} entry → win ₦${EVENTS[0].prize.toLocaleString()}`, sub: `Today only · ${g.events.claimsLeft('cup')} prize match${g.events.claimsLeft('cup') === 1 ? '' : 'es'} left · entry paid once at kick-off, not refunded if you leave`, disabled: !!why || g.events.claimsLeft('cup') <= 0 || g.economy.balance < EVENTS[0].entry, why: why ?? (g.events.claimsLeft('cup') <= 0 ? 'No prize matches left today' : 'Not enough money'), act: () => this.startMatch(this.opts, { cup: true }) }] : []),
        { label: 'Match record & achievements', act: () => g.openChoice(() => this.recordView()) },
        { label: 'Not now', ghost: true, act: () => g.closeChoice() },
      ],
    };
  }

  recordView() {
    const g = this.g, f = ensureActivities(g.saveData).football, st = footballStanding(f);
    const recent = f.history.slice(0, 5).map((h) => `${h.outcome === 'win' ? 'W' : h.outcome === 'loss' ? 'L' : 'D'} ${h.score[0]}–${h.score[1]} v ${h.opp}`);
    return { title: 'Your football record', kicker: `${st.label.toUpperCase()} · ${st.points} POINTS`,
      text: `Played ${f.played} · Won ${f.won} · Drawn ${f.drawn} · Lost ${f.lost} · Goals for ${f.gf}, against ${f.ga} · Your goals ${f.goals}, assists ${f.assists}${f.abandoned ? ` · Left early ${f.abandoned}` : ''}.`,
      note: recent.length ? `Recent: ${recent.join(' · ')}` : 'No matches played yet.',
      sections: [{ heading: `Achievements ${f.achievements.length}/${Object.keys(FOOTBALL_ACHIEVEMENTS).length}`, options: Object.entries(FOOTBALL_ACHIEVEMENTS).map(([id, a]) => {
        const got = f.achievements.includes(id); return { label: `${got ? '★' : '☆'} ${a.label}`, sub: got ? a.note : `Locked — ${a.note}`, disabled: !got, why: `Locked — ${a.note}`, act: () => {} }; }) }],
      options: [{ label: 'Back', primary: true, act: () => g.openChoice(() => this.view()) }] };
  }

  /** v0.48: the whole stadium field for 11-a-side league matches: full-size goals and markings, built once when needed. */
  ensure11() {
    if (this.frame11) return this.frame11;
    const f5 = this.frame, f = this.frame11 = new THREE.Group(); f.name = 'ElevenASidePitch'; f.visible = false; this.stadium.group.add(f); this.stadium.group.updateMatrixWorld(true);
    this.frame = f; setPitchFormat('11'); this.noColliders = true;
    try { this.buildMarkings(); this.buildGoals(); } finally { this.noColliders = false; setPitchFormat('5'); this.frame = f5; }
    return f;
  }
  /** Switch the pitch the match uses (and show only that pitch's goals and lines). */
  useFormat(format) {
    const eleven = format === '11'; if (eleven) this.ensure11();
    if (!this.frame5) this.frame5 = this.frame;
    for (const o of this.frame5.children) if (o.name !== 'FootballMatch') o.visible = !eleven;
    if (this.frame11) this.frame11.visible = eleven;
    this.frame = eleven ? this.frame11 : this.frame5; setPitchFormat(eleven ? '11' : '5');
  }
  startMatch(opts = this.opts, { cup = false, format = '5', league = null } = {}) {
    const why = this.why(); if (why) { this.g.ui.toast(why); return false; }
    let cupInfo = null;
    if (cup) {
      const ev = this.g.events, e = ev?.active('cup') ? EVENTS.find((x) => x.id === 'cup') : null;
      if (!e) { this.g.ui.toast('The Community Cup is not on now.'); return false; }
      if (ev.claimsLeft('cup') <= 0) { this.g.ui.toast('You have played all your prize matches today.'); return false; }
      if (this.g.economy.balance < e.entry) { this.g.ui.toast(`You need ₦${e.entry.toLocaleString()} for the entry.`); return false; }
      cupInfo = { entry: e.entry, prize: e.prize };
    }
    const opp = league ? { ...OPPONENTS[opts.opp], name: league } : OPPONENTS[opts.opp], act = new FootballActivity(this.g, this, { opponent: opp, difficulty: LEVELS[opts.level].id, halfSeconds: LENGTHS[opts.length].half, cup: cupInfo, format });
    return this.g.activities.start(act);
  }
}
