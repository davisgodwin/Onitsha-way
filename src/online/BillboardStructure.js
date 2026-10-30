import * as THREE from 'three';
import {BILLBOARD_SIZE} from '../world/RoadsideSites.js';
/** Roadside-scale double-sided board; no extra real-time lights or draw-heavy text meshes. */
export function buildBillboardStructure(texture){
 const group=new THREE.Group(),{width:w,height:h,bottom:b}=BILLBOARD_SIZE,y=b+h/2;
 const steel=new THREE.MeshStandardMaterial({color:'#29383b',metalness:.65,roughness:.55}),rim=new THREE.MeshStandardMaterial({color:'#b0b9b3',metalness:.7,roughness:.5}),concrete=new THREE.MeshStandardMaterial({color:'#92958b',roughness:.95});
 const add=(geo,mat,x,yy,z)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,yy,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;};
 add(new THREE.BoxGeometry(w+.6,h+.6,.46),steel,0,y,0);
 for(const yy of[b-.15,b+h+.15])add(new THREE.BoxGeometry(w+.4,.12,.58),rim,0,yy,0);
 for(const x of[-w/2-.15,w/2+.15])add(new THREE.BoxGeometry(.12,h+.4,.58),rim,x,y,0);
 const face=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,emissive:'#ffffff',emissiveMap:texture,emissiveIntensity:.35,roughness:.6}));face.name='Billboard-front';face.position.set(0,y,.245);group.add(face);const back=face.clone();back.name='Billboard-back';back.position.z=-.245;back.rotation.y=Math.PI;group.add(back);
 for(const x of[-4.5,4.5]){add(new THREE.CylinderGeometry(.24,.34,y,10),steel,x,y/2,0);add(new THREE.BoxGeometry(1.4,.3,1.5),concrete,x,.15,0);}
 add(new THREE.BoxGeometry(w+.7,.18,.85),steel,0,b-.45,-.3);
 for(const x of[-4.5,0,4.5]){add(new THREE.BoxGeometry(.16,.16,1.1),steel,x,b+h+.25,0);add(new THREE.BoxGeometry(.65,.14,.34),rim,x,b+h+.15,.65);add(new THREE.BoxGeometry(.55,.05,.28),new THREE.MeshBasicMaterial({color:'#f0e3bd'}),x,b+h+.06,.65);}
 // v0.39 night lighting: the three lamp lenses glow and throw a wash of light down both faces after dark.
 const lens=new THREE.Mesh(mergeLenses(w,h,b),NIGHT.lens);lens.name='Billboard-lamps';group.add(lens);
 for(const side of[1,-1])for(const x of[-4.5,0,4.5]){const wash=new THREE.Mesh(washGeo(h),NIGHT.wash);wash.name='Billboard-wash';wash.position.set(x,y+.15,side*.27);if(side<0)wash.rotation.y=Math.PI;wash.renderOrder=3;group.add(wash);}
 group.userData={faceWidth:w,faceHeight:h,bottom:b,top:b+h,doubleSided:true,posts:[-4.5,4.5]};return group;
}

const washTexture=typeof document==='undefined'?null:(()=>{const c=document.createElement('canvas');c.width=64;c.height=128;const x=c.getContext('2d'),gr=x.createRadialGradient(32,0,2,32,10,120);gr.addColorStop(0,'rgba(255,240,200,1)');gr.addColorStop(.55,'rgba(255,225,160,.35)');gr.addColorStop(1,'rgba(255,220,150,0)');x.fillStyle=gr;x.fillRect(0,0,64,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
/** Shared night materials for every roadside board: set once per update by Billboards.setNight(). */
export const NIGHT={lens:new THREE.MeshBasicMaterial({color:'#5f5a4c'}),wash:new THREE.MeshBasicMaterial({map:washTexture,transparent:true,opacity:0,blending:THREE.AdditiveBlending,depthWrite:false})};
NIGHT.wash.visible=false;
const washGeo=(h)=>new THREE.PlaneGeometry(4.2,h+.4);
function mergeLenses(w,h,b){const parts=[];for(const x of[-4.5,0,4.5])for(const z of[.65,-.65]){const g=new THREE.BoxGeometry(.5,.05,.26);g.translate(x,b+h+.035,z);parts.push(g.toNonIndexed());}const pos=[];for(const g of parts)pos.push(...g.attributes.position.array);const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));out.computeVertexNormals();return out;}
