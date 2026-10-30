export const AD_AREAS=['upper-iweka','shoprite','main-market','bridgehead'];
export const BILLBOARD_CATALOGUE=AD_AREAS.flatMap(area=>Array.from({length:50},(_,i)=>({id:`${area}-${String(i+1).padStart(3,'0')}`,area,number:i+1})));
export const safeBusinessLink=value=>{if(!value)return '';try{const u=new URL(String(value));if(!['https:','http:'].includes(u.protocol)||u.username||u.password||u.href.length>2048)return null;return u.href;}catch{return null;}};
