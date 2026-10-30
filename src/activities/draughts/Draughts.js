/**
 * International draughts (10 × 10), the board played in Nigerian parlours and parks. Pure JavaScript.
 *
 * Board: squares 0…99 (row * 10 + col); only dark squares ((row + col) odd) are used. White starts on rows 6–9 and
 * moves up (towards row 0) and moves first; Black starts on rows 0–3.
 * Pieces: 1 white man, 2 white king, −1 black man, −2 black king, 0 empty.
 *
 * Rules implemented:
 *  - Men move one square diagonally forward; they capture forwards and backwards.
 *  - Kings fly: any distance along a diagonal; they capture a piece at any distance and may land on any empty
 *    square beyond it.
 *  - Capturing is compulsory and you must take the maximum number of pieces available (men and kings count the same).
 *    Captured pieces are removed only when the move ends and cannot be jumped twice.
 *  - A man becomes a king if it ends its move on the far row (passing through it during a capture does not crown).
 *  - You lose when you have no legal move (no pieces left, or all blocked).
 *  - Draw: 25 moves each with only kings moving and nothing captured, or the same position three times.
 */
const DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const on = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 10;
export const sq = (r, c) => r * 10 + c;

export function initialBoard() {
  const b = new Array(100).fill(0);
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) if ((r + c) % 2) { if (r < 4) b[sq(r, c)] = -1; else if (r > 5) b[sq(r, c)] = 1; }
  return b;
}

/** All legal moves for `side` (1 white, −1 black): [{from, to, path:[…], captured:[…]}]. */
export function legalMoves(board, side) {
  let caps = [];
  for (let s = 0; s < 100; s++) if (board[s] * side > 0) caps.push(...captures(board, s));
  if (caps.length) { const max = Math.max(...caps.map((m) => m.captured.length)); return dedupe(caps.filter((m) => m.captured.length === max)); }
  const out = [];
  for (let s = 0; s < 100; s++) {
    const p = board[s]; if (p * side <= 0) continue;
    const r = Math.floor(s / 10), c = s % 10;
    for (const [dr, dc] of DIRS) {
      if (Math.abs(p) === 1) { if (dr !== -side) continue; const nr = r + dr, nc = c + dc; if (on(nr, nc) && board[sq(nr, nc)] === 0) out.push({ from: s, to: sq(nr, nc), path: [s, sq(nr, nc)], captured: [] }); }
      else for (let k = 1; ; k++) { const nr = r + dr * k, nc = c + dc * k; if (!on(nr, nc) || board[sq(nr, nc)] !== 0) break; out.push({ from: s, to: sq(nr, nc), path: [s, sq(nr, nc)], captured: [] }); }
    }
  }
  return out;
}
function dedupe(moves) { const seen = new Set(); return moves.filter((m) => { const k = m.from + ':' + m.to + ':' + [...m.captured].sort((a, b) => a - b).join(','); if (seen.has(k)) return false; seen.add(k); return true; }); }

function captures(board, from) {
  const piece = board[from], side = Math.sign(piece), king = Math.abs(piece) === 2, out = [];
  const walk = (at, path, taken) => {
    const r = Math.floor(at / 10), c = at % 10; let extended = false;
    for (const [dr, dc] of DIRS) {
      if (!king) {
        const mr = r + dr, mc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc; if (!on(lr, lc)) continue;
        const mid = sq(mr, mc), land = sq(lr, lc);
        if (board[mid] * side < 0 && !taken.includes(mid) && (board[land] === 0 || land === from)) { extended = true; walk(land, [...path, land], [...taken, mid]); }
      } else {
        let k = 1, enemy = -1;
        for (; ; k++) { const nr = r + dr * k, nc = c + dc * k; if (!on(nr, nc)) break; const s = sq(nr, nc); if (board[s] === 0 || s === from) continue; if (board[s] * side < 0 && !taken.includes(s)) enemy = s; break; }
        if (enemy < 0) continue;
        const er = Math.floor(enemy / 10), ec = enemy % 10;
        for (let j = 1; ; j++) { const nr = er + dr * j, nc = ec + dc * j; if (!on(nr, nc)) break; const s = sq(nr, nc); if (board[s] !== 0 && s !== from) break; extended = true; walk(s, [...path, s], [...taken, enemy]); }
      }
    }
    if (!extended && taken.length) out.push({ from, to: at, path, captured: taken });
  };
  walk(from, [from], []);
  return out;
}

/** Apply a move to a copy of the board; returns the new board. */
export function applyMove(board, m) {
  const b = board.slice(), p = b[m.from]; b[m.from] = 0; for (const c of m.captured) b[c] = 0;
  const r = Math.floor(m.to / 10); b[m.to] = Math.abs(p) === 1 && ((p > 0 && r === 0) || (p < 0 && r === 9)) ? p * 2 : p;
  return b;
}

const MAN = 100, KING = 320;
/** Static evaluation from White's point of view. */
export function evaluate(b) {
  let s = 0;
  for (let i = 0; i < 100; i++) {
    const p = b[i]; if (!p) continue;
    const r = Math.floor(i / 10), c = i % 10;
    if (p === 1) s += MAN + (9 - r) * 3 + (c > 2 && c < 7 ? 4 : 0) + (r === 9 ? 6 : 0);
    else if (p === -1) s -= MAN + r * 3 + (c > 2 && c < 7 ? 4 : 0) + (r === 0 ? 6 : 0);
    else if (p === 2) s += KING; else if (p === -2) s -= KING;
  }
  return s;
}

function search(b, side, depth, alpha, beta, deadline, stats) {
  stats.n++;
  const moves = legalMoves(b, side);
  if (!moves.length) return -100000 - depth;
  if (depth <= 0 && !moves[0].captured.length) return side * evaluate(b);
  if (performance.now() > deadline) return side * evaluate(b);
  moves.sort((x, y) => y.captured.length - x.captured.length);
  let best = -Infinity;
  for (const m of moves) {
    const v = -search(applyMove(b, m), -side, depth - 1, -beta, -alpha, deadline, stats);
    if (v > best) best = v; if (v > alpha) alpha = v; if (alpha >= beta) break;
  }
  return best;
}

export const DRAUGHTS_LEVELS = { easy: { depth: 1, noise: 60, ms: 120 }, normal: { depth: 3, noise: 12, ms: 350 }, hard: { depth: 6, noise: 0, ms: 900 } };

export class DraughtsGame {
  constructor({ difficulty = 'normal', seed = 1, userSide = 1 } = {}) {
    this.board = initialBoard(); this.side = 1; this.userSide = userSide; this.level = DRAUGHTS_LEVELS[difficulty] ?? DRAUGHTS_LEVELS.normal; this.difficulty = DRAUGHTS_LEVELS[difficulty] ? difficulty : 'normal';
    let s = seed >>> 0 || 3; this.rand = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    this.result = null; this.history = []; this.kingOnly = 0; this.seen = new Map(); this.moveNo = 0; this.note(); this.moves = legalMoves(this.board, this.side);
  }
  note() { const k = this.board.join(',') + '|' + this.side; this.seen.set(k, (this.seen.get(k) ?? 0) + 1); return this.seen.get(k); }
  count(side) { let m = 0, k = 0; for (const p of this.board) { if (p === side) m++; else if (p === 2 * side) k++; } return { men: m, kings: k }; }
  /** Play a legal move (object from this.moves, or {from,to} to pick the matching one). */
  play(mv) {
    if (this.result) return false;
    const m = this.moves.find((x) => x === mv || (x.from === mv.from && x.to === mv.to && (!mv.captured || x.captured.join() === mv.captured.join())));
    if (!m) return false;
    const piece = this.board[m.from];
    this.board = applyMove(this.board, m); this.history.push({ ...m, side: this.side, piece }); this.moveNo++;
    this.kingOnly = !m.captured.length && Math.abs(piece) === 2 ? this.kingOnly + 1 : 0;
    this.side = -this.side; this.moves = legalMoves(this.board, this.side);
    const reps = this.note();
    if (!this.moves.length) this.result = { winner: -this.side, reason: this.count(this.side).men + this.count(this.side).kings ? 'No legal moves left' : 'All pieces captured' };
    else if (this.kingOnly >= 50) this.result = { winner: 0, reason: '25 king moves each without a capture' };
    else if (reps >= 3) this.result = { winner: 0, reason: 'Same position three times' };
    else if (this.moveNo >= 400) this.result = { winner: 0, reason: 'Move limit reached' };
    return m;
  }
  /** AI move for the side to play (iterative deepening alpha-beta within a time budget). */
  think() {
    const side = this.side, moves = this.moves; if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    const deadline = performance.now() + this.level.ms, stats = { n: 0 };
    let scored = moves.map((m) => ({ m, v: 0 }));
    for (let d = 1; d <= this.level.depth; d++) {
      const next = []; let timedOut = false;
      for (const s of scored) { const v = -search(applyMove(this.board, s.m), -side, d - 1, -Infinity, Infinity, deadline, stats); next.push({ m: s.m, v }); if (performance.now() > deadline) { timedOut = true; break; } }
      if (next.length === scored.length) scored = next.sort((a, b) => b.v - a.v);
      if (timedOut) break;
    }
    const noise = this.level.noise; let best = null, bv = -Infinity;
    for (const s of scored) { const v = s.v + (this.rand() - 0.5) * 2 * noise; if (v > bv) { bv = v; best = s.m; } }
    return best;
  }
}
