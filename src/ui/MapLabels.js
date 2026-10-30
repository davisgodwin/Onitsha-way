/**
 * Small collision-aware screen-space label allocator. Markers remain even if text is suppressed.
 * v0.35: pins and the map's header panel are blocked first so text never covers them, and the same name is not
 * repeated close to itself (phones showed "Old Market Road" six times on top of the pins).
 */
export class MapLabels {
 constructor(width,height){this.width=width;this.height=height;this.boxes=[];this.texts=new Map();}
 hits(x,y,w,h){return this.boxes.some(b=>x<b.x+b.w+5&&x+w+5>b.x&&y<b.y+b.h+4&&y+h+4>b.y);}
 /** Mark an area as taken (pins, the header panel) without the edge checks. */
 block(x,y,w,h){this.boxes.push({x,y,w,h,blocked:true});}
 reserve(x,y,w,h){if(x<8||y<8||x+w>this.width-8||y+h>this.height-8||this.hits(x,y,w,h))return false;this.boxes.push({x,y,w,h});return true;}
 /** True if this text was already drawn within `radius` px. */
 repeated(text,x,y,radius=220){return (this.texts.get(text)??[]).some(p=>Math.hypot(p.x-x,p.y-y)<radius);}
 note(text,x,y){const l=this.texts.get(text)??[];l.push({x,y});this.texts.set(text,l);}
 place(x,y,w,h=18,text=null){if(text&&this.repeated(text,x,y))return null;for(const dy of[0,21,-21,42,-42])for(const dx of[0,-w-24])if(this.reserve(x+dx,y+dy,w,h)){if(text)this.note(text,x+dx,y+dy);return{x:x+dx,y:y+dy};}return null;}
}
