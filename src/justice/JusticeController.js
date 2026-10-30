import * as THREE from 'three';
import { buildVenue, venuePlot, venueSize } from '../world/VenueArchitecture.js';
import { buildHuman, defaultAppearance } from '../characters/HumanRig.js';
import { naira } from '../economy/Economy.js';
import { OCCUPATION } from '../data/occupations.js';
import { CRIMES, attempt, chance, fencePrice, heistReady, incidentsFor, FENCE } from './Crime.js';
import { Cases, ensureJustice, LAWYERS } from './Cases.js';
import { SCHEMES, KINGDOM, NPC_KINGDOMS, newKingdom, recruit, canRun, runScheme, kingdomDay, suspect, payMore } from './Kingdom.js';
import { ACADEMY, FORCES, dutyFor, stepChoices, arrestOutcome, complaint } from './Forces.js';
/**
 * v0.42 crime, investigations, the courts, Hustle Kingdoms, and working for the police or the EFCC.
 * Stage 3 of the open-life plan, single-player. Agencies are the real names; every person, gang, bank and case is
 * fictional, and schemes stay abstract. Children never see any of it.
 */
const KINGDOM_CASE = 'Running a Hustle Kingdom (fraud schemes)';
export class JusticeController {
 constructor(g) {
  this.g = g; this.ready = false; this.checkAt = 0; this.raidAt = 0; this.clock = 0; this.rigs = []; this.gateCache = { t: -1, gate: null };
  g.bus.on('clock:day', (d) => { if (this.ready) try { this.newDay(d); } catch (e) { console.error('[justice]', e); } });
 }
 get j() { return this.save.justice; }
 get day() { return this.g.clock?.day ?? 1; }
 get hour() { return (this.g.clock?.minutes ?? 720) / 60; }
 adult() { return this.g.saveData?.character?.ageGroup !== 'child'; }
 night() { const h = this.hour; return h >= 22 || h < 4; }
 officer() { const c = this.g.life?.work?.current; return c && OCCUPATION[c.id]?.force ? c.id : null; }
 free() { const st = this.g.story?.s; return !!st && !st.arrest && !st.pending && this.g.story.outside(); }

 // ── world ──────────────────────────────────────────────────────────────────────────────────────
 setup() {
  const g = this.g, L = (id) => g.world.landmarks.get(id) ?? g.world.landmarks.list[0];
  this.group = new THREE.Group(); this.group.name = 'Justice'; g.renderer.scene.add(this.group);
  // the Magistrate Court
  const m = L('main-market'), p = venuePlot(g.world, { x: m.x - 60, z: m.z + 45 }, venueSize('court'));
  this.court = { id: 'magistrate-court', kind: 'court', name: 'Magistrate Court', ...p }; buildVenue(g.world, this.court, this.group);
  g.npcs.addAnchored({ id: 'court:clerk', kind: 'host', role: 'neighbour', name: 'Court clerk', x: p.x + Math.cos(p.yaw ?? 0) * 1.8, z: p.z - Math.sin(p.yaw ?? 0) * 1.8, nx: Math.sin(p.yaw ?? 0), nz: Math.cos(p.yaw ?? 0), schedule: [0, 24] });
  g.interactions.register({ x: p.x, z: p.z, radius: 4, enabled: () => this.ready && this.free(), label: () => this.courtOpen() ? (this.j.court ? 'Magistrate Court — go in for your hearing' : 'Magistrate Court — go in') : 'Magistrate Court — closed (sits 8:00–17:00)', onInteract: () => this.courtOpen() ? this.enterCourt() : g.openChoice(() => this.courtView()) });
  // the back-street dealer (buys stolen goods, sells tools, finds people for a job)
  const o = L('ochanja'), [dx, dz] = g.world.findFreeSpot(o.x - 26, o.z + 18, 0.6);
  this.dealer = { x: dx, z: dz, name: 'Back-street dealer' };
  g.npcs.addAnchored({ id: 'justice:dealer', kind: 'host', role: 'neighbour', name: 'Okwy (dealer)', x: dx, z: dz, nx: 0, nz: 1, schedule: [0, 24] });
  g.interactions.register({ x: dx, z: dz, radius: 2.6, priority: 5, enabled: () => this.ready && this.free(), label: 'Back-street dealer', onInteract: () => g.openChoice(() => this.dealerView()) });
  // break-ins: any walled compound, once you carry tools
  this.gates = (g.world.infill?.compounds ?? []).map((c) => { if (c.removed) return { x: 1e9, z: 1e9 }; const [a, b] = c.gate; return { x: (a[0] + b[0]) / 2 + Math.sin(c.yaw) * 1.2, z: (a[1] + b[1]) / 2 + Math.cos(c.yaw) * 1.2 }; });
  const self = this;
  g.interactions.register({ get x() { return self.nearGate()?.x ?? 1e9; }, get z() { return self.nearGate()?.z ?? 1e9; }, radius: 2.4, enabled: () => this.ready && this.j.kit && this.adult() && this.free() && !this.officer(), label: () => `A compound${this.night() ? ' (the family is asleep)' : ' (people are home)'} — break in?`, onInteract: () => g.openChoice(() => this.breakinView(this.nearGate())) });
  // the current duty step for an officer
  g.interactions.register({ get x() { return self.stepAt()?.x ?? 1e9; }, get z() { return self.stepAt()?.z ?? 1e9; }, radius: 5, priority: 15, enabled: () => this.ready && !!this.j.duty && this.free(), label: () => this.j.duty?.steps[this.j.duty.step]?.text ?? '', onInteract: () => g.openChoice(() => this.stepView()) });
 }
 courtOpen() { const h = this.hour; return h >= 8 && h < 17; }
 /** v0.44: the courtroom: the bench, the witness box and the dock, counsel tables, the gallery and the registry. */
 enterCourt() {
  const g = this.g, view = () => g.openChoice(() => this.courtView());
  this.court.civic ??= { id: 'magistrate-court', kind: 'court', name: 'Magistrate Court', x: this.court.x, z: this.court.z, visitSpot: { x: this.court.x, z: this.court.z }, interior: { kind: 'court', hours: [8, 17], welcome: 'Magistrate Court · the registry is on your right', counters: [{ at: 'robing', label: 'Robing room — lawyers\' chambers', act: () => this.g.openChoice(() => this.g.occupationsCity?.staffView({ name: 'Magistrate Court' }, ['lawyer'])) }, 
   { at: 'registry', label: () => this.j.court ? 'Registry — your hearing' : 'Registry', act: view }, { at: 'bench', label: () => this.j.court ? 'Stand before the magistrate' : 'The bench', act: view }] } };
  return g.civic.enter(this.court.civic);
 }
 nearGate() { const t = this.g.clock?.minutes ?? 0, p = this.g.player.position; if (this.gateCache.p && Math.hypot(this.gateCache.p.x - p.x, this.gateCache.p.z - p.z) < 1.5) return this.gateCache.gate; let best = null, d = 6; for (const q of this.gates) { const e = Math.hypot(q.x - p.x, q.z - p.z); if (e < d) { d = e; best = q; } } this.gateCache = { p: { x: p.x, z: p.z }, gate: best, t }; return best; }
 stepAt() { const d = this.j?.duty; return d && d.steps[d.step]?.at; }
 start(save) { save.justice = ensureJustice(save.justice); this.save = save; this.cases = new Cases(save.justice); this.ready = true; this.clearRigs(); this.placeRigs(); }
 places() { if (!this.ready) return []; return [{ x: this.court.x, z: this.court.z, kind: 'court', label: 'Magistrate Court' }, ...(this.adult() ? [{ x: this.dealer.x, z: this.dealer.z, kind: 'dealer', label: 'Back-street dealer' }] : [])]; }
 log(text) { this.cases.log(this.day, text); }
 /** What the world around you looks like for a crime right now. */
 crimeCtx(at, extra = {}) {
  const g = this.g, p = at ?? g.player.position, near = (n, r) => Math.hypot(n.x - p.x, n.z - p.z) < r;
  const people = g.npcs.active.filter((n) => n.state !== 'ride' && n.role !== 'police' && near(n, 18)).length;
  const police = g.npcs.active.filter((n) => n.role === 'police' && near(n, 30)).length + g.police.posts.filter((q) => near(q, 35)).length;
  return { skill: g.skills.level('hustle'), fitness: g.skills.level('fitness'), witnesses: Math.max(0, people - (extra.target ? 1 : 0)), police, night: this.night(), rep: g.life?.standing?.value('notoriety') ?? 0, ...extra };
 }

 // ── crimes ─────────────────────────────────────────────────────────────────────────────────────
 /** Crime options in a conversation with an NPC (adults only, never with police officers). */
 dialogueOptions(npc) {
  if (!this.ready || !this.adult() || !this.free() || npc.role === 'police' || this.g.vehicles?.driving) return [];
  if (npc.role === 'trader') return [{ kind: 'stall', label: '(Rob the stall)' }];
  return [{ kind: 'pickpocket', label: '(Try to pick their pocket)' }];
 }
 /** Ask first: say what you're about to do and the odds, so nothing happens by accident. */
 confirm(kind, at, extra, onGo) {
  const g = this.g, C = CRIMES[kind], ctx = this.crimeCtx(at, extra), p = chance(kind, ctx);
  g.openChoice(() => ({ title: C.label, kicker: 'CRIME · YOUR CHOICE', text: `${ctx.witnesses === 0 ? 'Nobody' : ctx.witnesses === 1 ? 'One person' : `${ctx.witnesses} people`} can see you${ctx.police ? `, and police are close (${ctx.police})` : ''}. If it goes wrong you may be chased, and people who saw you can tell the police.`, note: `Your chances: about ${Math.round(p * 100)}%. A crime is investigated: it can lead to a warrant, an arrest and court.`, options: [
   { label: 'Do it', primary: true, act: () => { g.closeChoice(); onGo(ctx); } },
   { label: 'Leave it', ghost: true, act: () => g.closeChoice() }] }));
 }
 commit(kind, npc = null) {
  if (!this.adult()) return;
  const at = npc ? { x: npc.x, z: npc.z } : null;
  this.confirm(kind, at, { target: !!npc }, (ctx) => this.resolve(kind, ctx, { npc, place: npc ? (npc.role === 'trader' ? `${npc.name}'s stall` : npc.name) : null }));
 }
 resolve(kind, ctx, { npc = null, place = null, cctv = false, crew = 0, scouted = false, getaway = false, bank = null } = {}) {
  const g = this.g, C = CRIMES[kind], seq = ++this.j.seq;
  const r = attempt(kind, { ...ctx, cctv, crew, scouted, getaway, rng: this.rng });
  g.skipTime(C.minutes); g.needs.adjust({ energy: -Math.min(20, C.minutes / 2) });
  const value = r.loot + r.goods.reduce((s, x) => s + x.value, 0);
  const caseObj = this.cases.open({ agency: C.agency, offence: `${C.offence}${place ? ` (${place})` : ''}`, severity: C.severity, evidence: r.evidence + (r.caught ? 1 : 0), day: this.day, ref: `crime:${seq}`, amount: value });
  if (r.ok) {
   if (r.loot) g.economy.transact({ key: `loot:${caseObj.id}`, amount: r.loot, reason: kind === 'heist' ? 'Robbery proceeds' : 'Stolen cash' });
   for (const x of r.goods) this.j.stash.push({ id: `s:${seq}:${this.j.stash.length}`, name: x.name, value: x.value, day: this.day, caseId: caseObj.id });
   g.life?.note(`crime:${seq}`, `${C.label}: got away with ${naira(value)}`, { integrity: C.integrity, notoriety: C.notoriety });
   g.skills.add('hustle', 20);
  } else g.life?.note(`crime:${seq}`, `${C.label}: it went wrong`, { integrity: C.integrity, notoriety: Math.ceil(C.notoriety / 2), public: -2 });
  if (npc && !r.ok) { const rel = g.npcs.rel?.(npc.identity); if (rel) rel.negative = (rel.negative ?? 0) + 4; }
  this.log(`${C.label}${place ? ` at ${place}` : ''}: ${r.ok ? `got ${naira(value)}` : r.caught ? 'seen, and chased' : 'went wrong'}`);
  g.saveGame();
  if (r.caught) { g.ui.toast(`You were seen! ${kind === 'heist' ? 'The alarm is ringing.' : 'Someone is shouting for the police.'}`, 4000); g.story.startChase('police', C.offence, 0); return r; }
  const seen = r.witnesses ? `${r.witnesses} people saw something.` : 'Nobody seemed to notice.';
  g.openChoice(() => ({ title: r.ok ? 'You got away with it' : 'It went wrong', kicker: C.label.toUpperCase(), text: r.ok ? `${r.loot ? `${naira(r.loot)} in cash.` : `In your bag: ${r.goods.map((x) => `${x.name} (worth about ${naira(x.value)})`).join(', ')}. Only a back-street dealer will buy them.`} ${seen}` : `You backed off before you were caught. ${seen}`, note: 'The victim reports it. The police open a case and keep asking questions; the more people saw, the likelier they find you.', options: [{ label: 'Close', primary: true, act: () => g.closeChoice() }] }));
  return r;
 }
 breakinView(gate) {
  const g = this.g; if (!gate) return { title: 'Compound', text: 'Move closer to a gate.', options: [{ label: 'Close', ghost: true, act: () => g.closeChoice() }] };
  return { title: 'A walled compound', kicker: 'BREAK-IN', text: this.night() ? 'The lights are off. The family is asleep.' : 'It is daytime: people come and go.', options: [
   { label: 'Break in', sub: 'With your tools. It takes about 25 minutes', act: () => { g.closeChoice(); this.confirm('breakin', gate, {}, (ctx) => this.resolve('breakin', ctx, { place: 'a compound' })); } },
   { label: 'Walk away', ghost: true, act: () => g.closeChoice() }] };
 }
 /** Extra options in a bank's banking hall: casing it by day, the heist at night. */
 bankOptions(br) {
  const g = this.g, j = this.j; if (!this.ready || !this.adult() || this.officer()) return [];
  const out = [], planning = j.kit || j.plan.crew > 0 || (j.kingdom?.role === 'boss' && j.kingdom.members.length > 0);
  if (!planning) return out;
  if (!this.night()) out.push({ label: 'Case the place', sub: j.plan.scouted[br.id] >= this.day - 7 ? `You watched it on day ${j.plan.scouted[br.id]}` : 'Watch the guards, the cameras and the vault (30 minutes)', act: () => { j.plan.scouted[br.id] = this.day; g.skipTime(30); this.log(`Watched ${br.name} closely`); g.saveGame(); g.ui.toast('You know the layout now. It has to be at night.'); g.renderChoice(); } });
  else {
   const plan = this.heistPlan(br), ready = heistReady(plan);
   out.push({ label: 'Rob the bank (planned heist)', sub: ready.ok ? `Crew of ${plan.crew}${plan.getaway ? ' · getaway vehicle' : ''} · cameras everywhere` : ready.missing.join(' · '), disabled: !ready.ok, why: ready.missing.join(' · '), act: () => { g.closeChoice(); this.confirm('heist', br, { crew: plan.crew, scouted: true, getaway: plan.getaway }, (ctx) => this.heist(br, ctx, plan)); } });
  }
  return out;
 }
 heistPlan(br) { const j = this.j, kingdomCrew = j.kingdom?.role === 'boss' ? j.kingdom.members.length : 0; return { kit: j.kit, crew: j.plan.crew + kingdomCrew, hired: j.plan.crew, kingdomCrew, scouted: (j.plan.scouted[br.id] ?? -99) >= this.day - 7, night: this.night(), getaway: (this.g.saveData.vehicles ?? []).some((v) => !v.garaged) }; }
 heist(br, ctx, plan) {
  const r = this.resolve('heist', ctx, { place: br.name, cctv: true, crew: plan.crew, scouted: true, getaway: plan.getaway, bank: br });
  const j = this.j; j.plan.crew = 0; delete j.plan.scouted[br.id];
  if (r?.ok && plan.kingdomCrew) { const cut = Math.round(r.loot * 0.1 * plan.kingdomCrew / 50) * 50; this.g.economy.transact({ key: `heist-cut:${j.seq}`, amount: -Math.min(cut, this.g.economy.balance), reason: 'Your crew\'s share' }); }
  this.g.saveGame();
 }
 dealerView() {
  const g = this.g, j = this.j, hustle = g.skills.level('hustle');
  if (!this.adult()) return { title: 'Back-street dealer', text: '"Go home, small pikin."', options: [{ label: 'Leave', ghost: true, act: () => g.closeChoice() }] };
  if (this.officer()) return { title: 'Okwy', text: 'He sees your uniform and finds somewhere else to be.', options: [{ label: 'Leave', ghost: true, act: () => g.closeChoice() }] };
  const opts = j.stash.map((x) => ({ label: `Sell the ${x.name} · ${naira(fencePrice(x.value, hustle))}`, sub: `Worth about ${naira(x.value)} new. He pays cash, no questions.`, act: () => this.fence([x.id]) }));
  if (j.stash.length > 1) opts.unshift({ label: `Sell everything · ${naira(j.stash.reduce((s, x) => s + fencePrice(x.value, hustle), 0))}`, primary: true, act: () => this.fence(j.stash.map((x) => x.id)) });
  opts.push({ label: j.kit ? 'You have tools' : `Buy tools · ${naira(FENCE.kitPrice)}`, sub: 'For breaking into compounds, and needed for any big job', disabled: j.kit || !g.economy.canAfford(FENCE.kitPrice), why: j.kit ? 'Already yours' : 'Not enough cash', act: () => { if (g.economy.transact({ key: `kit:${++j.seq}`, amount: -FENCE.kitPrice, reason: 'Tools from a dealer' }).ok) { j.kit = true; this.log('Bought tools from the dealer'); g.saveGame(); g.renderChoice(); } } });
  opts.push({ label: `Hire someone for a job · ${naira(FENCE.crewPrice)}`, sub: `For a bank job you need ${FENCE.heistCrew}. Hired: ${j.plan.crew}. Paid now, for one job`, disabled: j.plan.crew >= 4 || !g.economy.canAfford(FENCE.crewPrice), why: j.plan.crew >= 4 ? 'Enough people' : 'Not enough cash', act: () => { if (g.economy.transact({ key: `crew:${++j.seq}`, amount: -FENCE.crewPrice, reason: 'Paid a crew member' }).ok) { j.plan.crew++; g.saveGame(); g.renderChoice(); } } });
  opts.push({ label: 'Ask about a bigger job', sub: 'He lowers his voice', act: () => g.openChoice(() => ({ title: 'A bigger job', text: '"The banks keep cash overnight. You want that kind of money? Tools, a crew of two at least, watch the place in the day, go in at night. A motor waiting outside helps. And the cameras see everything, so plenty of people end up in court."', options: [{ label: 'Back', act: () => g.openChoice(() => this.dealerView()) }] })) });
  opts.push({ label: 'Leave', ghost: true, act: () => g.closeChoice() });
  return { title: 'Okwy, back-street dealer', kicker: 'NO RECEIPTS', text: j.stash.length ? 'He looks over what you have.' : '"What you get for me?"', note: 'Selling stolen goods can lead the police back to you.', options: opts };
 }
 fence(ids) {
  const g = this.g, j = this.j, hustle = g.skills.level('hustle'); let total = 0;
  for (const id of ids) { const i = j.stash.findIndex((x) => x.id === id); if (i < 0) continue; const x = j.stash[i]; const pay = fencePrice(x.value, hustle);
   if (g.economy.transact({ key: `fence:${x.id}`, amount: pay, reason: `Sold a ${x.name} to a dealer` }).ok) { total += pay; j.stash.splice(i, 1); if (x.caseId && this.rng() < 0.15) this.cases.add(x.caseId, 0.25); } }
  this.log(`Sold stolen goods for ${naira(total)}`); g.saveGame(); g.ui.toast(`The dealer paid ${naira(total)}.`); g.openChoice(() => this.dealerView());
 }

 // ── investigations, arrest, custody, court ────────────────────────────────────────────────────
 rng = () => Math.random();
 wanted(agency = null) { return this.ready && this.cases.warrants(agency).length > 0; }
 reasonFor(agency) { const w = this.cases.warrants(agency); return w.length ? w.map((c) => c.offence).slice(0, 2).join('; ') + (w.length > 2 ? ` and ${w.length - 2} more` : '') : 'Outstanding warrant'; }
 newDay(day) {
  const j = this.j, extra = {};
  if (j.kingdom?.caseId) { const add = kingdomDay(j.kingdom); if (add) extra[j.kingdom.caseId] = add; }
  for (const ev of this.cases.newDay(day, extra)) if (ev.type === 'warrant') { this.log(`A warrant is out: ${ev.c.offence}`); this.g.ui?.toast(`${ev.c.agency === 'efcc' ? 'The EFCC' : 'The police'} have identified you. A warrant is out for your arrest.`, 6000); }
  if (j.court && day > j.court.day) { // missed the hearing
   const ids = j.court.caseIds; for (const c of this.cases.j.cases) if (ids.includes(c.id) && c.status === 'charged') c.status = 'warrant';
   this.cases.open({ agency: j.court.agency ?? 'police', offence: 'Failed to appear in court', severity: 1, evidence: 1.2, day, ref: `fta:${j.court.day}` });
   this.g.life?.record.add({ kind: 'case', day, text: `Missed a court hearing: bail of ${naira(j.court.bond)} forfeited, warrant issued`, status: 'open', ref: `fta:${j.court.day}` });
   this.log('You missed your court date: a warrant is out'); j.court = null;
  }
  this.incidents = null;
 }
 /** Called every frame from the story update while playing: police or EFCC catch up with you. */
 watch(dt) {
  if (!this.ready || !this.free() || this.g.state !== 'playing') return false;
  this.clock += dt; if (this.clock < this.checkAt) return false;
  const g = this.g, p = g.player.position;
  if (this.wanted('efcc') && this.clock >= this.raidAt) { this.checkAt = this.clock + 60; this.raidAt = this.clock + 240; this.encounter('efcc', 'EFCC officers are waiting for you'); return true; }
  if (this.wanted('police')) {
   const post = g.police.posts.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 14), cop = g.npcs.active.some((n) => n.role === 'police' && Math.hypot(n.x - p.x, n.z - p.z) < 9);
   if (post || cop) { this.checkAt = this.clock + 60; this.encounter('police', post ? 'An officer at the checkpoint recognises you' : 'A police officer recognises you'); return true; }
  }
  this.checkAt = this.clock + 2; return false;
 }
 encounter(agency, text) {
  const g = this.g, reason = this.reasonFor(agency), fit = g.skills.level('fitness');
  if (g.vehicles.driving) g.vehicles.stopDriving({ silent: true });
  g.openChoice(() => ({ title: agency === 'efcc' ? 'EFCC' : 'Police', kicker: 'YOU ARE UNDER ARREST', text: `${text}. "You are wanted for: ${reason}."`, note: 'Going quietly counts in your favour in court. Running or resisting adds charges if you are caught.', options: [
   { label: 'Go quietly', primary: true, act: () => { g.closeChoice(); g.story.arrest(agency, reason); } },
   { label: 'Run', sub: 'A chase through the market', act: () => { g.closeChoice(); g.story.startChase(agency, reason, 0); } },
   { label: 'Resist arrest', sub: `Push past them (fitness ${fit})`, act: () => { g.closeChoice(); const ok = this.rng() < 0.2 + fit * 0.05; this.cases.open({ agency, offence: 'Resisting arrest', severity: 1, evidence: 1.2, day: this.day, ref: `resist:${++this.j.seq}` }); g.life?.note(`resist:${this.j.seq}`, 'Resisted arrest', { notoriety: 4, public: -3, integrity: -2 }); if (ok) { g.ui.toast('You shoved past and got away. They will be looking harder now.', 5000); this.checkAt = this.clock + 120; } else { g.ui.toast('They overpowered you.', 4000); g.story.arrest(agency, `${reason}; resisting arrest`); } g.saveGame(); } }] }));
 }
 /** Turning yourself in at the station or field office. */
 surrender(agency) { const g = this.g; g.closeChoice(); g.story.exitOffice?.(); g.story.arrest(agency, this.reasonFor(agency)); this.log('Turned yourself in'); }
 /** StoryController.arrest calls this: warrants become charges, and custody is about them. */
 onArrest(agency, a) {
  if (!this.ready || !a) return;
  const charges = this.cases.charge(this.day, agency).map((c) => c.id); if (!charges.length) return;
  a.justice = { caseIds: charges, sentence: null, served: 0, finePaid: false, agency };
  if (this.j.kingdom && agency === 'efcc') { this.log(`EFCC raid: ${this.j.kingdom.name} is shut down`); this.j.kingdom = null; }
  this.j.court = null; this.g.saveGameNow();
 }
 escaped(p) { if (!this.ready || p.kind === 'thugs') return; const w = this.cases.warrants(p.agency); if (!w.length) this.cases.open({ agency: p.agency, offence: `Escaped arrest (${p.reason})`, severity: 1, evidence: 1.1, day: this.day, ref: `escape:${p.id}` }); else for (const c of w) c.evidence = Math.min(3, c.evidence + 0.2); }
 caseList(ids) { return ids.map((id) => this.cases.byId(id)).filter(Boolean); }
 /** The custody desk when you're held on charges. */
 custodyView() {
  const g = this.g, st = g.story.s, a = st.arrest?.justice; if (!a) return null;
  const cs = this.caseList(a.caseIds), list = cs.map((c) => c.offence).join('; ');
  if (!a.sentence) {
   const bond = this.cases.bail(a.caseIds), bribe = cs.reduce((s, c) => s + c.severity * 15000, 0);
   return { title: a.agency === 'efcc' ? 'EFCC custody' : 'Police custody', kicker: 'CHARGED', text: `You are charged with: ${list}.`, note: 'Pleading guilty means a lighter sentence. A trial can clear you if the evidence is weak; a lawyer helps.', options: [
    { label: 'Plead guilty', sub: (() => { const s = this.cases.sentence(a.caseIds, { guilty: true }); return `About: ${s.fine ? naira(s.fine) + ' fine · ' : ''}${s.service} day${s.service === 1 ? '' : 's'} of community service${s.forfeit ? ` · hand back ${naira(s.forfeit)}` : ''}`; })(), primary: true, act: () => this.convict(a, true) },
    { label: 'Plead not guilty: go before the magistrate today', sub: 'A trial now. Hire a lawyer or defend yourself', act: () => g.openChoice(() => this.trialView(a.caseIds, { custody: true })) },
    { label: `Plead not guilty and ask for bail · ${naira(bond)}`, sub: 'Go home today; your hearing is tomorrow at the Magistrate Court. Miss it and a warrant goes out', disabled: !g.economy.canAfford(bond), why: 'Not enough cash for the bond', act: () => this.bail(a, bond) },
    { label: `Offer the officer ${naira(bribe)} to make it go away`, sub: 'Corruption. It may work; if not, it is another charge', disabled: !g.economy.canAfford(bribe), why: 'Not enough cash', act: () => this.tryBribe(a, bribe) }] };
  }
  const s = a.sentence, fineDue = s.fine > 0 && !a.finePaid;
  return { title: 'Serving your sentence', kicker: 'CONVICTED', text: `${list}. Sentence: ${s.fine ? `${naira(s.fine)} fine, ` : ''}${s.service} day${s.service === 1 ? '' : 's'} of community service.`, note: 'Each day of service takes about an hour and a half of supervised work.', options: [
   ...(fineDue ? [{ label: `Pay the fine · ${naira(s.fine)}`, primary: true, disabled: !g.economy.canAfford(s.fine), why: 'Not enough cash', act: () => { if (g.economy.transact({ key: `fine:${a.caseIds[0]}`, amount: -s.fine, reason: 'Court fine' }).ok) { a.finePaid = true; g.saveGame(); g.renderChoice(); } } },
    { label: "I can't pay: do extra service instead", sub: `+${Math.ceil(s.fine / 15000)} days of service`, act: () => { s.service += Math.ceil(s.fine / 15000); a.finePaid = true; s.fine = 0; g.saveGame(); g.renderChoice(); } }] : []),
   { label: `Community service · ${a.served}/${s.service}`, sub: 'Clean the yard, sort records, carry supplies', disabled: a.served >= s.service || g.needs.energy < 10, why: a.served >= s.service ? 'Done' : 'Too tired: rest first', act: () => { a.served++; g.skipTime(90); g.needs.adjust({ energy: -10, hunger: -8, fun: -6 }); g.saveGame(); g.renderChoice(); } },
   { label: 'Ask to be released', disabled: fineDue || a.served < s.service, why: 'Finish the sentence first', primary: !fineDue && a.served >= s.service, act: () => this.release('Sentence served') }] };
 }
 convict(a, guilty, { s = null } = {}) {
  const g = this.g, cs = this.caseList(a.caseIds); s ??= this.cases.sentence(a.caseIds, { guilty });
  // hand back what was taken: cash first, then the bank account; stolen goods are confiscated
  let back = Math.min(s.forfeit, g.economy.balance); if (back) g.economy.transact({ key: `forfeit:${a.caseIds[0]}`, amount: -back, reason: 'Court order: proceeds of crime returned' });
  const rest = s.forfeit - back, acct = g.business?.bank?.account; if (rest > 0 && acct && acct.balance > 0) { const t = Math.min(rest, acct.balance); acct.transact({ key: `forfeit-bank:${a.caseIds[0]}`, amount: -t, reason: 'Court order: proceeds of crime' }); back += t; }
  this.j.stash = this.j.stash.filter((x) => !a.caseIds.includes(x.caseId));
  this.cases.close(a.caseIds, guilty ? 'convicted (guilty plea)' : 'convicted', this.day); this.j.convictions++;
  a.sentence = s; a.served = 0; a.finePaid = s.fine === 0;
  g.life?.record.add({ kind: 'conviction', day: this.day, agency: 'Magistrate Court', text: `Convicted: ${cs.map((c) => c.offence).join('; ')} · ${s.fine ? naira(s.fine) + ' fine, ' : ''}${s.service} days' service${back ? `, ${naira(back)} handed back` : ''}`, ref: `conv:${a.caseIds.join(',')}` });
  g.life?.note(`conv:${a.caseIds.join(',')}`, `Convicted at the Magistrate Court${guilty ? ' (pleaded guilty)' : ''}`, { public: -5, notoriety: 3, integrity: guilty ? 2 : 0 });
  const off = this.officer(); if (off) { const r = g.life.work.dismiss(this.day); g.life.record.add({ kind: 'dismissal', day: this.day, agency: OCCUPATION[off].label, text: 'Dismissed from the force after a conviction', ref: `force-dismiss:${this.day}` }); if (r) this.log('Dismissed from the force'); this.j.duty = null; this.clearRigs(); }
  this.log(`Convicted: ${cs.map((c) => c.offence).join('; ')}`); g.saveGameNow(); g.openChoice(() => this.custodyView());
 }
 acquit(ids) { const g = this.g; this.cases.close(ids, 'acquitted', this.day); if (!this.cases.active().length) g.life?.record.close((e) => e.kind === 'case', this.day, 'Acquitted'); g.life?.record.add({ kind: 'cleared', day: this.day, agency: 'Magistrate Court', text: `Acquitted: ${this.caseList(ids).map((c) => c.offence).join('; ')}`, ref: `acq:${ids.join(',')}` }); g.life?.note(`acq:${ids.join(',')}`, 'Acquitted at the Magistrate Court', { public: 1 }); this.log('Acquitted'); }
 trialView(ids, { custody = false } = {}) {
  const g = this.g, opts = Object.entries(LAWYERS).map(([id, L]) => ({ label: L.label, sub: id === 'private' ? `${naira(L.cost)} · the best chance` : id === 'aid' ? 'Free · overworked, but it helps' : 'Free · the magistrate goes by the evidence', disabled: !g.economy.canAfford(L.cost), why: 'Not enough cash', act: () => this.verdict(ids, id, { custody }) }));
  return { title: 'Magistrate Court', kicker: 'TRIAL', text: `The prosecution presents its evidence on: ${this.caseList(ids).map((c) => c.offence).join('; ')}.`, note: 'The weaker their evidence, the better your chances. Convicted after a trial, the sentence is heavier than for a guilty plea.', options: opts };
 }
 verdict(ids, lawyer, { custody = false } = {}) {
  const g = this.g, L = LAWYERS[lawyer]; if (L.cost && !g.economy.transact({ key: `lawyer:${ids[0]}:${++this.j.seq}`, amount: -L.cost, reason: 'Lawyer\'s fee' }).ok) return;
  g.skipTime(120); const t = this.cases.trial(ids, lawyer), st = g.story.s;
  if (!t.convicted) {
   this.acquit(ids);
   if (custody) { g.openChoice(() => ({ title: 'Not guilty', kicker: 'ACQUITTED', text: 'The magistrate found the evidence did not hold. You are free to go.', options: [{ label: 'Walk out', primary: true, act: () => this.release('Acquitted') }] })); return; }
   this.refundBail(); g.openChoice(() => ({ title: 'Not guilty', kicker: 'ACQUITTED', text: 'The magistrate found the evidence did not hold. Your bail bond is returned.', options: [{ label: 'Leave the court', primary: true, act: () => g.closeChoice() }] })); g.saveGame(); return;
  }
  if (!custody) { // convicted at a bail hearing: taken down to serve the sentence
   const agency = this.j.court?.agency ?? 'police'; this.refundBail(); g.closeChoice(); g.story.arrest(agency, 'Sentenced at the Magistrate Court'); const a = st.arrest; a.justice = { caseIds: ids, sentence: null, served: 0, finePaid: false, agency }; this.convict(a.justice, false); return;
  }
  this.convict(st.arrest.justice, false);
 }
 bail(a, bond) {
  const g = this.g; if (!g.economy.transact({ key: `bail:${a.caseIds[0]}`, amount: -bond, reason: 'Bail bond (returned when you attend court)' }).ok) return;
  this.j.court = { day: this.day + 1, caseIds: a.caseIds, bond, agency: a.agency };
  g.life?.record.add({ kind: 'bail', day: this.day, agency: a.agency, text: `Released on bail of ${naira(bond)}; hearing on day ${this.day + 1}`, ref: `bail:${a.caseIds[0]}` });
  this.log(`On bail: your hearing is on day ${this.day + 1}`); this.release(null);
  g.ui.toast(`Your hearing is tomorrow (day ${this.day + 1}) at the Magistrate Court. It's on your map.`, 6000);
 }
 refundBail() { const c = this.j.court; if (!c) return; this.g.economy.transact({ key: `bail-back:${c.caseIds[0]}`, amount: c.bond, reason: 'Bail bond returned' }); this.j.court = null; }
 tryBribe(a, amount) {
  const g = this.g, r = this.cases.bribe(a.caseIds, this.day);
  g.life?.note(`bribe:${this.j.seq}`, 'Offered a bribe to an officer', { integrity: -10 });
  if (r.ok) { g.economy.transact({ key: `bribe-paid:${a.caseIds[0]}`, amount: -amount, reason: 'Paid a bribe' }); this.log('Paid a bribe and the case went away'); this.release(null); g.ui.toast('The officer pocketed it. "Your file is lost." You walk out.', 5000); return; }
  a.caseIds = this.cases.charged().map((c) => c.id); this.log('The officer refused your bribe: another charge'); g.saveGame(); g.ui.toast('"You want to bribe me?" Another charge: attempted bribery.', 5000); g.openChoice(() => this.custodyView());
 }
 release(text) {
  const g = this.g, st = g.story.s, a = st.arrest; if (!a) return;
  st.arrest = null; st.wanted = false; st.heat = 0;
  g.life?.record.close((e) => e.kind === 'case', this.day, 'Dealt with');
  if (text) g.life?.record.add({ kind: 'service', day: this.day, agency: a.agency, text, ref: `rel:${this.day}:${++this.j.seq}` });
  g.story.exitOffice(); g.saveGameNow();
 }
 courtView() {
  const g = this.g, c = this.j.court;
  if (!c) return { title: 'Magistrate Court', kicker: 'REGISTRY', text: 'The court sits every day. Cases come here after an arrest. Pleading guilty earns a lighter sentence; a lawyer helps at a trial.', options: [{ label: 'Leave', ghost: true, act: () => g.closeChoice() }] };
  if (this.day < c.day) return { title: 'Magistrate Court', text: `Your hearing is on day ${c.day}. Come back then. Miss it and a warrant goes out.`, options: [{ label: 'Leave', ghost: true, act: () => g.closeChoice() }] };
  return { title: 'Magistrate Court', kicker: 'YOUR HEARING', text: `You are on bail, charged with: ${this.caseList(c.caseIds).map((x) => x.offence).join('; ')}.`, options: [
   { label: 'Change your plea to guilty', sub: 'A lighter sentence, served in custody', act: () => { const ids = c.caseIds, agency = c.agency ?? 'police'; this.refundBail(); g.closeChoice(); g.story.arrest(agency, 'Sentenced at the Magistrate Court'); const a = g.story.s.arrest; a.justice = { caseIds: ids, sentence: null, served: 0, finePaid: false, agency }; this.convict(a.justice, true); } },
   { label: 'Go to trial', primary: true, act: () => g.openChoice(() => this.trialView(c.caseIds)) }] };
 }

 // ── police and EFCC ───────────────────────────────────────────────────────────────────────────
 /** Extra options at the visitor desk of the station / field office (not in custody). */
 officeOptions(office) {
  const g = this.g, force = office.id, F = FORCES[force]; if (!this.ready || !F) return [];
  const out = [], j = this.j, mine = this.officer();
  if (this.wanted(force)) out.push({ label: 'Turn yourself in', sub: `For: ${this.reasonFor(force)}. It counts in your favour`, act: () => this.surrender(force) });
  if (!this.adult()) return out;
  if (mine === force) out.push(...g.life.siteOptions({ careers: [force] }));
  else if (!mine) {
   const n = j.academy[force], today = j.academyDay === this.day;
   if (n < ACADEMY.sessions) out.push({ label: `${force === 'efcc' ? 'EFCC' : 'Police'} academy · session ${n + 1} of ${ACADEMY.sessions}`, sub: today ? 'One session a day: come back tomorrow' : `3 hours of training · ${F.skill === 'fitness' ? 'drills and law' : 'finance and law'}. Then you can apply`, disabled: today || g.needs.energy < ACADEMY.energy || !!j.kingdom, why: j.kingdom ? 'Not while you run with a Hustle Kingdom' : today ? 'One session a day' : 'Too tired', act: () => { j.academy[force]++; j.academyDay = this.day; g.skipTime(ACADEMY.minutes); g.needs.adjust({ energy: -20, hunger: -12 }); g.skills.add(F.skill, 60); this.log(`Academy session ${j.academy[force]} done (${F.label})`); g.saveGame(); g.ui.toast(j.academy[force] >= ACADEMY.sessions ? 'Academy finished. You can apply now.' : `Session ${j.academy[force]} of ${ACADEMY.sessions} done.`); g.renderChoice(); } });
   out.push(...g.life.siteOptions({ careers: [force] }));
  }
  return out;
 }
 spots() {
  const g = this.g, o = g.story.offices[0];
  return (this.spotList ??= g.world.landmarks.list.filter((l) => Number.isFinite(l.x) && (l.name || l.label) && Math.hypot(l.x - o.x, l.z - o.z) < 1600).map((l) => ({ x: l.x, z: l.z, name: l.name ?? l.label })));
 }
 startDuty() {
  const g = this.g, j = this.j, force = this.officer(); if (!force) return;
  if (j.duty) { g.closeChoice(); this.markStep(); return; }
  const now = g.life.shiftCheck(); if (!now.ok) { g.ui.toast(now.error); return; }
  const office = g.story.offices.find((o) => o.id === FORCES[force].office), spots = this.spots();
  this.incidents ??= incidentsFor(this.day, spots);
  const incident = this.incidents.shift() ?? null;
  j.duty = { ...dutyFor(force, { seq: ++j.seq, day: this.day, spots, incident, office: { x: office.x, z: office.z, name: office.name }, kingdom: NPC_KINGDOMS[j.seq % NPC_KINGDOMS.length] }), corrupt: 0, quality: 0.5, arrests: 0 };
  this.log(`On duty: ${j.duty.title}`); g.saveGame(); g.story.exitOffice?.(); g.closeChoice(); this.placeRigs(); this.markStep();
 }
 markStep() { const d = this.j.duty, s = d?.steps[d.step]; if (!s) return; this.g.setWaypoint({ x: s.at.x, z: s.at.z, name: s.text, radius: 5, custom: true }); this.g.ui.toast(`Duty: ${s.text}`, 5000); }
 stepView() {
  const g = this.g, d = this.j.duty, s = d?.steps[d.step]; if (!s) return null;
  return { title: d.title, kicker: `DUTY · STEP ${d.step + 1} OF ${d.steps.length}`, text: s.text, options: [...stepChoices(d, d.step).map((c) => ({ label: c.label, sub: c.sub, disabled: c.cost > 0 && !g.economy.canAfford(c.cost), why: 'Not enough cash', primary: c.id === 'book', act: () => this.doStep(c) })), { label: 'Not yet', ghost: true, act: () => g.closeChoice() }] };
 }
 doStep(c) {
  const g = this.g, d = this.j.duty, s = d.steps[d.step], key = `${d.id}:${d.step}`;
  g.closeChoice(); g.skipTime(c.minutes ?? 15);
  if (c.cost) g.economy.transact({ key: `informant:${key}`, amount: -c.cost, reason: 'Paid an informant' });
  if (c.skill) d.quality += (g.skills.level(c.skill) - 2) * 0.03;
  let msg = '';
  if (c.corrupt) { d.corrupt++; g.economy.transact({ key: `bribe-taken:${key}`, amount: c.bribe, reason: 'Bribe taken on duty' }); g.life?.note(`bribe-taken:${key}`, 'Took a bribe on duty', { integrity: c.integrity, notoriety: 1 }); msg = `${naira(c.bribe)} in your pocket.`; }
  else if (c.integrity) g.life?.note(`duty:${key}`, `${s.do === 'file' ? 'Filed an honest report' : 'Did the duty by the book'}`, { integrity: c.integrity, public: 0.3 });
  if (c.arrest) { const r = arrestOutcome(g.skills.level('fitness'), this.rng); if (r.caught) { d.arrests++; d.quality += 0.15; msg = r.runs ? 'They ran, and you caught them. Arrested.' : 'They came quietly. Arrested.'; } else { d.quality -= 0.1; msg = 'They ran and got away. It goes in the report.'; } g.skills.add('fitness', 15); }
  d.quality = Math.max(0, Math.min(1, d.quality + (c.quality ?? 0)));
  this.clearRigs(); d.step++;
  if (d.step >= d.steps.length) return this.finishDuty();
  this.placeRigs(); g.saveGame(); if (msg) g.ui.toast(msg, 4000); setTimeout(() => this.markStep(), msg ? 1800 : 0);
 }
 finishDuty() {
  const g = this.g, d = this.j.duty; this.j.duty = null; g.setWaypoint?.(null);
  const upheld = complaint(d.corrupt, this.rng);
  if (upheld) { this.j.complaints++; this.log('A complaint against you was upheld'); }
  const bonus = Math.round(OCCUPATION[d.force].shiftPay * (d.quality - 0.5) / 50) * 50;
  g.life.finishShift(upheld ? 'shortcut' : d.corrupt ? null : 'honest', { skip: false, bonus, title: 'Duty done' });
  this.log(`Duty done: ${d.title}${d.arrests ? ` · ${d.arrests} arrest${d.arrests > 1 ? 's' : ''}` : ''}`);
 }
 placeRigs() {
  const d = this.j?.duty, s = d?.steps[d.step]; if (!s || !['suspect', 'raid'].includes(s.do)) return;
  const n = s.do === 'raid' ? 3 : 1;
  for (let i = 0; i < n; i++) { const r = buildHuman({ ...defaultAppearance(), outfit: 'shirt_trousers', color: (d.step + i) % 4, gender: i % 2 ? 'female' : 'male' }); const [x, z] = this.g.world.findFreeSpot(s.at.x + i * 1.4 - 1.4, s.at.z + 1.5, 0.4); r.group.position.set(x, 0, z); this.group.add(r.group); this.rigs.push(r); }
 }
 clearRigs() { for (const r of this.rigs) { this.group?.remove(r.group); r.dispose?.(); } this.rigs = []; }

 // ── Hustle Kingdoms ───────────────────────────────────────────────────────────────────────────
 kingdomCase(add, amount) { const k = this.j.kingdom; if (!k) return; if (!k.caseId || !this.cases.byId(k.caseId) || this.cases.byId(k.caseId).status === 'closed') k.caseId = this.cases.open({ agency: 'efcc', offence: k.role === 'boss' ? KINGDOM_CASE : `Taking part in schemes with ${k.boss}`, severity: k.role === 'boss' ? 3 : 2, evidence: 0, day: this.day, ref: `kingdom:${k.day}:${this.j.seq}` }).id; this.cases.add(k.caseId, add, amount); }
 found(name) { const g = this.g; if (!this.adult() || this.officer() || this.j.kingdom) return false; if (!g.economy.transact({ key: `kingdom:${++this.j.seq}`, amount: -20000, reason: 'Set up a house for your crew' }).ok) return false; this.j.kingdom = newKingdom(name, this.day); this.log(`Started ${name}`); g.life?.note(`kingdom:${this.j.seq}`, `Started a Hustle Kingdom: ${name}`, { integrity: -6, notoriety: 4 }); g.saveGame(); return true; }
 join(boss) { if (!this.adult() || this.officer() || this.j.kingdom) return false; this.j.kingdom = newKingdom(boss, this.day, { role: 'member', boss }); this.log(`Joined ${boss}`); this.g.life?.note(`kingdom-join:${++this.j.seq}`, `Joined a Hustle Kingdom (${boss})`, { integrity: -4, notoriety: 2 }); this.g.saveGame(); return true; }
 candidates() { const k = this.j.kingdom; return [0, 1, 2].map((i) => recruit(`${this.day}:${i}:${k.name}`)).filter((c) => !k.members.some((m) => m.id === c.id)); }
 hire(c) { const g = this.g, k = this.j.kingdom; if (!k || k.members.length >= KINGDOM.maxMembers) return; if (!g.economy.transact({ key: `recruit:${c.id}`, amount: -10000, reason: `Brought ${c.name} into the house` }).ok) return; k.members.push({ ...c, day: this.day }); g.saveGame(); }
 scheme(size) {
  const g = this.g, k = this.j.kingdom; if (!k) return null;
  const r = runScheme(k, size, { day: this.day, hustle: g.skills.level('hustle'), rng: this.rng }); if (!r.ok && r.error) { g.ui.toast(r.error); return r; }
  g.skipTime(r.minutes); g.needs.adjust({ energy: -12, fun: -4 }); g.skills.add('hustle', 30);
  if (r.mine > 0) g.economy.transact({ key: `scheme:${k.name}:${k.schemes}:${this.day}`, amount: r.mine, reason: 'Hustle proceeds' });
  k.pot += r.gross; this.kingdomCase(SCHEMES[size].heat / 100, r.mine);
  g.life?.note(`scheme:${k.schemes}:${this.day}`, `${SCHEMES[size].label}: ${r.ok ? naira(r.mine) : 'came to nothing'}`, { integrity: -4, notoriety: r.ok ? 2 : 1 });
  this.log(`${SCHEMES[size].label}: ${r.ok ? naira(r.mine) + ' for you' : 'came to nothing'}`); g.saveGame(); return r;
 }
 leaveKingdom() { const k = this.j.kingdom; if (!k) return; this.log(k.role === 'boss' ? `Closed down ${k.name}` : `Left ${k.boss}`); this.j.kingdom = null; this.g.saveGame(); }
 /** For the phone: what you know about your situation (never the investigators' numbers). */
 status() {
  const j = this.j, cs = this.cases;
  return {
   wanted: cs.warrants().map((c) => ({ agency: c.agency, offence: c.offence })),
   watched: cs.active().filter((c) => c.status === 'open' && c.evidence >= 0.3).map((c) => ({ agency: c.agency, offence: c.offence, day: c.day })),
   court: j.court, stash: j.stash, kingdom: j.kingdom, duty: j.duty, academy: j.academy, convictions: j.convictions, complaints: j.complaints, log: [...j.log].reverse().slice(0, 12),
  };
 }
 get schemes() { return SCHEMES; }
 get kingdomMax() { return KINGDOM.maxMembers; }
 canRun(k, size, ctx) { return canRun(k, size, ctx); }
 npcKingdoms() { return NPC_KINGDOMS; }
 suspectView() { const g = this.g, k = this.j.kingdom; const list = suspect(k, g.skills.level('charisma'), this.rng); return list; }
 payMembers(amount) { const g = this.g, k = this.j.kingdom; if (!k?.members.length) return; if (!g.economy.transact({ key: `kingdom-pay:${++this.j.seq}`, amount: -amount, reason: 'Paid your crew extra' }).ok) return; payMore(k, amount); g.saveGame(); }
 letGo(id) { const k = this.j.kingdom; if (!k) return; k.members = k.members.filter((m) => m.id !== id); this.g.saveGame(); }
}
export { SCHEMES, KINGDOM, NPC_KINGDOMS, canRun };
