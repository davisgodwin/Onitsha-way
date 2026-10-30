import { EATERIES } from '../data/eateries.js';
/**
 * Invitations pop up as a small card at the top of the screen with Accept / Decline right there, instead of
 * waiting unseen in Messages → Invitations. "Later" hides the card; the invitation stays in Messages until it
 * expires (5 minutes).
 */
const WHAT = {
  friend: ['🤝', 'wants to be your friend'],
  home: ['🏠', 'invites you to their home'],
  visit: ['🚪', 'wants to visit your home'],
  ride: ['🚗', 'offers you a ride'],
  team: ['👥', 'invites you to their crew'],
  decorate: ['🛋', 'wants to hire you to decorate their home'],
  date: ['☕', 'asks you out on a date'],
  relationship: ['💛', 'asks you to be their partner'],
};
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** What stops the player accepting right now (null = can accept). */
export function acceptBlocker(g, r) {
  if (['home', 'visit', 'ride', 'decorate'].includes(r.kind)) {
    if (!g.saveData) return 'Load your character first.';
    if (g.transport?.riding) return 'Finish your bus or keke trip first.';
    if (g.story?.s?.arrest || g.state === 'chase') return 'Finish the police matter first.';
  }
  if (r.kind === 'visit' && !(g.homes?.inside && !g.homes.inside.viewing && !g.online?.guestHost)) return 'Go inside your own home first, then accept — your friend arrives at your door.';
  if (r.kind === 'ride' && g.vehicles?.driving) return 'Get out of your own car first.';
  return null;
}

export class InviteBanner {
  constructor(online) {
    this.o = online; this.g = online.g; this.later = new Set(); this.busy = false; this.shownId = null;
    const root = this.root = el('section', 'invite-banner'); root.hidden = true; root.setAttribute('role', 'alertdialog'); root.setAttribute('aria-live', 'assertive');
    this.icon = el('span', 'invite-icon'); this.text = el('p', 'invite-text'); this.more = el('small', 'invite-more'); this.msg = el('small', 'invite-msg');
    const copy = el('div', 'invite-copy'); copy.append(this.text, this.more, this.msg);
    const actions = el('div', 'invite-actions');
    this.yes = el('button', 'invite-btn invite-yes', 'Accept'); this.no = el('button', 'invite-btn invite-no', 'Decline'); this.wait = el('button', 'invite-btn invite-later', 'Later');
    for (const b of [this.yes, this.no, this.wait]) { b.type = 'button'; actions.append(b); }
    this.yes.onclick = () => this.answer(true); this.no.onclick = () => this.answer(false); this.wait.onclick = () => { this.later.add(this.shownId); this.update(); };
    root.append(this.icon, copy, actions);
    document.body.append(root);
  }
  pending() {
    const me = this.o.me?.id, t = Date.now() + (this.o.offset || 0);
    return (this.o.data?.requests ?? []).filter((r) => r.to === me && r.status === 'pending' && r.expiresAt > t && !this.later.has(r.id) && WHAT[r.kind]);
  }
  update() {
    const g = this.g, list = this.o.connected ? this.pending() : [];
    const show = list.length > 0 && !!g.saveData && !['menu', 'creator', 'loading'].includes(g.state);
    if (!show) { this.root.hidden = true; this.shownId = null; return; }
    const r = list[0];
    if (r.id !== this.shownId) {
      this.shownId = r.id; this.msg.textContent = ''; this.busy = false;
      const [icon, what] = WHAT[r.kind];
      this.icon.textContent = icon; this.text.textContent = `${r.fromName ?? 'A player'} ${what}${r.kind === 'date' && r.area ? ` (${EATERIES.find((e) => e.id === r.area)?.name ?? r.area.replace(/-/g, ' ')})` : ''}`;
      try { navigator.vibrate?.(60); } catch { /* not supported */ }
    }
    this.more.textContent = list.length > 1 ? `+${list.length - 1} more in Messages` : '';
    this.yes.disabled = this.no.disabled = this.busy;
    this.root.hidden = false;
  }
  async answer(accept) {
    const r = this.pending().find((x) => x.id === this.shownId); if (!r || this.busy) return;
    if (accept) { const why = acceptBlocker(this.g, r); if (why) { this.msg.textContent = why; return; } }
    this.busy = true; this.update();
    try {
      const out = await this.o.request('respond', { id: r.id, accept });
      this.later.add(r.id); // answered: never show it again even before the next server update
      if (accept && r.kind === 'friend') this.o.notice(`You and ${r.fromName} are now friends.`);
      else if (accept && r.kind === 'visit') this.o.notice(`${r.fromName} is coming in.`);
      else if (!accept) this.o.notice('Declined.');
    } catch (e) { this.msg.textContent = e.message; }
    finally { this.busy = false; this.update(); }
  }
}
