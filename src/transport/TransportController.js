import * as THREE from 'three';
import { TransitNetwork } from './TransitNetwork.js';
import { TransitFleet } from './TransitFleet.js';
import { TripSystem } from './TripSystem.js';
import { buildStopProps } from './StopProps.js';
import { MODES, TRANSPORT } from './transportConfig.js';
import { ControlState } from '../player/PlayerController.js';
import { SEAT_HEIGHT } from '../characters/CharacterAnimator.js';
import { CONFIG } from '../config.js';
import { naira } from '../economy/Economy.js';
import { compass } from '../dialogue/Conversations.js';
import { mulberry32 } from '../core/utils.js';
import { SEATS } from '../sim/TrafficSystem.js';
import { SKIP } from '../data/housing.js';

/*
  Public transport as the player experiences it. This is the glue between the pure transport logic
  (TransitNetwork / TransitFleet / TripSystem) and the game: prompts at stops and doors, the waiting
  chip, boarding, the seated player, the ride camera and HUD, getting down, and NPCs getting in and
  out at stops near the player.
  The player never drives here: in PASSENGER state the vehicle's position decides where the player is,
  and the only controls are camera, "next stop", "drop me here" and "get down" (when stopped).
*/

// vehicle-local positions (+Z forward, -X is the kerb side when driving on the right)
const SEAT = Object.fromEntries(Object.entries(SEATS).map(([k, s]) => [k, s.pax[s.pax.length - 1]])); // the last passenger seat is the player's
const DOOR_Z = { keke: -0.7, minibus: 0.5, cbus: 1.7, bus: 2.4 };
const CAM = { keke: { dist: 5.4, height: 1.35 }, minibus: { dist: 7.5, height: 1.7 }, cbus: { dist: 8, height: 1.9 }, bus: { dist: 9.5, height: 2.1 } };
const fmtDist = (m) => (m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`);
const AVG_SPEED = 6.5; // m/s including stops, for rough "about N min" estimates

export class TransportController {
  constructor(game) { this.g = game; this.seatView = false; this._v = new THREE.Vector3(); this.serviceT = 0; }

  /** At load: build the network from the real map, put the fleet on the roads, furnish the stops. */
  setup() {
    const g = this.g;
    this.net = new TransitNetwork({ map: g.world.map, graph: g.graph, landmarks: g.world.landmarks });
    this.fleet = new TransitFleet(this.net, { rng: mulberry32(2025) });
    g.traffic.attachFleet(this.fleet);
    this.props = buildStopProps(this.net, g.world.collision);
    g.renderer.scene.add(this.props);
    for (const m of this.props.userData.nightMaterials ?? []) g.atmosphere.nightMaterials.push(m);
    g.npcs.transit = { network: this.net, fleet: this.fleet };
    g.minimap.network = this.net;
    // people getting in and out where the player can see it
    this.fleet.on((type, v, occ, info) => {
      if (type !== 'arrive' || !occ || !g.player) return;
      const p = g.player.position;
      if (Math.hypot(v.x - p.x, v.z - p.z) > 85) return;
      const door = this.doorPoint(v, 0.45), kerb = this.doorPoint(v, 1.8);
      if (info.serials?.length) g.npcs.boardWaiters(info.serials, door);
      if (info.down && v !== this.trips?.riding?.v) g.npcs.spawnAlighting(Math.min(3, info.down), door, kerb);
      // the vehicle the player is waiting for has come
      if (this.trips?.trip?.state === 'waiting' && this.trips.optionFor(v)) {
        g.ui.toast(`${MODES[v.transit.line.mode].short} to ${this.trips.trip.dest.name} don come — board it (E)`);
      }
    });
  }

  /** On entering the world: the trip system reads and writes the save's transit state. */
  start(saveData) {
    this.trips?.off?.();
    this.trips = new TripSystem({ economy: this.g.economy, fleet: this.fleet, network: this.net, bus: this.g.bus, state: saveData.transit });
    this.pendingAlight = false; this.seatView = false;
    const bus = this.g.bus;
    this.offs?.forEach((f) => f());
    this.offs = [
      bus.on('trip:departed', (t) => this.g.ui.toast(`Fare paid: ${naira(t.fare)} · ${MODES[t.mode].short} to ${t.dest.name}`)),
      bus.on('trip:arrived', () => { this.pendingAlight = true; }),
      bus.on('trip:ejected', ({ v }) => { this.g.ui.toast('Driver: “Your money no reach. Abeg come down.”'); this.putDown(v); }),
    ];
  }

  get riding() { return this.trips?.riding ?? null; }
  get waiting() { return this.trips?.trip?.state === 'waiting' ? this.trips.trip : null; }

  /** World position next to the vehicle's door, `out` metres from the side. */
  doorPoint(v, out = 0.5) {
    const z = DOOR_Z[v.type] ?? 0, side = v.T.wid / 2 + out;
    return { x: v.x + v.dx * z + -v.dz * side, z: v.z + v.dz * z + v.dx * side };
  }

  // ------------------------------------------------------------------ on foot
  /** Every frame, from the world clock and crowds. */
  updateWorld(dt, hour) {
    const g = this.g;
    if (g.player) this.fleet.player = { x: g.player.position.x, z: g.player.position.z };
    this.fleet.updatePlatforms(dt, hour, (x, z, h) => g.traffic.crowdFactor(x, z, h));
    // keep the wait short: bring a vehicle from out of sight if none is on its way
    const w = this.waiting;
    if (w) {
      this.serviceT -= dt;
      if (this.serviceT <= 0) {
        this.serviceT = 3;
        const p = g.player.position;
        this.fleet.ensureService(w.occs, p.x, p.z, (v, D) => g.traffic.placeOnLine(v, v.transit.line, D));
      }
    }
  }

  /** A stopped fleet vehicle whose door is near the player, or null. */
  vehicleAtDoor(px, pz) {
    let best = null, bd = TRANSPORT.boardRadius;
    for (const v of this.fleet.vehicles) {
      if (!(v.transit.dwell > 0) || !v.transit.stopped?.occ) continue;
      if (Math.abs(v.x - px) > 15 || Math.abs(v.z - pz) > 15) continue;
      const d0 = this.doorPoint(v, 0.6), d = Math.hypot(d0.x - px, d0.z - pz);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  /**
   * What the player can do here with transport: {label, act} or null. `nearNpc` is the distance to
   * the nearest talkable person, so someone standing right next to you still gets the Talk prompt.
   */
  prompt(px, pz, nearNpc = Infinity) {
    const t = this.trips; if (!t) return null;
    const v = this.vehicleAtDoor(px, pz);
    const w = this.waiting;
    if (v && w) {
      const c = t.canBoard(v);
      if (c.ok || c.error === 'insufficient-funds') return { label: `Board ${MODES[v.transit.line.mode].short} to ${w.dest.name} · ${naira(c.fare)}`, act: () => this.g.openChoice(() => this.fareTalk(v)) };
      if (c.error === 'full') return { label: 'This one don full — wait for the next', act: null };
    }
    if (v && !w && this.fleet.free(v) > 0 && nearNpc > 1.2) {
      return { label: `Ask the ${MODES[v.transit.line.mode].short.toLowerCase()} driver where he dey go`, act: () => this.g.openOverlay('stop', { vehicle: v }) };
    }
    if (nearNpc < 1.3) return null;
    const plat = this.net.nearestPlatform(px, pz, TRANSPORT.platformRadius);
    if (plat) {
      if (w && w.stop === plat.stop) return { label: `Waiting for ${w.dest.name} — change destination`, act: () => this.g.openOverlay('stop', { stop: plat.stop }) };
      return { label: `Bus stop: ${plat.stop.name} — where are you going?`, act: () => this.g.openOverlay('stop', { stop: plat.stop }) };
    }
    return null;
  }

  /** Waiting chip text, and auto-cancel when the player walks away from the stop. */
  waitingStatus(px, pz) {
    const w = this.waiting; if (!w) return null;
    const d = Math.hypot(w.stop.x - px, w.stop.z - pz);
    if (d > 70) { this.trips.cancel(); this.g.ui.toast('You left the bus stop — no longer waiting'); return null; }
    const next = this.fleet.approaching(w.occs)[0];
    const mode = MODES[w.options[0].line.mode].short;
    let eta = 'nothing coming yet';
    if (next) {
      if (next.dist < 25 && next.v.transit.dwell > 0) eta = `${MODES[next.v.transit.line.mode].short} is here — board it (E)`;
      else { const m = Math.max(1, Math.round(next.dist / AVG_SPEED / 60)); eta = `next ${MODES[next.v.transit.line.mode].short.toLowerCase()} about ${m} min away`; }
    }
    return `Waiting at ${w.stop.name} for ${w.options.length > 1 ? 'transport' : mode.toLowerCase()} to ${w.dest.name} · ${eta}`;
  }

  /** Destination list for the stop picker: from a stop, or from a vehicle standing at one. */
  pickerView({ stop = null, vehicle = null }) {
    const t = this.trips;
    const entries = vehicle ? t.destinationsOnVehicle(vehicle) : t.destinationsFrom(stop);
    const at = vehicle ? vehicle.transit.stopped.occ.stop : stop;
    const p = this.g.player.position;
    const lines = vehicle ? [vehicle.transit.line] : this.net.lines.filter((l) => at.lines.has(l.id));
    return {
      title: at.name,
      subtitle: vehicle ? `${MODES[vehicle.transit.line.mode].label} · line ${vehicle.transit.line.id}: ${vehicle.transit.line.name} · ${this.fleet.free(vehicle)} seat${this.fleet.free(vehicle) === 1 ? '' : 's'} free` : 'Choose where you are going, then wait by the sign. You pay the fare once, when the vehicle moves off.',
      lines: lines.map((l) => ({ id: l.id, name: l.name, mode: MODES[l.mode].short, color: l.color })),
      balance: this.g.economy.balance,
      waitingFor: this.waiting?.dest?.id ?? null,
      entries: entries.map((e) => ({
        id: e.stop.id, name: e.stop.name, named: e.stop.named,
        where: `${fmtDist(Math.hypot(e.stop.x - p.x, e.stop.z - p.z))} ${compass(p.x, p.z, e.stop.x, e.stop.z)}`,
        options: e.options.map((o) => ({ line: o.line.id, mode: MODES[o.line.mode].short, color: o.line.color, fare: o.fare, stops: o.stops, dist: fmtDist(o.dist), mins: Math.max(1, Math.round(o.dist / AVG_SPEED / 60)) })),
        raw: e,
      })),
    };
  }

  /** The player picked a destination in the stop picker. */
  choose(view, entryId, ctx) {
    const entry = view.entries.find((e) => e.id === entryId)?.raw; if (!entry) return false;
    if (ctx.vehicle) {
      const v = ctx.vehicle;
      if (!(v.transit.dwell > 0)) { this.g.ui.toast('The driver don move — wait for the next one'); return false; }
      const r = this.trips.choose(v.transit.stopped.occ.stop, entry);
      if (!r.ok) return false;
      return this.board(v);
    }
    const r = this.trips.choose(ctx.stop, entry);
    if (r.ok) this.g.ui.toast(`Wait by the sign for transport to ${entry.stop.name}`);
    return r.ok;
  }

  /** Talking fare with the driver at the door: pay the fare, or "Kpaa ife" (keke and mini bus only). */
  fareTalk(v) {
    const t = this.trips, g = this.g;
    if (!this.waiting || !t.optionFor(v) || !(v.transit.dwell > 0)) return null; // the vehicle has gone
    const o = t.fareOffer(v), M = MODES[v.transit.line.mode], dest = this.waiting.dest.name;
    const said = this.fareReply?.v === v ? this.fareReply : null;
    const afford = g.economy.canAfford(o.fare);
    return {
      title: `${M.short} to ${dest}`, kicker: `Line ${v.transit.line.id} · ${v.transit.line.name}`,
      expr: said?.expr ?? null,
      text: said?.text ?? (o.fixed ? `Driver: “${dest}? Na ${naira(o.fare)}. Fixed price — enter make we go.”` : `Driver: “${dest}? ${naira(o.fare)}. Enter make we go.”`),
      note: afford ? 'You pay when the vehicle moves off. Getting down before then costs nothing.' : `You have ${naira(g.economy.balance)} — not enough for ${naira(o.fare)}.`,
      options: [
        { label: `Enter — ${naira(o.fare)}`, sub: o.fare < o.standard ? `usual fare ${naira(o.standard)}` : null, disabled: !afford || this.fleet.free(v) < 1, why: !afford ? 'Not enough money' : 'No free seat',
          act: () => { this.fareReply = null; g.closeChoice(); this.board(v); } },
        ...(o.canHaggle ? [{ label: 'Kpaa ife — ask for something small off', expr: 'kpaa-ife', act: () => {
          const r = t.haggle(v);
          this.fareReply = { v, expr: r.moved ? 'kpaa-ife' : null, text: r.moved ? `Driver: “Okay, okay — ${naira(r.fare)}. Enter quick.”` : `Driver: “Na ${naira(r.fare)} o. I no fit reduce — fuel cost.”` };
          if (r.moved) g.npcs.onHeard?.('kpaa-ife');
          g.renderChoice();
        } }] : []),
        { label: 'Leave am', ghost: true, act: () => { this.fareReply = null; g.closeChoice(); } },
      ],
    };
  }

  /** Skip the rest of a paid ride: the clock jumps by the time it would take; you get down at your stop. */
  skipInfo() {
    const t = this.riding; if (!t || t.state !== 'riding') return null;
    const line = t.line, L = line.length, D = this.fleet.D(t.v);
    const metres = (((t.option.to.d - D) % L) + L) % L;
    if (metres < SKIP.minMetres) return null;
    return { metres, minutes: Math.max(SKIP.minMinutes, Math.round(metres / SKIP.rideMetresPerMinute)), dest: t.dest.name };
  }
  skipRide() {
    const info = this.skipInfo(); if (!info) return false;
    const t = this.riding, v = t.v, line = t.line, to = t.option.to;
    // the vehicle reappears just before your stop and pulls in as usual
    this.g.traffic.placeOnLine(v, line, to.d - 14);
    Object.assign(v.transit, { occIdx: line.occ.indexOf(to), lastDD: Infinity, dwell: 0, dwellT: 0, stopped: null, adhoc: null, nextRequested: false, boardHold: 0 });
    t.nextRequested = false; t.dropHere = false;
    v.speed = 4;
    this.lastYaw = v.yaw;
    this.g.skipTime(info.minutes, { riding: true });
    this.g.ui.toast(`About ${info.minutes} min later… nearly at ${info.dest}`);
    return true;
  }

  cancelWait() { if (this.trips?.cancel().ok) this.g.ui.toast('No longer waiting'); }

  // ------------------------------------------------------------------ riding
  board(v) {
    const g = this.g;
    const r = this.trips.board(v);
    if (!r.ok) {
      g.ui.toast(r.error === 'insufficient-funds' ? `You need ${naira(r.fare)} for the fare` : r.error === 'full' ? 'No seat — wait for the next one' : 'This one no dey go there');
      return false;
    }
    g.player.setState(ControlState.PASSENGER);
    g.player.velocity.set(0, 0, 0);
    this.seatView = false;
    this.lastYaw = v.yaw;
    g.cameraRig.yaw = v.yaw + Math.PI * 0.8;
    g.cameraRig.setPassenger(CAM[v.type] ?? CAM.minibus);
    g.ui.setPrompt(null);
    g.ui.toast(`You don sit. Fare ${naira(r.trip.fare)} is paid when we move.`);
    this.pendingAlight = false;
    return true;
  }

  /** The frame update while seated (replaces on-foot movement). */
  updateRiding(dt, input) {
    const g = this.g, t = this.riding; if (!t) return;
    const v = t.v;
    // seat the player model in the vehicle
    const [sx, sy, sz] = SEAT[v.type] ?? SEAT.minibus;
    const seat = g.traffic.localToWorld(v, sx, sy, sz, this._v);
    g.player.position.set(seat.x, seat.y - SEAT_HEIGHT, seat.z);
    g.player.heading = v.yaw;
    g.player.speed = 0;
    g.player.animator?.sit(dt, Math.sin(performance.now() / 700) * Math.min(1, v.speed / 6));
    g.player.syncModel();
    g.player.human.group.visible = !this.seatView; // seen through the windows (open sides in a keke)

    // camera: orbit the vehicle, or the keke seat view; both turn with the vehicle
    let dy = v.yaw - (this.lastYaw ?? v.yaw); while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
    this.lastYaw = v.yaw;
    g.cameraRig.yaw += dy;
    const look = input.consumeLook(); if (look.dx || look.dy) g.cameraRig.applyLook(look.dx, look.dy);
    const zoom = input.consumeZoom(); if (zoom) g.cameraRig.applyZoom(zoom);
    if (this.seatView) {
      g.cameraRig.setSeat(g.traffic.localToWorld(v, sx, sy + 0.66, sz + 0.06, new THREE.Vector3()));
    }
    g.cameraRig.update(dt, { x: v.x, y: v.y, z: v.z });

    // controls
    if (input.consumePress('camera')) this.toggleView();
    if (input.consumePress('nextstop')) this.nextStop();
    if (input.consumePress('drophere')) this.dropHere();
    if (input.consumePress('skip')) this.g.confirmSkipRide();
    if (input.consumePress('interact')) this.getDown();
    input.consumePress('jump');
    // the driver has reached your stop (or the one you asked for): you get down
    if (this.pendingAlight && v.transit.dwell > 0) { this.pendingAlight = false; this.getDown(true); }
  }

  toggleView() {
    const t = this.riding; if (!t) return;
    if (t.v.type !== 'keke') { this.g.ui.toast('Seat view is only for keke — their sides are open'); return; }
    this.seatView = !this.seatView;
    if (!this.seatView) this.g.cameraRig.setPassenger(CAM.keke); else this.g.cameraRig.yaw = t.v.yaw + Math.PI;
  }
  nextStop() {
    const r = this.trips.requestNextStop();
    this.g.ui.toast(r.ok ? 'You: “Driver, next stop!”' : 'We never move yet');
  }
  dropHere() {
    const r = this.trips.requestHere();
    this.g.ui.toast(r.ok ? 'You: “Driver, drop me here!” — he go stop for the next safe place' : r.error === 'nowhere-safe' ? 'Driver: “I no fit stop for here. Wait small.”' : 'We never move yet');
  }

  /** Get down (only while the vehicle is standing still). */
  getDown(arrived = false) {
    const t = this.riding; if (!t) return false;
    const v = t.v;
    const r = this.trips.alight();
    if (!r.ok) { this.g.ui.toast(r.error === 'moving' ? 'Wait — the driver never stop' : 'You no dey inside any vehicle'); return false; }
    this.putDown(v);
    const where = v.transit.stopped?.occ?.stop?.name ?? this.g.world.location(v.x, v.z).street;
    this.g.ui.toast(arrived ? `We don reach ${where}. You got down.` : `You got down at ${where}`);
    this.g.saveGame();
    return true;
  }

  /** Put the player on the kerb next to the door, back on foot. */
  putDown(v) {
    const g = this.g;
    const d = this.doorPoint(v, 1.3);
    const [x, z] = g.world.findFreeSpot(d.x, d.z, CONFIG.player.radius + 0.1);
    g.player.teleport(x, z, Math.atan2(-v.dz, v.dx)); // facing away from the road
    g.player.setState(ControlState.ON_FOOT);
    g.player.human.group.visible = true;
    this.seatView = false;
    g.cameraRig.setMode('follow');
    g.cameraRig.yaw = g.player.heading + Math.PI;
    g.cameraRig.snapTo(new THREE.Vector3(x, CONFIG.camera.height, z));
    this.pendingAlight = false;
  }

  /** Ride HUD view: line, destination, next stop, fare and what you can do right now. */
  rideView() {
    const t = this.riding; if (!t) return null;
    const v = t.v, line = t.line, L = line.length, D = this.fleet.D(v);
    const ahead = (d) => (((d - D) % L) + L) % L;
    const toDest = ahead(t.option.to.d);
    const between = line.occ.filter((o) => ahead(o.d) > 1 && ahead(o.d) <= toDest + 1);
    const next = between.sort((a, b) => ahead(a.d) - ahead(b.d))[0];
    const stopped = v.transit.dwell > 0;
    let status;
    if (t.state === 'boarded') status = `Waiting to move off · fare ${naira(t.fare)} is paid when we leave`;
    else if (stopped) status = `Stopped at ${v.transit.stopped?.occ?.stop?.name ?? 'the roadside'} · you can get down`;
    else status = `Next stop: ${next?.stop.name ?? t.dest.name}${t.dropHere ? ' · driver will drop you at the next safe spot' : t.nextRequested ? ' · getting down there' : ''}`;
    return {
      badge: line.id, color: line.color, title: `${MODES[t.mode].short} to ${t.dest.name}`,
      status, detail: `${between.length} stop${between.length === 1 ? '' : 's'} · ${fmtDist(toDest)} to go · fare ${naira(t.fare)}${t.paid ? ' (paid)' : ''}`,
      canDown: stopped, canAsk: t.state === 'riding' && !stopped, keke: v.type === 'keke', seatView: this.seatView,
      canSkip: !!this.skipInfo(), skipLabel: this.skipInfo() ? `Skip to my stop (~${this.skipInfo().minutes} min)` : null,
    };
  }

  /** Where to put the player in the save while riding: the fare is paid, so the destination stop. */
  savePosition() {
    const t = this.riding; if (!t) return null;
    const p = t.paid ? t.option.to.platform : t.option.from.platform;
    const [x, z] = this.g.world.findFreeSpot(p.x - p.dz * 1.2, p.z + p.dx * 1.2, CONFIG.player.radius + 0.1);
    return { x: +x.toFixed(2), z: +z.toFixed(2), heading: +Math.atan2(p.dx, p.dz).toFixed(3) };
  }

  /** Leaving the world (main menu): never leave the player seated in a vehicle. */
  reset() {
    if (!this.trips) return;
    if (this.riding) { const v = this.riding.v; this.trips.endTrip('quit'); this.putDown(v); }
    else this.trips.cancel();
  }

  /** Markers for the minimap: the stop you are travelling to. */
  marker() {
    const t = this.trips?.trip; if (!t) return null;
    const s = t.dest; return { x: s.x, z: s.z, color: '#f2c200' };
  }

  /** Nearest stop to a point (for directions in conversation). */
  nearestStop(x, z) {
    let best = null, bd = Infinity;
    for (const s of this.net.stops) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
    return best ? { name: best.name, dist: bd, dir: compass(x, z, best.x, best.z), stop: best } : null;
  }
}
