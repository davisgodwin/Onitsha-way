import { GOOD_BY_ID, HOME_GOODS, deliveryFee } from '../buy/Goods.js';
import { naira } from '../economy/Economy.js';

/*
  v0.48: decorating another player's home, online.
  1. The owner, inside their home, hires a friend (Messages → the friend → "Hire to decorate"): a budget for the
     furniture and a fee for the work. The friend accepts the invitation and arrives inside the owner's home.
  2. The decorator walks round, then opens the job (E near the middle of the room): they pick pieces from the
     furniture catalogue that fit the budget and send them as a suggestion.
  3. The owner's game shows the suggestion. Accept: the owner's game buys the pieces from the owner's money and
     places them in free spots (the owner can move them later); the decorator sees them appear. Decline: nothing.
  4. When the decorator finishes, the owner is asked to pay the fee (a normal player-to-player payment).
  The owner's money and save are only changed on the owner's own device, after the owner says yes.
*/
const BUDGETS = [50000, 150000, 400000, 1000000], FEES = [5000, 15000, 40000];
const CATS = { living: 'Living room', bedroom: 'Bedroom', lighting: 'Lighting', walldecor: 'Wall decor', textiles: 'Rugs & curtains', kitchen: 'Kitchen', bathroom: 'Bathroom', electronics: 'Electronics', hobbies: 'Hobbies' };
export const pieceCost = (id, qty = 1) => { const gd = GOOD_BY_ID[id]; return gd ? (gd.price + deliveryFee(gd.price)) * qty : 0; };
export function proposalCost(items) { return items.reduce((a, i) => a + pieceCost(i.id, i.qty ?? 1), 0); }

export class DecorJobs {
  constructor(online) {
    this.o = online; this.g = online.g; this.job = null; this.hosting = null; this.basket = [];
    const g = this.g;
    // the decorator's job board: near the middle of the room they are decorating
    g.interactions.register({
      get x() { const i = g.homes?.inside; return i ? i.layout.origin.x + i.layout.size[0] / 2 : 1e9; },
      get z() { const i = g.homes?.inside; return i ? i.layout.origin.z + i.layout.size[1] / 2 : 1e9; },
      radius: 6, priority: 1, enabled: () => !!this.job && !!this.o.guestHost && !!g.homes?.inside,
      label: () => `Decorating for ${this.job.hostName} · ${naira(this.job.left)} left`, onInteract: () => g.openChoice(() => this.jobView()),
    });
  }
  // ---------------------------------------------------------------- the owner
  hireView(peer) {
    const g = this.g, pick = { budget: BUDGETS[1], fee: FEES[1] };
    const view = () => ({ title: `Hire @${peer.username} to decorate`, text: `They come into your home and suggest furniture. Nothing is bought until you accept a suggestion. Budget ${naira(pick.budget)} · their fee ${naira(pick.fee)} (you pay when they finish).`,
      options: [...BUDGETS.map((b) => ({ label: `Budget ${naira(b)}`, sub: b === pick.budget ? 'Selected' : '', act: () => { pick.budget = b; g.openChoice(view); } })), ...FEES.map((f) => ({ label: `Fee ${naira(f)}`, sub: f === pick.fee ? 'Selected' : '', act: () => { pick.fee = f; g.openChoice(view); } })),
        { label: 'Send the job offer', act: async () => { g.closeChoice(); try { await this.o.request('request', { target: peer.id, kind: 'decorate', budget: pick.budget, fee: pick.fee }); this.o.notice(`Job offer sent to @${peer.username}.`); } catch (e) { this.o.notice(e.message); } } },
        { label: 'Cancel', ghost: true, act: () => g.closeChoice() }] });
    return view();
  }
  receive(m) {
    const g = this.g;
    if (m.type === 'decorStart') { this.hosting = { job: m.job, decorator: m.decorator, name: m.name, budget: m.budget, fee: m.fee, spent: 0 }; this.o.notice(`${m.name} is on the way in to decorate. You'll see their suggestions here.`); return true; }
    if (m.type === 'decorProposal') { g.openChoice(() => this.proposalView(m)); return true; }
    if (m.type === 'decorFinished') { g.openChoice(() => this.finishView(m)); return true; }
    if (m.type === 'decorAnswer') { if (this.job) { this.job.left = m.left; this.o.notice(m.accepted ? `${this.job.hostName} accepted: ${naira(m.spent)} spent, ${naira(m.left)} left.` : `${this.job.hostName} said no to that one${m.note ? ': ' + m.note : '.'}`); } return true; }
    return false;
  }
  proposalView(m) {
    const g = this.g, total = proposalCost(m.items), inside = g.homes?.inside && !g.homes.inside.viewing && !this.o.guestHost;
    const lines = m.items.map((i) => `${GOOD_BY_ID[i.id]?.label ?? i.id}${i.qty > 1 ? ' ×' + i.qty : ''} · ${naira(pieceCost(i.id, i.qty))}`).join('\n');
    return { title: `${m.name} suggests`, text: `${lines}\n\nTotal ${naira(total)} (with delivery).${m.note ? '\n“' + m.note + '”' : ''}`,
      options: [
        { label: `Accept and pay ${naira(total)}`, disabled: !inside || !g.economy.canAfford(total), why: !inside ? 'Be inside your home' : 'Not enough money', act: () => { const r = this.apply(m.items); g.closeChoice(); this.o.request('decorAnswer', { to: m.from, accepted: r.spent > 0, spent: r.spent, note: r.note }).catch(() => {}); this.o.notice(r.spent ? `Bought and placed ${r.placed} piece(s). Move them any time with Buy.` : r.note); } },
        { label: 'No thanks', ghost: true, act: () => { g.closeChoice(); this.o.request('decorAnswer', { to: m.from, accepted: false, spent: 0, note: 'not this one' }).catch(() => {}); } }] };
  }
  /** Buy the pieces from the owner's money and put each in a free spot in the room. */
  apply(items) {
    const g = this.g, i = g.homes.inside; let spent = 0, placed = 0, note = '';
    for (const it of items) for (let k = 0; k < (it.qty ?? 1); k++) {
      const gd = GOOD_BY_ID[it.id]; if (!gd) continue;
      const r = g.homeUpgrades.buy(i.home.id, it.id, { fee: deliveryFee(gd.price), via: 'order' }); if (!r.ok) { note = r.error === 'funds' ? 'Not enough money for all of it.' : 'Some pieces could not be bought.'; break; }
      spent += gd.price + deliveryFee(gd.price);
      const spot = g.homes.decor?.findSpot(it.id, r.piece.pid, { player: false });
      if (spot && g.homeUpgrades.place(i.home.id, r.piece.pid, { x: spot.x, z: spot.z, rotation: spot.rotation ?? 0, floor: i.layout.id }).ok) placed++;
    }
    g.homes.refreshDecor(); g.homes.applyLight?.(); g.saveGame();
    if (this.hosting) this.hosting.spent += spent;
    return { spent, placed, note: note || (placed ? '' : 'No free spot for that piece: it is in your storage.') };
  }
  finishView(m) {
    const g = this.g;
    return { title: `${m.name} has finished`, text: `${m.picks} suggestion(s) accepted, ${naira(m.spent)} spent on furniture. Their fee: ${naira(m.fee)}.`,
      options: [
        ...(m.fee > 0 ? [{ label: `Pay ${m.name} ${naira(m.fee)}`, act: async () => { g.closeChoice(); try { const r = await this.o.request('pay', { target: m.from, amount: m.fee }); await g.authority?.sync(); this.o.notice(`You paid ${r.name} ${naira(r.amount)}.`); } catch (e) { this.o.notice(e.message); } } }] : []),
        { label: 'Thank them', ghost: true, act: () => { g.closeChoice(); this.hosting = null; } }] };
  }
  // ---------------------------------------------------------------- the decorator
  startJob(d) { this.job = { ...d, left: d.budget }; this.basket = []; this.o.notice(`You're decorating for ${d.hostName}: ${naira(d.budget)} budget, ${naira(d.fee)} fee. Press E in the middle of the room to choose furniture.`); }
  endJob() { this.job = null; this.basket = []; }
  jobView(cat = null) {
    const g = this.g, j = this.job, used = proposalCost(this.basket), left = j.left - used;
    if (!cat) return { title: `Decorating for ${j.hostName}`, text: `Budget left ${naira(j.left)}. In your suggestion: ${this.basket.length ? this.basket.map((b) => GOOD_BY_ID[b.id].label).join(', ') + ` (${naira(used)})` : 'nothing yet'}.`,
      options: [...Object.entries(CATS).map(([k, label]) => ({ label, act: () => g.openChoice(() => this.jobView(k)) })),
        { label: `Send suggestion (${this.basket.length})`, disabled: !this.basket.length, why: 'Choose some pieces first', act: async () => { const items = this.basket.slice(0, 6); g.closeChoice(); try { const r = await this.o.request('decorPropose', { items, estimate: proposalCost(items) }); this.basket = []; this.o.notice(r.message); } catch (e) { this.o.notice(e.message); } } },
        { label: 'Clear my suggestion', ghost: true, disabled: !this.basket.length, act: () => { this.basket = []; g.openChoice(() => this.jobView()); } },
        { label: 'Finish the job', act: async () => { g.closeChoice(); try { const r = await this.o.request('decorFinish'); this.o.notice(r.message); } catch (e) { this.o.notice(e.message); } } },
        { label: 'Close', ghost: true, act: () => g.closeChoice() }] };
    const list = HOME_GOODS.filter((x) => (x.category === cat || x.tab === cat) && !x.fixed && x.price > 0).sort((a, b) => a.price - b.price).slice(0, 24);
    return { title: CATS[cat], text: `Budget left ${naira(left)}.`, options: [...list.map((x) => ({ label: x.label, sub: naira(pieceCost(x.id)), disabled: pieceCost(x.id) > left || this.basket.length >= 6, why: this.basket.length >= 6 ? 'Six pieces per suggestion' : 'Over the budget', act: () => { this.basket.push({ id: x.id, qty: 1 }); g.openChoice(() => this.jobView(cat)); } })), { label: 'Back', ghost: true, act: () => g.openChoice(() => this.jobView()) }] };
  }
}
