# v0.48.0: Onitsha only (now with GRA), motor parks and bus stops, premium cars, neighbourhoods, decorating online, 11-a-side

The two briefs (map and environment) were audited first; the plan was approved. Nothing that already existed was
moved: every new thing is placed after the city is built, on clear land, and saves keep working.

## Onitsha only: everything outside is COMING SOON
- **The boundary is the River Niger.** West of the middle of the main channel is Delta State: the Asaba bank and
  the island in the river (Oshimili South).
- **On the Niger Bridge**, at mid-river, a closed red-and-white barrier with a gantry says **ASABA · COMING SOON**.
  Drive up to it and you stop; the game says only Onitsha is open for now.
- **The Asaba buildings are kept**: you can still see them across the water. You can't reach them, and:
  - traffic and people don't go there;
  - no bus goes there (the coaster now runs Upper Iweka Park – Bridgehead);
  - the GPS refuses it;
  - on the map it's "Asaba · COMING SOON".
- **The rest of the boundary is Onitsha's LGA lines** (Onitsha North and Onitsha South, from the OSM export). Okpoko,
  Obosi and Nkpor are outside them: you can see their buildings but not go there.
- **Signs where the main roads cross that line**: "TOWARDS NKPOR / OBOSI / OKPOKO · COMING SOON".
- **Saves:**
  - A player saved on the Asaba side starts at Bridgehead.
  - One rentable home stood on the Delta island. If your save rents or owns it, your tenancy, storage and every piece
    of furniture move to the nearest free home of the same kind in Onitsha (same floor plan, so the furniture stays
    where it was), and the game tells you.
  - The fuel desk at the Asaba filling station no longer opens.

## The map grew: GRA and the rest of Onitsha
From the OpenStreetMap export you sent (6.120–6.192 N, 6.748–6.830 E):
- **Added:** GRA Phase I and II, the north and east of Onitsha up to the LGA lines: 1,191 roads, 6,574 buildings, 11
  named places and a lake. The map now spans about 9 × 8 km; the playable part is everything inside the LGA lines.
- **Kept exactly:** everything that was already in the game. The new map is added after the old one (tool:
  `tools/osm_append.py`), and the world builds it last. A browser test loads the old map and the new one and compares
  them: every home to let, resident, shop, branch, hospital, car lot, landmark, bus stop, unfinished building and house
  on empty land has the same number in the same spot.
- **The one exception:** eight houses this game had invented on empty land at the old edge of the map now stand where
  OpenStreetMap has real buildings or roads. They are taken out; their numbers stay reserved so no other house moves.
  One family lived in one of them, so that neighbour no longer has a home.

## Motor parks: real terminals
- **Upper Iweka Motor Park** (60 × 38 m, 8 bays) and **Bridgehead Motor Park** (46 × 30 m, 5 bays) are now walled
  yards with:
  - a driveway from the road, and a gate with the park's name on a gantry;
  - a guard post with a barrier arm, and a concrete yard with a drive lane;
  - numbered loading bays with destination boards;
  - a long covered waiting shed with rows of benches and a departures board;
  - a ticket office and a park office;
  - a Mama Put and a drinks kiosk;
  - floodlights and a drain grating.
- **Buses work the yard.** Minibuses, commercial buses and coasters come off the road, drive in, pull into a free
  bay and let passengers off. People from the shed walk over and get in, then the bus reverses out, leaves through the
  gate and joins the traffic again.
- **Staff and travellers:** a ticket clerk, a dispatcher, park security, food sellers, and travellers waiting on the
  benches.
- **Intercity travel** (Lagos, Abuja, Enugu…) is honest about it: the bays are on the board, but the ticket office
  says intercity is COMING SOON. City lines stop on the road outside.
- **Where the yards go:** the Bridgehead park stands on the car park OpenStreetMap marks there. The houses this game
  had invented on mapped car parks, parks and pitches were taken away again. Everything else keeps its number.

## Bus stops you can see
Every stop is built for its street:
- **Large** (the named stops: the markets, Upper Iweka, Bridgehead, the mall…):
  - a double shelter with three benches, a lit information board with the lines, and queue rails;
  - a street light, a kiosk where there's room, and a long painted yellow bay on the road.
- **Medium** (busy roads): a longer shelter, two benches, a bin, a route panel and a painted bay.
- **Small** (quiet streets): a raised pad, a small shelter, a bench and the sign.

Every sign shows "BUS STOP" and the stop's own name. Roof colour, shape and wear vary from stop to stop. Of the 135
platforms, 129 have a built stop; 6 had no room and kept the sign.

## Premium vehicles
- **18 new models:**
  - **Luxury SUVs:** Mercedes-Benz G-Class (G 550), Mercedes-AMG G 63, Range Rover, Toyota Land Cruiser, Cadillac
    Escalade, BMW X5 and X7, Mercedes-Benz GLS, Porsche Cayenne.
  - **Executive saloons:** S-Class, 7 Series, Lexus LS 500, Audi A6 and A8.
  - **Performance:** BMW M5, Audi RS 7 Sportback.
  - **Everyday:** Toyota Avalon, Honda Civic.
- **How they look:** they're reshaped from the free (CC0) car models with their own details:
  - the G-Class's slab sides, flat roof, round lamps and spare wheel;
  - the Escalade's tall light bars;
  - the Range Rover's floating black roof;
  - the Audi single-frame grille;
  - sloping tails and quad pipes on the sporty ones.
- They have no manufacturer badges and are not exact replicas.
- **Prestige Autos Onitsha** (fictional), a glass showroom by Onitsha Mall:
  - cars on turntables inside and on the forecourt;
  - a sales desk, and a collection bay for the car you buy;
  - premium prices (from ₦780,000 to ₦3,200,000 in game money).
- The roadside stands keep their cars (plus the Avalon and Civic).
- **In traffic, premium cars are rare** (about 1 in 12 of their kind), except around the mall and in GRA (about one car
  in five there).
- They drive with the usual controls, open on your side and are saved like any car.
- **The coaster bus is now our own model.** The supplied bus model had no licence notice, so it was removed.

## Neighbourhoods look different
Neighbourhoods come from the map: the markets and interchanges, the old dense districts around them, the main roads,
the ordinary family streets, and GRA (the OSM GRA Phase I and II).
- **Family streets:** shade trees along the verges.
- **The old dense districts:** open concrete drains along the side streets, no trees.
- **Main roads through town:** black-and-white painted kerbs.
- **GRA Phase I and II:**
  - **Houses:** villas, mansions and duplexes, never tenements.
  - **Compounds:** tall finished walls with black steel gates.
  - **Streets:** palms and lawns on both verges, tall lamp posts, and good cars parked in front of the houses.

## Decorating someone's home, online
1. In your own home, open Messages → a friend → **Hire to decorate**, and choose a budget and a fee.
2. They accept and come in. They press E in the middle of the room and pick pieces from the furniture catalogue
   within the budget.
3. You see their suggestion. Accept: your game buys the pieces with your money and places them, and they see them
   appear.
4. When they finish, you're asked to pay their fee: a normal player-to-player payment.

Your money and your save change only on your own device, after you say yes. Adults only.

## 11-a-side
League matches for Onitsha City FC are now 11-a-side on the whole stadium field:
- 100 × 64 m, with full-size goals and markings, 22 players in a 4-4-2, and you up front;
- friendlies and the Community Cup stay 5-a-side on the small pitch.

## Database (XAMPP's MySQL/MariaDB)
The cloud-save path was run end to end on MariaDB 10.11, the database XAMPP ships. This found one out-of-date test
expectation, now fixed; the game itself was fine. LAUNCH_CHECKLIST.md lists the checks only you can do: Windows,
a real phone and two machines.

## Phones: less to draw
The bigger map would have meant about a third more to draw. Instead, roads, kerbs, drains, lawns, lamps and parked
cars are now split into 1 km and 400 m tiles. Only the tiles near you, or in view, are drawn. Measured in the test
browser at phone size, on the low setting:
- **At the start:** about 390,000 triangles, against 840,000 before the split.
- **In the main market:** about 300,000, against 760,000.

Memory use is about 100 MB higher than on the old map, and loading takes about 20% longer. That is the cost of 6,500 more
buildings. Check it on a real phone (LAUNCH_CHECKLIST.md).

## Small fixes
- 18 harmless "color undefined" warnings at start-up are gone. Some display cars at the car lots had no paint set; they
  stay white, as before.

## Saves
The save version is unchanged (23). Nothing to convert, except the moves described above for Asaba and the island.
