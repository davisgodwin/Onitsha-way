import {Messenger} from './Messenger.js';
import { politicsApp } from '../politics/PoliticsPhone.js';
import { courierApp } from '../life/CourierPhone.js';
import { venturesApp } from '../life/VenturesPhone.js';
import './phone18.css';
import {hustleEligibility} from '../data/careerProgression.js';
import { furniturePolygon,FURNITURE_SIZE } from '../housing/Placement.js';
import { SKILLS, practiceSkill } from '../life/Skills.js';
import { HOME_GOODS } from '../life/HomeUpgrades.js';
import { GOOD_BY_ID } from '../buy/Goods.js';
import { naira } from '../economy/Economy.js';
import { backgroundInfo } from '../data/backgrounds.js';
export const PHONE_MODELS = [['osha', 'Osha One'], ['niger', 'Niger Pro'], ['palm', 'Palm Mini']];
const APPS = [['jobs','Trader jobs','briefcase'],['messages','Messages','message'],['games','Games','game'],['ads','Business ads','news'],['profile','Profile','idcard'],['bank','Bank','bank'],['business','My business','store'],['law','Law & street','scale'],['politics','Politics','vote'],['courier','The Courier','news'],['ventures','Ventures','briefcase'],['bet','Onitsha Bet','ball'],['contacts','Contacts','people'],['guide','Help & guide','help'],['ride','Book ride','car'],['cars','Cars & homes','home'],['hustle','Hustle','wallet'],['style','Wardrobe','shirt'],['skills','Learn skills','star'],['gist','Onitsha gist','news'],['furnish','My home','lamp'],['places','Places','pin']];
const paths = { vote:'M4 11h16v9H4z M8 11l2-7h5l-2 7 M9 15.5h6', scale:'M12 3v18 M7 21h10 M4 7h16 M6 7l-3 7a3 3 0 0 0 6 0z M18 7l-3 7a3 3 0 0 0 6 0z', bank:'M3 9l9-5 9 5 M5 10v8 M9.5 10v8 M14.5 10v8 M19 10v8 M3 20h18', store:'M4 9l1.5-5h13L20 9 M4 9h16v2a2.6 2.6 0 0 1-5.3 0 2.6 2.6 0 0 1-5.4 0A2.6 2.6 0 0 1 4 11z M5.5 13v7h13v-7 M10 20v-4h4v4', idcard:'M3 5h18v14H3z M8 9.5a2 2 0 1 0 .01 0 M5.5 16c.8-2 4.2-2 5 0 M13 9h5 M13 12h5 M13 15h3', shirt:'M8 3l4 2 4-2 6 5-4 4-2-2v11H8V10l-2 2-4-4z M8 3c0 4 8 4 8 0', briefcase:'M4 7h16v13H4z M9 7V4h6v3 M4 12h16 M10 12v3h4v-3', message:'M4 4h16v13H9l-5 4z M8 8h8 M8 12h5', game:'M7 8h10l4 10h-5l-2-3h-4l-2 3H3z M6 11v4 M4 13h4 M16 11h.1 M18 14h.1', ball:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 8l4 3-2 5h-4l-2-5z M12 3v5 M3 10l5 1 M6 19l4-3 M18 19l-4-3 M21 10l-5 1', people:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M2 21v-3a7 7 0 0 1 14 0v3 M16 4a4 4 0 0 1 0 7 M19 15a5 5 0 0 1 3 5', help:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 9a3 3 0 1 1 4 3l-1 1v1 M12 17h.1', car:'M5 9l2-5h10l2 5 M3 9h18v9H3z M6 18v3 M18 18v3 M6 13h2 M16 13h2', home:'M2 11l10-8 10 8 M5 9v12h14V9 M10 21v-7h4v7', wallet:'M3 5h17v15H3z M3 5V3h14v2 M14 10h7v5h-7z', star:'M12 3l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z', news:'M4 3h16v18H4z M8 7h8 M8 11h8 M8 15h3 M14 15h2 M8 18h8', lamp:'M8 3h8l4 10H4z M12 13v8 M8 21h8', pin:'M12 22S4 14 4 9a8 8 0 0 1 16 0c0 5-8 13-8 13 M12 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6' };
const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[id]}" /></svg>`;
const node = (tag, text, cls) => { const e = document.createElement(tag); if (text != null) e.textContent = text; if (cls) e.className = cls; return e; };
export class PhoneController {
  constructor(game) { this.g = game; this.root = document.querySelector('#phone-content'); this.app = null; this.messenger = new Messenger(this); }
  render(app = null, notice = '') {
    if(['online','voice','team','account','nearby'].includes(app)){if(app==='team')this.messenger.view='groups';app='messages';}
    this.app = app; this.g.online?.updateDock(); const g = this.g, model = g.saveData.phone.model; g.ui.setNeeds(g.needs.values);
    const shell = document.querySelector('.phone-shell'); shell.dataset.model = model; shell.dataset.app = app || 'home';
    this.root.replaceChildren();
    const status = node('div', null, 'phone-status');status.append(node('span',g.clock.label()),node('span',g.online?.connected?'● Local':'○ Offline'));this.root.append(status);
    const heading = node('div', null, 'phone-heading');
    const back = node('button', app ? '‹ Apps' : 'Close'); back.type = 'button'; back.onclick = () => app ? this.render() : g.closeOverlay('phone');
    heading.append(back, node('b', app==='decorate'?'Arrange furniture':APPS.find(a => a[0] === app)?.[1] ?? 'Your Onitsha', 'phone-title')); this.root.append(heading);
    const body = node('div', null, 'phone-body'); this.root.append(body); this.body = body;
    if(app&&!['messages','online','ads','voice','team','account','nearby','places'].includes(app)&&g.clock.mode==='real')body.append(node('p','Real Onitsha time · WAT. Activity durations are simulated; the clock does not skip.','phone-disclaimer'));
    if (notice) body.append(node('p', notice, 'phone-notice'));
    if (!app) { this.home(); return; }
    this[app]?.(); this.messenger.badge();
  }
  text(t, cls = 'phone-copy') { this.body.append(node('p', t, cls)); }
  button(label, detail, action, disabled = false) {
    const b = node('button', null, 'phone-row'); b.type = 'button'; b.disabled = disabled; b.append(node('strong', label)); if (detail) b.append(node('small', detail)); b.onclick = action; this.body.append(b); return b;
  }
  home() {
    const g=this.g,hero=node('div',null,'phone-home-hero');hero.append(node('strong',g.clock.label(),'phone-big-time'),node('span',new Intl.DateTimeFormat('en-NG',{timeZone:'Africa/Lagos',weekday:'long',day:'numeric',month:'long'}).format(new Date())+' · Onitsha'),node('p',`Nnọọ, ${g.saveData.character.name}.`,'phone-greeting'));this.body.append(hero);
    const card=node('button',null,'phone-wallet-widget');card.type='button';card.append(node('span','Your wallet · game naira'),node('strong',naira(g.economy.balance)));card.setAttribute('aria-label','Open bag and wallet');card.onclick=()=>this.bridge('bag');this.body.append(card);
    const grid=node('div',null,'phone-grid');
    for(const[id,label,ico]of APPS){const b=node('button',null,'phone-app');b.type='button';const im=node('span',null,`phone-icon icon-${id}`);im.innerHTML=icon(ico);b.append(im,node('span',label));if(id==='messages'){const badge=node('b',null,'phone-app-badge');badge.dataset.mailBadge='';badge.hidden=true;im.append(badge);}b.onclick=()=>{if(id==='messages')this.messenger.view='inbox';this.render(id);};grid.append(b);}
    this.body.append(grid);const dock=node('div',null,'phone-dock');for(const[id,label,ico]of[['contacts','Contacts','people'],['places','Places','pin'],['messages','Messages','message']]){const b=node('button',null,'phone-app');b.type='button';const im=node('span',null,'phone-icon');im.innerHTML=icon(ico);b.append(im,node('span',label));b.onclick=()=>this.render(id);dock.append(b);}this.body.append(dock);this.messenger.badge();
  }
  openMessages(target=null) {const o=this.g.online;if(this.g.state==='overlay'&&this.g.overlay!=='phone')this.g.closeOverlay();if(!(this.g.state==='overlay'&&this.g.overlay==='phone'))this.g.openOverlay('phone');const peer=target?o.data?.friends.find(p=>p.id===target)||o.players.find(p=>p.id===target)||o.data?.mail?.threads.find(t=>t.peer.id===target)?.peer:null;this.messenger.show(peer);}
  ads() { this.g.online.panel.render('ads'); }
  bridge(which) { this.g.closeOverlay('phone'); this.g.openOverlay(which); }
  story() { this.render('profile'); }
  /** v0.41: your bank account and loans (cash in and out needs a branch). */
  bank() {
    const g=this.g,B=g.business,b=B.bank,s=g.saveData.bank;
    if(!s.open){this.text('You have no bank account. Visit a branch to open one (Nkwo Trust Bank near Main Market, Bridgehead Savings & Loans near Upper Iweka).');for(const br of B.branches)this.button(br.name,'Mark the branch on the map',()=>this.mark(br.x,br.z,br.name));return;}
    const card=node('div',null,'profile-card');card.append(node('strong',naira(b.balance)),node('span',`${B.branches.find(x=>x.id===s.bank)?.name??'Your bank'} · credit score ${s.score} · cash in hand ${naira(g.economy.balance)}`));this.body.append(card);
    this.text('Deposits and withdrawals need a branch. From the phone you can move money to your businesses and pay off loans.','phone-copy profile-small');
    for(const l of b.active()){const owed=b.owed(l);this.button(`${l.label}: ${naira(owed)} owed${l.status==='default'?' · in default':''}`,`${naira(l.per)} a day from your account · ${l.missedTotal?`${l.missedTotal} missed`:'on time'}${l.assetLabel?` · pledged: ${l.assetLabel}`:''} · tap to pay ${naira(Math.min(owed,b.balance))} now`,()=>{const r=b.repay(l.id,Math.min(owed,b.balance));g.saveGame();this.render('bank',r.ok?(r.owed?`Paid. ${naira(r.owed)} still owed.`:'Loan paid off!'):r.error);},b.balance<=0);}
    for(const o of g.saveData.orgs.list)this.button(`Send ${naira(Math.min(50000,b.balance))} to ${o.name}`,'From your bank account to the business account',()=>{B.transfer(b.account,B.acct(o),Math.min(50000,b.balance),`${o.name}: from your bank`);this.render('bank','Sent.');},b.balance<=0);
    this.button('Find a branch','Loans are arranged in the banking hall',()=>{const p=g.player.position,br=[...B.branches].sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];if(br)this.mark(br.x,br.z,br.name);});
    this.body.append(node('h3','Recent','profile-h'));for(const e of [...g.saveData.bank.account.ledger].reverse().slice(0,10))this.text(`Day ${e.day??'?'} · ${e.reason} · ${e.amount>0?'+':''}${naira(e.amount)}`,'phone-copy profile-entry');
  }
  /** v0.41: your businesses and fleets, plus your own bus route and conductor. */
  business() {
    const g=this.g,B=g.business,list=B.summary(),biz=g.saveData.business;
    if(!list.length)this.text('You run no business yet. Shops to let are marked on the map (Places): rent or buy one and open a provisions shop, buka, beer parlour, phone shop or boutique. With a keke or a bus you can also start a transport company and hire drivers.');
    for(const o of list)this.button(`${o.name} · ${naira(o.balance)}`,`${o.label}${o.last?` · day ${o.last.day}: ${naira(o.kind==='shop'?o.last.revenue:o.last.remit)}${o.last.notes.length?' · '+o.last.notes[0]:''}`:''}`,()=>{g.closeOverlay('phone');g.openChoice(()=>B.orgView(g.saveData.orgs.list.find(x=>x.id===o.id)));});
    this.button('Find a shop to let','Mark the nearest free premises',()=>{const p=g.player.position,pr=B.premises.filter(x=>!B.orgAt(x)).sort((a,c)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(c.x-p.x,c.z-p.z))[0];if(pr)this.mark(pr.x,pr.z,'Shop to let');else this.render('business','No free premises right now.');});
    const fleet=B.commercialVehicles();
    if(fleet.length&&!g.saveData.orgs.list.some(o=>o.kind==='transport'))this.button('Start a transport company · ₦5,000','Hire drivers to work your keke or buses',()=>{g.closeOverlay('phone');B.startTransport();},!g.economy.canAfford(5000));
    if(fleet.some(v=>v.model!=='keke')){const lines=['any',...g.transport.net.lines.filter(l=>l.mode!=='keke').map(l=>l.id)],cur=biz.line??'any',name=cur==='any'?'Any destination':g.transport.net.lines.find(l=>l.id===cur)?.name??cur;this.button(`Your bus route: ${name}`,'Passengers only board for stops on your route. Tap to change',()=>{const nx=lines[(lines.indexOf(cur)+1)%lines.length];biz.line=nx==='any'?null:nx;if(g.vehicles.driving)g.vehicles.setFareVehicle?.(g.vehicles.driving);g.saveGame();this.render('business');});}
    if(fleet.length){const on=biz.conductorDay===g.clock.day;this.button(on?'Your conductor is with you today':'Hire a conductor for today · ₦1,500','Calls passengers from across the stop and collects fares as they board',()=>{const tx=g.economy.transact({key:`conductor:${g.clock.day}`,amount:-1500,reason:'Conductor for the day'});if(tx.ok)biz.conductorDay=g.clock.day;g.saveGame();this.render('business',tx.ok?'Your conductor will meet you at your vehicle.':'Not enough cash');},on||!g.economy.canAfford(1500));}
  }
  /** v0.42: your legal situation, stolen goods, the police and EFCC, and Hustle Kingdoms. */
  politics() { politicsApp(this); } // v0.45
  courier() { courierApp(this); } // v0.46
  ventures() { venturesApp(this); } // v0.47
  law() {
    const g=this.g,J=g.justice;if(!J?.ready)return;const st=J.status(),sec=(t)=>this.body.append(node('h3',t,'profile-h')),adult=J.adult(),off=J.officer();
    const card=node('div',null,'profile-card');const legal=g.life.legal();card.append(node('strong',legal.word),node('span',st.wanted.length?`Wanted by ${[...new Set(st.wanted.map(w=>w.agency==='efcc'?'the EFCC':'the police'))].join(' and ')}`:st.court?`On bail · hearing on day ${st.court.day}`:'Nobody is looking for you'));this.body.append(card);
    for(const w of st.wanted)this.text(`Warrant (${w.agency==='efcc'?'EFCC':'police'}): ${w.offence}. Officers who see you will arrest you. You can turn yourself in at the ${w.agency==='efcc'?'EFCC field office':'police station'}.`,'phone-copy profile-entry');
    for(const w of st.watched)this.text(`People are asking questions about: ${w.offence} (day ${w.day}).`,'phone-copy profile-entry');
    if(st.court)this.button(`Court hearing: day ${st.court.day}`,'Magistrate Court. Miss it and a warrant goes out',()=>this.mark(J.court.x,J.court.z,'Magistrate Court'));
    if(st.convictions)this.text(`Convictions: ${st.convictions}. Each one makes the next sentence heavier.`,'phone-copy profile-small');
    if(!adult){this.text('Crime, the police and the EFCC are for adults. If something is wrong, tell a grown-up you trust.');return;}
    if(st.stash.length){sec('Stolen goods');for(const x of st.stash)this.text(`${x.name} · worth about ${naira(x.value)} · taken on day ${x.day}`,'phone-copy profile-entry');this.button('Find the back-street dealer','He buys anything, no questions',()=>this.mark(J.dealer.x,J.dealer.z,'Back-street dealer'));}
    const T=g.together;if(g.online?.connected&&T){sec('Other players');const ps=T.status;
      if(!ps){this.text('Checking with the server…','phone-copy profile-small');if(!this.lawLoading){this.lawLoading=true;T.loadStatus().finally(()=>{this.lawLoading=false;if(this.app==='law')this.render('law');});}}
      else{const mins=(ms)=>Math.ceil(ms/60000);
        this.button(ps.peace?'Peace mode is on':'Peace mode is off',ps.peace?'Nobody can rob you, and you can\'t rob anyone. Tap to switch off':`Switch on and nobody can target you (and you can't target anyone)${ps.peaceLock?` · available in ${mins(ps.peaceLock)} min`:''}`,async()=>{try{await T.setPeace(!ps.peace);this.render('law',ps.peace?'Peace mode on.':'Peace mode off.');}catch(e){this.render('law',e.message);}},!ps.peace&&ps.peaceLock>0);
        if(ps.shield)this.text(`You were targeted recently: nobody can target you for ${mins(ps.shield)} more minutes.`,'phone-copy profile-small');
        if(ps.nextCrime)this.text(`You can try something again in ${mins(ps.nextCrime)} minutes.`,'phone-copy profile-small');
        this.text('Safe areas: near the police, a hospital, a bank or the court, and indoors. Never with children.','phone-copy profile-small');
        for(const i of ps.incidents){const what=i.mine?`You ${i.ok?(i.kind==='rob'?'robbed':'pickpocketed'):'tried to rob'} ${i.other}${i.amount?` (${naira(i.amount)})`:''}`:`${i.other} ${i.ok?(i.kind==='rob'?'robbed':'pickpocketed'):'tried to rob'} you${i.amount?` (${naira(i.amount)})`:''}`;
          if(!i.mine&&!i.reported)this.button(what,'Tap to report it to the police',async()=>{try{await T.req('pvpReport',{id:i.id});T.status=null;this.render('law','Reported to the police.');}catch(e){this.render('law',e.message);}});else this.text(`${what}${i.reported?' · reported':''}`,'phone-copy profile-entry');}}}
    sec('Police & EFCC');
    if(off){const d=st.duty;this.text(`You serve with the ${off==='efcc'?'EFCC':'Nigeria Police Force'}. ${st.complaints?`Complaints upheld: ${st.complaints}.`:'No complaints against you.'}`);if(d)this.button(`On duty: ${d.title}`,`Step ${d.step+1} of ${d.steps.length}: ${d.steps[d.step].text}`,()=>{g.closeOverlay('phone');J.markStep();});else{const o=g.story.offices.find(x=>x.id===off);this.button('Go on duty','At your office',()=>this.mark(o.x,o.z,o.name));}}
    else for(const o of g.story.offices.filter((o,i,a)=>a.findIndex(q=>(q.kind??q.id)===(o.kind??o.id))===i)){const n=st.academy[o.id]??0;this.button(`Join the ${o.id==='efcc'?'EFCC':'police'}`,`Academy ${n}/3 · then apply at the ${o.name}. Needs a clean record and no Hustle Kingdom`,()=>this.mark(o.x,o.z,o.name));}
    if(off){this.lawLog(st);return;}
    sec('Hustle Kingdom');const k=st.kingdom;
    this.text('Schemes are kept abstract. They pay, they draw EFCC attention, and a member who doesn\'t trust you may talk.','phone-copy profile-small');
    if(!k){this.button('Start a Hustle Kingdom · ₦20,000','Rent a house for a crew. You run the schemes',()=>{const name=`${g.saveData.character.name}'s house`;if(J.found(name))this.render('law','Started.');else this.render('law','Not enough cash.');},!g.economy.canAfford(20000));
      for(const b of J.npcKingdoms())this.button(`Join ${b}`,'Work for a boss: you keep half of what you bring in',()=>{J.join(b);this.render('law',`You run with ${b} now.`);});}
    else{
      this.text(`${k.role==='boss'?`${k.name} · ${k.members.length} member${k.members.length===1?'':'s'}`:`You run with ${k.boss}`} · ${k.schemes} scheme${k.schemes===1?'':'s'} so far`,'phone-copy');
      for(const[id,S]of Object.entries(J.schemes)){const c=J.canRun(k,id,{day:g.clock.day,hustle:g.skills.level('hustle')});this.button(`${S.label}`,c.ok?`${S.minutes/60} hours · ${naira(S.gross[0])}–${naira(S.gross[1])} before cuts · more heat`:c.error,()=>{const r=J.scheme(id);if(r)this.render('law',r.ok?`It worked: ${naira(r.mine)} for you.`:r.error??'It came to nothing.');},!c.ok);}
      if(k.role==='boss'){
        for(const m of k.members)this.button(`${m.name} · ${m.hint}`,`Since day ${m.day} · tap to let them go`,()=>{J.letGo(m.id);this.render('law',`${m.name} is out.`);});
        if(k.members.length<J.kingdomMax)for(const c of J.candidates())this.button(`Bring in ${c.name} · ₦10,000`,`${c.hint}`,()=>{J.hire(c);this.render('law');},!g.economy.canAfford(10000));
        if(k.members.length){this.button('Who might be talking?',`Charisma ${g.skills.level('charisma')}: read your people`,()=>{const l=J.suspectView();this.render('law',l.map(m=>`${m.name}: ${m.flagged?'something is off':'seems fine'}`).join(' · '));});
          this.button('Pay the crew extra · ₦20,000','Buys loyalty (not from someone already talking)',()=>{J.payMembers(20000);this.render('law','They\'re happy.');},!g.economy.canAfford(20000));}
      }
      this.button(k.role==='boss'?'Close the house down':'Walk away',"The EFCC's case doesn't close with it",()=>{J.leaveKingdom();this.render('law');});
    }
    this.lawLog(st);
  }
  lawLog(st){if(!st.log.length)return;this.body.append(node('h3','Recently','profile-h'));for(const l of st.log)this.text(`Day ${l.day} · ${l.text}`,'phone-copy profile-entry');}
  /** v0.40: who you are in the city — your work, the seven sides of your reputation, your record and your life so far. */
  profile() {
    const g=this.g,p=g.life.profile(),sec=(t)=>this.body.append(node('h3',t,'profile-h'));
    const card=node('div',null,'profile-card');card.append(node('strong',p.name??'You'),node('span',p.jobs.length?p.jobs.map(j=>`${j.rank} · ${j.label}`).join(' / '):'Looking for opportunities'));this.body.append(card);
    sec('Work');
    if(!p.jobs.length)this.text('You have no job. Nobody will give you one: apply at a workplace (marked on the map), take trader jobs in the markets, buy a keke and carry passengers, or trade stock. Change direction whenever you like.');
    for(const j of p.jobs){const b=this.button(`${j.label} · ${j.rank}`,j.kind==='employed'?`Rank ${j.rankIndex+1} of ${j.of} · ${j.shifts} shift${j.shifts===1?'':'s'} worked since day ${j.since}${j.warnings?` · ${j.warnings} warning${j.warnings>1?'s':''}`:''}`:`Self-employed · ${j.acts} done since day ${j.since} · level ${j.rankIndex+1} of ${j.of}`,()=>{});b.classList.add('profile-static');}
    if(p.jobs.some(j=>j.kind==='employed'))this.text('Work shifts, see what your next promotion needs, or resign at your workplace.','phone-copy profile-small');
    sec('Reputation');
    for(const d of p.dims){
      if(d.list){const row=node('div',null,'profile-dim');row.append(node('b',d.label),node('small',`${d.who} · ${d.desc}`));if(!d.list.length)row.append(node('span','No work yet','profile-word'));for(const x of d.list){const r=node('div',null,'profile-sub');r.append(node('span',`${x.label}: ${x.word}`),bar(x.value));row.append(r);}this.body.append(row);continue;}
      const row=node('div',null,'profile-dim');row.append(node('b',d.label),node('span',d.word,'profile-word'),bar(d.bar,d.min<0),node('small',`${d.who} · ${d.desc}`));this.body.append(row);
    }
    const pv=p.publicView;this.text(`What other people see: ${pv.public} · ${pv.social}${pv.business?` · business ${pv.business}`:''} · ${pv.wealth}. Integrity, notoriety and your record are not shown to other players.`,'phone-copy profile-small');
    sec('Police and work record');
    const st=node('div',null,`profile-legal level-${p.legal.level}`);st.append(node('b',p.legal.word));this.body.append(st);
    if(!p.record.length)this.text('Nothing on your record.','phone-copy profile-small');
    for(const e of p.record)this.text(`Day ${e.day} · ${e.text}${e.amount?` · ${naira(e.amount)}`:''}${e.status==='open'?' · open':''}`,'phone-copy profile-entry');
    sec('Recent changes to your reputation');
    if(!p.log.length)this.text('Nothing yet. What you do in the city changes how people see you.','phone-copy profile-small');
    for(const e of p.log){const parts=Object.entries(e.d??{}).flatMap(([k,v])=>k==='prof'?Object.entries(v).map(([o,n])=>`${o} ${n>0?'+':''}${n}`):[`${k} ${v>0?'+':''}${v}`]);this.text(`Day ${e.day} · ${e.text}${parts.length?` (${parts.join(', ')})`:''}${e.rumour?' · rumour':''}`,'phone-copy profile-entry');}
    if(p.history.length){sec('Your working life');for(const h of p.history)this.text(`Day ${h.day} · ${h.text}`,'phone-copy profile-entry');}
    const au=g.authority?.summary();sec('Account server');
    if(!au?.on)this.text('Offline: this game lives in this browser. Log in to an account and your account server keeps the books (money, property you paid for, your record and reputation).','phone-copy profile-small');
    else{this.text(`Your account server keeps the books for this game${au.lastSync?` · last checked ${new Date(au.lastSync).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`:''}${au.queued?` · ${au.queued} to send`:''}${au.status==='offline'?' · not reachable right now (it catches up later)':''}.`,'phone-copy profile-small');
     for(const x of au.rejected)this.text(`Not accepted: ${x.amount>0?'+':''}${naira(x.amount)} · ${x.why}`,'phone-copy profile-entry');
     if(au.unverified.vehicles.length||au.unverified.homes.length)this.text(`${au.unverified.vehicles.length+au.unverified.homes.length} thing(s) you own were never paid for on this account: you keep them, but they can't be sold or pledged.`,'phone-copy profile-entry');}
    function bar(v,signed=false){const o=node('span',null,`profile-bar${signed?' signed':''}`),f=node('i'),x=Math.max(0,Math.min(100,v));if(signed){f.style.left=`${Math.min(50,x)}%`;f.style.width=`${Math.abs(x-50)}%`;if(x<50)f.classList.add('neg');}else f.style.width=`${x}%`;o.append(f);return o;} /* signed bars grow from the centre: right = good, left = bad */
  }
  jobs() { this.text('Trader jobs you have taken, and your work log. Traders in the markets offer delivery, collection and errand jobs.'); this.button('Open job journal','Active and finished trader jobs',()=>this.bridge('jobs')); this.button('Find market work','Visit a trader and talk (E) for local offers.',()=>this.goLandmark('main-market')); }
  style() { this.text('All 16 outfits and the original hairstyles now fit the supplied character body, with independent top, trouser and shoe colours. No purchase or new game is needed.');this.button('Open wardrobe','Casual · smart & suits · traditional · sport',()=>{this.g.openChoice(()=>this.g.homes.wardrobeView());}); }
  messages() { this.messenger.render(); }
  games() {
    this.text('Street Quiz · one free round each game day. Correct answers give +15 fun.');
    const q = (this.g.clock.day - 1) % 3, questions = [['Which river runs past Onitsha?',['Niger','Nile','Congo'],0],['What do you buy at a foodstuff stall?',['Engine oil','Rice and pepper','Car tyres'],1],['Where can you cross to Asaba?',['Main Market','A kitchen','Niger Bridge'],2]];
    const [question,answers,right] = questions[q]; this.text(question,'phone-greeting');
    const done = this.g.saveData.phone.work[`quiz:${this.g.clock.day}`];
    answers.forEach((a,i)=>this.button(a,done ? 'Played today' : 'Choose your answer',()=>{ const key=`quiz:${this.g.clock.day}`; if(this.g.saveData.phone.work[key])return; this.g.saveData.phone.work[key]=true; this.g.needs.adjust({fun:i===right?15:5}); this.g.saveGame(); this.render('games',i===right?'Correct! +15 fun.':'Good try. +5 fun. Come back tomorrow.'); },!!done));
  }
  bet() {
    if(this.g.saveData.character.ageGroup==='child'){this.text('Betting is unavailable for child characters. Try Street Quiz or learning activities.');return;}
    this.text('Bridgehead United vs Fegge Stars. Game money only. No real teams, deposits, cashout or real odds.');
    this.text('Optional: ₦100 stake, ₦250 total return for a correct pick. Maximum one ticket per game day. This is not a reliable way to earn.');
    const prev=this.g.saveData.phone.bets[this.g.clock.day];
    if(prev) this.text(`Today: ${prev.choice}. Result: ${prev.result}. ${prev.won?'Returned ₦250.':'Stake lost.'}`);
    for(const [pick,label] of [['home','Bridgehead win'],['draw','Draw'],['away','Fegge win']])this.button(label,'Stake ₦100 of game money',()=>{ const r=this.g.phoneServices.bet(pick);this.g.saveGame();this.render('bet',r.ok?(r.won?'You won a game-money prize.':'No win this time. Take a break.'):`Unavailable: ${r.error}`);},!!prev || !this.g.economy.canAfford(100));
  }
  contacts() {
    const contacts=Object.entries(this.g.saveData.relationships).filter(([,r])=>r.name && (r.talks??0)>0);
    this.text('People you have met. Calls are simulated conversations with local NPCs.');
    if(!contacts.length)this.text('Your contacts list is empty. Talk to people on the street.');
    for(const [id,r] of contacts.slice(0,24))this.button(r.name,`Familiarity ${r.familiarity??0} · call and catch up (15 min)`,()=>{const key=`call:${this.g.clock.day}:${id}`;if(this.g.saveData.phone.work[key]){this.render('contacts','You already caught up today.');return;}this.g.saveData.phone.work[key]=true;r.talks=(r.talks??0)+1;r.positive=(r.positive??0)+1;this.g.skipTime(15);this.g.needs.adjust({social:22,fun:3});this.g.skills.add('charisma',15);this.g.saveGame();this.render('contacts',`${r.name}: “How far? Hope say you dey alright!”`);});
  }
  guide() { const attribution=node('p',null,'phone-copy');for(const [text,url]of[['Weather data: Open-Meteo','https://open-meteo.com/'],[' · CC BY 4.0','https://creativecommons.org/licenses/by/4.0/']]){const a=node('a',text);a.href=url;a.target='_blank';a.rel='noopener noreferrer';attribution.append(a);}this.body.append(attribution);this.text('Real Onitsha time is the default (WAT, Africa/Lagos), based on your device clock. Normal play always uses real time; old accelerated settings are ignored. Simulated weather is enabled by default and requires no API. Clubs open 19:00–04:00 only. Activities apply simulated-duration effort in real mode without changing the real time. Live current conditions come from Open-Meteo.com (CC BY 4.0); internet failure uses clearly labelled cached/simulated fallback. Grid outages are simulated. The free weather endpoint is for non-commercial demos only; a commercial launch needs a licensed service/proxy.');for(const t of ['Move with WASD or the touch joystick. E interacts. M opens the labelled map; O opens this phone.','Six needs: eat cooked food for hunger; sleep for energy; play or go out for fun; talk or call for social; shower for hygiene; use a toilet for bladder. High bars are good.','Rent at a TO LET door. Every home has a kitchen and bathroom. Buy foodstuff at the market, cook at your stove, eat from your bag (I).','My home sells furniture, decor and power equipment. Arrange furniture lets you move, rotate, recolour and store purchased items for a rented house. Generators stay outdoors, use fuel, and must be switched on. Inverters recharge when grid power returns.','Skills range from 1 to 10. Practice takes game time and drains needs; level up by doing things, not just opening a menu.','Offline mode is a single-player simulation; Online city adds local multiplayer for adult characters. Prices, services, people and interiors are designed for play; some entrances are approximate. You can walk away from street pressure without paying.','Save regularly. Settings → Export save creates your backup. Use Import save to move devices.'])this.text(t); }
  ride() {
    const g=this.g; if(g.homes.inside){this.text('Go outside before booking transport.');return;}
    if(g.transport.riding || g.vehicles.driving){this.text('Finish your current trip before booking another ride.');return;}
    this.text('Book existing public transport from a stop. Walk to the sign before choosing a destination; payment is collected once when you depart.');
    const p=g.player.position, stops=[...g.transport.net.stops].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z));
    for(const s of stops.slice(0,8)){const d=Math.hypot(s.x-p.x,s.z-p.z);this.button(s.name,`${Math.round(d)} m · ${d<14?'Choose destination':'Mark stop on map'}`,()=>{if(d<14){g.closeOverlay('phone');g.openOverlay('stop',{stop:s});}else this.mark(s.x,s.z,s.name);});}
  }
  cars() { this.text('Compare real in-game rental listings and vehicle dealers. Mark a listing, then visit it to rent or buy.'); this.button('Browse homes & cars','Includes your parked vehicles',()=>this.bridge('homes')); }
  hustle() {
    const g=this.g;this.text('Jobs with an employer are at the workplaces on the map (apply, then work shifts). Here are small gigs you can do from your phone.');
    this.button('Find a workplace','Mark the nearest workplace on the map',()=>{const p=g.player.position,s=[...(g.story.city?.sites??[])].sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];if(s)this.mark(s.x,s.z,s.name);});
    this.text('Optional phone-side creative gigs: once per WAT date, with equipment, skill and energy requirements.');
    for(const[id,label,skill]of[['music','Record a jingle','music'],['comedy','Write a comedy set','comedy']]){const r=hustleEligibility(id,{skills:g.skills,inventory:g.inventory,character:g.saveData.character});this.button(label,`${r.ok?'Ready':r.missing.join(' · ')} · Level ${g.skills.level(skill)}`,()=>{const x=g.phoneServices.work(id);if(x.ok)g.skipTime(x.minutes);g.saveGame();this.render('hustle',x.ok?`Gig complete: ${naira(x.amount)} earned.`:x.error);},!r.ok||!!g.saveData.phone.work[`${g.clock.day}:${id}`]);}
  }
  skills() {
    const g = this.g;
    this.text('Level 1 → 10. Guided phone practice earns up to 30 XP and applies 30 simulated minutes of effort. Your real WAT clock does not skip. Close the phone and play in the city for 20 seconds between exercises. Cooking grows at home or at the catering workshop.');
    for (const id of Object.keys(SKILLS)) {
      const p = g.skills.progress(id);
      const detail = p.level === 10 ? `${p.xp} XP · Mastered — maximum level` : `${p.xp} / ${p.nextXp} total XP · ${p.remaining} XP to level ${p.level + 1} · ${Math.floor(p.progress * 100)}%${id === 'cooking' ? ' · use a kitchen or workshop' : ' · practise (+30 XP)'}`;
      this.button(`${p.label} · ${p.level}/10`, detail, () => {
        const r = practiceSkill({ skills: g.skills, needs: g.needs, progression: g.story.s, spendTime: minutes => g.skipTime(minutes), travelling: !!(g.vehicles.driving || g.transport.riding) }, id);
        if (r.ok) g.saveGame();
        this.render('skills', r.ok ? `${p.label}: +${r.gained} XP.${r.level > r.before ? ` Level up! Level ${r.level}/10${r.level === 10 ? ' · Mastered!' : ''}` : ''}` : r.error);
      }, p.level === 10);
    }
  }
  gist() { const g=this.g;this.text('ONITSHA GIST','phone-greeting');this.text(`${g.clock.label()} · ${g.weather?.w?.label??'City weather'} · ${g.weather?.power.on?'Grid power is on.':'NEPA took light. Check your backup power.'}`);this.text(`Clock: ${g.clock.mode==='real'?'Real Onitsha time · Africa/Lagos':'Accelerated game time'}. Weather: ${g.settings.liveWeather===false?'simulated':g.weather.live.status}. Weather data: Open-Meteo.com, CC BY 4.0; model-derived current conditions, not a street sensor. Power cuts are simulated.`);this.text(`Weather update: ${g.weather.live.current?new Date(g.weather.live.current.fetchedAt).toLocaleString('en-GB',{timeZone:'Africa/Lagos'}):'No successful fetch yet'} WAT. API sample: ${g.weather.live.current?.observedAt??'unavailable'}.`);this.text(`Your area reputation: ${g.reputation().label}.`);this.text('Local bulletin: take delivery jobs at the market, find bulk supplies at the depot, or carry passengers in your own keke.'); for(const v of g.cityLife.venues)this.button(v.name,'',()=>this.mark(v.x,v.z,v.name));this.button('Street tips','Read new advice from the city guide',()=>this.render('guide')); }
  places() { for(const l of this.g.world.landmarks.list)this.button(l.name,'',()=>this.mark(l.visitSpot?.x??l.x,l.visitSpot?.z??l.z,l.name));for(const v of this.g.cityLife.venues)this.button(v.name,'',()=>this.mark(v.x,v.z,v.name));for(const v of this.g.story.city.services.filter(v=>v.kind==='fuel'))this.button(v.name,'',()=>this.mark(v.x,v.z,v.name)); }
  furnish() { const gh=this.g.homes.housing?.mine().filter(m=>this.g.homes.housing.access(m.home.id).use)??[];for(const m of gh)this.button('Secure garage · '+m.home.label,'Store, retrieve vehicles and choose your respawn home',()=>this.g.openChoice(()=>this.g.garage.view(m.home)));
    this.button('Open Buy mode','Full home catalogue, finish previews and furniture placement',()=>{this.g.closeOverlay('phone');this.g.buy.open();});
    const g=this.g, inside=g.homes.inside, h=inside?.home;
    const mine=g.homes.housing.mine().filter(h=>h.status==='tenant');
    if(!h || inside.viewing || inside.host || !g.homes.housing.access(h.id).use){this.text('Visit a home you currently rent to decorate it and manage power.');for(const x of mine)this.button(x.home.label,x.home.street??'Your rented home',()=>this.mark(x.home.door.stand.x,x.home.door.stand.z,x.home.label));return;}
    const s=g.homeUpgrades.home(h.id);this.text(`${h.label} · furniture and equipment stay with this home. Move, rotate, recolour, store or sell furniture in Buy mode.`);
    this.text(`Power: ${g.homeUpgrades.powered(h.id,g.weather?.power.on??true)?'available':'off'} · Generator ${s.fuel.toFixed(1)} L · Battery ${Math.round(s.battery)}%`);
    this.button('Arrange furniture','Top-down room editor · move, rotate, recolour and store',()=>this.render('decorate'));
    for(const r of [...new Map((g.homes.decor.records??[]).map(r=>[r.id,r])).values()]){const good=HOME_GOODS.find(item=>item.id===r.id);if(good?.action)this.button('Use '+good.label,'Open the same controls as interacting beside this appliance',()=>{g.closeOverlay('phone');g.openChoice(()=>g.homes.upgradeView(r.id));});}
    const refresh=msg=>{g.homes.refreshDecor();g.homes.applyLight();g.saveGame();this.render('furnish',msg);};
    if(g.homeUpgrades.hasEquipment(h.id,'generator')){this.button(s.generatorOn?'Switch generator off':'Switch generator on','Outdoor unit · 1 L lasts 120 game minutes',()=>{if(!s.generatorOn&&s.fuel<=0){refresh('Add fuel first.');return;}const result=g.homeUpgrades.setBackup(h.id,'generator',!s.generatorOn);if(result.ok&&s.generatorOn)g.homes.housing.state.lamps[h.id]=true;refresh(result.ok?(s.generatorOn?'Generator running outside.':'Generator off.'):result.error);});this.button('Pour 5 L fuel','Uses one fuel jerrycan from your bag',()=>{const r=g.homeUpgrades.refuel(h.id,g.inventory);refresh(r.ok?'Fuel added.':r.error);});}
    if(g.homeUpgrades.hasEquipment(h.id,'battery'))this.button(s.inverterOn?'Disable inverter backup':'Enable inverter backup','6 hours at full charge · grid charging takes 4 hours',()=>{const result=g.homeUpgrades.setBackup(h.id,'battery',!s.inverterOn);if(result.ok&&s.inverterOn)g.homes.housing.state.lamps[h.id]=true;refresh(result.ok?'Backup preference saved.':result.error);});
    this.text('Homes include ceiling bulbs, a kitchen and bathroom. Buy furniture at the four home stores around Onitsha (delivered free) or order it in Buy mode (delivery fee), place it, then walk up and interact to use them. Inverter batteries recharge on the grid and supply lights during outages when backup is enabled. Backup units share one home fuel tank and battery reserve.');

  }
  decorate() {
    const g=this.g,d=g.homes.decor,inside=g.homes.inside;
    if(!inside||inside.host||inside.viewing||!g.homes.housing.access(inside.home.id).use){this.text('Enter your rented home first.');return;}
    const lay=inside.layout,s=g.homeUpgrades.home(inside.home.id);
    const pieces=s.pieces.filter(p=>FURNITURE_SIZE[p.item]&&GOOD_BY_ID[p.item].mount!=='outdoor'&&(p.floor===lay.id||p.floor==='storage'));
    this.text('Tap or drag on the floor plan, rotate, then Save position. Wall items snap to the nearest wall. Walls and entry routes stay protected. Buy mode has the full 3D editor.');
    if(!pieces.length){this.button('Buy furniture first','Open Buy mode',()=>{g.closeOverlay('phone');g.buy.open();});return;}
    if(!pieces.some(p=>p.pid===this.decorId))this.decorId=pieces[0].pid;const piece=pieces.find(p=>p.pid===this.decorId),id=piece.item;
    let draft={x:lay.size[0]/2,z:lay.size[1]/2,rotation:0,...(piece.floor===lay.id?{x:piece.x,z:piece.z,rotation:piece.rotation}:{})};
    const select=node('select',null,'decor-select');select.setAttribute('aria-label','Furniture to arrange');const n={};for(const p of pieces){n[p.item]=(n[p.item]??0)+1;const op=node('option',`${GOOD_BY_ID[p.item].label}${pieces.filter(q=>q.item===p.item).length>1?' #'+n[p.item]:''}${p.floor==='storage'?' (stored)':''}`);op.value=p.pid;op.selected=p.pid===piece.pid;select.append(op);}select.onchange=()=>{this.decorId=select.value;this.render('decorate');};this.body.append(select);
    const canvas=node('canvas',null,'decor-plan');canvas.width=640;canvas.height=Math.round(640*lay.size[1]/lay.size[0]);canvas.setAttribute('aria-label','Room floor plan. Tap to set furniture position.');this.body.append(canvas);const ctx=canvas.getContext('2d'),scale=640/lay.size[0];
    const status=node('p',null,'phone-notice');status.setAttribute('role','status');this.body.append(status);
    const paint=(poly,color)=>{ctx.fillStyle=color;ctx.beginPath();poly.forEach(([x,z],i)=>ctx[i?'lineTo':'moveTo']((x-lay.origin.x)*scale,(z-lay.origin.z)*scale));ctx.closePath();ctx.fill();};
    let save;
    const draw=()=>{draft=d.resolve(id,draft);ctx.fillStyle='#e9e2d5';ctx.fillRect(0,0,canvas.width,canvas.height);for(const pi of lay.polys){const p=g.world.collision.polys[pi];if(p)paint(p.pts,'#8e8b80');}for(const r of d.records??[])if(r.pid!==piece.pid)paint(r.polygon,r.mount==='floor'?'#819e97':'#b9cbc6');for(const i of lay.items.filter(x=>['door','stairs','bathroom','kitchen'].includes(x.kind))){ctx.fillStyle='#b07b3c';ctx.beginPath();ctx.arc((i.x-lay.origin.x)*scale,(i.z-lay.origin.z)*scale,9,0,Math.PI*2);ctx.fill();}const result=d.checkPlacement(id,draft,piece.pid);paint(furniturePolygon(id,lay.origin.x+draft.x,lay.origin.z+draft.z,draft.rotation),result.ok?'#227969':'#b95446');status.textContent=result.ok?`${Math.round(draft.rotation)}° · position clear. Save to place it.`:result.error;if(save)save.disabled=!result.ok;};
    const point=e=>{const b=canvas.getBoundingClientRect();draft.x=Math.round(((e.clientX-b.left)/b.width*lay.size[0])*10)/10;draft.z=Math.round(((e.clientY-b.top)/b.height*lay.size[1])*10)/10;draw();};
    canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);this.decorDragging=true;point(e);};canvas.onpointermove=e=>{if(this.decorDragging)point(e);};canvas.onpointerup=()=>{this.decorDragging=false;};canvas.onpointercancel=()=>{this.decorDragging=false;};
    this.button('Rotate 45°','Turn the selected furniture',()=>{draft.rotation=(draft.rotation+45)%360;draw();});
    save=this.button('Save position','Place it here in this room',()=>{const r=d.placePiece(piece.pid,draft);this.render('decorate',r.ok?'Furniture position saved.':r.error);});
    if(piece.floor!=='storage')this.button('Store this item','Take it off the floor; you still own it',()=>{d.storePiece(piece.pid);this.render('decorate','Item stored. Pick a clear position to bring it back.');});
    this.button('Back to My home','Shop and power controls',()=>this.render('furnish'));draw();
  }
  goLandmark(id) { const l=this.g.world.landmarks.get(id);if(l)this.mark(l.x,l.z,l.name); }
  mark(x,z,name) { this.g.closeOverlay('phone');this.g.setWaypoint({x,z,name,radius:8,custom:true});this.g.openMap({x,z,name}); }
}
