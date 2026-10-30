import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {spawn} from 'node:child_process';import {WebSocket} from 'ws';const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ow-phone18-'));const server=spawn(process.execPath,['server/service.mjs'],{env:{...process.env,DATA_DIR:tmp,PORT:'8787'},stdio:'ignore'});const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4222','--strictPort'],{stdio:'ignore'});const sleep=ms=>new Promise(r=>setTimeout(r,ms));let browser,p,bob;const checks=[],errors=[];const check=(name,ok)=>{if(!ok)throw Error(name);checks.push(name);console.log('PASS',name);};
const post=async(route,body)=>(await(await fetch('http://127.0.0.1:8787'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json());
const connect=async a=>{const ws=new WebSocket('ws://127.0.0.1:8787/socket'),q=[],pending=new Map();ws.on('message',b=>{const m=JSON.parse(b);q.push(m);if(pending.has(m.requestId)){pending.get(m.requestId)(m);pending.delete(m.requestId);}});await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:a.token}));for(let i=0;i<100&&!q.some(m=>m.me);i++)await sleep(10);return{ws,q,act:(action,args={})=>new Promise((resolve,reject)=>{const requestId=crypto.randomUUID(),timer=setTimeout(()=>reject(Error('Peer timeout')),10000);pending.set(requestId,m=>{clearTimeout(timer);resolve(m);});ws.send(JSON.stringify({type:'action',action,...args,requestId}));})};};
try{fs.mkdirSync('.qa',{recursive:true});for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:4222/api/health')).ok)break;}catch{}await sleep(250);}
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const context=await browser.newContext({viewport:{width:1366,height:900}});p=await context.newPage();p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('onitshaway:settings',JSON.stringify({quality:'low',liveWeather:false,clockFixVersion:1})));await p.goto('http://127.0.0.1:4222/');await p.getByRole('button',{name:'Create an account →',exact:true}).click();await p.getByLabel('Display name',{exact:true}).fill('Ada');await p.getByLabel('Username',{exact:true}).fill('ada_phone');await p.getByLabel('Password',{exact:true}).fill('phone-test-password18');await p.getByLabel('I am 18 or older.',{exact:false}).check();await p.getByRole('button',{name:'Create account & continue →',exact:true}).click();await p.waitForFunction(()=>window.__game?.state==='creator',null,{timeout:300000});await p.evaluate(()=>__game.touch=true);await p.locator('#screen-creator [data-action=start]').click();await p.waitForFunction(()=>__game.state==='playing'&&__game.online.data);check('account-first signup and real Start button still enter city',true);

 await p.evaluate(()=>__game.renderer.renderer.setAnimationLoop(null));
 const fits=()=>p.evaluate(()=>{const shell=document.querySelector('.phone-shell'),body=document.querySelector('.phone-body');const r=shell.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight&&body.scrollWidth<=body.clientWidth+1&&document.documentElement.scrollWidth<=innerWidth;});
 const open=async tab=>{await p.evaluate(tab=>__game.online.open(tab),tab);await p.locator('.phone-community').waitFor();};
 await p.getByRole('navigation',{name:'Game navigation'}).getByRole('button',{name:'Phone',exact:true}).click();
 check('Local Play dialog is removed from DOM',await p.locator('dialog.online-panel').count()===0);
 check('business ads has its own phone icon',await p.locator('.phone-grid').getByRole('button',{name:'Business ads',exact:true}).isVisible());
 await p.screenshot({path:'.qa/phone192-home-desktop.png'});
 await p.locator('.phone-grid').getByRole('button',{name:'Business ads',exact:true}).click();
 check('Business ads opens inside the phone',await p.getByLabel('Business name / headline',{exact:true}).isVisible()&&await p.evaluate(()=>__game.overlay==='phone'&&__game.phone.app==='ads'));
 check('test-only payment warning remains explicit',await p.getByText('LOCAL TEST MODE',{exact:false}).isVisible());
 await p.screenshot({path:'.qa/phone192-ads-desktop.png'});fs.writeFileSync('.qa/phone192-ads-preview.html',await p.evaluate(()=>{const css=[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('\n');}catch{return '';}}).join('\n');return '<!doctype html><html><head><meta charset="utf-8"><style>'+css+'</style></head><body>'+document.querySelector('#screen-phone').outerHTML+'</body></html>';}));
 await p.getByLabel('Business name / headline',{exact:true}).fill('Ada Fashion');
 await p.getByLabel('Ad message',{exact:true}).fill('Made in Onitsha. New collections available.');
 await p.getByLabel('Seven-day slots',{exact:true}).fill('2');
 check('two slots quote fourteen days and six thousand naira',await p.locator('.oc-quote').textContent()==='2 slots · 14 days · ₦6,000 (TEST)');
 // A snapshot refresh must not discard an unfinished checkout.
 await p.evaluate(()=>__game.online.panel.refresh());
 check('live city refresh preserves unfinished ad form',await p.getByLabel('Business name / headline',{exact:true}).inputValue()==='Ada Fashion');
 await p.getByRole('button',{name:'Create test checkout',exact:true}).click();
 await p.getByRole('button',{name:'Simulate successful payment · no real charge',exact:true}).waitFor();
 check('real local server creates a test campaign from phone',true);
 await p.getByRole('button',{name:'Simulate successful payment · no real charge',exact:true}).click();
 await p.waitForFunction(()=>__game.online.data.campaigns.some(a=>a.title==='Ada Fashion'&&a.status==='active'));
 check('phone campaign test activation reaches server',true);
 await p.screenshot({path:'.qa/phone192-campaign-desktop.png'});
 await p.getByRole('button',{name:'Cancel test campaign',exact:true}).click();
 await p.waitForFunction(()=>__game.online.data.campaigns.some(a=>a.title==='Ada Fashion'&&a.status==='cancelled'));
 check('phone can cancel test campaign',true);
 await p.setViewportSize({width:390,height:844});
 for(const [tab,name] of [['people','players'],['voice','voice'],['team','coop'],['account','account'],['chat','nearby'],['ads','ads']]){
  await open(tab);check(`${name} app fits mobile without horizontal overflow`,await fits());await p.screenshot({path:`.qa/phone192-${name}-mobile.png`});
 }
 await p.getByRole('button',{name:'‹ Apps',exact:true}).click();
 check('Apps returns to phone home, not a second window',await p.locator('.phone-grid').isVisible()&&await p.locator('dialog.online-panel').count()===0);
 await p.screenshot({path:'.qa/phone192-home-mobile.png'});
 await p.getByRole('button',{name:'Close phone',exact:true}).click();
 check('closing phone returns to gameplay',await p.evaluate(()=>__game.state==='playing'));
 await p.setViewportSize({width:1366,height:900});await p.locator('.city-online').click();
 check('HUD online count opens Players within phone',await p.evaluate(()=>__game.overlay==='phone'&&__game.phone.app==='online'));
 await p.getByRole('button',{name:'Close phone',exact:true}).click();await p.locator('.city-avatar').click();
 check('profile avatar opens phone Account',await p.evaluate(()=>__game.phone.app==='account'));
 await p.getByRole('button',{name:'Close phone',exact:true}).click();
 await p.evaluate(()=>__game.online.open('ads','main-market'));
 check('billboard entry keeps selected area inside phone',await p.getByLabel('Billboard location',{exact:true}).inputValue()==='main-market');
 await p.getByRole('button',{name:'Close phone',exact:true}).click();await p.evaluate(()=>__game.phone.openMessages());
 check('messages remains in phone with no community window',await p.evaluate(()=>__game.phone.app==='messages'&&!__game.online.panel.visible));
 await open('ads');await p.evaluate(()=>__game.online.ws.close());
 await p.getByRole('button',{name:'Open Account',exact:true}).waitFor();
 check('disconnected ads provides phone Account recovery',true);
 await p.getByRole('button',{name:'Open Account',exact:true}).click();await p.getByRole('button',{name:'Reconnect to city',exact:true}).waitFor();await p.screenshot({path:'.qa/phone192-offline-desktop.png'});
 await p.getByRole('button',{name:'Reconnect to city',exact:true}).click();await p.waitForFunction(()=>__game.online.connected);
 check('reconnect works without leaving phone',await p.evaluate(()=>__game.phone.app==='account'));
 check('no browser or recovered game errors',errors.length===0&&await p.evaluate(()=>!window.__onitshaErrors?.length));
 fs.writeFileSync('qa/phone192-browser-results.json',JSON.stringify({checks,errors},null,2));console.log(`${checks.length} phone community browser checks passed`);
}catch(e){console.error(e);console.error(await p?.evaluate(()=>({state:window.__game?.state,mail:window.__game?.online?.data?.mail,view:window.__game?.phone?.messenger.view,status:document.querySelector('.msg-status')?.textContent,errors:window.__onitshaErrors})).catch(()=>null));await p?.screenshot({path:'.qa/phone192-failed.png',timeout:120000}).catch(()=>{});process.exitCode=1;}finally{bob?.ws.terminate();await browser?.close();server.kill();vite.kill();fs.rmSync(tmp,{recursive:true,force:true});}
