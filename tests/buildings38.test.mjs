import test from 'node:test';import assert from 'node:assert/strict';
import {loadWorld} from './helpers/loadWorld.mjs';
import {obb} from '../src/world/BuildingBounds.js';
import {mulberry32} from '../src/core/utils.js';
import {classifyBuilding,BUILDING_TYPES,oldCoreWeight,planBuilding,frontEdge} from '../src/world/buildings/ResidentialKit.js';
const {map,landmarks}=loadWorld();
const area=p=>{let a=0;for(let i=0;i<p.length;i++){const[x1,z1]=p[i],[x2,z2]=p[(i+1)%p.length];a+=x1*z2-x2*z1;}return Math.abs(a)/2;};
const inPoly=(x,z,pts)=>{let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[xi,zi]=pts[i],[xj,zj]=pts[j];if((zi>z)!==(zj>z)&&x<((xj-xi)*(z-zi))/(zj-zi)+xi)c=!c;}return c;};
const items=map.buildings.filter(b=>b.pts.length>=3).map(b=>{const box=obb(b.pts),a=area(b.pts);return{b,kind:b.kind,levels:b.levels,area:a,box,rect:box?a/box.area:0,cx:b.pts[0][0],cz:b.pts[0][1],gh:3,H:3*b.levels};});
const types=it=>classifyBuilding(it,mulberry32(Math.floor(it.b.seed*1e9)+4401),{oldCore:oldCoreWeight(landmarks,it.cx,it.cz)});
test('every residential footprint gets one of the Onitsha building types, deterministically, with a real mix',()=>{
  const count={};for(const it of items){const t=types(it);if(it.kind==='residential')assert.ok(BUILDING_TYPES[t],String(t));if(t)count[t]=(count[t]??0)+1;assert.equal(types(it),t,'same building, same type');}
  assert.deepEqual(Object.keys(count).sort(),Object.keys(BUILDING_TYPES).filter(t=>!['villa','mansion'].includes(t)).sort(),'all eight types appear (v0.48: villas and mansions only in GRA)');
  const res=items.filter(i=>i.kind==='residential').length;for(const[t,n]of Object.entries(count))if(t!=='shopsrooms')assert.ok(n/res>0.02&&n/res<0.5,`${t} ${n}`);
});
test('older bungalows are more common in the old trading districts than in the newer north-east',()=>{
  const share=(f)=>{const r=items.filter(i=>i.kind==='residential'&&i.levels===1&&f(i));return r.filter(i=>types(i)==='oldbungalow').length/r.length;};
  const old=share(i=>oldCoreWeight(landmarks,i.cx,i.cz)>0.6),nw=share(i=>oldCoreWeight(landmarks,i.cx,i.cz)<0.1);assert.ok(old>nw+0.1,`${old} vs ${nw}`);
});
test('front parts (veranda, porch, balconies) are only planned where the ground is clear, and face outward',()=>{
  let verandas=0,blocked=0;
  for(const it of items.slice(0,3000)){if(it.kind!=='residential'||it.b.front<0)continue;
    const p=planBuilding(it,mulberry32(7),{clear:()=>true,inPoly});if(p?.veranda){verandas++;const e=p.veranda.edge;const[px,pz]=p.veranda.pillars[0];assert.ok(!inPoly(px,pz,it.b.pts),'pillars stand outside the house');}
    const q=planBuilding(it,mulberry32(7),{clear:()=>false,inPoly});if(q?.veranda||q?.porch)blocked++;}
  assert.ok(verandas>100);assert.equal(blocked,0);
});
