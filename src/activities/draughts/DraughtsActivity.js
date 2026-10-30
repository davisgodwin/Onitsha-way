import * as THREE from 'three';
import { DraughtsGame, sq } from './Draughts.js';
import { SportSounds } from '../../audio/SportSounds.js';
import { recordGame } from '../ActivityRecords.js';

/**
 * Draughts against a parlour regular. The board is shown as a large, tappable 10 × 10 grid over the table
 * (the 3D board on the table follows the same position). Mouse/touch: tap a piece, then a highlighted square.
 * Keyboard: arrows/WASD move the cursor, Space or Enter selects.
 */
export class DraughtsActivity {
  constructor(g, venue, { opponent = 'Papa Ifeanyi', difficulty = 'normal' } = {}) {
    Object.assign(this, { g, venue, opponent, difficulty, kind: 'draughts', title: 'Draughts' });
    this.sel = null; this.cursor = sq(6, 1); this.aiT = 0; this.last = null; this.recorded = null;
    this.controls = {
      desktop: 'Click a piece, then a highlighted square · or arrows/WASD + Space · Esc pause',
      touchHint: 'Tap a piece, then a highlighted square',
      desktopHelp: 'You play White (bottom) and move first.\nMen move one square diagonally forward and capture forwards or backwards. Kings move and capture any distance along a diagonal.\nCapturing is compulsory and you must take the most pieces possible — only those moves are highlighted.\nReach the far row to crown a king. Win when your opponent has no move left.\nDraw after 25 king moves each without a capture, or the same position three times.',
      touchHelp: 'You play White (bottom) and move first. Tap one of your pieces, then a highlighted square. Capturing is compulsory and you must take the most pieces possible.\nReach the far row to crown a king. Win when your opponent has no move left.',
      touch: [],
    };
  }

  begin(mgr) {
    const g = this.g; this.mgr = mgr;
    this.game = new DraughtsGame({ difficulty: this.difficulty, seed: (Math.random() * 4294967295) >>> 0 });
    this.sounds = new SportSounds(g.audio);
    const el = this.el = document.createElement('div'); el.className = 'dr-wrap'; el.setAttribute('role', 'grid'); el.setAttribute('aria-label', 'Draughts board');
    const board = this.boardEl = document.createElement('div'); board.className = 'dr-board'; el.appendChild(board);
    this.cells = [];
    for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
      const s = sq(r, c), cell = document.createElement('button'); cell.type = 'button'; cell.className = 'dr-cell ' + ((r + c) % 2 ? 'dark' : 'light'); cell.dataset.sq = s;
      if ((r + c) % 2) { cell.addEventListener('click', () => { this.tap(s); cell.blur(); }); cell.setAttribute('aria-label', `row ${10 - r}, column ${'abcdefghij'[c]}`); } else cell.tabIndex = -1;
      board.appendChild(cell); this.cells[s] = cell;
    }
    mgr.el.appendChild(el);
    this.onKey = (e) => {
      if (g.state !== 'activity' || mgr.paused || mgr.panelOpen || document.activeElement?.classList?.contains('dr-cell')) return;
      const map = { ArrowUp: [-1, 0], KeyW: [-1, 0], ArrowDown: [1, 0], KeyS: [1, 0], ArrowLeft: [0, -1], KeyA: [0, -1], ArrowRight: [0, 1], KeyD: [0, 1] };
      if (map[e.code]) { const [dr, dc] = map[e.code], r = Math.max(0, Math.min(9, Math.floor(this.cursor / 10) + dr)), c = Math.max(0, Math.min(9, this.cursor % 10 + dc)); this.cursor = sq(r, c); this.render(); e.preventDefault(); }
      else if (e.code === 'Space' || e.code === 'Enter') { if ((Math.floor(this.cursor / 10) + this.cursor % 10) % 2) this.tap(this.cursor); e.preventDefault(); }
    };
    window.addEventListener('keydown', this.onKey);
    g.player.human.group.visible = false;
    const cam = g.renderer.camera, top = this.venue.site.at(3.7, -1.8);
    const p = this.venue.site.at(3.7, -0.4); cam.position.set(p.x, 2.1, p.z); cam.lookAt(top.x, 0.79, top.z);
    this.render(); this.status();
  }

  tap(s) {
    const game = this.game; if (game.result || game.side !== 1) return;
    this.cursor = s;
    const mine = game.moves.filter((m) => m.from === s);
    if (mine.length) { this.sel = s; this.render(); return; }
    if (this.sel != null) {
      const m = game.moves.find((x) => x.from === this.sel && x.to === s);
      if (m) { this.play(m); return; }
    }
    if (game.board[s] > 0) this.say(game.moves[0]?.captured.length ? 'You must capture — and take the most pieces possible' : 'That piece cannot move', 1.8);
    this.sel = null; this.render();
  }

  play(m) {
    const game = this.game, side = game.side, crown = Math.abs(game.board[m.from]) === 1;
    game.play(m); this.last = m; this.sel = null; this.aiT = 0;
    this.sounds.click(0.5); if (m.captured.length) setTimeout(() => this.sounds.click(0.8), 90);
    if (crown && Math.abs(game.board[m.to]) === 2) this.say(side === 1 ? 'Crowned! Your king can fly' : `${this.opponent} crowned a king`, 2);
    else if (m.captured.length) this.say(side === 1 ? `You took ${m.captured.length}` : `${this.opponent} took ${m.captured.length}`, 1.6);
    this.render(); this.status();
    this.venue.drawBoard?.(game.board);
    if (game.result) this.finish();
  }

  update(dt) {
    const game = this.game;
    if (this.statusT > 0) { this.statusT -= dt; if (this.statusT <= 0) this.status(); }
    if (!game.result && game.side === -1) { this.aiT += dt; if (this.aiT > 0.7) { this.aiT = -99; const m = game.think(); if (m) this.play(m); } }
    this.mgr.pressed('jump', 'primary', 'interact');
  }
  idle() {}
  say(t, secs = 1.6) { this.mgr.setStatus(t); this.statusT = secs; }
  status() {
    const game = this.game; if (game.result) return;
    const w = game.count(1), b = game.count(-1), span = (cls, t) => { const e = document.createElement('span'); e.className = cls; e.textContent = t; return e; };
    this.mgr.setScore([span('team home', `${game.side === 1 ? '▶ ' : ''}You · ${w.men}${w.kings ? ` + ${w.kings}K` : ''}`), span('goals', 'Draughts'), span('team away', `${game.side === -1 ? '▶ ' : ''}${this.opponent} · ${b.men}${b.kings ? ` + ${b.kings}K` : ''}`)]);
    if (this.statusT > 0) return;
    this.mgr.setStatus(game.side === 1 ? (game.moves[0]?.captured.length ? `Your move — capture ${game.moves[0].captured.length}` : 'Your move') : `${this.opponent} is thinking…`);
  }
  render() {
    const game = this.game, b = game.board, dests = new Set(this.sel != null ? game.moves.filter((m) => m.from === this.sel).map((m) => m.to) : []);
    const movable = new Set(game.side === 1 ? game.moves.map((m) => m.from) : []), lastPath = new Set(this.last?.path ?? []);
    for (let s = 0; s < 100; s++) {
      const cell = this.cells[s]; const p = b[s];
      cell.classList.toggle('sel', s === this.sel); cell.classList.toggle('dest', dests.has(s)); cell.classList.toggle('movable', movable.has(s) && this.sel == null);
      cell.classList.toggle('last', lastPath.has(s)); cell.classList.toggle('cursor', s === this.cursor && !this.g.touch);
      cell.classList.toggle('captured-now', !!this.last?.captured.includes(s));
      const want = p ? `dr-piece ${p > 0 ? 'w' : 'b'}${Math.abs(p) === 2 ? ' k' : ''}` : '';
      if (cell.dataset.p !== want) { cell.dataset.p = want; cell.replaceChildren(); if (p) { const piece = document.createElement('span'); piece.className = want; cell.appendChild(piece); } }
    }
  }

  finish() {
    const g = this.g, game = this.game, mgr = this.mgr, w = game.result.winner;
    const won = w === 1 ? true : w === -1 ? false : 'draw';
    const rec = recordGame(g.saveData, 'draughts', mgr.matchId, { won });
    this.recorded = rec;
    let prize = 0;
    if (rec.ok && !rec.duplicate) {
      g.needs?.adjust({ fun: won === true ? 12 : 8, social: 8 }); g.skills?.add('hustle', won === true ? 15 : 6);
      if (won === true && this.difficulty === 'hard' && g.events?.active('draughts-sunday')) { const p = g.events.payPrize('draughts-sunday', `draughts:sunday-prize:${g.clock.day}`, 1000, 'Sunday draughts challenge prize'); if (p.ok) prize = 1000; }
      mgr.finished(); g.saveGameNow();
    }
    const r = rec.record ?? {};
    setTimeout(() => mgr.panel({ kicker: `DRAUGHTS · ${this.difficulty.toUpperCase()}`, title: won === true ? 'You won!' : won === false ? `${this.opponent} won` : 'Draw', text: game.result.reason,
      lines: [{ label: 'Moves played', value: String(Math.ceil(game.moveNo / 2)) }, { label: 'Pieces left (you · them)', value: `${game.count(1).men + game.count(1).kings} · ${game.count(-1).men + game.count(-1).kings}` }, { label: 'Record', value: `${r.won ?? 0}W ${r.drawn ?? 0}D ${r.lost ?? 0}L` }, { label: 'Reward', value: rec.duplicate ? 'Already recorded' : `+${won === true ? 15 : 6} Hustle XP${prize ? ' · Sunday prize ₦1,000' : ''}` }],
      buttons: [{ label: 'Play again', primary: true, act: () => { const v = this.venue, d = this.difficulty; mgr.end(); v.startDraughts(d); } }, { label: 'Leave the table', act: () => mgr.end() }] }), 900);
  }
  pauseText() { return 'Leaving now ends the game with no result.'; }
  focus() { return this.venue.site.at(3.7, -1.8); }
  end() { window.removeEventListener('keydown', this.onKey); this.el?.remove(); this.venue.drawBoard?.(null); }
}
