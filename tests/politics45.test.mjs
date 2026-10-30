// v0.45 stage 6: politics and elections (offline rules, the players' elections on the server), and dates at eateries.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { WebSocket } from 'ws';
import { SEASON, OFFICE, OFFICES, PARTIES, season, newPolitics, ensurePolitics, canStand, npcCandidates, playerStrength, holdElection, castBallot, tally, decide, diversionEvidence } from '../src/politics/Politics.js';
import { onlineCycle, ensureElections, declare, vote, count, status } from '../server/elections.mjs';
import { dateOutcome, EATERIES } from '../src/data/eateries.js';
import { createService } from '../server/service.mjs';
const { defaultSave, migrate, SAVE_VERSION } = await import('../src/save/SaveSystem.js');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('the season calendar: nominations, campaign, election day, results', () => {
 assert.deepEqual([1, 7, 8, 20, 21, 22, 28, 29].map((d) => season(d).phase), ['nominations', 'nominations', 'campaign', 'campaign', 'election', 'term', 'term', 'nominations']);
 assert.equal(season(29).n, 1); assert.equal(season(29).electionDay, 28 + 21); assert.equal(season(1).debateDay, 14);
});

test('who can stand: adults, registered, in a party, in nominations, with the standing, the experience and the fee', () => {
 const P = newPolitics(), base = { office: 'councillor', adult: true, day: 3, publicStanding: 10, money: 1e9 };
 assert.match(canStand(P, { ...base, adult: false }).error, /adults/);
 assert.match(canStand(P, base).error, /Register/); P.registered = true;
 assert.match(canStand(P, base).error, /party/); P.party = 'opp';
 assert.match(canStand(P, { ...base, day: 10 }).error, /Nominations/);
 assert.match(canStand(P, { ...base, money: 100 }).error, /forms cost/);
 assert.equal(canStand(P, base).ok, true);
 assert.match(canStand(P, { ...base, office: 'assembly' }).error, /public standing/);
 assert.match(canStand(P, { ...base, office: 'governor', publicStanding: 90 }).error, /Win an election/);
 P.history.push({ won: true }); assert.equal(canStand(P, { ...base, office: 'governor', publicStanding: 90 }).ok, true);
 assert.match(canStand(P, { ...base, convicted: true }).error, /conviction/);
 P.barredUntil = 50; assert.match(canStand(P, base).error, /Barred/);
});

test('NPC candidates are fictional, from other parties, fixed per season', () => {
 const a = npcCandidates('chairman', 3, 'opp'), b = npcCandidates('chairman', 3, 'opp');
 assert.deepEqual(a, b); assert.ok(a.length >= 2 && a.length <= 3); assert.ok(a.every((c) => c.party !== 'opp' && PARTIES.some((p) => p.id === c.party)));
});

test('an election: counted from the record, one ballot per voter, recount gives the same result', () => {
 const cands = [...npcCandidates('councillor', 0), { id: 'player', name: 'Ada', party: 'opp', strength: 40 }];
 const r1 = holdElection({ office: 'councillor', n: 0, candidates: cands, seed: 5 }), r2 = holdElection({ office: 'councillor', n: 0, candidates: cands, seed: 5 });
 assert.deepEqual(r1, r2, 'deterministic');
 assert.equal(r1.units.length, OFFICE.councillor.units); const t = tally(r1); assert.ok(t.cast > OFFICE.councillor.electorate * 0.15 && t.cast < OFFICE.councillor.electorate);
 assert.equal(castBallot(r1, 'player', 'player').ok, true); assert.match(castBallot(r1, 'player', cands[0].id).error, /already voted/);
 assert.equal(tally(r1).totals.player, t.totals.player + 1, 'the ballot is in the count');
 const copy = JSON.parse(JSON.stringify(r1)); assert.deepEqual(tally(copy), tally(r1), 'a recount from the stored record matches');
 // stronger campaigns win more votes
 const weak = playerStrength({ publicStanding: 0 }), strong = playerStrength({ publicStanding: 30, charisma: 6, campaign: { rallies: 4, posters: 3, debate: 8 } });
 assert.ok(strong > weak + 30); assert.ok(playerStrength({ campaign: { bought: 2 } }) > weak, 'vote buying works, which is why it is tempting');
});

test('a tie is re-run between the tied candidates', () => {
 const cands = [{ id: 'a', name: 'A', party: 'opp', strength: 30 }, { id: 'b', name: 'B', party: 'pra', strength: 30 }];
 const rec = { office: 'councillor', n: 0, round: 1, seed: 1, units: [{ id: 'PU-001', registered: 100, votes: { a: 20, b: 20 } }], ballots: [] };
 assert.deepEqual(tally(rec).tie, ['a', 'b']); assert.equal(tally(rec).winner, null);
 const d = decide({ office: 'councillor', candidates: cands, seed: 1, record: rec }, 0); assert.ok(d.round >= 2 && d.result.winner, JSON.stringify(d.result));
});

test('stealing public money leaves more evidence the more you take', () => {
 assert.ok(diversionEvidence(1e6, 8e6) < diversionEvidence(4e6, 8e6)); assert.ok(diversionEvidence(1e6, 8e6, 2) > diversionEvidence(1e6, 8e6));
});

test('saves: v21 adds politics; an older life keeps everything and starts unregistered', () => {
 assert.equal(SAVE_VERSION, 23); const d = defaultSave({ name: 'A', gender: 'female', ageGroup: 'adult' }); assert.equal(d.politics.registered, false);
 const old = defaultSave({ name: 'B', gender: 'male', ageGroup: 'adult' }); old.version = 20; delete old.politics; old.wallet.balance = 4321;
 const m = migrate(old); assert.equal(m.version, 23); assert.equal(m.politics.party, null); assert.equal(m.wallet.balance, 4321);
 const bad = ensurePolitics({ party: 'apc', office: { id: 'president' }, projects: [{ kind: 'castle', x: 1, z: 1 }, { kind: 'borehole', x: 2, z: 3 }] });
 assert.equal(bad.party, null, 'only the game\'s fictional parties'); assert.equal(bad.office, null); assert.equal(bad.projects.length, 1);
});

test('dates: how the evening goes depends on what you say', () => {
 assert.equal(dateOutcome(8, true).grade, 'great'); assert.equal(dateOutcome(2, true).grade, 'good'); assert.equal(dateOutcome(-4, false).grade, 'poor');
 assert.equal(EATERIES.length, 3); assert.ok(EATERIES.every((e) => e.menu.length >= 5 && e.id.startsWith('eatery-')));
});

test("the players' elections: weekly phases, one vote per account, results from the vote record, ties, adults only", () => {
 const mon = Date.parse('2026-10-26T09:00:00Z'), day = 86_400_000; // Monday in Onitsha
 assert.deepEqual([0, 3, 4, 5, 6].map((k) => onlineCycle(mon + k * day).phase), ['nominations', 'nominations', 'campaign', 'voting', 'results']);
 assert.equal(onlineCycle(mon + 6 * day).cycle, '2026-10-26');
 const E = ensureElections({});
 assert.throws(() => declare(E, { user: 'k', name: 'Kid', office: 'councillor', party: 'opp', adult: false, now: mon }), /adults/);
 declare(E, { user: 'a', name: 'Ada', office: 'councillor', party: 'opp', adult: true, now: mon }); declare(E, { user: 'b', name: 'Obi', office: 'councillor', party: 'pra', adult: true, now: mon });
 assert.throws(() => declare(E, { user: 'a', name: 'Ada', office: 'chairman', party: 'opp', adult: true, now: mon }), /already standing/);
 assert.throws(() => vote(E, { user: 'c', office: 'councillor', candidate: 'a', adult: true, now: mon }), /Saturday/);
 const sat = mon + 5 * day; vote(E, { user: 'c', office: 'councillor', candidate: 'a', adult: true, now: sat }); vote(E, { user: 'd', office: 'councillor', candidate: 'b', adult: true, now: sat });
 assert.throws(() => vote(E, { user: 'c', office: 'councillor', candidate: 'b', adult: true, now: sat }), /already voted/);
 assert.throws(() => vote(E, { user: 'e', office: 'councillor', candidate: 'zz', adult: true, now: sat }), /Not a candidate/);
 let r = count(E, '2026-10-26').councillor; assert.equal(r.winner, null); assert.deepEqual(r.tie.sort(), ['a', 'b']);
 vote(E, { user: 'e', office: 'councillor', candidate: 'a', adult: true, now: sat }); r = count(E, '2026-10-26').councillor; assert.equal(r.winner, 'a'); assert.equal(r.totals.a, 2);
 assert.deepEqual(count(JSON.parse(JSON.stringify(E)), '2026-10-26'), count(E, '2026-10-26'), 'recount from the stored record');
 const st = status(E, 'c', mon + 6 * day); assert.equal(st.phase, 'results'); assert.equal(st.results.councillor.winner, 'a'); assert.deepEqual(st.voted, ['councillor']);
});

test('on the real server: stand, vote once, results; a date at an eatery counts once both are inside', async () => {
 let T = Date.parse('2026-10-26T09:00:00Z'); const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ow45-pol-')); const s = createService({ dataDir: dir, now: () => T }); await s.listen(0);
 const base = `http://127.0.0.1:${s.server.address().port}`, sockets = [];
 const register = async (username) => (await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password: 'pol-qa-password', name: username, adult: true }) })).json());
 const connect = async (a) => { const ws = new WebSocket(base.replace('http:', 'ws:') + '/socket'); sockets.push(ws); const q = [], wait = new Map(); ws.on('message', (b) => { const m = JSON.parse(b); q.push(m); if (wait.has(m.requestId)) { wait.get(m.requestId)(m); wait.delete(m.requestId); } }); await new Promise((r) => ws.once('open', r)); ws.send(JSON.stringify({ type: 'auth', token: a.token })); for (let i = 0; i < 100 && !q.some((m) => m.me); i++) await sleep(5);
  return { q, ws, act: (action, args = {}) => new Promise((resolve, reject) => { const requestId = crypto.randomUUID(), timer = setTimeout(() => reject(Error('Reply timeout')), 5000); wait.set(requestId, (m) => { clearTimeout(timer); resolve(m); }); ws.send(JSON.stringify({ type: 'action', action, ...args, requestId })); }) }; };
 const at = (c, x, z, extra = {}) => c.ws.send(JSON.stringify({ type: 'presence', p: { x, y: 0, z, heading: 0, scene: 'city', speed: 0, appearance: { gender: 'female', ageGroup: 'adult' }, voice: 'off', safe: false, ...extra } }));
 try {
  const ada = await register('pol_ada'), obi = await register('pol_obi'), A = await connect(ada), B = await connect(obi);
  at(A, 0, 0, { locations: { 'eatery-ugo-garden': { x: 100, z: 50 } } }); at(B, 2, 0); await sleep(40);
  let r = await A.act('electionDeclare', { office: 'councillor', party: 'opp' }); assert.equal(r.ok, true, r.error); assert.equal(r.elections.standing, 'councillor');
  r = await B.act('electionDeclare', { office: 'councillor', party: 'gam' }); assert.equal(r.ok, true);
  r = await B.act('electionVote', { office: 'councillor', candidate: ada.me.id }); assert.match(r.error, /Saturday/);
  T += 5 * 86_400_000; at(A, 0, 0); at(B, 2, 0); await sleep(30);
  r = await B.act('electionVote', { office: 'councillor', candidate: ada.me.id }); assert.equal(r.ok, true, r.error);
  r = await B.act('electionVote', { office: 'councillor', candidate: obi.me.id }); assert.match(r.error, /already voted/);
  r = await A.act('electionVote', { office: 'councillor', candidate: ada.me.id }); assert.equal(r.ok, true);
  assert.equal(s.db.elections.votes.length, 2, 'the vote record is stored');
  T += 86_400_000; at(A, 0, 0); at(B, 2, 0); await sleep(30);
  r = await A.act('electionStatus'); assert.equal(r.elections.results.councillor.winner, ada.me.id); assert.equal(r.elections.results.councillor.totals[ada.me.id], 2);
  // a date at an eatery (friends first)
  r = await A.act('request', { target: obi.me.id, kind: 'friend' }); assert.equal(r.ok, true, r.error); const fr = s.db.requests.find((x) => x.kind === 'friend'); await B.act('respond', { id: fr.id, accept: true });
  r = await A.act('request', { target: obi.me.id, kind: 'date', area: 'eatery-ugo-garden' }); assert.equal(r.ok, true, r.error); const dr = s.db.requests.find((x) => x.kind === 'date'); assert.equal(dr.area, 'eatery-ugo-garden');
  r = await B.act('respond', { id: dr.id, accept: true }); assert.equal(r.ok, true, r.error); await sleep(30); const dm = A.q.find((m) => m.type === 'date'); assert.ok(dm && dm.date.x === 100);
  at(A, 9805, 7, { scene: 'public:eatery-ugo-garden' }); at(B, 9806, 7, { scene: 'public:eatery-ugo-garden' }); await sleep(30);
  assert.equal((await A.act('dateReady', { id: dm.date.id })).ok, true); assert.equal((await B.act('dateReady', { id: dm.date.id })).ok, true);
  T += 31_000; await sleep(400); assert.ok(A.q.some((m) => m.type === 'dateEnd' && m.completed && /meal/.test(m.message)), 'the date counts inside the eatery');
 } finally { for (const ws of sockets) ws.terminate(); await s.close(); }
});
