import { VEHICLE_MODELS } from '../data/housing.js';
const record = v => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (path, why) => { throw new Error(`Invalid save field ${path}: ${why}`); };
const obj = (v, path) => { if (!record(v)) fail(path, 'expected an object'); };
const list = (v, path) => { if (!Array.isArray(v)) fail(path, 'expected a list'); };
const objects = (v, path) => { list(v,path);v.forEach((x,i)=>obj(x,`${path}[${i}]`)); };
function inventory(v,path){obj(v,path);if(v.slots!=null&&(!Number.isSafeInteger(v.slots)||v.slots<1||v.slots>1000))fail(path+'.slots','invalid capacity');if(v.items!=null){objects(v.items,path+'.items');for(const it of v.items)if(typeof it.id!=='string'||!it.id||!Number.isSafeInteger(it.qty)||it.qty<1)fail(path+'.items','invalid item or quantity');}}
/** Reject damaged structures before import replaces a working save. Missing legacy fields still migrate. */
export function validateSave(data){
 obj(data,'root');const version=data.version??0;if(!Number.isSafeInteger(version)||version<0)fail('version','expected a non-negative integer');
 obj(data.character,'character');if(!['male','female'].includes(data.character.gender))fail('character.gender','unsupported character');if(data.character.name!=null&&typeof data.character.name!=='string')fail('character.name','expected text');
 for(const id of ['clock','wallet','inventory','jobs','needs','skills','phone','street','transit','housing','business','wholesale','police','relationships','world','activities','politics','education','ventures','news'])if(data[id]!=null)obj(data[id],id);
 if(data.activities?.pool!=null){const f=data.activities.pool;obj(f,'activities.pool');for(const k of ['history','finished','achievements'])if(f[k]!=null)list(f[k],'activities.pool.'+k);}if(data.activities?.games!=null)obj(data.activities.games,'activities.games');if(data.activities?.football!=null){const f=data.activities.football;obj(f,'activities.football');for(const k of ['history','finished','achievements'])if(f[k]!=null)list(f[k],'activities.football.'+k);}
 if(data.clock){const c=data.clock;if(c.day!=null&&(!Number.isSafeInteger(c.day)||c.day<1))fail('clock.day','invalid day');if(c.minutes!=null&&(!Number.isFinite(c.minutes)||c.minutes<0||c.minutes>1440))fail('clock.minutes','invalid time');}
 if(data.wallet){const w=data.wallet;if(!Number.isSafeInteger(w.balance)||w.balance<0)fail('wallet.balance','invalid balance');if(w.ledger!=null)objects(w.ledger,'wallet.ledger');if(w.processed!=null){list(w.processed,'wallet.processed');if(w.processed.some(k=>typeof k!=='string'))fail('wallet.processed','invalid transaction key');}}
 if(data.inventory)inventory(data.inventory,'inventory');
 if(data.jobs){for(const id of ['list','completed','log'])if(data.jobs[id]!=null)list(data.jobs[id],'jobs.'+id);for(const [i,j]of (data.jobs.list??[]).entries()){obj(j,`jobs.list[${i}]`);if(j.steps!=null)objects(j.steps,`jobs.list[${i}].steps`);}if(data.jobs.active!=null)obj(data.jobs.active,'jobs.active');}
 if(data.jobs?.missions!=null){
  const m=data.jobs.missions;obj(m,'jobs.missions');
  if(m.version!==1)fail('jobs.missions.version','unsupported mission schema');
  obj(m.records,'jobs.missions.records');
  if(m.tracked!==null&&(typeof m.tracked!=='string'||!Object.hasOwn(m.records,m.tracked)))fail('jobs.missions.tracked','unknown mission');
  for(const [id,s]of Object.entries(m.records)){
   const p='jobs.missions.records.'+id;obj(s,p);obj(s.bindings,p+'.bindings');
   if(!['available','active','completed'].includes(s.status)||typeof s.rewardClaimed!=='boolean'||!Number.isInteger(s.progress)||s.progress<0||s.progress>2)fail(p,'invalid mission state');
   for(const k of ['giver','target'])if(typeof s.bindings[k]!=='string'||!s.bindings[k])fail(p+'.bindings','missing resident');
   if(s.bindings.giver===s.bindings.target)fail(p+'.bindings','identical residents');
   for(const k of ['acceptedAt','completedAt'])if(s[k]!==null&&(!Number.isFinite(s[k])||s[k]<0))fail(p+'.'+k,'invalid timestamp');
   if(s.status==='available'&&(s.progress!==0||s.rewardClaimed||s.acceptedAt!==null||s.completedAt!==null))fail(p,'inconsistent offer');
   if(s.status==='active'&&(s.progress>1||s.rewardClaimed||s.acceptedAt===null||s.completedAt!==null))fail(p,'inconsistent active mission');
   if(s.status==='completed'&&(s.progress!==2||!s.rewardClaimed||s.acceptedAt===null||s.completedAt===null))fail(p,'inconsistent completion receipt');
  }
 }
 if(data.vehicles!=null){objects(data.vehicles,'vehicles');for(const v of data.vehicles){if(!VEHICLE_MODELS[v.model])fail('vehicles.model',`unsupported model ${String(v.model)}`);for(const id of ['fuel','odo','heading','repairSeq'])if(v[id]!=null&&!Number.isFinite(v[id]))fail('vehicles.'+id,'invalid vehicle value');if(v.garaged!=null&&typeof v.garaged!=='boolean')fail('vehicles.garaged','expected boolean');if(v.garageHomeId!=null&&typeof v.garageHomeId!=='string')fail('vehicles.garageHomeId','expected home identifier');if(v.paint!=null&&!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.paint))fail('vehicles.paint','invalid paint colour');if(v.repairSeq!=null&&(!Number.isSafeInteger(v.repairSeq)||v.repairSeq<0))fail('vehicles.repairSeq','invalid service sequence');}}
 if(data.phone){if(data.phone.messages!=null)objects(data.phone.messages,'phone.messages');for(const id of ['bets','work'])if(data.phone[id]!=null)obj(data.phone[id],'phone.'+id);}
 if(data.transit?.log!=null)objects(data.transit.log,'transit.log');
 if(data.housing){for(const id of ['rentals','storage','lamps','upgrades','owned'])if(data.housing[id]!=null)obj(data.housing[id],'housing.'+id);for(const [id,s]of Object.entries(data.housing.storage??{}))inventory(s,'housing.storage.'+id);for(const [id,r]of Object.entries(data.housing.rentals??{})){obj(r,'housing.rentals.'+id);if(!Number.isFinite(r.until))fail('housing.rentals.'+id,'missing expiry');}}
 if(data.world){if(data.world.stock!=null){obj(data.world.stock,'world.stock');for(const [id,s]of Object.entries(data.world.stock)){obj(s,'world.stock.'+id);if(s.q!=null)obj(s.q,'world.stock.'+id+'.q');}}for(const id of ['soldVehicles','heard'])if(data.world[id]!=null)list(data.world[id],'world.'+id);}
 for(const [id,r]of Object.entries(data.relationships??{}))obj(r,'relationships.'+id);
 if(data.street?.resolved!=null)obj(data.street.resolved,'street.resolved');
 if(data.wholesale){if(data.wholesale.bought!=null)obj(data.wholesale.bought,'wholesale.bought');if(data.wholesale.orders!=null)objects(data.wholesale.orders,'wholesale.orders');if(data.wholesale.done!=null)list(data.wholesale.done,'wholesale.done');}
 if(data.police){if(data.police.owed!=null)objects(data.police.owed,'police.owed');if(data.police.held!=null)obj(data.police.held,'police.held');}
 if(data.retail!=null){obj(data.retail,'retail');if(data.retail.seq!=null&&(!Number.isSafeInteger(data.retail.seq)||data.retail.seq<0))fail('retail.seq','invalid sequence');if(data.retail.clothes!=null){list(data.retail.clothes,'retail.clothes');if(data.retail.clothes.some(k=>typeof k!=='string'))fail('retail.clothes','invalid clothing receipt');}}
 return data;
}
