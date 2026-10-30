/**
 * Versioned local save (browser localStorage).
 * - SAVE_VERSION bumps whenever the shape changes; migrate() fills defaults for new fields,
 *   so old saves keep loading as wallet, inventory, jobs, rentals etc. arrive in later milestones.
 * - Corrupt or unreadable data never crashes the game: it is quarantined under a backup key.
 * - Starting a new game requires explicit confirmation in the UI and keeps a backup of the old save.
 */
import { newMissionState } from '../jobs/MissionDefinitions.js';
export const SAVE_VERSION = 23;
import { backgroundInfo, randomBackground } from '../data/backgrounds.js';
import { validateSave } from './validateSave.js';
import { migrateFurniturePieces } from '../life/HomeUpgrades.js';
import { ECONOMY_CONFIG } from '../data/catalogue.js';
import { newActivities, ensureActivities } from '../activities/ActivityRecords.js';
import { newLife, migrateLife, retireStory } from '../life/LifeMigration.js';
import { newBank, ensureBank } from '../money/Bank.js';
import { newOrgs, ensureOrgs } from '../business/Business.js';
import { newJustice, ensureJustice } from '../justice/Cases.js';
import { newPolitics, ensurePolitics } from '../politics/Politics.js';
import { newEducation, ensureEducation } from '../data/education.js';
import { newVentures, ensureVentures } from '../data/ventures.js';
import { newNews, ensureNews } from '../life/NewsFeed.js';
import { newContracts, ensureContracts } from '../business/Contracts.js';
let KEY = 'onitshaway:save';
let BACKUP_KEY = 'onitshaway:save:backup';
const SETTINGS_KEY = 'onitshaway:settings';
let CREATION_KEY = 'onitshaway:creation-background';

// Real civil time is the normal-play policy, not an inherited accelerated preference.
export function normalizeSettings(defaults, saved = {}) {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  return { ...defaults, ...saved, clockMode: 'real', clockSpeed: 1,
    liveWeather: saved.clockFixVersion === 1 ? saved.liveWeather === true : false,
    clockFixVersion: 1 };
}

const storage = {
  get(k) { try { return window.localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { window.localStorage.removeItem(k); } catch { /* ignore */ } },
};

export function defaultSave(character) {
  return {
    version: SAVE_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    story: null,
    lifeStart: null,                 // legacy saves keep their progress and balance
    character,                       // { name, gender, skin, hair, outfit, palette, color }
    player: null,                    // { x, z, heading }
    clock: { day: 1, minutes: 9 * 60 },
    // reserved for later milestones — present now so the format is stable
    wallet: { balance: ECONOMY_CONFIG.startingBalance, ledger: [], processed: [] },
    inventory: { slots: ECONOMY_CONFIG.bagSlots, items: [] },
    jobs: { list: [], completed: [], log: [], tracked: null, missions: newMissionState() },
    needs: { hunger: 80, energy: 85, fun: 75, social: 75, hygiene: 90, bladder: 90 },
    skills: {}, phone: { model: character?.phone ?? 'osha', messages: [], bets: {}, work: {}, seq: 0 },
    street: { resolved: {} },
    transit: { seq: 0, log: [] },
    housing: { rentals: {}, storage: {}, lamps: {}, owned: {} },
    business: { riders: [], trips: 0, earned: 0, seq: 0 },
    wholesale: { bought: {}, orders: [], done: [] },
    police: { seq: 0, wanted: 0, owed: [], warned: null, held: {} },
    activities: newActivities(),     // v16: football (and later pool, board games…) results and achievements
    life: newLife(),                 // v18: occupations, seven-sided reputation, legal record
    bank: newBank(), orgs: newOrgs(), contracts: newContracts(), // v19: banks and loans, businesses and fleets, escrowed contracts
    justice: newJustice(), // v20: cases, court, stolen goods, academy, duty, Hustle Kingdom
    politics: newPolitics(), // v21: voter registration, party, seasons and races, office, public projects
    education: newEducation(), // v22: university programme, lectures, degrees
    ventures: newVentures(), // v23: events, decorating, agency, lets, builds, security, crew, football
    news: newNews(), // v23: the city's news feed
    rentals: [], vehicles: [], relationships: {}, world: { stock: {}, weatherSeed: (Math.random() * 1e9) | 0 },
  };
}

export function migrate(data) {
  validateSave(data);
  const v = data.version ?? 0;
  if (v > SAVE_VERSION) throw new Error(`save version ${v} is newer than this build (${SAVE_VERSION})`);
  const base = defaultSave(data.character);
  const out = { ...base, ...data, version: SAVE_VERSION };
  if (!out.character || !out.character.gender) throw new Error('save has no character');
  out.clock = { ...base.clock, ...(data.clock ?? {}) };
  // v1 → v2: Milestone 2 enlarged the map and moved its origin, so old positions point to the
  // wrong place. Keep the character and clock; the player restarts on Old Market Road.
  if (v < 2) out.player = null;
  // v2 → v3: Milestone 4 adds the wallet, bag and jobs. Older saves start with the standard balance.
  if (!out.wallet || !Number.isInteger(out.wallet.balance)) out.wallet = base.wallet;
  if (!out.inventory || Array.isArray(out.inventory)) out.inventory = base.inventory;
  if (!out.jobs || !Array.isArray(out.jobs.completed)) out.jobs = base.jobs;
  out.jobs.log ??= [];
  out.jobs.missions ??= newMissionState();
  // v3 → v4: Milestone 5 allows several jobs with deadlines (the single active job is kept, with no
  // deadline), and adds energy, the transport trip log and traders' stock.
  if (!Array.isArray(out.jobs.list)) { out.jobs.list = out.jobs.active ? [{ ...out.jobs.active, deadline: null }] : []; }
  delete out.jobs.active;
  out.jobs.tracked ??= out.jobs.list[0]?.id ?? null;
  if (!out.needs || !Number.isFinite(out.needs.energy)) out.needs = base.needs;
  if (!out.transit || !Array.isArray(out.transit.log)) out.transit = base.transit;
  out.world = out.world && typeof out.world === 'object' ? out.world : {};
  out.world.stock ??= {};
  // v4 → v5: Milestone 6 adds rented homes (with a cupboard each), owned vehicles and sold-vehicle spots.
  if (!out.housing || typeof out.housing !== 'object') out.housing = base.housing;
  out.housing.rentals ??= {}; out.housing.storage ??= {}; out.housing.lamps ??= {};
  if (!Array.isArray(out.vehicles)) out.vehicles = [];
  out.vehicles = out.vehicles.filter((v) => v && typeof v.id === 'string' && Number.isFinite(v.x) && Number.isFinite(v.z));
  out.world.soldVehicles ??= [];
  // v5 → v6: Milestone 7 adds the weather seed (a migrated save gets one derived from the character, so its
  // weather is stable), the keke business, wholesale orders, and vehicle damage (none on older vehicles).
  if (!Number.isInteger(out.world.weatherSeed)) { let h = 2166136261; for (const ch of `${out.character.name}:${out.createdAt ?? ''}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } out.world.weatherSeed = h >>> 0; }
  if (!out.business || typeof out.business !== 'object') out.business = base.business;
  out.business.riders = []; // nobody stays in a keke across a reload
  out.business.trips ??= 0; out.business.earned ??= 0; out.business.seq ??= 0;
  if (!out.wholesale || typeof out.wholesale !== 'object') out.wholesale = base.wholesale;
  out.wholesale.bought ??= {}; out.wholesale.orders ??= []; out.wholesale.done ??= [];
  for (const v of out.vehicles) {v.damage = Number.isFinite(v.damage) ? Math.max(0, Math.min(100, v.damage)) : 0;v.fuel=Number.isFinite(v.fuel)?Math.max(0,v.fuel):0;v.odo=Number.isFinite(v.odo)?Math.max(0,v.odo):0;v.heading=Number.isFinite(v.heading)?v.heading:0;v.repairSeq??=0;}
  // v6 → v7: traffic police (fines owed, wanted, held vehicles).
  if (!out.police || typeof out.police !== 'object') out.police = base.police;
  out.police.seq ??= 0; out.police.wanted ??= 0; out.police.owed ??= []; out.police.warned ??= null; out.police.held ??= {};
  // v7 → v8: six needs, skills, phone, furnishings and street encounters.
  for (const [id, value] of Object.entries(base.needs)) if (!Number.isFinite(out.needs[id])) out.needs[id] = value;
  out.skills = data.skills && typeof data.skills === 'object' && !Array.isArray(data.skills) ? data.skills : {};
  out.phone = { ...base.phone, ...(data.phone && typeof data.phone === 'object' ? data.phone : {}) };
  if (!Array.isArray(out.phone.messages)) out.phone.messages = [];
  for (const id of ['bets', 'work']) if (!out.phone[id] || typeof out.phone[id] !== 'object' || Array.isArray(out.phone[id])) out.phone[id] = {};
  if (!Number.isInteger(out.phone.seq) || out.phone.seq < 0) out.phone.seq = 0;
  if (!['osha', 'niger', 'palm'].includes(out.phone.model)) out.phone.model = 'osha';
  out.street = data.street && typeof data.street === 'object' ? data.street : { resolved: {} };
  out.street.resolved ??= {};
  out.housing.upgrades ??= {}; out.housing.owned ??= {};
  // v16 → v17: furniture becomes individual pieces (two armchairs can each be placed, recoloured or sold).
  for (const s of Object.values(out.housing.upgrades)) if (s && typeof s === 'object' && !Array.isArray(s) && !Array.isArray(s.pieces)) migrateFurniturePieces(s);
  // v9 → v10: never assign a new background or credit a grant when loading an existing life.
  const origin = data.lifeStart && backgroundInfo(data.lifeStart.background);
  out.lifeStart = origin ? { background: origin.id, initialBalance: origin.balance, homeId: typeof data.lifeStart.homeId === 'string' ? data.lifeStart.homeId : null } : null;
  // v15 → v16: city activities. Older lives start with an empty record; nothing else changes.
  ensureActivities(out);
  // v17 → v18: open life. The old career becomes a job, past work counts, story trust/heat seed reputation, police matters seed the record.
  out.life = migrateLife(data);
  retireStory(out);
  // v18 → v19: banks, businesses, contracts (an older life simply has none yet).
  out.bank = ensureBank(data.bank); out.orgs = ensureOrgs(data.orgs); out.contracts = ensureContracts(data.contracts);
  // v19 → v20: crime, cases and the courts (an older life has a clean slate).
  out.justice = ensureJustice(data.justice);
  // v20 → v21: politics (an older life isn't registered, in no party, holds no office).
  out.politics = ensurePolitics(data.politics);
  // v21 → v22: education (an older life has no degree yet).
  out.education = ensureEducation(data.education);
  // v22 → v23: ventures and the news (an older life has none yet).
  out.ventures = ensureVentures(data.ventures); out.news = ensureNews(data.news);
  out.business.line ??= null;
  for (const v of out.vehicles) { v.dirt = Number.isFinite(v.dirt) ? Math.max(0, Math.min(1, v.dirt)) : 0; if (v.polished != null && !Number.isInteger(v.polished)) delete v.polished; }
  return out;
}

export const SaveSystem = {
  scope: null,
  setScope(id) {
    if (id && !/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid account save scope');
    this.scope = id || null; this._creationBackground = null;
    KEY = id ? `onitshaway:account:${id}:save` : 'onitshaway:save';
    BACKUP_KEY = KEY + ':backup';
    CREATION_KEY = id ? `onitshaway:account:${id}:creation-background` : 'onitshaway:creation-background';
  },
  hasSave() { return !!storage.get(KEY); },

  /** Keep the random draw across styling edits, Back and reload. No reroll control. */
  creationBackground() {
    if (backgroundInfo(this._creationBackground)) return this._creationBackground;
    const pending = storage.get(CREATION_KEY);
    const id = backgroundInfo(pending) ? pending : randomBackground();
    this._creationBackground = id; storage.set(CREATION_KEY, id); return id;
  },
  completeCreation() { this._creationBackground = null; storage.del(CREATION_KEY); },

  load() {
    const raw = storage.get(KEY);
    if (!raw) return { ok: false, reason: 'none' };
    try {
      return { ok: true, data: migrate(JSON.parse(raw)) };
    } catch (e) {
      console.warn('[Save] unreadable save quarantined:', e.message);
      storage.set(BACKUP_KEY + ':corrupt', raw);
      return { ok: false, reason: 'corrupt', error: e.message };
    }
  },

  /** Called after every successful local save (the cloud save uploads a little later). */
  onSaved: null,
  save(data) {
    const d = { ...data, version: SAVE_VERSION, updatedAt: new Date().toISOString() };
    const ok = storage.set(KEY, JSON.stringify(d));
    if (ok) try { this.onSaved?.(); } catch (e) { console.warn('[Save] cloud hook failed:', e.message); }
    return ok;
  },

  /** Put a save that came from the account server in place, exactly as sent (checked first; the old copy is backed up). */
  writeRaw(text) {
    try { migrate(JSON.parse(text)); } catch (e) { return { ok: false, error: e.message || 'unreadable' }; }
    this.backupCurrent();
    return storage.set(KEY, text) ? { ok: true } : { ok: false, error: 'storage is full or blocked' };
  },

  /** The stored save as text (for export). */
  raw() { return storage.get(KEY); },

  /** Replace the save with an imported one, after checking and migrating it. The old save is backed up. */
  importRaw(text) {
    let data;
    try { data = migrate(JSON.parse(text)); } catch (e) { return { ok: false, error: e.message || 'unreadable' }; }
    if (!data.wallet || !data.clock) return { ok: false, error: 'missing game data' };
    this.backupCurrent();
    if (!this.save(data)) return { ok: false, error: 'storage is full or blocked' };
    const c = data.character;
    return { ok: true, summary: { name: c.name || 'Player', day: data.clock.day } };
  },

  /** Back up the existing save (one level) before a confirmed new game overwrites it. */
  backupCurrent() { const raw = storage.get(KEY); if (raw) storage.set(BACKUP_KEY, raw); },

  summary() {
    const r = this.load();
    if (!r.ok) return null;
    const c = r.data.character;
    const hh = Math.floor(r.data.clock.minutes / 60), mm = Math.floor(r.data.clock.minutes % 60);
    return { name: c.name || 'Player', day: r.data.clock.day, time: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, updatedAt: r.data.updatedAt };
  },

  loadSettings(defaults) {
    let saved = {};
    try { saved = JSON.parse(storage.get(SETTINGS_KEY) || '{}'); } catch { /* invalid settings use defaults */ }
    const settings = normalizeSettings(defaults, saved);
    storage.set(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  },
  saveSettings(s) { storage.set(SETTINGS_KEY, JSON.stringify(s)); },
};
