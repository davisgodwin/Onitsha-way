import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export const MODELS=new Map();
let ready;
export function loadModelLibrary(onProgress=()=>{}){
 return ready??= (async()=>{const base=import.meta.env.BASE_URL+'models/v24/',res=await fetch(base+'catalogue.json');if(!res.ok)throw Error('Model catalogue unavailable');const entries=await res.json(),loader=new GLTFLoader();let n=0;await Promise.all(entries.map(async e=>{const g=await loader.loadAsync(base+e.id+'.glb');let mesh;g.scene.traverse(o=>{if(o.isMesh){mesh??=o;o.castShadow=true;o.receiveShadow=true;}});MODELS.set(e.id,{...e,...g,geometry:mesh?.geometry});onProgress(++n/entries.length);}));return MODELS;})();
}
export function modelGeometry(id){return MODELS.get(id)?.geometry?.clone()??null;}
