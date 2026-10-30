/**
 * Goods sold by traders and hawkers. Prices are GAME prices in naira, chosen to feel plausible for an
 * Onitsha market in the mid-2020s; they are configuration, not surveyed market data.
 * Each trader marks the base price up a little (from their identity seed); bargaining can bring it
 * down to a floor that improves as the trader gets to know you. Items with `use` can be eaten, drunk or opened
 * from the bag.
 */
export const CATALOGUE = {
  'career equipment': [
    {id:'laptop',name:'Work laptop',price:85000},
    {id:'camera',name:'Digital camera',price:45000},
    {id:'notebook',name:'Client notebook',price:1200},
    {id:'inspection-kit',name:'Vehicle inspection kit',price:12000},
    {id:'delivery-bag',name:'Delivery bag',price:1800},
    {id:'toolbox',name:'Mechanic toolbox',price:9000},
    {id:'sewing-kit',name:'Sewing starter kit',price:4500},
    {id:'clipboard',name:'Dispatch clipboard',price:1500},
    {id:'microphone',name:'Recording microphone',price:6500},
  ],
  provisions: [
    { id: 'pure-water', name: 'Pure water (bag of 20)', price: 600, use: { verb: 'Open', open: { into: 'sachet-water', qty: 20 } } },
    { id: 'bottled-water', name: 'Bottled water', price: 300, use: { verb: 'Drink', energy: 8 } },
    { id: 'malt', name: 'Malt drink', price: 700, use: { verb: 'Drink', energy: 12 } },
    { id: 'bread', name: 'Sliced bread', price: 1500, use: { verb: 'Eat', energy: 30 } },
    { id: 'noodles', name: 'Instant noodles (carton)', price: 9500 },
    { id: 'sugar', name: 'Sugar (1 kg)', price: 1800 },
    { id: 'milk-tin', name: 'Tin milk', price: 900, use: { verb: 'Drink', energy: 10 } },
  ],
  fabrics: [
    { id: 'ankara-6y', name: 'Ankara (6 yards)', price: 9000 },
    { id: 'george', name: 'George wrapper', price: 18000 },
    { id: 'lace', name: 'Lace (5 yards)', price: 25000 },
    { id: 'thread', name: 'Sewing thread (pack)', price: 1200 },
  ],
  'phones & accessories': [
    { id: 'recharge', name: 'Recharge card', price: 500 },
    { id: 'earpiece', name: 'Earpiece', price: 2000 },
    { id: 'charger', name: 'Phone charger', price: 3500 },
    { id: 'power-bank', name: 'Power bank', price: 9500 },
  ],
  'shoes & bags': [
    { id: 'slippers', name: 'Slippers', price: 2500 },
    { id: 'sandals', name: 'Leather sandals', price: 8000 },
    { id: 'sneakers', name: 'Sneakers', price: 15000 },
    { id: 'handbag', name: 'Handbag', price: 12000 },
  ],
  foodstuff: [
    { id: 'yam', name: 'Yam tuber', price: 2500 },
    { id: 'plantain', name: 'Plantain bunch', price: 1800 },
    { id: 'eggs', name: 'Eggs (6)', price: 1600 },
    { id: 'tomatoes', name: 'Tomatoes (basket)', price: 1200 },
    { id: 'onions', name: 'Onions (small bag)', price: 700 },
    { id: 'vegetables', name: 'Ugu leaves', price: 500 },
    { id: 'fish', name: 'Fresh fish', price: 1800 },
    { id: 'beef', name: 'Beef (portion)', price: 2000 },
    { id: 'spices', name: 'Salt & seasoning', price: 400 },
    { id: 'egusi', name: 'Ground egusi', price: 1400 },
    { id: 'cooking-oil', name: 'Vegetable oil', price: 1500 },
    { id: 'garri', name: 'Garri (paint bucket)', price: 3200 },
    { id: 'rice-mudu', name: 'Rice (1 mudu)', price: 2400 },
    { id: 'beans-mudu', name: 'Beans (1 mudu)', price: 2600 },
    { id: 'palm-oil', name: 'Palm oil (bottle)', price: 2200 },
    { id: 'pepper', name: 'Pepper (small basket)', price: 1500 },
  ],
  'spare parts': [
    { id: 'spark-plug', name: 'Keke spark plug', price: 1500, use: { verb: null, why: 'Fit it to your own vehicle: stand next to it and press E.' } },
    { id: 'brake-pads', name: 'Brake pads', price: 7000, use: { verb: null, why: 'Fit it to your own vehicle: stand next to it and press E.' } },
    { id: 'engine-oil', name: 'Engine oil (4 L)', price: 9000, use: { verb: null, why: 'Fit it to your own vehicle: stand next to it and press E.' } },
    { id: 'jerrycan', name: 'Fuel in jerrycan (5 L)', price: 2200, use: { verb: null, why: 'Pour it into your own vehicle: stand next to it.' } },
  ],
  kitchenware: [
    { id: 'bucket', name: 'Plastic bucket', price: 2000 },
    { id: 'pot-set', name: 'Pot set', price: 14000 },
    { id: 'cooler', name: 'Food cooler', price: 11000 },
  ],
  electricals: [
    { id: 'bulb', name: 'Energy-saving bulb', price: 800 },
    { id: 'extension', name: 'Extension box', price: 4500 },
    { id: 'fan', name: 'Rechargeable fan', price: 28000 },
    { id: 'rechargeable-lamp', name: 'Rechargeable lamp', price: 6500, use: { verb: null, why: 'Keep it in your bag: it lights your room at home when NEPA takes light.' } },
  ],
  // v0.32 street-food stalls (bought and eaten at the stall, or kept in the bag)
  streetfood: [
    { id: 'suya-small', name: 'Suya (small wrap)', price: 1000, use: { verb: 'Eat', energy: 18, hunger: 25 } },
    { id: 'suya-big', name: 'Suya (big wrap, with onions)', price: 2500, use: { verb: 'Eat', energy: 30, hunger: 45 } },
    { id: 'roasted-corn', name: 'Roasted corn', price: 300, use: { verb: 'Eat', energy: 10, hunger: 15 } },
    { id: 'corn-ube', name: 'Corn & ube (African pear)', price: 600, use: { verb: 'Eat', energy: 14, hunger: 22 } },
    { id: 'boli-groundnut', name: 'Boli & groundnut', price: 700, use: { verb: 'Eat', energy: 18, hunger: 28 } },
    { id: 'puff-puff', name: 'Puff-puff (10 pieces)', price: 500, use: { verb: 'Eat', energy: 15, hunger: 22 } },
    { id: 'akara-pap', name: 'Akara & pap', price: 800, use: { verb: 'Eat', energy: 22, hunger: 32 } },
    { id: 'zobo', name: 'Zobo (chilled bottle)', price: 300, use: { verb: 'Drink', energy: 6, hunger: 2 } },
    { id: 'mama-put-rice', name: 'Rice, stew & meat (Mama Put)', price: 1800, use: { verb: 'Eat', energy: 40, hunger: 60 } },
    { id: 'beans-dodo', name: 'Beans & dodo (Mama Put)', price: 1500, use: { verb: 'Eat', energy: 38, hunger: 55 } },
    { id: 'abacha', name: 'Abacha (African salad)', price: 1200, use: { verb: 'Eat', energy: 25, hunger: 35 } },
  ],
  hawker: [
    { id: 'sachet-water', name: 'Pure water (sachet)', price: 50, use: { verb: 'Drink', energy: 4 } },
    { id: 'gala', name: 'Gala sausage roll', price: 300, use: { verb: 'Eat', energy: 15 } },
    { id: 'groundnut', name: 'Groundnut (small)', price: 200, use: { verb: 'Eat', energy: 9 } },
  ],
};

/** Made at home (not sold): cooked meals, a few portions each. Price is used for gift value and selling. */
export const HOME_MADE = [
  { id: 'yam-eggs', name: 'Yam and egg sauce', price: 1000, home: true, use: {verb:'Eat',energy:35,hunger:50} },
  { id: 'plantain-plate', name: 'Fried plantain & eggs', price: 900, home: true, use: {verb:'Eat',energy:30,hunger:45} },
  { id: 'egusi-soup', name: 'Egusi soup & garri', price: 1400, home: true, use: {verb:'Eat',energy:40,hunger:65} },
  { id: 'fish-stew', name: 'Fish stew & rice', price: 1300, home: true, use: {verb:'Eat',energy:42,hunger:60} },
  { id: 'cooked-noodles', name: 'Cooked noodles (portion)', price: 400, home: true, use: { verb: 'Eat', energy: 22 } },
  { id: 'rice-stew', name: 'Rice and stew (portion)', price: 900, home: true, use: { verb: 'Eat', energy: 40 } },
  { id: 'beans-porridge', name: 'Beans porridge (portion)', price: 800, home: true, use: { verb: 'Eat', energy: 38 } },
  { id: 'soaked-garri', name: 'Soaked garri (bowl)', price: 500, home: true, use: { verb: 'Eat', energy: 25 } },
];

export const ITEMS = Object.fromEntries([...Object.values(CATALOGUE).flat(), ...HOME_MADE].map((i) => [i.id, i]));

/** Raw foodstuff needs cooking: in the kitchen of a home you rent (Milestone 6). */
export const NEEDS_COOKING = new Set(['garri', 'rice-mudu', 'beans-mudu', 'palm-oil', 'pepper', 'sugar', 'noodles', 'yam', 'plantain', 'eggs', 'tomatoes', 'onions', 'vegetables', 'fish', 'beef', 'spices', 'egusi', 'cooking-oil']);

export const ECONOMY_CONFIG = {
  startingBalance: 5000, // legacy migration/dev fallback; normal new lives use data/backgrounds.js
  bagSlots: 16,
  // what traders pay when you sell to them, as a share of the base price (grows a little with familiarity)
  sellShare: 0.5, sellShareMax: 0.62, sellSharePerFamiliarity: 0.015,
};
