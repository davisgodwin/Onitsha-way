/**
 * Saved progress for city activities (football first; pool, board games and the rest plug in later).
 * Pure functions over `saveData.activities`, so results, rewards and achievements are unit-tested and
 * a finished match can never be rewarded twice: each match has an id and is recorded exactly once.
 *
 * Shape (save v16):
 *   activities: { version: 1, seq, active: null | { kind, id, startedAt },
 *                 football: { played, won, drawn, lost, gf, ga, goals, assists, abandoned,
 *                             history: [ {id, opp, score:[a,b], outcome, goals, day} ] (last 10),
 *                             finished: [id…] (last 40), achievements: [id…] } }
 */
export const FOOTBALL_ACHIEVEMENTS = {
  'first-match': { label: 'First kick', note: 'Played a full 5-a-side match at the stadium.' },
  'first-win': { label: 'Winner', note: 'Won a 5-a-side match.' },
  'first-goal': { label: 'Off the mark', note: 'Scored your first goal.' },
  'hat-trick': { label: 'Hat-trick', note: 'Scored three goals in one match.' },
  'clean-sheet': { label: 'Clean sheet', note: 'Won without conceding.' },
  'playmaker': { label: 'Playmaker', note: 'Made two assists in one match.' },
  'five-wins': { label: 'Stadium regular', note: 'Won five matches.' },
  'hard-win': { label: 'Giant killer', note: 'Beat a Hard team.' },
};
export const FOOTBALL_STANDING = [
  { min: 0, label: 'Newcomer' },
  { min: 6, label: 'Weekend baller' },
  { min: 18, label: 'Known on the pitch' },
  { min: 40, label: 'Local star' },
  { min: 80, label: 'Stadium legend' },
];

const int = (v) => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
export function newFootballRecord() { return { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, goals: 0, assists: 0, abandoned: 0, history: [], finished: [], achievements: [] }; }
export function newPoolRecord() { return { played: 0, won: 0, lost: 0, staked: 0, winnings: 0, bestRun: 0, abandoned: 0, history: [], finished: [], achievements: [] }; }
export const POOL_ACHIEVEMENTS = {
  'pool-first-game': { label: 'Chalked up', note: 'Finished a game of 8-ball.' },
  'pool-first-win': { label: 'Sank the 8', note: 'Won a game of 8-ball.' },
  'pool-run-five': { label: 'On a roll', note: 'Potted five balls in one visit.' },
  'pool-clean': { label: 'Run out', note: 'Won with all seven of your group and the 8 in one visit.' },
  'pool-stake-win': { label: 'Table money', note: 'Won a staked game.' },
  'pool-hard-win': { label: 'Parlour champion', note: 'Beat a Hard opponent.' },
};
export function newActivities() { return { version: 1, seq: 0, active: null, football: newFootballRecord(), pool: newPoolRecord(), games: {} }; }

/** Fill defaults/repair types without losing anything already recorded. */
export function ensureActivities(save) {
  const a = (save.activities && typeof save.activities === 'object' && !Array.isArray(save.activities)) ? save.activities : (save.activities = newActivities());
  a.version = 1; a.seq = int(a.seq);
  if (a.active && (typeof a.active !== 'object' || typeof a.active.id !== 'string')) a.active = null;
  a.active ??= null;
  const f = a.football && typeof a.football === 'object' && !Array.isArray(a.football) ? a.football : (a.football = newFootballRecord());
  for (const k of ['played', 'won', 'drawn', 'lost', 'gf', 'ga', 'goals', 'assists', 'abandoned']) f[k] = int(f[k]);
  for (const k of ['history', 'finished', 'achievements']) if (!Array.isArray(f[k])) f[k] = [];
  f.finished = f.finished.filter((x) => typeof x === 'string');
  f.achievements = f.achievements.filter((x) => Object.hasOwn(FOOTBALL_ACHIEVEMENTS, x));
  const p = a.pool && typeof a.pool === 'object' && !Array.isArray(a.pool) ? a.pool : (a.pool = newPoolRecord());
  for (const k of ['played', 'won', 'lost', 'staked', 'winnings', 'bestRun', 'abandoned']) p[k] = int(p[k]);
  for (const k of ['history', 'finished', 'achievements']) if (!Array.isArray(p[k])) p[k] = [];
  p.finished = p.finished.filter((x) => typeof x === 'string');
  p.achievements = p.achievements.filter((x) => Object.hasOwn(POOL_ACHIEVEMENTS, x));
  // small per-activity records (draughts, gaming centre, basketball, jogging…): { played, won, best, … }
  if (!a.games || typeof a.games !== 'object' || Array.isArray(a.games)) a.games = {};
  for (const [k, r] of Object.entries(a.games)) { if (!r || typeof r !== 'object' || Array.isArray(r)) { delete a.games[k]; continue; } for (const [f, v] of Object.entries(r)) if (typeof v === 'number' && !(Number.isFinite(v) && v >= 0)) r[f] = 0; if (r.finished && !Array.isArray(r.finished)) r.finished = []; }
  return a;
}

/** Start a match: returns its unique id and marks it active (an unfinished active match counts as abandoned on the next load). */
export function beginActivity(save, kind) {
  const a = ensureActivities(save);
  const id = `${kind}-${++a.seq}-${Date.now().toString(36)}`;
  a.active = { kind, id, startedAt: new Date().toISOString() };
  return id;
}

/** On load: a match that was running when the page closed is recorded as abandoned (no result, no reward). */
export function settleAbandoned(save) {
  const a = ensureActivities(save);
  if (!a.active) return null;
  const was = a.active; a.active = null;
  const r = was.kind === 'football' ? a.football : was.kind === 'pool' ? a.pool : a.games[was.kind]; if (r) r.abandoned = int(r.abandoned) + 1;
  return was;
}

/** Leaving mid-match: no result, no reward. */
export function abandonActivity(save, id) {
  const a = ensureActivities(save);
  if (a.active?.id !== id) return false;
  a.active = null; const r = id.startsWith('football') ? a.football : id.startsWith('pool') ? a.pool : a.games[id.split('-')[0]]; if (r) r.abandoned = int(r.abandoned) + 1;
  return true;
}

export function footballPoints(f) { return f.won * 3 + f.drawn + f.goals + f.assists; }
export function footballStanding(f) { const pts = footballPoints(f); let s = FOOTBALL_STANDING[0]; for (const l of FOOTBALL_STANDING) if (pts >= l.min) s = l; return { ...s, points: pts }; }

/**
 * Record a finished match exactly once. Returns { ok, duplicate?, newAchievements, standing, xp, needs }.
 * The caller applies `xp` and `needs` (game systems) only when ok && !duplicate.
 */
export function recordFootball(save, id, result, { opponent = 'Opponents', day = 1, difficulty = 'normal' } = {}) {
  const a = ensureActivities(save), f = a.football;
  if (typeof id !== 'string' || !id) return { ok: false, error: 'No match id' };
  if (f.finished.includes(id)) return { ok: true, duplicate: true, newAchievements: [], standing: footballStanding(f) };
  if (!result || !Array.isArray(result.score) || result.score.length !== 2) return { ok: false, error: 'No result' };
  const [gf, ga] = result.score.map(int), u = result.user ?? {}, goals = int(u.goals), assists = int(u.assists);
  const outcome = gf > ga ? 'win' : gf < ga ? 'loss' : 'draw';
  f.played++; f[outcome === 'win' ? 'won' : outcome === 'loss' ? 'lost' : 'drawn']++;
  f.gf += gf; f.ga += ga; f.goals += goals; f.assists += assists;
  f.finished.push(id); if (f.finished.length > 40) f.finished.splice(0, f.finished.length - 40);
  f.history.unshift({ id, opp: String(opponent).slice(0, 40), score: [gf, ga], outcome, goals, assists, day: int(day), difficulty });
  if (f.history.length > 10) f.history.length = 10;
  if (a.active?.id === id) a.active = null;
  const earned = [];
  const award = (k, cond) => { if (cond && !f.achievements.includes(k)) { f.achievements.push(k); earned.push(k); } };
  award('first-match', true); award('first-win', outcome === 'win'); award('first-goal', f.goals > 0);
  award('hat-trick', goals >= 3); award('clean-sheet', outcome === 'win' && ga === 0); award('playmaker', assists >= 2);
  award('five-wins', f.won >= 5); award('hard-win', outcome === 'win' && difficulty === 'hard');
  // Fitness and needs: a full match is real exercise. Capped per match; friendlies pay no money.
  const xp = 25 + 5 * Math.min(3, goals) + (outcome === 'win' ? 5 : 0);
  return { ok: true, duplicate: false, outcome, newAchievements: earned, standing: footballStanding(f), xp,
    needs: { energy: -18, hunger: -10, hygiene: -15, fun: outcome === 'loss' ? 8 : 18, social: 10 } };
}

/**
 * Record a finished 8-ball game exactly once. `payout` is what the table pays the winner (0 for a free game);
 * the caller credits it with the economy using key `pool:win:<id>` only when this returns ok && !duplicate.
 */
export function recordPool(save, id, { won, bestRun = 0, cleanRun = false, stake = 0, payout = 0, opponent = 'Opponent', difficulty = 'normal', reason = '', day = 1 } = {}) {
  const a = ensureActivities(save), p = a.pool;
  if (typeof id !== 'string' || !id) return { ok: false, error: 'No game id' };
  if (p.finished.includes(id)) return { ok: true, duplicate: true, newAchievements: [] };
  p.played++; if (won) p.won++; else p.lost++;
  p.staked += int(stake); if (won) p.winnings += int(payout); p.bestRun = Math.max(p.bestRun, int(bestRun));
  p.finished.push(id); if (p.finished.length > 40) p.finished.splice(0, p.finished.length - 40);
  p.history.unshift({ id, opp: String(opponent).slice(0, 40), won: !!won, stake: int(stake), payout: won ? int(payout) : 0, difficulty, reason: String(reason).slice(0, 80), day: int(day) });
  if (p.history.length > 10) p.history.length = 10;
  if (a.active?.id === id) a.active = null;
  const earned = []; const award = (k, c) => { if (c && !p.achievements.includes(k)) { p.achievements.push(k); earned.push(k); } };
  award('pool-first-game', true); award('pool-first-win', won); award('pool-run-five', bestRun >= 5); award('pool-clean', won && cleanRun);
  award('pool-stake-win', won && stake > 0); award('pool-hard-win', won && difficulty === 'hard');
  return { ok: true, duplicate: false, newAchievements: earned, needs: { fun: won ? 14 : 8, social: 8, energy: -3 } };
}

/** Generic once-only record for smaller activities (draughts, gaming centre, basketball, jogging…). */
export function recordGame(save, kind, id, { won = null, score = null, best = 'max' } = {}) {
  const a = ensureActivities(save), r = (a.games[kind] ??= { played: 0, won: 0, lost: 0, drawn: 0, best: 0, abandoned: 0, finished: [] });
  r.finished ??= [];
  if (typeof id !== 'string' || !id) return { ok: false, error: 'No id' };
  if (r.finished.includes(id)) return { ok: true, duplicate: true, record: r };
  r.played = int(r.played) + 1;
  if (won === true) r.won = int(r.won) + 1; else if (won === false) r.lost = int(r.lost) + 1; else if (won === 'draw') r.drawn = int(r.drawn) + 1;
  let newBest = false;
  if (Number.isFinite(score)) { const prev = Number.isFinite(r.best) && r.best > 0 ? r.best : null; if (prev == null || (best === 'max' ? score > prev : score < prev)) { r.best = score; newBest = true; } }
  r.finished.push(id); if (r.finished.length > 40) r.finished.splice(0, r.finished.length - 40);
  if (a.active?.id === id) a.active = null;
  return { ok: true, duplicate: false, record: r, newBest };
}
