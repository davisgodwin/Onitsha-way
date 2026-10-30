import { CATALOGUE, ITEMS, ECONOMY_CONFIG } from '../data/catalogue.js';

const r50 = (n) => Math.max(50, Math.round(n / 50) * 50);

function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * One visit to a trader's shop: asking prices, bargaining, buying and selling.
 * Pure logic — the UI renders what this returns. Money moves only through Economy.transact().
 * `stock` is the trader's stock for today ({itemId: qty}, see StockBook); without it stock is unlimited.
 */
export class ShopSession {
  /**
   * @param {object} o
   * @param {{id:string, goods:string, role:string}} o.trader
   * @param {{familiarity:number}} o.rel
   */
  constructor({ trader, rel, economy, inventory, visit = Date.now(), stock = null, discount = 0 }) {
    this.discount = discount;                   // reputation (M7): a known face pays a little less
    this.trader = trader; this.rel = rel; this.economy = economy; this.inventory = inventory;
    this.goods = trader.role === 'hawker' ? 'hawker' : trader.goods;
    this.items = CATALOGUE[this.goods] ?? CATALOGUE.provisions;
    const r = rngFrom(hash(trader.id));
    this.markup = 0.08 + r() * 0.27;            // each trader prices a little differently
    this.firmness = 0.3 + r() * 0.5;            // how hard they bargain
    this.visit = visit; this.seq = 0;
    this.offers = new Map();                    // itemId -> {asking, rounds, insulted}
    this.stock = stock;
  }

  fam() { return Math.min(8, this.rel?.familiarity ?? 0); }
  left(itemId) { return this.stock ? (this.stock[itemId] ?? 0) : Infinity; }

  asking(item) {
    if (!this.offers.has(item.id)) this.offers.set(item.id, { asking: this.goods === 'hawker' ? item.price : r50(item.price * (1 + this.markup) * (1 - this.discount)), rounds: 0, insulted: false });
    return this.offers.get(item.id).asking;
  }
  floor(item) {
    if (this.goods === 'hawker') return item.price;
    return r50(Math.max(item.price * 0.82, item.price * (0.97 - this.fam() * 0.018)) * (1 - Math.max(0, this.discount)));
  }

  /** "Kpaa ife" — ask for a small reduction. Up to two rounds; never below the floor. */
  haggle(itemId) {
    const item = this.items.find((i) => i.id === itemId); if (!item) return { ok: false, error: 'no-item' };
    const o = this.offers.get(itemId) ?? (this.asking(item), this.offers.get(itemId));
    const floor = this.floor(item);
    if (this.goods === 'hawker') return { ok: true, price: o.asking, moved: false, reply: 'fixed' };
    if (o.rounds >= 2 || o.asking <= floor) return { ok: true, price: o.asking, moved: false, reply: 'final' };
    o.rounds++;
    const cut = 0.05 + (1 - this.firmness) * 0.07 + this.fam() * 0.008;
    o.asking = Math.max(floor, r50(o.asking * (1 - cut)));
    return { ok: true, price: o.asking, moved: true, reply: o.asking <= floor ? 'floor' : 'reduced' };
  }

  /** Offer about half. Traders treat it as an insult ("Inye iru evi") and stop reducing for this item. */
  lowball(itemId) {
    const item = this.items.find((i) => i.id === itemId); if (!item) return { ok: false, error: 'no-item' };
    const o = this.offers.get(itemId) ?? (this.asking(item), this.offers.get(itemId));
    o.insulted = true; o.rounds = 2;
    return { ok: true, price: o.asking, insulted: true, offer: r50(o.asking * 0.5) };
  }

  /** Buy at the current agreed price. All-or-nothing: stock and bag space are checked before any money moves. */
  buy(itemId, qty = 1) {
    const item = this.items.find((i) => i.id === itemId); if (!item) return { ok: false, error: 'no-item' };
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { ok: false, error: 'invalid-qty' };
    if (this.left(itemId) < qty) return { ok: false, error: 'sold-out' };
    const unit = this.asking(item), total = unit * qty;
    if (!this.inventory.canAdd(item, qty)) return { ok: false, error: 'bag-full' };
    if (!this.economy.canAfford(total)) return { ok: false, error: 'insufficient-funds', total };
    const key = `buy:${this.trader.id}:${item.id}:${this.visit}:${this.seq++}`;
    const tx = this.economy.transact({ key, amount: -total, reason: `Bought ${qty} × ${item.name} from ${this.trader.name}`, ref: { trader: this.trader.id, item: item.id, qty, unit } });
    if (!tx.ok) return { ok: false, error: tx.error, total };
    const added = this.inventory.add(item, qty);
    if (!added.ok) { // cannot normally happen (checked above) — refund so money is never lost
      this.economy.transact({ key: key + ':refund', amount: total, reason: `Refund: ${item.name}` });
      return { ok: false, error: added.error };
    }
    if (this.stock) this.stock[itemId] -= qty;
    return { ok: true, total, unit, item, balance: tx.balance, left: this.left(itemId) };
  }

  // ---------------------------------------------------------------- selling to the trader
  /** Does this trader buy that item? Only goods of their own line; hawkers buy nothing. */
  buys(itemId) { return this.goods !== 'hawker' && this.items.some((i) => i.id === itemId); }

  /** What the trader pays for one. Always below what they sell it for, so there is no buy-sell loop. */
  sellPrice(itemId) {
    const item = ITEMS[itemId]; if (!item) return 0;
    const C = ECONOMY_CONFIG;
    const share = Math.min(C.sellShareMax, C.sellShare + this.fam() * C.sellSharePerFamiliarity);
    return Math.min(r50(item.price * share), this.floor(item) - 50);
  }

  /** Things in the bag this trader would buy: [{id, name, qty, price}] */
  sellable() {
    return this.inventory.items.filter((it) => !it.unique && it.kind !== 'package' && this.buys(it.id))
      .map((it) => ({ id: it.id, name: it.name, qty: it.qty, price: this.sellPrice(it.id) }));
  }

  /** Sell one item: removes it from the bag and credits the wallet once. */
  sell(itemId) {
    if (!this.buys(itemId)) return { ok: false, error: 'not-buying' };
    if (!this.inventory.has(itemId)) return { ok: false, error: 'missing-item' };
    const inv = this.inventory.items.find((i) => i.id === itemId);
    if (inv.unique || inv.kind === 'package') return { ok: false, error: 'not-buying' };
    const price = this.sellPrice(itemId);
    if (price <= 0) return { ok: false, error: 'not-buying' };
    const key = `sell:${this.trader.id}:${itemId}:${this.visit}:${this.seq++}`;
    const tx = this.economy.transact({ key, amount: price, reason: `Sold ${ITEMS[itemId].name} to ${this.trader.name}`, ref: { trader: this.trader.id, item: itemId } });
    if (!tx.ok) return { ok: false, error: tx.error };
    this.inventory.remove(itemId, 1);
    if (this.stock) this.stock[itemId] = (this.stock[itemId] ?? 0) + 1;
    return { ok: true, price, item: ITEMS[itemId], balance: tx.balance };
  }
}
