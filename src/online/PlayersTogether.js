import { PVP } from '../authority/Policy.js';
import { naira } from '../economy/Economy.js';
/**
 * v0.44 players together (stage 5 of the open-life plan). Walk up to another player and press E: pay them, message
 * them, report them, or (adults, out on the streets) try to pick their pocket or rob them. The account server decides
 * everything and moves the money between the two players' books; this module only asks and shows the answer.
 *
 * Safeguards (enforced by the server, src/authority/Policy.js PVP): safe areas (near the police, a hospital, a bank,
 * the court, or indoors), peace mode (opt out: nobody can target you and you can't target anyone), a cooldown for
 * the one acting, a shield for the one targeted, three a day at most, a cap on what can be taken, never children,
 * blocked players can't interact, and every incident can be reported to the police and to the moderators.
 */
export const SAFE_RADIUS = 45;
export class PlayersTogether {
 constructor(g) {
  this.g = g; this.status = null;
  const self = this;
  g.interactions.register({ get x() { return self.nearest()?.x ?? 1e9; }, get z() { return self.nearest()?.z ?? 1e9; }, radius: 2.6, priority: 6, enabled: () => !!this.nearest() && this.free(), label: () => `${this.nearest()?.name ?? 'Player'} — meet`, onInteract: () => { const q = this.nearest(); if (q) g.openChoice(() => this.view(q)); } });
 }
 get online() { return this.g.online; }
 free() { const g = this.g; return !!g.saveData && !g.vehicles?.driving && !g.homes?.inside && !g.civic?.inside && !g.story?.inside && g.state === 'playing'; }
 adult() { return this.g.saveData?.character?.ageGroup !== 'child'; }
 nearest() { const o = this.online; if (!o?.connected) return null; const p = this.g.player.position; let best = null, d = 2.6; for (const q of o.players ?? []) { if (q.scene !== 'city') continue; const e = Math.hypot(q.x - p.x, q.z - p.z); if (e < d) { d = e; best = q; } } return best; }
 /** Safe areas: indoors, or near the police, a hospital, a bank or the court. Sent with your position. */
 safe() {
  const g = this.g; if (!g.saveData || g.homes?.inside || g.civic?.inside || g.club?.inside || g.story?.inside) return true;
  const p = g.player?.position; if (!p) return true; const near = (q, r = SAFE_RADIUS) => q && Math.hypot(q.x - p.x, q.z - p.z) < r;
  return (g.police?.posts ?? []).some((q) => near(q, 35)) || (g.story?.offices ?? []).some((q) => near(q)) || (g.hospitals?.list ?? []).some((h) => near(h.place)) || (g.business?.branches ?? []).some((b) => near(b)) || near(g.justice?.court);
 }
 req(action, data) { return this.online.request(action, data); }
 view(q) {
  const g = this.g, opts = [], safe = this.safe();
  for (const amt of [1000, 5000, 20000]) opts.push({ label: `Give ${q.name} ${naira(amt)}`, sub: 'From your wallet. Your account server moves it', disabled: !this.adult() || !g.economy.canAfford(amt), why: !this.adult() ? 'Adults only' : 'Not enough cash', act: () => this.pay(q, amt) });
  opts.push({ label: 'Send a message', act: () => { g.closeChoice(); g.phone?.openMessages(q.id); } });
  if (this.adult()) for (const e of g.eateries?.list ?? []) opts.push({ label: `Ask ${q.name} on a date — ${e.name}`, sub: 'Friends only. If they say yes, meet there and sit down together', act: () => this.askDate(q, e) }); // v0.45
  if (this.adult()) for (const [kind, K] of Object.entries(PVP.kinds)) opts.push({ label: `(${K.label})`, sub: safe ? 'Not here: this is a safe area' : `A crime. They'll know it was you and can report you. At most ${naira(K.max)}`, disabled: safe, why: 'This is a safe area: near the police, a hospital, a bank, the court, or indoors', act: () => this.confirmCrime(q, kind) });
  opts.push({ label: 'Report this player', sub: 'To the moderators', act: () => g.openChoice(() => this.reportView(q)) });
  opts.push({ label: 'Close', ghost: true, act: () => g.closeChoice() });
  return { title: q.name, kicker: 'ANOTHER PLAYER', text: `${q.name} is standing with you.`, options: opts };
 }
 async askDate(q, e) { const g = this.g; g.closeChoice(); try { await this.req('request', { target: q.id, kind: 'date', area: e.id }); g.ui.toast(`You asked ${q.name} to ${e.name}. They have to accept.`, 5000); } catch (err) { g.ui.toast(err.message, 5000); } }
 async pay(q, amount) {
  const g = this.g; g.closeChoice();
  try { const r = await this.req('pay', { target: q.id, amount }); await g.authority?.sync(); g.ui.toast(`You gave ${r.name} ${naira(r.amount)}.`); g.life?.note(`p2p:${r.id}`, `Gave ${r.name} ${naira(r.amount)}`, { social: 1 }); }
  catch (e) { g.ui.toast(e.message, 5000); }
 }
 confirmCrime(q, kind) {
  const g = this.g, K = PVP.kinds[kind];
  g.openChoice(() => ({ title: K.label, kicker: 'CRIME · ANOTHER PLAYER', text: `${q.name} will know it was you. They can report you to the police, and the police will open a case.`, note: `If it works you take up to ${Math.round(K.share * 100)}% of the cash they carry (at most ${naira(K.max)}). Players in peace mode, in safe areas or targeted recently can't be touched.`, options: [
   { label: 'Do it', primary: true, act: () => this.crime(q, kind) }, { label: 'Leave it', ghost: true, act: () => g.closeChoice() }] }));
 }
 async crime(q, kind) {
  const g = this.g; g.closeChoice();
  let r; try { r = await this.req('pvpCrime', { target: q.id, kind }); } catch (e) { g.ui.toast(e.message, 6000); return; }
  await g.authority?.sync();
  const J = g.justice; if (J?.ready) J.cases.open({ agency: 'police', offence: `${r.offence} (${r.name})`, severity: r.severity, evidence: r.ok ? 0.45 : 0.7, day: g.clock.day, ref: `pvp:${r.id}`, amount: r.amount });
  g.life?.note(`pvp:${r.id}`, `${PVP.kinds[kind].label}: ${r.name}${r.ok ? ` · ${naira(r.amount)}` : ' · it went wrong'}`, { integrity: -8, notoriety: r.ok ? 4 : 2 });
  g.saveGame?.();
  g.openChoice(() => ({ title: r.ok ? (r.amount ? 'You got it' : 'Empty pockets') : 'It went wrong', kicker: 'CRIME · ANOTHER PLAYER', text: r.ok ? (r.amount ? `${naira(r.amount)} from ${r.name}.` : `${r.name} had no cash on them.`) : `${r.name} noticed and pulled away.`, note: `${r.name} knows it was you. If they report it, the police case gets stronger.`, options: [{ label: 'Close', primary: true, act: () => g.closeChoice() }] }));
 }
 reportView(q) {
  const g = this.g, send = async (reason) => { g.closeChoice(); try { await this.req('report', { target: q.id, reason }); g.ui.toast('Reported. The moderators can see it.'); } catch (e) { g.ui.toast(e.message, 5000); } };
  return { title: `Report ${q.name}`, text: 'Reports go to the people who run this server.', options: [['Harassing me', 'Harassing or following me around'], ['Offensive', 'Offensive name, messages or behaviour'], ['Cheating', 'Cheating or exploiting the game'], ['Targeting me', 'Keeps targeting me with crime']].map(([label, reason]) => ({ label, act: () => send(reason) })).concat([{ label: 'Back', ghost: true, act: () => g.openChoice(() => this.view(q)) }]) };
 }
 /** Messages from the server about you. */
 receive(m) {
  const g = this.g; this.status = null; g.authority?.sync();
  if (m.type === 'paid') { g.ui.toast(`${m.name} gave you ${naira(m.amount)}.`, 5000); return; }
  if (m.type === 'pvpReported') { const c = g.justice?.cases.j.cases.find((x) => x.ref === `pvp:${m.id}`); if (c) g.justice.cases.add(c.id, 0.6); g.justice?.log(`${m.by} reported you to the police`); g.ui.toast(`${m.by} reported you to the police.`, 6000); g.saveGame?.(); return; }
  if (m.type === 'pvp') {
   const what = m.ok ? (m.amount ? `${m.name} ${m.kind === 'rob' ? 'robbed you' : 'picked your pocket'}: ${naira(m.amount)} gone.` : `${m.name} went through your pockets, but you had no cash.`) : `${m.name} tried to ${m.kind === 'rob' ? 'rob you' : 'pick your pocket'}, and you pulled away.`;
   g.life?.note(`pvp-victim:${m.id}`, what, { social: -1 });
   g.openChoice(() => ({ title: m.ok ? 'You were robbed' : 'Someone tried to rob you', kicker: 'ANOTHER PLAYER', text: what, note: 'For 30 minutes nobody can target you. Peace mode (phone, Law & street) stops it for good.', options: [
    { label: 'Report it to the police', primary: true, act: async () => { g.closeChoice(); try { await this.req('pvpReport', { id: m.id }); g.ui.toast('The police have your statement.'); } catch (e) { g.ui.toast(e.message, 5000); } } },
    { label: 'Report to the moderators', act: () => g.openChoice(() => this.reportView({ id: m.from, name: m.name })) },
    { label: 'Close', ghost: true, act: () => g.closeChoice() }] }));
  }
 }
 async loadStatus() { try { this.status = await this.req('pvpStatus', {}); } catch { this.status = null; } return this.status; }
 async setPeace(on) { const r = await this.req('pvpPeace', { on }); if (this.status) this.status.peace = r.peace; return r.peace; }
}
