# v0.38.0 — Onitsha buildings, compounds on empty land, 90 rentable homes

Stage 2 of the three briefs: the residential building redesign and filling the empty land. (Stage 1, furnishing,
was v0.37.)

## 1. Eight Onitsha building types (the building kit)
Every residential building on the map keeps its real footprint and collider, and is now drawn as one of eight types,
picked from its size, number of floors and neighbourhood (the same building is always the same type):

| Type | Look | How many |
|---|---|---|
| Older bungalow | rust/zinc roof, front **veranda with square pillars and a low wall**, dark painted dado band, faded paint | ~2,700 |
| Tenement (face-me-I-face-you) | long single storey, many doors along the front, veranda, zinc roof | ~1,200 |
| Modern bungalow | coloured long-span roof (mostly hipped), **porch with two columns and a small gable**, light paint | ~2,200 |
| Duplex | two floors, porch, **balcony** over the entrance, hipped long-span roof | ~2,300 |
| Storey building with flats | 2–3 floors, flat roof with parapet, **balconies on every upper floor**, water tanks | ~2,700 |
| Apartment block | 3+ floors, parapet roof, full-width balconies, tanks | ~330 |
| Shops with rooms above | 2–3 storey commercial buildings get residential balconies above the shops | ~650 |
| Self-contained units | small single-storey rows, a door per unit, low roof | ~970 |

Older bungalows and tenements are more common in the old trading districts (Main Market, Ochanja, Fegge,
Bridgehead); modern bungalows and duplexes more common further out. Verandas, porches and balconies are only added
where the ground in front is clear of roads and neighbours; pillars are solid.

## 2. Houses on the empty land
The 800 plain box houses are gone. In their place, about **3,400 houses** stand on empty plots along real streets,
in rows behind the road (up to about 50 m back). Each is an ordinary city building: it gets a type from the kit,
streams in and out with the city and has a proper collider. About **2,000 sit in walled compounds** with:
- a perimeter wall with pillars and coping, and a coloured **sliding gate** facing the street (you can walk in);
- an **elevated water tank** on a steel stand, a **generator house**, a **clothesline with washing**, and a
  **security light** over the gate — a mix per compound, not all of them everywhere.

The old districts get smaller plots closer together and fewer walls; newer areas get bigger compounds.

**Kept open** (nothing built): roads and pavements, the space around junctions, markets, parks, schools, churches,
monuments, the mall, the stadium and its grounds, the interchange, billboard and venue sites, water, the paths to the
rentable homes' doors, the car stands' plots and the spawn point. Land more than about 50 m from any street is also
left open (there is no street access to build from); you will still see open ground in the middle of large blocks.

## 3. Life
- About **500 neighbours** now stand at compound gates during the day (same resident system as before).
- **At night**, lit windows glow in roughly four in ten homes, and compound security lights come on.

## 4. 90 rentable homes
The 46 homes you already know are unchanged (same ids, same doors). **44 flats** are added in storey buildings and
apartment blocks: two per building, each with its own door on the front — *Flat A* on the left, *Flat B* on the right
(room-and-parlour, self-contain or 2-bedroom flat). They rent and buy, take furniture and visitors exactly like the
other homes. Ids look like `home:<building>:A`, so saves can't confuse them with the originals.

## Performance
Measured on this test machine (2 CPUs, software graphics, medium quality): street-level views 170–320 draw calls and
0.35–0.6 M triangles, the same range as before this update (v0.36: 130–320 calls, 0.26–0.72 M). All new geometry is
merged into the existing city chunks (one extra night-light mesh per chunk). Planning the houses on empty land adds
about **4 s to loading on this machine** (it is faster on a normal PC; a phone will be closer to this machine).

## Not done yet
- Parked cars, keke and motorcycles inside compounds; children in courtyards (left out, as agreed).
- The new houses on empty land are not enterable (only the 90 listings are).
- Open land deep inside large blocks, away from any street, is left open on purpose (see above).

## How to update
Back up first (Settings → Export save, and copy `server/data`). Extract into a fresh folder, copy your own
`server/data` back, `npm ci`, then `npm run dev` (or `npm run lan`). Keep the same browser profile and address.
**Do not clear browser storage.** No save change in this version (still save version 17).
