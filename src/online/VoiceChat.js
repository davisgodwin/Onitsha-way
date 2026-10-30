/** Local WebRTC mesh. Audio never goes through the game server; it only relays SDP/ICE. */
export class VoiceChat {
 constructor(online){this.o=online;this.mode='off';this.stream=null;this.peers=new Map();this.muted=new Set();this.deaf=false;this.held=false;this.openMic=false;
  window.addEventListener('keydown',e=>{if(e.code==='KeyV'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){this.hold(true);}});
  window.addEventListener('keyup',e=>{if(e.code==='KeyV')this.hold(false);});window.addEventListener('blur',()=>this.hold(false));document.addEventListener('visibilitychange',()=>this.hold(false));
 }
 async enable(mode){
  if(mode==='off'){this.stop();return;}
  if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('Voice needs microphone support on localhost or HTTPS. A plain HTTP LAN address cannot use the microphone.');
  if(!this.stream)this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  this.mode=mode;this.hold(false);for(const id of [...this.peers.keys()])this.remove(id);this.o.sendPresence();
 }
 hold(value){this.held=!!value;for(const t of this.stream?.getAudioTracks()||[])t.enabled=this.mode!=='off'&&(this.openMic||this.held)&&!document.hidden;this.o.updateDock();}
 stop(){this.mode='off';this.held=false;this.openMic=false;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;for(const id of [...this.peers.keys()])this.remove(id);this.o.updateDock();}
 remove(id){const p=this.peers.get(id);if(p){p.pc.onicecandidate=null;p.pc.ontrack=null;p.pc.close();p.audio.remove();this.peers.delete(id);}}
 eligible(p){const o=this.o,a=o.presence();return this.mode!=='off'&&p.voice===this.mode&&!o.data?.blocks?.includes(p.id)&&((this.mode==='team'&&o.data?.team?.members.includes(p.id))||(this.mode==='nearby'&&p.scene===a.scene&&Math.hypot(p.x-a.x,p.z-a.z)<60));}
 async peer(id){
  if(this.peers.has(id))return this.peers.get(id);if(!this.stream)return null;
  const pc=new RTCPeerConnection({iceServers:location.hostname==='localhost'||/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname)?[]:[{urls:'stun:stun.l.google.com:19302'}]}) /* v0.54: on the internet, a public STUN server helps two players connect */;const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.hidden=true;document.body.append(audio);const p={pc,audio,queue:[]};this.peers.set(id,p);
  this.stream.getTracks().forEach(t=>pc.addTrack(t,this.stream));pc.onicecandidate=e=>{if(e.candidate)this.o.send({type:'signal',target:id,data:{candidate:e.candidate}});};pc.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>this.o.notice('Tap the 🎙 Voice button to hear players.'));};return p;
 }
 async signal(from,data){try{const remote=this.o.players.find(p=>p.id===from);if(!remote||!this.eligible(remote))return;const p=await this.peer(from);if(!p)return;
  if(data.description){await p.pc.setRemoteDescription(data.description);for(const c of p.queue)await p.pc.addIceCandidate(c);p.queue=[];if(data.description.type==='offer'){await p.pc.setLocalDescription(await p.pc.createAnswer());this.o.send({type:'signal',target:from,data:{description:p.pc.localDescription}});}}
  else if(data.candidate){if(p.pc.remoteDescription)await p.pc.addIceCandidate(data.candidate);else p.queue.push(data.candidate);}
 }catch(e){this.o.notice(`Voice connection: ${e.message}`);this.remove(from);}}
 update(){const ids=new Set();for(const remote of this.o.players){if(!this.eligible(remote))continue;ids.add(remote.id);if(!this.peers.has(remote.id)&&this.o.me.id<remote.id&&this.stream){this.peer(remote.id).then(async p=>{if(!p||p.pc.signalingState==='closed')return;await p.pc.setLocalDescription(await p.pc.createOffer());this.o.send({type:'signal',target:remote.id,data:{description:p.pc.localDescription}});}).catch(()=>this.remove(remote.id));}const p=this.peers.get(remote.id);if(p){const a=this.o.presence();p.audio.muted=this.deaf||this.muted.has(remote.id);p.audio.volume=this.mode==='team'?1:Math.max(0,1-Math.hypot(remote.x-a.x,remote.z-a.z)/60);}}
  for(const id of [...this.peers.keys()])if(!ids.has(id))this.remove(id);
 }
}
