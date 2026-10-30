import * as THREE from 'three';
/** Two traffic-managed patrol vehicles. They obey the same lanes, collision gaps and junction rules. */
export class PolicePatrols{
 constructor(g){this.g=g;this.group=new THREE.Group();this.group.name='PolicePatrols';g.renderer.scene.add(this.group);this.cars=Array.from({length:2},()=>this.build());this.time=0;}
 build(){const group=new THREE.Group(),black=new THREE.MeshStandardMaterial({color:'#13212b'}),red=new THREE.MeshBasicMaterial({color:'#ff253b'}),blue=new THREE.MeshBasicMaterial({color:'#258aff'});const box=(w,h,d,x,y,z,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);group.add(m);return m;};box(1.5,.1,.35,0,1.8,.35,black);const lamps=[box(.6,.17,.3,-.4,1.93,.35,red),box(.6,.17,.3,.4,1.93,.35,blue)];
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#152f4a';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff';ctx.font='bold 88px Arial';ctx.textAlign='center';ctx.fillText('POLICE',256,96);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});for(const side of[-1,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(1.45,.36),mat);m.position.set(side*1.02,1.2,-.1);m.rotation.y=side*Math.PI/2;group.add(m);}this.group.add(group);return{group,lamps};
 }
 update(dt){const g=this.g;this.time+=dt;const patrols=g.traffic.near?.filter(v=>v.police)??[];let nearest=Infinity;
 this.cars.forEach((p,i)=>{const v=patrols[i];p.group.visible=!!v;if(!v)return;p.group.position.set(v.x,(v.y??0),v.z);p.group.rotation.set(0,v.yaw,0);const phase=Math.floor(this.time*8)%2;p.lamps[0].visible=phase===0;p.lamps[1].visible=phase===1;nearest=Math.min(nearest,Math.hypot(v.x-g.player.position.x,v.z-g.player.position.z));});
 this.siren(nearest,g.state==='playing'&&!document.hidden&&!g.homes?.inside&&!g.club?.inside);
 }
 siren(distance,live){const a=this.g.audio;if(!a?.ctx)return;if(!this.sound){const ctx=a.ctx,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';gain.gain.value=0;osc.connect(gain).connect(a.master);osc.start();this.sound={osc,gain};}const ctx=a.ctx,t=ctx.currentTime;this.sound.osc.frequency.setTargetAtTime(780+300*Math.sin(this.time*5),t,.06);this.sound.gain.gain.setTargetAtTime(live&&distance<110?.1*(1-distance/110)**2:0,t,.15);}
 mute(){if(this.sound)this.sound.gain.gain.setTargetAtTime(0,this.g.audio.ctx.currentTime,.05);}
}
