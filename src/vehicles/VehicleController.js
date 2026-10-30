import { MODES } from '../transport/transportConfig.js';
import {VEHICLE_PAINTS,paintName} from '../data/VehiclePaints.js';
import {poseMotorcycle} from './SeatedOccupants.js';
import { buildDealership } from './Dealership.js';
import { variantGeometry } from './VehicleVariants.js';
import * as THREE from 'three';
import { interactiveCar, setCarDoors, tickCarDoors, carSideOf } from './InteractiveCar.js';
import { VehicleSystem, pickSaleSpots, planDrive } from './VehicleSystem.js';
import { TYPES, SEATS, splitGlass, GLASS_MATERIAL } from '../sim/TrafficSystem.js';
import { VEHICLE_MODELS, FUEL, SKIP, vehicleBody } from '../data/housing.js';
import { ControlState } from '../player/PlayerController.js';
import { SEAT_HEIGHT } from '../characters/CharacterAnimator.js';
import { CONFIG } from '../config.js';
import { naira } from '../economy/Economy.js';
import { ITEMS } from '../data/catalogue.js';
import { KekeBusiness } from './KekeBusiness.js';
import { compass } from '../dialogue/Conversations.js';
import { durationLabel } from '../jobs/JobSystem.js';

/*
  Personal vehicles in play: for-sale cars at the stands, buying, getting in, driving, fuel, parking.
  DRIVER is its own control state: while driving, this controller moves the vehicle and the player sits
  in it; on foot the PlayerController moves the player. Public transport (PASSENGER) never mixes with it.
  Driving model: simple arcade car (throttle, brake/reverse, steering that tightens with speed) on the
  2D collision world (buildings, walls, poles, water), traffic and pedestrians. On the Niger Bridge and
  the Upper Iweka flyover the car follows the deck height once it drives up a ramp.
*/

const geoCache = new Map();
function vehicleMeshes(model) {
  if (!geoCache.has(model)) geoCache.set(model, splitGlass(TYPES[model].geo()));
  return geoCache.get(model);
}
function saleTexture(price) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#ffd400'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#111'; g.lineWidth = 5; g.strokeRect(3, 3, 250, 90);
  g.fillStyle = '#111'; g.textAlign = 'center'; g.font = '900 34px "Bricolage Grotesque", system-ui, sans-serif'; g.fillText('FOR SALE', 128, 40);
  g.font = '800 28px "DM Sans", system-ui, sans-serif'; g.fillText(naira(price), 128, 78);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class VehicleController {
  constructor(game) { this.g = game; this.driving = null; this.meshes = new Map(); this.obs = new Map(); this.car = null; this.ownedOffs=new Map();this.selectedPaint=new Map(); }

  setup() {
    const g = this.g, col = g.world.collision;
    const free = (x,z,r=2.5) => col.isFree(x,z,r)&&!g.world.terrain.isWater(x,z);
    const offRoad=(x,z,r=2)=>{const b=g.world.map.bounds;return x>b.minX+r&&x<b.maxX-r&&z>b.minZ+r&&z<b.maxZ-r&&!g.world.map.onCarriageway(x,z,r);};
    this.spots = pickSaleSpots(g.graph, g.world.landmarks, { free,offRoad });
    this.decks = g.world.map.roads.filter((r) => r.elevated && r.heightAt && !r.footbridge);
    this.stations = g.world.map.pois.filter((p) => p.kind === 'fuel');
    this.group = new THREE.Group(); this.group.name = 'PlayerVehicles';
    g.renderer.scene.add(this.group);
    this.saleMeshes=new Map(); this.dealerships=[];g.world.pavedForecourts=this.dealerships;
    for(const plot of new Map(this.spots.map(sp=>[sp.lot,sp.plot])).values()){
      const stand=buildDealership(plot,this,col);this.group.add(stand);plot.group=stand;this.dealerships.push(plot);
      g.interactions.register({x:plot.desk.x,z:plot.desk.z,radius:3.2,enabled:()=>!!this.sys&&!this.driving&&!g.world.collision.inZone(g.player.position.x,g.player.position.z),label:()=>`Browse all ${this.spots.filter(s=>s.lot===plot.id).length} vehicles · ${plot.name}`,onInteract:()=>g.openChoice(()=>this.dealerView(plot))});
    }
  }

  dealerView(plot){
    const stock=this.spots.filter(s=>s.lot===plot.id);
    return {title:plot.name,kicker:plot.premium?'PREMIUM SHOWROOM':'CAR STAND · SALES & SERVICE',text:(plot.premium?`${stock.length} premium vehicles: luxury SUVs, executive saloons and performance cars.`:`All ${stock.length} vehicles are available here.`)+' Choose a vehicle to inspect its price, fuel and handling. Bought vehicles arrive in the marked collection bay. Prices are fictional game naira.',note:'Move your last purchase out of the collection bay before buying another.',options:[...stock.map(sp=>({label:sp.label,sub:naira(sp.price)+(this.sys.world.soldVehicles.includes(sp.id)?' · Sold to you':''),disabled:this.sys.world.soldVehicles.includes(sp.id),why:'You already bought this listing',act:()=>this.g.openChoice(()=>this.buyView(sp))})),{label:'Leave stand',ghost:true,act:()=>this.g.closeChoice()}]};
  }

  makeMesh(model, paint) {
    paint ??= '#ffffff'; // a car with no paint given stays white (as before) without a three.js warning
    if (['sedan', 'executive', 'suv'].includes(vehicleBody(model))) return interactiveCar(vehicleBody(model), paint, VEHICLE_MODELS[model]);
    const [body, glass] = vehicleMeshes(model);
    const grp = new THREE.Group();
    const m = new THREE.Mesh(body, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.35, metalness: 0.35, color: paint }));
    m.castShadow = true; grp.add(m);
    if (glass) { const gm = new THREE.Mesh(glass, GLASS_MATERIAL()); gm.renderOrder = 2; grp.add(gm); }
    return grp;
  }

  /** On entering the world: the vehicles you own, from the save. */
  start(saveData) {
    clearTimeout(this.entryTimer); clearTimeout(this.exitDoorTimer); this.entering = null; this._doorReady = false;
    const g = this.g;
    if (this.driving) this.stopDriving({ silent: true });
    g.traffic.setOwnershipState(saveData.world);
    saveData.vehicles ??= []; saveData.world.soldVehicles ??= [];
    this.sys = new VehicleSystem(saveData.vehicles, saveData.world, { economy: g.economy, inventory: g.inventory, spots: this.spots, bus: g.bus, canDeliver:sp=>g.traffic.isClear(sp.x,sp.z,2)&&g.world.collision.isFree(sp.x,sp.z,2) });
    saveData.business ??= {};
    this.biz = new KekeBusiness(saveData.business, { economy: g.economy, network: g.transport.net, bus: g.bus, surge: () => g.transport.trips?.surge ?? 1 });
    this.biz.dropAll(); // you load on foot: any passengers from before have gone their way
    this.clearRiders?.();
    for(const off of this.ownedOffs.values())off();this.ownedOffs.clear();
    for (const [, m] of this.meshes) this.group.remove(m);
    this.meshes.clear(); this.obs.clear();
    for (const v of saveData.vehicles) { if(v.garaged)continue;this.rescue(v); this.addOwned(v); }
    this.syncSale();
  }

  /** A vehicle saved somewhere it can't be (in the river under a bridge, inside a wall): onto the nearest road. */
  rescue(v) {
    const g = this.g, w = g.world;
    if (Number.isFinite(v.x) && Number.isFinite(v.z) && !w.terrain.isWater(v.x, v.z) && w.collision.isFree(v.x, v.z, 1.0)) return false;
    let best = null, bd = Infinity;
    for (const e of g.graph.edgesNear(v.x || 0, v.z || 0, 600, 0, (ed) => ed.drivable && !ed.road.elevated)) {
      const [ax, az] = g.graph.nodes[e.a];
      for (const t of [0.25, 0.5, 0.75]) {
        const x = ax + e.dx * e.len * t, z = az + e.dz * e.len * t;
        if (w.terrain.isWater(x, z)) continue;
        const d = Math.hypot(x - v.x, z - v.z);
        if (d < bd) { bd = d; best = { x, z, h: Math.atan2(e.dx, e.dz) }; }
      }
    }
    if (!best) return false;
    v.x = best.x; v.z = best.z; v.heading = best.h;
    return true;
  }

  syncSale() { /* Display vehicles belong to the dealer; purchases spawn separately in the collection bay. */ }

  addOwned(v) {
    this.ownedOffs.get(v.id)?.();
    const g = this.g, m = this.makeMesh(v.model, v.paint);
    this.group.add(m); this.meshes.set(v.id, m);
    const T = TYPES[v.model];
    const o = { id: 'own:' + v.id, type: vehicleBody(v.model), T, x: v.x, y: 0, z: v.z, dx: Math.sin(v.heading), dz: Math.cos(v.heading), yaw: v.heading, speed: 0, own: true, lit: false };
    this.obs.set(v.id, o);
    g.traffic.obstacles = [...this.obs.values()];
    this.placeMesh(v);
    this.ownedOffs.set(v.id,g.interactions.register({
      get x() { return v.x; }, get z() { return v.z; }, radius: T.len / 2 + 1.4,
      enabled: () => !v.garaged && !this.driving && this.sys?.get(v.id) === v && !g.world.collision.inZone(g.player.position.x, g.player.position.z),
      label: () => `${this.needsMenu(v) ? 'Your' : 'Open & enter your'} ${VEHICLE_MODELS[v.model].label.toLowerCase()} · fuel ${v.fuel.toFixed(1)} L${v.damage > 0 ? ` · damage ${v.damage}%` : ''}${this.sys.standAt(v.x, v.z) ? ' · at a car stand' : ''}`,
      onInteract: () => { if (this.needsMenu(v)) g.openChoice(() => this.carView(v)); else this.startDriving(v); },
    }));
  }

  placeMesh(v, y = 0, pitch = 0, roll = 0) {
    const m = this.meshes.get(v.id); if (!m) return;
    m.position.set(v.x, y, v.z); m.rotation.set(0, 0, 0); m.rotation.order = 'YXZ'; m.rotation.y = v.heading; m.rotation.x = pitch; m.rotation.z = roll;
    const o = this.obs.get(v.id);
    Object.assign(o, { x: v.x, z: v.z, y, yaw: v.heading, dx: Math.sin(v.heading), dz: Math.cos(v.heading) });
  }

  colourView(sp){return{title:'Choose '+sp.label+' colour',kicker:'PAINT INCLUDED · NO EXTRA CHARGE',text:'The selected finish is saved with your vehicle and kept in your garage.',options:[...VEHICLE_PAINTS.map(p=>({label:p.name,color:p.hex,sub:this.selectedPaint.get(sp.id)===p.hex?'Selected':null,act:()=>{this.selectedPaint.set(sp.id,p.hex);this.g.openChoice(()=>this.buyView(sp));}})),{label:'Back',ghost:true,act:()=>this.g.openChoice(()=>this.buyView(sp))}]};}
  buyView(sp) {
    const g = this.g, can = g.economy.canAfford(sp.price), M = VEHICLE_MODELS[sp.model];
    return {
      title: sp.label, kicker: sp.lotName.toUpperCase(),
      text: `Seller: “${sp.model === 'keke' ? 'Clean keke, engine sound well' : 'Tokunbo, clean, no wahala'}. ${naira(sp.price)} — e get papers.” Tank ${M.tank} L (comes half full), uses about ${M.use} L per km.`,
      note: can ? `You have ${naira(g.economy.balance)}. It will appear in this stand’s marked collection bay. Walk up and press E to drive.` : `You have ${naira(g.economy.balance)} — you need ${naira(sp.price - g.economy.balance)} more.`,
      options: [
        {label:'Choose colour · '+paintName(this.selectedPaint.get(sp.id)??sp.paint),sub:'Paint included in price',act:()=>g.openChoice(()=>this.colourView(sp))},
        { label: `Buy it — ${naira(sp.price)}`, primary: true, disabled: !can, why: 'Not enough money', act: () => {
          const r = this.sys.buy(sp.id,this.selectedPaint.get(sp.id)??null);
          if (!r.ok) { g.ui.toast(r.error === 'insufficient-funds' ? 'Not enough money' : r.error === 'delivery-blocked' ? 'Collection bay blocked — move the vehicle there first. No money was taken.' : 'It has already been sold'); return; }
          g.closeChoice(); this.syncSale(); this.addOwned(r.vehicle); g.saveGame();
          g.ui.toast(`The ${sp.label.toLowerCase()} is yours. Press E next to it to drive.`);
        } },
        { label: 'Back to stand', ghost: true, act: () => g.openChoice(()=>this.dealerView(sp.plot)) },
      ],
    };
  }

  /** Whether walking up to your vehicle offers more than "drive": jerrycan, spare parts, or a car stand. */
  needsMenu(v) {
    const jerry = this.g.inventory.has('jerrycan') && VEHICLE_MODELS[v.model].tank - v.fuel >= FUEL.jerrycanLitres;
    return jerry || (v.damage > 0 && this.sys.partsFor(v).length > 0) || !!this.sys.standAt(v.x, v.z);
  }

  carView(v) {
    const g = this.g, M = VEHICLE_MODELS[v.model], lot = this.sys.standAt(v.x, v.z);
    const jerry = g.inventory.has('jerrycan');
    const options = [{ label: 'Drive', primary: true, act: () => { g.closeChoice(); this.startDriving(v); } }];
    if (jerry) options.push({ label: `Pour the jerrycan in (+${FUEL.jerrycanLitres} L)`, disabled: M.tank - v.fuel < FUEL.jerrycanLitres, why: 'Need room for the full 5 L can',
      act: () => { const r = this.sys.pourJerrycan(v); g.ui.toast(r.ok ? `Fuel now ${v.fuel.toFixed(1)} L` : 'The tank is nearly full'); g.renderChoice(); g.saveGame(); } });
    for (const p of this.sys.partsFor(v)) {
      const name = ITEMS[p.id]?.name ?? p.id;
      options.push({ label: `Fit the ${name.toLowerCase()} yourself`, sub: `−${p.fix} damage`, disabled: !(v.damage > 0), why: 'Nothing to fix',
        act: () => { const r = this.sys.fitPart(v, p.id); g.ui.toast(r.ok ? `Done. Damage now ${v.damage}%` : 'That did not work'); g.renderChoice(); g.saveGame(); } });
    }
    if (lot) {
      const cost = this.sys.repairQuote(v), price = this.sys.sellQuote(v);
      options.push({ label: `Mechanic: fix everything — ${naira(cost)}`, disabled: !(v.damage > 0) || !g.economy.canAfford(cost), why: !(v.damage > 0) ? 'Nothing to fix' : 'Not enough money',
        act: () => { const r = this.sys.repair(v, lot); g.ui.toast(r.ok ? `Fixed for ${naira(r.cost)} — e don set` : 'Not enough money'); g.renderChoice(); if (r.ok) g.saveGame(); } });
      options.push({ label: `Sell it here — ${naira(price)}`, sub: 'The dealer pays cash', act: () => g.openChoice(() => this.sellView(v, lot)) });
    }
    options.push({ label: 'Not now', ghost: true, act: () => g.closeChoice() });
    return {
      sheet: true, // compact card at the bottom: the car stays in view
      title: `Your ${M.label.replace(/\s*\(.*\)$/, '')}`, kicker: lot ? lot.name.toUpperCase() : undefined,
      text: `Fuel: ${v.fuel.toFixed(1)} of ${M.tank} L. ${v.damage > 0 ? `Damage: ${v.damage}% — top speed down to ${Math.round(this.sys.maxSpeed(v) * 3.6)} km/h.` : 'No damage.'}`,
      note: lot ? null : v.damage > 0 ? 'Mechanics at any of the six car stands can fix it; spare parts from the market fix some of it.' : null,
      options,
    };
  }

  sellView(v, lot) {
    const g = this.g, price = this.sys.sellQuote(v), M = VEHICLE_MODELS[v.model];
    return {
      title: `Sell your ${M.label.toLowerCase()}?`, kicker: lot.name.toUpperCase(),
      text: `Dealer: “I go give you ${naira(price)} — ${v.damage > 0 ? 'e don get small wahala, the body don jam' : 'na fair price, market no too good'}.” You paid ${naira(M.price)}.`,
      note: 'Selling is final — the vehicle goes to the dealer.',
      options: [
        { label: `Sell for ${naira(price)}`, primary: true, disabled: !!g.business?.isPledged(`vehicle:${v.id}`) || !!g.authority?.isUnverified('vehicle', v.id), why: g.authority?.isUnverified('vehicle', v.id) ? 'Your account server has no record of paying for it, so it can\'t be sold' : 'Pledged to the bank for a loan: repay it first', act: () => {
          const r = this.sys.sell(v.id, lot);
          if (!r.ok) { g.ui.toast('The dealer changed his mind'); return; }
          this.removeOwned(v); g.closeChoice(); g.saveGame();
          g.ui.toast(`Sold for ${naira(r.price)}`);
        } },
        { label: 'Keep it', ghost: true, act: () => g.openChoice(() => this.carView(v)) },
      ],
    };
  }

  removeOwned(v) {
    this.ownedOffs.get(v.id)?.();this.ownedOffs.delete(v.id);
    const m = this.meshes.get(v.id); if (m) this.group.remove(m);
    this.meshes.delete(v.id); this.obs.delete(v.id);
    this.g.traffic.obstacles = [...this.obs.values()];
  }

  animateDoors(dt) { const f=this.g.worldFocus();for(const p of this.dealerships)p.group.visible=Math.hypot(p.x-f.x,p.z-f.z)<650; for (const m of this.meshes.values()) tickCarDoors(m, dt); for (const m of this.saleMeshes.values()) tickCarDoors(m, dt); }

  // ------------------------------------------------------------------ driving
  startDriving(v) {
    const g = this.g, M = VEHICLE_MODELS[v.model];
    const held = g.police?.isHeld(v.id);
    if (held) { g.ui.toast(`The police are holding this vehicle — pay ${naira(held.amount)} to the officers at the checkpoint to release it.`); return; }
    if (this.entering) return;
    if (this.paysFares(v)) this.setFareVehicle(v);
    const mesh = this.meshes.get(v.id);
    if (mesh?.userData.doors && !this._doorReady) {
      this.entering = v.id; this.doorSide = carSideOf(v.heading, v.x, v.z, g.player.position.x, g.player.position.z); setCarDoors(mesh, true, this.doorSide); // v0.46: the door on your side
      g.player.setState(ControlState.FROZEN);
      this.entryTimer = setTimeout(() => {
        this.entering = null;
        if (g.state !== 'playing') { setCarDoors(mesh, false); g.player.setState(ControlState.ON_FOOT); return; }
        this._doorReady = true; this.startDriving(v); this._doorReady = false;
        setCarDoors(mesh, false);
      }, 550);
      return;
    }
    this.driving = v;
    g.carRadio?.sync(0);
    this.car = { speed: 0, deck: null, y: 0, pitch: 0, bumpT: 0, emptyWarned: false, steer: 0 };
    g.player.setState(ControlState.DRIVER);
    g.player.velocity.set(0, 0, 0);
    this.obs.get(v.id).lit = true;
    g.cameraRig.setPassenger(M.cam);
    g.cameraRig.yaw = v.heading + Math.PI;
    g.ui.setPrompt(null);
    g.ui.toast(v.fuel <= 0 ? 'The tank is empty — pour a jerrycan in or push… (buy one from a spare-parts trader)' : 'W/S drive and brake · A/D steer · E get out');
  }

  /** Get out on the driver's side (left); the other side if that is blocked. */
  stopDriving({ silent = false } = {}) {
    const g = this.g, v = this.driving; if (!v) return false;
    if (Math.abs(this.car.speed) > 1.5 && !silent) { g.ui.toast('Slow down first'); return false; }
    if (this.car.deck && !silent) { g.ui.toast('You can’t get out on the bridge — drive off it first'); return false; }
    const T = TYPES[v.model], lx = Math.cos(v.heading), lz = -Math.sin(v.heading); // local +X (left side)
    let spot = null;
    let outSide = 1;
    for (const side of [1, -1]) {
      const x = v.x + lx * side * (T.wid / 2 + 0.7), z = v.z + lz * side * (T.wid / 2 + 0.7);
      if (g.world.collision.isFree(x, z, CONFIG.player.radius + 0.05)) { spot = [x, z]; outSide = side; break; }
    }
    spot ??= g.world.findFreeSpot(v.x + lx * (T.wid / 2 + 0.7), v.z + lz * (T.wid / 2 + 0.7), CONFIG.player.radius + 0.1);
    if (this.biz?.riders.length) {
      const n = this.biz.dropAll().length; this.clearRiders();
      if (!silent) g.ui.toast(`Your ${n === 1 ? 'passenger' : `${n} passengers`} got down — no pay for an unfinished ride.`);
    }
    setCarDoors(this.meshes.get(v.id), true, spot ? outSide : 1); // v0.46: only the door you get out of
    clearTimeout(this.exitDoorTimer);
    this.exitDoorTimer = setTimeout(() => setCarDoors(this.meshes.get(v.id), false), 900);
    this.driving = null;
    g.carRadio?.sync(0);
    g.audio.engine?.(false);
    this.obs.get(v.id).lit = false;
    this.placeMesh(v, 0, 0);
    g.player.teleport(spot[0], spot[1], v.heading);
    g.player.setState(ControlState.ON_FOOT);
    g.player.human.group.visible = true;
    g.cameraRig.setMode('follow');
    g.cameraRig.yaw = v.heading + Math.PI;
    g.cameraRig.snapTo(new THREE.Vector3(spot[0], CONFIG.camera.height, spot[1]));
    if (!silent) g.saveGame();
    return true;
  }

  /** The frame update while driving (replaces on-foot movement). */
  update(dt, input) {
    const g = this.g, v = this.driving; if (!v) return;
    const M = VEHICLE_MODELS[v.model], T = TYPES[v.model], c = this.car;
    const mv = input.getMove();
    let throttle = mv.y, steer = -mv.x;
    if (v.fuel <= 0) { if (throttle > 0) throttle = 0; if (!c.emptyWarned) { c.emptyWarned = true; g.ui.toast('Out of fuel! Buy a jerrycan at a spare-parts trader, or fill up at a station.'); } }
    // speed
    if (throttle > 0.05) c.speed += (c.speed < -0.2 ? 9 : M.accel * Math.max(0, 1 - Math.max(0, c.speed) / this.sys.maxSpeed(v))) * throttle * dt;
    else if (throttle < -0.05) c.speed += (c.speed > 0.3 ? -9 : -2.5) * -throttle * dt;
    const drag = (0.5 + 0.012 * c.speed * c.speed) * dt + (Math.abs(throttle) < 0.05 ? 1.2 * dt : 0);
    c.speed = Math.abs(c.speed) <= drag ? 0 : c.speed - Math.sign(c.speed) * drag;
    const top = this.sys.maxSpeed(v);
    if (c.speed > top) c.speed = Math.max(top, c.speed - 6 * dt);
    c.speed = Math.max(-4, c.speed);
    // steering and grip (a simple bicycle model): the front wheels ask for a turn rate; the tyres can only
    // give so much sideways grip (less in the rain, much less at the back with the handbrake on). Ask for
    // more and the vehicle runs wide (understeer) and slides; the handbrake swings the back round.
    const hand = (!!input.keys?.has('Space') || !!input.handbrake) && Math.abs(c.speed) > 2;
    c.steer += (steer - c.steer) * Math.min(1, dt * 7);
    const wheelbase = T.len * 0.6;
    const angle = c.steer * Math.min(0.6, M.steer * 0.34) / (1 + Math.abs(c.speed) / 16);
    const wet = (g.weather?.w.rain ?? 0) > 0.15 || (g.atmosphere.wet ?? 0) > 0.3;
    const grip = (M.grip ?? 7) * (wet ? 0.72 : 1) * (1 - 0.25 * ((v.damage ?? 0) / 100));
    const want = (c.speed * Math.tan(angle)) / wheelbase;
    const limit = grip / Math.max(2, Math.abs(c.speed));
    let yawRate = Math.max(-limit, Math.min(limit, want));
    if (hand) { yawRate = want * 1.45; c.speed -= Math.sign(c.speed) * 3.5 * dt; }
    // sideways slide: whatever turn the tyres couldn't hold pushes the vehicle outwards, then grip pulls it back
    const lost = Math.abs(want - yawRate) * Math.abs(c.speed) * (hand ? 0.35 : 1);
    c.side = (c.side ?? 0) - Math.sign(want) * Math.sign(c.speed || 1) * lost * dt * 0.9;
    c.side *= Math.exp(-(hand ? 1.4 : wet ? 3 : 5) * dt);
    if (Math.abs(c.side) < 0.02) c.side = 0;
    v.heading += yawRate * dt;
    c.latAcc = Math.abs(c.speed * yawRate);
    // a keke cornering hard lifts a wheel: it scrubs speed and warns you
    if (v.model === 'keke' && c.latAcc > 5.2) { c.speed *= 1 - 0.8 * dt; c.tip = Math.min(1, (c.tip ?? 0) + dt * 2); if (c.tip > 0.6 && !(c.tipWarn > 0)) { c.tipWarn = 4; g.ui.toast('Easy! The keke nearly tipped over.'); } }
    else c.tip = Math.max(0, (c.tip ?? 0) - dt * 2);
    c.tipWarn = (c.tipWarn ?? 0) - dt;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const ox = v.x, oz = v.z;
    v.x += (fx * c.speed + fz * c.side) * dt; v.z += (fz * c.speed - fx * c.side) * dt;
    g.audio.engine?.(true, { speed: c.speed, throttle, model: v.model, slide: Math.abs(c.side) });
    // v0.48: the Niger Bridge is closed at mid-river (Asaba is COMING SOON)
    if (g.guardPlayArea({ x: v.x, z: v.z }, () => { v.x = ox; v.z = oz; c.speed = 0; c.side = 0; }, 10)) { /* stopped at the barrier */ }
    // bridge decks and ramps
    this.updateDeck(v, T);
    g.police?.update(dt, v, c);
    if(!this.driving||g.state==='chase')return;
    // collisions: three circles along the body against walls/poles/water (not on a deck), traffic and people
    const r = T.wid / 2 * 0.92, half = T.len / 2 - r;
    let cx = 0, cz = 0, hit = 0;
    for (const k of [-1, 0, 1]) {
      const p = { x: v.x + fx * half * k, z: v.z + fz * half * k };
      const p0x = p.x, p0z = p.z;
      if (!c.deck) g.world.collision.resolveCircle(p, r);
      const hitV = g.traffic.pushOut(p, r * 0.9, this.obs.get(v.id), c.y);
      if (hitV && Math.abs(c.speed) > 2.5 && g.traffic.near.includes(hitV) && g.traffic.hit(hitV, 'player', Math.abs(c.speed) / 4)) g.ui.toast('The driver is not happy with you!');
      if (!c.deck) {
        const hitP = g.npcs.pushOut(p, r * 0.8);
        if (hitP && Math.abs(c.speed) > 4 && !(hitP.hitAt > performance.now() - 3000)) {
          hitP.hitAt = performance.now();
          const rel = g.npcs.rel(hitP.identity); rel.negative += 2;
          g.npcs.say(hitP, { gen: 'Ahh! You don jam me! You no get eye?' }, 3);
          c.speed *= 0.5;
          g.police?.hitPerson();
          if (Math.abs(c.speed) > 8) g.hospitals?.npcHit(hitP.x, hitP.z);
        }
      }
      const ddx = p.x - p0x, ddz = p.z - p0z;
      if (ddx || ddz) { cx += ddx; cz += ddz; hit++; }
    }
    if (hit) {
      v.x += cx / hit; v.z += cz / hit;
      const push = Math.hypot(cx, cz) / hit;
      if (push > 0.01) {
        if (Math.abs(c.speed) > 6 && c.bumpT <= 0) {
          c.bumpT = 1.2; g.audio.horn?.(0, 4);
          const add = this.sys.crash(v, Math.abs(c.speed) * Math.min(1, push * 6 + 0.4));
          g.ui.toast(add > 0 ? `Bam! The body don dent — damage ${v.damage}%` : 'Bam! Careful o.');
        }
        c.speed *= Math.max(0.2, 1 - push * 4);
      }
    }
    c.bumpT -= dt;
    // fuel
    const moved = Math.hypot(v.x - ox, v.z - oz);
    this.sys.burn(v, moved);
    // the player sits in the vehicle (visible in a keke, through the glass in a car)
    // body lean: a little roll in corners (more for a keke, which also lifts a wheel when pushed)
    const roll = Math.max(-0.12, Math.min(0.12, -Math.sign(c.speed * (v.heading - (c.lastHeading ?? v.heading))) * Math.min(1, (c.latAcc ?? 0) / 7) * (v.model === 'keke' ? 0.07 + 0.06 * (c.tip ?? 0) : 0.035)));
    c.lastHeading = v.heading;
    this.placeMesh(v, c.y, c.pitch, roll);
    this.obs.get(v.id).speed = c.speed;
    const [sx, sy, sz] = SEATS[v.model].driver;
    const seat = new THREE.Vector3(sx, sy, sz).applyEuler(new THREE.Euler(c.pitch, v.heading, 0, 'YXZ'));
    g.player.position.set(v.x + seat.x, c.y + seat.y - SEAT_HEIGHT, v.z + seat.z);
    g.player.heading = v.heading; g.player.speed = 0;
    g.player.animator?.sit(dt, Math.min(1, Math.abs(c.speed) / 10) * Math.sin(performance.now() / 600));
    if(v.model==='motorcycle')poseMotorcycle(g.player.human);
    g.player.syncModel();
    g.player.human.group.visible = true;
    // camera
    const look = input.consumeLook(); if (look.dx || look.dy) g.cameraRig.applyLook(look.dx, look.dy);
    const zoom = input.consumeZoom(); if (zoom) g.cameraRig.applyZoom(zoom);
    if (Math.abs(c.speed) > 1 && performance.now() - input.lastLookTime > 1200) g.cameraRig.autoFollow(c.speed >= 0 ? v.heading : v.heading + Math.PI, dt, 2.2);
    g.cameraRig.update(dt, { x: v.x, y: c.y, z: v.z });
    // controls
    if (input.consumePress('interact')) this.stopDriving();
    if (input.consumePress('fuel')) this.refuel();
    if (input.consumePress('nextstop')) this.pickUp();
    if (this.paysFares(v)) this.updateBusiness(dt);
    if (input.consumePress('skip')) g.confirmSkipDrive();
    if (input.consumePress('drophere')) { g.audio.horn?.(0, 2); } // H: horn
    input.consumePress('jump'); input.consumePress('camera');
  }

  // ------------------------------------------------------------------ keke business
  /** Stopped at a stop with people waiting: take them on (N, or the button). */
  pickUp() {
    const g = this.g, v = this.driving;
    if (!v || !this.paysFares(v)) { if (v) g.ui.toast('Only a keke, minibus or bus can carry passengers for money'); return; }
    this.setFareVehicle(v);
    if (Math.abs(this.car.speed) > 1.5) { g.ui.toast('Stop at the bus stop first'); return; }
    if (this.biz.free <= 0) { g.ui.toast('The keke is full'); return; }
    const pl = this.biz.platformNear(v.x, v.z);
    if (!pl) { g.ui.toast('Nobody is waiting here — stop at a bus stop where people are queueing'); return; }
    const got = this.biz.pickUp(pl, g.nowAbs());
    if (!got.length) { g.ui.toast('Nobody here wants to go anywhere you can take them'); return; }
    if (v.model === 'keke') for (const r of got) this.seatRider(r); // bus passengers sit inside, out of sight
    g.npcs.boardWaiters(got.map((r) => r.serial), { x: v.x, z: v.z });
    const list = got.map((r) => `${r.destName} (${naira(r.fare)})`).join(', ');
    g.ui.toast(`${got.length === 1 ? 'A passenger' : `${got.length} passengers`} for ${list}. Stop near their stop to drop them.`);
    this.guideToDrop(true);
  }

  /** v0.41: a keke, minibus or bus can carry paying passengers (fares, seats and route follow the vehicle). */
  paysFares(v) { return !!v && (v.model === 'keke' || ['minibus', 'cbus', 'bus'].includes(vehicleBody(v.model))); }
  setFareVehicle(v) {
    const body = v.model === 'keke' ? 'keke' : vehicleBody(v.model), mode = { keke: 'keke', minibus: 'minibus', cbus: 'cbus', bus: 'coaster' }[body] ?? 'keke';
    this.biz.today = () => this.g.clock.day;
    this.biz.setVehicle({ mode, seats: MODES[mode].seats, line: mode === 'keke' ? null : (this.g.saveData.business.line ?? null) });
  }

  /** Mark the next drop-off on the map (unless you've marked something yourself). */
  guideToDrop(force = false) {
    const g = this.g, v = this.driving; if (!v) return;
    const nd = this.biz.nextDrop(v.x, v.z);
    const ours = g.waypoint?.kekeDrop;
    if (!nd) { if (ours) g.setWaypoint(null); return; }
    if (g.waypoint && !ours && !force) return;
    if (ours === nd.rider.id) return;
    g.setWaypoint({ x: nd.rider.x, z: nd.rider.z, name: `Drop: ${nd.rider.destName}`, radius: 20, kekeDrop: nd.rider.id });
  }

  updateBusiness(dt) {
    const g = this.g, v = this.driving;
    this.bizT = (this.bizT ?? 0) - dt;
    if (this.bizT > 0 || !this.biz.riders.length) return;
    this.bizT = 0.4;
    if (Math.abs(this.car.speed) < 1.2) {
      const paid = this.biz.dropOff(v.x, v.z);
      if (paid.length) {
        for (const p of paid) this.unseatRider(p.rider, true);
        const total = paid.reduce((s, p) => s + p.paid, 0);
        g.ui.toast(`${paid.length === 1 ? `Your passenger got down at ${paid[0].rider.destName}` : `${paid.length} passengers got down`} and paid ${naira(total)}. “Thank you, driver!”`);
        g.audio?.horn?.(0, 3);
        g.saveGame();
      }
    }
    const gone = this.biz.expire(g.nowAbs());
    if (gone.length) {
      for (const r of gone) this.unseatRider(r, false);
      g.ui.toast(`${gone.length === 1 ? 'A passenger' : `${gone.length} passengers`} got tired of waiting and got down — “Driver, you dey waste my time!” No pay.`);
    }
    this.guideToDrop();
  }

  bizStatus(v) {
    const n = this.biz.riders.length;
    if (!n) {
      const pl = Math.abs(this.car.speed) < 1.5 ? this.biz.platformNear(v.x, v.z) : null;
      return pl ? `${pl.queue.length} waiting at ${pl.stop.name} — pick up (N)` : null;
    }
    const nd = this.biz.nextDrop(v.x, v.z);
    const total = this.biz.riders.reduce((s, r) => s + r.fare, 0);
    return `${n} passenger${n > 1 ? 's' : ''} · ${naira(total)} to collect · next drop ${nd.rider.destName}, ${Math.round(nd.dist / 10) * 10} m`;
  }

  /** A passenger sitting in the back of your keke (a pooled NPC body). */
  seatRider(r) {
    this.riderNpcs ??= new Map();
    const idx = this.biz.riders.indexOf(r);
    const g = this.g, rr = (r.serial * 2654435761) >>> 0;
    const gender = rr % 2 ? 'female' : 'male';
    const identity = { id: `kbiz:${r.id}`, kind: 'kbiz', role: 'passenger', gender, name: 'Passenger', template: rr % 1000, x: this.driving.x, z: this.driving.z, yaw: 0 };
    let npc = g.npcs.embody(identity, 'ride');
    // the pool is busy: try the other body type, then make a far-off passer-by (or anyone far away) make way
    for (const gen of [gender, gender === 'male' ? 'female' : 'male']) {
      if (npc) break;
      identity.gender = gen;
      npc = g.npcs.embody(identity, 'ride');
      if (npc) break;
      const dist = (n) => Math.hypot(n.x - this.driving.x, n.z - this.driving.z);
      const far = g.npcs.active.filter((n) => n.identity.gender === gen && n.state !== 'ride' && n.state !== 'talk' && n.identity.id !== g.npcs.priorityId && (n.identity.kind === 'walk' || dist(n) > 30))
        .sort((a, b) => (b.identity.kind === 'walk') - (a.identity.kind === 'walk') || dist(b) - dist(a))[0];
      if (far) { g.npcs.release(far); npc = g.npcs.embody(identity, 'ride'); }
    }
    if (!npc) return;
    npc.rideAt = () => {
      const v = this.driving; if (!v) return null;
      const seats = SEATS[v.model].pax, k = Math.max(0, this.biz.riders.indexOf(r));
      const [sx, sy, sz] = seats[k % seats.length];
      const p = new THREE.Vector3(sx, sy, sz).applyEuler(new THREE.Euler(this.car.pitch, v.heading, 0, 'YXZ'));
      return { x: v.x + p.x, y: this.car.y + p.y - SEAT_HEIGHT, z: v.z + p.z, heading: v.heading };
    };
    void idx;
    this.riderNpcs.set(r.id, npc);
  }

  unseatRider(r, paid) {
    const npc = this.riderNpcs?.get(r.id); if (!npc) return;
    this.riderNpcs.delete(r.id);
    const g = this.g, v = this.driving;
    g.npcs.release(npc);
    if (v) { // they climb out and walk off
      const lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
      g.npcs.spawnAlighting(1, { x: v.x - lx * 1.0, z: v.z - lz * 1.0 }, { x: v.x - lx * 2.6, z: v.z - lz * 2.6 });
    }
    void paid;
  }

  clearRiders() {
    for (const npc of this.riderNpcs?.values() ?? []) this.g.npcs.release(npc);
    this.riderNpcs?.clear();
  }

  /** Where the car you're driving is and where it's heading — for people to get out of its way. */
  carInfo() {
    const v = this.driving; if (!v || this.car.deck) return null;
    const T = TYPES[v.model], fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    return { x: v.x, z: v.z, fx, fz, rx: -fz, rz: fx, speed: this.car.speed, half: T.len / 2, wid: T.wid };
  }

  /** Follow a bridge deck once the car drives up its ramp; leave it at the far ramp. */
  updateDeck(v, T) {
    const c = this.car;
    const project = (road) => {
      const pts = road.points; let best = null, acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az); if (L < 1e-3) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L;
        const t = Math.max(0, Math.min(L, (v.x - ax) * ux + (v.z - az) * uz));
        const qx = ax + ux * t, qz = az + uz * t, lat = (v.x - qx) * -uz + (v.z - qz) * ux, d = Math.hypot(v.x - qx, v.z - qz);
        if (!best || d < best.d) best = { s: acc + t, lat, d, ux, uz, qx, qz };
        acc += L;
      }
      return best;
    };
    if (!c.deck) {
      for (const road of this.decks) {
        const p = project(road); if (!p || p.d > road.width / 2 - 0.3) continue;
        const h = road.heightAt(p.s);
        const along = Math.abs(Math.sin(v.heading) * p.ux + Math.cos(v.heading) * p.uz);
        if (h < 0.9 && along > 0.6) { c.deck = road; break; } // driving onto the foot of a ramp
      }
    }
    if (c.deck) {
      const road = c.deck, p = project(road), L = road.length;
      const h = road.heightAt(p.s);
      // parapets / railings: keep on the deck
      const lim = road.width / 2 - T.wid / 2 - 0.15;
      if (Math.abs(p.lat) > lim) { const k = Math.sign(p.lat) * lim; v.x = p.qx + -p.uz * k; v.z = p.qz + p.ux * k; c.speed *= 0.96; }
      c.y = h - 0.08;
      const h2 = road.heightAt(Math.min(L, p.s + 2)), h1 = road.heightAt(Math.max(0, p.s - 2));
      const dir = Math.sign(Math.sin(v.heading) * p.ux + Math.cos(v.heading) * p.uz) || 1;
      c.pitch = -Math.atan2((h2 - h1) * dir, 4);
      if (h < 0.35 && (p.s < 3 || p.s > L - 3 || p.d > road.width / 2)) { c.deck = null; c.y = 0; c.pitch = 0; }
    } else { c.y = 0; c.pitch = 0; }
  }

  nearestStation(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.stations) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
    return best ? { station: best, dist: bd } : null;
  }

  refuel() {
    const g = this.g, v = this.driving; if (!v) return;
    const ns = this.nearestStation(v.x, v.z);
    if (!ns || ns.dist > FUEL.stationRadius) { g.ui.toast('No filling station here'); return; }
    if (Math.abs(this.car.speed) > 0.8) { g.ui.toast('Stop at the pump first'); return; }
    const r = this.sys.refuel(v, ns.station.name);
    g.ui.toast(r.ok ? `Filled ${r.litres} L for ${naira(r.cost)}` : r.error === 'full' ? 'The tank is full' : `Fuel is ${naira(FUEL.pricePerLitre)} a litre — your money no reach`);
    if (r.ok) g.saveGame();
  }

  /** Drive HUD view (or null when not driving). */
  driveView() {
    const v = this.driving; if (!v) return null;
    const g = this.g, M = VEHICLE_MODELS[v.model], c = this.car;
    const ns = this.nearestStation(v.x, v.z);
    const atPump = ns && ns.dist <= FUEL.stationRadius;
    const low = v.fuel < M.tank * 0.2;
    const dest = g.skipDestination();
    return {
      damage: v.damage ?? 0,
      title: `Your ${M.label.replace(/\s*\(.*\)$/, '')}${v.damage > 0 ? ` · damage ${v.damage}%` : ''}`, speed: Math.round(Math.abs(c.speed) * 3.6), fuel: v.fuel, tank: M.tank,
      status: g.police?.statusLine(v) ? g.police.statusLine(v) : this.paysFares(v) && this.bizStatus(v) ? this.bizStatus(v) : !atPump && this.sys.standAt(v.x, v.z) && Math.abs(c.speed) < 4 ? `${this.sys.standAt(v.x, v.z).name} — get out (E) to see the mechanic or sell` : atPump ? `${ns.station.name} filling station — fill up (F) · ${naira(FUEL.pricePerLitre)}/L` : low && ns ? `Fuel low — nearest station ${ns.station.name}, ${Math.round(ns.dist / 10) * 10} m ${compass(v.x, v.z, ns.station.x, ns.station.z)}` : c.deck ? `On the ${c.deck.name ? c.deck.name.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()) : 'flyover'}` : 'W/S drive · A/D steer · H horn',
      canExit: Math.abs(c.speed) <= 1.5 && !c.deck, canFuel: !!atPump, low,
      canPickup: this.paysFares(v) && this.biz.free > 0 && Math.abs(c.speed) < 1.5 && !!this.biz.platformNear(v.x, v.z),
      skip: dest ? `Skip drive to ${dest.name}` : null,
    };
  }

  /** Skip the drive to a destination along the roads: time and fuel are spent, the car is parked at the kerb there. */
  planSkip() {
    const v = this.driving, g = this.g; if (!v) return null;
    const dest = g.skipDestination(); if (!dest) return { error: 'no-destination' };
    if (this.car.deck) return { error: 'on-bridge' };
    const plan = planDrive(g.graph, { x: v.x, z: v.z }, dest);
    if (!plan) return { error: 'no-route', dest };
    if (plan.metres < SKIP.minMetres) return { error: 'too-close', dest };
    const litres = this.sys.fuelFor(v, plan.metres);
    const minutes = Math.max(SKIP.minMinutes, Math.round(plan.metres / SKIP.driveMetresPerMinute));
    return { dest, plan, litres, minutes, ok: v.fuel >= litres };
  }

  doSkip(info) {
    const g = this.g, v = this.driving, T = TYPES[v.model];
    // park at the kerb by the destination (search along the road if that exact spot is taken)
    let { x, z, heading } = info.plan.stop;
    const fx = Math.sin(heading), fz = Math.cos(heading);
    for (let k = 0; k < 24; k++) {
      const d = (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 3;
      const px = x + fx * d, pz = z + fz * d;
      if ([-1, 0, 1].every((s) => g.world.collision.isFree(px + fx * s * (T.len / 2 - 1), pz + fz * s * (T.len / 2 - 1), T.wid / 2))) { x = px; z = pz; break; }
    }
    v.x = x; v.z = z; v.heading = heading;
    this.sys.burn(v, info.plan.metres);
    Object.assign(this.car, { speed: 0, side: 0, deck: null, y: 0, pitch: 0 });
    this.placeMesh(v);
    g.cameraRig.yaw = heading + Math.PI;
    g.cameraRig.snapTo(new THREE.Vector3(x, CONFIG.camera.height, z));
    g.skipTime(info.minutes, {});
    g.ui.toast(`${durationLabel(info.minutes)} later — you have arrived near ${info.dest.name}`);
  }

  /** Saved position while driving: next to the car (you are on foot when you load). */
  savePosition() {
    const v = this.driving; if (!v) return null;
    if (this.car.deck) {
      // saving on a flyover or the Niger Bridge: park at the nearer end of the deck, on the ground, so a reload
      // never puts the car (or you) under the bridge or in the river
      const pts = this.car.deck.points, a = pts[0], b = pts[pts.length - 1];
      const useA = Math.hypot(a[0] - v.x, a[1] - v.z) < Math.hypot(b[0] - v.x, b[1] - v.z);
      const [ex, ez] = useA ? a : b, [px, pz] = useA ? pts[1] : pts[pts.length - 2];
      const dx = ex - px, dz = ez - pz, l = Math.hypot(dx, dz) || 1;
      const [fx, fz] = this.g.world.findFreeSpot(ex + dx / l * 8, ez + dz / l * 8, 1.4);
      v.x = fx; v.z = fz; v.heading = Math.atan2(dx, dz);
    }
    const T = TYPES[v.model], lx = Math.cos(v.heading), lz = -Math.sin(v.heading);
    const [x, z] = this.g.world.findFreeSpot(v.x + lx * (T.wid / 2 + 0.7), v.z + lz * (T.wid / 2 + 0.7), CONFIG.player.radius + 0.1);
    return { x: +x.toFixed(2), z: +z.toFixed(2), heading: +v.heading.toFixed(3) };
  }
}
