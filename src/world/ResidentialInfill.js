import {rect,roadConflict} from './StreetLayout.js';
import {polysOverlap} from './ExpansionSites.js';
import {mulberry32} from '../core/utils.js';
import {oldCoreWeight} from './buildings/ResidentialKit.js';
import {planCompound,compoundColliders} from './buildings/CompoundKit.js';
/**
 * Houses on empty land (v0.38, replaces the 800 box houses of v0.29). Plots are found along real streets, set back
 * in rows behind the road, never on roads, junction mouths, landmarks, the stadium, markets, parks, schools,
 * billboard or venue sites, water, home access paths or anything already built. Each plot becomes an ordinary
 * city building (so it gets the building kit: type, roof, veranda/porch/balconies) and most get a walled
 * compound with a gate facing the street. The old trading districts are denser (smaller plots, fewer walls);
 * the newer areas have bigger compounds.
 */
// v0.49: the map extension is filled in rows and columns by OrderlyFill instead (MAX_INFILL_EXT 0)
export const MAX_INFILL=4200, MAX_INFILL_EXT=0;
const KEEP_OPEN=['market','mall','monument','church','stadium','park','interchange','school','public','plaza'];
export class ResidentialInfill{
 constructor(g){
  const t0=performance.now();const cnt={c:0,center:0,road:0,grid:0};
  const w=this.w=g.world;this.houses=[];const taken=new Map();this.compounds=[];const rng=mulberry32(29029),plots=[...new Set(g.vehicles.spots.map(s=>s.plot))],candidates=[];
  // junctions in a coarse grid so each plot only checks the few nearby
  const oldNodes=w.map.meta?.extensions?.[0]?.before?.nodes??Infinity,jgrid=new Map(),jgridAll=new Map(),JG=40;for(const i of w.map.junctions){const n=w.map.nodes[i];if(!n)continue;{const k=Math.floor(n[0]/JG)+','+Math.floor(n[1]/JG);if(!jgridAll.has(k))jgridAll.set(k,[]);jgridAll.get(k).push(n);}if(i>=oldNodes)continue;const k=Math.floor(n[0]/JG)+','+Math.floor(n[1]/JG);if(!jgrid.has(k))jgrid.set(k,[]);jgrid.get(k).push(n);}
  const nearJunction=(x,z,r,ext=0)=>{const G=ext?jgridAll:jgrid,gx=Math.floor(x/JG),gz=Math.floor(z/JG);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)for(const n of G.get((gx+i)+','+(gz+j))??[])if(Math.hypot(x-n[0],z-n[1])<r)return true;return false;};
  const boards=w.map.billboardSites.map(b=>({b,x:b.x,z:b.z})),venues=(w.venuePlots??[]).map(v=>({v,x:v.pts.reduce((a,q)=>a+q[0],0)/v.pts.length,z:v.pts.reduce((a,q)=>a+q[1],0)/v.pts.length}));
  // v0.48: roads added by a map extension come after every road of the earlier map, so the houses of the earlier
  // map are planned first and come out exactly as before (their numbers, compounds and neighbours stay the same)
  const oldRoads=w.map.meta?.extensions?.[0]?.before?.roads??Infinity,roadIdx=new Map(w.map.roads.map((r,i)=>[r,i]));
  for(const s of w.map.segments){if(s.road.elevated||s.road.width<4||['footway','path','steps','pedestrian','construction','track'].includes(s.road.type))continue;const dx=s.bx-s.ax,dz=s.bz-s.az,L=Math.hypot(dx,dz);if(L<12)continue;
   const mx=(s.ax+s.bx)/2,mz=(s.az+s.bz)/2,old=oldCoreWeight(w.landmarks,mx,mz),spacing=old>.5?17:23,n=Math.max(1,Math.floor(L/spacing));
   for(let i=0;i<n;i++)for(const side of[-1,1])for(const[row,setback]of(old>.5?[[0,11],[1,25],[2,39]]:[[0,14],[1,32],[2,50]])){const t=(i+.5)/n,x=s.ax+dx*t-dz/L*side*(s.road.width/2+setback),z=s.az+dz*t+dx/L*side*(s.road.width/2+setback),yaw=Math.atan2(dz/L*side,-dx/L*side);const ext=roadIdx.get(s.road)>=oldRoads?1:0;candidates.push({ext,prem:ext&&w.districts?.premiumAt(x,z)>.5?0:1,x,z,yaw,seed:rng(),old,row});}}
  // nearer rows first so streets fill from the front; in a map extension GRA's plots come first (it is mapped with few
  // buildings, and the cap would otherwise leave it empty)
  candidates.sort((a,b)=>a.ext-b.ext||(a.ext&&a.prem-b.prem)||a.row-b.row||a.seed-b.seed);let nOld=0,nNew=0;
  for(const p of candidates){if(p.ext?nNew>=MAX_INFILL_EXT:nOld>=MAX_INFILL){if(p.ext)break;continue;}if(!Number.isFinite(p.x)||!Number.isFinite(p.z)||!Number.isFinite(p.yaw))continue;
   const r2=mulberry32(Math.floor(p.seed*1e9)),old=p.old>.5;
   const ww=old?8+r2()*4:9+r2()*6,dd=old?8.5+r2()*4:10+r2()*5,levels=r2()<(old?.25:.35)?2:r2()<.06?3:1;
   const compound=r2()<(old?.35:.85),front=compound?(old?3.5:4.5+r2()*2):1.2,sideM=compound?(old?1.6:2+r2()*1.5):.8,backM=compound?2.2+r2()*1.5:.8;
   const hw=ww/2+sideM,hd=(dd+front+backM)/2,hz=(backM-front)/2; // house sits back from the gate
   const at=(u,v)=>[p.x+Math.cos(p.yaw)*u+Math.sin(p.yaw)*v,p.z-Math.sin(p.yaw)*u+Math.cos(p.yaw)*v];
   const outer=rect(p.x,p.z,hw*2+.6,hd*2+.6,p.yaw);
      const ig=p.ext?null:2,newRoad=p.ext?null:(r)=>roadIdx.get(r)>=oldRoads; // the earlier map's houses are planned as if the extension were not there (v0.48)
   if(!w.collision.isFree(p.x,p.z,Math.min(hw,hd),ig))continue;
   if(Math.hypot(p.x-w.map.spawn.x,p.z-w.map.spawn.z)<40||w.map.inHomeAccess?.(p.x,p.z,12)||plots.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<34))continue;
   if(w.landmarks.list.some(l=>KEEP_OPEN.includes(l.kind)&&(p.ext||!l.ext)&&Math.hypot(p.x-l.x,p.z-l.z)<Math.min((l.radius??60)+25,200)))continue;
   if(nearJunction(p.x,p.z,Math.max(hw,hd)+12,p.ext))continue;
   const BB=p.ext?(w.map.fullBounds??w.map.bounds):w.map.bounds;if(outer.some(([x,z])=>x<BB.minX||x>BB.maxX||z<BB.minZ||z>BB.maxZ)||polysOverlap(outer,w.map.stadiumSite.pts)||boards.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<60&&polysOverlap(outer,q.b.pts))||venues.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<70&&polysOverlap(outer,q.v.pts)))continue;
   {const gx=Math.floor(p.x/40),gz=Math.floor(p.z/40);let hit=false;for(let i=-1;i<=1&&!hit;i++)for(let j=-1;j<=1&&!hit;j++)for(const q of taken.get((gx+i)+','+(gz+j))??[])if(Math.hypot(q.x-p.x,q.z-p.z)<q.r+Math.hypot(hw,hd)&&polysOverlap(outer,q.pts)){hit=true;break;}if(hit)continue;}
   // cheap centre test first, then a coarse grid of covering circles over the whole plot
   cnt.center++;if(roadConflict(w.map,outer,3,newRoad))continue;cnt.road++;
   let ok=true;const nu=Math.ceil((hw*2+.6)/2.4),nv=Math.ceil((hd*2+.6)/2.4);for(let i=0;i<=nu&&ok;i++)for(let j=0;j<=nv;j++){const u=-hw-.3+(hw*2+.6)*i/nu,v=-hd-.3+(hd*2+.6)*j/nv,[px,pz]=at(u,v);if(!w.collision.isFree(px,pz,1.35,ig)||w.map.inHomeAccess?.(px,pz,2)){ok=false;break;}}
   if(ok)for(const[u,v]of[[0,0],[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]]){const[px,pz]=at(u,v);if(w.terrain.isWater(px,pz)||w.map.onCarriageway(px,pz,1.5,newRoad)){ok=false;break;}}
   if(!ok)continue;
   const[hx,hz2]=at(0,hz),pts=rect(hx,hz2,ww,dd,p.yaw);
   // the edge facing the street (+v) is the front
   let front_i=0,best=-Infinity;for(let i=0;i<4;i++){const a=pts[i],b=pts[(i+1)%4],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,f=(mx-hx)*Math.sin(p.yaw)+(mz-hz2)*Math.cos(p.yaw);if(f>best){best=f;front_i=i;}}
   const h={ext:!!p.ext,id:'infill:'+this.houses.length,x:hx,z:hz2,yaw:p.yaw,w:ww,d:dd,levels,pts,front:front_i,seed:p.seed,old,registered:true,plot:{x:p.x,z:p.z,hw,hd,front,back:backM}};
   h.polys=[w.collision.addPolygon(pts,levels*3+1)];
   if(compound){const c=planCompound({x:p.x,z:p.z,yaw:p.yaw,hw,hd,house:{w:ww,d:dd,z:hz,front,back:backM},rng:r2,tier:w.districts?.premiumAt(p.x,p.z)>.5?'premium':old?'standard':ww>12?'large':'standard'});for(const q of compoundColliders(c))h.polys.push(w.collision.addPolygon(q,2.4));h.compound=c;this.compounds.push(c);}
   this.houses.push(h);if(p.ext)nNew++;else nOld++;{const k=Math.floor(p.x/40)+','+Math.floor(p.z/40);if(!taken.has(k))taken.set(k,[]);taken.get(k).push({x:p.x,z:p.z,r:Math.hypot(hw,hd)+.5,pts:outer});}
  }
  // v0.48: a house of the earlier map that the extension's real buildings or roads now cover is taken out (number kept)
  if(oldRoads!==Infinity){const extRoad=(r)=>!(roadIdx.get(r)>=oldRoads);for(const h of this.houses){if(h.ext||h.removed)continue;const pts=[[h.x,h.z],...h.pts];if(pts.some(([x,z])=>{const q=w.collision.insidePolygon(x,z);return q&&q.tag===2;})||roadConflict(w.map,h.pts,1,extRoad)){h.removed=true;h.removedBy='ext';if(h.compound)h.compound.removed=true;for(const pi of h.polys??[])w.collision.removePolygon(pi);this.removedExt=(this.removedExt??0)+1;}}}
  // v0.49: a house planned under a bridge deck or flyover ramp (roads on land don't count elevated decks) is taken out
  {const segs=w.map.segments.filter(s=>s.road.elevated);const near=(x,z)=>segs.some(s=>{const dx=s.bx-s.ax,dz=s.bz-s.az,L=dx*dx+dz*dz||1,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/L));return Math.hypot(x-s.ax-t*dx,z-s.az-t*dz)<s.road.width/2+1.5;});
   this.removedBridge=0;for(const h of this.houses){if(h.removed)continue;const pts=[[h.x,h.z],...h.pts,...(h.compound?.ring??[])];if(!pts.some(([x,z])=>near(x,z)))continue;h.removed=true;h.removedBy='bridge';if(h.compound)h.compound.removed=true;for(const pi of h.polys??[])w.collision.removePolygon(pi);this.removedBridge++;}}
  // v0.48: OpenStreetMap marks some of this land as car parks, parks and pitches (the Bridgehead car park, the parks
  // by Zik Roundabout): those stay open. The houses planned there are taken out again; every other house, compound
  // and neighbour keeps its number (so saves and friendships stay the same).
  const open=(w.map.areas??[]).filter(a=>['parking','park','pitch'].includes(a.kind)&&a.pts?.length>2);
  const inA=(x,z,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[xi,zi]=pts[i],[xj,zj]=pts[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)c=!c;}return c;};
  this.removedOpen=0;
  for(const h of this.houses){const pts=[[h.x,h.z],...h.pts,...(h.compound?.outer??[])];if(!open.some(a=>pts.some(([x,z])=>inA(x,z,a.pts))))continue;h.removed=true;if(h.compound)h.compound.removed=true;for(const pi of h.polys??[])w.collision.removePolygon(pi);this.removedOpen++;}
  this.tidy(w);
  const t1=performance.now();this.items=w.city.addBuildings(this.houses.filter(h=>!h.removed));
  w.stats.infillMs=[Math.round(t1-t0),Math.round(performance.now()-t1),candidates.length,cnt.center,cnt.road];
  w.stats.infillHouses=this.houses.length;w.stats.infillCompounds=this.compounds.length;
 }
 /**
  * v0.49: rows and columns. Every house on its plot gets the standard size for its street (old districts, ordinary
  * streets, GRA) and stands the same distance back from the street, so a row of plots reads as one straight row.
  * The plot, its number and its compound stay exactly as planned (the house only gets smaller or stays the same).
  * And every house gets a wall and a gate: a house planned without a compound gets a wall round its plot (these
  * are kept out of `compounds`, whose order the gate neighbours' ids depend on).
  */
 tidy(w){
  const col=w.collision;this.fenced=0;
  for(const h of this.houses){if(h.removed||!h.plot)continue;const P=h.plot,gra=w.districts?.premiumAt(P.x,P.z)>.5;
   const W=Math.min(h.w,gra?12:h.old?8.4:10),D=Math.min(h.d,gra?11.5:h.old?8.6:10),F=gra?4.6:h.old?3.6:4.2;
   const front=Math.max(-P.hd+D,Math.min(P.hd-(h.compound?Math.min(P.front,2.4):1.1),F)),vz=front-D/2;
   const at=(u,v)=>[P.x+Math.cos(h.yaw)*u+Math.sin(h.yaw)*v,P.z-Math.sin(h.yaw)*u+Math.cos(h.yaw)*v];
   const pts=rect(...at(0,vz),W,D,h.yaw);
   let fi=0,best=-Infinity;const[cx,cz]=at(0,vz);for(let i=0;i<4;i++){const a=pts[i],b=pts[(i+1)%4],mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2,f=(mx-cx)*Math.sin(h.yaw)+(mz-cz)*Math.cos(h.yaw);if(f>best){best=f;fi=i;}}
   col.removePolygon(h.polys[0]);h.polys[0]=col.addPolygon(pts,h.levels*3+1);h.pts=pts;h.front=fi;h.w=W;h.d=D;
   if(!h.compound){const c=planCompound({x:P.x,z:P.z,yaw:h.yaw,hw:P.hw,hd:P.hd,house:{w:W,d:D,z:vz,front:P.hd-front,back:P.hd+vz-D/2},rng:mulberry32(Math.floor(h.seed*1e9)+4949),tier:gra?'premium':'standard'});c.fence=true;for(const q of compoundColliders(c))h.polys.push(col.addPolygon(q,2.4));h.compound=c;this.fenced++;}
  }
 }
 update(){}
}
