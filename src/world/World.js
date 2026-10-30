import {planBillboardSites} from './BillboardSites.js';
import { mergeStatic } from '../render/MergeStatic.js';
import {findStadiumSite} from './ExpansionSites.js';
import {CityStadium} from './CityStadium.js';
import {StreetLighting} from './StreetLighting.js';
import {loadModelLibrary} from '../render/ModelLibrary.js';
import {loadFurnitureLibrary} from '../buy/FurnitureLibrary.js';
import {CityMonuments,prepareMonumentSites} from './CityMonuments.js';
import {LEGACY_HOMES} from '../data/legacyHomes.js';
import { PlayArea } from './PlayArea.js';
import { Districts, parsePreview } from './Districts.js';
import {doorOf} from '../housing/HousingSystem.js';
import {rect} from './StreetLayout.js';
import {segDistSq} from '../core/utils.js';
import * as THREE from 'three';
import { VergeGrass } from '../render/VergeGrass.js';
import { buildMallPrecinct } from './MallPrecinct.js';
import { CONFIG } from '../config.js';
import { MapData } from './MapData.js';
import { CollisionWorld } from '../physics/CollisionWorld.js';
import { buildRoads } from './RoadBuilder.js';
import { paveGRARoads, buildGRAGround } from './GRAGround.js';
import { City } from './City.js';
import { buildProps } from './PropBuilder.js';
import { buildTerrain } from './Terrain.js';
import { markElevated, buildBridges } from './Bridges.js';
import { addRoadFlyovers, planWalkways, buildWalkwayGeometry } from './Flyovers.js';
import { Walkways } from './Walkways.js';
import { Landmarks } from './Landmarks.js';
import { buildLandmarkDressing } from './LandmarkDressing.js';
import { planCivicSites, buildCivicSites } from './CivicSites.js';
import * as WT from '../render/WorldTextures.js';
import { repairStreetLayout, alignBuildingFronts } from './StreetLayout.js';
import {Riverfront} from './Riverfront.js';
import { MarketDistricts } from './MarketDistricts.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const FACADE_SCALE = { low: 1, medium: 1.5, high: 2 };

/**
 * The city: terrain + river, roads, bridges, the streamed buildings, landmarks and props,
 * all generated from the OSM extract of Onitsha (Main Market → Upper Iweka, Bridgehead → ShopRite).
 */
function mergeProps(a, b) {
  const group = new THREE.Group(); group.name = 'Props';
  group.add(a.group, b.group);
  const stats = { ...a.stats }; for (const [k, v] of Object.entries(b.stats)) stats[k] = (stats[k] ?? 0) + v;
  return {
    group, treeSites:[...(a.treeSites??a.group.userData.treeSites??[]),...(b.treeSites??b.group.userData.treeSites??[])], utilityPoles:[...(a.utilityPoles??a.group.userData.utilityPoles??[]),...(b.utilityPoles??b.group.userData.utilityPoles??[])], stats, nightMaterials: [...a.nightMaterials, ...b.nightMaterials],
    stallSpots: [...a.stallSpots, ...b.stallSpots], kekeSpots: [...a.kekeSpots, ...b.kekeSpots], parked: [...a.parked, ...b.parked],
    update: (x, z, r) => { a.update(x, z, r); b.update(x, z, r); },
  };
}

export class World {
  static async create(renderer, { onProgress = () => {}, quality = 'medium', focus = null } = {}) {
    const w = new World();
    w.quality = quality;
    onProgress(0.04, 'Loading the Onitsha map');
    w.map = await MapData.load(import.meta.env.BASE_URL + CONFIG.mapUrl);
    w.landmarks = new Landmarks(w.map);
    onProgress(.07,'Loading character and vehicle models');
    // Furniture models (Kenney Furniture Kit, CC0) load alongside the city build; awaited before the world is ready.
    const furnitureReady=loadFurnitureLibrary();
    await loadModelLibrary(p=>onProgress(.07+p*.04,`Loading supplied models · ${Math.round(p*100)}%`));
    prepareMonumentSites(w.map,w.landmarks);
    await nextFrame();

    onProgress(0.12, 'Painting textures');
    const maxAniso = renderer.renderer.capabilities.getMaxAnisotropy();
    w.tex = {
      asphalt: WT.asphaltTexture(), dirtRoad: WT.lateriteTexture(true), ground: WT.lateriteTexture(false),
      concrete: WT.concreteTexture(), facade: WT.facadeAtlas(FACADE_SCALE[quality] ?? 1), roof: WT.roofAtlas(), signs: WT.signAtlas(),
      umbrella: WT.umbrellaTexture(), billboards: WT.billboardAtlas(), waterNormal: WT.waterNormalTexture(),
    };
    w.tex.facadeGlow = WT.facadeAtlas.emissive;
    Object.values(w.tex).forEach((t) => (t.anisotropy = Math.min(8, maxAniso)));
    await nextFrame();

    w.collision = new CollisionWorld(8);
    w.collision.setBounds(w.map.bounds);
    // v0.48: Onitsha only. West of the middle of the Niger (the Asaba bank and the Delta island) is COMING SOON.
    w.playArea = w.map.playArea = new PlayArea(w.map);
    // switched on by Game once everything is placed (so nothing already built moves): activateLock()
    w.activateLock = (graph) => { w.playArea.active = true; graph?.setLock((x, z) => w.playArea.locked(x, z)); };
    w.root = new THREE.Group(); w.root.name = 'World';

    onProgress(0.2, 'River Niger and the ground');
    w.terrain = buildTerrain(w.map, w.tex, w.collision);
    w.root.add(w.terrain.group);
    w.roadFlyovers = addRoadFlyovers(w.map, w.landmarks); // v0.39: invented flyovers over junctions near Upper Iweka
    markElevated(w.map, w.terrain.isWater);
    await nextFrame();

    onProgress(0.28, 'Roads — Old Market Rd, New Market Rd, Iweka Rd…');
    // Build road edges after saved-home access corridors are known.
    await nextFrame();

    onProgress(0.36, `Surveying ${w.map.buildings.length.toLocaleString()} buildings`);
    repairStreetLayout(w.map);
    w.map.frontsAligned=alignBuildingFronts(w.map,new Set(LEGACY_HOMES.map(h=>h.buildingId)));
    // Keep existing rental IDs, floor plans, storage and paid furniture intact.
    w.map.legacyListings=LEGACY_HOMES;
    w.map.stadiumSite=findStadiumSite(w.map,w.landmarks.get('shoprite'));
    const access=[];const accessPolys=[];
    for(const home of LEGACY_HOMES){const b=w.map.buildings.find(b=>b.id===home.buildingId),d=b&&doorOf(b);if(!d)continue;const nr=w.map.nearestRoad(d.stand.x,d.stand.z,{maxDist:26}),L=Math.min(26,(nr?.dist??8)+1.5),a=[d.stand.x,d.stand.z],end=[a[0]+d.nx*L,a[1]+d.nz*L];access.push({a,b:end});accessPolys.push(w.collision.addPolygon(rect((a[0]+end[0])/2,(a[1]+end[1])/2,2.2,L+1,Math.atan2(d.nx,d.nz)),.01));}
    accessPolys.push(w.collision.addPolygon(w.map.stadiumSite.pts,.01));
    w.map.homeAccessCorridors=access;
    {const AG=new Map(),AC=24;for(const s of access){const x0=Math.floor((Math.min(s.a[0],s.b[0])-3)/AC),x1=Math.floor((Math.max(s.a[0],s.b[0])+3)/AC),z0=Math.floor((Math.min(s.a[1],s.b[1])-3)/AC),z1=Math.floor((Math.max(s.a[1],s.b[1])+3)/AC);for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){const k=i+','+j;(AG.get(k)??AG.set(k,[]).get(k)).push(s);}}
    // v0.54.2: only the corridors near the point (same answer; r stays small, under 3 m)
    w.map.inHomeAccess=(x,z,r=0)=>{if(r>2.9)return access.some(s=>segDistSq(x,z,...s.a,...s.b)<(1.15+r)**2);const l=AG.get(Math.floor(x/AC)+','+Math.floor(z/AC));return!!l&&l.some(s=>segDistSq(x,z,...s.a,...s.b)<(1.15+r)**2);};}
    planCivicSites(w); // v0.46: plots for the cathedrals, the palace, CKC and Shanahan University, before anything else is placed
    w.map.billboardSites=planBillboardSites(w.map,w.landmarks);
    // Keep the full sign envelopes reserved through dealership / venue / infill setup.
    w.billboardReservations=w.map.billboardSites.map(site=>w.collision.addPolygon(site.pts,.01));
    for(const site of Object.values(w.map.monumentSites))w.collision.addCircle(site.x,site.z,site.r+.15);
    w.city = new City({ map: w.map, tex: w.tex, collision: w.collision, landmarks: w.landmarks, quality });
    w.districts = w.city.districts = new Districts({ map: w.map, landmarks: w.landmarks, preview: parsePreview(globalThis.location?.search) }); // v0.48 neighbourhoods
    // v0.52: GRA: tarred roads and concrete ground
    w.graPavedRoads = paveGRARoads(w.map, w.districts);
    w.graGround = buildGRAGround(w.districts, WT.graConcreteTexture()); w.root.add(w.graGround.group);
    w.roads=buildRoads(w.map,w.tex);w.root.add(w.roads);
    w.city.prepare();
    w.root.add(w.city.group);
    await nextFrame();

    onProgress(0.5, 'Niger Bridge and the Upper Iweka flyover');
    const walkPlan = planWalkways(w.map, w.collision, w.terrain.isWater, w.landmarks); // stairs + footbridges (before decks are drawn: parapet openings)
    w.bridges = buildBridges(w.map, w.tex, w.collision, w.terrain.isWater);
    w.root.add(w.bridges.group);
    w.root.add(buildWalkwayGeometry(walkPlan, w.tex, w.collision));
    w.walkways = new Walkways(w.map);
    w.flyovers = { plan: walkPlan, stairs: walkPlan.stairs, footbridges: walkPlan.footbridges, roads: w.roadFlyovers, stats: () => ({ stairs: walkPlan.stairs.length, footbridges: walkPlan.footbridges.length, newFlyovers: w.roadFlyovers.length, names: w.roadFlyovers.map((f) => f.road.name), surfaces: w.walkways.count }) };
    w.dressing = buildLandmarkDressing(w.map, w.landmarks, w.collision);
    w.root.add(w.dressing.group);
    w.root.add(buildMallPrecinct(w.map, w.collision));
    await nextFrame();

    onProgress(0.58, 'Market stalls, poles and keke');
    const propOpts = { density: CONFIG.quality[quality]?.props ?? 1, umbrellaTex: w.tex.umbrella, landmarks: w.landmarks, spawn: focus };
    const oldProps = buildProps(w.map, w.collision, propOpts);
    // then the area added in Milestone 6 (Asaba bank, south of Bridgehead): after the old area, so its ids stay stable
    w.city.prepare({ extra: true });
    const newProps = buildProps(w.map, w.collision, { ...propOpts, extra: true });
    w.props = mergeProps(oldProps, newProps);
    // v0.48: the area added by the map extension (GRA, the east), after everything of the earlier map
    if (w.map.meta.extensions?.length) { w.collision.tag = 2; w.city.prepare({ ext: true }); w.props = mergeProps(w.props, buildProps(w.map, w.collision, { ...propOpts, ext: true })); w.collision.tag = 0; }
    // things that ended up standing on a road: take their colliders out now that everything is placed
    for (const o of [...w.props.stallSpots, ...w.props.kekeSpots, ...w.props.parked]) if (o.hidden) for (const ci of [].concat(o.ci)) w.collision.removeCircle(ci);
    w.city.clearRoadKiosks();
    // Retire the generic kiosk models inside the rebuilt trading districts.
    for(const ch of w.city.chunks.values())ch.kiosks=ch.kiosks.filter(k=>{
      if(!w.landmarks.list.some(l=>['market','bridgehead'].includes(l.kind)&&Math.hypot(k.x-l.x,k.z-l.z)<l.radius))return true;
      w.collision.removePolygon(k.poly);if(k.gen)w.collision.removeCircle(k.gen.ci);return false;
    });
    w.root.add(w.props.group);
    w.riverfront=new Riverfront(w);
    w.root.add(w.riverfront.group);
    w.markets = new MarketDistricts(w);
    w.root.add(w.markets.group);
    w.monuments=new CityMonuments(w);
    w.monuments.mergeStats=mergeStatic(w.monuments.group);
    w.root.add(w.monuments.group);
    for(const pi of accessPolys)w.collision.removePolygon(pi);
    await nextFrame();

    w.stadium=new CityStadium(w);w.root.add(w.stadium.group);
    w.streetLighting=new StreetLighting(w);w.root.add(w.streetLighting.group);
    buildCivicSites(w);
    renderer.scene.add(w.root);
    w.grass = new VergeGrass(w);
    w.stats = { ...w.city.stats, ...w.props.stats, roads: w.map.roads.length, bridges: w.bridges.count, buses: w.dressing.group.userData.buses ?? 0 };
    console.info('[World] prepared', w.stats);
    await furnitureReady;
    return w;
  }

  /** Synchronously build the chunks around a point (used while the loading screen is up). */
  async warmUp(x, z, onProgress) {
    const r = this.loadRadius;
    this.city._lodFocus={x,z};this.city._lodQuality=null;
    const keys = this.city.keysWithin(x, z, r);
    for (let i = 0; i < keys.length; i++) {
      const ch = this.city.chunks.get(keys[i]);
      if (!ch.group) { const g = this.city.buildChunk(ch); while (!g.next().done); }
      onProgress?.((i + 1) / keys.length);
      if (i % 3 === 2) await nextFrame();
    }
    this.city.update(x,z,r,0);
  }

  get loadRadius() { return (CONFIG.quality[this.quality]?.drawDistance ?? 420) + 60; }

  setQuality(q) { this.quality = q; if(this.city)this.city.quality=q; }

  update(dt, focus) {
    this.terrain.update(dt);this.stadium?.update(focus);this.infill?.update(focus);this.districtDressing?.userData.update?.(focus,{low:450,medium:650,high:850}[this.quality]??650);
    this.riverfront?.update(dt);
    this.markets?.update(dt, focus);
    this.city.update(focus.x, focus.z, this.loadRadius, 4);
    this.props.update(focus.x, focus.z, this.loadRadius - 60);
  }

  get nightMaterials() {
    const m = this.city.materials;
    return [{ mat: m.sign, max: 0.6 }, { mat: m.wall, max: 0.55 }, { mat: m.board, max: 0.8 },
      ...this.props.nightMaterials, ...(this.dressing.group.userData.nightMaterials ?? []), ...(this.monuments?.nightMaterials ?? [])];
  }

  findFreeSpot(x, z, r = 0.4) {
    if (this.collision.isFree(x, z, r)) return [x, z];
    for (let rad = 1; rad < 40; rad += 1) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad;
      if (this.collision.isFree(px, pz, r)) return [px, pz];
    }
    return [x, z];
  }

  /** HUD location: {place, street}. place = most specific landmark, street = nearest named road. */
  location(x, z) {
    const lm = this.landmarks.at(x, z);
    const named = this.map.nearestRoad(x, z, { named: true, maxDist: 45 });
    let street = 'Inside the block';
    const any = this.map.nearestRoad(x, z, { maxDist: 12 });
    const onRoad = any && any.dist < any.road.width / 2 + 3;
    if (named && named.dist < named.road.width / 2 + 3) street = named.road.displayName;
    else if (onRoad && !any.road.name) street = { trunk: 'Expressway', trunk_link: 'Expressway ramp', primary: 'Main road', secondary: 'Main road' }[any.road.type] ?? 'Street';
    else if (named) street = `Near ${named.road.displayName}`;
    return { place: lm?.name ?? null, street, landmark: lm };
  }

  locationLabel(x, z) { const l = this.location(x, z); return l.place ? `${l.place} · ${l.street}` : l.street; }
}
