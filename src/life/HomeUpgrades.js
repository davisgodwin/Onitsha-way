import {DESIGN_GOODS} from '../buy/Catalogue.js';
import {HOME_GOODS,GOOD_BY_ID,PALETTES,resaleValue} from '../buy/Goods.js';
export {HOME_GOODS} from '../buy/Goods.js';
/** Most pieces one home can hold (placed + stored), and most of one item. Keeps saves and rooms sane. */
export const MAX_PIECES=160, MAX_OF_ONE=12;
const FLOOR_RE=/^[a-zA-Z][\w-]{0,30}$/;
/** v16 → v17: one piece per owned item, keeping its saved position, rotation and colour. */
export function migrateFurniturePieces(s){
  s.pieces=[];let n=1;
  for(const item of [...new Set(s.owned)]){
    if(!GOOD_BY_ID[item])continue;const old=s.placements?.[item],good=GOOD_BY_ID[item];
    const p={pid:'p'+n++,item};
    if(good.mount==='outdoor')p.floor='outdoor';
    else if(old&&old.floor==='storage')p.floor='storage';
    else if(old&&Number.isFinite(old.x)&&Number.isFinite(old.z)&&typeof old.floor==='string'){p.x=old.x;p.z=old.z;p.rotation=old.rotation??0;p.floor=old.floor;}
    else p.floor=null; // never positioned: the old game laid these out automatically, and so does this one
    if(old?.color)p.color=old.color;
    s.pieces.push(p);
  }
  s.nextPid=n;
  }
/**
 * Furniture per home (save v17). Every bought item is its own *piece* with a stable id (p1, p2…), so a home
 * can hold two armchairs, each placed, recoloured, stored or sold on its own.
 *   pieces: [{pid, item, color?, x?, z?, rotation?, floor}]   floor = layout id | 'storage' | 'outdoor' | null (auto-place)
 * `owned` and `placements` are kept as read-only summaries (one entry per item) for older code and tests.
 * Money moves only through Economy.transact with a key per piece, so a purchase or sale can never be applied twice.
 */
export class HomeUpgrades {
  constructor(state, { economy, housing }) { this.state = state; state.upgrades ??= {}; this.economy = economy; this.housing = housing; this.checked = new WeakSet(); }
  home(id) {
    const known=this.state.upgrades[id];if(known&&this.checked.has(known))return known;
    if(!this.state.upgrades[id]||typeof this.state.upgrades[id]!=='object'||Array.isArray(this.state.upgrades[id]))delete this.state.upgrades[id];
    const s=this.state.upgrades[id] ??= { pieces: [], nextPid: 1, owned: [], placements: {}, fuel: 0, battery: 0, generatorOn: false, inverterOn: true, paint: '#e9dec8' };
    if(!Array.isArray(s.owned))s.owned=[];
    s.fuel=Math.max(0,Math.min(10,Number.isFinite(s.fuel)?s.fuel:0));s.battery=Math.max(0,Math.min(100,Number.isFinite(s.battery)?s.battery:0));
    if(!s.placements||typeof s.placements!=='object'||Array.isArray(s.placements))s.placements={};
    if(!Array.isArray(s.pieces))this.migrate(s);
    s.pieces=s.pieces.filter(p=>p&&typeof p==='object'&&GOOD_BY_ID[p.item]&&typeof p.pid==='string');
    const seen=new Set();s.pieces=s.pieces.filter(p=>!seen.has(p.pid)&&seen.add(p.pid));
    for(const p of s.pieces)this.cleanPiece(p);
    if(!Number.isInteger(s.nextPid)||s.nextPid<1)s.nextPid=1;
    for(const p of s.pieces){const n=Number(p.pid.slice(1));if(Number.isInteger(n)&&n>=s.nextPid)s.nextPid=n+1;}
    if(!Array.isArray(s.designs))s.designs=[];
    if(!s.removedLamps||typeof s.removedLamps!=='object'||Array.isArray(s.removedLamps))s.removedLamps={};
    s.inverterOn ??= true;if(!s.applianceOn||typeof s.applianceOn!=='object'||Array.isArray(s.applianceOn))s.applianceOn={};
    this.sync(s);this.checked.add(s);return s;
  }
  migrate(s){migrateFurniturePieces(s);}
  cleanPiece(p){
    const good=GOOD_BY_ID[p.item];
    if(good.mount==='outdoor'){p.floor='outdoor';delete p.x;delete p.z;}
    else if(p.floor!=null&&p.floor!=='storage'&&(!FLOOR_RE.test(p.floor)||!Number.isFinite(p.x)||!Number.isFinite(p.z)||Math.abs(p.x)>100||Math.abs(p.z)>100)){p.floor='storage';delete p.x;delete p.z;}
    if(p.floor==='storage'){delete p.x;delete p.z;}
    p.rotation=Number.isFinite(p.rotation)?((Math.round(p.rotation)%360)+360)%360:0;
    if(p.color&&!/^#[0-9a-f]{6}$/i.test(p.color))delete p.color;
  }
  /** Summaries used by older readers: which items the home has, and where the first of each stands. */
  sync(s){
    s.owned=[...new Set(s.pieces.map(p=>p.item))];
    const pl={};for(const p of s.pieces){const placed=p.floor&&p.floor!=='storage';if(!pl[p.item]||(placed&&pl[p.item].floor==='storage'))pl[p.item]=placed&&p.floor!=='outdoor'?{x:p.x,z:p.z,rotation:p.rotation,floor:p.floor,...(p.color?{color:p.color}:{})}:{floor:p.floor==='outdoor'?'outdoor':'storage'};}
    s.placements=pl;
  }
  allowed(id) { return !!this.housing.get(id) && this.housing.access(id).use; }
  pieces(homeId){return this.home(homeId).pieces;}
  piece(homeId,pid){return this.home(homeId).pieces.find(p=>p.pid===pid)??null;}
  count(homeId,item){return this.home(homeId).pieces.filter(p=>p.item===item).length;}
  validColor(item,color){if(!color)return true;const pal=PALETTES[GOOD_BY_ID[item]?.variants];return !!pal&&pal.colors.some(c=>c[1]===color);}
  /**
   * Pay for one new piece. It arrives in home storage (outdoor items are installed outside straight away).
   * `fee` is a delivery charge for phone orders; it is paid in the same transaction as the item.
   */
  buy(homeId, itemId, { color = null, fee = 0, via = 'shop' } = {}) {
    const it = GOOD_BY_ID[itemId];
    if (!this.allowed(homeId)) return { ok: false, error: 'rent-required' };
    if (!it) return { ok: false, error: 'unknown-item' };
    if (!this.validColor(itemId,color)) return { ok: false, error: 'unknown-colour' };
    const s = this.home(homeId);
    if (s.pieces.length >= MAX_PIECES) return { ok: false, error: 'home-full' };
    if (s.pieces.filter(p=>p.item===itemId).length >= MAX_OF_ONE) return { ok: false, error: 'too-many' };
    fee=Math.max(0,Math.round(Number(fee)||0));
    let pid,tx;
    // A piece id is never reused, even after a sale: skip any id the ledger has already seen.
    for(let tries=0;tries<50;tries++){pid='p'+s.nextPid;tx=this.economy.transact({ key: `furnish:${homeId}:${pid}`, amount: -(it.price+fee), reason: `Home: ${it.label}${fee?' + delivery':''}`, ref:{home:homeId,piece:pid,item:itemId,via} });if(tx.error!=='duplicate')break;s.nextPid++;}
    if (!tx.ok) return tx;
    s.nextPid++;
    const piece={pid,item:itemId,floor:it.mount==='outdoor'?'outdoor':'storage',rotation:0};if(color)piece.color=color;
    s.pieces.push(piece);this.sync(s);
    return { ok: true, item: it, piece };
  }
  /** Sell a piece back for its resale value. The key is per piece, so a sale pays exactly once. */
  sell(homeId,pid){
    if(!this.allowed(homeId))return{ok:false,error:'rent-required'};
    const s=this.home(homeId),i=s.pieces.findIndex(p=>p.pid===pid);if(i<0)return{ok:false,error:'not-owned'};
    const piece=s.pieces[i],good=GOOD_BY_ID[piece.item],value=resaleValue(good.price);
    if(value>0){const tx=this.economy.transact({key:`sell-furniture:${homeId}:${pid}`,amount:value,reason:`Sold: ${good.label}`,ref:{home:homeId,piece:pid,item:piece.item}});if(!tx.ok)return tx;}
    s.pieces.splice(i,1);
    if(!s.pieces.some(p=>p.item===piece.item)){delete s.applianceOn[piece.item];if(s.lightOn)delete s.lightOn[piece.item];}
    if(good.power==='generator'&&!this.hasEquipment(homeId,'generator'))s.generatorOn=false;
    this.sync(s);return{ok:true,value,piece};
  }
  place(homeId,pid,{x,z,rotation=0,floor}){
    if(!this.allowed(homeId))return{ok:false,error:'rent-required'};
    const s=this.home(homeId),p=s.pieces.find(q=>q.pid===pid);if(!p)return{ok:false,error:'not-owned'};
    if(GOOD_BY_ID[p.item].mount==='outdoor')return{ok:false,error:'outdoor-item'};
    if(![x,z,rotation].every(Number.isFinite)||!FLOOR_RE.test(floor??''))return{ok:false,error:'Invalid position'};
    Object.assign(p,{x:Math.round(x*100)/100,z:Math.round(z*100)/100,rotation:((Math.round(rotation)%360)+360)%360,floor});this.sync(s);return{ok:true,piece:p};
  }
  store(homeId,pid){
    const s=this.home(homeId),p=s.pieces.find(q=>q.pid===pid);if(!p)return{ok:false,error:'not-owned'};
    if(GOOD_BY_ID[p.item].mount==='outdoor')return{ok:false,error:'outdoor-item'};
    p.floor='storage';delete p.x;delete p.z;this.sync(s);return{ok:true,piece:p};
  }
  recolor(homeId,pid,color){
    const s=this.home(homeId),p=s.pieces.find(q=>q.pid===pid);if(!p)return{ok:false,error:'not-owned'};
    if(!this.validColor(p.item,color))return{ok:false,error:'unknown-colour'};
    if(color)p.color=color;else delete p.color;this.sync(s);return{ok:true,piece:p};
  }
  ownsDesign(homeId,design){return design.price===0||this.home(homeId).designs?.includes(`${design.type}:${design.id}`);}
  buyDesign(homeId,designId,type){
    const design=DESIGN_GOODS.find(d=>d.id===designId&&d.type===type);
    if(!this.allowed(homeId))return{ok:false,error:'rent-required'};
    if(!design)return{ok:false,error:'unknown-design'};
    const state=this.home(homeId),key=`${type}:${design.id}`;
    if(!this.ownsDesign(homeId,design)){const tx=this.economy.transact({key:`design:${homeId}:${key}`,amount:-design.price,reason:`Home ${type}: ${design.label}`});if(!tx.ok)return tx;state.designs??=[];state.designs.push(key);}
    state[type==='paint'?'paint':'floor']=design.color;return{ok:true,design};
  }
  refuel(homeId, inventory) {
    if (!this.allowed(homeId)) return { ok: false, error: 'rent-required' };
    const s = this.home(homeId);
    if (!this.hasEquipment(homeId,'generator')) return { ok: false, error: 'no-generator' };
    if (s.fuel > 5) return { ok: false, error: 'tank-full' };
    if (!inventory.has('jerrycan')) return { ok: false, error: 'buy-jerrycan' };
    inventory.remove('jerrycan', 1); s.fuel += 5; return { ok: true };
  }
  /** Equipment counts only when installed: placed in a room or installed outside. */
  hasEquipment(homeId,type){return this.home(homeId).pieces.some(p=>{const g=GOOD_BY_ID[p.item];return(type==='solar'?g.solar:g.power===type)&&p.floor&&p.floor!=='storage';});}
  isPlaced(homeId,item){return this.home(homeId).pieces.some(p=>p.item===item&&p.floor&&p.floor!=='storage');}
  powered(homeId, grid = true) { const s = this.home(homeId); return grid || (this.hasEquipment(homeId,'generator') && s.generatorOn && s.fuel > 0) || (this.hasEquipment(homeId,'battery') && s.inverterOn && s.battery > 0); }
  setBackup(homeId,type,on) {
    if(!this.allowed(homeId))return{ok:false,error:'Home access required'};
    if(!['battery','generator'].includes(type)||!this.hasEquipment(homeId,type))return{ok:false,error:'Buy and install this equipment first'};
    const s=this.home(homeId);if(on&&type==='generator'&&s.fuel<=0)return{ok:false,error:'Add fuel first'};
    s[type==='battery'?'inverterOn':'generatorOn']=!!on;return{ok:true};
  }
  powerStatus(homeId,grid=true) {
    const s=this.home(homeId),battery=this.hasEquipment(homeId,'battery'),generator=this.hasEquipment(homeId,'generator')&&s.generatorOn&&s.fuel>0;
    return {grid,source:grid?'Grid':generator?'Generator':battery&&s.inverterOn&&s.battery>0?'Inverter battery':'No power',battery:s.battery,fuel:s.fuel,charging:grid&&battery&&s.battery<100,solar:this.hasEquipment(homeId,'solar'),backupEnabled:!!s.inverterOn};
  }
  applianceRunning(homeId,id,grid=true) {const s=this.home(homeId);return this.isPlaced(homeId,id)&&s.applianceOn[id]===true&&(GOOD_BY_ID[id]?.rechargeable||this.powered(homeId,grid));}
  /**
   * Called once per elapsed GAME minute, including sleeps/travel, for every home.
   * `sun` (daylight hours) lets a solar system charge the batteries during a grid outage.
   */
  advance(minutes, grid, sun = false) {
    if (!Number.isFinite(minutes) || minutes <= 0) return;
    for (const id of Object.keys(this.state.upgrades)) {
      const s = this.home(id);
      let poweredMinutes = grid ? minutes : 0;
      if (!grid && this.hasEquipment(id,'generator') && s.generatorOn) { const run = Math.min(minutes, s.fuel * 120); s.fuel = Math.max(0, s.fuel - run / 120); poweredMinutes += run; if (s.fuel <= 0) s.generatorOn = false; }
      if (this.hasEquipment(id,'battery')) {
        if (grid) s.battery = Math.min(100, s.battery + minutes * 100 / 240);
        else if (sun && this.hasEquipment(id,'solar')) s.battery = Math.min(100, s.battery + minutes * 100 / 300);
        else if (s.inverterOn) s.battery = Math.max(0, s.battery - Math.max(0, minutes - poweredMinutes) * 100 / 360);
      }
    }
  }
}
