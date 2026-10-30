import {HOME_GOODS,TABS} from './Goods.js';
export const BUY_CATEGORIES=[['design','Design'],...TABS];
export const DESIGN_GOODS=[
 {id:'cream',type:'paint',label:'Classic Cream',color:'#e9dec8',price:0},
 {id:'river',type:'paint',label:'River Blue',color:'#a3c7db',price:0},
 {id:'mint',type:'paint',label:'Garden Mint',color:'#a1cdb5',price:0},
 {id:'peach',type:'paint',label:'Peach Clay',color:'#e6ad8c',price:3000},
 {id:'lilac',type:'paint',label:'Soft Lilac',color:'#b6a1cd',price:3000},
 {id:'green',type:'paint',label:'Ogene Green',color:'#438e69',price:4000},
 {id:'charcoal',type:'paint',label:'Charcoal',color:'#656b73',price:5000},
 {id:'gold',type:'paint',label:'Festival Gold',color:'#d6b34d',price:6000},
 {id:'terracotta',type:'paint',label:'Market Terracotta',color:'#bd826b',price:3500},
 {id:'rose',type:'paint',label:'Dusty Rose',color:'#cda4a7',price:4000},
 {id:'navy',type:'paint',label:'Deep River Navy',color:'#52647e',price:5500},
 {id:'linen',type:'paint',label:'Soft Linen',color:'#dedad1',price:2500},
 {id:'ivory',type:'floor',label:'Ivory Tile',color:'#ffffff',price:0},
 {id:'sand',type:'floor',label:'Warm Sand',color:'#e8d2b0',price:0},
 {id:'slate',type:'floor',label:'River Slate',color:'#a8b8c5',price:3500},
 {id:'clay',type:'floor',label:'Terracotta',color:'#ca9c83',price:4000},
 {id:'sage',type:'floor',label:'Sage Tile',color:'#b3c1a3',price:4500},
 {id:'dark',type:'floor',label:'Midnight Tile',color:'#7b828e',price:5000},
 {id:'ochre',type:'floor',label:'Ochre Tile',color:'#d1b277',price:3800},
 {id:'pearl',type:'floor',label:'Pearl Tile',color:'#dce1de',price:4200},
 {id:'cocoa',type:'floor',label:'Cocoa Tile',color:'#9b7c65',price:4500},
 {id:'moss',type:'floor',label:'Moss Tile',color:'#8c9e85',price:4800},
];
export const GOOD_CATEGORY=Object.fromEntries(HOME_GOODS.map(i=>[i.id,i.category]));
const DETAILS={bed:'Sleep or nap after placing this bed.',wardrobe:'Change your outfit at this wardrobe.',storage:'Store food and supplies in your home cupboard inventory.',cooker:'Cook market ingredients using your home recipes.',shower:'Bathe to restore hygiene.',toilet:'Use the toilet to restore bladder comfort.',sink:'Wash hands to restore hygiene.',washer:'Freshen your clothes. Requires home power.',seat:'Sit and rest for a while.',fan:'Cool down and rest. Requires home power.',tv:'Watch a show. Requires home power.',speaker:'Listen to music. Requires home power.',console:'Play a game. Requires home power.',boardgame:'Enjoy a quiet board-game break.',aquarium:'Relax and watch the fish.',desk:'Practise coding. Requires home power.',read:'Read and build your charisma skill.',art:'Practise visual composition and build photography skill.',music:'Practise your music skill.',craft:'Practise sewing and build hustle skill.',light:'Switch this lamp on or off. Grid or home backup power required; the rechargeable lantern also works during cuts.',power:'Manage backup power from Phone → My home. Battery units share one charge reserve; generators share one fuel tank. Buying extra units does not multiply reserve capacity.'};
export const GOOD_DETAIL=Object.fromEntries(HOME_GOODS.map(i=>[i.id,i.fixed==='outdoor'?(i.power?'Installed outside by your front door. Manage fuel and switching in Phone → My home. Shared fuel tank.':'Set out by your front door.'):i.mount==='wall'?'Hangs on a wall; no floor obstruction.':i.mount==='ceiling'?'Fitted to the ceiling.':DETAILS[i.action]||'Place, rotate, move or store this decorative piece.']));
