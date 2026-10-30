import { ITEMS, NEEDS_COOKING } from '../data/catalogue.js';

/**
 * Energy (0–100). It runs down slowly over the day and quickly while running; sitting in a keke or
 * bus lets you rest a little. When it is low you can't run at full speed. Eating and drinking from the
 * bag brings it back up. Rates are per real second (the game clock runs 1 minute per second).
 * State in the save: { energy }.
 */
export const NEEDS = {
  base: 0.065,       // ~ one game day from full to empty when idle
  walk: 0.02,
  run: 0.17,         // extra while running
  rest: 0.11,        // recovered while seated in transport (net of the base drain)
  low: 25,
};

export const NEED_DEFAULTS = { hunger: 80, energy: 85, fun: 75, social: 75, hygiene: 90, bladder: 90 };
export const NEED_LABELS = { hunger: 'Hunger', energy: 'Energy', fun: 'Fun', social: 'Social', hygiene: 'Hygiene', bladder: 'Bladder' };
const clamp = v => Math.max(0, Math.min(100, v));
export class Needs {
  constructor(state, { bus = null } = {}) {
    this.state = state; this.bus = bus;
    for (const [id, value] of Object.entries(NEED_DEFAULTS)) state[id] = clamp(Number.isFinite(state[id]) ? state[id] : value);
    this.warned = state.energy < NEEDS.low;
  }
  get energy() { return this.state.energy; }

  update(dt, { moving = false, running = false, riding = false } = {}) {
    if (!Number.isFinite(dt) || dt <= 0) return;
    for (const [id, rate] of Object.entries({ hunger: 0.075, fun: 0.045, social: 0.035, hygiene: running ? 0.075 : 0.035, bladder: 0.085 })) this.state[id] = clamp(this.state[id] - rate * dt);
    let d = -NEEDS.base;
    if (riding) d += NEEDS.rest;
    else if (running) d -= NEEDS.run;
    else if (moving) d -= NEEDS.walk;
    const before = this.state.energy;
    this.state.energy = Math.max(0, Math.min(100, before + d * dt));
    if (!this.warned && this.state.energy < NEEDS.low) { this.warned = true; this.bus?.emit('needs:low', this.state.energy); }
    if (this.state.energy > NEEDS.low + 10) this.warned = false;
  }

  adjust(changes) { for (const [id, amount] of Object.entries(changes)) if (id in NEED_DEFAULTS && Number.isFinite(amount)) this.state[id] = clamp(this.state[id] + amount); this.bus?.emit('needs:changed',this.values); }
  get values() { return { ...this.state }; }
  get mood() { const values = Object.keys(NEED_DEFAULTS).map(id => this.state[id]); return values.some(v => v < 15) ? 'Uncomfortable' : values.every(v => v >= 60) ? 'Feeling good' : 'Okay'; }

  /** Multiplier on running speed: full above the low mark, down to walking pace when empty. */
  runFactor() { const e = this.state.energy; return e >= NEEDS.low ? 1 : 0.4 + 0.6 * (e / NEEDS.low); }

  label() { const e = this.state.energy; return e >= 80 ? 'Full of energy' : e >= 45 ? 'Okay' : e >= NEEDS.low ? 'Getting tired' : e >= 8 ? 'Tired — can’t run well' : 'Exhausted'; }

  /** What using this bag item would do: {verb, energy?, open?} or {verb:null, why}. */
  static useInfo(itemId) {
    const it = ITEMS[itemId];
    if (it?.use?.verb) return it.use;
    if (it?.use) return { verb: null, why: it.use.why ?? null };
    if (NEEDS_COOKING.has(itemId)) return { verb: null, why: 'Needs cooking — use the stove in a home you rent.' };
    return { verb: null, why: null };
  }

  /** Eat / drink / open one item from the inventory. All-or-nothing. */
  use(inventory, itemId) {
    const info = Needs.useInfo(itemId);
    if (!info.verb) return { ok: false, error: 'not-usable', why: info.why };
    if (!inventory.has(itemId)) return { ok: false, error: 'missing-item' };
    if (info.open) {
      const into = ITEMS[info.open.into];
      if (!inventory.canAdd(into, info.open.qty) && inventory.items.find((i) => i.id === itemId)?.qty > 1) return { ok: false, error: 'bag-full' };
      inventory.remove(itemId, 1);
      inventory.add(into, info.open.qty);
      return { ok: true, opened: true, into, qty: info.open.qty };
    }
    if (this.state.energy >= 99.5 && this.state.hunger >= 99.5) return { ok: false, error: 'full' };
    inventory.remove(itemId, 1);
    const before = this.state.energy;
    this.state.energy = clamp(before + (info.energy ?? 0));
    this.adjust({ hunger: info.hunger ?? (info.verb === 'Eat' ? (info.energy ?? 15) : 2), bladder: info.verb === 'Drink' ? -6 : 0 });
    if (this.state.energy > NEEDS.low + 10) this.warned = false;
    return { ok: true, gained: Math.round(this.state.energy - before), energy: this.state.energy, item: ITEMS[itemId], verb: info.verb };
  }
}
