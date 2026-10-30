import { PROGRAMME, hasDegree } from '../data/education.js';
import { OCCUPATION, RANK_PAY, PROMOTION, SHIFT, DISMISSAL } from '../data/occupations.js';
import { SKILLS } from './Skills.js';
/**
 * v0.40 occupations: what you do for a living, chosen in the world and changeable at any time.
 * Pure rules (no rendering, no wallet): LifeController pays, records reputation and shows the choices.
 * State (save.life.work): { current: null | { id, rank, since, shifts, clean, warnings, lastDay, today, dilemmas },
 *   self: { [id]: { since, acts, rank } }, banned: { [id]: untilDay }, seq, history: [{ day, text }] }
 */
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const int = (v, d = 0) => (Number.isInteger(v) && v >= 0 ? v : d);
export const HISTORY_MAX = 60;
export function newWork() { return { v: 1, current: null, self: {}, banned: {}, seq: 0, history: [] }; }
export function ensureWork(raw) {
 const w = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : newWork();
 const c = w.current;
 w.current = c && OCCUPATION[c.id]?.kind === 'employed' ? { id: c.id, rank: clamp(int(c.rank), 0, OCCUPATION[c.id].ranks.length - 1), since: int(c.since, 1), shifts: int(c.shifts), clean: int(c.clean), warnings: clamp(int(c.warnings), 0, DISMISSAL.warnings), lastDay: int(c.lastDay), today: int(c.today), dilemmas: int(c.dilemmas) } : null;
 w.self = Object.fromEntries(Object.entries(w.self && typeof w.self === 'object' ? w.self : {}).filter(([id, v]) => OCCUPATION[id]?.kind === 'self' && v && typeof v === 'object').map(([id, v]) => [id, { since: int(v.since, 1), acts: int(v.acts), rank: clamp(int(v.rank), 0, OCCUPATION[id].ranks.length - 1) }]));
 w.banned = Object.fromEntries(Object.entries(w.banned && typeof w.banned === 'object' ? w.banned : {}).filter(([id, d]) => OCCUPATION[id] && Number.isFinite(d)));
 w.seq = int(w.seq); w.history = Array.isArray(w.history) ? w.history.filter((h) => h && typeof h.text === 'string').slice(-HISTORY_MAX) : [];
 w.v = 1; return w;
}
export const rankName = (id, rank) => OCCUPATION[id]?.ranks[clamp(rank ?? 0, 0, (OCCUPATION[id]?.ranks.length ?? 1) - 1)] ?? '';
/** Pay for one shift at a rank, scaled by how well it went (quality 0..1): 85%–115% of the rank's rate. */
export const shiftPay = (id, rank, quality = 0.5) => Math.max(50, Math.round((OCCUPATION[id].shiftPay * RANK_PAY[rank] * (0.85 + 0.3 * clamp(quality, 0, 1))) / 50) * 50);

export class Occupations {
 constructor(state, { rng = Math.random } = {}) { this.w = ensureWork(state); this.rng = rng; }
 log(day, text) { this.w.history.push({ day: Math.floor(day ?? 1), text }); if (this.w.history.length > HISTORY_MAX) this.w.history.shift(); }
 get current() { return this.w.current; }
 /** Can you take this job now? ctx = { skills, inventory, character, legal: { clean, word }, day } */
 eligibility(id, ctx) {
  const o = OCCUPATION[id]; if (!o || o.kind !== 'employed') return { ok: false, checks: [], missing: ['Not a job you apply for'] };
  const checks = [], child = ctx.character?.ageGroup === 'child';
  if (child && !o.child) checks.push({ ok: false, label: 'Adults only' });
  const lvl = ctx.skills?.level(o.skill) ?? 1, need = child ? 1 : o.level;
  checks.push({ ok: lvl >= need, label: `${SKILLS[o.skill] ?? o.skill} level ${need} (now ${lvl})` });
  for (const t of child ? [] : o.tools) checks.push({ ok: !!ctx.inventory?.has(t), label: `Own: ${t.replace(/-/g, ' ')}` });
  if (!child) checks.push({ ok: ctx.legal?.clean !== false, label: `Police record: ${ctx.legal?.word ?? 'clean'}` });
  if (o.degree && !child) checks.push({ ok: hasDegree(ctx.degrees ?? [], o.degree), label: o.degree === 'any' ? 'A university degree (Shanahan University)' : `A degree in ${PROGRAMME[o.degree]?.label ?? o.degree} (Shanahan University)` });
  if (o.academy && !child) checks.push({ ok: (ctx.academy?.[id] ?? 0) >= o.academy, label: `Academy training ${Math.min(o.academy, ctx.academy?.[id] ?? 0)}/${o.academy} (at the ${id === 'efcc' ? 'EFCC field office' : 'police station'})` });
  if (o.force && !child) checks.push({ ok: !ctx.kingdom, label: 'Not in a Hustle Kingdom' });
  const ban = this.w.banned[id]; if (ban && (ctx.day ?? 0) < ban) checks.push({ ok: false, label: `Dismissed recently: they will consider you again on day ${ban}` });
  if (this.w.current?.id === id) checks.push({ ok: false, label: 'You already work here' });
  return { ok: checks.every((c) => c.ok), checks, missing: checks.filter((c) => !c.ok).map((c) => c.label) };
 }
 /** Take the job (any current job is resigned first by the caller asking you). */
 join(id, ctx) {
  const e = this.eligibility(id, ctx); if (!e.ok) return { ok: false, error: e.missing.join(' · ') };
  if (this.w.current) this.resign(ctx.day, 'to take a new job');
  this.w.current = { id, rank: 0, since: Math.floor(ctx.day ?? 1), shifts: 0, clean: 0, warnings: 0, lastDay: 0, today: 0, dilemmas: 0 };
  this.log(ctx.day, `Started as ${rankName(id, 0)} (${OCCUPATION[id].label})`);
  return { ok: true, rank: rankName(id, 0) };
 }
 resign(day, why = '') {
  const c = this.w.current; if (!c) return { ok: false, error: 'You have no job to resign from' };
  this.log(day, `Resigned as ${rankName(c.id, c.rank)} (${OCCUPATION[c.id].label})${why ? ' ' + why : ''}`);
  this.w.current = null; return { ok: true, id: c.id };
 }
 /** Can you work a shift now? ctx = { day, hour, weekday (0 Mon…6 Sun), needs: { energy, hunger } } */
 canWork(ctx) {
  const c = this.w.current; if (!c) return { ok: false, error: 'You have no job' };
  const student = c.id === 'student', [a, b] = student ? SHIFT.studentOpen : SHIFT.open;
  if (ctx.weekday === 6 || (student && ctx.weekday === 5)) return { ok: false, error: student ? 'No classes at the weekend' : 'Closed on Sundays' }; // weekdayOf: 0 = Monday … 6 = Sunday (v0.47 fix: this used to close on Mondays)
  if (ctx.hour < a || ctx.hour >= b) return { ok: false, error: `Shifts start between ${a}:00 and ${b}:00` };
  if (c.lastDay === ctx.day && c.today >= SHIFT.perDay) return { ok: false, error: `You've done ${SHIFT.perDay} shifts today. Rest and come back tomorrow` };
  if ((ctx.needs?.energy ?? 100) < SHIFT.energy) return { ok: false, error: 'Too tired to work. Sleep or rest first' };
  if ((ctx.needs?.hunger ?? 100) < SHIFT.hunger) return { ok: false, error: 'Too hungry to work. Eat first' };
  return { ok: true, minutes: student ? SHIFT.studentMinutes : SHIFT.minutes };
 }
 /** Every third shift brings a choice: do the job properly, or take the shortcut. */
 dilemmaDue() { const c = this.w.current; return !!c && c.shifts % 3 === 2 && !!OCCUPATION[c.id].dilemma?.prompt; }
 /**
  * Work one shift. ctx = { day, skills, needs, professional (current score), choice: 'honest' | 'shortcut' | null }.
  * Returns what happened; nothing is paid here.
  */
 work(ctx) {
  const c = this.w.current, o = OCCUPATION[c.id], dl = o.dilemma ?? {}, out = { id: c.id, events: [] };
  const lvl = ctx.skills?.level(o.skill) ?? 1, fresh = ((ctx.needs?.energy ?? 60) - 20) / 80;
  const quality = clamp(0.35 + (lvl - o.level) * 0.08 + c.rank * 0.04 + fresh * 0.25, 0, 1);
  let pay = shiftPay(c.id, c.rank, quality), prof = quality >= 0.7 ? 3 : quality >= 0.4 ? 2 : -1, integrity = 0, warned = false;
  if (ctx.choice === 'honest') { integrity += dl.kind === 'mistake' ? 0 : 2; prof += 1; out.events.push({ text: `Did the job properly: ${dl.honest}`, integrity: 2, prof: 1 }); }
  if (ctx.choice === 'shortcut') {
   if (dl.kind === 'mistake') { prof -= 4; pay = Math.round(pay * 0.6 / 50) * 50; out.events.push({ text: 'Got it wrong: the client was sent to the wrong trader', prof: -4 }); }
   else {
    pay += Math.round((pay * (dl.gain ?? 0)) / 50) * 50; integrity += dl.integrity ?? -3;
    if (this.rng() < (dl.risk ?? 0.4)) { warned = true; prof -= 6; pay = shiftPay(c.id, c.rank, quality * 0.5); c.warnings++; c.clean = 0; out.events.push({ text: dl.kind === 'complaint' ? `A complaint against you was upheld: written warning ${c.warnings}/${DISMISSAL.warnings}` : `Caught taking a shortcut (${dl.kind}): written warning ${c.warnings}/${DISMISSAL.warnings}`, prof: -6, warning: true }); }
    else out.events.push({ text: dl.kind === 'dishonest' ? 'Took the dishonest shortcut and got away with it, this time' : 'Cut corners and got away with it, this time', integrity: dl.integrity });
   }
   c.dilemmas++;
  }
  if (ctx.choice === 'honest') c.dilemmas++;
  if (c.lastDay !== ctx.day) { c.lastDay = ctx.day; c.today = 0; }
  c.today++; c.shifts++; if (!warned) c.clean++;
  if (c.warnings && c.clean >= DISMISSAL.cleanShiftsToForgive) { c.warnings--; c.clean = 0; out.events.push({ text: 'Your good work cleared a warning' }); }
  Object.assign(out, { pay, quality, prof, integrity, warned, rank: c.rank, minutes: c.id === 'student' ? SHIFT.studentMinutes : SHIFT.minutes });
  if (c.warnings >= DISMISSAL.warnings) { out.dismissed = this.dismiss(ctx.day); return out; }
  out.promoted = this.review({ day: ctx.day, skills: ctx.skills, professional: (ctx.professional ?? 0) + prof });
  return out;
 }
 /** Performance review after each shift: promoted only when every requirement for the next rank is met. */
 review(ctx) {
  const c = this.w.current; if (!c) return null; const o = OCCUPATION[c.id], next = c.rank + 1; if (next >= o.ranks.length) return null;
  const need = this.requirements(c.id, next), lvl = ctx.skills?.level(o.skill) ?? 1, days = (ctx.day ?? 1) - c.since;
  if (c.shifts < need.shifts || days < need.days || lvl < need.skill || (ctx.professional ?? 0) < need.professional || c.warnings > 0) return null;
  c.rank = next; this.log(ctx.day, `Promoted to ${o.ranks[next]}`); return { rank: next, name: o.ranks[next] };
 }
 requirements(id, rank) { const o = OCCUPATION[id]; return { shifts: PROMOTION.shifts[rank] ?? Infinity, days: PROMOTION.days[rank] ?? Infinity, skill: Math.min(10, o.level + (PROMOTION.skill[rank] ?? 9)), professional: PROMOTION.professional[rank] ?? 100 }; }
 dismiss(day) {
  const c = this.w.current; if (!c) return null; const o = OCCUPATION[c.id];
  this.w.banned[c.id] = Math.floor(day ?? 1) + DISMISSAL.banDays; this.log(day, `Dismissed from ${o.label} after ${DISMISSAL.warnings} warnings`);
  this.w.current = null; return { id: c.id, until: this.w.banned[c.id] };
 }
 /** Self-employed work done (a trader job, a keke fare, a wholesale delivery). First time = you become known for it. */
 did(id, day) {
  const o = OCCUPATION[id]; if (o?.kind !== 'self') return null;
  const first = !this.w.self[id], s = this.w.self[id] ??= { since: Math.floor(day ?? 1), acts: 0, rank: 0 };
  s.acts++; if (first) this.log(day, `Started working as: ${o.label}`);
  let promoted = null; while (s.rank + 1 < o.ranks.length && s.acts >= o.acts[s.rank + 1]) { s.rank++; promoted = o.ranks[s.rank]; }
  if (promoted) this.log(day, `${o.label}: now a ${promoted}`);
  return { first, promoted, acts: s.acts, rank: s.rank };
 }
 /** Everything you do, for the profile: main job first. */
 summary() {
  const out = []; const c = this.w.current;
  if (c) out.push({ id: c.id, kind: 'employed', label: OCCUPATION[c.id].label, rank: rankName(c.id, c.rank), rankIndex: c.rank, of: OCCUPATION[c.id].ranks.length, shifts: c.shifts, warnings: c.warnings, since: c.since });
  for (const [id, s] of Object.entries(this.w.self)) out.push({ id, kind: 'self', label: OCCUPATION[id].label, rank: rankName(id, s.rank), rankIndex: s.rank, of: OCCUPATION[id].ranks.length, acts: s.acts, since: s.since });
  return out;
 }
}
