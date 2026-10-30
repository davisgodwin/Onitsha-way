import fs from 'node:fs';import {spawn} from 'node:child_process';let chromium;try{({chromium}=await import('playwright'));}catch{({chromium}=await import('playwright-core'));}
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4212','--strictPort'],{stdio:'ignore'});
let browser; const checks=[],errors=[];const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);console.log('PASS',name);};
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4212')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await browser.newPage({viewport:{width:1280,height:900}});p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1})));
 await p.goto('http://127.0.0.1:4212/?quickstart');await p.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:240000});
 check('direction marker visible without a selected destination',await p.locator('.hud-navigation').isVisible());
 check('idle marker shows compass heading',await p.locator('[data-slot=navigation-title]').textContent().then(t=>t.includes('Compass')));
 const arrow=await p.locator('.navigation-arrow').getAttribute('style');await p.evaluate(()=>__game.cameraRig.yaw+=Math.PI/2);await p.waitForFunction(old=>document.querySelector('.navigation-arrow').getAttribute('style')!==old,arrow,{timeout:30000});
 check('compass arrow responds to camera rotation',arrow!==await p.locator('.navigation-arrow').getAttribute('style'));
 await p.evaluate(()=>{const g=__game,p=g.player.position;g.setWaypoint({x:p.x+350,z:p.z+200,name:'Navigation QA destination',custom:true,radius:8});});await p.evaluate(()=>__game.tickHUD(0));await p.waitForTimeout(500);
 check('destination takes over direction marker',await p.locator('[data-slot=navigation-title]').textContent().then(t=>t==='Navigation QA destination'));
 check('marker displays distance and route guidance',await p.locator('[data-slot=navigation-detail]').textContent().then(t=>/\d.*m.*Follow arrow/.test(t)));
 check('destination beacon and minimap route remain active',await p.evaluate(()=>__game.beacon.grp.visible&&__game.minimap.route?.length>1&&!!__game.minimap.waypoint));
 for(const [label,width,height] of [['desktop',1280,900],['mobile',390,844],['small-mobile',320,640],['landscape',844,390]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(300);
  check(`${label}: direction marker fits and does not overlap clock/weather/minimap/phone`,await p.evaluate(()=>{
   const nav=document.querySelector('.hud-navigation').getBoundingClientRect(),wp=document.querySelector('.hud-waypoint').getBoundingClientRect();
   const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   return nav.width>0&&nav.left>=0&&nav.right<=innerWidth&&nav.top>=0&&nav.bottom<=innerHeight&&wp.top>=nav.bottom&&['.hud-clock','.hud-weather','.minimap-wrap','.hud-phone'].every(sel=>!overlap(nav,document.querySelector(sel).getBoundingClientRect()));
  }));
  if(label==='desktop'||label==='mobile')await p.screenshot({timeout:120000,path:`.qa/navigation-${label}.png`});
 }
 await p.setViewportSize({width:390,height:844});await p.locator('.hud-navigation').click();
 check('direction marker opens map on tap',await p.evaluate(()=>__game.state==='map'));
 await p.evaluate(()=>{__game.touch=true;__game.closeMap();});await p.waitForTimeout(500);const wp=await p.locator('.hud-waypoint').boundingBox();await p.mouse.click(wp.x+wp.width/2,wp.y+wp.height/2);await p.evaluate(()=>__game.tickHUD(0));await p.waitForTimeout(350);
 check('clearing destination restores compass without removing direction marker',await p.locator('.hud-navigation').isVisible()&&await p.locator('[data-slot=navigation-title]').textContent().then(t=>t.includes('Compass')));
 await p.evaluate(()=>{
  const g=__game;g.hudTimer=0;g.__qaTarget=g.jobs.target.bind(g.jobs);const p=g.player.position;
  g.jobs.target=()=>({x:p.x+250,z:p.z+80,name:'Tracked job QA',label:'Delivery',resident:{id:'qa',schedule:[0,24]},job:{id:'qa',deadline:Infinity}});g.routeKey=null;g.updateRoute();
 });await p.evaluate(()=>__game.tickHUD(0));await p.waitForTimeout(500);
 check('tracked job supplies direction when no map marker exists',await p.locator('[data-slot=navigation-title]').textContent().then(t=>t==='Tracked job QA'));
 check('tracked job arrow remains visible',await p.locator('.job-arrow').isVisible()&&await p.locator('.job-arrow').evaluate(e=>getComputedStyle(e).visibility==='visible'));
 await p.evaluate(()=>{const g=__game,p=g.player.position;g.setWaypoint({x:p.x-150,z:p.z-150,name:'Custom priority',radius:8,custom:true});});await p.evaluate(()=>__game.tickHUD(0));await p.waitForTimeout(500);
 check('custom marker takes priority over tracked job',await p.locator('[data-slot=navigation-title]').textContent().then(t=>t==='Custom priority'));
 await p.evaluate(()=>{__game.jobs.target=__game.__qaTarget;__game.setWaypoint(null);});await p.waitForTimeout(300);
 check('no browser or recovered frame errors',errors.length===0&&await p.evaluate(()=>!(window.__onitshaErrors??[]).length));
 fs.writeFileSync('.qa/navigation-results.json',JSON.stringify({checks,errors},null,2));console.log(`${checks.length} navigation checks passed`);
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.kill();}
