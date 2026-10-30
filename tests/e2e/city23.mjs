import fs from 'node:fs';
import {spawn} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4223','--strictPort'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4223')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1})));
 await p.goto('http://127.0.0.1:4223/?quickstart');await p.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:240000});
 const checks=await p.evaluate(()=>{const g=__game,w=g.world;g.renderer.renderer.setAnimationLoop(null);const venues=[...g.story.offices,...g.story.city.sites,...g.story.city.services,...g.cityLife.venues];
  const frontage=venues.every(v=>{const f=v.frontage,dx=f.roadPoint.x-v.x,dz=f.roadPoint.z-v.z,L=Math.hypot(dx,dz);return Math.abs(L-f.roadWidth/2-3.6)<.001&&(dx*Math.sin(v.yaw)+dz*Math.cos(v.yaw))/L>.9999&&w.collision.isFree(v.x,v.z,.4);});
  const boatStart=w.riverfront.boats.map(b=>b.root.position.y);w.riverfront.update(2);const boatsAnimate=w.riverfront.boats.some((b,i)=>b.root.position.y!==boatStart[i]);
  const boatsInWater=w.riverfront.boats.every(b=>w.terrain.isWater(b.root.position.x,b.root.position.z));const landings=w.riverfront.places;
  const allHomeDoorsClear=g.homes.listings.every(h=>w.collision.isFree(h.door.stand.x,h.door.stand.z,.4));
  const homesPreserved=w.map.legacyListings.every(h=>g.homes.listings.some(n=>n.id===h.id&&n.type===h.type));
  g.saveData.character.ageGroup='adult';g.clock.minutes=21*60;const exits=[];
  for(const v of g.cityLife.venues.filter(v=>v.kind==='club')){const ok=g.club.enter(v);g.club.exit();exits.push(ok&&w.collision.isFree(g.player.position.x,g.player.position.z,.4)&&Math.hypot(g.player.position.x-v.x,g.player.position.z-v.z)<.01);}
  for(const o of g.story.offices){const ok=g.story.enterOffice(o);g.story.exitOffice();exits.push(ok&&w.collision.isFree(g.player.position.x,g.player.position.z,.4));}
  for(const h of g.story.city.services.filter(v=>v.kind==='hotel')){const ok=g.civic.enter(h);g.civic.exit();exits.push(ok&&w.collision.isFree(g.player.position.x,g.player.position.z,.4));}
  return{frontage,venueCount:venues.length,markets:w.markets.districts.length,marketShops:w.markets.stalls.length,landings:landings.length,landingsOnSafeLand:landings.every(v=>!w.terrain.isWater(v.x,v.z)&&w.collision.isFree(v.x,v.z,.4)),boats:w.riverfront.boats.length,boatsInWater,boatsAnimate,homesPreserved,allHomeDoorsClear,exits:exits.every(Boolean),recoveredErrors:window.__onitshaErrors??[]};});
 for(const k of['frontage','landingsOnSafeLand','boatsInWater','boatsAnimate','homesPreserved','allHomeDoorsClear','exits'])if(!checks[k])throw Error('Failed '+k);
 if(checks.venueCount!==23||checks.markets!==3||checks.landings!==2||checks.boats<8||checks.recoveredErrors.length)throw Error('Missing expected city content');
 await p.evaluate(()=>new Promise(resolve=>{__game.openMap();requestAnimationFrame(()=>requestAnimationFrame(resolve));}));const options=await p.locator('[data-slot=map-place] option').evaluateAll(a=>a.filter(o=>o.value && o.textContent.includes('River Niger')).map(o=>o.value));if(options.length!==2)throw Error('Missing waterfront map directory');
 await p.locator('[data-slot=map-place]').selectOption(options[0]);if(!await p.evaluate(()=>__game.waypoint?.name.includes('River Niger')))throw Error('Waterfront selection did not set waypoint');
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{const g=__game,p=g.worldFocus();g.minimap.openBig(p.x,p.z,g.player.heading,g.waypoint);const v=g.minimap.view;const W=g.minimap.big.clientWidth,H=g.minimap.big.clientHeight;if(Math.abs(g.waypoint.x-v.cx)*v.ppm>W/2-20||Math.abs(g.waypoint.z-v.cz)*v.ppm>H/2-20)throw Error('River destination outside mobile map frame');});if(!await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))throw Error('Mobile map overflow');
 if(errors.length)throw Error(errors.join('\n'));fs.mkdirSync('qa/v23',{recursive:true});fs.writeFileSync('qa/v23/gameplay-audit.json',JSON.stringify({checks,errors},null,2));console.log('PASS city23',JSON.stringify(checks));
}finally{await browser?.close();server.kill();}
