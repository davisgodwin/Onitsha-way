import {segDistSq,pointInPolygon} from '../core/utils.js';
/** Keep pole shafts and crossarm envelopes outside all carriageways and home paths. */
export function safePoleSite(map,collision,x,z,r=.55){
 if(map.stadiumSite&&pointInPolygon(x,z,map.stadiumSite.pts))return false;
 if(!collision.isFree(x,z,r)||map.inHomeAccess?.(x,z,r)||(map.water??[]).some(w=>pointInPolygon(x,z,w.outer)))return false;
 const c=map.cell??40,gx=Math.floor(x/c),gz=Math.floor(z/c),seen=new Set();
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const i of map.grid.get(`${gx+dx},${gz+dz}`)??[]){if(seen.has(i))continue;seen.add(i);const s=map.segments[i];if(['footway','path','steps','pedestrian'].includes(s.road.type))continue;if(segDistSq(x,z,s.ax,s.az,s.bx,s.bz)<(s.road.width/2+r+.65)**2)return false;}return true;
}
/** Local X is (cos yaw, -sin yaw), matching the actual crossarm mesh. */
export const wirePin=(p,offset)=>({x:p.x+Math.cos(p.yaw)*offset,y:8.7,z:p.z-Math.sin(p.yaw)*offset});
