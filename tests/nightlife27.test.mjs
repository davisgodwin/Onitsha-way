import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {roadLampSamples,LAMP_SPACING} from '../src/world/StreetLighting.js';
import {LAYOUT_SIZE,BATHROOM_SIZE} from '../src/housing/Interiors.js';
const root=new URL('../',import.meta.url);
test('lamp spacing is continuous across bent street segments and covers short roads',()=>{
 const samples=roadLampSamples({points:[[0,0],[9,0],[9,31],[49,31]]});assert.equal(samples.length,4);assert.ok(samples.every(s=>[s.x,s.z,s.dx,s.dz,s.at].every(Number.isFinite)));for(let i=1;i<samples.length;i++)assert.ok(samples[i].at-samples[i-1].at<=LAMP_SPACING);
 assert.equal(roadLampSamples({points:[[0,0],[6,0]]}).length,1);assert.equal(roadLampSamples({points:[[0,0],[0,0]]}).length,0);
});
test('all home floor plans support the larger bathroom and clear circulation',()=>{assert.ok(BATHROOM_SIZE.width*BATHROOM_SIZE.depth>=7);assert.ok(BATHROOM_SIZE.door>=1.1);assert.ok(LAYOUT_SIZE.selfcon.W[0]>=6);for(const S of Object.values(LAYOUT_SIZE))assert.ok(S.D[0]>=7);});
test('three bundled MP3s exist with attribution and offline cache rules',()=>{for(const id of ['iweka-afterglow','niger-breeze','market-lights']){assert.ok(fs.statSync(new URL(`public/audio/afrobeat/${id}.mp3`,root)).size>100000);assert.ok(fs.readFileSync(new URL('public/sw.js',root),'utf8').includes(id+'.mp3'));}assert.ok(fs.existsSync(new URL('public/audio/afrobeat/README.txt',root)));});
test('home essentials are no longer gated by unfurnished mode',()=>{const s=fs.readFileSync(new URL('src/housing/Interiors.js',root),'utf8');for(const name of ['lamp','kitchen','bathroom']){const section=s.slice(s.indexOf('function '+name+'('),s.indexOf('\n}',s.indexOf('function '+name+'(')));assert.ok(!section.includes('if(L.unfurnished)return'),name);}});


test('all 20 home layout variants retain connected circulation at the real player radius',async()=>{
 const {buildInteriors}=await import('../src/housing/Interiors.js'),{CollisionWorld}=await import('../src/physics/CollisionWorld.js'),T=await import('three');
 const old=globalThis.document,ctx=new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]??(()=>{})});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 try{const col=new CollisionWorld(),interiors=buildInteriors(new T.Scene(),col);
  for(const [id,S]of Object.entries(LAYOUT_SIZE))for(const n of [0,1])for(const bare of [true,false]){
   interiors.resize(id,S.W[n],S.D[n],bare);const lay=interiors.layouts[id],b=lay.bounds,step=.18,w=Math.ceil((b.maxX-b.minX)/step),h=Math.ceil((b.maxZ-b.minZ)/step),queue=[[Math.round((lay.spawn.x-b.minX)/step),Math.round((lay.spawn.z-b.minZ)/step)]],seen=new Set();
   assert.ok(col.isFree(lay.spawn.x,lay.spawn.z,.325),id+' spawn');
   for(let j=0;j<queue.length;j++){const [x,z]=queue[j];for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,c=z+dz,key=a+c*w;if(a<=0||c<=0||a>=w||c>=h||seen.has(key))continue;if(!col.isFree(b.minX+a*step,b.minZ+c*step,.325))continue;seen.add(key);queue.push([a,c]);}}
   for(const item of lay.items.filter(i=>['bathroom','switch','stove','sink','stairs','door','cupboard'].includes(i.kind)))assert.ok(queue.some(([x,z])=>Math.hypot(b.minX+x*step-item.x,b.minZ+z*step-item.z)<.35),`${id} ${n?'max':'min'} bare=${bare} ${item.kind}`);
  }
 }finally{globalThis.document=old;}
});
