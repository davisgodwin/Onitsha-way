import * as THREE from 'three';
import {dancePose,drinkPose} from '../life/VenueActivities.js';
import {SEAT_HEIGHT} from '../characters/CharacterAnimator.js';
import { buildHuman, SKIN_TONES, OUTFITS, NPC_HAIR, OUTFIT_COLORS } from '../characters/HumanRig.js';
import { ankaraTexture, plainFabricTexture, senatorTexture } from '../characters/ClothingTextures.js';
import { CharacterAnimator } from '../characters/CharacterAnimator.js';
import { mulberry32, hashString, dampAngle } from '../core/utils.js';
import { ambientLine, bumpLine, dodgeLine } from '../dialogue/Conversations.js';
import { isOpen, hoursFor } from '../data/schedule.js';
const hoursForCached = hoursFor;
import { crowdFactor } from '../sim/Calendar.js';

/*
  Living NPCs.
  Residents are persistent identities tied to real places: traders behind market stalls and shop
  fronts, keke-rank agents, neighbours at compound gates. Passers-by and hawkers are generated along
  the road graph. Only identities near the player are embodied, using a pool of pre-built rigs
  (building a rig costs ~40 ms, so nothing is built during play). Each identity keeps a stable
  appearance template, name, role, schedule and relationship with the player.
  Public transport: people queue at bus stops near the player (from the stop's real queue in
  TransitFleet), walk to the door and get in when a keke or bus picks them up, and riders who get
  down step onto the kerb and walk off.
*/

const MALE = ['Chidi', 'Emeka', 'Obinna', 'Ikenna', 'Nnamdi', 'Chukwudi', 'Uche', 'Ifeanyi', 'Kelechi', 'Okechukwu', 'Somto', 'Tochukwu', 'Ebuka', 'Chinedu', 'Onyeka', 'Arinze', 'Musa', 'Tunde', 'Kenechukwu', 'Azubuike'];
const FEMALE = ['Ngozi', 'Adaeze', 'Chioma', 'Nkechi', 'Ifeoma', 'Amaka', 'Uju', 'Ebele', 'Chiamaka', 'Obiageli', 'Oluchi', 'Nneka', 'Ogechi', 'Chinyere', 'Ifunanya', 'Halima', 'Kemi', 'Adanna'];
const ROLE_LABEL = { churchgoer: 'On the way to church', police: 'Police officer', trader: 'Trader', tout: 'Keke rank agent', hawker: 'Hawker', walker: 'Passer-by', neighbour: 'Neighbour', passenger: 'Waiting for transport' };
const GOODS = ['fabrics', 'provisions', 'phones & accessories', 'shoes & bags', 'foodstuff', 'spare parts', 'kitchenware', 'electricals'];

const POOL_SIZE = { low: 24, medium: 36, high: 50 };
const WALKERS = { low: 8, medium: 14, high: 20 };

export class NPCSystem {
  constructor({ scene, graph, world, landmarks, quality = 'medium', relationships }) {
    this.scene = scene; this.graph = graph; this.world = world; this.landmarks = landmarks;
    this.quality = quality;
    this.rels = relationships;          // object owned by the save data
    this.pool = []; this.active = [];
    this.bubbles = [];
    this.rng = mulberry32(31337);
    this.t = 0; this.tick = 0;
    this.residents = [];
    this.anchorGrid = new Map();
    this.frame = 0;
    this.basinGeo = (() => { const g = new THREE.CylinderGeometry(0.24, 0.17, 0.12, 14); g.translate(0, 0.06, 0); return g; })();
    this.basinMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.5 });
    this.goodsMat = new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.8 });
  }

  // ------------------------------------------------------------------ setup
  async buildPool(onProgress) {
    const n = POOL_SIZE[this.quality] ?? 26;
    const rng = mulberry32(2026);
    for (let i = 0; i < n; i++) {
      const gender = i % 2 ? 'female' : 'male';
      const older = rng() < 0.3;
      let hair = NPC_HAIR[gender][Math.floor(rng() * NPC_HAIR[gender].length)];
      let outfit = OUTFITS[gender][Math.floor(rng() * OUTFITS[gender].length)].id;
      if (older) { hair = gender === 'male' ? 'redcap' : 'gele'; outfit = gender === 'male' ? 'senator' : (rng() < 0.5 ? 'blouse_skirt' : 'ankara_gown'); }
      else if (hair === 'redcap' || hair === 'gele') hair = NPC_HAIR[gender][0];
      const app = { gender, skin: Math.floor(rng() * SKIN_TONES.length), hair, outfit, palette: Math.floor(rng() * 7), color: Math.floor(rng() * 6) };
      const rig = buildHuman(app);
      rig.group.visible = false;
      const s = 0.94 + rng() * 0.1; rig.group.scale.multiplyScalar(s);
      this.scene.add(rig.group);
      const anim = new CharacterAnimator(rig, { walkSpeed: 1.4, runSpeed: 4 });
      // head-load (for hawkers) parented to the head bone, hidden unless used
      const load = new THREE.Group();
      const basin = new THREE.Mesh(this.basinGeo, this.basinMat); load.add(basin);
      for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), this.goodsMat); b.position.set((k % 3 - 1) * 0.08, 0.13, (Math.floor(k / 3) - 0.5) * 0.08); load.add(b); }
      load.position.set(0,rig.imported?0:.215,0); load.visible=false;(rig.headAttachment??rig.bones.head).add(load);
      // umbrella for the rain, held in the right hand (hidden unless it's raining)
      this.umbGeo ??= (() => { const g = new THREE.ConeGeometry(0.62, 0.28, 8, 1, true); g.translate(0, 2.08, 0); return g; })();
      this.umbStickGeo ??= (() => { const g = new THREE.CylinderGeometry(0.012, 0.012, 1.0, 4); g.translate(0, 1.55, 0); return g; })();
      this.umbMats ??= ['#1d3557', '#c1121f', '#2b9348', '#222222', '#f77f00'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, side: THREE.DoubleSide }));
      const umbrella = new THREE.Group();
      const canopy = new THREE.Mesh(this.umbGeo, this.umbMats[i % this.umbMats.length]); canopy.castShadow = true;
      const stick = new THREE.Mesh(this.umbStickGeo, this.stickMat ??= new THREE.MeshStandardMaterial({ color: '#333' }));
      umbrella.add(canopy, stick); umbrella.position.set(-0.2, 0, 0.12); umbrella.visible = false; rig.group.add(umbrella);
      this.pool.push({ i, app, rig, anim, load, umbrella, busy: false });
      if (i % 3 === 2) { onProgress?.((i + 1) / n); await new Promise((r) => requestAnimationFrame(r)); }
    }
    onProgress?.(1);
  }

  /** Persistent residents from real anchors (stalls, shop fronts, keke ranks, compound gates). */
  buildResidents({ stalls = [], kekes = [], shops = [], gates = [] }) {
    const add = this.addResident = (kind, i, x, z, nx, nz, role, schedule, presence = 1) => {
      const id = `${kind}:${i}`;
      const seed = hashString(id);
      const r = mulberry32(seed);
      const gender = r() < (role === 'trader' ? 0.55 : role === 'tout' ? 0.12 : 0.5) ? 'female' : 'male';
      const first = gender === 'male' ? MALE[Math.floor(r() * MALE.length)] : FEMALE[Math.floor(r() * FEMALE.length)];
      const older = r() < 0.4;
      const title = role === 'trader' ? (gender === 'female' ? (older ? `Mama ${first}` : `Madam ${first}`) : (older ? `Oga ${first}` : first)) : first;
      const res = {
        id, kind, role, gender, name: title, first, x, z, yaw: Math.atan2(nx, nz),
        goods: GOODS[Math.floor(r() * GOODS.length)], schedule, presence, seed, template: Math.floor(r() * 1000),
        older,
      };
      this.residents.push(res);
      const k = Math.floor(x / 50) + ',' + Math.floor(z / 50);
      if (!this.anchorGrid.has(k)) this.anchorGrid.set(k, []); this.anchorGrid.get(k).push(res);
    };
    stalls.forEach((s, i) => { if (i % 2 === 0 && !s.hidden) add('stall', i, s.x + s.nx * 0.95, s.z + s.nz * 0.95, -s.nx, -s.nz, 'trader', [7, 19.5]); });
    shops.forEach((s, i) => { if (i % 3 === 0) add('shop', i, s.x, s.z, s.nx, s.nz, 'trader', [7.5, 19]); });
    kekes.forEach((s, i) => !s.hidden && add('rank', i, s.x, s.z, s.nx, s.nz, 'tout', [6, 21]));
    gates.forEach((s, i) => { if (i % 3 === 0) add('gate', i, s.x, s.z, s.nx, s.nz, 'neighbour', [7, 21], 0.4); });
  }

  /** v0.38: neighbours at the gates of the compounds built on empty land (about one in four, mornings to evening). */
  addCompoundNeighbours(gates) { if (!this.addResident) return 0; let n = 0; gates.forEach((s, i) => { if (i % 4 === 0) { this.addResident('compound', i, s.x, s.z, s.nx, s.nz, 'neighbour', [7, 21], 0.45); n++; } }); return n; }

  /** An extra anchored resident (police officers at checkpoints): stands at x, z facing (nx, nz) during its hours. */
  addAnchored({ id, kind, role, name, x, z, nx, nz, schedule, gender = null, activity = null, seatY = null }) {
    const seed = hashString(id), r = mulberry32(seed);
    const res = { id, kind, role, activity, seatY, gender: gender ?? (r() < 0.25 ? 'female' : 'male'), name, first: name, x, z, yaw: Math.atan2(nx, nz), goods: null, schedule, presence: 1, seed, template: Math.floor(r() * 1000) };
    this.residents.push(res);
    const k = Math.floor(x / 50) + ',' + Math.floor(z / 50);
    if (!this.anchorGrid.has(k)) this.anchorGrid.set(k, []); this.anchorGrid.get(k).push(res);
    return res;
  }

  rel(identity) {
    let r = this.rels[identity.id];
    if (!r) { r = this.rels[identity.id] = { name: identity.name, role: identity.role, talks: 0, positive: 0, negative: 0, knowsName: false, bumps: 0, lastDay: 0 }; }
    r.familiarity = Math.max(0, Math.round(r.talks + r.positive * 0.5 - r.negative * 0.7));
    return r;
  }

  // ------------------------------------------------------------------ spawning
  freeRig(gender, pref) {
    const free = this.pool.filter((p) => !p.busy && p.app.gender === gender);
    if (!free.length) return null;
    return free[pref % free.length];
  }

  embody(identity, state) {
    const p = this.freeRig(identity.gender, identity.template);
    if (!p) return null;
    p.busy = true;
    const npc = {
      identity, role: identity.role, name: identity.name, rigRef: p, rig: p.rig, anim: p.anim,
      x: identity.x, z: identity.z, heading: identity.yaw ?? 0, state, speed: 0, animAcc: 0,
      bubbleT: 2 + this.rng() * 6, stateT: 0, chatWith: null, lastBump: 0,
    };
    p.load.visible = identity.role === 'hawker';
    this.applyLook(p, identity);
    if(!p.drinkCup){p.drinkCup=new THREE.Mesh(new THREE.CylinderGeometry(.045,.035,.14,8),new THREE.MeshStandardMaterial({color:'#d7aa55',roughness:.4}));p.drinkCup.position.set(0,.02,.03);p.rig.bones['hand.R'].add(p.drinkCup);}
    p.drinkCup.visible=identity.activity==='drink';
    p.rig.group.visible = true;
    this.active.push(npc);
    return npc;
  }

  /** Ensure an interaction group can be seen even when the ambient pool is already busy. */
  ensureAnchored(residents,px,pz,talkingTo=null) {
    for(const resident of residents){
      if(this.active.some(n=>n.identity===resident))continue;
      if(!this.freeRig(resident.gender,0)){
        const victim=this.active.filter(n=>n!==talkingTo&&n.identity.id!==this.priorityId
          && n.identity.gender===resident.gender
          && !(n.identity.kind==='street'&&Math.hypot(n.x-px,n.z-pz)<16))
          .sort((a,b)=>Math.hypot(b.x-px,b.z-pz)-Math.hypot(a.x-px,a.z-pz))[0];
        if(victim)this.release(victim);
      }
      const n=this.embody(resident,'stand');
      if(n){n.rig.group.position.set(n.x,0,n.z);n.rig.group.rotation.y=n.heading;n.anim.update(0,{speed:0,grounded:true,turnRate:0});}
    }
  }

  /**
   * Give a pooled rig this identity's own look: skin tone, print / colour of clothes and height all
   * come from the identity seed, so the same resident looks the same every time you meet them and
   * two residents sharing a rig template don't look identical.
   */
  applyLook(p, identity) {
    const r = mulberry32(hashString(identity.id) ^ 0x5bd1e995);
    const m = p.rig.materials;
    const skin = new THREE.Color(SKIN_TONES[Math.floor(r() * SKIN_TONES.length)]);
    m.skin?.color.copy(skin);
    m.lip?.color.copy(skin.clone().multiplyScalar(0.72).lerp(new THREE.Color('#5a2a2a'), 0.35));
    const pal = Math.floor(r() * 7), pat = Math.floor(r() * 4);
    const solid = OUTFIT_COLORS[Math.floor(r() * OUTFIT_COLORS.length)];
    const outfit = p.app.outfit;
    if (m.top) {
      if (outfit === 'senator') m.top.map = senatorTexture(solid, solid === '#f1ead8' ? '#7a5c1f' : '#d4af37');
      else if (outfit === 'tee_chinos' || outfit === 'blouse_skirt') m.top.map = plainFabricTexture(solid === '#3b3b3b' && outfit === 'blouse_skirt' ? '#f4f1ea' : solid);
      else m.top.map = ankaraTexture(pal, pat);
    }
    if (m.bottom && m.bottom !== m.top && outfit === 'blouse_skirt') m.bottom.map = ankaraTexture((pal + 3) % 7, (pat + 1) % 4);
    if (m.gele) m.gele.map = ankaraTexture((pal + 2) % 7, (pat + 2) % 4);
    for (const k of ['top', 'bottom', 'gele']) if (m[k]) m[k].needsUpdate = true;
    if (identity.role === 'police') { // black uniform
      for (const k of ['top', 'bottom']) if (m[k]) { m[k].map = plainFabricTexture('#1c1f26'); m[k].needsUpdate = true; }
    }
    const h = 0.92 + r() * 0.13;
    p.rig.group.scale.setScalar((p.rig.female ? 0.94 : 1) * h);
  }

  release(npc) {
    npc.rigRef.busy = false; npc.rig.group.visible = false; npc.rigRef.load.visible = false; npc.rigRef.umbrella.visible = false;
    if (npc.chatWith) { npc.chatWith.chatWith = null; if (npc.chatWith.state === 'chat') npc.chatWith.state = 'walk'; }
    this.active.splice(this.active.indexOf(npc), 1);
  }

  crowd(x, z, hour) {
    const day = hour >= 6.5 && hour < 19.5 ? 1 : hour >= 19.5 && hour < 22 ? 0.5 : hour >= 5.5 && hour < 6.5 ? 0.5 : 0.15;
    let k = 1;
    for (const l of this.landmarks.list) {
      const d = Math.hypot(x - l.x, z - l.z);
      if ((l.kind === 'market' || l.kind === 'interchange' || l.kind === 'park' || l.kind === 'bridgehead') && d < l.radius * 1.3) k = Math.max(k, 1.7);
    }
    return k * day * crowdFactor(this.weekday ?? 0, hour, this.weather?.rain ?? 0);
  }

  spawnWalker(px, pz, hour) {
    const edges = this.graph.edgesNear(px, pz, 70, 22, (e) => e.len > 6 && e.walkable);
    if (!edges.length) return;
    const e = edges[Math.floor(this.rng() * edges.length)];
    const slot = Math.floor(this.rng() * 3);
    const id = `walk:${e.id}:${slot}`;
    if (this.active.some((n) => n.identity.id === id)) return;
    const r = mulberry32(hashString(id));
    const gender = r() < 0.5 ? 'female' : 'male';
    const name = gender === 'male' ? MALE[Math.floor(r() * MALE.length)] : FEMALE[Math.floor(r() * FEMALE.length)];
    const hawker = hour > 7 && hour < 19 && r() < 0.18;
    const identity = { id, kind: 'walk', role: hawker ? 'hawker' : 'walker', gender, name, template: Math.floor(r() * 1000) };
    const npc = this.embody(identity, 'walk');
    if (!npc) return;
    npc.edge = e; npc.fwd = this.rng() < 0.5; npc.s = this.rng() * e.len;
    npc.side = this.rng() < 0.5 ? 1 : -1;
    npc.walkSpeed = hawker ? 1.0 : 1.15 + this.rng() * 0.35;
    const p = this.walkPoint(npc); npc.x = p.x; npc.z = p.z; npc.heading = Math.atan2(p.dx, p.dz);
  }

  walkLateral(npc) {
    const w = npc.edge.road.width;
    if (npc.edge.road.footbridge) return npc.side * 0.4; // stairs and footbridges: keep to your side, on the steps
    return npc.side * (npc.edge.major ? w / 2 - 0.35 : w / 2 + 0.15);
  }
  walkPoint(npc) { return this.graph.pointAt(npc.edge, npc.fwd, Math.min(npc.s, npc.edge.len), this.walkLateral(npc)); }

  // ------------------------------------------------------------------ main update
  update(dt, { player, hour, camera, talkingTo, vehicles = [], car = null }) {
    this.car = car;
    this.t += dt; this.frame++;
    const px = player.x, pz = player.z;
    // spawn / despawn twice a second
    this.tick -= dt;
    if (this.tick <= 0) {
      this.tick = 0.5;
      for (const n of [...this.active]) {
        if (n === talkingTo) continue;
        const d = Math.hypot(n.x - px, n.z - pz);
        const outOfHours = !!n.identity.schedule && !isOpen(n.identity, this.weekday ?? 0, hour);
        // closing time: someone at their stall packs up and walks off down the street instead of vanishing
        if (outOfHours && n.state === 'stand' && n.identity.kind === 'church' && this.churchDoor) { n.state = 'board'; n.target = { ...this.churchDoor }; n.stateT = 40; this.say(n, { gen: 'Mass don start — make we enter.' }, 2.5); }
        else if (outOfHours && n.state === 'stand' && n.identity.kind !== 'host' && n.identity.kind !== 'wait' && d <= 60) { this.becomeWalker(n); n.state = 'walk'; n.leaving = true; n.leftAt = this.t; this.say(n, { gen: n.role === 'churchgoer' ? 'Mass don start — make I go in.' : n.role === 'trader' ? 'Market don close. I dey go house.' : 'Make I dey go.' }, 2.5); }
        if (d > 95 || (outOfHours && d > 25 && !n.leaving) || (n.leaving && (d > 60 || this.t - n.leftAt > 60))) this.release(n);
        // someone waiting at a stop who has gone (picked up while out of sight, or the queue changed)
        else if (n.identity.kind === 'wait' && n.state === 'stand' && !n.identity.platform.queue.includes(n.identity.serial)) this.release(n);
      }
      // anchored residents near the player
      const gx = Math.floor(px / 50), gz = Math.floor(pz / 50);
      const cand = [];
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (const r of this.anchorGrid.get(gx + dx + ',' + (gz + dz)) ?? []) {
        const d = Math.hypot(r.x - px, r.z - pz);
        if (d > 75) continue;
        if (!isOpen(r, this.weekday ?? 0, hour)) continue;
        if (r.id !== this.priorityId && r.presence < 1 && mulberry32(r.seed + Math.floor(hour / 3))() > r.presence) continue;
        if (this.active.some((n) => n.identity === r)) continue;
        cand.push([d, r]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      // Job contacts and a nearby encounter's group must remain visible even at low quality.
      // Otherwise a full market pool could show an agbero prompt with nobody standing there.
      const priorities = cand.filter(([d,r]) => r.id === this.priorityId || (r.kind === 'street' && d < 16));
      this.ensureAnchored(priorities.map(([,r])=>r),px,pz,talkingTo);
      const maxAnchored = Math.floor(this.pool.length * 0.6);
      for (const [d, r] of cand) {
        if(this.active.some(n=>n.identity===r))continue;
        if (this.active.filter((n) => n.state !== 'walk' && n.identity.kind !== 'walk').length >= maxAnchored) break;
        // opening time and you're watching: they walk up to their spot from down the street
        const h = hoursForCached(r, this.weekday ?? 0);
        const justOpened = h && hour - h[0] < 0.75 && d < 70 && d > 8 && r.kind !== 'host';
        const npc = this.embody(r, justOpened ? 'arrive' : 'stand');
        if (npc && justOpened) {
          const a = mulberry32(r.seed + this.frame)() * Math.PI * 2, far = 18 + (r.seed % 10);
          const [sx, sz] = [r.x + Math.sin(a) * far, r.z + Math.cos(a) * far];
          this._pos ??= { x: 0, z: 0 }; this._pos.x = sx; this._pos.z = sz; this.world.collision.resolveCircle(this._pos, 0.3);
          npc.x = this._pos.x; npc.z = this._pos.z; npc.stateT = 30;
        }
      }
      this.spawnWaiters(px, pz);
      const target = Math.round((WALKERS[this.quality] ?? 12) * this.crowd(px, pz, hour));
      const walkers = this.active.filter((n) => n.identity.kind === 'walk').length;
      for (let k = 0; k < 2 && walkers + k < target; k++) this.spawnWalker(px, pz, hour);
      // shadows only close to the camera
      for (const n of this.active) { const near = Math.hypot(n.x - px, n.z - pz) < 32; for (const m of n.rig.meshes) m.castShadow = near; }
    }

    for (const n of this.active) this.updateNPC(n, dt, px, pz, player, hour, talkingTo, vehicles);
    for (const n of this.active.filter((a) => a.gone)) this.release(n);
    // expire bubbles
    this.bubbles = this.bubbles.filter((b) => b.until > this.t && this.active.includes(b.npc));
  }

  /** Time skipped: the passers-by around you have moved on (new ones walk in); stall-keepers stay put. */
  fastForward(minutes, keep = null) {
    if (!(minutes > 0)) return;
    for (const n of [...this.active]) if (n !== keep && (n.identity.kind === 'walk' || n.state === 'walk' || n.state === 'chat' || n.state === 'browse')) this.release(n);
    this.tick = 0;
  }

  /** What the weather and power are doing, for people's remarks. */
  envCtx() { return { weather: this.weather, power: this.power, sunday: this.weekday === 6 }; }

  say(npc, line, seconds = 3.5) {
    this.bubbles = this.bubbles.filter((b) => b.npc !== npc);
    this.bubbles.push({ npc, line, until: this.t + seconds });
    this.onHeard?.(line.expr);
  }

  updateNPC(n, dt, px, pz, player, hour, talkingTo, vehicles = []) {
    if (n.state === 'ride') { // sitting in the player's keke
      const at = n.rideAt?.();
      if (!at) { n.gone = true; return; }
      n.x = at.x; n.z = at.z; n.heading = at.heading;
      const g = n.rig.group; g.position.set(at.x, at.y, at.z); g.rotation.y = at.heading;
      n.anim.sit?.(dt, 0);
      return;
    }
    const dPlayer = Math.hypot(n.x - px, n.z - pz);
    let speed = 0, targetHeading = n.heading;
    n.stateT -= dt;

    // the player's car bearing down: step smartly out of its path (and say something about it)
    const car = this.car;
    if (car && n !== talkingTo && n.state !== 'stand' && n.state !== 'ride' && n.state !== 'board' && n.state !== 'alight' && !(n.dodgeT > 0) && Math.abs(car.speed) > 2.5) {
      const rx = n.x - car.x, rz = n.z - car.z, sgn = Math.sign(car.speed);
      const along = (rx * car.fx + rz * car.fz) * sgn, lat = rx * car.rx + rz * car.rz;
      if (along > -car.half && along < car.half + 3 + Math.abs(car.speed) * 1.3 && Math.abs(lat) < car.wid / 2 + 0.9) {
        n.dodgeT = 0.9; n.dodgeDir = lat >= 0 ? 1 : -1;
        if (n.state === 'chat' || n.state === 'browse') n.state = 'walk';
        if (!(this.t - (n.shoutAt ?? -99) < 8)) { n.shoutAt = this.t; this.say(n, dodgeLine(Math.abs(lat) < car.wid / 2 + 0.2 && along < car.half + 4, this.rng), 2.8); }
      }
    }

    const dodging = n.dodgeT > 0;
    if (n === talkingTo) {
      n.state = 'talk';
      targetHeading = Math.atan2(px - n.x, pz - n.z);
    } else if (n.state === 'talk') {
      n.state = n.identity.kind === 'walk' ? 'walk' : 'stand';
    }

    if (dodging) {
      n.dodgeT -= dt; speed = 3.4;
      n.x += car ? car.rx * n.dodgeDir * speed * dt : 0; n.z += car ? car.rz * n.dodgeDir * speed * dt : 0;
      this._pos ??= { x: 0, z: 0 };
      this._pos.x = n.x; this._pos.z = n.z; this.world.collision.resolveCircle(this._pos, 0.26); n.x = this._pos.x; n.z = this._pos.z;
      if (car) targetHeading = Math.atan2(car.rx * n.dodgeDir, car.rz * n.dodgeDir);
      if (n.state === 'walk' && n.edge) { // carry on along the walk from wherever the jump landed
        const lat = (n.x - this.graph.nodes[n.edge.a][0]) * -n.edge.dz + (n.z - this.graph.nodes[n.edge.a][1]) * n.edge.dx;
        n.side = (n.fwd ? lat : -lat) >= 0 ? 1 : -1;
      }
    } else if (n.state === 'stand') {
      n.x = n.identity.x; n.z = n.identity.z;
      targetHeading = n === talkingTo && !n.identity.activity ? Math.atan2(px - n.x, pz - n.z) : n.identity.yaw;
    } else if (n.state === 'walk') {
      // stop for the player directly ahead
      const ahead = (px - n.x) * Math.sin(n.heading) + (pz - n.z) * Math.cos(n.heading);
      const blocked = dPlayer < 1.3 && ahead > 0 && !player.riding;
      speed = blocked ? 0 : n.walkSpeed * ((this.weather?.rain ?? 0) > 0.2 ? 1.3 : 1); // hurrying out of the rain
      n.s += speed * dt;
      while (n.s > n.edge.len) {
        n.s -= n.edge.len;
        const node = this.graph.endNode(n.edge, n.fwd);
        const opts = this.graph.options(node, n.edge);
        if (!opts.length) { n.fwd = !n.fwd; n.s = 0; break; }
        const o = opts[Math.floor(this.rng() * opts.length)];
        n.edge = o.edge; n.fwd = o.fwd;
        if (this.rng() < 0.15) n.side = -n.side; // sometimes cross over
      }
      const p = this.walkPoint(n);
      const k = 1 - Math.exp(-6 * dt);
      n.x += (p.x - n.x) * k; n.z += (p.z - n.z) * k;
      // walk around stalls, kiosks, poles and walls instead of through them
      this._pos ??= { x: 0, z: 0 };
      this._pos.x = n.x; this._pos.z = n.z;
      this.world.collision.resolveCircle(this._pos, 0.26);
      n.x = this._pos.x; n.z = this._pos.z;
      if (speed > 0) targetHeading = Math.atan2(p.dx, p.dz);
      // social: chat with another passer-by, or browse at a trader
      if (n.stateT < -6 && this.rng() < dt * 0.4) {
        for (const o of this.active) {
          if (o === n || Math.hypot(o.x - n.x, o.z - n.z) > 2.6) continue;
          if (o.state === 'walk' && o.role !== 'hawker' && n.role !== 'hawker' && this.rng() < 0.5) {
            n.state = o.state = 'chat'; n.chatWith = o; o.chatWith = n; n.stateT = o.stateT = 5 + this.rng() * 5;
            this.say(n, ambientLine(n, this.envCtx(), this.rng), 3); setTimeout(() => o.state === 'chat' && this.say(o, ambientLine(o, this.envCtx(), this.rng), 3), 1600);
            break;
          }
          if (o.role === 'trader' && o.state === 'stand') {
            n.state = 'browse'; n.browseAt = o; n.stateT = 3 + this.rng() * 4;
            if (this.rng() < 0.6) this.say(o, ambientLine(o, { busy: hour > 9 && hour < 17, ...this.envCtx() }, this.rng), 3);
            break;
          }
        }
      }
    } else if (n.state === 'arrive') {
      // walking to their stall / post / spot at opening time
      const dx = n.identity.x - n.x, dz = n.identity.z - n.z, d = Math.hypot(dx, dz);
      speed = d > 0.3 ? 1.25 : 0;
      if (d > 0.01) {
        const k = Math.min(1, (speed * dt) / d); n.x += dx * k; n.z += dz * k; targetHeading = Math.atan2(dx, dz);
        this._pos ??= { x: 0, z: 0 }; this._pos.x = n.x; this._pos.z = n.z; this.world.collision.resolveCircle(this._pos, 0.26); n.x = this._pos.x; n.z = this._pos.z;
      }
      if (d < 0.4 || n.stateT < 0) { n.state = 'stand'; if (n.role === 'trader' && this.rng() < 0.6) this.say(n, { gen: 'Good morning! Market don open.' }, 2.5); }
    } else if (n.state === 'board' || n.state === 'alight') {
      // walking to the vehicle door (then gone, inside), or from the door to the kerb (then a passer-by)
      const dx = n.target.x - n.x, dz = n.target.z - n.z, d = Math.hypot(dx, dz);
      speed = d > 0.25 ? 1.5 : 0;
      if (d > 0.01) { const k = Math.min(1, (speed * dt) / d); n.x += dx * k; n.z += dz * k; targetHeading = Math.atan2(dx, dz); }
      if (d < 0.3 || n.stateT < 0) {
        if (n.state === 'board') n.gone = true;
        else this.becomeWalker(n);
      }
    } else if (n.state === 'chat') {
      if (n.chatWith) targetHeading = Math.atan2(n.chatWith.x - n.x, n.chatWith.z - n.z);
      if (n.stateT <= 0) { n.state = 'walk'; n.stateT = 0; if (n.chatWith) n.chatWith.chatWith = null; n.chatWith = null; }
    } else if (n.state === 'browse') {
      if (n.browseAt) targetHeading = Math.atan2(n.browseAt.x - n.x, n.browseAt.z - n.z);
      if (n.stateT <= 0) { n.state = 'walk'; n.browseAt = null; n.stateT = 0; }
    }

    // ambient call-outs to the player
    n.bubbleT -= dt;
    if (n.bubbleT <= 0 && n !== talkingTo) {
      n.bubbleT = 7 + this.rng() * 9;
      if (dPlayer < 11 && (n.role === 'trader' || n.role === 'tout' || n.role === 'hawker' || n.role === 'churchgoer' || (n.role === 'police' && this.rng() < 0.4))) {
        this.say(n, ambientLine(n, { playerFemale: player.gender === 'female', busy: hour > 9 && hour < 17, ...this.envCtx() }, this.rng));
      }
    }

    // bumps: the player shoving through people gets a reaction (and remembered)
    if (!player.riding && dPlayer < 0.62 && player.speed > 2.2 && this.t - n.lastBump > 1.5 && n !== talkingTo) {
      n.lastBump = this.t;
      const r = this.rel(n.identity);
      r.bumps = (r.bumps ?? 0) + 1; r.negative += r.bumps >= 2 ? 1 : 0;
      this.say(n, bumpLine(r.bumps, n, this.rng), 3);
      n.heading = Math.atan2(px - n.x, pz - n.z);
    }

    // rain: people out walking put up umbrellas (not hawkers with a head-load, not people at their stalls)
    const wet = (this.weather?.rain ?? 0) > 0.2;
    n.rigRef.umbrella.visible = wet && n.role !== 'hawker' && n.role !== 'police' && (n.state === 'walk' || n.state === 'chat' || n.state === 'browse' || n.state === 'alight' || n.identity.kind === 'wait' || n.state === 'arrive' || n.state === 'leave');
    n.heading = dampAngle(n.heading, targetHeading, 6, dt);
    const g = n.rig.group;
    n.y = n.edge?.road.walkDeck ? this.graph.heightAt(n.edge, n.fwd, Math.min(n.s ?? 0, n.edge.len)) : 0; // v0.39: up the stairs, over the flyovers
    g.position.set(n.x, n.identity.seatY != null && n.state === 'stand' ? n.identity.seatY - SEAT_HEIGHT * g.scale.y : n.y, n.z);
    g.rotation.y = n.heading;
    // animation LOD: full rate close by, every 3rd frame further away
    n.animAcc += dt;
    const far = dPlayer > 35;
    // people beyond the detail distance are a few pixels tall: don't draw them (each costs ~9 draw calls)
    // and don't animate them. Your conversation partner and the tracked job contact always stay visible.
    const cull = this.quality === 'low' ? 50 : this.quality === 'high' ? 100 : 75;
    const show = dPlayer < cull || n === talkingTo || n.identity.id === this.priorityId;
    if (g.visible !== show) g.visible = show;
    if (!show) return;
    for(const mesh of n.rig.meshes)mesh.castShadow=!far;
    if (!far || this.frame % 3 === 0) {
      if(n.state==='stand' && n.identity.seatY != null){n.anim.sit(n.animAcc);drinkPose(n.rig,this.t+n.identity.seed%9);}
      else {n.anim.update(n.animAcc, { speed, grounded: true, turnRate: 0 });if(n.state==='stand'&&n.identity.activity==='dance')dancePose(n.rig,this.t*3.6+n.identity.seed%9);}

      n.animAcc = 0;
      if(n.identity.activity==='checkpoint'&&((vehicles ?? []).some(v=>Math.hypot(v.x-n.x,v.z-n.z)<30)||(car&&Math.hypot(car.x-n.x,car.z-n.z)<30))){
        n.rig.bones['upperArm.R'].rotation.set(-1.25,0,-.25);n.rig.bones['foreArm.R'].rotation.x=-.3;
      }else if(n.identity.activity==='serve'){
        n.rig.bones['upperArm.L'].rotation.x=-.65;n.rig.bones['foreArm.L'].rotation.x=-1.1;
        n.rig.bones['upperArm.R'].rotation.x=-.65-.14*Math.sin(this.t*2);n.rig.bones['foreArm.R'].rotation.x=-1.1;
      }
      if (n.role === 'hawker') { // one arm steadies the head-load
        const b = n.rig.bones;
        b['upperArm.R'].rotation.set(-0.2, 0, -2.75); b['foreArm.R'].rotation.set(-0.5, 0, 0);
      } else if (n.rigRef.umbrella.visible) { // holding the umbrella up
        const b = n.rig.bones;
        b['upperArm.R'].rotation.set(-0.35, 0, -0.55); b['foreArm.R'].rotation.set(-1.5, 0, 0);
      }
      // look at the player when close and idle
      if (n === talkingTo && !n.identity.activity && !player.riding) {
        const rel = Math.atan2(px - n.x, pz - n.z) - n.heading;
        const a = Math.atan2(Math.sin(rel), Math.cos(rel));
        n.rig.bones.head.rotation.y = Math.max(-0.9, Math.min(0.9, a));
      }
    }
  }

  // ------------------------------------------------------------------ public transport
  /** People queueing at stop platforms near the player (up to 3 per platform are embodied). */
  spawnWaiters(px, pz) {
    const net = this.transit?.network; if (!net) return;
    let waiting = this.active.filter((n) => n.identity.kind === 'wait').length;
    for (const stop of net.stops) {
      if (waiting >= 7) return;
      if (Math.abs(stop.x - px) > 75 || Math.abs(stop.z - pz) > 75) continue;
      for (const p of stop.platforms) {
        if (Math.hypot(p.x - px, p.z - pz) > 70) continue;
        const rx = -p.dz, rz = p.dx;
        p.queue.slice(0, 3).forEach((serial, k) => {
          const id = `wait:${serial}`;
          if (waiting >= 7 || this.active.some((n) => n.identity.id === id)) return;
          const r = mulberry32(hashString(id));
          const gender = r() < 0.5 ? 'female' : 'male';
          const name = gender === 'male' ? MALE[Math.floor(r() * MALE.length)] : FEMALE[Math.floor(r() * FEMALE.length)];
          let x = p.x + p.dx * (k * 0.95 - 1.2) + rx * (0.35 + r() * 0.4), z = p.z + p.dz * (k * 0.95 - 1.2) + rz * (0.35 + r() * 0.4);
          [x, z] = this.world.findFreeSpot(x, z, 0.3);
          const identity = { id, kind: 'wait', role: 'passenger', gender, name, x, z, yaw: Math.atan2(-rx, -rz) + (r() - 0.5) * 0.8, template: Math.floor(r() * 1000), serial, platform: p };
          if (this.embody(identity, 'stand')) waiting++;
        });
      }
    }
  }

  /** The vehicle picked these queue members up: they walk to the door and get in. */
  boardWaiters(serials, door) {
    for (const n of this.active) {
      if (n.identity.kind !== 'wait' || !serials.includes(n.identity.serial)) continue;
      n.state = 'board'; n.target = { x: door.x, z: door.z }; n.stateT = 5;
    }
  }

  /** Riders getting down: they appear at the door and step onto the kerb. */
  spawnAlighting(count, door, kerb) {
    for (let i = 0; i < count; i++) {
      const id = `ride:${Math.floor(this.t * 10)}:${i}:${Math.floor(door.x)}`;
      const r = mulberry32(hashString(id));
      const gender = r() < 0.5 ? 'female' : 'male';
      const name = gender === 'male' ? MALE[Math.floor(r() * MALE.length)] : FEMALE[Math.floor(r() * FEMALE.length)];
      const npc = this.embody({ id, kind: 'walk', role: 'walker', gender, name, template: Math.floor(r() * 1000), x: door.x, z: door.z, yaw: 0 }, 'alight');
      if (!npc) return;
      npc.target = { x: kerb.x + (r() - 0.5) * 1.6, z: kerb.z + (r() - 0.5) * 1.6 }; npc.stateT = 4 + i * 0.6;
      npc.walkSpeed = 1.15 + r() * 0.3;
    }
  }

  /** Join the pavement as an ordinary passer-by on the nearest walkable street. */
  becomeWalker(n) {
    const edges = this.graph.edgesNear(n.x, n.z, 30, 0, (e) => e.walkable && e.len > 4);
    if (!edges.length) { n.gone = true; return; }
    let best = null, bd = Infinity, bs = 0, bside = 1;
    for (const e of edges) {
      const [ax, az] = this.graph.nodes[e.a];
      const t = Math.max(0, Math.min(e.len, (n.x - ax) * e.dx + (n.z - az) * e.dz));
      const qx = ax + e.dx * t, qz = az + e.dz * t, d = Math.hypot(n.x - qx, n.z - qz);
      if (d < bd) { bd = d; best = e; bs = t; bside = ((n.x - qx) * -e.dz + (n.z - qz) * e.dx) >= 0 ? 1 : -1; }
    }
    n.edge = best; n.fwd = this.rng() < 0.5; n.s = n.fwd ? bs : best.len - bs;
    n.side = n.fwd ? bside : -bside;
    n.walkSpeed ??= 1.25;
    n.state = 'walk'; n.stateT = 0;
  }

  // ------------------------------------------------------------------ queries
  nearestTalkable(px, pz, maxD = 2.4) {
    let best = null, bd = maxD;
    for (const n of this.active) { if (n.state === 'board' || n.state === 'alight' || n.state === 'ride') continue; const d = Math.hypot(n.x - px, n.z - pz); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  roleLabel(n) { return n.role === 'trader' ? `${ROLE_LABEL.trader} · ${n.identity.goods ?? 'goods'}` : ROLE_LABEL[n.role] ?? n.role; }

  /** Push a circle out of people. Returns the last person it touched (or null). */
  pushOut(pos, r, y = 0) {
    let hit = null;
    for (const n of this.active) {
      if (n.state === 'ride' || Math.abs((n.y ?? 0) - y) > 1.5) continue;
      const dx = pos.x - n.x, dz = pos.z - n.z, d = Math.hypot(dx, dz), m = r + 0.28;
      if (d < m && d > 1e-4) { pos.x = n.x + (dx / d) * m; pos.z = n.z + (dz / d) * m; hit = n; }
    }
    return hit;
  }
  positions() { return this.active.filter((n) => n.state !== 'ride').map((n) => ({ x: n.x, z: n.z })); }
  stats() { const c = {}; for (const n of this.active) c[n.role] = (c[n.role] ?? 0) + 1; return { active: this.active.length, pool: this.pool.length, residents: this.residents.length, ...c }; }
}
