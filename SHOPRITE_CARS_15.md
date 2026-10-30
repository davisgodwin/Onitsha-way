# v0.15.0 — Shoprite shopping and branded cars

## Shoprite · Onitsha Mall

- Map → Find on map → Shopping → Shoprite points to a clear entrance on the existing mall forecourt, not the middle of the building.
- Walk to the entrance and press E / Use, then choose Enter Shoprite.
- The shopping floor has stocked aisles, clothing displays, appliances and a checkout. It is open 24 hours for gameplay; this is not a statement of the real store's opening hours.
- **Groceries and drinks:** 17 products use the existing catalogue, wallet and bag. Bread, water, malt and milk are usable from the bag. Raw ingredients, including rice and beans, work with the existing rented-home kitchen.
- **Clothing:** shop the 12 outfits for your character's gender, buy and immediately wear them. Receipts persist. Rewearing a purchased outfit is free; the pre-existing free wardrobe remains available and is not retroactively paywalled.
- **Appliances:** televisions, refrigerators, standing fans, speakers and inverter/battery units are delivered to a selected actively rented home. They use existing home equipment, placement and power rules, not unusable inventory souvenirs. No home means no appliance payment. Already-owned appliances cannot be charged again.
- Checkout checks money, bag capacity, ownership and store access before payment. Purchases save immediately.

The assortment, layout, prices, round-the-clock access and delivery are game features, not a live inventory, service or real-world booking with Shoprite.

## Eight additional cars

| Vehicle | Dealer | Game price |
| --- | --- | ---: |
| Mercedes-Benz C 300 | Upper Iweka car stand | ₦320,000 |
| Mercedes-AMG G 63 | Upper Iweka car stand | ₦950,000 |
| Lexus RX 350 | Upper Iweka car stand | ₦480,000 |
| BMW 330i | Old Market Road dealers | ₦330,000 |
| Lexus ES 350 | Old Market Road dealers | ₦350,000 |
| Toyota Camry | Old Market Road dealers | ₦210,000 |
| BMW X5 | Bridgehead tokunbo stand | ₦650,000 |
| Toyota RAV4 | Bridgehead tokunbo stand | ₦310,000 |

Map → Find on map → Cars for sale lists the actual available vehicles. Visit the pin, press E and buy. Vehicles are owned, rendered and driveable, with opening doors, seats, fuel, damage, repairs, resale and save/Continue support. Original generic vehicles remain available. Existing dealership slot IDs for earlier models are preserved.

Brand/model names identify the catalogue entries. The cars use original simplified procedural meshes with body/trim variations, not scanned exact manufacturer models or licensed badges. Names do not imply manufacturer affiliation. Prices and handling are game balance values, not real car quotations.

## Updating

Package version 0.15.0; save version 13. Older saves migrate without a new game or any money grant. Optional shopping receipts live with the same character save. Older builds should not load the new vehicle/receipt saves: export a backup before updating and keep it if you want to roll back.

Use the same host address to retain browser storage. Do not clear site data. Source users: extract into a new folder, stop the old server, run npm ci and npm run dev. Website users: upload the full built website, including assets, map data and hidden .htaccess. A new service-worker cache requests this release's assets.

Read QA_SHOPRITE_15.md for verification results and limits.
