import {HOME_GOODS, GOOD_BY_ID, isNonBlocking} from '../buy/Goods.js';
/** Footprints and placement rules for furniture. Pure functions (no scene), so they are unit-tested directly. */
export const FURNITURE_SIZE=Object.fromEntries(HOME_GOODS.filter(i=>i.size).map(i=>[i.id,i.size]));
export const ROTATION_STEP=45;
export function furniturePolygon(id,x,z,rotation=0,margin=.08){const[w,d]=FURNITURE_SIZE[id]??[1,1],a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return[[-w/2-margin,-d/2-margin],[w/2+margin,-d/2-margin],[w/2+margin,d/2+margin],[-w/2-margin,d/2+margin]].map(([u,v])=>[x+u*c-v*s,z+u*s+v*c]);}
export function polygonsOverlap(a,b){for(const p of[a,b])for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length],n=[-(q[1]-p[i][1]),q[0]-p[i][0]];const aa=a.map(v=>v[0]*n[0]+v[1]*n[1]),bb=b.map(v=>v[0]*n[0]+v[1]*n[1]);if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;}return true;}
export function pointInPolygon(x,z,pts){let inside=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[xi,zi]=pts[i],[xj,zj]=pts[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;}return inside;}
/** The facing (degrees, in this module's rotation convention) that points an item's front along (nx, nz). */
export const facing=(nx,nz)=>((Math.round(Math.atan2(-nx,nz)*180/Math.PI)%360)+360)%360;
/**
 * Wall segments a wall-mounted item can hang on: the room's outer walls and thin wall slabs inside it.
 * Built-in counters and cupboards are not walls.
 */
export function wallSegments(bounds,obstacles=[]){
  const b=bounds,segs=[[b.minX,b.minZ,b.maxX,b.minZ,0,1],[b.maxX,b.minZ,b.maxX,b.maxZ,-1,0],[b.maxX,b.maxZ,b.minX,b.maxZ,0,-1],[b.minX,b.maxZ,b.minX,b.minZ,1,0]];
  for(const pts of obstacles){if(!pts||pts.length!==4)continue;const e=[0,1,2,3].map(i=>{const p=pts[i],q=pts[(i+1)%4];return[p[0],p[1],q[0],q[1],Math.hypot(q[0]-p[0],q[1]-p[1])];});const thin=Math.min(e[0][4],e[1][4]);if(thin>.3)continue;
    const cx=pts.reduce((s,p)=>s+p[0],0)/4,cz=pts.reduce((s,p)=>s+p[1],0)/4;
    for(const[x1,z1,x2,z2,len]of e){if(len<.6)continue;const mx=(x1+x2)/2,mz=(z1+z2)/2;let nx=-(z2-z1)/len,nz=(x2-x1)/len;if((mx-cx)*nx+(mz-cz)*nz<0){nx=-nx;nz=-nz;}segs.push([x1,z1,x2,z2,nx,nz]);}}
  return segs;
}
/**
 * Snap a wall item to the nearest wall within reach. Returns {x, z, rotation} (front facing into the room) or null.
 * The item must fit along the wall without hanging past its end (door gaps split walls into segments).
 */
export function snapToWall(id,x,z,segments,reach=1.2){
  const[w,d]=FURNITURE_SIZE[id]??[.6,.06];let best=null;
  for(const[x1,z1,x2,z2,nx,nz]of segments){const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);if(len<w+.1)continue;
    let t=((x-x1)*dx+(z-z1)*dz)/(len*len);t=Math.max((w/2+.05)/len,Math.min(1-(w/2+.05)/len,t));
    const px=x1+dx*t,pz=z1+dz*t,dist=Math.hypot(x-px,z-pz),side=(x-px)*nx+(z-pz)*nz;
    if(dist>reach||side<-.05)continue;
    if(!best||dist<best.dist)best={dist,x:px+nx*(d/2+.01),z:pz+nz*(d/2+.01),rotation:facing(nx,nz)};}
  return best&&{x:best.x,z:best.z,rotation:best.rotation};
}
/**
 * Check a placement. `mount` comes from the catalogue:
 *  floor   – inside the room, clear of walls, built-ins, other floor furniture, doors and interaction points
 *  ceiling – inside the room, clear of other ceiling fittings
 *  wall    – already snapped to a wall; clear of other wall items
 *  surface / bedding – inside the room (they sit on a table, cabinet, bed, or the floor) and never block walking
 */
export function validatePlacement({id,x,z,rotation=0,bounds,obstacles=[],others=[],protectedPoints=[],wallOthers=[],ceilingOthers=[]}){
  if(!Number.isFinite(x)||!Number.isFinite(z)||!Number.isFinite(rotation))return{ok:false,error:'Invalid position'};
  const good=GOOD_BY_ID[id],mount=good?.mount??'floor',p=furniturePolygon(id,x,z,rotation,mount==='wall'?0:.08);
  const edge=mount==='wall'?-.02:.12;
  if(p.some(([x,z])=>x<bounds.minX+edge||x>bounds.maxX-edge||z<bounds.minZ+edge||z>bounds.maxZ-edge))return{ok:false,error:mount==='wall'?'Hang it on a wall inside the room':'Keep the item inside the room'};
  if(mount==='ceiling')return ceilingOthers.some(o=>polygonsOverlap(p,o))?{ok:false,error:'Another ceiling fitting is there'}:{ok:true,polygon:p};
  if(mount==='wall')return wallOthers.some(o=>polygonsOverlap(p,o))?{ok:false,error:'Another wall item is there'}:{ok:true,polygon:p};
  if(isNonBlocking(id))return{ok:true,polygon:p};
  if(obstacles.some(o=>polygonsOverlap(p,o)))return{ok:false,error:'A wall or built-in furnishing is in the way'};
  if(others.some(o=>polygonsOverlap(p,o)))return{ok:false,error:'Another furnishing is in the way'};
  if(protectedPoints.some(q=>{const[w,d]=FURNITURE_SIZE[id]??[1,1];return Math.hypot(x-q.x,z-q.z)<Math.max(w,d)/2+(q.radius??.9);}))return{ok:false,error:'Keep doors, stairs and interaction points clear'};
  return{ok:true,polygon:p};
}
