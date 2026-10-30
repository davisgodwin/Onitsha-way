import { ITEMS } from './catalogue.js';
import { SKILLS } from '../life/Skills.js';
/** Prices, qualifications and simplified tasks are fictional game progression, not real licences. */
export const CAREER_RULES = {
 tech:{skill:'coding',level:5,tools:['laptop'],site:'metadav',trainee:'Aspiring developer'},
 realtor:{skill:'charisma',level:3,tools:['notebook'],site:'property',trainee:'Property assistant'},
 apprentice:{skill:'hustle',level:1,tools:[],site:'market',trainee:'Trade apprentice'},
 car_dealer:{skill:'hustle',level:3,tools:['inspection-kit'],site:'motors',trainee:'Vehicle sales trainee'},
 oso_afia:{skill:'charisma',level:2,tools:['notebook'],site:'market',trainee:'Market broker trainee'},
 courier:{skill:'fitness',level:1,tools:['delivery-bag'],site:'dispatch',trainee:'Courier trainee'},
 caterer:{skill:'cooking',level:3,tools:['pot-set'],site:'kitchen',trainee:'Kitchen assistant'},
 mechanic:{skill:'hustle',level:3,tools:['toolbox'],site:'motors',trainee:'Workshop trainee'},
 tailor:{skill:'hustle',level:2,tools:['sewing-kit'],site:'fashion',trainee:'Fashion trainee'},
 creator:{skill:'photography',level:3,tools:['camera'],site:'metadav',trainee:'Photography learner'},
 logistics:{skill:'hustle',level:3,tools:['clipboard'],site:'dispatch',trainee:'Dispatch assistant'},
 student:{skill:'coding',level:1,tools:[],site:'metadav',trainee:'Student / learner'},
};
export const EQUIPMENT = ['laptop','camera','notebook','inspection-kit','delivery-bag','pot-set','toolbox','sewing-kit','clipboard','microphone'];
export function careerEligibility(id, {skills,inventory,character={}}={}) {
 const r=CAREER_RULES[id];if(!r)return {ok:true,checks:[],missing:[]};
 const supervised=character.ageGroup==='child'&&id==='creator';
 const checks=[{ok:(skills?.level(r.skill)??1)>=(supervised?1:r.level),label:`${SKILLS[r.skill]} level ${supervised?1:r.level} (now ${skills?.level(r.skill)??1})`}];
 for(const item of r.tools)checks.push({ok:supervised||!!inventory?.has(item),label:supervised?'Supervised studio loaner camera':`Own ${ITEMS[item]?.name??item}`});
 if(character.ageGroup==='child'&&!['student','creator'].includes(id))checks.push({ok:false,label:'Adult career — unavailable in child mode'});
 return {ok:checks.every(c=>c.ok),checks,missing:checks.filter(c=>!c.ok).map(c=>c.label),supervised};
}
/** Two changing briefs per trade. The final workplace response uses its established career decision. */
export const CAREER_BRIEFS = {
 tech:[['A trader needs a mobile-friendly stock page. What should you agree first?',['Confirm the product list, budget and delivery date','Start coding without asking what the shop sells']],['A client reports that a checkout screen breaks. How do you begin?',['Reproduce the bug with a safe test order','Change the live site without a backup']]],
 realtor:[['A renter asks you to find a room. What should you record?',['Budget, location and renewal terms','Only the maximum amount they can pay']],['A client wants to inspect a flat. What do you arrange?',['Permission, an inspection time and clear fees','Collect a secret fee before naming the property']]],
 apprentice:[['Your mentor has a new delivery. What comes first?',['Count cartons together and record the invoice','Guess the number of cartons']],['A stock entry looks wrong. What do you do?',['Check the shelf and ask your mentor','Change the book to hide the difference']]],
 car_dealer:[['A buyer requests a used vehicle. What comes first?',['Confirm the budget and record inspection needs','Promise a fault-free car without inspecting it']],['A buyer asks about running costs. What do you prepare?',['Condition notes and a transparent estimate','Hide maintenance costs']]],
 oso_afia:[['A buyer needs Ankara fabric. How do you take the brief?',['Confirm fabric, quantity, budget and disclosed commission','Send the buyer to any stall and hide your fee']],['A returning buyer wants matching fabric. What do you check?',['Pattern, quantity and seller availability','Promise matching stock without checking']]],
 courier:[['A sealed order is ready for dispatch. What do you check?',['Recipient, destination and package label','Open the contents for a look']],['A hotel has requested a delivery. What do you confirm?',['Reception handover and the order reference','Leave it with an unknown passer-by']]],
 caterer:[['A hotel needs a small catering order. What do you record?',['Portions, allergy warnings and a safe handover time','Ignore the allergy note']],['A client requests a meal tray. What comes first?',['Clean equipment and confirm the ingredients','Reuse unwashed equipment to save time']]],
 mechanic:[['A driver reports poor braking. What is the first step?',['Inspect safely and agree a diagnosis','Replace expensive parts without checking']],['A delivery vehicle needs maintenance. What do you do first?',['Record symptoms and obtain permission to inspect','Start repairs without a quote']]],
 tailor:[['A customer wants a fitted outfit. What do you record?',['Measurements, fabric and delivery date','Cut first and guess the measurements']],['A repeat client needs an alteration. How do you begin?',['Confirm the new fit before stitching','Reuse old measurements without checking']]],
 creator:[['A trader requests product photos. What do you arrange?',['Permission, a shot list and truthful product styling','Use another shop’s pictures without permission']],['A hotel wants a photo of its reception. What do you confirm?',['Consent and a clear shot without private guest details','Photograph guests without asking']]],
 logistics:[['A wholesale order needs dispatch. What do you verify?',['Invoice, quantity and receiving contact','Approve uncounted cartons']],['Several cartons have similar labels. What is safest?',['Match each order to its recipient','Mix the cartons to save time']]],
 student:[['Your tutor has set a small coding exercise. How do you begin?',['Read the task and try a small example','Copy an answer without reading it']],['You are practising a shop inventory table. What helps?',['Test your work and ask for feedback','Skip testing to finish sooner']]],
};
export const TRAINING_QUIZZES={
 coding:{q:'Which habit makes a small program more reliable?',a:['Test a small change and keep a backup','Change everything without testing']},
 photography:{q:'Before photographing a product or person, what comes first?',a:['Permission and an accurate shot plan','Use someone else’s photos without permission']},
 charisma:{q:'A customer has a different budget. What builds trust?',a:['Listen and explain the options honestly','Pressure them with hidden charges']},
 hustle:{q:'A delivery and its invoice disagree. What should you do?',a:['Count again and record the difference','Hide the difference in the book']},
 fitness:{q:'What is a safe way to prepare for delivery work?',a:['Check the route, rest and drink water','Ignore fatigue and rush into traffic']},
 cooking:{q:'A client mentions an allergy. What is the safe response?',a:['Check every ingredient and avoid cross-contact','Assume a small amount cannot matter']},
};
export function hustleEligibility(id,context={}) {
 const mapped={coding:'tech',photography:'creator',errands:'courier'}[id];if(mapped)return careerEligibility(mapped,context);
 const checks=[];if(context.character?.ageGroup==='child')checks.push({ok:false,label:'Adult-only side gig'});
 const skill=id==='music'?'music':id==='comedy'?'comedy':'charisma';checks.push({ok:(context.skills?.level(skill)??1)>=2,label:`${SKILLS[skill]} level 2`});
 if(id==='music')checks.push({ok:!!context.inventory?.has('microphone'),label:'Own Recording microphone'});
 return{ok:checks.every(c=>c.ok),checks,missing:checks.filter(c=>!c.ok).map(c=>c.label)};
}
