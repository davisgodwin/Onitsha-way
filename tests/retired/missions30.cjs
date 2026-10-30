const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'../..'),OUT=path.join(ROOT,'.qa/missions30');fs.mkdirSync(OUT,{recursive:true});
(async()=>{
 const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4300','--strictPort'],{cwd:ROOT,stdio:'ignore'});let browser;
 const checks=[],errors=[],check=(name,ok,detail)=>{assert.ok(ok,name+' '+JSON.stringify(detail??''));checks.push(name);console.log('PASS',name);};
 try{
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4300')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(fs.existsSync('/usr/local/bin/chromium')?'/usr/local/bin/chromium':undefined),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p=await browser.newPage({viewport:{width:1280,height:800}});p.on('pageerror',e=>{errors.push(e.message);console.log('PAGEERROR',e.message);});
  await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',adaptive:false,liveWeather:false,clockFixVersion:1})));
  await p.goto('http://127.0.0.1:4300/?quickstart');await p.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:300000});
  const setup=await p.evaluate(()=>{const g=__game;g.renderer.renderer.setAnimationLoop(null);g.clock.setMode('game');g.clock.rate=0;g.clock.minutes=12*60;
   window.qaResidentCount=g.npcs.residents.length;window.qaBalance=g.economy.balance;return {mission:g.jobs.mission('find-your-friend'),residents:g.npcs.residents.length};});console.log('SETUP',JSON.stringify(setup));
  check('mission uses existing source and gate neighbour',!!setup.mission&&setup.mission.status==='available',setup);
  await p.evaluate(()=>__game.openOverlay('jobs'));
  check('journal offers world navigation, not remote accept/complete',await p.getByRole('button',{name:'Find contact to accept'}).isVisible()&&await p.locator('[data-mission] button').count()===1);
  await p.screenshot({path:OUT+'/journal-desktop.png'});
  await p.getByRole('button',{name:'Find contact to accept'}).click();
  check('available mission follows source without accepting',await p.evaluate(()=>__game.missions.target().resident.id===__game.jobs.mission('find-your-friend').bindings.giver&&__game.jobs.mission('find-your-friend').status==='available'));
  // QA teleport shortens travel; spawning, prompts, collision checks, input and conversation are the real game systems.
  async function approach(which,page=p){
   return await page.evaluate(which=>{const g=__game;if(g.state==='overlay')g.closeOverlay();if(g.state==='dialogue')g.endDialogue();g.setState('playing');g.ui.only('hud');
    const m=g.jobs.mission('find-your-friend'),r=g.jobs.byId.get(m.bindings[which]);g.clock.setMode('game');g.clock.rate=0;g.clock.minutes=720;g.updateWaypoint();g.player.teleport(r.x+1.2,r.z);
    g.npcs.weekday=0;g.npcs.update(1,{player:g.player.position,hour:12,camera:g.renderer.camera,talkingTo:null});
    const n=g.npcs.active.find(n=>n.identity.id===r.id);if(!n)throw Error('Mission resident not embodied '+r.id);
    let spot=null;for(let i=0;i<32;i++){const a=i*Math.PI/16,x=n.x+Math.cos(a)*1.2,z=n.z+Math.sin(a)*1.2;if(!g.world.collision.isFree(x,z,.325))continue;g.player.teleport(x,z);const label=g.interactions.update(g.player.position.x,g.player.position.z);if(label?.includes('Find Your Friend')){spot={x,z,label};break;}}
    if(!spot)throw Error('No reachable mission interaction '+r.id);g.cameraRig.update(.1,g.player.position);g.renderer.render();g.ui.setPrompt(spot.label);g.touchControls?.setInteract(spot.label);return {id:r.id,name:r.name,spot};
   },which);
  }
  async function pressE(){await p.keyboard.press('e');await p.evaluate(()=>__game.updatePlaying(.016));check('E opens actual nearby NPC conversation',await p.evaluate(()=>__game.state==='dialogue'));}
  const source=await approach('giver');console.log('SOURCE',JSON.stringify(source));await pressE();
  await p.getByRole('button',{name:/I am looking for my friend/}).click();
  check('source explains real mission before acceptance',await p.getByRole('button',{name:/I will go and meet them/}).isVisible());
  await p.getByRole('button',{name:/I will go and meet them/}).click();
  check('accepting tracks friend but does not pay or complete',await p.evaluate(()=>{const g=__game,m=g.jobs.mission('find-your-friend');return m.status==='active'&&m.progress===0&&g.economy.balance===qaBalance&&g.missions.target().resident.id===m.bindings.target;}));
  await p.getByRole('button',{name:/Thank you. Make I go/}).click();
  await p.evaluate(()=>{const g=__game;g.continueGameNow();g.renderer.renderer.setAnimationLoop(null);g.clock.setMode('game');g.clock.rate=0;g.clock.minutes=720;});
  check('active mission reload retains binding and zero reward',await p.evaluate(()=>__game.jobs.mission('find-your-friend').status==='active'&&__game.economy.balance===qaBalance));
  const friend=await approach('target');console.log('FRIEND',JSON.stringify(friend));
  check('arriving at friend does not complete mission',await p.evaluate(()=>__game.jobs.mission('find-your-friend').progress===0&&__game.economy.balance===qaBalance));
  await pressE();check('unrelated NPC opener is not completion',await p.evaluate(()=>__game.economy.balance===qaBalance));
  await p.getByRole('button',{name:/My guy, I don find you/}).click();
  check('welcome conversation records first objective only',await p.evaluate(()=>__game.jobs.mission('find-your-friend').progress===1&&__game.economy.balance===qaBalance));
  await p.screenshot({path:OUT+'/friend-conversation.png'});
  await p.getByRole('button',{name:/Thank you, my friend. I am ready/}).click();
  check('finishing conversation pays precisely 500 and records permanent receipt',await p.evaluate(()=>{const g=__game,m=g.jobs.mission('find-your-friend');return m.status==='completed'&&m.rewardClaimed&&m.progress===2&&g.economy.balance===qaBalance+500;}));
  await p.getByRole('button',{name:/See you around/}).click();
  check('completion removes mission marker and does not duplicate residents',await p.evaluate(()=>__game.missions.target()===null&&__game.npcs.residents.length===qaResidentCount));
  await p.evaluate(()=>{const g=__game;g.continueGameNow();g.renderer.renderer.setAnimationLoop(null);g.clock.setMode('game');g.clock.rate=0;g.clock.minutes=720;g.openOverlay('jobs');});
  check('reload keeps completed journal and never pays twice',await p.evaluate(()=>__game.jobs.mission('find-your-friend').rewardClaimed&&__game.economy.balance===qaBalance+500));
  check('completed mission has no accept or follow buttons',await p.locator('[data-mission] button').count()===0);
  await p.setViewportSize({width:390,height:844});await p.screenshot({path:OUT+'/journal-mobile.png'});
  check('journal fits mobile without horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.querySelector('[data-mission]').getBoundingClientRect().right<=innerWidth));
  // A real touch-enabled context runs the normal mobile input setup against the same build.
  const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));
  await mp.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',adaptive:false,liveWeather:false,clockFixVersion:1})));
  await mp.goto('http://127.0.0.1:4300/?quickstart');await mp.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:300000});
  check('touch controls initialize with mission journal',await mp.evaluate(()=>{__game.renderer.renderer.setAnimationLoop(null);__game.openOverlay('jobs');return !!__game.touchControls&&!!__game.jobs.mission('find-your-friend');}));
  await mp.getByRole('button',{name:'Find contact to accept'}).tap();check('mobile tap tracks the existing mission contact',await mp.evaluate(()=>!!__game.missions.target()));await mp.screenshot({path:OUT+'/journal-touch.png'});
  await approach('giver',mp);await mp.locator('.tbtn-interact').tap();await mp.evaluate(()=>__game.updatePlaying(.016));
  check('mobile contextual touch opens the actual source NPC',await mp.evaluate(()=>__game.state==='dialogue'));
  await mp.getByRole('button',{name:/I am looking for my friend/}).tap();await mp.getByRole('button',{name:/I will go and meet them/}).tap();
  check('mobile dialogue accepts without paying',await mp.evaluate(()=>__game.jobs.mission('find-your-friend').status==='active'&&__game.jobs.mission('find-your-friend').progress===0));
  await mp.getByRole('button',{name:/Thank you. Make I go/}).tap();await approach('target',mp);await mp.locator('.tbtn-interact').tap();await mp.evaluate(()=>__game.updatePlaying(.016));
  await mp.getByRole('button',{name:/My guy, I don find you/}).tap();await mp.screenshot({path:OUT+'/friend-touch.png'});
  const mobileBalance=await mp.evaluate(()=>__game.economy.balance);await mp.getByRole('button',{name:/Thank you, my friend. I am ready/}).tap();
  check('mobile touch dialogue completes and pays once',await mp.evaluate(before=>__game.jobs.mission('find-your-friend').rewardClaimed&&__game.economy.balance===before+500,mobileBalance));
  await mp.getByRole('button',{name:/See you around/}).tap();await mobile.close();
  await p.setViewportSize({width:1280,height:800});await p.evaluate(()=>{__game.closeOverlay();__game.input.keys.clear();});
  const moved=await p.evaluate(()=>{const g=__game,pos=g.player.position.clone();g.input.keys.add('KeyW');for(let i=0;i<15;i++)g.updatePlaying(.033);g.input.keys.delete('KeyW');return g.player.position.distanceTo(pos);});check('existing keyboard movement remains functional',moved>.05,moved);
  check('existing camera can still turn',await p.evaluate(()=>{const g=__game;const before=g.cameraRig.yaw;g.cameraRig.applyLook(30,0);return g.cameraRig.yaw!==before;}));
  check('no browser or game-frame exceptions',errors.length===0&&await p.evaluate(()=>!(window.__onitshaErrors??[]).length),errors);
  fs.writeFileSync(OUT+'/results.json',JSON.stringify({checks,errors,source,friend},null,2));console.log('DONE',checks.length);
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.kill();}
})();
