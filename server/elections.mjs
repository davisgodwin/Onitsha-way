/**
 * v0.45 the players' elections (online). The same four offices as in the game, contested by players on this server,
 * on a weekly cycle in Onitsha time (WAT): Monday–Thursday nominations, Friday the last day of the campaign, Saturday
 * voting, Sunday the results. One vote per account per office per week; the results are always counted from the
 * stored vote record, so anyone can recount. A tie has no winner and the office is contested again next week.
 * Adults only (child characters can't join online play at all).
 */
import { OFFICE, OFFICES, PARTY } from '../src/politics/Politics.js';
const DAY = 86_400_000, KEEP = 8;
/** The cycle (the WAT date of its Monday) and the phase at a moment. */
export function onlineCycle(ms) {
 const d = new Date(ms + 3_600_000), wd = d.getUTCDay(), back = (wd + 6) % 7, monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - back * DAY).toISOString().slice(0, 10);
 const phase = wd >= 1 && wd <= 4 ? 'nominations' : wd === 5 ? 'campaign' : wd === 6 ? 'voting' : 'results';
 return { cycle: monday, phase, previous: new Date(Date.parse(monday) - 7 * DAY).toISOString().slice(0, 10) };
}
export function ensureElections(e) {
 const E = e && typeof e === 'object' ? e : {}; E.candidates = Array.isArray(E.candidates) ? E.candidates : []; E.votes = Array.isArray(E.votes) ? E.votes : [];
 const cycles = [...new Set(E.candidates.map((c) => c.cycle).concat(E.votes.map((v) => v.cycle)))].sort(); const old = new Set(cycles.slice(0, Math.max(0, cycles.length - KEEP)));
 if (old.size) { E.candidates = E.candidates.filter((c) => !old.has(c.cycle)); E.votes = E.votes.filter((v) => !old.has(v.cycle)); }
 return E;
}
const fail = (m) => { throw Error(m); };
export function declare(E, { user, name, office, party, adult, now }) {
 const c = onlineCycle(now);
 if (!adult) fail('Politics is for adults.'); if (!OFFICE[office]) fail('No such office.'); if (!PARTY[party]) fail('Choose a party.');
 if (c.phase !== 'nominations') fail('Nominations are open Monday to Thursday (Onitsha time).');
 if (E.candidates.some((x) => x.cycle === c.cycle && x.user === user)) fail('You are already standing this week.');
 const entry = { cycle: c.cycle, office, user, name: String(name ?? 'Player').slice(0, 40), party, at: now }; E.candidates.push(entry); return entry;
}
export function vote(E, { user, office, candidate, adult, now }) {
 const c = onlineCycle(now);
 if (!adult) fail('Only adults can vote.'); if (c.phase !== 'voting') fail('Voting is on Saturday (Onitsha time).'); if (!OFFICE[office]) fail('No such office.');
 if (!E.candidates.some((x) => x.cycle === c.cycle && x.office === office && x.user === candidate)) fail('Not a candidate.');
 if (E.votes.some((v) => v.cycle === c.cycle && v.office === office && v.voter === user)) fail('You have already voted for this office this week.');
 const v = { cycle: c.cycle, office, voter: user, candidate, at: now }; E.votes.push(v); return v;
}
/** Count a cycle from the vote record: per office { totals, winner (null on a tie or no votes), tie }. */
export function count(E, cycle) {
 const out = {};
 for (const o of OFFICES) {
  const cands = E.candidates.filter((c) => c.cycle === cycle && c.office === o.id); if (!cands.length) continue;
  const totals = Object.fromEntries(cands.map((c) => [c.user, 0])); for (const v of E.votes) if (v.cycle === cycle && v.office === o.id && v.candidate in totals) totals[v.candidate]++;
  const top = Math.max(...Object.values(totals)), lead = Object.keys(totals).filter((k) => totals[k] === top);
  out[o.id] = { totals, cast: Object.values(totals).reduce((a, b) => a + b, 0), winner: top > 0 && lead.length === 1 ? lead[0] : null, tie: top > 0 && lead.length > 1 ? lead : null, names: Object.fromEntries(cands.map((c) => [c.user, c.name])), parties: Object.fromEntries(cands.map((c) => [c.user, c.party])) };
 }
 return out;
}
/** What a player sees. Results are shown from Sunday of their week; holders are last week's winners. */
export function status(E, user, now) {
 const c = onlineCycle(now), mine = (cy) => E.votes.filter((v) => v.cycle === cy && v.voter === user).map((v) => v.office);
 const current = c.phase === 'results' ? count(E, c.cycle) : null, last = count(E, c.previous), shown = current ?? last;
 return { cycle: c.cycle, phase: c.phase, candidates: E.candidates.filter((x) => x.cycle === c.cycle).map(({ office, user: id, name, party }) => ({ office, id, name, party })), voted: mine(c.cycle), standing: E.candidates.find((x) => x.cycle === c.cycle && x.user === user)?.office ?? null, results: shown, resultsCycle: current ? c.cycle : c.previous };
}
