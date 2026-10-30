import { Hospitals } from '../life/Hospitals.js';
import { HomeStores } from '../buy/HomeStores.js';
import { PlaceNameSigns } from '../world/PlaceNameSigns.js';
import { mergeStatic } from '../render/MergeStatic.js';
import {ResidentialInfill} from '../world/ResidentialInfill.js';
import { OrderlyFill, KeepClear } from '../world/OrderlyFill.js';
import { fenceCity } from '../world/Fencing.js';
import { MorePlaces } from '../world/MorePlaces.js';
import { TrafficControl } from '../sim/TrafficControl.js';
import {GarageController,homeForResume,garageSnapshot} from '../housing/GarageController.js';
import {PolicePatrols} from '../sim/PolicePatrols.js';
import {VenueMusic} from '../audio/VenueMusic.js';
import * as THREE from 'three';
import {BuyController} from '../buy/BuyController.js';
import { OnlineCity } from '../online/OnlineCity.js';
import '../online/online.css';
import { StoryController } from '../story/StoryController.js';
import { Skills } from '../life/Skills.js';
import { HomeUpgrades } from '../life/HomeUpgrades.js';
import { PhoneServices } from '../life/PhoneServices.js';
import { PhoneController } from '../phone/PhoneController.js';
import { CivicInterior } from '../life/CivicInterior.js';
import { ClubInterior } from '../life/ClubInterior.js';
import { TVShows } from '../life/TVShows.js';
import { FuelStationLife } from '../life/FuelStationLife.js';
import { CompoundGates } from '../world/CompoundGates.js';
import { RetailShop } from '../life/RetailShop.js';
import { CityLife } from '../life/CityLife.js';
import { CONFIG } from '../config.js';
import { EventBus } from './EventBus.js';
import { isTouchDevice } from './utils.js';
import { Renderer } from '../render/Renderer.js';
import { Atmosphere } from '../render/Atmosphere.js';
import { buildComingSoon } from '../world/ComingSoon.js';
import { buildGRAWelcome } from '../world/GRAWelcome.js';
import { Terminals } from '../transport/Terminals.js';
import { Showroom } from '../vehicles/Showroom.js';
import { buildDistrictDressing } from '../world/DistrictDressing.js';
import { buildStopShelters } from '../transport/StopShelters.js';
import { World } from '../world/World.js';
import { CameraRig } from '../camera/CameraRig.js';
import { InputManager } from '../input/InputManager.js';
import { TouchControls } from '../input/TouchControls.js';
import { PlayerController, ControlState } from '../player/PlayerController.js';
import { defaultAppearance } from '../characters/HumanRig.js';
import { SimClock } from '../sim/SimClock.js';
import { UIManager } from '../ui/UIManager.js';
import { Minimap } from '../ui/Minimap.js';
import { SaveSystem, defaultSave } from '../save/SaveSystem.js';
import { CloudSave } from '../save/CloudSave.js';
import { DriveDash } from '../ui/DriveDash.js';
import { backgroundInfo } from '../data/backgrounds.js';
import { prepareNewLife } from '../life/LifeStart.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { AudioManager } from '../audio/AudioManager.js';
import { isMajorRoad } from '../world/RoadBuilder.js';
import { RoadGraph } from '../sim/RoadGraph.js';
import { TrafficSystem } from '../sim/TrafficSystem.js';
import { NPCSystem } from '../npc/NPCSystem.js';
import { buildConversation, compass } from '../dialogue/Conversations.js';
import { mulberry32 } from './utils.js';
import { Economy, naira } from '../economy/Economy.js';
import { Inventory } from '../economy/Inventory.js';
import { ShopSession } from '../economy/Shop.js';
import { LifeController } from '../life/LifeController.js';
import { BusinessController } from '../business/BusinessController.js';
import { JusticeController } from '../justice/JusticeController.js';
import { AuthorityClient } from '../authority/AuthorityClient.js';
import { PlayersTogether } from '../online/PlayersTogether.js';
import { Eateries } from '../life/Eateries.js';
import { PoliticsController } from '../politics/PoliticsController.js';
import { OccupationsCity } from '../life/OccupationsCity.js';
import { Ventures } from '../life/Ventures.js';
import { NewsFeed } from '../life/NewsFeed.js';
import { Posture } from '../player/Posture.js';
import { JobSystem, clockLabel, durationLabel } from '../jobs/JobSystem.js';
import { ITEMS } from '../data/catalogue.js';
import { StockBook } from '../economy/Stock.js';
import { Needs } from '../player/Needs.js';
import { TransportController } from '../transport/TransportController.js';
import { HomeController } from '../housing/HomeController.js';
import { VehicleController } from '../vehicles/VehicleController.js';
import { planDrive } from '../vehicles/VehicleSystem.js';
import { WeatherController } from '../render/WeatherController.js';
import { hoursFor, inService, SERVICE } from '../data/schedule.js';
import { reputation } from '../sim/Reputation.js';
import { WholesaleController } from '../economy/WholesaleController.js';
import { doorOf } from '../housing/HousingSystem.js';
import { PoliceController } from '../vehicles/PoliceController.js';
import { weekdayOf, calendar } from '../sim/Calendar.js';
import {CityHUD} from '../ui/CityHUD.js';
import { CarRadioController } from '../radio/CarRadioController.js';
import { ActivityManager } from '../activities/ActivityManager.js';
import { StadiumFootball } from '../activities/football/StadiumFootball.js';
import { ParlourCorner } from '../activities/ParlourCorner.js';
import { StreetServices } from '../activities/StreetServices.js';
import { EntertainmentCentres } from '../activities/EntertainmentCentres.js';
import { BasketballCourt } from '../activities/basketball/BasketballCourt.js';
import { Jogging } from '../activities/Jogging.js';
import { CarWash } from '../activities/CarWash.js';
import { CityEvents } from '../activities/CityEvents.js';

const DEFAULT_SETTINGS = { quality: 'medium', sensitivity: 1, invertY: false, showFps: false, volume: 0.7, fov: CONFIG.camera.fov, adaptive: true, clockSpeed: 1, clockMode:'real', liveWeather:false, hints: true };
const AUTOSAVE_SECONDS = 60;

/**
 * Top-level orchestrator and game-state machine:
 *   loading → menu → creator → playing ⇄ paused / map / dialogue
 * Systems communicate through the EventBus; Game wires them together and owns the frame loop.
 */
export class Game {
  constructor() {
    this.bus = new EventBus();
    this.ui = new UIManager(this.bus);
    this.settings = SaveSystem.loadSettings(DEFAULT_SETTINGS);
    let hasSettings = false;
    try { hasSettings = !!localStorage.getItem('onitshaway:settings'); } catch { /* storage blocked */ }
    if (isTouchDevice() && !hasSettings) this.settings.quality = 'low';
    this.state = 'loading';
    this.touch = isTouchDevice();
    this.params = new URLSearchParams(location.search);
    this.audio = new AudioManager();
    this.venueMusic = new VenueMusic(this);
    const unlock = () => { this.audio.unlock(); this.applyAudioDuck(); };
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    this.audioTimer = 0; this.lastStep = 0;
  }

  applyAudioDuck() {
    const d = { playing: this.transport?.riding ? 0.75 : 1, dialogue: 0.7, shop: 0.7, overlay: 0.3, paused: 0.25, map: 0.35, menu: 0.45, creator: 0.45 }[this.state] ?? 0.4;
    this.audio.setDuck(d);
    if(this.state!=='playing')this.patrols?.mute();
    this.venueMusic?.update();
    this.carRadio?.sync(0);
  }

  /** Ambience levels from where the player is and the time of day. */
  updateAudioLevels() {
    const { x, z } = this.player.position;
    const h = this.clock.minutes / 60;
    const day = h >= 7 && h < 19 ? 1 : h >= 6 && h < 7 ? h - 6 : h >= 19 && h < 21 ? (21 - h) / 2 : 0.1;
    let market = 0;
    for (const l of this.world.landmarks.list) {
      if (!['market', 'bridgehead', 'park', 'interchange'].includes(l.kind)) continue;
      market = Math.max(market, 1 - Math.hypot(x - l.x, z - l.z) / (l.radius * 1.4));
    }
    const nr = this.world.map.nearestRoad(x, z, { maxDist: 90 });
    const major = nr && isMajorRoad(nr.road);
    if (major) market = Math.max(market, 0.35 * (1 - nr.dist / 40));
    const near = this.traffic ? this.traffic.countNear(x, z, 45) : 0;
    const traffic = Math.max(nr ? (major ? 1 - nr.dist / 90 : 0.3 * (1 - nr.dist / 45)) : 0, Math.min(1, near / 10));
    const iw = this.world.terrain.isWater;
    const river = [[60, 0], [-60, 0], [0, 60], [0, -60], [120, 0], [-120, 0]].filter(([dx, dz]) => iw(x + dx, z + dz)).length / 4;
    const night = h >= 19.2 || h < 5.8 ? 1 : 0;
    const wx = this.weather?.audioLevels(Math.max(0, market)) ?? {};
    // Sunday Mass at the Basilica: the choir carries outside; the bell rings before it starts
    const wd = weekdayOf(this.clock.day), ch = this.church;
    const dCh = ch ? Math.hypot(x - ch.x, z - ch.z) : Infinity;
    wx.choir = ch && inService(wd, h) ? Math.max(0, 1 - dCh / 260) : 0;
    const bellAt = this.clock.day * 1440 + SERVICE.start * 60 - 15;
    if (ch && wd === 6 && dCh < 900 && this.nowAbs() >= bellAt && this.nowAbs() < bellAt + 20 && this.bellRung !== this.clock.day) { this.bellRung = this.clock.day; this.audio.bell(dCh); }
    const rainK = 1 - 0.6 * (this.weather?.w.rain ?? 0); // the rain drives people indoors
    this.audio.setLevels({ market: Math.max(0, market) * (0.15 + 0.85 * day) * rainK, traffic: Math.max(0, traffic) * (0.4 + 0.6 * day), night: night * rainK, river: Math.min(1, river), ...wx }, this.cameraRig.yaw);
    this.footSurface = nr && nr.dist < nr.road.width / 2 ? (nr.road.surface === 'dirt' ? 'dirt' : 'hard') : 'dirt';
  }

  /**
   * v0.48 Onitsha only: a person (or the car they drive) can't go into a COMING SOON place. Moves `p` back to the last
   * playable spot and says why (once every few seconds). Returns true when it stepped in.
   */
  guardPlayArea(p, onBack, margin = 0) {
    const pa = this.world?.playArea; if (!pa?.active || this.civic?.inside || this.homes?.inside || this.club?.inside || this.world.collision.inZone(p.x, p.z)) return false;
    const at = pa.lockedAt(p.x, p.z, margin);
    if (!at) { (this._okSpot ??= { x: p.x, z: p.z }); this._okSpot.x = p.x; this._okSpot.z = p.z; return false; }
    const back = this._okSpot ?? pa.clamp(p.x, p.z, 8); p.x = back.x; p.z = back.z; onBack?.();
    const t = performance.now(); if (!(this._soonToast > t)) { this._soonToast = t + 4000; this.ui.toast(`${at.name} · COMING SOON. Only Onitsha is open for now.`); }
    return true;
  }

  async init() {
    this.renderer = new Renderer(document.getElementById('viewport'), this.settings.quality);
    this.ui.setLoading(0.02, 'Preparing renderer');
    this.world = await World.create(this.renderer, {
      quality: this.settings.quality,
      onProgress: (p, t) => this.ui.setLoading(p, t),
    });
    this.clock = new SimClock(this.bus);
    this.atmosphere = new Atmosphere(this.renderer, { nightMaterials: this.world.nightMaterials });
    this.cameraRig = new CameraRig(this.renderer.camera, this.world.collision);
    this.input = new InputManager(this.renderer.renderer.domElement, this.bus);
    this.touchControls = this.touch ? new TouchControls(document.getElementById('app'), this.input) : null;
    this.touchControls?.setVisible(false);
    this.player = new PlayerController(this.renderer.scene, this.world.collision); this.player.walkways = this.world.walkways;
    this.interactions = new InteractionSystem();
    this.minimap = new Minimap(this.world.map, this.world.landmarks, this.ui.miniCanvas, this.ui.bigCanvas);

    // living city: road graph, traffic and NPCs
    this.graph = new RoadGraph(this.world.map);
    this.traffic = new TrafficSystem(this.renderer.scene, this.graph, { landmarks: this.world.landmarks, districts: this.world.districts, quality: this.settings.quality });
    this.npcs = new NPCSystem({ scene: this.renderer.scene, graph: this.graph, world: this.world, landmarks: this.world.landmarks, quality: this.settings.quality, relationships: {} });
    this.ui.setLoading(0.58, 'Bringing people to the streets');
    await this.npcs.buildPool((p) => this.ui.setLoading(0.58 + p * 0.04));
    const props = this.world.props;
    this.npcs.buildResidents({
      stalls: props.stallSpots,
      kekes: props.kekeSpots.filter((k) => k.first).map((k) => ({ x: k.x + k.nx * 1.9, z: k.z + k.nz * 1.9, nx: -k.nx, nz: -k.nz, hidden: k.hidden })),
      shops: this.world.city.shopSpots, gates: this.world.city.gateSpots,
    });
    this.world.markets.register(this.npcs);
    // public transport: lines and stops on the real roads, the fleet joins the traffic
    this.ui.setLoading(0.6, 'Routing keke, mini buses and buses');
    await new Promise((r) => setTimeout(r, 0));
    this.transport = new TransportController(this);
    this.transport.setup();
    // homes to rent (real houses, shared interiors) and vehicles for sale
    this.ui.setLoading(0.61, 'Houses to let and cars for sale');
    await new Promise((r) => setTimeout(r, 0));
    this.homes = new HomeController(this);
    this.homes.setup();
    this.vehicles = new VehicleController(this);
    this.vehicles.setup();
    this.weather = new WeatherController(this);
    this.weather.setup();
    this.wholesale = new WholesaleController(this);
    this.wholesale.setup();
    this.police = new PoliceController(this);
    this.police.setup();
    this.setupChurch();
    this.phone = new PhoneController(this);
    this.civic=new CivicInterior(this);this.club=new ClubInterior(this);this.tvShows=new TVShows(this);this.cityLife = new CityLife(this); this.cityLife.setup();
    this.story=new StoryController(this);this.story.setup();
    this.life=new LifeController(this); // v0.40 open life: occupations, reputation, legal record
    this.retail=new RetailShop(this);this.retail.setup();
    this.activities=new ActivityManager(this);this.stadiumFootball=new StadiumFootball(this);this.stadiumFootball.setup();
    // walk-in activity places; a place that can't find a road-fronting plot is skipped, never fatal
    this.parlour=new ParlourCorner(this);this.streetServices=new StreetServices(this);this.entertainment=new EntertainmentCentres(this);this.court=new BasketballCourt(this);this.jogging=new Jogging(this);this.carWash=new CarWash(this);this.events=new CityEvents(this);this.activityPlaces=[this.stadiumFootball];
    for(const place of [this.parlour,this.streetServices,this.entertainment,this.court,this.jogging,this.carWash,this.events]){try{place.setup();this.activityPlaces.push(place);}catch(err){console.warn('[activities] could not place',place.constructor?.name,err);}}
    // the four home stores (furniture, electronics, lighting & electrical, décor) in existing commercial buildings
    this.homeStores=new HomeStores(this);try{this.homeStores.setup();this.activityPlaces.push(this.homeStores);}catch(err){console.warn('[stores] could not set up',err.message);}
    this.hospitals=new Hospitals(this);try{this.hospitals.setup();this.activityPlaces.push(this.hospitals);}catch(err){console.warn('[hospitals] could not set up',err.message);}
    this.business=new BusinessController(this);try{this.business.setup();this.activityPlaces.push(this.business);}catch(err){console.warn('[business] could not set up',err.message);} // v0.41 banks, premises, shops, fleets
    this.online = new OnlineCity(this);
    this.together = new PlayersTogether(this); // v0.44 players together
    this.eateries=new Eateries(this);try{this.eateries.setup();this.activityPlaces.push(this.eateries);}catch(err){console.warn('[eateries] could not set up',err.message);} // v0.45 eateries and dates
    this.politics=new PoliticsController(this);try{this.politics.setup();this.activityPlaces.push(this.politics);}catch(err){console.warn('[politics] could not set up',err.message);} // v0.45 stage 6: politics and elections
    this.occupationsCity=new OccupationsCity(this); // v0.46 stage 7: university, professions, freelance work
    this.ventures=new Ventures(this);try{this.ventures.setup();this.activityPlaces.push(this.ventures);}catch(err){console.warn('[ventures] could not set up',err.message);} // v0.47 stage 7: the remaining roles
    this.news=new NewsFeed(this);try{this.news.setup();this.activityPlaces.push(this.news);}catch(err){console.warn('[news] could not set up',err.message);} // v0.47 stage 8: the city responds
    this.posture = new Posture(this); // v0.45 sit and lie down
    this.authority = new AuthorityClient(this); CloudSave.beforePush = () => this.authority.sync(); CloudSave.onCorrected = () => this.authority.sync(); // v0.43 server authority
    this.world.infill=new ResidentialInfill(this);
    this.justice=new JusticeController(this);try{this.justice.setup();this.activityPlaces.push(this.justice);}catch(err){console.warn('[justice] could not set up',err.message);} // v0.42 crime, cases, court, police/EFCC, Hustle Kingdoms
    // neighbours standing at the new compound gates (they use the same resident system and schedules)
    this.world.stats.compoundNeighbours=this.npcs.addCompoundNeighbours(this.world.infill.compounds.map(c=>{if(c.removed)return{x:1e9,z:1e9,nx:0,nz:1};const[g0,g1]=c.gate,nx=Math.sin(c.yaw),nz=Math.cos(c.yaw);return{x:(g0[0]+g1[0])/2+nx*1.1,z:(g0[1]+g1[1])/2+nz*1.1,nx,nz};}));
    this.world.placeSigns = new PlaceNameSigns(this);
    this.world.placeSigns.mergeStats = mergeStatic(this.world.placeSigns.group);
    this.renderer.scene.add(this.world.placeSigns.group);
    for(const ci of this.world.flyovers?.plan.reservations??[])this.world.collision.removeCircle(ci);if(this.world.flyovers)this.world.flyovers.plan.reservations=[];
    for(const pi of this.world.billboardReservations??[])this.world.collision.removePolygon(pi);
    this.world.billboardReservations=[];
    this.world.map.useFullBounds?.(); this.world.collision.setBounds(this.world.map.bounds); // v0.48: the whole map, now that everything is placed
    this.world.activateLock(this.graph); // v0.48 Onitsha only: Asaba and the Delta island are COMING SOON
    // interiors (homes, clubs, civic buildings, story rooms) sit off the map: they are never COMING SOON
    this.interactions.locked = (x, z) => !(this.homes?.inside || this.civic?.inside || this.club?.inside || this.world.collision.inZone(x, z)) && this.world.playArea.locked(x, z);
    this.world.comingSoon = buildComingSoon(this.world); this.renderer.scene.add(this.world.comingSoon.group);
    this.world.graWelcome = buildGRAWelcome(this.world); this.renderer.scene.add(this.world.graWelcome.group); // v0.50
    try { const sh = this.transport.shelters = buildStopShelters(this); this.renderer.scene.add(sh); for (const m of sh.userData.nightMaterials ?? []) this.atmosphere.nightMaterials.push(m); } catch (err) { console.warn('[stops] could not build', err.message); } // v0.48 real bus stops
    this.terminals = new Terminals(this); try { this.terminals.setup(); this.activityPlaces.push(this.terminals); } catch (err) { console.warn('[terminals] could not set up', err.message); } // v0.48 motor parks
    this.showroom = new Showroom(this); try { this.showroom.setup(); this.activityPlaces.push(this.showroom); } catch (err) { console.warn('[showroom] could not set up', err.message); } // v0.48 premium cars
    try { this.world.districtDressing = buildDistrictDressing(this); this.renderer.scene.add(this.world.districtDressing); } catch (err) { console.warn('[districts] could not dress', err.message); } // v0.48 neighbourhoods
    // v0.49: more working places all over Onitsha (built before the new rows of houses, so they get the plots)
    this.morePlaces = new MorePlaces(this); try { this.morePlaces.setup(); this.activityPlaces.push(this.morePlaces); } catch (err) { console.warn('[places] could not add more', err); }
    // v0.49: traffic lights and wardens at the busy junctions
    try { this.traffic.control = new TrafficControl(this.graph, { landmarks: this.world.landmarks, locked: (x, z) => this.world.playArea.locked(x, z) }); this.traffic.control.build(this.renderer.scene, this.npcs, this.world.collision); } catch (err) { console.warn('[traffic] no lights', err); }
    // v0.49: houses in rows and columns on the empty land, and a wall and a gate round every house
    try { const keep = new KeepClear(this); const lotsQ = /[?&]lots=(\d+)/.exec(location.search); this.world.orderly = new OrderlyFill(this, { keep, cap: lotsQ ? +lotsQ[1] : ({ low: 7000, medium: 12000 }[this.settings.quality] ?? 15000) }); for (const h of this.world.orderly.houses) keep.add(h.plot.x, h.plot.z, 0); fenceCity(this, keep); } catch (err) { console.warn('[orderly] could not fill', err); }
    try { this.homes.addListings([...(this.world.orderly?.houses ?? []).slice(0, 7000), ...this.world.infill.houses.filter((h) => !h.removed && h.compound)]); } catch (err) { console.warn('[homes] could not add more', err); } // v0.49: homes to rent or buy in the walled houses (lots beyond 7,000 exist only on higher settings, so never listed)
    // v0.53: compound gates that slide open as you come up to them
    try { this.gates = new CompoundGates(this); this.world.stats.gates = this.gates.setup(); } catch (err) { console.warn('[gates]', err); }
    // v0.53: no kiosk in front of an entrance (gates, doors, venue fronts)
    try { const zones = [], R = (x, z, ux, uz, nx, nz, a0, a1, b0, b1) => [[x + ux * a0 + nx * b0, z + uz * a0 + nz * b0], [x + ux * a1 + nx * b0, z + uz * a1 + nz * b0], [x + ux * a1 + nx * b1, z + uz * a1 + nz * b1], [x + ux * a0 + nx * b1, z + uz * a0 + nz * b1]];
      for (const q of this.gates?.gates ?? []) zones.push(R(q.x, q.z, q.ux, q.uz, -q.nx, -q.nz, -(q.gl / 2 + 0.8), q.gl / 2 + 0.8, -1.5, 5.5));
      for (const b of this.world.map.buildings) { if (!(b.front >= 0)) continue; const d = doorOf(b); if (d) zones.push(R(d.x, d.z, d.ux ?? -d.nz, d.uz ?? d.nx, d.nx, d.nz, -1.2, 1.2, -0.2, 3.6)); }
      for (const h of this.homes.listings) { const d = h.door; if (d) zones.push(R(d.x, d.z, d.ux ?? -d.nz, d.uz ?? d.nx, d.nx, d.nz, -1.2, 1.2, -0.2, 3.6)); }
      for (const v of [...(this.story?.city?.services ?? []), ...(this.world.landmarks.list.filter((l) => l.door || l.site))]) { if (!Number.isFinite(v.x) || v.yaw == null) continue; const c = Math.cos(v.yaw), sn = Math.sin(v.yaw), half = v.kind === 'fuel' ? 11.5 : 4; zones.push(R(v.x, v.z, c, -sn, sn, c, -half, half, -1, 6)); }
      this.world.stats.kiosksAtEntrances = this.world.city.clearEntranceKiosks(zones); } catch (err) { console.warn('[kiosks]', err); }
    // v0.52: more homes to rent or buy in both GRAs (after the others, so every earlier listing keeps its place)
    try { const D = this.world.districts; this.world.stats.graListings = this.homes.addListings([...(this.world.orderly?.houses ?? []).slice(0, 7000), ...this.world.infill.houses.filter((h) => !h.removed && h.compound)].filter((h) => (h.tier === 'gra' || D.premiumAt(h.x ?? h.plot?.x ?? 0, h.z ?? h.plot?.z ?? 0) > 0.5)), 140, { cellSize: 55, spacing: 30, spread: 40 }); } catch (err) { console.warn('[homes] GRA', err); }
    this.minimap.addFootprints([...this.world.infill.houses.filter((h) => !h.removed), ...(this.world.orderly?.houses ?? [])].map((h) => ({ pts: h.pts, kind: 'residential', wall: h.compound?.ring })));
    this.minimap.addFootprints([...this.world.city.chunks.values()].flatMap((ch) => (ch.compounds ?? []).filter((c) => c.fence && c.item && !c.item.infill).map((c) => ({ pts: c.item.b.pts, kind: c.item.b.renderKind ?? c.item.kind, wall: c.ring }))));
    this.minimap.setPlayArea(this.world.playArea); // the map shows every house, every wall and the COMING SOON land
    this.cityHud = new CityHUD(this);
    this.buy = new BuyController(this);
    this.carRadio = new CarRadioController(this);
    this.driveDash = new DriveDash(this);
    this.minimap.onPick = (x, z, place) => this.setWaypoint(place ? { x, z, name: place.label, radius: 5, custom: true } : { x, z, name: 'Marked place', radius: 14, custom: true });
    this.buildBeacon();
    this.npcs.onHeard = (id) => { if (id && this.saveData) { const h = (this.saveData.world.heard ??= []); if (!h.includes(id)) h.push(id); } };
    this.waypoint = null;
    this.applySettings();

    // spawn on the kerb of Old Market Road (the extractor stores the road-centre point)
    this.spawn = this.computeSpawn();
    this.cameraRig.cine.center.set(this.spawn.x, 0, this.spawn.z);
    this.cameraRig.cine.radius = 70;

    this.bindUI();
    this.bindCreatorDrag();
    this.atmosphere.update(this.clock.minutes);
    // build the streets around the starting point (and a saved position, if any) before showing the menu
    this.ui.setLoading(0.62, 'Building the streets around Old Market Road');
    await this.world.warmUp(this.spawn.x, this.spawn.z, (p) => this.ui.setLoading(0.62 + p * 0.36));
    this.ui.setLoading(1, 'Ready');
    this.ui.hideLoading();
    this.showMenu();

    this.fps = { frames: 0, t: 0, value: 0 };
    this.hudTimer = 0; this.autosaveTimer = 0;
    this.lastTime = performance.now();
    this.renderer.renderer.setAnimationLoop(() => this.frame());
    // leaving the tab or app: pause and save, so time doesn't run on without you
    document.addEventListener('visibilitychange', () => { if(document.hidden&&this.state==='chase'){this.story.run.paused=true;this.saveGameNow();} if (document.hidden && this.state === 'playing') { this.saveGame(); this.pause(); } });
    window.addEventListener('pagehide', () => { if (this.saveData && ['playing', 'paused', 'map', 'chase', 'overlay', 'activity'].includes(this.state)) this.saveGame(); });
    // the graphics driver can drop the WebGL context (phones under memory pressure): save and offer a reload
    const cv = this.renderer.renderer.domElement;
    cv.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.saveData && ['playing', 'paused', 'map', 'dialogue', 'shop', 'overlay', 'chase', 'activity'].includes(this.state)) this.saveGame();
      this.ui.contextLost?.();
    });
    cv.addEventListener('webglcontextrestored', () => this.ui.contextRestored?.());

    if (this.params.has('quickstart')) this.quickStart();
    window.__game = this; // handy for debugging in the console
  }

  computeSpawn() {
    // kerbside on Old Market Road, mid-block (away from junctions), facing along the road
    const map = this.world.map;
    const [sx, sz] = map.spawn;
    let best = null;
    for (const road of map.roads) {
      if (road.name !== 'Old Market Road') continue;
      for (let i = 0; i < road.points.length - 1; i++) {
        const [ax, az] = road.points[i], [bx, bz] = road.points[i + 1];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 40) continue;
        const mx = (ax + bx) / 2, mz = (az + bz) / 2, d = Math.hypot(mx - sx, mz - sz);
        if (!best || d < best.d) best = { d, road, ax, az, bx, bz, L, mx, mz };
      }
    }
    let x = sx, z = sz, heading = 0;
    if (best) {
      const dx = (best.bx - best.ax) / best.L, dz = (best.bz - best.az) / best.L;
      const off = best.road.width / 2 + 0.9;
      x = best.mx + -dz * off; z = best.mz + dx * off;
      heading = Math.atan2(dx, dz);
    }
    [x, z] = this.world.findFreeSpot(x, z, 0.6);
    return { x, z, heading };
  }

  applySettings() {
    this.settings.clockMode = 'real'; this.settings.clockSpeed = 1;
    this.cameraRig.sensitivity = CONFIG.camera.sensitivity * this.settings.sensitivity;
    this.cameraRig.invertY = this.settings.invertY;
    this.ui.setFpsVisible(this.settings.showFps);
    this.audio?.setVolume(this.settings.volume ?? 0.7);
    this.carRadio?.sync(0);
    this.renderer.setFov?.(this.settings.fov ?? CONFIG.camera.fov);
    if (this.clock) { if(this.saveData){const old=this.nowAbs(),before=this.clock.mode;this.clock.setMode('real');if(before!==this.clock.mode){this.rebaseCommitments(this.nowAbs()-old);this.lastPowerAbs=this.nowAbs();}}this.clock.rate=this.clock.mode==='real'?1/60:CONFIG.clock.minutesPerSecond*(this.settings.clockSpeed??1); }
    document.getElementById('app')?.classList.toggle('no-hints', this.settings.hints === false);
    if (this.renderer.qualityName !== this.settings.quality) { this.renderer.applyQuality(this.settings.quality); this.world?.setQuality(this.settings.quality); }
  }

  // ------------------------------------------------------------------ UI wiring
  bindUI() {
    const on = (e, f) => this.bus.on(e, f);
    on('ui:menu:continue', () => this.continueGame());
    on('ui:menu:new', () => this.newGame());
    on('ui:menu:settings', () => this.openSettings());
    on('ui:menu:credits', () => this.ui.show('credits'));
    on('ui:credits:close', () => this.ui.show('credits', false));
    on('ui:creator:back', () => this.showMenu());
    on('ui:creator:start', () => this.startFromCreator());
    on('ui:hud:phone', () => this.openOverlay('phone'));
    on('ui:hud:pause', () => this.pause());
    on('ui:hud:map', () => this.openMap());
    on('ui:pause:resume', () => this.resume());
    on('ui:pause:save', () => { this.saveGame(); this.ui.toast('Game saved'); });
    on('ui:pause:map', () => this.openMap());
    on('ui:pause:settings', () => this.openSettings());
    on('ui:pause:phrasebook', () => this.ui.openPhrasebook(new Set(this.saveData?.world?.heard ?? [])));
    on('ui:phrasebook:close', () => this.ui.show('phrasebook', false));
    on('ui:dialogue:close', () => this.endDialogue());
    on('ui:shop:close', () => this.closeShop());
    on('ui:hud:bag', () => this.openOverlay('bag'));
    on('ui:hud:jobs', () => this.openOverlay('jobs'));
    on('ui:pause:bag', () => this.openOverlay('bag'));
    on('ui:pause:jobs', () => this.openOverlay('jobs'));
    on('ui:bag:close', () => this.closeOverlay('bag'));
    on('ui:jobs:close', () => this.closeOverlay('jobs'));
    on('ui:stop:close', () => this.closeOverlay('stop'));
    on('ui:choice:close', () => this.closeChoice());
    on('ui:homes:close', () => this.closeOverlay('homes'));
    on('ui:pause:homes', () => this.openOverlay('homes'));
    on('ui:hud:ride-skip', () => this.confirmSkipRide());
    on('ui:hud:drive-exit', () => this.vehicles.stopDriving());
    on('ui:hud:drive-fuel', () => this.vehicles.refuel());
    on('ui:hud:drive-pickup', () => this.vehicles.pickUp());
    on('ui:hud:drive-skip', () => this.confirmSkipDrive());
    on('ui:hud:drive-horn', () => this.audio.horn?.(0, 2));
    on('ui:hud:waypoint', () => { if (this.waypoint?.custom) { this.setWaypoint(null); this.ui.toast('Marker cleared'); } });
    on('ui:hud:transit', async () => {
      if (this.state !== 'playing' || !this.transport.waiting) return;
      const ok = await this.ui.confirm('Stop waiting?', `You will no longer wait for transport to ${this.transport.waiting.dest.name}.`, 'Stop waiting');
      if (ok) this.transport.cancelWait();
    });
    on('ui:hud:ride-next', () => this.transport.nextStop());
    on('ui:hud:ride-here', () => this.transport.dropHere());
    on('ui:hud:ride-down', () => this.transport.getDown());
    on('ui:hud:ride-view', () => this.transport.toggleView());
    this.bus.on('job:expired', ({ job }) => { this.ui.toast(`Job missed: ${job.title} — time don pass`); const g = this.npcs.rels[job.giver]; if (g) g.negative += 1; });
    this.bus.on('skill:level-up', ({ label, level }) => this.ui.toast(`${label} level up! Level ${level}/10${level === 10 ? ' · Mastered!' : ''}`));
    this.bus.on('needs:changed', values => this.ui.setNeeds(values));
    this.bus.on('needs:low', () => this.ui.toast('Energy is low — rest or sleep at home. Eat from your bag if hungry (I).'));
    this.bus.on('wallet:changed', ({ balance, entry }) => {
      this.ui.setWallet(balance, true);
      if (entry.amount > 0) this.ui.toast(`+${naira(entry.amount)} · ${entry.reason.replace(/^Job: /, '')}`);
    });
    this.bus.on('job:completed', ({ job }) => { this.skills?.add('hustle', 25); this.phoneServices?.message('Job board', `Completed: ${job.title}. Your payment is in your wallet.`); this.minimap.waypoint = null; this.npcs.priorityId = null; this.ui.toast(`Job done: ${job.title}`); });
    window.addEventListener('keydown', (e) => {
      if (this.state === 'shop' && e.key === 'Escape') { this.closeShop(); return; }
      if (this.state === 'overlay' && this.overlay === 'choice') { if (e.key === 'Escape') this.closeChoice(); else if (/^[1-9]$/.test(e.key)) this.ui.pickChoice(parseInt(e.key, 10) - 1); return; }
      if (this.state === 'overlay' && e.key === 'Escape') { this.closeOverlay(); return; }
      if (this.state === 'overlay' && this.overlay === 'stop' && /^[1-9]$/.test(e.key) && !(e.target instanceof HTMLInputElement)) { this.ui.pickStopOption(parseInt(e.key, 10) - 1); return; }
      if (this.state !== 'dialogue') return;
      if (e.key === 'Escape') { this.endDialogue(); return; }
      const n = parseInt(e.key, 10); if (n >= 1 && n <= 9) this.chooseResponse(n - 1);
    });
    on('ui:pause:quit', () => { this.saveGame(); this.showMenu(); });
    on('ui:settings:export', () => this.exportSave());
    // account save status in Settings (uploads happen on their own; "Sync now" is for peace of mind)
    const cloudLine = () => { const el = document.querySelector('[data-slot=cloud-status]'), b = document.querySelector('[data-slot=cloud-sync]'); if (!el) return; el.textContent = CloudSave.describe(); el.dataset.state = CloudSave.state; if (b) { b.hidden = CloudSave.state === 'off'; b.disabled = CloudSave.state === 'uploading' || CloudSave.state === 'checking'; } };
    CloudSave.listeners.add(cloudLine); this.cloudLine = cloudLine; cloudLine();
    on('ui:settings:cloud-sync', async () => { if (this.saveData && ['playing', 'paused', 'map', 'chase', 'overlay', 'activity'].includes(this.state)) this.saveGame(); const ok = await CloudSave.flush(); cloudLine(); this.ui.toast(ok ? 'Saved to your account' : CloudSave.describe(), ok ? 2700 : 6000); });
    on('ui:settings:import', () => document.querySelector('[data-slot=import-file]')?.click());
    const file = document.querySelector('[data-slot=import-file]');
    if (file) file.onchange = () => { const f = file.files?.[0]; file.value = ''; if (f) this.importSave(f); };
    const hb = document.querySelector('[data-action=drive-handbrake]');
    if (hb) {
      const set = (v) => (e) => { e.preventDefault(); this.input.handbrake = v; };
      hb.addEventListener('pointerdown', set(true)); for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) hb.addEventListener(ev, set(false));
    }
    on('ui:settings:close', () => { this.ui.show('settings', false); SaveSystem.saveSettings(this.settings); });
    on('ui:map:close', () => this.closeMap());
    on('ui:map:zoomin', () => this.minimap.zoomCenter(1.4));
    on('ui:map:zoomout', () => this.minimap.zoomCenter(1 / 1.4));
    on('ui:map:me', () => this.minimap.recenter());
    // losing the mouse lock means the player pressed Esc or left the window — but opening and closing
    // an overlay also releases it, and that event can arrive just after we are back in play: ignore it then
    on('input:pointerlock-lost', () => { if (this.state === 'playing' && performance.now() - this.stateAt > 400) this.pause(); });
    this.ui.bindSettings(this.settings, () => { this.applySettings(); SaveSystem.saveSettings(this.settings); });
    document.addEventListener('visibilitychange', () => {
      if(document.hidden&&this.state==='chase'){this.story.run.paused=true;this.saveGameNow();} if (document.hidden && this.state === 'playing') { this.saveGame(); this.pause(); }
    });
    window.addEventListener('resize', () => {
      if (this.state === 'map') this.minimap.drawBig();
      this.cameraRig.showcaseShift = window.innerWidth < 720 ? 0 : 0.55;
    });
    this.cameraRig.showcaseShift = window.innerWidth < 720 ? 0 : 0.55;
  }

  bindCreatorDrag() {
    const c = this.renderer.renderer.domElement;
    let last = null;
    c.addEventListener('pointerdown', (e) => { if (this.state === 'creator') last = e.clientX; });
    window.addEventListener('pointermove', (e) => {
      if (this.state !== 'creator' || last === null) return;
      this.cameraRig.yaw -= (e.clientX - last) * 0.01; last = e.clientX;
    });
    window.addEventListener('pointerup', () => (last = null));
  }

  // ------------------------------------------------------------------ states
  setState(s) {
    if(this.buy?.visible&&s!=='overlay')this.buy.leave();
    this.state = s;
    if (this.creatorStudio) this.creatorStudio.visible = s === 'creator';
    this.stateAt = performance.now();
    const playing = s === 'playing';
    document.getElementById('app')?.classList.toggle('playing', playing);
    const activity = s === 'activity'; // football etc.: own controls, the city clock keeps running
    this.input.setEnabled(playing || activity);
    this.touchControls?.setVisible(playing || activity);
    this.clock.paused = !(playing || activity || s === 'dialogue' || s === 'shop');
    this.applyAudioDuck();
  }

  showMenu() {
    this.story?.leaveScene();
    this.civic?.exit({quiet:true});
    this.club?.exit({quiet:true});
    this.transport?.reset();
    if (this.vehicles?.driving) this.vehicles.stopDriving({ silent: true });
    if (this.homes?.inside) { this.homes.inside = null; this.cameraRig.indoor = null; this.atmosphere.indoor = null; }
    this.setState('menu');
    this.ui.only('menu');
    this.ui.setMenuSave(SaveSystem.summary());
    this.cameraRig.setMode('cinematic');
    if (this.player.human) this.player.human.group.visible = false;
  }

  async newGame() {
    if (SaveSystem.hasSave()) {
      const ok = await this.ui.confirm('Start a new life?', 'Your current save will be replaced when the new game is first saved. A backup copy of the old save is kept.', 'Start new game');
      if (!ok) return;
    }
    this.openCreator();
  }

  setupCreatorStudio() {
    if (this.creatorStudio) return;
    const studio = new THREE.Group(); studio.name = 'Character preview studio'; studio.position.set(12000,0,12000);
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(8,8,6,64,1,true),new THREE.MeshBasicMaterial({color:'#dfe2e5',side:THREE.BackSide,fog:false}));wall.position.y=3;studio.add(wall);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8,64),new THREE.MeshStandardMaterial({color:'#c9cdd1',roughness:1,fog:false}));floor.rotation.x=-Math.PI/2;floor.position.y=-.004;studio.add(floor);
    studio.add(new THREE.HemisphereLight(0xe8f1ff,0x8d7763,1.6));
    this.creatorKey = new THREE.PointLight(0xfff0df,34,10,2);studio.add(this.creatorKey);
    this.creatorFill = new THREE.PointLight(0xdbe8ff,16,9,2);studio.add(this.creatorFill);
    this.renderer.scene.add(studio);this.creatorStudio=studio;
  }

  openCreator() {
    this.setupCreatorStudio();
    this.setState('creator');
    this.ui.only('creator');
    this.creatorBackground = SaveSystem.creationBackground();
    this.creatorHomeId = null;
    const app = { ...defaultAppearance('male'), name: (this.entryAccount?.me.name || '').slice(0,18) };
    this.creatorState = this.ui.buildCreator(app, (next, meta) => {
      this.creatorState = next;
      if (!meta?.nameOnly) this.player.setAppearance(next);
    });
    this.ui.bindCreatorStart(backgroundInfo(this.creatorBackground), this.homes.listings, id => { this.creatorHomeId = id; });
    this.player.setAppearance(app);
    this.player.human.group.visible = true;
    // Preview is outside city collision bounds; startFromCreator restores the street spawn.
    const h = this.spawn.heading;
    const yaw = Math.atan2(Math.cos(h), -Math.sin(h));
    this.player.position.copy(this.creatorStudio.position);
    this.player.heading = yaw; this.player.velocity.set(0,0,0); this.player.syncModel();
    this.cameraRig.yaw = yaw;
    this.cameraRig.setMode('showcase');
  }

  startFromCreator() {
    if (this.state !== 'creator' || this.startingLife) return;
    this.startingLife = true;
    try {
      const c = { ...this.creatorState };
      if (!c.name) c.name = c.gender === 'female' ? 'Adaeze' : 'Chidi';
      const prepared = prepareNewLife(c, this.creatorBackground, this.creatorHomeId, this.homes.listings, 1440 + CONFIG.clock.startMinutes);
      if (!prepared.ok) { this.ui.creatorStartError(prepared.error); return; }
      SaveSystem.backupCurrent();
      this.saveData = prepared.data;
      this.clock.day = 1; this.clock.minutes = CONFIG.clock.startMinutes;
      const home = prepared.home;
      const pos = home ? { x: home.door.stand.x, z: home.door.stand.z, heading: Math.atan2(home.door.nx, home.door.nz), inside: home.id } : { x: this.spawn.x, z: this.spawn.z, heading: this.spawn.heading };
      try { this.enterWorld(c, pos); }
      catch (err) { this.reportError(err, 'new-game'); this.showMenu(); this.ui.confirm('Could not start', `Something went wrong starting the game: ${String(err?.message ?? err)}. Your earlier save is kept.`, 'OK'); return; }
      if (this.saveGame()) SaveSystem.completeCreation();
      this.ui.toast(`Welcome to Onitsha, ${c.name} — ${backgroundInfo(this.creatorBackground).label}`);
    } finally { this.startingLife = false; }
  }

  continueGame() {
    if (this.loadingSave) return; // a double tap on Continue
    this.loadingSave = true;
    this.ui.setMenuBusy(true, 'Loading your game…');
    // let the button show it's working before the (synchronous) world restore runs
    setTimeout(() => { try { this.continueGameNow(); } finally { this.loadingSave = false; this.ui.setMenuBusy(false); } }, 30);
  }

  continueGameNow() {
    const r = SaveSystem.load();
    if (!r.ok) {
      this.ui.confirm('Save could not be loaded', r.reason === 'corrupt' ? 'The saved game is damaged. It has been set aside so nothing is lost; you can start a new game.' : 'No saved game found.', 'OK');
      this.ui.setMenuSave(null);
      return;
    }
    this.saveData = r.data;
    this.saveData.world ??= {}; this.saveData.relationships ??= {};
    this.clock.day = r.data.clock.day; this.clock.minutes = r.data.clock.minutes;
    const p = {...(r.data.player ?? {x:this.spawn.x,z:this.spawn.z,heading:this.spawn.heading}),resumeAtHome:true};
    try {
      this.enterWorld(r.data.character, p);
    } catch (err) {
      // something in the save didn't fit: try again from the start spot (keeping money, bag, homes, vehicles)
      this.reportError(err, 'continue');
      try {
        this.saveData.business && (this.saveData.business.riders = []);
        this.enterWorld(r.data.character, { x: this.spawn.x, z: this.spawn.z, heading: this.spawn.heading });
        this.ui.toast('Your game was restored at Old Market Road (the saved spot could not be loaded).');
      } catch (err2) {
        this.reportError(err2, 'continue-retry');
        this.showMenu();
        this.ui.confirm('Could not load your game', `The save is kept safe, but this build could not open it: ${String(err2?.message ?? err2)}. Please send this message to the developer. You can still start a new game (your old save is backed up first).`, 'OK');
        return;
      }
    }
    this.ui.toast(`Welcome back, ${r.data.character.name}`);
  }

  get landmarks() { return this.world?.landmarks; }
  /** Absolute game time in minutes (day * 1440 + minutes): job deadlines use it. */
  rebaseCommitments(delta){if(!delta||!this.saveData)return;for(const j of this.saveData.jobs?.list??[])if(Number.isFinite(j.deadline))j.deadline+=delta;for(const r of Object.values(this.saveData.housing?.rentals??{})){if(Number.isFinite(r.from))r.from+=delta;if(Number.isFinite(r.until))r.until+=delta;}for(const o of this.saveData.wholesale?.orders??[])if(Number.isFinite(o.due))o.due+=delta;}
  nowAbs() { return this.clock.day * 1440 + this.clock.minutes; }

  enterWorld(character, pos) {
    const previousAbs=this.nowAbs();
    this.clock.mode=null;this.clock.setMode('real',{realDate:this.saveData.clock.realDate});
    if(this.saveData.clock.realDate==null)this.rebaseCommitments(this.nowAbs()-previousAbs);
    this.clock.rate=this.clock.mode==='real'?1/60:CONFIG.clock.minutesPerSecond*(this.settings.clockSpeed??1);
    this.saveData.relationships ??= {}; this.saveData.world ??= {};
    this.activities?.onLoad(this.saveData);
    this.npcs.rels = this.saveData.relationships;
    // economy, bag and jobs all read and write the save data directly
    this.economy = new Economy(this.saveData.wallet, { bus: this.bus, clock: this.clock });
    this.inventory = new Inventory(this.saveData.inventory, { bus: this.bus });
    this.jobs = new JobSystem(this.saveData.jobs, { economy: this.economy, inventory: this.inventory, residents: this.npcs.residents, bus: this.bus, now: () => this.nowAbs() });
    this.stock = new StockBook(this.saveData.world.stock ??= {});
    this.needs = new Needs(this.saveData.needs, { bus: this.bus });
    this.skills = new Skills(this.saveData.skills ??= {}, { bus: this.bus });
    this.saveData.phone ??= { model: character.phone ?? 'osha', messages: [], bets: {}, work: {}, seq: 0 };
    this.saveData.street ??= { resolved: {} };
    this.phoneServices = new PhoneServices(this.saveData.phone, { economy: this.economy, skills: this.skills, inventory:this.inventory,character:this.saveData.character, needs: this.needs, day: () => this.clock.day, seed: this.saveData.world.weatherSeed ?? 1 });
    if (!this.saveData.phone.messages.length) this.phoneServices.message('Onitsha guide', 'Nnọọ! Onitsha is yours: nobody will tell you what to do. Find work at the workplaces on the map, take jobs from traders in the markets, drive a keke, trade, or just live. Your work, reputation and record are under Profile on your phone. Eat, rest and wash to keep your needs up.');
    this.cityLife.start();
    this.transport.start(this.saveData);
    this.homes.start(this.saveData);
    this.homeUpgrades = new HomeUpgrades(this.saveData.housing, { economy: this.economy, housing: this.homes.housing });
    this.lastPowerAbs = this.nowAbs();
    this.weather.start(this.saveData);
    this.wholesale.start(this.saveData);
    this.police.start(this.saveData);
    this.jobs.hoursFn = (p, day) => hoursFor(p, weekdayOf(day));
    const resumeHome=pos.resumeAtHome?homeForResume(this.homes.housing):null;
    if(resumeHome){pos={x:resumeHome.door.stand.x,z:resumeHome.door.stand.z,heading:Math.atan2(resumeHome.door.nx,resumeHome.door.nz),inside:resumeHome.id};this.saveData.vehicles=garageSnapshot(this.saveData,this.homes.housing).vehicles;}
    this.vehicles.start(this.saveData);
    this.garage??=new GarageController(this);this.garage.start();
    this.business.start(this.saveData);
    this.justice.start(this.saveData);
    this.authority?.start();
    this.life.start(this.saveData);
    this.story.start();
    this.jobs.setResidents(this.npcs.residents);
    this.waypoint = null; this.minimap.waypoint = null;
    this.ui.setWallet(this.economy.balance);
    this.ui.setEnergy(this.needs.energy, this.needs.label());
    this.ui.setNeeds(this.needs.values); this.cityHud?.update();
    this.player.setAppearance(character);
    this.player.human.group.visible = true;
    // never restore into a wall, the river, an empty interior room or off the map
    const b = this.world.map.bounds;
    const bad = !Number.isFinite(pos.x) || !Number.isFinite(pos.z) || (!pos.inside && this.world.collision.inZone(pos.x, pos.z))
      || (!this.world.collision.inZone(pos.x, pos.z) && (pos.x < b.minX || pos.x > b.maxX || pos.z < b.minZ || pos.z > b.maxZ || this.world.terrain.isWater(pos.x, pos.z)));
    if (bad) { pos = { x: this.spawn.x, z: this.spawn.z, heading: this.spawn.heading }; this.ui.toast('Your saved spot could not be used, so you start at Old Market Road.'); }
    else if (!pos.inside && this.world.playArea?.locked(pos.x, pos.z)) { const bh = this.world.landmarks.get('bridgehead'); pos = { x: bh.x, z: bh.z, heading: 0 }; this.ui.toast('Asaba is COMING SOON, so you start at Bridgehead, Onitsha.'); }
    this._okSpot = null;
    const [x, z] = this.world.findFreeSpot(pos.x, pos.z, CONFIG.player.radius + 0.1);
    this.world.city.buildAround(x, z, 260); // make sure the neighbourhood exists before the camera arrives
    this.player.teleport(x, z, pos.heading ?? 0, pos.y ?? 0);
    this.player.setState(ControlState.ON_FOOT);
    this.cameraRig.yaw = (pos.heading ?? 0) + Math.PI;
    this.cameraRig.pitch = 0.25;
    this.cameraRig.snapTo(new THREE.Vector3(x, CONFIG.camera.height, z));
    this.cameraRig.setMode('follow');
    this.cameraRig.indoor = null;
    this.ui.only('hud');
    this.ui.fadeHints();
    this.setState('playing');
    this.homes.restore(pos);
    if(pos.civic){const l=this.world.landmarks.get(pos.civic);if(l&&this.civic.isOpen(l))this.civic.enter(l);}
    if(pos.club){const venue=this.cityLife.venues.find(v=>v.id===pos.club);if(venue&&(this.clock.hour>=19||this.clock.hour<4))this.club.enter(venue);}
    this.story.restore(pos);
    // straight back inside your home if you saved there and still rent it
  }

  quickStart() {
    // dev shortcut: ?quickstart[&gender=female][&t=18.5] skips the menus
    const g = this.params.get('gender') === 'female' ? 'female' : 'male';
    const t = parseFloat(this.params.get('t'));
    this.saveData = defaultSave({ ...defaultAppearance(g), name: 'Tester' });
    if (!Number.isNaN(t)) this.clock.minutes = t * 60;
    let pos = { x: this.spawn.x, z: this.spawn.z, heading: this.spawn.heading };
    const at = this.landmarks?.get(this.params.get('at') ?? '');
    if (at) { const g = at.gatePos ?? at; pos = { x: g.x, z: g.z, heading: 0 }; }
    this.enterWorld(this.saveData.character, pos);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.setState('paused');
    this.renderPauseStatus();
    this.ui.show('pause');
  }

  /** The week, the season and how the area knows you, on the pause screen. */
  renderPauseStatus() {
    const el = document.querySelector('[data-slot=pause-status]'); if (!el) return;
    const c = calendar(this.clock.day), r = this.reputation(), w = this.weather;
    const season = c.season === 'harmattan' ? 'Harmattan season' : c.season === 'rainy' ? 'Rainy season' : 'Dry season';
    el.innerHTML = '';
    const row = (label, ...lines) => { const d = document.createElement('div'); d.className = 'status-row'; const h = document.createElement('span'); h.className = 'status-label'; h.textContent = label; d.append(h); for (const t of lines.filter(Boolean)) { const p = document.createElement('span'); p.className = 'status-text'; p.textContent = t; d.append(p); } el.appendChild(d); };
    row('Today', `${c.label}, ${this.clock.label()} WAT`, `${season}${w?.w.label ? `, ${w.w.label.toLowerCase()}` : ''}${w && !w.power.on ? '. No light (NEPA)' : ''}`);
    const L = this.life; if (L?.ready) { const pub = L.standing.label('public'), legal = L.legal().word, jobs = L.work.summary(); row('You', jobs.length ? jobs.slice(0, 2).map((j) => `${j.rank}, ${j.label}`).join('; ') : 'Looking for opportunities', `People see you as: ${pub}`, `Record: ${legal}`); }
    else row('You', `${r.label} (${r.score}). ${r.note}`);
    if (this.events) { const today = this.events.today(); row('What’s on', ...(today.length ? today.map((e) => `${e.name}, ${e.where}, ${e.hours[0]}:00–${e.hours[1]}:00${this.events.active(e.id) ? ' (on now)' : ''}`) : ['No special events. Street food, pool, draughts, the court, the game zone and the viewing centre are open every day.'])); }
  }
  resume() {
    this.ui.only('hud');
    this.setState('playing');
    if (!this.touch) { try { const p = this.renderer.renderer.domElement.requestPointerLock?.(); p?.catch?.(() => {}); } catch { /* drag-look fallback */ } }
  }
  openSettings() { this.ui.show('settings'); this.cloudLine?.(); }

  /** Download the current save as a JSON file (a backup, or to move to another browser or device). */
  exportSave() {
    if (this.saveData && ['playing', 'paused', 'map', 'chase', 'overlay', 'activity'].includes(this.state)) this.saveGame();
    const raw = SaveSystem.raw();
    if (!raw) { this.ui.toast('There is no saved game to export yet'); return; }
    let name = 'game', day = '';
    try { const d = JSON.parse(raw); name = (d.character?.name ?? 'game').replace(/[^\w-]+/g, '_'); day = `-day${d.clock?.day ?? ''}`; } catch { /* keep defaults */ }
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `onitsha-way-${name}${day}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.ui.toast('Save exported');
  }

  /** Load a save file: checked and migrated first; the current save is backed up before it is replaced. */
  async importSave(file) {
    let text;
    try { text = await file.text(); } catch { this.ui.toast('Could not read that file'); return; }
    const r = SaveSystem.importRaw(text);
    if (!r.ok) { this.ui.confirm('Not a save file', `That file can't be loaded: ${r.error}. Your current game is unchanged.`, 'OK'); return; }
    this.ui.toast(`Imported ${r.summary.name}. Your previous save is backed up.`);
    this.ui.show('settings', false);
    this.ui.setMenuSave(SaveSystem.summary());
    if (this.state !== 'menu') this.showMenu();
  }
  openMap(focus = null) {
    this.prevState = this.state === 'map' ? this.prevState : this.state;
    if (this.state === 'playing' || this.state === 'paused') {
      this.setState('map');
      this.ui.show('map');
      this.updatePlaces();
      this.ui.show('pause', false);
      const p = this.worldFocus();
      requestAnimationFrame(() => this.minimap.openBig(p.x, p.z, this.player.heading, focus));
    }
  }
  closeMap() {
    this.ui.show('map', false);
    if (this.prevState === 'paused') { this.setState('paused'); this.ui.show('pause'); }
    else this.resume();
  }

  saveGame() {
    const ok = this.saveGameNow();
    if (ok === false && this.saveData && !this._saveWarned) { this._saveWarned = true; this.ui.toast('Could not save — your browser storage is full or blocked. Export your save from Settings to keep it safe.'); }
    if (ok) this._saveWarned = false;
    return ok;
  }

  saveGameNow() {
    if (!this.saveData || !this.player.human) return false;
    this.story?.snapshot();
    this.saveData.player = this.activities?.savePosition() ?? this.story?.savePosition() ?? this.civic?.savePosition() ?? this.club?.savePosition() ?? this.transport?.savePosition() ?? this.vehicles?.savePosition() ?? this.homes?.savePosition() ?? this.player.serialize();
    this.saveData.clock = this.clock.serialize();
    this.saveData.character = { ...this.saveData.character, ...this.player.appearance, name: this.saveData.character.name };
    return SaveSystem.save(this.homes?.housing?garageSnapshot(this.saveData,this.homes.housing):this.saveData);
  }

  // ------------------------------------------------------------------ frame loop
  frame() {
    // one bad frame must never stop the game: three.js stops its loop if the callback throws
    try { this.frameInner(); } catch (err) {
      this.reportError(err, 'frame');
      try { this.renderer.render(); } catch { /* ignore */ }
    }
  }

  /** Errors are logged, kept for a "copy details" button, and shown once in a small bar (the game keeps running). */
  reportError(err, where = '') {
    console.error(`[${where}]`, err);
    const msg = `${where}: ${err?.message ?? err}`;
    window.__onitshaErrors ??= [];
    if (window.__onitshaErrors.length < 30) window.__onitshaErrors.push({ where, message: String(err?.message ?? err), stack: String(err?.stack ?? '').split('\n').slice(0, 6).join('\n'), t: new Date().toISOString(), state: this.state });
    const now = performance.now();
    if (this._lastErrMsg === msg && now - (this._lastErrAt ?? 0) < 15000) return;
    this._lastErrMsg = msg; this._lastErrAt = now;
    this.ui.errorBar?.(err?.message ?? String(err));
  }

  frameInner() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if(this.saveData)this.clock.syncReal();
    if (this.state === 'chase') this.story.updateChase(dt);
    else if (this.state === 'activity') this.activities.update(dt);
    else if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'dialogue' || this.state === 'shop') { this.player.idle(dt); this.cameraRig.update(dt, this.player.position); this.clock.update(dt); }
    else if (this.state === 'creator') { this.player.idle(dt); this.cameraRig.update(dt, this.player.position); }
    else if (this.state === 'menu') this.cameraRig.update(dt, this.player.position);
    else if (this.state === 'paused' && this.input.consumePress('pause') && !this.ui.isOpen('settings')) this.resume();
    else if (this.state === 'map' || this.state === 'paused') {
      // world frozen; keep keyboard shortcuts alive
      if (this.state === 'map' && (this.input.consumePress('pause') || this.input.consumePress('map'))) { this.input.keys.clear(); this.closeMap(); }
    }

    if (this.state === 'creator' && this.creatorKey) { const y=this.cameraRig.yaw;this.creatorKey.position.set(Math.sin(y)*2.5+Math.cos(y)*1.2,2.8,Math.cos(y)*2.5-Math.sin(y)*1.2);this.creatorFill.position.set(Math.sin(y)*1.8-Math.cos(y)*1.6,1.8,Math.cos(y)*1.8+Math.sin(y)*1.6); }
    this.vehicles?.animateDoors(dt);
    this.cityLife?.update(dt);
    this.gates?.update(dt); (this.fuelLife ??= new FuelStationLife(this)).update(dt); // v0.53 cars and attendants at the filling stations
    this.showroom?.update?.(dt); this.morePlaces?.update(dt); // v0.49 the showrooms' turntables (and hiding them when far off)
    for(const place of this.activityPlaces??[])place.update?.(dt);
    this.club?.update(dt);
    this.civic?.update();
    this.story?.update(dt);
    this.posture?.update(dt);
    this.weather?.update(dt);
    this.atmosphere.update(this.clock.minutes); this.world.city?.setNight?.(this.atmosphere.nightK ?? 0); this.world.monuments?.updateLights?.(performance.now() / 1000, this.atmosphere.nightK ?? 0);
    if(this.saveData&&this.clock.mode==='real'&&['overlay','paused','map'].includes(this.state))this.tickHUD(dt);
    const focus = this.state === 'menu' ? this.cameraRig.cine.center : this.worldFocus();
    this.world.update(dt, focus);
    this.world.streetLighting?.update(dt,focus,this.atmosphere.nightK,this.settings.quality,!!this.cameraRig.indoor);
    this.venueMusic?.update();
    this.world.grass?.update(dt, focus);
    this.updateLife(dt, focus);
    this.online?.update(dt);
    this.carRadio?.sync(dt);
    this.renderer.followShadows(focus);
    this.buy?.update();
    this.renderer.render();
    this.renderer.adapt(dt, this.settings.adaptive !== false);

    // fps
    this.fps.frames++; this.fps.t += dt;
    if (this.fps.t >= 0.5) { this.fps.value = Math.round(this.fps.frames / this.fps.t); this.fps.frames = 0; this.fps.t = 0; }
  }

  /** Where the city must stay loaded and alive: the player, or the front door while they are indoors. */
  worldFocus() {
    const f = this.activities?.focus() ?? this.story?.focus() ?? this.civic?.inside?.visitSpot ?? this.civic?.inside ?? this.club?.inside ?? this.homes?.focus();
    return f ? { x: f.x, y: 0, z: f.z } : this.player.position;
  }

  updatePlaying(dt) {
    const input = this.input;
    if(this.story?.s?.arrest){if(input.consumePress('pause')){this.pause();return;}if(input.consumePress('interact')||input.consumePress('phone'))this.openChoice(()=>this.story.officeView());this.ui.setPrompt('Custody desk — E / Phone for bail or service');this.touchControls?.setInteract('Custody desk');this.player.idle(dt);this.cameraRig.update(dt,this.player.position);this.tickHUD(dt);return;}
    if (input.consumePress('pause')) { this.pause(); return; }
    if (input.consumePress('map')) { this.openMap(); return; }
    if (input.consumePress('bag')) { this.openOverlay('bag'); return; }
    if (input.consumePress('jobs')) { this.openOverlay('jobs'); return; }
    if (input.consumePress('phone')) { this.openOverlay('phone'); return; }
    if (input.consumePress('homes')) { this.openOverlay('homes'); return; }
    if (this.online?.passengerFrame(dt)) return;
    if (this.vehicles.driving) { this.updateDrivingFrame(dt); return; }

    if (this.transport.riding) { this.updateRidingFrame(dt); return; }
    const look = input.consumeLook();
    if (look.dx || look.dy) this.cameraRig.applyLook(look.dx, look.dy);
    const z = input.consumeZoom(); if (z) this.cameraRig.applyZoom(z);
    input.consumePress('nextstop'); input.consumePress('drophere'); input.consumePress('camera'); input.consumePress('fuel'); input.consumePress('skip');

    const move = input.getMove();
    if(this.cityLife?.activity){
      if(move.mag>.1||input.keys.has('Space'))this.cityLife.finishActivity(false);
      else {this.player.idle(dt);this.cameraRig.update(dt,this.player.position);this.clock.update(dt);this.tickHUD(dt);this.ui.setPrompt('Move to stand up / stop dancing');this.touchControls?.setInteract(null);return;}
    }
    if (this.hospitals?.knocked) { // v0.39: knocked down by a vehicle — lie still until the ambulance comes
      this.player.idle(dt); const hg = this.player.human?.group; if (hg) { hg.rotation.x = -Math.PI / 2; hg.position.y = this.player.position.y + 0.18; }
      this.cameraRig.update(dt, this.player.position); this.clock.update(dt); this.tickHUD(dt); this.ui.setPrompt('You were knocked down. An ambulance is coming…'); this.touchControls?.setInteract(null); return;
    }
    const intent = { move, run: input.isRunning(), jump: input.consumePress('jump'), runFactor: this.needs.runFactor() };
    this.player.update(dt, intent, this.cameraRig.basis());
    // people and vehicles are solid too
    const pp = this.player.position;
    if (!this.player.posture) { // v0.45: seated or lying on furniture you are inside its collider on purpose
    const hitV = this.traffic.pushOut(pp, CONFIG.player.radius, null, pp.y);
    if (hitV && Math.abs(hitV.speed ?? 0) > 5 && !hitV.ambulance) this.hospitals?.knockDown(hitV);
    this.npcs.pushOut(pp, CONFIG.player.radius, pp.y);
    if (pp.y < 0.7) this.world.collision.resolveCircle(pp, CONFIG.player.radius);
    }
    this.guardPlayArea(pp);
    this.player.syncModel();

    // gentle auto-follow when the player isn't steering the camera (touch / keyboard-only)
    if (move.mag > 0.1 && !input.locked && performance.now() - input.lastLookTime > 1600) {
      this.cameraRig.autoFollow(this.player.heading, dt, 1.1);
    }
    this.cameraRig.update(dt, this.player.position);

    let prompt = this.interactions.update(this.player.position.x, this.player.position.z);
    let talkTo = !prompt && !this.homes.inside && !this.club?.inside && !this.civic?.inside ? this.npcs.nearestTalkable(this.player.position.x, this.player.position.z) : null;
    const tp = !prompt && !this.homes.inside && !this.club?.inside && !this.civic?.inside ? this.transport.prompt(pp.x, pp.z, talkTo ? Math.hypot(talkTo.x - pp.x, talkTo.z - pp.z) : Infinity) : null;
    if (tp) { prompt = tp.label; talkTo = null; } else if (talkTo) prompt = `Talk to ${talkTo.name}`;
    this.touchControls?.setInteract(prompt);
    this.ui.setPrompt(prompt);
    if (input.consumePress('interact')) {
      if (tp) { tp.act?.(); return; }
      if (talkTo) { this.startDialogue(talkTo); return; }
      this.interactions.trigger();
    }

    this.clock.update(dt);
    this.needs.update(this.clock.mode==='real'?0:dt * this.clock.rate, { moving: this.player.speed > 0.4, running: intent.run && this.player.speed > 3 });

    // audio: ambience levels a few times a second, footsteps on every foot contact
    this.audioTimer -= dt;
    if (this.audioTimer <= 0) { this.audioTimer = 0.3; this.updateAudioLevels(); }
    this.audio.update(dt, null);
    const an = this.player.animator;
    if (an) {
      const step = Math.floor(an.phase / Math.PI);
      if (step !== this.lastStep) {
        this.lastStep = step;
        if (this.player.grounded && this.player.speed > 0.4) this.audio.footstep(this.footSurface, Math.min(1.3, 0.5 + this.player.speed / 5));
      }
    }

    this.homes?.decor?.updateAppliances(dt);
    this.tickHUD(dt);
  }

  /** HUD, waypoints, minimap and autosave — shared by walking and riding. */
  tickHUD(dt) {
    this.hudTimer -= dt;
    // A low frame rate caps simulation dt; the real clock must not wait several
    // capped frames before its displayed minute/date catches up.
    const clockKey = `${this.clock.day}:${this.clock.label()}`;
    if (this.hudTimer <= 0 || (this.clock.mode === 'real' && this.lastHudClockKey !== clockKey)) {
      this.hudTimer = 0.25;
      this.lastHudClockKey = clockKey;
      if (this.state === 'paused') this.renderPauseStatus();
      const elapsed = Math.max(0, this.nowAbs() - (this.lastPowerAbs ?? this.nowAbs()));
      if(this.clock.mode==='real')this.needs.update(elapsed,{moving:this.player.speed>.4,running:this.player.speed>3,riding:!!this.transport.riding});
      this.homeUpgrades?.advance(elapsed, this.weather?.power.on ?? true, this.clock.hour >= 7 && this.clock.hour < 18); this.lastPowerAbs = this.nowAbs();
      const p = this.player.position;
      const f = this.worldFocus();
      this.ui.updateHUD({
        location: (this.story?.inside?{place:this.story.inside.id==='efcc'?'EFCC office':'Police station',street:this.story.s?.arrest?'In custody':'Visitor desk'}:null) ?? (this.civic?.inside?{place:this.civic.inside.name,street:({mall:'Shopping floor',eatery:'Dining room',hospital:'Inside',bank:'Banking hall',court:'Courtroom',electoral:'Electoral office',store:'Showroom'})[this.civic.inside.kind]??'Visitor room'}:null) ?? (this.club?.inside?{place:this.club.inside.name,street:'Club interior'}:null) ?? this.homes.locationLabel() ?? this.world.location(f.x, f.z),
        time: this.clock.label(), period: this.clock.period(), day: this.clock.day, fps: this.fps.value, env: this.weather?.hud(),
        northAngle: this.cameraRig.yaw,
      });
      this.jobs.update(this.nowAbs());
      this.wholesale.update();
      this.updateWaypoint();
      this.ui.setEnergy(this.needs.energy, this.needs.label());
    this.ui.setNeeds(this.needs.values); this.cityHud?.update();
      this.ui.setTransit(this.transport.riding ? null : this.transport.waitingStatus(p.x, p.z));
      this.ui.setRide(this.transport.rideView());
      this.ui.setDrive(this.vehicles.driveView());
      this.homes.applyLight(); this.homes.refreshSigns(); this.homes.decor.renderOutdoor();
      this.updateRoute(); this.updatePlaces();
    }
    const ang = this.directionAngle();
    this.ui.setDirection(ang, !this.waypoint&&!this.story?.s?.contract);
    const { fx, fz, rx, rz } = this.cameraRig.basis();
    const northAngle = Math.atan2(-rz, -fz);
    const heading = ((Math.atan2(fx, -fz) * 180 / Math.PI) + 360) % 360;
    const cardinal = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(heading / 45) % 8];
    const dest = this.destination(), focus = this.worldFocus();
    const indoors = this.homes?.inside || this.story?.inside || this.club?.inside || this.civic?.inside;
    if (dest && !indoors) {
      const direct = Math.hypot(dest.x - focus.x, dest.z - focus.z);
      const distance = this.route?.metres ?? direct;
      const label = distance < 950 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`;
      const bearing = ang ?? Math.atan2((dest.x - focus.x) * rx + (dest.z - focus.z) * rz, (dest.x - focus.x) * fx + (dest.z - focus.z) * fz);
      this.ui.setNavigation(bearing, dest.name || 'Destination', `${label} · ${this.route ? 'Follow arrow along streets' : 'Direction to destination'}`, true);
    } else {
      this.ui.setNavigation(northAngle, `Compass · facing ${cardinal}`, dest ? 'Exit the building to follow your marker' : 'N arrow · tap to mark a destination');
    }
    this.updateBeacon(dt);
    const mf = this.worldFocus();
    this.minimap.drawMini(mf.x, mf.z, this.cameraRig.yaw, this.player.heading);

    this.autosaveTimer += dt;
    if (this.autosaveTimer > AUTOSAVE_SECONDS) { this.autosaveTimer = 0; this.saveGame(); }
  }

  /** Driving your own vehicle: the VehicleController moves it; the player sits in it. */
  updateDrivingFrame(dt) {
    this.vehicles.update(dt, this.input);
    if (!this.vehicles.driving) return; // got out this frame
    const dv = this.vehicles.driveView();
    this.touchControls?.setInteract(dv?.canExit ? 'Get out' : null);
    this.ui.setPrompt(dv?.canExit ? 'Get out' : null);
    this.clock.update(dt);
    this.needs.update(this.clock.mode==='real'?0:dt * this.clock.rate, { riding: true });
    this.audioTimer -= dt;
    if (this.audioTimer <= 0) { this.audioTimer = 0.3; this.updateAudioLevels(); }
    this.audio.update(dt, null);
    this.homes?.decor?.updateAppliances(dt);
    this.tickHUD(dt);
  }

  /** Seated in a keke or bus: the vehicle moves you; you can look around, ask to stop, or get down. */
  updateRidingFrame(dt) {
    this.transport.updateRiding(dt, this.input);
    this.touchControls?.setInteract(this.transport.rideView()?.canDown ? 'Get down' : null);
    this.ui.setPrompt(this.transport.rideView()?.canDown ? 'Get down' : null);
    this.clock.update(dt);
    this.needs.update(this.clock.mode==='real'?0:dt * this.clock.rate, { riding: !!this.transport.riding });
    this.audioTimer -= dt;
    if (this.audioTimer <= 0) { this.audioTimer = 0.3; this.updateAudioLevels(); this.applyAudioDuck(); }
    this.audio.update(dt, null);
    this.homes?.decor?.updateAppliances(dt);
    this.tickHUD(dt);
  }

  // ------------------------------------------------------------------ living city
  updateLife(dt, focus) {
    const hour = this.clock.minutes / 60;
    const live = ['playing', 'dialogue', 'shop', 'menu', 'creator'].includes(this.state);
    if (!live) return;
    const inWorld = this.state === 'playing' || this.state === 'dialogue' || this.state === 'shop';
    const p = this.player.position;
    const riding = !!this.transport?.riding || !!this.vehicles?.driving;
    const indoors = !!this.homes?.inside;
    const playerInfo = inWorld && !riding && !indoors ? { x: p.x, z: p.z } : null;
    if (inWorld) this.transport.updateWorld(dt, hour);
    if (inWorld) {
      this.npcs.update(dt, {
        player: { x: p.x, z: p.z, speed: this.player.speed, gender: this.saveData?.character?.gender, riding },
        hour, camera: this.renderer.camera, talkingTo: this.dialogue?.npc ?? null, vehicles: this.traffic.near ?? [], car: this.vehicles?.carInfo() ?? null,
      });
    }
    this.traffic.setNight(this.atmosphere.nightK ?? 0);
    if (this.traffic.control) { this.traffic.control.update(dt); this.traffic.control.render(dt, inWorld ? this.worldFocus() : focus); } // v0.49 traffic lights and wardens
    this.traffic.update(dt, inWorld ? this.worldFocus() : focus, hour, playerInfo, inWorld ? this.npcs.positions() : []);
    this.patrols??=new PolicePatrols(this);this.patrols.update(dt);
    // horns from real vehicles, panned relative to the camera
    for (const h of this.traffic.takeHorns()) {
      const dx = h.x - p.x, dz = h.z - p.z, dist = Math.hypot(dx, dz);
      if (dist > 90 || !inWorld) continue;
      const { fx, fz, rx, rz } = this.cameraRig.basis();
      this.audio.horn(Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), dist);
    }
    this.renderBubbles(inWorld);
  }

  renderBubbles(show) {
    if (!show) { this.ui.renderBubbles([]); return; }
    const cam = this.renderer.camera, v = new THREE.Vector3();
    const W = window.innerWidth, H = window.innerHeight;
    const items = [];
    for (const { v: car, text } of this.traffic.crashBubbles?.() ?? []) { // drivers shouting after a knock
      const d = Math.hypot(car.x - this.player.position.x, car.z - this.player.position.z); if (d > 40) continue;
      v.set(car.x, (car.y ?? 0) + 2.1, car.z).project(cam); if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) continue;
      items.push({ key: 'crash:' + car.id, x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, text, alpha: Math.max(0.4, 1 - d / 42) });
    }
    for (const b of this.npcs.bubbles) {
      const n = b.npc;
      const d = Math.hypot(n.x - this.player.position.x, n.z - this.player.position.z);
      if (d > 24 || n === this.dialogue?.npc) continue;
      v.set(n.x, 2.05 * (n.rig.group.scale.y || 1), n.z).project(cam);
      if (v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1) continue;
      items.push({ key: n.identity.id, x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, text: b.line.expr && b.line.form === undefined && !b.line.gen ? b.line.expr : b.line.gen, expr: b.line.expr, alpha: Math.max(0.35, 1 - d / 26) });
    }
    const pri = this.npcs.priorityId && this.npcs.active.find((n) => n.identity.id === this.npcs.priorityId);
    if (pri && !items.some((i) => i.key === pri.identity.id) && pri !== this.dialogue?.npc) {
      v.set(pri.x, 2.2 * (pri.rig.group.scale.y || 1), pri.z).project(cam);
      if (v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1) items.push({ key: 'job-target', target: true, x: (v.x * 0.5 + 0.5) * W, y: (-v.y * 0.5 + 0.5) * H, text: `★ ${pri.name}`, alpha: 1 });
    }
    this.ui.renderBubbles(items);
  }

  // ------------------------------------------------------------------ conversations
  relLabel(rel) {
    const f = rel.familiarity;
    if (rel.negative >= 3 && rel.negative > rel.positive) return 'Not happy with you';
    return f >= 6 ? 'Close friend · Aloba m' : f >= 3 ? 'Familiar face' : f >= 1 ? 'Met before' : 'Stranger';
  }

  startDialogue(npc) {
    const rel = this.npcs.rel(npc.identity);
    const p = this.player.position;
    const loc = this.world.location(npc.x, npc.z);
    const id = npc.identity;
    const now = this.nowAbs();
    const rep = this.reputation();
    const offer = npc.role === 'trader' ? this.jobs.offerFor(id, this.clock.day, now, { bonus: rep.jobBonus }) : null;
    const stepHere = this.jobs.stepsFor(id.id)[0] ?? null;
    const step = stepHere?.step ?? null;
    const job = stepHere ? stepHere.job : offer;
    const targetR = job?.target ? this.jobs.byId.get(job.target) : null;
    const giverR = job ? this.jobs.byId.get(job.giver) : null;
    // things in the bag you could give (not job parcels), once a day per person
    const giftable = rel.giftDay === this.clock.day ? [] : this.inventory.items.filter((it) => it.kind !== 'package' && !it.unique && ITEMS[it.id]).slice(0, 5).map((it) => ({ id: it.id, name: it.name }));
    const mission = this.missions?.context(npc);
    const ctx = {
      mission,
      canShop: npc.role === 'trader' || npc.role === 'hawker',
      jobOffer: offer, jobStep: step, jobReward: job?.reward, jobsFull: this.jobs.full,
      jobDue: offer ? `${clockLabel(offer.deadline)} (${durationLabel(offer.deadline - now)})` : null,
      jobTargetName: targetR?.name, jobGiverName: giverR?.name, jobItemName: job?.item ? ITEMS[job.item]?.name : null,
      jobWhere: offer && targetR ? `${Math.round(Math.hypot(targetR.x - id.x, targetR.z - id.z) / 50) * 50} m ${compass(id.x, id.z, targetR.x, targetR.z)} of here` : null,
      giftable,
      nearestStop: (x, z) => this.transport.nearestStop(x, z),
      reputation: rep, fame: this.news?.fame?.() ?? null, // v0.47: people react to who you are
      supplyOrders: this.wholesale?.sys.ordersFor(id.id) ?? [],
      crime: this.justice?.dialogueOptions(npc) ?? [],
      npc, rel, rng: mulberry32((Date.now() & 0xffff) ^ npc.identity.id.length),
      player: { name: this.saveData.character.name, gender: this.saveData.character.gender },
      hour: this.clock.minutes / 60, place: loc.place, street: loc.street, landmarks: this.world.landmarks,
    };
    this.dialogue = { npc, rel, nodes: buildConversation(ctx), node: null, counted: false, mission, offer, stepJob: stepHere?.job ?? null };
    if (ctx.fame?.level === 'wanted' && npc.role !== 'police') this.news?.recognised(npc);
    this.player.heading = Math.atan2(npc.x - p.x, npc.z - p.z); this.player.syncModel();
    this.cameraRig.setDialogue(p, new THREE.Vector3(npc.x, 0, npc.z));
    this.setState('dialogue');
    this.ui.setPrompt(null); this.ui.only('hud', 'dialogue');
    this.ui.openDialogue({ name: npc.name, role: this.npcs.roleLabel(npc), relLabel: this.relLabel(rel) });
    this.showNode('open');
  }

  showNode(id) {
    const d = this.dialogue; if (!d) return;
    const node = d.nodes[id];
    if (!node) { this.endDialogue(); return; }
    d.node = node;
    this.missions?.opened(d,id);
    if (node.expr) this.npcs.onHeard?.(node.expr);
    if (node.action?.type === 'waypoint') {
      const l = this.world.landmarks.get(node.action.landmark);
      if (l) { this.waypoint = l; this.minimap.waypoint = { x: l.x, z: l.z }; }
    }
    this.ui.renderDialogueNode(node, (i) => this.chooseResponse(i));
  }

  chooseResponse(i) {
    const d = this.dialogue; if (!d?.node) return;
    const r = d.node.responses[i]; if (!r) return;
    const rel = d.rel;
    if (!d.counted) {
      d.counted = true; rel.talks += 1;
      if (rel.m9SocialDay !== this.clock.day) { this.needs.adjust({social:12,fun:3});this.skills?.add('charisma',12);rel.m9SocialDay=this.clock.day; }
      rel.lastDay = this.clock.day;
    }
    const e = r.effect ?? {};
    if (e.positive) rel.positive += e.positive;
    if (e.mood && e.mood < 0) rel.negative += -e.mood;
    if (e.knowsName) rel.knowsName = true;
    if (e.invited) rel.invitedDay = this.clock.day;
    if (e.visit) {
      const home = this.homes.addVisit(d.npc.identity, rel);
      if (home) { this.setWaypoint({ x: home.door.stand.x, z: home.door.stand.z, name: home.label, radius: 4 }); this.ui.toast(`${d.npc.name}'s house is on your map${home.street ? ' — ' + home.street : ''}`); }
    }
    if (r.expr) this.npcs.onHeard?.(r.expr);
    let next = r.next;
    if (r.action) {
      const res = this.handleAction(r.action, d);
      if (res === 'closed') return;
      if (next && typeof next === 'object') next = next[res];
    }
    this.npcs.rel(d.npc.identity); // refresh familiarity
    this.ui.setDialogueRel(this.relLabel(rel));
    if (next === null || next === undefined) this.endDialogue(); else this.showNode(next);
  }

  /** Dialogue actions that change game state. Returns a result key used to pick the next node. */
  handleAction(action, d) {
    const npc = d.npc;
    if (action.type.startsWith('mission-')) return this.missions.action(action.type,d);
    if (action.type === 'shop') { this.endDialogue({ save: false }); this.openShop(npc); return 'closed'; }
    if (action.type === 'job-accept') {
      const res = this.jobs.accept(d.offer);
      if (!res.ok) { if (res.error === 'bag-full') this.ui.toast('Your bag is full'); return res.error === 'too-many' ? 'full' : 'fail'; }
      this.jobs.state.missions.tracked=null;
      this.jobs.track(res.job.id);
      this.ui.toast(`Job accepted: ${res.job.title} · by ${clockLabel(res.job.deadline)}`);
      return 'ok';
    }
    if (action.type === 'job-step') {
      const res = this.jobs.doStep(npc.identity.id, d.stepJob?.id ?? null);
      if (!res.ok) return res.error === 'expired' ? 'expired' : 'fail';
      d.rel.positive += 1;
      if (res.advanced) { this.ui.toast('Goods collected — take them back'); return 'advanced'; }
      return 'ok';
    }
    if (action.type === 'supply') {
      const res = this.wholesale.sys.deliver(action.order, this.nowAbs());
      if (!res.ok) return res.error === 'expired' ? 'expired' : 'fail';
      d.rel.positive += 1; this.ui.toast(`Supply delivered — ${naira(res.paid)} paid`); this.saveGame();
      return 'ok';
    }
    if (action.type === 'crime') { this.endDialogue({ save: false }); this.justice.commit(action.kind, npc); return 'closed'; }
    if (action.type === 'gift') {
      const it = ITEMS[action.item];
      if (!it || !this.inventory.has(action.item) || d.rel.giftDay === this.clock.day) return 'fail';
      this.inventory.remove(action.item, 1);
      d.rel.giftDay = this.clock.day;
      d.rel.gifts = (d.rel.gifts ?? 0) + 1;
      d.rel.positive += 1 + (it.price >= 1000 ? 1 : 0) + (it.price >= 5000 ? 1 : 0);
      this.ui.toast(`You gave ${npc.name} ${it.name}`);
      return 'ok';
    }
    return 'fail';
  }

  endDialogue({ save = true } = {}) {
    if (!this.dialogue) return;
    this.dialogue = null;
    this.ui.closeDialogue();
    this.cameraRig.setMode('follow');
    this.cameraRig.yaw = this.player.heading + Math.PI;
    this.cameraRig.snapTo(this.player.position.clone().setY(CONFIG.camera.height));
    this.ui.only('hud');
    this.setState('playing');
    if (save) this.saveGame();
  }

  // ------------------------------------------------------------------ shopping
  openShop(npc) {
    const rel = this.npcs.rel(npc.identity);
    const stock = this.stock.forTrader(npc.identity, this.clock.day);
    const session = new ShopSession({ trader: npc.identity, rel, economy: this.economy, inventory: this.inventory, stock, discount: this.reputation().discount });
    this.shop = { npc, rel, session, selected: null, first: {}, insulted: false, bought: false, tab: 'buy',
      reply: npc.role === 'hawker' ? { gen: 'Wetin you go buy? Everything fresh.' } : { expr: 'ote', gen: 'Everything here na ote. Choose wetin you like.' } };
    this.dialogue = { npc }; // keeps the NPC facing the player
    this.cameraRig.setDialogue(this.player.position, new THREE.Vector3(npc.x, 0, npc.z));
    this.setState('shop');
    this.ui.setPrompt(null);
    this.ui.only('hud', 'shop');
    this.renderShop();
  }

  renderShop() {
    const s = this.shop, ses = s.session;
    const items = ses.items.map((it) => ({ id: it.id, name: it.name, price: ses.asking(it), owned: this.inventory.count(it.id), left: ses.left(it.id) }));
    let deal = null;
    if (s.selected) {
      const it = ses.items.find((i) => i.id === s.selected); const price = ses.asking(it);
      s.first[it.id] ??= price;
      const o = ses.offers.get(it.id);
      deal = { id: it.id, name: it.name, price, first: s.first[it.id], half: Math.max(50, Math.round(price / 100) * 50), left: ses.left(it.id),
        canAfford: this.economy.canAfford(price), bagOk: this.inventory.canAdd(it, 1), fixed: ses.goods === 'hawker', final: o.rounds >= 2 || price <= ses.floor(it) };
    }
    const sellable = ses.sellable();
    const goodsLabel = s.npc.role === 'hawker' ? 'Hawker · snacks and water' : `${s.npc.identity.goods} · ${this.relLabel(s.rel)}`;
    this.ui.renderShop({ name: s.npc.name, goodsLabel, balance: this.economy.balance, items, selected: s.selected, deal, reply: s.reply, tab: s.tab, sellable, canSell: ses.goods !== 'hawker' }, {
      select: (id) => { s.selected = id; const it = ses.items.find((i) => i.id === id); s.reply = ses.left(id) < 1 ? { gen: `${it.name}? E don finish for today o. Come back tomorrow.` } : { gen: `${it.name}? Na ${naira(ses.asking(it))}.` }; this.renderShop(); },
      buy: (id) => this.shopBuy(id),
      tab: (t) => { s.tab = t; s.reply = t === 'sell' ? { gen: sellable.length ? 'Wetin you carry come? Show me — I go give you correct price.' : `I only dey buy ${ses.goods}. You no get anything wey I dey buy.` } : { expr: 'ote', gen: 'Everything here na ote. Choose wetin you like.' }; this.renderShop(); },
      sell: (id) => {
        const r = ses.sell(id);
        if (r.ok) { s.reply = { expr: 'o-suo', form: 0, gen: `O suo! I don pay you ${naira(r.price)} for the ${r.item.name}.` }; this.npcs.onHeard?.('o-suo'); this.ui.toast(`Sold ${r.item.name} for ${naira(r.price)}`); }
        else s.reply = { gen: 'I no fit buy that one.' };
        this.renderShop();
      },
      haggle: (id) => {
        const r = ses.haggle(id);
        s.reply = r.reply === 'reduced' ? { expr: 'kpaa-ife', gen: `Okay, I don kpaa ife small — ${naira(r.price)}.` }
          : r.reply === 'floor' ? { gen: `Na last price be that: ${naira(r.price)}. I no dey gain again.` }
            : r.reply === 'fixed' ? { gen: 'Na fixed price o, my sister/brother.' } : { gen: 'I no fit go lower than this one.' };
        if (s.reply.expr) this.npcs.onHeard?.(s.reply.expr);
        this.renderShop();
      },
      lowball: (id) => {
        const r = ses.lowball(id);
        s.reply = { expr: 'inye-iru-evi', gen: `${naira(r.offer)}?! Inye iru evi! You wan finish me?` };
        if (!s.insulted) { s.insulted = true; s.rel.negative += 1; }
        this.npcs.onHeard?.('inye-iru-evi');
        this.renderShop();
      },
    });
  }

  shopBuy(id) {
    const s = this.shop, r = s.session.buy(id, 1);
    if (r.ok) {
      s.reply = { expr: 'o-suo', form: 0, gen: `O suo! ${r.item.name} na your own now. Come back again o.` };
      this.npcs.onHeard?.('o-suo');
      if (!s.bought) { s.bought = true; s.rel.positive += 1; s.rel.purchases = (s.rel.purchases ?? 0) + 1; }
      this.ui.toast(`Bought ${r.item.name} for ${naira(r.total)}`);
    } else {
      s.reply = r.error === 'insufficient-funds' ? { gen: 'Your money no reach for this one o.' } : r.error === 'bag-full' ? { gen: 'Your bag don full — where you go put am?' } : r.error === 'sold-out' ? { gen: 'E don finish! Na tomorrow I go get more.' } : { gen: 'Something no correct. Try again.' };
    }
    this.renderShop();
  }

  closeShop() {
    if (this.state !== 'shop') return;
    this.shop = null; this.dialogue = null;
    this.ui.show('shop', false);
    this.cameraRig.setMode('follow');
    this.cameraRig.yaw = this.player.heading + Math.PI;
    this.cameraRig.snapTo(this.player.position.clone().setY(CONFIG.camera.height));
    this.ui.only('hud');
    this.setState('playing');
    this.saveGame();
  }

  // ------------------------------------------------------------------ bag / jobs overlays
  openOverlay(which, ctx = null) {
    if(this.story?.s?.arrest){this.openChoice(()=>this.story.officeView());return;}
    if (!['playing', 'paused'].includes(this.state)) return;
    this.overlayReturn = this.state;
    this.ui.show('pause', false);
    this.setState('overlay');
    this.overlay = which;
    if (which === 'bag') this.renderBag();
    else if (which === 'stop') { this.stopCtx = ctx; this.renderStop(); }
    else if (which === 'homes') this.renderHomes();
    else if (which === 'phone') { this.ui.show('phone'); this.phone.render(); }
    else if (which === 'buy') this.buy.enter();
    else this.renderJobs();
  }

  // ------------------------------------------------------------------ generic choice panel
  /** builder() returns {title, kicker, expr, text, note, sections:[{heading, empty, options}], options:[{label, sub, disabled, why, primary, ghost, act}]} */
  openChoice(builder) {
    if (this.state === 'overlay' && this.overlay === 'choice') { this.choiceBuilder = builder; this.renderChoice(); return; }
    const fromPhone = this.state === 'overlay' && this.overlay === 'phone';
    if (!['playing', 'paused'].includes(this.state) && !fromPhone) return;
    const view = builder(); if (!view) return;
    this.choiceBuilder = builder;
    if (fromPhone) this.ui.show('phone', false);
    else this.overlayReturn = this.state;
    this.ui.show('pause', false);
    this.setState('overlay'); this.overlay = 'choice';
    this.ui.setPrompt(null);
    this.ui.renderChoice(view);
  }
  renderChoice(builder = null) {
    if (builder) this.choiceBuilder = builder;
    const view = this.choiceBuilder?.();
    if (!view) { this.closeChoice(); return; }
    this.ui.renderChoice(view);
  }
  closeChoice() {
    if (this.overlay !== 'choice' || this.state !== 'overlay') return;
    this.choiceBuilder = null;
    this.closeOverlay('choice');
  }

  // ------------------------------------------------------------------ homes & vehicles list
  renderHomes() {
    const p = this.worldFocus(), now = this.nowAbs();
    const where = (x, z) => { const d = Math.hypot(x - p.x, z - p.z); return `${d < 950 ? Math.round(d / 10) * 10 + ' m' : (d / 1000).toFixed(1) + ' km'} ${compass(p.x, p.z, x, z)}`; };
    const H = this.homes.housing;
    const show = (w) => { this.setWaypoint(w); this.closeOverlay('homes'); this.ui.toast(`${w.name} — marked on your map. Follow the blue line.`); this.openMap(w); };
    const homes = this.homes.listings.map((h) => {
      const st = H.status(h.id, now);
      return { id: h.id, title: `${h.label}${h.street ? ' — ' + h.street : ''}`, price: H.state.owned[h.id]?'Owned permanently':`${naira(h.rent)} / ${h.days} days · buy ${naira(H.purchasePrice(h.id))}`, area: `${h.area} m²`, where: where(h.door.stand.x, h.door.stand.z),
        status: H.state.owned[h.id]?'Your property':st === 'tenant' ? `Yours until ${this.homes.untilLabel(h)}` : st === 'due' ? 'Rent due — renew at the door' : 'To let', mine: st !== 'vacant',
        place: this.placeName(h.door.stand.x, h.door.stand.z, h.street),
        go: () => show({ x: h.door.stand.x, z: h.door.stand.z, name: h.label + (h.street ? `, ${h.street}` : ''), radius: 5 }) };
    }).sort((a, b) => (b.mine - a.mine) || a.title.localeCompare(b.title));
    const V = this.vehicles.sys;
    const nearestStock=new Map();
    for(const s of V.forSale()){const prev=nearestStock.get(s.model);if(!prev||Math.hypot(s.x-p.x,s.z-p.z)<Math.hypot(prev.x-p.x,prev.z-p.z))nearestStock.set(s.model,s);}
    const sale = [...nearestStock.values()].map((s) => ({ title: s.label, price: naira(s.price), status: s.lotName, where: where(s.desk?.x??s.x, s.desk?.z??s.z), place: this.placeName(s.x, s.z, this.streetName(s.x, s.z)),
      go: () => show({ x: s.desk?.x??s.x, z: s.desk?.z??s.z, name: `${s.label} (${s.lotName})`, radius: 6 }) }));
    const mine = V.list.map(v=>{const home=H.get(v.garageHomeId),loc=v.garaged?(this.garage.site(home??homeForResume(H))??home?.door.stand??v):v;return({ title: `Your ${v.model === 'keke' ? 'keke' : this.vehicles.sys.model(v).label.toLowerCase()}`, price: `${v.fuel.toFixed(1)} L fuel`, status: v.garaged?'Stored safely in home garage':'Parked outside', where: where(loc.x,loc.z), place: v.garaged?home?.label:this.placeName(v.x,v.z,this.streetName(v.x,v.z)),
      go: () => show({ x:loc.x,z:loc.z,name:v.garaged?'Your home garage':'Your vehicle',radius:5 }) });});
    this.ui.renderHomes({ homes, sale, mine, balance: this.economy.balance });
  }

  // ------------------------------------------------------------------ destinations, time skips
  setWaypoint(w) { const soon = w && this.world.playArea?.lockedAt(w.x, w.z); if (soon) { this.ui.toast(`${soon.name} · COMING SOON. You can only travel within Onitsha for now.`); return; } this.waypoint = w; this.minimap.waypoint = w ? { x: w.x, z: w.z } : null; this.minimap.waypointLabel = w?.name ?? null; this.routeKey = null; if (this.graph && this.player) { this.updateRoute(); this.updatePlaces(); } this.updateWaypoint(); }

  /** Sunday Mass at Holy Trinity Basilica: a congregation outside before and after, a choir during it. */
  setupChurch() {
    const l = this.world.landmarks.get('basilica'); if (!l) return;
    const b = this.world.map.buildings.find((x) => String(x.id) === String(l.osmBuilding) || x.name === 'Cathedral Basilica of the Most Holy Trinity');
    let cx = l.x, cz = l.z, nx = 0, nz = 1;
    if (b) { const d = doorOf(b); if (d) { cx = d.stand.x + d.nx * 4; cz = d.stand.z + d.nz * 4; nx = d.nx; nz = d.nz; } }
    this.church = { x: cx, z: cz, name: l.name };
    if (b) { const d = doorOf(b); if (d) this.npcs.churchDoor = { x: d.x - d.nx * 0.5, z: d.z - d.nz * 0.5 }; }
    const r = mulberry32(31);
    for (let i = 0; i < 16; i++) {
      // little groups facing each other in front of the doors
      const gx = cx + (r() - 0.5) * 22, gz = cz + (r() - 0.5) * 12;
      const [x, z] = this.world.findFreeSpot(gx, gz, 0.4);
      const a = r() * Math.PI * 2;
      this.npcs.addAnchored({ id: `church:${i}`, kind: 'church', role: 'churchgoer', name: ['Bro.', 'Sis.'][i % 2] + ' ' + ['Emeka', 'Ngozi', 'Obinna', 'Chioma', 'Ifeanyi', 'Adaeze', 'Uche', 'Amaka'][i % 8], x, z, nx: Math.sin(a), nz: Math.cos(a), schedule: [7.5, 12.5], gender: i % 2 ? 'female' : 'male' });
    }
    void nx; void nz;
  }

  /** How the area knows you (recomputed from relationships and the job log). */
  reputation() { return reputation(this.saveData?.relationships ?? {}, this.jobs?.state.log ?? [], this.saveData?.police); }

  // ------------------------------------------------------------------ directions
  /** Nearest named street to a point, or null. */
  streetName(x, z) { return this.world.map.nearestRoad(x, z, { named: true, maxDist: 80 })?.road.displayName ?? null; }
  /** "Old Market Road, near Main Market" — where a place is, in words people use. */
  placeName(x, z, street = null) {
    let best = null, bd = Infinity;
    for (const l of this.landmarks.list) { const d = Math.hypot(l.x - x, l.z - z); if (d < bd) { bd = d; best = l; } }
    const near = best && bd < 1200 ? `${bd < (best.radius ?? 80) ? 'at' : 'near'} ${best.name}` : null;
    return [street, near].filter(Boolean).join(', ') || null;
  }
  /** A tall light over the destination, visible from far away. */
  buildBeacon() {
    const grp = new THREE.Group(); grp.name = 'Beacon';
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.9, 60, 16, 1, true), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    beam.position.y = 30;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 32), new THREE.MeshBasicMaterial({ color: '#ffd166', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.55), new THREE.MeshBasicMaterial({ color: '#ffd166' }));
    gem.position.y = 3.2;
    grp.add(beam, ring, gem); grp.visible = false; grp.renderOrder = 3;
    this.beacon = { grp, gem, ring };
    this.renderer.scene.add(grp);
  }

  /** Where the directions lead: your map marker, else the tracked job's next stop. */
  destination() {
    if (this.waypoint) return { x: this.waypoint.x, z: this.waypoint.z, name: this.waypoint.name };
    const mission=this.missions?.target();
    if(mission)return {x:mission.x,z:mission.z,name:mission.name};
    const career=this.story?.s?.contract?.target;
    if(career)return {...career};
    const t = this.jobs?.target();
    return t ? { x: t.x, z: t.z, name: t.name } : null;
  }

  /** Recompute the street route to the destination now and then (walking, or driving when in your vehicle). */
  updateRoute() {
    const dest = this.destination();
    const riding = !!this.transport?.riding, inside = !!(this.homes?.inside||this.civic?.inside||this.club?.inside||this.story?.inside), drv = this.vehicles?.driving;
    if (!dest || riding || inside) { this.route = null; this.minimap.route = null; return; }
    const from = drv ? { x: drv.x, z: drv.z } : { x: this.player.position.x, z: this.player.position.z };
    const key = `${Math.round(dest.x)},${Math.round(dest.z)},${drv ? 'd' : 'w'}`;
    const now = performance.now();
    const moved = this.route ? Math.hypot(from.x - this.route.from.x, from.z - this.route.from.z) : Infinity;
    if (this.routeKey === key && moved < 18 && now - this.routeAt < 4000) return;
    this.routeKey = key; this.routeAt = now;
    const plan = Math.hypot(dest.x - from.x, dest.z - from.z) < 25 ? null : planDrive(this.graph, from, dest, { walk: !drv });
    const points = plan?.points ?? [[from.x, from.z], [dest.x, dest.z]];
    this.route = { from, points, metres: plan?.metres ?? Math.hypot(dest.x - from.x, dest.z - from.z) };
    this.minimap.route = points;
  }

  /** The way to go from here: angle of the next stretch of the route relative to the camera (0 = straight ahead). */
  directionAngle() {
    const r = this.route; if (!r) return null;
    const f = this.vehicles?.driving ?? this.player.position;
    const pts = r.points;
    // nearest point on the route, then look ~22 m further along it
    let bi = 0, bd = Infinity;
    for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - f.x, pts[i][1] - f.z); if (d < bd) { bd = d; bi = i; } }
    let tx = pts[pts.length - 1][0], tz = pts[pts.length - 1][1], acc = 0;
    for (let i = bi; i < pts.length - 1; i++) {
      acc += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      if (acc > 22) { tx = pts[i + 1][0]; tz = pts[i + 1][1]; break; }
    }
    const dx = tx - f.x, dz = tz - f.z;
    const { fx, fz, rx, rz } = this.cameraRig.basis();
    return Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  }

  updateBeacon(dt) {
    const b = this.beacon; if (!b) return;
    const dest = this.destination();
    const show = !!dest && !this.homes?.inside && this.state !== 'menu';
    b.grp.visible = show;
    if (!show) return;
    b.grp.position.set(dest.x, 0, dest.z);
    b.gem.rotation.y += dt * 1.6; b.gem.position.y = 3.2 + Math.sin(performance.now() / 400) * 0.25;
  }

  /** Homes to let, vehicles for sale and yours, for the maps (with names and streets). */
  updatePlaces() {
    if (!this.homes?.housing || !this.vehicles?.sys) return;
    const H = this.homes.housing, out = [];
    for (const h of this.homes.listings) {
      const st = H.status(h.id);
      out.push({ x: h.door.stand.x, z: h.door.stand.z, kind: st === 'vacant' ? 'home' : 'home-mine',
        label: `${st === 'vacant' ? 'To let' : st === 'due' ? 'Rent due' : 'Your home'}: ${h.label}${h.street ? ', ' + h.street : ''}` });
    }
    for (const v of this.homes.visits?.values() ?? []) out.push({ x: v.home.door.stand.x, z: v.home.door.stand.z, kind: 'friend', label: `${v.home.label}${v.home.street ? ', ' + v.home.street : ''}` });
    for (const lot of this.vehicles.dealerships) out.push({ x:lot.desk.x,z:lot.desk.z,kind:'car',label:lot.name });
    for(const [id,site] of this.garage?.sites??[])if(site)out.push({x:site.x,z:site.z,kind:'car-mine',label:'Secure home garage'});
    for (const v of this.vehicles.sys.list.filter(v=>!v.garaged)) out.push({ x: v.x, z: v.z, kind: 'car-mine', label: `Your ${this.vehicles.sys.model(v).label.toLowerCase()}` });
    for(const l of this.world.markets?.districts??[]){const s=l.stalls[0];if(s)out.push({x:s.x+Math.sin(s.yaw)*3.3,z:s.z+Math.cos(s.yaw)*3.3,kind:'market',label:this.world.landmarks.get(l.id).name});}
    for(const p of this.world.monuments?.places??[])out.push({...p,label:p.name});
    for(const p of this.world.riverfront?.places??[])out.push({x:p.x,z:p.z,kind:'waterfront',label:p.name});
    for (const v of this.cityLife?.venues ?? []) out.push({x:v.x,z:v.z,kind:'venue',label:v.name});
    out.push(...(this.cityLife?.places()??[]));
    out.push(...(this.story?.places()??[]),...(this.retail?.places()??[]),...(this.activityPlaces??[]).flatMap(p=>p.places?.()??[]));
    for(const w of this.world.graWelcome?.gates??[])out.push({x:w.x,z:w.z,kind:'landmark',label:`Welcome to ${w.name}${w.road?` · ${w.road}`:''}`});
    for(const e of this.world.comingSoon?.edges??[])out.push({x:e.x,z:e.z,kind:'soon',label:`${e.name==='Beyond Onitsha'?'Onitsha ends':'Towards '+e.name} · COMING SOON`});
    for(const t of this.jobs?.targets()??[])out.push({x:t.x,z:t.z,kind:'job',id:t.job.id,label:`DELIVERY JOB · ${t.label} · ${t.name}`});
    this.minimap.places = out;
    if(this.state==='map')this.ui.setMapPlaces(out,place=>{this.setWaypoint({...place,name:place.label,radius:5,custom:true});this.minimap.openBig(this.worldFocus().x,this.worldFocus().z,this.player.heading,place);});
  }

  /** Where "skip drive" goes: your map marker, else the tracked job's next stop. */
  skipDestination() {
    if (this.waypoint) return { x: this.waypoint.x, z: this.waypoint.z, name: this.waypoint.name };
    const career=this.story?.s?.contract?.target;
    if(career)return {...career};
    const t = this.jobs?.target();
    return t ? { x: t.x, z: t.z, name: t.name } : null;
  }

  /** Jobs that would run past their deadline if `minutes` went by now: a warning line, or null. */
  deadlineNote(minutes) {
    const end = this.nowAbs() + (this.clock.mode==='real'?0:minutes);
    const late = this.jobs.list.filter((j) => Number.isFinite(j.deadline) && j.deadline < end);
    if (!late.length) return null;
    return `Careful: ${late.map((j) => `“${j.title}” is due by ${clockLabel(j.deadline)}`).join('; ')} — you would miss ${late.length > 1 ? 'them' : 'it'}.`;
  }

  /** Jump the clock: sleeping, resting, cooking, skipping a ride or a drive. Everything time-based follows. */
  skipTime(minutes, { riding = false, sleeping = false, resting = 0 } = {}) {
    minutes = Math.max(0, Math.round(minutes));
    // Account for power in short clock slices, including midnight and weather changes.
    for (let left = this.clock.mode==='real'?0:minutes; left > 0;) { const step = Math.min(10, left); this.homeUpgrades?.advance(step, this.weather?.power.on ?? true, this.clock.hour >= 7 && this.clock.hour < 18); this.clock.advance(step); this.weather?.sample(); left -= step; }
    this.lastPowerAbs = this.nowAbs();
    if(this.clock.mode!=='real'){this.traffic.fastForward(minutes);this.npcs.fastForward(minutes,this.dialogue?.npc??null);}
    this.needs.update(minutes, { riding });
    if (sleeping) { this.needs.state.energy = 100; this.needs.warned = false; }
    else {
      if (resting) this.needs.state.energy = Math.min(100, this.needs.state.energy + resting);
    }
    this.jobs.update(this.nowAbs());
    this.weather?.sample(); if (this.weather) { this.atmosphere.weather = this.weather.w; this.atmosphere.power = this.weather.power.on; }
    this.atmosphere.update(this.clock.minutes);
    this.ui.setEnergy(this.needs.energy, this.needs.label());
    this.ui.setNeeds(this.needs.values); this.cityHud?.update();
    this.hudTimer = 0;
  }

  confirmSkipRide() {
    const info = this.transport.skipInfo();
    if (!info) { this.ui.toast(this.transport.riding?.state === 'boarded' ? 'Wait until the vehicle moves off' : 'Nearly there already'); return; }
    this.openChoice(() => ({
      title: `Skip to ${info.dest}`, text: `About ${(info.metres / 1000).toFixed(1)} km more on this line — roughly ${durationLabel(info.minutes)} of game time. You rest on the way.`,
      note: this.deadlineNote(info.minutes),
      options: [
        { label: `Skip ride (${durationLabel(info.minutes)})`, primary: true, act: () => { this.closeChoice(); this.ui.fade(() => this.transport.skipRide()); } },
        { label: 'Keep riding', ghost: true, act: () => this.closeChoice() },
      ],
    }));
  }

  confirmSkipDrive() {
    const info = this.vehicles.planSkip();
    if (!info || info.error) {
      this.ui.toast(!info ? 'You are not driving' : info.error === 'no-destination' ? 'Mark a place on the map (M, then tap) or follow a job first' : info.error === 'on-bridge' ? 'Drive off the bridge first' : info.error === 'too-close' ? `You are nearly at ${info.dest.name}` : 'No road route to there');
      return;
    }
    this.openChoice(() => ({
      title: `Skip drive to ${info.dest.name}`, text: `About ${(info.plan.metres / 1000).toFixed(1)} km by road — roughly ${durationLabel(info.minutes)} of game time and ${info.litres.toFixed(1)} L of fuel (you have ${this.vehicles.driving.fuel.toFixed(1)} L).`,
      note: info.ok ? this.deadlineNote(info.minutes) : 'Not enough fuel for that distance — fill up first.',
      options: [
        { label: `Skip drive (${durationLabel(info.minutes)})`, primary: true, disabled: !info.ok, why: 'Not enough fuel', act: () => { this.closeChoice(); this.ui.fade(() => this.vehicles.doSkip(info)); } },
        { label: 'Keep driving', ghost: true, act: () => this.closeChoice() },
      ],
    }));
  }
  renderBag(msg = null) {
    const items = this.inventory.items.map((it) => {
      const info = it.kind === 'package' ? { verb: null } : Needs.useInfo(it.id);
      return { ...it, verb: info.verb, why: info.why, energy: info.energy };
    });
    this.ui.renderBag({ balance: this.economy.balance, items, slots: this.inventory.state.slots, ledger: this.saveData.wallet.ledger, energy: this.needs.energy, energyLabel: this.needs.label(), msg }, {
      use: (id) => {
        const r = this.needs.use(this.inventory, id);
        const m = r.ok ? (r.opened ? `Opened: ${r.qty} × ${r.into.name}` : `${r.verb === 'Drink' ? 'Drank' : 'Ate'} ${r.item.name} · +${r.gained} energy`)
          : r.error === 'full' ? 'You are already full.' : r.error === 'bag-full' ? 'No room in your bag to open it.' : r.why ?? 'You can’t use that.';
        this.ui.setEnergy(this.needs.energy, this.needs.label());
    this.ui.setNeeds(this.needs.values); this.cityHud?.update();
        this.renderBag(m);
      },
    });
  }
  renderStop() {
    const ctx = this.stopCtx;
    if (ctx.vehicle && !(ctx.vehicle.transit.dwell > 0)) { this.closeOverlay('stop'); this.ui.toast('The driver don move'); return; }
    const view = this.transport.pickerView(ctx);
    this.ui.renderStop(view, (entryId) => {
      const ok = this.transport.choose(view, entryId, ctx);
      if (ok) this.closeOverlay('stop');
    });
  }
  renderJobs() {
    const p = this.player.position, now = this.nowAbs();
    const jobs = this.jobs.list.map((j) => {
      const t = this.jobs.target(j.id);
      return { id: j.id, title: j.title, steps: j.steps, step: j.step, reward: j.reward, tracked: !this.jobs.state.missions.tracked && j.id === this.jobs.state.tracked,
        due: Number.isFinite(j.deadline) ? `Due by ${clockLabel(j.deadline)} · ${durationLabel(j.deadline - now)} left` : 'No time limit',
        late: Number.isFinite(j.deadline) && j.deadline - now < 20,
        where: t ? `${t.name} is about ${Math.round(Math.hypot(t.x - p.x, t.z - p.z) / 10) * 10} m ${compass(p.x, p.z, t.x, t.z)} of you` : null };
    });
    this.ui.renderJobs({ jobs, max: 3, log: this.jobs.state.log, missions: this.missions?.journal() ?? [] }, {
      trackMission: (id) => { this.missions.track(id); this.renderJobs(); },
      track: (id) => { this.jobs.state.missions.tracked=null; this.jobs.track(id); this.saveGame(); this.updateWaypoint(); this.renderJobs(); },
      abandon: async (id) => {
        const ok = await this.ui.confirm('Abandon this job?', 'Any parcel for this job is handed back. You will not be paid.', 'Abandon');
        if (ok) { this.jobs.abandon(id); this.npcs.priorityId = null; this.minimap.waypoint = null; this.ui.toast('Job abandoned'); this.saveGame(); }
        this.renderJobs();
      },
    });
  }
  closeOverlay(which = this.overlay) {
    if (this.state !== 'overlay') return;
    if(this.overlay==='buy')this.buy.leave();
    this.ui.show(which, false);
    if (this.overlayReturn === 'paused') { this.setState('paused'); this.ui.show('pause'); } else this.resume();
  }

  updateWaypoint() {
    // Explicit mission tracking reuses the existing objective chip, route, beacon and minimap.
    const mission = this.missions?.target();
    const t = mission ?? this.jobs?.target();
    const markers = [];
    for (const o of this.jobs?.targets() ?? []) if (!t || o.job.id !== t.job.id) markers.push({ x: o.x, z: o.z, color: '#9ad1ff' });
    const tm = this.transport?.marker(); if (tm) markers.push(tm);
    if (t && this.waypoint) markers.push({ x: t.x, z: t.z, color: '#ffd166' }); // your own marker leads; the job shows as a dot
    this.minimap.markers = markers;
    if (t) {
      const p = this.player.position, d = Math.hypot(t.x - p.x, t.z - p.z);
      const dist = d < 950 ? `${Math.round(d / 10) * 10} m` : `${(d / 1000).toFixed(1)} km`;
      const h = this.clock.minutes / 60, hrs = hoursFor(t.resident, weekdayOf(this.clock.day));
      const o = hrs?.[0] ?? 0, c = hrs?.[1] ?? 0;
      const closed = !hrs ? ' · closed today' : h < o ? ` · opens ${String(Math.floor(o)).padStart(2, '0')}:${o % 1 ? '30' : '00'}` : h >= c ? ' · closed for today' : '';
      const left = Number.isFinite(t.job.deadline) ? ` · ${durationLabel(t.job.deadline - this.nowAbs())} left` : '';
      const more = this.jobs.list.length > 1 ? ` (+${this.jobs.list.length - 1})` : '';
      this.ui.setJobChip(`${t.label} · ${dist} ${compass(p.x, p.z, t.x, t.z)}${closed}${left}${more}`, Number.isFinite(t.job.deadline) && t.job.deadline - this.nowAbs() < 20);
      this.minimap.waypoint = this.waypoint ? { x: this.waypoint.x, z: this.waypoint.z } : { x: t.x, z: t.z };
      this.npcs.priorityId = t.resident.id;
    } else { this.npcs.priorityId=null; this.ui.setJobChip(null); if (!this.waypoint) this.minimap.waypoint = null; }
    if(!this.waypoint&&!mission&&this.story?.s?.contract)this.minimap.waypoint={...this.story.s.contract.target};
    const w = this.waypoint;
    if (!w) { this.ui.setWaypoint(null); return; }
    const inside = this.homes?.inside;
    if (inside) {
      // you went into the very house you were heading for
      if (Math.hypot(inside.home.door.stand.x - w.x, inside.home.door.stand.z - w.z) < 8) { this.setWaypoint(null); return; }
      this.ui.setWaypoint(null); return;
    }
    const p = this.player.position, d = Math.hypot(w.x - p.x, w.z - p.z);
    if (!w.kekeDrop && d < Math.max(3, (w.radius ?? 60) * 0.5)) { this.ui.toast(`You have reached ${w.name}`); this.setWaypoint(null); return; }
    const rd = this.route?.metres ?? d;
    const dist = rd < 950 ? `${Math.round(rd / 10) * 10} m` : `${(rd / 1000).toFixed(1)} km`;
    this.ui.setWaypoint(`${w.name} · ${dist}${this.route ? ' by road' : ''} ${compass(p.x, p.z, w.x, w.z)}`);
  }
}
