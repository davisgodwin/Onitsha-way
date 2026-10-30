import * as THREE from 'three';
import {pointInPolygon} from '../core/utils.js';
import {safePoleSite} from './UtilitySafety.js';
import {isMajorRoad} from './RoadBuilder.js';

export const LAMP_SPACING=24;
/** Arc-length samples, including short streets. No per-segment gaps at bends. */
export function roadLampSamples(road,spacing=LAMP_SPACING) {
 const pts=road.points,total=pts.slice(1).reduce((n,p,i)=>n+Math.hypot(p[0]-pts[i][0],p[1]-pts[i][1]),0);
 if(total<5)return[];
 const n=Math.max(1,Math.ceil(total/spacing)),out=[];let seg=0,acc=0;
 for(let k=0;k<n;k++) {const at=(k+.5)*total/n;while(seg<pts.length-2&&acc+Math.hypot(pts[seg+1][0]-pts[seg][0],pts[seg+1][1]-pts[seg][1])<at){acc+=Math.hypot(pts[seg+1][0]-pts[seg][0],pts[seg+1][1]-pts[seg][1]);seg++;}const a=pts[seg],b=pts[seg+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);if(l<.001)continue;const dx=(b[0]-a[0])/l,dz=(b[1]-a[1])/l;out.push({x:a[0]+dx*(at-acc),z:a[1]+dz*(at-acc),dx,dz,at});}
 return out;
}
/** Solar LED street lighting: instanced furniture and light pools, bounded local real lights.
 * Solar is deliberate: neighborhood illumination survives the existing NEPA power-cut simulation.
 */
export class StreetLighting {
 constructor(world) {
  this.world=world;this.group=new THREE.Group();this.group.name='SolarStreetLighting';this.sites=[];this.coverage=[];this.timer=0;
  const {map,collision,terrain}=world,occupied=new Set();
  const oldRoads=map.meta?.extensions?.[0]?.before?.roads??Infinity; // v0.48: lamps on roads of a map extension are tagged, so the earlier map's houses are planned as before
  for(const [ri,road] of map.roads.entries()) {
   if(['construction','proposed','steps'].includes(road.type))continue;collision.tag=ri>=oldRoads?2:0;
   const samples=roadLampSamples(road),major=isMajorRoad(road),sides=major&&road.width>=12?[-1,1]:[1];let installed=0;
   for(const [i,s]of samples.entries())for(const chosen of sides){let site=null;
    for(const side of [chosen,-chosen]) {for(const extra of [0,1.3,2.6]) {const off=road.width/2+(road.elevated?.35:1.1)+extra,x=s.x-s.dz*side*off,z=s.z+s.dx*side*off,y=road.heightAt?.(s.at)??0,key=`${Math.round(x/4)},${Math.round(z/4)}`;
     if(map.stadiumSite&&pointInPolygon(x,z,map.stadiumSite.pts)||occupied.has(key)||(!road.elevated&&!safePoleSite(map,collision,x,z,.4))||(!road.elevated&&(terrain.isWater(x,z)||map.inHomeAccess?.(x,z,.35)||map.onCarriageway(x,z,.25)||!collision.isFree(x,z,.32))))continue;
     site={x,z,y,dx:s.dx,dz:s.dz,nx:s.dz*side,nz:-s.dx*side,road:road.id};occupied.add(key);break;
    }if(site)break;}
    if(!site)continue;
    site.lx=site.x+site.nx*1.8;site.lz=site.z+site.nz*1.8;
    if(!road.elevated)collision.addCircle(site.x,site.z,.13);
    this.sites.push(site);installed++;
   }
   if(samples.length)this.coverage.push({road:road.id,samples:samples.length,installed});
  }
  collision.tag=0;
  this.build();this.pool=Array.from({length:12},()=>{const l=new THREE.PointLight('#ffdfa5',0,28,2);l.castShadow=false;this.group.add(l);return l;});
 }
 /**
  * Instanced furniture for the lamps near the camera only. The city has thousands of lamps; drawing all of
  * them every frame (4 meshes + glow pools, ~650k triangles) was the single biggest GPU cost. Sites are
  * bucketed in a 100 m grid and the instanced meshes are refilled with the lamps within `radius` of the
  * focus whenever the focus moves 20 m or the radius changes. Five draw calls, a few hundred lamps.
  */
 build() {
  const sites=this.sites,mat=new THREE.MeshStandardMaterial({color:'#59666a',metalness:.55,roughness:.62});
  const pole=new THREE.CylinderGeometry(.065,.11,7.3,6);pole.translate(0,3.65,0);
  const arm=new THREE.BoxGeometry(.1,.1,1.85);arm.translate(0,7.16,.9);
  const panel=new THREE.BoxGeometry(1.05,.07,.7);panel.translate(0,7.45,0);
  const bulb=new THREE.BoxGeometry(.4,.08,.9);bulb.translate(0,7.08,1.65);
  this.bulbMat=new THREE.MeshStandardMaterial({color:'#f1e4c9',emissive:'#ffe0a0',emissiveIntensity:0,roughness:.45});
  this.grid=new Map();for(const s of sites){const k=Math.floor(s.x/100)+','+Math.floor(s.z/100);(this.grid.get(k)??this.grid.set(k,[]).get(k)).push(s);}
  this.capacity=Math.max(1,Math.min(sites.length,2400));
  this.parts=[];
  for(const [name,geo,material]of[['poles',pole,mat],['arms',arm,mat],['solarPanels',panel,new THREE.MeshStandardMaterial({color:'#182f46',metalness:.5,roughness:.4})],['bulbs',bulb,this.bulbMat]]) {
   const mesh=new THREE.InstancedMesh(geo,material,this.capacity);mesh.name='street-'+name;mesh.count=0;this.parts.push(mesh);this.group.add(mesh);
  }
  this.glowMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{night:{value:0}},vertexShader:`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv; uniform float night; void main(){float d=length((vUv-.5)*2.);float a=pow(max(0.,1.-d),1.65)*.30*night;gl_FragColor=vec4(1.,.70,.30,a);}`});
  const geo=new THREE.PlaneGeometry(25,25);geo.rotateX(-Math.PI/2);this.pools=new THREE.InstancedMesh(geo,this.glowMat,this.capacity);this.pools.name='street-light-pools';this.pools.count=0;this.group.add(this.pools);
  this.shown=null;
 }
 /** Lamps within `radius` of (x, z), nearest first, capped at capacity. */
 near(x,z,radius) {
  const out=[],r2=radius*radius,c=Math.ceil(radius/100),gx=Math.floor(x/100),gz=Math.floor(z/100);
  for(let i=-c;i<=c;i++)for(let j=-c;j<=c;j++)for(const s of this.grid.get((gx+i)+','+(gz+j))??[]){const d=(s.x-x)**2+(s.z-z)**2;if(d<=r2)out.push([d,s]);}
  if(out.length>this.capacity)out.sort((a,b)=>a[0]-b[0]).length=this.capacity;
  return out.map(v=>v[1]);
 }
 refill(focus,radius) {
  const list=this.near(focus.x,focus.z,radius),m=new THREE.Matrix4(),pos=new THREE.Vector3(),q=new THREE.Quaternion(),one=new THREE.Vector3(1,1,1),up=new THREE.Vector3(0,1,0);
  list.forEach((s,i)=>{q.setFromAxisAngle(up,Math.atan2(s.nx,s.nz));m.compose(pos.set(s.x,s.y,s.z),q,one);for(const p of this.parts)p.setMatrixAt(i,m);m.makeTranslation(s.lx,s.y+.095,s.lz);this.pools.setMatrixAt(i,m);});
  for(const mesh of [...this.parts,this.pools]){mesh.count=list.length;mesh.instanceMatrix.needsUpdate=true;mesh.visible=list.length>0;if(list.length)mesh.computeBoundingSphere();}
  this.shown={x:focus.x,z:focus.z,radius,count:list.length};
 }
 update(dt,focus,night,quality='medium',indoors=false) {
  const k=Math.max(0,Math.min(1,night??0));this.bulbMat.emissiveIntensity=k*3;this.glowMat.uniforms.night.value=k;
  // lamps beyond the fog aren't drawn at all (the fog distance follows the quality setting)
  const radius=quality==='low'?240:quality==='high'||quality==='ultra'?560:380;
  if(!this.shown||this.shown.radius!==radius||(this.shown.x-focus.x)**2+(this.shown.z-focus.z)**2>400)this.refill(focus,radius);
  this.pools.visible=k>.01&&this.pools.count>0;
  this.timer-=dt;
  if(this.timer<=0){this.timer=.25;this.nearest=this.near(focus.x,focus.z,80).map(s=>[s,(s.lx-focus.x)**2+(s.lz-focus.z)**2]).filter(v=>v[1]<75**2).sort((a,b)=>a[1]-b[1]).slice(0,12).map(v=>v[0]);}
  const budget=quality==='low'?6:quality==='high'||quality==='ultra'?12:9;
  // real lights beyond the budget, and all of them by day or indoors, are switched off entirely (not just
  // dimmed): every visible light makes every lit material's shader more expensive
  this.pool.forEach((l,i)=>{const s=this.nearest?.[i];l.intensity=s&&i<budget&&!indoors?220*k:0;l.visible=i<budget&&k>.01&&!indoors;if(s)l.position.set(s.lx,s.y+6.85,s.lz);});
 }
}
