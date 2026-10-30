import fs from 'node:fs';import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await b.newPage({viewport:{width:1280,height:850}}),errors=[],checks=[];
p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(120000);fs.mkdirSync('qa/v26',{recursive:true});
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
try{
 await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1})));
 await p.goto('http://127.0.0.1:4240/?quickstart');await p.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:240000});
 const setup=await p.evaluate(async()=>{const g=__game;g.renderer.renderer.setAnimationLoop(null);history.replaceState(null,'','/');g.touch=true;g.clock.setMode('game');g.clock.minutes=16*60;g.clock.rate=0;g.economy.transact({key:'qa26:funds',amount:1000000,reason:'QA fixture'});
  window.view26=(x,z,y=1.3,dist=15,yaw=0)=>{g.world.update(1,{x,z});g.atmosphere.update(g.clock.minutes);g.atmosphere.indoor=null;g.renderer.camera.position.set(x+Math.sin(yaw)*dist,6,z+Math.cos(yaw)*dist);g.renderer.camera.lookAt(x,y,z);g.renderer.followShadows({x,y:0,z});g.renderer.render();};
  return {lots:g.vehicles.dealerships.map(l=>({id:l.id,type:l.frontage?.roadName,stock:g.vehicles.spots.filter(s=>s.lot===l.id).length,displays:l.group.children.filter(o=>o.name.startsWith('DealerDisplay:')).length})),encounters:g.cityLife.encounters.length,posts:g.police.posts.length,barResidents:g.npcs.residents.filter(r=>r.kind==='nightlife').map(r=>({activity:r.activity,seatY:r.seatY})),clubRoles:g.club.people.map(p=>p.role)};
 });
 check('every roadside dealer lists all 38 cars (v0.48: +Avalon, Civic) and displays six',setup.lots.length>=6&&setup.lots.filter(l=>l.type).every(l=>l.stock===38&&l.displays===6&&l.type));
 check('agbero encounters cover many neighbourhoods rather than three fixed hotspots',setup.encounters>=18);
 check('bars have seated drinkers, dancers and bar staff',setup.barResidents.filter(r=>r.seatY===.5).length===12&&setup.barResidents.filter(r=>r.activity==='dance').length===4);
 check('club has seated booths, bar stools, dancers and working DJ', ['sit','bar','dance','dj','serve'].every(role=>setup.clubRoles.includes(role)));
 // Real pooled bar residents, correct seat-surface placement, gestures move over time.
 const patrons=await p.evaluate(()=>{const g=__game,v=g.cityLife.venues.find(v=>v.kind==='bar');g.player.teleport(v.x,v.z);for(let i=0;i<4;i++)g.npcs.update(.6,{player:{x:v.x,z:v.z,speed:0,riding:false},hour:16,camera:g.renderer.camera,talkingTo:null,vehicles:[]});
  const seated=g.npcs.active.filter(n=>n.identity.id.startsWith('venue:'+v.id)&&n.identity.seatY!=null),dancer=g.npcs.active.find(n=>n.identity.id.includes(v.id+':dance:'));
  const before=dancer?.rig.bones['upperArm.L'].rotation.x;g.npcs.updateNPC(dancer,.4,v.x,v.z,{speed:0,riding:false},16,null,[]);g.npcs.t+=.4;g.npcs.updateNPC(dancer,.4,v.x,v.z,{speed:0,riding:false},16,null,[]);
  view26(v.x,v.z-3,1,20,v.yaw);return {count:seated.length,pose:seated.every(n=>n.rig.bones['thigh.L'].rotation.x< -1&&Math.abs(n.rig.group.position.y+.87*n.rig.group.scale.y-.5)<.01),dance:dancer?.rig.bones['upperArm.L'].rotation.x!==before};});
 check('pooled bar patrons really sit on chairs and dancers animate',patrons.count>=4&&patrons.pose&&patrons.dance);await p.screenshot({path:'qa/v26/bar-activities.png'});
 await p.evaluate(()=>{const g=__game,v=g.cityLife.venues.find(v=>v.kind==='bar');g.openChoice(()=>g.cityLife.venueView(v));});
 await p.getByRole('button',{name:/Sit with a drink/}).click();
 check('player can take a real bar seat',await p.evaluate(()=>{__game.cityLife.update(.1);return !!__game.cityLife.activity&&__game.player.human.bones['thigh.L'].rotation.x< -1;}));
 const act=await p.evaluate(()=>{const g=__game;g.input.keys.add('KeyW');g.updatePlaying(.05);g.input.keys.clear();return !g.cityLife.activity;});check('movement stands the player up without trapping them in chair collision',act);
 await p.evaluate(()=>{const g=__game,v=g.cityLife.venues.find(v=>v.kind==='bar');g.openChoice(()=>g.cityLife.venueView(v));});await p.getByRole('button',{name:/Join the dancing/}).click();
 check('player dance runs visibly and completes with XP',await p.evaluate(()=>{const g=__game;g.cityLife.update(.5);const animated=Math.abs(g.player.human.bones.spine.rotation.y)>.01;g.cityLife.update(15);return animated&&!g.cityLife.activity;}));
 const turning=await p.evaluate(()=>{const g=__game,n=g.npcs.active.find(n=>n.state==='stand'&&!n.identity.activity);if(!n)return false;n.heading=n.identity.yaw;g.npcs.updateNPC(n,.1,n.x+1,n.z,{speed:0,riding:false},16,null,[]);const first=n.heading;g.npcs.updateNPC(n,.1,n.x-1,n.z,{speed:0,riding:false},16,null,[]);return Math.abs(first-n.heading)<.001;});check('passing left and right does not turn an idle NPC toward the player',turning);
 // Physical checkpoint approaches and actual UI choices.
 await p.evaluate(()=>{const g=__game,l=g.vehicles.dealerships[0],sp=g.vehicles.spots.find(s=>s.lot===l.id&&s.model==='toyota_corolla');const r=g.vehicles.sys.buy(sp.id);g.vehicles.addOwned(r.vehicle);window.car26=r.vehicle;g.police.open=()=>true;
  window.stop26=()=>{g.closeChoice();g.police.clearanceUntil=0;g.police.sys.stop=null;const post=g.police.posts[0],v=car26;v.x=post.cx;v.z=post.cz;v.heading=post.heading;g.vehicles.placeMesh(v);g.vehicles._doorReady=true;g.vehicles.startDriving(v);g.vehicles._doorReady=false;g.vehicles.car.speed=0;g.police.update(.05,v,g.vehicles.car);};stop26();});
 check('routine checkpoint flags a legal driver and offers ₦200 or Run',await p.getByRole('button',{name:/Give police ₦200/}).count()===1&&await p.getByRole('button',{name:/Run — start police chase/}).count()===1);
 const before=await p.evaluate(()=>__game.economy.balance);await p.screenshot({path:'qa/v26/police-stop.png'});await p.getByRole('button',{name:/Give police ₦200/}).click();
 check('payment charges exactly ₦200 once and grants passage',await p.evaluate(before=>{const g=__game;g.police.update(.1,car26,g.vehicles.car);return before-g.economy.balance===200&&!g.police.sys.stop&&g.vehicles.driving;},before));
 await p.evaluate(()=>stop26());await p.getByRole('button',{name:/Run — start police chase/}).click();
 check('Run leaves the parked car and launches the real police mini-game',await p.evaluate(()=>__game.state==='chase'&&!__game.vehicles.driving&&__game.story.s.pending.kind==='police'&&__game.story.run.distance===0));
 await p.locator('[data-run-action=left]').click();check('chase controls respond',await p.evaluate(()=>__game.story.run.lane===0));
 await p.evaluate(()=>{__game.story.drawRun(.1);});await p.screenshot({path:'qa/v26/police-chase.png'});
 await p.evaluate(()=>{const g=__game;g.story.run.distance=449.99;g.story.run.next=1000;g.story.run.rows=[];g.story.updateChase(.1);});check('successful checkpoint escape returns to the city and keeps the parked car',await p.evaluate(()=>__game.state==='playing'&&!__game.story.s.pending&&__game.vehicles.sys.get(car26.id)));
 await p.evaluate(()=>stop26());await p.getByRole('button',{name:/Run — start police chase/}).click();await p.locator('[data-run-action=surrender]').click();check('being caught at a checkpoint pursuit enters police custody',await p.evaluate(()=>__game.story.s.arrest?.agency==='police'&&__game.story.inside?.id==='police'));
 await p.evaluate(()=>{const g=__game;g.story.s.arrest.service=3;g.story.release(false);g.police.sys.state.wanted=0;g.clock.minutes=16*60;
  const post=g.police.posts[0],v={x:post.cx-Math.sin(post.heading)*8,z:post.cz-Math.cos(post.heading)*8,dx:Math.sin(post.heading),dz:Math.cos(post.heading),T:{len:4},speed:0};
  window.traffic26=[];for(let i=0;i<32;i++){g.traffic.time+=.1;traffic26.push(g.police.controlTraffic(v,10,.1));}window.npcStop26=traffic26.some(s=>s===0)&&traffic26.at(-1)===10;
  view26(post.cx,post.cz,1.2,30,post.heading+.4);});
 check('NPC traffic stops briefly, then is waved through rather than permanently jammed',await p.evaluate(()=>npcStop26));await p.screenshot({path:'qa/v26/checkpoint-layout.png'});
 // CityLife's day/cooldown guarantees encounters do not debit merely for proximity.
 const street=await p.evaluate(()=>{const g=__game,e=g.cityLife.encounters[0];g.clock.minutes=16*60;g.player.teleport(e.x,e.z);g.cityLife.encounterCooldown=0;g.cityLife.check=0;delete g.saveData.street.resolved[`${g.clock.day}:${e.id}`];const before=g.economy.balance;g.cityLife.update(1);return {choice:g.overlay==='choice',unchanged:g.economy.balance===before};});check('agbero proximity starts a choice, never an automatic charge',street.choice&&street.unchanged);await p.getByRole('button',{name:/Keep walking/}).click();
 check('agbero walk-away resolves safely and global cooldown prevents harassment spam',await p.evaluate(()=>__game.cityLife.encounterCooldown===90));
 // Test the real flyer form without mocking its upload/decoding path; transport isolated from account state.
 await p.evaluate(()=>{const g=__game,o=g.online;Object.defineProperty(o,'connected',{value:true});o.data??={};o.data.campaigns=[];o.data.testPayments=true;window.flyerRequest26=null;o.request=async(action,data)=>{flyerRequest26={action,data};return {ad:{amount:3000}};};o.panel.open('ads');});
 // v0.30.x added one optional business-link field; there is still no headline, message or write-up text.
 check('ad form has no headline, message or write-up fields (only the optional business link)',await p.locator('.oc-form textarea,.oc-form input[type=text]').count()===0&&await p.locator('.oc-form input[type=url]').count()<=1);
 const flyer=fs.readFileSync(new URL('../fixtures/flyer26.png',import.meta.url));
 await p.locator('.oc-form input[type=file]').setInputFiles({name:'business-flyer.png',mimeType:'image/png',buffer:flyer});await p.locator('.oc-form .oc-flyer-preview').waitFor({state:'visible'});
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:'qa/v26/flyer-mobile.png'});check('flyer uploader fits mobile',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await p.getByRole('button',{name:'Create flyer checkout',exact:true}).click();check('flyer checkout submits an image and no write-up fields',await p.evaluate(()=>!!flyerRequest26?.data.image&&!('body'in flyerRequest26.data)&&!('title'in flyerRequest26.data)));
 check('no browser or recovered frame errors',errors.length===0&&await p.evaluate(()=>!(window.__onitshaErrors||[]).length));
 fs.writeFileSync('qa/v26/fixes-audit.json',JSON.stringify({setup,patrons,checks,errors},null,2));console.log('PASS FIXES26',checks.length);
}catch(e){console.error(e);console.error(await p.evaluate(()=>({state:__game?.state,errors:window.__onitshaErrors})).catch(()=>null));await p.screenshot({path:'qa/v26/failed.png'}).catch(()=>{});process.exitCode=1;}finally{await b.close();}
