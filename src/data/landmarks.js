/**
 * Known places of Onitsha shown in the game.
 *
 * Positions are real-world lat/lon, converted at runtime with the same projection as the OSM map.
 * Every entry records where its position came from and how sure we are, so places can be
 * checked by people who know Onitsha and corrected here without touching any other code.
 *
 *   confidence: 'osm'          — position taken from an OpenStreetMap object in the supplied export
 *               'published'    — published coordinates (cited)
 *               'approximate'  — placed from descriptions only; needs local confirmation
 *
 * kind drives the 3D treatment: market (gateway arch + dense stalls), park (motor park dressing),
 * bridgehead, mall, church, district (label only), interchange.
 */
export const LANDMARKS = [
  {
    id: 'main-market', name: 'Onitsha Main Market', kind: 'market',
    lat: 6.1522, lon: 6.7750, radius: 230,
    blurb: 'One of the largest markets in West Africa, between the River Niger and Fegge.',
    confidence: 'published', source: 'Wikipedia: Main Market, Onitsha (6°09′08″N 6°46′30″E); lock-up rows match the OSM footprints',
    gate: 'ONITSHA MAIN MARKET',
  },
  {
    id: 'ochanja', name: 'Ochanja Market', kind: 'market',
    lat: 6.1447, lon: 6.7806, radius: 120,
    blurb: 'Foodstuff market off Iweka Road (Woliwo, Onitsha South).',
    confidence: 'approximate', source: 'Placed on Iweka Road from descriptions (billboard listings, Wikipedia: Woliwo, Onitsha South) — needs local check',
    gate: 'OCHANJA MARKET',
  },
  {
    id: 'upper-iweka', name: 'Upper Iweka', kind: 'interchange',
    lat: 6.1330, lon: 6.7922, radius: 260,
    blurb: 'The flyover crossroads and motor parks where Onitsha meets the Owerri and Enugu roads.',
    confidence: 'osm', source: 'OSM: Onitsha–Owerri Road bridge (flyover) and cloverleaf links',
    gate: 'UPPER IWEKA',
  },
  {
    id: 'upper-iweka-park', name: 'Upper Iweka Motor Park', kind: 'park',
    lat: 6.13506, lon: 6.79282, radius: 90,
    blurb: 'Inter-city buses load here for Lagos, Abuja, the East and the North.',
    confidence: 'osm', source: 'OSM: amenity=bus_station nodes (Peace Mass Transit Park)',
    gate: 'UPPER IWEKA MOTOR PARK',
  },
  {
    id: 'bridgehead', name: 'Bridgehead (Head Bridge)', kind: 'bridgehead',
    lat: 6.13152, lon: 6.77048, radius: 260,
    blurb: 'The Onitsha end of the Niger Bridge; markets and traffic from Asaba arrive here.',
    confidence: 'osm', source: 'OSM: place=neighbourhood "Bridgehead" and NIGER BRIDGE way',
    gate: 'WELCOME TO ONITSHA',
  },
  {
    id: 'niger-bridge', name: 'Niger Bridge', kind: 'landmark',
    lat: 6.1352, lon: 6.7625, radius: 120,
    blurb: 'Steel bridge over the River Niger linking Onitsha and Asaba (opened 1965).',
    confidence: 'osm', source: 'OSM: way "NIGER BRIDGE" (bridge=yes)',
  },
  {
    id: 'shoprite', name: 'Shoprite Onitsha Mall', kind: 'mall',
    lat: 6.15602, lon: 6.79515, radius: 140, osmBuilding: '1375577040',
    blurb: 'Onitsha Mall, the state’s first modern shopping mall, anchored by ShopRite (opened 2016).',
    confidence: 'osm', source: 'OSM: shop=department_store "ShopRite" node inside this footprint',
    gate: 'ONITSHA MALL',
  },
  {
    id: 'basilica', name: 'Holy Trinity Basilica', kind: 'church',
    lat: 6.16124, lon: 6.77692, radius: 110, osmBuilding: '669486591',
    blurb: 'Cathedral Basilica of the Most Holy Trinity, on the Niger bank north of the market.',
    confidence: 'osm', source: 'OSM: building=church "Cathedral Basilica of the Most Holy Trinity"',
  },
  {
    id: 'asaba', name: 'Asaba · COMING SOON', kind: 'district', comingSoon: true,
    lat: 6.13721, lon: 6.75129, radius: 300,
    blurb: 'Delta State, across the River Niger. COMING SOON: only Onitsha is open for now; the Niger Bridge is closed at mid-river.',
    confidence: 'osm', source: 'OSM: west end of the Niger Bridge way and the Onitsha-Asaba Road (only the bank next to the bridge is in the play area)',
  },
  {
    id: 'fegge', name: 'Fegge', kind: 'district',
    lat: 6.13705, lon: 6.77402, radius: 420,
    blurb: 'Planned residential grid south of the market; Onitsha South LGA headquarters.',
    confidence: 'osm', source: 'OSM: place=suburb "Fegge"',
  },
  {
    id: 'ike-dunkofia', name: 'Ike Dunkofia Plaza', kind: 'plaza',
    lat: 6.1525, lon: 6.78205, radius: 50,
    blurb: 'Shopping plaza listed in OpenStreetMap.',
    confidence: 'osm', source: 'OSM: shop=mall node',
  },
  { id: 'all-saints', name: "All Saints’ Cathedral", kind: 'church', lat: 6.154702, lon: 6.789541, radius: 60,
    blurb: 'Anglican cathedral on Ozalla Road by Awka Road. Public visitor entrance.', confidence: 'approximate', source: 'https://en.wikivoyage.org/wiki/Onitsha' },
  { id: 'ckc', name: 'Christ the King College (CKC)', kind: 'school', lat: 6.14284, lon: 6.79086, radius: 90,
    blurb: 'Historic secondary school on Oguta Road, founded in 1933. Campus location is mapped; no claim of a surveyed interior.', confidence: 'approximate', source: 'https://en.wikipedia.org/wiki/Christ_the_King_College,_Onitsha' },
  { id: 'ime-obi', name: 'Ime Obi · Palace of the Obi', kind: 'public', lat: 6.153038, lon: 6.79219, radius: 65,
    blurb: 'Traditional palace and cultural headquarters of the Obi of Onitsha. Public visitor entrance; private royal rooms are not accessible.', confidence: 'approximate', source: 'https://en.wikivoyage.org/wiki/Onitsha' },
];
