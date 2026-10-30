import * as THREE from 'three';
import {GeoBuilder} from './GeoBuilder.js';
import {rect,venuePlot} from './StreetLayout.js';

export const venueSize=kind=>kind==='fuel'?{w:23,d:25}:kind==='hotel'?{w:20,d:22}:kind==='club'?{w:17,d:18}:kind==='hospital'?{w:24,d:25}:kind==='bank'?{w:16,d:17}:kind==='court'?{w:18,d:19}:{w:15,d:17};
/**
 * v0.43: a clear, road-fronting plot for a purpose-built venue near a landmark, kept out of markets, malls and
 * interchanges and away from given points (other venues, stores). Tries rings around the landmark; null if none fits.
 */
export function venueNear(world,near,kind,{from=45,avoid=[],seed=0}={}){
 const L=world.landmarks.get(near)??world.landmarks.list[0],size=venueSize(kind);
 const zones=world.landmarks.list.filter(l=>['market','mall','interchange'].includes(l.kind)).map(l=>({x:l.x,z:l.z,r:(l.radius??60)+12}));
 for(const r of[from,from+35,from+80,from+140,from+220])for(let i=0;i<10;i++){const a=(i+seed*0.37)*Math.PI*2/10;
  let p;try{p=venuePlot(world,{x:L.x+Math.cos(a)*r,z:L.z+Math.sin(a)*r},size);}catch{continue;}
  const bad=zones.some(q=>Math.hypot(q.x-p.plot.x,q.z-p.plot.z)<q.r)||avoid.some(q=>Math.hypot(q.x-p.plot.x,q.z-p.plot.z)<(q.r??30));
  if(bad){world.collision.removePolygon(p.plot.pi);world.venuePlots=world.venuePlots.filter(q=>q.pi!==p.plot.pi);continue;}
  return p;}
 return null;
}
/** A door on a venue's front: local (x, z) in the venue's frame (z negative = into the plot), with the street normal. */
export function venueDoor(v,x,z,standOut=2.2){const c=Math.cos(v.yaw??0),s=Math.sin(v.yaw??0),wp=(a,b)=>({x:v.x+c*a+s*b,z:v.z-s*a+c*b});const d=wp(x,z),st=wp(x,z+standOut);return{x:d.x,z:d.z,nx:s,nz:c,ux:c,uz:-s,stand:st,world:wp};}
export {venuePlot};
// Geometry is local to the street-facing entrance, not a world-axis kiosk.
export function buildVenue(world,v,parent){
 const root=new THREE.Group();root.name=`venue:${v.id}`;root.position.set(v.x,0,v.z);root.rotation.y=v.yaw??0;parent.add(root);
 if(v.plot)world.collision.removePolygon(v.plot.pi);
 const gb=new GeoBuilder(),glow=new GeoBuilder(),col=c=>new THREE.Color(c),solids=[];
 const worldPoint=(x,z)=>[v.x+Math.cos(v.yaw??0)*x+Math.sin(v.yaw??0)*z,v.z-Math.sin(v.yaw??0)*x+Math.cos(v.yaw??0)*z];
 function box(w,h,d,x,y,z,c,solid=false,lit=false){(lit?glow:gb).box(x,z,y-h/2,y+h/2,w,d,0,col(c));if(solid){const pts=rect(x,z,w,d).map(([a,b])=>worldPoint(a,b));world.collision.addPolygon(pts,h);solids.push(pts);}}
 function sign(text,w,h,x,y,z,bg='#143e36',fg='#fff2cc'){
 const c=document.createElement('canvas');c.width=1024;c.height=160;const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,1024,160);g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';g.font='bold 65px Arial';g.fillText(text,512,82,980);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const mat=new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:'#fff',emissiveIntensity:.35,roughness:.6});const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);m.position.set(x,y,z);root.add(m);
 }
 function windows(w,levels,z){for(let f=0;f<levels;f++)for(let x=-w/2+1.4;x<w/2;x+=2.6){box(1.55,1.35,.09,x,2.3+f*3,z,'#244b5b');box(1.65,.11,.18,x,1.57+f*3,z+.06,'#e8e3d7');box(.07,1.35,.12,x,2.3+f*3,z+.06,'#a9c9d2');}}
 function door(x,z){box(1.75,2.55,.12,x,1.28,z,'#153743');box(.08,2.55,.17,x,1.28,z+.04,'#a0b4ad');box(.07,.5,.16,x+.55,1.2,z+.13,'#d9b469');}
 function bollard(x,z,c='#d5b94d'){box(.2,.95,.2,x,.48,z,c,true);box(.23,.15,.23,x,.75,z,'#e8e4d7');}
 if(v.driveway){const len=v.driveway.length;box(v.driveway.width,.08,len,0,.025,len/2-.1,'#bcb7a8');}
 const kind=v.kind??v.id,cream='#e9dfcc',trim=kind==='efcc'?'#8d2d32':'#254b55';
 if(kind==='fuel'){
  // Drive-through pump islands: open forecourt, no collider across the canopy.
  box(22,.15,23,0,.02,-10,'#b0aea4');
  box(17,.65,12,0,5.1,-8,'#f5f0df');box(17,.25,12.1,0,4.78,-8,'#c62e2b');
  for(const x of[-6.4,6.4])for(const z of[-12,-4])box(.35,4.7,.35,x,2.35,z,'#e6e2d9',true);
  for(const x of[-4,4]){
   box(1.4,.18,6,x,.18,-8,'#ded8bf',true);for(const z of[-6.2,-9.8]){box(.72,1.65,.65,x,1.1,z,'#eae9e0',true);box(.74,.45,.67,x,1.05,z,'#c92b2b');box(.48,.34,.025,x,1.52,z+.34,'#112d36');sign('₦ / L',.45,.15,x,1.53,z+.36,'#102d30','#a8e39c');box(.07,.8,.08,x+.48,1,z,'#252a2a');box(.2,.13,.15,x+.42,1.35,z,'#343735');}
   for(const z of[-11.4,-4.5])bollard(x,z);
  }
  box(17,3.2,4,0,1.6,-19,'#e7dcc5',true);windows(15,1,-16.94);door(0,-16.9);sign('MINI MART • LUBRICANTS',12,.65,0,2.85,-16.86,'#c3292c');
  sign(v.name.toUpperCase(),15,.75,0,5.1,-1.94,'#c3292c');
  box(.28,5,.28,-9,2.5,-.8,'#666c69',true);box(2.5,3,.35,-9,4.5,-.8,'#c3292c');sign('PMS',2.15,.55,-9,5.1,-.6,'#c3292c');sign('DIESEL',2.15,.45,-9,4.35,-.6,'#c3292c');sign('OPEN',2.15,.45,-9,3.6,-.6,'#c3292c');
  // Painted lanes and arrows remain clear of the public road.
  for(const x of[-8,0,8]){box(.12,.02,11,x,.12,-8,'#f7e5a3');box(.8,.02,.15,x,.13,-2.8,'#f7e5a3');}
 }else if(kind==='police'||kind==='efcc'){
  const police=kind==='police';box(14,.16,15,0,.02,-6.5,'#b6b0a0');
  box(12,police?4.2:7.2,7,0,police?2.1:3.6,-9.3,cream,true);box(12.5,.3,7.5,0,police?4.3:7.3,-9.3,trim);windows(11,police?1:2,-5.76);door(0,-5.7);
  box(4.3,.25,3.2,0,3.2,-4.1,trim);for(const x of[-1.95,1.95])box(.22,3.1,.22,x,1.55,-2.65,cream,true);
  sign(police?'NIGERIA POLICE FORCE':'EFCC • FIELD OFFICE',11,1,0,police?3.7:6.8,-5.62,trim);sign('VISITOR RECEPTION',4.2,.43,0,2.7,-2.5,trim);
  for(const x of[-6.5,6.5]){box(.28,1.4,13,x,.7,-6.5,'#c7c0aa',true);for(let z=-12;z<0;z+=1)box(.07,.9,.07,x,1.85,z,'#39484b');}
  // Gatehouse and barrier leave a pedestrian opening beside the central gate.
  box(1.6,2.7,1.8,-5,1.35,-.7,trim,true);box(1.1,.8,.05,-5,1.9,.23,'#4c7785');
  for(const x of[-3,3])bollard(x,-.1,trim);
  box(.07,7,.07,5.1,3.5,-3,'#a5ada9');for(const [i,c]of['#167b46','#f2f0df','#167b46'].entries())box(.47,.9,.04,5.36+i*.47,6.25,-3,c);
  sign(police?'POLICE':'EFCC',3.5,.65,4,1.35,-2.8,trim);
 }else if(kind==='hotel'){
  box(19,.16,20,0,.02,-9.5,'#b6b2a9');box(17,12.2,11,0,6.1,-12.2,'#e8ddc7',true);box(17.6,.35,11.6,0,12.4,-12.2,'#39494b');
  windows(16,4,-6.64);for(let f=1;f<4;f++){box(17.2,.2,.75,0,f*3+.2,-6.3,'#f4eee1');for(let x=-7;x<=7;x+=2.5){box(1.6,.65,.1,x,f*3+.58,-5.95,'#526d74');}}
  box(7,.4,4.5,0,3.6,-4.6,'#856e4c');for(const x of[-3.1,3.1])box(.35,3.4,.35,x,1.7,-2.7,'#d8c9a8',true);
  door(0,-6.55);sign(v.name.toUpperCase(),15,1.05,0,11.65,-6.53,'#374f57','#f9deb1');sign('HOTEL • RECEPTION • ROOMS',7,.6,0,3.65,-2.27,'#374f57');
  for(const x of[-7.5,7.5]){box(1.3,.6,1.3,x,.3,-3,'#af8062',true);box(1,1.3,1,x,1.1,-3,'#456b3a');}for(let i=0;i<3;i++)box(6,.14,1.8-i*.35,0,.08+i*.14,-1.5-i*.35,'#e6d9bd');
 }else if(kind==='club'){
  box(16,.14,16,0,.02,-7,'#797a79');box(14,6.2,10,0,3.1,-9,'#252b3b',true);box(14.5,.3,10.5,0,6.3,-9,'#111e2d');
  for(const x of[-6.65,6.65])box(.16,5.7,.2,x,3,-3.9,'#b775cf',false,true);
  sign(v.name.toUpperCase(),12,1.2,0,4.6,-3.87,'#211e35','#e3b5ff');sign('MUSIC • DANCE • LOUNGE',9,.5,0,3.55,-3.85,'#211e35','#87d9d5');door(0,-3.8);
  box(5,.22,3,0,3.1,-2.5,'#3b3652');for(const x of[-2.2,2.2])box(.12,2.8,.12,x,1.4,-1.2,'#c0a06d',true);
  for(const x of[-1.5,1.5]){for(const z of[-2,-.5,1])bollard(x,z,'#a38759');box(.05,.05,3,x,.88,-.5,'#a94350');}
  box(1.4,1.1,.6,4.4,.55,-2,'#151c25',true);sign('ENTRY 19:00',2.5,.4,4.4,1.5,-1.65,'#17222d','#dbbb7f');
 }else if(kind==='bar'){
  box(14,.13,15,0,.02,-6,'#b19b7c');box(13,3.5,5,0,1.75,-10,'#ba8058',true);box(14,.3,7,0,3.65,-9,'#355b50');
  for(const x of[-6.2,6.2])box(.2,3.5,.2,x,1.75,-6.2,'#614c35',true);
  sign(v.name.toUpperCase(),12,.8,0,3,-7.43,'#224b3b','#f6df9d');box(8,1.1,.9,0,.55,-6,'#78513a',true);
  for(let i=0;i<15;i++){const x=-3.5+i*.5;box(.17,.42,.17,x,1.35,-6,['#7b4931','#34805b','#d4aa45'][i%3]);}
  for(const x of[-4,0,4])for(const z of[-2,1]){box(1.3,.12,1.1,x,.83,z,'#c3a06d',true);box(.13,.8,.13,x,.4,z,'#374c47');box(.12,.2,.12,x+.3,.99,z,'#d2ac59');box(.16,.025,.22,x-.25,.91,z,'#e4d9c2');for(const a of[-1,1]){box(.48,.5,.48,x+a,.25,z,'#744a36',true);box(.08,.65,.48,x+a+a*.24,.7,z,'#744a36');}}
  sign('PEPPER SOUP • MALT • MUSIC',9,.45,0,2,-7.4,'#224b3b');
 }else if(kind==='hospital'){
  // v0.43: a purpose-built hospital — a three-storey white block, red-cross panel, emergency canopy, ambulance bay.
  box(24,.16,24,0,.02,-11,'#c9c6bc');box(20,9.4,10,0,4.7,-16,'#f5f5f0',true);box(20.6,.4,10.6,0,9.6,-16,'#1f6f8b');
  for(let f=0;f<3;f++)box(20.1,.18,.12,0,3.05+f*3,-10.95,'#1f6f8b');windows(19,3,-10.94);door(0,-10.93);door(-2,-10.93);
  box(5,5,.1,6.5,7.2,-10.9,'#ffffff');box(1.3,3.8,.14,6.5,7.2,-10.84,'#d4202a');box(3.8,1.3,.14,6.5,7.2,-10.84,'#d4202a');
  box(14,1.5,.3,-2.5,10.55,-11.2,'#ffffff');for(const x of[-8,3])box(.2,.8,.2,x,9.9,-11.2,'#1f6f8b');sign(v.name.toUpperCase(),13.4,1.2,-2.5,10.55,-11.03,'#ffffff','#123c69');
  box(9,.3,5,-1,3.4,-8.4,'#1f6f8b');for(const x of[-5.2,3.2])box(.25,3.3,.25,x,1.65,-6.2,'#e9e9e2',true);sign('24-HOUR EMERGENCY',7,.55,-1,3.95,-5.88,'#d4202a','#ffffff');
  box(4.2,.02,7.5,7.6,.04,-4.6,'#d9cf8a');box(3.8,.025,7.1,7.6,.05,-4.6,'#c9c6bc');sign('AMBULANCE ONLY',3.6,.4,7.6,.06,-.95,'#d4202a','#ffffff');
  for(const x of[-11.8,11.8])box(.25,1.2,22,x,.6,-11,'#dcd9cf',true);box(1.2,2.4,1.2,-9.5,1.2,-1.2,'#1f6f8b',true);sign('HOSPITAL',2.2,.38,-9.5,2.6,-.58,'#d4202a','#ffffff');
  for(const x of[-10,-7,10])box(.9,.5,.9,x,.25,-9.6,'#a77c5b',true);
 }else if(kind==='bank'){
  // v0.43: a purpose-built banking hall — glass front between columns, the bank's colours, an ATM and a security post.
  const [bg,fg]=v.colors??['#0f3d63','#f2c14e'];
  box(16,.16,16,0,.02,-7.5,'#bdb8ab');box(13,7,9,0,3.5,-11.5,'#e9e4d8',true);box(13.6,.5,9.6,0,7.2,-11.5,bg);
  box(11,3,.1,0,1.9,-6.95,'#5d8aa0');for(let x=-5;x<=5;x+=2.5)box(.1,3,.16,x,1.9,-6.9,'#d9dfe0');windows(12,1,-6.94);
  for(const x of[-6,-3,3,6])box(.6,6.4,.6,x,3.2,-6.4,'#f4f0e6',true);box(13.2,1.3,1.4,0,6.75,-6.6,bg);
  sign(v.name.toUpperCase(),12,1.05,0,6.75,-5.88,bg,fg);door(0,-6.88);
  box(1.4,2.3,.7,-4.6,1.15,-5.4,'#2b2f33',true);box(1,.6,.05,-4.6,1.6,-5.03,'#6fb0d8');sign('ATM',1,.3,-4.6,2.05,-5.02,bg,fg);
  box(1.4,2.5,1.4,5.6,1.25,-1.2,'#5c6a72',true);sign('SECURITY',1.3,.3,5.6,2.3,-.48,bg,fg);
  for(let i=0;i<3;i++)box(6,.14,1.6-i*.35,0,.08+i*.14,-5.9+i*.17,'#ddd6c6');for(const x of[-2.5,2.5])bollard(x,-2.6,fg);
 }else if(kind==='court'){
  // v0.43: the Magistrate Court — columned portico, pediment, coat-of-arms panel, flagpole.
  box(18,.16,18,0,.02,-8.5,'#c3bdae');box(15,6.6,9,0,3.3,-13,'#ece4d2',true);box(15.6,.45,9.6,0,6.8,-13,'#6b4e33');
  windows(14,2,-8.44);door(0,-8.43);box(10,.5,3.4,0,5.4,-7,'#efe7d4');box(10.4,.35,3.6,0,5.8,-7,'#6b4e33');
  for(const x of[-4,-2,2,4])box(.55,5.2,.55,x,2.6,-5.6,'#f6f1e5',true);sign(v.name.toUpperCase(),9.5,.8,0,5.38,-5.28,'#6b4e33','#f9e7b8');
  box(1.6,1.6,.1,0,3.9,-8.38,'#167b46');box(1.1,1.1,.12,0,3.9,-8.33,'#f2f0df');
  for(let i=0;i<4;i++)box(9,.14,1.6-i*.3,0,.08+i*.14,-4.4,'#e2dccd');
  box(.07,7,.07,7.6,3.5,-2,'#a5ada9');for(const [i,c]of['#167b46','#f2f0df','#167b46'].entries())box(.47,.9,.04,7.86+i*.47,6.25,-2,c);
 }else if(kind==='ict'){
  // v0.46: Metadav ICT Hub: a two-storey glass-fronted tech building with a cantilevered upper floor, green fins,
  // a lit strip, solar panels on the roof, planters and a bike rack.
  box(15,.14,17,0,.02,-7.5,'#c9ccc8');box(13,3.4,8,0,1.7,-10,'#e9eef0',true);
  box(12.6,3,.08,0,1.6,-5.97,'#7fb3c8',false,true);for(let x=-6;x<=6;x+=1.5)box(.12,3.2,.14,x,1.6,-5.9,'#1f7a55');box(12.8,.14,.16,0,3.15,-5.9,'#1f7a55');
  box(14,3.6,9.4,0,5.2,-9.6,'#2f3a40',true);box(14.1,.18,9.5,0,3.45,-9.6,'#1f7a55');box(14.1,.2,.06,0,4.3,-4.88,'#5ff0a8',false,true);
  for(let x=-6.3;x<=6.3;x+=2.1)box(1.6,1.6,.06,x,5.5,-4.88,'#5d8aa0');for(let x=-7;x<=7;x+=1)box(.08,3.6,.5,x,5.2,-4.7,'#1f7a55');
  sign('METADAV ICT HUB',8,.9,-2.2,6.9,-4.84,'#1f3a4a','#9ff2c4');sign('</>  CODE LAB · PHOTO STUDIO · GIGS',7.5,.42,0,2.75,-5.84,'#1f3a4a','#d9f3d0');
  for(let x=-5;x<=5;x+=2.5)for(const z of[-12,-8.5]){box(2,.08,2.6,x,7.3,z,'#1d2f4a');box(.08,.5,.08,x,7.05,z+1.1,'#8a8f93');}
  door(0,-5.85);for(let i=0;i<3;i++)box(4.5,.14,1.4-i*.3,0,.08+i*.14,-5.1+i*.15,'#d6d9d6');
  for(const x of[-5.6,5.6]){box(1.2,.6,1.2,x,.3,-3.8,'#5a6a72',true);box(1,.9,1,x,1.05,-3.8,'#3f7d3f');}
  for(let i=0;i<4;i++)box(.06,.7,.7,-3.2+i*.5,.35,-2.4,'#8a8f93');box(2,.06,.06,-2.45,.7,-2.4,'#8a8f93');
 }else if(kind==='electoral'){
  // v0.45: the electoral offices: a white two-storey block with green bands, flags, a notice board out front.
  box(16,.16,16,0,.02,-7.5,'#c4c0b4');box(14,6.4,8,0,3.2,-11,'#f2f1ea',true);box(14.5,.35,8.5,0,6.55,-11,'#167b46');for(const y of[3.2])box(14.1,.2,.12,0,y,-6.95,'#167b46');
  windows(13,2,-6.94);door(0,-6.92);box(5,.3,2.6,0,3,-5.6,'#167b46');for(const x of[-2.3,2.3])box(.22,2.9,.22,x,1.45,-4.4,'#e9e8e0',true);
  sign('ELECTORAL OFFICES',10,.8,0,5.6,-6.86,'#167b46','#ffffff');sign('VOTER REGISTRATION • NOMINATIONS • RESULTS',7,.42,0,2.6,-4.25,'#167b46','#ffffff');
  for(const x of[5.5,6.4]){box(.07,7,.07,x,3.5,-3,'#a5ada9');}for(const [i,c]of['#167b46','#f2f0df','#167b46'].entries())box(.42,.8,.04,5.73+i*.42,6.3,-3,c);
  box(2.4,1.5,.12,-5,1.4,-2.2,'#5a3a24',true);box(2.2,1.3,.03,-5,1.45,-2.13,'#f2f0df');sign('NOTICE OF ELECTION',2,.3,-5,1.95,-2.1,'#167b46','#fff');
  for(let i=0;i<3;i++)box(6,.14,1.6-i*.35,0,.08+i*.14,-6.1+i*.17,'#dcd8cc');
 }else if(kind==='eatery'){
  // v0.45: a one-storey restaurant: awning over the door, a big painted name board, tables outside, potted plants.
  const [bg,fg]=v.colors??['#7a2a1a','#f2c14e'];
  box(15,.14,16,0,.02,-7,'#b9ad98');box(13,3.8,8,0,1.9,-9,v.style==='grill'?'#e2d2bc':'#efe4cf',true);box(13.5,.35,8.5,0,3.95,-9,bg);
  windows(12,1,-4.94);door(0,-4.9);box(7,.12,2.4,0,2.9,-3.8,bg);for(const x of[-3.3,3.3])box(.12,2.9,.12,x,1.45,-2.7,'#5a4636',true);
  for(let i=0;i<8;i++)box(.86,.25,.05,-3+i*.86,2.75,-2.62,i%2?fg:bg);
  sign(v.name.toUpperCase(),11,.85,0,3.4,-4.86,bg,fg);sign(v.style==='grill'?'SUYA • GRILLS • COLD DRINKS':v.style==='garden'?'RESTAURANT • GARDEN • DATES':'SOUPS • RICE • SWALLOW',6.5,.42,0,2.2,-2.56,bg,fg);
  for(const x of[-4.6,4.6]){box(.9,.06,.9,x,.75,-1.6,'#7a5a3a',true);box(.08,.72,.08,x,.36,-1.6,'#3a3a3a');for(const d of[-.65,.65])box(.42,.45,.42,x+d,.22,-1.6,bg,true);box(.05,2.2,.05,x,1.1,-1.6,'#d8d0c0');box(1.6,.08,1.6,x,2.25,-1.6,fg);}
  for(const x of[-6.2,6.2]){box(.6,.5,.6,x,.25,-3.6,'#a77c5b',true);box(.5,.9,.5,x,.95,-3.6,'#3f7d3f');}
 }else{
  box(12,3.6,8,0,1.8,-8,'#ddd2bb',true);windows(11,1,-3.94);door(0,-3.87);box(12.5,.35,8.5,0,3.8,-8,'#35665c');box(7,.2,2.5,0,3,-2.8,'#35665c');sign(v.name.toUpperCase(),11,.75,0,3.35,-3.85,'#244c48');sign('JOBS • TRAINING • EQUIPMENT',7,.42,0,2.65,-1.5,'#244c48');
 }
 const mesh=new THREE.Mesh(gb.build(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.75}));mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
 if(glow.vertexCount){const m=new THREE.Mesh(glow.build(),new THREE.MeshStandardMaterial({vertexColors:true,emissive:'#bba0ef',emissiveIntensity:.65}));root.add(m);}
 v.architecture={root,solids,kind};return root;
}
