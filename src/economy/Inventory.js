/**
 * The player's bag. Stackable goods by item id plus unique job packages.
 * State lives in the save: { slots, items: [{id, name, qty, kind, meta?}] }.
 */
export class Inventory {
  constructor(state, { bus = null } = {}) {
    this.state = state;
    state.items ??= [];
    state.slots ??= 16;
    this.bus = bus;
  }
  get items() { return this.state.items; }
  get slotsUsed() { return this.state.items.length; }
  count(id) { return this.state.items.filter((i) => i.id === id).reduce((s, i) => s + i.qty, 0); }
  has(id, qty = 1) { return this.count(id) >= qty; }

  /** Would adding `qty` of this item fit? (stackable items share one slot) */
  canAdd(item, qty = 1) {
    if (!item || typeof item.id !== 'string' || !item.id || !Number.isSafeInteger(qty) || qty <= 0 || (item.unique && qty !== 1)) return false;
    if (!item.unique && this.state.items.some((i) => i.id === item.id)) return true;
    return this.state.items.length < this.state.slots;
  }

  add(item, qty = 1) {
    if (!this.canAdd(item, qty)) return { ok: false, error: 'bag-full' };
    const existing = !item.unique && this.state.items.find((i) => i.id === item.id);
    if (existing) existing.qty += qty;
    else this.state.items.push({ id: item.id, name: item.name, qty, kind: item.kind ?? 'goods', meta: item.meta ?? null, unique: !!item.unique });
    this.bus?.emit('inventory:changed', { id: item.id });
    return { ok: true };
  }

  remove(id, qty = 1) {
    if (!Number.isSafeInteger(qty) || qty <= 0) return { ok: false, error: 'invalid-qty' };
    if (!this.has(id, qty)) return { ok: false, error: 'missing-item' };
    let left = qty;
    for (const it of [...this.state.items]) {
      if (it.id !== id || left <= 0) continue;
      const take = Math.min(it.qty, left);
      it.qty -= take; left -= take;
      if (it.qty <= 0) this.state.items.splice(this.state.items.indexOf(it), 1);
    }
    this.bus?.emit('inventory:changed', { id });
    return { ok: true };
  }
}
