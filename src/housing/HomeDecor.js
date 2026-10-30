import * as THREE from 'three';
import {GOOD_BY_ID,isNonBlocking} from '../buy/Goods.js';
import {furnitureModel,disposeModel} from '../buy/FurnitureModels.js';
import {furniturePolygon,validatePlacement,FURNITURE_SIZE,wallSegments,snapToWall,pointInPolygon} from './Placement.js';
const MAX_LAMPS=4;
/**
 * Draws the furniture of the home you are in (one record per placed piece), the outdoor items of all your homes,
 * and — when you visit someone — the host's furniture from the snapshot they share.
 */
export class HomeDecor {
  constructor(game) { this.g=game;this.group=new THREE.Group();this.group.name='PlayerHomeDecor';game.renderer.scene.add(this.group);this.polys=[];this.offs=[];this.outdoor=new THREE.Group();this.outdoor.name='OutdoorFurniture';game.renderer.scene.add(this.outdoor);this.outdoorCircles=[];this.outdoorOffs=[];this.records=[]; }
  clear() { for(const off of this.offs)off();this.offs=[];for(const p of this.polys)this.g.world.collision.removePolygon(p);this.polys=[];for(const c of [...this.group.children])disposeModel(c);this.records=[];this.inside=null;this.upgrades=null; }
  obstacles(lay){return lay.polys.map(i=>this.g.world.collision.polys[i]?.pts).filter(Boolean);}
  protectedPoints(lay,player=true){return[{...lay.spawn,radius:1},...lay.items.filter(i=>i.kind!=='decorate').map(i=>({...i,radius:i.kind==='door'||i.kind==='stairs'?1.1:.65})),...(player?[{...this.g.player.position,radius:.65}]:[])];}
  /** Height at which a surface item stands at (x,z): on top of a table/cabinet/bed if one is there, else the floor. */
  supportAt(x,z,exceptPid=null,bedOnly=false){let best=null;for(const r of this.records){if(r.pid===exceptPid)continue;const g=GOOD_BY_ID[r.id];if(bedOnly?g.action!=='bed':!g.top&&g.action!=='bed')continue;if(pointInPolygon(x,z,r.polygon)&&(!best||r.top>best.top))best=r;}return best;}
  /** Turn a raw floor position into where the item will really go (wall items snap to the nearest wall). */
  resolve(id,draft,lay=this.inside?.layout){
    const good=GOOD_BY_ID[id];if(!good||!lay)return draft;
    if(good.mount==='wall'){const s=snapToWall(id,lay.origin.x+draft.x,lay.origin.z+draft.z,wallSegments(lay.bounds,this.obstacles(lay)));return s?{...draft,x:s.x-lay.origin.x,z:s.z-lay.origin.z,rotation:s.rotation,snapped:true}:{...draft,snapped:false};}
    if(good.mount==='bedding'){const bed=this.supportAt(lay.origin.x+draft.x,lay.origin.z+draft.z,draft.pid,true);return bed?{...draft,x:bed.x-lay.origin.x,z:bed.z-lay.origin.z,rotation:bed.rotation,bed:bed.pid}:{...draft,bed:null};}
    return draft;
  }
  render(inside,upgrades) {
    this.clear();this.freeSocket=null;this.storedForLayout=[];if(!inside || inside.host || inside.viewing)return;
    const {layout:lay}=inside, s=upgrades, col=this.g.world.collision;this.inside=inside;this.upgrades=s;
    const used=[]; const spot=(r=.5,commit=true)=>{for(let z=lay.bounds.minZ+.65;z<lay.bounds.maxZ-.65;z+=.65)for(let x=lay.bounds.minX+.65;x<lay.bounds.maxX-.65;x+=.65){if(Math.hypot(x-lay.spawn.x,z-lay.spawn.z)<1.5 || lay.items.some(i=>i.kind!=='decorate' && Math.hypot(x-i.x,z-i.z)<(i.kind==='door'||i.kind==='stairs'||i.kind==='bathroom'?1.4:.95)) || used.some(p=>Math.hypot(x-p.x,z-p.z)<r+p.r+.3))continue;if(!col.isFree(x,z,r+.12))continue;if(commit)used.push({x,z,r});return{x,z};}return null;};
    this.freeSocket=r=>spot(r,false);
    const order=p=>{const m=GOOD_BY_ID[p.item].mount;return m==='surface'?2:m==='bedding'?3:isNonBlocking(p.item)?0:1;};
    const pieces=s.pieces.filter(p=>p.floor===lay.id||p.floor==null).sort((a,b)=>order(a)-order(b));
    let changed=false;
    for(const p of pieces){
      const good=GOOD_BY_ID[p.item];if(!good||good.mount==='outdoor')continue;
      if(p.floor==null){ // an item from an old save that was never positioned: lay it out once, like before
        const [w,d]=FURNITURE_SIZE[p.item]??[1,1],r=Math.max(w,d)/2,at=good.mount==='floor'&&!good.nonSolid?spot(Math.min(1.1,r)):null;
        let draft=at?this.resolve(p.item,{x:at.x-lay.origin.x,z:at.z-lay.origin.z,rotation:0,pid:p.pid},lay):this.findSpot(p.item,p.pid,{player:false});
        if(!draft||this.check(p.item,draft,p.pid,{player:false}).ok!==true)draft=this.findSpot(p.item,p.pid,{player:false})??draft;
        if(!draft||this.check(p.item,draft,p.pid,{player:false}).ok!==true){p.floor='storage';this.storedForLayout.push(p.item);changed=true;continue;}
        Object.assign(p,{x:draft.x,z:draft.z,rotation:draft.rotation??0,floor:lay.id});changed=true;
      } else if(good.mount==='floor'&&!good.nonSolid&&this.check(p.item,p,p.pid,{player:false,free:true}).ok!==true){p.floor='storage';delete p.x;delete p.z;this.storedForLayout.push(p.item);changed=true;continue;}
      this.addRecord(p,lay,{interactive:true});
    }
    if(changed)this.g.homeUpgrades?.sync?.(s);
    this.updateAppliances(0);
    if(this.storedForLayout.length)this.g.ui.toast(`${this.storedForLayout.length} item${this.storedForLayout.length>1?'s':''} didn't fit this room and went to storage. Place ${this.storedForLayout.length>1?'them':'it'} again in Buy mode.`);
  }
  /** Position a model for a piece the way it will stand: on the floor, on a wall, under the ceiling, on a table or on a bed. Returns the height of its top surface above its base (for things placed on it). */
  poseModel(item,p,lay){
    const good=GOOD_BY_ID[p.item],x=lay.origin.x+p.x,z=lay.origin.z+p.z,rotation=p.rotation??0;
    item.position.set(x,0,z);item.rotation.y=-rotation*Math.PI/180;item.scale.set(1,1,1);item.visible=true;
    const h=item.userData.height;
    if(good.mount==='wall'){const y=Math.min((lay.ceiling??2.9)-h-.02,Math.max(.05,(good.y??1.6)-h/2));item.position.y=y;item.userData.wallMountY=y;}
    else if(good.mount==='ceiling'){item.position.y=(lay.ceiling??2.9)-h-.005;}
    else if(good.mount==='surface'){const sup=this.supportAt(x,z,p.pid);if(sup)item.position.y=sup.top;}
    else if(good.mount==='bedding'){const bed=this.supportAt(x,z,p.pid,true);if(bed){const[w,d]=FURNITURE_SIZE[bed.id];item.position.set(bed.x,bed.top+(p.item==='duvet'?.012:p.item==='bedpillows'?.03:0),bed.z);item.rotation.y=-bed.rotation*Math.PI/180;item.scale.set(w*.94,1,d*.92);}else item.visible=false;}
    return good.top||good.action==='bed'?(good.action==='bed'?h*(good.model==='k:bedBunk'?.27:.62):h):0;
  }
  /** Draw one piece. Returns the record. */
  addRecord(p,lay,{interactive=false,collide=true}={}){
    const good=GOOD_BY_ID[p.item],col=this.g.world.collision,x=lay.origin.x+p.x,z=lay.origin.z+p.z,rotation=p.rotation??0;
    const item=furnitureModel(p.item,p.color);item.userData.pid=p.pid;
    const top=this.poseModel(item,p,lay),h=item.userData.height;
    if(good.action==='spin'||good.spin){const spinner=new THREE.Group();spinner.name='fan-rotor-y';while(item.children.length)spinner.add(item.children[0]);item.add(spinner);}
    if(good.action==='light'&&this.records.filter(r=>r.lamp).length<MAX_LAMPS){const L=new THREE.PointLight('#ffd9a0',0,good.mount==='ceiling'?6:4.5,1.6);L.position.y=good.mount==='ceiling'?-.1:Math.min(h,1.5);L.name='lamp-light';item.add(L);item.userData.lamp=L;}
    this.group.add(item);
    const polygon=furniturePolygon(p.item,x,z,rotation);
    const rec={pid:p.pid,id:p.item,x,z,rotation,polygon,item,top:item.position.y+top,mount:good.mount,lamp:item.userData.lamp};this.records.push(rec);
    if(collide&&good.mount==='floor'&&!isNonBlocking(p.item))this.polys.push(col.addPolygon(polygon,1.6));
    if(interactive&&good.action&&good.mount!=='bedding'){const inside=this.inside;this.offs.push(this.g.interactions.register({x,z,radius:good.mount==='ceiling'||good.mount==='wall'?2.2:1.8,enabled:()=>this.g.homes.inside===inside,label:()=>{const st=this.g.homeUpgrades.home(inside.home.id);return good.power?`${good.label} — ${good.power==='battery'?Math.round(st.battery)+'% battery':st.fuel.toFixed(1)+' L fuel'} · manage power`:`${good.label} — use`;},onInteract:()=>this.g.openChoice(()=>this.g.homes.upgradeView(p.item))}));}
    return rec;
  }
  /** Placement check for a piece (pid) or a new item (pid null). */
  check(id,draft,pid=null,{player=true,free=false}={}){
    const lay=this.inside?.layout;if(!lay)return{ok:false,error:'Rent and enter your home first'};
    const good=GOOD_BY_ID[id];
    if(good?.mount==='outdoor')return{ok:false,error:'This goes outside: it is installed by your front door'};
    if(good?.mount==='wall'&&draft.snapped===false)return{ok:false,error:'Move it closer to a wall'};
    if(good?.mount==='bedding'&&!draft.bed)return{ok:false,error:'Put bedding on a bed'};
    const others=this.records.filter(r=>r.pid!==pid);
    // v0.52: free placement: the player puts things where they like (they may overlap other furniture, fittings and
    // walls); only the room's outline and a clear doorway / staircase are kept
    if(free)return validatePlacement({id,x:lay.origin.x+draft.x,z:lay.origin.z+draft.z,rotation:draft.rotation??0,bounds:lay.bounds,obstacles:[],others:[],wallOthers:[],ceilingOthers:[],
      protectedPoints:lay.items.filter(i=>i.kind==='door'||i.kind==='stairs').map(i=>({...i,radius:.45}))});
    return validatePlacement({id,x:lay.origin.x+draft.x,z:lay.origin.z+draft.z,rotation:draft.rotation??0,bounds:lay.bounds,obstacles:this.obstacles(lay),
      others:others.filter(r=>r.mount==='floor'&&!isNonBlocking(r.id)).map(r=>r.polygon),
      wallOthers:others.filter(r=>r.mount==='wall').map(r=>furniturePolygon(r.id,r.x,r.z,r.rotation,0)),
      ceilingOthers:others.filter(r=>r.mount==='ceiling').map(r=>r.polygon),
      protectedPoints:this.protectedPoints(lay,player)});
  }
  /** First clear spot for an item in this room (scans the floor plan; wall items snap to walls as they go). */
  findSpot(item,pid=null,opts={}){const lay=this.inside?.layout;if(!lay)return null;const good=GOOD_BY_ID[item];
    if(good.mount==='bedding'){const bed=this.records.find(r=>GOOD_BY_ID[r.id].action==='bed');return bed?this.resolve(item,{x:bed.x-lay.origin.x,z:bed.z-lay.origin.z,rotation:0,pid},lay):null;}
    if(good.mount==='surface'){const t=this.records.find(r=>GOOD_BY_ID[r.id].top);if(t)return{x:t.x-lay.origin.x,z:t.z-lay.origin.z,rotation:0,pid};}
    for(const rotation of[0,90])for(let z=.5;z<lay.size[1]-.3;z+=.25)for(let x=.5;x<lay.size[0]-.3;x+=.25){const d=this.resolve(item,{x,z,rotation,pid},lay);if(this.check(item,d,pid,opts).ok)return d;}
    return null;}
  /** Move a piece you own to a spot in this room (used by the phone floor plan and Buy mode). */
  placePiece(pid,raw){const u=this.g.homeUpgrades,i=this.inside;if(!i)return{ok:false,error:'Enter your home first'};const piece=u.piece(i.home.id,pid);if(!piece)return{ok:false,error:'You do not own that item'};const draft=this.resolve(piece.item,{...raw,pid});const r=this.checkPlacement(piece.item,draft,pid);if(!r.ok)return r;const res=u.place(i.home.id,pid,{x:draft.x,z:draft.z,rotation:draft.rotation??0,floor:i.layout.id});if(!res.ok)return res;this.g.homes.refreshDecor();this.g.homes.applyLight();this.g.saveGame();return{ok:true};}
  /** Older one-of-each API (phone editor, tests): acts on the first piece of that item in this home. */
  place(item,draft){const i=this.inside;if(!i)return{ok:false,error:'Enter your home first'};const p=this.g.homeUpgrades.pieces(i.home.id).find(q=>q.item===item);if(!p)return{ok:false,error:'Buy this item first'};const r=this.placePiece(p.pid,draft);if(r.ok&&draft.color&&this.g.homeUpgrades.validColor(item,draft.color)){this.g.homeUpgrades.recolor(i.home.id,p.pid,draft.color);this.g.homes.refreshDecor();this.g.saveGame();}return r;}
  store(item){const i=this.inside;const p=i&&this.g.homeUpgrades.pieces(i.home.id).find(q=>q.item===item);return p?this.storePiece(p.pid):{ok:false};}
  storePiece(pid){const i=this.inside;if(!i)return{ok:false};const r=this.g.homeUpgrades.store(i.home.id,pid);if(r.ok){this.g.homes.refreshDecor();this.g.homes.applyLight();this.g.saveGame();}return r;}
  checkPlacement(id,draft,pid=null){if(!this.inside||!this.g.homes.housing.access(this.inside.home.id).use)return{ok:false,error:'Rent and enter your home first'};return this.check(id,draft,pid,{free:true});}
  canFit(id) { const g=GOOD_BY_ID[id];return !!g?.fixed || g?.mount!=='floor' || !!this.freeSocket?.(Math.min(1.1,Math.max(...(FURNITURE_SIZE[id]??[1,1]))/2)); }
  /** Draw a host's furniture for a visitor. `snap` is the shared snapshot: {paint, floor, pieces:[[item,color,x,z,rot,floor]]}. */
  renderGuest(inside,snap){
    this.clear();if(!inside||!snap)return;const lay=inside.layout;this.inside=inside;
    const pieces=(snap.pieces??[]).filter(a=>a[5]===lay.id&&GOOD_BY_ID[a[0]]).map((a,i)=>({pid:'g'+i,item:a[0],color:a[1]||undefined,x:a[2],z:a[3],rotation:a[4]})).sort((a,b)=>(GOOD_BY_ID[a.item].mount==='bedding')-(GOOD_BY_ID[b.item].mount==='bedding'));
    for(const p of pieces){if(GOOD_BY_ID[p.item].mount==='bedding'){const bed=this.supportAt(lay.origin.x+p.x,lay.origin.z+p.z,null,true);p.bed=bed?.pid;}this.addRecord(p,lay,{interactive:false,collide:true});}
  }
  updateAppliances(dt=0) {
    const i=this.g.homes.inside;if(!i||i.viewing&&!this.records.length)return;
    const guest=!!i.host||i.viewing;const u=this.g.homeUpgrades,state=guest?null:u?.home(i.home.id);
    const grid=this.g.weather?.power.on??true,powered=guest?grid:u.powered(i.home.id,grid);
    let tvOn=false;
    for(const r of this.records){const good=GOOD_BY_ID[r.id],running=guest?false:state.applianceOn[r.id]===true&&(powered||good.rechargeable);
      if(!r.controls){r.controls=[];r.item.traverse(n=>{if(['appliance-screen','fan-rotor','fan-rotor-y','power-indicator'].includes(n.name))r.controls.push(n);});}
      for(const n of r.controls){
        if(n.name==='fan-rotor'){if(running)n.rotation.z+=dt*18;continue;}
        if(n.name==='fan-rotor-y'){if(running)n.rotation.y+=dt*9;continue;}
        if(n.name==='power-indicator'){if(guest)continue;const active=good.power==='battery'?state.inverterOn&&state.battery>0:state.generatorOn&&state.fuel>0,charging=good.power==='battery'&&grid&&state.battery<100,c=charging?'#eab64e':active?'#74d88a':'#d75548';if(n.userData.status===c)continue;n.userData.status=c;n.material.color.set(c);n.material.emissive?.set(c);n.material.emissiveIntensity=.55;continue;}
        if(n.name==='appliance-screen'){const tv=good.action==='tv'&&this.g.tvShows;if(running&&tv)tvOn=true;if(n.userData.running===running)continue;n.userData.running=running;
          // v0.50: a TV that is on shows the programme (TVShows draws it); other screens just light up
          if(tv){n.userData.offMat??=n.material;n.material=running?this.g.tvShows.material:n.userData.offMat;continue;}
          n.material.color.set(running?'#71b9d5':'#111b20');n.material.emissive?.set(running?'#4f91b6':'#000000');n.material.emissiveIntensity=running?.6:0;}
      }
    }
    this.g.tvShows?.update(dt,tvOn);
  }
  /** Lamps: emissive shades plus a few real lights. `on(record)` says whether that lamp is lit. */
  setLamps(on){for(const r of this.records){const good=GOOD_BY_ID[r.id];if(good.action!=='light'&&!good.outdoorLight)continue;const lit=on(r);r.item.traverse(n=>{if(n.material?.emissive&&n.material.name!=='led')n.material.emissiveIntensity=lit?.65:0;});if(r.lamp)r.lamp.intensity=lit?(good.mount==='ceiling'?2.2:1.4):0;}}
  /** Everything for the guest snapshot of the home you are standing in (all floors). */
  snapshot(homeId){const s=this.g.homeUpgrades?.home(homeId);if(!s)return null;return{paint:s.paint,floor:s.floor??null,pieces:s.pieces.filter(p=>p.floor&&p.floor!=='storage'&&p.floor!=='outdoor').slice(0,160).map(p=>[p.item,p.color??'',p.x,p.z,p.rotation??0,p.floor])};}
  /** Outdoor items of all your homes, set out by each front door (they are not dragged; their spot is chosen for you). */
  renderOutdoor() {
    const g=this.g;if(!g.homeUpgrades)return;
    const records=Object.entries(g.homeUpgrades.state.upgrades).flatMap(([home,s])=>(s.pieces??[]).filter(p=>GOOD_BY_ID[p.item]?.mount==='outdoor').map(p=>({home,p,s})));
    const night=(g.atmosphere?.nightK??0)>.4;
    const key=records.map(({home,p,s})=>`${home}:${p.pid}:${p.color??''}:${s.generatorOn&&s.fuel>0}`).join('|')+night;if(key===this.outdoorKey)return;this.outdoorKey=key;
    for(const off of this.outdoorOffs)off();this.outdoorOffs=[];
    for(const i of this.outdoorCircles)g.world.collision.removeCircle(i);this.outdoorCircles=[];
    for(const c of [...this.outdoor.children])disposeModel(c);
    const perHome={},facadeHome={};
    for(const {home,p} of records){
      const h=g.homes.housing.get(home);if(!h)continue;const good=GOOD_BY_ID[p.item],d=h.door;
      const model=furnitureModel(p.item,p.color);model.userData.pid=p.pid;
      if(good.facade){ // fixed to the wall beside the door
        const n=facadeHome[home]=(facadeHome[home]??0)+1,side=n%2?1:-1,off=1.1+Math.floor((n-1)/2)*.7;
        model.position.set(d.x+d.ux*side*off+d.nx*.12,good.facade,d.z+d.uz*side*off+d.nz*.12);model.rotation.y=Math.atan2(d.nx,d.nz);
      } else {
        const n=perHome[home]=(perHome[home]??0)+1,side=n%2?1:-1,along=2.6+Math.floor((n-1)/2)*1.7,out=good.power?1:1.6;
        const[x,z]=g.world.findFreeSpot(d.stand.x+d.ux*side*along+d.nx*out,d.stand.z+d.uz*side*along+d.nz*out,good.flat?.3:.7);
        model.position.set(x,0,z);model.rotation.y=Math.atan2(d.nx,d.nz)+(good.power?0:Math.PI);
        if(!good.flat)this.outdoorCircles.push(g.world.collision.addCircle(x,z,good.id==='watertank'?.9:good.id==='solar'?1.4:.55));
        if(good.action==='power')this.outdoorOffs.push(g.interactions.register({x,z,radius:2,enabled:()=>!g.homes.inside&&g.homeUpgrades.allowed(home),label:()=>good.label+' — manage power',onInteract:()=>g.openChoice(()=>g.homes.powerView(home,p.item))}));
      }
      if(good.outdoorLight)model.traverse(n=>{if(n.material?.emissive)n.material.emissiveIntensity=night?.9:0;});
      this.outdoor.add(model);
    }
  }
}
