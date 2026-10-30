import {polysOverlap} from '../world/ExpansionSites.js';
import * as THREE from 'three';
import {rect,roadConflict} from '../world/StreetLayout.js';
import {VEHICLE_MODELS} from '../data/housing.js';
/** Snapshot parking never teleports the live car during an autosave. Held vehicles stay impounded. */
export function homeForResume(housing){const mine=housing.mine().filter(m=>housing.access(m.home.id).use);return mine.find(m=>m.home.id===housing.state.primaryHome)?.home??mine.find(m=>housing.state.owned?.[m.home.id])?.home??mine[0]?.home??null;}
export function garageSnapshot(data,housing){const home=homeForResume(housing);if(!home)return data;const vehicles=data.vehicles.map(v=>data.police?.held?.[v.id]?{...v}:{...v,garaged:true,garageHomeId:home.id});return{...data,vehicles};}
const inRing=(x,z,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[xi,zi]=pts[i],[xj,zj]=pts[j];if((zi>z)!==(zj>z)&&x<((xj-xi)*(z-zi))/(zj-zi)+xi)c=!c;}return c;};
/** the nearest point on a drivable road (for which way a garage door faces) */
const nearestPoint=(map,x,z)=>{const c=map.cell,gx=Math.floor(x/c),gz=Math.floor(z/c);let best=null,bd=40*40;for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const si of map.grid.get(gx+dx+','+(gz+dz))??[]){const q=map.segments[si];if(q.road.elevated||['footway','path','steps','pedestrian'].includes(q.road.type))continue;const vx=q.bx-q.ax,vz=q.bz-q.az,L=vx*vx+vz*vz||1,t=Math.max(0,Math.min(1,((x-q.ax)*vx+(z-q.az)*vz)/L)),px=q.ax+vx*t,pz=q.az+vz*t,d=(px-x)**2+(pz-z)**2;if(d<bd){bd=d;best={x:px,z:pz,dist:Math.sqrt(d)-(q.road.width??6)/2};}}return best;};
export class GarageController{
 constructor(g){this.g=g;this.sites=new Map();this.polys=[];this.group=new THREE.Group();this.group.name='HomeGarages';g.renderer.scene.add(this.group);}
 start(){for(const id of this.polys)this.g.world.collision.removePolygon(id);this.polys=[];this.group.clear();this.sites.clear();for(const {home} of this.g.homes.housing.mine())if(this.g.homes.housing.access(home.id).use)this.site(home);}
 /** All compound walls in the city (OSM buildings, houses on empty land, rows of new houses), found once. */
 compounds(){if(this._comps)return this._comps;const w=this.g.world,set=new Set();for(const ch of w.city?.chunks?.values()??[])for(const c of ch.compounds??[])set.add(c);for(const c of w.infill?.compounds??[])if(!c.removed)set.add(c);for(const h of w.orderly?.houses??[])if(h.compound)set.add(h.compound);
  this._comps=[...set].filter(c=>c.ring?.length===4&&c.gate);return this._comps;}
 /** v0.52: the compound a home's door is in */
 compoundOf(home){const d=home.door.stand,door=home.door;let best=null,bd=1e9;for(const c of this.compounds()){const[cx,cz]=c.ring.reduce((a,p)=>[a[0]+p[0]/4,a[1]+p[1]/4],[0,0]);const dd=Math.hypot(cx-d.x,cz-d.z);if(dd>60)continue;if(inRing(d.x,d.z,c.ring)||inRing(door.x,door.z,c.ring)){if(dd<bd){bd=dd;best=c;}}}return best;}
 site(home){if(!home)return null;if(this.sites.has(home.id))return this.sites.get(home.id);const w=this.g.world;
  // v0.52: 1) a carport inside the home's own compound; 2) a walled garage built onto the compound (the compound grows); 3) as before, by a nearby road
  let site=null;const comp=this.compoundOf(home);if(comp){site=this.insideSite(comp,home)??this.annexSite(comp);}
  if(!site)site=this.nearSite(home);
  if(!site)site=this.roadSite(home);
  this.sites.set(home.id,site);if(site)this.build(home,site);return site;
 }
 frame(c){const[c0,c1,c2,c3]=c.ring,mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2],f=mid(c0,c3),bk=mid(c1,c2),cx=(f[0]+bk[0])/2,cz=(f[1]+bk[1])/2;let Fx=f[0]-bk[0],Fz=f[1]-bk[1];const hf=Math.hypot(Fx,Fz)/2;Fx/=hf*2;Fz/=hf*2;let Sx=c3[0]-c0[0],Sz=c3[1]-c0[1];const hs=Math.hypot(Sx,Sz)/2;Sx/=hs*2;Sz/=hs*2;
  return{cx,cz,F:[Fx,Fz],S:[Sx,Sz],hf,hs,at:(sv,fv)=>[cx+Sx*sv+Fx*fv,cz+Sz*sv+Fz*fv],yaw:Math.atan2(Fx,Fz)};}
 /** a free footprint (W across, D deep) centred at local (s, f)? */
 freeAt(fr,s,f,W,D,{inside=true}={}){const w=this.g.world;for(let a=-W/2;a<=W/2+1e-6;a+=W/Math.ceil(W/.7))for(let b=-D/2;b<=D/2+1e-6;b+=D/Math.ceil(D/.7)){const[x,z]=fr.at(s+a,f+b);if(!w.collision.isFree(x,z,.3)||w.terrain.isWater(x,z))return false;if(!inside&&w.map.onCarriageway(x,z,.6))return false;}return true;}
 insideSite(c,home){const fr=this.frame(c),m=.45,[g0,g1]=c.gate,gm=[(g0[0]+g1[0])/2,(g0[1]+g1[1])/2],feats=(c.features??[]).filter(q=>q.p).map(q=>q.p);
  // the carport's long side along the compound's depth (car faces the gate side), or across it in a wide, shallow yard
  for(const turn of[0,1]){const W=turn?6:3.6,D=turn?3.6:6;if(fr.hs*2<W+2*m||fr.hf*2<D+2*m)continue;
   const cand=[];for(let s=-fr.hs+W/2+m;s<=fr.hs-W/2-m+1e-6;s+=.5)for(let f=-fr.hf+D/2+m;f<=fr.hf-D/2-m+1e-6;f+=.5){const[x,z]=fr.at(s,f);cand.push({s,f,x,z,score:Math.hypot(x-gm[0],z-gm[1])});}
   cand.sort((a,b)=>a.score-b.score);
   for(const q of cand){if(feats.some(([x,z])=>Math.hypot(x-q.x,z-q.z)<2.4))continue;if(Math.hypot(home.door.x-q.x,home.door.z-q.z)<2.4)continue;if(!this.freeAt(fr,q.s,q.f,W,D))continue;return{x:q.x,z:q.z,yaw:fr.yaw+(turn?Math.PI/2:0),kind:'carport',w:3.6,d:6,comp:c};}}
  return null;}
 annexSite(c){const w=this.g.world,fr=this.frame(c),W=4.6,D=Math.min(7.2,fr.hf*2);if(D<6)return null;
  for(const side of[1,-1]){const s=side*(fr.hs+W/2+.12),f=fr.hf-D/2,[x,z]=fr.at(s,f),pts=[fr.at(s-W/2,f-D/2),fr.at(s+W/2,f-D/2),fr.at(s+W/2,f+D/2),fr.at(s-W/2,f+D/2)];
   if(roadConflict(w.map,pts,.4)||w.map.billboardSites?.some(b=>polysOverlap(pts,b.pts))||w.playArea?.lockedFast?.(x,z))continue;if(!this.freeAt(fr,s+side*.25,f,W-.5,D-.3,{inside:false}))continue; // (the side against the compound wall is the wall itself)
   // the street in front of the annex door must be reachable (not another compound or a building)
   let ok=true;for(let k=1;k<=3&&ok;k++){const[px,pz]=fr.at(s,fr.hf+k);if(!w.collision.isFree(px,pz,.5))ok=false;}if(!ok)continue;
   return{x,z,yaw:fr.yaw,kind:'annex',w:W,d:D,comp:c,side};}
  return null;}
 /** a walled garage on free land right by the house (for a house with no compound wall), its door facing the street */
 nearSite(home){const w=this.g.world,d=home.door.stand,W=4.6,D=7.2;
  for(let r=5;r<=34;r+=1.5)for(let k=0;k<24;k++){const q=k/24*Math.PI*2,x=d.x+Math.cos(q)*r,z=d.z+Math.sin(q)*r,nr=nearestPoint(w.map,x,z);if(!nr||nr.dist<D/2+1.5)continue;
   const yaw=Math.atan2(nr.x-x,nr.z-z),fr={at:(sv,fv)=>[x+Math.cos(yaw)*sv+Math.sin(yaw)*fv,z-Math.sin(yaw)*sv+Math.cos(yaw)*fv]},pts=[fr.at(-W/2,-D/2),fr.at(W/2,-D/2),fr.at(W/2,D/2),fr.at(-W/2,D/2)];
   if(roadConflict(w.map,pts,.4)||w.map.billboardSites?.some(b=>polysOverlap(pts,b.pts))||w.playArea?.lockedFast?.(x,z))continue;if(!this.freeAt(fr,0,0,W,D,{inside:false}))continue;
   let ok=true;for(let kk=1;kk<=3&&ok;kk++){const[px,pz]=fr.at(0,D/2+kk);if(!w.collision.isFree(px,pz,.6))ok=false;}if(!ok||[...pts].some(([px,pz])=>w.map.inHomeAccess?.(px,pz,.5)))continue;
   return{x,z,yaw,kind:'annex',w:W,d:D,comp:{wallColor:'#e3d9c3'},standalone:true};}
  return null;}
 roadSite(home){const w=this.g.world,d=home.door.stand,candidates=[];
 for(const s of w.map.segments){if(s.road.elevated||['footway','path','steps','pedestrian','construction'].includes(s.road.type))continue;const dx=s.bx-s.ax,dz=s.bz-s.az,L=Math.hypot(dx,dz);if(L<8)continue;for(const t of[.2,.5,.8])for(const side of[-1,1]){const off=s.road.width/2+10,x=s.ax+dx*t-dz/L*side*off,z=s.az+dz*t+dx/L*side*off,dist=Math.hypot(x-d.x,z-d.z);if(dist>260)continue;candidates.push({x,z,yaw:Math.atan2(dz/L*side,-dx/L*side),dist});}}
 candidates.sort((a,b)=>a.dist-b.dist);let site=null;for(const p of candidates){const pts=rect(p.x,p.z,8.5,11,p.yaw);if(pts.some(([x,z])=>x<w.map.bounds.minX||x>w.map.bounds.maxX||z<w.map.bounds.minZ||z>w.map.bounds.maxZ)||roadConflict(w.map,pts,2)||w.map.billboardSites?.some(b=>polysOverlap(pts,b.pts))||this.sites.size&&[...this.sites.values()].some(s=>s&&Math.hypot(s.x-p.x,s.z-p.z)<18))continue;let ok=true;for(let x=-4.2;x<=4.3&&ok;x+=1.4)for(let z=-5.5;z<=5.6;z+=1.4){const px=p.x+Math.cos(p.yaw)*x+Math.sin(p.yaw)*z,pz=p.z-Math.sin(p.yaw)*x+Math.cos(p.yaw)*z;if(!w.collision.isFree(px,pz,1)||w.terrain.isWater(px,pz)||w.map.inHomeAccess?.(px,pz,1)){ok=false;break;}}if(ok){site=p;break;}}
  if(site)site.kind='road';return site;
 }
 build(home,s){if(s.kind==='carport'||s.kind==='annex')return this.buildCompound(home,s);const g=new THREE.Group();g.position.set(s.x,0,s.z);g.rotation.y=s.yaw;const add=(w,h,d,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.75}));m.position.set(x,y,z);g.add(m);};add(8,.12,10,0,.08,0,'#aaa697');add(8.2,.22,10.2,0,3.8,0,'#1e5349');for(const x of[-3.6,3.6])for(const z of[-4.5,4.5])add(.18,3.7,.18,x,1.9,z,'#ded6bd');
 for(const [x,z,ww,dd] of[[-4,0,.18,10],[4,0,.18,10],[0,-5,8,.18]]){add(ww,3.6,dd,x,1.9,z,'#d4c9ae');const pts=rect(x,z,ww,dd).map(([lx,lz])=>[s.x+Math.cos(s.yaw)*lx+Math.sin(s.yaw)*lz,s.z-Math.sin(s.yaw)*lx+Math.cos(s.yaw)*lz]);this.polys.push(this.g.world.collision.addPolygon(pts,3.8));}
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#173d35';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff4d5';ctx.textAlign='center';ctx.font='bold 42px Arial';ctx.fillText('PRIVATE HOME GARAGE',256,57);ctx.font='26px Arial';ctx.fillText('Secure storage · use the home door',256,102);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(6.8,1.1),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));sign.position.set(0,3.1,5.05);g.add(sign);this.group.add(g);}
 /** v0.52: a carport in the yard, or a walled garage built onto the compound in the compound's own wall colour */
 buildCompound(home,s){const c=s.comp,g=new THREE.Group();g.position.set(s.x,0,s.z);g.rotation.y=s.yaw;const mats=new Map(),mat=(col,o={})=>{const k=col+JSON.stringify(o);if(!mats.has(k))mats.set(k,new THREE.MeshStandardMaterial({color:col,roughness:.75,...o}));return mats.get(k);};
  const add=(w,h,d,x,y,z,color,o)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,o));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
  const W=s.w,D=s.d,wall=c.wallColor??'#e3d9c3',roof='#2e3b44',toWorld=(lx,lz)=>[s.x+Math.cos(s.yaw)*lx+Math.sin(s.yaw)*lz,s.z-Math.sin(s.yaw)*lx+Math.cos(s.yaw)*lz],collide=(lx,lz,w,d,h)=>{const pts=rect(lx,lz,w,d).map(([a,b])=>toWorld(a,b));this.polys.push(this.g.world.collision.addPolygon(pts,h));};
  add(W,.08,D,0,.05,0,'#9b9891'); // concrete floor
  if(s.kind==='carport'){for(const x of[-W/2+.12,W/2-.12])for(const z of[-D/2+.15,D/2-.15]){add(.14,2.55,.14,x,1.28,z,'#3a3d40',{metalness:.5});collide(x,z,.2,.2,2.6);}
   const r=add(W+.5,.09,D+.4,0,2.6,0,roof,{metalness:.35});r.rotation.x=-.05;add(W+.5,.18,.12,0,2.5,D/2+.2,'#1f2629');add(W+.5,.18,.12,0,2.66,-D/2-.2,'#1f2629');}
  else{const H=2.9;for(const[x,z,ww,dd]of[[-W/2,0,.22,D],[W/2,0,.22,D],[0,-D/2,W,.22]]){add(ww,H,dd,x,H/2,z,wall);collide(x,z,ww,dd,H);}
   add(W+.3,.18,D+.3,0,H+.05,0,'#d0c8b4');add(.3,.6,.25,-W/2+.15,H-.3,D/2,wall);add(.3,.6,.25,W/2-.15,H-.3,D/2,wall);
   // a raised roller shutter (open) over the door
   add(W-.3,.5,.35,0,H-.35,D/2-.1,'#7d858c',{metalness:.6});}
  // a small sign
  const cv=document.createElement('canvas');cv.width=256;cv.height=64;const x2=cv.getContext('2d');x2.fillStyle='#173d35';x2.fillRect(0,0,256,64);x2.fillStyle='#fff4d5';x2.font='bold 26px Arial';x2.textAlign='center';x2.fillText('HOME GARAGE',128,42);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.4),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide}));sign.position.set(W/2-.9,s.kind==='annex'?2.35:2.3,D/2+.02);g.add(sign);
  this.group.add(g);}
 view(home){const g=this.g,list=g.vehicles.sys?.list??[],held=v=>!!g.saveData.police?.held?.[v.id];return{title:'Secure garage · '+home.label,kicker:'HOME VEHICLE STORAGE',text:'All owned vehicles are stored safely on reload or sign-out. Fuel, colour, mileage and damage are preserved. Impounded vehicles must be released by police first. Retrieve one vehicle at a time into the garage collection bay.',note:this.site(home)?({carport:'Your carport is inside your compound, by the gate.',annex:this.site(home).standalone?'Your walled garage is right by your house, opening to the street.':'Your garage is built onto your compound wall, opening to the street.'}[this.site(home).kind]??'Your private garage is marked beside a nearby clear road.'):'Secure storage is available; collection waits until a clear off-road bay is available.',options:[...list.map(v=>({label:VEHICLE_MODELS[v.model].label,sub:held(v)?'Police impound':v.garaged?'Stored safely · '+v.paint:'Outside · '+v.paint,disabled:held(v),why:'Release from police first',act:()=>{if(v.garaged)this.retrieve(home,v);else this.store(home,v);}})),{label:'Store all available vehicles',act:()=>{for(const v of list)if(!held(v))this.store(home,v,false);g.saveGame();g.renderChoice();}},{label:'Make this my respawn home',act:()=>{g.saveData.housing.primaryHome=home.id;g.saveGame();g.ui.toast('You will return inside this home on restart.');}},{label:'Mark garage on map',disabled:!this.site(home),act:()=>{const s=this.site(home);if(s){g.minimap.waypoint={x:s.x,z:s.z,label:'Home garage'};g.ui.toast('Garage marked on map');}}},{label:'Done',ghost:true,act:()=>g.closeChoice()}]};}
 store(home,v,refresh=true){const g=this.g;if(g.saveData.police?.held?.[v.id])return false;if(g.vehicles.driving?.id===v.id)g.vehicles.stopDriving({silent:true});g.vehicles.removeOwned(v);v.garaged=true;v.garageHomeId=home.id;if(refresh){g.saveGame();g.renderChoice();g.ui.toast('Vehicle stored safely');}return true;}
 retrieve(home,v){const g=this.g,s=this.site(home);if(!s||!g.world.collision.isFree(s.x,s.z,s.kind==='carport'||s.kind==='annex'?1.1:2.4)||!g.traffic.isClear(s.x,s.z,3)||g.vehicles.sys.list.some(q=>!q.garaged&&q.id!==v.id&&Math.hypot(q.x-s.x,q.z-s.z)<10)){g.ui.toast('Garage collection bay is blocked. Move the vehicle there first.');return false;}if(g.saveData.police?.held?.[v.id])return false;v.x=s.x;v.z=s.z;v.heading=s.yaw;v.garaged=false;v.garageHomeId=home.id;g.vehicles.addOwned(v);g.saveGame();g.renderChoice();g.ui.toast('Your vehicle is ready in the garage bay.');return true;}
}
