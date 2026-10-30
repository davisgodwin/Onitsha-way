import fs from 'node:fs';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const port=4261,base=`http://127.0.0.1:${port}`;
const dev=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'ignore'});
let b;const checks=[],errors=[];fs.mkdirSync('qa/v261',{recursive:true});
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 b=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1100,height:760}});p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(120000);
 await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1})));
 await p.goto(base+'/?quickstart');await p.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:240000});
 const report=await p.evaluate(async()=>{
  const g=__game;g.renderer.renderer.setAnimationLoop(null);history.replaceState(null,'','/');g.clock.setMode('game');g.clock.minutes=12*60;g.clock.day=1;g.clock.rate=0;g.cityLife.encounterCooldown=9999;g.npcs.weekday=0;
  const posts=[];let actualTrafficArgument=false;const original=g.npcs.update;g.npcs.update=function(dt,options){actualTrafficArgument ||= Array.isArray(options.vehicles)&&options.vehicles===g.traffic.near;return original.call(this,dt,options);};
  for(const post of g.police.posts){g.closeChoice();g.player.teleport(post.x+Math.sin(post.heading)*5,post.z+Math.cos(post.heading)*5);g.cameraRig.snapTo(g.player.position);g.npcs.tick=0;
   // Exercise the real game frame: do not inject a vehicles array into NPCSystem like the previous suite did.
   for(let frame=0;frame<45;frame++)g.frameInner(1/60);
   const cops=g.npcs.active.filter(n=>n.identity.id.startsWith(`police:${post.id}:`));assertFrame(cops.length>0,'No checkpoint officers were exercised at '+post.id);
   posts.push({id:post.id,officers:cops.length,frames:45});
  }
  function assertFrame(ok,message){if(!ok)throw Error(message);}
  // Also exercise the old caller contract: omitted and null traffic collections while real officer rigs are active.
  const position=g.player.position,options={player:{x:position.x,z:position.z,speed:0,riding:false},hour:12,camera:g.renderer.camera,talkingTo:null};
  g.npcs.update(.016,options);g.npcs.update(.016,{...options,vehicles:null});g.npcs.update=original;
  const cop=g.npcs.active.find(n=>n.identity.activity==='checkpoint');
  // Player-only car must still produce the stop gesture when ambient traffic is empty.
  g.npcs.car={x:cop.x+5,z:cop.z,speed:0};g.npcs.updateNPC(cop,.016,cop.x+5,cop.z,{speed:0,riding:true},12,null,[]);
  const playerSignal=cop.rig.bones['upperArm.R'].rotation.x===-1.25;g.npcs.car=null;
  g.saveGameNow();return {posts,actualTrafficArgument,playerSignal,recovered:window.__onitshaErrors||[]};
 });
 assert.equal(report.posts.length,6);assert.ok(report.actualTrafficArgument);assert.ok(report.playerSignal);assert.equal(report.recovered.length,0);assert.equal(errors.length,0);
 checks.push('270 real game frames at all six police posts with officer rigs active','Game.updateLife supplies real nearby traffic','omitted and null traffic are safe','officers still signal the player car');console.log('PASS',checks.join('; '));
 // Reopen the saved game normally; use the live animation loop for this final check.
 p.on('dialog',d=>d.accept());await p.goto(base+'/');await p.getByRole('button',{name:'Open previous offline save',exact:true}).click();await p.waitForFunction(()=>window.__game?.state==='menu',null,{timeout:240000});await p.locator('#screen-menu [data-action=continue]').click();await p.waitForFunction(()=>__game.state==='playing',null,{timeout:120000});
 // Continue intentionally restores Onitsha wall-clock time; officers are off duty after 18:00.
 // Restore this test's noon fixture before asserting daytime checkpoint residents.
 await p.evaluate(()=>{const g=__game;g.clock.setMode('game');g.clock.minutes=12*60;g.clock.rate=0;g.npcs.weekday=0;g.npcs.tick=0;g.cityLife.encounterCooldown=9999;});await p.waitForTimeout(1500);
 const saved=await p.evaluate(()=>({frames:__game.fps.frames,officers:__game.npcs.active.filter(n=>n.identity.activity==='checkpoint').length,recovered:window.__onitshaErrors||[]}));
 assert.ok(saved.officers>0);assert.equal(saved.recovered.length,0);assert.equal(errors.length,0);checks.push('Continue near a checkpoint runs without recovered frame errors');
 await p.screenshot({path:'qa/v261/checkpoint-continue.png',timeout:120000});fs.writeFileSync('qa/v261/checkpoint-audit.json',JSON.stringify({checks,report,saved,errors},null,2));console.log('PASS checkpoint261',checks.length);
}catch(e){console.error(e);if(b){for(const page of b.contexts()[0]?.pages()||[]){console.error('Failure state',await page.evaluate(()=>({url:location.href,state:window.__game?.state,loading:document.body.innerText.slice(0,900),errors:window.__onitshaErrors})).catch(()=>null));}}process.exitCode=1;}finally{await b?.close();dev.kill();}
