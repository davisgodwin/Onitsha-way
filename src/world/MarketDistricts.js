import * as THREE from 'three';
import {GeoBuilder} from './GeoBuilder.js';
import {rect,roadConflict} from './StreetLayout.js';
import {mulberry32,hashString} from '../core/utils.js';

const GOODS=['TOMATOES & PEPPERS','RICE • BEANS • GARRI','ANKARA & TEXTILES','SHOES & BAGS','PHONES & ACCESSORIES','HOUSEHOLD GOODS','FRESH FRUIT','SPARE PARTS'];
const PAINT=['#aa5a3c','#b49550','#436d67','#526680','#79556e','#4c7159','#b5a488','#995a43'];
const STORES=['MAMA NGOZI • FOODSTUFFS','CHUKWU & SONS • WHOLESALE','AMAKA TEXTILES','OBINNA FOOTWEAR','CHIDI COMMUNICATIONS','IFEANYI GENERAL STORES','ADA FRUIT & PROVISIONS','EMEKA MOTOR PARTS'];
function labelAtlas(){const cv=document.createElement('canvas');cv.width=1024;cv.height=1024;const g=cv.getContext('2d');for(let i=0;i<8;i++){g.fillStyle=['#e4d6b5','#2b4d42','#273f58','#7d3c2c'][i%4];g.fillRect(0,i*128,1024,128);g.fillStyle=i%4===0?'#433d32':'#fff2d6';g.font='bold 42px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(STORES[i],512,i*128+41,970);g.font='28px Arial';g.fillText(GOODS[i]+'  •  RETAIL & WHOLESALE',512,i*128+92,970);}const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t;}
const NOOP=new Proxy({},{get:()=>()=>0}); // v0.54.3: a builder that draws nothing (walls only at load)
export class MarketDistricts{
 constructor(world){this.world=world;this.group=new THREE.Group();this.group.name='MarketDistricts';this.stalls=[];this.districts=[];this.time=0;
 const tex=labelAtlas();this.signMaterial=new THREE.MeshStandardMaterial({map:tex,roughness:.8,emissiveMap:tex,emissive:'#ffffff',emissiveIntensity:.18});
 for(const lm of world.landmarks.list.filter(l=>['market','bridgehead'].includes(l.kind)))this.build(lm);
 this.stats={districts:this.districts.length,stalls:this.stalls.length};console.info('[Market districts]',this.stats);
 }
 build(lm){const {map,collision,terrain}=this.world,rng=mulberry32(hashString(lm.id)+220),root=new THREE.Group();root.name='market:'+lm.id;this.group.add(root);const batches=new Map(),spots=[];const batch=(x,z)=>{const key=Math.floor(x/50)+','+Math.floor(z/50);if(!batches.has(key))batches.set(key,{stalls:[],x:(Math.floor(x/50)+.5)*50,z:(Math.floor(z/50)+.5)*50});return batches.get(key);};
 const add=(x,z,yaw)=>{
  if(spots.length>=(lm.id==='ochanja'?180:420)||Math.hypot(x-lm.x,z-lm.z)>lm.radius||spots.some(s=>Math.hypot(s.x-x,s.z-z)<5.1)||this.stalls.some(s=>Math.hypot(s.x-x,s.z-z)<5.1))return;
  const pts=[[-2.7,-2.65],[2.7,-2.65],[2.7,3.45],[-2.7,3.45]].map(([a,b])=>[x+Math.cos(yaw)*a+Math.sin(yaw)*b,z-Math.sin(yaw)*a+Math.cos(yaw)*b]);if(roadConflict(map,pts,1.4))return;
  for(let a=-2.7;a<=2.75;a+=1.125)for(let b=-2.65;b<=3.5;b+=1.2){const px=x+Math.cos(yaw)*a+Math.sin(yaw)*b,pz=z-Math.sin(yaw)*a+Math.cos(yaw)*b;if(!collision.isFree(px,pz,.35)||terrain.isWater(px,pz))return;}
  const s={id:`market22:${lm.id}:${spots.length}`,x,z,yaw,variant:spots.length%8,lm:lm.id};spots.push(s);this.stalls.push(s);const b=batch(x,z);b.stalls.push(s);this.stall(NOOP,NOOP,s,rng); // v0.54.3: walls now, shapes later (when you get near)
 };
 // Parallel shop rows follow each street. The front faces the carriageway;
 // a generous pedestrian strip stays between the canopy and the road.
 for(const r of map.roads){if(r.elevated||['trunk','trunk_link','construction','steps','path','footway'].includes(r.type))continue;
 for(let i=0;i<r.points.length-1;i++){const a=r.points[i],b=r.points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<5)continue;const ux=dx/L,uz=dz/L;
 for(let t=3;t<L-1;t+=5.4)for(const side of[-1,1]){const off=r.width/2+5.6,x=a[0]+ux*t-uz*side*off,z=a[1]+uz*t+ux*side*off;add(x,z,Math.atan2(uz*side,-ux*side));}
 }}
 // No scattered infill sheds: every shop opens onto an actual street.
 const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.86,side:THREE.DoubleSide});this.material??=material;const chunks=[];for(const b of batches.values()){const chunk=new THREE.Group();chunk.name='market-chunk';root.add(chunk);chunks.push({root:chunk,x:b.x,z:b.z,stalls:b.stalls,built:false});}
 this.districts.push({id:lm.id,root,stalls:spots,x:lm.x,z:lm.z,radius:lm.radius,chunks});lm.marketStalls=spots.length;
 }
 stall(gb,sg,s,rng){const {x,z,yaw,variant:k}=s,c=Math.cos(yaw),sn=Math.sin(yaw),P=(a,b)=>[x+c*a+sn*b,z-sn*a+c*b],C=color=>new THREE.Color(color),col=PAINT[k];
 const box=(w,h,d,a,y,b,color,solid=false)=>{const[px,pz]=P(a,b);gb.box(px,pz,y-h/2,y+h/2,w,d,yaw,C(color));if(solid&&!this.noCollide)this.world.collision.addPolygon(rect(px,pz,w,d,yaw),h);};
 // Attached, deep-shaded lock-up shop bays with concrete trading floors above.
 // This replaces the repeating freestanding garden-shed silhouette of v22.
 const block=Math.abs(Math.floor((x*c-z*sn)/23)),upper=s.lm==='main-market'?1+block%3:(s.lm==='ochanja'?1:block%2+1),wall=['#d9cdb1','#c2cec7','#bfc9c5','#d0bbac'][block%4];
 box(5.2,.14,4.7,0,.035,-.25,'#b9b1a0');box(5.2,3.35,.18,0,1.65,-2.25,wall,true);
 for(const a of[-2.52,2.52])box(.18,3.35,4.5,a,1.65,-.1,wall,true);
 box(4.8,2.8,.08,0,1.45,-2.13,'#34362f'); // deep shop shade, not a shuttered solid front
 for(let floor=0;floor<upper;floor++){
  const y=3.5+floor*3.15;
  box(5.35,.22,5,0,y,-.15,'#c2b99f');box(5.2,2.95,4.45,0,y+1.5,-.4,wall);
  for(const a of[-1.65,0,1.65]){box(1.24,1.85,.07,a,y+1.42,1.86,(block+floor)%3===0?'#45696d':'#68776b');box(1.3,.12,.18,a,y+.47,1.92,'#ddd0b1');box(.065,1.8,.1,a,y+1.42,1.93,'#a6b4a4');box(1.24,.065,.1,a,y+1.42,1.94,'#a6b4a4');}
  box(5.35,.16,.72,0,y,2.05,'#bab49e');box(5.35,.1,.1,0,y+.92,2.36,'#5c6862');for(let a=-2.5;a<=2.5;a+=.7)box(.05,.88,.05,a,y+.46,2.36,'#6a746a');
 }
 const top=3.5+upper*3.15;box(5.4,.18,5,0,top,-.15,'#8e9189');box(5.35,.4,.14,0,top+.2,2.22,'#b3ae9b');
 box(4.98,.68,.12,0,2.97,2.15,col);
 // Varied sloping tarpaulin canopies; no identical striped toy-shop roofs.
 const canopy=['#69776a','#877765','#687380','#9a7862','#59786e'][s.variant%5];
 const A=P(-2.46,.55),B=P(2.46,.55),D=P(-2.46,2.32),E=P(2.46,2.32);
 gb.quad([[A[0],2.85,A[1]],[B[0],2.85,B[1]],[E[0],2.38,E[1]],[D[0],2.38,D[1]]],[[0,0],[1,0],[1,1],[0,1]],[sn*.3,.9,c*.3],C(canopy));
 box(4.9,.18,.06,0,2.32,2.32,canopy);
 for(const a of[-2.4,2.4])box(.055,2.4,.055,a,1.2,2.3,'#63675b',true);
 box(3.6,.12,.8,0,.83,.65,'#846341',true);for(const a of[-1.6,1.6])box(.12,.78,.6,a,.4,.65,'#5b4633');
 // Umbrellas and pavement baskets punctuate food sections, leaving the aisle open.
 if(k===0||k===6){const[ux,uz]=P(1.3,2.32);gb.cylinder(ux,uz,0,2.88,.035,C('#5b5c52'),6);for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2;gb.tri([ux,3.02,uz],[ux+Math.cos(a)*1.08,2.68,uz+Math.sin(a)*1.08],[ux+Math.cos(b)*1.08,2.68,uz+Math.sin(b)*1.08],[.5,.5],[0,0],[1,0],[0,1,0],C(i%2?'#c0a678':'#6c8d7d'));}}
 // Shelves on rear wall, crates and sacks under and beside the counter.
 for(const y of[.55,1.4,2.1])box(3.5,.09,.4,0,y,-1.35,'#775538');
 for(const a of[-1.35,1.35]){box(.55,.5,.5,a,.25,1.05,'#ad7c48',true);for(let q=-.2;q<=.2;q+=.2)box(.04,.5,.52,a+q,.25,1.05,'#67452e');}
 for(let i=0;i<12;i++){const a=-1.4+(i%6)*.55,b=i<6?.55:-1.2,y=i<6?1.05:1.62;
  if([0,6].includes(k)){const[px,pz]=P(a,b);gb.cylinder(px,pz,y-.08,y+.05,.2,C('#454f35'),8);for(let j=0;j<4;j++){const[fx,fz]=P(a+(j%2-.5)*.17,b+(Math.floor(j/2)-.5)*.16);gb.cylinder(fx,fz,y+.05,y+.2,.085,C(k===0?(i%2?'#b82e25':'#d75424'):['#e4b338','#67a143','#df7e28'][i%3]),6);}}
  else if(k===1){const[px,pz]=P(a,b);gb.cylinder(px,pz,y-.08,y+.33,.19,C(['#d6c9a0','#e2c67a','#b19362'][i%3]),9);gb.cylinder(px,pz,y+.33,y+.36,.16,C('#eee0b0'),9);}
  else if(k===2){box(.43,.16,.4,a,y,b,['#c85a45','#427e93','#d1ac3b','#805495'][i%4]);box(.43,.025,.4,a,y+.1,b,'#f3dca1');}
  else if(k===3){box(.28,.16,.48,a,y,b,['#41382f','#bd7d4a','#d8c6b3'][i%3]);box(.2,.15,.2,a,y+.12,b-.1,'#4c382e');}
  else{box(.32,.22,.25,a,y,b,['#e6dfbf','#567c88','#342f32','#c4503c'][i%4]);box(.2,.1,.02,a,y+.01,b+.135,'#d9e7dd');}
 }
 // Garment rails and a display mannequin distinguish the textile / fashion lanes.
 if(k===2||k===3){for(let i=0;i<5;i++){const a=-1.75+i*.65,color=PAINT[(i+3)%8];box(.46,.68,.06,a,1.7,-.9,color);box(.78,.21,.06,a,1.95,-.9,color);}const a=1.7,b=1.15;box(.42,.68,.22,a,1.05,b,k===2?'#ac4f49':'#45666d');box(.63,.16,.22,a,1.33,b,k===2?'#ac4f49':'#45666d');for(const q of[-.12,.12])box(.12,.58,.14,a+q,.42,b,'#82745b');const[hx,hz]=P(a,b);gb.cylinder(hx,hz,1.43,1.7,.12,C('#bda98e'),8);}
 // Hanging textiles / bags clearly distinguish a fabric or fashion trader.
 if(k===2||k===3)for(let a=-1.3;a<=1.4;a+=.65)box(.48,.8,.06,a,1.86,-1.12,PAINT[(Math.round(a*10)+24)%8]);
 const[SA,SB]=[P(-2.34,2.23),P(2.34,2.23)];sg.quad([[SA[0],2.66,SA[1]],[SB[0],2.66,SB[1]],[SB[0],3.26,SB[1]],[SA[0],3.26,SA[1]]],[[0,1-(k+1)/8],[1,1-(k+1)/8],[1,1-k/8],[0,1-k/8]],[sn,0,c]);
 const[vx,vz]=P(0,.05);s.vendor={x:vx,z:vz,nx:sn,nz:c};
 }
 /** v0.49: stall keepers for the stalls of a market opened later (stalls from index `from`). */
 registerFrom(npcs,from){const all=this.stalls;this.stalls=all.slice(from);try{this.register(npcs,from);}finally{this.stalls=all;}}
 register(npcs,offset=0){for(let i=0;i<this.stalls.length;i++){const s=this.stalls[i],female=i%2===0;const r=npcs.addAnchored({id:s.id,kind:'stall',role:'trader',name:female?['Mama Ngozi','Madam Amaka','Mama Chioma','Ada Textiles'][i%4]:['Oga Emeka','Chidi Stores','Oga Obinna','Uche & Sons'][i%4],...s.vendor,schedule:[7,19.5],gender:female?'female':'male'});r.goods=GOODS[s.variant].toLowerCase();}}
 update(dt,focus){this.time+=dt;const range={low:125,medium:185,high:260}[this.world.quality]??185;let builds=0;for(const d of this.districts){d.root.visible=Math.hypot(focus.x-d.x,focus.z-d.z)<d.radius+range;for(const ch of d.chunks){const dist=Math.hypot(focus.x-ch.x,focus.z-ch.z);ch.root.visible=dist<range+36;
  // v0.54.3: a block of stalls gets its shapes when you come near (two blocks a frame) and lets them go far away
  if(ch.root.visible&&!ch.built&&builds<2){this.buildChunk(ch);builds++;}else if(ch.built&&dist>range+160)this.dropChunk(ch);}}}
 buildChunk(ch){const gb=new GeoBuilder(),sg=new GeoBuilder();this.noCollide=true;try{for(const s of ch.stalls)this.stall(gb,sg,s,null);}finally{this.noCollide=false;}const mesh=new THREE.Mesh(gb.build(),this.material);mesh.castShadow=true;mesh.receiveShadow=true;ch.root.add(mesh,new THREE.Mesh(sg.build(),this.signMaterial));ch.built=true;}
 dropChunk(ch){for(const m of [...ch.root.children]){m.geometry?.dispose();ch.root.remove(m);}ch.built=false;}
 /** build every block now (tests and screenshots) */
 buildAll(){for(const d of this.districts)for(const ch of d.chunks)if(!ch.built)this.buildChunk(ch);}
}
