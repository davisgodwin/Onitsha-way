/** Public name/address research. Entrances are simplified gameplay anchors, not surveyed doors. */
export const CITY_SERVICES = [
 {id:'grace-lodge',name:'Grace Lodge Onitsha',kind:'hotel',road:'Awka',near:'shoprite',confidence:'approximate',address:'Awka Road · sources disagree on street number',source:'https://www.hotelsone.com/nigeria-ng/reservations-onitsha-hotels.html',rate:3500},
 {id:'venus-hotel',name:'Venus Hotel',kind:'hotel',road:'Port Harcourt',near:'upper-iweka',confidence:'approximate',address:'100 Port Harcourt Road · approximate entrance',source:'https://www.hotelsone.com/nigeria-ng/reservations-onitsha-hotels.html',rate:4500},
 {id:'chizilili',name:'Chizilili Hotel',kind:'hotel',osm:'12569260282',confidence:'osm',source:'https://www.openstreetmap.org/node/12569260282',rate:2500},
 {id:'total-oguta',name:'TotalEnergies Oguta Road',kind:'fuel',lat:6.147259,lon:6.789944,confidence:'published',address:'Oguta Road · published map point',source:'https://www.hotfrog.com.ng/company/AFc1fC78c9Cory9bmDWTAw/totalenergies-oguta-road-service-station/onitsha/automotive-services'},
 {id:'total-old-market',name:'TotalEnergies Old Market Road',kind:'fuel',road:'Old Market',near:'main-market',confidence:'approximate',address:'54 Old Market Road · approximate entrance',source:'https://www.hotfrog.com.ng/search/onitsha'},
 {id:'total-new-market',name:'TotalEnergies New Market Road',kind:'fuel',road:'New Market',near:'main-market',confidence:'approximate',address:'82 Upper New Market Road · approximate entrance',source:'https://www.hotfrog.com.ng/search/onitsha'},
];
export const WORK_SITES = [
 {id:'metadav',name:'Metadav ICT Hub',near:'shoprite',dx:-110,dz:160,kind:'ict',careers:['tech','creator','student'],blurb:'Coding lab, photography studio, equipment desk and gig board. Train, qualify and meet clients for paid work.'},
 {id:'market',name:'Main Market buyer & apprenticeship desk',near:'main-market',dx:30,dz:65,careers:['oso_afia','apprentice'],blurb:'Meet buyers, arrange disclosed commissions and learn the market trade with a mentor.'},
 {id:'property',name:'Onitsha property work desk',near:'ochanja',dx:85,dz:-50,careers:['realtor'],blurb:'Arrange property inspections and agree clear terms with clients.'},
 {id:'motors',name:'Onitsha motors & mechanic workshop',near:'upper-iweka-park',dx:-110,dz:-50,careers:['car_dealer','mechanic'],blurb:'Learn diagnosis, meet drivers and arrange vehicle sales.'},
 {id:'dispatch',name:'Bridgehead delivery & logistics desk',near:'bridgehead',dx:70,dz:-80,careers:['courier','logistics'],blurb:'Collect delivery briefs and check wholesale orders before handover.'},
 {id:'kitchen',name:'Ochanja catering training kitchen',near:'ochanja',dx:-85,dz:65,careers:['caterer'],blurb:'Train with loaned pots, build cooking skills and take catering orders.'},
 {id:'fashion',name:'Ochanja fashion workshop',near:'ochanja',dx:95,dz:80,careers:['tailor'],blurb:'Take measurements, practise alterations and complete clothing orders.'},
];
