import * as THREE from 'three';
import {compactSedan,PAINTS} from '../vehicles/CarModels.js';
/** Designed game boundary around the mapped mall; the public arterial at x≈1570 stays outside. */
export function buildMallPrecinct(map,collision) {
  const group=new THREE.Group();group.name='OnitshaMallPrecinct';
  const mat=new THREE.MeshStandardMaterial({color:'#d5d8d0',roughness:.8}),rail=new THREE.MeshStandardMaterial({color:'#354d4b',metalness:.4,roughness:.5});
  const box=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;group.add(o);return o;};
  const fence=(ax,az,bx,bz)=>{const len=Math.hypot(bx-ax,bz-az),angle=-Math.atan2(bz-az,bx-ax),cx=(ax+bx)/2,cz=(az+bz)/2;const base=box(len,.48,.22,cx,.24,cz,mat);base.rotation.y=angle;for(const y of[.8,1.65]){const o=box(len,.06,.08,cx,y,cz,rail);o.rotation.y=angle;}const n=Math.ceil(len/2);for(let i=0;i<=n;i++){const t=i/n;box(.09,1.85,.09,ax+(bx-ax)*t,.925,az+(bz-az)*t,rail);}const dx=(bz-az)/len*.15,dz=-(bx-ax)/len*.15;collision.addPolygon([[ax+dx,az+dz],[bx+dx,bz+dz],[bx-dx,bz-dz],[ax-dx,az-dz]],1.9);};
  fence(1594,-1220,1787,-1220);fence(1787,-1220,1787,-964);fence(1787,-964,1594,-964);fence(1594,-1220,1594,-1083);fence(1594,-1052,1594,-964);
  // Purpose-built forecourt replaces the visual impression of public roads through a dirt lot.
  const paving=new THREE.MeshStandardMaterial({color:'#b3b5ad',roughness:.9}),asphalt=new THREE.MeshStandardMaterial({color:'#444d50',roughness:.8}),grass=new THREE.MeshStandardMaterial({color:'#60845b',roughness:1});
  box(72,.025,226,1634,.055,-1092,paving);for(const x of[1614,1653])box(6,.018,210,x,.081,-1092,asphalt);box(72,.02,10,1634,.105,-1067,asphalt);box(4,.025,210,1668,.09,-1092,new THREE.MeshStandardMaterial({color:'#d8c8af',roughness:.95}));
  for(const z of[-1185,-1145,-1105,-1025,-990]){box(4,.12,7,1663,.12,z,mat);box(3.5,.025,6.5,1663,.2,z,grass);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.17,.24,2.9,8),new THREE.MeshStandardMaterial({color:'#715b41'}));trunk.position.set(1663,1.65,z);group.add(trunk);for(const[dx,dy]of[[-.7,0],[.7,.2],[0,.8]]){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(1.25,1),new THREE.MeshStandardMaterial({color:'#3e7654',roughness:1}));crown.position.set(1663+dx,3.2+dy,z);group.add(crown);}collision.addCircle(1663,z,.45);box(2,.15,.5,1667,.5,z,rail);for(const dx of[-.7,.7])box(.08,.5,.4,1667+dx,.25,z,rail);collision.addPolygon([[1665.9,z-.3],[1668.1,z-.3],[1668.1,z+.3],[1665.9,z+.3]],.65);}
  // Static parked cars are decorative and collidable, separate from ambient through traffic.
  const parking=[];for(const x of[1626,1637])for(let i=0;i<12;i++){const z=-1180+i*15;if(z>-1080&&z<-1050)continue;parking.push({x,z});}
  const parked=new THREE.InstancedMesh(compactSedan(),new THREE.MeshStandardMaterial({vertexColors:true,metalness:.25,roughness:.38}),parking.length),dummy=new THREE.Object3D();parked.castShadow=true;
  parking.forEach((p,i)=>{dummy.position.set(p.x,.08,p.z);dummy.rotation.y=Math.PI/2;dummy.updateMatrix();parked.setMatrixAt(i,dummy.matrix);parked.setColorAt(i,new THREE.Color(PAINTS.sedan[i%PAINTS.sedan.length]));collision.addPolygon([[p.x-2.35,p.z-.95],[p.x+2.35,p.z-.95],[p.x+2.35,p.z+.95],[p.x-2.35,p.z+.95]],1.5);});group.add(parked);
  // Clearly marked parking rows, forecourt planters and benches (never a through-road).
  const line=new THREE.MeshStandardMaterial({color:'#f5edd2'});
  for(let z=-1184;z<-990;z+=7.5){if(z>-1085&&z<-1048)continue;for(const x of[1626,1637])box(6,.012,.11,x,.13,z,line);}
  for(const z of[-1190,-985]){box(16,.45,1.4,1632,.23,z,rail);for(let i=0;i<8;i++){const plant=new THREE.Mesh(new THREE.IcosahedronGeometry(.65,1),new THREE.MeshStandardMaterial({color:'#4f805b'}));plant.position.set(1625+i*2,.95,z);group.add(plant);}collision.addPolygon([[1624,z-.7],[1640,z-.7],[1640,z+.7],[1624,z+.7]],1.5);}
  return group;
}
