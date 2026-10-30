/**
 * v0.45 eateries: fictional restaurants (names, menus and staff are invented; any likeness to a real business is
 * coincidental). Prices are in naira. hunger/fun/social/energy are what a plate does for you.
 */
export const EATERIES = [
 { id: 'eatery-mama-blessing', name: "Mama Blessing's Kitchen", near: 'main-market', style: 'local', colors: ['#7a2a1a', '#f2c14e'], hours: [8, 22], blurb: 'Home-style Onitsha cooking: soups and swallow, rice, abacha.',
  menu: [
   { id: 'jollof', name: 'Jollof rice & chicken', price: 3500, hunger: 55, fun: 4 },
   { id: 'onugbu', name: 'Ofe onugbu & fufu', price: 3000, hunger: 60, fun: 4 },
   { id: 'abacha', name: 'Abacha & ugba', price: 1500, hunger: 35, fun: 6 },
   { id: 'pepper-soup', name: 'Goat meat pepper soup', price: 2500, hunger: 30, fun: 8 },
   { id: 'zobo', name: 'Zobo (chilled)', price: 500, hunger: 4, fun: 3, drink: true },
   { id: 'malt', name: 'Malt drink', price: 700, hunger: 6, fun: 3, drink: true },
  ] },
 { id: 'eatery-niger-breeze', name: 'Niger Breeze Grill', near: 'bridgehead', style: 'grill', colors: ['#1d3a4a', '#ff9a3c'], hours: [12, 24], blurb: 'Suya, asun and grilled fish by the river, late into the night.',
  menu: [
   { id: 'suya', name: 'Suya plate', price: 2500, hunger: 35, fun: 8 },
   { id: 'asun', name: 'Asun (peppered goat)', price: 3000, hunger: 35, fun: 8 },
   { id: 'fish', name: 'Grilled fish & yam chips', price: 6000, hunger: 60, fun: 10 },
   { id: 'chicken', name: 'Grilled chicken & chips', price: 4500, hunger: 55, fun: 6 },
   { id: 'chapman', name: 'Chapman', price: 1200, hunger: 4, fun: 5, drink: true },
   { id: 'water', name: 'Bottled water', price: 300, hunger: 0, fun: 0, drink: true },
  ] },
 { id: 'eatery-ugo-garden', name: 'Ugo Garden Restaurant', near: 'shoprite', style: 'garden', colors: ['#2f5d3a', '#f6e7b0'], hours: [10, 23], blurb: 'A quiet garden restaurant with fairy lights: a good place for a date.',
  menu: [
   { id: 'fried-rice', name: 'Fried rice & turkey', price: 5500, hunger: 60, fun: 8 },
   { id: 'ofe-akwu', name: 'Ofe akwu & white rice', price: 4000, hunger: 55, fun: 6 },
   { id: 'nkwobi', name: 'Nkwobi', price: 4500, hunger: 35, fun: 10 },
   { id: 'small-chops', name: 'Small chops platter', price: 3500, hunger: 30, fun: 10 },
   { id: 'chapman', name: 'Chapman', price: 1500, hunger: 4, fun: 5, drink: true },
   { id: 'ice-cream', name: 'Ice cream', price: 1200, hunger: 8, fun: 8, drink: true },
  ] },
];
export const EATERY_IDS = EATERIES.map((e) => e.id);
/** Is the eatery open at this hour (hours may run past midnight: [12, 24])? */
export const eateryOpen = (e, hour) => hour >= e.hours[0] && hour < e.hours[1];
/** Conversation on a date: each round offers three of these; score is how it lands. No romance beyond conversation. */
export const DATE_TOPICS = [
 { id: 'work', label: 'Ask about their work', score: 2, reply: (n) => `${n} tells you about their work, and laughs about a difficult customer.` },
 { id: 'family', label: 'Ask about their family', score: 2, reply: (n) => `${n} talks about a younger brother who wants to be a footballer.` },
 { id: 'onitsha', label: 'Talk about Onitsha: the market, the bridge, the traffic', score: 1, reply: (n) => `You trade Upper Iweka traffic stories. ${n} has a good one.` },
 { id: 'joke', label: 'Make them laugh', score: 2, reply: (n) => `${n} laughs so hard the next table looks over.` },
 { id: 'listen', label: 'Just listen', score: 1, reply: (n) => `${n} seems glad you're listening.` },
 { id: 'dreams', label: 'Ask what they dream of doing', score: 3, reply: (n) => `${n} wants to open a business one day. You talk about it for a long time.` },
 { id: 'money', label: 'Talk about how much money you have', score: -2, reply: (n) => `${n} goes quiet and checks their phone.` },
 { id: 'phone', label: 'Check your phone', score: -2, reply: (n) => `${n} notices. The conversation stalls.` },
 { id: 'self', label: 'Talk about yourself, at length', score: -1, reply: (n) => `${n} nods politely.` },
];
/** How a date went from its conversation score (three rounds, each -2..3) and whether you paid for the meal. Pure. */
export function dateOutcome(score, meal) {
 const total = score + (meal ? 2 : 0);
 if (total >= 7) return { grade: 'great', positive: 3, social: 35, fun: 25, line: 'a wonderful evening' };
 if (total >= 3) return { grade: 'good', positive: 2, social: 25, fun: 15, line: 'a good evening' };
 if (total >= 0) return { grade: 'ok', positive: 1, social: 15, fun: 8, line: 'a pleasant evening' };
 return { grade: 'poor', positive: 0, negative: 1, social: 5, fun: 0, line: 'an awkward evening' };
}
