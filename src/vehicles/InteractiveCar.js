import {importedCar} from './ImportedCar.js';
/** Supplied exterior with clipped front side panels, true door apertures and a cabin. */
export function interactiveCar(model,paint,variant={}){const g=importedCar(model,paint,variant);if(!g)throw Error('Vehicle models must be loaded before creating cars');return g;}
/** v0.46: open only the door(s) on one side: side = +1 (the car's local +X) or -1; null opens both. */
export function setCarDoors(group,open,side=null){const u=group?.userData;if(!u?.doors)return;for(const d of u.doors){const at=Math.sign(d.hinge.position.x)||1;d.target=open&&(side==null||at===side)?1:0;}u.doorTarget=u.doors.some(d=>d.target)?1:0;}
export function tickCarDoors(group,dt){if(!group?.userData.doors)return;for(const d of group.userData.doors){d.amount??=0;d.target??=0;d.amount+=Math.sign(d.target-d.amount)*Math.min(Math.abs(d.target-d.amount),dt*2.8);d.hinge.rotation.y=d.side*d.amount*1.08;}group.userData.doorAmount=Math.max(0,...group.userData.doors.map(d=>d.amount));}
/** Which side of the car (local +X = +1, -X = -1) a point is on. heading = the car's heading (0 = facing +Z). */
export function carSideOf(heading,cx,cz,px,pz){const lx=Math.cos(heading),lz=-Math.sin(heading);return (px-cx)*lx+(pz-cz)*lz>=0?1:-1;}
