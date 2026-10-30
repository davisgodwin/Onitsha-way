import {dancePose} from './VenueActivities.js';
import {SEAT_HEIGHT} from '../characters/CharacterAnimator.js';
import {buildVenue,venuePlot,venueSize} from '../world/VenueArchitecture.js';
import * as THREE from 'three';
import { naira } from '../economy/Economy.js';
/** Original fictional venues/encounters; never allegations about real businesses or people. */
export const openAt = (h,[a,b]) => a>b ? h>=a || h<b : h>=a && h<b;
export class CityLife {
  constructor(game) { this.g=game;this.venues=[];this.encounters=[];this.check=0; }
  setup() {
    const g=this.g; this.group=new THREE.Group();this.group.name='M9CityLife';g.renderer.scene.add(this.group);
    const defs=[{id:'market-parlour',name:'Market Corner Beer Parlour',near:'main-market',dx:38,dz:35,hours:[12,23],kind:'bar'},{id:'river-lounge',name:'Bridgehead Riverside Lounge',near:'bridgehead',dx:45,dz:55,hours:[14,24],kind:'bar'},{id:'house-of-pilate',name:'House of Pilate',near:'upper-iweka-park',dx:-65,dz:55,hours:[19,4],kind:'club',placement:'Fictional in-game location, placed at the player’s request; not the real address'}, {id:'osha-afterdark',name:'Osha Afterdark',near:'upper-iweka-park',dx:50,dz:35,hours:[19,4],kind:'club'}];
    const box=(w,h,d,x,y,z,color)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.65}));m.position.set(x,y,z);m.castShadow=true;this.group.add(m);return m;};
    this.box=box;
    // v0.49: one function per venue, so more bars and clubs can be opened later (MorePlaces)
    const addVenue=(def,p)=>{const {x,z}=p;const v={...def,...p,fictional:true};this.venues.push(v);buildVenue(g.world,v,this.group);
      g.interactions.register({x,z,radius:3,enabled:()=>!!g.saveData&&!g.homes.inside&&!g.club?.inside&&!g.civic?.inside&&!g.vehicles.driving&&!g.transport.riding,label:()=>v.name,onInteract:()=>v.kind==='club'&&openAt(g.clock.minutes/60,v.hours)?g.club.enter(v):g.openChoice(()=>this.venueView(v))});
      const at=(u,w)=>({x:x+Math.cos(v.yaw)*u+Math.sin(v.yaw)*w,z:z-Math.sin(v.yaw)*u+Math.cos(v.yaw)*w});
      v.seats=[];
      if(v.kind==='bar'){
        for(const [i,u,w,dir]of [[0,-5,-2,1],[1,-3,-2,-1],[2,3,-2,1],[3,5,-2,-1],[4,-5,1,1],[5,5,1,-1]]){
          const q=at(u,w),yaw=v.yaw+dir*Math.PI/2;
          const person=g.npcs.addAnchored({id:`venue:${v.id}:${i}`,kind:'nightlife',role:'neighbour',name:['Chuka','Amaka','Uche','Chisom','Ifeanyi','Ada'][i],...q,nx:Math.sin(yaw),nz:Math.cos(yaw),schedule:v.hours,gender:i%2?'female':'male',activity:'drink',seatY:.5});
          v.seats.push({x:q.x,z:q.z,y:.5,yaw,person});
        }
        // Two spare real chairs for the player; dancing stays in the clear strip by the counter.
        for(const u of[-1,1]){const q=at(u,1);v.seats.push({...q,y:.5,yaw:v.yaw+(u<0?Math.PI/2:-Math.PI/2)});}
        for(let i=0;i<2;i++){const q=at(i?2:-2,-4.1);g.npcs.addAnchored({id:`venue:${v.id}:dance:${i}`,kind:'nightlife',role:'neighbour',name:i?'Nneka':'Obi',...q,nx:Math.sin(v.yaw),nz:Math.cos(v.yaw),schedule:v.hours,gender:i?'female':'male',activity:'dance'});}
        const q=at(0,-6.9);g.npcs.addAnchored({id:`venue:${v.id}:staff`,kind:'nightlife',role:'trader',name:'Bar staff',...q,nx:Math.sin(v.yaw),nz:Math.cos(v.yaw),schedule:v.hours,activity:'serve'});
      }
      return v;};
    this.addVenue=addVenue;
    for(const def of defs){const l=g.world.landmarks.get(def.near);if(!l)continue;addVenue(def,venuePlot(g.world,{x:l.x+def.dx,z:l.z+def.dz},venueSize(def.kind)));}
    const hubs=g.world.landmarks.list.filter(l=>['market','transport','fuel','venue','landmark','public'].includes(l.kind)||['main-market','upper-iweka-park','bridgehead','ochanja','fegge','shoprite'].includes(l.id));
    const anchors=hubs.filter(l=>!l.ext); // v0.48: places from a map extension come last, so the earlier map's encounters stay where they were
    for(const e of g.graph.edges){if(!e.drivable||e.road.elevated||e.len<35||!['primary','secondary','tertiary','residential'].includes(e.road.type))continue;
      const a=g.graph.nodes[e.a],x=a[0]+e.dx*e.len*.5,z=a[1]+e.dz*e.len*.5;
      if(anchors.some(q=>Math.hypot(q.x-x,q.z-z)<190))continue;
      anchors.push({id:'road-'+e.id,name:e.road.name||'Neighbourhood roadside',x,z});if(anchors.length>=64)break;
    }
    anchors.push(...hubs.filter(l=>l.ext));
    const oldRoads=g.world.map.meta?.extensions?.[0]?.before?.roads??Infinity,newRoads=new Set(g.world.map.roads.slice(oldRoads)),newRoad=(r)=>newRoads.has(r);
    this.encounterGrid=new Map();
    for(const l of anchors){const road=g.world.map.nearestRoad(l.x,l.z,{maxDist:120});if(!road)continue;
      let found=null;for(let i=0;i<20;i++){const a=i*Math.PI*.38,r=8+i*.8,x=l.x+Math.cos(a)*r,z=l.z+Math.sin(a)*r;
        if(g.world.collision.isFree(x,z,1,l.ext?null:2)&&!g.world.terrain.isWater(x,z)&&!g.world.map.onCarriageway(x,z,1,l.ext?null:newRoad)&&!g.world.collision.inZone(x,z)&&!g.vehicles.dealerships.some(q=>Math.hypot(q.x-x,q.z-z)<32)){found={x,z};break;}}
      if(!found||this.encounters.some(q=>Math.hypot(q.x-found.x,q.z-found.z)<100))continue;
      const e={id:l.id,...found,name:l.name,people:[]};this.encounters.push(e);const cell=Math.floor(e.x/60)+','+Math.floor(e.z/60);if(!this.encounterGrid.has(cell))this.encounterGrid.set(cell,[]);this.encounterGrid.get(cell).push(e);
      for(let i=0;i<2;i++){const[nx,nz]=g.world.findFreeSpot(e.x+i*1.4,e.z,.4);e.people.push(g.npcs.addAnchored({id:`street:${e.id}:${i}`,kind:'street',role:'tout',name:i?'Area companion':'Rank regular',x:nx,z:nz,nx:0,nz:1,schedule:[6,23],gender:'male'}));}
      g.interactions.register({x:e.x,z:e.z,radius:5,enabled:()=>this.canEncounter(e),label:()=>`Agbero / area boys · ${e.name}`,onInteract:()=>this.beginEncounter(e)});
    }
    // Mall visitors remain on the pedestrian forecourt, not in through traffic.
    const mall=g.world.landmarks.get('shoprite');if(mall){for(let i=0;i<9;i++){const[x,z]=g.world.findFreeSpot(1630+(i%3)*12,-1020-Math.floor(i/3)*18,.4);g.npcs.addAnchored({id:`mall:m9:${i}`,kind:'mall-visitor',role:'neighbour',name:['Chika','Obi','Ada','Ikenna','Nneka','Somto','Amara','Ugo','Kene'][i],x,z,nx:i%2?1:-1,nz:0,schedule:[9,21],gender:i%2?'male':'female'});}}
    this.addCivicLandmark=(l)=>{const[x,z]=l.site?[l.site.door.stand.x,l.site.door.stand.z]:g.world.findFreeSpot(l.x,l.z,1);l.visitSpot={x,z};if(!l.site)this.sign(l.name,x,2.7,z,'#a8d2e5');g.interactions.register({x,z,radius:3,priority:2,enabled:()=>!!g.saveData&&!g.homes.inside&&!g.club?.inside&&!g.civic?.inside&&!g.vehicles.driving,label:()=>l.site?(g.civic.isOpen(l)?`${l.name} — go in`:`${l.name} — opens ${g.civic.hours(l)[0]}:00`):l.name,onInteract:()=>l.site&&g.civic.isOpen(l)?g.civic.enter(l):g.openChoice(()=>({title:l.name,text:l.blurb,note:'Mapped location; buildings and access are simplified for gameplay.',options:[{label:g.civic.isOpen(l)?'Enter visitor room':'Visitor room closed',sub:`${g.civic.hours(l)[0]}:00–${g.civic.hours(l)[1]}:00 · visitor room`,disabled:!g.civic.isOpen(l),act:()=>g.civic.enter(l)},{label:l.kind==='school'?'Read and learn (30 min)':'Take a quiet break (20 min)',act:()=>{g.closeChoice();g.skipTime(l.kind==='school'?30:20);g.needs.adjust({fun:8,social:5});if(l.kind==='school')g.skills.add('charisma',15);g.saveGame();}},{label:'Leave',ghost:true,act:()=>g.closeChoice()}]}))});};
    for(const l of g.world.landmarks.list.filter(l=>['school','public','church'].includes(l.kind)))this.addCivicLandmark(l);
  }
  encounterKey(e) { return `${this.g.clock.day}:${e.id}`; }
  canEncounter(e) {
    const g=this.g;
    return !!g.saveData && g.state==='playing' && !g.homes.inside && !g.club?.inside && !g.civic?.inside
      && !g.vehicles.driving && !g.transport.riding && !this.activity && !(this.encounterCooldown>0)
      && !g.world.collision.inZone(g.player.position.x,g.player.position.z)
      && openAt(g.clock.minutes/60,[6,23]) && !g.saveData.street.resolved[this.encounterKey(e)];
  }
  beginEncounter(e) {
    if(!this.canEncounter(e))return false;
    const g=this.g,key=this.encounterKey(e);
    g.npcs?.ensureAnchored(e.people??[],g.player.position.x,g.player.position.z);
    g.saveData.street.resolved[key]=true;this.encounterCooldown=90;g.saveGame();
    g.openChoice(()=>this.encounterView(e,key));return true;
  }
  places() {
    const g=this.g,open=openAt(g.clock.minutes/60,[6,23]);
    return this.encounters.map(e=>{
      const resolved=!!g.saveData?.street?.resolved[this.encounterKey(e)];
      return {id:`agbero:${e.id}`,x:e.x,z:e.z,kind:'agbero',resolved,open,
        label:e.name};
    });
  }
  sign(text,x,y,z,color) {const c=document.createElement('canvas');c.width=768;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#172e2a';ctx.fillRect(0,0,768,128);ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='bold 38px system-ui';ctx.fillText(text,384,64,730);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(5.4,.9),new THREE.MeshStandardMaterial({map:t,side:THREE.DoubleSide,emissive:'#ffffff',emissiveMap:t,emissiveIntensity:.3}));m.position.set(x,y,z);this.group.add(m);}
  start() { this.lastEncounter=null;this.check=0;this.encounterCooldown=0;this.activity=null; }
  updateActivity(dt){const g=this.g,a=this.activity;if(!a)return;
    if(g.state!=='playing')return;
    if(!openAt(g.clock.minutes/60,a.venue.hours)||Math.hypot(g.player.position.x-a.x,g.player.position.z-a.z)>.7){this.finishActivity(false);return;}
    a.left-=dt;a.time+=dt;
    if(a.kind==='dance')dancePose(g.player.human,a.time*3.6);else {g.player.animator.sit(dt);g.player.human.group.position.y=a.y-SEAT_HEIGHT*g.player.human.group.scale.y;}
    if(a.left<=0)this.finishActivity(true);
  }
  beginActivity(v,kind='sit'){const g=this.g;if(!openAt(g.clock.minutes/60,v.hours))return;
    const seat=v.seats?.find(s=>!s.person);if(kind!=='dance'&&!seat){g.ui.toast('No free seat right now.');return;}
    const q=kind==='dance'?{x:v.x+Math.sin(v.yaw)*-4.1,z:v.z+Math.cos(v.yaw)*-4.1,y:0,yaw:v.yaw}:seat;
    g.closeChoice();g.player.teleport(q.x,q.z,q.yaw);this.activity={venue:v,kind,...q,left:15,time:0};g.ui.toast(kind==='dance'?'Dancing — move to stop.':'Seated at the bar — move to stand up.');
  }
  finishActivity(reward){const g=this.g,a=this.activity;if(!a)return;this.activity=null;g.player.human.group.position.y=0;
    const dx=Math.sin(a.yaw),dz=Math.cos(a.yaw),[x,z]=g.world.findFreeSpot(a.x+dx*.9,a.z+dz*.9,.35);g.player.teleport(x,z,a.yaw);
    if(reward){g.needs.adjust(a.kind==='dance'?{fun:12,social:5,energy:-2}:{social:10,fun:6});if(a.kind==='dance')g.skills.add('dancing',12);g.saveGame();g.ui.toast(a.kind==='dance'?'Nice moves! +12 dancing XP.':'A good break with the regulars.');}
  }
  update(dt) {const g=this.g;this.updateActivity(dt);this.encounterCooldown=Math.max(0,(this.encounterCooldown||0)-dt);
    if(g.civic?.inside||g.club?.inside||g.state!=='playing'||!g.saveData||g.homes.inside||g.vehicles.driving||g.transport.riding||this.activity)return;
    this.check-=dt;if(this.check>0)return;this.check=1;if(this.encounterCooldown>0)return;const h=g.clock.minutes/60;if(h<6||h>=23)return;
    const px=g.player.position.x,pz=g.player.position.z,cx=Math.floor(px/60),cz=Math.floor(pz/60);
    for(let x=cx-1;x<=cx+1;x++)for(let z=cz-1;z<=cz+1;z++)for(const e of this.encounterGrid.get(x+','+z)||[]){if(Math.hypot(e.x-px,e.z-pz)>4)continue;if(this.beginEncounter(e))return;}
  }
  encounterView(e,key) { const g=this.g,finish=(msg)=>{this.encounterCooldown=90;g.saveData.street.resolved[key]=true;for(const k of Object.keys(g.saveData.street.resolved))if(Number(k.split(':')[0])<g.clock.day-7)delete g.saveData.street.resolved[k];g.closeChoice();g.phoneServices.message('Street guide',msg);g.saveGame();g.ui.toast(msg);};return{title:'Agbero / area boys',kicker:`STREET ENCOUNTER · ${e.name}`,text:'A rank regular calls out: “Oga, anything for the boys?” You can refuse. No charge is automatic.',note:'Fictional gameplay encounter, not a real-world location claim. You can leave safely; no combat or compulsory payment.',options:[{label:'Run from the group',disabled:g.saveData.character.ageGroup==='child',why:'Child characters can walk away or ask for help',sub:'Start an escape mini-game · no automatic payment',act:()=>{finish('You ran from the group.');g.story.startChase('thugs','Street extortion');}},{label:'Keep walking',sub:'No payment · end this encounter for today',primary:true,act:()=>finish('You walked away safely. No street fee was paid.')},{label:'Talk calmly',sub:`Charisma level ${g.skills.level('charisma')} · practise settling tension`,act:()=>{g.skills.add('charisma',20);g.needs.adjust({social:5});finish(g.skills.level('charisma')>=3?'You reasoned together; they shared a shortcut.':'You kept it respectful and moved on.');}},{label:'Give ₦200 voluntarily',disabled:!g.economy.canAfford(200),why:'Not enough money',act:()=>{const r=g.economy.transact({key:`street:${key}`,amount:-200,reason:'Optional street gift'});if(r.ok)finish('You chose to give ₦200. No further payment here today.');}}]}; }
  venueView(v) { const g=this.g,open=openAt(g.clock.minutes/60,v.hours);const activity=(id,label,price,minutes,effects,skill)=>({label,sub:`${naira(price)} · ${minutes} min`,disabled:!open||!g.economy.canAfford(price)||!!g.saveData.phone.work[`venue:${v.id}:${id}:${g.clock.day}`],why:!open?'Closed':'Not enough money or already enjoyed today',act:()=>{const k=`venue:${v.id}:${id}:${g.clock.day}`;if(!openAt(g.clock.minutes/60,v.hours)){g.closeChoice();g.ui.toast('The venue has closed.');return;}if(g.saveData.phone.work[k])return;const tx=g.economy.transact({key:k,amount:-price,reason:`${v.name}: ${label}`});if(!tx.ok)return;g.saveData.phone.work[k]=true;g.closeChoice();g.skipTime(minutes);g.needs.adjust(effects);if(skill)g.skills.add(skill,35);g.saveGame();g.ui.toast(`${label} · ${minutes} minutes well spent.`);}});
    return{title:v.name,kicker:v.kind==='club'?'NIGHTLIFE':'FOOD & MUSIC',text:open?`Sit down, enjoy music and meet the regulars. Meals and non-alcoholic drinks are available.`:`Closed. Opens ${v.hours[0]}:00; closes ${v.hours[1]}:00.`,note:'Entertainment and food affect needs. Each paid activity is available once per day.',options:[...(open?[{label:'Music — playlist & volume',act:()=>g.openChoice(()=>g.venueMusic.view())}]:[]),...(v.kind==='bar'&&open?[{label:'Sit with a drink · 15 seconds',act:()=>this.beginActivity(v,'sit')},{label:'Join the dancing · 15 seconds',act:()=>this.beginActivity(v,'dance')}]:[]),...(v.kind==='club'&&!g.club?.inside?[{label:open?'Enter nightclub':'Nightclub closed · 19:00–04:00',disabled:!open,act:()=>{g.closeChoice();g.club.enter(v);}}]:[]),activity('meal','Pepper soup & malt',700,30,{hunger:45,fun:10,social:5}),activity('social','Gist with the regulars',150,30,{social:35,fun:12},'charisma'),activity('dance',v.kind==='club'?'Dance to the DJ':'Enjoy the live music',300,45,{fun:45,social:15,energy:-8,hygiene:-5},v.kind==='club'?'dancing':'music'),activity('comedy','Join the open mic',200,30,{fun:20,social:20},'comedy'),{label:'Use venue toilet',disabled:!open,why:'Closed',act:()=>{g.closeChoice();g.skipTime(5);g.needs.adjust({bladder:100,hygiene:5});g.saveGame();}},{label:'Leave',ghost:true,act:()=>g.closeChoice()}]}; }
}
