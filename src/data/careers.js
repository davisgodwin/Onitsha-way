/** Original fictional contracts; prices and compressed apprenticeship are game rules. */
export const AGE_GROUPS = [['child','Child · 10'],['young','Young adult · 18'],['adult','Adult · 30'],['elder','Older adult · 68']];
export const BODY_TYPES = [['slim','Slim'],['average','Average'],['full','Fuller build']];
export const CAREERS = [
 {id:'tech',label:'Tech bro / sis',skill:'coding',pay:8000,near:'school',prompt:'A client needs a reliable shop website.',choices:['Back up the work and test the site','Promise a finished site without checking it'],right:0},
 {id:'realtor',label:'Realtor',skill:'charisma',pay:6500,near:'home',prompt:'A client asks about a rental property.',choices:['Disclose the rent and inspect the rooms','Hide the renewal terms to rush a deal'],right:0},
 {id:'apprentice',label:'Nwa boy / trade apprentice',skill:'hustle',pay:2500,near:'main-market',prompt:'Your mentor asks you to reconcile a stock book.',choices:['Report the exact stock count','Cover up a missing item'],right:0},
 {id:'car_dealer',label:'Car seller',skill:'hustle',pay:9000,near:'dealer',prompt:'A customer asks about a used car.',choices:['Disclose its condition and offer an inspection','Hide its defects to close quickly'],right:0},
 {id:'oso_afia',label:'Oso afia · market broker',skill:'charisma',pay:4500,near:'market-vendor',prompt:'A buyer needs fabric. Connect them with a fabric seller and agree your commission.',choices:['Fabrics trader · disclosed commission','Foodstuff trader · wrong goods','Spare-parts trader · wrong goods'],right:0},
 {id:'courier',label:'Delivery rider / courier',skill:'fitness',pay:3500,near:'bridgehead',prompt:'Deliver a sealed customer order.',choices:['Confirm the recipient and keep the package sealed','Open the parcel without permission'],right:0},
 {id:'caterer',label:'Cook / caterer',skill:'cooking',pay:5000,near:'main-market',prompt:'A customer requests a meal with an allergy warning.',choices:['Check ingredients and prepare a safe meal','Ignore the warning to save time'],right:0},
 {id:'mechanic',label:'Mechanic',skill:'hustle',pay:6000,near:'dealer',prompt:'A driver asks for an honest repair estimate.',choices:['Diagnose the fault and explain the price','Charge for unnecessary replacement parts'],right:0},
 {id:'tailor',label:'Tailor / fashion designer',skill:'hustle',pay:4500,near:'ochanja',prompt:'A client needs a well-fitted outfit.',choices:['Confirm measurements and the delivery date','Cut the cloth without checking measurements'],right:0},
 {id:'creator',label:'Photographer / creative',skill:'photography',pay:4000,near:'main-market',child:true,prompt:'A trader wants product photos.',choices:['Ask permission and show the goods accurately','Use a misleading photo of different goods'],right:0},
 {id:'logistics',label:'Wholesale / logistics agent',skill:'hustle',pay:7000,near:'bridgehead',prompt:'A wholesaler needs an order checked before dispatch.',choices:['Match quantities against the invoice','Approve unchecked boxes'],right:0},
 {id:'student',label:'Student / learner',skill:'coding',pay:500,near:'school',child:true,prompt:'Complete a supervised learning exercise.',choices:['Practise and ask for feedback','Copy an answer without understanding it'],right:0},
 {id:'thief',label:'Street crime · illegal path',illegal:true,pay:0,near:'main-market'},
 {id:'fraud',label:'Yahoo / fraud · illegal path',illegal:true,pay:0,near:'main-market'},
];
export const careerInfo = id => CAREERS.find(c=>c.id===id) ?? null;
export const careersFor = age => CAREERS.filter(c=>age!=='child'||c.child);
export const adultCharacter = c => c?.ageGroup !== 'child';
