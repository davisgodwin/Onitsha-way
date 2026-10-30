import fs from 'node:fs';import{spawn}from'node:child_process';let chromium;try{({chromium}=await import('playwright'));}catch{({chromium}=await import('playwright-core'));}
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4218','--strictPort'],{stdio:'ignore'});let browser,p;const checks=[],errors=[];const check=(n,ok)=>{if(!ok)throw Error(n);checks.push(n);console.log('PASS',n);};
const reopenOffline=async(p)=>{p.once('dialog',d=>d.accept());await p.reload();await p.getByRole('button',{name:'Open previous offline save'}).click({timeout:240000});await p.waitForFunction(()=>window.__game?.state==='menu',null,{timeout:240000});}; // v0.27.3+: reload shows the signup splash; quickstart saves are the offline save
try{
for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4218')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});p=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1})));
await p.goto('http://127.0.0.1:4218/?quickstart');await p.waitForFunction(()=>window.__game?.state==='playing',null,{timeout:240000});await p.evaluate(()=>history.replaceState(null,'','/'));
check('pause icon has two visible high-contrast bars',await p.locator('.hud-pause .pause-bar').evaluateAll(a=>a.length===2&&a.every(e=>e.getBoundingClientRect().height>=14&&getComputedStyle(e).backgroundColor!=='rgba(0, 0, 0, 0)')));
check('touch controls are instantiated on a touch device',await p.evaluate(()=>!!__game.touchControls));
const state=async(s)=>p.waitForFunction(s=>window.__game?.state===s,s,{timeout:120000});
const settle=async()=>{await p.waitForTimeout(1400);check('menu dismissal remains in play without queued shortcut',await p.evaluate(()=>__game.state==='playing'));};
await p.keyboard.press('m');await state('map');await p.keyboard.press('m');await state('playing');await settle();
await p.keyboard.press('m');await state('map');await p.keyboard.press('Escape');await state('playing');await settle();
await p.locator('.hud-phone').click();await state('overlay');await p.keyboard.press('Escape');await state('playing');await settle();
await p.evaluate(()=>__game.openChoice(()=>({title:'Audit menu',text:'Input check',options:[]})));await p.keyboard.press('Escape');await state('playing');await settle();
await p.keyboard.press('p');await state('paused');await p.keyboard.press('p');await state('playing');await settle();
await p.evaluate(()=>{const g=__game;g.input.touch.active=true;g.input.touch.x=1;g.input.touch.run=true;g.touchControls.movePointer=42;g.openOverlay('phone');});
check('opening a menu clears movement and the run toggle',await p.evaluate(()=>{const g=__game;return !g.input.touch.active&&!g.input.touch.run&&g.input.touch.x===0&&g.touchControls.movePointer===null&&g.touchControls.joy.hidden;}));
const apps=['jobs','messages','games','bet','contacts','guide','ride','cars','hustle','skills','gist','furnish','places'];
for(const app of apps){const text=await p.evaluate(a=>{__game.phone.render(a);return document.querySelector('#phone-content').textContent;},app);check(`${app}: phone app renders without errors`,text.trim().length>25);if(['places','gist'].includes(app))check(`${app}: no fictional/game venue labels`,!/fiction|game venue|fictional game/i.test(text));}
await p.evaluate(()=>{__game.closeOverlay('phone');__game.openMap();});
check('map directory has no fictional/game venue labels',await p.locator('[data-slot=map-place]').textContent().then(t=>!/fiction|game venue/i.test(t)));
check('map retains workplaces, hotel, fuel and office destinations',await p.locator('[data-slot=map-place]').textContent().then(t=>/Metadav/.test(t)&&/Hotel|Lodge/i.test(t)&&/Fuel|Filling|Petrol/i.test(t)&&/EFCC/.test(t)));
await p.screenshot({timeout:120000,path:'.qa/audit-map-mobile.png'});await p.evaluate(()=>__game.closeMap());
await p.evaluate(()=>{const g=__game;g.input.keys.add('KeyW');g.input.presses.add('interact');g.input.touch.run=true;window.dispatchEvent(new Event('blur'));});
check('window blur clears held keys, queued use and run',await p.evaluate(()=>!__game.input.keys.size&&!__game.input.presses.size&&!__game.input.touch.run));
await p.evaluate(async()=>{const g=__game;g.saveGameNow();g.__auditSave=localStorage.getItem('onitshaway:save');g.__auditBackup=localStorage.getItem('onitshaway:save:backup');const d=JSON.parse(g.__auditSave);d.wallet.ledger={};await g.importSave(new File([JSON.stringify(d)],'bad-save.json',{type:'application/json'}));});
check('malformed import shows a useful error without overwriting save or backup',await p.evaluate(()=>localStorage.getItem('onitshaway:save')===__game.__auditSave&&localStorage.getItem('onitshaway:save:backup')===__game.__auditBackup)&&await p.locator('#screen-confirm').isVisible());
await p.locator('#screen-confirm [data-action=yes]').click();
await p.evaluate(()=>{const g=__game;g.saveGameNow();g.__auditBalance=g.economy.balance;g.__auditItems=JSON.stringify(g.saveData.inventory.items);});const before=await p.evaluate(()=>({balance:__game.__auditBalance,items:__game.__auditItems}));
await reopenOffline(p);await p.locator('#screen-menu [data-action=continue]').click();await state('playing');
check('Continue restores wallet and inventory after validation',await p.evaluate(b=>__game.economy.balance===b.balance&&JSON.stringify(__game.saveData.inventory.items)===b.items,before));
check('direction marker is still visible after Continue',await p.locator('.hud-navigation').isVisible());await p.screenshot({timeout:120000,path:'.qa/audit-hud-mobile.png'});
check('no browser or recovered game-loop errors',errors.length===0&&await p.evaluate(()=>!(window.__onitshaErrors??[]).length));
fs.writeFileSync('.qa/audit-results.json',JSON.stringify({checks,errors},null,2));console.log(`${checks.length} audit browser checks passed`);
}catch(e){console.error(e);if(p)await p.screenshot({timeout:120000,path:'.qa/audit-failed.png'}).catch(()=>{});process.exitCode=1;}finally{await browser?.close();server.kill();}
