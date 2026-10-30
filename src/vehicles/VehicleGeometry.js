import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Clip triangle polygons precisely; dropping whole crossing triangles leaves holes at a cut. */
export function clipVehicleGeometry(source, axis, bound, keepAbove = true) {
  const g = source.index ? source.toNonIndexed() : source;
  const attrs = Object.entries(g.attributes), out = Object.fromEntries(attrs.map(([name]) => [name, []]));
  const offsets = {}; let size = 0;
  for (const [name, a] of attrs) { offsets[name] = size; size += a.itemSize; }
  const component = offsets.position + axis, sign = keepAbove ? 1 : -1;
  const vertex = i => attrs.flatMap(([, a]) => Array.from({length: a.itemSize}, (_, k) => a.array[i * a.itemSize + k]));
  for (let i = 0; i < g.attributes.position.count; i += 3) {
    const tri = [vertex(i), vertex(i + 1), vertex(i + 2)], poly = [];
    for (let j = 0; j < 3; j++) {
      const a = tri[j], b = tri[(j + 1) % 3], da = (a[component] - bound) * sign, db = (b[component] - bound) * sign;
      if (da >= 0) poly.push(a);
      if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); poly.push(a.map((v, k) => v + (b[k] - v) * t)); }
    }
    for (let j = 1; j < poly.length - 1; j++) for (const v of [poly[0], poly[j], poly[j + 1]])
      for (const [name, a] of attrs) out[name].push(...v.slice(offsets[name], offsets[name] + a.itemSize));
  }
  const result = new THREE.BufferGeometry();
  for (const [name, a] of attrs) result.setAttribute(name, new THREE.Float32BufferAttribute(out[name], a.itemSize));
  return result;
}

/** Complete the supplied coach shell for both catalogue vehicles and the public-transport fleet. */
export function completeCoach(source, {len:L=7,wid:W=2.1,height:H=2.8}={}) {
  let g=source.index?source.toNonIndexed():source;
  g.deleteAttribute('uv');g.computeBoundingBox();const b=g.boundingBox;
  g.translate(-(b.min.x+b.max.x)/2,-b.min.y,-(b.min.z+b.max.z)/2);
  g.scale((W-.12)/(b.max.x-b.min.x),(H-.34)/(b.max.y-b.min.y),L/(b.max.z-b.min.z));g.translate(0,.34,0);
  const paint=(geo,hex)=>{geo=geo.index?geo.toNonIndexed():geo;const c=new THREE.Color(hex),a=new Float32Array(geo.attributes.position.count*3);for(let i=0;i<a.length;i+=3)c.toArray(a,i);geo.setAttribute('color',new THREE.BufferAttribute(a,3));geo.deleteAttribute('uv');return geo;};
  const box=(w,h,d,x,y,z,c)=>{const geo=new THREE.BoxGeometry(w,h,d);geo.translate(x,y,z);return paint(geo,c);};
  const parts=[g,box(W-.2,.14,L-.5,0,.54,0,'#30393a'),box(W-.18,.12,L-.55,0,.74,0,'#30393a')];
  for(const side of[-1,1]){
    // The imported end-window faces had narrow triangular gaps/ribs. Close the ends and put
    // a continuous opaque pane outside those faces; retain the original body silhouette.
    parts.push(box(W-.12,H*.70,.44,0,H*.63,side*(L/2-.25),'#ece2be'));
    parts.push(box(W-.4,H*.40,.026,0,H*.75,side*(L/2-.016),'#1d2730'));
  }
  // Keep readable front/rear lamps outside the new closing panels.
  for(const x of[-W*.30,W*.30])parts.push(
    box(.28,.16,.026,x,1.02,L/2-.014,'#f4f1e2'),
    box(.22,.20,.026,x,1.02,-L/2+.014,'#9e0b0b'),
  );
  parts.push(box(.85,.16,.026,0,.86,L/2-.014,'#30393a'),box(.50,.14,.026,0,.88,-L/2+.014,'#30393a'));
  for(const x of[-1,1])for(const z of[-L*.32,L*.32]){
    const tyre=new THREE.CylinderGeometry(.39,.39,.2,16);tyre.rotateZ(Math.PI/2);tyre.translate(x*(W/2-.05),.39,z);parts.push(paint(tyre,'#171b1d'));
    const hub=new THREE.CylinderGeometry(.19,.19,.215,12);hub.rotateZ(Math.PI/2);hub.translate(x*(W/2-.05),.39,z);parts.push(paint(hub,'#8c979b'));
  }
  const out=mergeGeometries(parts,false);out.computeVertexNormals();out.computeBoundingBox();out.computeBoundingSphere();return out;
}
