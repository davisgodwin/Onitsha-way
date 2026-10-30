import * as THREE from 'three';
import { frontageCandidates, rect, roadConflict } from './StreetLayout.js';
import { polysOverlap } from './ExpansionSites.js';
import { gateSignTexture } from '../render/WorldTextures.js';

export const PLACE_SIGN_SIZE = Object.freeze({ width: 10, depth: 1.8, height: 6.3 });

/** Validate the whole sign envelope, not just its posts, against the finished city. */
export function clearPlaceSign(world, site, { reserved = [], residents = [] } = {}) {
  const map=world.map, pts=site.pts??rect(site.x,site.z,11.4,2.2,site.yaw), b=map.bounds;
  if(pts.some(([x,z])=>x<b.minX+1||x>b.maxX-1||z<b.minZ+1||z>b.maxZ-1)||roadConflict(map,pts,1.3))return false;
  if(reserved.some(q=>polysOverlap(pts,q.pts)))return false;
  if(map.stadiumSite&&polysOverlap(pts,map.stadiumSite.pts))return false;
  if((world.pavedForecourts??[]).some(p=>polysOverlap(pts,rect(p.x,p.z,36,28,p.heading))))return false;
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);
  for(const p of world.collision.polys){if(p.height<=0||p.maxX<minX||p.minX>maxX||p.maxZ<minZ||p.minZ>maxZ)continue;if(polysOverlap(pts,p.pts))return false;}
  const nearResidents=residents.filter(r=>r.x>=minX-2.8&&r.x<=maxX+2.8&&r.z>=minZ-2.8&&r.z<=maxZ+2.8);
  for(let x=-5.7;x<=5.71;x+=.95)for(let z=-1.1;z<=1.11;z+=.55){
    const px=site.x+Math.cos(site.yaw)*x+Math.sin(site.yaw)*z,pz=site.z-Math.sin(site.yaw)*x+Math.cos(site.yaw)*z;
    if(!world.collision.isFree(px,pz,.5)||world.terrain.isWater(px,pz)||map.inHomeAccess?.(px,pz,1.5))return false;
    if(nearResidents.some(r=>Math.hypot(r.x-px,r.z-pz)<2.8))return false;
  }
  return true;
}

export function findPlaceSignSite(world, anchor, options = {}) {
  for(const range of [120,260,420]){
    const candidates=frontageCandidates(world.map,anchor,{w:11.4,d:2.2,maxDistance:range});
    candidates.sort((a,b)=>a.dist-b.dist);
    for(const p of candidates)if(clearPlaceSign(world,p,options))return p;
  }
  return null; // Never force a sign into a building, doorway or road.
}

/** Shared Upper Iweka-inspired cream pillars, green fascia and gold cap/trim. */
export function buildPlaceNameStand(name) {
  const group=new THREE.Group();group.name='PlaceNameStand';group.userData.name=name;
  const stone=new THREE.MeshStandardMaterial({color:'#f1ead8',roughness:.85}),green=new THREE.MeshStandardMaterial({color:'#0f5132',roughness:.7}),gold=new THREE.MeshStandardMaterial({color:'#d4a017',roughness:.45,metalness:.4});
  const box=(w,h,d,x,y,z,mat)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);};
  for(const x of [-5,5]){box(1.2,.35,1.2,x,.175,0,green);box(.55,5.7,.55,x,3.1,0,stone);box(.8,.3,.8,x,6.05,0,gold);}
  box(10.6,.22,.5,0,5.7,0,gold);box(10.5,.22,.5,0,3.65,0,green);box(10,1.9,.28,0,4.67,0,green);
  const texture=gateSignTexture(name.toUpperCase(),''),material=new THREE.MeshStandardMaterial({map:texture,roughness:.65,emissive:'#ffffff',emissiveMap:texture,emissiveIntensity:.22});
  // Separate front/back planes keep lettering readable, never mirrored on the reverse.
  for(const side of [-1,1]){const face=new THREE.Mesh(new THREE.PlaneGeometry(9.8,1.84),material);face.position.set(0,4.67,side*.15);face.rotation.y=side<0?Math.PI:0;group.add(face);}
  return group;
}

export class PlaceNameSigns {
  constructor(game) {
    const w=game.world;this.group=new THREE.Group();this.group.name='OnitshaPlaceNameStands';this.records=[];this.unplaced=[];
    const covered=new Set((w.dressing?.placed??[]).map(p=>p.id));
    // Car forecourts already have freestanding street and sales signs. Their names are updated in place.
    const places=[...w.landmarks.list,...(game.cityLife?.venues??[]),...(game.story?.city?.services??[])];
    const unique=new Map(places.map(p=>[p.id,p]));
    const ordered=[...unique.values()].sort((a,b)=>(a.kind==='stadium'?-2:a.id==='shoprite'?-1:0)-(b.kind==='stadium'?-2:b.id==='shoprite'?-1:0));
    for(const p of ordered){
      if(covered.has(p.id))continue;
      const anchor=p.visitSpot??p;
      const b=w.map.bounds;if(anchor.x<b.minX||anchor.x>b.maxX||anchor.z<b.minZ||anchor.z>b.maxZ){this.unplaced.push({id:p.id,name:p.name,reason:'outside playable boundary'});continue;}
      const site=findPlaceSignSite(w,anchor,{reserved:this.records,residents:game.npcs.residents});
      if(!site){this.unplaced.push({id:p.id,name:p.name,reason:'no collision-safe roadside footprint'});continue;}
      const model=buildPlaceNameStand(p.name);model.name='place-name:'+p.id;model.position.set(site.x,0,site.z);model.rotation.y=site.yaw;this.group.add(model);
      const circles=[];for(const x of [-5,5])circles.push(w.collision.addCircle(site.x+Math.cos(site.yaw)*x,site.z-Math.sin(site.yaw)*x,.65));
      this.records.push({...site,id:p.id,name:p.name,model,circles});
    }
  }
}
