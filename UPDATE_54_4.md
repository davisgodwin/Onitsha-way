# v0.54.4: faster loading, less memory held by street dressing

## Loading time
The slowest parts of loading were profiled. Four of them now do the same checks with much less work. They give the
same answers, so the city is laid out exactly as before:
- **Road checks** (is this plot on a road?) look roads up by number instead of building text keys, and stop
  allocating a new list for every check.
- **River checks** (is this point in the water?) only test the edges of the river near that point.
- **Wall checks** (is this spot free?) no longer build a set for every check.
- **Stadium and billboard sites** skip water and flyovers that are clearly far away.

Measured on the test machine (2 CPUs, software graphics), loading the full city:

| | v0.54.3 | v0.54.4 |
|---|---|---|
| Total load (s) | 58.7 | 48.4 |
| "Roads…" step (s) | 11.0 | 6.0 |

A check after loading compared the two versions: 389 homes and listings at the same places, the same number of walls
(615,160 edges, 148,820 shapes) and the same filling stations and services. Saves are unaffected.

## Street dressing near you only
Road-side strips and street lamps are now built in 400 m squares around the player, one square per frame, and
dropped when you are far away. Lamp posts still block you everywhere as before. Memory held by the graphics card's
copies went from 196 MB to 168 MB.

## Still to know (iPhone 8)
The iPhone 8 has 2 GB of memory, and Safari gives a page much less than that. After loading, the game still uses
roughly 285 MB of script memory plus about 170 MB of shapes and textures. Most of that is the whole city's
collision map and layout, which is needed to place the homes the same way every time. An iPhone 8 may therefore still
reload. The next step for very old phones would be a "lite city" that loads only part of Onitsha, which needs care so
homes and saves stay the same.
