import { CATALOGUE_BY_ID } from './VehicleCatalogue.js';
/**
 * Milestone 6 configuration: rentable homes, vehicles for sale, fuel and home cooking.
 * All prices are GAME prices in naira, chosen to fit the game's economy (jobs pay ₦500–₦3,000). They
 * are configuration, not surveyed rents or car prices. Rent is paid per period of game days.
 */

/** Home types. `interior` picks the reusable interior layout; size ranges pick real OSM houses that fit. */
export const HOME_TYPES = {

  selfcon: {
    label: 'Self-contain', blurb: 'One room with its own kitchenette and bathroom.',
    rent: 3500, days: 7, area: [35, 90], interior: 'selfcon', count: 12,
  },
  roomparlour: {
    label: 'Room and parlour', blurb: 'A bedroom and a sitting room (parlour), kitchen at the back.',
    rent: 7500, days: 7, area: [90, 160], interior: 'roomparlour', count: 10,
  },
  flat: {
    label: '2-bedroom flat', blurb: 'Two bedrooms, a parlour and a proper kitchen.',
    rent: 15000, days: 7, area: [160, 320], interior: 'flat', count: 10,
  },
  bungalow: { label: 'Premium bungalow', blurb: 'A spacious single-floor home with a fitted kitchen, larger bathroom and space for your furniture.', rent: 22000, days: 7, area: [220, 480], interior: 'flat', count: 8 },
  duplex: { label: 'Duplex', blurb: 'Two game floors, private bedrooms, kitchen and bathrooms. Generated layout, not a surveyed floor plan.', rent: 35000, days: 7, area: [160, 650], interior: 'duplex', count: 6 },
};

/** How many game days after the rent runs out the landlord still lets you renew at the old rate. */
export const RENT_GRACE_DAYS = 2;

/**
 * Vehicles for sale ("tokunbo" = imported second-hand). `model` is the TrafficSystem model id.
 * `tank` in litres, `use` in litres per km (game values, tuned so a tank lasts a good few trips).
 */
export const VEHICLE_MODELS = {
  keke: { label: 'Keke (used tricycle)', price: 22000, tank: 8, use: 0.45, maxSpeed: 13, accel: 3.2, steer: 1.9, grip: 5.5, cam: { dist: 5.4, height: 1.4 } },
  sedan: { label: 'Tokunbo saloon car', price: 48000, tank: 14, use: 0.8, maxSpeed: 22, accel: 4.2, steer: 1.6, grip: 7, cam: { dist: 6.6, height: 1.5 } },
  executive: { label: 'Executive saloon (tokunbo)', price: 160000, tank: 18, use: 1.0, maxSpeed: 26, accel: 5.2, steer: 1.55, grip: 7.8, cam: { dist: 7, height: 1.5 } },
  suv: { label: 'Luxury SUV (tokunbo)', price: 290000, tank: 22, use: 1.3, maxSpeed: 25, accel: 5.0, steer: 1.45, grip: 7.2, cam: { dist: 7.4, height: 1.8 } },
  mercedes_c300: {label:'Mercedes-Benz C 300',brand:'Mercedes-Benz',body:'executive',style:'luxury',price:320000,tank:18,use:1,maxSpeed:27,accel:5.6,steer:1.6,grip:8,cam:{dist:7,height:1.5}},
  mercedes_g63: {label:'Mercedes-AMG G 63',brand:'Mercedes-Benz',body:'suv',style:'boxy',price:950000,tank:26,use:1.6,maxSpeed:27,accel:5.8,steer:1.35,grip:7.3,cam:{dist:7.8,height:1.8}},
  lexus_es350: {label:'Lexus ES 350',brand:'Lexus',body:'executive',style:'spindle',price:350000,tank:20,use:1.1,maxSpeed:27,accel:5.4,steer:1.5,grip:8,cam:{dist:7,height:1.5}},
  lexus_rx350: {label:'Lexus RX 350',brand:'Lexus',body:'suv',style:'spindle',price:480000,tank:24,use:1.3,maxSpeed:26,accel:5.2,steer:1.45,grip:7.6,cam:{dist:7.4,height:1.8}},
  bmw_330i: {label:'BMW 330i',brand:'BMW',body:'sedan',style:'twin',price:330000,tank:18,use:1,maxSpeed:29,accel:6,steer:1.7,grip:8.4,cam:{dist:6.8,height:1.5}},
  bmw_x5: {label:'BMW X5',brand:'BMW',body:'suv',style:'twin',price:650000,tank:25,use:1.4,maxSpeed:28,accel:5.7,steer:1.5,grip:7.8,cam:{dist:7.5,height:1.8}},
  toyota_camry: {label:'Toyota Camry',brand:'Toyota',body:'sedan',style:'wide',price:210000,tank:18,use:.85,maxSpeed:25,accel:4.8,steer:1.6,grip:7.6,cam:{dist:6.6,height:1.5}},
  toyota_rav4: {label:'Toyota RAV4',brand:'Toyota',body:'suv',style:'wide',price:310000,tank:21,use:1.1,maxSpeed:25,accel:4.9,steer:1.5,grip:7.4,cam:{dist:7.2,height:1.8}},
  ...CATALOGUE_BY_ID
};

export { VEHICLE_LOTS } from './VehicleCatalogue.js';

/**
 * Wear and tear (game rules). Crashes dent the vehicle: `damage` 0–100. A damaged vehicle loses top speed
 * (up to 45% at 100). Mechanics at the car stands fix it for a price per point; spare parts from the
 * market fix some of it yourself. Car stands also buy vehicles back at 60% of the price, less damage.
 */
export const WEAR = {
  crashSpeed: 5,            // m/s: impacts slower than this leave no mark
  perMs: 2.6,               // damage points per m/s above crashSpeed
  maxSpeedLoss: 0.45,
  mechanicPerPoint: 0.0022, // fraction of the vehicle's price per damage point
  standRadius: 45,          // how close to a car stand you must be to sell or get it fixed
  buyBack: 0.6,
  parts: { 'spark-plug': { fix: 25, models: ['keke'] }, 'brake-pads': { fix: 20 }, 'engine-oil': { fix: 15 } },
};

export const FUEL = { pricePerLitre: 350, stationRadius: 22, jerrycanLitres: 5 };

/** Home cooking: ingredients come from the market; the meal goes into the bag as portions. */
export const RECIPES = [
  { id:'yam-eggs',label:'Cook yam & egg sauce',needs:{yam:1,eggs:1,tomatoes:1},makes:{id:'yam-eggs',qty:5} },
  { id:'plantain',label:'Fry plantain & eggs',needs:{plantain:1,eggs:1,'cooking-oil':1},makes:{id:'plantain-plate',qty:4} },
  { id:'egusi',label:'Cook egusi soup & garri',needs:{egusi:1,vegetables:1,beef:1,'palm-oil':1,garri:1},makes:{id:'egusi-soup',qty:6} },
  { id:'fish-stew',label:'Cook fish stew & rice',needs:{fish:1,'rice-mudu':1,tomatoes:1,onions:1,spices:1},makes:{id:'fish-stew',qty:5} },
  { id: 'noodles', label: 'Cook instant noodles', needs: { noodles: 1 }, makes: { id: 'cooked-noodles', qty: 6 } },
  { id: 'rice-stew', label: 'Cook rice and stew', needs: { 'rice-mudu': 1, pepper: 1, 'palm-oil': 1 }, makes: { id: 'rice-stew', qty: 5 } },
  { id: 'beans', label: 'Cook beans porridge', needs: { 'beans-mudu': 1, 'palm-oil': 1 }, makes: { id: 'beans-porridge', qty: 5 } },
  { id: 'garri', label: 'Soak garri with sugar', needs: { garri: 1, sugar: 1 }, makes: { id: 'soaked-garri', qty: 6 } },
];

/**
 * Skipping a ride or a drive charges realistic Onitsha travel time on the game clock — about 18 km/h by
 * keke or bus with stops, 24 km/h by car in town traffic — rather than the time the trip would take when
 * played out (the game clock runs a minute per real second, so a played-out ride costs far more game
 * time). Skipping is the quick way to get somewhere; riding or driving yourself is the scenic one.
 */
export const SKIP = { rideMetresPerMinute: 300, driveMetresPerMinute: 400, minMinutes: 2, minMetres: 150 };

export const vehicleBody=id=>VEHICLE_MODELS[id]?.body??id;
