# v0.54.3: sharp graphics on phones, much less memory (iPhone reloads), club built on first visit

## Phones looked blurry
The low setting, which phones start on, drew at one pixel per screen point with no edge smoothing. When the frame
rate dipped, the resolution also dropped by up to half. Now:
- the low setting draws up to 1.75 pixels per screen point, with smooth edges;
- it never drops below one pixel per screen point;
- building fronts use the sharper texture;
- phones are no longer forced onto the low setting.

## iPhone loaded, then started loading again
That is Safari running out of memory and reloading the page. On the iPhone, the graphics chip shares the phone's
memory. Measured after loading:

| | before | now |
|---|---|---|
| Vertex copies kept after upload (MB) | 335 | 196 |
| Peak while loading (MB) | about 750 | about 620 |

- **Market stalls are built when you come near**: market blocks get their shapes within about 200 m of you and drop
  them when you go far away. Their walls are still set up at load, and the stalls don't change.
- **Vertex copies are dropped**: the big static parts of the city (blocks, roads, props, bus stops, signs…) drop
  their in-memory copy once it's on the graphics card. Shared models are kept.
- **The nightclub is built the first time someone goes into a club**, not at startup (about 22 MB and some loading
  time).

## Still to know
The game still uses roughly 470 MB once loaded. An older iPhone with 2–3 GB of memory may still reload. The next
step would be to build all of the city's dressing (not just market stalls) only around the player, and to store the
collision map more compactly. That's a bigger change.
