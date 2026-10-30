import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/*
  Keke NAPEP (auto-rickshaw) built from primitives, vertex-coloured, single geometry so it can be
  instanced. Local axes: +Z forward, origin on the ground under the vehicle centre.
  Reused by the public transport system in Milestone 5 (wheels are separate there for animation).
*/

function colored(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (geo.index === null) return geo;
  return geo;
}
function box(w, h, d, x, y, z, hex, rx = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return colored(g, hex);
}
function cyl(r, h, x, y, z, hex, axis = 'x', seg = 14) {
  const g = new THREE.CylinderGeometry(r, r, h, seg);
  if (axis === 'x') g.rotateZ(Math.PI / 2); else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return colored(g, hex);
}

export function buildKekeGeometry({ body = '#f2c200', stripe = '#1f7a3a', canopy = '#1b1b1b' } = {}) {
  const soft=(w,h,d,x,y,z,color,r=.07)=>{const g=new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4));g.translate(x,y,z);return colored(g,color);};
  const beam=(a,b,r,color)=>{const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(r,r,v.length(),8);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize()));g.translate((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2);return colored(g,color);};
  const parts=[
    soft(1.22,.12,2.24,0,.34,-.08,'#242a28'),
    soft(1.24,.5,.35,0,.64,-1.02,body),
    soft(1.24,.06,.56,0,.73,-.94,stripe),
    soft(1.14,.06,.66,0,.4,-.32,stripe), // lowered passenger footwell, below the seated calves
    soft(1.14,.14,.46,0,.82,-.86,'#31302a'),
    soft(1.14,.46,.1,0,1.04,-1.08,'#31302a'),
    soft(.43,.12,.42,0,.82,.16,'#30312c'),
    soft(.43,.42,.12,0,1.06,-.08,'#30312c'),
    // Faceted sloping yellow apron, unlike a four-wheel taxi bonnet.
    soft(.83,.5,.55,0,.68,.89,body),
    box(.95,.4,.07,0,1.02,.83,body,-.21),
    box(.99,.67,.035,0,1.48,.78,'#2b3a44',-.2),
    soft(1.34,.17,2.12,0,1.97,-.12,canopy),
    soft(1.32,.11,.25,0,1.90,.86,body),
    soft(1.22,.68,.07,0,1.52,-1.15,canopy),
    box(.65,.51,.03,0,1.51,-1.194,'#2b3a44'),
    // Single headlamp, front mudguard, and a clearly visible single front wheel.
    cyl(.135,.065,0,.88,1.196,'#fff1c7','z',20),
    cyl(.16,.035,0,.88,1.16,'#9eaba4','z',20),
    soft(.35,.12,.65,0,.56,1.04,body),
    box(.64,.08,.06,0,.48,1.27,'#929d97'),
    box(.39,.13,.025,0,.62,1.195,'#f5e5c0'),
    box(.25,.1,.03,0,.43,-1.225,'#f5e5c0'),
    box(.12,.16,.03,-.48,.65,-1.22,'#b93221'),box(.12,.16,.03,.48,.65,-1.22,'#b93221'),
    // Handlebars remain visible through the open side cabin.
    beam([0,.71,.63],[0,1.04,.51],.025,'#303b36'),beam([-.25,1.08,.46],[.25,1.08,.46],.025,'#a5b0aa'),
  ];
  for(const side of[-1,1]){
    parts.push(soft(.075,.31,1.14,side*.6,.53,-.55,body),soft(.1,.08,1.1,side*.61,.73,-.56,stripe));
    parts.push(beam([side*.55,.96,.93],[side*.57,1.90,.75],.028,'#27342e'),beam([side*.61,.76,-1.1],[side*.61,1.90,-1.1],.03,'#27342e'));
    parts.push(beam([side*.52,1.23,.83],[side*.72,1.24,.83],.016,'#303b36'),soft(.13,.18,.06,side*.73,1.27,.83,'#a5b0aa'));
    parts.push(box(.045,.25,.74,side*.63,.54,-.65,body));
  }
  for(const[x,z]of[[0,1],[-.58,-.72],[.58,-.72]]){parts.push(cyl(.23,.15,x,.23,z,'#151a18'),cyl(.12,.17,x,.23,z,'#b5b9ad'));for(const side of[-1,1])parts.push(cyl(.045,.18,x,.23,z,'#646e67'));}
  // Rear ventilation and spare-wheel cover add working-rickshaw detail.
  for(let i=0;i<5;i++)parts.push(box(.48,.025,.025,0,.46+i*.055,-1.21,'#465344'));
  const geos=parts.map(g=>{const p=g.index?g.toNonIndexed():g;if(p.attributes.uv)p.deleteAttribute('uv');return p;});
  const geo=mergeGeometries(geos,false);geo.computeVertexNormals();geo.computeBoundingSphere();geo.userData.remodel='v24-three-wheel-keke';return geo;
}
