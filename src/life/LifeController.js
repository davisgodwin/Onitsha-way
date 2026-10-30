import { Occupations, ensureWork, rankName } from './Occupations.js';
import { Standing, ensureStanding, DIMENSIONS, labelFor, wealthOf } from './Standing.js';
import { LegalRecord, ensureRecord, RECORD_KINDS } from './LegalRecord.js';
import { OCCUPATION, SHIFT } from '../data/occupations.js';
import { CATALOGUE_BY_ID } from '../data/VehicleCatalogue.js';
import { GOOD_BY_ID } from '../buy/Goods.js';
import { SKILLS } from './Skills.js';
import { naira } from '../economy/Economy.js';
import { weekdayOf } from '../sim/Calendar.js';
/**
 * v0.40 open life: what you do for a living, how the city judges you, and your official record.
 * Nothing here is forced: you start with no job and choose work in the city (workplaces, trader jobs, a keke, trading),
 * change it whenever you like, and the city keeps score of what you actually do.
 */
export class LifeController {
 constructor(g) {
  this.g = g;
  const on = (type, fn) => g.bus.on(type, (p) => { if (this.ready) try { fn(p); } catch (e) { console.error('[life]', type, e); } });
  on('job:completed', ({ job, paid }) => this.selfWork('errands', `job:${job.id}`, `Finished a trader job: ${job.title ?? 'errand'}${paid ? ' · ' + naira(paid) : ''}`, { prof: 2, business: 0.6, public: 0.4 }));
  on('job:expired', ({ job }) => this.note(`job-late:${job.id}`, `Let a trader down: ${job.title ?? 'a job'} ran out of time`, { prof: { errands: -3 }, business: -1.5, public: -0.5 }));
  on('keke-biz:paid', ({ rider, paid }) => paid > 0 && this.selfWork(rider.mode && rider.mode !== 'keke' ? 'busdriver' : 'keke', `keke:${rider.id}`, `Keke fare: ${naira(paid)} from ${rider.from ?? 'a stop'} to ${rider.destName ?? 'their stop'}`, { prof: 1, business: 0.3 }));
  on('supply:delivered', (o) => this.selfWork('trader', `supply:${o.id}`, `Delivered ${o.qty ?? ''} ${o.itemName ?? 'goods'} to ${o.traderName ?? 'a trader'}`.replace(/\s+/g, ' '), { prof: 2, business: 1 }));
  on('police:fled', (s) => { const k = `fled:${s.post?.id}:${Math.round(s.started ?? 0)}`; this.record.add({ kind: 'evasion', day: this.day, text: `Drove off from the ${s.post?.name ?? 'checkpoint'} (${s.offence})`, ref: k }); this.note(k, `Ran from a police checkpoint (${s.offence})`, { notoriety: 4, public: -2, integrity: -2 }); });
  on('police:paid', (p) => { this.record.add({ kind: 'fine', day: this.day, text: `Paid a police fine: ${p.offence} at ${p.post}`, amount: p.amount, ref: `fine:${p.key}` }); this.note(`fine:${p.key}`, `Paid a fine of ${naira(p.amount)} (${p.offence})`, { public: -0.5 }); });
  on('police:held', (p) => this.record.add({ kind: 'held', day: this.day, text: `Vehicle held at ${p.post} until a fine of ${naira(p.amount)} is paid`, amount: p.amount, ref: `held:${p.vehicle}:${this.day}` }));
  on('clock:day', (day) => { this.standing.newDay(day); this.socialFloor(); });
 }
 /** Wire up a loaded save (save.life was filled in by the save migration). */
 start(save) {
  const life = save.life ??= {};
  life.work = ensureWork(life.work); life.standing = ensureStanding(life.standing); life.record = ensureRecord(life.record);
  this.save = save; this.work = new Occupations(life.work); this.standing = new Standing(life.standing); this.record = new LegalRecord(life.record);
  this.ready = true; this.socialFloor();
 }
 get day() { return this.g.clock?.day ?? 1; }
 note(key, text, dims = {}) { return this.standing?.record({ key, day: this.day, text, ...dims }); }
 /** Self-employed work: you become known for it, and it counts towards your standing in it. */
 selfWork(id, key, text, { prof = 1, business = 0, public: pub = 0 } = {}) {
  if (this.standing.has(key)) return;
  const r = this.work.did(id, this.day);
  this.note(key, text, { prof: { [id]: prof }, business, public: pub });
  if (r?.first) this.g.ui?.toast(`You're now working as a ${OCCUPATION[id].label.toLowerCase()} · see Profile on your phone`);
  else if (r?.promoted) this.g.ui?.toast(`${OCCUPATION[id].label}: you're now a ${r.promoted}`);
 }
 /** People you know make you more connected: social influence never falls below what your contacts give you. */
 socialFloor() { const n = Object.values(this.save?.relationships ?? {}).filter((r) => (r.talks ?? 0) > 0).length, s = this.standing.s; s.social = Math.max(s.social, Math.min(60, n * 2)); }
 /** What the police and custody systems say right now (for the legal status line and job applications). */
 legalLive() {
  const p = this.save?.police ?? {}, st = this.g.story?.s;
  return { custody: !!st?.arrest, wanted: (p.wanted ?? 0) > 0 || !!this.g.justice?.wanted(), owed: (p.owed ?? []).reduce((a, o) => a + (o.amount ?? 0), 0), held: Object.keys(p.held ?? {}).length, investigation: !!st?.fraudActive };
 }
 legal() { return this.record.status(this.legalLive()); }
 netWorth() {
  const g = this.g, h = g.homes?.housing; let worth = g.economy?.balance ?? 0;
  for (const id of Object.keys(h?.state.owned ?? {})) worth += h.purchasePrice?.(id) ?? 0;
  for (const v of this.save?.vehicles ?? []) worth += Math.round((CATALOGUE_BY_ID[v.model]?.price ?? 0) * 0.6);
  for (const home of Object.values(this.save?.housing?.upgrades ?? {})) for (const p of home?.pieces ?? []) worth += Math.round((GOOD_BY_ID[p.item]?.price ?? 0) * 0.4);
  // v0.41: bank account less what you owe, business accounts and premises you own
  const B = this.g.business, bank = this.save?.bank;
  if (bank?.open) { worth += bank.account.balance; for (const l of bank.loans ?? []) if (l.status === 'active' || l.status === 'default') worth -= Math.max(0, l.total - l.paid); }
  for (const o of this.save?.orgs?.list ?? []) { worth += o.account?.balance ?? 0; const pr = o.lease === 'own' && B?.premisesOf?.(o); if (pr) worth += Math.round(pr.price * 0.7); }
  return Math.max(0, worth);
 }
 ctx() { const g = this.g, j = this.save.justice; return { skills: g.skills, inventory: g.inventory, character: this.save.character, legal: this.legal(), day: this.day, academy: j?.academy, kingdom: !!j?.kingdom, degrees: this.save.education?.degrees ?? [] }; }

 // ── workplaces ────────────────────────────────────────────────────────────────────────────────
 /** The employment part of a workplace's menu (CareerCity.siteView). */
 siteOptions(site) {
  const g = this.g, c = this.work.current, here = (site.careers ?? []).filter((id) => OCCUPATION[id] && (this.save.character.ageGroup !== 'child' || OCCUPATION[id].child)), out = [];
  for (const id of here) {
   const o = OCCUPATION[id];
   if (c?.id === id) {
    const now = this.shiftCheck();
    if (o.force) { const duty = g.saveData.justice?.duty; out.push({ label: duty ? 'Carry on with your duty' : `Go on duty as ${rankName(id, c.rank)}`, sub: duty ? duty.steps[duty.step]?.text : now.ok ? `A duty in the city · about ${naira(o.shiftPay * [1, 1.25, 1.6, 2, 2.6][c.rank])} · by the book, or not` : now.error, primary: !!duty || now.ok, disabled: !duty && !now.ok, why: now.error, act: () => g.justice.startDuty() }); }
    else out.push({ label: `Work a shift as ${rankName(id, c.rank)}`, sub: now.ok ? `${now.minutes / 60} hours · about ${naira(o.shiftPay * [1, 1.25, 1.6, 2, 2.6][c.rank])} · ${SKILLS[o.skill]} practice` : now.error, primary: now.ok, disabled: !now.ok, why: now.error, act: () => this.startShift() });
    const next = c.rank + 1 < o.ranks.length ? this.work.requirements(id, c.rank + 1) : null;
    if (next) out.push({ label: `Next: ${o.ranks[c.rank + 1]}`, sub: `${c.shifts}/${next.shifts} shifts · ${this.day - c.since}/${next.days} days · ${SKILLS[o.skill]} ${g.skills.level(o.skill)}/${next.skill} · standing ${Math.round(this.standing.value('professional', id))}/${next.professional}${c.warnings ? ` · ${c.warnings} warning(s) to clear` : ''}`, disabled: true, why: 'Keep working well' });
    out.push({ label: 'Resign', sub: 'Leave this job. You can apply again later.', ghost: true, act: () => this.confirmResign() });
   } else {
    const e = this.work.eligibility(id, this.ctx());
    out.push({ label: `Apply: ${o.label}`, sub: e.ok ? `Start as ${o.ranks[0]} · ${naira(o.shiftPay)} a shift${c ? ` · you'll leave your job as ${rankName(c.id, c.rank)}` : ''}` : e.missing.join(' · '), disabled: !e.ok, why: e.missing.join(' · '), act: () => this.apply(id) });
   }
  }
  return out;
 }
 apply(id) {
  const g = this.g, c = this.work.current;
  const go = () => { const r = this.work.join(id, this.ctx()); if (!r.ok) { g.ui.toast(r.error); return; } this.note(`joined:${id}:${this.work.w.seq++}`, `Hired as ${r.rank} (${OCCUPATION[id].label})`, { social: 1 }); g.saveGame(); g.ui.toast(`Hired! You start as ${r.rank}. Come back in working hours for a shift.`); g.renderChoice?.(); };
  if (!c) return go();
  g.openChoice(() => ({ title: 'Change jobs?', text: `You'll resign as ${rankName(c.id, c.rank)} (${OCCUPATION[c.id].label}) to start as ${OCCUPATION[id].ranks[0]}. Your skills and equipment stay yours.`, options: [{ label: 'Resign and take the new job', primary: true, act: () => { g.closeChoice(); go(); } }, { label: 'Keep my job', ghost: true, act: () => g.closeChoice() }] }));
 }
 confirmResign() {
  const g = this.g, c = this.work.current; if (!c) return;
  g.openChoice(() => ({ title: 'Resign?', text: `Leave your job as ${rankName(c.id, c.rank)} (${OCCUPATION[c.id].label}). You keep your skills, equipment and money, and you can apply again later at the starting rank.`, options: [{ label: 'Resign', primary: true, act: () => { this.work.resign(this.day); this.note(`resigned:${c.id}:${this.work.w.seq++}`, `Resigned from ${OCCUPATION[c.id].label}`); g.saveGame(); g.closeChoice(); g.ui.toast('You resigned. Find new work at any workplace, or work for yourself.'); } }, { label: 'Stay', ghost: true, act: () => g.closeChoice() }] }));
 }
 shiftCheck() { const g = this.g; return this.work.canWork({ day: this.day, hour: g.clock.minutes / 60, weekday: weekdayOf(this.day), needs: { energy: g.needs.energy, hunger: g.needs.state?.hunger ?? 100 } }); }
 startShift() {
  const g = this.g, c = this.work.current, now = this.shiftCheck(); if (!c || !now.ok) { g.ui.toast(now.error ?? 'You have no job'); return; }
  if (OCCUPATION[c.id].cases && g.occupationsCity) return g.occupationsCity.runCase(c.id); // v0.46: a real case, then the shift is paid
  const d = OCCUPATION[c.id].dilemma;
  if (!this.work.dilemmaDue()) return this.finishShift(null);
  g.openChoice(() => ({ title: 'On the job', kicker: `${rankName(c.id, c.rank).toUpperCase()} · A CHOICE`, text: d.prompt, note: 'Nobody makes this choice for you. Shortcuts can pay, and can cost you.', options: [
   { label: d.honest, sub: 'Do it properly', act: () => { g.closeChoice(); this.finishShift('honest'); } },
   ...d.shortcut.slice(0, 2).map((s) => ({ label: s, sub: d.kind === 'dishonest' ? 'The shortcut · more money, if nobody notices' : d.kind === 'mistake' ? 'Your call' : 'The quick way', act: () => { g.closeChoice(); this.finishShift('shortcut'); } })),
  ] }));
 }
 finishShift(choice, opts = {}) {
  const g = this.g, c = this.work.current; if (!c) return; const o = OCCUPATION[c.id], seq = ++this.work.w.seq;
  if (g.state === 'overlay' && g.overlay === 'choice') g.closeChoice();
  const r = this.work.work({ day: this.day, skills: g.skills, needs: { energy: g.needs.energy }, professional: this.standing.value('professional', c.id), choice });
  if (opts.skip !== false) g.skipTime(r.minutes); g.needs.adjust({ energy: -18, hunger: -14, fun: -6, hygiene: -6 }); g.skills.add?.(o.skill, 45);
  if (opts.bonus) r.pay = Math.max(50, r.pay + opts.bonus);
  const tx = g.economy.transact({ key: `shift:${o.id}:${seq}`, amount: r.pay, reason: `${o.id === 'student' ? 'Bursary' : 'Shift pay'}: ${rankName(o.id, r.rank)}, ${o.label}` });
  this.note(`shift:${o.id}:${seq}`, `Worked a shift as ${rankName(o.id, r.rank)}${tx.ok ? ' · ' + naira(r.pay) : ''}`, { prof: { [o.id]: r.prof }, integrity: r.integrity, public: r.quality >= 0.7 ? 0.3 : 0 });
  for (const e of r.events.filter((e) => e.warning)) this.record.add({ kind: 'warning', day: this.day, agency: o.label, text: e.text, ref: `warn:${seq}` });
  let msg = `${opts.title ?? 'Shift done'}: ${naira(r.pay)} paid.`;
  if (r.dismissed) { this.record.add({ kind: 'dismissal', day: this.day, agency: o.label, text: `Dismissed after ${3} warnings`, ref: `dismiss:${seq}` }); this.note(`dismissed:${seq}`, `Dismissed from ${o.label}`, { public: -3, integrity: -4, social: -1 }); msg = `You've been dismissed from ${o.label} after three warnings. They'll consider you again on day ${r.dismissed.until}.`; }
  else if (r.promoted) { this.note(`promoted:${o.id}:${r.promoted.rank}:${seq}`, `Promoted to ${r.promoted.name}`, { public: 1, social: 1 }); msg += ` Promoted to ${r.promoted.name}!`; }
  else if (r.warned) msg += o.force ? ` A complaint against you was upheld: warning ${c.warnings}/3.` : ` You were caught: warning ${c.warnings}/3.`;
  g.saveGame(); g.ui.toast(msg, 5000);
 }

 // ── crime, custody (called from the story/justice code) ─────────────────────────────────────────
 parcel(id, returned) {
  const k = `parcel:${this.day}:${id}`;
  if (returned) this.note(k, 'Returned a lost parcel to its owner', { public: 3, integrity: 3, social: 1 });
  else this.note(k, 'Stole a parcel from a trader', { integrity: -6, notoriety: 2 });
 }
 escaped(p) { if (p.kind === 'thugs') return; this.note(`escape:${p.id}`, `Escaped a police pursuit (${p.reason ?? 'an offence'})`, { notoriety: 5, public: -2 }); this.record.add({ kind: 'case', day: this.day, text: `Open case: ${p.reason ?? 'offence'} (escaped)`, status: 'open', ref: `case:${p.id}` }); }
 custody(agency, reason) { this.record.add({ kind: 'custody', day: this.day, agency, text: `Taken into ${agency === 'efcc' ? 'EFCC' : 'police'} custody: ${reason}`, ref: `custody:${agency}:${this.day}:${reason}` }); this.note(`custody:${agency}:${this.day}:${reason}`, `Arrested by the ${agency === 'efcc' ? 'EFCC' : 'police'}: ${reason}`, { public: -4, notoriety: 3 }); }
 released(bail, agency) { this.record.close((e) => e.kind === 'case', this.day, 'Dealt with in custody'); this.record.add({ kind: bail ? 'bail' : 'service', day: this.day, agency, text: bail ? 'Released on bail' : 'Released after community service', ref: `release:${this.day}:${this.record.r.seq}` }); }

 // ── profile ───────────────────────────────────────────────────────────────────────────────────
 profile() {
  const s = this.standing, worth = this.netWorth(), w = wealthOf(worth), jobs = this.work.summary(), legal = this.legal();
  const dims = DIMENSIONS.map((d) => {
   if (d.id === 'wealth') return { ...d, value: w.bar, word: `${w.tier} · ${naira(w.netWorth)}`, bar: w.bar };
   if (d.id === 'professional') return { ...d, list: jobs.map((j) => ({ label: j.label, value: Math.round(s.value('professional', j.id)), word: labelFor('professional', s.value('professional', j.id)) })) };
   const v = s.value(d.id); return { ...d, value: Math.round(v), word: s.label(d.id), bar: d.min < 0 ? (v + 100) / 2 : v };
  });
  return { name: this.save.character.name, jobs, dims, legal, record: this.record.r.entries.slice(-12).reverse(), log: [...s.s.log].reverse().slice(0, 25), history: [...this.work.w.history].reverse().slice(0, 12), worth, publicView: s.publicView(worth) };
 }
 /** Shown at the custody desk and anywhere the old "Story & careers" page used to open. */
 profileView() { const g = this.g; return { title: 'Your profile', text: 'Your work, reputation and record are on your phone: open Profile.', options: [{ label: 'Open Profile', primary: true, act: () => { g.closeChoice(); g.openOverlay('phone'); g.phone?.render('profile'); } }, { label: 'Close', ghost: true, act: () => g.closeChoice() }] }; }
}
export { RECORD_KINDS, SHIFT };
