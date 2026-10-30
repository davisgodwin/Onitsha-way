/** Single media element, no proxy, recording, Web Audio cross-origin routing or automatic retry loop. */
export const clamp01=(v,fallback=0)=>Number.isFinite(Number(v))?Math.max(0,Math.min(1,Number(v))):fallback;
export function radioPreferences(value={},stations=[]){if(!value||typeof value!=='object')value={};return{station:stations.some(s=>s.id===value.station)?value.station:stations[0]?.id,volume:clamp01(value.volume,.55),enabled:value.enabled!==false,consent:value.consent===true};}
export function validStream(url){try{return new URL(url).protocol==='https:';}catch{return false;}}
export class RadioEngine{
 constructor({stations,preferences,createAudio=()=>new Audio(),save=()=>{},onChange=()=>{},setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}){this.stations=stations;this.pref=radioPreferences(preferences,stations);this.createAudio=createAudio;this.save=save;this.onChange=onChange;this.setTimer=setTimer;this.clearTimer=clearTimer;this.env={vehicle:null,allowed:false,visible:true,online:true,master:.7,duck:1,voice:false};this.code='parked';this.detail='Enter your own vehicle to use the radio.';this.generation=0;this.audio=null;this.level=0;}
 get station(){return this.stations.find(s=>s.id===this.pref.station)||this.stations[0];}
 get permitted(){return !!this.env.vehicle&&this.env.allowed&&this.env.visible&&this.env.online&&this.pref.enabled&&this.pref.consent;}
 state(code,detail){if(this.code===code&&this.detail===detail)return;this.code=code;this.detail=detail;this.onChange(this);}
 persist(){this.save({...this.pref});this.onChange(this);}
 release(){++this.generation;this.clearTimer(this.timer);this.timer=null;const a=this.audio;this.audio=null;this.level=0;if(a){for(const e of ['playing','waiting','stalled','error','ended'])a['on'+e]=null;a.pause();a.removeAttribute('src');a.load();}}
 setEnvironment(next){const was=this.permitted,vehicle=this.env.vehicle;Object.assign(this.env,next);const active=this.permitted;
  if(!active){if(this.audio)this.release();const [code,detail]=!this.env.vehicle||!this.env.allowed?['parked','Radio stops when you leave your vehicle.']:!this.env.visible?['suspended','Radio paused while the game is in the background.']:!this.env.online?['offline','No internet. Reconnect, then retry.']:!this.pref.enabled?['off','Radio switched off.']:['consent','Live radio uses internet data and connects to the station provider.'];this.state(code,detail);}
  else if(!was||vehicle!==this.env.vehicle)this.start();
  this.applyVolume(0,true);
 }
 setStation(id){if(!this.stations.some(s=>s.id===id))return;this.pref.station=id;this.persist();this.release();if(this.permitted)this.start();else this.setEnvironment({});}
 step(direction){const i=this.stations.findIndex(s=>s.id===this.pref.station);this.setStation(this.stations[(i+direction+this.stations.length)%this.stations.length].id);}
 setVolume(value){this.pref.volume=clamp01(value,.55);this.persist();this.applyVolume(0,true);}
 setEnabled(value){this.pref.enabled=!!value;this.persist();this.release();if(this.permitted)this.start();else this.setEnvironment({});}
 enable(){this.pref.consent=true;this.pref.enabled=true;this.persist();if(this.permitted)this.start();else this.setEnvironment({});}
 start(){this.release();if(!this.permitted)return;const s=this.station;if(!s||!validStream(s.url)){this.state('unavailable','No verified direct stream configured for this station. Choose another station.');return;}
  const a=this.createAudio(),version=this.generation;this.audio=a;a.preload='none';a.setAttribute('playsinline','');a.volume=0;a.muted=clamp01(this.env.master)===0;this.level=0;
  const current=()=>this.audio===a&&version===this.generation&&this.permitted;
  const fail=(code,detail)=>{if(!current())return;this.release();this.state(code,detail);};
  const watch=()=>{this.clearTimer(this.timer);this.timer=this.setTimer(()=>fail('error','Station did not respond. Retry or choose another station.'),15000);};
  a.onplaying=()=>{if(!current())return;this.clearTimer(this.timer);this.state('playing','Live internet broadcast');};
  a.onwaiting=a.onstalled=()=>{if(!current())return;this.state('buffering','Buffering station…');watch();};
  a.onerror=()=>fail('error','Station unavailable or blocked. Retry or choose another station.');
  a.onended=()=>fail('error','Broadcast ended. Retry to reconnect.');
  a.src=s.url;this.state('connecting','Connecting to station…');watch();
  try{Promise.resolve(a.play()).catch(e=>fail(e?.name==='NotAllowedError'?'blocked':'error',e?.name==='NotAllowedError'?'Tap Play radio to allow audio on this browser.':'Station unavailable or unsupported. Retry or change station.'));}catch(e){fail('error','Unable to start this station. Retry or change station.');}
 }
 retry(){if(!this.pref.consent||!this.pref.enabled)this.enable();else this.start();}
 applyVolume(dt=0,immediate=false){const a=this.audio;if(!a)return;const target=this.permitted?clamp01(this.pref.volume)*clamp01(this.env.master,.7)*clamp01(this.env.duck,1)*(this.env.voice?.22:1):0;this.level=immediate?Math.min(this.level,target):this.level+(target-this.level)*Math.min(1,Math.max(0,dt)*7);a.muted=clamp01(this.env.master)===0||this.pref.volume===0;try{a.volume=clamp01(this.level);}catch{/* some mobile browsers use hardware volume */}}
 tick(dt){this.applyVolume(dt);}
 destroy(){this.release();this.env.vehicle=null;this.state('parked','Radio stopped.');}
}
