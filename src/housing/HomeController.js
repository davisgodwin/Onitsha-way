import { relocateHomes } from './Relocate.js';
import { pickFlatUnits } from './FlatUnits.js';
import * as THREE from 'three';
import { calendar } from '../sim/Calendar.js';
import {GOOD_BY_ID} from '../buy/Goods.js';
import {TV_CHANNELS} from '../life/TVShows.js';
import { HomeDecor } from './HomeDecor.js';
import { pickListings, pickHostHome, HousingSystem, doorOf } from './HousingSystem.js';
import { buildInteriors } from './Interiors.js';
import { recipeStatus, cook } from './Kitchen.js';
import { Inventory } from '../economy/Inventory.js';
import { naira } from '../economy/Economy.js';
import { CONFIG } from '../config.js';
import { OUTFITS, OUTFIT_COLORS, SHOE_COLORS, HAIR_STYLES, OUTFIT_CATEGORIES } from '../characters/HumanRig.js';
import { ANKARA_PALETTES } from '../characters/ClothingTextures.js';
import { durationLabel } from '../jobs/JobSystem.js';
import { RENT_GRACE_DAYS, HOME_TYPES } from '../data/housing.js';

/*
  Homes as the player experiences them: doors and TO LET signs on real houses, renting and renewing at
  the door, going in and out (with a short fade), the furniture inside, and safe restore after a save.
  Access rules come from HousingSystem: tenants use everything; a vacant listing can be viewed but not
  used; a home whose rent ran out is locked until you renew.
  While you are inside, the world keeps running around the front door (that is the "focus").
*/

function signTexture(lines, bg, fg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(5, 5, 246, 118);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '900 44px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText(lines[0], 128, 48);
  g.font = '700 20px "DM Sans", system-ui, sans-serif'; g.fillText(lines[1], 128, 96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class HomeController {
  constructor(game) { this.g = game; this.inside = null; this.offs = []; }

  /** At load: pick the listings, build the shared interiors and the doors/signs. */
  setup() {
    const g = this.g, map = g.world.map, col = g.world.collision;
    const doorOk = (d) => {
      const st = d.stand;
      if (!col.isFree(st.x, st.z, 0.45)) return false;
      const nr = map.nearestRoad(st.x, st.z, { maxDist: 26 });
      if (!nr) return false;
      // a clear walk from the door out towards the street (no compound wall or gate in the way)
      const L = Math.min(26, nr.dist + 1.5);
      return col.raycast(st.x, st.z, st.x + d.nx * L, st.z + d.nz * L) >= 1;
    };
    const streetAt = (x, z) => map.nearestRoad(x, z, { named: true, maxDist: 80 })?.road.displayName ?? null;
    this.doorOk = doorOk; this.streetAt = streetAt;
    this.listings = pickListings(map, { doorOk, streetAt });
    // v0.38: two rentable flats in each of some storey buildings and apartment blocks (about 90 homes in all)
    this.listings.push(...pickFlatUnits(g.world.city, { doorOk, streetAt, existing: this.listings }));
    // v0.48: homes outside Onitsha (the Niger island is Delta State) are no longer listed; a save that used one moves
    const pa = g.world.playArea; this.lockedListings = this.listings.filter((h) => pa?.locked(h.door.stand.x, h.door.stand.z));
    if (this.lockedListings.length) this.listings = this.listings.filter((h) => !this.lockedListings.includes(h));
    this.interiors = buildInteriors(g.renderer.scene, col);
    this.buildEntrances();
    this.visitGroup = new THREE.Group(); this.visitGroup.name = 'VisitDoors'; g.renderer.scene.add(this.visitGroup);
    this.visits = new Map();
    g.interactions.register({
      get x() { return g.homes.inside?.hostBody?.x ?? 1e9; }, get z() { return g.homes.inside?.hostBody?.z ?? 1e9; }, radius: 2.2,
      enabled: () => !!this.inside?.host,
      label: () => `Talk with ${this.visits.get(this.inside.host)?.rel.name ?? 'your host'}`,
      onInteract: () => g.openChoice(() => this.visitView()),
    });
    // interactions: the doors outside, the furniture inside
    for (const home of this.listings) {
      g.interactions.register({
        x: home.door.stand.x, z: home.door.stand.z, radius: 1.9,
        enabled: () => !this.inside && !!this.housing && !g.vehicles?.driving,
        label: () => this.doorLabel(home),
        onInteract: () => this.doorAction(home),
      });
    }
    this.decor = new HomeDecor(g);
    this.itemOffs = {};
    for (const lay of Object.values(this.interiors.layouts)) this.registerItems(lay);
  }

  /**
   * v0.49: more homes to rent or buy, in the walled houses of the new rows (and the houses on empty land). Called
   * once the city is filled; each new home gets its door, sign and use point like the others. Ids are fixed
   * (`home:lot:N`, `home:infill:N`), picked in a fixed order, so a save that rents or owns one finds it again.
   */
  addListings(houses, max = 160, { cellSize = 260, spacing = 90, spread = 140 } = {}) {
    const g = this.g, col = g.world.collision, pa = g.world.playArea, out = [], cell = new Set(), hash = (t) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
    const area = (pts) => { let a = 0; for (let i = 0; i < pts.length; i++) { const [x1, z1] = pts[i], [x2, z2] = pts[(i + 1) % pts.length]; a += x1 * z2 - x2 * z1; } return Math.abs(a) / 2; };
    const near = (x, z) => this.listings.some((h) => Math.hypot(h.door.x - x, h.door.z - z) < spacing) || out.some((h) => Math.hypot(h.door.x - x, h.door.z - z) < spread);
    for (const h of [...houses].sort((a, b) => hash('home:' + a.id) - hash('home:' + b.id))) {
      if (out.length >= max) break;
      const door = doorOf({ pts: h.pts, front: h.front }); if (!door || pa?.locked(door.stand.x, door.stand.z) || !col.isFree(door.stand.x, door.stand.z, 0.45) || near(door.x, door.z)) continue;
      const k = Math.floor(door.x / cellSize) + ',' + Math.floor(door.z / cellSize); if (cell.has(k)) continue; cell.add(k);
      const a = area(h.pts), gra = h.tier === 'gra' || (g.world.districts?.premiumAt(door.x, door.z) ?? 0) > 0.5;
      const type = h.levels >= 2 && a >= 110 ? 'duplex' : gra ? (a >= 140 ? 'bungalow' : 'flat') : a >= 120 ? 'flat' : a >= 88 ? 'roomparlour' : 'selfcon', T = HOME_TYPES[type];
      out.push({ id: `home:${h.id}`, buildingId: h.id, type, label: gra ? `${T.label} · GRA` : T.label, blurb: `${T.blurb} A walled compound with its own gate.`, rent: gra ? Math.round(T.rent * 1.4 / 500) * 500 : T.rent, days: T.days, interior: T.interior, door, area: Math.round(a), street: this.streetAt(door.x, door.z), levels: h.levels, pts: h.pts, compound: true });
    }
    if (!out.length) return 0;
    this.listings.push(...out);
    const { doorGeo, doorMat, frameGeo, frameMat } = this.doorParts, signGeo = new THREE.PlaneGeometry(1.1, 0.55);
    for (const home of out) {
      const d = home.door, yaw = Math.atan2(d.nx, d.nz);
      const door = new THREE.Mesh(doorGeo, doorMat); door.position.set(d.x + d.nx * 0.05, 0, d.z + d.nz * 0.05); door.rotation.y = yaw;
      const frame = new THREE.Mesh(frameGeo, frameMat); frame.position.copy(door.position); frame.rotation.y = yaw;
      const sign = new THREE.Mesh(signGeo, this.signMats.tolet); sign.position.set(d.x + d.nx * 0.09 + d.ux * 1.05, 1.7, d.z + d.nz * 0.09 + d.uz * 1.05); sign.rotation.y = yaw;
      this.entrances.add(door, frame, sign); this.signs.set(home.id, sign);
      g.interactions.register({ x: d.stand.x, z: d.stand.z, radius: 1.9, enabled: () => !this.inside && !!this.housing && !g.vehicles?.driving, label: () => this.doorLabel(home), onInteract: () => this.doorAction(home) });
    }
    return out.length;
  }

  /** Use points for the furniture of a layout (again after it's rebuilt at another size). */
  registerItems(lay) {
    const g = this.g;
    for (const off of this.itemOffs[lay.id] ?? []) off();
    this.itemOffs[lay.id] = lay.items.map((it) => g.interactions.register({
      x: it.x, z: it.z, radius: it.radius,
      enabled: () => this.inside?.layout === lay,
      label: () => this.itemLabel(it),
      onInteract: () => this.useItem(it),
    }));
  }

  /** Inside size of a house: its footprint along the front wall (width) and back from it (depth), less walls. */
  roomSize(home) {
    const b = home.pts ? { pts: home.pts } : this.g.world.map.buildings.find((x) => x.id === home.buildingId);
    const d = home.door; if (!b || !d) return null;
    let u0 = Infinity, u1 = -Infinity, n0 = Infinity, n1 = -Infinity;
    for (const [x, z] of b.pts) { const u = x * d.ux + z * d.uz, n = x * d.nx + z * d.nz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); n0 = Math.min(n0, n); n1 = Math.max(n1, n); }
    return { W: u1 - u0 - 0.5, D: n1 - n0 - 0.5 };
  }

  buildEntrances() {
    const doorGeo = new THREE.BoxGeometry(1.0, 2.15, 0.1); doorGeo.translate(0, 1.075, 0);
    const doorMat = new THREE.MeshStandardMaterial({ color: '#5e3b22', roughness: 0.7 });
    const frameGeo = new THREE.BoxGeometry(1.2, 2.3, 0.06); frameGeo.translate(0, 1.15, -0.03);
    const frameMat = new THREE.MeshStandardMaterial({ color: '#d9d1c1', roughness: 0.8 });
    const signGeo = new THREE.PlaneGeometry(1.1, 0.55);
    this.signMats = {
      tolet: new THREE.MeshStandardMaterial({ map: signTexture(['TO LET', 'Ask the landlord'], '#ffffff', '#c81d25'), roughness: 0.6 }),
      home: new THREE.MeshStandardMaterial({ map: signTexture(['HOME', 'Your place'], '#1f7a3a', '#ffffff'), roughness: 0.6 }),
      due: new THREE.MeshStandardMaterial({ map: signTexture(['RENT DUE', 'See the landlord'], '#f2a20c', '#15110e'), roughness: 0.6 }),
    };
    this.entrances = new THREE.Group(); this.entrances.name = 'HomeEntrances';
    this.signs = new Map();
    for (const home of this.listings) {
      const d = home.door, yaw = Math.atan2(d.nx, d.nz);
      const door = new THREE.Mesh(doorGeo, doorMat); door.position.set(d.x + d.nx * 0.05, 0, d.z + d.nz * 0.05); door.rotation.y = yaw;
      const frame = new THREE.Mesh(frameGeo, frameMat); frame.position.copy(door.position); frame.rotation.y = yaw;
      const sign = new THREE.Mesh(signGeo, this.signMats.tolet);
      sign.position.set(d.x + d.nx * 0.09 + d.ux * 1.05, 1.7, d.z + d.nz * 0.09 + d.uz * 1.05); sign.rotation.y = yaw;
      this.entrances.add(door, frame, sign);
      this.signs.set(home.id, sign);
    }
    this.g.renderer.scene.add(this.entrances);
    this.doorParts = { doorGeo, doorMat, frameGeo, frameMat };
  }

  // ------------------------------------------------------------------ visiting people
  /*
    Someone who likes you enough invites you round ("tinyelu m ahu"). Accepting gives you their house —
    a real house near where you met — on the map. Knock between 09:00 and 21:00: they let you in, you
    can eat with them (once a day) and gist (both build the relationship). Their rooms use the same
    interiors as rented homes, in their own colours; you can't use their things.
  */
  /** Called when you accept an invitation. Returns the host's house (or null if none fits there). */
  addVisit(identity, rel) {
    if (rel.home) { this.ensureVisit(identity.id, rel); return this.visits.get(identity.id)?.home ?? null; }
    const exclude = new Set(this.listings.map((h) => h.buildingId));
    for (const v of this.visits.values()) exclude.add(v.home.buildingId);
    const pick = pickHostHome(this.g.world.map, identity.x ?? this.g.player.position.x, identity.z ?? this.g.player.position.z, { seed: identity.id, doorOk: this.doorOk, exclude });
    if (!pick) return null;
    rel.home = { buildingId: pick.buildingId };
    rel.look = { gender: identity.gender, template: identity.template };
    this.ensureVisit(identity.id, rel);
    return this.visits.get(identity.id).home;
  }

  /** Door, door mesh and interaction for a host's house (from the relationship record). */
  ensureVisit(id, rel) {
    if (this.visits.has(id) || !rel.home) return;
    const b = this.g.world.map.buildings.find((x) => x.id === rel.home.buildingId); if (!b) return;
    const pick = pickHostHome({ buildings: [b] }, b.pts[0][0] + 100, b.pts[0][1], { seed: id }) ?? null;
    // (re-derive the door and interior from the footprint; the 100 m offset just passes the distance filter)
    if (!pick) return;
    const home = { id: `visit:${id}`, buildingId: b.id, label: `${rel.name}'s house`, interior: pick.interior, door: pick.door, area: pick.area, street: this.streetAt(pick.door.x, pick.door.z), host: id };
    const d = home.door, yaw = Math.atan2(d.nx, d.nz), P = this.doorParts;
    const door = new THREE.Mesh(P.doorGeo, P.doorMat); door.position.set(d.x + d.nx * 0.05, 0, d.z + d.nz * 0.05); door.rotation.y = yaw;
    const frame = new THREE.Mesh(P.frameGeo, P.frameMat); frame.position.copy(door.position); frame.rotation.y = yaw;
    this.visitGroup.add(door, frame);
    const off = this.g.interactions.register({
      x: d.stand.x, z: d.stand.z, radius: 1.9,
      enabled: () => !this.inside && !this.g.vehicles?.driving && this.visits.get(id)?.home === home,
      label: () => `Knock: ${rel.name}'s house`,
      onInteract: () => this.knock(id),
    });
    this.visits.set(id, { home, rel, meshes: [door, frame], off });
  }

  clearVisits() {
    for (const v of this.visits?.values() ?? []) { v.off(); for (const m of v.meshes) this.visitGroup.remove(m); }
    this.visits = new Map();
  }

  knock(id) {
    const g = this.g, v = this.visits.get(id); if (!v) return;
    const h = g.clock.minutes / 60;
    if (h < 9 || h >= 21) { g.ui.toast(`No answer. ${v.rel.name} must be sleeping — come back between 09:00 and 21:00.`); return; }
    g.audio?.footstep?.('hard', 0.6);
    this.enter(v.home, { viewing: true, host: id });
  }

  /** Put the host in the room (a pooled NPC body with their own look). */
  placeHost(id, lay) {
    const g = this.g, v = this.visits.get(id);
    const sofa = lay.items.find((it) => it.kind === 'sofa') ?? lay.items.find((it) => it.kind !== 'door') ?? lay.spawn;
    const x = (sofa.x + lay.spawn.x) / 2, z = (sofa.z + lay.spawn.z) / 2;
    const identity = { id, kind: 'host', role: v.rel.role === 'trader' ? 'trader' : 'walker', name: v.rel.name, gender: v.rel.look?.gender ?? 'male', template: v.rel.look?.template ?? 0, x, z, yaw: Math.atan2(lay.spawn.x - x, lay.spawn.z - z), schedule: [0, 24], presence: 1 };
    const npc = g.npcs.embody(identity, 'stand');
    if (npc) npc.role = identity.role;
    return { npc, x, z };
  }

  visitView() {
    const g = this.g, i = this.inside; if (!i?.host) return null;
    const v = this.visits.get(i.host), rel = v.rel, day = g.clock.day;
    const ate = rel.mealDay === day, gisted = rel.gistDay === day;
    const fam = rel.familiarity ?? 0;
    return {
      title: rel.name, kicker: 'VISITING',
      text: `${rel.name}: “${ate ? 'You don chop? Belle full?' : fam >= 8 ? 'Nnọọ! Sit down, sit down. Food dey — you go chop.' : 'Ehen, you come! Nnọọ. Sit down make I bring something.'}”`,
      note: 'Eating together and gisting make you closer friends. Once a day each.',
      options: [
        { label: 'Eat with them', sub: ate ? 'Already ate here today' : '+35 energy · about 40 minutes', primary: !ate, disabled: ate, why: 'You ate here today',
          act: () => { g.closeChoice(); g.ui.fade(() => { g.skipTime(40, { resting: 35 }); rel.mealDay = day; rel.positive += 2; g.needs.adjust({hunger:40,social:15}); g.ui.toast(`Rice and stew, plenty meat. Thank you, ${rel.name}!`); this.applyLight(); g.saveGame(); }); } },
        { label: 'Gist for a while', sub: gisted ? 'You have gisted today' : 'About an hour', disabled: gisted, why: 'You have gisted today',
          act: () => { g.closeChoice(); g.ui.fade(() => { g.skipTime(60, { resting: 6 }); rel.gistDay = day; rel.positive += 1; rel.talks += 1; g.needs.adjust({social:35,fun:15}); g.skills?.add('charisma',20); g.ui.toast(`You and ${rel.name} gisted about everything — the market, the area, family.`); this.applyLight(); g.saveGame(); }); } },
        { label: 'Thank them and go', act: () => { g.closeChoice(); this.exit(); } },
        { label: 'Stay a bit', ghost: true, act: () => g.closeChoice() },
      ],
    };
  }

  /** On entering the world: housing state from the save; restore inside a home safely. */
  start(saveData) {
    const g = this.g;
    saveData.housing ??= { rentals: {}, storage: {}, lamps: {} };
    saveData.housing.lamps ??= {};
    const moved = relocateHomes(saveData, this.lockedListings ?? [], this.listings);
    for (const m of moved) setTimeout(() => g.ui.toast(`Your home was in Delta State (COMING SOON), so your tenancy and everything in it moved to a ${m.label}${m.street ? ' on ' + m.street : ''} in Onitsha.`), 1500);
    this.housing = new HousingSystem(saveData.housing, { economy: g.economy, listings: this.listings, bus: g.bus, now: () => g.nowAbs() });
    this.inside = null; this.decor?.clear();
    this.refreshSigns();
    this.clearVisits();
    for (const [id, rel] of Object.entries(saveData.relationships ?? {})) if (rel.home) this.ensureVisit(id, rel);
  }

  /** Called by the Game right after placing the player from a save. */
  restore(pos) {
    if (!pos?.inside) return;
    const home = this.housing.get(pos.inside);
    // only straight back inside if you still rent it; otherwise you are at the front door (pos is the step outside)
    if (home && this.housing.access(home.id).use) { this.enter(home, { fade: false }); if (pos.floor === 'up' && home.type === 'duplex') this.switchFloor('up'); }
    else if (home) this.g.ui.toast(this.housing.status(home.id) === 'due' ? 'Your rent ran out while you were away — renew at the door' : 'You are outside the house');
  }

  refreshSigns() {
    if (!this.housing) return;
    for (const home of this.listings) {
      const s = this.housing.status(home.id);
      this.signs.get(home.id).material = s === 'tenant' ? this.signMats.home : s === 'due' ? this.signMats.due : this.signMats.tolet;
    }
  }

  // ------------------------------------------------------------------ doors
  doorLabel(home) {
    const s = this.housing.status(home.id);
    if (s === 'tenant') return `Enter your home (${home.label})`;
    if (s === 'due') return `Rent due — renew ${home.label} (${naira(home.rent)})`;
    return `To let: ${home.label} · ${naira(home.rent)} / ${home.days} days`;
  }

  doorAction(home) {
    const s = this.housing.status(home.id);
    if (s === 'tenant') { this.g.openChoice(()=>this.homeMenu(home)); return; }
    this.g.openChoice(() => this.rentView(home));
  }

  homeMenu(home){const g=this.g,h=this.housing;return{sheet:true,title:home.label,kicker:h.state.owned[home.id]?'YOUR PROPERTY':'YOUR HOME',text:'',options:[{label:'Enter home',primary:true,act:()=>{g.closeChoice();this.enter(home);}},{label:'Secure vehicle garage',act:()=>g.openChoice(()=>g.garage.view(home))},...(!h.state.owned[home.id]?[this.buyOption(home)]:[]),{label:'Done',ghost:true,act:()=>g.closeChoice()}]};}
  buyOption(home){const g=this.g,h=this.housing,price=h.purchasePrice(home.id);return{label:'Buy permanently — '+naira(price),sub:'No more rent · secure garage · respawn home',disabled:!g.economy.canAfford(price),why:'Not enough money',act:()=>g.openChoice(()=>({title:'Buy '+home.label+'?',text:'Pay '+naira(price)+' once. Existing rent is not deducted. Prices are fictional game naira. Your furniture is retained.',options:[{label:'Confirm home purchase',primary:true,act:()=>{const r=h.buy(home.id);if(!r.ok){g.ui.toast('Could not buy this home: '+r.error);return;}g.garage.site(home);g.saveGame();this.refreshSigns();g.closeChoice();g.ui.toast('Home purchased. You will respawn here on restart.');}},{label:'Cancel',act:()=>g.closeChoice()}]}))};}

  rentView(home, { insideView = false } = {}) {
    const g = this.g, h = this.housing, s = h.status(home.id);
    const can = g.economy.canAfford(home.rent);
    const options = [];
    if (s === 'vacant' && !insideView) options.push({ label: 'Look inside', sub: 'The landlord lets you look round first', act: () => { g.closeChoice(); this.enter(home, { viewing: true }); } });
    options.push({
      label: s === 'due' ? `Renew — ${naira(home.rent)} for ${home.days} days` : `Rent it — ${naira(home.rent)} for ${home.days} days`,
      primary: true, disabled: !can, why: 'Not enough money',
      act: () => {
        const r = h.rent(home.id);
        if (!r.ok) { g.ui.toast(r.error === 'insufficient-funds' ? `You need ${naira(home.rent)}` : 'Could not rent it'); return; }
        g.closeChoice(); this.refreshSigns(); g.saveGame();
        g.ui.toast(s === 'due' ? 'Rent renewed — welcome back' : `${home.label} is yours until ${this.untilLabel(home)}`);
        if (this.inside?.home === home) { this.inside.viewing = false; this.refreshDecor(); this.applyLight(); } 
      },
    });
    if(!h.state.owned[home.id])options.push(this.buyOption(home));
    options.push({ label: insideView ? 'Not now' : 'Not now', ghost: true, act: () => g.closeChoice() });
    const left = h.left(home.id);
    return {
      title: `${home.label}${home.street ? ' — ' + home.street : ''}`, kicker: s === 'due' ? 'RENT DUE' : 'TO LET',
      text: `${home.blurb} About ${home.area} m² of floor space.`,
      note: s === 'due' ? `Your rent ran out ${durationLabel(-left)} ago. Renew within ${durationLabel(RENT_GRACE_DAYS * 1440 + left)} or the place goes back on the market (your things stay in the cupboard).`
        : `Fitted kitchen, bulbs and bathroom included. Buy and arrange movable furniture in Buy mode. Rent is paid ahead, ${home.days} days at a time. You have ${naira(g.economy.balance)}.`,
      options,
    };
  }

  untilLabel(home) {
    if(this.housing.state.owned[home.id])return 'permanent ownership';
    const r = this.housing.state.rentals[home.id]; if (!r) return '—';
    const d = Math.floor(r.until / 1440), m = r.until % 1440;
    return `${calendar(d).label}, ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }

  // ------------------------------------------------------------------ in / out
  /** Each home's own floor plan is generated from its id (NPC hosts' houses from theirs). */
  planKey(home) { return String(home.id); }
  /** Ceiling bulbs the tenant took out of this home (per floor), so they stay out. */
  removedLamps(home, layoutId, host) { if (host || !this.g.homeUpgrades || !this.housing?.access(home.id).use) return []; const r = this.g.homeUpgrades.home(home.id).removedLamps?.[layoutId]; return Array.isArray(r) ? r.filter(Number.isInteger).sort((a, b) => a - b) : []; }
  /** Take a room's bulb and switch out, or put them back (free). Rebuilds the room. */
  setLampRemoved(index, removed) {
    const i = this.inside; if (!i || i.host || i.viewing || !this.housing.access(i.home.id).use) return { ok: false, error: 'Enter your own home first' };
    const s = this.g.homeUpgrades.home(i.home.id), list = new Set((s.removedLamps ??= {})[i.layout.id] ?? []);
    if (removed) list.add(index); else list.delete(index);
    s.removedLamps[i.layout.id] = [...list].sort((a, b) => a - b);
    const lay = i.layout; if (this.interiors.resize(lay.id, lay.size[0], lay.size[1], true, this.planKey(i.home), s.removedLamps[lay.id])) this.registerItems(lay);
    this.refreshDecor(); this.applyLight(); this.g.saveGame(); return { ok: true };
  }
  enter(home, { viewing = false, fade = true, host = null } = {}) {
    const g = this.g, lay = this.interiors.layouts[home.interior];
    if (!host && !viewing && g.ventures?.isLet(home.id)) { g.ui.toast('Your tenant lives here now. End the let first (phone: Ventures).', 5000); return false; } // v0.47
    const go = () => {
      // the rooms take this house's own size
      const sz = this.roomSize(home);
      if (this.interiors.resize(home.interior, sz?.W??lay.size[0], sz?.D??lay.size[1], !host, this.planKey(home), this.removedLamps(home, home.interior, host))) this.registerItems(lay);
      g.hudTimer=0;this.inside = { home, layout: lay, viewing, host };
      if (host) this.inside.hostBody = this.placeHost(host, lay);
      this.interiors.setLook?.(home.id);
      this.refreshDecor();
      g.player.teleport(lay.spawn.x, lay.spawn.z, lay.spawn.heading);
      g.cameraRig.yaw = lay.spawn.heading + Math.PI; g.cameraRig.pitch = 0.18;
      g.cameraRig.indoor = { ceiling: lay.ceiling - 0.2, distance: 3.6, height: 1.2 };
      g.cameraRig.pitch = 0.35;
      g.cameraRig.snapTo(new THREE.Vector3(lay.spawn.x, CONFIG.camera.height, lay.spawn.z));
      this.settleCamera(lay);
      this.applyLight();
      if (host) { g.ui.toast(`${this.visits.get(host).rel.name} lets you in. Talk to them (E).`); g.openChoice(() => this.visitView()); }
      else if (!g.online?.guestHost) g.ui.toast(viewing ? `Looking round: ${home.label}. Press E at the door to leave or rent it.` : `Home — ${home.label}`); // online guests get their own welcome
    };
    if (fade) g.ui.fade(go); else go();
  }

  exit() {
    const g = this.g, home = this.inside?.home; if (!home) return; g.tvShows?.stop(true);
    const go = () => {
      const d = home.door;
      if (this.inside?.hostBody?.npc) g.npcs.release(this.inside.hostBody.npc);
      this.decor.clear();
      this.interiors.setLight({lamp:false,daylight:0});
      this.inside = null;g.hudTimer=0;
      g.cameraRig.indoor = null;
      g.atmosphere.indoor = null;
      const [x, z] = g.world.findFreeSpot(d.stand.x, d.stand.z, CONFIG.player.radius + 0.1);
      g.player.teleport(x, z, Math.atan2(d.nx, d.nz));
      g.cameraRig.yaw = Math.atan2(d.nx, d.nz) + Math.PI;
      g.cameraRig.snapTo(new THREE.Vector3(x, CONFIG.camera.height, z));
      g.saveGame();
    };
    g.ui.fade(go);
  }

  /** Where the world should stay loaded while you are inside: your front step. */
  focus() { return this.inside ? this.inside.home.door.stand : null; }

  /** Saved position: always the step outside the door, plus which home you were in. */
  savePosition() {
    if (!this.inside) return null;
    const d = this.inside.home.door;
    return { x: +d.stand.x.toFixed(2), z: +d.stand.z.toFixed(2), heading: +Math.atan2(d.nx, d.nz).toFixed(3), floor: this.inside.layout.id === 'duplexUp' ? 'up' : 'ground', inside: this.inside.viewing ? null : this.inside.home.id };
  }

  locationLabel() {
    const i = this.inside; if (!i) return null;
    return { place: i.host ? `Visiting — ${i.home.label}` : i.viewing ? `Viewing: ${i.home.label}` : `Home — ${i.home.label}`, street: i.home.street ?? 'Indoors' };
  }

  applyLight() {
    if (!this.inside) return;
    const lamps = this.housing.state.lamps;
    const night = this.g.atmosphere.nightK ?? 0;
    const want = lamps[this.inside.home.id] ?? night > 0.4;
    // a power cut: the bulb is dead unless you have a rechargeable lamp in your bag (or your host runs a generator)
    const grid = this.g.weather?.power.on ?? true;
    const backup = !this.inside.viewing && this.g.homeUpgrades?.powered(this.inside.home.id, grid);
    const state=this.g.homeUpgrades?.home(this.inside.home.id);
    const placedLights=this.decor?.records?.filter(r=>GOOD_BY_ID[r.id]?.action==='light')??[];
    const fixture=true; // Landlord ceiling bulbs are standard in every home.
    const guest=!!this.inside.host||!!this.inside.viewing;
    const switchedOn=r=>guest?want:state?.lightOn?.[r.id]!==false;
    const lantern=placedLights.some(r=>GOOD_BY_ID[r.id].rechargeable&&switchedOn(r));
    const on = (want && fixture && (grid || backup || !!this.inside.host)) || lantern || this.g.inventory.has('rechargeable-lamp');
    // Placed lamps glow when switched on and there is power (rechargeable ones work through a cut); at night only for guests.
    this.decor?.setLamps(r=>switchedOn(r)&&(grid||backup||!!this.inside.host||GOOD_BY_ID[r.id].rechargeable)&&(!guest||want));
    this.interiors.setLight({ lamp: want && (grid || backup || !!this.inside.host), daylight: 1 - night, layout:this.inside.layout });
    this.inside.layout.lightsOn = want && (grid || backup || !!this.inside.host);
    this.g.atmosphere.indoor = { lamp: on, daylight: 1 - night };
    this.decor?.updateAppliances(0);
    this.lampNote = want && !on ? 'NEPA took light — enable a charged inverter or fuelled generator, or use a rechargeable lamp.' : null;
  }

  // ------------------------------------------------------------------ furniture
  itemLabel(it) {
    const use = this.inside && !this.inside.viewing;
    if (it.kind === 'door') return this.inside?.host ? 'Door — say goodbye and go' : this.inside?.viewing ? 'Door — leave or rent this place' : 'Door — go outside';
    if (it.kind === 'switch') { const want=this.housing.state.lamps[this.inside.home.id]??(this.g.atmosphere.nightK??0)>.4;const powered=(this.g.weather?.power.on??true)||this.g.homeUpgrades?.powered(this.inside.home.id,false);return `Light switch — ${want?'switch OFF':'switch ON'}${powered?'':' (no grid / backup power)'}`; }
    if (this.inside?.host) return `${it.label.split(' — ')[0]} (not yours — you're visiting)`;
    return use ? it.label : `${it.label.split(' — ')[0]} (rent the place to use it)`;
  }

  useItem(it) {
    const g = this.g, i = this.inside; if (!i) return;
    if (it.kind === 'door') {
      if (i.host) { this.exit(); return; }
      if (g.online?.guestHost) { g.online.leaveVisit(); return; } // visiting a friend online: the door just takes you outside
      if (i.viewing && this.housing.status(i.home.id) !== 'tenant') { g.openChoice(() => ({ ...this.rentView(i.home, { insideView: true }), options: [...this.rentView(i.home, { insideView: true }).options.slice(0, -1), { label: 'Go outside', ghost: true, act: () => { g.closeChoice(); this.exit(); } }] })); return; }
      this.exit(); return;
    }
    if (it.kind === 'switch') {
      const lamps = this.housing.state.lamps, night = (g.atmosphere.nightK ?? 0) > 0.4;
      lamps[i.home.id] = !(lamps[i.home.id] ?? night);
      this.applyLight(); g.saveGame(); g.audio?.footstep?.('hard', 0.4);
      if (this.lampNote) g.ui.toast(this.lampNote);
      return;
    }
    if (i.host) { g.ui.toast('These are not your things — talk to your host'); return; }
    if (i.viewing && this.housing.status(i.home.id) !== 'tenant') { g.ui.toast('Rent the place to use this'); return; }
    if (it.kind === 'bathroom') g.openChoice(() => this.bathroomView());
    else if (it.kind === 'decorate') { g.buy.open(); }
    else if (it.kind === 'stairs') this.switchFloor(i.layout.id === 'duplexUp' ? 'ground' : 'up');
    else if (it.kind === 'bed') g.openChoice(() => this.bedView());
    else if (it.kind === 'sofa') g.openChoice(() => this.sofaView());
    else if (it.kind === 'sink') { g.needs.adjust({hygiene:8});g.ui.toast('Hands washed at the kitchen sink.');g.saveGame(); }
    else if (it.kind === 'stove') g.openChoice(() => this.stoveView());
    else if (it.kind === 'cupboard') g.openChoice(() => this.cupboardView());
    else if (it.kind === 'wardrobe') g.openChoice(() => this.wardrobeView());
  }

  bedView() {
    const g = this.g, h = g.clock.minutes / 60;
    const toMorning = Math.round(((7 - h + 24) % 24) * 60);
    const night = h >= 18 || h < 7;
    return {
      title: 'Bed', text: `It is ${g.clock.label()}. Energy ${Math.round(g.needs.energy)}%.`,
      note: g.deadlineNote(night ? toMorning : 120),
      options: [
        { label: g.clock.mode==='real'?'Sleep session (simulated rest)':'Sleep until morning (07:00)', sub: g.clock.mode==='real'?'Restores energy; real clock stays unchanged. Night only.':night ? `about ${durationLabel(toMorning)} · energy back to full` : 'Only after 18:00', disabled: !night, why: 'Too early to sleep',
          primary: true, act: () => { g.closeChoice(); if (!g.player.posture) g.posture?.lie(); g.ui.fade(() => { g.skipTime(toMorning, { sleeping: true }); g.ui.toast(g.clock.mode==='real'?`Rest complete. Real Onitsha time is still ${g.clock.label()} WAT.`:`Good morning! ${g.clock.label()}`); this.applyLight(); g.saveGame(); }); } },
        { label: g.clock.mode==='real'?'Nap session (simulated 2 hours)':'Take a nap (2 hours)', sub: '+30 energy', act: () => { g.closeChoice(); if (!g.player.posture) g.posture?.lie(); g.ui.fade(() => { g.skipTime(120, { resting: 30 }); this.applyLight(); g.ui.toast(`You napped. It is ${g.clock.label()}.`); }); } },
        { label: 'Not now', ghost: true, act: () => g.closeChoice() },
      ],
    };
  }

  sofaView() {
    const g = this.g;
    return {
      title: 'Sofa', text: 'Sit down, put on the TV and rest a little.', note: g.deadlineNote(60),
      options: [
        { label: 'Rest for an hour', sub: '+12 energy', primary: true, act: () => { g.closeChoice(); this.interiors.setTv(true); g.ui.fade(() => { g.skipTime(60, { resting: 12 }); this.interiors.setTv(false); this.applyLight(); g.ui.toast(`You rested. It is ${g.clock.label()}.`); }); } },
        { label: 'Not now', ghost: true, act: () => g.closeChoice() },
      ],
    };
  }

  stoveView(msg = null) {
    const g = this.g;
    const list = recipeStatus(g.inventory);
    return {
      title: 'Gas cooker', text: msg ?? 'Cook with foodstuff from the market. The meal goes into your bag as portions.', note: 'Cooking takes about 40 minutes.',
      options: [
        ...list.map((r) => ({ label: r.recipe.label, sub: r.ok ? `makes ${r.makes.qty} × ${r.makes.name}` : `need: ${r.missing.join(', ')}`, disabled: !r.ok, why: 'Missing ingredients',
          act: () => {
            const res = cook(g.inventory, r.recipe.id);
            if (!res.ok) { g.renderChoice(() => this.stoveView(res.error === 'bag-full' ? 'Your bag is full — make room first.' : 'Something is missing.')); return; }
            g.skills?.add('cooking', 35);
            g.closeChoice();
            g.ui.fade(() => { g.skipTime(res.minutes, {}); g.ui.toast(`Cooked: ${res.qty} × ${res.made.name} (in your bag)`); g.saveGame(); });
          } })),
        { label: 'Done', ghost: true, act: () => g.closeChoice() },
      ],
    };
  }

  cupboardView() {
    const g = this.g, i = this.inside;
    const store = new Inventory(this.housing.storage(i.home.id));
    const move = (from, to, it) => {
      const item = { id: it.id, name: it.name, kind: it.kind, unique: it.unique, meta: it.meta };
      if (!to.canAdd(item, it.qty)) { g.ui.toast(to === store ? 'The cupboard is full' : 'Your bag is full'); return; }
      const qty = it.qty;
      from.remove(it.id, qty); to.add(item, qty);
      g.renderChoice(); g.saveGame();
    };
    const bagItems = g.inventory.items.filter((it) => it.kind !== 'package');
    return {
      title: 'Cupboard', text: `Things you keep at home. Cupboard: ${store.items.length}/${store.state.slots} · Bag: ${g.inventory.items.length}/${g.inventory.state.slots}`,
      sections: [
        { heading: 'In your bag', empty: 'Nothing to put away (job parcels stay with you).', options: bagItems.map((it) => ({ label: `Put away: ${it.name}`, sub: `× ${it.qty}`, act: () => move(g.inventory, store, it) })) },
        { heading: 'In the cupboard', empty: 'The cupboard is empty.', options: store.items.map((it) => ({ label: `Take: ${it.name}`, sub: `× ${it.qty}`, act: () => move(store, g.inventory, it) })) },
      ],
      options: [{ label: 'Done', ghost: true, act: () => g.closeChoice() }],
    };
  }

  wardrobeView() {
    const g = this.g, app = g.player.appearance, gender = app.gender;
    const apply = (patch) => {
      const next = { ...app, ...patch };
      g.player.setAppearance(next); g.player.syncModel();
      g.saveData.character = { ...g.saveData.character, ...patch };
      g.renderChoice(); g.saveGame();
    };
    return {
      title: 'Wardrobe', text: 'All 16 looks use the supplied character body. Your original hairstyles, Ankara prints and clothing choices remain available. Changes are free and saved immediately.',
      sections: OUTFIT_CATEGORIES.filter(([id])=>id!=='all').map(([id,label])=>({heading:label,options:OUTFITS[gender].filter(o=>o.category===id).map(o=>({label:o.label,sub:o.id===app.outfit?'wearing now':null,disabled:o.id===app.outfit,why:'Wearing it',act:()=>apply({outfit:o.id})}))})),
      options: [
        { label:'Next hairstyle',sub:HAIR_STYLES[gender].find(h=>h.id===app.hair)?.label??app.hair,act:()=>{const hair=HAIR_STYLES[gender];apply({hair:hair[(hair.findIndex(h=>h.id===app.hair)+1)%hair.length].id});}},
        { label:'Another Ankara print',act:()=>apply({palette:((app.palette??0)+1)%ANKARA_PALETTES.length}) },
        { label:'Next top / jacket colour',act:()=>apply({color:((app.color??0)+1)%OUTFIT_COLORS.length}) },
        { label:'Next trouser / shorts colour',act:()=>apply({bottomColor:app.bottomColor==null?0:(app.bottomColor+1)%OUTFIT_COLORS.length}) },
        { label:'Match trousers to outfit',act:()=>apply({bottomColor:null}) },
        { label:'Next shoe colour',act:()=>apply({shoeColor:app.shoeColor==null?0:(app.shoeColor+1)%SHOE_COLORS.length}) },
        { label:'Use outfit shoe colour',act:()=>apply({shoeColor:null}) },
        { label:'Done',ghost:true,act:()=>g.closeChoice() },
      ],
    };
  }
  refreshDecor() {
    const i = this.inside;
    // Visiting another player: show the host's own furniture and finishes from the snapshot they share.
    const snap=i&&this.g.online?.guestHost?this.g.online.hostDecor:null;
    if (snap&&i.viewing) { this.interiors.setLook(i.home.id);this.interiors.repaint(/^#[0-9a-f]{6}$/i.test(snap.paint)?snap.paint:'#e9dec8');if(/^#[0-9a-f]{6}$/i.test(snap.floor??''))this.interiors.refloor(snap.floor);this.decor.renderGuest(i,snap);return; }
    if (!i || i.host || i.viewing || !this.g.homeUpgrades) { this.decor?.clear(); return; }
    const state = this.g.homeUpgrades.home(i.home.id);
    this.interiors.setLook(i.home.id);this.interiors.repaint(state.paint);if(state.floor)this.interiors.refloor(state.floor);this.decor.render(i, state);
  }
  switchFloor(floor) {
    const i=this.inside,g=this.g; if(!i || i.home.type!=='duplex')return;
    const lay=this.interiors.layouts[floor==='up'?'duplexUp':'duplex'];this.decor.clear();if(this.interiors.resize(lay.id,lay.size[0],lay.size[1],!i.host,this.planKey(i.home),this.removedLamps(i.home,lay.id,i.host)))this.registerItems(lay);i.layout=lay;
    this.interiors.setLook(i.home.id);this.refreshDecor();
    g.player.teleport(lay.spawn.x,lay.spawn.z,lay.spawn.heading);g.cameraRig.snapTo(new THREE.Vector3(lay.spawn.x,CONFIG.camera.height,lay.spawn.z));this.settleCamera(lay);this.applyLight();g.ui.toast(floor==='up'?'Upstairs — bedrooms & bathroom':'Ground floor — kitchen & living room');g.saveGame();
  }
  bathroomView(fixture = null) {
    const g=this.g,i=this.inside;
    if(!i || i.viewing || i.host || !this.housing.access(i.home.id).use)return null;
    const act=(minutes,changes,msg)=>{g.closeChoice();g.skipTime(minutes);g.needs.adjust(changes);g.saveGame();g.ui.toast(msg);};
    return {title:'Bathroom',kicker:'YOUR HOME',text:'Bathroom fittings you bought for this home. Water is included in the game rent.',options:[
      {label:'Use toilet',sub:'5 minutes · restore bladder',act:()=>act(5,{bladder:100,hygiene:-3},'Feeling relieved.')},
      {label:'Take a shower',sub:'20 minutes · restore hygiene',act:()=>act(20,{hygiene:100,fun:4},'Fresh and clean.')},
      {label:'Wash hands',sub:'2 minutes · +12 hygiene',act:()=>act(2,{hygiene:12},'Hands washed.')},
      {label:'Done',ghost:true,act:()=>g.closeChoice()}].filter((op,n)=>n===3||((!fixture||fixture===['toilet','shower','sink'][n])&&(!fixture||(this.decor.records??[]).some(r=>GOOD_BY_ID[r.id]?.action===['toilet','shower','sink'][n]))))};
  }
  /** v0.50: the TV menu of the TV in this room (first one found) */
  tvView(){const r=(this.decor.records??[]).find(r=>GOOD_BY_ID[r.id]?.action==='tv');return r?this.upgradeView(r.id):null;}
  upgradeView(id) {
    const g=this.g,i=this.inside;if(!i || i.viewing || i.host || !this.housing.access(i.home.id).use)return null;
    const good=GOOD_BY_ID[id],record=this.decor.records?.find(r=>r.id===id),state=g.homeUpgrades.home(i.home.id);
    if(!good||!state.owned.includes(id)||(!record&&!good.fixed))return null;
    const action=good.action;
    if(action==='storage'){const view=this.cupboardView();if(good.model==='fridge'||id==='fridge')view.text=(g.homeUpgrades.powered(i.home.id,g.weather?.power.on??true)?'Fridge cooling — power available. ':'Fridge cooling stopped — no grid or backup power. ')+(view.text??'');return view;}
    if(action==='bed'){const v=this.bedView();v.options.unshift({label:'Lie down',sub:'Just lie here for a while (move to get up)',act:()=>{g.closeChoice();g.posture?.lie();}});return v;}
    if(action==='wardrobe')return this.wardrobeView();
    if(action==='cooker')return this.stoveView();
    if(['shower','toilet','sink'].includes(action))return this.bathroomView(action);
    if(action==='power')return this.powerView(i.home.id,id);
    if(action==='light')return{title:good.label,text:id==='lantern'?'Rechargeable light works during power cuts.':'Requires grid or home backup power.',options:[{label:state.lightOn?.[id]===false?'Switch on':'Switch off',act:()=>{state.lightOn??={};state.lightOn[id]=state.lightOn[id]===false;g.homes.housing.state.lamps[i.home.id]=true;this.applyLight();g.saveGame();g.closeChoice();}},{label:'Done',act:()=>g.closeChoice()}]};
    const powered=g.homeUpgrades.powered(i.home.id,g.weather?.power.on??true)||!!good.rechargeable,requiresPower=['tv','speaker','fan','desk','console','washer','craft'].includes(action);
    const activities={tv:['Watch television (30 min)',null,0],speaker:['Listen to music (30 min)','music',10],fan:['Cool down by the fan (30 min)',null,0],read:['Read (30 min)','charisma',20],art:['Practise drawing (30 min)','photography',25],music:['Practise guitar (30 min)','music',30],craft:['Practise sewing (30 min)','hustle',30],desk:['Practise coding (30 min)','coding',45],console:['Play games (30 min)',null,0],boardgame:['Play a board game (30 min)',null,0],aquarium:['Watch the fish (30 min)',null,0],washer:['Wash clothes (30 min)',null,0]};
    const [label,skill,xp]=activities[action]??['Relax (30 min)',null,0];
    const switched=['tv','speaker','fan'].includes(action),on=state.applianceOn[id]===true;
    const canUse=()=>(good.rechargeable||g.homeUpgrades.powered(i.home.id,g.weather?.power.on??true))&&(!switched||state.applianceOn[id]===true);
    const seatOpt=action==='seat'?[{label:'Sit down',sub:'Move to get up',primary:true,act:()=>{g.closeChoice();g.posture?.sit();}}]:[];
    return {title:good.label,text:requiresPower&&!powered?'No power — switch on your backup or wait for grid power.':switched?`${on?'Switched on':'Switched off'} · Home power available.`:'Take a little time for yourself.',options:[
      ...seatOpt,
      ...(switched?[{label:on?'Switch off':'Switch on',disabled:!on&&!powered,why:'No power',act:()=>{if(!on&&!good.rechargeable&&!g.homeUpgrades.powered(i.home.id,g.weather?.power.on??true))return;state.applianceOn[id]=!on;this.decor.updateAppliances(0);g.venueMusic?.update();g.saveGame();g.renderChoice();}}]:[]),
      ...(action==='speaker'&&on&&powered?[{label:'Music playlist & volume',act:()=>g.openChoice(()=>g.venueMusic.view())}]:[]),
      // v0.50: choose what to watch; the programme plays on the TV and big on your screen
      ...(action==='tv'&&g.tvShows?TV_CHANNELS.map(c=>{const p=g.tvShows.programme(c.id);return{label:`Watch ${c.name}`,sub:`${c.channel} · “${p.s.title}” · ${c.minutes} min`,disabled:!(on&&powered),why:!powered?'No power':'Switch on first',act:()=>{if(!canUse())return;g.closeChoice();g.tvShows.watch(c.id,{onDone:()=>this.applyLight()});}};}):[]),
      ...(action==='tv'?[]:[{label,disabled:requiresPower&&(!powered||(switched&&!on)),why:!powered?'No power':'Switch on first',act:()=>{if(requiresPower&&!canUse()){g.ui.toast('Switch on the appliance with grid or backup power available.');return;}g.closeChoice();g.skipTime(30);g.needs.adjust({fun:['tv','console'].includes(action)?25:action==='speaker'?22:12,energy:8,hygiene:action==='washer'?35:action==='fan'?4:0});if(skill)g.skills.add(skill,xp);this.applyLight();g.saveGame();g.ui.toast(label.replace(' (30 min)','')+' complete.');}}]),
      {label:'Done',ghost:true,act:()=>g.closeChoice()}]};
  }

  powerView(homeId,id) {
    const g=this.g,u=g.homeUpgrades,good=GOOD_BY_ID[id];
    if(!good?.power||!u.allowed(homeId)||!u.isPlaced(homeId,id)||!u.hasEquipment(homeId,good.power))return null;
    const state=u.home(homeId),grid=g.weather?.power.on??true,status=u.powerStatus(homeId,grid),battery=good.power==='battery';
    const refresh=msg=>{this.applyLight();this.decor.updateAppliances(0);this.decor.renderOutdoor();g.venueMusic?.update();g.saveGame();g.ui.toast(msg);g.renderChoice();};
    const enabled=battery?state.inverterOn:state.generatorOn;
    return {title:good.label,kicker:'HOME POWER',text:`${grid?'Grid available':'Grid outage'} · Supply: ${status.source}. Battery ${Math.round(state.battery)}% · Fuel ${state.fuel.toFixed(1)} L.`,note:battery?(status.charging?'Charging from the grid. ':'')+`${enabled?'Automatic backup enabled':'Backup disabled'}. Full battery: 6 game hours; full grid recharge: 4 game hours. Empty batteries must recharge before an outage. Units share one home reserve.`:'Generator uses 1 L per 120 game minutes. Fuel must be in your bag to refill.',options:[
      {label:battery?(enabled?'Disable inverter backup':'Enable inverter backup'):(enabled?'Switch generator off':'Start generator'),disabled:!battery&&!enabled&&state.fuel<=0,why:'Add fuel first',act:()=>{const result=u.setBackup(homeId,good.power,!enabled);if(result.ok){if(!enabled)this.housing.state.lamps[homeId]=true;refresh(!enabled?'Backup enabled — home lights use the available supply.':'Backup switched off.');}else g.ui.toast(result.error);}},
      ...(!battery?[{label:'Pour 5 L fuel',sub:'Uses one jerrycan from your bag',act:()=>{const result=u.refuel(homeId,g.inventory);refresh(result.ok?'Generator fuel added.':result.error==='buy-jerrycan'?'Buy a 5 L fuel jerrycan and keep it in your bag first.':result.error==='tank-full'?'The generator tank is full.':result.error);}}]:[]),
      {label:'Turn on home lights',disabled:!u.powered(homeId,grid),why:'No grid or charged backup',act:()=>{if(!u.powered(homeId,g.weather?.power.on??true))return;this.housing.state.lamps[homeId]=true;refresh('Home lights switched on.');}},
      {label:'Done',ghost:true,act:()=>g.closeChoice()}
    ]};
  }

  settleCamera(lay) {
    const g=this.g; let best={yaw:lay.spawn.heading,clear:0};
    for(let i=0;i<16;i++){const yaw=lay.spawn.heading+i*Math.PI/8,clear=g.world.collision.raycast(lay.spawn.x,lay.spawn.z,lay.spawn.x+Math.sin(yaw)*3,lay.spawn.z+Math.cos(yaw)*3);if(clear>best.clear)best={yaw,clear};}
    g.cameraRig.yaw=best.yaw;g.cameraRig.currentDist=Math.max(.6,Math.min(2.2,best.clear*3-.4));g.cameraRig.update(.1,g.player.position);
  }

}
