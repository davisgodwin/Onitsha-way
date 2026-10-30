// Original game clothing; existing IDs remain stable for old saves and NPCs.
export const OUTFIT_CATEGORIES = [['all','All looks'],['casual','Casual'],['smart','Smart & suits'],['traditional','Traditional'],['sport','Sport']];
const shared = [
 {id:'tee_shorts',label:'T-shirt & denim shorts',category:'casual',kind:'tee',shorts:true},
 {id:'linen_shorts',label:'Linen shirt & tailored shorts',category:'casual',kind:'shirt',shorts:true},
 {id:'cargo_shorts',label:'Polo & cargo shorts',category:'casual',kind:'polo',shorts:true,cargo:true},
 {id:'polo_chinos',label:'Polo & chinos',category:'smart',kind:'polo'},
 {id:'shirt_trousers',label:'Oxford shirt & trousers',category:'smart',kind:'shirt',long:true},
 {id:'suit',label:'Tailored suit · open collar',category:'smart',kind:'suit',long:true},
 {id:'suit_tie',label:'Two-piece suit & tie',category:'smart',kind:'suit',long:true,tie:true},
 {id:'hoodie_jeans',label:'Hoodie & jeans',category:'casual',kind:'hoodie',long:true},
 {id:'tracksuit',label:'Zip-up tracksuit',category:'sport',kind:'track',long:true},
];
export const OUTFITS = {
 male:[{id:'model_casual',label:'Classic casual shorts',category:'casual',kind:'tee'},{id:'model_shirt',label:'Relaxed shirt & trousers',category:'casual',kind:'shirt'},{id:'model_longsleeve',label:'Long-sleeve shirt',category:'smart',kind:'shirt'},{id:'model_suit',label:'Classic suit',category:'smart',kind:'suit'},{id:'ankara_jeans',label:'Ankara shirt & jeans',category:'traditional',kind:'shirt',print:true},{id:'tee_chinos',label:'T-shirt & chinos',category:'casual',kind:'tee'},{id:'senator',label:'Senator kaftan',category:'traditional',kind:'kaftan',long:true},...shared],
 female:[{id:'model_casual',label:'Classic casual trousers',category:'casual',kind:'tee'},{id:'model_alt',label:'Relaxed everyday shirt',category:'casual',kind:'shirt'},{id:'model_dress',label:'Plain colour dress',category:'smart',kind:'gown'},{id:'model_tank',label:'Classic summer shorts',category:'casual',kind:'tee'},{id:'ankara_top_jeans',label:'Ankara top & jeans',category:'traditional',kind:'shirt',print:true},{id:'ankara_gown',label:'Ankara gown',category:'traditional',kind:'gown',print:true},{id:'blouse_skirt',label:'Blouse & Ankara skirt',category:'traditional',kind:'blouse',print:true},...shared],
};
export const OUTFIT_COLORS=['#1d2b4f','#7a1f2b','#f1ead8','#2f5d3a','#3b3b3b','#c9a227','#e4c5b3','#87a8bf','#60466e','#b75b36','#f5f5f1','#172328'];
export const SHOE_COLORS=['#f0ede5','#181a1e','#6c412c','#873b3c'];
export function outfitInfo(gender,id){return (OUTFITS[gender]??OUTFITS.male).find(o=>o.id===id)??OUTFITS[gender==='female'?'female':'male'].find(o=>o.id===(gender==='female'?'ankara_top_jeans':'ankara_jeans'));}
