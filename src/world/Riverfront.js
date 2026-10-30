import * as THREE from 'three';
import {GeoBuilder} from './GeoBuilder.js';
import {rect,roadConflict} from './StreetLayout.js';

// The bundled OSM water ring is the real river, not a new canal through the city.
export function riverEdgesAt(map,z){const xs=[];for(const w of map.water)for(let i=0;i<w.outer.length;i++){const a=w.outer[i],b=w.outer[(i+1)%w.outer.length];if((a[1]>z)!==(b[1]>z))xs.push(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1]));}return xs.sort((a,b)=>a-b);}
export class Riverfront{
 constructor(world){this.world=world;this.group=new THREE.Group();this.group.name='RiverNigerWaterfront';this.boats=[];this.places=[];this.time=0;
  for(const[id,title,z]of[['niger-waterside','River Niger · Main Market waterfront',-650],['niger-bridge-view','River Niger · Bridgehead boat landing',1130]])this.buildLanding(id,title,z);
  // Moored canoes, small cargo boats and a covered passenger launch are visible from land.
  for(const landing of this.places){for(let i=0;i<6;i++){const z=landing.z+(i-2.5)*14,x=riverEdgesAt(world.map,z).at(-1)-18-(i%3)*13;if(this.onRiver(x,z,5))this.addBoat(x,z,i===4?'launch':i%3===0?'cargo':'canoe',i*.5,i<3);}}
  // A slow passenger launch follows a checked, straight in-water course near the bridge landing.
  const v=this.places[1];if(v){const z=v.z+75,x=riverEdgesAt(world.map,z).at(-1)-85;if(this.onRiver(x,z,24))this.addBoat(x,z,'launch',1.1,false,true);}
 }
 onRiver(x,z,r=2){return [[0,0],[-r,-r],[r,-r],[-r,r],[r,r]].every(([a,b])=>this.world.terrain.isWater(x+a,z+b));}
 buildLanding(id,name,targetZ){const w=this.world;let spot=null;
  for(let radius=0;radius<=180&&!spot;radius+=6)for(const side of[-1,1]){const z=targetZ+radius*side,edge=riverEdgesAt(w.map,z).at(-1);if(!Number.isFinite(edge))continue;
   const x=edge+9,pts=rect(x,z,12,13);if(roadConflict(w.map,pts,.5))continue;
   if(!pts.every(([a,b])=>w.collision.isFree(a,b,1)&&!w.terrain.isWater(a,b))||!w.collision.isFree(x,z,2))continue;
   spot={id,name,label:name,x,z,kind:'waterfront',radius:30,confidence:'approximate',edge,blurb:'River Niger viewing point and boat landing. Scenic boats only; no swimming or boat controls.',source:'Bundled OpenStreetMap shoreline; game landing is approximate.'};break;
  }
  if(!spot)return;this.places.push(spot);w.landmarks.list.push(spot);w.landmarks.byRadius=[...w.landmarks.list].sort((a,b)=>a.radius-b.radius);
  const gb=new GeoBuilder(),C=c=>new THREE.Color(c),box=(ww,h,d,x,y,z,c,solid=false)=>{gb.box(x,z,y-h/2,y+h/2,ww,d,0,C(c));if(solid)w.collision.addPolygon(rect(x,z,ww,d),h);};
  const {x,z,edge}=spot;
  box(12,.09,13,x,.025,z,'#aaa48c');
  // Quayside railing keeps the viewing edge legible without inviting a water teleport.
  for(let dz=-6;dz<=6;dz+=2){box(.12,1.1,.12,x-5.7,.55,z+dz,'#50645f',true);}box(.11,.09,12,x-5.7,1.1,z,'#50645f');
  for(const dz of[-4.3,4.3]){box(1.1,.14,2.4,x+1,.55,z+dz,'#8b6646',true);for(const a of[-.8,.8])box(.14,.52,.13,x+1,.25,z+dz+a,'#4d5b50');box(.12,.6,2.4,x+1.5,.92,z+dz,'#8b6646');}
  // Timber jetty is scenery beyond the water barrier; boats moor beside it.
  for(let a=0;a<18;a+=.48)box(.4,.12,3.4,edge-a,.1,z,'#a68b64');for(const a of[2,8,14])for(const dz of[-1.5,1.5])box(.2,1.7,.2,edge-a,-.38,z+dz,'#78634a');
  const mesh=new THREE.Mesh(gb.build(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.87}));mesh.receiveShadow=true;this.group.add(mesh);
  const cv=document.createElement('canvas');cv.width=1024;cv.height=320;const g=cv.getContext('2d');g.fillStyle='#194d51';g.fillRect(0,0,1024,320);g.textAlign='center';g.fillStyle='#f4e7c5';g.font='bold 78px Arial';g.fillText('RIVER NIGER',512,112);g.font='36px Arial';g.fillText(id==='niger-waterside'?'ONITSHA WATERSIDE':'BRIDGEHEAD · BOAT LANDING',512,186);g.font='29px Arial';g.fillText('Viewing area · Boats on the river',512,252);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;const sign=new THREE.Mesh(new THREE.PlaneGeometry(6,1.88),new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.7}));sign.position.set(x+3.8,2.3,z);sign.rotation.y=Math.PI/2;this.group.add(sign);
 }
 addBoat(x,z,kind,phase,moored=true,moving=false){const root=new THREE.Group(),gb=new GeoBuilder(),C=c=>new THREE.Color(c),launch=kind==='launch',cargo=kind==='cargo',L=launch?10:cargo?8:6.2,W=launch?2.6:cargo?2:1.2,H=launch?.72:.48;
  const ring=[[-W*.18,-L/2],[W*.18,-L/2],[W/2,-L*.32],[W/2,L*.29],[W*.12,L/2],[-W*.12,L/2],[-W/2,L*.29],[-W/2,-L*.32]];
  const color=C(launch?'#d6c9a3':cargo?'#715234':'#8c6744');
  for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];gb.quad([[a[0]*.62,-.27,a[1]*.94],[b[0]*.62,-.27,b[1]*.94],[b[0],H,b[1]],[a[0],H,a[1]]],[[0,0],[1,0],[1,1],[0,1]],[a[0]+b[0],0,a[1]+b[1]],color);gb.beam([a[0],H,a[1]],[b[0],H,b[1]],.08,C(launch?'#395e59':'#57442f'));}
  gb.box(0,0,-.13,-.02,W*.72,L*.72,0,C('#5d503c'));
  for(let i=-2;i<=2;i++)gb.box(0,i*L/7,H-.24,H-.13,W*.88,.22,0,C('#ad8c5d'));
  if(launch){gb.box(0,0,1.85,2.02,W+ .25,L*.62,0,C('#477779'));for(const a of[-W*.43,W*.43])for(const b of[-L*.25,L*.25])gb.box(a,b,H,1.85,.07,.07,0,C('#d9d4bf'));gb.box(0,-L*.34,H,H+.65,1.5,1.3,0,C('#e4d8b8'));gb.box(0,-L*.407,H+.2,H+.57,1.2,.04,0,C('#345863'));}
  if(cargo)for(let i=0;i<9;i++)gb.box((i%3-1)*.4,(Math.floor(i/3)-1)*.65,H-.1,H+.45,.36,.52,0,C(['#bda77b','#a68350','#86724c'][i%3]));
  // A seated silhouette makes these working boats rather than empty props.
  gb.box(0,L*.25,H,H+.55,.32,.3,0,C('#4c6d76'));gb.cylinder(0,L*.25,H+.55,H+.82,.13,C('#624730'),8);gb.beam([W*.4,H+.3,L*.22],[W*1.1,-.05,L*.22+1.2],.055,C('#b59c72'));
  const mesh=new THREE.Mesh(gb.build(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,side:THREE.DoubleSide}));root.add(mesh);root.position.set(x,-.54,z);root.rotation.y=phase;this.group.add(root);this.boats.push({root,x,z,phase,kind,moored,moving});
 }
 update(dt){this.time+=dt;for(const b of this.boats){const t=this.time+b.phase;b.root.position.y=-.54+.045*Math.sin(t*1.2);b.root.rotation.z=.012*Math.sin(t*.8);b.root.rotation.x=.008*Math.cos(t);if(b.moving){const dz=22*Math.sin(t*.025);if(this.onRiver(b.x,b.z+dz,7)){b.root.position.z=b.z+dz;b.root.rotation.y=Math.cos(t*.025)>0?0:Math.PI;}}}}
}
