import { ITEMS } from '../data/catalogue.js';

/*
  Wholesale and supply orders (Milestone 7 business). Game rules and game prices:
  - The wholesaler by Main Market sells goods in bulk lots at under half the retail price per piece.
    Each lot can be bought a few times a day. A lot is one Economy.transact; the pieces go into the bag
    (all-or-nothing: bag space is checked before any money moves).
  - Traders also buy those pieces off you (their usual buy-back price, which improves as they know you),
    so buying wholesale and selling round the market is a small, honest margin.
  - Supply orders: every day a few traders post orders at the depot — N pieces by an hour, at a better
    price than buy-back. Accept one, then bring the goods and talk to the trader; they pay on delivery
    (one Economy.transact keyed on the order). Miss the time and the order lapses (and they remember).
  State in the save (wholesale): { bought: {[day:lotId]: count}, orders: [order], done: [orderId] }
*/
export const WHOLESALE_LOTS = [
  { id: 'w-ankara', item: 'ankara-6y', qty: 10, share: 0.45, goods: 'fabrics' },
  { id: 'w-thread', item: 'thread', qty: 20, share: 0.42, goods: 'fabrics' },
  { id: 'w-sugar', item: 'sugar', qty: 20, share: 0.44, goods: 'provisions' },
  { id: 'w-malt', item: 'malt', qty: 24, share: 0.45, goods: 'provisions' },
  { id: 'w-recharge', item: 'recharge', qty: 40, share: 0.46, goods: 'phones & accessories' },
  { id: 'w-slippers', item: 'slippers', qty: 12, share: 0.43, goods: 'shoes & bags' },
  { id: 'w-rice', item: 'rice-mudu', qty: 10, share: 0.45, goods: 'foodstuff' },
  { id: 'w-palm-oil', item: 'palm-oil', qty: 12, share: 0.45, goods: 'foodstuff' },
  { id: 'w-bulbs', item: 'bulb', qty: 24, share: 0.42, goods: 'electricals' },
];
export const WHOLESALE = { perLotPerDay: 3, ordersPerDay: 4, orderShare: 0.68, orderClose: 18.5 };

const r50 = (n) => Math.round(n / 50) * 50;
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

export function lotPrice(lot) { return r50(ITEMS[lot.item].price * lot.qty * lot.share); }

export class Wholesale {
  /** traders: resident traders [{id, name, goods, x, z}] */
  constructor(state, { economy, inventory, traders, bus = null }) {
    state.bought ??= {}; state.orders ??= []; state.done ??= [];
    this.state = state; this.economy = economy; this.inventory = inventory; this.traders = traders; this.bus = bus;
  }

  left(lot, day) { return WHOLESALE.perLotPerDay - (this.state.bought[`${day}:${lot.id}`] ?? 0); }

  /** Buy one lot. All-or-nothing. */
  buy(lotId, day) {
    const lot = WHOLESALE_LOTS.find((l) => l.id === lotId); if (!lot) return { ok: false, error: 'no-lot' };
    if (this.left(lot, day) <= 0) return { ok: false, error: 'sold-out' };
    const item = ITEMS[lot.item];
    if (!this.inventory.canAdd(item, lot.qty)) return { ok: false, error: 'bag-full' };
    const n = (this.state.bought[`${day}:${lot.id}`] ?? 0) + 1;
    const price = lotPrice(lot);
    const tx = this.economy.transact({ key: `wholesale:${day}:${lot.id}:${n}`, amount: -price, reason: `Wholesale: ${lot.qty} × ${item.name}`, ref: { lot: lot.id } });
    if (!tx.ok) return { ok: false, error: tx.error, price };
    this.inventory.add(item, lot.qty);
    this.state.bought[`${day}:${lot.id}`] = n;
    // forget old days
    for (const k of Object.keys(this.state.bought)) if (+k.split(':')[0] < day - 1) delete this.state.bought[k];
    return { ok: true, price, lot, balance: tx.balance };
  }

  /** Today's posted orders (not yet taken or done), deterministic for the day. */
  board(day, isOpen = () => true) {
    const out = [];
    const cands = this.traders.filter((t) => WHOLESALE_LOTS.some((l) => l.goods === t.goods));
    if (!cands.length) return out;
    for (let k = 0; k < WHOLESALE.ordersPerDay * 3 && out.length < WHOLESALE.ordersPerDay; k++) {
      const h = hash(`order:${day}:${k}`);
      const t = cands[h % cands.length];
      if (!isOpen(t) || out.some((o) => o.trader === t.id)) continue;
      const lots = WHOLESALE_LOTS.filter((l) => l.goods === t.goods);
      const lot = lots[(h >>> 8) % lots.length];
      const id = `order:${day}:${t.id}`;
      if (this.state.done.includes(id) || this.state.orders.some((o) => o.id === id)) continue;
      const qty = Math.max(3, Math.round(lot.qty * (0.4 + ((h >>> 16) % 50) / 100)));
      const unit = r50(ITEMS[lot.item].price * WHOLESALE.orderShare);
      out.push({ id, day, trader: t.id, traderName: t.name, item: lot.item, itemName: ITEMS[lot.item].name, qty, unit, total: unit * qty, due: day * 1440 + Math.round(WHOLESALE.orderClose * 60) });
    }
    return out;
  }

  accept(order) {
    if (this.state.orders.some((o) => o.id === order.id) || this.state.done.includes(order.id)) return { ok: false, error: 'taken' };
    if (this.state.orders.length >= 3) return { ok: false, error: 'too-many' };
    this.state.orders.push({ ...order });
    return { ok: true };
  }

  /** Orders for this trader that you're carrying out. */
  ordersFor(traderId) { return this.state.orders.filter((o) => o.trader === traderId); }

  /** Hand the goods over; paid once (keyed on the order). */
  deliver(orderId, now) {
    const o = this.state.orders.find((x) => x.id === orderId); if (!o) return { ok: false, error: 'no-order' };
    if (now > o.due) return { ok: false, error: 'expired' };
    if (!this.inventory.has(o.item, o.qty)) return { ok: false, error: 'missing-item', have: this.inventory.count(o.item) };
    const tx = this.economy.transact({ key: `supply:${o.id}`, amount: o.total, reason: `Supply order: ${o.qty} × ${o.itemName} for ${o.traderName}`, ref: { order: o.id } });
    if (!tx.ok) return { ok: false, error: tx.error };
    this.inventory.remove(o.item, o.qty);
    this.state.orders = this.state.orders.filter((x) => x !== o);
    this.state.done.push(o.id); if (this.state.done.length > 200) this.state.done.splice(0, this.state.done.length - 200);
    this.bus?.emit('supply:delivered', o);
    return { ok: true, paid: o.total, order: o, balance: tx.balance };
  }

  /** Orders past their time lapse. Returns them. */
  expire(now) {
    const late = this.state.orders.filter((o) => now > o.due);
    if (late.length) { this.state.orders = this.state.orders.filter((o) => now <= o.due); for (const o of late) this.state.done.push(o.id); }
    return late;
  }
}
