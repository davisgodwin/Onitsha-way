import { Economy, naira } from '../economy/Economy.js';
import { CloudSave } from '../save/CloudSave.js';
/**
 * v0.43 server authority, the browser's side. While you're signed in to an account, every transaction in any of your
 * money accounts (wallet, bank account, each business, each wage escrow) is sent to the account server as it happens.
 * The server checks it against the game's rules and answers with the true balances, the legal record it holds,
 * the reputation it allows, and any property it hasn't seen you pay for. The browser adopts that answer.
 * Offline, or signed out, nothing changes: the local save is the game, as before.
 *
 * save.authority = { opened: lifeId | 'pending:<lifeId>' | null, queue: [entries not yet sent], rejected: [...],
 *   unverified: { vehicles, homes }, lastSync, corrections }
 */
export const SYNC = { debounce: 3000, every: 45000, batch: 400, queueMax: 3000 };
export class AuthorityClient {
 constructor(g) {
  this.g = g; this.busy = null; this.timer = null; this.status = 'off'; this.applying = false;
  Economy.observer = (state, entry) => { try { this.capture(state, entry); } catch (e) { console.error('[authority]', e); } };
  this.interval = setInterval(() => { if (this.on) this.sync(); }, SYNC.every);
 }
 get on() { return !!CloudSave.userId && !!CloudSave.token && CloudSave.state !== 'elsewhere' && !!this.g.saveData && this.g.saveData.character?.name != null; }
 get lifeId() { return String(this.g.saveData?.createdAt ?? ''); }
 state() { const a = (this.g.saveData.authority ??= {}); a.queue ??= []; a.rejected ??= []; a.unverified ??= { vehicles: [], homes: [] }; a.corrections ??= 0; return a; }
 start() { if (!this.g.saveData) return; const a = this.state(); if (a.opened && !String(a.opened).endsWith(this.lifeId)) { a.opened = null; a.queue = []; } this.applyUnverified(); if (this.on) this.schedule(500); }
 /** Which of your accounts a ledger state belongs to. */
 ledgerOf(state) {
  const d = this.g.saveData; if (!d) return null;
  if (state === d.wallet) return 'wallet'; if (state === d.bank?.account) return 'bank';
  for (const o of d.orgs?.list ?? []) if (state === o.account) return `org:${o.id}`;
  for (const k of d.contracts?.list ?? []) if (state === k.escrow) return `escrow:${k.id}`;
  return null;
 }
 stateOf(ledger) {
  const d = this.g.saveData; if (ledger === 'wallet') return d.wallet; if (ledger === 'bank') return d.bank?.open ? d.bank.account : null;
  if (ledger.startsWith('org:')) return d.orgs?.list.find((o) => `org:${o.id}` === ledger)?.account ?? null;
  if (ledger.startsWith('escrow:')) return d.contracts?.list.find((k) => `escrow:${k.id}` === ledger)?.escrow ?? null;
  return null;
 }
 capture(state, entry) {
  if (this.applying || !this.on) return; const a = this.state(); if (!a.opened || !String(a.opened).endsWith(this.lifeId)) return;
  const ledger = this.ledgerOf(state); if (!ledger) return;
  a.queue.push({ ledger, key: entry.key, amount: entry.amount, reason: String(entry.reason ?? '').slice(0, 160) });
  if (a.queue.length > SYNC.queueMax) a.queue.splice(0, a.queue.length - SYNC.queueMax);
  this.schedule();
 }
 schedule(ms = SYNC.debounce) { clearTimeout(this.timer); this.timer = setTimeout(() => this.sync(), ms); }
 snapshot(d) { return { wallet: { balance: d.wallet.balance }, bank: d.bank?.open ? { open: true, account: { balance: d.bank.account.balance } } : { open: false }, orgs: { list: (d.orgs?.list ?? []).map((o) => ({ id: o.id, account: { balance: o.account.balance } })) }, contracts: { list: (d.contracts?.list ?? []).map((k) => ({ id: k.id, escrow: { balance: k.escrow.balance } })) }, vehicles: (d.vehicles ?? []).map((v) => ({ id: v.id, model: v.model })), housing: { owned: d.housing?.owned ?? {} }, life: { record: { entries: d.life?.record?.entries ?? [] }, standing: d.life?.standing }, justice: { convictions: d.justice?.convictions ?? 0 } }; }
 /** Send what happened; adopt what the server decides. Returns true when the server answered. */
 sync() {
  if (!this.on) return Promise.resolve(false); if (this.busy) return this.busy;
  const d = this.g.saveData, a = this.state(), lifeId = this.lifeId;
  if (a.opened && !String(a.opened).endsWith(lifeId)) { a.opened = null; a.queue = []; }
  const opening = !a.opened || String(a.opened).startsWith('pending:'); if (!a.opened) a.opened = `pending:${lifeId}`;
  const entries = a.queue.slice(0, SYNC.batch);
  const body = { lifeId, entries, record: d.life?.record?.entries ?? [], standing: d.life?.standing ?? null, convictions: d.justice?.convictions ?? 0, property: { vehicles: (d.vehicles ?? []).map((v) => v.id), homes: Object.keys(d.housing?.owned ?? {}) }, ...(opening ? { snapshot: this.snapshot(d) } : {}) };
  this.busy = (async () => {
   let r, out = {};
   try { r = await CloudSave.fetcher('/api/authority/sync', { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { Authorization: `Bearer ${CloudSave.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); out = await r.json().catch(() => ({})); }
   catch { this.status = 'offline'; return false; }
   if (r.status !== 200 || out?.ok !== true || !out.balances) { this.status = r.status === 401 ? 'signed-out' : 'error'; return false; }
   if (this.g.saveData !== d) return false; // another save was loaded meanwhile
   a.opened = lifeId; a.queue.splice(0, entries.length); this.apply(out, d, a); a.lastSync = Date.now(); this.status = 'ok'; return true;
  })().finally(() => { this.busy = null; if (this.on && this.state().queue.length) this.schedule(); });
  return this.busy;
 }
 apply(out, d, a) {
  const g = this.g; this.applying = true;
  try {
   // moves the server made itself (a payment between players, a robbery): recorded as ordinary entries first
   for (const x of out.incoming ?? []) { const st = this.stateOf(x.ledger); if (!st || st.processed?.includes(x.key)) continue; st.balance += x.amount; st.ledger?.push({ key: x.key, amount: x.amount, reason: x.reason, balance: st.balance, day: g.clock?.day ?? null }); st.processed?.push(x.key); if (x.ledger === 'wallet') g.economy?.processed?.add(x.key); }
   const fixes = [];
   for (const [ledger, bal] of Object.entries(out.balances)) {
    const st = this.stateOf(ledger); if (!st) continue;
    const pending = a.queue.filter((e) => e.ledger === ledger).reduce((s, e) => s + e.amount, 0), want = bal + pending; // entries made since sending are still to come
    if (st.balance !== want) { const diff = want - st.balance; st.ledger?.push({ key: `authority:${Date.now()}:${ledger}`, amount: diff, reason: 'Corrected by the account server', balance: want, day: g.clock?.day ?? null }); st.balance = want; fixes.push({ ledger, diff }); }
   }
   for (const x of out.rejected ?? []) { a.rejected.push({ ...x, at: Date.now() }); if (a.rejected.length > 20) a.rejected.shift(); }
   const rec = g.life?.record?.r ?? d.life?.record;
   if (rec && out.record?.length) { const have = new Set(rec.entries.map((e) => e.id)); for (const e of out.record) if (!have.has(e.id)) rec.entries.push(e); rec.entries.sort((x, y) => Number(/\d+$/.exec(x.id)?.[0] ?? 0) - Number(/\d+$/.exec(y.id)?.[0] ?? 0)); }
   const st = g.life?.standing?.s ?? d.life?.standing; if (st && out.standing) { for (const k of ['public', 'integrity', 'notoriety', 'business', 'social']) if (Number.isFinite(out.standing[k])) st[k] = out.standing[k]; for (const [k, v] of Object.entries(out.standing.prof ?? {})) st.prof[k] = v; }
   if (d.justice && Number.isInteger(out.convictions) && out.convictions > (d.justice.convictions ?? 0)) d.justice.convictions = out.convictions;
   a.unverified = { vehicles: out.unverified?.vehicles ?? [], homes: out.unverified?.homes ?? [] }; this.applyUnverified();
   if (fixes.length) { a.corrections += fixes.length; g.bus?.emit('wallet:changed', { balance: d.wallet.balance }); }
   const lost = (out.rejected ?? []).filter((x) => x.amount > 0);
   if (lost.length) g.ui?.toast(`Your account server didn't accept ${lost.length === 1 ? `${naira(lost[0].amount)}: ${lost[0].why}` : `${lost.length} payments (${naira(lost.reduce((s, x) => s + x.amount, 0))})`}.`, 6000);
   else if (fixes.some((f) => f.ledger === 'wallet')) g.ui?.toast('Your money was brought in line with your account server.', 4000);
   if (fixes.length || out.record?.length) g.saveGame?.();
  } finally { this.applying = false; }
 }
 /** Property the server hasn't seen you pay for stays yours, but can't be sold or pledged. */
 applyUnverified() { const d = this.g.saveData, u = d?.authority?.unverified; if (!d || !u) return; for (const v of d.vehicles ?? []) v.unverified = u.vehicles.includes(v.id) || undefined; }
 isUnverified(kind, id) { const u = this.g.saveData?.authority?.unverified; return !!u && (kind === 'vehicle' ? u.vehicles : u.homes).includes(id); }
 /** For the phone: what the server says. */
 summary() { const a = this.g.saveData?.authority; return { on: this.on, status: this.status, lastSync: a?.lastSync ?? 0, queued: a?.queue?.length ?? 0, rejected: [...(a?.rejected ?? [])].reverse().slice(0, 6), corrections: a?.corrections ?? 0, unverified: a?.unverified ?? { vehicles: [], homes: [] } }; }
}
