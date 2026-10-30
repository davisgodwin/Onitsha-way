/**
 * Cloud save: keeps each account's game save on the local account server (MySQL or server files), so
 * logging in on another browser or device continues the same life.
 *
 * The browser copy (localStorage) is still written first on every save — play never waits for the network.
 * Uploads follow a few seconds later. Each server copy has a revision number; this browser remembers which
 * revision its copy is based on, so a copy saved elsewhere is never silently overwritten:
 *   - only one side changed      → that side is used;
 *   - both changed (two devices) → the most recently played copy is used and the other is kept as a backup
 *                                  (in this browser's backup slot, or in the server's save history).
 */
import { SaveSystem } from './SaveSystem.js';

const metaKey = (id) => `onitshaway:account:${id}:cloud`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } },
};
/** FNV-1a (32-bit) + length: enough to tell whether the local copy changed since the last sync. */
export function saveHash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return `${(h >>> 0).toString(16)}:${s.length}`; }
const savedAt = (raw) => { try { return Date.parse(JSON.parse(raw).updatedAt) || 0; } catch { return 0; } };

/**
 * Decide what to do when this browser and the server disagree. Pure, so it is tested on its own.
 * local: raw text or null · server: { rev, raw } or null · meta: { rev, hash } remembered from the last sync, or null
 */
export function plan(local, server, meta) {
  if (!local && !server) return { action: 'none' };
  if (local && !server) return { action: 'upload', baseRev: 0 };
  if (!local && server) return { action: 'download' };
  const localChanged = !meta || meta.hash !== saveHash(local);
  const serverChanged = !meta || meta.rev !== server.rev;
  if (local === server.raw) return { action: 'adopt' };
  if (!serverChanged) return localChanged ? { action: 'upload', baseRev: server.rev } : { action: 'none' };
  // this tab stepped aside when the account was opened on another device: that device's progress comes first
  if (meta?.yielded) return { action: 'download', ...(localChanged ? { conflict: 'kept-server' } : {}) };
  if (!localChanged) return { action: 'download' };
  // both sides moved on: keep the one played most recently, keep the other as a backup
  return savedAt(local) >= savedAt(server.raw) ? { action: 'upload', baseRev: server.rev, force: true, conflict: 'kept-local' } : { action: 'download', conflict: 'kept-server' };
}

export const CloudSave = {
  userId: null, token: '', meta: null, state: 'off', error: '', lastSync: 0, rev: null, notice: '',
  timer: null, firstDirty: 0, pushing: null, retryMs: 15000, listeners: new Set(),
  fetcher: (...a) => fetch(...a),
  DEBOUNCE: 8000, MAX_WAIT: 60000,

  attach(userId, token) {
    this.detach();
    if (!userId || !token) return;
    this.userId = userId; this.token = token;
    try { this.meta = JSON.parse(store.get(metaKey(userId)) || 'null'); } catch { this.meta = null; }
    this.rev = this.meta?.rev ?? null; this.set('checking');
    SaveSystem.onSaved = () => this.localSaved();
    if (!this.hooked && typeof document !== 'undefined') {
      // leaving the tab or closing the page: upload straight away instead of waiting for the timer
      this.hooked = true;
      const now = () => { if (this.userId && this.firstDirty) { clearTimeout(this.timer); this.timer = null; this.push(); } };
      document.addEventListener('visibilitychange', () => { if (document.hidden) now(); });
      addEventListener('pagehide', now);
      addEventListener('online', () => { if (this.userId && this.state === 'offline') this.push(); });
    }
  },
  detach() { clearTimeout(this.timer); this.timer = null; this.userId = null; this.token = ''; this.meta = null; this.firstDirty = 0; this.notice = ''; SaveSystem.onSaved = null; this.set('off'); },
  set(state, error = '') { this.state = state; this.error = error; for (const f of this.listeners) try { f(this.status()); } catch { /* UI only */ } },
  status() { return { state: this.state, error: this.error, lastSync: this.lastSync, rev: this.rev, pending: !!this.firstDirty }; },
  remember(rev, raw) { this.meta = { rev, hash: saveHash(raw) }; this.rev = rev; this.lastSync = Date.now(); store.set(metaKey(this.userId), JSON.stringify(this.meta)); },

  async request(method, body, timeout = 10000) {
    const r = await this.fetcher('/api/save', { method, cache: 'no-store', signal: AbortSignal.timeout(timeout),
      headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let out = {}; try { out = await r.json(); } catch { /* handled by status */ }
    // A "200 OK" that isn't the account server's answer (an old server still running, another program on the port,
    // a proxy page): treat it as unreachable, keep the save in this browser and try again later. Never crash on it.
    if (r.status === 200 && (out?.ok !== true || (method === 'PUT' && !Number.isFinite(out.save?.rev)))) return { status: 502, out: { error: 'unexpected answer from the account server' } };
    return { status: r.status, out: out ?? {} };
  },
  failed(e, status) {
    if (status === 401) { this.set('signed-out', 'Signed out — log in again to sync.'); return; }
    if (status === 503) { this.set('error', out503(e)); return; }
    this.set('offline', 'Account server not reachable — your save is safe in this browser and will upload when it is back.');
  },

  /** On login: make this browser and the server agree before the game loads. Never blocks for more than ~8 s. */
  async reconcile() {
    if (!this.userId) return { action: 'off' };
    let res;
    try { res = await this.request('GET', null, 8000); } catch { this.failed(); this.schedule(); return { action: 'offline' }; }
    if (res.status !== 200) { this.failed(res.out?.error, res.status); return { action: 'offline' }; }
    const server = res.out.save, local = SaveSystem.raw(), p = plan(local, server, this.meta);
    if (p.action === 'download') {
      const w = SaveSystem.writeRaw(server.raw);
      if (!w.ok) { this.set('error', `The save from your account could not be loaded here (${w.error}). Your browser copy is unchanged.`); return { action: 'error' }; }
      this.remember(server.rev, server.raw);
      if (p.conflict) this.notice = 'This account was played more recently on another device, so that game was loaded. The game that was in this browser is kept as a backup.';
      else if (local == null) this.notice = `Your saved game was loaded from your account (${server.character || 'your character'}, day ${server.day ?? '?'}).`;
      this.set('synced'); return p;
    }
    if (p.action === 'adopt') { this.remember(server.rev, server.raw); this.set('synced'); return p; }
    if (p.action === 'upload') {
      this.firstDirty ||= Date.now();
      const ok = await this.push({ force: p.force, baseRev: p.baseRev, always: true });
      if (ok && p.conflict) this.notice = 'This browser had the most recent game, so it was kept. The copy saved from another device is kept in your account\'s save history.';
      return { ...p, ok };
    }
    this.set(server ? 'synced' : 'idle'); if (server) this.lastSync = Date.now();
    return p;
  },

  localSaved() { if (!this.userId || this.state === 'elsewhere') return; this.firstDirty ||= Date.now(); this.schedule(); },
  schedule(delay) {
    if (!this.userId) return;
    clearTimeout(this.timer);
    const wait = delay ?? Math.max(0, Math.min(this.DEBOUNCE, this.firstDirty + this.MAX_WAIT - Date.now()));
    this.timer = setTimeout(() => { this.timer = null; this.push(); }, wait);
  },
  /** Upload now (used before signing out and by "Sync now"). */
  async flush() { clearTimeout(this.timer); this.timer = null; if (this.pushing) await this.pushing; if (this.firstDirty || this.state !== 'synced') return this.push(); return true; },

  /**
   * The account was opened on another device (the server moved the live connection there). Stop uploading from this
   * tab so it can't overwrite that device's progress; the next login here loads the newest game.
   */
  yieldToOtherDevice() {
    if (!this.userId || this.state === 'elsewhere') return;
    clearTimeout(this.timer); this.timer = null; this.firstDirty = 0;
    if (this.meta) { this.meta.yielded = true; store.set(metaKey(this.userId), JSON.stringify(this.meta)); }
    this.set('elsewhere');
  },
  push(opts = {}) {
    if (!this.userId || this.state === 'elsewhere') return Promise.resolve(false);
    if (this.pushing) return this.pushing.then(() => this.push(opts));
    this.pushing = this.doPush(opts).finally(() => { this.pushing = null; });
    return this.pushing;
  },
  async doPush({ force = false, baseRev, always = false } = {}) {
    // v0.43: the account server hears about every transaction first, so the save it stores agrees with its books
    try { await this.beforePush?.(); } catch { /* the save still uploads */ }
    const raw = SaveSystem.raw();
    if (!raw) { this.firstDirty = 0; return true; }
    if (!force && !always && this.meta && this.meta.hash === saveHash(raw)) { this.firstDirty = 0; this.set('synced'); return true; }
    const startedDirty = this.firstDirty; this.set('uploading');
    let res;
    try { res = await this.request('PUT', { raw, baseRev: baseRev ?? this.meta?.rev ?? 0, force }); }
    catch { this.failed(); this.schedule(this.retryMs); return false; }
    if (res.status === 409) {
      // Saved from another device since we last synced. This browser's game is the one being played right now,
      // so keep it; the server keeps the other copy in the save history.
      this.notice = 'This account was also saved from another device. The game in this browser was kept; the other copy is in your account\'s save history.';
      return this.doPush({ force: true });
    }
    if (res.status !== 200) { this.failed(res.out?.error, res.status); if (res.status !== 401 && res.status !== 400) this.schedule(this.retryMs * 2); return false; }
    this.remember(res.out.save.rev, raw);
    if (res.out.corrected?.length) this.onCorrected?.(res.out.corrected);
    if (this.firstDirty === startedDirty) this.firstDirty = 0;
    if (SaveSystem.raw() !== raw) { this.firstDirty ||= Date.now(); this.schedule(); }
    this.set('synced'); return true;
  },
  /** One line for Settings. */
  describe() {
    const s = this.status(), when = s.lastSync ? new Date(s.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    switch (s.state) {
      case 'off': return 'Offline save: kept in this browser only. Log in to an account to keep your game on the account server.';
      case 'checking': return 'Checking your account\'s save…';
      case 'uploading': return 'Uploading your save to your account…';
      case 'synced': return s.pending ? 'Saved in this browser · uploading shortly…' : `Saved to your account${when ? ` at ${when}` : ''}. Log in on another browser or device to continue this game.`;
      case 'idle': return 'No saved game on your account yet.';
      case 'elsewhere': return 'This account is now open on another device, so this tab stopped uploading (that device\'s progress is safe). Reload this page to continue here with the newest game.';
      default: return s.error || 'Not synced yet.';
    }
  },
};
function out503(e) { return `Your account server could not save (${e || 'database unavailable'}). Your game is safe in this browser and will upload when it is fixed.`; }
