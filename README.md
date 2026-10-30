## Current update — v0.54.4: faster loading (about 18% on the test machine), same city layout, street dressing built near you. See [UPDATE_54_4.md](UPDATE_54_4.md).

## Previous update — v0.54.0: ready to launch on Render (game + accounts + multiplayer + Paystack test), playable on Vercel offline

`npm start` runs the public server: one port serves the game, the API and the live connection, behind the host's HTTPS. `render.yaml` sets up Render with a persistent disk. On a host without the server (Vercel) the game offers "Play now" and saves in the browser. See [LAUNCH_RENDER.md](LAUNCH_RENDER.md).

## Previous update — v0.53.0: more GRA homes, busy filling stations, compound gates that open, free furniture placement, no kiosks at entrances

See [UPDATE_53.md](UPDATE_53.md) and [TEST_RESULTS_53.md](TEST_RESULTS_53.md).

## Previous update — v0.52.0: GRA tarred, concrete GRA ground, the garage at home, a new Buy mode

Every road cars use in both GRAs is tarred, and GRA's open land is poured concrete, so GRA looks different from the rest of Onitsha. Your home garage is now a carport inside your compound, a garage built onto the compound wall, or a walled garage right by the house, not a spot by a road up to 260 m away. Buy mode has a side panel on computers, search, item pictures, and a list that no longer gets squeezed. See [UPDATE_52.md](UPDATE_52.md) and [TEST_RESULTS_52.md](TEST_RESULTS_52.md).

## Previous update — v0.51.0: Paystack (test mode) for billboard ads

Billboard ads are paid through **Paystack**, in test mode. The server starts each payment with the secret key, Paystack's own popup takes the card, and the server confirms the payment and amount with Paystack before the flyer goes up. A signed webhook is also accepted. Keys go in `server/paystack.local.json` (git-ignored, never zipped); live keys are refused. See [UPDATE_51.md](UPDATE_51.md) and [TEST_RESULTS_51.md](TEST_RESULTS_51.md).

## Previous update — v0.50.0: watch TV; WELCOME TO GRA gateways; the nightclub rebuilt

**TV you can watch**: switch on a TV at home and pick a channel: Nollywood drama, Hollywood-style action, comedy skits, news, football highlights, music videos or cartoons. The programme plays on the TV in the room and big on your screen, with captions; the clock moves on and your fun goes up. Every show, channel and character is invented and drawn by the game. **WELCOME TO GRA**: big arches over the main roads into GRA Phase I and Phase II, on the map too. **The nightclub, rebuilt**: a bigger room with an LED dance floor, a stage, DJ decks and a big LED wall that moves with the music, light beams and lasers, a VIP section, a long bar and 38 people (dancers, VIP guests, the DJ, a hype man, bar staff, waitresses, bouncers). **Request a song** from the DJ (with a shout-out on the wall), **spray money** over the floor, order **Dorime** bottle service. Two original DJ mixes (Afrobeats and amapiano), and a folder for music you have the rights to. See [UPDATE_50.md](UPDATE_50.md) and [TEST_RESULTS_50.md](TEST_RESULTS_50.md).

## Previous update — v0.49.0: a new map screen; the city filled in rows of walled houses; more places; traffic lights and wardens

**The map** is a light street map like a phone maps app: search for any place, street or area, category chips, a key, every place and neighbourhood named (GRA Phase I and II included), crisp streets and buildings when you zoom in, and the COMING SOON land shaded. **The empty land is filled**: thousands of new houses in rows and columns along the streets, each in a walled compound with a gate; the houses already on empty land stand in line too, and every house and small business has a wall and a gate. **More places**: 9 filling stations, 7 hotels, 10 bars, 5 clubs, 8 eateries, 6 recreation centres, 8 mini pitches, 5 street markets, 8 schools, 10 churches, 5 police stations, 2 car showrooms, and 160 more homes to rent or buy. **Big COMING SOON gantries** on all 51 roads out of Onitsha. **Traffic lights** at 208 junctions and **traffic wardens** at 12; vehicles no longer drive through each other. The house that stood under the Niger Bridge ramp is gone. See [UPDATE_49.md](UPDATE_49.md) and [TEST_RESULTS_49.md](TEST_RESULTS_49.md).

## Previous update — v0.48.0: Onitsha only; motor parks, bus stops, premium cars, neighbourhoods; decorating online; 11-a-side

**Onitsha only**: the Niger Bridge closes at mid-river (ASABA · COMING SOON); the Asaba bank and the Delta island can't be reached by anyone, any bus or the GPS; signs where the main roads leave the map. **Upper Iweka and Bridgehead motor parks** are working terminals (gate, ticket office, shed, numbered bays; buses come in, load and leave). **Bus stops** are built stops in three sizes. **18 new vehicles** (G-Class, Range Rover, Land Cruiser, Escalade, X5/X7, GLS, S-Class, 7 Series, LS, A6/A8, Cayenne, M5, RS 7, Avalon, Civic) and the **Prestige Autos** showroom; premium cars are rare in traffic except by the mall. **The map grew** from your OSM export to Onitsha's LGA lines: **GRA Phase I and II** (villas, palms, lawns, good cars) and the north and east of town; outside Onitsha North/South (Okpoko, Obosi, Nkpor) is COMING SOON. **Neighbourhoods** differ (trees, drains, painted kerbs, GRA). **Hire a friend to decorate your home online.** **League matches are 11-a-side.** Every model now has a known licence. Tested on MariaDB (XAMPP's database). See [UPDATE_48.md](UPDATE_48.md), [TEST_RESULTS_48.md](TEST_RESULTS_48.md) and [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md).

## Previous update — v0.47.0: the rest of stage 7, and stage 8 (the city responds; balance)

New **Ventures** phone app: **event planner** (bookings, suppliers, a canopy on the day), **interior decorator**, **tech agency** (briefs, developers, deadlines), **landlord** (tenants, weekly rent), **property developer** (finish an unfinished building in the city, sell or let it), **roadside mechanic** (broken-down cars at the roadside), **security company** (guards, clients, break-ins), **street crew** (abstract: turf, rivals, peace talks; the "levy" is a crime), **footballer and coach** (Onitsha City FC, a six-team league, the U-17s). **The city responds**: a news feed written from what happened, three LED news screens, wanted posters while you have a warrant, election announcements, strangers who react to your reputation. Balance bands are tested; shifts now close on Sundays (they closed on Mondays by mistake). Saves move to version 23 by themselves. See [UPDATE_47.md](UPDATE_47.md) and [TEST_RESULTS_47.md](TEST_RESULTS_47.md).

---

## Current update — v0.46.0: real buildings for the landmarks; enter first, then work; hotel rooms; stage 7 begins

**Holy Trinity Basilica, All Saints' Cathedral, Ime Obi, Christ the King College and Shanahan University** now have their own buildings and grounds with doors you walk into (no homes or shops were moved). **Workplaces** (the new Metadav ICT Hub building and every trade desk) are entered first; jobs, training and equipment are inside. **Hotels** have four rooms to see and book (standard, deluxe, executive, suite). Car doors open **only on your side**. The Main Market eatery is now **Mama Blessing's Kitchen**. **Stage 7, first part**: degrees at Shanahan University, and jobs as **doctor, nurse, teacher, lecturer and lawyer**, where each shift is a real case; freelance **journalism** (The Courier app), **DJ** and **hypeman** gigs. Saves move to version 22 by themselves. See [UPDATE_46.md](UPDATE_46.md) and [TEST_RESULTS_46.md](TEST_RESULTS_46.md).

---

## Current update — v0.45.0: open life, stage 6 — politics and elections; sit and lie down; eateries and dates; the palace and other interiors

**Sit and lie down** anywhere (X / Z, or the Sit and Lie buttons on a phone), or on any chair, bench, sofa or bed (E), in the interiors and in your home; other players see it. **The palace visitors' hall** (an empty roped-off dais, carved pillars, a heritage gallery, the visitors' book: stylised, never the real monarch), the **churches, the school, the ICT hub and the hotels** get proper rooms. **Three eateries** (map: Eateries & restaurants): order food, and take someone you know, or another player, **on a date**. **Politics**: fictional parties, the Electoral Offices (INEC and ANSIEC desks, the debate, the polling unit), a 28-day election season for councillor, LGA chairman, House of Assembly and governor; register, join a party, stand, campaign (rallies, posters, donations, the debate), vote once, results counted from the polling-unit record, ties re-run; in office: a salary, a public budget and **public projects built in the city**; vote buying and diverted funds are EFCC cases that can remove you from office. Online, the players elect their own office holders every week. Saves move to version 21 by themselves. See [UPDATE_45.md](UPDATE_45.md) and [TEST_RESULTS_45.md](TEST_RESULTS_45.md).

---

## Current update — v0.44.0: open life, stage 5 — players together; walk-in interiors; new menus

**Walk into every establishment**: the police station (charge room, cells), the EFCC office (interview room), hospitals (reception, pharmacy, consulting room, ward), banks (tellers, loans desk, ATMs), the Magistrate Court (bench, witness box, dock, gallery), Shoprite (stocked aisles, fridges, tills) and the four home stores' showrooms. **New menus** in the style of Onitsha's hand-painted signboards: a route-board main menu, a pause screen that shows today in Onitsha beside action tiles, and grouped settings. **Players together**: meet another player to give them money, message or report them, or (adults, outside safe areas) pick their pocket or rob them, decided and carried out by the account server, with peace mode, safe areas, cooldowns, daily limits, reports to the police and the moderators, and never with children. The account server is now tested over the LAN gateway and through a long session with the network dropping. See [UPDATE_44.md](UPDATE_44.md) and [TEST_RESULTS_44.md](TEST_RESULTS_44.md).

---

## Current update — v0.43.0: open life, stage 4 — the account server keeps the books; real hospital and bank buildings

**Hospitals, banks and the Magistrate Court are now purpose-built buildings** on their own plots (no more hospital inside the Ezinne Furniture block): a three-storey hospital with a red cross, emergency canopy and ambulance bay; banking halls in each bank's colours with columns, glass and an ATM; a columned court. **Server authority**: for a signed-in account, every transaction (wallet, bank, businesses, wage escrows) goes to the account server, which accepts only what the game's rules allow and answers with the true balances; property you never paid for can't be sold or pledged; the legal record is append-only; reputation moves at most 30 a day; uploaded saves are corrected to the server's books. Offline play is unchanged. MySQL servers gain one table (`authority`) automatically. See [UPDATE_43.md](UPDATE_43.md) and [TEST_RESULTS_43.md](TEST_RESULTS_43.md).

---

## Current update — v0.42.0: open life, stage 3 — crime, investigations, the courts, Hustle Kingdoms, police and EFCC careers

**Crime against the city** is now something you can choose: pick a pocket or rob a stall from a conversation, break into compounds once you have tools, or plan a **bank job** (crew, casing it by day, at night). Witnesses and cameras become **evidence**; the police or the **EFCC** work each **case** day by day until they put out a **warrant** or it goes cold. Wanted, you can go quietly, run or resist; **custody** leads to the new **Magistrate Court**: plead guilty, take bail and a hearing, or stand trial with a lawyer; sentences are fines, community service and handing back the proceeds. **Hustle Kingdoms** run abstract schemes, and members who don't trust you can turn **informant** for the EFCC until it **raids**. You can also **join the Nigeria Police Force or the EFCC** (academy, ranks, duties in the city, by the book or corrupt, complaints and dismissal). Children see none of it. Also fixes the **cloud-save crash** ("reading 'rev'"). Saves move to version 20 by themselves. See [UPDATE_42.md](UPDATE_42.md) and [TEST_RESULTS_42.md](TEST_RESULTS_42.md).

---

## Current update — v0.41.0: open life, stage 2 — banks, loans, your own businesses, transport companies, buses

Two fictional **banks** with branches in town: open an account, save, earn a little interest, build a **credit score** and take **personal or secured loans** (vehicle or home as collateral) with daily repayments, late fees, default and repossession. **Rent or buy a shop** (provisions, buka, beer parlour, phones, boutique) under your own name: its own account, stock, prices, opening hours, **attendants hired on escrowed wage contracts**, customers every hour, rent, spoilage, theft by untrusted staff and daily reports. Start a **transport company**: put your keke or bus to work with a **hired driver** who brings back the day's takings. **Drive minibuses and buses** for fares yourself, on a chosen route, with a **conductor**. New phone apps: **Bank** and **My business**. Saves move to version 19 by themselves. See [UPDATE_41.md](UPDATE_41.md) and [TEST_RESULTS_41.md](TEST_RESULTS_41.md).

---

## Current update — v0.40.0: open life, stage 1

No more forced path: the career pick, the "Story & careers" chapters, the career-board contracts, the "illegal path" careers and "Find Your Friend" are gone. You start with no job and choose your work in the city: **apply at workplaces** (skills, tools and a clean police record), **work shifts**, rise through **ranks** by working well, face **real choices on the job** (honesty or the shortcut, with warnings and dismissal), resign whenever you like, or **work for yourself** (trader jobs, keke, wholesale). A new **Profile** app shows your work, a **seven-sided reputation** (public, professional, notoriety, integrity, business, social, wealth) with the reasons it changed, and your **police and work record**. Old saves convert automatically (your career becomes your job). See [UPDATE_40.md](UPDATE_40.md) and [TEST_RESULTS_40.md](TEST_RESULTS_40.md).

---

## Current update — v0.39.0: crashes, night lights, climbable flyovers, unfinished buildings, new floor plans, hospitals

NPC drivers now **react when their car is hit** (by another driver or by you): hazard lights, horn, a Pidgin shout. The **DMGS and Upper Iweka monuments** light up at night with flashing **LED shows**, and all **billboards** light up after dark. The real **Upper Iweka flyover** gets staircases, two **new road flyovers** (invented for the game) carry traffic over busy junctions nearby, and **four footbridges** cross the big roads — players and NPCs can walk up all of them. About **350 uncompleted buildings** stand around town. **All 90 homes have their own floor plan** and come **empty except for a bulb and switch in each room** (bulbs can be taken out); buy your own bathroom and kitchen. **Two hospitals** and **ambulances**: get knocked down by a car and an ambulance takes you to hospital. See [UPDATE_39.md](UPDATE_39.md) and [TEST_RESULTS_39.md](TEST_RESULTS_39.md).

---

## Current update — v0.38.0: Onitsha buildings, compounds on empty land, 90 homes

Every house is now one of **eight Onitsha building types** — older bungalows with verandas, face-me-I-face-you tenements, modern bungalows with porches, duplexes with balconies, storey buildings with flats, apartment blocks, shops with rooms above and self-contained units — with their own roofs, paint, pillars and balconies. About **3,400 houses** now stand on the empty land along the streets, about 2,000 of them in **walled compounds** with sliding gates, water tanks on stands, generator houses, washing lines and security lights. Neighbours stand at the gates by day; lit windows glow at night. **44 new flats** in multi-storey buildings bring the rentable homes to **90**. Roads, junctions, markets, parks, schools, churches, the mall and the stadium are kept clear. See [UPDATE_38.md](UPDATE_38.md) and [TEST_RESULTS_38.md](TEST_RESULTS_38.md).

---

## Current update — v0.37.0: furnish your home, four home stores, model-pack houses removed

**184 furnishings** in the brief's sections (living room, bedroom, electronics, lighting, wall décor, rugs/curtains/bedding, kitchen, bathroom, Nigerian home essentials, outdoor, hobbies) with **Budget / Standard / Premium** tiers and colour options. Each thing you buy is its own piece: own two armchairs, place them on the floor, hang pictures and curtains on walls, fit fans and chandeliers to the ceiling, put a fruit bowl on the table or a duvet on the bed, rotate in 45° steps, move, store, recolour or **sell at 40%**. Shop at **four stores in town** (free delivery) or order from home in Buy mode (delivery fee). Friends visiting your home see your furniture. Models: Kenney Furniture Kit (CC0) plus code-drawn Nigerian items. The squished supplied-pack houses are removed; the game's own buildings are back while the new building kit is made. Saves move to version 17 by themselves and keep every position. See [UPDATE_37.md](UPDATE_37.md) and [TEST_RESULTS_37.md](TEST_RESULTS_37.md).

---

## Current update — v0.36.0: phone fixes — buying, pop-ups, dashboard, visiting friends

On phones, pressing Use at a car stand or a house no longer picks a vehicle or "Buy" for you (it was a ghost tap; fixed for every panel). Your car and your front door now open a small card at the bottom instead of a big pop-up. The driving dashboard minimises to a small pill (▾), and the radio starts folded on phones. Invitations pop up on screen with Accept/Decline; Invite home and Visit always explain what's needed; ＋ Add friend is right in the chat; guests leave through the door properly. The game now reconnects by itself after a dropped connection. See [UPDATE_36.md](UPDATE_36.md) and [TEST_RESULTS_36.md](TEST_RESULTS_36.md).

---

## Current update — v0.35.0: voice chat on phones, other players' cars, cleaner map text

Other players now see each other's vehicles (all 36+ models, not just the first 12). Voice chat is back: tap the **🎙 Voice** button in online play to choose nearby or crew, then **hold it to talk** (or hold V). `npm run lan` now serves **https** so phones can use the microphone. The first visit on each phone shows a "not private" warning you can pass, or you can install the game's local-only certificate. Map labels on phones no longer overlap. See [UPDATE_35.md](UPDATE_35.md) and [TEST_RESULTS_35.md](TEST_RESULTS_35.md).

---

## Current update — v0.34.0: LAN play on phones and other PCs

Run `npm run lan` on the host computer and open the printed `http://192.168…:5180` address on phones or other computers on the **same Wi-Fi**. New players there enter the **join code** shown in the terminal; existing players just log in and their saved game follows them. The account server still listens on this computer only, and the gateway refuses anything outside the local network. Voice chat needs https, so it works on the host only. See [UPDATE_34.md](UPDATE_34.md) (firewall and hotspot tips) and [TEST_RESULTS_34.md](TEST_RESULTS_34.md).

---

## Current update — v0.33.0: MySQL database (XAMPP) and cloud saves

Accounts, logins, mail, requests, ads and reports can move from `server/data/world.json` into **MySQL/MariaDB** (XAMPP works with its defaults), and each account's **game save is stored on the account server**, so logging in from another browser or browser profile continues the same game (the server still listens on this computer only, so other phones/PCs can't reach it yet). Start MySQL in the XAMPP Control Panel, then `npm run db:setup` once — existing accounts and passwords are imported and the original file is kept. Without that step the server keeps using world.json as before. Settings → Account save shows the sync state. See [UPDATE_33.md](UPDATE_33.md) and [TEST_RESULTS_33.md](TEST_RESULTS_33.md).

Database commands: `npm run db:setup`, `npm run db:status`, `npm run db:backup`, `npm run db:saves -- <username> [--restore N]`.

---

## Current update — v0.32.0: the city comes alive

8-ball pool and international draughts at Market Corner, four street-food stalls (suya, corn & ube, puff-puff & akara, Mama Put), Kingsway barbing & hair salon, Obi's Game Zone (console football), Iweka Viewing Centre, CKC basketball shootout court, jogging laps on the stadium track, Sparkle Car Wash (cars now collect dust), and weekly events with phone invitations (Saturday Community Cup with prize money, Friday/Saturday street party, Sunday draughts challenge, big match nights). All places are on the map. See [UPDATE_32.md](UPDATE_32.md) and [TEST_RESULTS_32.md](TEST_RESULTS_32.md).

Run `npm ci`, then `npm run dev`. Keep your own `server/data`, browser profile, account and existing site address/port. Export a save backup; **do not reset saves**.

---

## Current update — v0.31.0: 5-a-side football at the stadium

Play a real 5-a-side match inside Chuba Ikpeazu Memorial Stadium: walk to the green 5-A-SIDE board on the touchline and press E. Ball physics, passing, shooting with power, tackling, diving keepers, kick-ins/corners/free kicks, two halves, AI team-mates and opponents, scoreboard, crowd, floodlights and procedural sounds. Friendlies pay no money: Fitness XP, football standing and achievements, recorded once per match. Built on a new shared activity framework for pool, board games and more. Saves move to version 16 automatically. See [UPDATE_31.md](UPDATE_31.md) and [TEST_RESULTS_31.md](TEST_RESULTS_31.md).

Run `npm ci`, then `npm run dev`. Keep your own `server/data`, browser profile, account and existing site address/port. Export a save backup; **do not reset saves**.

---

## Current update — v0.30.2: performance and phone layout fixes

Smoother play on phones and modest laptops. Only nearby street lamps are drawn, unused lights are switched off, static landmark/showroom/sign pieces are merged, distant pedestrians are culled, and Three.js ships as its own cached file. On landscape phones the mail button no longer covers Jump. The browser smoke test now covers the signup splash. No gameplay or save changes. See [UPDATE_30_2.md](UPDATE_30_2.md) and [TEST_RESULTS_30_2.md](TEST_RESULTS_30_2.md).

Run `npm ci`, then `npm run dev`. Keep your own `server/data`, browser profile, account and existing site address/port. Export a save backup; **do not reset saves**.

---

## Current update — v0.30.1: local names and landmark signs

Chuba Ikpeazu Memorial Stadium, 36 green-and-gold place-name stands, six locally named car dealerships and name-only map/phone Places labels. The first playable mission and all billboard/home-appliance fixes remain. See [UPDATE_30_1.md](UPDATE_30_1.md) and [TEST_RESULTS_30_1.md](TEST_RESULTS_30_1.md).

Run `npm ci`, then `npm run dev`. Keep your own `server/data`, browser profile, account and existing site address/port. Export a save backup; **do not reset saves**.

---

## Current update — v0.30.0: first playable mission

**Find Your Friend** now runs through existing city NPCs, dialogue, map guidance, wallet and local saves. Open **Missions & Jobs (J)** to locate your contact. The welcome conversation pays **₦500 once**. This stage includes the mission foundation and journal, not the remaining four planned missions. All v0.29.1 billboard/appliance fixes are retained.

See [MISSIONS_30.md](MISSIONS_30.md) for safe upgrading, exact launch/play instructions, changed files and limitations, and [MISSION_TEST_RESULTS_30.md](MISSION_TEST_RESULTS_30.md) for executed checks. Run `npm ci`, then `npm run dev`. Preserve your own `server/data`, browser profile, account and existing URL/port; do not reset saves.

---

## Current update — v0.29.1: road-facing billboards & working appliances

All 200 billboards face their adjacent road squarely and reserve full clearance from building roofs and later construction. Installed inverters have direct controls and supply home lights during grid outages when charged. TV/fan/radio switches, powered appliance activities and outdoor generator controls are included. See [HOTFIX_29_1.md](HOTFIX_29_1.md) for controls, battery charging and safe upgrade instructions.

Run `npm ci`, then `npm run dev`. Keep your existing save, `server/data`, browser profile, account and localhost address. No save reset.

---

## Current update — v0.29.0: garages, patrols, stadium and 200 billboards

Power-line/roadside pole fixes, marked police patrols with sirens, secure home garages and home respawn, 800 decorative houses, an original stadium near Shoprite, exclusive numbered ad bookings with fitted flyers and clickable business links, and ten purchase paint choices. See [UPDATE_29.md](UPDATE_29.md) for controls, limits and save-safe installation. Ad payments remain test-only.

Run `npm ci`, then `npm run dev`. Keep your own `server/data`, browser storage, account and localhost address when upgrading.

---

## Current update — v0.27.3: original splash and one dev command

Run `npm ci`, then `npm run dev`. The command starts the account server and Vite together. Signup and login now live inside the original warm loading screen and ONITSHA WAY logo. `npm run local` remains a compatibility alias; `npm run dev:client` is frontend-only for advanced use. Keep your own `server/data` folder and browser storage when updating.

## Current update — v0.27.2: skill progression fixes

Phone practice cooldowns, correct Comedy qualification, level-up feedback and mastery/XP displays. See `SKILLS_27_2.md` for verification and backend-readiness limits.

# Current: v0.27.1 · Mobile HUD clean view

Tap **HUD** beside Pause on touch devices to minimize/restore the interface.
Essential controls stay available and the preference persists in browser settings.
See [MOBILE_HUD_27_1.md](MOBILE_HUD_27_1.md). All v0.27.0 gameplay features remain.

---

# Current: v0.27.0 · Night lighting, fitted homes & venue music

Solar street lighting across the mapped road network, permanent home bulbs/switches and kitchens,
7 m² bathrooms, and three bundled original Afrobeat-style instrumentals with DJ/bar controls.
Upper Iweka monument remains unverified; no fictitious historical statue was added.

**Upgrade note:** movable furniture is still purchased, but kitchens, ceiling bulbs and bathroom
fixtures are now standard. Old “empty shell/no bathroom fixtures” notes below describe older releases.
Conflicting old furniture goes to storage, without losing ownership or money.

See [NIGHTLIFE_HOMES_27.md](NIGHTLIFE_HOMES_27.md) for details, installation, music provenance,
test results and the unresolved Upper Iweka reference. Export saves and retain your own server/data.
Run `npm ci`, then `npm run dev`; keep the same browser profile, account and localhost URL.

---

# Current: v0.26.2 · Vehicle bodies & agbero map pins

Hilux cab/bed closure repaired for owned cars, dealers and NPC traffic; duplicate coupe dashboards removed; coach end windows and fleet chassis completed. All 36 catalogue vehicles and the legacy fleet were visually checked.

All 63 agbero encounter sites are marked with **A** on the maps and listed under **Find on map → Agbero / area encounters**. Pins show hours/resolved status; nearby groups stay visible in the NPC pool. On-foot choices include walking away, talking, an optional ₦200 gift or the thugs escape mini-game. Daily resolution and cooldowns also apply to manual interaction.

See **FIXES_26_2.md** for scope, controls, tests and save-safe installation. Apply the small patch over v0.26.1, restart at the same address, hard-refresh, and **Continue**. Do not clear browser storage. No new character, dependency update or save reset is required.

# Previous: v0.26.1 · Checkpoint NPC crash hotfix

Fixes the repeated `NPCSystem.updateNPC` frame error near police posts. The normal game loop now supplies nearby traffic; absent traffic is handled safely and officers still signal player cars. All seven v0.26 gameplay fixes are retained.

See **HOTFIX_26_1.md** for the small-patch and full-source update instructions. Back up your save and `server/data`, keep the same account/browser/address, and **Continue**. No new character or save reset is needed.

# Previous: v0.26.0 · City activities & gameplay fixes

Seated and dancing bar patrons, routine ₦200-or-run checkpoint encounters connected to the police runner, no idle NPC tracking of passing players, full-stock roadside dealerships, solid car cabins/glazing, image-only business flyers, and wider neighbourhood agbero encounters.

See **CITY_FIXES_26.md** for controls, scope, tests and save-safe updating. Back up your save and your own `server/data`, install fresh, run `npm ci` then `npm run dev`, and **Continue** with the same account/browser/address.

# Previous: v0.25.0 · 36 vehicles & six car stands

All 36 requested vehicles are purchasable across six off-road car stands and available to NPC owners. Supplied human bodies replace the old public-transport and keke occupants; scattered decorative roadside cars are removed. Vehicles are stylised remodels, not exact licensed replicas.

See **VEHICLES_25.md** for stock lists, buying instructions, tests and save-safe installation. Back up your save and your own `server/data` before updating. Run `npm ci`, then `npm run dev`, and Continue with the same account/browser/address.

# Previous: v0.24.1 · Character fit & performance fixes

Every player and NPC now uses the supplied character body, including existing saves. Original hairstyles, Ankara/traditional and other clothing styles remain available on that body. Character alignment and keke headroom are revised; merged character materials, offscreen culling and distance-based building detail reduce rendering work.

See **CHARACTER_FIX_24_1.md** for the changes, measured workload comparison, limits, testing and save-safe update instructions. No new character or wardrobe selection is required for the body replacement. Back up your save and your own `server/data`, extract fresh, restore your own `server/data`, run `npm ci` then `npm run dev`, and keep the same account/browser/localhost address.

# Previous: v0.24.0 · Supplied model packs & Zik Roundabout

See **MODEL_UPDATE_24.md** for the historical v0.24 model inventory, no-taxi policy, monument map destination, asset provenance and save-safe upgrade instructions. Stadium selection is pending confirmation.

# Previous: v0.23.0 · Road-fronting markets & River Niger

Markets now use connected multi-storey shop bays, varied fabric canopies, open goods displays and traders, informed by real Onitsha market-street photographs. Venue fronts are placed directly beside and parallel to roads, not inside vacant blocks. River Niger now has signed viewing areas, scenic boats and two destinations in the Map picker under **River Niger & boats**.

See [CITY_REBUILD_23.md](CITY_REBUILD_23.md) for reference sources, limitations, river directions, upgrade and verification steps. Back up your save and `server/data`, use a fresh extraction, restore your own `server/data`, run `npm ci`, then `npm run dev`. Keep the same browser profile and **http://localhost:5173**; do not clear browser storage.

# Previous: v0.22.0 · Market streets and recognizable venues

Main Market, Ochanja and Bridgehead now have road-aligned shop rows, stocked stalls, awnings, and male and female traders connected to existing dialogue and buying. Filling stations, police/EFCC offices, hotels, bars and clubs now have distinct building designs instead of generic kiosks. Building footprints, roof overhangs and venue plots receive road-setback checks.

See [CITY_REDESIGN_22.md](CITY_REDESIGN_22.md) for changes, verification and upgrade steps. Back up your save and `server/data`; extract into a fresh folder, restore your own `server/data`, run `npm ci`, then `npm run dev`. Keep the same browser profile and **http://localhost:5173**. Do not clear browser storage. Existing unfurnished homes and Buy mode are retained.

# Previous: v0.21.0 · Unfurnished homes and more Buy choices

Rentals now start as empty shells: no free furniture, appliances or bathroom fixtures. Buy and arrange your own household items in **Buy mode**. The catalogue now has **57 furnishings and 22 finishes**, with at least five furnishings in every furniture category. Purchased items from existing saves are preserved. New Shoprite deliveries start in home storage until placed.

See [FURNISHING_21.md](FURNISHING_21.md) for category counts, fixture activities, lighting, arrangement and power rules. Run `npm ci`, then `npm run dev`; keep your existing server/data and browser storage. No community phone apps were re-added; co-op stays in Messages.

# Previous: v0.20.0 · Buy mode

Bottom navigation is **Home · Buy · Map · Phone**. Enter your rented home and tap Buy for an overhead cutaway, a category catalogue, paint/floor previews and safe furniture placement. Previews are free; game money is charged only on confirmation. Owned items can be stored or placed again free. See [BUY_MODE_20.md](BUY_MODE_20.md).

Bag remains accessible with I or the phone wallet widget. Business ads and co-op inside Messages remain unchanged. Preserve server/data and browser storage when upgrading. Run `npm ci`, then `npm run dev`; open **http://localhost:5173**. The local-startup version-check fix is retained.

# Previous: v0.19.4 · Local startup fix

Fixed a launcher bug: scripts/local.mjs still expected account-server v0.19.1 while v0.19.3 reported v0.19.3, so a healthy server was rejected. Both now read the installed version from package.json through server/version.mjs. Readiness also verifies that the responding server is the one just started, not another process on port 8787.

Phone behavior is unchanged from v0.19.3: only Business ads was added; co-op lives in Messages → Groups. No extra Players, Voice, Account or Nearby chat apps.

Preserve your server/data folder and browser storage. Stop the old local command with Ctrl+C, install dependencies with `npm ci` if using a fresh extraction, then run `npm run dev`. Open **http://localhost:5173** and keep this URL consistent for saved progress. Do not clear browser storage or delete server/data to resolve startup errors.

Verified the actual `npm run dev` command starts the account server, Vite, entry HTML and API proxy. An occupied-port regression also verifies it cannot accept an unrelated server as ready. Run `npm run test:startup` separately from a running local game or other browser tests.

# Previous: v0.19.3 · Business ads only; co-op inside Messages

**Business ads** is the only added community phone app. The Players/People, Voice, Co-op, Account and Nearby chat apps and their standalone screens have been removed. Existing game apps and private messaging remain.

Use **Phone → Messages → Groups** to invite friends, accept crew invitations, open crew chat and manage co-op tasks. In crew chat, tap **Co-op controls** to mark a task, check in, cancel or leave your crew. There is no second chat or separate co-op app.

Ads remain local TEST simulations; no real payments. Account-first login and existing saves are unchanged. Keep your server/data directory and browser storage when updating. Run `npm ci`, then `npm run dev`; open **http://localhost:5173**.

See [PHONE_SIMPLIFIED_19_3.md](PHONE_SIMPLIFIED_19_3.md).

# Previous: v0.19.2 · Community apps in your phone

The separate Local Play window has been removed. Open **Phone → Business ads** to create and manage local test campaigns. Players, Voice, Co-op, Account and Nearby chat are separate phone apps; private conversations remain in Messages. The HUD online count opens Players and the profile avatar opens Account, both within the phone. Billboard interactions also open the Business ads phone app at the selected location.

No real payments: seven-day billboard slots and test activation behave as before. Existing account data and character saves are unchanged. Keep your own server/data directory and the same browser address when upgrading.

Run `npm ci` then `npm run dev`, and open **http://localhost:5173**.

# Previous: v0.19.1 · Minimizable car radio

Use **−** next to radio power to minimize the panel; **↗** expands it. The station keeps playing and the preferred view is remembered. See [RADIO_MINIMIZE_19_1.md](RADIO_MINIMIZE_19_1.md).

# Previous: v0.19.0 · Car radio

Enter your own vehicle, then tap **Enable live radio** on first use. Radio Sapientia is the default; station, volume and power are remembered. Live audio needs internet, even during local play. See [CAR_RADIO_19.md](CAR_RADIO_19.md) for stream verification, availability and permission limits.

Run `npm ci` then `npm run dev`; open **http://localhost:5173**. Keep your existing server/data and browser saves when upgrading.

# Previous: v0.18.0 · City HUD and messaging phone

Run `npm ci`, then `npm run dev`, and open **http://localhost:5173**. See [PHONE_HUD_18.md](PHONE_HUD_18.md) and START-HERE.txt for the new white HUD, app-grid phone, private chats, consent requests, unread badges and local storage limits.

Account-first entry is preserved. Ads remain local TEST simulations; no real payments. Back up and retain your own server/data and browser saves when upgrading.

# Previous: v0.17.0 · Account-first player entry

Run `npm ci`, then `npm run dev`, and open **http://localhost:5173**. New players create their account on the welcome screen, make a character, then enter the city. Returning players resume their saved character. See [ACCOUNT_ENTRY_17.md](ACCOUNT_ENTRY_17.md) and START-HERE.txt.

Character saves remain per-account in this browser; this is not cloud sync. Advertising payments remain local TEST simulations. Older release notes below are historical.

# Account hotfix: v0.16.1

Use `npm ci` then `npm run dev` (`npm run dev` now starts both services). Read ACCOUNT_FIX_16_1.md. This patch adds robust account-response handling and checks the account server before starting the frontend.

# Latest: v0.16.0 · Local multiplayer

Run `npm ci` then `npm run dev`. Read [LOCAL-MULTIPLAYER-16.md](LOCAL-MULTIPLAYER-16.md) and START-HERE.txt. All advertising payments are local TEST simulations.

> **Historical: v0.15.0 — Shoprite shopping and eight branded cars.** Enter the mall store for groceries, outfits and appliance delivery. Buy Mercedes-Benz, Lexus, BMW and Toyota models at mapped dealers. See [SHOPRITE_CARS_15.md](SHOPRITE_CARS_15.md).

> **v0.14.1 audit baseline — gameplay audit fixes.** Fixes repeat repairs, fuel-can loss, errand routing/suppliers, malformed save imports, and stuck menu/touch input. Removes repeated fictional/game-venue labels without deleting playable places. See [AUDIT_FIXES.md](AUDIT_FIXES.md).

> **v0.14.0 feature baseline — qualify, find work and finish the job.** Twelve legal career paths now enforce tools and skill requirements, career clicks open mapped multi-stage jobs, Metadav ICT Hub supplies training/gigs, and researched hotels/filling stations have usable game services. Police/EFCC are in the map directory, not the career menu. See [MILESTONE_14.md](MILESTONE_14.md).

> **v0.13.1 navigation hotfix:** The direction marker is always visible, with a north compass when exploring and an arrow/distance for marked destinations or tracked jobs. See DIRECTION_FIX.md.

> **Previous milestone: v0.13.0 — story, careers and consequences.** Four age presets, three builds, 14 career paths, researched oso afia commissions, an original escape runner, custody/release, occasional EFCC investigations, extortion choices and game offices. Start at **Phone → Story & careers**. See [MILESTONE_13.md](MILESTONE_13.md) for controls, scope and research.

> **v0.12.0 — random backgrounds & starting homes.** New lives are assigned Nwa Ogbe (₦1,000,000) or Nwa Mummy (₦5,000,000) with equal chance and no selection/reroll button. Rent a home in the creator and start inside it, or start on the street. Existing saves retain their balance and progress. See MILESTONE_12.md.

> **v0.11.0 — character & wardrobe refresh.** See MILESTONE_11.md for 12 outfits per character, new hairstyles, independent clothing colours and Phone → Wardrobe. The working real-WAT clock fix is preserved.

> **v0.10.1 clock hotfix:** See CLOCK_FIX.md. Real WAT is now mandatory for normal play; old accelerated preferences are overridden. Simulated weather is the default. Earlier clock-selector instructions below are historical.

# Onitsha Way

An open-world Nigerian city-life simulator for the browser, set in Onitsha (Anambra State).
The street network, the River Niger and all 13,823 building footprints in the 5.6 × 4.1 km play area come from
**real OpenStreetMap data**. It covers Main Market, Ochanja, Fegge, Bridgehead and the Niger Bridge, Upper Iweka,
Holy Trinity Basilica, ShopRite (Onitsha Mall) and, across the bridge, the Asaba bank.

> Historical status: **Milestone 10 — nightlife, decorating and real Onitsha time/weather (v0.10.0)**. Enterable nightclubs including a fictional-location House of Pilate, move/rotate/store room editor, more vehicle and mall polish, public visitor interiors, real WAT clock and live-weather fallback. Read [MILESTONE_10.md](MILESTONE_10.md) for controls, weather-service licensing and honest scope. [MILESTONE_9.md](MILESTONE_9.md) is historical.

## Run it (Windows, macOS, Linux)

Requirements: Node.js 18+ (22 LTS recommended) and npm.

```bash
npm ci
npm run dev      # http://localhost:5173; starts account/multiplayer server AND frontend
npm run build      # production build → dist/
npm run preview    # serve the production build
npm test           # unit/regression tests (plain Node, uses the real map)
npm run check      # tests + production build + build validation (what CI and Netlify run)
npm run e2e        # optional browser smoke test: new game, walk, save, reload, Continue (needs playwright-core + Chrome/Edge)
```

Real Onitsha time (WAT) is mandatory in normal play; historical accelerated settings are ignored. Nightclubs open 19:00–04:00 WAT. Live weather uses a non-commercial demo endpoint; see MILESTONE_10.md before monetising.

Dev shortcut: `http://localhost:5173/?quickstart` skips the menus (`&gender=female`, `&t=19.5` for 19:30 in game-time mode, `&at=upper-iweka` to start at a landmark id).
`http://localhost:5173/dev/character.html` shows the six character presets side by side (`?speed=1.75&rot=1.2` to see the walk cycle).

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move | W A S D / arrow keys | Left-half floating joystick |
| Run | Hold Shift | Run toggle, or push the joystick to the edge |
| Jump | Space | Jump button |
| Look | Click the scene (pointer lock) or drag | Drag on the right half |
| Zoom | Mouse wheel | — |
| Talk to someone / use a bus stop | E (when the prompt shows) | Use button |
| Board a keke or bus | E at its door when it stops, agree the fare (or "Kpaa ife") | Use button |
| While riding: next stop / drop me here / get down / skip to my stop | N / H / E / K (or the ride panel) | Ride panel buttons |
| While riding in a keke: seat view | C | Seat view button |
| Homes & vehicles list | L | Pause menu → Homes & vehicles |
| Rent / enter a home, use furniture | E at the door / next to the bed, cooker, cupboard, wardrobe, sofa, light switch | Use button |
| Drive your vehicle | E next to it · W/S accelerate/brake/reverse · A/D steer · H horn · E get out | Joystick; drive panel buttons |
| Keke business: pick up passengers | N, stopped at a bus stop where people are waiting (they get down and pay when you stop near their stop) | Pick up passengers button |
| Mechanic / sell / fit spare parts | E next to your vehicle at a car stand (or with parts in your bag) | Use button |
| Wholesale depot (bulk goods, supply orders) | E at the WHOLESALE DEPOT board by Main Market | Use button |
| Fill up at a filling station | F (stopped at the pump) | Fill up button |
| Mark a place / skip drive there | M, tap the big map (tap a house or car icon to mark it) · K while driving | Tap the map · Skip drive button |
| Show a house or car for sale on the map | L, then "Show on map": the big map opens with the blue route; follow the arrow on the chip and the light beacon | Same |
| Choose a reply | 1–9 or click | Tap |
| Bag & wallet | I, or click the ₦ chip | Tap the ₦ chip |
| Jobs | J, or click the JOB chip | Tap the JOB chip |
| Map | M, or click the minimap | Tap the minimap |
| Handbrake (slide round corners) | Hold Space while driving | Handbrake button |
| Police checkpoint stop | Stop next to the officers when flagged down, then choose | Same |
| Export / import your save | Settings → Export save / Import save | Same |
| Pause / save | Esc (or the ❚❚ button) | ❚❚ button |

## The map

`public/data/onitsha_core.json` is generated from the OSM export you supplied (`map`, Overpass API, 2026-10-15) by:

```bash
pip install shapely
python tools/osm_extract.py path/to/map public/data/onitsha_core.json
# optional: --bbox S N W E   (default 6.1260 6.1630 6.7480 6.7985)
#           --origin LAT LON (default: centre of the Milestone 2–5 area, so coordinates never move)
```

The extractor keeps:
- **Roads:** type, width, surface, names, bridge/layer, and a routable node graph with junctions for future NPC and transport routing.
- **Buildings:** footprint, a deterministic seed, the edge facing the nearest road, and a commercial/residential guess.
- **The River Niger** and **land** polygons, plus named POIs.

**Road clean-up.** Many OSM footprints overlap the carriageway, usually from mapping offsets. The extractor cuts the
overlapping part away, keeping room for the open drain on main roads. It drops footprints that are mostly inside a
road. On the supplied data that means 1,193 trimmed and 88 dropped.

OSM has no storey counts here, so building heights are generated, not surveyed. Shop names and businesses are fictional.

**Map extension (Milestone 6).** The area grew west to the Asaba bank of the Niger Bridge and about 390 m south,
where the Bridgehead dual carriageway turns back into town (without it, nothing could drive back off the bridge).
To keep saves valid, the projection origin is unchanged, and everything in the earlier area is written first,
byte-for-byte as before. A road that crosses the old edge keeps its old piece; the extension is added as a
separate piece sharing the boundary node. The world is then built in two phases, old area first, with
the same random sequences. As a result all 3,537 earlier residents keep their ids, names, trades and places
(checked in the browser against the Milestone 5 map). The new area adds 498.

**Map extension (v0.48): GRA and the rest of Onitsha.** From the export of 6.120–6.192 N, 6.748–6.830 E, which has the
Onitsha North and Onitsha South LGA boundaries, `tools/osm_append.py` appends only what lies outside the earlier map
and inside those LGA lines: 1,191 roads, 6,574 buildings, GRA Phase I and II (OSM suburb nodes), 11 places and a lake.
Nothing earlier is rewritten: new roads join the old network at existing nodes, and the world builds the extension in a
third phase whose colliders are tagged, so the earlier map's houses, residents, homes and shops come out exactly as
before (checked in the browser, `tests/e2e/mapext48.mjs`). Eight houses this game had invented on empty land at the old
edge now stand where OSM has real buildings or roads; they are taken out (their numbers kept), and one family who lived
in one of them has no home. Outside the LGA lines is COMING SOON.

```bash
python3 tools/osm_append.py export.osm --base public/data/onitsha_core.json --bbox 6.120 6.192 6.748 6.830 --out public/data/onitsha_core.json
```

### Landmarks

Known places are defined in `src/data/landmarks.js` with real latitude/longitude. Each one records its source and a
confidence (`osm`, `published` or `approximate`):

| Place | Position from |
|---|---|
| Onitsha Main Market | Wikipedia coordinates; matches the market lock-up rows in OSM |
| Ochanja Market | **approximate**: placed on Iweka Road from descriptions; please confirm locally |
| Upper Iweka (flyover + cloverleaf) | OSM bridge and link roads |
| Upper Iweka Motor Park | OSM `bus_station` nodes (Peace Mass Transit Park) |
| Bridgehead and the Niger Bridge | OSM neighbourhood node and bridge way |
| ShopRite · Onitsha Mall | OSM ShopRite node inside the mall footprint |
| Holy Trinity Basilica | OSM church footprint |
| Fegge | OSM suburb node |

To correct a place, edit its `lat`/`lon` in that file; gates, the map pins and HUD labels follow automatically.

Map data © OpenStreetMap contributors, available under the Open Database License (ODbL). Keep this attribution
(it is shown in-game on the menu and credits screens).

## Project structure

```
src/
  core/         Game (state machine + frame loop), EventBus, utils
  render/       Renderer (scene, camera, lights, sky), Atmosphere (day/night, weather, power cuts), WorldTextures (procedural atlases),
                Rain (falling rain), WeatherController (calendar, weather and power brought into the world)
  world/        MapData, World, City (streamed chunks), RoadBuilder, Bridges, Terrain, Landmarks,
                LandmarkDressing, PropBuilder, GeoBuilder
  physics/      CollisionWorld — 2D grid of wall segments + circles
  characters/   HumanRig (procedural skinned human), CharacterAnimator (procedural gait), ClothingTextures
  player/       PlayerController + ControlState (onFoot / passenger / driver); Needs — energy, eating and drinking
  camera/       CameraRig — follow (wall-aware), showcase, cinematic, passenger orbit, keke seat view
  transport/    transportConfig (modes, fares, lines), TransitNetwork (routes + stops from the road graph),
                TransitFleet (vehicles on their lines, pickups/drop-offs, seats), TripSystem (the player's trip:
                wait → board → pay once → ride → get down), TransportController (game glue), StopProps (signs, shelters)
  input/        InputManager (keyboard/mouse/pointer-lock), TouchControls
  sim/          SimClock — the single in-game clock; Calendar — weekdays, seasons, weather and power cuts (pure);
                Reputation — how the area knows you (pure); Police — checkpoint rules, fines (pure);
                RoadGraph — navigation graph; TrafficSystem — ambient traffic
  interaction/  InteractionSystem — contextual prompts (used from Milestone 3)
  vehicles/     KekeModel, MinibusModel, CarModels (executive saloon, sedan, luxury SUV, coaster bus, lorry);
                VehicleSystem (sale spots, buying, fuel, wear and repairs, selling, route planning), VehicleController (driving,
                parking, mechanic), KekeBusiness (carrying passengers for money), PoliceController (checkpoints, stops)
  housing/      HousingSystem (listings in real houses, rent, access), Interiors (shared room layouts),
                Kitchen (cooking), HomeController (doors, enter/exit, furniture, safe restore, visiting people)
  ui/           UIManager, Minimap (live minimap + zoomable map), styles.css
  audio/        AudioManager — procedural ambience, horns, footsteps
  economy/      Economy (the only money service), Inventory, Shop (prices, bargaining, buying, selling), Stock (daily trader stock),
                Wholesale (bulk lots, supply orders), WholesaleController (the depot by Main Market)
  jobs/         JobSystem — up to three delivery, collection and errand jobs with deadlines
  data/         landmarks.js — known places with sources; onitshaExpressions.js — the language pack; catalogue.js — goods & prices;
                housing.js — home types and rents, vehicles and prices, wear, fuel, recipes, skip speeds; schedule.js — opening hours by weekday
  dialogue/     Conversations — data-driven dialogue nodes, ambient lines, bump reactions
  npc/          NPCSystem — residents, rig pool, routines, bubbles, relationships
  save/         SaveSystem — versioned localStorage saves + settings
tools/          osm_extract.py (needs shapely)
scripts/        validate.mjs — build validation (run by `npm run check`)
tests/          unit tests (plain Node); e2e/smoke.mjs — optional browser smoke test
public/         data/ (map), icons/, manifest.webmanifest, sw.js (offline cache), .htaccess (Apache hosting)
public/data/    onitsha_core.json
dev/            character.html (character lineup test page)
```

## Economy

- **One money service.** `src/economy/Economy.js` handles every naira. Whole-naira amounts only.
- **No partial payments.** A debit that would go negative is refused and nothing changes.
- **No double charges.** Every transaction has an idempotency key, and replaying a key is refused, even after a save/load.
- **Ledger.** Every transaction is recorded and shown under Bag & wallet.
- **Purchases** check stock and bag space before any money moves. Traders have a limited daily stock that restocks each morning.
- **Selling:** traders buy goods of their own line at about half price (a little more for friends), always below what they
  sell for, so buying and reselling can't make money.
- **Job rewards** are paid only after the completion condition (parcel or item in the bag) is checked, using one key per job.
- **Fares** are charged once per trip, with the trip's own key, when the vehicle pulls away with you on board.
- **Prices and fares** in `src/data/catalogue.js` and `src/transport/transportConfig.js` are game configuration, not
  surveyed prices. The starting balance is ₦5,000.
- **Rent** is paid per 7-day period with one key per period. You can't pay more than one period ahead. **Buying a
  vehicle** uses the sale spot's key, so it can never be bought twice. **Fuel** is bought in whole litres, as many as
  you can afford — never a partial payment.
- **Tests.** `npm test` runs 100 unit tests covering all of the above.

## Public transport

- **Eight lines on real roads** (`src/transport/transportConfig.js`), routed by shortest path on the OSM road graph:
  four keke lines through the side streets, two mini bus lines, a commercial bus line, and a coaster that runs from
  Upper Iweka Motor Park over the Niger Bridge to Asaba. Keke never go on the Niger Bridge.
- **Stops** are placed near the named places (Main Market, Ochanja, Upper Iweka, Bridgehead, Fegge, the Basilica,
  ShopRite and others) and every few hundred metres between them. They are never on bridges, in junctions or on another
  road's carriageway. Unnamed stops are named from what is really there: street names, cross streets and the distance to
  the nearest known place.
- **How to ride:** walk up to a yellow BUS STOP sign and press E. Choose a destination; the list shows each line, the
  number of stops, a rough time and the fare. Wait by the sign and board (E) when the vehicle stops. Keke and mini bus
  drivers can be asked "Kpaa ife" for a small reduction, once each; bus and coaster fares are fixed. You can also ask
  any keke or bus standing at a stop where it goes. The fare you agreed is paid once, when the vehicle moves off;
  getting down before then is free. You get down automatically at your stop. "Next stop" or "Drop me here" makes the driver pull in at the next
  safe place, never on a bridge or in a junction.
- **The fleet** runs everywhere all the time. Only vehicles near you are drawn. Drivers pick up people queueing at
  stops (you see them walk to the door) and drop riders off, within the seats available. Vehicle windows are
  see-through, so drivers and passengers (and you, in your seat) show inside cars, buses and coasters.

## Homes

- **Up to 46 homes to let (including M9 bungalows and duplexes)** in real OSM houses: self-contains (₦3,500 per 7 days), rooms and parlours (₦7,500) and 2-bedroom
  flats (₦15,000), picked by floor area. Only houses whose front door has a clear walk to the street (no compound
  wall or gate in the way) are listed. Each has a door and a TO LET / HOME / RENT DUE sign.
- **At the door:** look inside first, rent, or renew. Tenants go straight in. When the rent runs out you have 2 days to
  renew; after that the place goes back on the market, and your cupboard is kept for you if you rent it again.
- **Inside** (one shared layout per home type, each house in its own colours):
  - bed: sleep until 07:00 (energy back to full) or nap;
  - gas cooker: turns market foodstuff into meals for your bag;
  - cupboard: stores your things;
  - wardrobe: change clothes;
  - sofa: rest;
  - light switch;
  - door.
  While viewing a place you haven't rented, the furniture is locked.
- **Saving inside** brings you back inside on loading if you still rent the place, otherwise to the front step.
  Positions are always saved as the step outside, so a save can never strand you in a wall or a room you can't use.

## Vehicles

- **Stands** at Upper Iweka, Old Market Road and Bridgehead sell a used keke (₦22,000), tokunbo saloons (₦48,000),
  an executive saloon (₦160,000) and a luxury SUV (₦290,000) — game prices.
- **Driving** is its own control state (separate from riding public transport):
  - arcade handling;
  - collisions with buildings, walls, poles and the river, traffic and people;
  - up and over the Upper Iweka flyover and the Niger Bridge decks;
  - head and tail lamps at night.
  Traffic keeps clear of your parked or moving vehicle.
- **Fuel:** each vehicle has a tank and uses fuel by distance. Fill up at the OSM filling stations (Gas, Pillars and Conoil in
  Onitsha, Ona Jones in Asaba), or pour a jerrycan from a spare-parts trader into the tank.

- **Wear:** crashes dent the vehicle (damage 0–100%), which takes top speed off (up to 45%). Mechanics at the three
  stands fix everything for a price; brake pads, engine oil and (for a keke) a spark plug from a spare-parts trader fix
  part of it yourself. The stands also **buy vehicles back** at 60% of the price, less damage.
- **People get out of the way:** pedestrians in the path of your vehicle jump aside and shout at you.

## Finding places: directions on the map

- Houses to let (red), your home (green), vehicles for sale (blue), your vehicles (green) and friends' houses (purple)
  are drawn on the minimap and the big map, with names on the big map. The homes list (L) shows each one's street
  and the nearest landmark; "Show on map" marks it and opens the big map with you and the place in view.
- Wherever you're heading (your marker, else your tracked job), a **blue route line** follows the real streets — walking
  routes when on foot, drivable routes (one-way streets respected) when driving — and is recalculated as you go. The
  waypoint chip gives the distance by road and an arrow that turns to show which way to go; a tall light beacon stands
  over the destination.

## Life in the city (Milestone 7)

- **Calendar:** every game day has a weekday (day 1 is a Monday), and each game day also moves the season on a week,
  starting in mid-October — so you see the last rains, the dry season, harmattan (Dec–Feb) and the next rains. The HUD
  shows the weekday and the weather; the pause screen shows the date, the season and your reputation.
- **Weather** is deterministic per save (a reload gives the same weather): afternoon and night storms in the rainy
  season, with falling rain, a grey sky, fog, wet shiny roads, rain and thunder sounds, fewer people about and a rain
  surge on keke and minibus fares (bus and coaster fares stay fixed); harmattan brings a dusty beige haze and a dim sun.
  People talk about the weather.
- **Power cuts ("NEPA took light"):** one to three a day. Street lights go out, homes and shops dim to generator light,
  generators drone, and the light at home doesn't work unless you carry a rechargeable lamp (electricals traders).
- **Weekly rhythm:** morning and evening rush hours on weekdays, a busy Saturday market that runs late, and a quiet
  Sunday morning (church). On Sunday the markets don't open — stall traders stay home — and shops open from 13:00.
  Job offers, job targets and the job chip follow the same hours.
- **Reputation** is worked out from the people who know you, jobs done and let down, and trouble caused (nothing extra
  is stored): New face → Known in the area → Respected → Big name in Onitsha (or a Bad name). It gives small shop
  discounts and better job pay, and strangers greet you differently.
- **Keke business:** in your own keke, stop at a bus stop where people are queueing and press N: up to three passengers
  get in (you see them in the back), each going to a real stop 0.4–2.6 km away for the standard keke fare. Stop near
  their stop and they pay (once each, through the Economy); take too long and they get down unpaid. The route to the
  next drop is marked for you.
- **Wholesale and supply orders:** the WHOLESALE DEPOT by Main Market sells bulk lots at under half the shop price per
  piece (a few lots a day; closed Sundays). Traders buy the pieces back at their usual buy-back price, or take a
  **supply order** from the board: bring N pieces to that trader by 18:30 and talk to them to get paid. Missed orders
  lapse and the trader remembers.
- **Visiting people:** someone who knows you well may invite you round ("Tinyelu m ahu"). Accept and their house — a
  real house near where you met — goes on your map. Knock between 09:00 and 21:00: eat with them (+energy) and gist,
  once a day each, to become closer friends. Their rooms are the shared interiors in their own colours, and every rented
  house now has its own paint, floor and rug colours too.
- **Skips move the world on:** after a skipped ride or drive, a sleep or a rest, the buses and kekes have carried on
  round their routes and the cars and passers-by around you are new.

## Driving, police and the streets (Milestone 7 follow-ups)

- **Driving** now has grip: the tyres hold only so much sideways force (less in the rain, and less on a damaged
  car), so a fast turn runs wide and slides; the handbrake swings the back round; a keke cornering hard lifts a
  wheel and warns you. Your engine and tyre sounds follow your speed.
- **Traffic police** man six checkpoints on main roads (drums, cones and a POLICE sign) by day, Monday to
  Saturday and Sunday afternoon, and shelter in heavy rain. Near a manned post they notice speeding (over the
  road's limit: 50 km/h on primary roads, 40 on secondary, 30 elsewhere), driving the wrong way down a one-way
  street, and knocking someone down. Stop at the post and pay the fine (₦3,000 / ₦5,000 / ₦10,000), or explain
  yourself (a respected name may get a warning). Drive off and you're wanted: the next checkpoint stops you on
  sight with the fine doubled. If you can't pay, they hold your vehicle until you pay at that checkpoint.
  The language pack's police expressions are now used for these events: "Ndi nwa" when the police are ahead,
  "Nwi nwo nwi" when they flag you down, "Bọchaa" when you run.
- **Sunday Mass** at Holy Trinity Basilica: people gather outside from 07:30, the bell rings at 08:45, a choir is
  heard from outside during Mass (09:00–11:00), and people chat outside afterwards.
- **Traders' days:** at opening time traders walk up to their stalls; at closing time they pack up and walk off.
  In the rain people put up umbrellas and hurry.
- **Rooms fit the house:** each house's rooms are sized from its own footprint (width along the front wall and
  depth), within limits that keep the furniture usable.
- **Streets cleaned up:** about 640 kiosks and 680 stalls, parked cars and parked kekes that had been placed on top
  of other roads (at junctions, or across dual carriageways) are gone, and road junctions are filled so roads meet
  without gaps or notches. Everything else stays exactly where it was.

## Release features (Milestone 8)

- **Adaptive resolution** (Settings, on by default) lowers the render resolution when the frame rate drops and
  raises it again when there's headroom. Also in Settings: field of view, game clock speed (slow / normal /
  fast), control hints on/off.
- **Saves:** export your save as a file and import it again (backups, or moving to another browser or device);
  imports are checked and migrated, and the previous save is backed up first. The game saves when you switch
  away from the tab or app, and warns you if the browser won't let it save.
- **Recovering from problems:** an error in one frame no longer freezes the game — it keeps running and shows a
  small bar with a "Copy details" button for bug reports. If loading a save fails, the game tries again from the
  start spot (keeping your money, bag, homes and vehicles) before giving up with a message. If the graphics driver
  resets, your game is saved and a reload is offered. Old browsers get a clear message instead of a blank page.
- **Installable web app:** a manifest and icons (add to home screen, full screen, landscape) and a service worker
  for offline play after the first visit (HTTPS only).
- **Deployment:** configs for Apache/cPanel (`.htaccess`), Netlify, Vercel and GitHub Pages — see [DEPLOY.md](DEPLOY.md).

## Skipping a trip

On a paid ride, "Skip to my stop" takes you to your stop. While driving, "Skip drive" goes to your map marker (tap
the big map) or your current job's next stop, along the real road route. Either way the clock moves on by
realistic Onitsha travel time (about 18 km/h by keke or bus, 24 km/h by car), and a drive uses fuel for the
distance. You're warned first if a job deadline would pass.

## Onitsha language pack

`src/data/onitshaExpressions.js` holds every supplied expression **verbatim**, with its supplied meaning and metadata:
category, context, roles, tone, triggers and a verification status. Every entry is `unverified` until checked with local
speakers. To add an expression, append an entry; the dialogue engine and the in-game Phrasebook pick it up.

- Warning, police and crime expressions only fire on matching events. Bumping into people triggers "Tinye onwe gi na chain"
  and then "Gbara ogwu gi ñuo"; police and robbery events don't exist yet, so those entries stay in the reference.
- "Onye mgbu", "O chala acha" and "Ina ete amu gi nsi" are reference-only and never spoken.
- English and Pidgin lines written for the game are shown as **Example dialogue**, separate from the supplied meaning.

## Assets and licensing

Sound is also synthesised at runtime with the Web Audio API: market crowd, traffic, keke horns, crickets, river,
footsteps, rain, thunder and generators. There are no audio files.

Most visuals are generated in code at load time: buildings, facades, roofs, signboards, keke, props, fabric prints and
many furnishings. Third-party models, each with its licence file next to it:
- `public/models/v24/` — the supplied character packs and the "vehicle 1" car pack (CC0; notes in
  `public/models/v24/licenses/`). The supplied *building* packs were removed in v0.37 at the player's request (one of them
  had no licence notice). In v0.48 the coaster bus from the "vehicle 2" pack (which also had no licence notice) was
  replaced by a bus model written in code, and the file was removed, so every model in the game now has a known licence.
- `public/models/furniture/` — Kenney *Furniture Kit* 2.0 (CC0, www.kenney.nl), `LICENSE-Kenney-Furniture-Kit-CC0.txt`.
No textures are downloaded. Fonts (Bricolage Grotesque, DM Sans) load from Google Fonts under the SIL Open Font License and
fall back to system fonts offline. three.js is MIT-licensed.
