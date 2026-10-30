> v0.16.0 adds a local multiplayer prototype. Read LOCAL-MULTIPLAYER-16.md for what is shared and the remaining public-hosting work; older roadmap entries below are historical planning.

# Onitsha Way — Architecture & Roadmap

## Technical architecture

- **Stack:** Vite 6 + three.js r169, plain ES modules. There is no framework, physics engine or backend.
- **One world, many systems.** `Game` owns the frame loop and the state machine (`loading → menu → creator → playing ⇄ paused/map`).
  Systems talk through an `EventBus` (`clock:hour`, `ui:*`, later `wallet:changed`, `job:completed`, …), so a delivery can
  update the wallet, the NPC's memory, the job log and the save without those modules importing each other.
- **Single sources of truth:** `SimClock` (time), `CollisionWorld` (walkability), `MapData` road graph (navigation/routes),
  `SaveSystem` (persistence), and from M4 an `Economy` service (all money movements go through it).
- **Control states:** `PlayerController.state` ∈ `onFoot | passenger | driver | frozen`. Exactly one state owns the player,
  which is how passenger mode (M5) and personal driving (M6) stay separate.
- **World generation:** OSM → `osm_extract.py` → compact JSON → builders produce merged, chunked (200 m) meshes:
  ~60 draw calls for 1,779 buildings, 129 roads, ~600 poles, ~790 stalls and 260 trees.
- **Collision:** 2D grid of building wall segments plus prop circles. The city is flat, so this is cheaper and more robust
  than a 3D physics engine. It costs about 0.15 ms per frame for the player and will scale to dozens of NPCs.
- **Characters:** `HumanRig` builds a real `SkinnedMesh` + `Skeleton` (17 bones) procedurally: body, face (eyes, lids, brows,
  nose, lips, ears), six hairstyles and six outfits. Skin weights come from distance to bone segments, so joints bend smoothly.
  `CharacterAnimator` drives idle, walk, run, airborne and turn-lean poses, with the gait phase tied to distance travelled
  (no foot sliding). The same builder will generate NPCs with varied parameters.

## Asset strategy

1. **Now:** procedural everything (zero licence risk, ~330 KB of map data, fast load).
2. **Later, where it clearly wins:** CC0 / properly licensed GLB assets, recorded in `ASSETS.md` with source and licence, for
   example higher-detail vehicles and furniture. Rigged human GLBs can be retargeted onto the same bone names if we choose to.
3. **Audio (M2/M7):** CC0 or original recordings only.

## Highest-risk technical decisions

| Risk | Why it matters | Mitigation |
|---|---|---|
| Procedural characters vs. imported rigged models | Visual quality ceiling of code-built humans | Rig and animation API are model-agnostic (bone names), so a GLB body can replace `HumanRig` later without touching the controller |
| Browser performance with a living city | NPCs + traffic + shadows on mid-range phones | Chunked merged meshes, instancing, distance-based NPC LOD and update rates, quality presets (Low is the mobile default) |
| Flat 2D collision | Onitsha is hilly in places; there are no stairs or multi-level interiors yet | Height queries are isolated in `PlayerController`, so a heightfield can come later; interiors (M6) are separate scenes with their own colliders |
| OSM data gaps | No storey counts, few names, no parcel/compound walls | Deterministic generation from seeds; never present generated detail as surveyed fact |
| Shared public transport simulation | Pickups/drop-offs plus guaranteed delivery of the player | Route system on the extracted road graph; trips are state machines with fare charged once at departure |
| Save compatibility | Many systems will add state | Versioned save with `migrate()` defaults; reserved fields already exist |

## Milestones

### ✅ Milestone 1 — Playable 3D foundation
Acceptance criterion: *the player can explore a small, coherent 3D neighbourhood smoothly.*

**Implemented**
- Vite + three.js project, modular architecture as above.
- Real OSM street grid and footprints (about 1.5 × 0.93 km): asphalt and laterite roads, clean junctions, centre dashes,
  open concrete drains with paved shoulders on main roads, multi-storey shops with roll-up shutters and signboards, louvre
  and burglar-barred windows, zinc, rusted and long-span roofs, flat slabs with parapets and black water tanks, market
  lock-up rows, electric poles with cables and lamps, umbrella stalls with goods, trees, and a parked keke rank.
- Main menu (live city fly-over), character creator (male/female, 6 skin tones, 3 hairstyles each, 3 outfits each,
  7 Ankara prints, 6 plain colours, name), settings (quality, sensitivity, invert Y, FPS), pause, credits.
- Rigged procedural character with idle / walk / run / jump animation.
- Third-person camera: orbit, zoom, wall avoidance, auto-follow when not steered.
- Movement with acceleration, running, jumping, wall and prop collision, world bounds.
- Desktop (pointer lock, plus drag-look fallback) and mobile (joystick, look-drag, Run/Jump) controls.
- Day/night cycle on the sim clock (24-minute day): sun path, hazy sky, lit shops, windows, signs and street lamps at night.
- HUD: real street name under the player, time and day, heading-up minimap; full-screen map with OSM street names.
- Versioned local save (character, position, clock), autosave every 60 s and on pause or tab-hide, corrupt-save
  quarantine, and a confirmed new game that keeps a backup.

**Verified (headless Chromium, software WebGL)**
- Production build succeeds; no runtime errors on load, in the menu, the creator, play, night and the map.
- Collision stress test: 3,000 random movement steps, player never inside a building.
- CPU cost of `updatePlaying` ≈ 0.14 ms/frame; ~60 draw calls, ~330k triangles in view.
- Not yet verified: real GPU frame rates on desktop and phones. Software rendering here only gives a lower bound
  (~24 fps), so this needs a real-device check.

**Known limitations / partial**
- The terrain is flat; there are no compound walls or gates yet (OSM has no parcel data); facade variety is limited to an atlas of 16 bays.
- Buildings cannot be entered (M6). Kekes are parked decoration (M5). No NPCs or audio yet (M2/M3).
- The shopfront tiles read as blocky up close; a higher-resolution facade pass is planned in M2.

### ✅ Milestone 2 — Visual identity & world building
Acceptance criterion: *the world looks and feels like a recognisable Nigerian urban environment inspired by Onitsha, not a generic empty city.*

**Implemented**
- **A bigger, real map:** 4.2 × 3.7 km instead of 1.5 × 0.9 km, covering Main Market, Ochanja, Fegge, Bridgehead and the
  Niger Bridge, Upper Iweka, ShopRite (Onitsha Mall) and Holy Trinity Basilica. There are 13,376 OSM footprints and 874 roads.
- **Buildings no longer intrude into roads:** the extractor cuts overlapping footprints back to the carriageway edge and
  drain (1,193 trimmed, 88 dropped).
- **River Niger:** built from the OSM multipolygon with sloped laterite banks and an animated surface. It is not walkable.
- **Bridges from OSM `bridge=yes`:** the Niger Bridge has a steel truss, piers and ramps; the Upper Iweka flyover has twin
  decks, parapets and piers you can walk under. Short culvert "bridges" stay at road level.
- **Landmarks** (`src/data/landmarks.js`, each with source and confidence):
  - Gateway arches with lit signs: Onitsha Main Market, Ochanja Market, Upper Iweka, Upper Iweka Motor Park, and
    "Welcome to Onitsha" at Bridgehead.
  - Upper Iweka Motor Park filled with 18 inter-city minibuses.
  - Onitsha Mall with a curtain wall, cladding, entrance canopy and an "ONITSHA MALL · ShopRite" sign.
  - Holy Trinity Basilica with stained-glass bays, a steep red roof, and twin bell towers with spires and crosses.
  - Denser market stalls inside market zones; keke ranks at the markets, Bridgehead, Upper Iweka and the mall.
- **New street life:** about 1,600 compound walls with black gates, about 2,700 roadside kiosks (about 1,170 with
  generators), and rooftop billboards for fictional brands.
- **Facades:** a higher-resolution atlas (1.5× on Medium, 2× on High); shop interiors with depth, counters, hanging goods
  and naira price tags; ceramic-tiled plaza fronts; mall and church tiles.
- **Streaming:** 200 m building chunks built within a 4 ms per-frame budget and unloaded when far away. Props are split
  into 300 m culled cells. About 270k triangles and about 180 draw calls in view on Medium.
- **Audio foundation:** a procedural Web Audio manager with market crowd, traffic, keke horns, crickets at night, river
  and surface-aware footsteps. Levels follow location and time of day; volume is in Settings.
- **HUD and maps:** the HUD shows the landmark you are in plus the street. The minimap is drawn live with landmark
  markers. The full map zooms and pans (wheel, drag, pinch, buttons) and shows landmark pins with a dashed ring on
  approximate ones.
- **Save format v2:** Milestone 1 positions are reset to Old Market Road because the map origin changed.

**Verified (headless Chromium, software WebGL)**
- Production build passes; no runtime errors in the menu, creator, play, map, gates and landmark visits.
- Collision stress test: 3,000 random steps across the new map with zero ends inside a building.
- `updatePlaying` costs about 0.3–0.5 ms/frame on the CPU, including chunk streaming. Save, continue and the
  corrupt-save checks still pass.
- Not verified: real-GPU frame rates and how the procedural audio sounds on real speakers (the audio graph runs without
  errors, but nobody has listened to it yet).

**Known limitations**
- Ochanja's position is approximate. Other markets (Ogbo-Efere, Electrical, Relief, Ogbo-Osisi and others) are not placed
  because no reliable coordinates were found.
- Bridges and flyovers can't be walked on yet; vehicles will use them from M5.
- The ground is still flat and shop interiors are textures, not enterable rooms.
- The procedural crowd sound is a placeholder-quality synthesis. Recorded CC0 or original field recordings would sound
  better if you can supply them.

### ✅ Milestone 3 — Living NPCs (+ road traffic)
Acceptance criterion: *the neighbourhood contains believable activity and the player can interact with its inhabitants.*

**Implemented**
- **Residents with identities.** About 3,500 persistent residents are tied to real places: traders at market stalls and shop
  fronts, keke-rank agents, and neighbours at compound gates. Each has a name and title (Mama, Madam, Oga), a role, goods
  type, schedule and appearance template.
- **Passers-by and hawkers.** Generated along the OSM road graph. Hawkers carry head-loads.
- **Embodied near the player** from a pool of pre-built rigs (14, 26 or 38 by quality); no rig is built during play. The
  NPC pool adds gele head-ties and red caps for older characters.
- **Routines from the clock.** Traders open about 7:00–19:30, agents 6:00–21:00 and neighbours come and go; the streets
  thin out at night. Crowds are heavier around the markets, Upper Iweka and Bridgehead.
- **Behaviours:** walking the road edges and choosing turns at junctions; stopping for the player; browsing at traders;
  two passers-by stopping to chat; head-turning to look at the player; reacting to being bumped, with escalation that is
  remembered.
- **Onitsha language pack.** All supplied expressions are stored verbatim with metadata and verification status; event-only
  and reference-only entries are respected.
- **Dialogue.** Data-driven conversations by role and familiarity:
  - greetings (Mon-sir oga, Kee kosi, John O, Aloba m), introductions, small talk and gossip;
  - trader business talk and bargaining as conversation only (Mmemme, Ote, Fibre/OO/1 mkpa, Mbada, Kpaa ife, Inye iru
    evi). No money is granted; buying is labelled as coming in M4;
  - directions computed from the real map, which set a waypoint; invitations ("Tinyelu m ahu") at higher familiarity;
    farewells.
- **Dialogue UI and street life:** the panel shows the character, expression, supplied meaning (tagged unverified), the
  example line (tagged), and numbered responses. Speech bubbles carry call-outs with meanings. A Phrasebook in the pause
  menu tracks which expressions you have heard.
- **Relationships.** Talks, familiarity, name known, positive and negative counts, bumps and invitations change greetings
  ("Met before", "Familiar face", "Close friend · Aloba m") and are saved.
- **Road traffic (requested addition).**
  - Executive saloons, luxury SUVs, everyday sedans, kekes, minibuses, coaster buses and lorries drive on the right along
    the road graph. They follow each other, queue at junctions, stop for the player and pedestrians, and honk.
  - Upper Iweka runs at about 2× density (about 100 vehicles around the flyover by day), markets at 1.5×, and less at night.
  - Parked cars line the main roads and fill the Onitsha Mall car park. The player cannot walk through vehicles or people.
  - Car shapes are generic: no manufacturer badges or logos.

**Verified (headless Chromium, software WebGL)**
- No runtime errors from the menu through creator, play, dialogue, phrasebook, and save then continue.
- Relationships and heard expressions persist across a reload.
- CPU per frame with traffic, NPCs and the player is about 1 ms. Draw calls are about 180 with NPCs and traffic around.
- Not verified: real-GPU frame rate with 26 skinned NPCs on phones. Low quality uses 14.

**Known limitations**
- NPC pathing follows road edges and is kinematic; NPCs can clip through stalls or kiosks at corners.
- Vehicles don't use the bridges or flyover decks yet, and there are no traffic lights or wardens (Onitsha mostly has
  neither, but junction behaviour is simplified). Headlights are not lit at night yet.
- Appearance per identity comes from a template pool, so a resident can occasionally look like someone else.
- The supplied expressions still need checking by local speakers, and some example dialogue may sound off to a native ear.

### ✅ Milestone 4 — Economy & jobs
Acceptance criterion: *the player can earn, spend, buy goods, and complete a full job cycle.*

**Implemented**
- **Wallet in naira** (start ₦5,000) behind one authoritative `Economy` service:
  - integer amounts; refuses to go negative, so there are no partial payments;
  - an idempotency key on every transaction, so a reward or purchase is never applied twice, even after save/load;
  - a ledger shown in the Bag & wallet screen. A HUD ₦ chip updates with a small pulse.
- **Shops.** Every trader sells their goods type and hawkers sell water and snacks. Each trader marks prices up differently.
  - "Kpaa ife" asks for a reduction, up to two rounds, never below a floor that improves with familiarity.
  - Offering half gets "Inye iru evi" and a small hit to the relationship.
  - Buying checks money and bag space first, then debits once. The trader says "O suo" only after a real, completed purchase.
- **Bag:** 16 slots, stackable goods, unique job parcels.
- **Jobs from traders** ("You get any small work for me?"), one per trader per day, between real residents 140 m to 1.1 km apart:
  - **Deliver** a parcel (it goes into your bag);
  - **Collect** goods and bring them back;
  - **Errand:** buy a named item from a trader who sells it; the giver refunds the standard price plus a tip.
  - Rewards scale with distance.
- **Job guidance:** JOB chip with the next step, distance and direction (and opening hours if the target is closed); a
  minimap marker; a ★ above the target person; job targets always spawn when you get close. You can abandon a job
  (the parcel is handed back, no pay).
- **Save format v3:** wallet, ledger, idempotency keys, bag and jobs. Milestone 3 saves migrate with the starting balance and keep their relationships.

**Milestone 3 follow-ups fixed in this build**
- NPCs no longer walk through stalls, kiosks, poles or walls; walkers are pushed out of colliders.
- Vehicles drive over the Niger Bridge and the Upper Iweka flyover decks at the right height, pitching on the ramps. Traffic
  on and under the decks no longer blocks each other.
- Head lamps, tail lamps and light pools on the road at night.
- Each resident has their own skin tone, fabric print or colour, gele print and height from their identity, so pooled
  rigs no longer produce identical-looking people. The same resident looks the same each time you meet them.

**Verified**
- `npm test`: 13 unit tests pass covering credits/debits, insufficient funds, idempotency (including after save/load),
  invalid amounts, bargaining floor, purchase, bag-full, and delivery/collect/errand completion, single payment and abandon.
- Browser (headless):
  - talk → shop → Kpaa ife (₦2,450 → ₦2,250) → buy (₦5,000 → ₦2,750, ledger entry);
  - accept a delivery → travel about 500 m → hand in → paid ₦950 once;
  - a v2 save migrates. No runtime errors.
- Found and fixed during testing: a horn sounding before audio was unlocked crashed the frame update.

**Known limitations**
- Goods have no use yet beyond errands (eating, gifting and reselling come later). There is no selling to traders yet.
- Stock is unlimited and prices don't change with time of day or demand.
- One active job at a time; no time limits on jobs.

### ✅ Milestone 5 — Public transport
Acceptance criterion: *the player can wait at a stop, choose a destination, pay once, ride, and get down safely.*

**Implemented**
- **Network from the real map** (`TransitNetwork`): 8 lines — K1–K4 keke, M1–M2 mini bus, B1 commercial bus, C1 coaster —
  routed on the OSM road graph with per-mode road costs. Buses keep to main roads; keke use side streets and the flyover
  but never the Niger Bridge. 74 stops with 115 kerb platforms (one per side of the road a line uses), named after the real places they serve or from street
  names, cross streets and the distance to the nearest landmark. Stops are never on bridges, in junctions or on another
  road's carriageway (unit-tested).
- **Street furniture:** yellow BUS STOP signs, lit at night, at every platform, and zinc shelters with benches at the
  named stops where there's room.
- **Fleet** (`TransitFleet`): 114 vehicles share the road with private traffic and follow the same driving rules. They
  pull in to the kerb, pick up queues and drop riders off within their seats, and skip stops nobody needs. The whole
  fleet runs everywhere; vehicles far from the player use a cheap update and are not drawn. Line boards in the line colour.
- **People at stops:** queues build up by place and time of day. Waiting people stand by the sign, walk to the door and
  get in when picked up. Riders who get down step onto the kerb and walk away.
- **The player's trip** (`TripSystem`, a small state machine): choose a destination at a stop (or ask a waiting driver)
  → wait (a vehicle is brought from out of sight if none is coming) → board at the door (seat and fare checked) → the
  fare is charged **once**, with a per-trip idempotency key, when the vehicle pulls away. If the money is gone by then,
  the driver puts you down at the stop and the balance never goes negative. → ride → get down at your stop
  automatically, or ask for "next stop" or "drop me here" (the next safe kerb spot, never a bridge or junction). Getting
  down is only possible when the vehicle is stopped.
- **Passenger state:** `ControlState.PASSENGER` — the vehicle carries the player and the player never steers it, so it
  stays separate from driving (M6). Seated pose, an orbit camera around the vehicle, and a seat view in keke.
  A ride panel shows the line, next stop, stops and distance left and the fare.
- **Maps:** routes (keke dashed) and stops on the full map, stops on the minimap, and a marker for your destination.
- **Save while riding:** the fare is paid, so you continue at your destination stop.
- **Save format v4:** several jobs, energy, the trip log and traders' stock. v3 saves keep their job (with no time limit).

**Milestone 4 follow-ups fixed in this build**
- **Goods have uses:** eat or drink food from the bag to restore energy. Energy runs down through the day and faster
  when running; low energy slows your run, and sitting in transport lets you rest. Pure water bags open into sachets.
  Raw foodstuff needs cooking (housing, M6). You can **gift** an item to anyone, once a day per person, which warms them to you.
- **Selling:** traders buy goods of their own line at about half price, always below their selling price.
- **Limited stock:** each trader has a daily stock from their identity and the day, which runs down as you buy, goes
  up when you sell, and restocks each morning.
- **Up to three jobs at once, with deadlines** set from the distance involved and never later than the shops close.
  A missed deadline fails the job: the parcel goes back, nothing is paid and the giver remembers. Jobs screen with
  "follow on the map" and abandon for each job; the JOB chip shows the time left and turns red when it's short.

**Found and fixed during testing**
- **Junction gridlock.** Queues could close into a cycle at busy junctions (and behind a person standing in the road)
  and freeze traffic for good. Drivers now edge past people after honking, squeeze past crossing traffic after a few
  seconds, a stationary vehicle's claim on a junction expires, and two drivers waiting for each other at a merge take
  turns. Long-jammed traffic away from the player clears. In the final run, 5-minute waits at 29 stops around Ochanja,
  Main Market, ShopRite, Upper Iweka and Bridgehead left no vehicle stuck for over a minute. A vehicle still waits, honking, for a player
  standing right in front of it.
- **Self-pause.** Opening and closing the stop picker could pause the game, because the release of the mouse lock was
  taken for the player leaving. Releases the game asks for itself are now ignored.
- **Half the lines missing in the game.** The Bridgehead gateway arch stands on the one-way slip onto the Niger Bridge, so
  lines anchored there could arrive but never leave, and K3, M2, B1 and C1 silently failed to route (the Node tests
  used the landmark centre and passed). Anchors must now be reachable both ways, and a unit test uses the in-game
  gateway positions.
- **Sign too close to another road.** One stop sign stood on a parallel road's carriageway. Placement now checks every road.
- Bus-stop sign plates were hidden inside their backing board.

**Verified**
- `npm test`: 34 unit tests, including on the real map:
  - every line is continuous and routed on real roads, also with the in-game gateway anchors;
  - stops are valid;
  - fares are whole naira in ₦50 steps;
  - a full trip charges once;
  - getting down early is free;
  - no boarding without the fare;
  - an unpaid departure puts you down;
  - "drop me here" uses a safe spot;
  - seats are never over-filled across a long fleet run;
  - stock, selling, energy and the v3 → v4 migration.
- Browser (headless, full game loop):
  - stop → picker (32 destinations from Main Market) → a keke came within half a minute of real time (9–29 game
    minutes) → board → ₦300 charged once on departure → got down automatically 2 m from the destination stop;
  - "drop me here" on another keke;
  - boarding refused with ₦40 for a ₦450 fare, no money moved;
  - mini bus ride and keke seat view;
  - phone layout;
  - eat from the bag (+15 energy);
  - sell to a trader (₦600 back, stock 2 → 3);
  - gift once a day;
  - a 4th job refused;
  - missed deadline fails a job;
  - v2 and v3 saves migrate;
  - save/continue, corrupt-save quarantine and collision stress still pass.
  - Updating a frame costs about 0.3 ms on the CPU, and the city simulation with all 114 transport vehicles
    0.9–1.5 ms (software renderer). About 330 draw calls.
- Not verified: real-GPU and phone frame rates.

**Known limitations**
- Fares are fixed game prices with no bargaining, no "change" haggling and no conductor yet. There are no inter-city
  trips over the Niger Bridge (the coaster turns at Bridgehead).
- People inside buses are not drawn individually (keke passengers are). Your character is hidden while seated in a bus.
- The fleet keeps no timetable; waits depend on where the vehicles are, and a vehicle is brought in if none is near.
- Stop names for unnamed places are generated, not local names. Local knowledge would improve them.

### ✅ Milestone 6 — Housing & personal vehicles
Acceptance criterion: *the player can rent and live in a home, and own and drive a vehicle, with safe saves.*

**Implemented**
- **Rental listings in real houses** (`HousingSystem`): 15 homes chosen deterministically from OSM residential
  footprints by floor area — 6 self-contains (₦3,500 / 7 days), 5 rooms and parlours (₦7,500), 4 two-bedroom flats
  (₦15,000). Only houses whose front door has a clear line to the street are listed (compound walls and gates are
  solid). Listing screen (L / pause menu) with "show on map".
- **Payment:** rent per period through `Economy.transact`, one key per period. No double charge, no partial payment,
  never more than one period ahead. Renewing continues from the end of the current period.
- **Physical entrances:** a door and frame on each house's real front wall, with a TO LET / HOME / RENT DUE sign that
  follows the rent status.
- **Reusable interiors** (`Interiors`): three procedural layouts (self-contain, room and parlour with a partition,
  2-bedroom flat with two partitions), shared by every house of that type. They are built once at x ≈ 9 km in a
  collision zone outside the city: walls and furniture are colliders, and the city is beyond the far plane. Indoor
  lighting comes from the room lamp, or daylight through the windows. The indoor camera stays under the ceiling and
  swings away from walls.
- **Furniture:**
  - **bed:** sleep until 07:00 (energy full) or nap;
  - **gas cooker:** 4 recipes turn foodstuff from the market into meal portions, all-or-nothing;
  - **cupboard:** 30-slot storage per home, kept between rentals;
  - **wardrobe:** outfit, print and colour, saved;
  - **sofa:** rest an hour;
  - **light switch**, and the **door**.
  Time-consuming actions move the clock and warn about job deadlines first.
- **Access control:** tenants use everything. A vacant listing can be viewed (furniture locked; you can rent from
  inside). An expired rent locks the door until you renew (2-day grace), then the place goes back on the market.
  Other houses have no entrance.
- **Interior/exterior transitions:** short fade; the world stays loaded and alive around your front door while
  you're inside; HUD shows "Home — …" / "Viewing: …".
- **Save restore safety:** the saved position is always the step outside, plus which home you were in. On load you're
  put back inside only if you still rent it.
- **Personal vehicles** (`VehicleSystem`, `VehicleController`): car stands at Upper Iweka, Old Market Road and
  Bridgehead (keke ₦22,000, tokunbo saloon ₦48,000, executive saloon ₦160,000, SUV ₦290,000 — game prices). Bought
  once with the sale spot's key, then parked where you left it and saved.
- **Driving:** `ControlState.DRIVER`, separate from riding transport.
  - Arcade handling (accelerate, brake/reverse, speed-sensitive steering).
  - Three collision circles against buildings, walls, poles and the river, plus traffic and people.
  - Follows the flyover and Niger Bridge decks up the ramps (parapets keep you on).
  - Head and tail lamps at night; horn.
  - Get out on the driver's side, or the other side if blocked; not while moving or on a bridge.
  - Traffic sees your vehicles (parked or moving) as obstacles.
- **Fuel:** tank and consumption per model. Filling stations from OSM (4). Pay for whole litres you can afford. A
  jerrycan (spare-parts traders) refuels anywhere.
- **Skip travel (requested):**
  - **"Skip to my stop"** on a paid ride.
  - **"Skip drive"** to your map marker (tap the big map; the HUD marker chip clears it) or your job's next stop,
    along the real road route (one-way streets respected), parking at the kerb.
  - The clock moves on by realistic Onitsha travel time (≈18 km/h by keke or bus, ≈24 km/h by car). Fuel is used
    for the distance, and you're warned if a job deadline would pass.
- **Save format v5:** rented homes, cupboards, lamp states, owned vehicles and sold sale spots. v4 saves migrate with
  empty defaults.

**Milestone 5 follow-ups fixed in this build**
- **Fare bargaining:** at the door the driver names the fare. "Kpaa ife" may knock about 12–20% off — keke 65% of the time,
  mini bus 40% — once per vehicle, never below the minimum fare, and deterministic. Bus and coaster fares are fixed.
  You pay exactly what you agreed.
- **Trips across the Niger Bridge to Asaba:** the map now includes the Asaba bank and the strip south of Bridgehead
  needed to drive back into town. The coaster C1 runs Upper Iweka Park → Bridgehead → over the bridge → Asaba (Head
  Bridge) and back, and you can drive there yourself. All earlier map content, ids and residents are unchanged (see README).
- **People inside buses:** car and bus bodies are now hollow above the beltline and the glass is a separate
  see-through mesh. Drivers sit in every vehicle, passengers fill buses and coasters from the fleet's real rider
  counts, and your own character is visible in your seat.
- Also fixed while testing: a pause right after closing an overlay; the indoor character being lit only by
  sunlight (black at night); the furniture tint from the lamp; the indoor camera pressed against walls.

**Verified**
- `npm test`: 55 unit tests, including on the real map:
  - listings, rent (once per period, refused without money, paid-ahead limit, grace and expiry, renewal continuity),
    access rules and cupboard persistence;
  - cooking all-or-nothing and the full-bag case;
  - buying vehicles (once; refused without money), fuel burn, whole-litre refuelling and the jerrycan;
  - skip-drive routing (continuous, one-way respected, across the Niger Bridge to Asaba and back);
  - the coaster stop on the Asaba bank;
  - fare bargaining over 30 seeds (sometimes works; never below the minimum; charged exactly once at the agreed
    fare) and fixed bus fares;
  - multi-day clock skips;
  - the v4 → v5 migration;
  - the earlier map area staying first and unchanged.
- Browser (headless, full game loop):
  - At a room and parlour: look inside (furniture locked) → rent ₦7,500 from inside → sleep 20:32 → 07:00 next day
    (energy 100) → cook rice and stew (5 portions) → cupboard → wardrobe (saved) → light switch → save inside →
    reload: back inside → leave onto the street.
  - Buy a tokunbo saloon (₦48,000) → drive (0–32 km/h) → drive into a wall at 24 km/h (stops, never inside the
    building) → up the Upper Iweka flyover (deck height 6.6 m) and down → fill 12 L (₦4,200) → skip-drive 1.2 km
    to Main Market (parks at the kerb) → get out → reload (car where you left it).
  - Keke bargaining ₦1,000 → ₦800 (paid ₦800 once) → skip to stop (got down 3 m from it).
  - Coaster from Bridgehead → skip → got down at Asaba (Head Bridge).
  - Passengers visible in coasters; phone layouts for buying, driving and the homes list.
  - Regressions: the whole Milestone 5 flow, save/continue, corrupt-save quarantine, collision stress, v2 and v3
    saves migrating to v5, and all 3,537 earlier residents identical.
- Performance (software renderer): about 0.3 ms per frame for the game update and about 1 ms for the city
  simulation with 143 transport vehicles; about 335 draw calls. Memory is about 45 MB higher, mainly from the larger
  map and minimap.
- Not verified: real-GPU and phone frame rates.

**Known limitations**
- Every home of a type shares one interior, so the inside doesn't match the building's footprint or storeys.
  *(Milestone 7: each house now has its own colours; the layouts are still shared.)*
- You can't visit NPCs' homes yet, sell a vehicle, or repair damage. *(Done in Milestone 7.)* There are no traffic
  police or fines.
- Driving is arcade-style. People in the road stop your car rather than reacting. *(Milestone 7: they jump aside.)*
- During a skip the rest of the world doesn't play out. *(Done in Milestone 7.)*
- Only a narrow strip of Asaba is on the map; the Onitsha–Asaba Road leaves it.

### ✅ Milestone 7 — Life simulation
Acceptance criterion: *the city keeps a weekly and seasonal rhythm that changes what you can do, and you can build
a living and a name in it.*

**Implemented**
- **Calendar** (`sim/Calendar.js`, pure): weekday names (day 1 = Monday). Each game day also advances the season a
  week, from mid-October: late rains → dry season → harmattan (Dec–Feb) → the next rains. HUD shows the weekday;
  the pause screen shows the date, season, weather and reputation.
- **Weather**, deterministic from a per-save seed:
  - rain storms by month (afternoon or night, 1–3.5 h, ramping in and out);
  - harmattan haze by month, thickest in the morning.
  - In the world (`Atmosphere`, `Rain`, `WeatherController`):
    - a grey storm sky and dusty harmattan sky, with fog drawn in;
    - a dimmer sun;
    - falling rain around the camera (hidden indoors);
    - roads that darken and shine when wet and dry off afterwards;
    - rain hiss, drumming and thunder (procedural);
    - fewer pedestrians and cars in the rain;
    - a rain surge of up to 30% on keke and minibus fares (bus and coaster fares stay fixed);
    - people's remarks about the rain, the harmattan and the power.
- **Power cuts:** one to three a day (merged when they overlap). Street lights go off, windows and signs dim to
  generator level, and a generator drone plays. At home the bulb is dead unless you carry a rechargeable lamp (new
  item, electricals traders). The HUD shows "No light", with toasts when NEPA takes light and when it's back.
- **Weekly routines and opening hours** (`data/schedule.js`):
  - weekday rush hours, a busy Saturday that runs late, and a quiet Sunday morning;
  - on Sunday the market stalls stay closed, shops open from 13:00, touts start at 09:00 and neighbours are out
    until after church.
  - Residents appear and leave by these hours; job offers and deadlines use them; the job chip says "opens 13:00" or
    "closed for today".
- **Reputation** (`sim/Reputation.js`, pure):
  - recomputed from relationships, jobs done and missed, and trouble (shoves, negatives);
  - 5 levels from Bad name to Big name in Onitsha;
  - 0–6% shop discount (a Bad name pays 3% more), 0–15% better job pay, and different greetings from strangers.
- **Keke business** (`vehicles/KekeBusiness.js`):
  - in your own keke, stop at a stop with a queue and press N; up to 3 passengers board (taken from the real queue);
  - each goes to a real stop 0.4–2.6 km away for the standard keke fare (with the rain surge) and sits in the back;
  - stop near their stop and they pay once each (`Economy.transact` keyed per passenger);
  - after their patience runs out they leave unpaid, and leaving the keke ends unfinished rides unpaid;
  - the next drop is routed on the map.
- **Wholesale and supply orders** (`economy/Wholesale.js`, the depot by Main Market):
  - 9 bulk lots at 42–46% of the shop price per piece, 3 per lot per day, all-or-nothing;
  - traders buy the pieces back at their usual price (a small margin; tested to stay below shop prices, so no money
    loop);
  - 4 supply orders a day from traders who are open and sell those goods, at 68% of the shop price, due 18:30;
  - you deliver in conversation and are paid once per order;
  - lapsed orders cost you standing with that trader;
  - the depot is closed on Sunday.

**Milestone 6 follow-ups done in this build**
- **Directions on the map (requested):**
  - houses to let, your home, vehicles for sale, your vehicles and friends' houses have icons on the minimap and
    big map, with labels on the big map (tap one to mark it);
  - the homes list shows each place's street and nearest landmark;
  - "Show on map" marks the place and opens the big map framing you and it;
  - a blue route along real streets (walking or driving rules) to your marker or job;
  - the chips show distance by road and a turning direction arrow;
  - a light beacon stands over the destination.
- **Visiting people:**
  - an invitation now gives the NPC a real house near where you met (not a listing, door reachable);
  - knock 09:00–21:00 and they're inside;
  - eat with them (+35 energy) and gist, once a day each, to raise the relationship;
  - you can't use their things;
  - saved with the relationship.
- **Per-house interiors:** each house gets its own wall paint, floor and rug colours.
- **Selling and repairs:**
  - crashes dent vehicles (damage 0–100, up to 45% less top speed);
  - mechanics at the stands fix it for a price, and spare parts fit by yourself fix some;
  - stands buy vehicles back at 60% less damage, once (keyed per vehicle).
- **Pedestrians react:** people in the path of your vehicle jump aside and shout; riders in your keke are ignored by
  traffic and collisions.
- **Skips move the world on:** the transport fleet carries on round its routes with new passengers, and the ambient
  cars and passers-by are replaced.
- **Memory:** the minimap base image is about 9 MB smaller.

**Verified**
- `npm test`: 70 unit tests. The new ones cover:
  - the calendar and seasons;
  - weather determinism, smooth ramps and seasonal statistics over 20 seeds;
  - power cuts; rush hour, Sunday and rain factors;
  - weekday opening hours;
  - reputation levels and the shop discount (hawkers fixed);
  - keke business pickup, real destinations, standard fares, the surge, single payment, replay refusal and impatient
    riders;
  - wholesale lots, the margin staying honest, the order board, deliver-once and lapsing;
  - wear, repair, parts, mechanic and selling;
  - NPC house picks on the real map;
  - the v5 → v6 migration.
- Browser (headless, full game loop):
  - Marking a 2-bedroom flat from the homes list: the big map shows a 36-point route of 1.7 km. The chip reads
    "… 1.7 km by road east" with the arrow, and the beacon is visible.
  - Vehicles: buy, crash (26% damage, top speed 22 → 19.4 m/s), fit brake pads, mechanic ₦600, sell ₦29,000 (a second
    sale is refused). A walker jumps 1.5 m aside, shouting "Easy, driver!".
  - A 30-minute skip moves all sampled fleet vehicles more than 50 m. Visiting Arinze: knock, eat (energy and the
    relationship up), leave, a night knock refused, and the visit kept after a restart.
  - Weather and power:
    - rain storm (rain drawn, fog 420 → 276 m, roads wet, fares ×1.28);
    - January harmattan morning (fog 253 m);
    - night power cut (street lamps 0, "No light" chip);
    - Sunday 14:00 (no stalls, shops open, no stall job offers, depot closed).
  - Wholesale: buy 20 sugar, take an order (9 Ankara for Oga Musa), deliver in conversation, paid ₦54,900 once.
  - Keke business: 4 waiting → 3 riders seated, routed to the first drop; dropped and paid ₦700; getting out ends the
    rest unpaid.
  - Phone layout in the rain and on the pause screen.
  - Regressions: the Milestone 5 flow, home, car (now damaged by its crash test), ride, Asaba coaster, phone
    layouts, collision stress, and v2/v3/v4/v5 saves loading as v6.
- Performance (software renderer): about 0.33 ms per frame for the game update; about 334 draw calls; heap about
  161 MB in the same test that measured 193 MB in Milestone 6.
- Not verified: real-GPU and phone frame rates, and how the procedural sound mix sounds on real speakers.

**Known limitations** (as of Milestone 7 — see the Milestone 8 follow-ups below for what changed)
- Interiors were three shared layouts in different colours. *(Now sized to each house.)*
- No traffic police or fines; the police expressions were reference-only. *(Done.)*
- Driving was arcade-style. *(Now grip-based.)*
- Only a narrow strip of Asaba is on the map. *(Still true: the supplied OSM file ends at longitude 6.7472, just
  past the bridge; a wider export is needed to add more of Asaba.)*
- A keke passenger could ride unseen in a crowded spot. *(Fixed.)*
- NPCs had no umbrellas; routines were opening hours only; church services were crowd levels only. *(Done.)*

### ✅ Milestone 8 — Polish & release (this build, v0.8.0)
Acceptance criterion: *the game can be shipped: it recovers from errors instead of freezing, keeps saves safe,
adapts to slow devices, installs as an app, and has a checked, repeatable build and deployment.*

**Bugs fixed (reported)**
- **"Stuck after pressing Continue."** I couldn't reproduce it with any save I could build: fresh Milestone 7 saves,
  Milestone 6 saves played in the Milestone 6 build and then continued in Milestone 7, saves inside a home, with
  vehicles and jobs, on a phone layout. But two weaknesses could produce exactly that symptom, and both are fixed:
  - three.js stops its frame loop for good if one frame throws an error, so any bug in any system froze the
    game; now the frame is guarded, the game keeps running, and the error is shown with "Copy details";
  - an error while restoring a save left you on the menu with a dead Continue button; now Continue shows that
    it's loading, retries from the start spot (keeping money, bag, homes and vehicles), and otherwise explains
    what went wrong.
  Saved positions that can't be used (in the river under a bridge, in an empty interior, off the map) now fall
  back to the start spot. Vehicles saved on a bridge deck are parked at the end of the deck. Vehicles found in
  the river or in a wall are moved to the nearest road.
- **Kiosks standing on the road.** Kiosks, stalls, parked cars and parked kekes were placed beside one road but
  could land on another one (at junctions, or across a dual carriageway). 644 kiosks and 676 other props were
  on a carriageway; they're now removed, with their colliders, after everything is placed, so nothing else
  moves (every other trader keeps their id).
- **Roads:** roads met at junctions with wedge-shaped gaps and notches, and sharp bends left gaps on the outside.
  Junctions are now filled with the convex hull of the meeting roads' edges, and sharp bends get round joins.

**Milestone 7 follow-ups**
- **Traffic police** (`sim/Police.js`, `PoliceController`): six checkpoints on main roads, with drums, cones, a
  sign and two officers in black. They're manned by day Monday–Saturday and Sunday afternoon, and not in heavy
  rain.
  - Offences noticed near a post: speeding over the road's limit (+8 km/h tolerance), going the wrong way on a
    one-way street, knocking someone down.
  - Stop and pay (one `Economy.transact` per case), or explain yourself (a respected name may get a warning, once
    a day, never for hurting someone).
  - Run and you're wanted (doubled fines, stopped on sight). If you can't pay, they hold your vehicle until you
    pay at that post.
  - Running away counts against your reputation. The police expressions "Ndi nwa", "Nwi nwo nwi" and "Bọchaa" are
    now spoken at those events.
- **Driving:**
  - grip-based handling: the turn rate is limited by tyre grip (less when wet or damaged), you slide when you ask
    too much, the handbrake swings the back round, and a keke warns you when it nearly tips;
  - body roll;
  - engine and tyre sound.
- **Sunday Mass** at Holy Trinity Basilica: a congregation gathers outside, a bell rings at 08:45, people go in
  for Mass, a choir is heard during it, and they come out to chat afterwards.
- **Traders' days:** traders walk to their spot when they open and walk off when they close. Walkers put up
  umbrellas and hurry in the rain.
- **Rooms fit the house:** each layout is rebuilt to the house's own width and depth (within limits) when you go
  in, with its colliders and furniture use points.
- **Keke passengers:** if the pool of people is busy, a far-off passer-by makes way, so riders are always visible.

**Implemented (Milestone 8)**
- **Performance and devices:**
  - adaptive resolution (55–100% of the quality's pixel ratio, from the measured frame rate);
  - auto-pause and save when the tab or app is hidden;
  - a save on page close;
  - WebGL context loss handled: the game is saved and a reload offered;
  - a "turn your phone sideways" hint in portrait.
- **Settings:** field of view, adaptive resolution, game clock speed, control hints, and save export/import.
- **Saves:**
  - format v7 (police record);
  - export to a file; import with checks and migration (the previous save is backed up first);
  - a warning when the browser won't store the save.
- **Error handling:**
  - the guarded frame loop, error bar and "Copy details" report;
  - window error and unhandled-promise hooks;
  - guarded new game and Continue;
  - a message for browsers too old to run the game, and a hint when loading stalls.
- **Mobile UX:** a handbrake button, the rotate hint, larger focus rings and live toasts for screen readers, and
  reduced motion respected.
- **Release:**
  - version 0.8.0;
  - web-app manifest and icons (procedurally drawn);
  - a service worker (cache-first for hashed assets, network-first for the page) — HTTPS only, and not inside
    frames;
  - browser targets set for the build (Chrome 87+, Edge 88+, Firefox 90+, Safari 14+), with `Array.at` removed for
    older Safari.
- **Build validation:**
  - `npm run check` runs the unit tests, the production build and `scripts/validate.mjs`: every referenced file
    exists, bundle and map size budgets, map data integrity, manifest icons, the version label;
  - `npm run e2e` is an optional browser smoke test (new game → walk → save → reload → Continue → the loop keeps
    running).
- **Deployment:** `.htaccess` (Apache/cPanel), `netlify.toml`, `vercel.json` and a GitHub Pages workflow, with a
  guide in DEPLOY.md.

**Verified**
- `npm test`: 76 unit tests, including the new ones:
  - checkpoints are beside real main roads, off the carriageway, and apart from each other; manned hours;
  - police stops: only seen near a post; paid once; fleeing makes you wanted with doubled fines; can't pay means
    the vehicle is held, then released; the warning rule; fleeing counts against reputation;
  - Sunday Mass hours;
  - the carriageway test on the real map, and removing collision shapes;
  - the v6 → v7 migration.
- `npm run check` passes (tests, build, validation). `npm run e2e` passes: new game → walk → save → reload →
  Continue → the loop keeps running.
- Browser (headless, full game loop):
  - Continue tested from: a fresh new game; a Milestone 6 save made in the Milestone 6 build and continued in
    this one (desktop and phone layout); saves inside a home, with a vehicle, a job and relationships.
  - A save made on the Niger Bridge deck: the car is parked off the deck and nobody is in the river. A save with
    the car and player in the river: both rescued, with a message.
  - A thrown error in three frames: the game keeps rendering and shows the error bar (3 errors logged).
  - Save export/import round trip: a damaged file is refused with the current save unchanged, and a backup is
    made.
  - Settings: field of view, clock speed and hints applied.
  - Police: speeding past Upper Iweka at 79 km/h → stopped → ₦3,000 paid once. Fleeing → wanted → stopped on
    sight for ₦6,000 → couldn't pay → vehicle held (driving refused) → released. Knocking someone down → an
    offence, and that person likes you less.
  - Driving: 0–35 km/h, a full-lock turn at the grip limit (7 m/s² sideways), a slide, and the handbrake.
  - Sunday 08:00: 15 people outside the Basilica, who go in at 09:00 (choir level 0.96 next to it). Rain: walkers
    with umbrellas. 19:31: 15 traders walk off; 07:05: traders arriving. Rooms sized per house (e.g. a 288 m² flat
    → 12.6 × 9.5 m) with all furniture use points clear.
  - 644 kiosks and 676 stalls, parked cars and kekes removed from carriageways; junction screenshots.
  - Phone layouts: the drive panel with the handbrake, and two-column settings on short screens.
  - Full regression run: the Milestone 5 flow, home, car, ride, Asaba coaster, phone layouts, map directions,
    Milestone 6 leftovers, Milestone 7 features, and v2/v3/v4/v5 saves loading as v7 — all without page errors.
- Performance (software renderer): about 0.39 ms per frame for the game update; about 326 draw calls; heap about
  176 MB.
- **Not verified** (no such hardware or browsers here): frame rates on real GPUs and phones, and Firefox and
  Safari. Only Chromium is available in this environment; the build targets and API checks above are the
  precaution.

**Known limitations**
- Only a narrow strip of Asaba is on the map (the supplied OSM file ends just past the bridge).
- Interiors are three layouts sized to each house, not floor plans of the real buildings; no upstairs.
- Police only work at fixed checkpoints: there are no patrol cars or chases.
- Driving physics are a simple grip model, not a full vehicle simulation.
- Offline play needs HTTPS and a first visit online; it doesn't work inside the claude.ai preview frame.


### Next (ideas, not started)
- A wider OSM export to bring in more of Asaba and the rest of Onitsha (Fegge south, GRA, Awada).
- Patrol cars and chases; area-boy and robbery events (the reserved street expressions).
- Real-device performance pass and Firefox/Safari testing.
- Upstairs floors and real floor plans for larger houses.


### Milestone 9 — City life (v0.9.0, first playable pass)

See [MILESTONE_9.md](MILESTONE_9.md) for the eleven-request coverage matrix, controls, tests, source links and remaining work. Earlier milestone limitations above are historical; the new coverage matrix is authoritative for this build.


## Milestone 10 — delivered build

See [MILESTONE_10.md](MILESTONE_10.md): night-only club interiors, fictional-location House of Pilate, saved room arrangement, WAT clock, live-weather fallback, public visitor rooms and mall/vehicle polish. Earlier milestones are historical.
