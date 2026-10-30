/**
 * The one authoritative money service. Every naira that enters or leaves the player's wallet goes
 * through `transact()` — shops, jobs, transport fares (M5) and rent (M6) never touch the balance directly.
 *
 * Rules
 *  - Amounts are whole naira (integers). Credits are positive, debits negative.
 *  - A debit that would make the balance negative is refused; nothing changes (no partial payments).
 *  - Every transaction has an idempotency key. Replaying the same key (double click, repeated event,
 *    reloaded save) is refused, so a purchase or reward can never be applied twice.
 *  - Successful transactions are written to a ledger and announced on the event bus.
 *
 * State lives in the save file: { balance, ledger: [...], processed: [...] }.
 */
export const LEDGER_LIMIT = 120;
export const PROCESSED_LIMIT = 600;

export class Economy {
  /** v0.43: called after every successful transaction in any ledger, with (ledger state, entry). */
  static observer = null;
  constructor(state, { bus = null, clock = null } = {}) {
    this.state = state;
    state.balance = Number.isInteger(state.balance) ? state.balance : 0;
    state.ledger ??= [];
    state.processed ??= [];
    this.processed = new Set(state.processed);
    this.bus = bus; this.clock = clock;
  }

  get balance() { return this.state.balance; }
  canAfford(amount) { return Number.isInteger(amount) && amount >= 0 && this.state.balance >= amount; }
  hasProcessed(key) { return this.processed.has(key); }

  /**
   * @param {{key:string, amount:number, reason:string, ref?:object}} tx
   * @returns {{ok:true, balance:number, entry:object} | {ok:false, error:string, balance:number}}
   */
  transact({ key, amount, reason, ref = null }) {
    const fail = (error) => ({ ok: false, error, balance: this.state.balance });
    if (typeof key !== 'string' || !key) return fail('missing-key');
    if (!Number.isInteger(amount) || amount === 0) return fail('invalid-amount');
    if (Math.abs(amount) > 100_000_000) return fail('invalid-amount');
    if (this.processed.has(key)) return fail('duplicate');
    const next = this.state.balance + amount;
    if (next < 0) return fail('insufficient-funds');
    // commit (single assignment — there is no intermediate state to roll back)
    const entry = {
      key, amount, reason, balance: next, ref,
      day: this.clock?.day ?? null, minutes: this.clock ? Math.round(this.clock.minutes) : null,
    };
    this.state.balance = next;
    this.state.ledger.push(entry);
    if (this.state.ledger.length > LEDGER_LIMIT) this.state.ledger.splice(0, this.state.ledger.length - LEDGER_LIMIT);
    this.processed.add(key);
    this.state.processed.push(key);
    if (this.state.processed.length > PROCESSED_LIMIT) {
      const drop = this.state.processed.splice(0, this.state.processed.length - PROCESSED_LIMIT);
      // keep the in-memory set in sync (old keys can no longer collide with new unique keys)
      for (const k of drop) this.processed.delete(k);
    }
    this.bus?.emit('wallet:changed', { balance: next, entry });
    Economy.observer?.(this.state, entry); // v0.43: the account server hears about every transaction (src/authority)
    return { ok: true, balance: next, entry };
  }
}

/** ₦12,500 */
export const naira = (n) => '₦' + Math.round(n).toLocaleString('en-NG');
