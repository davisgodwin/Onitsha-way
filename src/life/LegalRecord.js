/**
 * v0.40 legal and disciplinary record: facts, kept apart from reputation (what people think).
 * Entries: fines (issued, paid), checkpoint evasions, vehicles held, custody and bail, dismissals and work warnings,
 * and open cases. The traffic police (sim/Police.js) and the custody desk keep their own working state; this record is
 * the history of what officially happened, which employers and (later) investigators can check.
 * entry = { id, day, kind, agency, text, amount?, status: 'open' | 'closed', ref? }
 */
export const RECORD_KINDS = { fine: 'Fine', evasion: 'Ran from a checkpoint', held: 'Vehicle held', custody: 'Taken into custody', bail: 'Released on bail', service: 'Community service', case: 'Case', warning: 'Work warning', dismissal: 'Dismissed from work', cleared: 'Cleared', conviction: 'Convicted' };
export const RECORD_MAX = 120;
export function newRecord() { return { v: 1, seq: 0, entries: [] }; }
export function ensureRecord(raw) {
 const r = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : newRecord();
 r.seq = Number.isInteger(r.seq) && r.seq >= 0 ? r.seq : 0;
 r.entries = Array.isArray(r.entries) ? r.entries.filter((e) => e && typeof e.id === 'string' && RECORD_KINDS[e.kind] && typeof e.text === 'string').slice(-RECORD_MAX) : [];
 r.v = 1; return r;
}
export class LegalRecord {
 constructor(state) { this.r = ensureRecord(state); }
 /** Add an entry once (`ref` makes it idempotent: the same ref is never recorded twice). */
 add({ kind, day, agency = 'police', text, amount = null, status = 'closed', ref = null }) {
  if (!RECORD_KINDS[kind]) return null;
  if (ref && this.r.entries.some((e) => e.ref === ref)) return null;
  const e = { id: `rec:${++this.r.seq}`, day: Math.floor(day ?? 1), kind, agency, text: String(text ?? RECORD_KINDS[kind]).slice(0, 160), status, ...(amount != null ? { amount: Math.round(amount) } : {}), ...(ref ? { ref } : {}) };
  this.r.entries.push(e); if (this.r.entries.length > RECORD_MAX) this.r.entries.shift();
  return e;
 }
 close(match, day, text) { let n = 0; for (const e of this.r.entries) if (e.status === 'open' && match(e)) { e.status = 'closed'; e.closedDay = Math.floor(day ?? 1); if (text) e.closedText = text; n++; } return n; }
 open() { return this.r.entries.filter((e) => e.status === 'open'); }
 count(kind, sinceDay = -Infinity) { return this.r.entries.filter((e) => e.kind === kind && e.day >= sinceDay).length; }
 /**
  * The one-line legal status shown in your profile and checked by employers.
  * live = { wanted, owed, held, custody, investigation } from the police / custody systems.
  */
 status(live = {}) {
  if (live.custody) return { word: 'In custody', level: 3, clean: false };
  if (live.wanted) return { word: 'Wanted by the police', level: 3, clean: false };
  if (live.investigation) return { word: 'Under EFCC investigation', level: 2, clean: false };
  if (live.owed > 0 || live.held > 0) return { word: 'Fines unpaid', level: 1, clean: false };
  if (this.open().length) return { word: 'Open case', level: 1, clean: false };
  return { word: this.r.entries.some((e) => ['fine', 'evasion', 'custody', 'conviction'].includes(e.kind)) ? 'Clear (has a past record)' : 'Clean record', level: 0, clean: true };
 }
}
