# v0.15.0 verification — Shoprite and cars

## Results

- 251 unit/rule regression checks passed, including 17 new shopping/car checks.
- Production build, source syntax and asset/map validation passed.
- 35 targeted Shoprite/car browser assertions passed.
- 16 direction-marker and map-navigation browser assertions passed on the final build.
- No browser page errors or recovered game-loop errors in the completed reports.

## Coverage

The shopping suite selects Shoprite in the public map directory, verifies the collision-free entrance and entrance waypoint, enters through the public interaction handler, and purchases through actual buttons. It checks grocery wallet/bag changes, clothing appearance and receipt changes, duplicate-purchase protection, appliance rental requirements and delivery, phone-screen overflow, and the TV rendering in the rented home.

All eight new car models were present in actual generated dealer slots. Each was bought through the buy menu, rendered with opening-door geometry, and entered in driver state with valid seats and player/camera coordinates. Save/Continue restored the shopping interior, groceries, clothing receipt, funds, all eight owned cars and the delivered TV. Pure unit checks additionally cover each model's price, fuel allocation, repair, duplicate ownership protection and save migration.

The navigation suite covers compass/destination arrows, mobile/desktop layout, map reopening, tracked-job navigation, and custom-marker priority. The Shoprite pin uses a shopping symbol, rather than a vehicle symbol. Mobile checkout and shopping-floor screenshots were inspected.

## Method and limits

Local headless Chromium, SwiftShader software rendering, desktop and 390 × 844 phone viewports. Test-only starting funds, home rental and teleport positioning are supplied by the browser fixture; no bonus money or forced new game ships to players. Test driving bypasses the door-animation delay to exercise driver-state initialization. This release was not road-tested on every physical phone or browser; a short checkout/driving regression is not a promise that every existing game feature is bug-free. Historical QA reports are retained but are not counted as new verification for v0.15.0.

During test development, the map directory initially omitted shopping/car categories; that real issue was corrected. The initial harness used exact button-name matching despite existing numbered keyboard shortcuts; selectors were corrected and the completed suite reran successfully.

Real brand/model names use simplified original procedural vehicle meshes, not exact licensed manufacturer replicas. Store assortment, opening hours, layout and prices are gameplay values, not live real-world retail data.

## Release

Source ZIP includes the tests and qa/v15 reports. Website ZIP has the built static site at its root, including the hidden .htaccess. Package version 0.15.0, save version 13; prior saves migrate. Export a backup before updating and use the same host address to retain browser storage. See START-HERE.txt and SHOPRITE_CARS_15.md.
