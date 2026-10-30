import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {NPCSystem} from '../src/npc/NPCSystem.js';
function fixture(){
 const system=Object.create(NPCSystem.prototype);Object.assign(system,{t:1,frame:1,car:null,weather:{},rng:()=>1});
 const bones=Object.fromEntries(['upperArm.R','foreArm.R','head'].map(k=>[k,new THREE.Object3D()]));
 const npc={identity:{id:'police:test',kind:'police',activity:'checkpoint',x:10,z:0,yaw:0},role:'police',state:'stand',x:10,z:0,heading:0,stateT:100,bubbleT:100,lastBump:0,animAcc:0,rig:{group:new THREE.Group(),meshes:[],bones},rigRef:{umbrella:{visible:false}},anim:{update(){bones['upperArm.R'].rotation.x=0;bones['foreArm.R'].rotation.x=0;}}};
 return {system,npc};
}
for(const [label,vehicles]of [['omitted',undefined],['null',null],['empty',[]]])test(`checkpoint animation accepts ${label} traffic without a frame error`,()=>{
 const {system,npc}=fixture();assert.doesNotThrow(()=>system.updateNPC(npc,.016,0,0,{speed:0,riding:false},12,null,vehicles));assert.equal(npc.rig.bones['upperArm.R'].rotation.x,0);
});
test('checkpoint officer signals a nearby ambient vehicle, but not a distant one',()=>{
 const {system,npc}=fixture();system.updateNPC(npc,.016,0,0,{speed:0,riding:false},12,null,[{x:12,z:0}]);assert.equal(npc.rig.bones['upperArm.R'].rotation.x,-1.25);
 system.updateNPC(npc,.016,0,0,{speed:0,riding:false},12,null,[{x:200,z:0}]);assert.equal(npc.rig.bones['upperArm.R'].rotation.x,0);
});
test('checkpoint officer signals the player car even if ambient traffic is empty',()=>{
 const {system,npc}=fixture();system.car={x:12,z:0,speed:0};system.updateNPC(npc,.016,0,0,{speed:0,riding:true},12,null,[]);assert.equal(npc.rig.bones['upperArm.R'].rotation.x,-1.25);
});
