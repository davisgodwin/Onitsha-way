import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VEHICLE_LOTS} from '../src/data/VehicleCatalogue.js';
import {clearPlaceSign} from '../src/world/PlaceNameSigns.js';
import {rect} from '../src/world/StreetLayout.js';
import {defaultSave,migrate} from '../src/save/SaveSystem.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const site={x:0,z:0,yaw:0,pts:rect(0,0,11.4,2.2)};
function world(){return {map:{bounds:{minX:-100,maxX:100,minZ:-100,maxZ:100},segments:[],grid:new Map(),cell:50},collision:{polys:[],isFree:()=>true},terrain:{isWater:()=>false}};}
test('six named Onitsha dealerships keep all lot IDs and catalogue assignments',()=>{
 assert.deepEqual(VEHICLE_LOTS.map(l=>l.id),['lot-iweka','lot-oldmarket','lot-bridgehead','lot-ochanja','lot-mall','lot-fegge']);
 assert.deepEqual(VEHICLE_LOTS.map(l=>l.name),['Amalu David Automobile Company','Kokan Investment','Shopcar Nigeria','Akuma Motors Limited','Unlimited Zion Motors','Onwurah Autos']);
 assert.equal(new Set(VEHICLE_LOTS.flatMap(l=>l.models)).size,36);
});
test('stadium keeps stable save/navigation identity and existing footprint',()=>{
 const s=read('src/world/CityStadium.js');assert.ok(s.includes("id:'community-stadium',name:'Chuba Ikpeazu Memorial Stadium'"));assert.ok(s.includes('this.site=w.map.stadiumSite'));assert.ok(!s.includes('ONITSHA COMMUNITY STADIUM'));assert.ok(!s.includes('SHOPRITE DISTRICT · ORIGINAL GAME VENUE'));
});
test('place display paths contain names without approximate labels or visiting-hour suffixes',()=>{
 assert.ok(read('src/story/CareerCity.js').includes('label:s.name'));assert.ok(!read('src/ui/Minimap.js').includes("' (approx.)'"));
 const phone=read('src/phone/PhoneController.js').split('  places() {')[1].split('\n')[0];assert.ok(!phone.includes('approx'));assert.ok(!phone.includes('hours['));assert.ok(phone.includes("this.button(l.name,''"));
 assert.ok(!read('src/core/Game.js').includes('(visit 09:00–21:00)'));assert.ok(read('src/core/Game.js').includes('label:lot.name'));
 // Source confidence and opening-hour behaviour remain, even when presentation is clean.
 assert.ok(read('src/data/landmarks.js').includes("confidence: 'approximate'"));assert.ok(read('src/life/CityLife.js').includes('openAt(g.clock.minutes/60,v.hours)'));
});
test('stand footprint is rejected if any part enters a building, including a thin centre wall',()=>{
 const w=world();assert.equal(clearPlaceSign(w,site),true);w.collision.polys=[{height:10,pts:rect(0,0,.05,10),minX:-.025,maxX:.025,minZ:-5,maxZ:5}];assert.equal(clearPlaceSign(w,site),false);
});
test('stands cannot overlap stadium, dealership, other signs, home access, water or residents',()=>{
 let w=world();w.map.stadiumSite={pts:rect(0,0,150,112)};assert.equal(clearPlaceSign(w,site),false);
 w=world();w.pavedForecourts=[{x:0,z:0,heading:0}];assert.equal(clearPlaceSign(w,site),false);
 assert.equal(clearPlaceSign(world(),site,{reserved:[site]}),false);
 w=world();w.map.inHomeAccess=()=>true;assert.equal(clearPlaceSign(w,site),false);
 w=world();w.terrain.isWater=()=>true;assert.equal(clearPlaceSign(w,site),false);
 assert.equal(clearPlaceSign(world(),site,{residents:[{x:0,z:0}]}),false);
 w=world();w.map.bounds.maxX=3;assert.equal(clearPlaceSign(w,site),false);
});
test('naming update does not change mission or wallet save schema/state',()=>{
 const d=defaultSave({name:'Ada',gender:'female'});d.jobs.missions.records['find-your-friend']={status:'completed',bindings:{giver:'career-city:market',target:'gate:117'},progress:2,rewardClaimed:true,acceptedAt:100,completedAt:200};
 const out=migrate(structuredClone(d));assert.equal(out.version,23); // v18 (open life) is the current schema; missions and wallet must still be untouchedassert.deepEqual(out.jobs,d.jobs);assert.deepEqual(out.wallet,d.wallet);
});
