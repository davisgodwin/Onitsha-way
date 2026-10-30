import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {VERSION} from '../server/version.mjs';
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const p of children)p.kill();process.exitCode=code;setTimeout(()=>process.exit(code),300).unref();}
function start(file,args=[],env=process.env){const p=spawn(process.execPath,[file,...args],{stdio:'inherit',env});children.push(p);p.on('error',e=>{console.error(`Could not start ${file}: ${e.message}`);stop(1);});p.on('exit',(code,signal)=>{if(!stopping){console.error(`${file} stopped (${signal||code}). Both local services are being stopped.`);stop(code||1);}});return p;}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop(0));
console.log(`\nONITSHA WAY v${VERSION} · Checking the local account server…`);
// v0.44: an older copy left running keeps ports 8787/5173, and the browser keeps showing that old copy. Say so loudly.
{const banner=(lines)=>console.error('\n'+'='.repeat(78)+'\n'+lines.join('\n')+'\n'+'='.repeat(78)+'\n');
 let old=null;try{const r=await fetch('http://127.0.0.1:8787/api/health',{signal:AbortSignal.timeout(800)});old=await r.json();}catch{}
 let page=false;try{await fetch('http://127.0.0.1:5173/',{signal:AbortSignal.timeout(800)});page=true;}catch{}
 if(old||page){banner([`ANOTHER COPY OF ONITSHA WAY IS ALREADY RUNNING${old?.version?` (v${old.version})`:''}.`,`This is v${VERSION}. While the old one runs, your browser keeps showing the OLD game.`,'Close the old copy first: go to its terminal window and press Ctrl+C (or close that window),','then run  npm run dev  again here. Your saves and server/data are not touched.']);process.exit(1);}
 const fs=await import('node:fs');if(!fs.existsSync('server/data')){banner(['No server/data folder in this copy.','If you unzipped into a NEW folder, copy the server/data folder from your previous copy into this one','first (it holds your accounts and cloud saves). Starting anyway with an empty server in 10 seconds;','press Ctrl+C now to stop and copy it.']);await new Promise(r=>setTimeout(r,10000));}}
const startupId=randomUUID();
const backend=start('server/service.mjs',[],{...process.env,PORT:'8787',HOST:'127.0.0.1',ONITSHA_STARTUP_ID:startupId});
let ready=false;
for(let i=0;i<60&&!stopping;i++){
 try{const r=await fetch('http://127.0.0.1:8787/api/health',{signal:AbortSignal.timeout(600)});const h=await r.json();if(r.ok&&h.ok===true&&h.version===VERSION&&h.startupId===startupId&&backend.exitCode===null){ready=true;break;}}catch{}
 await new Promise(r=>setTimeout(r,150));
}
if(!ready||stopping){if(!stopping){console.error('The account server did not become ready on port 8787. Check the server error above. If port 8787 is occupied, stop that old server before retrying. Do not delete server/data or clear browser saves.');stop(1);}}
else{start('node_modules/vite/bin/vite.js');console.log('\nAccount server ready on 127.0.0.1:8787.\nOpen http://localhost:5173 when Vite prints its Local URL.\nUse two browser profiles/accounts. No real payments.\nKeep this terminal open; Ctrl+C stops both services.\n');}
