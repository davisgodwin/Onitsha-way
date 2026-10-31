import * as THREE from 'three';
import {variantGeometry} from './VehicleVariants.js';
import {splitGlass,GLASS_MATERIAL} from '../sim/TrafficSystem.js';
import {modelGeometry} from '../render/ModelLibrary.js';
// v0.55: the cut-up shapes of each model are made once and shared by every car of that model (only the paint, a
// material, differs per car). Before, every car on a lot, in traffic or in a garage carried its own copy (~25 MB).
const TEMPLATES=new Map();
export function importedCar(model,paint,variant={}){
 const key=variant.id?'v:'+variant.id:'m:'+model;let T=TEMPLATES.get(key);
 if(!T){T=carTemplate(model,variant);if(!T)return null;TEMPLATES.set(key,T);}
 const {width}=T,group=new THREE.Group();group.name='ImportedInteractive:'+model;group.userData.imported=true;group.userData.solidCabin=true;
 const material=new THREE.MeshStandardMaterial({vertexColors:true,color:paint,roughness:.4,metalness:.25,side:THREE.DoubleSide}),doors=[];
 for(const {b,opaque,glass} of T.parts){const mesh=new THREE.Group();if(opaque){const body=new THREE.Mesh(opaque,material);body.castShadow=true;body.receiveShadow=true;body.userData.sharedModel=true;mesh.add(body);}if(glass){const gm=new THREE.Mesh(glass,GLASS_MATERIAL());gm.userData.sharedModel=true;mesh.add(gm);}if(!b)group.add(mesh);else{const side=b===1?1:-1,hinge=new THREE.Group();hinge.position.set(side*width/2,0,.8);hinge.add(mesh);group.add(hinge);doors.push({hinge,side:-side});}}
 // Catalogue variants already contain correctly scaled seats, floor and dashboard.
 // Adding the old fixed-height cabin again made dashboards protrude through low coupe windscreens.
 // Only legacy, unscaled base models need this fallback interior.
 if(!variant.id){
 const seat=new THREE.MeshStandardMaterial({color:'#333d3b',roughness:.95});const box=(w,h,d,x,y,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),seat);m.position.set(x,y,z);group.add(m);};
 box(width-.15,.08,2.6,0,.4,-.2);for(const x of[-.36,.36]){box(.52,.15,.6,x,.55,.05);box(.52,.55,.12,x,.87,-.22);}box(width-.2,.18,.45,0,.87,.85);
 }
 group.userData.doors=doors;group.userData.doorAmount=0;group.userData.doorTarget=0;group.userData.modelLabel=variant.label??model;group.userData.brand=variant.brand??null;return group;
}
function carTemplate(model,variant){
 const source=variant.id?variantGeometry(variant.id):modelGeometry('car-'+model);if(!source)return null;const g=source.index?source.toNonIndexed():source;g.computeBoundingBox();const width=g.boundingBox.max.x*2,roof=g.boundingBox.max.y;
 const buckets=[[],[],[]],p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;
 const vert=i=>[p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),c.getX(i),c.getY(i),c.getZ(i)];
 const emit=(poly,bucket)=>{for(let j=1;j<poly.length-1;j++)bucket.push(poly[0],poly[j],poly[j+1]);};
 // Clip painted side panels and glass against a door volume. Wheels/trim remain intact.
 const cut=(poly,axis,bound,sign)=>{const inside=[],outside=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=(a[axis]-bound)*sign,db=(b[axis]-bound)*sign;if(da>=0)inside.push(a);else outside.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db),v=a.map((q,k)=>q+(b[k]-q)*t);inside.push(v);outside.push(v);}}return[inside,outside];};
 for(let t=0;t<p.count;t+=3){let poly=[vert(t),vert(t+1),vert(t+2)];const color=c.getX(t)+c.getY(t)+c.getZ(t),body=color>2.5,glass=c.getZ(t)>c.getX(t)*1.3&&color<.3;let side=(poly.reduce((s,v)=>s+v[0],0)>=0)?1:-1;if(!(body||glass)){emit(poly,buckets[0]);continue;}
  for(const[axis,bound,sign]of [[0,side*width*.29,side],[1,.44,1],[1,roof-.1,-1],[2,-.75,1],[2,.8,-1]]){if(poly.length<3)break;const[inside,outside]=cut(poly,axis,bound,sign);if(outside.length>=3)emit(outside,buckets[0]);poly=inside;}if(poly.length>=3)emit(poly,buckets[side===1?1:2]);
 }
 const parts=[];
 for(let b=0;b<3;b++){const a=buckets[b];if(!a.length)continue;const gg=new THREE.BufferGeometry();for(const[name,offset]of[['position',0],['normal',3],['color',6]])gg.setAttribute(name,new THREE.Float32BufferAttribute(a.flatMap(v=>v.slice(offset,offset+3)),3));const [opaque,glass]=splitGlass(gg);if(b){const side=b===1?1:-1;for(const q of [opaque,glass])q?.translate(-side*width/2,0,-.8);}for(const q of [opaque,glass])if(q){q.computeBoundingSphere();q.userData.shared=true;}parts.push({b,opaque,glass});}
 return {width,parts};
}
