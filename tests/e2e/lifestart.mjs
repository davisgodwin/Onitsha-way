import fs from 'node:fs';import{spawn}from'node:child_process';import{fileURLToPath}from'node:url';
let chromium;try{({chromium}=await import('playwright'));}catch{({chromium}=await import('playwright-core'));}
const output=fileURLToPath(new URL('../../.qa/',import.meta.url));fs.mkdirSync(output,{recursive:true});
const server=spawn(process.execPath,[fileURLToPath(new URL('../../node_modules/vite/bin/vite.js',import.meta.url)),'preview','--host','127.0.0.1','--port','4203','--strictPort'],{stdio:'ignore'});
for(let i=0;i<60;i++){try{if((await fetch('http://127.0.0.1:4203')).ok)break;}catch{}await new Promise(r=>setTimeout(r,250));}
const b=await chromium.launch({executablePath:process.env.CHROME_PATH??'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await b.newContext({viewport:{width:1280,height:900}});const p=await context.newPage();
await p.addInitScript(()=>{localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1}));if(!localStorage.getItem('onitshaway:creation-background')&&!localStorage.getItem('onitshaway:save'))localStorage.setItem('onitshaway:creation-background','nwa_ogbe');});
const errors=[],checks=[];p.on('pageerror',e=>errors.push(e.message));const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);console.log('PASS',name);};
const menu=async()=>{await p.waitForFunction(()=>window.__game?.state==='menu',null,{timeout:240000});};
const openNew=async()=>{await p.locator('#screen-menu [data-action=new]').click();if(await p.locator('#screen-confirm').isVisible())await p.locator('#screen-confirm [data-action=yes]').click();await p.waitForFunction(()=>__game.state==='creator');};
try{
await p.goto('http://127.0.0.1:4203');await menu();await openNew();
check('Nwa Ogbe is displayed with exactly one million game naira',await p.locator('[data-slot=creator-background]').textContent().then(t=>t==='Nwa Ogbe · Lapo baby')&&await p.locator('[data-slot=creator-funds]').textContent().then(t=>t.includes('₦1,000,000')));
check('background has no player selection or reroll controls',await p.locator('.creator-origin button,.creator-origin select,.creator-origin input').count()===0);
check('creation starts with optional street spawn and no rent deducted',await p.locator('[data-field=starting-home]').inputValue()===''&&await p.evaluate(()=>!localStorage.getItem('onitshaway:save')));
await p.locator('[data-field=gender]').getByRole('button',{name:'Female',exact:true}).click();await p.locator('[data-field=outfit]').getByRole('button',{name:'Two-piece suit & tie',exact:true}).click();
check('appearance changes cannot change the assigned background',await p.evaluate(()=>__game.creatorBackground==='nwa_ogbe')&&await p.locator('[data-slot=creator-background]').textContent().then(t=>t.startsWith('Nwa Ogbe')));
await p.locator('#screen-creator [data-action=back]').click();await openNew();check('Back and reopening creation keep the same assigned background',await p.evaluate(()=>__game.creatorBackground==='nwa_ogbe'));
await p.reload();await menu();await openNew();check('pending assignment survives a browser reload',await p.evaluate(()=>__game.creatorBackground==='nwa_ogbe'));
const home=await p.evaluate(()=>{const h=__game.homes.listings.find(h=>h.type==='duplex');return{id:h.id,rent:h.rent,days:h.days,label:h.label};});
await p.locator('[data-field=starting-home]').selectOption(home.id);await p.locator('[data-field=name]').fill('Obinna');
check('creation lists real rental homes across all five available types',await p.locator('[data-field=starting-home] optgroup').count()===5);
check('chosen home shows rent period remaining balance and home spawn',await p.locator('[data-slot=creator-home-detail]').textContent().then(t=>t.includes('7 days')&&t.includes('inside this home'))&&await p.locator('[data-slot=creator-remaining]').textContent().then(t=>t.includes('₦965,000'))&&await p.locator('#screen-creator [data-action=start]').textContent().then(t=>t==='Rent & start at home'));
await p.screenshot({timeout:120000,path:output+'lifestart-creator-desktop.png'});
await p.setViewportSize({width:390,height:844});await p.locator('.creator-body').evaluate(e=>e.scrollTop=0);await p.waitForTimeout(500);await p.screenshot({timeout:120000,path:output+'lifestart-creator-mobile.png'});
await p.locator('[data-field=starting-home]').scrollIntoViewIfNeeded();await p.screenshot({timeout:120000,path:output+'lifestart-home-mobile.png'});
check('background and starting-home controls fit a phone viewport',await p.evaluate(()=>{const panel=document.querySelector('.creator-panel').getBoundingClientRect(),select=document.querySelector('[data-field=starting-home]').getBoundingClientRect();return panel.left>=0&&panel.right<=innerWidth&&panel.bottom<=innerHeight&&select.left>=panel.left&&select.right<=panel.right&&document.documentElement.scrollWidth<=innerWidth;}));
await p.locator('#screen-creator [data-action=start]').click();await p.waitForFunction(id=>__game.state==='playing'&&__game.homes.inside?.home.id===id,home.id,{timeout:120000});await p.evaluate(()=>__game.startFromCreator());
check('paid creator rental spawns the player inside their own home',await p.evaluate(id=>__game.homes.inside.home.id===id&&!__game.homes.inside.viewing&&__game.homes.housing.access(id).use,home.id));
check('rental fee is charged once and only once from one million',await p.evaluate(()=>__game.economy.balance===965000&&__game.saveData.wallet.ledger.filter(e=>e.amount===-35000).length===1&&__game.saveData.wallet.ledger.filter(e=>e.amount===1000000).length===1));
check('first rental lasts exactly seven real-clock days after time rebasing',await p.evaluate(id=>{const r=__game.saveData.housing.rentals[id];return Math.abs((r.until-__game.nowAbs())-7*1440)<1&&r.periods===1;},home.id));
check('first save records background and indoor home position',await p.evaluate(id=>{const d=JSON.parse(localStorage.getItem('onitshaway:save'));return d.version===13&&d.lifeStart.background==='nwa_ogbe'&&d.lifeStart.homeId===id&&d.player.inside===id&&!localStorage.getItem('onitshaway:creation-background');},home.id));
await p.setViewportSize({width:1280,height:900});await p.waitForTimeout(500);await p.screenshot({timeout:120000,path:output+'lifestart-spawn-home.png'});
await p.reload();await menu();await p.locator('#screen-menu [data-action=continue]').click();await p.waitForFunction(()=>__game.state==='playing',{timeout:120000});
check('Continue restores background home and remaining balance without regrant',await p.evaluate(id=>__game.homes.inside?.home.id===id&&__game.saveData.lifeStart.background==='nwa_ogbe'&&__game.economy.balance===965000&&__game.saveData.wallet.ledger.length===2,home.id));
check('real WAT and no-API default remain enabled',await p.evaluate(()=>__game.clock.mode==='real'&&__game.settings.liveWeather===false));
await p.locator('.hud-phone').click();check('phone shows the saved background',await p.locator('.phone-background').textContent().then(t=>t.includes('Nwa Ogbe')));await p.locator('#phone-content .phone-heading button').click();
await p.evaluate(()=>{__game.showMenu();localStorage.setItem('onitshaway:creation-background','nwa_mummy');});await openNew();
check('Nwa Mummy is displayed with exactly five million game naira',await p.locator('[data-slot=creator-background]').textContent().then(t=>t==='Nwa Mummy · Nepo baby')&&await p.locator('[data-slot=creator-funds]').textContent().then(t=>t.includes('₦5,000,000')));
check('old life remains saved until the new character actually starts',await p.evaluate(()=>JSON.parse(localStorage.getItem('onitshaway:save')).lifeStart.background==='nwa_ogbe'));
await p.locator('[data-field=starting-home]').selectOption('');await p.locator('#screen-creator [data-action=start]').click();await p.waitForFunction(()=>__game.state==='playing');
check('Nwa Mummy street start keeps full five million and has no rental',await p.evaluate(()=>__game.economy.balance===5000000&&!__game.homes.inside&&Object.keys(__game.saveData.housing.rentals).length===0&&__game.saveData.lifeStart.background==='nwa_mummy'&&__game.saveData.lifeStart.homeId===null));
check('new life preserves a backup of the previous home and balance',await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('onitshaway:save:backup'));return d.lifeStart.background==='nwa_ogbe'&&d.wallet.balance===965000&&!!d.player.inside;}));
check('no browser runtime errors',errors.length===0);check('no recovered game-loop errors',await p.evaluate(()=>!(window.__onitshaErrors??[]).length));
fs.writeFileSync(output+'lifestart-browser-results.json',JSON.stringify({checks,errors},null,2));
}catch(e){console.error(e.stack);console.log('ERRORS',errors);process.exitCode=1;await p.screenshot({timeout:120000,path:output+'lifestart-failed.png'});}finally{await b.close();server.kill();}
