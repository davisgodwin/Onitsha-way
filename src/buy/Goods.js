/**
 * Home furniture catalogue (v0.37). Prices are fictional game naira, set against the game economy:
 * jobs pay ₦500–₦9,000 a task, a self-contain rents for ₦3,500 a week and cars cost ₦18k–₦2.2M.
 *
 * Every item has: id (never renamed: saves refer to it), label, price, tier, tab (Buy-mode section),
 * shop (which Onitsha store sells it), model, size (placement footprint in metres, [width, depth]),
 * mount (floor | surface | wall | ceiling | bedding | outdoor), resale value and colour variants.
 *
 * Models: 'k:<name>' is a Kenney Furniture Kit model (CC0); anything else is drawn in code
 * (src/buy/FurnitureModels.js). `fit` scales the finished model uniformly to fit [w, d, h].
 */
import KIT_BOUNDS from '../data/furnitureBounds.json' with { type: 'json' };
const KIT_SCALE = 2; // same as FurnitureLibrary.KIT_SCALE (kept here so this data file has no three.js import)

export const TABS = [
  ['living', 'Living room'], ['bedroom', 'Bedroom'], ['electronics', 'Electronics & appliances'], ['lighting', 'Lighting'],
  ['walldecor', 'Wall décor & accessories'], ['textiles', 'Rugs, curtains & bedding'], ['kitchen', 'Kitchen & dining'],
  ['bathroom', 'Bathroom'], ['essentials', 'Nigerian home essentials'], ['outdoor', 'Outdoor & compound'], ['hobbies', 'Hobbies & study'],
];
export const SHOPS = {
  furniture: { id: 'furniture', name: 'Ezinne Furniture Showroom', short: 'Furniture showroom' },
  electronics: { id: 'electronics', name: 'Bright Star Electronics & Appliances', short: 'Electronics store' },
  lighting: { id: 'lighting', name: 'Nnamdi Lighting & Electricals', short: 'Lighting & electrical shop' },
  decor: { id: 'decor', name: 'Adaeze Home Décor', short: 'Home décor shop' },
};
export const TIERS = [['budget', 'Budget', 0], ['standard', 'Standard', 6000], ['premium', 'Premium', 35000]];
export const tierOf = (price) => (price >= 35000 ? 'premium' : price >= 6000 ? 'standard' : 'budget');
export const RESALE_RATE = 0.4;
export const resaleValue = (price) => Math.max(0, Math.round((price * RESALE_RATE) / 50) * 50);

/** Colour/material variants. `mat` is the material name (Kenney kit names, or the role names used by code-drawn models). */
export const PALETTES = {
  fabric: { mat: /^(carpet|carpetBlue|carpetDarker|fabric)$/, label: 'Fabric', colors: [['Cream', '#e6dac2'], ['Indigo', '#4c5d92'], ['Ankara red', '#b8473a'], ['Forest', '#45705a'], ['Charcoal', '#4a4e55'], ['Mustard', '#c99b3a']] },
  wood: { mat: /^(wood|woodDark)$/, label: 'Wood', colors: [['Light oak', '#dca96d'], ['Walnut', '#7d5537'], ['Mahogany', '#6e3426'], ['White', '#ebe7df'], ['Black', '#34343a']] },
  appliance: { mat: /^(metalLight|body)$/, label: 'Finish', colors: [['White', '#eef0ee'], ['Silver', '#b9c1c6'], ['Black', '#33383d']] },
  plastic: { mat: /^plastic$/, label: 'Colour', colors: [['White', '#f1f1ee'], ['Blue', '#3f74b8'], ['Red', '#c0453c'], ['Green', '#3d8a5a']] },
  frame: { mat: /^frame$/, label: 'Frame', colors: [['Gold', '#c9a24b'], ['Black', '#2f2f33'], ['Wood', '#8a5f3c'], ['White', '#efece6']] },
  shade: { mat: /^(lamp|shade)$/, label: 'Shade', colors: [['Warm white', '#fff1cf'], ['Amber', '#f2b866'], ['Linen', '#e2d6bd']] },
  rug: { mat: /^(carpet|carpetDarker|fabric)$/, label: 'Colour', colors: [['Terracotta', '#b0634c'], ['Indigo', '#56688f'], ['Sage', '#86a07f'], ['Sand', '#d8c39a'], ['Wine', '#7c3443']] },
  ceramic: { mat: /^(ceramic|body)$/, label: 'Colour', colors: [['Clay', '#bb805d'], ['White', '#efeae2'], ['Teal', '#3f8c8a'], ['Black', '#2f3033']] },
};

const rows = [];
/** G(id, label, price, tab, shop, model, options) */
const G = (id, label, price, tab, shop, model, o = {}) => rows.push({ id, label, price, tab, shop, model, ...o });
const S = 'surface', W = 'wall', C = 'ceiling', O = 'outdoor', B = 'bedding';

// ── A. Living room ───────────────────────────────────────────────────────────
G('loveseat', 'Two-seater sofa', 12500, 'living', 'furniture', 'k:loungeDesignChair', { fit: [1.45, 0.85], action: 'seat', variants: 'fabric', tint: { carpetBlue: '#657a9e' } });
G('sofa', 'Three-seater sofa', 18000, 'living', 'furniture', 'k:loungeSofa', { fit: [1.75, 0.75], action: 'seat', variants: 'fabric', tint: { carpet: '#5c7b73' } });
G('lsofa', 'L-shaped sofa', 85000, 'living', 'furniture', 'k:loungeSofaCorner', { s: 1.9, action: 'seat', variants: 'fabric', tint: { carpet: '#8a7a6a' } });
G('designsofa', 'Designer sofa', 65000, 'living', 'furniture', 'k:loungeDesignSofa', { s: 1.9, action: 'seat', variants: 'fabric' });
G('armchair', 'Single-seater armchair', 6500, 'living', 'furniture', 'k:loungeChair', { fit: [0.85, 0.85], action: 'seat', variants: 'fabric', tint: { carpet: '#bc876a' } });
G('recliner', 'Recliner armchair', 42000, 'living', 'furniture', 'k:loungeChairRelax', { s: 1.9, action: 'seat', variants: 'fabric' });
G('coffeetable', 'Centre table', 3500, 'living', 'furniture', 'k:tableCoffeeSquare', { fit: [0.85, 0.85], top: true, variants: 'wood' });
G('glasstable', 'Glass centre table', 14000, 'living', 'furniture', 'k:tableCoffeeGlass', { top: true });
G('sidetable', 'Side table', 3500, 'living', 'furniture', 'k:cabinetBedDrawerTable', { s: 1.9, top: true, variants: 'wood' });
G('tvstand', 'TV stand', 9500, 'living', 'furniture', 'k:cabinetTelevision', { s: 1.7, top: true, variants: 'wood' });
G('tvwallunit', 'TV wall unit', 38000, 'living', 'furniture', 'tvwallunit', { size: [2.2, 0.45], variants: 'wood' });
G('bookshelf', 'Bookshelf', 6500, 'living', 'furniture', 'k:bookcaseOpen', { fit: [0.9, 0.4, 1.75], action: 'read', variants: 'wood', also: ['hobbies'] });
G('displaycabinet', 'Glass display cabinet', 24000, 'living', 'furniture', 'displaycabinet', { size: [1, 0.45], variants: 'wood' });
G('shoerack', 'Shoe rack', 2500, 'living', 'furniture', 'shoerack', { size: [0.8, 0.32], top: true, variants: 'wood', also: ['essentials'] });
G('ottoman', 'Ottoman', 2200, 'living', 'furniture', 'k:loungeSofaOttoman', { fit: [0.7, 0.6, 0.45], action: 'seat', variants: 'fabric' });
G('storagecabinet', 'Storage cabinet', 11000, 'living', 'furniture', 'k:bookcaseClosedDoors', { s: 1.9, variants: 'wood' });
G('consoletable', 'Console table', 6000, 'living', 'furniture', 'k:sideTableDrawers', { s: 1.8, top: true, variants: 'wood' });

// ── B. Bedroom ───────────────────────────────────────────────────────────────
G('singlebed', 'Single bed', 6500, 'bedroom', 'furniture', 'k:bedSingle', { fit: [1.1, 2.05, 0.8], action: 'bed', variants: 'wood' });
G('bed', 'Double bed', 16000, 'bedroom', 'furniture', 'k:bedDouble', { fit: [1.65, 2.05, 0.8], action: 'bed', variants: 'wood' });
G('queenbed', 'Queen-size bed', 26000, 'bedroom', 'furniture', 'k:bedDouble', { fit: [1.85, 2.18, 0.82], action: 'bed', variants: 'wood', tint: { wood: '#7d5537' } });
G('kingbed', 'King-size bed', 39000, 'bedroom', 'furniture', 'k:bedDouble', { fit: [2.05, 2.25, 0.85], action: 'bed', variants: 'wood', tint: { wood: '#6e3426', carpet: '#86749d' } });
G('bunkbed', 'Twin bunk bed', 21000, 'bedroom', 'furniture', 'k:bedBunk', { fit: [1.1, 2.15], action: 'bed', variants: 'wood' });
G('nightstand', 'Bedside table', 2800, 'bedroom', 'furniture', 'k:cabinetBedDrawerTable', { fit: [0.5, 0.45], top: true, variants: 'wood' });
G('wardrobe', 'Two-door wardrobe', 9500, 'bedroom', 'furniture', 'wardrobe', { size: [1.05, 0.62], action: 'wardrobe', variants: 'wood' });
G('slidewardrobe', 'Sliding-door wardrobe', 32000, 'bedroom', 'furniture', 'slidewardrobe', { size: [1.8, 0.64], action: 'wardrobe', variants: 'wood' });
G('drawers', 'Chest of drawers', 12000, 'bedroom', 'furniture', 'drawers', { size: [0.9, 0.5], top: true, variants: 'wood' });
G('dressingtable', 'Dressing table with mirror', 15000, 'bedroom', 'furniture', 'dressingtable', { size: [1.1, 0.5], variants: 'wood' });
G('dressingstool', 'Dressing stool', 2200, 'bedroom', 'furniture', 'stool', { size: [0.45, 0.45], action: 'seat', variants: 'fabric' });
G('mirror', 'Full-length mirror', 4200, 'bedroom', 'furniture', 'mirror', { size: [0.75, 0.45], variants: 'wood' });
G('storagebench', 'Storage bench', 5500, 'bedroom', 'furniture', 'k:benchCushionLow', { s: 2, action: 'seat', top: true, variants: 'fabric' });

// ── C. Electronics & appliances ──────────────────────────────────────────────
G('tv', 'Flat-screen TV on stand', 18000, 'electronics', 'electronics', 'tvonstand', { size: [1, 0.4], action: 'tv' });
G('smarttv', 'Smart TV (55", wall-mounted)', 58000, 'electronics', 'electronics', 'walltv', { mount: W, size: [1.3, 0.08], y: 1.45, action: 'tv' });
G('fridge', 'Refrigerator', 22000, 'electronics', 'electronics', 'k:kitchenFridge', { fit: [0.7, 0.7, 1.6], action: 'storage', variants: 'appliance', also: ['kitchen'] });
G('minifridge', 'Compact refrigerator', 10000, 'electronics', 'electronics', 'k:kitchenFridgeSmall', { fit: [0.6, 0.6], action: 'storage', variants: 'appliance', also: ['kitchen'] });
G('bigfridge', 'Double-door refrigerator', 95000, 'electronics', 'electronics', 'k:kitchenFridgeLarge', { s: 1.9, action: 'storage', variants: 'appliance', also: ['kitchen'] });
G('freezer', 'Deep freezer', 48000, 'electronics', 'electronics', 'freezer', { size: [1.1, 0.68], action: 'storage', top: true, variants: 'appliance', also: ['kitchen'] });
G('fan', 'Standing fan', 5500, 'electronics', 'electronics', 'fan', { size: [0.55, 0.55], action: 'fan' });
G('tablefan', 'Table fan', 3500, 'electronics', 'electronics', 'tablefan', { mount: S, size: [0.35, 0.3], action: 'fan' });
G('ceilingfan', 'Ceiling fan', 12000, 'electronics', 'electronics', 'k:ceilingFan', { mount: C, s: 2.4, action: 'fan', spin: true });
G('aircon', 'Split air conditioner', 145000, 'electronics', 'electronics', 'aircon', { mount: W, size: [0.95, 0.3], y: 2.3, action: 'fan' });
G('microwave', 'Microwave oven', 28000, 'electronics', 'electronics', 'k:kitchenMicrowave', { mount: S, s: 1.9, also: ['kitchen'] });
G('cooker', 'Gas cooker', 12000, 'electronics', 'electronics', 'cooker', { size: [0.7, 0.65], action: 'cooker', also: ['kitchen'] });
G('range', 'Wide oven range', 24000, 'electronics', 'electronics', 'cooker', { size: [1, 0.72], scale: [1.4, 1, 1.08], tint: { body: '#9faab2' }, action: 'cooker', also: ['kitchen'] });
G('kettle', 'Electric kettle', 4000, 'electronics', 'electronics', 'kettle', { mount: S, size: [0.25, 0.2], variants: 'appliance', also: ['kitchen'] });
G('blender', 'Blender', 6500, 'electronics', 'electronics', 'k:kitchenBlender', { mount: S, s: 1.9, also: ['kitchen'] });
G('toaster', 'Toaster', 5000, 'electronics', 'electronics', 'k:toaster', { mount: S, s: 1.9, also: ['kitchen'] });
G('dispenser', 'Water dispenser', 22000, 'electronics', 'electronics', 'dispenser', { size: [0.4, 0.4], also: ['essentials'] });
G('washer', 'Washing machine', 16000, 'electronics', 'electronics', 'k:washer', { fit: [0.7, 0.65], action: 'washer', also: ['bathroom'] });
G('washerdryer', 'Washer-dryer stack', 120000, 'electronics', 'electronics', 'k:washerDryerStacked', { s: 1.9, action: 'washer', also: ['bathroom'] });
G('iron', 'Electric iron & ironing board', 8000, 'electronics', 'electronics', 'ironboard', { size: [1.2, 0.4], action: 'washer' });
G('speaker', 'Music speaker tower', 4500, 'electronics', 'electronics', 'k:speaker', { fit: [0.36, 0.34], action: 'speaker' });
G('btspeaker', 'Bluetooth speaker', 4000, 'electronics', 'electronics', 'k:speakerSmall', { mount: S, s: 1.2, action: 'speaker' });
G('hometheatre', 'Home theatre system', 85000, 'electronics', 'electronics', 'hometheatre', { size: [1.9, 0.45], action: 'speaker' });
G('radio', 'Retro home radio', 2500, 'electronics', 'electronics', 'radio', { size: [0.65, 0.4], action: 'speaker' });
G('console', 'Game console & screen', 26000, 'electronics', 'electronics', 'console', { size: [1.05, 0.55], action: 'console', also: ['hobbies'] });
G('gameconsole', 'Gaming console (with controllers)', 95000, 'electronics', 'electronics', 'gameconsole', { mount: S, size: [0.45, 0.35], action: 'console' });
G('router', 'Wi-Fi router', 9500, 'electronics', 'electronics', 'router', { mount: S, size: [0.3, 0.2] });
G('laptop', 'Laptop', 150000, 'electronics', 'electronics', 'k:laptop', { mount: S, s: 1.4, action: 'desk', also: ['hobbies'] });

// ── D. Lighting ──────────────────────────────────────────────────────────────
G('ceilinglight', 'Basic ceiling light', 1200, 'lighting', 'lighting', 'ceilinglight', { mount: C, size: [0.3, 0.3], action: 'light' });
G('modernlight', 'Modern ceiling light', 6500, 'lighting', 'lighting', 'modernlight', { mount: C, size: [0.6, 0.6], action: 'light' });
G('chandelier', 'Crystal chandelier', 120000, 'lighting', 'lighting', 'chandelier', { mount: C, size: [0.9, 0.9], action: 'light' });
G('pendant', 'Pendant light', 5500, 'lighting', 'lighting', 'k:lampSquareCeiling', { mount: C, s: 2, action: 'light', variants: 'shade' });
G('spotlights', 'Recessed spotlights (set of 4)', 4800, 'lighting', 'lighting', 'spotlights', { mount: C, size: [1.2, 1.2], action: 'light' });
G('sconce', 'Wall sconce', 3800, 'lighting', 'lighting', 'k:lampWall', { mount: W, s: 2, y: 1.9, action: 'light' });
G('lamp', 'Floor lamp', 3200, 'lighting', 'lighting', 'k:lampRoundFloor', { fit: [0.6, 0.6, 1.65], action: 'light', variants: 'shade' });
G('squarelamp', 'Modern floor lamp', 6500, 'lighting', 'lighting', 'k:lampSquareFloor', { s: 1.9, action: 'light', variants: 'shade' });
G('tablelamp', 'Table lamp on stand', 1500, 'lighting', 'lighting', 'tablelamp', { size: [0.5, 0.5], action: 'light' });
G('bedsidelamp', 'Bedside lamp', 2200, 'lighting', 'lighting', 'k:lampRoundTable', { mount: S, s: 1.5, action: 'light', variants: 'shade' });
G('ledstrip', 'LED strip light', 3500, 'lighting', 'lighting', 'ledstrip', { mount: W, size: [2, 0.04], y: 2.6, action: 'light' });
G('rgblight', 'RGB gaming light bars', 9000, 'lighting', 'lighting', 'rgblight', { size: [0.6, 0.25], action: 'light', also: ['hobbies'] });
G('lantern', 'Rechargeable lantern', 2800, 'lighting', 'lighting', 'lantern', { size: [0.4, 0.4], action: 'light', rechargeable: true, also: ['essentials'] });
G('emergencylight', 'Emergency LED light', 4500, 'lighting', 'lighting', 'emergencylight', { mount: W, size: [0.45, 0.1], y: 2.3, action: 'light', rechargeable: true, also: ['essentials'] });
G('archedlamp', 'Arc reading lamp', 5800, 'lighting', 'lighting', 'archedlamp', { size: [1, 0.7], action: 'light' });
G('tripodlamp', 'Tripod shade lamp', 4500, 'lighting', 'lighting', 'tripodlamp', { size: [0.7, 0.7], action: 'light' });

// ── E. Wall décor & accessories ──────────────────────────────────────────────
G('art', 'Onitsha wall art', 2500, 'walldecor', 'decor', 'art', { mount: W, size: [1, 0.06], y: 1.7 });
G('painting', 'Framed painting', 6500, 'walldecor', 'decor', 'painting', { mount: W, size: [0.9, 0.05], y: 1.65, variants: 'frame' });
G('africanart', 'African-inspired artwork', 9000, 'walldecor', 'decor', 'africanart', { mount: W, size: [0.8, 0.05], y: 1.7, variants: 'frame' });
G('ulicanvas', 'Nigerian cultural artwork (Uli lines)', 14000, 'walldecor', 'decor', 'ulicanvas', { mount: W, size: [1.4, 0.05], y: 1.65, variants: 'frame' });
G('photoframes', 'Family photo frames', 3000, 'walldecor', 'decor', 'photoframes', { mount: W, size: [0.9, 0.04], y: 1.6, variants: 'frame' });
G('portrait', 'Large family portrait', 12000, 'walldecor', 'decor', 'portrait', { mount: W, size: [1, 0.06], y: 1.75, variants: 'frame', also: ['essentials'] });
G('wallclock', 'Wall clock', 2500, 'walldecor', 'decor', 'wallclock', { mount: W, size: [0.4, 0.05], y: 2.1, variants: 'frame' });
G('roundmirror', 'Decorative round mirror', 7500, 'walldecor', 'decor', 'roundmirror', { mount: W, size: [0.75, 0.05], y: 1.6, variants: 'frame' });
G('statementmirror', 'Large statement mirror', 45000, 'walldecor', 'decor', 'statementmirror', { mount: W, size: [1.1, 0.06], y: 1.25, variants: 'frame' });
G('wallshelves', 'Floating wall shelves', 4000, 'walldecor', 'decor', 'wallshelves', { mount: W, size: [1, 0.25], y: 1.5, variants: 'wood' });
G('wallpanels', 'Decorative wall panels', 18000, 'walldecor', 'decor', 'wallpanels', { mount: W, size: [1.5, 0.06], y: 1.2, variants: 'wood' });
G('flowers', 'Artificial flowers', 2500, 'walldecor', 'decor', 'flowers', { mount: S, size: [0.25, 0.25] });
G('vases', 'Ceramic vases (pair)', 3500, 'walldecor', 'decor', 'vases', { mount: S, size: [0.35, 0.2], variants: 'ceramic' });
G('vase', 'Ceramic floor vase', 1800, 'walldecor', 'decor', 'vase', { size: [0.5, 0.5], variants: 'ceramic' });
G('plant', 'Indoor plant', 1200, 'walldecor', 'decor', 'k:pottedPlant', { fit: [0.75, 0.75, 1.25] });
G('fern', 'Tall potted fern', 2400, 'walldecor', 'decor', 'fern', { size: [0.85, 0.85] });
G('smallplant', 'Small potted plant', 1000, 'walldecor', 'decor', 'k:plantSmall2', { mount: S, s: 2 });
G('decobowl', 'Decorative bowl', 1800, 'walldecor', 'decor', 'decobowl', { mount: S, size: [0.32, 0.32], variants: 'ceramic' });
G('centrepiece', 'Table centrepiece', 3200, 'walldecor', 'decor', 'centrepiece', { mount: S, size: [0.45, 0.25] });
G('sculpture', 'Decorative sculpture', 22000, 'walldecor', 'decor', 'sculpture', { size: [0.45, 0.45] });
G('candles', 'Candles & candle holders', 1500, 'walldecor', 'decor', 'candles', { mount: S, size: [0.3, 0.15] });
G('teddy', 'Teddy bear', 1500, 'walldecor', 'decor', 'k:bear', { mount: S, s: 1 });
G('books', 'Stack of books', 1200, 'walldecor', 'decor', 'k:books', { mount: S, s: 2, also: ['hobbies'] });
G('coatrack', 'Standing coat rack', 3500, 'walldecor', 'furniture', 'k:coatRackStanding', { s: 2 });
G('divider', 'Woven room divider', 6000, 'walldecor', 'furniture', 'divider', { size: [1.5, 0.45] });

// ── F. Rugs, curtains & bedding ──────────────────────────────────────────────
G('largerug', 'Living room rug', 3800, 'textiles', 'decor', 'k:rugRectangle', { fit: [2.4, 1.75], nonSolid: true, variants: 'rug', tint: { carpet: '#617791', carpetDarker: '#4a5c78' } });
G('rug', 'Bedroom rug', 2200, 'textiles', 'decor', 'k:rugRounded', { fit: [1.5, 1.1], nonSolid: true, variants: 'rug', tint: { carpet: '#ad674f', carpetDarker: '#8c4f3c' } });
G('luxurycarpet', 'Luxury carpet', 28000, 'textiles', 'decor', 'k:rugSquare', { s: 3, nonSolid: true, variants: 'rug', tint: { carpet: '#7c3443', carpetDarker: '#c9a24b' } });
G('roundrug', 'Round rug', 4500, 'textiles', 'decor', 'k:rugRound', { s: 1.7, nonSolid: true, variants: 'rug' });
G('doormat', 'Door mat', 800, 'textiles', 'decor', 'k:rugDoormat', { s: 2, nonSolid: true, entry: true });
G('throwpillows', 'Throw pillows (pair)', 2000, 'textiles', 'decor', 'throwpillows', { mount: S, size: [0.6, 0.25], variants: 'fabric' });
G('cushions', 'Decorative cushions', 2500, 'textiles', 'decor', 'k:pillowLong', { mount: S, s: 2, variants: 'fabric' });
G('ankaracushions', 'African-patterned cushions', 3500, 'textiles', 'decor', 'ankaracushions', { mount: S, size: [0.7, 0.25], also: ['essentials'] });
G('sofathrow', 'Sofa throw', 3000, 'textiles', 'decor', 'sofathrow', { mount: S, size: [0.7, 0.5], variants: 'fabric' });
G('bedsheets', 'Bed sheets', 3500, 'textiles', 'decor', 'bedsheets', { mount: B, size: [1, 1], variants: 'fabric' });
G('duvet', 'Duvet set', 9000, 'textiles', 'decor', 'duvet', { mount: B, size: [1, 1], variants: 'fabric' });
G('bedpillows', 'Bed pillows (pair)', 2500, 'textiles', 'decor', 'bedpillows', { mount: B, size: [1, 1] });
G('sheercurtains', 'Sheer curtains', 4500, 'textiles', 'decor', 'sheercurtains', { mount: W, size: [1.6, 0.08], y: 1.55, variants: 'fabric' });
G('curtains', 'Colourful curtains', 1800, 'textiles', 'decor', 'curtains', { mount: W, size: [1.4, 0.08], y: 1.55, variants: 'fabric' });
G('blackout', 'Blackout curtains', 8500, 'textiles', 'decor', 'blackout', { mount: W, size: [1.6, 0.1], y: 1.55, variants: 'fabric' });
G('curtainrod', 'Curtain rod', 1500, 'textiles', 'decor', 'curtainrod', { mount: W, size: [1.7, 0.08], y: 2.45 });
G('blinds', 'Window blinds', 6000, 'textiles', 'decor', 'blinds', { mount: W, size: [1.2, 0.06], y: 1.75 });

// ── G. Kitchen & dining ──────────────────────────────────────────────────────
G('diningtable', 'Two-seat dining set', 8500, 'kitchen', 'furniture', 'diningtable', { size: [1.5, 1.25], action: 'seat', variants: 'wood' });
G('dining4', 'Four-seater dining set', 32000, 'kitchen', 'furniture', 'dining4', { size: [1.75, 1.75], action: 'seat', variants: 'wood' });
G('dining6', 'Six-seater dining set', 62000, 'kitchen', 'furniture', 'dining6', { size: [2.45, 1.75], action: 'seat', variants: 'wood' });
G('diningchair', 'Dining chair', 1800, 'kitchen', 'furniture', 'k:chairCushion', { fit: [0.5, 0.55, 0.95], action: 'seat', variants: 'fabric' });
G('barstool', 'Bar stool', 4500, 'kitchen', 'furniture', 'k:stoolBar', { s: 2, action: 'seat', variants: 'fabric' });
G('kitchencabinet', 'Kitchen storage cabinet', 5500, 'kitchen', 'furniture', 'cabinet', { size: [0.95, 0.55], action: 'storage', top: true, variants: 'wood' });
G('kitchenunit', 'Kitchen base cabinets', 26000, 'kitchen', 'furniture', 'kitchenunit', { size: [1.72, 0.64], action: 'storage', top: true, variants: 'wood' });
G('wallcupboard', 'Kitchen wall cupboard', 9000, 'kitchen', 'furniture', 'k:kitchenCabinetUpperDouble', { mount: W, s: 2, y: 1.75, variants: 'wood' });
G('kitchenshelf', 'Kitchen shelves', 3500, 'kitchen', 'furniture', 'kitchenshelf', { mount: W, size: [0.9, 0.25], y: 1.6, variants: 'wood' });
G('trolley', 'Kitchen trolley', 7500, 'kitchen', 'furniture', 'trolley', { size: [0.6, 0.4], top: true });
G('microshelf', 'Microwave shelf', 5000, 'kitchen', 'furniture', 'microshelf', { size: [0.65, 0.42], top: true });
G('spicerack', 'Spice rack', 2200, 'kitchen', 'decor', 'spicerack', { mount: W, size: [0.5, 0.1], y: 1.45 });
G('dinnerset', 'Dinner set', 6500, 'kitchen', 'decor', 'dinnerset', { mount: S, size: [0.4, 0.3], variants: 'ceramic' });
G('cupset', 'Cup & mug set', 3000, 'kitchen', 'decor', 'cupset', { mount: S, size: [0.35, 0.2], variants: 'ceramic' });
G('cutlery', 'Cutlery set', 2500, 'kitchen', 'decor', 'cutlery', { mount: S, size: [0.3, 0.2] });
G('potset', 'Cooking pot set', 8500, 'kitchen', 'decor', 'potset', { mount: S, size: [0.5, 0.3] });
G('tray', 'Serving tray', 1500, 'kitchen', 'decor', 'tray', { mount: S, size: [0.45, 0.3] });
G('fruitbowl', 'Fruit bowl', 1800, 'kitchen', 'decor', 'fruitbowl', { mount: S, size: [0.32, 0.32] });
G('dishrack', 'Dish rack', 2000, 'kitchen', 'decor', 'dishrack', { mount: S, size: [0.45, 0.3] });
G('kitchenbin', 'Kitchen bin', 1500, 'kitchen', 'decor', 'k:trashcan', { s: 1.7 });

// ── H. Bathroom ──────────────────────────────────────────────────────────────
G('shower', 'Shower set', 8500, 'bathroom', 'furniture', 'shower', { size: [0.85, 0.85], action: 'shower' });
G('toilet', 'Close-coupled toilet', 4500, 'bathroom', 'furniture', 'k:toilet', { fit: [0.55, 0.8], action: 'toilet' });
G('sink', 'Pedestal washbasin', 3000, 'bathroom', 'furniture', 'k:bathroomSink', { fit: [0.65, 0.55], action: 'sink' });
G('vanity', 'Vanity basin unit', 16000, 'bathroom', 'furniture', 'k:bathroomSinkSquare', { s: 1.9, action: 'sink' });
G('bathtub', 'Freestanding bath', 14000, 'bathroom', 'furniture', 'bathtub', { fit: [0.9, 1.8], action: 'shower' });
G('bathcabinet', 'Bathroom cabinet', 3800, 'bathroom', 'furniture', 'k:bathroomCabinetDrawer', { fit: [0.55, 0.45], top: true, variants: 'wood' });
G('wallbathcabinet', 'Wall bathroom cabinet', 5500, 'bathroom', 'furniture', 'k:bathroomCabinet', { mount: W, s: 2, y: 1.45, variants: 'wood' });
G('bathmirror', 'Bathroom mirror', 3500, 'bathroom', 'decor', 'k:bathroomMirror', { mount: W, s: 2, y: 1.35 });
G('towelrack', 'Towel rack', 2500, 'bathroom', 'decor', 'towelrack', { mount: W, size: [0.7, 0.12], y: 1.2, variants: 'fabric' });
G('bathmat', 'Bath mat', 1200, 'bathroom', 'decor', 'bathmat', { size: [0.8, 0.5], nonSolid: true, variants: 'fabric' });
G('soapdispenser', 'Soap dispenser', 900, 'bathroom', 'decor', 'soapdispenser', { mount: S, size: [0.1, 0.1] });
G('toothbrush', 'Toothbrush holder', 700, 'bathroom', 'decor', 'toothbrush', { mount: S, size: [0.1, 0.1], variants: 'ceramic' });
G('showershelf', 'Shower shelf', 2000, 'bathroom', 'decor', 'showershelf', { mount: W, size: [0.4, 0.15], y: 1.4 });
G('hamper', 'Laundry hamper', 3500, 'bathroom', 'decor', 'hamper', { size: [0.45, 0.4] });
G('bathshelf', 'Bathroom storage shelf', 4500, 'bathroom', 'furniture', 'bathshelf', { size: [0.6, 0.35], top: true });

// ── I. Nigerian home essentials ──────────────────────────────────────────────
G('monobloc', 'Plastic monobloc chair', 1500, 'essentials', 'furniture', 'monobloc', { size: [0.55, 0.55], action: 'seat', variants: 'plastic' });
G('rechfan', 'Rechargeable standing fan', 14000, 'essentials', 'electronics', 'rechfan', { size: [0.55, 0.55], action: 'fan', rechargeable: true });
G('generator', 'Outdoor generator', 25000, 'essentials', 'lighting', 'generator', { mount: O, action: 'power', power: 'generator' });
G('compactgen', 'Compact outdoor generator', 18000, 'essentials', 'lighting', 'generator', { mount: O, action: 'power', power: 'generator', scale: [0.75, 0.8, 0.8], tint: { body: '#668c74' } });
G('inverter', 'Inverter & battery', 45000, 'essentials', 'lighting', 'inverter', { size: [0.55, 0.45], action: 'power', power: 'battery' });
G('largeinverter', 'Heavy-duty inverter unit', 62000, 'essentials', 'lighting', 'inverter', { size: [0.85, 0.6], scale: [1.5, 1.25, 1.3], tint: { body: '#687d98' }, action: 'power', power: 'battery' });
G('inverterbattery', 'Inverter battery (tubular)', 38000, 'essentials', 'lighting', 'battery', { size: [0.5, 0.35], action: 'power', power: 'battery' });
G('powerstation', 'Portable power station', 24000, 'essentials', 'lighting', 'powerstation', { size: [0.6, 0.45], action: 'power', power: 'battery' });
G('batterybank', 'Backup battery cabinet', 36000, 'essentials', 'lighting', 'batterybank', { size: [0.65, 0.55], action: 'power', power: 'battery' });
G('solar', 'Solar panel system', 220000, 'essentials', 'lighting', 'solar', { mount: O, action: 'power', power: 'battery', solar: true });
G('watertank', 'Water storage tank on stand', 65000, 'essentials', 'furniture', 'watertank', { mount: O });
G('carving', 'Decorative wooden carving', 16000, 'essentials', 'decor', 'carving', { size: [0.4, 0.4] });
G('compoundchairs', 'Outdoor compound chairs (set of 4)', 5500, 'essentials', 'furniture', 'compoundchairs', { mount: O, variants: 'plastic' });

// ── J. Outdoor & compound ────────────────────────────────────────────────────
G('gardenchair', 'Garden chair', 3500, 'outdoor', 'furniture', 'gardenchair', { mount: O, variants: 'wood' });
G('gardentable', 'Garden table', 6500, 'outdoor', 'furniture', 'gardentable', { mount: O, variants: 'wood' });
G('outdoorbench', 'Outdoor bench', 9000, 'outdoor', 'furniture', 'k:benchCushion', { mount: O, s: 2.2, variants: 'fabric' });
G('flowerpots', 'Flower pots', 2500, 'outdoor', 'decor', 'flowerpots', { mount: O });
G('planters', 'Decorative planters', 6000, 'outdoor', 'decor', 'planters', { mount: O });
G('gardenlights', 'Garden lights (solar, set of 3)', 7500, 'outdoor', 'lighting', 'gardenlights', { mount: O, outdoorLight: true });
G('porchlight', 'Porch light', 4500, 'outdoor', 'lighting', 'porchlight', { mount: O, facade: 2.5, outdoorLight: true });
G('securitylight', 'Security floodlight', 12000, 'outdoor', 'lighting', 'securitylight', { mount: O, facade: 2.9, outdoorLight: true });
G('walllight', 'Outdoor wall light', 5500, 'outdoor', 'lighting', 'walllight', { mount: O, facade: 2.2, outdoorLight: true });
G('housesign', 'House number sign', 3000, 'outdoor', 'decor', 'housesign', { mount: O, facade: 1.7 });
G('outdoorrug', 'Outdoor rug', 5500, 'outdoor', 'decor', 'outdoorrug', { mount: O, flat: true, variants: 'rug' });
G('umbrella', 'Patio umbrella', 18000, 'outdoor', 'furniture', 'umbrella', { mount: O });

// ── Hobbies & study ──────────────────────────────────────────────────────────
G('desk', 'Study desk & laptop', 18000, 'hobbies', 'furniture', 'desk', { size: [1, 0.6], action: 'desk' });
G('officechair', 'Office chair', 15000, 'hobbies', 'furniture', 'k:chairDesk', { s: 1.7, action: 'seat', variants: 'fabric' });
G('writingdesk', 'Writing desk & books', 7000, 'hobbies', 'furniture', 'writingdesk', { size: [1, 0.65], action: 'read', variants: 'wood' });
G('easel', 'Artist easel', 5200, 'hobbies', 'decor', 'easel', { size: [0.75, 0.85], action: 'art' });
G('guitar', 'Acoustic guitar & stand', 7800, 'hobbies', 'electronics', 'guitar', { size: [0.6, 0.5], action: 'music' });
G('sewing', 'Sewing workstation', 12500, 'hobbies', 'furniture', 'sewing', { size: [1, 0.65], action: 'craft' });
G('boardtable', 'Board-game table', 4200, 'hobbies', 'furniture', 'boardtable', { size: [0.9, 0.9], action: 'boardgame' });
G('aquarium', 'Display aquarium', 8000, 'hobbies', 'decor', 'aquarium', { size: [0.9, 0.45], action: 'aquarium' });

function finish(r) {
  const mount = r.mount ?? 'floor';
  let size = r.fit ? [r.fit[0], r.fit[1]] : r.size;
  if (!size && typeof r.model === 'string' && r.model.startsWith('k:')) {
    const b = KIT_BOUNDS[r.model.slice(2)], s = r.s ?? KIT_SCALE;
    if (b) size = [+(b.s[0] * s).toFixed(2), +(b.s[2] * s).toFixed(2)];
  }
  if (mount === 'outdoor' || mount === 'bedding') size = mount === 'bedding' ? [1, 1] : null;
  const item = {
    ...r, mount, size: size ?? null, tier: tierOf(r.price), resale: resaleValue(r.price), tabs: [r.tab, ...(r.also ?? [])],
    category: r.tab, fixed: mount === 'outdoor' ? 'outdoor' : undefined,
  };
  if (!item.fixed) delete item.fixed;
  return item;
}
export const HOME_GOODS = rows.map(finish);
export const GOOD_BY_ID = Object.fromEntries(HOME_GOODS.map((i) => [i.id, i]));
export const isFloorCovering = (id) => !!GOOD_BY_ID[id]?.nonSolid;
/** Items that never block walking (rugs, wall/ceiling fittings, things on tables or beds). */
export const isNonBlocking = (id) => { const g = GOOD_BY_ID[id]; return !!g && (g.nonSolid || ['wall', 'ceiling', 'surface', 'bedding'].includes(g.mount)); };
export const goodsForShop = (shop) => HOME_GOODS.filter((i) => i.shop === shop);
export const goodsForTab = (tab) => HOME_GOODS.filter((i) => i.tabs.includes(tab));

/** Delivery to your home: 8% of the price, between ₦300 and ₦6,000 (rounded to ₦50). */
export const deliveryFee = (price) => Math.max(300, Math.min(6000, Math.round(price * .08 / 50) * 50));
