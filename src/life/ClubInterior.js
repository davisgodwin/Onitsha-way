import * as THREE from 'three';
import {dancePose,drinkPose} from './VenueActivities.js';
import {SEAT_HEIGHT} from '../characters/CharacterAnimator.js';
import {buildHuman,defaultAppearance,OUTFITS,NPC_HAIR} from '../characters/HumanRig.js';
import {CharacterAnimator} from '../characters/CharacterAnimator.js';
import {openAt} from './CityLife.js';
import {mergeStatic} from '../render/MergeStatic.js';
import {naira} from '../economy/Economy.js';

/**
 * v0.50: the nightclub, rebuilt. An original, fictional club (no real business is portrayed), 30 × 24 m:
 * - a raised DJ stage with decks, speaker stacks and a big LED wall that moves with the music;
 * - an LED dance floor with a crowd of dancers, moving light beams and sweeping lasers;
 * - a long bar with lit bottle shelves and bar staff; a raised VIP section with sofas, tables and ice buckets;
 * - a hype man by the stage, bouncers at the door, waitresses who bring the bottles.
 * Things to do: dance, request a song from the DJ (with a shout-out on the LED wall), "Dorime" bottle service
 * (the waitresses parade the bottles to your table with sparklers while the crowd raises their glasses), spray
 * money on the dance floor, the bar, the VIP lounge and the bathroom.
 * Local frame: x 0..30 across, z 0 (stage wall) .. 24 (entrance). Built off the map at x = ox.
 */
const W = 30, D = 24, H = 6.2;
const NOTE_COLORS = ['#c2e0c9', '#f2c6d2', '#cfd8f4', '#f5e2b0'];
export class ClubInterior {
 constructor(g){this.g=g;this.inside=null;this.people=[];this.t=0;this.lights=[];this.group=new THREE.Group();this.group.name='NightclubInterior';this.group.visible=false;g.renderer.scene.add(this.group);this.ox=9500;this.oz=0;
  g.world.collision.addZone({minX:this.ox-1,maxX:this.ox+W+1,minZ:-1,maxZ:D+1});this.mats=new Map();this.build();}
 mat(color,glow=0,opts={}){const k=color+'|'+glow+JSON.stringify(opts);if(!this.mats.has(k))this.mats.set(k,new THREE.MeshStandardMaterial({color,roughness:.5,metalness:.15,emissive:glow?color:'#000000',emissiveIntensity:glow,...opts}));return this.mats.get(k);}
 build(){const g=this.g,c=g.world.collision,grp=this.group,st=new THREE.Group();st.name='club-static';grp.add(st);this.static=st;
  const box=(w,h,d,x,y,z,color,solid=false,glow=0,parent=st)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),this.mat(color,glow));m.position.set(this.ox+x,y,z);m.castShadow=false;m.receiveShadow=true;parent.add(m);if(solid)c.addPolygon([[this.ox+x-w/2,z-d/2],[this.ox+x+w/2,z-d/2],[this.ox+x+w/2,z+d/2],[this.ox+x-w/2,z+d/2]],h);return m;};this.box=box;
  const cyl=(r,h,x,y,z,color,glow=0,parent=st,seg=16)=>{const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,seg),this.mat(color,glow));m.position.set(this.ox+x,y,z);parent.add(m);return m;};
  // the room: floor, walls, ceiling, gold ribs and LED strips along the walls
  box(W,.16,D,W/2,-.09,D/2,'#16131f');box(.25,H,D,0,H/2,D/2,'#141522',true);box(.25,H,D,W,H/2,D/2,'#141522',true);box(W,H,.25,W/2,H/2,0,'#10121c',true);box(W,H,.25,W/2,H/2,D,'#10121c',true);box(W,.15,D,W/2,H,D/2,'#0b0d14');
  for(let x=1.5;x<W;x+=2.5){box(.06,4.6,.08,x,2.6,D-.17,'#b89261',false,.2);}
  for(const [z,col] of [[.2,'#7b2ff7'],[D-.2,'#00c2ff']])box(W-1,.06,.06,W/2,H-.4,z,col,false,2.5);
  for(const x of[.2,W-.2])box(.06,.06,D-1,x,H-.4,D/2,'#ff2bd6',false,2.5);
  // the stage: platform, steps, DJ desk with decks and mixer, speaker stacks, truss
  box(14,.6,4.6,15,.3,2.4,'#1d1e28',true);box(14,.04,.08,15,.62,4.68,'#00e5ff',false,3);box(4,.3,1,15,.15,5.2,'#262838');
  box(5.2,1.05,.9,15,1.12,3.1,'#0f1015',true);box(5.4,.06,1,15,1.66,3.1,'#2b2f3a');box(5.2,.5,.04,15,1.1,3.56,'#00e5ff',false,1.6);
  for(const x of[13.4,16.6]){cyl(.36,.04,x,1.71,3.05,'#1a1a1a',0,st,24);cyl(.08,.05,x,1.73,3.05,'#c0c0c0');}
  box(1,.05,.6,15,1.71,3.05,'#3a3f4a');for(let i=0;i<8;i++)box(.06,.02,.06,14.6+i*.12,1.75,3.0,['#ff3b3b','#3bff7a','#3bb4ff'][i%3],false,2);
  for(const x of[6.5,23.5]){box(2,3.2,1.6,x,1.6,2.2,'#0d0e12',true);for(const y of[.7,1.6,2.5]){cyl(.42,.05,x,y,3.02,'#22252c');}box(2.1,.08,.08,x,3.25,3.05,'#7b2ff7',false,2);}
  box(16,.25,.25,15,H-.6,4.6,'#2a2d36');for(const x of[7.2,22.8])box(.25,H-.6,.25,x,(H-.6)/2,4.6,'#2a2d36');
  // the LED wall behind the DJ (a canvas that the update() draws: equaliser, the club's name, shout-outs)
  const cv=document.createElement('canvas');cv.width=768;cv.height=256;this.wallCanvas=cv;this.wallTex=new THREE.CanvasTexture(cv);this.wallTex.userData.keepCanvas=true;this.wallTex.colorSpace=THREE.SRGBColorSpace;
  const wall=new THREE.Mesh(new THREE.PlaneGeometry(13,4.3),new THREE.MeshBasicMaterial({map:this.wallTex,toneMapped:false}));wall.position.set(this.ox+15,3.2,.2);grp.add(wall);
  // the dance floor: LED tiles (one instanced mesh, coloured each frame)
  const nx=12,nz=8;this.tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(.96,.03,.96),new THREE.MeshBasicMaterial({toneMapped:false}),nx*nz);this.tileXY=[];
  const m4=new THREE.Matrix4();let k=0;for(let i=0;i<nx;i++)for(let j=0;j<nz;j++){m4.makeTranslation(this.ox+9.5+i,.02,6.5+j);this.tiles.setMatrixAt(k,m4);this.tiles.setColorAt(k,new THREE.Color('#222'));this.tileXY.push([i,j]);k++;}
  grp.add(this.tiles);
  // the bar: counter, lit bottle shelves, stools
  box(1.2,1.1,11,25.5,.55,11.5,'#3b2a24',true);box(1.4,.08,11.2,25.5,1.14,11.5,'#d1b684');box(.05,.5,11,24.88,.6,11.5,'#ffb000',false,1.5);
  box(.4,3,11,29.6,1.9,11.5,'#1a1c24',true);for(const y of[1.2,1.9,2.6]){box(.45,.05,11,29.4,y,11.5,'#ffd27a',false,1.2);for(let z=6.4;z<17;z+=.38)box(.09,.32,.09,29.4,y+.2,z,['#6dd3b5','#c9a24a','#9b7bd6','#e35d5d','#f1f1f1'][Math.floor(z*7)%5],false,.35);}
  this.barStools=[];for(let z=7;z<16.5;z+=1.6){cyl(.22,.05,23.8,.78,z,'#9a7a5a');cyl(.04,.75,23.8,.38,z,'#3a3d44');this.barStools.push(z);}
  // VIP: raised platform, rope, L sofas, tables, ice buckets with bottles
  box(7.5,.1,12,4,.05,12,'#241a2e');box(7.5,.04,.08,4,.12,6.05,'#ffd27a',false,2);box(.08,.04,12,7.75,.12,12,'#ffd27a',false,2);
  for(const z of[6.8,17.2]){for(let x=1;x<=7;x+=1.5)cyl(.04,.9,x,.75,z,'#d4af37',1);box(6,.05,.05,4,1.15,z,'#9b111e');}
  this.vipSeats=[];for(const [z,face] of [[8.2,0],[12,0],[15.8,0]]){box(4.2,.42,.9,3,.51,z-1,'#5b2a5e',true);box(4.2,.7,.2,3,.95,z-1.45,'#5b2a5e');box(.9,.42,1.9,1,.51,z,'#5b2a5e',true);box(1.6,.4,.9,4.6,.5,z+.6,'#16161c',true);cyl(.17,.3,4.6,.85,z+.6,'#c0c0c0',.3);for(const dx of[-.06,.06])cyl(.04,.4,4.6+dx,1.15,z+.6,'#1f5c3a');for(const x of[2.4,3.6])this.vipSeats.push({x:this.ox+x,z:z-.95,y:.72,heading:face,kind:'seat'});}
  // the bathroom (south-east) and the entrance (south wall, middle)
  box(4,3,.15,27.5,1.5,19,'#2e3a44',true);box(.15,3,4.6,25.5,1.5,21.7,'#2e3a44',true);box(.6,.45,.7,28.5,.25,22.6,'#e4ddd1',true);
  box(3,.06,.06,15,3,D-.2,'#ff2bd6',false,3);box(.2,3,.3,13.4,1.5,D-.2,'#2a2d36',true);box(.2,3,.3,16.6,1.5,D-.2,'#2a2d36',true);
  // moving light beams and lasers (additive, no real lights) and three coloured point lights
  this.beams=[];const beamMat=(col)=>new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.16,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
  for(let i=0;i<6;i++){const col=['#a64dff','#00e5ff','#ff3bd4','#ffd23b','#3bff9d','#ff5a3b'][i];const cone=new THREE.Mesh(new THREE.ConeGeometry(1.1,H-.7,16,1,true),beamMat(col));cone.geometry.translate(0,-(H-.7)/2,0);const pivot=new THREE.Group();pivot.position.set(this.ox+8+i*2.8,H-.65,4.6);pivot.add(cone);grp.add(pivot);this.beams.push({pivot,phase:i*1.1});cyl(.18,.25,8+i*2.8,H-.65,4.6,'#20222a',0,grp,8);}
  this.lasers=[];for(let i=0;i<8;i++){const m=new THREE.Mesh(new THREE.BoxGeometry(.02,.02,16),new THREE.MeshBasicMaterial({color:i%2?'#33ff66':'#ff2244',transparent:true,opacity:.55,blending:THREE.AdditiveBlending,depthWrite:false}));m.geometry.translate(0,0,8);const p=new THREE.Group();p.position.set(this.ox+15,H-.9,4.7);p.add(m);grp.add(p);this.lasers.push({p,phase:i*.8});}
  for(const[x,z,color]of[[10,9,'#ab85ff'],[20,9,'#4bdac7'],[15,15,'#ffd084'],[4,12,'#ff8ad8'],[26,11,'#ffcf7a']]){const l=new THREE.PointLight(color,18,16,2);l.position.set(this.ox+x,4.4,z);grp.add(l);this.lights.push(l);}
  // the people
  this.seats=[...this.vipSeats];
  const cast=[];const crowd=(x,z,yaw)=>cast.push(['dance',x,z,0,yaw]);
  for(let i=0;i<20;i++){const a=i*2.399,r=1+Math.sqrt(i)*1.35;crowd(15+Math.cos(a)*r,10.2+Math.sin(a)*r*.6,Math.PI+Math.sin(a)*.6);}
  for(const z of[8.2,12])for(const x of[1.3,4.7]){cast.push(['sit',x,z-.95,.72,0]);}
  cast.push(['sit',1,15.8,.72,Math.PI/2]);
  for(let i=0;i<4;i++)cast.push(['bar',23.8,this.barStools[i*2]??(7+i*3),.78,Math.PI/2]);
  cast.push(['serve',26.8,9,0,-Math.PI/2],['serve',26.8,14,0,-Math.PI/2],['dj',15,2.3,.6,0],['hype',19.5,4,.6,Math.PI*.15],['bouncer',12.6,22.6,0,Math.PI],['bouncer',17.4,22.6,0,Math.PI]);
  for(let i=0;i<3;i++)cast.push(['waitress',26.2,17.5+i*.55,0,-Math.PI/2]);
  this.waitresses=[];
  for(let i=0;i<cast.length;i++){const[role,x,z,y,yaw]=cast[i];const female=role==='waitress'||(role!=='bouncer'&&role!=='dj'&&i%2===1);
   const app=defaultAppearance(female?'female':'male');app.skin=(i*7)%6;app.color=(i*5)%8;app.palette=i%7;app.outfit=OUTFITS[app.gender][(i*3)%Math.min(4,OUTFITS[app.gender].length)].id;app.hair=(NPC_HAIR[app.gender]??[])[i%4]??app.hair;if(role==='bouncer'||role==='waitress'){app.color=role==='bouncer'?7:3;}
   const h=buildHuman(app),seated=role==='sit'||role==='bar';h.group.position.set(this.ox+x,y-(seated?SEAT_HEIGHT*h.group.scale.y:0),z);h.group.rotation.y=yaw;
   if(seated||role==='hype'){const cup=new THREE.Mesh(new THREE.CylinderGeometry(.045,.035,.14,8),this.mat(role==='hype'?'#222':'#d7aa55'));cup.position.set(0,.02,.03);h.bones['hand.R'].add(cup);}
   grp.add(h.group);const p={h,anim:new CharacterAnimator(h,{}),phase:i*1.37,role,home:{x:this.ox+x,y,z,yaw},style:i%3};this.people.push(p);if(role==='waitress')this.waitresses.push(p);}
  // naira notes for spraying (instanced), sparklers for bottle service
  const nc=document.createElement('canvas');nc.width=128;nc.height=64;const nx2=nc.getContext('2d');nx2.fillStyle='#fff';nx2.fillRect(0,0,128,64);nx2.fillStyle='#355c3a';nx2.font='bold 34px system-ui';nx2.textAlign='center';nx2.textBaseline='middle';nx2.fillText('₦',30,33);nx2.fillRect(56,14,58,6);nx2.fillRect(56,30,46,5);nx2.fillRect(56,44,52,5);nx2.strokeStyle='#355c3a';nx2.lineWidth=4;nx2.strokeRect(3,3,122,58);
  const ntex=new THREE.CanvasTexture(nc);ntex.colorSpace=THREE.SRGBColorSpace;this.notes=new THREE.InstancedMesh(new THREE.PlaneGeometry(.16,.08),new THREE.MeshStandardMaterial({map:ntex,side:THREE.DoubleSide,roughness:.8}),360);this.notes.count=0;this.notes.frustumCulled=false;grp.add(this.notes);this.noteState=[];
  this.sparks=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:'#ffe9a0',size:.06,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));this.sparks.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(600*3),3));this.sparks.frustumCulled=false;this.sparks.visible=false;grp.add(this.sparks);
  this.bottles=this.waitresses.map(()=>{const b=new THREE.Group();const glass=new THREE.Mesh(new THREE.CylinderGeometry(.06,.07,.32,10),this.mat('#1f5c3a',0,{metalness:.4,roughness:.2}));glass.position.y=.16;const neck=new THREE.Mesh(new THREE.CylinderGeometry(.02,.04,.14,8),this.mat('#d4af37',.3));neck.position.y=.38;b.add(glass,neck);b.visible=false;return b;});
  this.waitresses.forEach((p,i)=>p.h.bones['hand.R'].add(this.bottles[i]));
  // the club's name over the bar
  const tc=document.createElement('canvas');tc.width=1024;tc.height=128;this.titleCanvas=tc;this.titleTexture=new THREE.CanvasTexture(tc);this.titleTexture.userData.keepCanvas=true;this.titleTexture.colorSpace=THREE.SRGBColorSpace;const title=new THREE.Mesh(new THREE.PlaneGeometry(7,.9),new THREE.MeshBasicMaterial({map:this.titleTexture,transparent:true,toneMapped:false}));title.position.set(this.ox+29.3,4.3,11.5);title.rotation.y=-Math.PI/2;grp.add(title);
  this.mergeStats=mergeStatic(st);
  // what you can do
  this.register(15,22,'Exit club',()=>this.exit());
  this.register(15,5.6,'DJ — request a song',()=>g.openChoice(()=>this.djView()),2.4);
  this.register(15,9.5,'Dance floor — dance, spray money',()=>g.openChoice(()=>this.activityView('dance')),3.2);
  this.register(24,11.5,'Bar — drinks, food & conversation',()=>g.openChoice(()=>g.cityLife.venueView(this.inside)),2.4);
  this.register(5.5,12,'VIP lounge — bottle service (Dorime), relax',()=>g.openChoice(()=>this.activityView('lounge')),2.6);
  this.register(27.5,21.5,'Club bathroom',()=>g.openChoice(()=>this.activityView('toilet')),1.8);
 }
 register(x,z,label,onInteract,radius=2){this.g.interactions.register({x:this.ox+x,z,radius,enabled:()=>!!this.inside&&!this.show,label:()=>label,onInteract});}
 enter(v){if(this.g.saveData.character.ageGroup==='child'){this.g.ui.toast('Nightclubs are unavailable for child characters.');return false;}const g=this.g;if(!v||!openAt(g.clock.minutes/60,v.hours)||g.homes.inside||g.civic.inside||g.vehicles.driving||g.transport.riding){g.ui.toast('The club is closed or you must finish your trip first. Nightclubs open 19:00–04:00 WAT.');return false;}
  this.inside=v;this.group.visible=true;g.hudTimer=0;this.clearNotes();const ctx=this.titleCanvas.getContext('2d');ctx.clearRect(0,0,1024,128);ctx.shadowColor='#ff2bd6';ctx.shadowBlur=24;ctx.fillStyle='#ffe9f8';ctx.font='800 64px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(v.name.toUpperCase(),512,64,980);this.titleTexture.needsUpdate=true;
  g.closeChoice();g.player.teleport(this.ox+15,20.8,Math.PI);g.cameraRig.setMode('follow');g.cameraRig.indoor={ceiling:H-.3,distance:4.6,height:1.4};g.cameraRig.yaw=0;g.cameraRig.pitch=.32;g.cameraRig.snapTo(g.player.position.clone().add(new THREE.Vector3(0,1.3,0)));g.cameraRig.currentDist=1;g.cameraRig.update(1,g.player.position);g.atmosphere.indoor={lamp:true,daylight:0};
  this.shout(`WELCOME TO ${v.name.toUpperCase()}`,6);g.ui.toast(`${v.name} · DJ, dance floor, bar, VIP & WC`);g.saveGame();return true;}
 exit({quiet=false}={}){const v=this.inside;if(!v)return;const g=this.g;this.inside=null;this.show=null;g.venueMusic?.stop();this.dancing=0;g.hudTimer=0;this.group.visible=false;g.cameraRig.indoor=null;g.atmosphere.indoor=null;g.player.teleport(v.x,v.z);g.cameraRig.snapTo(g.player.position);if(!quiet){g.closeChoice();g.ui.toast('You step outside. See you next night.');g.saveGame();}}
 /** pay from the wallet (one key per action) */
 pay(amount,reason){const g=this.g;const r=g.economy.transact({key:`club:${reason}:${g.clock.day}:${++g.saveData.phone.seq}`,amount:-amount,reason});if(!r.ok)g.ui.toast(`You need ${naira(amount)}.`);return r.ok;}
 nightly(key,text,dims){this.g.life?.note?.(`club:${key}:${this.g.clock.day}`,text,dims);}
 // ------------------------------------------------------------------ the DJ
 djView(){const g=this.g,M=g.venueMusic,v=this.inside;if(!v)return null;const now=M.track;
  const tracks=M.clubTracks;return{title:'DJ booth · requests',kicker:'REQUEST A SONG · SHOUT-OUT ON THE SCREEN',text:`Now playing: ${now.name}${now.genre?` (${now.genre})`:''}. Tip the DJ and choose what plays next; for ${naira(5000)} the DJ shouts you out on the big screen.`,note:'The music is original, made for this game (Afrobeats and amapiano DJ mixes, Afrobeat-style tracks). See public/audio/club/custom to add music you have the rights to.',
   options:[...tracks.map(t=>({label:t.name,sub:`${t.genre??''}${t.bpm?` · ${t.bpm} BPM`:''}${t.id===now.id?' · playing now':''}`,act:()=>g.openChoice(()=>this.tipView(t))})),
    ...(g.occupationsCity?.boothView?[{label:'Work the decks / grab the mic (DJ & hype man gigs)',act:()=>g.openChoice(()=>g.occupationsCity.boothView())}]:[]),
    {label:'Volume and mute',act:()=>g.openChoice(()=>M.view())},{label:'Back',ghost:true,act:()=>g.closeChoice()}]};}
 tipView(t){const g=this.g,name=g.saveData.character.name?.split(' ')[0]??'my guy';
  return{title:`Request: ${t.name}`,text:'How much do you tip the DJ?',options:[
   {label:`Tip ${naira(1000)} · play it next`,disabled:!g.economy.canAfford(1000),why:'Not enough money',act:()=>this.request(t,1000,null)},
   {label:`Tip ${naira(5000)} · play it now, with a shout-out`,disabled:!g.economy.canAfford(5000),why:'Not enough money',act:()=>this.request(t,5000,name)},
   {label:'Back',ghost:true,act:()=>g.openChoice(()=>this.djView())}]};}
 request(t,tip,shout){const g=this.g;if(!this.pay(tip,'DJ request'))return;g.closeChoice();g.venueMusic.play(t.id);g.needs.adjust({fun:6,social:3});
  if(shout){this.shout(`SHOUT OUT TO ${shout.toUpperCase()}! ${t.genre?.toUpperCase()??''} VIBES`,9);this.hype(5);g.ui.toast(`DJ: "Make some noise for ${shout}!"`);this.nightly('shout',`The DJ shouted you out at ${this.inside.name}`,{social:1});}
  else g.ui.toast(`DJ: "${t.name}, coming up!"`);g.saveGame();}
 shout(text,seconds){this.shoutText=text;this.shoutUntil=this.t+seconds;}
 hype(seconds){this.hypeUntil=this.t+seconds;}
 // ------------------------------------------------------------------ dance floor, VIP, bathroom
 activityView(kind){const g=this.g,v=this.inside;if(!v)return null;if(!openAt(g.clock.minutes/60,v.hours))return{title:'Closing time',text:'The club is closed.',options:[{label:'Go outside',act:()=>this.exit()}]};
  if(kind==='toilet')return{title:'Club bathroom',options:[{label:'Use toilet and wash hands',act:()=>{g.closeChoice();g.needs.adjust({bladder:100,hygiene:12});g.saveGame();}},{label:'Back',ghost:true,act:()=>g.closeChoice()}]};
  if(kind==='lounge')return{title:'VIP lounge',kicker:'BOTTLE SERVICE · DORIME',text:'Take a table. Order bottle service and the waitresses bring the bottles through the club with sparklers held high, the DJ calls your name and the whole room lifts their glasses: "Dorime!"',options:[
   {label:`Dorime bottle service · ${naira(30000)}`,sub:'Two bottles, sparklers, the parade to your table',disabled:!g.economy.canAfford(30000)||!!this.show,why:this.show?'Something is already happening':'Not enough money',act:()=>this.dorime(30000,2)},
   {label:`Big Dorime · ${naira(80000)}`,sub:'Three bottles, more sparklers, the DJ hypes you, the LED wall shows your name',disabled:!g.economy.canAfford(80000)||!!this.show,why:this.show?'Something is already happening':'Not enough money',act:()=>this.dorime(80000,3)},
   {label:`Chat and relax · ${naira(200)}`,disabled:!g.economy.canAfford(200),act:()=>{if(!this.pay(200,'VIP lounge'))return;g.closeChoice();g.needs.adjust({social:20,energy:8});g.skills.add('charisma',10);g.saveGame();}},
   {label:'Back',ghost:true,act:()=>g.closeChoice()}]};
  return{title:'Dance floor',text:'Join the crowd, or spray money over the dancers: the notes fly, the crowd goes up.',options:[
   {label:'Dance for 15 seconds',act:()=>{g.closeChoice();this.dancing=15;this.danceOrigin={x:g.player.position.x,z:g.player.position.z};g.ui.toast('Dance started — move to stop. Rewards after the dance.');}},
   ...[5000,20000,50000,100000].map(a=>({label:`Spray ${naira(a)}`,sub:a>=50000?'Big man / big woman spray: the DJ notices':'Notes over the dance floor',disabled:!g.economy.canAfford(a)||!!this.show,why:this.show?'Something is already happening':'Not enough money',act:()=>this.spray(a)})),
   {label:'Request a song from the DJ',act:()=>g.openChoice(()=>this.djView())},
   {label:'Back',ghost:true,act:()=>g.closeChoice()}]};}
 /** spray money: notes fly from your hand over the floor for a few seconds; the crowd cheers */
 spray(amount){const g=this.g;if(!this.pay(amount,'Sprayed money in the club'))return;g.closeChoice();const n=Math.min(300,Math.round(30+amount/400));
  this.show={kind:'spray',until:this.t+6,left:n,rate:n/4.5};this.hype(7);if(amount>=50000){this.shout(`${(g.saveData.character.name?.split(' ')[0]??'BIG BOSS').toUpperCase()} DEY SPRAY! ${naira(amount)}`,7);g.ui.toast('DJ: "Big spender on the floor! Make noise!"');}
  else g.ui.toast('The notes fly and the floor goes up!');
  g.needs.adjust({fun:Math.min(30,8+amount/5000),social:Math.min(25,6+amount/6000)});g.skills.add('charisma',Math.min(40,5+Math.round(amount/4000)));this.nightly('spray',`Sprayed money at ${this.inside.name}`,{social:amount>=50000?3:1,public:amount>=50000?1:0});g.saveGame();}
 /** Dorime: the waitresses bring the bottles through the club with sparklers to your table */
 dorime(price,bottles){const g=this.g;if(!this.pay(price,'Dorime bottle service'))return;g.closeChoice();
  const P=g.player.position,seat=[...this.vipSeats].sort((a,b)=>Math.hypot(a.x-P.x,a.z-P.z)-Math.hypot(b.x-P.x,b.z-P.z))[0]??{x:this.ox+3,z:12};
  const target={x:seat.x+1.6,z:seat.z+1.2};this.show={kind:'dorime',until:this.t+15,start:this.t,target,bottles};
  this.waitresses.forEach((p,i)=>{p.walk={from:{x:p.home.x,z:p.home.z},to:{x:target.x+(i-1)*.7,z:target.z+.6},t0:this.t+i*.5};this.bottles[i].visible=i<bottles;});
  this.sparks.visible=true;this.shout('DORIME! DORIME! BOTTLES TO THE VIP',12);this.hype(13);g.ui.toast('Bottle service is coming — the room lifts their glasses: "Dorime!"');
  g.needs.adjust({fun:20,social:25});g.skills.add('charisma',bottles*12);this.nightly('dorime',`Ordered Dorime bottle service at ${this.inside.name}`,{social:bottles,public:1});g.saveGame();}
 clearNotes(){this.noteState=[];if(this.notes)this.notes.count=0;}
 // ------------------------------------------------------------------ every frame
 update(dt){if(!this.inside)return;const g=this.g;if(!openAt(g.clock.minutes/60,this.inside.hours)){this.exit();return;}g.atmosphere.indoor={lamp:true,daylight:0};if(g.state!=='playing'&&g.state!=='overlay')return;this.t+=dt;
  const bands=g.venueMusic?.bands?.(16),bass=bands?(bands[0]+bands[1]+bands[2])/3:.5+.4*Math.max(0,Math.sin(this.t*Math.PI*104/60)),hype=this.hypeUntil>this.t;
  for(const p of this.people)this.animate(p,dt,hype,bass);
  this.drawWall(bands,bass);this.drawFloor(bass);
  for(const b of this.beams){b.pivot.rotation.z=.55*Math.sin(this.t*.7+b.phase);b.pivot.rotation.x=.4*Math.cos(this.t*.55+b.phase*1.3);b.pivot.children[0].material.opacity=.08+.14*bass;}
  for(const l of this.lasers){l.p.rotation.y=.9*Math.sin(this.t*1.3+l.phase);l.p.rotation.x=.22+.12*Math.sin(this.t*2.1+l.phase);l.p.visible=hype||Math.sin(this.t*.4)>-.2;}
  for(let i=0;i<this.lights.length;i++)this.lights[i].intensity=12+10*bass*(.6+.4*Math.sin(this.t*1.8+i));
  this.updateShow(dt);
  if(this.dancing>0){if(Math.hypot(g.player.position.x-this.danceOrigin.x,g.player.position.z-this.danceOrigin.z)>.7){this.dancing=0;g.ui.toast('Dance stopped.');}else{this.dancing-=dt;this.pose(g.player.human,this.t*3.6);if(this.dancing<=0){g.player.idle(.1);g.needs.adjust({fun:12,social:4,energy:-2,hygiene:-1});g.skills.add('dancing',12);g.saveGame();g.ui.toast('Nice moves! +12 dancing XP.');}}}
 }
 animate(p,dt,hype,bass){const t=this.t,b=p.h.bones;
  if(p.role==='sit'||p.role==='bar'){p.anim.sit(dt);if(hype&&p.role==='sit'){b['upperArm.R'].rotation.set(-2.6,0,-.2);b['foreArm.R'].rotation.set(-.3,0,0);}else drinkPose(p.h,t+p.phase);return;}
  if(p.walk){const w=p.walk,sh=this.show?.kind==='dorime'?this.show:null;if(!sh){p.walk=null;p.h.group.position.set(p.home.x,0,p.home.z);p.h.group.rotation.y=p.home.yaw;}else{
   const back=t>sh.until-3,k=back?Math.min(1,(t-(sh.until-3))/3):Math.max(0,Math.min(1,(t-w.t0)/5)),from=back?w.to:w.from,to=back?w.from:w.to;
   const moving=k>0&&k<1;p.h.group.position.set(from.x+(to.x-from.x)*k,0,from.z+(to.z-from.z)*k);if(moving)p.h.group.rotation.y=Math.atan2(to.x-from.x,to.z-from.z);
   p.anim.update(dt,{speed:moving?1.2:0,grounded:true,turnRate:0});b['upperArm.R'].rotation.set(-2.9,0,-.15);b['foreArm.R'].rotation.set(-.2,0,0);return;}}
  p.anim.update(dt,{speed:0,grounded:true,turnRate:0});
  if(p.role==='dance'){const tt=t*(p.style===1?4.2:3.6)+p.phase;dancePose(p.h,tt);if(p.style===2){b.hips.position.y=.96+.05*Math.abs(Math.sin(tt));b.chest.rotation.x=.12*Math.sin(tt*2);} // a bounce
   if(hype){b['upperArm.L'].rotation.set(-2.7+.3*Math.sin(tt*2),0,.25);b['upperArm.R'].rotation.set(-2.7-.3*Math.sin(tt*2),0,-.25);b['foreArm.L'].rotation.x=-.2;b['foreArm.R'].rotation.x=-.2;}
   p.h.group.position.y=.04*bass*Math.abs(Math.sin(tt));return;}
  if(p.role==='dj'){b['upperArm.L'].rotation.set(-.9,0,.2);b['foreArm.L'].rotation.x=-1;b['upperArm.R'].rotation.set(-.9+.25*Math.sin(t*3),0,-.2);b['foreArm.R'].rotation.x=-1.1;b.head.rotation.x=.12+.1*Math.sin(t*Math.PI*104/60);if(hype){b['upperArm.L'].rotation.set(-2.8,0,.2);b['foreArm.L'].rotation.x=-.1;}return;}
  if(p.role==='hype'){b['upperArm.R'].rotation.set(-1.9-.4*Math.sin(t*4),0,-.3);b['foreArm.R'].rotation.x=-.9;b['upperArm.L'].rotation.set(hype?-2.8:-.6,0,.3);b.head.rotation.y=.4*Math.sin(t*.8);return;}
  if(p.role==='bouncer'){b['upperArm.L'].rotation.set(-.3,0,.6);b['upperArm.R'].rotation.set(-.3,0,-.6);b['foreArm.L'].rotation.set(-1.6,0,0);b['foreArm.R'].rotation.set(-1.6,0,0);return;}
  if(p.role==='waitress'){b['upperArm.R'].rotation.set(-.3,0,-.1);return;}
  b['upperArm.L'].rotation.x=-.65;b['foreArm.L'].rotation.x=-1.1;b['upperArm.R'].rotation.x=-.65-.15*Math.sin(t*2);b['foreArm.R'].rotation.x=-1.1;}
 updateShow(dt){const g=this.g,s=this.show;
  // spray: notes leave your hand and flutter down over the floor; they stay on the floor until you leave
  if(s?.kind==='spray'&&s.left>0){let k=Math.min(s.left,Math.ceil(s.rate*dt));s.left-=k;const P=g.player.position;while(k-->0)this.noteState.push({x:P.x+(Math.random()-.5)*.4,y:2.3,z:P.z+(Math.random()-.5)*.4,vx:(Math.random()-.5)*2.6,vz:-Math.random()*2.2,vy:1.5+Math.random()*1.2,rx:Math.random()*6,ry:Math.random()*6,spin:2+Math.random()*4,col:NOTE_COLORS[Math.floor(Math.random()*4)]});}
  if(this.noteState.length){const m=this._m??=new THREE.Matrix4(),q=this._q??=new THREE.Quaternion(),e=this._e??=new THREE.Euler(),pos=this._p??=new THREE.Vector3(),one=this._one??=new THREE.Vector3(1,1,1),c=this._c??=new THREE.Color();
   const N=Math.min(this.noteState.length,this.notes.instanceMatrix.count);if(this.noteState.length>N)this.noteState.splice(0,this.noteState.length-N);
   this.noteState.forEach((n,i)=>{if(n.y>.03){n.vy-=3.2*dt;n.vy=Math.max(n.vy,-.9);n.x+=n.vx*dt;n.z+=n.vz*dt;n.vx*=.985;n.vz*=.985;n.y+=n.vy*dt;n.rx+=n.spin*dt;n.ry+=n.spin*.7*dt;if(n.y<=.03){n.y=.03;n.rx=-Math.PI/2;n.ry=n.ry%6;}}
    e.set(n.y>.03?n.rx:-Math.PI/2,n.ry,0);m.compose(pos.set(n.x,n.y,n.z),q.setFromEuler(e),one);this.notes.setMatrixAt(i,m);this.notes.setColorAt(i,c.set(n.col));});
   this.notes.count=N;this.notes.instanceMatrix.needsUpdate=true;if(this.notes.instanceColor)this.notes.instanceColor.needsUpdate=true;}
  // dorime: sparkler sparks over each carried bottle
  if(s?.kind==='dorime'){const pos=this.sparks.geometry.attributes.position,v=new THREE.Vector3();let k=0;for(let i=0;i<s.bottles;i++){this.bottles[i].getWorldPosition(v);for(let j=0;j<200&&k<600;j++,k++){const a=Math.random()*6.28,r=Math.random()*.35,up=Math.random()*.5;pos.setXYZ(k,v.x+Math.cos(a)*r,v.y+.45+up,v.z+Math.sin(a)*r);}}for(;k<600;k++)pos.setXYZ(k,0,-50,0);pos.needsUpdate=true;}
  if(s&&this.t>s.until){if(s.kind==='dorime'){this.sparks.visible=false;this.bottles.forEach(b=>b.visible=false);g.ui.toast('Dorime! The bottles are on your table.');}this.show=null;}
 }
 drawWall(bands,bass){const c=this.wallCanvas,x=c.getContext('2d'),W2=c.width,H2=c.height,t=this.t;if((this._wallT=(this._wallT??0)+1)%2)return;
  const grad=x.createLinearGradient(0,0,W2,H2);grad.addColorStop(0,`hsl(${(t*20)%360},70%,${8+bass*10}%)`);grad.addColorStop(1,`hsl(${(t*20+120)%360},70%,${6+bass*8}%)`);x.fillStyle=grad;x.fillRect(0,0,W2,H2);
  const n=24;for(let i=0;i<n;i++){const v=bands?bands[Math.floor(i/n*16)]:(.3+.6*Math.abs(Math.sin(t*3+i*.7))*bass),h=v*H2*.8,bw=W2/n;x.fillStyle=`hsl(${(i*12+t*40)%360},90%,60%)`;x.fillRect(i*bw+3,H2-h,bw-6,h);x.fillStyle='rgba(255,255,255,.7)';x.fillRect(i*bw+3,H2-h-6,bw-6,4);}
  x.save();x.globalAlpha=.25+.3*bass;x.strokeStyle='#ffffff';x.lineWidth=3;x.beginPath();x.arc(W2/2,H2/2,40+bass*60,0,Math.PI*2);x.stroke();x.restore();
  const msg=this.shoutUntil>t?this.shoutText:(this.inside?.name??'').toUpperCase();x.textAlign='center';x.textBaseline='middle';x.font=`900 ${this.shoutUntil>t?44:56}px system-ui`;x.lineWidth=8;x.strokeStyle='rgba(0,0,0,.6)';x.strokeText(msg,W2/2,H2*.36,W2-40);x.fillStyle=this.shoutUntil>t&&Math.floor(t*4)%2?'#ffe14d':'#ffffff';x.fillText(msg,W2/2,H2*.36,W2-40);
  const tr=this.g.venueMusic?.track;if(tr){x.font='600 20px system-ui';x.fillStyle='rgba(255,255,255,.85)';x.fillText(`NOW PLAYING · ${tr.name.toUpperCase()}`,W2/2,H2*.6,W2-60);}
  this.wallTex.needsUpdate=true;}
 drawFloor(bass){const c=this._fc??=new THREE.Color(),t=this.t;for(let k=0;k<this.tileXY.length;k++){const[i,j]=this.tileXY[k],v=Math.sin(i*.7+t*3)+Math.cos(j*.9-t*2.4);c.setHSL(((i+j)*.06+t*.08)%1,.85,.18+.22*bass*(v>.4?1:.35));this.tiles.setColorAt(k,c);}this.tiles.instanceColor.needsUpdate=true;}
 pose(h,t){const b=h.bones;b.hips.rotation.z=.1*Math.sin(t);b.hips.position.y=.98+.025*Math.sin(t*2);b.spine.rotation.y=.15*Math.sin(t);b['upperArm.L'].rotation.set(-.4-.3*Math.sin(t),0,.35);b['upperArm.R'].rotation.set(-.4+.3*Math.sin(t),0,-.35);b['foreArm.L'].rotation.x=-.8;b['foreArm.R'].rotation.x=-.8;b['thigh.L'].rotation.x=.14*Math.sin(t);b['thigh.R'].rotation.x=-.14*Math.sin(t);}
 savePosition(){return this.inside?{x:this.inside.x,z:this.inside.z,heading:0,club:this.inside.id}:null;}
}
