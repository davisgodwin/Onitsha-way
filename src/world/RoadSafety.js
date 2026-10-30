import {segDistSq,pointInPolygon} from '../core/utils.js';
import {roadConflict} from './StreetLayout.js';
export const SIDEWALK_WIDTH=2.3;
export function segmentsCross(a,b,c,d){const k=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return k(a,b,c)*k(a,b,d)<0&&k(c,d,a)*k(c,d,b)<0;}
export function polygonNearSegment(pts,a,b,r){
 if(pointInPolygon(...a,pts)||pointInPolygon(...b,pts))return true;
 for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];if(segmentsCross(p,q,a,b)||Math.min(segDistSq(...p,...a,...b),segDistSq(...q,...a,...b),segDistSq(...a,...p,...q),segDistSq(...b,...p,...q))<r*r)return true;}return false;
}
export function validQuad(pts){
 if(pts.some(p=>!p.every(Number.isFinite)))return false;
 const cross=[];for(let i=0;i<4;i++){const a=pts[i],b=pts[(i+1)%4],c=pts[(i+2)%4];cross.push((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]));}
 return cross.every(v=>v>1e-8)||cross.every(v=>v< -1e-8);
}
/** Exact footprint checks, not just corner samples: catches roads through the middle. */
export function roadsideConflict(map,pts){
 if(roadConflict(map,pts,.035))return true;
 const b=map.bounds;if(b&&pts.some(([x,z])=>x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ))return true;
 for(const a of map.homeAccessCorridors??[])if(polygonNearSegment(pts,a.a,a.b,1.2))return true;
 return false;
}
/** Split only near conflicts; long clear stretches remain a single batched strip. */
export function clipRoadsideBand(map,innerA,innerB,outerA,outerB,{minLength=.65,maxDepth=12}={}){
 const result=[],mix=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
 const walk=(u,v,depth)=>{const p=[mix(innerA,innerB,u),mix(innerA,innerB,v),mix(outerA,outerB,v),mix(outerA,outerB,u)];
  if(!validQuad(p))return;
  if(!roadsideConflict(map,p)){result.push({u,v,pts:p});return;}
  if(depth>=maxDepth||Math.max(Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]),Math.hypot(p[2][0]-p[3][0],p[2][1]-p[3][1]))<minLength)return;
  const m=(u+v)/2;walk(u,m,depth+1);walk(m,v,depth+1);
 };walk(0,1,0);
 const merged=[];for(const q of result){const prev=merged.at(-1);if(prev&&Math.abs(prev.v-q.u)<1e-10){const pts=[prev.pts[0],q.pts[1],q.pts[2],prev.pts[3]];if(validQuad(pts)&&!roadsideConflict(map,pts)){prev.v=q.v;prev.pts=pts;continue;}}merged.push(q);}return merged;
}
