import './helpers/loadModels24.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateFlyer} from '../server/flyers.mjs';
import {PoliceSystem,POLICE} from '../src/sim/Police.js';
import {Economy} from '../src/economy/Economy.js';
import {variantGeometry} from '../src/vehicles/VehicleVariants.js';
import {VEHICLE_CATALOGUE} from '../src/data/VehicleCatalogue.js';
import {GLASS_MATERIAL} from '../src/sim/TrafficSystem.js';
import {ChaseRun} from '../src/story/ChaseRun.js';
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=';
test('flyer required; supported complete PNG accepted; text, HTML, SVG, spoofed and oversized payloads refused',()=>{
 assert.equal(validateFlyer(png),png);
 for(const bad of [null,'','My business','https://example.com/flyer.png','data:image/svg+xml;base64,AAAA','data:text/html;base64,AAAA','data:image/png;base64,iVBORw==','data:image/jpeg;base64,'+'A'.repeat(280000)])assert.throws(()=>validateFlyer(bad));
 const b=Buffer.from(png.split(',')[1],'base64');b.writeUInt32BE(90000,16);assert.throws(()=>validateFlyer('data:image/png;base64,'+b.toString('base64')));
});
test('routine police stop costs exactly ₦200 once and uses road centre rather than shoulder for stopping',()=>{
 const wallet={balance:1000},P=new PoliceSystem({}, {economy:new Economy(wallet),posts:[{id:'a',name:'Post',x:0,z:12,cx:0,cz:0}]});
 const s=P.notice('checkpoint',0,0,{open:true,nowS:10});assert.equal(s.amount,200);
 assert.equal(P.progress(0,0,0,11),'stopped');assert.equal(P.pay().ok,true);assert.equal(wallet.balance,800);assert.equal(P.pay().error,'no-stop');
});
test('broke checkpoint payment never debits; running adds a finite demand and wanted state, runner can escape or be caught',()=>{
 const wallet={balance:100},P=new PoliceSystem({}, {economy:new Economy(wallet),posts:[{id:'a',name:'Post',x:0,z:0}]});
 P.notice('checkpoint',0,0,{open:true,nowS:10});assert.equal(P.pay().ok,false);assert.equal(wallet.balance,100);assert.ok(P.stop);P.flee();assert.equal(P.state.wanted,1);assert.equal(P.owedTotal(),200);
 const r=new ChaseRun(42);r.health=1;r.rows=[{at:.01,lane:1,kind:'cart',hit:false}];r.next=100;assert.equal(r.update(.1),'caught');const escape=new ChaseRun(2);escape.distance=449.99;escape.next=1000;assert.equal(escape.update(.1),'escaped');
});
test('all enclosed remodels contain solid cabin fill and all glass writes opaque depth',()=>{
 const mat=GLASS_MATERIAL();assert.equal(mat.transparent,false);assert.equal(mat.depthWrite,true);assert.equal(mat.opacity,1);
 for(const v of VEHICLE_CATALOGUE){const geo=variantGeometry(v.id);if(!['keke','motorcycle'].includes(v.body))assert.equal(geo.userData.solidCabin,true,v.id);assert.ok(Array.from(geo.attributes.position.array).every(Number.isFinite));}
});
test('nearby passing players no longer drive idle NPC facing or head rotation; conversations still do',()=>{
 const s=fs.readFileSync(new URL('../src/npc/NPCSystem.js',import.meta.url),'utf8');assert.ok(!s.includes('dPlayer < 4.5'));assert.ok(!s.includes('targetHeading = dPlayer < 5'));assert.ok(s.includes('n === talkingTo'));
});
