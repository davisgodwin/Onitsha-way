/**
 * v0.42 investigations and the courts (pure rules).
 *
 * Every crime that is noticed becomes a case with the police or the EFCC. Each day the investigators work it: the
 * stronger the evidence, the likelier they identify you and put out a warrant. Evidence fades and unsolved cases go
 * cold. When you're arrested, the cases with a warrant become charges, and a magistrate deals with them: plead guilty
 * for a lighter sentence, or stand trial (a lawyer helps). Sentences are fines, community service done in custody,
 * and handing back what you took. Everything is game money and fictional people; the agencies are the real names.
 *
 * state (save.justice): { v, seq, cases: [case], stash: [{ id, name, value, day }], academy: { police, efcc },
 *   academyDay, duty, kingdom, court: { day, caseIds, bond } | null, kit, plan: { scouted: { [bankId]: day }, crew },
 *   convictions, complaints, log: [{ day, text }] }
 * case = { id, agency, offence, severity, evidence, day, status: 'open'|'warrant'|'charged'|'closed', outcome?, amount, ref }
 */
export const CASE = { identifyAt: 0.55, perDay: 0.6, decay: 0.04, coldAfter: 21, max: 60, logMax: 40 };
export const SENTENCE = { fine: [0, 8000, 25000, 70000, 250000], service: [0, 1, 2, 3, 5], plea: 0.7, prior: 0.25 };
export const LAWYERS = { none: { label: 'Defend yourself', cost: 0, bonus: 0 }, aid: { label: 'Legal aid lawyer', cost: 0, bonus: 0.08 }, private: { label: 'Private lawyer', cost: 60000, bonus: 0.22 } };
export const BAIL_PER_SEVERITY = 20000;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, d = 0) => (Number.isInteger(v) && v >= 0 ? v : d);
export function newJustice() { return { v: 1, seq: 0, cases: [], stash: [], academy: { police: 0, efcc: 0 }, academyDay: 0, duty: null, kingdom: null, court: null, kit: false, plan: { scouted: {}, crew: 0 }, convictions: 0, complaints: 0, log: [] }; }
export function ensureJustice(raw) {
 const j = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : newJustice();
 j.seq = int(j.seq);
 j.cases = (Array.isArray(j.cases) ? j.cases : []).filter((c) => c && typeof c.id === 'string' && ['police', 'efcc'].includes(c.agency) && ['open', 'warrant', 'charged', 'closed'].includes(c.status)).slice(-CASE.max);
 for (const c of j.cases) { c.severity = clamp(int(c.severity, 1), 1, 4); c.evidence = clamp(Number.isFinite(c.evidence) ? c.evidence : 0, 0, 3); c.amount = int(c.amount); }
 j.stash = (Array.isArray(j.stash) ? j.stash : []).filter((s) => s && typeof s.name === 'string' && Number.isFinite(s.value)).slice(-30);
 j.academy = { police: clamp(int(j.academy?.police), 0, 3), efcc: clamp(int(j.academy?.efcc), 0, 3) };
 j.academyDay = int(j.academyDay); j.kit = !!j.kit; j.convictions = int(j.convictions); j.complaints = int(j.complaints);
 j.plan = { scouted: j.plan?.scouted && typeof j.plan.scouted === 'object' ? j.plan.scouted : {}, crew: clamp(int(j.plan?.crew), 0, 4) };
 j.court = j.court && Number.isInteger(j.court.day) && Array.isArray(j.court.caseIds) ? j.court : null;
 j.duty = j.duty && typeof j.duty.id === 'string' && Array.isArray(j.duty.steps) ? j.duty : null;
 j.kingdom = j.kingdom && typeof j.kingdom.name === 'string' && Array.isArray(j.kingdom.members) ? j.kingdom : null;
 j.log = (Array.isArray(j.log) ? j.log : []).filter((l) => l && typeof l.text === 'string').slice(-CASE.logMax);
 j.v = 1; return j;
}
export class Cases {
 constructor(state, { rng = Math.random } = {}) { this.j = ensureJustice(state); this.rng = rng; }
 log(day, text) { this.j.log.push({ day: Math.floor(day ?? 1), text }); if (this.j.log.length > CASE.logMax) this.j.log.shift(); }
 /** Open a case (once per ref). Evidence starts at what the crime left behind. */
 open({ agency = 'police', offence, severity = 1, evidence = 0, day, ref = null, amount = 0 }) {
  if (ref) { const old = this.j.cases.find((c) => c.ref === ref); if (old) return old; }
  const c = { id: `case:${++this.j.seq}`, agency, offence: String(offence).slice(0, 120), severity: clamp(severity, 1, 4), evidence: clamp(evidence, 0, 3), day: Math.floor(day ?? 1), status: 'open', amount: Math.max(0, Math.round(amount)), ...(ref ? { ref } : {}) };
  if (c.evidence >= 1) c.status = 'warrant'; // caught in the act, or plainly identified
  this.j.cases.push(c); if (this.j.cases.length > CASE.max) { const i = this.j.cases.findIndex((x) => x.status === 'closed'); this.j.cases.splice(i >= 0 ? i : 0, 1); }
  return c;
 }
 add(id, evidence, amount = 0) { const c = this.byId(id); if (!c || c.status === 'closed') return null; c.evidence = clamp(c.evidence + evidence, 0, 3); c.amount += Math.max(0, Math.round(amount)); if (c.evidence >= 1 && c.status === 'open') c.status = 'warrant'; return c; }
 byId(id) { return this.j.cases.find((c) => c.id === id) ?? null; }
 active() { return this.j.cases.filter((c) => c.status !== 'closed'); }
 warrants(agency = null) { return this.j.cases.filter((c) => c.status === 'warrant' && (!agency || c.agency === agency)); }
 wanted() { return this.warrants().length > 0; }
 charged() { return this.j.cases.filter((c) => c.status === 'charged'); }
 /**
  * A day of investigation. Each open case: the investigators may identify you (more likely with more evidence and
  * for more serious crimes); evidence fades a little; a case with nothing new for 21 days goes cold.
  * extra = { [caseId]: evidence added today (informants, a kingdom's activity) }. Returns what changed.
  */
 newDay(day, extra = {}) {
  const out = [];
  for (const c of this.j.cases) {
   if (c.status !== 'open') continue;
   if (extra[c.id]) c.evidence = clamp(c.evidence + extra[c.id], 0, 3);
   const p = clamp((c.evidence - 0.1) * CASE.perDay * (0.8 + c.severity * 0.1), 0, 0.95);
   if (c.evidence >= CASE.identifyAt && this.rng() < p) { c.status = 'warrant'; c.warrantDay = day; out.push({ type: 'warrant', c }); continue; }
   c.evidence = clamp(c.evidence - CASE.decay, 0, 3);
   if (day - c.day >= CASE.coldAfter && !extra[c.id]) { c.status = 'closed'; c.outcome = 'cold'; c.closedDay = day; out.push({ type: 'cold', c }); }
  }
  return out;
 }
 /** Arrested: every warrant becomes a charge. Returns the charges. */
 charge(day, agency = null) { const list = this.warrants(agency); for (const c of list) { c.status = 'charged'; c.chargedDay = day; } return this.charged(); }
 close(ids, outcome, day) { for (const c of this.j.cases) if (ids.includes(c.id) && c.status !== 'closed') { c.status = 'closed'; c.outcome = outcome; c.closedDay = day; } }
 /** How strong the prosecution's case is (0–1) across the charges. */
 strength(ids) { const cs = ids.map((id) => this.byId(id)).filter(Boolean); return cs.length ? clamp(Math.max(...cs.map((c) => c.evidence)) / 1.5, 0, 1) : 0; }
 /** The sentence for a set of charges. guilty = pleaded guilty (30% off). Priors make it heavier. */
 sentence(ids, { guilty = false } = {}) {
  const cs = ids.map((id) => this.byId(id)).filter(Boolean), k = (guilty ? SENTENCE.plea : 1) * (1 + SENTENCE.prior * Math.min(4, this.j.convictions));
  const fine = Math.round(cs.reduce((s, c) => s + SENTENCE.fine[c.severity], 0) * k / 500) * 500;
  const service = Math.max(cs.length ? 1 : 0, Math.round(cs.reduce((s, c) => s + SENTENCE.service[c.severity], 0) * k));
  const forfeit = cs.reduce((s, c) => s + c.amount, 0);
  return { fine, service: Math.min(12, service), forfeit, offences: cs.map((c) => c.offence) };
 }
 /** A trial: the magistrate convicts if the evidence holds. A good lawyer makes weak evidence fail. */
 trial(ids, lawyer = 'none') {
  const L = LAWYERS[lawyer] ?? LAWYERS.none, s = this.strength(ids), p = clamp(0.15 + s * 0.85 - L.bonus, 0.05, 0.95);
  return { convicted: this.rng() < p, chance: Math.round(p * 100) / 100 };
 }
 bail(ids) { const cs = ids.map((id) => this.byId(id)).filter(Boolean); return cs.reduce((s, c) => s + c.severity * BAIL_PER_SEVERITY, 0); }
 /** Bribing whoever holds your case: sometimes it disappears; if not, it's another charge. */
 bribe(ids, day) {
  const cs = ids.map((id) => this.byId(id)).filter(Boolean), amount = cs.reduce((s, c) => s + c.severity * 15000, 0), ok = this.rng() < 0.35;
  if (ok) this.close(ids, 'dropped (bribe)', day);
  else this.open({ agency: cs[0]?.agency ?? 'police', offence: 'Attempted bribery of an officer', severity: 1, evidence: 1.2, day, ref: `bribe:${day}:${this.j.seq}` }).status = 'charged';
  return { ok, amount };
 }
}
