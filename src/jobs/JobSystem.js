import { MISSION_DEFINITIONS, newMissionState } from './MissionDefinitions.js';
import { CATALOGUE, ITEMS } from '../data/catalogue.js';

const r50 = (n) => Math.max(50, Math.round(n / 50) * 50);
const r15 = (n) => Math.ceil(n / 15) * 15;
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export const MAX_JOBS = 3;
const RUN = 5.4;          // m/s — deadlines assume you hurry (or take transport)
const ROUTE_FACTOR = 1.35; // streets are longer than the straight line

/**
 * Jobs offered by traders, between real places in the city.
 *   deliver  — carry a parcel from the giver to another trader
 *   collect  — fetch goods from another trader and bring them back to the giver
 *   errand   — buy a specific item (from a trader who sells it) and bring it to the giver;
 *              the giver reimburses the standard price plus a tip
 * Up to MAX_JOBS can be active at once. Every job has a deadline on the game clock, set when you
 * accept it from the distance involved and never later than the shops involved close. A job that
 * runs past its deadline fails: any parcel goes back, nothing is paid and the giver remembers.
 * Rewards are paid only by Economy.transact with a per-job idempotency key, after the completion
 * condition has been checked against the inventory.
 *
 * Times are absolute game minutes: day * 1440 + minutes.
 * State (in the save): { list: [Job], completed: [jobId], log: [{id,title,reward,day,missed?}], tracked }
 */
export class JobSystem {
  constructor(state, { economy, inventory, residents, bus = null, now = () => 0 }) {
    this.state = state;
    state.list ??= []; state.completed ??= []; state.log ??= []; state.tracked ??= null;
    // pre-v4 saves had a single `active` job
    if (state.active) { if (!state.list.some((j) => j.id === state.active.id)) state.list.push({ deadline: Infinity, ...state.active }); delete state.active; }
    for (const j of state.list) if (j.deadline === null || j.deadline === undefined) j.deadline = Infinity;
    this.economy = economy; this.inventory = inventory; this.bus = bus; this.now = now;
    state.missions ??= newMissionState();
    this.setResidents(residents);
  }

  setResidents(list) {
    this.residents = list ?? [];
    this.byId = new Map(this.residents.map((r) => [r.id, r]));
    this.traders = this.residents.filter((r) => r.role === 'trader');
  }

  /** One-off mission records and permanent receipts are not trimmed with daily job history. */
  mission(id) { return this.state.missions.records[id] ?? null; }
  offerMission(id, bindings) {
    if (!MISSION_DEFINITIONS[id] || !bindings || this.mission(id)) return this.mission(id);
    return this.state.missions.records[id] = { status: 'available', bindings, progress: 0, rewardClaimed: false, acceptedAt: null, completedAt: null };
  }
  acceptMission(id, actor) {
    const m = this.mission(id);
    if (!m || m.status !== 'available' || m.rewardClaimed || m.bindings.giver !== actor) return { ok: false };
    m.status = 'active'; m.acceptedAt = this.now(); this.state.missions.tracked = id;
    return { ok: true };
  }
  meetMission(id, actor) {
    const m = this.mission(id);
    if (!m || m.status !== 'active' || m.bindings.target !== actor || m.rewardClaimed) return { ok: false };
    const changed = m.progress === 0; m.progress = Math.max(1, m.progress);
    return { ok: true, changed };
  }
  /** Called only by validated in-world dialogue. Reward amount always comes from the definition. */
  completeMission(id, actor, conversationFinished = false) {
    const m = this.mission(id), def = MISSION_DEFINITIONS[id];
    if (!def || !m || m.status !== 'active' || m.rewardClaimed || m.progress !== 1 || m.bindings.target !== actor || !conversationFinished) return { ok: false };
    const tx = this.economy.transact({ key: `mission:${id}:reward`, amount: def.reward, reason: `Mission: ${def.title}`, ref: { mission: id } });
    if (!tx.ok && tx.error !== 'duplicate') return { ok: false, error: tx.error };
    m.progress = 2; m.status = 'completed'; m.rewardClaimed = true; m.completedAt = this.now();
    if (this.state.missions.tracked === id) this.state.missions.tracked = null;
    return { ok: true, paid: tx.ok ? def.reward : 0 };
  }

  get list() { return this.state.list; }
  get full() { return this.state.list.length >= MAX_JOBS; }
  get(jobId) { return this.state.list.find((j) => j.id === jobId) ?? null; }

  /** Latest time (absolute minutes) on `day` when everyone the job needs is still open. */
  /** Opening hours of a person on a day (set by the game from the weekday rules; base schedule otherwise). */
  hoursOf(p, day) { return this.hoursFn ? this.hoursFn(p, day) : p.schedule ?? [0, 24]; }

  closingCap(day, ...people) {
    const close = Math.min(...people.map((p) => this.hoursOf(p, day)?.[1] ?? 0));
    return day * 1440 + Math.round(close * 60);
  }

  /**
   * Today's offer from this trader, or null (already done or taken today, nothing suitable, or too
   * late in the day to finish before the shops close). The deadline counts from `nowAbs`.
   */
  offerFor(giver, day, nowAbs = day * 1440 + 9 * 60, { bonus = 0 } = {}) {
    const pay = (n) => r50(n * (1 + bonus)); // reputation bonus (M7)
    if (giver.role !== 'trader') return null;
    const id = `job:${giver.id}:d${day}`;
    if (this.state.completed.includes(id) || this.get(id)) return null;
    const r = rngFrom(hash(id));
    const near = this.traders.filter((t) => {
      if (t.id === giver.id) return false;
      const d = Math.hypot(t.x - giver.x, t.z - giver.z);
      const th = this.hoursOf(t, day), gh = this.hoursOf(giver, day);
      return d > 140 && d < 1100 && !!th && !!gh && th[1] >= gh[1] - 1;
    });
    if (!near.length) return null;
    const target = near[Math.floor(r() * near.length)];
    const dist = Math.hypot(target.x - giver.x, target.z - giver.z);
    const roll = r();
    const due = (metres, cap) => {
      const allowed = r15(45 + 1.3 * (metres * ROUTE_FACTOR) / RUN);
      const deadline = Math.min(nowAbs + allowed, cap);
      return deadline - nowAbs < 40 ? null : { allowed, deadline };
    };
    let job;
    if (roll < 0.45) {
      const t = due(dist, this.closingCap(day, target)); if (!t) return null;
      job = { id, type: 'deliver', giver: giver.id, target: target.id, day, dist: Math.round(dist), ...t,
        title: `Deliver a parcel to ${target.name}`, reward: pay(400 + dist * 1.1),
        package: { id: `pkg:${id}`, name: `Parcel for ${target.name}`, kind: 'package', unique: true },
        steps: [{ who: target.id, do: 'deliver', label: `Take the parcel to ${target.name} (${target.goods})` }] };
    } else if (roll < 0.75) {
      const t = due(dist * 2, this.closingCap(day, target, giver)); if (!t) return null;
      job = { id, type: 'collect', giver: giver.id, target: target.id, day, dist: Math.round(dist), ...t,
        title: `Collect goods from ${target.name}`, reward: pay(500 + dist * 1.3),
        package: { id: `pkg:${id}`, name: `Goods for ${giver.name}`, kind: 'package', unique: true },
        steps: [
          { who: target.id, do: 'pickup', label: `Collect the goods from ${target.name} (${target.goods})` },
          { who: giver.id, do: 'return', label: `Bring the goods back to ${giver.name}` },
        ] };
    } else {
      // errand: an item sold by a different kind of trader
      const suppliers=this.traders.filter(t=>{const h=this.hoursOf(t,day),hour=(nowAbs-day*1440)/60;return t.id!==giver.id&&h&&hour>=h[0]&&hour<h[1]&&this.closingCap(day,t,giver)-nowAbs>=40;});
      const kinds = Object.keys(CATALOGUE).filter(k=>k!==giver.goods&&k!=='hawker'&&suppliers.some(t=>t.goods===k));
      if(!kinds.length)return null;
      const kind = kinds[Math.floor(r() * kinds.length)];
      const cheap = CATALOGUE[kind].filter((i) => i.price <= 4000);
      const item = (cheap.length ? cheap : CATALOGUE[kind])[Math.floor(r() * (cheap.length || CATALOGUE[kind].length))];
      const seller=suppliers.filter(t=>t.goods===kind).sort((a,b)=>Math.hypot(a.x-giver.x,a.z-giver.z)-Math.hypot(b.x-giver.x,b.z-giver.z))[0];
      const shoppingDist=Math.hypot(seller.x-giver.x,seller.z-giver.z);
      const tip = pay(300 + shoppingDist * 0.4);
      const t = due(Math.max(400, shoppingDist) * 2, this.closingCap(day, giver,seller)); if (!t) return null;
      job = { id, type: 'errand', giver: giver.id, target: seller.id, day, dist: Math.round(shoppingDist), item: item.id, sellerGoods: kind, ...t,
        title: `Buy ${item.name} for ${giver.name}`, reward: item.price + tip, tip,
        steps: [{ who: giver.id, do: 'bring', label: `Buy ${item.name} (a ${kind} trader sells it) and bring it to ${giver.name}` }] };
    }
    return job;
  }

  /** Start a job. Parcels for deliveries go into the bag immediately. */
  accept(job) {
    if (!job) return { ok: false, error: 'no-job' };
    if (this.get(job.id)) return { ok: false, error: 'already-active' };
    if (this.state.completed.includes(job.id)) return { ok: false, error: 'already-done' };
    if (this.full) return { ok: false, error: 'too-many' };
    if (this.now() > job.deadline) return { ok: false, error: 'too-late' };
    if (job.type === 'deliver') {
      const r = this.inventory.add(job.package, 1);
      if (!r.ok) return { ok: false, error: r.error };
    }
    const active = { ...job, step: 0, acceptedAt: this.now() };
    this.state.list.push(active);
    if (!this.get(this.state.tracked)) this.state.tracked = active.id;
    this.bus?.emit('job:changed', active);
    return { ok: true, job: active };
  }

  currentStep(job) { return job ? job.steps[job.step] : null; }

  /** Everything you can do with this person right now: [{job, step}]. */
  stepsFor(identityId) {
    const out = [];
    for (const job of this.state.list) { const s = this.currentStep(job); if (s && s.who === identityId) out.push({ job, step: s }); }
    return out;
  }

  /** Carry out a job's current step with this person. Checks the condition before anything is paid. */
  doStep(identityId, jobId = null) {
    const job = jobId ? this.get(jobId) : this.stepsFor(identityId)[0]?.job;
    const step = this.currentStep(job);
    if (!job || !step || step.who !== identityId) return { ok: false, error: 'not-your-step' };
    if (this.now() > job.deadline) { this.expire(job); return { ok: false, error: 'expired', job }; }
    if (step.do === 'deliver' || step.do === 'return') {
      if (!this.inventory.has(job.package.id)) return { ok: false, error: 'missing-package' };
      this.inventory.remove(job.package.id, 1);
      return this.finish(job);
    }
    if (step.do === 'pickup') {
      const r = this.inventory.add(job.package, 1);
      if (!r.ok) return { ok: false, error: r.error };
      job.step++;
      this.bus?.emit('job:changed', job);
      return { ok: true, advanced: true, job };
    }
    if (step.do === 'bring') {
      if (!this.inventory.has(job.item)) return { ok: false, error: 'missing-item', item: ITEMS[job.item] };
      this.inventory.remove(job.item, 1);
      return this.finish(job);
    }
    return { ok: false, error: 'unknown-step' };
  }

  remove(job) {
    this.state.list = this.state.list.filter((j) => j !== job);
    if (this.state.tracked === job.id) this.state.tracked = this.state.list[0]?.id ?? null;
  }

  record(job, entry) {
    this.state.completed.push(job.id);
    if (this.state.completed.length > 400) this.state.completed.splice(0, this.state.completed.length - 400);
    this.state.log.push({ id: job.id, title: job.title, day: job.day, ...entry });
    if (this.state.log.length > 50) this.state.log.shift();
  }

  finish(job) {
    const tx = this.economy.transact({ key: `${job.id}:reward`, amount: job.reward, reason: `Job: ${job.title}`, ref: { job: job.id } });
    // a 'duplicate' here means the reward was already paid (e.g. a replayed event) — never pay twice
    const paid = tx.ok ? job.reward : 0;
    this.remove(job);
    this.record(job, { reward: paid });
    this.bus?.emit('job:completed', { job, paid });
    return { ok: true, completed: true, paid, job, balance: tx.balance };
  }

  /** Past the deadline: the parcel goes back, nothing is paid, the giver remembers. */
  expire(job) {
    if (!this.get(job.id)) return;
    if (job.package && this.inventory.has(job.package.id)) this.inventory.remove(job.package.id, 1);
    this.remove(job);
    this.record(job, { reward: 0, missed: true });
    this.bus?.emit('job:expired', { job });
  }

  /** Call regularly with the clock; fails jobs whose deadline has passed. */
  update(nowAbs = this.now()) {
    for (const job of [...this.state.list]) if (nowAbs > job.deadline) this.expire(job);
  }

  abandon(jobId = this.state.tracked) {
    const job = this.get(jobId); if (!job) return { ok: false };
    if (job.package && this.inventory.has(job.package.id)) this.inventory.remove(job.package.id, 1);
    this.remove(job);
    this.bus?.emit('job:changed', null);
    return { ok: true };
  }

  track(jobId) { if (this.get(jobId)) this.state.tracked = jobId; }

  /** Where to go next for a job (default: the tracked one): the resident for its current step. */
  target(jobId = this.state.tracked) {
    const job = this.get(jobId); const s = this.currentStep(job); if (!s) return null;
    let r = this.byId.get(s.who),label=s.label;
    if(job.type==='errand'&&!this.inventory.has(job.item)){const seller=this.byId.get(job.target)??this.traders.filter(t=>t.goods===job.sellerGoods).sort((a,b)=>Math.hypot(a.x-(r?.x??0),a.z-(r?.z??0))-Math.hypot(b.x-(r?.x??0),b.z-(r?.z??0)))[0];if(seller){r=seller;label=`Buy ${ITEMS[job.item]?.name??job.item} from ${seller.name}, then return to the client`;}}
    if (!r) return null;
    return { x: r.x, z: r.z, name: r.name, label, resident: r, job };
  }
  targets() { return this.state.list.map((j) => this.target(j.id)).filter(Boolean); }
}

/** "14:30" for an absolute game time. */
export function clockLabel(abs) {
  if (!Number.isFinite(abs)) return '—';
  const m = ((Math.round(abs) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
/** "1 h 20 min" */
export function durationLabel(mins) {
  if (!Number.isFinite(mins)) return 'no limit';
  mins = Math.max(0, Math.round(mins));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h ? `${h} h${m ? ` ${m} min` : ''}` : `${m} min`;
}
