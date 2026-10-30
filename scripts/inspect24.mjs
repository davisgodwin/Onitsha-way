import fs from 'node:fs';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import * as T from 'three';
for(const f of ['/data/model-packs/male-character/FBX/Male_Casual.fbx','/data/model-packs/female-character/FBX/Female_Casual.fbx']){
 try{let b=fs.readFileSync(f);let g=new FBXLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');let box=new T.Box3().setFromObject(g);console.log(f,'bounds',box.min.toArray(),box.max.toArray(),'clips',g.animations.map(a=>[a.name,a.duration]));g.traverse(o=>{if(o.isSkinnedMesh)console.log('skin',o.name,o.geometry.attributes.position.count,o.skeleton.bones.map(b=>b.name));});}catch(e){console.log(e.stack.slice(0,1000));}
}
for(const f of ['/data/model-packs/building-1/Models with Materials/OBJ/2Story_Balcony_Mat.obj','/data/model-packs/building-2/OBJ/Building1_Small.obj','/data/model-packs/vehicle-1/OBJ/NormalCar1.obj']){const g=new OBJLoader().parse(fs.readFileSync(f,'utf8'));console.log(f,new T.Box3().setFromObject(g),g.children.length);}
