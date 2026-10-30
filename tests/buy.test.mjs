import * as THREE from 'three';
import fs from 'node:fs/promises';
import test from 'node:test';import assert from 'node:assert/strict';
import {furnitureModel,disposeModel} from '../src/buy/FurnitureModels.js';
import {loadFurnitureLibraryFromFiles,kitLoaded} from '../src/buy/FurnitureLibrary.js';
import {Economy} from '../src/economy/Economy.js';import {HomeUpgrades,HOME_GOODS,migrateFurniturePieces,MAX_OF_ONE} from '../src/life/HomeUpgrades.js';
import {DESIGN_GOODS,GOOD_CATEGORY,BUY_CATEGORIES} from '../src/buy/Catalogue.js';
import {GOOD_BY_ID,TABS,SHOPS,PALETTES,tierOf,resaleValue,goodsForShop,isNonBlocking} from '../src/buy/Goods.js';
import {validatePlacement,FURNITURE_SIZE,snapToWall,wallSegments,furniturePolygon} from '../src/housing/Placement.js';
import {migrate,defaultSave} from '../src/save/SaveSystem.js';
const setup=(money=50000,allowed=true)=>{const state={},wallet={balance:money};const economy=new Economy(wallet);return{state,wallet,economy,h:new HomeUpgrades(state,{economy,housing:{get:()=>({id:'home'}),access:()=>({use:allowed})}})};};
const OLD_IDS=['bed','singlebed','kingbed','bunkbed','wardrobe','nightstand','fridge','cooker','minifridge','range','kitchencabinet','diningtable','diningchair','shower','toilet','sink','bathtub','washer','bathcabinet','sofa','fan','armchair','loveseat','coffeetable','ottoman','tv','speaker','console','radio','boardtable','aquarium','desk','bookshelf','writingdesk','easel','guitar','sewing','lamp','tablelamp','lantern','archedlamp','tripodlamp','rug','plant','art','curtains','largerug','fern','mirror','vase','divider','generator','inverter','compactgen','powerstation','batterybank','largeinverter'];

test('catalogue: about 150+ items with id, tab, shop, tier, resale, model, size and valid variants',()=>{
  assert.ok(HOME_GOODS.length>=150,`only ${HOME_GOODS.length} items`);
  assert.equal(new Set(HOME_GOODS.map(i=>i.id)).size,HOME_GOODS.length,'ids are unique');
  for(const id of OLD_IDS)assert.ok(GOOD_BY_ID[id],`saved item id ${id} still exists`);
  const tabs=new Set(TABS.map(t=>t[0]));
  for(const i of HOME_GOODS){
    assert.ok(tabs.has(i.tab)&&i.tabs.every(t=>tabs.has(t)),i.id+' tab');assert.ok(SHOPS[i.shop],i.id+' shop');
    assert.ok(Number.isInteger(i.price)&&i.price>0,i.id+' price');assert.equal(i.tier,tierOf(i.price),i.id+' tier');
    assert.equal(i.resale,resaleValue(i.price));assert.ok(i.resale>0&&i.resale<i.price,i.id+' resale');
    assert.ok(i.model,i.id+' model');if(i.variants)assert.ok(PALETTES[i.variants],i.id+' palette');
    assert.ok(['floor','surface','wall','ceiling','bedding','outdoor'].includes(i.mount),i.id+' mount');
    if(i.mount!=='outdoor')assert.ok(FURNITURE_SIZE[i.id]?.every(v=>v>0),i.id+' size');
    assert.ok(BUY_CATEGORIES.some(c=>c[0]===GOOD_CATEGORY[i.id]),i.id);
  }
});
test('catalogue: every brief section has items, all three tiers exist, every shop sells something',()=>{
  for(const[t]of TABS)assert.ok(HOME_GOODS.filter(i=>i.tabs.includes(t)).length>=5,t);
  for(const tier of ['budget','standard','premium'])assert.ok(HOME_GOODS.filter(i=>i.tier===tier).length>=15,tier);
  for(const shop of Object.keys(SHOPS))assert.ok(goodsForShop(shop).length>=20,shop);
  assert.ok(HOME_GOODS.filter(i=>i.variants).length>=60,'colour/material variants on many items');
  // prices sit inside the game economy: nothing below a cheap meal, nothing above a used car
  for(const i of HOME_GOODS)assert.ok(i.price>=500&&i.price<=250000,i.id);
});
test('paid finishes cost once and can be re-applied free, per home',()=>{const{h,economy,state}=setup();assert.ok(h.buyDesign('a','peach','paint').ok);assert.equal(economy.balance,47000);assert.ok(h.buyDesign('a','cream','paint').ok);assert.ok(h.buyDesign('a','peach','paint').ok);assert.equal(economy.balance,47000);assert.ok(h.buyDesign('a','slate','floor').ok);assert.equal(economy.balance,43500);assert.equal(state.upgrades.a.paint,'#e6ad8c');assert.equal(state.upgrades.a.floor,'#a8b8c5');assert.ok(h.buyDesign('b','peach','paint').ok);assert.equal(economy.balance,40500);});
test('free finishes never enter a zero-naira economy transaction',()=>{const{h,economy}=setup(0);for(const d of DESIGN_GOODS.filter(d=>d.price===0))assert.ok(h.buyDesign('a',d.id,d.type).ok);assert.equal(economy.balance,0);assert.equal(economy.state.ledger.length,0);});
test('insufficient funds and unowned homes never apply a finish',()=>{const a=setup(100);assert.equal(a.h.buyDesign('a','gold','paint').error,'insufficient-funds');assert.notEqual(a.state.upgrades.a.paint,'#d6b34d');assert.equal(a.economy.balance,100);const b=setup(50000,false);assert.equal(b.h.buyDesign('a','peach','paint').error,'rent-required');assert.equal(b.economy.balance,50000);});

test('buying makes one stored piece and charges its price exactly once',()=>{const{h,economy}=setup(100000);const r=h.buy('a','armchair');assert.ok(r.ok);assert.equal(economy.balance,100000-6500);assert.equal(r.piece.floor,'storage');assert.equal(h.pieces('a').length,1);
  const r2=h.buy('a','armchair',{color:PALETTES.fabric.colors[1][1]});assert.ok(r2.ok);assert.notEqual(r2.piece.pid,r.piece.pid);assert.equal(economy.balance,100000-13000);assert.equal(h.count('a','armchair'),2);assert.equal(h.pieces('b').length,0,'pieces belong to their home');
  // the ledger has one entry per piece
  assert.equal(economy.state.ledger.filter(e=>e.key.startsWith('furnish:a:')).length,2);});
test('failed purchases charge nothing and add nothing',()=>{const{h,economy}=setup(1000);assert.equal(h.buy('a','sofa').error,'insufficient-funds');assert.equal(economy.balance,1000);assert.equal(h.pieces('a').length,0);
  assert.equal(h.buy('a','nope').error,'unknown-item');assert.equal(h.buy('a','monobloc',{color:'#123456'}).error,'unknown-colour');assert.equal(economy.balance,1000);
  const b=setup(100000,false);assert.equal(b.h.buy('a','sofa').error,'rent-required');assert.equal(b.economy.balance,100000);});
test('delivery fee is paid in the same transaction as the item',()=>{const{h,economy}=setup(100000);const r=h.buy('a','tv',{fee:1450});assert.ok(r.ok);assert.equal(economy.balance,100000-18000-1450);assert.equal(economy.state.ledger.length,1);});
test('selling pays the resale value exactly once and removes only that piece',()=>{const{h,economy}=setup(100000);const a=h.buy('a','sofa').piece,b=h.buy('a','sofa').piece;const before=economy.balance;
  const s=h.sell('a',a.pid);assert.ok(s.ok);assert.equal(s.value,resaleValue(18000));assert.equal(economy.balance,before+s.value);
  assert.equal(h.sell('a',a.pid).error,'not-owned');assert.equal(economy.balance,before+s.value,'a second sale pays nothing');
  assert.equal(h.pieces('a').length,1);assert.equal(h.pieces('a')[0].pid,b.pid);
  assert.equal(h.sell('b',b.pid).error,'not-owned','cannot sell another home\'s piece');
  // a sold piece's id is never reused, so a later purchase gets a fresh ledger key
  const c=h.buy('a','sofa').piece;assert.ok(![a.pid,b.pid].includes(c.pid));});
test('place, store, re-place and recolour keep the same piece; outdoor items install themselves',()=>{const{h}=setup(500000);const p=h.buy('a','bed').piece;
  assert.ok(h.place('a',p.pid,{x:2.5,z:3,rotation:45,floor:'flat'}).ok);assert.deepEqual({x:p.x,z:p.z,rotation:p.rotation,floor:p.floor},{x:2.5,z:3,rotation:45,floor:'flat'});
  assert.ok(h.store('a',p.pid).ok);assert.equal(p.floor,'storage');assert.equal(p.x,undefined);
  assert.ok(h.place('a',p.pid,{x:1,z:1,rotation:-90,floor:'flat'}).ok);assert.equal(p.rotation,270);
  assert.ok(h.recolor('a',p.pid,PALETTES.wood.colors[2][1]).ok);assert.equal(p.color,PALETTES.wood.colors[2][1]);assert.equal(h.recolor('a',p.pid,'#000001').error,'unknown-colour');
  assert.equal(h.place('a',p.pid,{x:NaN,z:1,floor:'flat'}).ok,false);
  const g=h.buy('a','generator').piece;assert.equal(g.floor,'outdoor');assert.equal(h.store('a',g.pid).ok,false);assert.equal(h.hasEquipment('a','generator'),true);});
test('there is a sane cap on pieces of one item',()=>{const{h}=setup(1000000);for(let i=0;i<MAX_OF_ONE;i++)assert.ok(h.buy('a','monobloc').ok);assert.equal(h.buy('a','monobloc').error,'too-many');});
test('stored backup units do not power the home; installed ones do; solar charges in daylight only',()=>{const{h}=setup(1000000);const ps=h.buy('a','powerstation').piece;const s=h.home('a');s.battery=100;assert.equal(h.powered('a',false),false);h.place('a',ps.pid,{x:2,z:2,floor:'selfcon'});assert.equal(h.powered('a',false),true);h.advance(180,false);assert.equal(s.battery,50);
  h.buy('a','solar');h.advance(60,false,true);assert.equal(s.battery,70);h.advance(60,false,false);assert.ok(s.battery<70);});

test('v16 saves become pieces with the same positions, rotations, colours and storage',()=>{const{h,state}=setup();state.upgrades.a={owned:['sofa','fridge','art','generator'],placements:{sofa:{x:2,z:3,rotation:90,floor:'duplex',color:'#4c5d92'},fridge:{floor:'storage'}},paint:'#e6ad8c',floor:'#a8b8c5',designs:['paint:peach'],fuel:1,battery:40};
  const s=h.home('a');assert.equal(s.pieces.length,4);const by=Object.fromEntries(s.pieces.map(p=>[p.item,p]));
  assert.deepEqual({x:by.sofa.x,z:by.sofa.z,rotation:by.sofa.rotation,floor:by.sofa.floor,color:by.sofa.color},{x:2,z:3,rotation:90,floor:'duplex',color:'#4c5d92'});
  assert.equal(by.fridge.floor,'storage');assert.equal(by.art.floor,null,'never-positioned items are laid out on the next visit, as before');assert.equal(by.generator.floor,'outdoor');
  assert.deepEqual(s.owned.sort(),['art','fridge','generator','sofa']);assert.deepEqual(s.placements.sofa,{x:2,z:3,rotation:90,floor:'duplex',color:'#4c5d92'});
  assert.equal(s.paint,'#e6ad8c');assert.equal(s.fuel,1);assert.equal(s.battery,40);assert.equal(s.nextPid,5);});
test('save migration v16 → v17 keeps money and furniture and never resets',()=>{const v16=defaultSave({name:'Ada',gender:'female'});v16.version=16;v16.wallet.balance=12345;v16.housing.upgrades={a:{owned:['bed'],placements:{bed:{x:1,z:2,rotation:0,floor:'selfcon'}}}};
  const out=migrate(structuredClone(v16));assert.equal(out.version,23);assert.equal(out.wallet.balance,12345);assert.equal(out.housing.upgrades.a.pieces[0].item,'bed');assert.equal(out.housing.upgrades.a.pieces[0].x,1);
  const again=migrate(structuredClone(out));assert.deepEqual(again.housing.upgrades.a.pieces,out.housing.upgrades.a.pieces,'migrating twice changes nothing');});
test('corrupt pieces are dropped or sent to storage, never crash',()=>{const{h,state}=setup();state.upgrades.a={pieces:[null,{pid:'p1',item:'sofa',x:'bad',z:1,floor:'flat'},{pid:'p2',item:'ghostitem'},{pid:'p1',item:'bed'},{pid:'p3',item:'bed',x:1,z:1,floor:'../hack'}],nextPid:1};const s=h.home('a');assert.deepEqual(s.pieces.map(p=>[p.pid,p.floor]),[['p1','storage'],['p3','storage']]);assert.equal(s.nextPid,4);});

test('floor placement protects room edges, walls, other furniture and doors; rugs and table-top items never block',()=>{for(const id of ['bed','shower','cooker','lamp','bookshelf','lsofa','dining6']){const base={id,x:4,z:4,bounds:{minX:0,maxX:9,minZ:0,maxZ:9}};assert.ok(validatePlacement(base).ok,id);assert.equal(validatePlacement({...base,x:0}).ok,false);assert.equal(validatePlacement({...base,protectedPoints:[{x:4,z:4,radius:1}]}).ok,false);}
  const b={x:4,z:4,bounds:{minX:0,maxX:8,minZ:0,maxZ:8},obstacles:[[[3,3],[5,3],[5,5],[3,5]]]};assert.ok(validatePlacement({...b,id:'largerug'}).ok);assert.ok(validatePlacement({...b,id:'fruitbowl'}).ok);assert.equal(validatePlacement({...b,id:'wardrobe'}).ok,false);
  assert.equal(isNonBlocking('sconce'),true);assert.equal(isNonBlocking('sofa'),false);});
test('45° rotation turns the footprint correctly',()=>{const p=furniturePolygon('sofa',0,0,45,0);const xs=p.map(q=>q[0]);assert.ok(Math.max(...xs)-Math.min(...xs)>1.5&&Math.max(...xs)-Math.min(...xs)<1.9);});
test('wall items snap to the nearest wall, face into the room and stay off door gaps',()=>{const bounds={minX:0,maxX:6,minZ:0,maxZ:5},segs=wallSegments(bounds,[]);
  const s=snapToWall('painting',3,.6,segs);assert.ok(s);assert.ok(Math.abs(s.z-.035)<.05);assert.equal(s.rotation,0,'front faces +z, into the room');
  const e=snapToWall('painting',5.6,2.5,segs);assert.ok(Math.abs(e.x-(6-.035))<.05);assert.equal(e.rotation,90);
  assert.equal(snapToWall('painting',3,2.5,segs),null,'too far from any wall');
  // a short wall stub (a door gap beside it) cannot hold an item wider than it
  const stub=[[0,0,.5,0,0,1]];assert.equal(snapToWall('ulicanvas',.25,.3,stub),null);
  // two pictures cannot overlap on the same wall; a ceiling fan and a light cannot share a spot
  const pic=furniturePolygon('painting',3,.035,0,0);assert.equal(validatePlacement({id:'painting',x:3.2,z:.035,rotation:0,bounds,wallOthers:[pic]}).ok,false);assert.ok(validatePlacement({id:'painting',x:4.5,z:.035,rotation:0,bounds,wallOthers:[pic]}).ok);
  const fan=furniturePolygon('ceilingfan',3,2.5,0);assert.equal(validatePlacement({id:'chandelier',x:3.1,z:2.5,bounds,ceilingOthers:[fan]}).ok,false);});

test('every item has a real model (Kenney kit or drawn) that fits its footprint',async()=>{
  await loadFurnitureLibraryFromFiles(fs.readFile,new URL('../public/models/furniture',import.meta.url).pathname);assert.ok(kitLoaded());
  for(const i of HOME_GOODS){const model=furnitureModel(i.id),b=new THREE.Box3().setFromObject(model);assert.ok(!b.isEmpty()&&Number.isFinite(b.max.y),i.id);let meshes=0;model.traverse(o=>{if(o.isMesh)meshes++;});assert.ok(meshes>=1,i.id);
    if(i.size&&i.mount!=='bedding'){const tol=.16,s=b.getSize(new THREE.Vector3());assert.ok(s.x<=i.size[0]+tol,`${i.id} width ${s.x.toFixed(2)} > ${i.size[0]}`);assert.ok(s.z<=i.size[1]+tol,`${i.id} depth ${s.z.toFixed(2)} > ${i.size[1]}`);}
    assert.ok(b.max.y-b.min.y<4.2,i.id+' height');
    if(i.variants){const c=PALETTES[i.variants].colors[1][1],m=furnitureModel(i.id,c);let hit=0;m.traverse(o=>{if(o.isMesh)for(const mat of [].concat(o.material))if(PALETTES[i.variants].mat.test(mat.userData.kitName??mat.name))hit++;});assert.ok(hit>0,`${i.id}: colour variant changes something`);disposeModel(m);}
    disposeModel(model);}
});
