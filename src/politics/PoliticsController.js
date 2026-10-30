import * as THREE from 'three';
import { GeoBuilder } from '../world/GeoBuilder.js';
import { buildVenue, venueNear, venueDoor } from '../world/VenueArchitecture.js';
import { naira } from '../economy/Economy.js';
import {
 SEASON, PARTIES, PARTY, OFFICES, OFFICE, PROJECTS, PROJECT, CAMPAIGN, RALLY_GROUNDS, DEBATE, MEMBERSHIP_FEE,
 season, ensurePolitics, npcCandidates, canStand, playerStrength, holdElection, castBallot, tally, decide, diversionEvidence,
} from './Politics.js';
/**
 * v0.45 stage 6: politics in the city. The electoral offices (walk in: register, nominations, the debate, the results
 * board, and the polling unit on election day), rally grounds at the markets and parks, posters, the phone's Politics
 * app, the office you win (salary, budget, public projects that are built where you choose) and what happens if you
 * steal from it (the EFCC opens a case; a conviction removes you and bars you from standing).
 */
const C = (c) => new THREE.Color(c);
export class PoliticsController {
 constructor(g) { this.g = g; this.group = new THREE.Group(); this.group.name = 'Politics'; this.projectMeshes = new Map(); this.rallyMesh = null; this.posterMeshes = []; this.day = null; this.office = null; this.grounds = []; }
 get P() { return this.g.saveData?.politics; }
 adult() { return this.g.saveData?.character?.ageGroup !== 'child'; }
 get today() { return this.g.clock.day; }
 me() { return this.g.saveData?.character?.name ?? 'You'; }
 standing() { const s = this.g.life?.standing?.s ?? {}; return { publicStanding: s.public ?? 0, social: s.social ?? 0, integrity: s.integrity ?? 0, charisma: this.g.skills?.level?.('charisma') ?? 0 }; }
 setup() {
  const g = this.g, w = g.world;
  const avoid = [...(g.homeStores?.stores ?? []).map((s) => ({ x: s.door?.stand?.x ?? s.x, z: s.door?.stand?.z ?? s.z, r: 40 })), ...(g.hospitals?.list ?? []).map((h) => ({ x: h.place.x, z: h.place.z, r: 45 })), ...(g.business?.branches ?? []).map((b) => ({ x: b.x, z: b.z, r: 40 })), ...(g.eateries?.list ?? []).map((e) => ({ x: e.place.x, z: e.place.z, r: 50 }))].filter((q) => Number.isFinite(q.x));
  const plot = venueNear(w, 'ochanja', 'electoral', { from: 90, avoid, seed: 11 });
  if (plot) {
   const v = { ...plot, id: 'electoral-office', kind: 'electoral', name: 'Electoral Offices' }; buildVenue(w, v, this.group);
   const d = venueDoor(v, 0, -6.9, 2.4); this.office = { door: d, place: { x: d.stand.x, z: d.stand.z } };
   g.interactions.register({ x: d.stand.x, z: d.stand.z, radius: 3, priority: 2, enabled: () => !!g.saveData && !g.homes.inside && !g.vehicles.driving && !g.civic?.inside, label: () => 'Electoral Offices — go in', onInteract: () => this.enter() });
  }
  for (const r of RALLY_GROUNDS) {
   const L = w.landmarks.get(r.id); if (!L) continue; let x = L.x + 18, z = L.z + 12; try { [x, z] = w.findFreeSpot(x, z, 3); } catch { /* keep */ }
   const gr = { ...r, x, z }; this.grounds.push(gr);
   g.interactions.register({ x, z, radius: 4, priority: 1, enabled: () => !!g.saveData && !g.civic?.inside && !g.homes.inside && !g.vehicles.driving && !!this.myRace() && season(this.today).phase === 'campaign', label: () => `Rally ground · ${r.label} — hold a rally`, onInteract: () => g.openChoice(() => this.rallyView(gr)) });
  }
  g.renderer.scene.add(this.group);
 }
 start() { const g = this.g; if (!g.saveData) return; this.saveRef = g.saveData; g.saveData.politics = ensurePolitics(g.saveData.politics); for (const { group } of this.projectMeshes.values()) this.drop(group); this.projectMeshes.clear(); this.day = g.clock.day; this.catchUp(); this.refreshVisuals(); }
 places() { const out = []; if (this.office) out.push({ x: this.office.place.x, z: this.office.place.z, kind: 'office', id: 'electoral-office', label: 'Electoral Offices (INEC · ANSIEC)' }); if (this.myRace() && season(this.today).phase === 'campaign') for (const r of this.grounds) out.push({ x: r.x, z: r.z, kind: 'office', id: 'rally-' + r.id, label: `Rally ground · ${r.label}` }); return out; }
 key(k) { const P = this.P; if (P.keys.includes(k)) return false; P.keys.push(k); if (P.keys.length > 200) P.keys.shift(); return true; }
 // ── seasons and races ─────────────────────────────────────────────────────────────────────────
 seasonState(n = season(this.today).n) { const P = this.P; P.seasons[n] ??= { races: {} }; const S = P.seasons[n];
  for (const o of OFFICES) S.races[o.id] ??= { office: o.id, candidates: npcCandidates(o.id, n), seed: (n * 31 + o.units) % 997, campaign: {}, player: false };
  const ks = Object.keys(P.seasons).map(Number).sort((a, b) => a - b); while (ks.length > 3) delete P.seasons[ks.shift()]; return S; }
 race(office, n) { return this.seasonState(n).races[office]; }
 /** The race you are standing in this season, if any. */
 myRace() { const P = this.P; if (!P) return null; const S = P.seasons[season(this.today).n]; return Object.values(S?.races ?? {}).find((r) => r.player) ?? null; }
 me_id() { return 'player'; }
 strengthOf(race) { return playerStrength({ ...this.standing(), campaign: race.campaign }); }
 /** Your candidate entry kept up to date with your campaign. */
 syncMe(race) { const c = race.candidates.find((x) => x.id === 'player'); if (c) { c.strength = this.strengthOf(race); c.party = this.P.party ?? c.party; c.name = this.me(); } }
 convictedForCorruption() { return (this.g.saveData?.justice?.cases ?? []).some((c) => String(c.ref ?? '').startsWith('politics:') && String(c.outcome ?? '').startsWith('convicted') && (c.closedDay ?? 0) > (this.P.barredSince ?? -1)); }
 // ── daily ───────────────────────────────────────────────────────────────────────────────────────
 update() { const g = this.g; if (!g.saveData) return; if (this.day == null || this.saveRef !== g.saveData || !this.P) { this.start(); return; } if (g.clock.day !== this.day) { this.day = g.clock.day; this.catchUp(); this.refreshVisuals(); } }
 /** Run everything due up to today (results days you slept through, salaries, projects finishing). */
 catchUp() {
  const g = this.g, P = this.P, day = this.today, s = season(day); if (!P) return;
  // results of this season and the one before (if you were away)
  for (const n of [s.n - 1, s.n]) { if (n < 0) continue; const S = P.seasons[n]; if (!S) continue; const rd = n * SEASON.length + SEASON.resultsDay; if (day >= rd && !S.declared) this.declare(n); }
  // the term you hold
  const o = P.office; if (o) {
   if (o.until && day >= o.until && !(o.renewed >= o.until)) { this.leaveOffice('Your term ended.'); }
   else { for (let d = (o.paidTo ?? o.since) + 7; d <= day; d += 7) { const T = OFFICE[o.id]; g.economy.transact({ key: `office-pay:${o.id}:${o.since}:${d}`, amount: T.salary, reason: `Office salary: ${T.title}` }); o.paidTo = d; } }
  }
  if (this.convictedForCorruption()) { // a corruption conviction: out of office, out of the race, barred for two seasons
   if (P.office) this.leaveOffice('Removed from office after a corruption conviction.');
   const r = this.myRace(); if (r && !r.result) { r.player = false; r.candidates = r.candidates.filter((c) => c.id !== 'player'); r.disqualified = true; g.ui?.toast?.('You have been disqualified from the election.', 6000); }
   P.barredUntil = day + 2 * SEASON.length; P.barredSince = day; g.life?.note(`barred:${day}`, 'Barred from public office after a corruption conviction', { public: -6 }); }
  for (const pr of P.projects) if (!pr.done && day >= pr.doneDay) { pr.done = true; if (this.key(`project-open:${pr.id}`)) { g.life?.note(`project:${pr.id}`, `Commissioned the ${PROJECT[pr.kind].label.toLowerCase()} (${pr.where ?? 'Onitsha'})`, { public: PROJECT[pr.kind].public, social: 1 }); g.ui?.toast?.(`The ${PROJECT[pr.kind].label.toLowerCase()} is finished and open.`, 5000); } }
  // campaign donations come in after rallies
  const mine = this.myRace(); if (mine && s.phase === 'campaign' && (mine.campaign.donatedTo ?? 0) < day) { const owed = (mine.campaign.rallies ?? 0) - (mine.campaign.donRallies ?? 0); if (owed > 0) { mine.campaign.fund = (mine.campaign.fund ?? 0) + owed * CAMPAIGN.donationsPerRally(OFFICE[mine.office]); mine.campaign.donRallies = mine.campaign.rallies; } mine.campaign.donatedTo = day; }
  g.saveGame?.();
 }
 /** Count and declare every race of season n (the record is kept; results come from it). */
 declare(n) {
  const g = this.g, P = this.P, S = this.seasonState(n), out = [];
  for (const o of OFFICES) {
   const race = S.races[o.id]; if (race.player) this.syncMe(race);
   race.record ??= holdElection({ office: o.id, n, candidates: race.candidates, seed: race.seed });
   const d = decide(race, n); race.record = d.record; race.result = { winner: d.result.winner, totals: d.result.totals, cast: d.result.cast, rerun: d.round > 1 };
   const w = race.candidates.find((c) => c.id === race.result.winner); race.winnerName = w?.name ?? '?'; race.winnerParty = w?.party ?? null;
   out.push(`${o.title}: ${race.winnerName} (${PARTY[race.winnerParty]?.short ?? ''})${d.round > 1 ? ' after a re-run' : ''}`);
   if (race.player) {
    const won = race.result.winner === 'player', share = Math.round((100 * (race.result.totals.player ?? 0)) / Math.max(1, race.result.cast));
    P.history.push({ n, office: o.id, won, share, day: g.clock.day });
    if (won) { const T = OFFICE[o.id]; if (P.office) this.leaveOffice('You take up your new office.', { quiet: true }); P.office = { id: o.id, since: n * SEASON.length + SEASON.resultsDay, until: (n + 1) * SEASON.length + SEASON.resultsDay, budget: T.budget, spent: 0, diverted: 0, diversions: 0, n, paidTo: n * SEASON.length + SEASON.resultsDay };
     g.life?.note(`elected:${n}:${o.id}`, `Elected ${T.title} with ${share}% of the vote`, { public: 12, social: 3 }); g.ui?.toast?.(`You won! You are the new ${T.title} (${share}%).`, 7000); }
    else { g.life?.note(`lost:${n}:${o.id}`, `Lost the election for ${OFFICE[o.id].title} (${share}%)`, { public: 2 }); g.ui?.toast?.(`The election for ${OFFICE[o.id].title} went to ${race.winnerName}. You got ${share}%.`, 7000); }
   }
  }
  S.declared = true; S.summary = out; return out;
 }
 leaveOffice(why, { quiet = false } = {}) { const g = this.g, P = this.P, o = P.office; if (!o) return; P.history.push({ n: o.n, office: o.id, left: why, day: g.clock.day }); P.office = null; if (!quiet) g.ui?.toast?.(why, 6000); }
 // ── the electoral office ───────────────────────────────────────────────────────────────────────
 enter() {
  const g = this.g, s = season(this.today), h = g.clock.minutes / 60, polling = s.phase === 'election' && h >= SEASON.polls[0] && h < SEASON.polls[1];
  const see = (fn) => () => g.openChoice(fn);
  const results = this.resultLines();
  const l = { id: 'electoral-office', kind: 'electoral', name: 'Electoral Offices', x: this.office.place.x, z: this.office.place.z, visitSpot: this.office.place, interior: { kind: 'electoral', hours: [8, 17], opts: { pollingOpen: polling, results }, welcome: polling ? 'Election day: the polling unit is open' : 'Electoral Offices · INEC on the left, ANSIEC on the right', counters: [
   { at: 'register', label: 'INEC desk — register to vote', act: see(() => this.registerView()) }, { at: 'nominate', label: 'ANSIEC desk — nominations', act: see(() => this.nominateView()) },
   { at: 'results', label: 'Results board', act: see(() => this.resultsView()) }, { at: 'debate', label: "Candidates' debate", act: see(() => this.debateView()) },
   ...(polling ? [{ at: 'vote', label: 'Polling unit — vote', act: see(() => this.voteView()) }] : [])] } };
  return g.civic.enter(l);
 }
 registerView() {
  const g = this.g, P = this.P, opts = [];
  if (!this.adult()) return { title: 'Voter registration', kicker: 'INEC', text: 'You must be 18 to register.', options: [{ label: 'OK', act: () => g.closeChoice() }] };
  if (!P.registered) opts.push({ label: 'Register and collect your voter card (PVC)', sub: 'Free · takes an hour', act: () => { P.registered = true; P.regDay = this.today; g.skipTime(60); g.life?.note('registered-voter', 'Registered to vote', { public: 1 }); g.saveGame(); g.openChoice(() => this.registerView()); } });
  else opts.push({ label: `Registered since day ${P.regDay}`, sub: 'Polling unit 004 · Ward 4, Onitsha North', disabled: true, why: 'Done' });
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Voter registration', kicker: 'INEC · ONITSHA NORTH', text: P.registered ? 'You can vote in every election here, once per election.' : 'Register to vote. You need a voter card to vote and to stand for office.', options: opts };
 }
 nominateView() {
  const g = this.g, P = this.P, s = season(this.today), st = this.standing(), opts = [];
  if (!this.adult()) return { title: 'Nominations', kicker: 'ANSIEC', text: 'Politics is for adults.', options: [{ label: 'OK', act: () => g.closeChoice() }] };
  for (const o of OFFICES) { const c = canStand(P, { office: o.id, adult: this.adult(), day: this.today, publicStanding: st.publicStanding, money: g.economy.balance, convicted: this.convictedForCorruption() });
   opts.push({ label: `Stand for ${o.title} · forms ${naira(o.fee)}`, sub: `${o.area} · run by ${o.body}`, disabled: !c.ok, why: c.error, act: () => this.stand(o.id) }); }
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: 'Nominations', kicker: `ANSIEC · SEASON ${s.n + 1} · DAY ${s.at} OF ${SEASON.length}`, text: s.phase === 'nominations' ? `Nominations are open until day ${SEASON.nominationsEnd} of the season. Your party: ${PARTY[P.party]?.name ?? 'none yet (join one on the phone: Politics)'}.` : `Nominations are closed. The next season starts on day ${s.start + SEASON.length}.`, note: 'One office per season. Higher offices need more public standing and experience.', options: opts };
 }
 stand(office) {
  const g = this.g, P = this.P, o = OFFICE[office], st = this.standing(), c = canStand(P, { office, adult: this.adult(), day: this.today, publicStanding: st.publicStanding, money: g.economy.balance, convicted: this.convictedForCorruption() });
  if (!c.ok) { g.ui.toast(c.error, 5000); return false; }
  const tx = g.economy.transact({ key: `nomination:${season(this.today).n}:${office}`, amount: -o.fee, reason: `${o.body}: nomination forms (${o.title})` }); if (tx?.ok === false) { g.ui.toast(tx.error ?? 'Payment failed.'); return false; }
  const race = this.race(office); race.player = true; race.candidates = race.candidates.filter((x) => x.party !== P.party); race.candidates.push({ id: 'player', name: this.me(), party: P.party, strength: this.strengthOf(race), npc: false }); race.campaign = { rallies: 0, posters: 0, debate: 0, bought: 0, scandal: 0, fund: 0, places: [] };
  g.life?.note(`stood:${season(this.today).n}:${office}`, `Nominated by the ${PARTY[P.party].short} for ${o.title}`, { public: 2 }); g.saveGame(); g.closeChoice(); g.ui.toast(`You are the ${PARTY[P.party].short} candidate for ${o.title}. Campaign from day ${SEASON.nominationsEnd + 1}.`, 6000); this.refreshVisuals(); return true;
 }
 resultLines() { const P = this.P, out = []; for (const [n, S] of Object.entries(P?.seasons ?? {}).sort((a, b) => b[0] - a[0])) { if (!S.declared) continue; out.push(`Season ${+n + 1}:`); out.push(...(S.summary ?? []).map((x) => '  ' + x)); if (out.length > 9) break; } return out.slice(0, 10); }
 resultsView() { const g = this.g, lines = this.resultLines(); return { title: 'Results', kicker: 'DECLARED RESULTS', text: lines.length ? lines.join('\n') : 'No elections declared yet.', note: 'Every result is counted from the polling unit record. Tap a race on the phone (Politics) for the full count.', options: [{ label: 'Close', act: () => g.closeChoice() }] }; }
 // ── voting ──────────────────────────────────────────────────────────────────────────────────────
 voteView() {
  const g = this.g, P = this.P, s = season(this.today), S = this.seasonState(s.n), opts = [];
  if (!this.adult()) return { title: 'Polling unit', text: 'Only adults can vote.', options: [{ label: 'OK', act: () => g.closeChoice() }] };
  if (!P.registered || P.regDay >= s.electionDay) return { title: 'Polling unit', kicker: 'POLLING UNIT 004', text: 'Your name is not on the register for this election. Register at the INEC desk before election day.', options: [{ label: 'OK', act: () => g.closeChoice() }] };
  for (const o of OFFICES) { const race = S.races[o.id]; if (race.player) this.syncMe(race); race.record ??= holdElection({ office: o.id, n: s.n, candidates: race.candidates, seed: race.seed }); const voted = race.record.ballots.some((b) => b.voter === this.me_id());
   opts.push({ label: `${o.title}${voted ? ' · voted ✓' : ''}`, sub: race.candidates.map((c) => `${c.name} (${PARTY[c.party]?.short})`).join(' · '), disabled: voted, why: 'You have voted in this election', act: () => g.openChoice(() => this.ballotView(o.id)) }); }
  opts.push({ label: 'Done', ghost: true, act: () => g.closeChoice() });
  return { title: 'Polling unit 004', kicker: `ELECTION DAY · POLLS ${SEASON.polls[0]}:00–${SEASON.polls[1]}:00`, text: 'Show your voter card, get your ballot papers, and vote in the cubicle. One vote per election.', options: opts };
 }
 ballotView(office) { const g = this.g, race = this.race(office); return { title: `Ballot · ${OFFICE[office].title}`, kicker: OFFICE[office].body, text: 'Thumbprint one box. Your vote is secret.', options: [...race.candidates.map((c) => ({ label: `${PARTY[c.party]?.short} · ${c.name}${c.id === 'player' ? ' (you)' : ''}`, act: () => this.vote(office, c.id) })), { label: 'Back', ghost: true, act: () => g.openChoice(() => this.voteView()) }] }; }
 vote(office, candidateId) {
  const g = this.g, s = season(this.today), race = this.race(office, s.n);
  if (s.phase !== 'election') { g.ui.toast('Voting is only on election day.'); return { ok: false, error: 'Not election day.' }; }
  race.record ??= holdElection({ office, n: s.n, candidates: race.candidates, seed: race.seed });
  const r = castBallot(race.record, this.me_id(), candidateId, 3); if (!r.ok) { g.ui.toast(r.error); return r; }
  g.life?.note(`voted:${s.n}:${office}`, `Voted in the election for ${OFFICE[office].title}`, { public: 1, social: 1 }); g.saveGame(); g.openChoice(() => this.voteView()); return r;
 }
 // ── campaigning ─────────────────────────────────────────────────────────────────────────────────
 spend(race, amount, reason, key) { const g = this.g, c = race.campaign, fromFund = Math.min(c.fund ?? 0, amount), rest = amount - fromFund; if (rest > 0 && !g.economy.canAfford(rest)) return false; if (rest > 0) { const tx = g.economy.transact({ key, amount: -rest, reason }); if (tx?.ok === false) return false; } c.fund = (c.fund ?? 0) - fromFund; return true; }
 rallyView(gr) {
  const g = this.g, race = this.myRace(); if (!race) return null; const o = OFFICE[race.office], cost = CAMPAIGN.rally.cost(o), done = (race.campaign.places ?? []).includes(gr.id), today = race.campaign.rallyDay === this.today;
  const opts = [{ label: `Hold a rally here · ${naira(cost)}`, sub: `Two hours: a stage, music, your speech. Campaign fund ${naira(race.campaign.fund ?? 0)} is used first`, disabled: done || today, why: done ? 'You have rallied here this season' : 'One rally a day', act: () => this.rally(gr) }];
  const vb = CAMPAIGN.voteBuying.cost(o); opts.push({ label: `(Share money to the crowd · ${naira(vb)})`, sub: 'Vote buying. It is a crime: it can win votes, and it leaves evidence for the EFCC', act: () => this.buyVotes(gr) });
  opts.push({ label: 'Back', ghost: true, act: () => g.closeChoice() });
  return { title: `Rally ground · ${gr.label}`, kicker: `${PARTY[this.P.party].short} · ${o.title.toUpperCase()}`, text: 'Bring the crowd, make your case.', options: opts };
 }
 rally(gr) {
  const g = this.g, race = this.myRace(), o = OFFICE[race.office], cost = CAMPAIGN.rally.cost(o);
  if (!this.spend(race, cost, `Campaign: rally at ${gr.label}`, `rally:${season(this.today).n}:${gr.id}`)) { g.ui.toast('Not enough money for the rally.'); return false; }
  race.campaign.rallies = (race.campaign.rallies ?? 0) + 1; (race.campaign.places ??= []).push(gr.id); race.campaign.rallyDay = this.today; race.campaign.rallyAt = gr.id;
  g.skipTime(CAMPAIGN.rally.minutes); g.needs?.adjust({ energy: -15, social: 15 }); g.life?.note(`rally:${season(this.today).n}:${gr.id}`, `Held a ${PARTY[this.P.party].short} rally at ${gr.label}`, { public: 1, social: 2 });
  g.closeChoice(); g.ui.toast(`A good crowd at ${gr.label}. Donations will come in tomorrow.`, 5000); this.syncMe(race); g.saveGame(); this.refreshVisuals(); return true;
 }
 buyVotes(gr) {
  const g = this.g, race = this.myRace(), o = OFFICE[race.office], cost = CAMPAIGN.voteBuying.cost(o), s = season(this.today);
  if (!this.spend(race, cost, `Campaign: cash for the crowd at ${gr.label}`, `votebuy:${s.n}:${gr.id}:${this.today}`)) { g.ui.toast('Not enough money.'); return false; }
  race.campaign.bought = (race.campaign.bought ?? 0) + 1; race.campaign.scandal = (race.campaign.scandal ?? 0) + (Math.random() < 0.35 ? 1 : 0);
  const J = g.justice; if (J?.ready) J.cases.open({ agency: 'efcc', offence: `Vote buying (${o.title} election)`, severity: 2, evidence: CAMPAIGN.voteBuying.evidence, day: this.today, ref: `politics:votebuy:${s.n}:${race.office}` });
  g.life?.note(`votebuy:${s.n}:${gr.id}:${this.today}`, `Shared money at a rally (${gr.label})`, { integrity: -8, notoriety: 3 });
  g.closeChoice(); g.ui.toast('The crowd cheers. Someone filmed it.', 5000); this.syncMe(race); g.saveGame(); return true;
 }
 posters() { const g = this.g, race = this.myRace(); if (!race) return false; const o = OFFICE[race.office], cost = CAMPAIGN.posters.cost(o); if ((race.campaign.posters ?? 0) >= CAMPAIGN.posters.max) return false; if (!this.spend(race, cost, 'Campaign: posters', `posters:${season(this.today).n}:${race.campaign.posters ?? 0}`)) { g.ui.toast('Not enough money.'); return false; } race.campaign.posters = (race.campaign.posters ?? 0) + 1; this.syncMe(race); g.saveGame(); this.refreshVisuals(); return true; }
 donate(amount) { const g = this.g, race = this.myRace(); if (!race || !g.economy.canAfford(amount)) return false; const tx = g.economy.transact({ key: `campaign-fund:${season(this.today).n}:${Date.now()}`, amount: -amount, reason: 'Campaign: your own money into the campaign fund' }); if (tx?.ok === false) return false; race.campaign.fund = (race.campaign.fund ?? 0) + amount; g.saveGame(); return true; }
 debateView() {
  const g = this.g, race = this.myRace(), s = season(this.today);
  if (!race) return { title: "Candidates' debate", text: s.phase === 'campaign' ? `The debate is on day ${s.debateDay}. Come and watch (you're not a candidate).` : 'No debate today.', options: [{ label: 'Close', act: () => g.closeChoice() }] };
  if (this.today < s.debateDay || s.phase !== 'campaign') return { title: "Candidates' debate", text: `The debate opens on day ${s.debateDay} (any day until the campaign ends).`, options: [{ label: 'Close', act: () => g.closeChoice() }] };
  const d = race.campaign.debateState ??= { q: 0, score: 0, done: false };
  if (d.done) return { title: "Candidates' debate", text: `You have debated. The papers scored you ${race.campaign.debate} out of 9.`, options: [{ label: 'Close', act: () => g.closeChoice() }] };
  const Q = DEBATE[d.q], ch = this.standing().charisma;
  return { title: "Candidates' debate", kicker: `QUESTION ${d.q + 1} OF ${DEBATE.length}`, text: Q.q, options: Q.a.map((a) => ({ label: a.t, act: () => { d.score += a.s + (a.s > 0 && ch >= 5 ? 0.5 : 0); if (a.integrity) g.life?.note(`debate-promise:${s.n}:${d.q}`, 'Made a promise at the debate you can\'t keep', { integrity: a.integrity }); d.q++; if (d.q >= DEBATE.length) { d.done = true; race.campaign.debate = Math.max(0, Math.round(d.score)); g.life?.note(`debate:${s.n}`, `Debated as the ${PARTY[this.P.party].short} candidate`, { public: race.campaign.debate >= 6 ? 3 : 1 }); this.syncMe(race); } g.saveGame(); g.openChoice(() => this.debateView()); } })) };
 }
 /** Your chance, as the newspapers see it: your strength against the field (an estimate, not the result). */
 poll(race) { this.syncMe(race); const n = season(this.today).n, r = holdElection({ office: race.office, n, candidates: race.candidates, seed: 9000 + race.seed }), t = tally(r); return race.candidates.map((c) => ({ name: c.name, party: c.party, me: c.id === 'player', share: Math.round((100 * (t.totals[c.id] ?? 0)) / Math.max(1, t.cast)) })).sort((a, b) => b.share - a.share); }
 // ── in office ───────────────────────────────────────────────────────────────────────────────────
 commission(kind) {
  const g = this.g, P = this.P, o = P.office, pr = PROJECT[kind]; if (!o) return { ok: false, error: 'You hold no office.' };
  if (o.budget - o.spent < pr.cost) return { ok: false, error: 'Not enough left in the budget.' };
  if (g.civic?.inside || g.homes?.inside) return { ok: false, error: 'Go outside to where you want it built.' };
  let x = g.player.position.x + Math.sin(g.player.heading) * 6, z = g.player.position.z + Math.cos(g.player.heading) * 6; try { [x, z] = g.world.findFreeSpot(x, z, 2.5); } catch { /* keep */ }
  if (P.projects.some((q) => Math.hypot(q.x - x, q.z - z) < 8)) return { ok: false, error: 'There is already a project right here.' };
  o.spent += pr.cost; const id = `p${++P.seq}`; P.projects.push({ id, kind, x, z, heading: g.player.heading, day: this.today, doneDay: this.today + pr.days, done: false, by: `${OFFICE[o.id].prefix} ${this.me()}`, office: o.id, where: this.g.world.placeName?.(x, z) ?? null });
  g.life?.note(`commission:${id}`, `Started a ${pr.label.toLowerCase()} (${naira(pr.cost)} of public money)`, { public: 1 }); g.saveGame(); this.refreshVisuals(); return { ok: true, id };
 }
 /** Corruption: move public money to your own pocket. The EFCC hears about it. */
 divert(amount) {
  const g = this.g, P = this.P, o = P.office; if (!o) return { ok: false, error: 'You hold no office.' };
  amount = Math.min(Math.floor(amount), o.budget - o.spent); if (amount <= 0) return { ok: false, error: 'Nothing left to take.' };
  o.spent += amount; o.diverted += amount; o.diversions = (o.diversions ?? 0) + 1;
  g.economy.transact({ key: `divert:${o.n}:${o.id}:${o.diversions}`, amount, reason: `Diverted public funds (${OFFICE[o.id].title})` });
  const ev = diversionEvidence(amount, o.budget, o.diversions - 1), J = g.justice, ref = `politics:divert:${o.n}:${o.id}`;
  if (J?.ready) { const old = J.cases.j.cases.find((c) => c.ref === ref && c.status !== 'closed'); if (old) J.cases.add(old.id, ev * 0.6, amount); else J.cases.open({ agency: 'efcc', offence: `Diversion of public funds (${OFFICE[o.id].title})`, severity: amount > 20_000_000 ? 4 : 3, evidence: ev * 0.6, day: this.today, ref, amount }); }
  g.life?.note(`divert:${o.n}:${o.diversions}`, `Diverted ${naira(amount)} of public money`, { integrity: -15, notoriety: 6, public: -3, rumour: false });
  g.saveGame(); return { ok: true, amount };
 }
 joinParty(id) { const g = this.g, P = this.P; if (!this.adult() || !PARTY[id] || P.party === id) return false; if (this.myRace()) { g.ui.toast('You can\'t change party while you are a candidate.'); return false; } if (!g.economy.canAfford(MEMBERSHIP_FEE)) return false; g.economy.transact({ key: `party:${id}:${this.today}`, amount: -MEMBERSHIP_FEE, reason: `${PARTY[id].short}: party membership` }); const was = P.party; P.party = id; P.joined = this.today; g.life?.note(`party:${id}:${this.today}`, was ? `Left the ${PARTY[was].short} for the ${PARTY[id].short}` : `Joined the ${PARTY[id].name}`, { social: 1, public: was ? -1 : 0 }); g.saveGame(); return true; }
 // ── the city changes ───────────────────────────────────────────────────────────────────────────
 refreshVisuals() {
  const P = this.P; if (!P) return;
  for (const pr of P.projects) { const key = `${pr.id}:${pr.done ? 1 : 0}`, old = this.projectMeshes.get(pr.id); if (old?.key === key) continue; if (old) this.drop(old.group); const grp = this.buildProject(pr); this.group.add(grp); this.projectMeshes.set(pr.id, { key, group: grp }); }
  if (this.rallyMesh) { this.drop(this.rallyMesh); this.rallyMesh = null; }
  const race = this.myRace(), gr = race && race.campaign.rallyDay === this.today ? this.grounds.find((r) => r.id === race.campaign.rallyAt) : null; if (gr) { this.rallyMesh = this.buildRally(gr); this.group.add(this.rallyMesh); }
  for (const m of this.posterMeshes) this.drop(m); this.posterMeshes = [];
  if (race && (race.campaign.posters ?? 0) > 0) for (const [i, gr2] of this.grounds.entries()) { if (i >= race.campaign.posters + 1) break; const m = this.buildPoster(gr2, race); this.group.add(m); this.posterMeshes.push(m); }
 }
 drop(o) { o.parent?.remove(o); o.traverse((m) => { m.geometry?.dispose(); m.material?.map?.dispose(); m.material?.dispose(); }); for (const p of o.userData.polys ?? []) this.g.world.collision.removePolygon(p); }
 board(text, sub, w, h, bg, fg) { const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * h / w); const c = cv.getContext('2d'); c.fillStyle = bg; c.fillRect(0, 0, cv.width, cv.height); c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle'; const f = Math.min(cv.height * 0.32, 96); c.font = `800 ${f}px Arial`; c.fillText(text, 512, cv.height * (sub ? 0.36 : 0.5), 980); if (sub) { c.font = `600 ${f * 0.5}px Arial`; c.fillText(sub, 512, cv.height * 0.74, 980); } const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.3, side: THREE.DoubleSide })); }
 buildProject(pr) {
  const grp = new THREE.Group(), gb = new GeoBuilder(), glow = new GeoBuilder(), polys = []; grp.position.set(pr.x, 0, pr.z); grp.rotation.y = pr.heading ?? 0; grp.name = `project:${pr.id}`;
  const box = (w, h, d, x, y, z, col, lit = false) => (lit ? glow : gb).box(x, z, y - h / 2, y + h / 2, w, d, 0, C(col)), cyl = (x, z, y0, y1, r, col) => gb.cylinder(x, z, y0, y1, r, C(col), 12);
  const solid = (w, d, x = 0, z = 0) => { const c = Math.cos(pr.heading ?? 0), s = Math.sin(pr.heading ?? 0), pt = (a, b) => [pr.x + c * a + s * b, pr.z - s * a + c * b]; polys.push(this.g.world.collision.addPolygon([pt(x - w / 2, z - d / 2), pt(x + w / 2, z - d / 2), pt(x + w / 2, z + d / 2), pt(x - w / 2, z + d / 2)], 2)); };
  if (!pr.done) { // under construction: a hoarding, sand, blocks
   for (const [x, z, w, d] of [[0, -2.5, 6, 0.08], [0, 2.5, 6, 0.08], [-3, 0, 0.08, 5], [3, 0, 0.08, 5]]) box(w, 1.8, d, x, 0.9, z, '#2f6f9f'); box(2, 0.6, 1.4, -1, 0.3, 0, '#c9a46a'); for (let i = 0; i < 6; i++) box(0.4, 0.2, 0.2, 1 + (i % 3) * 0.45, 0.1 + Math.floor(i / 3) * 0.2, 0.5, '#9a9a94'); solid(6, 5);
  } else switch (pr.kind) {
   case 'streetlights': for (let i = 0; i < 6; i++) { const z = -10 + i * 4; cyl(0, z, 0, 6, 0.08, '#7a8288'); box(1.1, 0.06, 0.6, 0.4, 6.1, z, '#1f3a6a'); box(0.5, 0.12, 0.25, 0.7, 5.9, z, '#fff6d8', true); } break;
   case 'borehole': cyl(0, 0, 0, 4, 0.12, '#7a8288'); for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(x, z, 0, 4, 0.08, '#7a8288'); cyl(0, 0, 4, 6, 1.2, '#2f6fa8'); box(2, 1, 0.8, 0, 0.5, 2.2, '#b9b3a6'); for (const x of [-0.6, 0, 0.6]) box(0.08, 0.3, 0.08, x, 1.1, 2.6, '#c0c0c0'); solid(2.6, 2.6); break;
   case 'shelter': box(4, 0.1, 1.8, 0, 2.6, 0, '#167b46'); for (const x of [-1.9, 1.9]) box(0.1, 2.6, 0.1, x, 1.3, -0.8, '#7a8288'); box(4, 2, 0.05, 0, 1.4, -0.85, '#bcd8e4'); box(3, 0.08, 0.4, 0, 0.5, -0.5, '#6b4a30'); break;
   case 'toilet': box(5, 2.8, 3, 0, 1.4, 0, '#e9e4d8'); box(5.2, 0.2, 3.2, 0, 2.9, 0, '#167b46'); for (const x of [-1.2, 1.2]) box(0.9, 2, 0.06, x, 1, 1.53, '#2f6fa8'); solid(5, 3); break;
   case 'playground': box(8, 0.03, 6, 0, 0.02, 0, '#3f8f4a'); for (const x of [-2.6, -1]) box(0.1, 2.2, 0.1, x, 1.1, -1.5, '#c0392b'); box(1.8, 0.1, 0.1, -1.8, 2.2, -1.5, '#c0392b'); box(0.5, 0.05, 0.25, -1.8, 0.5, -1.5, '#f2c14e'); box(1, 1.4, 1, 2, 0.7, 0, '#2f6fa8'); box(0.6, 0.06, 2.2, 2, 0.7, 1.4, '#f2c14e'); box(2, 0.3, 0.3, 0, 0.15, 2.2, '#8b5a2b'); break;
   case 'road': box(3.4, 0.03, 16, 0, 0.035, 0, '#2a2b2d'); for (let i = 0; i < 4; i++) box(0.15, 0.035, 1.6, 0, 0.05, -6 + i * 4, '#f5f1e6'); break;
   case 'classroom': box(10, 3.2, 5, 0, 1.6, 0, '#efe6cf'); box(10.4, 0.25, 5.4, 0, 3.3, 0, '#7d1d28'); for (const x of [-3.5, -1, 1.5, 4]) box(1.2, 1, 0.06, x, 1.9, 2.53, '#5d8aa0'); box(1, 2.2, 0.06, -4.5, 1.1, 2.53, '#5a3a24'); solid(10, 5); break;
   case 'clinic': box(12, 3.4, 6, 0, 1.7, 0, '#f6f8f7'); box(12.4, 0.3, 6.4, 0, 3.5, 0, '#1f6f8b'); box(1.6, 0.5, 0.1, 3, 2.7, 3.06, '#d4202a'); box(0.5, 1.6, 0.1, 3, 2.7, 3.06, '#d4202a'); box(1.8, 2.2, 0.06, -3, 1.1, 3.03, '#153743'); for (const x of [-5, 0, 5]) box(1.4, 1, 0.06, x, 2, 3.03, '#5d8aa0'); solid(12, 6); break;
  }
  const mesh = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })); mesh.castShadow = true; mesh.receiveShadow = true; grp.add(mesh);
  if (glow.vertexCount) grp.add(new THREE.Mesh(glow.build(), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#ffffff', emissiveIntensity: 0.8 })));
  const label = pr.done ? PROJECT[pr.kind].label.toUpperCase() : `${PROJECT[pr.kind].label.toUpperCase()} · UNDER CONSTRUCTION`, sign = this.board(label, `Commissioned by ${pr.by} · ${OFFICE[pr.office]?.title ?? ''} · day ${pr.day}`, 3.4, 0.9, '#167b46', '#ffffff');
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.08), new THREE.MeshStandardMaterial({ color: '#7a8288' })); post.position.set(3.6, 0.8, 3.2); sign.position.set(3.6, 2.0, 3.25); grp.add(post, sign);
  grp.userData.polys = polys; return grp;
 }
 buildRally(gr) {
  const P = this.P, party = PARTY[P.party], grp = new THREE.Group(), gb = new GeoBuilder(); grp.position.set(gr.x, 0, gr.z); grp.name = 'rally';
  gb.box(0, 0, 0, 1, 6, 4, 0, C('#5a3a24')); for (const x of [-2.8, 2.8]) gb.box(x, -1.8, 1, 4, 0.15, 0.15, 0, C('#7a8288')); gb.box(0, -1.8, 4, 4.2, 6, 0.2, 0, C(party.color));
  for (let i = 0; i < 4; i++) { gb.box(-3.6 + i * 2.4, 4, 0, 2.6, 0.06, 0.06, 0, C('#7a8288')); }
  const mesh = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({ vertexColors: true })); grp.add(mesh);
  const banner = this.board(`VOTE ${this.me().toUpperCase()}`, `${party.short} · ${party.slogan}`, 5.6, 1.4, party.color, '#ffffff'); banner.position.set(0, 3.2, -1.7); grp.add(banner);
  for (let i = 0; i < 4; i++) { const f = this.board(party.short, null, 0.9, 0.6, party.color, '#ffffff'); f.position.set(-3.6 + i * 2.4, 2.3, 4); grp.add(f); }
  return grp;
 }
 buildPoster(gr, race) { const party = PARTY[this.P.party], m = this.board(`${this.me().toUpperCase()} FOR ${OFFICE[race.office].title.split(',')[0].toUpperCase()}`, `${party.short} · ${party.slogan} · vote on day ${season(this.today).electionDay}`, 3.2, 1.6, party.color, '#ffffff'); m.position.set(gr.x - 4, 2.2, gr.z - 3); m.name = 'poster'; return m; }
}
