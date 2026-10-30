import './helpers/loadModels24.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {VEHICLE_CATALOGUE} from '../src/data/VehicleCatalogue.js';
import {variantGeometry} from '../src/vehicles/VehicleVariants.js';
import {clipVehicleGeometry} from '../src/vehicles/VehicleGeometry.js';
import {CityLife} from '../src/life/CityLife.js';import {Economy} from '../src/economy/Economy.js';
const ray=new T.Raycaster();const meshFor=M=>{const mesh=new T.Mesh(variantGeometry(M.id),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();return mesh;};
function hit(mesh,p,d){ray.set(new T.Vector3(...p),new T.Vector3(...d));return ray.intersectObject(mesh)[0]?.point;}
test('cutting a crossing face preserves the exact boundary instead of deleting the face',()=>{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-1,0,0,1,0,0,1,1,0],3));g.computeVertexNormals();g.setAttribute('color',new T.Float32BufferAttribute([1,1,1,1,1,1,1,1,1],3));
 const cut=clipVehicleGeometry(g,0,0);assert.equal(cut.attributes.position.count,6);assert.ok([...cut.attributes.position.array].every(Number.isFinite));
 for(let i=0;i<cut.attributes.position.count;i++)assert.ok(cut.attributes.position.getX(i)>=0);
 assert.ok([...cut.attributes.position.array].includes(0));
});
for(const M of VEHICLE_CATALOGUE.filter(m=>!['keke','motorcycle'].includes(m.body)))test(M.label+': front, both cab sides, rear closure, roof and underfloor are present',()=>{
 const mesh=meshFor(M),cabZ=M.body==='pickup'?-.35:M.body==='lorry'?M.len*.32:0,y=M.body==='lorry'?1.7:M.body==='pickup'?M.height*.8:M.height*.69;
 for(const side of[-1,1]){const p=hit(mesh,[side*(M.wid+1),y,cabZ+.15],[-side,0,0]);assert.ok(p&&p.x*side>M.wid*.3,'missing side '+side);}
 const rear=hit(mesh,[0,y,-M.len],[0,0,1]);assert.ok(rear&&rear.z<cabZ+.1,'missing rear cab surface');
 const roof=hit(mesh,[0,M.height+2,cabZ+.2],[0,-1,0]);assert.ok(roof&&roof.y>M.height*.8,'missing roof');
 const floor=hit(mesh,[0,-1,cabZ+.2],[0,1,0]);assert.ok(floor&&floor.y<M.height*.55,'missing floor');
 for(const x of[-.25,0,.25])for(const y of[.55,.65,.75]){const p=hit(mesh,[M.wid*x,M.height*y,M.len],[0,0,-1]);assert.ok(p&&p.z>=0,'missing front panel');}
});
test('Hilux has a closed cab/window at the cut, an open-top bed with floor and all four bed walls',()=>{
 const M=VEHICLE_CATALOGUE.find(v=>v.id==='toyota_hilux'),m=meshFor(M);
 for(const y of[.95,1.3,1.5,1.68])for(const x of[-.45,0,.45]){
  const p=hit(m,[x,y,-.44],[0,0,1]);assert.ok(p&&p.z<-.34&&p.z>-.46,`rear cab hole at ${x},${y}`);
 }
 for(const z of[-.8,-1.4,-2.2]){const p=hit(m,[0,3,z],[0,-1,0]);assert.ok(p&&p.y<.92&&p.y>.7,'bed must be open above its solid floor');}
 for(const side of[-1,1]){const p=hit(m,[side*2,1.12,-1.4],[-side,0,0]);assert.ok(p&&p.x*side>.8,'bed side missing');}
 assert.ok(hit(m,[0,1.1,-3],[0,0,1]).z<-2.4,'tailgate');
 assert.ok(hit(m,[0,1.1,-1],[0,0,1]).z<-.4,'bed headboard');
});
function fixture(){const g={clock:{day:3,minutes:720},state:'playing',saveData:{street:{resolved:{}},character:{ageGroup:'adult'}},homes:{},club:{},civic:{},vehicles:{},transport:{},world:{collision:{inZone:()=>false}},player:{position:{x:0,z:0}},saveGame(){},openChoice(fn){this.view=fn();this.state='overlay';},closeChoice(){this.state='playing';},phoneServices:{message(){}},ui:{toast(){}},skills:{level:()=>1,add(){}},needs:{adjust(){}},story:{startChase(kind){g.chase=kind;g.state='chase';}}};g.economy=new Economy({balance:1000});const life=new CityLife(g);life.start();life.encounters=[{id:'test',name:'Test Road',x:0,z:0},{id:'other',name:'Second Road',x:500,z:500}];life.encounterGrid=new Map([['0,0',[life.encounters[0]]]]);return {g,life,e:life.encounters[0]};}
test('every actual agbero encounter maps to its own stable marker and opening/resolved status',()=>{
 const {g,life,e}=fixture();let places=life.places();assert.equal(places.length,2);assert.equal(places[0].id,'agbero:test');assert.equal(places[0].kind,'agbero');assert.equal(places[0].x,e.x);assert.equal(places[0].label,e.name);assert.equal(places[0].open,true);
 g.saveData.street.resolved['3:test']=true;assert.equal(life.places()[0].resolved,true);assert.equal(life.places()[0].label,e.name);g.clock.day++;g.clock.minutes=2*60;assert.equal(life.places()[0].open,false);assert.equal(life.places()[0].label,e.name);g.clock.minutes=12*60;assert.equal(life.places()[0].resolved,false);
});
test('agbero approach prompts without debit, walking away resolves today, repeat/manual spam is blocked',()=>{
 const {g,life,e}=fixture();life.update(1);assert.equal(g.economy.balance,1000);assert.match(g.view.title,/Agbero/);g.view.options.find(o=>o.label==='Keep walking').act();assert.equal(g.economy.balance,1000);assert.equal(life.beginEncounter(e),false);life.encounterCooldown=0;assert.equal(life.beginEncounter(e),false);g.clock.day++;assert.equal(life.beginEncounter(e),true);
});
test('agbero ₦200 choice debits only once; Run uses thugs runner, not police',()=>{
 let {g,life,e}=fixture();life.beginEncounter(e);const pay=g.view.options.find(o=>o.label==='Give ₦200 voluntarily');pay.act();pay.act();assert.equal(g.economy.balance,800);
 ({g,life,e}=fixture());life.beginEncounter(e);g.view.options.find(o=>o.label==='Run from the group').act();assert.equal(g.chase,'thugs');assert.equal(g.economy.balance,1000);
});
test('night, safe zones, indoor scenes, riding and driving cannot start an agbero encounter',()=>{
 for(const change of[g=>g.clock.minutes=60,g=>g.world.collision.inZone=()=>true,g=>g.homes.inside={},g=>g.club.inside={},g=>g.civic.inside={},g=>g.transport.riding=true,g=>g.vehicles.driving=true]){const {g,life,e}=fixture();change(g);assert.equal(life.beginEncounter(e),false);assert.equal(g.economy.balance,1000);}
});

test('coach front and rear have continuous opaque windows, floor and tyres in catalogue and fleet geometries',async()=>{
 const {coasterBus}=await import('../src/vehicles/CarModels.js');const {splitGlass}=await import('../src/sim/TrafficSystem.js');
 for(const geo of[variantGeometry('toyota_coaster'),coasterBus()]){const [,glass]=splitGlass(geo);assert.ok(glass);const mesh=new T.Mesh(glass,new T.MeshBasicMaterial({side:T.DoubleSide}));
  for(const side of[-1,1])for(const x of[-.6,0,.6])for(const y of[1.65,2,2.45]){const p=hit(mesh,[x,y,side*5],[0,0,-side]);assert.ok(p&&p.z*side>3.3,'missing end window');}
  const body=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));assert.ok(hit(body,[0,0,0],[0,1,0]).y<.8);
 }
});
test('closed-door coupe meshes match their catalogue surfaces without protruding duplicate dashboard geometry',async()=>{
 const {importedCar}=await import('../src/vehicles/ImportedCar.js');
 for(const id of['mercedes_amg_gt','porsche_911','ford_mustang_gt']){const M=VEHICLE_CATALOGUE.find(m=>m.id===id);assert.ok(M);
  const source=meshFor(M),owned=importedCar(M.body,'#ffffff',M);owned.updateMatrixWorld(true);
  for(const z of[.6,.85,1])for(const y of[.7,.87,1.0]){const a=hit(source,[3,y,z],[-1,0,0]),b=hit(owned,[3,y,z],[-1,0,0]);assert.equal(!!a,!!b);if(a)assert.ok(a.distanceTo(b)<.001,`${M.id}: duplicate interior outside body at ${y},${z}`);}
 }
});
