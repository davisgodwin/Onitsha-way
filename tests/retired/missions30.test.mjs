import test from 'node:test';
import assert from 'node:assert/strict';
import {JobSystem} from '../src/jobs/JobSystem.js';
import {MissionController} from '../src/jobs/MissionController.js';
import {bindFriend} from '../src/jobs/MissionDefinitions.js';
import {Economy} from '../src/economy/Economy.js';
import {Inventory} from '../src/economy/Inventory.js';
import {defaultSave,migrate,SaveSystem,SAVE_VERSION} from '../src/save/SaveSystem.js';
import {InteractionSystem} from '../src/interaction/InteractionSystem.js';
import {buildConversation} from '../src/dialogue/Conversations.js';
const ID='find-your-friend';
function fixture(){
 const data=defaultSave({name:'Ada',gender:'female'}),wallet=new Economy(data.wallet),residents=[
 {id:'career-city:mentor',name:'Workplace mentor',kind:'host',role:'neighbour',schedule:[0,24],x:0,z:0},
 {id:'gate:friend',name:'Amaka',kind:'gate',role:'neighbour',schedule:[7,21],x:40,z:0},
 {id:'gate:other',name:'Chidi',kind:'gate',role:'neighbour',schedule:[7,21],x:200,z:0}];
 const jobs=new JobSystem(data.jobs,{economy:wallet,inventory:new Inventory(data.inventory),residents,now:()=>1500});
 const active=residents.map(identity=>({identity,name:identity.name,x:identity.x,z:identity.z}));
 const g={jobs,economy:wallet,state:'playing',saveData:data,player:{position:{x:0,z:1}},clock:{day:1,minutes:720},
  npcs:{residents,active},world:{collision:{isFree:()=>true},terrain:{isWater:()=>false}},interactions:new InteractionSystem(),
  ui:{toast:()=>{}},saveGame:()=>SaveSystem.save(data),updateWaypoint:()=>{},startDialogue:()=>{}};
 const c=new MissionController(g);c.start({x:0,z:0});g.missions=c;
 return {data,wallet,jobs,c,g,active};
}
function dialogue(f,who,node){const npc=f.active[who];f.g.player.position={x:npc.x,z:npc.z+1};const mission=f.c.context(npc);const d={npc,mission,node:{id:node}};f.g.dialogue=d;f.g.state='dialogue';return d;}
function accept(f){const d=dialogue(f,0,'mission-offer');assert.equal(f.c.action('mission-accept',d),'ok');return d;}
function finish(f){const d=dialogue(f,1,'mission-welcome');f.c.opened(d,'mission-welcome');assert.equal(f.c.action('mission-finish',d),'ok');return d;}
const memory=new Map();global.window={localStorage:{getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)}};
test('v14 saves migrate without changing wallet, housing, inventory or daily jobs',()=>{
 const d=defaultSave({gender:'female',name:'Ada'});d.version=14;delete d.jobs.missions;d.jobs.log=[{id:'old'}];d.housing.owned={home:true};
 const copy=structuredClone(d),out=migrate(d);assert.equal(out.version,SAVE_VERSION);assert.deepEqual(out.wallet,copy.wallet);assert.deepEqual(out.housing,{...copy.housing,upgrades:{}});assert.deepEqual(out.jobs.log,copy.jobs.log);assert.deepEqual(out.jobs.missions.records,{});
});
test('bindings are deterministic and reuse existing reachable residents only',()=>{
 const f=fixture(),a=bindFriend(f.g.npcs.residents,{x:0,z:0});assert.deepEqual(a,{giver:'career-city:mentor',target:'gate:friend'});
 assert.deepEqual(a,bindFriend([...f.g.npcs.residents].reverse(),{x:0,z:0}));assert.equal(f.g.npcs.residents.length,3);
 assert.equal(bindFriend(f.g.npcs.residents,{x:0,z:0},()=>false),null);
 const before=structuredClone(f.jobs.mission(ID));f.c.start({x:300,z:0});assert.deepEqual(f.jobs.mission(ID),before);assert.equal(f.g.interactions.items.size,1);
});
test('journal offers directions only, not remote acceptance or completion',()=>{
 const f=fixture();assert.equal(f.c.journal()[0].status,'available');f.c.track(ID);assert.equal(f.jobs.mission(ID).status,'available');assert.equal(f.c.target().resident.id,'career-city:mentor');
 assert.equal(f.c.action('mission-accept',{}),'fail');assert.equal(f.jobs.mission(ID).status,'available');
});
test('source acceptance requires real active NPC, range, scene, dialogue node and session',()=>{
 const f=fixture(),d=dialogue(f,0,'open');assert.equal(f.c.action('mission-accept',d),'fail');d.node.id='mission-offer';
 f.g.player.position.x=20;assert.equal(f.c.action('mission-accept',d),'fail');f.g.player.position.x=0;
 f.g.homes={inside:{}};assert.equal(f.c.action('mission-accept',d),'fail');f.g.homes=null;
 f.g.npcs.active=[];assert.equal(f.c.action('mission-accept',d),'fail');f.g.npcs.active=f.active;
 f.g.dialogue={...d};assert.equal(f.c.action('mission-accept',d),'fail');f.g.dialogue=d;
 assert.equal(f.c.action('mission-accept',d),'ok');assert.equal(f.c.action('mission-accept',d),'fail');assert.equal(f.jobs.mission(ID).progress,0);
});
test('wrong actor, arrival alone and unrelated conversations never pay',()=>{
 const f=fixture();accept(f);const before=f.wallet.balance;
 const d=dialogue(f,2,'mission-welcome');f.c.opened(d,'mission-welcome');assert.equal(f.c.action('mission-finish',d),'fail');
 const friend=dialogue(f,1,'open');assert.equal(f.jobs.mission(ID).progress,0);assert.equal(f.c.action('mission-finish',friend),'fail');
 friend.node.id='mission-welcome';assert.equal(f.c.action('mission-finish',friend),'fail');assert.equal(f.wallet.balance,before);
});
test('closed friend, distant contact, and an interior cannot advance objectives',()=>{
 const f=fixture();accept(f);const d=dialogue(f,1,'mission-welcome');f.g.clock.minutes=23*60;f.c.opened(d,'mission-welcome');assert.equal(f.jobs.mission(ID).progress,0);
 f.g.clock.minutes=720;f.g.player.position.x+=10;f.c.opened(d,'mission-welcome');assert.equal(f.jobs.mission(ID).progress,0);
 f.g.player.position.x=40;f.g.civic={inside:{}};f.c.opened(d,'mission-welcome');assert.equal(f.jobs.mission(ID).progress,0);
});
test('welcome branch advances and pays exactly once through wallet',()=>{
 const f=fixture();accept(f);const before=f.wallet.balance,d=finish(f),m=f.jobs.mission(ID);
 assert.equal(f.wallet.balance,before+500);assert.equal(m.status,'completed');assert.equal(m.rewardClaimed,true);assert.equal(m.progress,2);assert.equal(f.c.target(),null);
 assert.equal(f.c.action('mission-finish',d),'fail');assert.equal(f.wallet.balance,before+500);assert.equal(f.data.wallet.ledger.at(-1).key,`mission:${ID}:reward`);
});
test('permanent mission receipt survives wallet ledger/key pruning',()=>{
 const f=fixture();accept(f);finish(f);for(let i=0;i<605;i++)f.wallet.transact({key:'later:'+i,amount:1,reason:'test'});
 assert.equal(f.wallet.hasProcessed(`mission:${ID}:reward`),false);const before=f.wallet.balance;
 assert.equal(f.jobs.completeMission(ID,'gate:friend',true).ok,false);assert.equal(f.wallet.balance,before);
});
test('reload restores progress and requires a fresh in-world welcome conversation',()=>{
 const f=fixture();accept(f);const d=dialogue(f,1,'mission-welcome');f.c.opened(d,'mission-welcome');assert.equal(f.g.saveGame(),true);
 const loaded=SaveSystem.load();assert.equal(loaded.ok,true);assert.equal(loaded.data.jobs.missions.records[ID].progress,1);
 const fresh=new MissionController(f.g);f.g.missions=fresh;assert.equal(fresh.action('mission-finish',d),'fail');fresh.opened(d,'mission-welcome');assert.equal(fresh.action('mission-finish',d),'ok');
 assert.equal(SaveSystem.load().data.jobs.missions.records[ID].rewardClaimed,true);
 const reloaded=new JobSystem(SaveSystem.load().data.jobs,{economy:f.wallet,inventory:new Inventory(f.data.inventory),residents:f.g.npcs.residents});assert.equal(reloaded.acceptMission(ID,'career-city:mentor').ok,false);
});
test('a blocked save never creates a persisted wallet-only reward or allows memory replay',()=>{
 const f=fixture();accept(f);const before=SaveSystem.raw(),set=window.localStorage.setItem;
 window.localStorage.setItem=()=>{throw Error('QuotaExceeded')};const d=finish(f);assert.equal(f.g.saveGame(),false);assert.equal(SaveSystem.raw(),before);const balance=f.wallet.balance;assert.equal(f.c.action('mission-finish',d),'fail');assert.equal(f.wallet.balance,balance);
 window.localStorage.setItem=set;assert.equal(f.g.saveGame(),true);const saved=SaveSystem.load().data;assert.equal(saved.wallet.balance,balance);assert.equal(saved.jobs.missions.records[ID].rewardClaimed,true);
});
test('damaged completion, bindings, progress or tracking are rejected, not reset to payable',()=>{
 const f=fixture();accept(f);finish(f);
 for(const mutate of [d=>d.jobs.missions.records[ID].rewardClaimed=false,d=>d.jobs.missions.records[ID].progress=90,d=>d.jobs.missions.records[ID].bindings.target=null,d=>d.jobs.missions.tracked='missing',d=>d.jobs.missions.version=2]){
  const d=structuredClone(f.data);mutate(d);assert.throws(()=>migrate(d),/Invalid save field/);
 }
});
test('daily job slots are separate and existing wallet prevents negative balances',()=>{
 const f=fixture();accept(f);assert.equal(f.jobs.list.length,0);assert.equal(f.jobs.full,false);assert.equal(f.wallet.transact({key:'overspend',amount:-(f.wallet.balance+1),reason:'test'}).error,'insufficient-funds');
});
test('actual generated dialogue exposes mission branches without replacing normal options',()=>{
 const npc={name:'Amaka',role:'neighbour'},ctx={npc,rel:{knowsName:false,familiarity:0},player:{name:'Ada',gender:'female'},rng:()=>.5,hour:12,landmarks:{list:[]},mission:{kind:'friend'}};
 const nodes=buildConversation(ctx);assert.ok(nodes.open.responses.some(r=>r.next==='mission-welcome'));assert.ok(nodes.open.responses.some(r=>r.next==='directions'));assert.equal(nodes['mission-welcome'].responses[0].action.type,'mission-finish');
});
