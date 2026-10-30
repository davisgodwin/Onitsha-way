import { CATALOGUE } from '../data/catalogue.js';

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Traders' stock. Each trader starts the day with a limited quantity of each item (cheap things
 * plenty, expensive things only one or two), from their identity and the day, and restocks the
 * next morning. What you buy runs the stock down; what you sell them adds to it.
 * Only traders you have dealt with today are stored in the save: { [traderId]: {day, q:{itemId: n}} }.
 */
export class StockBook {
  constructor(state) { this.state = state; }

  static opening(traderId, goods, day) {
    const r = rngFrom(hash(`${traderId}:stock:${day}`));
    const q = {};
    for (const it of CATALOGUE[goods] ?? []) {
      const [lo, hi] = goods === 'hawker' ? [8, 30] : it.price <= 1000 ? [5, 16] : it.price <= 5000 ? [2, 8] : it.price <= 15000 ? [1, 4] : [0, 3];
      q[it.id] = lo + Math.floor(r() * (hi - lo + 1));
    }
    return q;
  }

  /** The live stock object for a trader today (mutated by purchases and sales). */
  forTrader(trader, day) {
    const goods = trader.role === 'hawker' ? 'hawker' : trader.goods;
    let e = this.state[trader.id];
    if (!e || e.day !== day) { e = this.state[trader.id] = { day, q: StockBook.opening(trader.id, goods, day) }; this.prune(day); }
    return e.q;
  }

  prune(day) {
    for (const [k, e] of Object.entries(this.state)) if (e.day < day) delete this.state[k];
  }
}
