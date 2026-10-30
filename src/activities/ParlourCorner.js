import * as THREE from 'three';
import { VenueSite, openAt } from './VenueKit.js';
import { buildPoolTable, syncBalls } from './pool/PoolTable3D.js';
import { PoolGame } from './pool/PoolGame.js';
import { PoolActivity } from './pool/PoolActivity.js';
import { ensureActivities, POOL_ACHIEVEMENTS } from './ActivityRecords.js';
import { naira } from '../economy/Economy.js';
import { DraughtsActivity } from './draughts/DraughtsActivity.js';
import { initialBoard } from './draughts/Draughts.js';

export const POOL_OPPONENTS = [
  { id: 'chuka', name: 'Chuka', difficulty: 'easy', note: 'Plays for fun; misses the long ones' },
  { id: 'ebuka', name: 'Ebuka "Long Cue"', difficulty: 'normal', note: 'Regular at the table' },
  { id: 'ngozi', name: 'Madam Ngozi', difficulty: 'hard', note: 'Owns the table. Rarely misses' },
];
export const POOL_STAKES = [{ stake: 0, payout: 0, label: 'Free game' }, { stake: 200, payout: 350 }, { stake: 500, payout: 900 }];
export const PARLOUR_HOURS = [11, 23];

/**
 * Covered pool & draughts corner beside Market Corner Beer Parlour: a real table you walk up to, two regulars
 * watching from the bench, and a draughts table. Open 11:00–23:00 (Onitsha time) like the parlour.
 */
export class ParlourCorner {
  constructor(g) { this.g = g; this.name = 'Market Corner Pool & Draughts'; this.poolOpts = { opp: 1, stake: 0 }; }
  setup() {
    const g = this.g, bar = g.cityLife?.venues?.find((v) => v.id === 'market-parlour');
    const near = bar ? { x: bar.x + 6, z: bar.z + 6 } : g.world.landmarks.get('main-market');
    const s = this.site = new VenueSite(g, 'parlour-corner', near, { w: 10, d: 9 });
    // concrete pad, zinc canopy on posts, low back wall
    s.box(10, 0.12, 9, 0, 0.06, -4.5, '#a9a397');
    for (const u of [-4.7, 4.7]) for (const w of [-0.4, -8.6]) s.box(0.16, 3, 0.16, u, 1.5, w, '#5c5f5a', true);
    const roof = s.box(10.6, 0.06, 9.6, 0, 3.05, -4.5, '#8c979a', false, { metalness: 0.4, roughness: 0.5 }); roof.rotation.x = 0.05;
    s.box(10, 1.1, 0.2, 0, 0.55, -8.9, '#d9cdb4', true);
    s.box(10.4, 0.45, 0.1, 0, 2.85, 0.35, '#7a1f2b');
    s.sign('POOL • DRAUGHTS • MARKET CORNER', 7.5, 0.42, 0, 2.85, 0.41, '#7a1f2b', '#fff0c9');
    // benches and the regulars watching
    for (const u of [-3, 3]) { s.box(2.2, 0.08, 0.45, u, 0.46, -8.3, '#6e4a2f', true); for (const k of [-0.9, 0.9]) s.box(0.08, 0.42, 0.4, u + k, 0.21, -8.3, '#4b3220'); }
    s.person(0, -3.4, -8.3, 0, { name: 'Obiora', activity: 'drink', seatY: 0.5, schedule: PARLOUR_HOURS });
    s.person(1, 2.6, -8.3, 0, { name: 'Chinwe', gender: 'female', activity: 'drink', seatY: 0.5, schedule: PARLOUR_HOURS });
    s.person(2, -4.1, -5.6, Math.PI / 2, { name: 'Tobe', schedule: PARLOUR_HOURS });
    // the pool table
    const tg = new THREE.Group(); tg.position.set(0, 0.12, -4.6); s.group.add(tg);
    this.table = buildPoolTable(tg); s.solid(0, -4.6, 2.35, 1.4, 1);
    s.box(0.9, 0.12, 0.4, 0, 2.75, -4.6, '#1d3b2f'); s.box(0.7, 0.03, 0.25, 0, 2.68, -4.6, '#fff4d8', false, { emissive: '#ffe8b0', emissiveIntensity: 1.2 }); s.box(0.02, 0.3, 0.02, 0, 2.95, -4.6, '#222');
    this.rackIdle();
    // draughts table
    s.box(0.8, 0.06, 0.8, 3.7, 0.75, -1.8, '#8b6440', true); s.box(0.1, 0.72, 0.1, 3.7, 0.37, -1.8, '#4b3220');
    this.board = this.boardMesh(); this.board.position.set(3.7, 0.79, -1.8); s.group.add(this.board);
    for (const w of [-2.55, -1.05]) s.box(0.35, 0.45, 0.35, 3.7, 0.23, w, '#6e4a2f');
    s.person(3, 3.7, -2.55, 0, { name: 'Papa Ifeanyi', activity: 'drink', seatY: 0.45, schedule: PARLOUR_HOURS });
    // interactions
    s.interact(0, -3.3, () => '8-ball pool — play a game', () => g.openChoice(() => this.poolView()), { radius: 2 });
    s.interact(3.7, -0.7, () => 'Draughts — play Papa Ifeanyi', () => g.openChoice(() => this.draughtsView()), { radius: 1.6, priority: 2 });
  }
  boardMesh() {
    const c = this.boardCanvas = document.createElement('canvas'); c.width = c.height = 256;
    const t = this.boardTex = new THREE.CanvasTexture(c); t.userData.keepCanvas = true; t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.5), [null, null, new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 }), null, null, null].map((x) => x ?? new THREE.MeshStandardMaterial({ color: '#4b3220' })));
    this.drawBoard(null); return m;
  }
  /** Balls racked on the table between games. */
  rackIdle() { const idle = new PoolGame({ seed: 4 }); syncBalls(this.table.balls, idle); }
  places() { return this.site ? [{ ...this.site.at(0, -1), kind: 'venue', label: this.name }] : []; }
  open() { return openAt(this.g.clock.minutes / 60, PARLOUR_HOURS); }

  poolView() {
    const g = this.g, o = this.poolOpts, opp = POOL_OPPONENTS[o.opp], st = POOL_STAKES[o.stake], p = ensureActivities(g.saveData).pool;
    const why = !this.open() ? 'The parlour table is open 11am–11pm (Onitsha time).' : st.stake > g.economy.balance ? `You need ${naira(st.stake)} for this stake.` : g.activities.blocked();
    const cycle = (k, n) => () => { this.poolOpts[k] = (this.poolOpts[k] + 1) % n; g.openChoice(() => this.poolView()); };
    return { title: '8-ball pool · Market Corner', kicker: `TABLE OPEN ${PARLOUR_HOURS[0]}AM–${PARLOUR_HOURS[1] - 12}PM`,
      text: `One rack of 8-ball against a regular. Your record: ${p.won} won, ${p.lost} lost${p.winnings ? ` · winnings ${naira(p.winnings)}` : ''}.${(() => { const h = p.history.filter((x) => x.opp === opp.name); if (!h.length) return ''; const w = h.filter((x) => x.won).length, l = h.length - w; return ` ${opp.name.split(' ')[0]}: ${h[0].won ? '"You beat me last time. Today I go collect my revenge."' : '"You want another beating?"'} (${w}–${l} between you).`; })()}`,
      note: why ?? (st.stake ? `Stake: ${naira(st.stake)} is paid once when the game starts. Win and the table pays you ${naira(st.payout)}. Lose, or leave before the end, and the stake is not refunded.` : 'Free game: no money changes hands.'),
      options: [
        { label: 'Rack them up', primary: true, disabled: !!why, why: why ?? '', act: () => this.startPool() },
        { label: `Opponent: ${opp.name} (${opp.difficulty})`, sub: `${opp.note} · tap to change`, act: cycle('opp', POOL_OPPONENTS.length) },
        { label: `Stake: ${st.stake ? `${naira(st.stake)} → win ${naira(st.payout)}` : 'Free game'}`, sub: 'Tap to change', act: cycle('stake', POOL_STAKES.length) },
        { label: 'House rules (8-ball)', act: () => g.openChoice(() => this.rulesView()) },
        { label: 'Not now', ghost: true, act: () => g.closeChoice() },
      ] };
  }
  rulesView() {
    return { title: 'House rules — 8-ball', text: 'Break from behind the line. The table is open after the break. Your first legal pot decides your group: solids (1–7) or stripes (9–15). Hit one of your own balls first every shot; after contact a ball must be potted or touch a cushion. Potting your own ball means you shoot again.',
      note: 'Fouls (white ball potted, wrong ball first, nothing hit, no cushion after contact) give your opponent ball in hand anywhere. Pot the 8 after clearing your group to win. Potting the 8 early, or with a foul, loses the game. The 8 potted on the break is put back on its spot.',
      options: [{ label: 'Back', primary: true, act: () => this.g.openChoice(() => this.poolView()) }, ...Object.values(POOL_ACHIEVEMENTS).map((a) => ({ label: `☆ ${a.label}`, sub: a.note, disabled: true, why: a.note, act: () => {} }))] };
  }
  startPool(opts = this.poolOpts) {
    const g = this.g, opp = POOL_OPPONENTS[opts.opp], st = POOL_STAKES[opts.stake];
    if (!this.open()) { g.ui.toast('The parlour table is closed now.'); return false; }
    if (st.stake > g.economy.balance) { g.ui.toast(`You need ${naira(st.stake)} for this stake.`); return false; }
    return g.activities.start(new PoolActivity(g, this, { opponent: opp, difficulty: opp.difficulty, stake: st.stake, payout: st.payout }));
  }
  draughtsView() {
    const g = this.g, r = ensureActivities(g.saveData).games.draughts ?? { won: 0, lost: 0, drawn: 0 }, lv = this.draughtsLevel ?? 1, names = ['Easy', 'Normal', 'Hard'];
    const why = !this.open() ? 'The parlour is open 11am–11pm (Onitsha time).' : g.activities.blocked();
    return { title: 'Draughts with Papa Ifeanyi', kicker: 'INTERNATIONAL DRAUGHTS · 10 × 10',
      text: `"Sit down, my pikin. Let us see what you know." Your record: ${r.won} won, ${r.drawn} drawn, ${r.lost} lost. Friendly game, no money.`,
      note: why ?? 'Capturing is compulsory and you must take the most pieces. Kings fly. You play White and move first.',
      options: [
        { label: 'Set up the board', primary: true, disabled: !!why, why: why ?? '', act: () => this.startDraughts(['easy', 'normal', 'hard'][lv]) },
        { label: `How seriously he plays: ${names[lv]}`, sub: 'Tap to change', act: () => { this.draughtsLevel = (lv + 1) % 3; g.openChoice(() => this.draughtsView()); } },
        { label: 'Not now', ghost: true, act: () => g.closeChoice() },
      ] };
  }
  startDraughts(difficulty = 'normal') {
    if (!this.open()) { this.g.ui.toast('The parlour is closed now.'); return false; }
    return this.g.activities.start(new DraughtsActivity(this.g, this, { opponent: 'Papa Ifeanyi', difficulty }));
  }
  /** Mirror a draughts position on the table's 3D board (null = starting position). */
  drawBoard(board) {
    const c = this.boardCanvas, x = c.getContext('2d'), b = board ?? initialBoard();
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { x.fillStyle = (i + j) % 2 ? '#3b2516' : '#e8d3a7'; x.fillRect(i * 25.6, j * 25.6, 25.6, 25.6); }
    for (let s = 0; s < 100; s++) { const p = b[s]; if (!p) continue; const r = Math.floor(s / 10), cc = s % 10; x.fillStyle = p > 0 ? '#f3efe6' : '#1d1b19'; x.beginPath(); x.arc(cc * 25.6 + 12.8, r * 25.6 + 12.8, 9.5, 0, 7); x.fill(); if (Math.abs(p) === 2) { x.strokeStyle = '#d4a017'; x.lineWidth = 3; x.stroke(); } }
    this.boardTex.needsUpdate = true;
  }
}
