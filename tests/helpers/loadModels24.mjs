import {MODELS} from '../../src/render/ModelLibrary.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {readFileSync} from 'node:fs';
for(const id of ['car-sedan','car-executive','car-suv']){if(MODELS.has(id))continue;const b=readFileSync(new URL('../../public/models/v24/'+id+'.glb',import.meta.url));const g=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');let geometry;g.scene.traverse(o=>{if(o.isMesh)geometry=o.geometry;});MODELS.set(id,{geometry});}
