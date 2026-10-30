import test from 'node:test';
import assert from 'node:assert/strict';
import {Skills, SKILLS, xpForLevel, practiceSkill} from '../src/life/Skills.js';
import {Needs} from '../src/player/Needs.js';
import {EventBus} from '../src/core/EventBus.js';
import {hustleEligibility, careerEligibility, CAREER_RULES} from '../src/data/careerProgression.js';
import {PhoneServices} from '../src/life/PhoneServices.js';
import {Economy} from '../src/economy/Economy.js';
import {defaultSave,migrate,SaveSystem} from '../src/save/SaveSystem.js';
import {storyState} from '../src/story/StorySystem.js';
const fixture=()=>{const needs=new Needs({}), skills=new Skills({}), progression=storyState({});return {skills,needs,progression,spendTime:n=>needs.update(n)};};
test('all nine skills cross each level only at the exact XP boundary',()=>{
 for(const id of Object.keys(SKILLS))for(let level=2;level<=10;level++){
  const s=new Skills({[id]:xpForLevel(level)-1});assert.equal(s.level(id),level-1);assert.equal(s.progress(id).remaining,1);s.add(id,1);assert.equal(s.level(id),level);assert.equal(s.progress(id).progress,level===10?1:0);
 }
});
test('invalid, inherited and nonpositive XP awards cannot mutate skills',()=>{
 const s=new Skills({});const before=JSON.stringify(s.state);
 for(const id of ['unknown','__proto__','toString','constructor'])assert.equal(s.add(id,30),false);
 for(const xp of [-1,0,NaN,Infinity,'30',null])assert.equal(s.add('coding',xp),false);
 assert.equal(JSON.stringify(s.state),before);
});
test('bad numeric XP is normalized; levels cap without rollover',()=>{
 const s=new Skills({coding:-8,comedy:NaN,hustle:Infinity,music:9000});assert.equal(s.state.coding,0);assert.equal(s.state.comedy,0);assert.equal(s.state.hustle,0);assert.equal(s.state.music,4500);s.add('music',1e10);assert.deepEqual(s.progress('music'),{id:'music',label:'Music',level:10,xp:4500,nextXp:null,remaining:0,progress:1});
});
test('only crossing a level emits feedback; bulk XP produces one final-level event',()=>{
 const events=[],bus=new EventBus();bus.on('skill:level-up',e=>events.push(e));const s=new Skills({},{bus});s.add('coding',99);assert.equal(events.length,0);s.add('coding',1);assert.equal(events[0].level,2);s.add('coding',900);assert.equal(events[1].level,5);s.add('coding',10000);s.add('coding',30);assert.equal(events.length,3);assert.equal(events[2].level,10);
});
test('phone practice awards XP, drains needs and shares the workshop cooldown',()=>{
 const f=fixture(),r=practiceSkill(f,'coding');assert.equal(r.gained,30);assert.equal(f.skills.state.coding,30);assert.ok(f.needs.energy<85);assert.ok(f.needs.state.hunger<80);assert.equal(f.progression.trainingAt,20);
 for(const id of ['coding','charisma','comedy'])assert.equal(practiceSkill(f,id).ok,false);
 f.progression.playSeconds=19.99;assert.equal(practiceSkill(f,'coding').ok,false);f.progression.playSeconds=20;assert.equal(practiceSkill(f,'coding').ok,true);
 f.progression.trainingAt=60;f.progression.playSeconds=40;assert.match(practiceSkill(f,'music').error,/20 seconds/);
});
test('failed practices do not consume XP, needs or cooldown',()=>{
 for(const kind of ['hungry','tired','trip','cooking','max','invalid']){
  const f=fixture();let id='coding';if(kind==='hungry')f.needs.state.hunger=14;if(kind==='tired')f.needs.state.energy=14;if(kind==='trip')f.travelling=true;if(kind==='cooking')id='cooking';if(kind==='max')f.skills.add(id,4500);if(kind==='invalid')id='toString';
  const before=JSON.stringify([f.skills.state,f.needs.state,f.progression]);assert.equal(practiceSkill(f,id).ok,false,kind);assert.equal(JSON.stringify([f.skills.state,f.needs.state,f.progression]),before,kind);
 }
});
test('last practice awards only remaining XP and reports mastery accurately',()=>{
 const f=fixture();f.skills.state.coding=4490;const r=practiceSkill(f,'coding');assert.deepEqual(r,{ok:true,gained:10,before:9,level:10});assert.equal(practiceSkill(f,'coding').ok,false);
});
test('all normal career skill gates enforce both level and equipment',()=>{
 for(const [id,rule]of Object.entries(CAREER_RULES)){
  const s=new Skills({[rule.skill]:xpForLevel(rule.level)}),inventory={has:()=>true};assert.ok(careerEligibility(id,{skills:s,inventory,character:{ageGroup:'adult'}}).ok,id);
  if(rule.level>1){s.state[rule.skill]--;assert.equal(careerEligibility(id,{skills:s,inventory}).ok,false,id);}
 }
});
test('comedy requires Comedy, not Charisma, and rewards the same skill',()=>{
 const skills=new Skills({comedy:100}),needs=new Needs({}),economy=new Economy({balance:1000}),character={ageGroup:'adult'};
 assert.ok(hustleEligibility('comedy',{skills,character}).ok);assert.equal(hustleEligibility('comedy',{skills:new Skills({charisma:4500}),character}).ok,false);
 const service=new PhoneServices({},{skills,needs,economy,character});assert.ok(service.work('comedy').ok);assert.equal(skills.state.comedy,124);assert.equal(skills.state.charisma,0);assert.equal(service.work('comedy').ok,false);
});
test('XP, levels and active-play cooldown survive real save/load and migration',()=>{
 const prior=globalThis.window,storage=new Map();globalThis.window={localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}};
 try{const f=fixture(),data=defaultSave({gender:'male',name:'Skills QA'});f.skills.add('coding',990);practiceSkill(f,'coding');data.skills=f.skills.state;data.story=f.progression;assert.ok(SaveSystem.save(data));const loaded=SaveSystem.load();assert.ok(loaded.ok);const g={...f,skills:new Skills(loaded.data.skills),progression:storyState(loaded.data.story)};assert.equal(g.skills.level('coding'),5);assert.equal(practiceSkill(g,'coding').ok,false);assert.equal(migrate(loaded.data).skills.coding,1020);
 }finally{globalThis.window=prior;}
});
