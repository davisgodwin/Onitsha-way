/**
 * v0.45 stage 6: politics and elections. Pure rules (no Three.js, no DOM) so they can be tested and shared with the
 * server.
 *
 * Fictional parties and fictional candidates. The electoral bodies are the real ones (ANSIEC runs council elections
 * in Anambra, INEC the State House of Assembly and governorship), with invented officials. Nothing here portrays a
 * real politician or party. Adults only: a child can't register, join a party, stand, campaign or vote.
 *
 * Offline (this life): every 28 game days there is an election season for four offices. Days 1–7 of a season:
 * register to vote, join a party, collect nomination forms. Days 8–20: the campaign (rallies, posters, donations, a
 * debate). Day 21: election day (polls 8:00–17:00). Day 22: results and the swearing-in. The winner holds the office
 * until the next season's results: a salary, a public budget and public projects that are built in the city.
 *
 * The NPC electorate votes from each candidate's strength; every polling unit's count is kept, and the result is
 * always re-computed from that record (anyone can recount). A tie is re-run the next day between the tied candidates.
 */
export const SEASON = { length: 28, nominationsEnd: 7, campaignEnd: 20, electionDay: 21, resultsDay: 22, polls: [8, 17] };
export const PARTIES = [
 { id: 'opp', name: 'Onward Progress Party', short: 'OPP', color: '#1f6fb5', slogan: 'Forward, together' },
 { id: 'pra', name: "People's Renewal Alliance", short: 'PRA', color: '#c0392b', slogan: 'A new day for our people' },
 { id: 'gam', name: 'Greater Anambra Movement', short: 'GAM', color: '#2f8f5a', slogan: 'Our state, our pride' },
 { id: 'cgp', name: 'Common Good Party', short: 'CGP', color: '#c99a0e', slogan: 'Power for the people' },
];
export const PARTY = Object.fromEntries(PARTIES.map((p) => [p.id, p]));
export const MEMBERSHIP_FEE = 5000;
/** The four offices. fee: nomination forms; strength: what a newcomer needs to be taken seriously (public standing);
 *  salary per 7 days; budget: public money for projects per term; electorate: registered voters; units: polling units. */
export const OFFICES = [
 { id: 'councillor', title: 'Councillor', prefix: 'Hon.', area: 'Ward 4, Onitsha North', body: 'ANSIEC', fee: 50_000, needs: { public: 0 }, salary: 60_000, budget: 8_000_000, electorate: 6_400, units: 8 },
 { id: 'chairman', title: 'Chairman, Onitsha North LGA', prefix: 'Hon.', area: 'Onitsha North Local Government Area', body: 'ANSIEC', fee: 300_000, needs: { public: 15 }, salary: 200_000, budget: 60_000_000, electorate: 64_000, units: 16, after: 'councillor' },
 { id: 'assembly', title: 'Member, Anambra State House of Assembly', prefix: 'Rt. Hon.', area: 'Onitsha North I constituency', body: 'INEC', fee: 1_000_000, needs: { public: 25 }, salary: 350_000, budget: 40_000_000, electorate: 96_000, units: 20 },
 { id: 'governor', title: 'Governor of Anambra State', prefix: 'His/Her Excellency', area: 'Anambra State', body: 'INEC', fee: 5_000_000, needs: { public: 45 }, salary: 1_200_000, budget: 800_000_000, electorate: 2_600_000, units: 30, after: 'any' },
];
export const OFFICE = Object.fromEntries(OFFICES.map((o) => [o.id, o]));
/** Public projects an office holder can commission. days to build; public: standing when it opens. */
export const PROJECTS = [
 { id: 'streetlights', label: 'Solar streetlights', cost: 3_000_000, days: 3, public: 4 },
 { id: 'borehole', label: 'Public borehole and water tank', cost: 2_000_000, days: 2, public: 4 },
 { id: 'shelter', label: 'Bus shelter', cost: 1_500_000, days: 2, public: 3 },
 { id: 'toilet', label: 'Public toilet block', cost: 2_500_000, days: 3, public: 3 },
 { id: 'playground', label: "Children's playground", cost: 4_000_000, days: 3, public: 5 },
 { id: 'road', label: 'Road patching (a stretch of fresh tarmac)', cost: 10_000_000, days: 4, public: 6 },
 { id: 'classroom', label: 'School classroom block', cost: 12_000_000, days: 5, public: 7 },
 { id: 'clinic', label: 'Primary health centre', cost: 25_000_000, days: 6, public: 9 },
];
export const PROJECT = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
/** Campaign actions: cost scales with the office (a governorship rally costs far more than a ward rally). */
export const CAMPAIGN = {
 rally: { cost: (o) => Math.round(o.fee * 0.4 / 1000) * 1000, strength: 6, minutes: 120, perPlace: 1 },
 posters: { cost: (o) => Math.round(o.fee * 0.15 / 1000) * 1000, strength: 3, minutes: 30, max: 3 },
 voteBuying: { cost: (o) => Math.round(o.fee * 0.5 / 1000) * 1000, strength: 5, evidence: 0.6 },
 donationsPerRally: (o) => Math.round(o.fee * 0.35 / 1000) * 1000,
};
export const RALLY_GROUNDS = [{ id: 'main-market', label: 'Main Market' }, { id: 'upper-iweka-park', label: 'Upper Iweka Motor Park' }, { id: 'bridgehead', label: 'Bridgehead' }, { id: 'ochanja', label: 'Ochanja Market' }];
export const DEBATE = [
 { q: 'Power supply: what will you do about light?', a: [{ t: 'Solar for markets and clinics first, then streets: a plan with costs', s: 3 }, { t: 'Blame the last government', s: 0 }, { t: 'Promise 24-hour light by next month', s: 1, integrity: -3 }] },
 { q: 'Security: people are afraid at night.', a: [{ t: 'Streetlights, community policing, and jobs for young people', s: 3 }, { t: 'Say it is a federal matter', s: 0 }, { t: 'Promise to deal with the boys yourself', s: -1 }] },
 { q: 'Traffic and markets: Upper Iweka and the Main Market.', a: [{ t: 'Fix the roads, move loading to night, build parks', s: 3 }, { t: 'Say traders should be patient', s: -1 }, { t: 'Promise free shops for everyone', s: 1, integrity: -3 }] },
];
const NAMES_F = ['Ngozi', 'Chiamaka', 'Ifeoma', 'Adaeze', 'Uche', 'Obiageli', 'Nkiru', 'Ebele', 'Chinwe', 'Amaka'];
const NAMES_M = ['Emeka', 'Obinna', 'Chukwudi', 'Ikenna', 'Nnamdi', 'Chibuzo', 'Okey', 'Kelechi', 'Tobenna', 'Ifeanyi'];
const SURNAMES = ['Okafor-Ile', 'Nwankwo-Eze', 'Obiorah', 'Anyaoku-Nnadi', 'Ezeudu', 'Onwuka', 'Okonkwo-Ibe', 'Nwosu-Achebe', 'Igwedibia', 'Chukwuma-Okeke', 'Ugwuanyi-Obi', 'Mbanefo-Nzei'];

export const rng = (seed) => { let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const hash = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Which season a game day is in, and what is happening. Day 1 is the first day of a life. */
export function season(day) {
 const d = Math.max(1, Math.floor(day)), n = Math.floor((d - 1) / SEASON.length), at = ((d - 1) % SEASON.length) + 1;
 const phase = at <= SEASON.nominationsEnd ? 'nominations' : at <= SEASON.campaignEnd ? 'campaign' : at === SEASON.electionDay ? 'election' : 'term';
 return { n, at, phase, start: n * SEASON.length + 1, electionDay: n * SEASON.length + SEASON.electionDay, resultsDay: n * SEASON.length + SEASON.resultsDay, debateDay: n * SEASON.length + 14 };
}
export function newPolitics() { return { v: 1, registered: false, regDay: null, party: null, joined: null, seasons: {}, office: null, history: [], projects: [], barredUntil: 0, seq: 0, keys: [] }; }
export function ensurePolitics(p) {
 const o = p && typeof p === 'object' ? p : newPolitics();
 o.v = 1; o.registered = !!o.registered; o.party = PARTY[o.party] ? o.party : null; o.seasons = o.seasons && typeof o.seasons === 'object' ? o.seasons : {};
 o.office = o.office && OFFICE[o.office.id] ? o.office : null; o.history = Array.isArray(o.history) ? o.history.slice(-40) : [];
 o.projects = Array.isArray(o.projects) ? o.projects.filter((x) => x && PROJECT[x.kind] && Number.isFinite(x.x) && Number.isFinite(x.z)).slice(-60) : [];
 o.barredUntil = Number.isFinite(o.barredUntil) ? o.barredUntil : 0; o.seq = Number.isInteger(o.seq) ? o.seq : 0; o.keys = Array.isArray(o.keys) ? o.keys.slice(-200) : [];
 for (const [k, s] of Object.entries(o.seasons)) if (!s || typeof s !== 'object' || !Number.isInteger(+k)) delete o.seasons[k]; else { s.races ??= {}; }
 const ks = Object.keys(o.seasons).map(Number).sort((a, b) => a - b); while (ks.length > 3) delete o.seasons[ks.shift()];
 return o;
}
/** The NPC candidates for an office in a season (2–3 from other parties), fixed by the season number. */
export function npcCandidates(officeId, n, exceptParty = null) {
 const r = rng(hash(`${officeId}:${n}`)), parties = PARTIES.filter((p) => p.id !== exceptParty), count = 2 + (r() < 0.5 ? 1 : 0), out = [];
 const pool = [...parties]; for (let i = 0; i < count && pool.length; i++) {
  const party = pool.splice(Math.floor(r() * pool.length), 1)[0], f = r() < 0.4, first = (f ? NAMES_F : NAMES_M)[Math.floor(r() * 10)], last = SURNAMES[Math.floor(r() * SURNAMES.length)];
  out.push({ id: `npc:${officeId}:${n}:${i}`, name: `${first} ${last}`, gender: f ? 'female' : 'male', party: party.id, strength: Math.round(18 + r() * 22), npc: true });
 }
 return out;
}
/** A party's pull in a season (it rises and falls), 0..10. */
export const partyPull = (partyId, n) => Math.round(rng(hash(`pull:${partyId}:${n}`))() * 10);
/** Can this character stand for this office now? Returns { ok, error }. */
export function canStand(P, { office, adult, day, publicStanding = 0, money = 0, convicted = false }) {
 const o = OFFICE[office], s = season(day), race = P.seasons[s.n]?.races?.[office];
 if (!o) return { ok: false, error: 'No such office.' };
 if (!adult) return { ok: false, error: 'Politics is for adults.' };
 if (!P.registered) return { ok: false, error: 'Register to vote first (at the electoral office).' };
 if (!P.party) return { ok: false, error: 'Join a party first.' };
 if (day < P.barredUntil) return { ok: false, error: `Barred from contesting after a conviction (until day ${P.barredUntil}).` };
 if (convicted) return { ok: false, error: 'You have an open conviction for corruption.' };
 if (s.phase !== 'nominations') return { ok: false, error: `Nominations are open on days 1–${SEASON.nominationsEnd} of a season (next: day ${s.start + SEASON.length}).` };
 if (Object.values(P.seasons[s.n]?.races ?? {}).some((r) => r.player)) return { ok: false, error: 'You are already standing for an office this season.' };
 if (race?.player) return { ok: false, error: 'Already standing.' };
 if (publicStanding < o.needs.public) return { ok: false, error: `Your public standing (${Math.round(publicStanding)}) is too low: the party wants ${o.needs.public}.` };
 if (o.after === 'councillor' && !P.history.some((h) => h.won) && publicStanding < o.needs.public + 15) return { ok: false, error: 'The party wants someone who has held an office before (or a public standing 15 higher).' };
 if (o.after === 'any' && !P.history.some((h) => h.won)) return { ok: false, error: 'Win an election for another office first.' };
 if (money < o.fee) return { ok: false, error: `The nomination forms cost ₦${o.fee.toLocaleString('en-NG')}.` };
 return { ok: true };
}
/** Your strength as a candidate: who you are plus what you did in the campaign. */
export function playerStrength({ publicStanding = 0, social = 0, integrity = 0, charisma = 0, campaign = {} }) {
 const c = campaign; return Math.round(clamp(10 + publicStanding * 0.35 + social * 0.15 + Math.min(0, integrity) * 0.1 + charisma * 1.5 + (c.rallies ?? 0) * CAMPAIGN.rally.strength + (c.posters ?? 0) * CAMPAIGN.posters.strength + (c.debate ?? 0) * 2 + (c.bought ?? 0) * CAMPAIGN.voteBuying.strength - (c.scandal ?? 0) * 4, 1, 120));
}
/**
 * Hold the election: the NPC electorate votes, polling unit by polling unit. Returns the vote record:
 * { office, n, seed, turnout, units: [{ id, registered, votes: { candidateId: n } }] }. Your own ballot (if you vote)
 * is added to your unit by castBallot. Deterministic for the same inputs.
 */
export function holdElection({ office, n, candidates, seed = 0, round = 1 }) {
 const o = OFFICE[office], r = rng(hash(`${office}:${n}:${seed}:${round}`)), units = [], per = Math.floor(o.electorate / o.units);
 const turnout = 0.32 + r() * 0.2;
 for (let u = 0; u < o.units; u++) {
  const registered = per + (u === 0 ? o.electorate - per * o.units : 0), cast = Math.round(registered * clamp(turnout + (r() - 0.5) * 0.08, 0.15, 0.8));
  const w = candidates.map((c) => Math.pow(Math.max(1, c.strength + (PARTY[c.party] ? partyPull(c.party, n) : 0)), 1.6) * (0.85 + r() * 0.3)), sum = w.reduce((a, b) => a + b, 0);
  const votes = {}; let left = cast; candidates.forEach((c, i) => { const v = i === candidates.length - 1 ? left : Math.round((cast * w[i]) / sum); votes[c.id] = Math.max(0, Math.min(left, v)); left -= votes[c.id]; });
  units.push({ id: `PU-${String(u + 1).padStart(3, '0')}`, registered, votes });
 }
 return { office, n, round, seed, turnout: Math.round(turnout * 100) / 100, units, ballots: [] };
}
/** One ballot per voter per race. Returns { ok, error }. The voter id is kept in the record so it can't vote twice. */
export function castBallot(record, voterId, candidateId, unitIndex = 0) {
 if (!record) return { ok: false, error: 'No election.' };
 if (record.ballots.some((b) => b.voter === voterId)) return { ok: false, error: 'You have already voted in this election.' };
 const unit = record.units[Math.min(record.units.length - 1, Math.max(0, unitIndex))]; if (!(candidateId in unit.votes)) return { ok: false, error: 'Not a candidate.' };
 unit.votes[candidateId]++; record.ballots.push({ voter: voterId, unit: unit.id, candidate: candidateId });
 return { ok: true };
}
/** The result, always counted from the record. { totals, order, winner, tie: [ids] | null, cast }. */
export function tally(record) {
 const totals = {}; let cast = 0;
 for (const u of record.units) for (const [id, v] of Object.entries(u.votes)) { totals[id] = (totals[id] ?? 0) + v; cast += v; }
 const order = Object.keys(totals).sort((a, b) => totals[b] - totals[a] || a.localeCompare(b));
 const top = totals[order[0]] ?? 0, tied = order.filter((id) => totals[id] === top);
 return { totals, order, cast, winner: tied.length === 1 ? order[0] : null, tie: tied.length > 1 ? tied : null };
}
/** A finished race: hold it (and re-run ties, between the tied candidates only, up to 3 rounds). */
export function decide(race, n) {
 let rec = race.record ?? holdElection({ office: race.office, n, candidates: race.candidates, seed: race.seed ?? 0 }), res = tally(rec), round = rec.round ?? 1;
 while (res.tie && round < 4) { round++; const cands = race.candidates.filter((c) => res.tie.includes(c.id)); rec = holdElection({ office: race.office, n, candidates: cands, seed: (race.seed ?? 0) + round, round }); res = tally(rec); }
 if (res.tie) res.winner = [...res.tie].sort()[0]; // still level after three re-runs: the commission draws lots (alphabetical here, so it can be checked)
 return { record: rec, result: res, round };
}
/** Weekly salary and term budget for an office. */
export const officeTerms = (id) => ({ salary: OFFICE[id].salary, budget: OFFICE[id].budget });
/**
 * Diverting public money: how much evidence it leaves (more for bigger sums and for repeat diversions). The money
 * leaves the budget and lands in your wallet; the EFCC opens or strengthens a case.
 */
export function diversionEvidence(amount, budget, times = 0) { return clamp(0.35 + (amount / Math.max(1, budget)) * 1.5 + times * 0.2, 0.3, 2); }
