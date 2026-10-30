import { Economy } from '../economy/Economy.js';
/**
 * v0.41 banks (stage 2 of the open-life redesign). Fictional banks; fictional rates and rules.
 *
 * - Open an account at a branch (₦500 fee, from cash). Deposit and withdraw at a branch; check the balance, transfer
 *   to your business accounts and repay loans from the phone.
 * - The account is its own ledger with unique keys (the same rule as the wallet: nothing is ever paid twice).
 * - Savings interest once a game day: 0.1% on up to ₦2,000,000 (at most ₦2,000 a day). It can't be farmed.
 * - Loans:
 *     personal  up to half of what you earned in the last 14 days (₦150,000 cap), 10% flat, 14 daily instalments
 *     secured   against a vehicle or a home you own (not already pledged): up to 60% of its value, 6% flat, 28 days
 *   One loan of each kind at a time; a pledged asset can't secure a second loan or be sold while pledged.
 *   A credit score (300–850) decides: steady income, a clean record, an older account and on-time repayments raise
 *   it; missed payments, defaults and open police cases lower it.
 * - Instalments are taken from the account once a day. Short? It's missed: a 5% late fee is added and your score
 *   drops. Three missed instalments in a row is a default: a secured loan's asset is repossessed and sold against
 *   the debt; an unsecured debt stays and the bank's collectors take up to one instalment a day from your cash until
 *   it is cleared. A defaulter can't borrow again until the debt is paid.
 * State (save.bank): { open, bank, openedDay, account: {balance, ledger, processed}, loans: [], score, history: [],
 *   seq, lastDay, pledged: { [assetKey]: loanId } }
 */
export const BANKS = [
 { id: 'nkwo', name: 'Nkwo Trust Bank', near: 'main-market', min: 140 },
 { id: 'bridgehead', name: 'Bridgehead Savings & Loans', near: 'upper-iweka', min: 200 },
];
export const BANK = {
 openFee: 500, interestRate: 0.001, interestCap: 2000000,
 personal: { rate: 0.10, days: 14, cap: 150000, incomeShare: 0.5, minScore: 450 },
 secured: { rate: 0.06, days: 28, ltv: 0.6, minScore: 400 },
 lateFee: 0.05, defaultAfter: 3, scoreMin: 300, scoreMax: 850, scoreStart: 520,
};
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r50 = (n) => Math.max(0, Math.round(n / 50) * 50);
export function newBank() { return { v: 1, open: false, bank: null, openedDay: null, account: { balance: 0, ledger: [], processed: [] }, loans: [], score: BANK.scoreStart, history: [], seq: 0, lastDay: null, pledged: {} }; }
export function ensureBank(raw) {
 const b = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : newBank();
 b.open = b.open === true; b.bank = BANKS.some((x) => x.id === b.bank) ? b.bank : null; if (!b.bank) b.open = false;
 b.account = b.account && typeof b.account === 'object' ? b.account : { balance: 0, ledger: [], processed: [] };
 b.account.balance = Number.isInteger(b.account.balance) && b.account.balance >= 0 ? b.account.balance : 0;
 b.loans = Array.isArray(b.loans) ? b.loans.filter((l) => l && typeof l.id === 'string' && Number.isInteger(l.total)) : [];
 b.score = clamp(Number.isFinite(b.score) ? Math.round(b.score) : BANK.scoreStart, BANK.scoreMin, BANK.scoreMax);
 b.history = Array.isArray(b.history) ? b.history.slice(-40) : []; b.seq = Number.isInteger(b.seq) ? b.seq : 0;
 b.pledged = b.pledged && typeof b.pledged === 'object' ? b.pledged : {}; b.v = 1; return b;
}
export class Bank {
 /** wallet = the cash Economy; ctx: { day: () => n, income14: () => naira earned in 14 days, legalClean: () => bool, assetValue: (key) => naira } */
 constructor(state, { wallet, bus = null, clock = null, ctx = {} } = {}) {
  this.s = ensureBank(state); this.wallet = wallet; this.bus = bus; this.ctx = ctx;
  this.account = new Economy(this.s.account, { clock });
 }
 get day() { return Math.floor(this.ctx.day?.() ?? 1); }
 note(text, d = 0) { this.s.history.push({ day: this.day, text, score: d }); if (this.s.history.length > 40) this.s.history.shift(); if (d) this.s.score = clamp(this.s.score + d, BANK.scoreMin, BANK.scoreMax); }
 get balance() { return this.s.account.balance; }
 open(bankId) {
  if (this.s.open) return { ok: false, error: 'You already have an account' };
  const bank = BANKS.find((b) => b.id === bankId); if (!bank) return { ok: false, error: 'Unknown bank' };
  const tx = this.wallet.transact({ key: `bank-open:${bankId}`, amount: -BANK.openFee, reason: `${bank.name}: account opening fee` });
  if (!tx.ok) return { ok: false, error: tx.error === 'insufficient-funds' ? `You need ${BANK.openFee} naira in cash` : tx.error };
  Object.assign(this.s, { open: true, bank: bankId, openedDay: this.day, lastDay: this.day }); this.note(`Opened an account at ${bank.name}`); return { ok: true };
 }
 /** Cash → account and back. Debit first, then credit: either both happen or neither does. */
 deposit(amount, key) { return this.move(this.wallet, this.account, amount, key ?? `dep:${++this.s.seq}`, 'Deposit'); }
 withdraw(amount, key) { return this.move(this.account, this.wallet, amount, key ?? `wd:${++this.s.seq}`, 'Withdrawal'); }
 move(from, to, amount, key, label) {
  if (!this.s.open) return { ok: false, error: 'Open an account first' };
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, error: 'Enter an amount' };
  const out = from.transact({ key: `${key}:out`, amount: -amount, reason: `${label}` }); if (!out.ok) return { ok: false, error: out.error === 'insufficient-funds' ? 'Not enough money' : out.error };
  const inn = to.transact({ key: `${key}:in`, amount, reason: `${label}` });
  if (!inn.ok) { from.transact({ key: `${key}:undo`, amount, reason: `${label} reversed` }); return { ok: false, error: inn.error }; }
  return { ok: true };
 }
 active() { return this.s.loans.filter((l) => l.status === 'active' || l.status === 'default'); }
 inDefault() { return this.s.loans.some((l) => l.status === 'default'); }
 /** What you could borrow today, and why not. assets = [{ key, label, value }] you own. */
 offers(assets = []) {
  const out = [], s = this.s, clean = this.ctx.legalClean?.() !== false, d = this.inDefault();
  const income = Math.max(0, Math.floor(this.ctx.income14?.() ?? 0)), P = BANK.personal, S = BANK.secured;
  const pAmt = r50(Math.min(P.cap, income * P.incomeShare)), hasP = this.active().some((l) => l.kind === 'personal');
  const pWhy = !s.open ? 'Open an account first' : d ? 'You have a loan in default' : hasP ? 'You already have a personal loan' : !clean ? 'Your police record is not clear' : s.score < P.minScore ? `Credit score ${s.score} (needs ${P.minScore})` : pAmt < 5000 ? 'Not enough recent income (earn more first)' : null;
  out.push({ kind: 'personal', label: 'Personal loan', max: pAmt, rate: P.rate, days: P.days, ok: !pWhy, why: pWhy });
  const hasS = this.active().some((l) => l.kind === 'secured');
  for (const a of assets) {
   const max = r50(a.value * S.ltv), pledged = !!s.pledged[a.key];
   const why = !s.open ? 'Open an account first' : d ? 'You have a loan in default' : hasS ? 'You already have a secured loan' : pledged ? 'Already pledged' : s.score < S.minScore ? `Credit score ${s.score} (needs ${S.minScore})` : max < 10000 ? 'Worth too little' : null;
   out.push({ kind: 'secured', label: `Loan against ${a.label}`, asset: a.key, assetLabel: a.label, value: a.value, max, rate: S.rate, days: S.days, ok: !why, why });
  }
  return out;
 }
 borrow(offer, amount) {
  if (!offer?.ok) return { ok: false, error: offer?.why ?? 'Not available' };
  amount = r50(amount); if (!(amount >= 5000 && amount <= offer.max)) return { ok: false, error: `Borrow between 5,000 and ${offer.max}` };
  if (offer.kind === 'secured' && this.s.pledged[offer.asset]) return { ok: false, error: 'Already pledged' };
  const id = `loan:${++this.s.seq}`, total = Math.round(amount * (1 + offer.rate)), per = Math.ceil(total / offer.days);
  const tx = this.account.transact({ key: `${id}:disburse`, amount, reason: `${offer.label}: ${amount} paid into your account` }); if (!tx.ok) return { ok: false, error: tx.error };
  const loan = { id, kind: offer.kind, label: offer.label, principal: amount, total, paid: 0, per, days: offer.days, startDay: this.day, lastDue: this.day, missed: 0, missedTotal: 0, status: 'active', ...(offer.asset ? { asset: offer.asset, assetLabel: offer.assetLabel, value: offer.value } : {}) };
  this.s.loans.push(loan); if (offer.asset) this.s.pledged[offer.asset] = id;
  this.note(`Borrowed ${amount} (${offer.label}); repay ${total} over ${offer.days} days`); this.bus?.emit('bank:loan', loan); return { ok: true, loan };
 }
 owed(l) { return Math.max(0, l.total - l.paid); }
 /** Pay something off a loan now, from the account. */
 repay(loanId, amount) {
  const l = this.s.loans.find((x) => x.id === loanId); if (!l || (l.status !== 'active' && l.status !== 'default')) return { ok: false, error: 'No such loan' };
  amount = Math.min(Math.floor(amount), this.owed(l)); if (!(amount > 0)) return { ok: false, error: 'Nothing to pay' };
  const tx = this.account.transact({ key: `${l.id}:pay:${++this.s.seq}`, amount: -amount, reason: `Repayment: ${l.label}` }); if (!tx.ok) return { ok: false, error: tx.error === 'insufficient-funds' ? 'Not enough in your account' : tx.error };
  l.paid += amount; this.settle(l); return { ok: true, owed: this.owed(l) };
 }
 settle(l) {
  if (this.owed(l) > 0) return;
  const wasDefault = l.status === 'default'; l.status = 'repaid'; if (l.asset) delete this.s.pledged[l.asset];
  this.note(`${l.label} repaid in full`, wasDefault ? 20 : l.missedTotal ? 15 : 35); this.bus?.emit('bank:repaid', l);
 }
 /**
  * Once a game day (catches up over missed days): interest, instalments, late fees, defaults, collection.
  * repossess(assetKey) → value recovered (the caller takes the asset away). Returns what happened.
  */
 newDay(day, { repossess = () => 0 } = {}) {
  const s = this.s, out = []; if (!s.open) { s.lastDay = day; return out; }
  const from = s.lastDay ?? day; s.lastDay = day;
  for (let d = from + 1; d <= day && d - from <= 30; d++) {
   const base = Math.min(this.balance, BANK.interestCap), interest = Math.floor(base * BANK.interestRate);
   if (interest > 0) this.account.transact({ key: `interest:${d}`, amount: interest, reason: 'Savings interest' });
   for (const l of s.loans.filter((x) => x.status === 'active')) {
    if (d <= l.lastDue) continue; l.lastDue = d;
    const due = Math.min(l.per, this.owed(l)); if (!due) continue;
    const tx = this.account.transact({ key: `${l.id}:due:${d}`, amount: -due, reason: `Loan instalment: ${l.label}` });
    if (tx.ok) { l.paid += due; l.missed = 0; this.note(`Instalment paid: ${l.label}`, 2); this.settle(l); }
    else {
     const fee = Math.round(due * BANK.lateFee); l.total += fee; l.missed++; l.missedTotal++; this.note(`Missed an instalment on ${l.label} (late fee ${fee})`, -25); out.push({ kind: 'missed', loan: l, fee });
     if (l.missed >= BANK.defaultAfter) {
      l.status = 'default'; this.note(`${l.label} is in default`, -120); out.push({ kind: 'default', loan: l });
      if (l.asset) { const got = Math.max(0, Math.floor(repossess(l.asset) ?? 0)); delete s.pledged[l.asset]; l.paid = Math.min(l.total, l.paid + got); l.repossessed = true; out.push({ kind: 'repossessed', loan: l, recovered: got }); if (this.owed(l) <= 0) this.settle(l); }
     }
    }
   }
   // collectors: a debt in default takes up to one instalment a day from the account, then from cash
   for (const l of s.loans.filter((x) => x.status === 'default')) {
    let want = Math.min(l.per, this.owed(l));
    const a = Math.min(want, this.balance); if (a > 0 && this.account.transact({ key: `${l.id}:collect-acc:${d}`, amount: -a, reason: `Debt collection: ${l.label}` }).ok) { l.paid += a; want -= a; }
    const c = Math.min(want, this.wallet.balance); if (c > 0 && this.wallet.transact({ key: `${l.id}:collect-cash:${d}`, amount: -c, reason: `Debt collectors: ${l.label}` }).ok) { l.paid += c; want -= c; out.push({ kind: 'collected', loan: l, amount: c }); }
    this.settle(l);
   }
  }
  return out;
 }
 /** Credit history influences the score slowly: steady income and a clean record help; an open case hurts. */
 review() { const inc = this.ctx.income14?.() ?? 0, clean = this.ctx.legalClean?.() !== false; const target = 480 + Math.min(200, inc / 2500) + (clean ? 40 : -80) + Math.min(60, (this.day - (this.s.openedDay ?? this.day)) * 2); this.s.score = clamp(Math.round(this.s.score + (target - this.s.score) * 0.1), BANK.scoreMin, BANK.scoreMax); }
}
