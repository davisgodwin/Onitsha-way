import * as THREE from 'three';
import {upperIwekaSite} from './RoadsideSites.js';
const TAU=Math.PI*2;
export function prepareMonumentSites(map,landmarks){
 const ring=map.roads.find(r=>String(r.id)==='371153211');if(!ring)throw Error('DMGS roundabout road missing');
 const pts=ring.points.slice(0,-1);const x=pts.reduce((n,p)=>n+p[0],0)/pts.length,z=pts.reduce((n,p)=>n+p[1],0)/pts.length;
 const r=Math.min(...map.segments.filter(s=>s.road===ring).map(s=>{const dx=s.bx-s.ax,dz=s.bz-s.az,t=Math.max(0,Math.min(1,((x-s.ax)*dx+(z-s.az)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-s.ax-dx*t,z-s.az-dz*t)-ring.width/2;}))-.7;
 map.monumentSites={zik:{x,z,r:Math.min(10,r)},upperIweka:upperIwekaSite(map,landmarks.get('upper-iweka'))};
 const l={id:'zik-roundabout',name:'Zik / DMGS Roundabout',kind:'monument',x,z,radius:38,confidence:'osm',source:'OSM ring 371153211; https://commons.wikimedia.org/wiki/File:DMGS_Roundabout.jpg',blurb:'Nnamdi Azikiwe statue beneath five ivory-coloured tusks and a red bead ring. Simplified original game model, based on photographs.'};landmarks.list.push(l);const u=map.monumentSites.upperIweka;landmarks.list.push({id:'upper-iweka-monument',name:'Upper Iweka Gateway Monument',kind:'monument',x:u.x,z:u.z,radius:25,confidence:'fictional',source:'Original game landmark; not a verified real-world monument replica.',blurb:'An original gateway sculpture on a clear island at the Upper Iweka interchange. Game-designed landmark, not a historical replica.'});landmarks.byRadius=[...landmarks.list].sort((a,b)=>a.radius-b.radius);
}
function sign(text,sub,width=4){const c=document.createElement('canvas');c.width=1024;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle='#173d38';ctx.fillRect(0,0,1024,256);ctx.strokeStyle='#c9ac70';ctx.lineWidth=8;ctx.strokeRect(10,10,1004,236);ctx.fillStyle='#f8edce';ctx.textAlign='center';ctx.font='bold 62px Arial';ctx.fillText(text,512,110);ctx.font='32px Arial';ctx.fillText(sub,512,180);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.8}));}
export class CityMonuments{
 constructor(world){this.world=world;this.group=new THREE.Group();this.group.name='OnitshaCityMonuments';this.places=[];this.nightMaterials=[];this.leds=[];this.buildZik();this.buildUpperIweka();this.addLeds();}
 /**
  * v0.39: flashing LED rigs on both roundabout monuments, on from dusk. Small glowing beads (one instanced mesh per
  * monument) follow the island kerb and the sculpture's lines; the gold work already glows at night. The colours cycle
  * through patterns: a running rainbow chase, green-white-green (the flag) blocks, and a slow warm pulse.
  */
 addLeds(){
  const rigs=[];
  if(this.upperIweka){const{r,group:g}=this.upperIweka,pts=[];
   for(let i=0;i<64;i++){const a=i*TAU/64;pts.push([Math.cos(a)*(r-.3),.48,Math.sin(a)*(r-.3)]);}
   for(let i=0;i<3;i++){const a=i*TAU/3+.4,u=Math.cos(a),v=Math.sin(a),c=new THREE.CatmullRomCurve3([new THREE.Vector3(u*3.5,2.2,v*3.5),new THREE.Vector3(u*4.3,6.7,v*4.3),new THREE.Vector3(u*3.1,11.4,v*3.1),new THREE.Vector3(u*.8,15,v*.8)]);for(let j=0;j<=26;j++){const q=c.getPoint(j/26);pts.push([q.x+u*.55,q.y,q.z+v*.55]);}}
   for(let i=0;i<28;i++){const a=i*TAU/28;pts.push([Math.cos(a)*2.5,13.45,Math.sin(a)*2.5]);}
   rigs.push({group:g,pts,lights:[[0,9,0,3.5]],size:.16});}
  if(this.zik){const{r,group:g}=this.zik,S=r/9.7,h=16*S,base=r*.76,top=.62*S,pts=[];
   for(let i=0;i<72;i++){const a=i*TAU/72;pts.push([Math.cos(a)*(r-.15),.42,Math.sin(a)*(r-.15)]);}
   for(let i=0;i<5;i++){const a=i*TAU/5+.25,ux=Math.cos(a),uz=Math.sin(a);for(let j=1;j<=22;j++){const t=j/23,rr=base*(1-t)**2+top*t,R=(1-t)*.84*S+.09*S;pts.push([ux*(rr+R+.06),1.2+h*t,uz*(rr+R+.06)]);}}
   rigs.push({group:g,pts,lights:[[0,6,0,3]],size:.14});}
  for(const rig of rigs){
   const mat=new THREE.MeshBasicMaterial({toneMapped:false}),mesh=new THREE.InstancedMesh(new THREE.SphereGeometry(rig.size,8,6),mat,rig.pts.length),m=new THREE.Matrix4();
   rig.pts.forEach((q,i)=>{m.makeTranslation(q[0],q[1],q[2]);mesh.setMatrixAt(i,m);mesh.setColorAt(i,new THREE.Color('#000'));});mesh.name='Monument-LEDs';mesh.visible=false;mesh.frustumCulled=false;rig.group.add(mesh);
   const flood=[]; // no real-time lights: they would cost every material in the city a light
   this.leds.push({mesh,flood,n:rig.pts.length,heights:rig.pts.map(q=>q[1]),angles:rig.pts.map(q=>Math.atan2(q[2],q[0]))});
  }
 }
 /** Animate the LEDs (called every frame with game time in seconds and the night factor 0–1). */
 updateLights(t,night){
  const on=night>.35,c=this._c??=new THREE.Color();
  for(const L of this.leds){
   L.mesh.visible=on;for(const f of L.flood){f.intensity=on?f.userData.max*(.75+.25*Math.sin(t*1.7)):0;}
   if(!on)continue;
   const mode=Math.floor(t/12)%3;
   for(let i=0;i<L.n;i++){
    if(mode===0)c.setHSL(((L.angles[i]/TAU+L.heights[i]*.03-t*.25)%1+1)%1,1,.55);                    // rainbow chase round and up
    else if(mode===1){const band=Math.floor(L.heights[i]*.7+L.angles[i]*2-t*3);c.set(((band%3)+3)%3===1?'#ffffff':'#00a651');if(Math.floor(t*4)%2&&i%2)c.multiplyScalar(.25);} // flag colours, flashing
    else{const k=.45+.55*Math.max(0,Math.sin(t*2.2-L.heights[i]*.35));c.setRGB(1*k,.72*k,.3*k);}           // warm pulse rising
    L.mesh.setColorAt(i,c);
   }
   L.mesh.instanceColor.needsUpdate=true;
  }
 }
 buildUpperIweka(){
 const w=this.world,{x,z,r}=w.map.monumentSites.upperIweka,g=new THREE.Group();g.name='Upper-Iweka-Gateway-Monument';g.position.set(x,0,z);g.userData={originalGameDesign:true,verifiedReplica:false};this.group.add(g);
 const stone=new THREE.MeshStandardMaterial({color:'#e2d6bc',roughness:.86}),dark=new THREE.MeshStandardMaterial({color:'#293832',roughness:.7}),green=new THREE.MeshStandardMaterial({color:'#225447',roughness:.53,metalness:.3}),gold=new THREE.MeshStandardMaterial({color:'#bd9448',roughness:.35,metalness:.75,emissive:'#e7b765',emissiveIntensity:0}),lawn=new THREE.MeshStandardMaterial({color:'#56764c',roughness:1});
 this.nightMaterials.push({mat:gold,max:.48});
 const mesh=(geo,mat,px=0,py=0,pz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 mesh(new THREE.CylinderGeometry(r,r,.26,48),dark,0,.13);mesh(new THREE.CylinderGeometry(r-.3,r-.3,.18,48),lawn,0,.32);
 for(let i=0;i<48;i++){const a=i*TAU/48,m=mesh(new THREE.BoxGeometry(.82,.28,.24),i%2?dark:stone,Math.cos(a)*(r-.06),.22,Math.sin(a)*(r-.06));m.rotation.y=-a+Math.PI/2;}
 mesh(new THREE.CylinderGeometry(4.4,5.1,.38,36),stone,0,.58);mesh(new THREE.CylinderGeometry(3.8,4.4,.3,36),dark,0,.92);mesh(new THREE.CylinderGeometry(2.7,3.5,1.3,6),stone,0,1.65);
 const S=r/9;
 for(let i=0;i<3;i++){const a=i*TAU/3+.4,u=Math.cos(a),v=Math.sin(a),curve=new THREE.CatmullRomCurve3([new THREE.Vector3(u*3.5,2.2,v*3.5),new THREE.Vector3(u*4.3,6.7,v*4.3),new THREE.Vector3(u*3.1,11.4,v*3.1),new THREE.Vector3(u*.8,15,v*.8)]);const arm=mesh(new THREE.TubeGeometry(curve,40,.5,10,false),i===1?gold:green);arm.name='Gateway-Arc-'+i;}
 const halo=mesh(new THREE.TorusGeometry(2.5,.18,10,48),gold,0,13.2);halo.rotation.x=Math.PI/2;
 mesh(new THREE.IcosahedronGeometry(.9,2),gold,0,15.5);mesh(new THREE.TorusGeometry(.72,.06,6,30),gold,0,2.35).rotation.x=Math.PI/2;
 for(let i=0;i<20;i++){const a=i*TAU/20;mesh(new THREE.IcosahedronGeometry(.4,1),lawn,Math.cos(a)*(r-1.1),.55,Math.sin(a)*(r-1.1));}
 for(const direction of[0,Math.PI]){const plaque=sign('UPPER IWEKA','GATEWAY MONUMENT',3.1);plaque.position.set(Math.sin(direction)*2.9,1.65,Math.cos(direction)*2.9);plaque.rotation.y=direction;g.add(plaque);}
 const label=sign('ORIGINAL GAME LANDMARK','NOT A HISTORICAL REPLICA',2.9);label.position.set(0,.8,4.5);g.add(label);
 if(S!==1)g.scale.set(S,S,S);w.collision.addCircle(x,z,r+.15);
 let view=null;for(let rad=r+6;rad<45&&!view;rad+=2)for(let i=0;i<48;i++){const a=i*TAU/48,px=x+Math.cos(a)*rad,pz=z+Math.sin(a)*rad;if(!w.map.onCarriageway(px,pz,1)&&!w.terrain.isWater(px,pz)&&w.collision.isFree(px,pz,.65)){view={x:px,z:pz};break;}}
 if(!view)throw Error('No safe Upper Iweka viewpoint');this.places.push({id:'upper-iweka-monument-view',...view,name:'Upper Iweka Gateway Monument',kind:'monument',label:'Upper Iweka Gateway Monument · original game landmark'});
 this.upperIweka={x,z,r,group:g,view,originalGameDesign:true};
 }
 buildZik(){const w=this.world,{x,z,r}=w.map.monumentSites.zik,g=new THREE.Group();g.name='Zik-DMGS-Roundabout';g.position.set(x,0,z);this.group.add(g);
 const mats={ivory:new THREE.MeshStandardMaterial({color:'#e9e1cb',roughness:.8}),dark:new THREE.MeshStandardMaterial({color:'#353635',roughness:.86}),red:new THREE.MeshStandardMaterial({color:'#742b27',roughness:.7}),green:new THREE.MeshStandardMaterial({color:'#467245',roughness:1}),bronze:new THREE.MeshStandardMaterial({color:'#423e2f',roughness:.6,metalness:.5}),stone:new THREE.MeshStandardMaterial({color:'#93958f',roughness:.9})};
 const mesh=(geo,mat,px=0,py=0,pz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(px,py,pz);m.castShadow=true;m.receiveShadow=true;g.add(m);return m;};
 mesh(new THREE.CylinderGeometry(r,r,.25,64),mats.dark,0,.1);mesh(new THREE.CylinderGeometry(r-.3,r-.3,.18,64),mats.green,0,.26);
 // Alternating curb stones stay entirely within the existing OSM traffic island.
 for(let i=0;i<48;i++){const geo=new THREE.CylinderGeometry(r+.05,r+.05,.28,1,1,false,i*TAU/48,TAU/48*.98);mesh(geo,new THREE.MeshStandardMaterial({color:i%2?'#292b2a':'#d7b34d',roughness:.85}),0,.2);}
 const S=r/9.7;const h=16*S,base=r*.76,top=.62*S;
 for(let i=0;i<5;i++){const a=i*TAU/5+.25;const ux=Math.cos(a),uz=Math.sin(a),segments=32,radial=10,pos=[],idx=[];
  for(let j=0;j<=segments;j++){const t=j/segments,rr=base*(1-t)**2+top*t,yy=1.2+h*t,R=(1-t)*.84*S+.09*S;for(let k=0;k<=radial;k++){const ang=k/radial*TAU;pos.push(ux*rr+Math.cos(ang)*R,yy,uz*rr+Math.sin(ang)*R);}}
  for(let j=0;j<segments;j++)for(let k=0;k<radial;k++){const a=j*(radial+1)+k,b=a+radial+1;idx.push(a,b,a+1,a+1,b,b+1);}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setIndex(idx);geo.computeVertexNormals();const tusk=mesh(geo,mats.ivory);tusk.name='IvoryTusk'+i;mesh(new THREE.CylinderGeometry(.85*S,1*S,.9,10),mats.dark,ux*base,.75,uz*base);
 }
 // Segmented coral bead ring binding the five tusks, as in the reference.
 const ringR=base*.16+top*.6+.65*S;for(let i=0;i<28;i++){const a=i*TAU/28,geo=new THREE.CylinderGeometry(.21*S,.21*S,ringR*TAU/28*.94,10);const m=mesh(geo,mats.red,Math.cos(a)*ringR,1.2+h*.6,Math.sin(a)*ringR);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(-Math.sin(a),0,Math.cos(a)));}
 mesh(new THREE.CylinderGeometry(1.25,1.85,2.1,4),mats.stone,0,1.4,0);mesh(new THREE.BoxGeometry(2.05,.22,2.05),mats.dark,0,2.56,0);
 // Original bronze figure in long ceremonial robes; not a claim of an exact statue scan.
 mesh(new THREE.CylinderGeometry(.43,.66,1.65,12),mats.bronze,0,3.65,0);mesh(new THREE.SphereGeometry(.3,12,10),mats.bronze,0,4.76,0);mesh(new THREE.CylinderGeometry(.31,.31,.16,12),mats.bronze,0,4.98,0);for(const side of[-1,1]){mesh(new THREE.CapsuleGeometry(.12,.8,3,8),mats.bronze,side*.43,3.94,.04);mesh(new THREE.BoxGeometry(.24,.25,.43),mats.bronze,side*.22,2.85,.08);}const staff=mesh(new THREE.CylinderGeometry(.035,.035,2.05,8),mats.bronze,-.57,3.9,.21);
 const plaque=sign('NNAMDI AZIKIWE','ZIK OF AFRICA',2);plaque.position.set(0,1.55,1.1);g.add(plaque);
 for(let i=0;i<24;i++){const a=i*TAU/24,px=Math.cos(a)*(r-.55),pz=Math.sin(a)*(r-.55);mesh(new THREE.CylinderGeometry(.095,.12,.85,8),mats.stone,px,.75,pz);mesh(new THREE.SphereGeometry(.15,8,6),mats.ivory,px,1.23,pz);}
 const railMat=new THREE.MeshStandardMaterial({color:'#b18b38',roughness:.7});const railing=mesh(new THREE.TorusGeometry(r-.55,.045,6,80),railMat,0,.88,0);railing.rotation.x=Math.PI/2;
 for(let i=0;i<56;i++){const a=i*TAU/56,hedge=mesh(new THREE.IcosahedronGeometry(.48,1),mats.green,Math.cos(a)*(r-1.2),.55,Math.sin(a)*(r-1.2));hedge.scale.set(1,.65,1);}
 w.collision.addCircle(x,z,r+.1);
 // A footpath-side viewpoint, not a waypoint in the monument or moving traffic.
 let view=null;for(let radius=27;radius<60&&!view;radius+=3)for(let i=0;i<60;i++){const a=i*TAU/60,px=x+Math.cos(a)*radius,pz=z+Math.sin(a)*radius;if(!w.map.onCarriageway(px,pz,1)&&!w.terrain.isWater(px,pz)&&w.collision.isFree(px,pz,.65)){view={x:px,z:pz};break;}}
 if(!view)throw Error('No safe Zik viewpoint');this.places.push({id:'zik-roundabout-view',...view,name:'Zik / DMGS Roundabout',kind:'monument',label:'Zik / DMGS Roundabout'});
 this.zik={x,z,r,group:g,tusks:5,view};
 }
}
