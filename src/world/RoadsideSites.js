import {segDistSq,pointInPolygon} from '../core/utils.js';
import {rect,roadConflict} from './StreetLayout.js';
export const BILLBOARD_SIZE={width:14,height:7,bottom:6,depth:2.6};
const onWater=(map,x,z)=>(map.water??[]).some(w=>pointInPolygon(x,z,w.outer));
/** Original landmark: locate a clear island in the Upper Iweka junction, never move the OSM roads. */
export function upperIwekaSite(map,anchor){
 const roads=map.segments.filter(s=>Math.min(s.ax,s.bx)<anchor.x+230&&Math.max(s.ax,s.bx)>anchor.x-230&&Math.min(s.az,s.bz)<anchor.z+230&&Math.max(s.az,s.bz)>anchor.z-230);
 const buildings=map.buildings.filter(b=>b.pts.some(([x,z])=>Math.hypot(x-anchor.x,z-anchor.z)<220));let best=null;
 for(let dx=-152;dx<=152;dx+=8)for(let dz=-152;dz<=152;dz+=8){const d=Math.hypot(dx,dz);if(d>160)continue;const x=anchor.x+dx,z=anchor.z+dz;if(onWater(map,x,z))continue;let clear=Infinity;
  for(const s of roads)clear=Math.min(clear,Math.sqrt(segDistSq(x,z,s.ax,s.az,s.bx,s.bz))-s.road.width/2);
  if(clear<8)continue;
  for(const b of buildings){if(pointInPolygon(x,z,b.pts)){clear=0;break;}for(let i=0;i<b.pts.length;i++)clear=Math.min(clear,Math.sqrt(segDistSq(x,z,...b.pts[i],...b.pts[(i+1)%b.pts.length])));if(clear<8)break;}
  const r=Math.min(9,clear-1.5);if(r<6.5)continue;const score=d+(9-r)*18+Math.max(0,clear-35)*2;
  if(!best||score<best.score)best={x,z,r,score,clearance:clear,distance:d};
 }if(!best)throw Error('No clear Upper Iweka island for the original monument');return best;
}
/** Entire large sign envelope is checked, not just its two posts. No unsafe hardcoded fallback. */
export function billboardSite(world,anchor,reserved=[]){
 const map=world.map,candidates=[];
 for(const s of map.segments){const r=s.road;if(r.elevated||r.width<5||['footway','path','steps','track','construction','pedestrian'].includes(r.type))continue;
  const dx=s.bx-s.ax,dz=s.bz-s.az,L=Math.hypot(dx,dz);if(L<4)continue;
  const t=Math.max(.12,Math.min(.88,((anchor.x-s.ax)*dx+(anchor.z-s.az)*dz)/(L*L))),u=dx/L,v=dz/L;
  for(const extra of [0,-24,24,-48,48])for(const side of[-1,1]){const at=Math.max(2,Math.min(L-2,t*L+extra)),px=s.ax+u*at,pz=s.az+v*at,nx=-v*side,nz=u*side;
   const off=r.width/2+13,x=px+nx*off,z=pz+nz*off,dist=Math.hypot(x-anchor.x,z-anchor.z);if(dist>650)continue;
   // The front normal points directly toward the road; no diagonal cant.
   const yaw=Math.atan2(-nx,-nz);candidates.push({x,z,yaw,road:r.id,roadName:r.displayName||r.name,roadPoint:{x:px,z:pz},score:dist+(r.width<8?35:0)});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);
 for(const p of candidates){if((world.dressing?.placed??[]).some(q=>Math.hypot(q.x-p.x,q.z-p.z)<32))continue;if(reserved.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<28))continue;const pts=rect(p.x,p.z,BILLBOARD_SIZE.width+.8,BILLBOARD_SIZE.depth+.8,p.yaw),b=map.bounds;
  if(pts.some(([x,z])=>x<b.minX+1||x>b.maxX-1||z<b.minZ+1||z>b.maxZ-1)||roadConflict(map,pts,2.5))continue;
  let ok=true;for(let xx=-7.4;xx<=7.5&&ok;xx+=1.2)for(let zz=-1.7;zz<=1.8;zz+=.8){const x=p.x+Math.cos(p.yaw)*xx+Math.sin(p.yaw)*zz,z=p.z-Math.sin(p.yaw)*xx+Math.cos(p.yaw)*zz;if(!world.collision.isFree(x,z,.75)||world.terrain.isWater(x,z)||map.inHomeAccess?.(x,z,.8)){ok=false;break;}}
  if(ok)return{...p,pts};
 }throw Error('No safe large billboard site near '+JSON.stringify(anchor));
}
