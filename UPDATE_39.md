# v0.39.0 — crashes, night lights, flyovers you can climb, unfinished buildings, new floor plans, hospitals

Your list, item by item. Item 5 (seeing what is in another player's house) was already in the game from v0.37 —
when you visit a friend online you see their furniture — so, as you said, it was left as it is.

## 1. NPC drivers react when their vehicle is hit
- When two NPC vehicles bump (squeezing past, cutting in at a junction) or **you hit one with your car**, the driver
  brakes hard, puts the **hazard lights** on (they blink, day or night), leans on the **horn** and shouts at you in
  Pidgin ("Oga! You don jam my motor!", "Oya come down make we settle am!"…) in a speech bubble over the car. After a
  few seconds they drive on. Hit them with your car and you also get "The driver is not happy with you!".
- A small bump at walking pace doesn't count; the same car won't react again to the same bump.

## 2. DMGS and Upper Iweka monuments light up at night
Both roundabout monuments carry strings of **LED lights** (355 in all) round the kerb, up the arches / tusks and in a
halo. They come on at dusk and cycle through three shows: a rainbow chase, flashing **green-white-green** flag bands,
and a warm pulse rising up the monument. Off by day.

## 3. Billboards light up at night
All 200 billboards: the lamps over each board glow, a wash of light falls on the face and the advert itself is
brighter after dark.

## 4. Flyovers you can climb (players and NPCs)
I checked the real Upper Iweka interchange: it has **one** flyover (the Onitsha–Owerri Road over the expressway,
with the cloverleaf ramps) — that is the one already in the game. As you chose "Both":
- **The real flyover** gets **staircases** up to its deck, through openings in the parapet. You can walk up the
  ramps too.
- **Two new road flyovers** (invented for the game — not real structures) carry through traffic over busy junctions
  near Upper Iweka: *Onitsha – Owerri Road Flyover* and *Iweka Link Flyover*. Cars, buses and your own car drive
  over them; the lanes under the deck are left for turning traffic and people walking (no through cars underneath).
  Each has staircases.
- **Four pedestrian footbridges** with steel railings and stairs at both ends cross the big roads around Upper Iweka.
- **You** can walk up any staircase or ramp, along the decks and footbridges, and down again. Railings and parapets
  stop you walking off the edge; you can still walk under the decks. If you save on a deck you load on the deck.
- **NPCs** use the same stairs, decks and footbridges as part of their walking routes.

## 5. (already there — left as it is)

## 6. Uncompleted buildings
About **350 uncompleted buildings** stand around town: concrete columns with rusty starter bars sticking out, slabs,
part-built blockwork walls, some missing their top floor, with a stack of blocks and a sand heap in the yard where
there is room. None of the rentable homes is affected (no home was turned into a building site).

## 7. Every home has its own floor plan, and comes empty
- **All 90 homes now have their own floor plan** (checked: 90 different plans). The room list follows how Onitsha
  homes are let — *self-contain* (room, kitchenette, bath/toilet), *room-and-parlour*, *2-bedroom flat* (parlour,
  dining, kitchen, 2 bedrooms, bath/toilet, store) and *duplex* (parlour, dining, kitchen, guest toilet downstairs;
  bedrooms with their own bath/toilet upstairs). The rooms are laid out differently in every home: sizes, which side
  the parlour is on, where the door, corridors and wet rooms are. The front door always opens into the parlour (or
  the room in a self-contain). Sources used for the room types: ownkey.com "Nigerian property terms" and
  nigeriapropertycentre.com listings.
- **Homes no longer come with a bathroom, kitchen cabinets, cooker or sink.** Each room has only a **ceiling bulb
  and its light switch** (the parlour's switch is by the front door). Buy your toilet, shower, basin, cooker,
  cupboards and everything else in Buy mode and place them where you want.
- **You can take bulbs out**: Buy mode → My items → *Ceiling bulbs & switches* → *Take out* / *Put back* for each
  room. In Buy mode the room names show on the floor.
- **Important for existing saves:** your home's rooms have changed shape. Furniture you already placed stays where it
  was if it still fits; anything that now stands in a wall goes to your **storage** (nothing is deleted and no money
  changes hands). The built-in toilet/shower/kitchen are gone, so if you hadn't bought your own, buy them in Buy mode.

## 8. Hospitals and ambulances
- **Two hospitals** (fictional names: *Iweka Road General Hospital* near Upper Iweka and *Nkem Memorial Specialist
  Hospital* near Main Market — I could not verify real hospital sites from here, so they take over existing
  buildings) with a red-cross sign, a parked **ambulance** with flashing lights, and a map pin (map search: Hospitals).
- At reception: **Check-up & treatment** (₦2,500, 1 hour, energy and hygiene back up) or **rest in a ward bed**
  (₦6,000, 8 hours, fully rested).
- **Ambulances drive in the traffic** with flashing red/white/blue lights and a siren you hear when they're close.
- **If a car knocks you down** you fall flat, an ambulance comes with its siren on, and you wake at the nearest
  hospital about 3 hours later, treated. It costs up to ₦3,000 (whatever you have if less; free if you have nothing).
- **If you knock someone down** while driving fast, someone calls an ambulance for them.

## How to update
Back up first (Settings → Export save, and copy `server/data`). Extract into a fresh folder, copy your own
`server/data` back, `npm ci`, then `npm run dev` (or `npm run lan`). Keep the same browser profile and address.
**Do not clear browser storage.** Save version is still 17 (two optional fields were added: the bulbs you took out,
and your height if you save on a deck).

## Not done / limits
- The new road flyovers and the footbridges are invented for the game; only the Upper Iweka flyover is real.
- Ambulances in the traffic drive the normal traffic routes (they don't race to a call); the ambulance that comes for
  you is a short scripted drive along the nearest road.
- You can't enter the hospital building — treatment happens at the reception door.
- NPC pedestrians walk up the stairs and over the decks but don't use them to cross a road on purpose (they follow
  their usual walking routes).
- On the real flyover the decks are short (60 m each way), so its stairs are fitted where the ground beside them is
  clear of roads.
