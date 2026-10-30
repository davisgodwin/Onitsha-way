import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createService} from '../server/service.mjs';
test('remembered local sessions survive restart, expire, and logout',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ow-entry-'));let clock=Date.now(),s=createService({dataDir:dir,now:()=>clock});let base;const start=async()=>{await s.listen(0);base=`http://127.0.0.1:${s.server.address().port}`;};
 const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 try{await start();let r=await post('/api/register',{username:'entry_qa',password:'entry-qa-password',name:'Davis',adult:true,remember:true});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/Max-Age=2592000/);const a=await r.json();assert.equal(a.me.name,'Davis');
 const headers={Cookie:cookie.split(';')[0]};assert.equal((await fetch(base+'/api/session',{headers})).status,200);assert.equal((await fetch(base+'/api/session')).status,401);
 assert.ok(!fs.readFileSync(path.join(dir,'world.json'),'utf8').includes(a.token),'no plaintext session token on disk');
 await s.close();s=createService({dataDir:dir,now:()=>clock});await start();r=await fetch(base+'/api/session',{headers});assert.equal(r.status,200);assert.equal((await r.json()).me.id,a.me.id);
 await post('/api/logout',{},headers);assert.equal((await fetch(base+'/api/session',{headers})).status,401);
 r=await post('/api/login',{username:'entry_qa',password:'entry-qa-password',remember:false});assert.doesNotMatch(r.headers.get('set-cookie'),/Max-Age/);const b=await r.json();clock+=13*3600000;assert.equal((await fetch(base+'/api/session',{headers:{Authorization:`Bearer ${b.token}`}})).status,401);
 r=await post('/api/login',{username:'entry_qa',password:'entry-qa-password',remember:true});const c=await r.json();clock+=31*86400000;assert.equal((await fetch(base+'/api/session',{headers:{Authorization:`Bearer ${c.token}`}})).status,401);
 }finally{await s.close();fs.rmSync(dir,{recursive:true,force:true});}
});
