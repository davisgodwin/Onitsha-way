import { segDistSq, pointInPolygon } from '../core/utils.js';

// Check complete edges, including a road crossing the middle of a footprint.
export function roadConflict(map, pts, margin = 1.2, skip = null) {
  const xs=pts.map(p=>p[0]),zs=pts.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs),seen=new Set();
  const reach=30+margin,c=map.cell;
  for(let gx=Math.floor((minX-reach)/c);gx<=Math.floor((maxX+reach)/c);gx++)for(let gz=Math.floor((minZ-reach)/c);gz<=Math.floor((maxZ+reach)/c);gz++)for(const si of map.grid.get(gx+','+gz)??[]){
    if(seen.has(si))continue;seen.add(si);const s=map.segments[si],r=s.road;
    if(r.elevated||['footway','path','steps','pedestrian'].includes(r.type)||skip?.(r))continue;
    const lim=r.width/2+margin;
    if(Math.max(s.ax,s.bx)<minX-lim||Math.min(s.ax,s.bx)>maxX+lim||Math.max(s.az,s.bz)<minZ-lim||Math.min(s.az,s.bz)>maxZ+lim)continue;
    if(pointInPolygon(s.ax,s.az,pts)||pointInPolygon(s.bx,s.bz,pts))return s;
    for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];
      if(crosses(a,b,[s.ax,s.az],[s.bx,s.bz])||Math.min(segDistSq(...a,s.ax,s.az,s.bx,s.bz),segDistSq(...b,s.ax,s.az,s.bx,s.bz),segDistSq(s.ax,s.az,...a,...b),segDistSq(s.bx,s.bz,...a,...b))<lim*lim)return s;
    }
  }return null;
}
function crosses(a,b,c,d){const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0;}
export function rect(x,z,w,d,yaw=0){const c=Math.cos(yaw),s=Math.sin(yaw);return [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([a,b])=>[x+c*a+s*b,z-s*a+c*b]);}
export function streetReference(map,x,z){let best=null;const seen=new Set(),c=map.cell;for(let gx=Math.floor((x-90)/c);gx<=Math.floor((x+90)/c);gx++)for(let gz=Math.floor((z-90)/c);gz<=Math.floor((z+90)/c);gz++)for(const si of map.grid.get(gx+','+gz)??[]){if(seen.has(si))continue;seen.add(si);const {ax,az,bx,bz,road}=map.segments[si];if(road.elevated||['footway','path','steps','pedestrian','construction'].includes(road.type))continue;const dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1))),px=ax+t*dx,pz=az+t*dz,dist=Math.hypot(px-x,pz-z);if(dist<85&&(!best||dist<best.dist))best={dist,px,pz,road,yaw:Math.atan2(px-x,pz-z)};}return best;}
export function streetFacing(map,x,z){return streetReference(map,x,z)?.yaw??0;}

// Clip only offending footprints against road setbacks. Keep building order/IDs and
// original irregular city blocks (housing/save identities depend on them).
export function repairStreetLayout(map){const stats={surveyed:map.buildings.length,repaired:0,removed:0};for(const b of map.buildings){let pts=b.pts.map(p=>[...p]),hit=roadConflict(map,pts);if(!hit)continue;const original=pts;for(let k=0;k<32&&hit&&pts.length>=3;k++){
 const {ax,az,bx,bz,road}=hit,dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz)||1;let nx=-dz/L,nz=dx/L;
 const cx=original.reduce((s,p)=>s+p[0],0)/original.length,cz=original.reduce((s,p)=>s+p[1],0)/original.length;
 if((cx-ax)*nx+(cz-az)*nz<0){nx=-nx;nz=-nz;}const offset=road.width/2+1.35;
 const signed=p=>(p[0]-ax)*nx+(p[1]-az)*nz-offset,out=[];
 for(let i=0;i<pts.length;i++){const a=pts[i],bb=pts[(i+1)%pts.length],da=signed(a),db=signed(bb);if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+t*(bb[0]-a[0]),a[1]+t*(bb[1]-a[1])]);}}
 pts=out;hit=pts.length>=3?roadConflict(map,pts):null;
 }
 let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],bb=pts[(i+1)%pts.length];area+=a[0]*bb[1]-bb[0]*a[1];}
 if(pts.length<3||Math.abs(area)/2<8||hit){b.layoutHidden=true;stats.removed++;}else{const front=b.front;if(front>=0){const a=original[front],bb=original[(front+1)%original.length],mx=(a[0]+bb[0])/2,mz=(a[1]+bb[1])/2;let best=null;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length],L=Math.hypot(q[0]-p[0],q[1]-p[1]);if(L<3.2)continue;const score=Math.hypot((p[0]+q[0])/2-mx,(p[1]+q[1])/2-mz);if(!best||score<best.score)best={i,score};}b.front=best?.i??0;}b.pts=pts;b.layoutRepaired=true;stats.repaired++;}
 }map.layoutStats=stats;return stats;}

// A site's FRONT is parallel to, immediately beside, and connected to a road.
// Candidates originate ON a road segment, never at random points inside a block.
export function frontageCandidates(map,p,{w=14,d=15,maxDistance=780}={}){
 const out=[];
 for(const seg of map.segments){const {ax,az,bx,bz,road}=seg;
  if(road.elevated||road.noTraffic||road.width<4.5||['footway','path','pedestrian','steps','construction','track','trunk_link'].includes(road.type))continue;
  const dx=bx-ax,dz=bz-az,L=Math.hypot(dx,dz);if(L<1)continue;
  const t=Math.max(0,Math.min(L,((p.x-ax)*dx+(p.z-az)*dz)/L));
  if(Math.hypot(ax+dx/L*t-p.x,az+dz/L*t-p.z)>maxDistance)continue;
  const samples=new Set([Math.max(0,Math.min(L,t)),...Array.from({length:Math.ceil(L/6)+1},(_,i)=>Math.min(L,i*6))]);
  for(const u of samples)for(const side of[-1,1]){const px=ax+dx/L*u,pz=az+dz/L*u,fx=dz/L*side,fz=-dx/L*side,off=road.width/2+2.1+d/2;
   const x=px-fx*off,z=pz-fz*off,dist=Math.hypot(x-p.x,z-p.z);if(dist>maxDistance)continue;
   const yaw=Math.atan2(fx,fz);out.push({x,z,yaw,dist,road,roadPoint:{x:px,z:pz},pts:rect(x,z,w,d,yaw)});
  }
 }
 const preferred=p.preferredRoad?.toLowerCase();
 return out.sort((a,b)=>((preferred&&!(a.road.displayName||a.road.name||'').toLowerCase().includes(preferred)?10000:0)+a.dist)-((preferred&&!(b.road.displayName||b.road.name||'').toLowerCase().includes(preferred)?10000:0)+b.dist));
}
export function venuePlot(world,p,{w=14,d=15}={}){
 world.venuePlots??=[];const map=world.map,ob=map.bounds,b=(p.x<ob.minX||p.x>ob.maxX||p.z<ob.minZ||p.z>ob.maxZ)?(map.fullBounds??ob):ob; // v0.48: places in the map extension use its bounds
 for(const c of frontageCandidates(map,p,{w,d})){const {x,z,yaw,pts,road,roadPoint}=c;
  if(pts.some(([px,pz])=>px<b.minX+2||px>b.maxX-2||pz<b.minZ+2||pz>b.maxZ-2)||roadConflict(map,pts,1.6))continue;
  if(world.venuePlots.some(q=>Math.hypot(q.x-x,q.z-z)<Math.hypot(q.w,q.d)/2+Math.hypot(w,d)/2+1))continue;
  let ok=true;
  for(let xx=-w/2;xx<=w/2+.1&&ok;xx+=Math.min(1.5,w/2))for(let zz=-d/2;zz<=d/2+.1;zz+=Math.min(1.5,d/2)){
   const px=x+Math.cos(yaw)*xx+Math.sin(yaw)*zz,pz=z-Math.sin(yaw)*xx+Math.cos(yaw)*zz;
   if(!world.collision.isFree(px,pz,.65)||world.terrain.isWater(px,pz)||map.inHomeAccess?.(px,pz,.7)){ok=false;break;}
  }
  // Keep the entire street-side apron accessible (two vehicle-width mouths for fuel).
  for(let xx=-w/2;xx<=w/2&&ok;xx+=1.5)for(let t=d/2;t<=d/2+2.3;t+=.7){const px=x+Math.cos(yaw)*xx+Math.sin(yaw)*t,pz=z-Math.sin(yaw)*xx+Math.cos(yaw)*t;if(!world.collision.isFree(px,pz,.5)||world.terrain.isWater(px,pz)||map.inHomeAccess?.(px,pz,.5))ok=false;}
  if(!ok)continue;
  const pi=world.collision.addPolygon(pts,.01),frontage={roadId:road.id,roadName:road.displayName||road.name||('Unnamed '+road.type+' road'),roadPoint,roadWidth:road.width,setback:2.1};
  world.venuePlots.push({x,z,w,d,yaw,pi,pts,frontage});
  return{x:x+Math.sin(yaw)*(d/2-1.5),z:z+Math.cos(yaw)*(d/2-1.5),yaw,frontage,driveway:{length:3.9,width:w-1},plot:{x,z,w,d,pts,pi}};
 }
 throw new Error('No directly road-fronting venue plot near '+JSON.stringify(p));
}

// Re-pick visible front edges for non-rental buildings; never rotate an irregular
// OSM footprint into traffic or change a saved rental's entrance identity.
export function alignBuildingFronts(map,protectedIds=new Set()){
 let changed=0;
 for(const b of map.buildings){if(b.layoutHidden||protectedIds.has(String(b.id)))continue;
  let best=null;const pts=b.pts;
  for(let i=0;i<pts.length;i++){const a=pts[i],q=pts[(i+1)%pts.length],L=Math.hypot(q[0]-a[0],q[1]-a[1]);if(L<2.4)continue;
   const mx=(a[0]+q[0])/2,mz=(a[1]+q[1])/2,nr=streetReference(map,mx,mz);if(!nr)continue;
   const nx=(q[1]-a[1])/L,nz=-(q[0]-a[0])/L,dx=nr.px-mx,dz=nr.pz-mz,dot=(nx*dx+nz*dz)/(nr.dist||1);if(dot<.35)continue;
   const score=nr.dist+12*(1-dot)-Math.min(L,20)*.12;if(!best||score<best.score)best={i,score};
  }
  if(best&&b.front!==best.i){b.front=best.i;changed++;}
 }
 return changed;
}
