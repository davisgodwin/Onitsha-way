# v0.52.0: GRA tarred and in concrete, the garage at home, and a new Buy mode

## GRA: tarred roads, concrete ground
- **Tarred roads**: every road cars use inside GRA Phase I and GRA Phase II is now asphalt. The map data marks 26
  of them as dirt (most of them in Phase II); they're tarred now, on the small map too. Footpaths are unchanged,
  and roads that never enter GRA are unchanged.
- **Concrete ground**: the open land in both GRAs is poured concrete in 3 m slabs with saw-cut joints, instead of
  red earth.
  - It covers each GRA where it is at least half "in", matching the shaded area on the map.
  - It is one flat mesh per GRA, so it costs almost nothing to draw.
  - Roads, walls and houses stand on top of it.
- Outside GRA nothing changes. You can see where GRA starts.

## The home garage is at home now
Before, the garage could be up to 260 m away by any clear road. Now, for the home you rent or own:

1. **A carport inside your compound**, near the gate. It is a steel frame with a dark roof over a concrete floor.
   In a wide, shallow yard it is turned to fit.
2. **No room in the yard**: a walled garage is built onto the compound wall, in the compound's own wall colour,
   with its door to the street. The compound becomes bigger.
3. **A house with no compound wall**: a walled garage on free land right by the house, its door facing the street.
4. **Only if none of these fit**: a spot by a nearby road, as before.

In a test of 120 homes:
- 55 got a carport inside the compound, 18 a garage on the compound, and 47 a walled garage by the house;
- none was more than 45 m from the door.

Your stored cars come out into the new spot. Nothing in your save changes: the garage spot is worked out each time
the game starts.

## Buy mode, redesigned
- **On a computer**: the catalogue is a panel down the right side and the room fills the rest of the screen. The
  room view is shifted so it's centred in the free space.
- **Search**: a search box finds an item by name in the section you're in.
- **Selected item**: it shows in a card with its picture. The item list keeps its room; before, the selected item
  squeezed the list away.
- **Cards**: bigger pictures, clearer prices, a hover lift, and a green border on the chosen one.
- **The top bar**: your home's name next to "Buy mode", and your money in a dark pill.
- **On a phone**: the catalogue is still a bottom sheet. With an item selected, the price filters and the search
  hide so you can still see the cards.

All the buttons and their names are the same, so nothing you already know moves.

## Saves
Save version unchanged (23).
