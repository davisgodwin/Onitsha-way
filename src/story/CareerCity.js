import {buildVenue,venuePlot,venueSize} from '../world/VenueArchitecture.js';
import { mergeStatic } from '../render/MergeStatic.js';
import * as THREE from 'three';
import {CITY_SERVICES,WORK_SITES} from '../data/cityServices.js';
import {CAREER_RULES,EQUIPMENT,CAREER_BRIEFS,TRAINING_QUIZZES} from '../data/careerProgression.js';
import {careerInfo,careersFor} from '../data/careers.js';
import {ITEMS} from '../data/catalogue.js';
import {SKILLS} from '../life/Skills.js';
import {naira} from '../economy/Economy.js';
/** Career boards and simplified public services. No real business is associated with crime events. */
export class CareerCity {
 constructor(story){this.story=story;this.g=story.g;this.sites=[];this.services=[];this.reserved=[];}
 anchor(def){const g=this.g,map=g.world.map,near=g.world.landmarks.get(def.near??'main-market')??g.world.landmarks.list[0];
  if(def.osm){const p=map.pois.find(p=>String(p.osm)===def.osm);if(p)return p;}
  if(Number.isFinite(def.lat)){const{origin,metresPerDegree:m}=map.meta;return{x:(def.lon-origin.lon)*m.lon,z:-(def.lat-origin.lat)*m.lat};}
  if(def.road){const roads=map.roads.filter(r=>r.displayName?.toLowerCase().includes(def.road.toLowerCase()));let best=null,dist=Infinity;for(const r of roads)for(const[x,z]of r.points){const d=Math.hypot(x-near.x,z-near.z);if(d<dist){dist=d;best={x,z};}}if(best)return best;}
  return{x:near.x+(def.dx??0),z:near.z+(def.dz??0)};
 }
 clearing(p,kind){return venuePlot(this.g.world,p,venueSize(kind));}
 setup(){const g=this.g;this.group=new THREE.Group();this.group.name='CareerWorkplacesAndServices';g.renderer.scene.add(this.group);
  for(const def of WORK_SITES){const p=this.clearing(this.anchor(def),def.kind),site={...def,...p,kind:def.kind??'workplace',confidence:'fictional',radius:12,visitSpot:p};this.sites.push(site);this.kiosk(site);g.world.landmarks.list.push(site);
   site.serviceView=()=>this.siteView(site);
   g.interactions.register({x:site.x,z:site.z,radius:4,enabled:()=>this.available()&&!g.civic?.inside,label:`${site.name} — go in`,onInteract:()=>g.civic.enter(site)}); // v0.46: go in first; jobs, training and equipment are at the desks inside
  }
  const defs=[...CITY_SERVICES,...g.world.map.pois.filter(p=>p.kind==='fuel').map(p=>({id:'osm-fuel:'+p.osm,name:p.name+' filling station',kind:'fuel',osm:String(p.osm),confidence:'osm',source:'https://www.openstreetmap.org/node/'+p.osm}))];
  for(const def of defs){const original=this.anchor(def),p=this.clearing({...original,preferredRoad:def.road??(def.id==='total-oguta'?'Oguta':null)},def.kind);this.addService(def,p);}
  g.world.landmarks.byRadius=[...g.world.landmarks.list].sort((a,b)=>a.radius-b.radius);
  this.mergeStats=mergeStatic(this.group); // kiosks and signs never move: one mesh per material
 }
 /** v0.49: one filling station or hotel on a plot (also used to open more of them later). */
 addService(def,p){const g=this.g,v={...def,...p,radius:12,visitSpot:p,gameEntrance:true};this.services.push(v);this.kiosk(v);if(v.kind==='fuel'){
    // Preserve all pre-existing pump anchors; additional stations use accessible game forecourts.
    const old=g.vehicles.stations.findIndex(s=>String(s.osm)===def.osm);if(old>=0)g.vehicles.stations[old]=v;else g.vehicles.stations.push(v);
   }else{g.world.landmarks.list.push(v);v.serviceView=()=>this.hotelView(v);}
   g.interactions.register({x:v.x,z:v.z,radius:4,enabled:()=>this.available(),label:`${v.name} — ${v.kind==='fuel'?'fuel desk':'go in'}`,onInteract:()=>v.kind==='fuel'?g.openChoice(()=>this.fuelView(v)):g.civic.enter(v)});
  return v;
 }
 available(){return!!this.story.s&&this.story.outside()&&!this.story.s.arrest&&!this.story.s.pending;}
 kiosk(v){buildVenue(this.g.world,v,this.group);
  const yaw=v.yaw??0, x=v.x+Math.cos(yaw)*2,z=v.z-Math.sin(yaw)*2;
  this.g.npcs.addAnchored({id:`career-city:${v.id}`,kind:'host',role:'neighbour',name:v.kind==='fuel'?'Fuel attendant':v.kind==='hotel'?'Receptionist':'Workplace mentor',x,z,nx:Math.sin(yaw),nz:Math.cos(yaw),schedule:[0,24],gender:v.id.length%2?'female':'male'});
 }
 workplace(id){return this.sites.find(s=>s.id===CAREER_RULES[id]?.site);}
 places(){return[...this.sites.map(s=>({...s,label:s.name,kind:s.kind})),...this.services.map(s=>({...s,label:s.name,kind:s.kind}))];}
 showMap(t){const g=this.g;if(g.civic.inside)g.civic.exit();if(g.state==='overlay')g.closeChoice();g.setWaypoint({...t,radius:5,custom:true,career:true});g.updatePlaces();g.openMap(t);g.saveGameNow();}
 requirements(c){const r=this.story.sys.eligibility(c.id);return r.checks.map(k=>`${k.ok?'✓':'○'} ${k.label}`).join(' · ');}
 siteView(site){const g=this.g,s=this.story.s,ids=site.careers.filter(id=>careersFor(g.saveData.character.ageGroup).some(c=>c.id===id));
  const options=[...g.life.siteOptions(site)]; // v0.40: apply, work shifts, promotion, resign (LifeController)
  const skills=[...new Set(ids.map(id=>CAREER_RULES[id].skill))];for(const skill of skills)options.push({label:`Train ${SKILLS[skill]} · level ${g.skills.level(skill)}`,sub:`Guided exercise · ${skill==='coding'?100:80} XP · loaned equipment · free`,act:()=>g.openChoice(()=>this.trainingView(skill,site))});
  options.push({label:'Buy career equipment',sub:'Owned tools stay in your bag. Buy the tools required for your career.',act:()=>g.openChoice(()=>this.shopView(site))});
  if(site.kind==='ict'&&!g.civic.inside)options.push({label:'Enter the ICT lab & studio',sub:'Computer lab & photo studio · open 24 hours',act:()=>g.civic.enter(site)});
  options.push({label:g.civic.inside?'Leave building':'Back to the city',ghost:true,act:()=>g.civic.inside?g.civic.exit():g.closeChoice()});
  return{title:site.name,kicker:'WORKPLACE · APPLY · WORK · TRAIN · EQUIP',text:site.blurb,note:'Jobs here are optional. Apply if you qualify, work shifts in opening hours (Mon–Sat), get promoted by doing good work, and resign whenever you like. Training uses active-play cooldowns.',options};
 }
 atSite(site){const g=this.g;return g.civic.inside?.id===site.id||(this.available()&&Math.hypot(g.player.position.x-site.x,g.player.position.z-site.z)<7);}
 shopView(site){const g=this.g,allowed=site.careers?new Set(site.careers.flatMap(id=>CAREER_RULES[id].tools)):new Set();if(site.id==='metadav')for(const id of EQUIPMENT)allowed.add(id);
  const options=[...allowed].map(id=>{const item=ITEMS[id];return{label:`${item.name} · ${naira(item.price)}`,sub:g.inventory.has(id)?'Already owned':'One bag slot · permanent work equipment',disabled:g.inventory.has(id)||!g.economy.canAfford(item.price)||!g.inventory.canAdd(item),why:g.inventory.has(id)?'Already owned':!g.inventory.canAdd(item)?'Free a bag slot':'Not enough money',act:()=>{if(!this.atSite(site)){g.ui.toast('Visit the equipment desk first.');return;}if(g.inventory.has(id)||!g.inventory.canAdd(item))return;const tx=g.economy.transact({key:`career-equipment:${++this.story.s.seq}`,amount:-item.price,reason:`Work equipment: ${item.name}`});if(tx.ok){g.inventory.add(item);g.saveGameNow();}g.ui.toast(tx.ok?`${item.name} added to your bag`:tx.error);g.renderChoice();}};});
  options.push({label:'Back to workplace',ghost:true,act:()=>g.openChoice(()=>this.siteView(site))});return{title:site.name+' · equipment',text:`Wallet ${naira(g.economy.balance)}. Tools are owned, not consumed by a job. Metadav’s central equipment desk stocks all starter kits.`,options};
 }
 trainingView(skill,site){const g=this.g,s=this.story.s,p=g.skills.progress(skill),quiz=TRAINING_QUIZZES[skill],cool=Math.max(0,Math.ceil(s.trainingAt-s.playSeconds)),n=s.trainingSeq??0,flip=n%2;
  const options=quiz.a.map((label,i)=>({label:quiz.a[(i+flip)%2],disabled:cool>0||p.level>=10,why:cool>0?`Return after ${cool} seconds of active city play`:'Maximum level reached',act:()=>{if(!this.atSite(site)){g.ui.toast('Go to the marked training desk first.');return;}if(s.playSeconds<s.trainingAt||g.skills.level(skill)>=10)return;if(g.needs.energy<15||g.needs.state.hunger<15){g.ui.toast('Eat and rest before training.');return;}s.trainingAt=s.playSeconds+20;s.trainingSeq++;const good=(i+flip)%2===0;if(good){g.skills.add(skill,skill==='coding'?100:80);g.needs.adjust({energy:-4,fun:4});g.skipTime(30);}g.saveGameNow();g.ui.toast(good?`${SKILLS[skill]} +${skill==='coding'?100:80} XP · level ${g.skills.level(skill)}`:'Try the guided exercise again after a short break. No XP awarded.');g.openChoice(()=>this.siteView(site));}}));
  options.push({label:'Back to workplace',ghost:true,act:()=>g.openChoice(()=>this.siteView(site))});return{title:`${SKILLS[skill]} workshop · level ${p.level}/10`,text:quiz.q,note:`${p.level===10?'4500 XP · Mastered — maximum level':`${p.xp} / ${p.nextXp} total XP · ${p.remaining} XP to level ${p.level+1}` }. Loaned training equipment is free; professional jobs require your own tools. Twenty seconds of active city play between sessions.`,options};
 }
 /** v0.46: the four room types of a hotel and their prices (nightly; a 3-hour rest is 40%). */
 hotelRooms(v){const r=v.rate??3000,R=(m)=>Math.round(r*m/500)*500;return[{id:'standard',label:'Standard room',price:R(1.6),fun:4,blurb:'A double bed, a chair and a TV'},{id:'deluxe',label:'Deluxe room',price:R(2.8),fun:10,blurb:'A bigger bed, a sofa, a wardrobe and a bigger TV'},{id:'executive',label:'Executive room',price:R(4.5),fun:16,blurb:'A king bed, a work desk, armchairs and a minibar'},{id:'suite',label:'Suite',price:R(8),fun:26,blurb:'A king bed, a lounge with a big TV, a dining table and a chandelier'}];}
 hotelView(v){const g=this.g;const options=[];
  if(!g.civic.inside)options.push({label:'Go inside',sub:'Reception, the rooms and the restaurant are inside',act:()=>g.civic.enter(v)});
  for(const[k,rm]of this.hotelRooms(v).entries())options.push({label:`${rm.label} · ${naira(rm.price)} a night`,sub:`${rm.blurb} · rest 3 hours for ${naira(Math.round(rm.price*.4/100)*100)}`,act:()=>g.openChoice(()=>this.roomView(v,k))});
  for(const[label,price,effects]of[['Reception meal',1200,{hunger:45,energy:10}]])options.push({label:`${label} · ${naira(price)}`,disabled:!g.economy.canAfford(price),why:'Not enough money',act:()=>{if(!this.atSite(v)){g.ui.toast('Visit reception first.');return;}const tx=g.economy.transact({key:`hotel-service:${++this.story.s.serviceSeq}`,amount:-price,reason:`${v.name}: ${label}`});if(tx.ok){g.needs.adjust(effects);g.skipTime(30);g.saveGameNow();g.ui.toast(label+' served.');}g.renderChoice();}});
  options.push({label:g.civic.inside?'Leave hotel':'Back to the city',ghost:true,act:()=>g.civic.inside?g.civic.exit():g.closeChoice()});return{title:v.name+' · reception',text:'Four kinds of room. Walk down the corridor to see them before you book.',note:'Prices are for one night (check-out 7:00), or a 3-hour rest. Paid from your wallet.',options};
 }
 roomView(v,k){const g=this.g,rm=this.hotelRooms(v)[k],rest=Math.round(rm.price*.4/100)*100;return{title:`${v.name} · ${rm.label}`,kicker:'BOOK A ROOM',text:rm.blurb+'.',options:[
  {label:`Rest for three hours · ${naira(rest)}`,sub:'Sleep, shower, feel better',disabled:!g.economy.canAfford(rest),why:'Not enough money',act:()=>this.bookRoom(v,k,'rest')},
  {label:`Stay the night · ${naira(rm.price)}`,sub:'Sleep until 7:00, breakfast included',disabled:!g.economy.canAfford(rm.price),why:'Not enough money',act:()=>this.bookRoom(v,k,'night')},
  {label:'Back',ghost:true,act:()=>g.closeChoice()}]};}
 bookRoom(v,k,mode){const g=this.g,rm=this.hotelRooms(v)[k],price=mode==='night'?rm.price:Math.round(rm.price*.4/100)*100;
  const tx=g.economy.transact({key:`hotel-room:${v.id}:${++this.story.s.serviceSeq}`,amount:-price,reason:`${v.name}: ${rm.label} (${mode==='night'?'one night':'3-hour rest'})`});if(tx&&tx.ok===false){g.ui.toast(tx.error??'Payment failed.');return false;}
  g.closeChoice();const A=g.civic.inside?.id===v.id?g.civic.anchors?.['room'+k]:null;
  if(A){const ox=g.civic.ox,bed=(g.civic.room?.seats??[]).filter(s=>s.kind==='bed').sort((a,b)=>Math.hypot(a.x-(ox+A.x),a.z-2.9)-Math.hypot(b.x-(ox+A.x),b.z-2.9))[0];if(bed)g.posture?.use(bed);}
  const h=g.clock.minutes/60,minutes=mode==='night'?Math.round(((24-h+7)%24||24)*60):180;g.skipTime(minutes);
  g.needs.adjust(mode==='night'?{energy:100,hygiene:70,bladder:60,hunger:25,fun:rm.fun}:{energy:45,hygiene:60,bladder:55,fun:Math.round(rm.fun/2)});
  g.life?.note?.(`hotel:${v.id}:${g.clock.day}:${k}`,`Stayed in a ${rm.label.toLowerCase()} at ${v.name}`,{social:rm.id==='suite'?2:0});g.saveGameNow();g.ui.toast(mode==='night'?`Good morning. You slept well in the ${rm.label.toLowerCase()}.`:'You feel rested.',5000);return true;}
 fuelView(v){const g=this.g;return{title:v.name,text:`Vehicle refuelling and fuel cans available.`,note:'Drive your own vehicle to a pump, stop, then press F to refuel. All stations also sell 5 L fuel cans for your car or generator.',options:[{label:`Buy 5 L fuel jerrycan · ${naira(ITEMS.jerrycan.price)}`,disabled:!g.economy.canAfford(ITEMS.jerrycan.price)||!g.inventory.canAdd(ITEMS.jerrycan),why:'Need money and bag space',act:()=>{if(!this.atSite(v)||!g.inventory.canAdd(ITEMS.jerrycan))return;const tx=g.economy.transact({key:`station-can:${++this.story.s.serviceSeq}`,amount:-ITEMS.jerrycan.price,reason:`Fuel can at ${v.name}`});if(tx.ok){g.inventory.add(ITEMS.jerrycan);g.saveGameNow();g.ui.toast('5 L fuel can added to your bag.');}g.renderChoice();}},{label:'Back to the city',ghost:true,act:()=>g.closeChoice()}]};}
 plan(c){const g=this.g,s=this.story.s,site=this.workplace(c.id),briefs=CAREER_BRIEFS[c.id],brief=briefs[(g.clock.day+(s.work[`${g.clock.day}:${c.id}`]??0))%briefs.length];
  const p=this.story.legacyTarget(c),hotel=this.services.find(v=>v.kind==='hotel'),fuel=this.services.find(v=>v.kind==='fuel');
  let finish={...p};if(c.id==='tech')finish={...this.story.legacyTarget({...c,near:'market-vendor'}),name:'Website handover · Main Market trader'};if(c.id==='apprentice')finish={...this.story.legacyTarget({...c,near:'market-vendor'}),name:'Mentor stock check · Main Market trader'};if(c.id==='realtor')finish.name='Rental inspection · '+(g.homes.listings[0]?.street??'Onitsha home');if(['courier','caterer'].includes(c.id))finish={x:hotel.x,z:hotel.z+1,name:hotel.name+' reception handover'};if(c.id==='mechanic')finish={x:fuel.x,z:fuel.z+2,name:fuel.name+' · driver meeting'};
  if(c.id==='student')finish={x:site.x+10,z:site.z+8,name:'Metadav tutor · exercise review'};
  const steps=[{target:{x:site.x,z:site.z+1,name:site.name+' · job briefing'},prompt:brief[0],choices:[...brief[1]],right:0},{target:finish,prompt:c.prompt,choices:[...c.choices],right:c.right}];
  if(c.id==='creator')steps[1].target={...this.story.legacyTarget({...c,near:'market-vendor'}),name:'Product photography · Main Market trader'};
  if(c.id==='student'){const[x,z]=g.world.findFreeSpot(finish.x,finish.z,.6);steps[1].target={...finish,x,z};}
  if(c.id==='oso_afia'||c.id==='creator')steps.push({target:{x:site.x,z:site.z+1,name:site.name+(c.id==='creator'?' · photo delivery':' · buyer confirmation')},prompt:c.id==='creator'?'Deliver the agreed, accurate photos and confirm client acceptance.':'The buyer has chosen the fabric. How do you close the brokerage?',choices:c.id==='creator'?['Deliver the agreed photos with permission','Substitute misleading pictures']:['Confirm the buyer’s goods and disclosed commission','Add an undisclosed extra fee'],right:0});
  // Vary answer order deterministically, including after reload (the full plan is saved).
  steps.forEach((t,i)=>{if((s.seq+i)%2){t.choices.push(t.choices.shift());t.right=(t.right-1+t.choices.length)%t.choices.length;}});return steps;
 }
}
