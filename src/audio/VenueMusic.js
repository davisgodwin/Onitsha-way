import {openAt} from '../life/CityLife.js';
import {SaveSystem} from '../save/SaveSystem.js';
/** Bars and homes: three short original Afrobeat-style instrumentals (v0.27). */
export const VENUE_TRACKS=[
 {id:'iweka-afterglow',name:'Iweka Afterglow',bpm:108,genre:'Afrobeat',url:'audio/afrobeat/iweka-afterglow.mp3'},
 {id:'niger-breeze',name:'Niger Breeze',bpm:102,genre:'Afrobeat',url:'audio/afrobeat/niger-breeze.mp3'},
 {id:'market-lights',name:'Market Lights',bpm:114,genre:'Afrobeat',url:'audio/afrobeat/market-lights.mp3'},
];
/** v0.50 nightclubs: two long original DJ mixes (scripts/compose-club-mixes.py), then the bar tracks, then any music
 * you add yourself in public/audio/club/custom/playlist.json (only music you have the rights to). */
export const CLUB_MIXES=[
 {id:'onitsha-nights',name:'Onitsha Nights · Afrobeats DJ mix',bpm:104,genre:'Afrobeats',url:'audio/club/onitsha-nights-afrobeats-mix.mp3',stream:true,minutes:7.7},
 {id:'amapiano-sunday',name:'Amapiano Sunday · mixtape',bpm:113,genre:'Amapiano',url:'audio/club/amapiano-sunday-mixtape.mp3',stream:true,minutes:7.1},
];
/** Original music only: no external streams or artist recordings are bundled.
 * Short tracks are decoded once; the long mixes stream through an <audio> element (far less memory on phones).
 * One source at a time, shared game volume/mute, distance fade for bars, race-safe loads, and an analyser so the
 * club's LED wall can move with the music. */
export class VenueMusic {
 constructor(g){this.g=g;this.buffers=new Map();this.trackIndex=0;this.clubIndex=0;this.token=0;this.source=null;this.venue=null;this.error=null;this.custom=[];document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});this.loadCustom();}
 async loadCustom(){try{const r=await fetch(import.meta.env.BASE_URL+'audio/club/custom/playlist.json',{cache:'no-cache'});if(!r.ok)return;const list=await r.json();this.custom=(Array.isArray(list)?list:list.tracks??[]).filter(t=>t&&typeof t.file==='string'&&/^[\w .()&'-]+\.(mp3|ogg|m4a|wav)$/i.test(t.file)).slice(0,60).map((t,i)=>({id:'custom:'+i,name:String(t.name??t.file).slice(0,80),genre:String(t.genre??'Your music').slice(0,30),bpm:Number(t.bpm)||null,url:'audio/club/custom/'+t.file,stream:true,custom:true}));}catch{this.custom=[];}}
 /** the club playlist: the mixes, the bar tracks, then your own */
 get clubTracks(){return[...CLUB_MIXES,...VENUE_TRACKS,...this.custom];}
 get inClub(){return!!this.g.club?.inside;}
 get playlist(){return this.inClub?this.clubTracks:VENUE_TRACKS;}
 get track(){const list=this.playlist;return list[(this.inClub?this.clubIndex:this.trackIndex)%list.length];}
 audibleVenue(){const g=this.g;if(!g.saveData||['menu','creator','entry','loading','paused','map'].includes(g.state)||document.hidden||g.civic?.inside)return null;
  const home=g.homes?.inside;
  if(home){if(home.host||home.viewing)return null;const speaker=g.homes.decor.records?.find(r=>['speaker','radio'].includes(r.id)&&g.homeUpgrades.applianceRunning(home.home.id,r.id,g.weather?.power.on??true));return speaker?{v:{id:'home:'+home.home.id,name:'Home music'},level:.55}:null;}
  const h=g.clock.minutes/60;
  if(g.club?.inside&&openAt(h,g.club.inside.hours))return {v:g.club.inside,level:.82};
  const p=g.player?.position;if(!p)return null;let found=null;
  for(const v of g.cityLife?.venues??[]) {if(v.kind!=='bar'||!openAt(h,v.hours))continue;const d=Math.hypot(p.x-v.x,p.z-v.z);const level=Math.max(0,1-d/30)**1.25*.65;if(level>(found?.level??.015))found={v,level};}
  return found;
 }
 update(){const g=this.g,ctx=g.audio.ctx,a=this.audibleVenue();
  if((a?.v?.id??null)!==(this.venue?.id??null)&&this.source)this.stop(); // a different place: start again with its playlist
  this.venue=a?.v??null;
  const enabled=g.settings.venueMusicEnabled!==false,volume=g.settings.venueMusicVolume??.65;
  if(!ctx||ctx.state!=='running'||!a||!enabled||volume<=0||g.settings.volume===0){this.stop();return;}
  if(!this.gain){this.gain=ctx.createGain();this.gain.gain.value=0;this.gain.connect(g.audio.master);try{this.analyser=ctx.createAnalyser();this.analyser.fftSize=256;this.analyser.smoothingTimeConstant=.7;this.gain.connect(this.analyser);this.levels=new Uint8Array(this.analyser.frequencyBinCount);}catch{this.analyser=null;}}
  this.gain.gain.setTargetAtTime(a.level*volume,ctx.currentTime,.12);
  if(!this.source&&!this.loading&&!this.error)this.start();
 }
 /** 0..1 levels in `bands` bands (bass first), from what is playing now; null when nothing plays */
 bands(n=16){if(!this.analyser||!this.source)return null;this.analyser.getByteFrequencyData(this.levels);const out=new Array(n).fill(0),L=this.levels.length;for(let i=0;i<n;i++){const a=Math.floor((i/n)**1.6*L),b=Math.max(a+1,Math.floor(((i+1)/n)**1.6*L));let s=0;for(let k=a;k<b;k++)s+=this.levels[k];out[i]=s/(b-a)/255;}return out;}
 advance(){if(this.inClub)this.clubIndex=(this.clubIndex+1)%this.clubTracks.length;else this.trackIndex=(this.trackIndex+1)%VENUE_TRACKS.length;}
 async start(){const ctx=this.g.audio.ctx,track=this.track,token=++this.token;this.loading=true;
  try {
   if(track.stream){
    const el=new Audio();el.crossOrigin='anonymous';el.preload='auto';el.src=import.meta.env.BASE_URL+track.url;
    const node=ctx.createMediaElementSource(el);node.connect(this.gain);
    await new Promise((res,rej)=>{el.oncanplay=res;el.onerror=()=>rej(Error('Music file unavailable'));setTimeout(()=>rej(Error('Music took too long to load')),20000);});
    if(token!==this.token){el.pause();node.disconnect();return;}
    const src={kind:'stream',el,node,stop:()=>{el.pause();el.removeAttribute('src');try{el.load();}catch{}node.disconnect();}};
    el.onended=()=>{if(this.source===src){src.stop();this.source=null;this.advance();}};
    if(track.seek&&el.duration)el.currentTime=Math.min(el.duration-5,track.seek);
    await el.play();this.source=src;this.error=null;return;
   }
   let buffer=this.buffers.get(track.id);
   if(!buffer){const response=await fetch(import.meta.env.BASE_URL+track.url);if(!response.ok)throw Error('Music file unavailable');buffer=await ctx.decodeAudioData(await response.arrayBuffer());this.buffers.set(track.id,buffer);}
   if(token!==this.token)return;
   if(!this.audibleVenue()||this.g.settings.venueMusicEnabled===false)return;
   const node=ctx.createBufferSource();node.buffer=buffer;node.loop=false;node.connect(this.gain);
   const src={kind:'buffer',node,buffer,stop:(when)=>{try{node.stop(when);}catch{}}};
   node.onended=()=>{node.disconnect();if(this.source===src){this.source=null;this.advance();}};node.start();this.source=src;this.error=null;
  }catch(err){if(token===this.token){this.error=err.message;this.g.ui.toast('Music unavailable. Use Retry music at the bar / DJ.');}}
  finally{if(token===this.token)this.loading=false;}
 }
 stop(){if(this.loading){++this.token;this.loading=false;}if(this.source){const old=this.source;this.source=null;if(old.kind==='buffer'){old.node.onended=()=>old.node.disconnect();if(this.gain)this.gain.gain.setTargetAtTime(0,this.g.audio.ctx.currentTime,.035);old.stop(this.g.audio.ctx.currentTime+.14);}else old.stop();}}
 next(){this.stop();this.error=null;this.advance();this.update();}
 /** Play a chosen track now (the DJ takes a request). */
 play(id){const list=this.playlist,i=list.findIndex(t=>t.id===id);if(i<0)return false;this.stop();this.error=null;if(this.inClub)this.clubIndex=i;else this.trackIndex=i;this.update();return true;}
 save(){SaveSystem.saveSettings(this.g.settings);this.update();}
 view(){const g=this.g,club=this.inClub;return{title:(g.homes?.inside?'Home music':club?'Club music':'Venue music')+(club?' · Afrobeats & amapiano':' · Afrobeat-style originals'),text:`${this.error?'Music unavailable — retry below.':this.source?'Now playing: ':this.loading?'Loading: ':'Playlist: '}${this.track.name}${this.track.bpm?` · ${this.track.bpm} BPM`:''}`,note:club?`Original music made for this game: two DJ mixes (Afrobeats and amapiano) and three Afrobeat-style tracks${this.custom.length?`, plus ${this.custom.length} of your own`:''}. No commercial artist recordings are bundled. To add music you have the rights to, see public/audio/club/custom/README.txt.`:'Three original instrumental tracks, bundled for offline play. No commercial artist recordings. Game volume also controls music. Home radios need power and their switch on. Nearby bars fade with distance; clubs play indoors.',options:[
  {label:g.settings.venueMusicEnabled===false?'Enable music':'Mute music',act:()=>{g.settings.venueMusicEnabled=g.settings.venueMusicEnabled===false;this.error=null;this.save();g.openChoice(()=>this.view());}},
  {label:this.error?'Retry music':'Next track',act:()=>{if(this.error){this.error=null;this.update();}else this.next();g.openChoice(()=>this.view());}},
  ...[.3,.65,1].map((v,i)=>({label:['Quiet','Normal','Loud'][i]+` · ${Math.round(v*100)}%`,act:()=>{g.settings.venueMusicVolume=v;this.save();g.openChoice(()=>this.view());}})),
  {label:'Done',ghost:true,act:()=>g.closeChoice()},
 ]};}
}
