import fs from 'node:fs';import{spawn}from'node:child_process';let chromium;try{({chromium}=await import('playwright'));}catch{({chromium}=await import('playwright-core'));}
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4219','--strictPort'],{stdio:'ignore'});let browser,p;const checks=[],errors=[];const check=(n,ok)=>{if(!ok)throw Error(n);checks.push(n);console.log('PASS',n);};
try{
for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4219')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1})));
await p.goto('http://127.0.0.1:4219/?quickstart');await p.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:240000});await p.evaluate(()=>history.replaceState(null,'','/'));
await p.mouse.move(80,450);await p.mouse.down();await p.mouse.move(110,410);
check('mobile joystick receives movement through real pointer events',await p.evaluate(()=>__game.input.touch.active&&__game.input.getMove().mag>0));
await p.evaluate(()=>{const c=__game.touchControls;c.el.querySelector('.touch-move').releasePointerCapture(c.movePointer);});await p.mouse.move(115,405);await p.mouse.up();
check('lost pointer capture cannot leave joystick movement stuck',await p.evaluate(()=>!__game.input.touch.active&&__game.touchControls.movePointer===null));
await p.evaluate(()=>{const g=__game;g.economy.transact({key:'audit:test-capital',amount:5000000,reason:'Test fixture only'});const s=g.vehicles.sys.forSale().find(s=>s.model==='keke');const r=g.vehicles.sys.buy(s.id);if(!r.ok)throw Error(r.error);g.vehicles.syncSale();g.vehicles.addOwned(r.vehicle);g.__auditVehicle=r.vehicle;g.player.teleport(s.x+3,s.z);r.vehicle.damage=10;g.openChoice(()=>g.vehicles.carView(g.__auditVehicle));});
await p.getByRole('button',{name:/Mechanic: fix everything/}).click();check('mechanic UI completes the first repair',await p.evaluate(()=>__game.__auditVehicle.damage===0&&__game.__auditVehicle.repairSeq===1));
await p.evaluate(()=>{__game.__auditVehicle.damage=10;__game.renderChoice();});await p.getByRole('button',{name:/Mechanic: fix everything/}).click();check('mechanic UI completes another identical repair without moving',await p.evaluate(()=>__game.__auditVehicle.damage===0&&__game.__auditVehicle.repairSeq===2));
await p.evaluate(()=>{const g=__game;g.inventory.add({id:'jerrycan',name:'Fuel'});g.__auditVehicle.fuel=5;g.renderChoice();});
check('fuel-can UI disables pouring when only 3 L fits',await p.getByRole('button',{name:/Pour the jerrycan/}).isDisabled());
await p.evaluate(()=>{__game.__auditVehicle.fuel=3;__game.renderChoice();});await p.getByRole('button',{name:/Pour the jerrycan/}).click();
check('fuel-can UI transfers exactly 5 L and consumes one can',await p.evaluate(()=>__game.__auditVehicle.fuel===8&&!__game.inventory.has('jerrycan')));
const vehicleId=await p.evaluate(()=>{__game.closeChoice();__game.saveGameNow();return __game.__auditVehicle.id;});await p.reload();await p.waitForFunction(()=>window.__game?.state==='menu',null,{timeout:240000});await p.locator('#screen-menu [data-action=continue]').click();await p.waitForFunction(()=>__game.state==='playing',null,{timeout:120000});
check('Continue preserves repair sequence, fuel and owned vehicle',await p.evaluate(id=>{const v=__game.vehicles.sys.get(id);return v?.repairSeq===2&&v.fuel===8&&v.damage===0;},vehicleId));
await p.evaluate(()=>{const g=__game;g.clock.setMode('game');g.clock.rate=0;g.clock.minutes=22*60;g.club.enter(g.cityLife.venues.find(v=>v.kind==='club'));});
check('club entry immediately places the follow camera inside its walls',await p.evaluate(()=>{const g=__game,c=g.renderer.camera.position;return !!g.club.inside&&c.x>9500&&c.x<9522&&c.z>0&&c.z<18&&c.y>0&&c.y<5.5;}));
await p.screenshot({timeout:120000,path:'.qa/audit-club-entry.png'});await p.evaluate(()=>__game.club.exit());
check('club exit returns to the street and clears indoor mode',await p.evaluate(()=>!__game.club.inside&&!__game.cameraRig.indoor&&__game.player.position.x<9000));
check('no browser or recovered game-loop errors',errors.length===0&&await p.evaluate(()=>!(window.__onitshaErrors??[]).length));fs.writeFileSync('.qa/audit-services-results.json',JSON.stringify({checks,errors},null,2));console.log(`${checks.length} service audit checks passed`);
}catch(e){console.error(e);if(p)await p.screenshot({timeout:120000,path:'.qa/audit-services-failed.png'}).catch(()=>{});process.exitCode=1;}finally{await browser?.close();server.kill();}
