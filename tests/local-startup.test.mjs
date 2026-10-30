import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {VERSION} from '../server/version.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const root=new URL('../',import.meta.url);
async function waitFor(fn,ms=20000){const until=Date.now()+ms;while(Date.now()<until){const v=await fn();if(v)return v;await sleep(100);}throw Error('Timed out waiting for local startup test');}
function launch(dir){const p=spawn(process.platform==='win32'?'npm.cmd':'npm',['run','dev'],{cwd:root,env:{...process.env,DATA_DIR:dir},stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let output='';p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>output+=d);return{p,get output(){return output;}};}
async function cleanup(run){if(run.p.exitCode===null){if(process.platform==='win32')spawn('taskkill',['/pid',String(run.p.pid),'/T','/F']);else try{process.kill(-run.p.pid,'SIGTERM');}catch{}}await sleep(500);}
async function health(){try{const r=await fetch('http://127.0.0.1:8787/api/health',{signal:AbortSignal.timeout(500)});return await r.json();}catch{return null;}}
// These integration tests deliberately use the real documented ports. Run separately
// from other browser suites or an already-running local game.
test('npm run dev starts both services with matching package version and serves entry', {timeout:30000},async()=>{
 assert.equal(await health(),null,'Stop your local test server before running startup tests.');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'onitsha-startup-'));const run=launch(dir);
 try{await waitFor(()=>run.output.includes('Account server ready on 127.0.0.1:8787.'));await waitFor(()=>run.output.includes('Local:'));
 const h=await health();assert.equal(h.version,VERSION);assert.equal(h.ok,true);assert.match(h.startupId,/^[a-f0-9-]{36}$/);assert.equal(run.p.exitCode,null);assert.ok(!run.output.includes('did not become ready'));
 const r=await fetch('http://localhost:5173/');assert.equal(r.status,200);assert.match(await r.text(),/Onitsha Way/i);
 const proxied=await(await fetch('http://localhost:5173/api/health')).json();assert.equal(proxied.version,VERSION);assert.equal(proxied.startupId,h.startupId);
 console.log(`PASS real npm run dev: server ${h.version}, Vite, entry HTML and API proxy`);
 }finally{await cleanup(run);fs.rmSync(dir,{recursive:true,force:true});}
 await waitFor(async()=>!await health());
});
test('occupied 8787 fails without accepting or stopping an unrelated server', {timeout:20000},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'onitsha-busy-'));
 const other=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,version:VERSION,startupId:'not-the-launched-server'}));});
 await new Promise((resolve,reject)=>{other.once('error',reject);other.listen(8787,'127.0.0.1',resolve);});const run=launch(dir);
 try{await waitFor(()=>run.p.exitCode!==null);assert.notEqual(run.p.exitCode,0);assert.ok(!run.output.includes('Account server ready'));assert.ok(!run.output.includes('Local:'));assert.match(run.output,/EADDRINUSE|address already in use|ALREADY RUNNING/i);assert.equal((await health()).startupId,'not-the-launched-server');console.log('PASS occupied port: no false readiness, no Vite, unrelated server untouched');}
 finally{await cleanup(run);await new Promise(r=>other.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
