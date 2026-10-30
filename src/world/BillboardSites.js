import {BILLBOARD_CATALOGUE,AD_AREAS} from '../../shared/BillboardCatalogue.js';
import {rect} from './StreetLayout.js';
import {clearExpansionFootprint,buildFootprintIndex,polysOverlap} from './ExpansionSites.js';
/** Plan once from map data, before quality-dependent props. Board IDs have the same location on every client. */
export function planBillboardSites(map,landmarks){const index=buildFootprintIndex(map,{visual:true}),candidates=[],reserved=[],anchors=Object.fromEntries(AD_AREAS.map(a=>[a,landmarks.get(a)]));
 for(const s of map.segments){const r=s.road;if(r.elevated||r.width<5||['footway','path','steps','track','construction','pedestrian'].includes(r.type))continue;const dx=s.bx-s.ax,dz=s.bz-s.az,L=Math.hypot(dx,dz);if(L<12)continue;const n=Math.max(1,Math.floor(L/24));for(let i=0;i<n;i++)for(const side of[-1,1]){const t=(i+.5)/n,u=dx/L,v=dz/L,nx=-v*side,nz=u*side,off=r.width/2+11,x=s.ax+dx*t+nx*off,z=s.az+dz*t+nz*off,yaw=Math.atan2(-nx,-nz),pts=rect(x,z,20.8,8.4,yaw);
  if(Object.values(map.monumentSites??{}).some(p=>Math.hypot(p.x-x,p.z-z)<p.r+20)||map.stadiumSite&&polysOverlap(pts,map.stadiumSite.pts)||x>1580&&x<1805&&z>-1240&&z<-945)continue;
  if(landmarks.list.some(l=>['church','monument','mall'].includes(l.kind)&&Math.hypot(l.x-x,l.z-z)<45))continue;
  if(pts.some(([px,pz])=>map.inHomeAccess?.(px,pz,1))||!clearExpansionFootprint(map,pts,index))continue;
  candidates.push({x,z,yaw,road:r.id,roadName:r.displayName||r.name||'Local road',roadPoint:{x:s.ax+dx*t,z:s.az+dz*t},roadDirection:{x:u,z:v},pts});
 }}
 const sorted=Object.fromEntries(AD_AREAS.map(a=>[a,[...candidates].sort((p,q)=>Math.hypot(p.x-anchors[a].x,p.z-anchors[a].z)-Math.hypot(q.x-anchors[a].x,q.z-anchors[a].z))]));
 for(let n=1;n<=50;n++)for(const area of AD_AREAS){const p=sorted[area].find(p=>!reserved.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<32));if(!p)throw Error('Not enough safe sites for 200 billboards');const def=BILLBOARD_CATALOGUE.find(b=>b.area===area&&b.number===n);reserved.push({...p,...def});}
 return reserved;
}
