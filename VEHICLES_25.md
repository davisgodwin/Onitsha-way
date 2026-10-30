# v0.25.0 — Vehicle catalogue, six car stands and supplied transport occupants
> Historical v0.25 notes. v0.26 supersedes dealership stock, placement and glazing; see **CITY_FIXES_26.md**.

## Playing the update
- Use **Phone → Homes & cars → Browse homes & cars**, or open **Map → Find on map** and select a **Car stand**. Follow the marker to the sales desk; press **E** to browse.
- Each of the six off-road stands carries six different listings, covering all 36 requested vehicles. Choose a listing, inspect its price and fuel information, then confirm **Buy it**. Prices and handling values are fictional game values, not real-world prices or specifications.
- Your purchase appears in that stand's yellow-lined **COLLECTION** bay. Walk up, enter and drive away. Clear that bay before buying another vehicle: a blocked bay refuses payment without charging your wallet.
- Owned vehicles remain in your save. Fuel, collision damage, repairs, selling and map markers use the existing vehicle systems. You cannot take ownership of a traffic vehicle by entering it.
- Car stands are generated game businesses near the named districts, not claims about real dealerships at surveyed addresses.

## Six stands
| Stand | Inventory |
| --- | --- |
| Upper Iweka Auto Market | Toyota Corolla (2003–2019), Toyota Camry (2002–2011), Honda Accord (2003–2012), Toyota Avensis, Nissan Altima, Kia Rio |
| Old Market Family Motors | Toyota Highlander, Lexus RX 350, Toyota RAV4, Honda CR-V, Honda Pilot, Toyota Sienna |
| Bridgehead SUV & Utility | Toyota Land Cruiser Prado, Lexus GX 460, Range Rover Sport, Lamborghini Urus, Lexus LX 570, Toyota Hilux |
| Ochanja Executive Motors | Mercedes-Benz C-Class, Mercedes-Benz E-Class, Lexus ES 350, Lexus GS 350, BMW 5 Series, Hyundai Elantra |
| Mall Sports & City Motors | Mercedes-AMG GT, Porsche 911, Ford Mustang GT, Motorcycle, Keke Napep, Mitsubishi L300 |
| Fegge Commercial Motors | Toyota HiAce, Toyota Coaster Bus, Isuzu NPR Truck, Commercial Mini Bus, Commercial Passenger Bus, Mercedes-Benz Sprinter |

## Models and NPC ownership
- The supplied sedan/executive/SUV exterior meshes are the bases for stylised vehicle variants, with per-entry dimensions, roof/bonnet treatment, lights and grille details. The pickup adds an open load bed. Buses, vans, truck, keke and motorcycle use the existing game vehicle families and/or supplied wheel/body geometry.
- These are **stylised interpretations**, not licensed manufacturer replicas. No manufacturer badges or external photos are bundled. A listed year range denotes one representative game model, not a separate exact model for every year. Motorcycle and commercial-body detailing is deliberately lightweight.
- Traffic can use every catalogue model. Stable fictional NPC owner/model/paint records are saved under `world.npcVehicleOwners`; ambient journeys themselves remain temporary traffic simulation. Two owner records per model avoid assigning several simultaneous cars to the same owner.
- Public-transport and keke drivers/passengers now use seated versions of the **same supplied human bodies**, with the existing fitted clothing and hairstyles. The old block torso/sphere-head figures have been removed. Player seating still uses the canonical animated rig.
- Fleet occupants are posed and baked once, then instanced. No individual skeleton or animation mixer is allocated per transport rider. Occupants are hidden beyond the local detail range (55/80/105 m on Low/Medium/High); vehicles and their trips continue to run.
- Decorative cars scattered along road shoulders and through the city are removed. Purpose-built marked mall parking, dealership stock, player-owned parked vehicles and moving traffic remain. The no-taxi rule is retained.

## Existing saves
Legacy vehicle IDs (including the earlier generic cars and branded cars) remain supported; existing cars are not deleted. Old roadside sale IDs are not reused for unrelated catalogue vehicles. Keep the same account, browser profile and address when continuing.

1. Export a save backup and back up your own `server/data` folder. Stop the old server.
2. Extract this release into a fresh folder and copy your own `server/data` into it.
3. Run `npm ci`, then `npm run local`.
4. Continue your existing save. Do not clear browser storage or start over.

## Implementation and checks
- `src/data/VehicleCatalogue.js`: the 36 entries and six stock lists; shared game handling presets keep the bundle compact.
- `src/vehicles/VehicleVariants.js`: cached remodelled exteriors; the same geometry is reused by traffic and owned vehicles.
- `src/vehicles/Dealership.js`: physical forecourt, staff, stock and marked collection bay.
- `src/vehicles/VehicleSystem.js`: off-road plot selection and atomic purchase guards.
- `src/vehicles/SeatedOccupants.js`: supplied-body seated geometry and instanced fleet rendering.
- `npm run check`, `npm run test:vehicles`, and `npm run e2e:vehicles25`. Browser results are in `qa/v25/vehicles-audit.json`; visual-QA PNGs are omitted from the source archive.
- Browser tests exercise all 36 models and driver states, the six clear forecourts, an actual sales-desk purchase, mobile containment, saved-car Continue, persistent NPC garages and supplied occupant templates.

## Asset rights
The v0.24 provenance notes still apply. Five supplied packs contained CC0 notices (included in `public/models/v24/licenses`); building 3 and vehicle 2 had no included license notice and require rights confirmation before public redistribution. This release does not imply manufacturer endorsement.
