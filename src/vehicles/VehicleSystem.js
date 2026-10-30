import {VEHICLE_PAINTS} from '../data/VehiclePaints.js';
import {VEHICLE_CATALOGUE, ROADSIDE} from '../data/VehicleCatalogue.js';
import { VEHICLE_MODELS, VEHICLE_LOTS, FUEL, WEAR, vehicleBody } from '../data/housing.js';

/*
  Personal vehicles: for sale at a few roadside car stands, bought once, then yours to drive and park.
  - Buying is one Economy.transact with the sale spot's key, so a double tap never buys twice.
  - Fuel is in litres; driving uses it by distance. Fill up at a filling station (pay for whole litres
    you can afford — never a partial payment) or pour a jerrycan from the bag next to the vehicle.
  - Only vehicles you own can be driven; traffic vehicles can't be entered.
  - Crashes dent it (damage 0–100, less top speed); mechanics at the car stands fix it, or use spare parts.
  - Car stands buy vehicles back (one Economy.transact with the vehicle's key).
  State in the save: vehicles: [{id, model, paint, x, z, heading, fuel, odo, damage}], world.soldVehicles: [spotId]
*/

const PAINTS = {
  keke: ['#f2c200', '#1d6e3a', '#2b5fae'],
  sedan: ['#c9ccd1', '#1b1d22', '#7b1e1e', '#2c4f7c', '#d8d3c4'],
  executive: ['#111316', '#cfd2d6', '#3b3f45', '#6b0f1a'],
  suv: ['#0e0f12', '#e8e9eb', '#4a4e55', '#2d3a2a'],
};
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Six off-road forecourts. Every point in the plot and driveway must be clear before placement. */
export function pickSaleSpots(graph, landmarks, { free = () => true, offRoad = () => true } = {}) {
  const spots=[], plots=[];
  for(const lot of VEHICLE_LOTS){
    const l=landmarks.get(lot.near); if(!l)continue; let chosen;
    for(const radius of [500,1000,1800,2800]){
      const edges=graph.edgesNear(l.x,l.z,radius,0,e=>e.drivable&&!e.road.elevated&&e.len>40&&['trunk','primary','secondary','tertiary'].includes(e.road.type))
        .sort((a,b)=>{const A=graph.nodes[a.a],B=graph.nodes[b.a];return Math.hypot(A[0]-l.x,A[1]-l.z)-Math.hypot(B[0]-l.x,B[1]-l.z)||a.id-b.id;});
      outer:for(const e of edges)for(const t of [.5,.25,.75,.1,.9])for(const side of [1,-1]){
        const [ax,az]=graph.nodes[e.a],nx=-e.dz*side,nz=e.dx*side,ux=e.dx*side,uz=e.dz*side;
        const x=ax+e.dx*e.len*t+nx*(e.road.width/2+15),z=az+e.dz*e.len*t+nz*(e.road.width/2+15);
        if(plots.some(q=>Math.hypot(q.x-x,q.z-z)<100))continue;
        const at=(u,v)=>({x:x+ux*u+nx*v,z:z+uz*u+nz*v});
        let clear=true;
        for(let u=-16;u<=16&&clear;u+=4)for(let v=-12;v<=12;v+=4){const q=at(u,v);if(!offRoad(q.x,q.z,2)||!free(q.x,q.z,2.5)){clear=false;break;}}
        // A straight, drivable/walkable entrance reaches the road with no wall, tree or river in between.
        for(let v=-15;v<=-12&&clear;v+=1){const q=at(0,v);if(!free(q.x,q.z,5))clear=false;}
        if(!clear)continue;
        const desk=at(-11,5.9),delivery=at(0,-6),entry=at(0,-12);
        chosen={...lot,x,z,heading:Math.atan2(nx,nz),desk,delivery,entry,at,frontage:{roadId:e.road.id,roadName:e.road.displayName||e.road.name||e.road.type,roadWidth:e.road.width,setback:2,roadPoint:{x:ax+e.dx*e.len*t,z:az+e.dz*e.len*t}},models:ROADSIDE.map(m=>m.id)};break outer;
      }
      if(chosen)break;
    }
    if(!chosen)throw Error('No safe off-road forecourt for '+lot.id);
    plots.push(chosen);
    ROADSIDE.map(m=>m.id).forEach((model,k)=>{const M=VEHICLE_MODELS[model],paints=PAINTS[vehicleBody(model)]??PAINTS.sedan;
      spots.push({id:`${lot.id}:catalog25:${model}`,lot:lot.id,lotName:lot.name,model,label:M.label,price:M.price,paint:paints[hash(lot.id+k)%paints.length],x:chosen.delivery.x,z:chosen.delivery.z,heading:chosen.heading+Math.PI,desk:chosen.desk,plot:chosen});});
  }
  return spots;
}

export class VehicleSystem {
  constructor(vehicles, world, { economy, inventory, spots, bus = null, canDeliver = () => true }) {
    this.list = vehicles; this.world = world; world.soldVehicles ??= [];
    this.economy = economy; this.inventory = inventory; this.bus = bus;
    this.spots = spots; this.seq = 0; this.canDeliver=canDeliver;
  }

  forSale() { return this.spots.filter((s) => !this.world.soldVehicles.includes(s.id)); }
  get(id) { return this.list.find((v) => v.id === id) ?? null; }
  model(v) { return VEHICLE_MODELS[v.model]; }

  /** Buy the vehicle at a sale spot. It stays where it is, now yours, with half a tank. */
  buy(spotId,paint=null) {
    const spot = this.spots.find((s) => s.id === spotId);
    if (!spot) return { ok: false, error: 'no-such-vehicle' };
    if(paint!==null&&!VEHICLE_PAINTS.some(p=>p.hex===paint))return{ok:false,error:'invalid-colour'};
    if (this.world.soldVehicles.includes(spotId)) return { ok: false, error: 'sold' };
    if(this.list.some(v=>Math.hypot(v.x-spot.x,v.z-spot.z)<9)||!this.canDeliver(spot))return {ok:false,error:'delivery-blocked'};
    const tx = this.economy.transact({ key: `buy-vehicle:${spotId}`, amount: -spot.price, reason: `Bought ${spot.label} at ${spot.lotName}`, ref: { spot: spotId } });
    if (!tx.ok) return { ok: false, error: tx.error, price: spot.price };
    const M = VEHICLE_MODELS[spot.model];
    const v = { id: `veh:${spotId}`, model: spot.model, paint: paint??spot.paint, garaged:false, x: spot.x, z: spot.z, heading: spot.heading, fuel: Math.round(M.tank * 0.5 * 10) / 10, odo: 0 };
    this.list.push(v);
    this.world.soldVehicles.push(spotId);
    this.bus?.emit('vehicle:bought', v);
    return { ok: true, vehicle: v, balance: tx.balance };
  }

  // ---------------------------------------------------------------- wear, repairs, selling
  /** Top speed now, after damage. */
  maxSpeed(v) { return this.model(v).maxSpeed * (1 - WEAR.maxSpeedLoss * (v.damage ?? 0) / 100); }

  /** A crash at `impact` m/s (closing speed). Returns the damage points added. */
  crash(v, impact) {
    const add = Math.round(Math.max(0, impact - WEAR.crashSpeed) * WEAR.perMs);
    if (add > 0) v.damage = Math.min(100, (v.damage ?? 0) + add);
    return add;
  }

  /** The car stand within reach of (x, z), or null. */
  standAt(x, z) {
    for (const lot of VEHICLE_LOTS) {
      const near = this.spots.filter((s) => s.lot === lot.id);
      if (near.some((s) => Math.hypot(s.x - x, s.z - z) <= WEAR.standRadius)) return lot;
    }
    return null;
  }

  repairQuote(v) { return Math.max(500, Math.round((v.damage ?? 0) * this.model(v).price * WEAR.mechanicPerPoint / 100) * 100); }

  /** A mechanic at a car stand fixes all the damage. All or nothing. */
  repair(v, lot) {
    if (!(v.damage > 0)) return { ok: false, error: 'no-damage' };
    if (!lot) return { ok: false, error: 'no-mechanic' };
    const cost = this.repairQuote(v);
    const tx = this.economy.transact({ key: `repair:${v.id}:service:${v.repairSeq??0}`, amount: -cost, reason: `Mechanic at ${lot.name}: fixed your ${this.model(v).label.toLowerCase()}`, ref: { vehicle: v.id, damage: v.damage } });
    if (!tx.ok) return { ok: false, error: tx.error, cost };
    v.repairSeq=(v.repairSeq??0)+1;
    v.damage = 0;
    return { ok: true, cost, balance: tx.balance };
  }

  /** Spare parts in the bag that would fix something on this vehicle. */
  partsFor(v) {
    return Object.entries(WEAR.parts).filter(([id, p]) => (!p.models || p.models.includes(v.model)) && this.inventory.has(id)).map(([id, p]) => ({ id, fix: p.fix }));
  }
  /** Fit a spare part yourself: it is used up and takes off some damage. */
  fitPart(v, itemId) {
    const p = WEAR.parts[itemId];
    if (!p || (p.models && !p.models.includes(v.model))) return { ok: false, error: 'wrong-part' };
    if (!(v.damage > 0)) return { ok: false, error: 'no-damage' };
    if (!this.inventory.has(itemId)) return { ok: false, error: 'missing-item' };
    this.inventory.remove(itemId, 1);
    v.damage = Math.max(0, v.damage - p.fix);
    return { ok: true, damage: v.damage };
  }

  sellQuote(v) { return Math.round(this.model(v).price * WEAR.buyBack * (1 - (v.damage ?? 0) / 200) / 500) * 500; }

  /** Sell your vehicle to a car stand: paid once (keyed on the vehicle), then it's gone. */
  sell(vId, lot) {
    const v = this.get(vId);
    if (!v) return { ok: false, error: 'no-such-vehicle' };
    if (!lot) return { ok: false, error: 'no-buyer' };
    const price = this.sellQuote(v);
    const tx = this.economy.transact({ key: `sell-vehicle:${v.id}`, amount: price, reason: `Sold your ${this.model(v).label.toLowerCase()} at ${lot.name}`, ref: { vehicle: v.id } });
    if (!tx.ok) return { ok: false, error: tx.error };
    this.list.splice(this.list.indexOf(v), 1);
    this.bus?.emit('vehicle:sold', v);
    return { ok: true, price, balance: tx.balance };
  }

  /** Burn fuel for `metres` driven. Returns false when the tank is empty. */
  burn(v, metres) {
    const M = this.model(v);
    v.fuel = Math.max(0, v.fuel - (metres / 1000) * M.use);
    v.odo = (v.odo ?? 0) + metres;
    // v0.32: road dust builds up with distance (half as fast for a few days after a wash & polish)
    v.dirt = Math.min(1, (Number.isFinite(v.dirt) ? v.dirt : 0) + metres / (v.polished ? 50000 : 25000));
    return v.fuel > 0;
  }
  /** Litres needed to drive `metres`. */
  fuelFor(v, metres) { return (metres / 1000) * this.model(v).use; }

  /** Whole litres you could buy now: {litres, cost} — the full tank if affordable, else what the wallet covers. */
  refuelQuote(v) {
    const room = Math.floor(this.model(v).tank - v.fuel);
    const afford = Math.floor(this.economy.balance / FUEL.pricePerLitre);
    const litres = Math.max(0, Math.min(room, afford));
    return { litres, cost: litres * FUEL.pricePerLitre, room, full: litres === room };
  }

  refuel(v, station) {
    const q = this.refuelQuote(v);
    if (q.room < 1) return { ok: false, error: 'full' };
    if (q.litres < 1) return { ok: false, error: 'insufficient-funds', price: FUEL.pricePerLitre };
    const tx = this.economy.transact({ key: `fuel:${v.id}:${Date.now().toString(36)}:${this.seq++}`, amount: -q.cost, reason: `Fuel: ${q.litres} L at ${station}`, ref: { vehicle: v.id, litres: q.litres } });
    if (!tx.ok) return { ok: false, error: tx.error };
    v.fuel = Math.min(this.model(v).tank, v.fuel + q.litres);
    return { ok: true, litres: q.litres, cost: q.cost, balance: tx.balance };
  }

  /** Pour a jerrycan from the bag into the tank (all-or-nothing: only if it fits). */
  pourJerrycan(v) {
    if (!this.inventory.has('jerrycan')) return { ok: false, error: 'missing-item' };
    if (this.model(v).tank - v.fuel < FUEL.jerrycanLitres) return { ok: false, error: 'full' };
    this.inventory.remove('jerrycan', 1);
    v.fuel = Math.min(this.model(v).tank, v.fuel + FUEL.jerrycanLitres);
    return { ok: true, fuel: v.fuel };
  }
}

/**
 * Shortest drivable route between two points on the road graph (one-way streets respected, bridge
 * decks allowed). Returns {metres, path:[{edge, fwd}], from, to} or null. Used to skip a drive.
 */
export function planDrive(graph, from, to, { walk = false } = {}) {
  // walking: any walkable street, both ways (one-way streets don't apply to people, decks aren't walkable)
  const usable = (e) => (walk ? e.walkable : e.drivable && !e.road.elevated);
  const oneway = (e) => !walk && e.road.oneway;
  const near = (p) => {
    let best = null, bd = Infinity;
    for (const e of graph.edgesNear(p.x, p.z, 160, 0, usable)) {
      const [ax, az] = graph.nodes[e.a];
      const t = Math.max(0, Math.min(e.len, (p.x - ax) * e.dx + (p.z - az) * e.dz));
      const d = Math.hypot(ax + e.dx * t - p.x, az + e.dz * t - p.z);
      if (d < bd) { bd = d; best = { e, t, d }; }
    }
    return best;
  };
  const A = near(from), B = near(to);
  if (!A || !B) return null;
  const starts = [[A.e.b, A.e.len - A.t], ...(oneway(A.e) ? [] : [[A.e.a, A.t]])];
  const goals = new Map([[B.e.a, B.t], ...(oneway(B.e) ? [] : [[B.e.b, B.e.len - B.t]])]);
  const dist = new Map(), prev = new Map();
  const heap = [];
  const push = (d, n) => { heap.push([d, n]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  for (const [n, d] of starts) { if (d < (dist.get(n) ?? Infinity)) { dist.set(n, d); push(d, n); } }
  let bestGoal = null, bestTotal = Infinity;
  while (heap.length) {
    const [d, n] = pop();
    if (d > (dist.get(n) ?? Infinity)) continue;
    if (d >= bestTotal) break;
    if (goals.has(n) && d + goals.get(n) < bestTotal) { bestTotal = d + goals.get(n); bestGoal = n; }
    for (const o of graph.adj.get(n) ?? []) {
      if (walk ? !o.edge.walkable : (o.walkOnly || !o.edge.drivable)) continue;
      const m = o.fwd ? o.edge.b : o.edge.a, nd = d + o.edge.len;
      if (nd < (dist.get(m) ?? Infinity)) { dist.set(m, nd); prev.set(m, o); push(nd, m); }
    }
  }
  if (bestGoal === null) return null;
  const path = []; let n = bestGoal;
  while (prev.has(n)) { const o = prev.get(n); path.push({ edge: o.edge, fwd: o.fwd }); n = o.fwd ? o.edge.a : o.edge.b; }
  path.reverse();
  // where to stop: on the destination edge at the nearest point, pulled in to the right-hand kerb
  const e = B.e, fwd = bestGoal === e.a;
  const s = fwd ? B.t : e.len - B.t;
  const lat = e.road.oneway || walk ? 0 : Math.max(1.2, e.road.width / 2 - 1.1);
  const stop = graph.pointAt(e, fwd, s, lat);
  // the route as a polyline: start → along the streets → destination
  const [sx, sz] = graph.nodes[A.e.a];
  const points = [[from.x, from.z], [sx + A.e.dx * A.t, sz + A.e.dz * A.t]];
  if (path.length) points.push(graph.nodes[path[0].fwd ? path[0].edge.a : path[0].edge.b]);
  for (const p of path) points.push(graph.nodes[p.fwd ? p.edge.b : p.edge.a]);
  if (!path.length) points.push(graph.nodes[bestGoal]);
  points.push([stop.x, stop.z], [to.x, to.z]);
  return { metres: Math.round(bestTotal + A.d + B.d), path, points, stop: { x: stop.x, z: stop.z, heading: Math.atan2(stop.dx, stop.dz) }, from: A, to: B };
}
