# v0.37.0 — Furnishing your home, four home stores, and the model-pack houses removed

This is stage 1 of the three briefs (home furnishing, residential buildings, filling empty land). It covers the
furnishing brief and the first building step you asked for: removing the supplied-pack houses.

## 1. The supplied-pack houses are gone
The 6,468 buildings that had been swapped for the supplied building packs (the ones that looked squished) are
drawn by the game's own building code again, at their real map footprints. The 21 building models and their two
licence notes were removed from `public/models/v24` (−16 MB). Supplied **characters and vehicles are unchanged**.
Collisions follow the same map footprints as before. The new building kit (8 Onitsha building types, compounds)
is the next stage.

## 2. Furniture: every item is its own piece
- You can own **two (or more) of the same thing**: two armchairs, four monobloc chairs, a fan in each room.
  Each piece is placed, moved, rotated, recoloured, stored or sold on its own (up to 12 of one item, 160 per home).
- **Placement:** pick an item → **Place…** → drag on the room (or arrow keys) → **↺ / ↻ rotate in 45° steps** (R /
  Shift+R) → **Pay & place** (or **Place here** when moving). A green outline means the spot is clear; red says why
  not (wall, built-in, another piece, door/stairs, interaction point). **Cancel** never charges and never loses the item.
- **Where things go:** floor furniture; **wall items** (pictures, mirrors, clocks, curtains, blinds, shelves, wall TV,
  air conditioner, sconces, cupboards) snap to the nearest wall at their proper height and face into the room;
  **ceiling items** (fans, lights, chandelier, spotlights); **table-top items** (bowls, cups, vases, kettle, microwave,
  lamps…) stand on a table, cabinet or bed if you drop them on one, otherwise on the floor; **bedding** (sheets,
  duvet, pillows) goes on a bed; **outdoor items** (garden chairs, planters, garden/porch/security lights, house sign,
  water tank, solar panels, generators) are installed by your front door automatically.
- **Tap a piece in Buy mode** (or open **My items**) to Move, Rotate 45°, Store, change its colour, or **Sell** it.
- **Selling** pays **40%** of the price, exactly once (a second tap or a double click pays nothing).
- **Colours/materials:** 6 fabrics, 5 woods, 3 appliance finishes, 4 plastic colours, 4 frames, 3 lamp shades, 5 rug
  colours, 4 ceramic glazes, depending on the item. Recolouring an owned piece is free.
- Phone → My home → **Arrange furniture** (the floor plan) works per piece too.
- Lamps you place now light the room at night (up to 4 real lights per room), and the rechargeable lantern, emergency
  light and rechargeable fan keep working during a power cut. A **solar panel system** recharges your inverter
  batteries in daylight during an outage.

## 3. The catalogue: 184 items in the brief's 11 sections
Living room · Bedroom · Electronics & appliances · Lighting · Wall décor & accessories · Rugs, curtains & bedding ·
Kitchen & dining · Bathroom · Nigerian home essentials · Outdoor & compound · Hobbies & study, plus Paint & floor.
Every item has an id, name, section, store, price, **tier**, resale value, model, colour options and placement rule.

| Tier | Prices | Items |
|---|---|---|
| Budget | under ₦6,000 (monobloc chair ₦1,500, door mat ₦800, standing fan ₦5,500) | 90 |
| Standard | ₦6,000–₦34,999 (three-seater sofa ₦18,000, double bed ₦16,000, fridge ₦22,000) | 72 |
| Premium | ₦35,000–₦220,000 (L-shaped sofa ₦85,000, smart TV ₦58,000, crystal chandelier ₦120,000, split AC ₦145,000, solar system ₦220,000) | 22 |

Prices were set against the economy already in the game: jobs pay ₦500–₦9,000 a task, a self-contain rents for
₦3,500 a week, cars cost ₦18k–₦2.2M. The 57 items from before keep their ids, so nothing in your save changes
meaning; a few were renamed to the brief's names (e.g. *Comfort sofa* → *Three-seater sofa*, now ₦18,000).

**Models:** 116 models from Kenney's *Furniture Kit* (CC0, kenney.nl — found re-hosted on GitHub, since kenney.nl
itself can't be reached from here; licence file included at `public/models/furniture/`), and code-drawn models for
everything the kit doesn't have: wardrobes, chests of drawers, TV wall unit, deep freezer, split AC, monobloc chairs,
water tank on stand, solar panels, chandelier, framed African and Uli-pattern artwork, family portrait, curtains,
blinds, cookware sets, Ankara cushions, carvings, outdoor lights and more. No item is a plain coloured box.

## 4. The four home stores (in existing buildings — nothing new built, nothing moved)
| Store | Where | Sells |
|---|---|---|
| Ezinne Furniture Showroom | by Upper Iweka | sofas, beds, wardrobes, tables, dining sets, outdoor furniture |
| Bright Star Electronics & Appliances | by Ochanja Market | TVs, fridges, freezers, cookers, fans, AC, washers, kitchen appliances |
| Nnamdi Lighting & Electricals | by Bridgehead | lights, lamps, generators, inverters, batteries, solar |
| Adaeze Home Décor | by Shoprite | art, mirrors, rugs, curtains, bedding, kitchenware, plants, bathroom accessories |

Each has a fascia sign, a few pieces on show on the pavement, a shopkeeper (8:00–20:00) and a map pin (under
*Shopping*). Walk up and press E / Use: the store's own catalogue opens; pick a colour and which of your homes it
goes to. **Store purchases are delivered free** to that home's storage. **Ordering from home** in Buy mode adds a
delivery fee of 8% of the price (₦300–₦6,000). Shoprite's appliance counter still works and now lets you buy a
second unit.

## 5. Visitors see your furniture
When a friend visits your home online, they now see your furniture, paint and floor (the game shares a small list of
placed pieces with the server; the server re-checks every value). If you rearrange while they are there, their view
updates within about half a second. NPC homes you visit are unchanged.

## 6. Saves (version 17)
Old saves convert automatically on load: every item you owned becomes one piece, keeping its **exact position,
rotation, colour and storage state**; items the old game laid out automatically are laid out the same way on your
next visit; outdoor generators stay outside. Money, rentals, paint and floors are untouched. Nothing is reset.
If an item no longer fits its room (it shouldn't, sizes were kept), it moves to storage with a message — you never
lose it.

## Not done yet (next stages)
- The residential building kit (8 types), compounds, and filling the empty land; enterable flats in multi-unit
  buildings (about 90 rentable homes). Today's 800 simple infill houses are still there until then.
- Furniture can't be placed on top of the kitchen counters that come with each home (only on furniture you own).
- Outdoor items are set out for you by the door; you can't drag them yet.
- Appliance on/off is per item type in a home (switching one TV switches all your TVs there).

## How to update
Back up first (Settings → Export save, and copy `server/data`). Extract into a fresh folder, copy your own
`server/data` back, run `npm ci`, then `npm run dev` (or `npm run lan`). Keep the same browser profile and address.
**Do not clear browser storage.** Your save converts to version 17 by itself the first time it loads.
