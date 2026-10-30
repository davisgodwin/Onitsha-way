import * as THREE from 'three';

/**
 * v0.50: television you can actually watch. Seven channels of original, invented programmes, drawn live on a canvas:
 * the same picture plays on the TV screen in the room and, while you watch, big on your screen. Every title, show,
 * channel, team and character is made up for this game; nothing is taken from real films or broadcasters.
 */
const SKINS = ['#5a3825', '#6e4630', '#8a5a3c', '#a46e4a', '#c79a74', '#3f281b'];
export const TV_CHANNELS = [
 {id:'nollywood', name:'Nollywood drama', channel:'Ụlọ Movies', minutes:60, needs:{fun:24,social:6}, shows:[
  {title:'The Inheritance of Obiageli', lines:['Obiageli: This house was my father\'s. Nobody will drive me out.','Uncle Emeka: You think you can fight family? We shall see.','Obiageli: Mama, you knew about the second will?','Mama: My daughter... sit down. There is something I never told you.','Uncle Emeka: Ehen! So the truth has finally come out!']},
  {title:'Village Girl, City Heart', lines:['Chioma: I left Umuoji with only my bag and my prayers.','Kene: Lagos is not for the weak. Are you sure?','Chioma: I did not come this far to go back.','Kene: Then let me show you the city.','Chioma: Wait... why is your mother looking at me like that?']},
  {title:'Market Wahala', lines:['Iya Bose: Who moved my stall to the drainage side?!','Nnamdi: Madam, it was the chairman, not me.','Chairman: Rules are rules. Pay your levy.','Iya Bose: Levy? I paid you since Monday!','Nnamdi: Chairman, the receipt is here...']}]},
 {id:'hollywood', name:'Hollywood-style action', channel:'Cinema Gold', minutes:90, needs:{fun:26,energy:4}, shows:[
  {title:'Midnight Pursuit', lines:['Agent Cole: They have the drive. We have ten minutes.','Rivera: Then we take the bridge.','Agent Cole: Hold on to something!','Rivera: Was that a helicopter?!','Agent Cole: Not for long.']},
  {title:'Steel Horizon', lines:['Captain Hale: The station is losing power.','Engineer Mbeki: I can reroute it, but someone has to go outside.','Captain Hale: I\'ll go.','Engineer Mbeki: Captain... the storm is coming.','Captain Hale: Then let\'s be quick.']}]},
 {id:'comedy', name:'Comedy skit', channel:'LaughHub', minutes:20, needs:{fun:30,social:4}, shows:[
  {title:'Mama Nkechi and the Generator', lines:['Mama Nkechi: Nkechi! Who used my fuel to iron cloth?','Nkechi: Mummy, it was Daddy!','Daddy: Me? I was sleeping since 2pm!','Mama Nkechi: Sleeping with the iron in your hand?','Daddy: ...the iron was sleeping with me. 😂']},
  {title:'The Danfo Conductor', lines:['Conductor: Upper Iweka! Enter with your change!','Passenger: I have ₦1,000.','Conductor: Who gave you that kind of big money this morning?','Passenger: My change is your problem, oga.','Conductor: Driver, stop! This one wants to buy the bus! 😂']},
  {title:'When Your Mum Says "We Have Food at Home"', lines:['Son: Mummy, can we buy shawarma?','Mum: We have shawarma at home.','Son: ...this is bread and stew.','Mum: Is it not bread? Is it not meat?','Son: The meat is in your imagination ma. 😂']}]},
 {id:'news', name:'News', channel:'OTV News (fictional)', minutes:30, needs:{fun:8}, skill:['charisma',8], shows:[
  {title:'Evening News', lines:['Good evening. Traders at the main market report a busy week ahead of the festive season.','Traffic wardens have been posted at Upper Iweka to ease the evening rush.','Weather: scattered showers expected along the Niger by morning.','Sports: Niger Harbour FC win again at home.','That is the news. Stay with us.']}]},
 {id:'football', name:'Football highlights', channel:'Sports Arena', minutes:40, needs:{fun:24,social:5}, shows:[
  {title:'Niger Harbour FC vs Coal City United', lines:['Kick-off on a bright afternoon.','Harbour press high early on.','GOAL! A low shot into the corner!','The equaliser! Coal City are back in it!','Late winner! What a finish!']}]},
 {id:'music', name:'Music videos', channel:'Afro Hits TV', minutes:30, needs:{fun:22,energy:6}, shows:[
  {title:'Top 10 countdown', lines:['Next up: "Ọkụ" — an original video by the Iweka Crew','Number 7: "Lagos to Onitsha" — Ama J (fictional artist)','Number 4: "Gbese" — The Bridgehead Boys (fictional)','Number 2: "Sunday Piano" — DJ Ọma (fictional)','Number 1 this week: "Niger Breeze"']}]},
 {id:'cartoon', name:'Cartoons', channel:'KidzToon', minutes:25, needs:{fun:20,energy:8}, shows:[
  {title:'Mbe the Tortoise', lines:['Mbe the tortoise wanted to go to the feast in the sky.','He asked every bird for one feather.','"Call me All-of-You," said Mbe.','The birds were not happy when they understood...','And that is why the tortoise shell is cracked!']}]},
];
export const TV_BY_ID = Object.fromEntries(TV_CHANNELS.map(c => [c.id, c]));

export class TVShows {
 constructor(g){this.g=g;this.canvas=document.createElement('canvas');this.canvas.width=512;this.canvas.height=288;this.ctx=this.canvas.getContext('2d');this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  this.material=new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false});this.channel='news';this.show=0;this.t=0;this.watching=null;this.frame=0;}
 /** the programme now on a channel (changes with the game hour, so it isn't always the same show) */
 programme(id=this.channel){const c=TV_BY_ID[id];const h=Math.floor((this.g.clock?.minutes??0)/60)+(this.g.clock?.day??0)*24;return{c,s:c.shows[h%c.shows.length]};}
 setChannel(id){if(TV_BY_ID[id]){this.channel=id;this.t=0;}}
 /** called every frame: draws when a TV is on in the room you are in (or while you watch) */
 update(dt,active){if(!active&&!this.watching)return;this.t+=dt;if((++this.frame)%2)return;this.draw(this.ctx,512,288);this.texture.needsUpdate=true;if(this.watching)this.updateWatch(dt*2);}
 draw(x,w,h){const{c,s}=this.programme(),t=this.t;x.save();
  ({nollywood:drama,hollywood:action,comedy:skit,news,football,music,cartoon})[c.id](x,w,h,t);
  // the caption line and the channel bug
  const lines=s.lines,line=lines[Math.floor(t/5)%lines.length];x.fillStyle='rgba(0,0,0,.55)';x.fillRect(0,h-46,w,46);x.fillStyle='#fff';x.font='600 15px system-ui';x.textAlign='center';x.textBaseline='middle';wrap(x,line,w/2,h-23,w-30,17);
  x.textAlign='left';x.font='800 12px system-ui';x.fillStyle='rgba(255,255,255,.85)';x.fillText(c.channel.toUpperCase(),12,16);x.textAlign='right';x.font='600 11px system-ui';x.fillText(s.title,w-12,16);x.restore();}
 // ------------------------------------------------------------------ watching, big on the screen
 watch(id,{onDone}={}){const g=this.g;this.stop(true);this.setChannel(id);const{c,s}=this.programme(id);const el=document.createElement('div');el.className='tv-watch';el.innerHTML=`<style>.tv-watch{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);padding:16px}.tv-watch .tv-box{width:min(860px,100%);background:#111;border-radius:14px;padding:10px;box-shadow:0 10px 40px #000}.tv-watch canvas{width:100%;aspect-ratio:16/9;border-radius:6px;display:block;background:#000}.tv-watch .tv-bar{display:flex;gap:8px;align-items:center;color:#fff;font:600 14px system-ui;padding:8px 2px 0;flex-wrap:wrap}.tv-watch .tv-bar span{flex:1;min-width:150px}.tv-watch .tv-p{height:4px;background:#333;border-radius:2px;margin-top:8px}.tv-watch .tv-p i{display:block;height:100%;width:0;background:#e9b44c;border-radius:2px}.tv-watch button{font:600 14px system-ui;border:0;border-radius:8px;padding:10px 14px;background:#e9b44c;color:#111;cursor:pointer;min-height:44px}.tv-watch button.ghost{background:#333;color:#fff}</style><div class="tv-box"><canvas width="960" height="540" aria-label="${c.name}: ${s.title}"></canvas><div class="tv-p"><i></i></div><div class="tv-bar"><span>${c.name} · ${s.title} <small style="opacity:.7">(${c.minutes} game min)</small></span><button class="ghost" data-ch>Change channel</button><button data-stop>Stop watching</button></div></div>`;
  document.body.appendChild(el);const big=el.querySelector('canvas'),bx=big.getContext('2d');
  this.watching={id,el,big,bx,elapsed:0,length:22,onDone,startMin:g.clock.minutes,c};
  el.querySelector('[data-stop]').onclick=()=>this.stop(false);el.querySelector('[data-ch]').onclick=()=>{this.stop(false);g.openChoice(()=>g.homes.tvView?.()??null);};
  g.ui.toast(`Watching ${c.name}: ${s.title}`);return true;}
 updateWatch(dt){const w=this.watching;if(!w)return;const g=this.g;w.elapsed+=dt;w.bx.save();w.bx.scale(960/512,540/288);w.bx.drawImage(this.canvas,0,0);w.bx.restore();w.el.querySelector('.tv-p i').style.width=Math.min(100,w.elapsed/w.length*100)+'%';
  const P=g.player?.position;if(P){w.at??={x:P.x,z:P.z};if((Math.hypot(P.x-w.at.x,P.z-w.at.z)>1.2&&(g.player.speed??0)>.5)||!g.homes?.inside){this.stop(false);return;}}
  if(w.elapsed>=w.length)this.finish(1);}
 /** rewards scale with how much of the programme you watched */
 finish(part){const w=this.watching;if(!w)return;const g=this.g,c=w.c;this.watching=null;w.el.remove();const share=Math.max(0,Math.min(1,part));if(share<.15){g.ui.toast('You switched off.');return;}
  g.skipTime(Math.round(c.minutes*share));const adj={};for(const[k,v]of Object.entries(c.needs))adj[k]=Math.round(v*share);g.needs.adjust(adj);if(c.skill)g.skills.add(c.skill[0],Math.round(c.skill[1]*share));
  g.saveGame();g.ui.toast(share>=1?`${c.name} finished. Fun +${adj.fun}.`:`You stopped watching. Fun +${adj.fun}.`);w.onDone?.();}
 stop(silent){const w=this.watching;if(!w)return;if(silent){this.watching=null;w.el.remove();return;}this.finish(w.elapsed/w.length);}
}

function wrap(x,text,cx,cy,maxW,lh){const words=text.split(' '),lines=[];let cur='';for(const wd of words){const t=cur?cur+' '+wd:wd;if(x.measureText(t).width>maxW&&cur){lines.push(cur);cur=wd;}else cur=t;}lines.push(cur);const y0=cy-(lines.length-1)*lh/2;lines.slice(0,2).forEach((l,i)=>x.fillText(l,cx,y0+i*lh));}
/** a simple person: head, body, arms; `talk` opens the mouth; `wrapper` adds a gele (head-tie) */
function person(x,px,py,s,{skin=SKINS[1],cloth='#b3413b',talk=0,gele=null,cap=null,arm=0,face=1}={}){
 x.save();x.translate(px,py);x.scale(s*face,s);x.fillStyle=cloth;x.beginPath();x.moveTo(-22,0);x.quadraticCurveTo(-26,-60,0,-64);x.quadraticCurveTo(26,-60,22,0);x.closePath();x.fill();
 x.strokeStyle=cloth;x.lineWidth=9;x.lineCap='round';x.beginPath();x.moveTo(-18,-52);x.lineTo(-30,-24+arm*-30);x.moveTo(18,-52);x.lineTo(30,-24);x.stroke();
 x.fillStyle=skin;x.beginPath();x.ellipse(0,-80,15,18,0,0,7);x.fill();x.fillStyle='#1a1a1a';x.beginPath();x.ellipse(0,-94,15,8,0,Math.PI,0);x.fill();
 if(gele){x.fillStyle=gele;x.beginPath();x.ellipse(0,-98,22,12,0,0,7);x.fill();x.beginPath();x.ellipse(12,-106,12,8,.6,0,7);x.fill();}
 if(cap){x.fillStyle=cap;x.fillRect(-15,-104,30,10);}
 x.fillStyle='#111';x.beginPath();x.arc(-5,-82,1.8,0,7);x.arc(6,-82,1.8,0,7);x.fill();x.fillStyle='#4a1d1d';x.beginPath();x.ellipse(1,-72,5,1+talk*3,0,0,7);x.fill();x.restore();}
const talking=(t,who)=>Math.floor(t/5)%2===who?Math.abs(Math.sin(t*12)):0;
function drama(x,w,h,t){const g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'#5b3a2a');g.addColorStop(1,'#2b1a12');x.fillStyle=g;x.fillRect(0,0,w,h);
 x.fillStyle='#7a5238';x.fillRect(0,h*.62,w,h*.38);x.fillStyle='#d9b26b';x.fillRect(w*.08,h*.12,w*.18,h*.3);x.fillStyle='#3e2a1c';x.fillRect(w*.1,h*.14,w*.14,h*.26); // a framed photo
 x.fillStyle='#6d2f3a';x.fillRect(w*.66,h*.42,w*.3,h*.22);x.fillStyle='#57242e';x.fillRect(w*.66,h*.36,w*.3,h*.08); // the sofa
 const zoom=1+.05*Math.sin(t*.3);x.save();x.translate(w/2,h*.8);x.scale(zoom,zoom);x.translate(-w/2,-h*.8);
 person(x,w*.36,h*.86,1.15,{skin:SKINS[2],cloth:'#2d6a4f',gele:'#e9b44c',talk:talking(t,0),arm:talking(t,0)?Math.sin(t*3)*.5+.5:0});person(x,w*.62,h*.86,1.2,{skin:SKINS[0],cloth:'#3a3a6e',talk:talking(t,1),face:-1});x.restore();
 x.fillStyle=`rgba(255,200,120,${.08+.05*Math.sin(t)})`;x.fillRect(0,0,w,h);}
function action(x,w,h,t){x.fillStyle='#0b1022';x.fillRect(0,0,w,h);for(let i=0;i<14;i++){const bx=((i*47-t*90)%(w+80)+w+80)%(w+80)-40,bh=60+((i*37)%90);x.fillStyle='#1c2440';x.fillRect(bx,h*.62-bh,38,bh);x.fillStyle='#f2d36b';for(let j=0;j<bh/14;j++)if((i+j)%3)x.fillRect(bx+6+(j%2)*16,h*.62-bh+6+j*14,8,6);}
 x.fillStyle='#2b2b2b';x.fillRect(0,h*.62,w,h*.38);x.fillStyle='#eee';for(let i=0;i<8;i++)x.fillRect(((i*80-t*300)%w+w)%w,h*.78,40,4);
 const cx=w*.42+Math.sin(t*1.3)*20;car(x,cx,h*.74,'#c0392b');car(x,cx-150-30*Math.sin(t*.9),h*.76,'#222');
 const ph=(t%6);if(ph>4.4){const r=(ph-4.4)*90;const gr=x.createRadialGradient(w*.75,h*.55,0,w*.75,h*.55,r);gr.addColorStop(0,'rgba(255,240,180,.95)');gr.addColorStop(.4,'rgba(255,140,40,.8)');gr.addColorStop(1,'rgba(120,20,0,0)');x.fillStyle=gr;x.fillRect(0,0,w,h);}
 x.fillStyle='#000';x.fillRect(0,0,w,22);x.fillRect(0,h-22,w,22);}
function car(x,cx,cy,col){x.fillStyle=col;x.beginPath();x.roundRect(cx-50,cy-22,100,24,6);x.fill();x.beginPath();x.roundRect(cx-28,cy-38,56,18,6);x.fill();x.fillStyle='#9fd3ff';x.fillRect(cx-22,cy-34,20,12);x.fillRect(cx+2,cy-34,20,12);x.fillStyle='#111';x.beginPath();x.arc(cx-30,cy+3,9,0,7);x.arc(cx+30,cy+3,9,0,7);x.fill();x.fillStyle='#ffd';x.fillRect(cx+46,cy-16,6,6);}
function skit(x,w,h,t){x.fillStyle='#f3d9a4';x.fillRect(0,0,w,h);x.fillStyle='#d9b77e';x.fillRect(0,h*.6,w,h*.4);x.fillStyle='#8a5a3c';x.fillRect(w*.72,h*.18,w*.18,h*.42);x.fillStyle='#5b8c5a';x.fillRect(w*.08,h*.2,w*.14,h*.18);
 const jump=Math.floor(t/5)%5===4?Math.abs(Math.sin(t*8))*10:0;person(x,w*.3,h*.86-jump,1.1,{skin:SKINS[3],cloth:'#9b2c6f',gele:'#2e86ab',talk:talking(t,0),arm:talking(t,0)});person(x,w*.6,h*.86,1.05,{skin:SKINS[1],cloth:'#f39c12',talk:talking(t,1),face:-1,cap:'#333'});
 if(Math.floor(t/5)%5===4){x.font='28px system-ui';for(let i=0;i<6;i++){x.globalAlpha=.8;x.fillText('😂',((i*83+t*40)%w),h*.5-((t*50+i*30)%120));}x.globalAlpha=1;x.fillStyle='#c0392b';x.font='900 30px system-ui';x.textAlign='center';x.fillText('HAHAHA!',w/2,h*.2);}}
function news(x,w,h,t){const g=x.createLinearGradient(0,0,w,h);g.addColorStop(0,'#0d2b5c');g.addColorStop(1,'#1b4f9c');x.fillStyle=g;x.fillRect(0,0,w,h);x.strokeStyle='rgba(255,255,255,.08)';for(let i=0;i<10;i++){x.beginPath();x.arc(w*.75,h*.4,20+i*18,0,7);x.stroke();}
 x.fillStyle='#ddd';x.fillRect(w*.55,h*.18,w*.38,h*.36);x.fillStyle='#4a7';x.fillRect(w*.56,h*.2,w*.36,h*.32);x.fillStyle='#e9b44c';x.beginPath();x.arc(w*.7,h*.32,14,0,7);x.fill();
 person(x,w*.28,h*.82,1.25,{skin:SKINS[2],cloth:'#1f2a44',talk:Math.abs(Math.sin(t*10)),gele:null});x.fillStyle='#1d1d1d';x.fillRect(w*.08,h*.66,w*.42,h*.2);
 x.fillStyle='#c0392b';x.fillRect(0,h*.6,120,20);x.fillStyle='#fff';x.font='800 12px system-ui';x.textAlign='left';x.fillText('BREAKING',10,h*.6+14);x.fillStyle='#e9b44c';x.fillRect(120,h*.6,w-120,20);x.save();x.beginPath();x.rect(120,h*.6,w-120,20);x.clip();x.fillStyle='#111';x.fillText('Market prices steady · Power supply improves in Fegge · Niger Harbour FC top the table · ',124+((-t*60)%400),h*.6+14);x.restore();}
function football(x,w,h,t){x.fillStyle='#2e8b3a';x.fillRect(0,0,w,h);for(let i=0;i<8;i++){x.fillStyle=i%2?'#2a8034':'#319640';x.fillRect(i*w/8,0,w/8,h);}x.strokeStyle='rgba(255,255,255,.8)';x.lineWidth=2;x.strokeRect(14,24,w-28,h-80);x.beginPath();x.moveTo(w/2,24);x.lineTo(w/2,h-56);x.stroke();x.beginPath();x.arc(w/2,(h-32)/2,34,0,7);x.stroke();x.strokeRect(w-80,h*.25,66,h*.32);
 const bx=w/2+Math.sin(t*.7)*w*.35,by=(h-32)/2+Math.sin(t*1.3)*60;for(let i=0;i<10;i++){const px=bx+Math.sin(i*2.1+t*.9)*(60+i*9),py=by+Math.cos(i*1.7+t*.8)*(40+i*5);x.fillStyle=i%2?'#e9e9e9':'#c0392b';x.beginPath();x.arc(px,py,6,0,7);x.fill();}
 x.fillStyle='#fff';x.beginPath();x.arc(bx,by,4,0,7);x.fill();const goals=Math.min(3,Math.floor(t/7));x.fillStyle='rgba(0,0,0,.7)';x.fillRect(w-190,30,176,24);x.fillStyle='#fff';x.font='700 13px system-ui';x.textAlign='left';const sc=[[0,0],[1,0],[1,1],[2,1]][goals];x.fillText(`HARBOUR ${sc[0]}  –  ${sc[1]} COAL CITY`,w-182,46);
 if(t%7>5.5){x.fillStyle='#e9b44c';x.font='900 44px system-ui';x.textAlign='center';x.fillText('GOAL!',w/2,h*.4);}}
function music(x,w,h,t){const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,`hsl(${t*30%360},70%,25%)`);g.addColorStop(1,`hsl(${(t*30+140)%360},70%,30%)`);x.fillStyle=g;x.fillRect(0,0,w,h);
 for(let i=0;i<24;i++){const v=.3+.6*Math.abs(Math.sin(t*4+i*.6)*Math.cos(t*1.3+i*.2));x.fillStyle=`hsla(${i*15+t*50},90%,60%,.5)`;x.fillRect(i*w/24+2,h*.62-v*h*.5,w/24-4,v*h*.5);}
 for(let i=0;i<3;i++){const b=Math.abs(Math.sin(t*4.4+i))*8;person(x,w*(.3+i*.2),h*.86-b,1+(i===1?.15:0),{skin:SKINS[i+1],cloth:['#e74c3c','#111','#8e44ad'][i],arm:Math.abs(Math.sin(t*4.4+i)),talk:i===1?Math.abs(Math.sin(t*9)):0});}}
function cartoon(x,w,h,t){x.fillStyle='#8fd3ff';x.fillRect(0,0,w,h);x.fillStyle='#fff';for(let i=0;i<4;i++){const cx=((i*150+t*20)%(w+120))-60;x.beginPath();x.arc(cx,50+i*12,22,0,7);x.arc(cx+24,46+i*12,26,0,7);x.arc(cx+50,52+i*12,20,0,7);x.fill();}
 x.fillStyle='#6ab04c';x.fillRect(0,h*.68,w,h*.32);const tx=((t*40)%(w+100))-50,hop=Math.abs(Math.sin(t*3))*6;x.save();x.translate(tx,h*.74-hop);x.fillStyle='#7a5a2a';x.beginPath();x.ellipse(0,0,40,26,0,Math.PI,0);x.fill();x.strokeStyle='#4b3516';x.lineWidth=2;for(let i=-2;i<=2;i++){x.beginPath();x.moveTo(i*14,0);x.lineTo(i*10,-22);x.stroke();}
 x.fillStyle='#9c8a4a';x.beginPath();x.ellipse(46,-8,13,10,0,0,7);x.fill();x.fillStyle='#000';x.beginPath();x.arc(50,-11,2,0,7);x.fill();x.fillRect(-30,0,10,8);x.fillRect(20,0,10,8);x.restore();
 for(let i=0;i<3;i++){const bx=((i*200-t*60)%(w+80)+w+80)%(w+80)-40,by=70+Math.sin(t*2+i)*20;x.strokeStyle='#333';x.lineWidth=3;x.beginPath();x.moveTo(bx-12,by);x.quadraticCurveTo(bx-6,by-8*Math.sin(t*10+i),bx,by);x.quadraticCurveTo(bx+6,by-8*Math.sin(t*10+i),bx+12,by);x.stroke();}}
