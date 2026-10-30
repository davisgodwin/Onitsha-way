import * as THREE from 'three';
import {GeoBuilder} from './GeoBuilder.js';
import {clipRoadsideBand} from './RoadSafety.js';
const MAJOR=new Set(['trunk','primary','secondary','tertiary','trunk_link','primary_link','secondary_link','tertiary_link']);
export const isMajorRoad=r=>MAJOR.has(r.type);
const dirtRoad=r=>r.surface==='dirt'||(!r.graPaved&&['track','path','footway'].includes(r.type)); // v0.52 GRA roads are tarred
/** Length-preserving, bounded offsets for street props. Closed rings share their first/last join. */
export function offsetPolyline(pts,off){
 const closed=pts.length>3&&Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<1e-5,n=closed?pts.length-1:pts.length;
 return pts.map((p,index)=>{const i=closed?index%n:index;let prev=null,next=null;
  for(let k=1;k<n;k++){const j=closed?(i-k+n)%n:i-k;if(j<0)break;const q=pts[j],L=Math.hypot(p[0]-q[0],p[1]-q[1]);if(L>1e-5){prev=[(p[0]-q[0])/L,(p[1]-q[1])/L,L];break;}}
  for(let k=1;k<n;k++){const j=closed?(i+k)%n:i+k;if(j>=n)break;const q=pts[j],L=Math.hypot(q[0]-p[0],q[1]-p[1]);if(L>1e-5){next=[(q[0]-p[0])/L,(q[1]-p[1])/L,L];break;}}
  const a=prev??next,b=next??prev;if(!a)return [...p];let tx=a[0]+b[0],tz=a[1]+b[1],L=Math.hypot(tx,tz);if(L<1e-5){tx=b[0];tz=b[1];L=1;}tx/=L;tz/=L;
  const sn=Math.max(.1,a[0]*tx+a[1]*tz),extension=Math.abs(off)*Math.sqrt(Math.max(0,1/(sn*sn)-1));
  let scale=Math.min(1.35,1/sn);if(extension>Math.min(a[2],b[2])*.4)scale=1;
  return[p[0]-tz*off*scale,p[1]+tx*off*scale];
 });
}
function cumulative(pts){const a=[0];for(let i=1;i<pts.length;i++)a.push(a.at(-1)+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));return a;}
function pointAt(pts,cum,d){for(let i=1;i<pts.length;i++)if(d<=cum[i]){const t=Math.max(0,Math.min(1,(d-cum[i-1])/(cum[i]-cum[i-1]||1)));return[pts[i-1][0]+(pts[i][0]-pts[i-1][0])*t,pts[i-1][1]+(pts[i][1]-pts[i-1][1])*t];}return [...pts.at(-1)];}
export function slicePolyline(pts,cum,s0,s1){const a=[pointAt(pts,cum,s0)];for(let i=1;i<pts.length-1;i++)if(cum[i]>s0&&cum[i]<s1)a.push([...pts[i]]);a.push(pointAt(pts,cum,s1));return a;}
function openIntervals(road,map,cum,clear){const cuts=[];road.nodes.forEach((ni,k)=>{if(map.isJunction(ni)||k===0||k===road.nodes.length-1)cuts.push([cum[k]-clear(ni),cum[k]+clear(ni)]);});cuts.sort((a,b)=>a[0]-b[0]);const keep=[],L=cum.at(-1);let s=0;for(const[a,b]of cuts){if(a>s+1)keep.push([s,Math.min(a,L)]);s=Math.max(s,b);}if(L>s+1)keep.push([s,L]);return keep.filter(([a,b])=>b-a>1.5);}
const PROFILE=[[.07,.055,.65],[.07,.19,.9],[.23,.19,1],[.31,.14,.9],[.7,.14,.7],[2.3,.14,.88],[2.3,0,.75]];
function curbBand(gb,map,road,pts,half,side,audit){
 // A single bounded offset frame for every cross-section prevents stretched multi-profile miters.
 const inner=offsetPolyline(pts,side*(half+PROFILE[0][0])),outer=offsetPolyline(pts,side*(half+2.3));
 const cum=cumulative(pts),col=new THREE.Color();
 for(let i=0;i<pts.length-1;i++){
  const L=cum[i+1]-cum[i];if(L<.05)continue;
  const ranges=clipRoadsideBand(map,inner[i],inner[i+1],outer[i],outer[i+1]);audit.curbCandidates++;if(ranges.length!==1||ranges[0].u>0||ranges[0].v<1)audit.trimmedCurbs++;
  const P=(j,t)=>{const o=(PROFILE[j][0]-.07)/(2.3-.07),u=inner[i][0]+(inner[i+1][0]-inner[i][0])*t,v=inner[i][1]+(inner[i+1][1]-inner[i][1])*t,ox=outer[i][0]+(outer[i+1][0]-outer[i][0])*t,oz=outer[i][1]+(outer[i+1][1]-outer[i][1])*t;return[u+(ox-u)*o,PROFILE[j][1],v+(oz-v)*o];};
  for(const q of ranges){audit.curbBands++;audit.curbFootprints.push({road:road.id,pts:q.pts});
   const dx=pts[i+1][0]-pts[i][0],dz=pts[i+1][1]-pts[i][1],ox=-dz/L*side,oz=dx/L*side;
   for(let k=0;k<PROFILE.length-1;k++){const[o,h,c]=PROFILE[k],[oo,hh,cc]=PROFILE[k+1],dO=oo-o,dH=hh-h,n=Math.hypot(dO,dH)||1;col.setScalar((c+cc)/2);gb.quad([P(k,q.u),P(k,q.v),P(k+1,q.v),P(k+1,q.u)],[[cum[i]/2.5+L*q.u/2.5,o],[cum[i]/2.5+L*q.v/2.5,o],[cum[i]/2.5+L*q.v/2.5,oo+Math.abs(dH)],[cum[i]/2.5+L*q.u/2.5,oo+Math.abs(dH)]],[ox*-dH/n,dO/n,oz*-dH/n],col);}
  }
 }
}
/** Constant-width segment ribbons + bounded round joins, never long acute miters or convex-hull spikes. */
export function buildRoads(map,tex){
 const group=new THREE.Group();group.name='Roads';const caps=new Map(),nodeWidth=new Map();
 // v0.48: the ribbons are built per 1 km tile (by each road's middle point), so the renderer skips the tiles out of view
 const tiles=new Map(),tile=(x,z)=>{const k=Math.floor(x/1000)+','+Math.floor(z/1000);if(!tiles.has(k))tiles.set(k,{asphalt:new GeoBuilder(),dirt:new GeoBuilder(),marks:new GeoBuilder(),drains:new GeoBuilder()});return tiles.get(k);};
 const audit={roads:0,segments:0,roundJoins:0,curbCandidates:0,trimmedCurbs:0,curbBands:0,curbFootprints:[]};
 for(const r of map.roads)if(!r.elevated)for(const n of r.nodes)nodeWidth.set(n,Math.max(nodeWidth.get(n)??0,r.width));
 for(const road of map.roads){if(road.elevated)continue;audit.roads++;const mid=road.points[Math.floor(road.points.length/2)],{asphalt,dirt,marks,drains}=tile(mid[0],mid[1]),pts=road.points,half=road.width/2,isDirt=dirtRoad(road),gb=isDirt?dirt:asphalt,y=isDirt?.033:.055,cum=cumulative(pts);
  for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.001)continue;const nx=-dz/L*half,nz=dx/L*half;
   gb.quad([[a[0]+nx,y,a[1]+nz],[a[0]-nx,y,a[1]-nz],[b[0]-nx,y,b[1]-nz],[b[0]+nx,y,b[1]+nz]],[[0,cum[i]/7],[1,cum[i]/7],[1,cum[i+1]/7],[0,cum[i+1]/7]],[0,1,0]);audit.segments++;
  }
  for(let i=0;i<pts.length;i++){let round=i===0||i===pts.length-1;if(!round){const a=pts[i-1],p=pts[i],b=pts[i+1],u=[p[0]-a[0],p[1]-a[1]],v=[b[0]-p[0],b[1]-p[1]],L=Math.hypot(...u)*Math.hypot(...v);round=L>1e-6&&(u[0]*v[0]+u[1]*v[1])/L<.999;}
   if(!round)continue;const p=pts[i],key=`${isDirt?'d':'p'}:${p[0].toFixed(3)},${p[1].toFixed(3)}`,old=caps.get(key);if(!old||old.r<half)caps.set(key,{x:p[0],z:p[1],r:half,y,gb});
  }
  if(isMajorRoad(road)&&!isDirt){for(const[s0,s1]of openIntervals(road,map,cum,n=>(nodeWidth.get(n)??road.width)/2+4))for(let s=s0;s+3<=s1;s+=7){const seg=slicePolyline(pts,cum,s,s+3);for(let j=0;j<seg.length-1;j++){const a=seg[j],b=seg[j+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<.01)continue;const nx=-(b[1]-a[1])/L*.07,nz=(b[0]-a[0])/L*.07;marks.quad([[a[0]+nx,y+.005,a[1]+nz],[a[0]-nx,y+.005,a[1]-nz],[b[0]-nx,y+.005,b[1]-nz],[b[0]+nx,y+.005,b[1]+nz]],[[0,0],[1,0],[1,1],[0,1]],[0,1,0],new THREE.Color('#eee8d6'));}}}
  if(isMajorRoad(road)&&road.type!=='construction')for(const side of[-1,1])curbBand(drains,map,road,pts,half,side,audit);
 }
 for(const{x,z,r,y,gb}of caps.values()){const N=20,base=gb.vertexCount;gb.vert(x,y,z,0,1,0,.5,z/7);for(let k=0;k<=N;k++){const a=k/N*Math.PI*2,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;gb.vert(px,y,pz,0,1,0,.5+Math.cos(a)*.5,pz/7);}for(let k=1;k<=N;k++)gb.i.push(base,base+k+1,base+k);audit.roundJoins++;}
 const add=(gb,mat,name)=>{if(!gb.vertexCount)return;const m=new THREE.Mesh(gb.build(),mat);m.name=name;m.receiveShadow=true;group.add(m);};
 const M={asphalt:new THREE.MeshStandardMaterial({map:tex.asphalt,roughness:.92,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2}),dirt:new THREE.MeshStandardMaterial({map:tex.dirtRoad,roughness:1,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}),marks:new THREE.MeshStandardMaterial({vertexColors:true,roughness:.8,polygonOffset:true,polygonOffsetFactor:-4,polygonOffsetUnits:-4}),drains:new THREE.MeshStandardMaterial({map:tex.concrete,vertexColors:true,roughness:.95})};
 for(const t of tiles.values()){add(t.asphalt,M.asphalt,'asphalt');add(t.dirt,M.dirt,'dirtRoads');add(t.marks,M.marks,'markings');add(t.drains,M.drains,'drains');}
 group.userData.audit=audit;return group;
}
