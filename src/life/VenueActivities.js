export function dancePose(h,t){
 const b=h.bones;
 b.hips.rotation.z=.11*Math.sin(t);b.hips.rotation.y=.12*Math.sin(t*.5);
 b.spine.rotation.y=.2*Math.sin(t);b.chest.rotation.z=.08*Math.cos(t);
 b['upperArm.L'].rotation.set(-.45-.35*Math.sin(t),0,.38);
 b['upperArm.R'].rotation.set(-.45+.35*Math.sin(t),0,-.38);
 b['foreArm.L'].rotation.x=-.9;b['foreArm.R'].rotation.x=-.9;
 b['thigh.L'].rotation.x=.22*Math.sin(t);b['thigh.R'].rotation.x=-.22*Math.sin(t);
 b['shin.L'].rotation.x=.15+.12*Math.max(0,Math.sin(t));b['shin.R'].rotation.x=.15+.12*Math.max(0,-Math.sin(t));
}
export function drinkPose(h,t){
 const b=h.bones,raise=.5+.5*Math.sin(t*.7);
 b['upperArm.R'].rotation.set(-.5-.6*raise,0,-.16);
 b['foreArm.R'].rotation.set(-1.1-.6*raise,0,0);
 b.head.rotation.x=-.06*raise;
}
