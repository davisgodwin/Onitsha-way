import {chooseBoard,validateBusinessLink,migrateBookings,bookingSummary,HOLD_MS} from './AdBookings.mjs';
import {validateFlyer} from './flyers.mjs';
import {loadPaystackKeys,createPaystack,paysFor} from './Paystack.mjs'; // v0.51 Paystack checkout (test mode)
import {VERSION} from './version.mjs';
import {createMailEngine} from './MailEngine.mjs';
import {JsonStore} from './store/jsonStore.mjs';
import {openStore} from './store/index.mjs';
import {publicSave,inspectSave,MAX_SAVE_BYTES} from './store/saves.mjs';
import {openAuthority,applySync,normaliseSave,serverMove,PVP,watDate} from '../src/authority/Policy.js';
import {VEHICLE_MODELS,vehicleBody} from '../src/data/housing.js';
import {EATERY_IDS} from '../src/data/eateries.js';
import {ensureElections,declare as electionDeclare,vote as electionVote,status as electionStatus} from './elections.mjs'; // v0.45 the players' elections // v0.45: players can meet for a date at an eatery // every model the game sells (36 since v0.25), not a hand-kept list
import {isLoopback,isLocalHostname,normalizeIp,parseNets} from './net.mjs';
import http from 'node:http';
import {createHash, randomBytes, randomUUID, scrypt as scryptCb, timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer, WebSocket} from 'ws';
const scrypt=promisify(scryptCb), DAY=86400000;
export const AD_PRICE=3000, SLOT_DAYS=7;
export const AREAS=['upper-iweka','shoprite','main-market','bridgehead'];
export const DATE_AREAS=[...AREAS,...EATERY_IDS];
/** v0.45: where a date member counts as being at the date: near the marker in the city, or inside that eatery. */
export const atDate=(p,d)=>!!p&&((p.scene==='city'&&Math.hypot(p.x-d.x,p.z-d.z)<30)||(String(d.area).startsWith('eatery-')&&p.scene===`public:${d.area}`));
const clean=(s,n=120)=>String(s??'').replace(/[\x00-\x1f]/g,' ').trim().slice(0,n);
const assert=(ok,m)=>{if(!ok)throw Error(m);};
const near=(a,b,d=30)=>a&&b&&a.scene===b.scene&&Math.hypot(a.x-b.x,a.z-b.z)<d;
export function createService({dataDir=process.env.DATA_DIR||fileURLToPath(new URL('./data',import.meta.url)),now=()=>Date.now(),testPayments=process.env.TEST_PAYMENTS!=='false',store=null,paystack=undefined,lan={secret:process.env.OW_GATEWAY_SECRET||'',joinCode:process.env.OW_JOIN_CODE||'',extraNets:process.env.OW_LAN_EXTRA_NETS||''}}={}){
 fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
 // v0.51: Paystack (test mode). `paystack` can be passed in (tests use a fake); otherwise the keys are read from the environment / server/paystack.local.json.
 let paystackProblem=null;if(paystack===undefined){const k=loadPaystackKeys();if(k.secretKey)paystack=createPaystack(k);else{paystack=null;paystackProblem=k.problem;}}
 const paystackInfo=()=>({enabled:!!paystack,publicKey:paystack?.publicKey||'',mode:'test',problem:paystack?null:paystackProblem});
 // Storage: world.json (default) or MySQL (npm run db:setup). Either way the world lives in memory and persist() queues the write.
 store??=new JsonStore(dataDir);
 const db=store.load();db.users??=[];db.requests??=[];db.ads??=[];db.reports??=[];db.authority??={};db.pvp??=[];db.elections=ensureElections(db.elections);
 const persist=()=>store.persist(db);
 // LAN play (npm run lan): players reach this server only through the LAN gateway, which vouches for their real address.
 const lanSecret=Buffer.from(String(lan?.secret||'')),lanNets=parseNets(lan?.extraNets),joinCode=String(lan?.joinCode||'').trim().toUpperCase();
 const viaGateway=req=>{const h=Buffer.from(String(req.headers['x-ow-gateway']||''));return lanSecret.length>0&&h.length===lanSecret.length&&timingSafeEqual(h,lanSecret)&&isLoopback(req.socket.remoteAddress);};
 /** A host's furniture, shared with visitors: finishes plus up to 160 placed pieces. Everything is re-checked here. */
const HEX=/^#[0-9a-f]{6}$/i;
const cleanDecor=d=>{if(!d||typeof d!=='object')return null;const pieces=Array.isArray(d.pieces)?d.pieces.slice(0,160).filter(a=>Array.isArray(a)&&/^[a-z0-9]{1,30}$/.test(a[0])&&[a[2],a[3],a[4]].every(Number.isFinite)&&Math.abs(a[2])<100&&Math.abs(a[3])<100&&/^[A-Za-z][\w-]{0,30}$/.test(a[5]??'')).map(a=>[a[0],HEX.test(a[1])?a[1]:'',Math.round(a[2]*100)/100,Math.round(a[3]*100)/100,Math.round(a[4])%360,a[5]]):[];return{paint:HEX.test(d.paint)?d.paint:'#e9dec8',floor:HEX.test(d.floor)?d.floor:null,pieces};};
 const clientIp=req=>normalizeIp(viaGateway(req)?req.headers['x-ow-client-ip']:req.socket.remoteAddress);
 const needsJoinCode=req=>!!joinCode&&!isLoopback(clientIp(req));
 migrateBookings(db.ads,now());persist();
 const sessions=new Map(Object.entries(db.sessions||{})), clients=new Map(), teams=new Map(), limits=new Map();
 const user=id=>db.users.find(u=>u.id===id);
 const publicUser=u=>({id:u.id,name:u.name,username:u.username});
 const blocked=(a,b)=>user(a)?.blocks.includes(b)||user(b)?.blocks.includes(a);
 const sessionKey=token=>createHash('sha256').update(String(token||'')).digest('hex');
 const persistSessions=()=>{db.sessions=Object.fromEntries([...sessions].filter(([,s])=>s.until>now()));persist();};
 const session=token=>{const s=sessions.get(sessionKey(token));return s&&s.until>now()?user(s.id):null;};
 const tokenFor=(u,remember=true)=>{const token=randomBytes(32).toString('hex');sessions.set(sessionKey(token),{id:u.id,until:now()+(remember?30*DAY:12*3600000)});persistSessions();return token;};
 const requestToken=req=>req.headers.authorization?.replace(/^Bearer /,'')||req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('ow_session='))?.slice(11)||'';
 const cookie=(res,token,remember)=>res.setHeader('Set-Cookie',`ow_session=${token}; HttpOnly; SameSite=Lax; Path=/${remember?'; Max-Age=2592000':''}${process.env.COOKIE_SECURE==='true'?'; Secure':''}`);
 const limit=(key,max,ms)=>{let q=limits.get(key);if(!q||q.until<now()){q={n:0,until:now()+ms};limits.set(key,q);}assert(++q.n<=max,'Too many requests. Please wait and try again.');};
 const send=(ws,msg)=>{if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<1024*1024)ws.send(JSON.stringify(msg));};
 const to=(id,msg)=>send(clients.get(id)?.ws,msg);
 const teamOf=id=>[...teams.values()].find(t=>t.members.includes(id));
 const publicAd=({owner,checkoutKey,image,paystack,...a})=>({...a,image:image?'/api/flyer/'+a.id:null,payStarted:!!paystack?.reference,paidAt:paystack?.paidAt??null});
 const activeAds=()=>db.ads.filter(a=>a.status==='active'&&!!a.image&&a.startsAt<=now()&&a.endsAt>now()).map(publicAd);
 const activateAd=(ad,via)=>{chooseBoard(db.ads,{boardId:ad.boardId,area:ad.area},now(),ad.id);ad.status='active';ad.startsAt=now();ad.endsAt=ad.startsAt+ad.slots*SLOT_DAYS*DAY;ad.test=true;ad.paidVia=via;persist();publish();};
 // a payment Paystack has confirmed: put the flyer up (if its board was taken meanwhile, another free board in the area)
 const settlePaystack=(ad,tx)=>{if(ad.status==='active')return{ad:publicAd(ad),paid:true};ad.paystack={...ad.paystack,paidAt:now(),amountKobo:Number(tx.amount),channel:tx.channel||null,txId:tx.id??null,testMode:tx.domain!=='live'};
  try{activateAd(ad,'paystack-test');}catch{try{const b=chooseBoard(db.ads,{area:ad.area},now(),ad.id);ad.boardId=b.id;activateAd(ad,'paystack-test');}catch{ad.status='paid_unplaced';persist();publish();return{ad:publicAd(ad),paid:true,message:'Paid, but every billboard in that area is taken now. The payment is recorded; refund it from the Paystack test dashboard.'};}}
  return{ad:publicAd(ad),paid:true,message:'Paystack TEST payment confirmed: your flyer is on the billboard. No real money was charged.'};};
 const snapshot=u=>({type:'state',me:publicUser(u),onlineCount:clients.size,mail:mail.snapshot(u),friends:u.friends.map(id=>user(id)).filter(Boolean).map(f=>({...publicUser(f),online:!!clients.get(f.id)?.p,canVisit:!!clients.get(f.id)?.p?.home&&clients.get(f.id).p.scene.startsWith(`home:${f.id}:`)})),partner:u.partner?publicUser(user(u.partner)):null,blocks:u.blocks,requests:db.requests.filter(r=>r.status==='pending'&&r.expiresAt>now()&&(r.to===u.id||r.from===u.id)).map(r=>({...r,fromName:user(r.from)?.name,toName:user(r.to)?.name})),team:teamOf(u.id)||null,credits:u.credits.filter(c=>!c.claimed),campaigns:db.ads.filter(a=>a.owner===u.id).map(a=>({...publicAd(a),status:a.status==='active'&&a.endsAt<=now()||a.status==='awaiting_test_payment'&&a.reservedUntil<=now()?'expired':a.status})),ads:activeAds(),bookings:bookingSummary(db.ads,now()),testPayments,paystack:paystackInfo(),serverTime:now()});
 const publish=()=>{for(const [id,c]of clients){const u=user(id);if(u)send(c.ws,snapshot(u));}};
 const mail=createMailEngine({db,user,publicUser,blocked,persist,publish,to,teamOf,limit,now});
 const guests=new Map();
 const expireGuests=()=>{for(const[id,g]of guests){if(g.until<=now()||!clients.has(g.host)||!clients.get(g.host)?.p?.scene.startsWith(`home:${g.host}:`)){guests.delete(id);to(id,{type:'visitEnd'});}}};
 const removePassenger=(id)=>{const c=clients.get(id);if(c?.p?.passenger){c.p.passenger=null;to(id,{type:'rideEnd'});} };
 const leaveTeam=id=>{const t=teamOf(id);if(!t)return;t.members=t.members.filter(x=>x!==id);if(!t.members.length)teams.delete(t.id);else if(t.leader===id)t.leader=t.members[0];};
 const action=(u,m)=>{
  const c=clients.get(u.id), p=c?.p; const target=user(m.target);
  if(m.action?.startsWith('mail'))return mail.action(u,m);
  if(m.action==='chat'){
   if(m.channel==='direct'){assert(target&&u.friends.includes(target.id)&&!blocked(u.id,target.id),'Direct messages need an unblocked friend.');return mail.sendDirect(u,{...m,key:m.key||randomUUID()});}
   if(m.channel==='team')return mail.action(u,{...m,action:'mailGroupSend'});
   limit(`chat:${u.id}`,6,5000);const text=clean(m.text,280);assert(text,'Write a message first.');assert(['nearby','team','direct'].includes(m.channel),'Choose a chat channel.');
   if(m.channel==='direct')assert(target&&u.friends.includes(target.id)&&!blocked(u.id,target.id),'Direct messages need an unblocked friend.');
   for(const[id,other]of clients){if(blocked(u.id,id))continue;const eligible=m.channel==='nearby'?near(p,other.p,60):m.channel==='team'?!!teamOf(u.id)?.members.includes(id):id===u.id||id===target.id;if(eligible)send(other.ws,{type:'chat',from:u.id,name:u.name,text,channel:m.channel,time:now()});}return{};
  }
  if(m.action==='request'){
   assert(target&&target.id!==u.id&&!blocked(u.id,target.id)&&clients.has(target.id),'Choose an online, unblocked player.');
   assert(['friend','relationship','date','home','visit','ride','team','decorate'].includes(m.kind),'Unknown invitation.');
   if(m.kind!=='friend')assert(u.friends.includes(target.id),'Become friends first.');
   if(m.kind==='friend')assert(!u.friends.includes(target.id),'You are already friends.');
   if(m.kind==='relationship')assert(!u.partner&&!target.partner,'Both players must be single.');
   if(m.kind==='home')assert(p?.scene.startsWith(`home:${u.id}:`)&&p.home,'Enter your rented home before inviting a friend.');
   // v0.48: hire a friend to decorate your home. The budget is spent from your money as you accept their picks; the fee you pay when they finish.
   if(m.kind==='decorate'){assert(p?.scene.startsWith(`home:${u.id}:`)&&p.home,'Go inside your home first.');assert(p.appearance?.ageGroup!=='child'&&clients.get(target.id)?.p?.appearance?.ageGroup!=='child','Decorating jobs are for adults.');m.budget=Math.floor(Number(m.budget));m.fee=Math.floor(Number(m.fee));assert(m.budget>=5000&&m.budget<=5000000,'Set a budget between ₦5,000 and ₦5,000,000.');assert(m.fee>=0&&m.fee<=PVP.pay.max,`Offer a fee up to ₦${PVP.pay.max.toLocaleString('en-NG')}.`);}
   if(m.kind==='visit')assert(clients.get(target.id)?.p?.home&&clients.get(target.id).p.scene.startsWith(`home:${target.id}:`),'Your friend must be in their own home before you request a visit.');
   if(m.kind==='ride')assert(p?.vehicle&&Math.abs(p.vehicle.speed)<1&&near(p,clients.get(target.id)?.p,15),'Stop your car beside your friend first.');
   if(m.kind==='team')assert(!teamOf(target.id),'That player is already in a team.');
   assert(!db.requests.some(r=>r.from===u.id&&r.to===target.id&&r.kind===m.kind&&r.status==='pending'&&r.expiresAt>now()),'An invitation is already pending.');
   limit(`invite:${u.id}`,12,60000);
   const details=m.kind==='date'?{area:DATE_AREAS.includes(m.area)?m.area:'shoprite'}:m.kind==='home'?{home:p.home,scene:p.scene}:m.kind==='decorate'?{home:p.home,scene:p.scene,budget:m.budget,fee:m.fee}:{};
   const r={id:randomUUID(),from:u.id,to:target.id,kind:m.kind,status:'pending',expiresAt:now()+5*60000,...details};db.requests.push(r);db.requests=db.requests.slice(-1000);persist();publish();return{message:'Invitation sent. They must accept.'};
  }
  if(m.action==='respond'){
   const r=db.requests.find(r=>r.id===m.id&&r.to===u.id&&r.status==='pending'&&r.expiresAt>now());assert(r,'Invitation expired or already answered.');
   if(!m.accept){r.status='declined';persist();publish();return{};}
   assert(!blocked(u.id,r.from),'This player is blocked.');const from=user(r.from), host=clients.get(r.from);
   if(r.kind==='friend'){if(!u.friends.includes(from.id))u.friends.push(from.id);if(!from.friends.includes(u.id))from.friends.push(u.id);}
   else{assert(u.friends.includes(from.id),'This player is no longer a friend.');
    if(r.kind==='relationship'){assert(!u.partner&&!from.partner,'Both players must still be single.');u.partner=from.id;from.partner=u.id;}
    if(r.kind==='home'){assert(host?.p?.home&&host.p.scene.startsWith(`home:${from.id}:`),'The host has left home.');guests.set(u.id,{host:from.id,home:host.p.home.id,until:now()+3600000});to(u.id,{type:'visit',host:from.id,home:host.p.home,scene:host.p.scene,decor:host.decor??null});}
    if(r.kind==='decorate'){assert(host?.p?.home&&host.p.scene.startsWith(`home:${from.id}:`),'Your client has left home.');assert(p?.appearance?.ageGroup!=='child','Decorating jobs are for adults.');const job={id:r.id,budget:r.budget,fee:r.fee,spent:0,picks:0,finished:false};guests.set(u.id,{host:from.id,home:host.p.home.id,until:now()+2*3600000,decorator:job});to(u.id,{type:'visit',host:from.id,home:host.p.home,scene:host.p.scene,decor:host.decor??null,decorate:{job:job.id,budget:job.budget,fee:job.fee,host:from.id,hostName:from.name}});to(from.id,{type:'decorStart',job:job.id,decorator:u.id,name:u.name,budget:job.budget,fee:job.fee});}
    if(r.kind==='visit'){assert(p?.home&&p.scene.startsWith(`home:${u.id}:`)&&host,'Enter your own home before accepting a visit request.');guests.set(from.id,{host:u.id,home:p.home.id,until:now()+3600000});to(from.id,{type:'visit',host:u.id,home:p.home,scene:p.scene,decor:clients.get(u.id)?.decor??null});}
    if(r.kind==='ride'){assert(p&&!p.passenger&&!p.vehicle&&host?.p?.vehicle&&Math.abs(host.p.vehicle.speed)<1&&near(p,host.p,15),'The car must be stopped beside you; leave your own vehicle first.');const riding=[...clients.values()].filter(c=>c.p?.passenger===from.id);assert(riding.length<host.p.vehicle.capacity,'That car is full.');p.passenger=from.id;to(u.id,{type:'rideStart',driver:from.id});}
    if(r.kind==='date'){
     const loc=locations[r.area];assert(loc,'Unknown meeting place.');const date={id:randomUUID(),kind:'date',area:r.area,x:loc.x,z:loc.z,ready:[],startsAt:null,completed:false};to(u.id,{type:'date',date,partner:from.id});to(from.id,{type:'date',date,partner:u.id});dates.set(date.id,{...date,members:[u.id,from.id]});
    }
    if(r.kind==='team'){assert(!teamOf(u.id),'Leave your existing team first.');let t=teamOf(from.id);if(!t){t={id:randomUUID(),leader:from.id,members:[from.id],task:null};teams.set(t.id,t);}assert(t.leader===from.id&&!t.task&&t.members.length<4,'Only the leader can invite, before a task; team capacity is four.');t.members.push(u.id);}
   }
   r.status='accepted';persist();publish();return{message:'Accepted.'};
  }
  if(m.action==='cancelRequest'){const r=db.requests.find(r=>r.id===m.id&&r.from===u.id&&r.status==='pending');assert(r,'No pending invitation.');r.status='cancelled';persist();publish();return{};}
  if(m.action==='unfriend'||m.action==='block'||m.action==='breakup'){
   assert(target,'Player not found.');if(m.action==='block'&&!u.blocks.includes(target.id))u.blocks.push(target.id);
   if(m.action!=='breakup'){u.friends=u.friends.filter(id=>id!==target.id);target.friends=target.friends.filter(id=>id!==u.id);}
   if(u.partner===target.id){u.partner=null;target.partner=null;}
   if(m.action==='block'){db.requests.filter(r=>(r.to===u.id&&r.from===target.id)||(r.from===u.id&&r.to===target.id)).forEach(r=>r.status='cancelled');guests.delete(u.id);guests.delete(target.id);if(teamOf(u.id)?.members.includes(target.id))leaveTeam(u.id);removePassenger(u.id);if(clients.get(target.id)?.p?.passenger===u.id)removePassenger(target.id);}
   persist();publish();return{};
  }
  if(m.action==='unblock'){u.blocks=u.blocks.filter(id=>id!==m.target);persist();publish();return{};}
  if(m.action==='report'){assert(target&&target.id!==u.id,'Choose a player.');const reason=clean(m.reason,500);assert(reason.length>=5,'Describe the issue (at least five characters).');limit(`report:${u.id}`,5,3600000);db.reports.push({id:randomUUID(),from:u.id,target:target.id,reason,at:now()});db.reports=db.reports.slice(-1000);persist();return{message:'Report saved for the local server operator. There is no live moderation team.'};}
  // v0.44 players together: payments between players, and crime between players with its safeguards (src/authority/Policy.js PVP)
  if(m.action==='electionStatus'){return{elections:electionStatus(db.elections,u.id,now())};}
  if(m.action==='electionDeclare'){const pp=clients.get(u.id)?.p;assert(pp,'Go into the city first.');electionDeclare(db.elections,{user:u.id,name:u.name,office:m.office,party:m.party,adult:pp.appearance?.ageGroup!=='child',now:now()});ensureElections(db.elections);persist();return{elections:electionStatus(db.elections,u.id,now()),message:'You are on the ballot. Voting is on Saturday.'};}
  if(m.action==='electionVote'){const pp=clients.get(u.id)?.p;assert(pp,'Go into the city first.');limit(`vote:${u.id}`,20,60000);electionVote(db.elections,{user:u.id,office:m.office,candidate:String(m.candidate??''),adult:pp.appearance?.ageGroup!=='child',now:now()});persist();return{elections:electionStatus(db.elections,u.id,now()),message:'Your vote is in.'};}
  if(m.action==='pvpStatus'){const s=u.pvp??{};return{peace:!!s.peace,nextCrime:Math.max(0,(s.nextCrime??0)-now()),shield:Math.max(0,(s.shieldUntil??0)-now()),peaceLock:Math.max(0,(s.lastCrime??0)+PVP.peaceLock-now()),incidents:db.pvp.filter(i=>i.from===u.id||i.to===u.id).slice(-8).map(i=>({id:i.id,at:i.at,kind:i.kind,ok:i.ok,amount:i.amount,mine:i.from===u.id,other:user(i.from===u.id?i.to:i.from)?.name??'someone',reported:i.reported}))};}
  if(m.action==='pvpPeace'){u.pvp??={};const on=!!m.on;if(on)assert(!((u.pvp.lastCrime??0)+PVP.peaceLock>now()),'You targeted someone recently: peace mode can be switched on 30 minutes after.');u.pvp.peace=on;persist();return{peace:on};}
  if(m.action==='pvpCrime'){
   const K=PVP.kinds[m.kind];assert(K,'Unknown action.');assert(target&&target.id!==u.id,'Choose a player.');assert(!blocked(u.id,target.id),'You can\'t do that.');
   const tp=clients.get(target.id)?.p;assert(p&&tp,`${target.name} isn't here.`);assert(p.scene==='city'&&tp.scene==='city','Only out on the streets.');
   assert(Math.hypot(p.x-tp.x,p.z-tp.z)<=PVP.reach,'Get closer.');assert(p.appearance?.ageGroup!=='child'&&tp.appearance?.ageGroup!=='child','Never with children.');
   assert(!p.safe&&!tp.safe,'This is a safe area: near the police, a hospital, a bank, the court, or indoors.');
   u.pvp??={};target.pvp??={};assert(!u.pvp.peace,'You are in peace mode: switch it off on your phone first (Law & street).');assert(!target.pvp.peace,`${target.name} is in peace mode and can't be targeted.`);
   assert(!(u.pvp.nextCrime>now()),'Wait a few minutes before trying anything again.');assert(!(target.pvp.shieldUntil>now()),`${target.name} was targeted a short while ago. Leave them be.`);
   const today=watDate(now());if(u.pvp.day!==today){u.pvp.day=today;u.pvp.count=0;}assert(u.pvp.count<PVP.perDay,'Enough of that for one day.');
   const A=db.authority[u.id],B=db.authority[target.id];assert(A&&B,'Both of you need to be signed in with the account server keeping your books.');
   const id=randomUUID().replace(/-/g,'').slice(0,12),ok=Math.random()<K.chance;let amount=ok?Math.min(K.max,Math.floor((B.ledgers.wallet?.balance??0)*K.share/50)*50):0;
   if(amount>0&&!serverMove(B,A,`pvp:${id}`,amount,now(),{out:`${m.kind==='rob'?'Robbed':'Pickpocketed'} by ${u.name}`,into:`Stolen cash (from ${target.name})`}))amount=0;
   u.pvp.nextCrime=now()+PVP.attackerCooldown;u.pvp.lastCrime=now();u.pvp.count++;target.pvp.shieldUntil=now()+PVP.victimShield;
   const inc={id,at:now(),kind:m.kind,from:u.id,to:target.id,ok,amount,reported:false};db.pvp.push(inc);if(db.pvp.length>500)db.pvp.splice(0,db.pvp.length-500);persist();
   to(target.id,{type:'pvp',role:'victim',id,kind:m.kind,ok,amount,name:u.name,from:u.id});
   return{id,ok,amount,name:target.name,offence:K.offence,severity:K.severity};
  }
  if(m.action==='pvpReport'){const inc=db.pvp.find(i=>i.id===m.id&&i.to===u.id);assert(inc,'Nothing to report.');assert(!inc.reported,'Already reported.');inc.reported=true;const msg={type:'pvpReported',id:inc.id,by:u.name};if(clients.get(inc.from))to(inc.from,msg);else{const f=user(inc.from);if(f){f.pvpInbox=[...(f.pvpInbox??[]),msg].slice(-20);}}persist();return{};}
  if(m.action==='pay'){
   assert(target&&target.id!==u.id,'Choose a player.');assert(!blocked(u.id,target.id),'You can\'t pay this player.');const amount=Math.floor(Number(m.amount));assert(amount>=50&&amount<=PVP.pay.max,`Pay between ₦50 and ₦${PVP.pay.max.toLocaleString('en-NG')}.`);
   const tp=clients.get(target.id)?.p,near=p&&tp&&p.scene===tp.scene&&Math.hypot(p.x-tp.x,p.z-tp.z)<=PVP.pay.reach;assert(near||u.friends.includes(target.id),'Pay a friend, or someone standing with you.');
   u.pvp??={};const today=watDate(now());if(u.pvp.payDay!==today){u.pvp.payDay=today;u.pvp.paid=0;}assert(u.pvp.paid+amount<=PVP.pay.perDay,'That is more than you can send in a day.');
   const A=db.authority[u.id],B=db.authority[target.id];assert(A&&B,'Both of you need to be signed in with the account server keeping your books.');
   const id=randomUUID().replace(/-/g,'').slice(0,12);assert(serverMove(A,B,`p2p:${id}`,amount,now(),{out:`Paid ${target.name}`,into:`From ${u.name}`}),'Your account server says you don\'t have that much.');u.pvp.paid+=amount;persist();
   const msg={type:'paid',id,amount,name:u.name,from:u.id};if(clients.get(target.id))to(target.id,msg);else target.pvpInbox=[...(target.pvpInbox??[]),msg].slice(-20);
   return{id,amount,name:target.name};
  }
  // v0.48 decorating jobs: the decorator suggests pieces, the owner's game buys and places them (from the owner's money), then the owner pays the fee
  if(m.action==='decorPropose'){const gs=guests.get(u.id);assert(gs?.decorator&&!gs.decorator.finished&&gs.until>now(),'You have no decorating job here.');limit(`decor:${u.id}`,20,60000);const items=(Array.isArray(m.items)?m.items:[]).slice(0,6).map(i=>({id:clean(i?.id,40),qty:Math.max(1,Math.min(4,Math.floor(Number(i?.qty)||1)))})).filter(i=>/^[a-z0-9-]+$/.test(i.id));assert(items.length,'Choose at least one piece.');const est=Math.floor(Number(m.estimate)||0);assert(est>0&&gs.decorator.spent+est<=gs.decorator.budget,'That goes over the budget.');to(gs.host,{type:'decorProposal',job:gs.decorator.id,from:u.id,name:u.name,items,estimate:est,note:clean(m.note,160)});return{message:'Sent. Your client decides.'};}
  if(m.action==='decorAnswer'){const gs=guests.get(m.to);assert(gs?.host===u.id&&gs.decorator,'No decorator is working for you.');const spent=Math.max(0,Math.floor(Number(m.spent)||0));if(m.accepted){gs.decorator.spent+=spent;gs.decorator.picks++;}to(m.to,{type:'decorAnswer',job:gs.decorator.id,accepted:!!m.accepted,spent,left:gs.decorator.budget-gs.decorator.spent,note:clean(m.note,160)});return{};}
  if(m.action==='decorFinish'){const gs=guests.get(u.id);assert(gs?.decorator&&!gs.decorator.finished,'You have no decorating job here.');gs.decorator.finished=true;to(gs.host,{type:'decorFinished',job:gs.decorator.id,from:u.id,name:u.name,fee:gs.decorator.fee,spent:gs.decorator.spent,picks:gs.decorator.picks});return{message:'Your client has been told the job is done.'};}
  if(m.action==='leaveRide'){removePassenger(u.id);return{};}
  if(m.action==='eject'){assert(clients.get(m.target)?.p?.passenger===u.id,'That player is not your passenger.');removePassenger(m.target);return{};}
  if(m.action==='endVisit'){guests.delete(u.id);return{};}
  if(m.action==='revokeVisit'){assert(guests.get(m.target)?.host===u.id,'No active visitor.');guests.delete(m.target);to(m.target,{type:'visitEnd'});return{};}
  if(m.action==='teamLeave'){leaveTeam(u.id);publish();return{};}
  if(m.action==='teamTask'){
   const t=teamOf(u.id);assert(t?.leader===u.id&&t.members.length>=2&&!t.task,'A leader and at least two team members are required.');assert(['delivery','risky'].includes(m.kind),'Choose a task.');const area=AREAS.includes(m.area)?m.area:'main-market',loc=locations[area];assert(loc,'Meeting locations are not ready.');t.task={id:randomUUID(),kind:m.kind,area,x:loc.x,z:loc.z,ready:[],started:now(),done:false};publish();return{};
  }
  if(m.action==='teamReady'){
   const t=teamOf(u.id);assert(t?.task&&!t.task.done,'No active team task.');assert(p?.scene==='city'&&Math.hypot(p.x-t.task.x,p.z-t.task.z)<30,'Travel to the team task marker first.');if(!t.task.ready.includes(u.id))t.task.ready.push(u.id);
   if(t.members.length>=2&&t.members.every(id=>t.task.ready.includes(id)&&clients.get(id)?.p?.scene==='city'&&Math.hypot(clients.get(id).p.x-t.task.x,clients.get(id).p.z-t.task.z)<30)&&now()-t.task.started>=30000){const task=t.task;for(const id of t.members){const member=user(id);member.credits.push({id:`team:${task.id}`,amount:task.kind==='risky'?1500:1000,risky:task.kind==='risky',claimed:false});}t.task=null;persist();}publish();return{};
  }
  if(m.action==='teamCancel'){const t=teamOf(u.id);assert(t?.leader===u.id,'Only the leader can cancel.');t.task=null;publish();return{};}
  if(m.action==='dateReady'){
   const d=dates.get(m.id);assert(d?.members.includes(u.id)&&!d.completed,'No active date.');assert(atDate(p,d),'Travel to the date marker first.');if(!d.ready.includes(u.id))d.ready.push(u.id);if(d.ready.length===2&&!d.startsAt)d.startsAt=now();return{};
  }
  if(m.action==='dateCancel'){const d=dates.get(m.id);assert(d?.members.includes(u.id),'No active date.');dates.delete(d.id);d.members.forEach(id=>to(id,{type:'dateEnd',message:'The date was cancelled.'}));return{};}
  if(m.action==='claimCredit'){const credit=u.credits.find(c=>c.id===m.id);assert(credit,'Reward not found.');return{credit};}
  if(m.action==='ackCredit'){const credit=u.credits.find(c=>c.id===m.id);assert(credit,'Reward not found.');credit.claimed=true;persist();publish();return{};}
  if(m.action==='adCreate'){
   limit(`ad:${u.id}`,10,60000);assert(Number.isInteger(m.slots)&&m.slots>=1&&m.slots<=52,'Choose 1–52 slots.');assert(AREAS.includes(m.area),'Choose a billboard area.');const title='Business flyer',body='',link=validateBusinessLink(m.link);
   const image=validateFlyer(m.image);
   const key=clean(m.key,80);assert(key.length>=12,'Missing checkout request ID.');const duplicate=db.ads.find(a=>a.owner===u.id&&a.checkoutKey===key);if(duplicate)return{ad:duplicate};
   const board=chooseBoard(db.ads,{boardId:m.boardId,area:m.area},now());
   const ad={id:randomUUID(),boardId:board.id,reservedUntil:now()+HOLD_MS,owner:u.id,checkoutKey:key,title,body,link,image,area:m.area,slots:m.slots,amount:m.slots*AD_PRICE,status:'awaiting_test_payment',createdAt:now(),startsAt:null,endsAt:null,test:true};db.ads.push(ad);persist();publish();return{ad};
  }
  if(m.action==='adConfirmTest'){
   assert(testPayments,'Test activation is disabled. No live payment provider is connected.');const ad=db.ads.find(a=>a.id===m.id&&a.owner===u.id);assert(ad,'Campaign not found.');if(ad.status==='active')return{ad};assert(ad.status==='awaiting_test_payment','This campaign cannot be activated.');assert(ad.reservedUntil>now(),'This checkout reservation expired. Create a new order.');activateAd(ad,'simulated');return{ad,message:'TEST campaign activated. No real money was charged.'};
  }
  // v0.51: Paystack checkout (test mode). The browser only gets an access code; the server asks Paystack itself whether it was paid.
  if(m.action==='adPayStart')return (async()=>{
   assert(paystack,paystackProblem||'Paystack is not set up on this server.');limit(`pay:${u.id}`,12,60000);
   const ad=db.ads.find(a=>a.id===m.id&&a.owner===u.id);assert(ad,'Campaign not found.');if(ad.status==='active')return{ad:publicAd(ad),paid:true};
   assert(ad.status==='awaiting_test_payment','This campaign cannot be paid for.');assert(ad.reservedUntil>now(),'This checkout reservation expired. Create a new order.');
   const email=clean(m.email,120).toLowerCase();assert(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email),'Enter a valid email for the Paystack receipt.');
   let callbackUrl;try{const r=new URL(String(m.returnUrl||''));if(['http:','https:'].includes(r.protocol)){r.hash='';r.searchParams.set('ow_ad',ad.id);callbackUrl=r.href;}}catch{}
   // a fresh reference for each attempt (Paystack refuses to reuse one)
   const reference=`ow-ad-${ad.id.slice(0,8)}-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
   const data=await paystack.initialize({email,amountKobo:ad.amount*100,reference,callbackUrl,metadata:{adId:ad.id,board:ad.boardId,slots:ad.slots,game:'Onitsha Way'}});
   ad.paystack={reference:data.reference||reference,accessCode:data.access_code,email,startedAt:now(),tries:(ad.paystack?.tries||0)+1};ad.reservedUntil=Math.max(ad.reservedUntil,now()+30*60*1000);persist();publish();
   return{ad:publicAd(ad),accessCode:data.access_code,authorizationUrl:data.authorization_url,reference:ad.paystack.reference,publicKey:paystack.publicKey};
  })();
  if(m.action==='adPayCheck')return (async()=>{
   assert(paystack,paystackProblem||'Paystack is not set up on this server.');limit(`paycheck:${u.id}`,30,60000);
   const ad=db.ads.find(a=>a.id===m.id&&a.owner===u.id);assert(ad,'Campaign not found.');if(ad.status==='active')return{ad:publicAd(ad),paid:true,message:'Paid: your flyer is on the billboard.'};
   assert(ad.paystack?.reference,'Start the Paystack checkout first.');
   const tx=await paystack.verify(ad.paystack.reference);
   if(paysFor(tx,ad))return settlePaystack(ad,tx);
   return{ad:publicAd(ad),paid:false,status:tx?.status||'unknown',message:['abandoned','ongoing','pending'].includes(tx?.status)?'Not paid yet. Finish the Paystack checkout, then check again.':`Paystack says: ${tx?.gateway_response||tx?.status||'not paid'}.`};
  })();
  if(m.action==='adCancel'){const ad=db.ads.find(a=>a.id===m.id&&a.owner===u.id);assert(ad,'Campaign not found.');ad.status='cancelled';persist();publish();return{};}
  throw Error('Unknown action.');
 };
 const dates=new Map(),locations={};
 const readBody=async(req,max=350000)=>{const parts=[];let size=0;for await(const b of req){size+=b.length;if(size>=max){const e=Error('Request too large.');e.status=413;e.closeConnection=true;throw e;}parts.push(b);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');};
 const originOK=req=>{if(!req.headers.origin)return true;try{const o=new URL(req.headers.origin);return ['localhost','127.0.0.1','[::1]'].includes(o.hostname)||(process.env.ALLOWED_ORIGINS||'').split(',').includes(o.origin)||(viaGateway(req)&&isLocalHostname(o.hostname,lanNets));}catch{return false;}};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status,value)=>{res.writeHead(status);res.end(JSON.stringify(value));};
  try{
   assert(originOK(req),'Origin not permitted.');const route=new URL(req.url,'http://localhost').pathname;
   if(route.startsWith('/api/flyer/')&&req.method==='GET'){const id=route.slice('/api/flyer/'.length),ad=db.ads.find(a=>a.id===id);assert(ad&&ad.image&&(ad.status==='active'&&ad.endsAt>now()||session(requestToken(req))?.id===ad.owner),'Flyer unavailable.');const [header,payload]=ad.image.split(',');res.setHeader('Content-Type',header.slice(5).split(';')[0]);res.setHeader('Cache-Control','private, max-age=60');res.writeHead(200);res.end(Buffer.from(payload,'base64'));return;}
   if(route==='/api/paystack/webhook'&&req.method==='POST'){ // v0.51: Paystack tells the server about a payment (only reaches you on a public URL)
    limit(`hook:${clientIp(req)}`,120,60000);const parts=[];let size=0;for await(const b of req){size+=b.length;assert(size<200000,'Request too large.');parts.push(b);}const raw=Buffer.concat(parts);
    if(!paystack||!paystack.signatureOK(raw,req.headers['x-paystack-signature']))return reply(401,{error:'Bad signature.'});
    let ev;try{ev=JSON.parse(raw.toString('utf8'));}catch{return reply(400,{error:'Bad JSON.'});}
    if(ev.event==='charge.success'&&ev.data?.reference){const ad=db.ads.find(a=>a.paystack?.reference===ev.data.reference);if(ad&&ad.status!=='active'){try{const tx=await paystack.verify(ev.data.reference);if(paysFor(tx,ad))settlePaystack(ad,tx);}catch(e){console.warn('[paystack] webhook check failed:',e.message);}}}
    return reply(200,{ok:true});
   }
   if(route==='/api/health'&&req.method==='GET')return reply(200,{ok:true,version:VERSION,startupId:process.env.ONITSHA_STARTUP_ID||null,mode:'local-prototype',testPayments,paystack:{enabled:!!paystack,mode:'test'},online:clients.size,database:store.status(),lan:lanSecret.length>0});
   if((route==='/api/register'||route==='/api/login')&&req.method==='POST'){
    limit(`auth:${clientIp(req)}`,30,60000);const b=await readBody(req),username=clean(b.username,32).toLowerCase();assert(/^[a-z0-9_]{3,24}$/.test(username),'Username: 3–24 letters, numbers or underscores.');assert(typeof b.password==='string'&&b.password.length>=10&&b.password.length<=128,'Password must be 10–128 characters.');let u=user('')||db.users.find(u=>u.username===username);
    if(route==='/api/register'){assert(!needsJoinCode(req)||String(b.joinCode||'').trim().toUpperCase()===joinCode,'Wrong or missing join code. Ask the player hosting the game for the code shown in their terminal.');assert(b.adult===true,'Local online play is 18+ only. Child characters remain offline.');assert(!u,'Username unavailable.');const salt=randomBytes(16).toString('hex'),hash=(await scrypt(b.password,salt,64)).toString('hex');assert(!db.users.some(u=>u.username===username),'Username unavailable.');u={id:randomUUID(),username,name:clean(b.name,32)||username,salt,hash,friends:[],blocks:[],partner:null,credits:[],createdAt:now()};db.users.push(u);persist();try{await store.flush();}catch(e){db.users=db.users.filter(x=>x!==u);persist();const err=Error('Your account could not be saved to the database. '+e.message);err.status=503;throw err;}}
    else{const computed=await scrypt(b.password,u?.salt||'invalid-user-salt',64);assert(u&&timingSafeEqual(computed,Buffer.from(u.hash,'hex')),'Username or password is incorrect.');}
    const token=tokenFor(u,b.remember!==false);cookie(res,token,b.remember!==false);return reply(200,{ok:true,token,me:publicUser(u)});
   }
   if(route==='/api/session'&&req.method==='GET'){const token=requestToken(req),u=session(token);return u?reply(200,{ok:true,token,me:publicUser(u)}):reply(401,{error:'Please log in to play.',joinCodeRequired:needsJoinCode(req)});}
   if(route==='/api/logout'&&req.method==='POST'){const token=requestToken(req),u=session(token);sessions.delete(sessionKey(token));persistSessions();res.setHeader('Set-Cookie','ow_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');if(u)clients.get(u.id)?.ws.close(1000,'Signed out');return reply(200,{ok:true});}
   if(route==='/api/save'&&(req.method==='GET'||req.method==='PUT')){
    // Cloud save: one game save per account, with revisions so two devices can't silently overwrite each other.
    const u=session(requestToken(req));if(!u)return reply(401,{error:'Please log in to sync your save.'});
    const dbDown=e=>{const err=Error(e.message);err.status=503;return err;};
    if(req.method==='GET'){limit(`save-get:${u.id}`,60,60000);let s;try{s=await store.getSave(u.id);}catch(e){throw dbDown(e);}return reply(200,{ok:true,save:publicSave(s,!new URL(req.url,'http://localhost').searchParams.has('meta'))});}
    limit(`save-put:${u.id}`,40,60000);const b=await readBody(req,MAX_SAVE_BYTES+65536);const info=inspectSave(b.raw);
    // v0.43 server authority: a save for a life the server keeps the books for is corrected to them before it's stored
    let corrected=[];const auth=db.authority[u.id];if(auth&&auth.lifeId===String(info.lifeId)){const fixed=normaliseSave(auth,JSON.parse(b.raw));if(fixed.corrected.length){corrected=fixed.corrected;b.raw=JSON.stringify(fixed.data);inspectSave(b.raw);}}
    let r;try{r=await store.putSave(u.id,{raw:b.raw,baseRev:b.baseRev,force:b.force===true},now());}catch(e){throw dbDown(e);}
    if('conflict' in r)return reply(409,{ok:false,conflict:true,error:'This account was saved from another device since this one last synced.',save:publicSave(r.conflict)});
    return reply(200,{ok:true,save:publicSave(r.next,false),backedUp:r.backup,...(corrected.length?{corrected}:{})});
   }
   if(route==='/api/authority/sync'&&req.method==='POST'){
    // v0.43: the browser reports what happened; the server decides what counts (src/authority/Policy.js)
    const u=session(requestToken(req));if(!u)return reply(401,{error:'Please log in.'});limit(`auth-sync:${u.id}`,120,60000);
    const b=await readBody(req,600000),lifeId=clean(b.lifeId,80);assert(lifeId,'Missing life id.');
    let a=db.authority[u.id],opened=false;
    if(!a||a.lifeId!==lifeId){assert(b.snapshot&&typeof b.snapshot==='object','Send the opening snapshot first.');a=db.authority[u.id]=openAuthority(lifeId,b.snapshot,now(),'browser');opened=true;}
    const out=applySync(a,b,now());a.updated=now();persist();
    return reply(200,{ok:true,opened,...out});
   }
   if(route==='/api/authority'&&req.method==='GET'){const u=session(requestToken(req));if(!u)return reply(401,{error:'Please log in.'});const a=db.authority[u.id];return reply(200,{ok:true,authority:a?{lifeId:a.lifeId,opened:a.opened,balances:Object.fromEntries(Object.entries(a.ledgers).map(([k,L])=>[k,L.balance])),stats:a.stats,rejected:a.rejected.slice(-10),vehicles:Object.keys(a.property.vehicles).length,homes:Object.keys(a.property.homes).length,record:Object.keys(a.record).length}:null});}
   return reply(404,{error:'Not found'});
  }catch(e){if(e.closeConnection)res.setHeader('Connection','close');reply(e.status===413?400:e.status||400,{error:e.message});}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:1500000});
 server.on('upgrade',(req,socket,head)=>{if(req.url!=='/socket'||!originOK(req)){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));});
 wss.on('connection',(ws,req)=>{
  let u=null,alive=true;const authTimer=setTimeout(()=>{if(!u)ws.close(1008,'Sign in first');},5000);
  ws.on('pong',()=>alive=true);
  ws.on('message',async raw=>{try{limit(`ws:${clientIp(req)}`,1600,10000);const m=JSON.parse(raw);if(!u){assert(m.type==='auth'&&session(m.token),'Session expired. Sign in again.');u=session(m.token);clearTimeout(authTimer);assert(clients.size<32||clients.has(u.id),'Local server is full (32 players).');clients.get(u.id)?.ws.close(1000,'Account connected elsewhere');clients.set(u.id,{ws,p:null,token:m.token});send(ws,{type:'welcome',...snapshot(u)});for(const msg of u.pvpInbox??[])send(ws,msg);if(u.pvpInbox?.length){u.pvpInbox=[];persist();}publish();return;}
   assert(session(clients.get(u.id)?.token)&&clients.get(u.id)?.ws===ws,'Session expired.');
   if(m.type==='away'){clients.get(u.id).p=null;removePassenger(u.id);return;}
   if(m.type==='decor'){const decor=cleanDecor(m.decor);clients.get(u.id).decor=decor;for(const[gid,gs]of guests)if(gs.host===u.id)to(gid,{type:'hostDecor',decor});return;}
   if(m.type==='presence'){
    const old=clients.get(u.id).p;const a=m.p;assert(a&&[a.x,a.y,a.z,a.heading].every(Number.isFinite)&&Math.abs(a.x)<50000&&Math.abs(a.z)<50000&&Math.abs(a.y)<1000,'Invalid position.');assert(a.appearance?.ageGroup!=='child','Child characters cannot join local online play.');let scene=clean(a.scene,120)||'city';
    if(scene.startsWith('home:')&&!scene.startsWith(`home:${u.id}:`)){const guest=guests.get(u.id);assert(guest&&guest.until>now()&&scene.startsWith(`home:${guest.host}:${guest.home}:`),'No active home invitation.');}
    assert(scene==='city'||/^(home|public|club|story):/.test(scene),'Unknown scene.');
    const app=a.appearance||{};const appearance={gender:app.gender==='female'?'female':'male',ageGroup:['young','adult','elder'].includes(app.ageGroup)?app.ageGroup:'adult',bodyType:['slim','average','full'].includes(app.bodyType)?app.bodyType:'average',outfit:clean(app.outfit,40),hair:clean(app.hair,30),skin:Number.isInteger(app.skin)?Math.max(0,Math.min(5,app.skin)):1,palette:Math.max(0,Math.min(20,Number(app.palette)||0)),color:Number.isInteger(app.color)?Math.max(0,Math.min(63,app.color)):0,bottomColor:Number.isInteger(app.bottomColor)?Math.max(0,Math.min(63,app.bottomColor)):null,shoeColor:Number.isInteger(app.shoeColor)?Math.max(0,Math.min(63,app.shoeColor)):null};
    const color=k=>/^#[0-9a-f]{6}$/i.test(app[k])?app[k]:undefined;for(const k of ['topColor','bottomColor','shoeColor'])if(color(k))appearance[k]=color(k);
    const vehicle=a.vehicle&&Object.hasOwn(VEHICLE_MODELS,a.vehicle.model)?{id:clean(a.vehicle.id,80),model:a.vehicle.model,x:a.x,z:a.z,y:a.y,heading:a.heading,paint:/^#[0-9a-f]{6}$/i.test(a.vehicle.paint)?a.vehicle.paint:'#31556b',speed:Math.max(-50,Math.min(70,Number(a.vehicle.speed)||0)),capacity:{keke:2,motorcycle:1}[vehicleBody(a.vehicle.model)]??3}:null;
    const home=a.home&&scene.startsWith(`home:${u.id}:`)?{id:clean(a.home.id,80),label:clean(a.home.label,80),floor:a.home.floor==='up'?'up':'down'}:null;
    clients.get(u.id).p={x:a.x,y:a.y,z:a.z,heading:a.heading,scene,appearance,speed:Math.min(8,Math.max(0,Number(a.speed)||0)),vehicle,home,passenger:old?.passenger||null,voice:['off','nearby','team'].includes(a.voice)?a.voice:'off',talking:!!a.talking,safe:!!a.safe,pose:['sit','ground','lie'].includes(a.pose)?a.pose:null};
    if(a.locations)for(const area of DATE_AREAS){const l=a.locations[area];if(!locations[area]&&l&&Number.isFinite(l.x)&&Number.isFinite(l.z))locations[area]={x:l.x,z:l.z};}
    return;
   }
   if(m.type==='signal'){const other=clients.get(m.target);assert(other&&!blocked(u.id,m.target)&&other.p?.voice!=='off'&&clients.get(u.id).p?.voice!=='off','Voice peer unavailable.');const a=clients.get(u.id).p,b=other.p;assert((a.voice==='nearby'&&b.voice==='nearby'&&near(a,b,60))||(a.voice==='team'&&b.voice==='team'&&teamOf(u.id)?.members.includes(m.target)),'Voice channel out of range.');limit(`signal:${u.id}`,200,10000);assert(JSON.stringify(m.data).length<20000,'Signal too large.');to(m.target,{type:'signal',from:u.id,data:m.data});return;}
   assert(m.type==='action','Unknown packet.');limit(`action:${u.id}`,50,10000);const result=await action(u,m);send(ws,{type:'result',requestId:m.requestId,ok:true,...result});
  }catch(e){let m;try{m=JSON.parse(raw);}catch{}if(process.env.OW_DEBUG)console.error('[ws error]',m?.type,m?.action,e?.stack||e);send(ws,{type:'result',requestId:m?.requestId,ok:false,error:e.message});if(!u)ws.close(1008,'Authentication failed');}});
  ws.on('close',()=>{clearTimeout(authTimer);if(u&&clients.get(u.id)?.ws===ws){clients.delete(u.id);guests.delete(u.id);leaveTeam(u.id);for(const[id,c]of clients)if(c.p?.passenger===u.id)removePassenger(id);for(const[id,g]of guests)if(g.host===u.id){guests.delete(id);to(id,{type:'visitEnd'});}for(const[id,d]of dates)if(d.members.includes(u.id)){dates.delete(id);d.members.forEach(id=>to(id,{type:'dateEnd',message:'Date ended: a player disconnected.'}));}publish();}});
  ws._ping=()=>{if(!alive)return ws.terminate();alive=false;ws.ping();};
 });
 const tick=setInterval(()=>{
  expireGuests();for(const[id,c]of clients){if(!session(c.token)){c.ws.close(1008,'Session expired');continue;}if(c.p?.scene.startsWith('home:')&&!c.p.scene.startsWith(`home:${id}:`)&&!guests.has(id))to(id,{type:'visitEnd'});
   if(c.p?.passenger){const driver=clients.get(c.p.passenger)?.p;if(driver?.vehicle&&driver.scene==='city'&&c.p.scene==='city'&&!blocked(id,c.p.passenger)){c.p.x=driver.x;c.p.y=driver.y;c.p.z=driver.z;c.p.heading=driver.heading;}else removePassenger(id);}
   const players=[...clients].filter(([pid,other])=>pid!==id&&other.p&&!blocked(id,pid)&&other.p.scene===c.p?.scene).map(([pid,other])=>({...other.p,...publicUser(user(pid))}));send(c.ws,{type:'world',onlineCount:clients.size,players,visitHost:guests.get(id)?.host||null,serverTime:now()});}
  for(const[id,d]of dates){if(d.startsAt&&d.members.every(id=>atDate(clients.get(id)?.p,d))&&now()-d.startsAt>=30000){dates.delete(id);d.members.forEach(id=>to(id,{type:'dateEnd',message:String(d.area).startsWith('eatery-')?'Date complete! You shared a meal together.':'Date complete! You spent time together in Onitsha.',completed:true}));}else if(d.startsAt&&d.members.some(id=>!atDate(clients.get(id)?.p,d))){d.startsAt=null;d.ready=[];d.members.forEach(id=>to(id,{type:'notice',message:'Date timer reset: stay together at the meeting place and both check in again.'}));}}
 },100);
 const pulse=setInterval(()=>{for(const c of clients.values())c.ws._ping?.();publish();for(const[k,v]of limits)if(v.until<now())limits.delete(k);for(const[k,v]of sessions)if(v.until<now())sessions.delete(k);},10000);
 return {server,db,clients,teams,get paystack(){return paystackInfo();},listen:(port=8787,host='127.0.0.1')=>new Promise(resolve=>server.listen(port,host,resolve)),close:async()=>{clearInterval(tick);clearInterval(pulse);for(const c of wss.clients)c.terminate();await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));await store.close();},dataDir,store};
}
/** Open the configured storage (world.json, or MySQL after npm run db:setup), then start the service. */
export async function startService(options={}){
 const dataDir=options.dataDir||process.env.DATA_DIR||fileURLToPath(new URL('./data',import.meta.url));
 fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
 const store=await openStore(dataDir);
 return createService({...options,dataDir,store});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let svc;try{svc=await startService();}catch(e){console.error(`\nThe account server could not open its database.\n${e.message}\n`);process.exit(1);}
 await svc.listen(Number(process.env.PORT)||8787,process.env.HOST||'127.0.0.1');const st=svc.store.status();
 console.log(`Onitsha Way local server: http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||8787}\nTEST payments only. Paystack: ${svc.paystack.enabled?'on (test keys)':'off ('+svc.paystack.problem+')'}. Storage: ${st.driver==='mysql'?`MySQL database "${st.database}" on ${st.host}`:`file ${st.where} (run npm run db:setup to use MySQL/XAMPP)`}\nDo not expose this prototype to the internet.`);
 let quitting=false;for(const sig of ['SIGINT','SIGTERM'])process.on(sig,async()=>{if(quitting)return;quitting=true;await svc.close().catch(()=>{});process.exit(0);});
}
