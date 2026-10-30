import { Economy } from '../economy/Economy.js';
/**
 * v0.41 contracts with escrow. An agreement between you (or your organisation) and someone else: a wage or a fee,
 * paid out of money set aside up front, so the other side knows it is there.
 *
 *   offer → accept (the escrow is funded from the payer's account) → payments released from escrow (daily or once)
 *        → ended (whatever is left in escrow goes back to the payer) | disputed (frozen until resolved)
 *
 * Every movement has its own key, so a payment can't happen twice. Escrow is its own ledger.
 * contract = { id, kind: 'wage' | 'fee', title, payer, payee, payeeName, amount (per day or once), days?, escrow:
 *   {balance, ledger, processed}, status: 'offered' | 'active' | 'ended' | 'disputed', startDay, paidDays, lastPaid }
 */
export const CONTRACT = { escrowDays: 3, maxContracts: 40 };
export function newContracts() { return { v: 1, seq: 0, list: [] }; }
export function ensureContracts(raw) { const c = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : newContracts(); c.seq = Number.isInteger(c.seq) ? c.seq : 0; c.list = Array.isArray(c.list) ? c.list.filter((k) => k && typeof k.id === 'string' && Number.isInteger(k.amount) && k.amount > 0) : []; c.v = 1; return c; }
export class Contracts {
 constructor(state, { clock = null } = {}) { this.s = ensureContracts(state); this.clock = clock; }
 get(id) { return this.s.list.find((k) => k.id === id) ?? null; }
 escrow(k) { return new Economy(k.escrow, { clock: this.clock }); }
 offer({ kind = 'wage', title, payer, payee, payeeName, amount, days = null, meta = {} }) {
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Invalid amount' };
  if (this.s.list.filter((k) => k.status === 'active').length >= CONTRACT.maxContracts) return { ok: false, error: 'Too many contracts' };
  const k = { id: `ct:${++this.s.seq}`, kind, title, payer, payee, payeeName, amount, days, meta, escrow: { balance: 0, ledger: [], processed: [] }, status: 'offered', startDay: null, paidDays: 0, lastPaid: null };
  this.s.list.push(k); return { ok: true, contract: k };
 }
 /** Accept and fund: `account` is the payer's Economy; escrow = amount × escrowDays (wage) or the whole fee. */
 accept(id, account, day) {
  const k = this.get(id); if (!k || k.status !== 'offered') return { ok: false, error: 'Not an open offer' };
  const fund = k.kind === 'wage' ? k.amount * CONTRACT.escrowDays : k.amount;
  const out = account.transact({ key: `${k.id}:fund`, amount: -fund, reason: `Escrow for: ${k.title}` }); if (!out.ok) return { ok: false, error: out.error === 'insufficient-funds' ? 'Not enough money to set aside' : out.error };
  this.escrow(k).transact({ key: `${k.id}:fund`, amount: fund, reason: 'Funded' });
  k.status = 'active'; k.startDay = day; k.lastPaid = day; return { ok: true, contract: k };
 }
 /** Top the escrow back up from the payer's account (keeps a wage contract funded). */
 topUp(id, account, day) {
  const k = this.get(id); if (!k || k.status !== 'active' || k.kind !== 'wage') return { ok: false };
  const want = k.amount * CONTRACT.escrowDays - k.escrow.balance; if (want <= 0) return { ok: true, added: 0 };
  const add = Math.min(want, account.balance); if (add <= 0) return { ok: false, error: 'insufficient-funds' };
  const out = account.transact({ key: `${k.id}:top:${day}`, amount: -add, reason: `Escrow top-up: ${k.title}` }); if (!out.ok) return { ok: false, error: out.error };
  this.escrow(k).transact({ key: `${k.id}:top:${day}`, amount: add, reason: 'Top-up' }); return { ok: true, added: add };
 }
 /** Release one day's wage (or the fee) from escrow to the payee. Returns the amount paid, 0 if escrow is short. */
 release(id, day, payeeAccount = null) {
  const k = this.get(id); if (!k || k.status !== 'active') return 0;
  const amt = Math.min(k.amount, k.escrow.balance); if (amt < k.amount) return 0;
  const tx = this.escrow(k).transact({ key: `${k.id}:pay:${day}`, amount: -amt, reason: `Paid: ${k.title}` }); if (!tx.ok) return 0;
  payeeAccount?.transact({ key: `${k.id}:pay:${day}`, amount: amt, reason: `${k.title}` });
  k.paidDays++; k.lastPaid = day; if (k.kind === 'fee') this.end(id, day);
  return amt;
 }
 /** End: what is left in escrow goes back to the payer. */
 end(id, day, payerAccount = null) {
  const k = this.get(id); if (!k || (k.status !== 'active' && k.status !== 'disputed' && k.status !== 'offered')) return { ok: false };
  const left = k.escrow.balance;
  if (left > 0 && payerAccount) { this.escrow(k).transact({ key: `${k.id}:refund`, amount: -left, reason: 'Refunded' }); payerAccount.transact({ key: `${k.id}:refund`, amount: left, reason: `Escrow returned: ${k.title}` }); }
  k.status = 'ended'; k.endDay = day; return { ok: true, refunded: left };
 }
 dispute(id, why) { const k = this.get(id); if (!k || k.status !== 'active') return { ok: false }; k.status = 'disputed'; k.dispute = String(why ?? '').slice(0, 120); return { ok: true }; }
 resolve(id) { const k = this.get(id); if (!k || k.status !== 'disputed') return { ok: false }; k.status = 'active'; delete k.dispute; return { ok: true }; }
 forPayer(payer) { return this.s.list.filter((k) => k.payer === payer && k.status !== 'ended'); }
}
