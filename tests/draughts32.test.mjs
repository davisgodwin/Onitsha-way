import test from 'node:test';
import assert from 'node:assert/strict';
import { DraughtsGame, initialBoard, legalMoves, applyMove, sq } from '../src/activities/draughts/Draughts.js';

const empty = () => new Array(100).fill(0);

test('start: 20 men each on dark squares, White has 9 opening moves', () => {
  const b = initialBoard();
  assert.equal(b.filter((p) => p === 1).length, 20); assert.equal(b.filter((p) => p === -1).length, 20);
  for (let i = 0; i < 100; i++) if (b[i]) assert.equal((Math.floor(i / 10) + (i % 10)) % 2, 1);
  assert.equal(legalMoves(b, 1).length, 9); assert.equal(legalMoves(b, -1).length, 9);
});

test('capture is compulsory, men capture backwards, and the maximum capture must be taken', () => {
  const b = empty(); b[sq(5, 4)] = 1; b[sq(4, 5)] = -1; b[sq(6, 7)] = 1;
  let m = legalMoves(b, 1); assert.equal(m.length, 1); assert.deepEqual(m[0].captured, [sq(4, 5)]);
  const back = empty(); back[sq(4, 3)] = 1; back[sq(5, 4)] = -1; // enemy behind the white man
  m = legalMoves(back, 1); assert.equal(m.length, 1); assert.equal(m[0].to, sq(6, 5));
  const multi = empty(); multi[sq(7, 0)] = 1; multi[sq(6, 1)] = -1; multi[sq(4, 3)] = -1; multi[sq(7, 8)] = 1; multi[sq(6, 7)] = -1;
  m = legalMoves(multi, 1); assert.equal(m.length, 1, 'only the two-piece capture is allowed'); assert.equal(m[0].captured.length, 2); assert.equal(m[0].to, sq(3, 4));
});

test('kings fly and capture at a distance, landing anywhere beyond', () => {
  const b = empty(); b[sq(9, 0)] = 2; b[sq(5, 4)] = -1;
  const m = legalMoves(b, 1); assert.ok(m.length >= 2 && m.every((x) => x.captured[0] === sq(5, 4)));
  assert.ok(m.some((x) => x.to === sq(4, 5)) && m.some((x) => x.to === sq(0, 9)));
  const free = empty(); free[sq(9, 0)] = 2; assert.equal(legalMoves(free, 1).length, 9);
});

test('a piece cannot be jumped twice; captured pieces are removed at the end of the move', () => {
  const b = empty(); b[sq(5, 4)] = 2; b[sq(4, 5)] = -1;
  for (const m of legalMoves(b, 1)) assert.equal(new Set(m.captured).size, m.captured.length);
  const after = applyMove(b, legalMoves(b, 1)[0]); assert.equal(after[sq(4, 5)], 0);
});

test('men crown on the far row only at the end of a move', () => {
  const b = empty(); b[sq(1, 2)] = 1; const m = legalMoves(b, 1).find((x) => x.to === sq(0, 1));
  assert.equal(applyMove(b, m)[sq(0, 1)], 2);
  const pass = empty(); pass[sq(2, 1)] = 1; pass[sq(1, 2)] = -1; pass[sq(1, 4)] = -1; // lands on row 0 then must continue back down
  const cap = legalMoves(pass, 1); assert.equal(cap[0].captured.length, 2); assert.equal(applyMove(pass, cap[0])[cap[0].to], 1, 'not crowned after passing through');
});

test('game ends when a side has no moves; AI plays legal games to a result', () => {
  const g = new DraughtsGame({ difficulty: 'easy', seed: 9 });
  g.board = empty(); g.board[sq(5, 4)] = 1; g.board[sq(4, 5)] = -1; g.moves = legalMoves(g.board, 1);
  g.play(g.moves[0]); assert.deepEqual(g.result, { winner: 1, reason: 'All pieces captured' });
  for (const [d, seed] of [['easy', 1], ['easy', 2], ['normal', 3]]) {
    const h = new DraughtsGame({ difficulty: d, seed }); let n = 0;
    while (!h.result && n++ < 500) { const m = h.think(); assert.ok(h.moves.includes(m)); h.play(m); }
    assert.ok(h.result, 'finished'); assert.ok([1, -1, 0].includes(h.result.winner));
  }
});

test('the user cannot play an illegal or non-maximum move', () => {
  const g = new DraughtsGame(); assert.equal(g.play({ from: sq(6, 1), to: sq(4, 3) }), false);
  assert.ok(g.play({ from: sq(6, 1), to: sq(5, 2) }));
  assert.equal(g.side, -1);
});
