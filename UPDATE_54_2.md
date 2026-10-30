# v0.54.2: iPhones load; much quicker loading on phones

## iPhone: "Object.groupBy is not a function"
The new error message on the loading screen showed the cause: the game used `Object.groupBy`, which Safari only has
from iOS 17.4. The game now brings its own copy of it, and of a few other newer functions: `Map.groupBy`,
`findLast`, `toSorted`, `Promise.withResolvers` and `structuredClone`.

## Loading was slow, worst on phones
Profiling the loading screen found two things that wasted most of the time:
- **Removing an object from the collision map** looked through every wall in the city, about 100,000 edges, each
  time. It now looks only at that object's own walls. With 651 kiosks removed at entrances, plus the other
  clean-ups, this alone cost about 25 seconds on a fast computer.
- **"Is this spot on a saved home's front path?"** checked every saved home's path each time. It now checks only the
  paths nearby. The checks for parks and venues during the new rows of houses also check only the nearby ones.

On a fast computer, "Houses to let and cars for sale" went from 51 s to about 24 s, split into steps. The answers are
exactly the same: the tests that compare the city (homes, rows, walls, the old map against the new) pass unchanged.

## You can see it moving
The long step is now split into named steps on the loading screen:
- Jobs, careers and shops
- Houses on the empty land
- Signs at the edge of Onitsha
- Filling stations, hotels, schools and churches
- Houses in rows on every street
- Compound gates
- Drawing the map

The page also gets a moment to breathe between steps, so the browser doesn't call it frozen.

## Still to know
An old phone such as the Galaxy S8 is several times slower than a computer. Loading the whole city there can still
take a few minutes. Making that much faster needs the city to be prepared in advance instead of built on each
phone, which is a bigger job.
