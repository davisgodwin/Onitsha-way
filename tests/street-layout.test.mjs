import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {MapData} from '../src/world/MapData.js';import {roadConflict,rect,repairStreetLayout} from '../src/world/StreetLayout.js';
const map=()=>new MapData(JSON.parse(fs.readFileSync(new URL('../public/data/onitsha_core.json',import.meta.url))));
test('all retained city footprints stay outside road setbacks',()=>{const m=map(),ids=m.buildings.map(b=>b.id),stats=repairStreetLayout(m);assert.equal(stats.surveyed,20397);assert.ok(stats.repaired>0);assert.deepEqual(m.buildings.map(b=>b.id),ids);assert.equal(m.buildings.filter(b=>!b.layoutHidden&&roadConflict(m,b.pts)).length,0);});
test('edge crossings are caught even with all building corners outside the road',()=>{const m=new MapData({meta:{playBounds:{}},spawn:[],graph:{nodes:[[-50,0],[50,0]],junctions:[]},roads:[{nodes:[0,1],width:6,type:'residential'}],buildings:[]});assert.ok(roadConflict(m,rect(0,0,20,20)));assert.equal(roadConflict(m,rect(0,20,10,10)),null);});
test('repairs are deterministic and idempotent',()=>{const a=map(),b=map();repairStreetLayout(a);repairStreetLayout(b);assert.deepEqual(a.buildings,b.buildings);const repaired=repairStreetLayout(a);assert.equal(repaired.repaired,0);});
test('raised bridge decks do not cut ground-floor plots',()=>{const m=new MapData({meta:{playBounds:{}},spawn:[],graph:{nodes:[[-50,0],[50,0]],junctions:[]},roads:[{nodes:[0,1],width:6,type:'primary',elevated:true}],buildings:[]});assert.equal(roadConflict(m,rect(0,0,20,20)),null);});

test('venue fronts are parallel to and immediately connected to their chosen road',async()=>{
 const {venuePlot}=await import('../src/world/StreetLayout.js');
 const m=new MapData({meta:{playBounds:{minX:-300,maxX:300,minZ:-300,maxZ:300}},spawn:[],graph:{nodes:[[-200,0],[200,0]],junctions:[]},roads:[{id:'test-road',name:'Test road',nodes:[0,1],width:8,type:'residential'}],buildings:[]});
 const world={map:m,collision:{isFree:()=>true,addPolygon:()=>0},terrain:{isWater:()=>false}};
 const v=venuePlot(world,{x:20,z:90},{w:23,d:25}),f=v.frontage;
 assert.equal(f.roadId,'test-road');assert.ok(Math.abs(Math.sin(v.yaw))<1e-6);
 const distance=Math.hypot(v.x-f.roadPoint.x,v.z-f.roadPoint.z);
 assert.ok(Math.abs(distance-(8/2+2.1+1.5))<1e-6,'anchor is within 3.6m of carriageway');
 assert.ok((f.roadPoint.x-v.x)*Math.sin(v.yaw)+(f.roadPoint.z-v.z)*Math.cos(v.yaw)>0,'front points towards road');
 assert.equal(roadConflict(m,v.plot.pts,1.6),null);
});
test('non-rental frontage repair preserves saved rental doors',async()=>{
 const{alignBuildingFronts}=await import('../src/world/StreetLayout.js');const m=new MapData({meta:{playBounds:{}},spawn:[],graph:{nodes:[[-50,0],[50,0]],junctions:[]},roads:[{nodes:[0,1],width:6,type:'residential'}],buildings:[{id:'rental',pts:rect(0,20,12,10),front:0},{id:'shop',pts:rect(20,20,12,10),front:2}]});
 alignBuildingFronts(m,new Set(['rental']));assert.equal(m.buildings[0].front,0);assert.equal(m.buildings[1].front,0);
});

test('venue frontage rejects tracks and narrow paths in favour of vehicle streets',async()=>{
 const{frontageCandidates}=await import('../src/world/StreetLayout.js');
 const m=new MapData({meta:{playBounds:{}},spawn:[],graph:{nodes:[[-200,0],[200,0],[-200,50],[200,50],[-200,100],[200,100]],junctions:[]},roads:[{id:'dirt-track',nodes:[0,1],width:6,type:'track'},{id:'narrow',nodes:[2,3],width:3,type:'service'},{id:'street',nodes:[4,5],width:8,type:'residential'}],buildings:[]});
 const c=frontageCandidates(m,{x:0,z:5});assert.ok(c.length>0);assert.ok(c.every(v=>v.road.id==='street'));
});
