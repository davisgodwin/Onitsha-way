import test from 'node:test';import assert from 'node:assert/strict';
import {loadWorld} from './helpers/loadWorld.mjs';
import {STORES,pickStoreBuilding} from '../src/buy/HomeStores.js';
import {SHOPS} from '../src/buy/Goods.js';
import {LEGACY_HOMES} from '../src/data/legacyHomes.js';
const {map,landmarks}=loadWorld();
test('the four home stores each take over a different existing commercial building with a road-facing door',()=>{
  const taken=new Set(LEGACY_HOMES.map(h=>h.buildingId)),picked=[];
  for(const def of STORES){const p=pickStoreBuilding(map,landmarks,def,taken);assert.ok(p,def.shop);assert.equal(p.b.kind,'commercial');assert.ok(!taken.has(p.b.id));taken.add(p.b.id);picked.push(p);
    const l=landmarks.get(def.near);const d=Math.hypot(p.door.x-l.x,p.door.z-l.z);assert.ok(d>40&&d<560,`${def.shop} ${d}`);assert.ok(p.road>=3&&p.road<=16);}
  assert.equal(new Set(picked.map(p=>p.b.id)).size,4);assert.deepEqual(STORES.map(s=>s.shop).sort(),Object.keys(SHOPS).sort());
  // deterministic: the same map gives the same buildings
  const again=STORES.reduce((acc,def)=>{const p=pickStoreBuilding(map,landmarks,def,acc.taken);acc.taken.add(p.b.id);acc.ids.push(p.b.id);return acc;},{taken:new Set(LEGACY_HOMES.map(h=>h.buildingId)),ids:[]});
  assert.deepEqual(again.ids,picked.map(p=>p.b.id));
});
