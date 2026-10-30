# v0.29.1 — Road-facing billboards and usable home appliances

## Billboard fixes

- All 200 billboard fronts now point straight toward their adjacent road. The face is parallel to that road segment; the old diagonal / approaching-traffic angle is removed. Signs on diagonal roads still follow the road, rather than the global map axes.
- Placement checks the complete sign and an extra clearance envelope against rendered building bounds, including rectangular pitched roofs and roof overhangs—not only the irregular ground-floor footprint.
- Reserved sign space remains protected while dealerships, venues and decorative housing are created. Garages also reject billboard space.
- Existing board IDs and bookings are retained; physical locations can move to safer roadside sites. There are still 50 boards in each of the four advertising areas.

## Home appliances

Buy and place appliances in **Buy mode**. Walk up to an installed item and use the interaction prompt / **E**. **Phone → My home** also lists installed item controls.

### Inverter and battery

- Interact directly to enable/disable automatic backup, inspect grid status, battery percentage and the current power source, or switch on home lights.
- A charged, installed inverter powers the home's ceiling bulbs and electrical appliances when grid power fails. Disabling backup or draining the battery stops those loads; returning grid power restores the normal supply and recharges the battery.
- An empty battery must charge first: **4 elapsed game hours from empty to full**, with up to **6 game hours of backup** from a full charge. Battery charging/draining follows the game's clock; the real-clock mode does not jump forward when a simulated activity is selected.
- Backup units share the existing home battery reserve; placing several does not multiply capacity. Stored / uninstalled units do not supply power.
- The small status light is amber while charging, green when charged backup is enabled, and red when disabled/empty.

### Other appliances

- **TV:** switch on/off; its screen visibly lights only when the set is switched on and electricity is available. Watch-TV activity is named explicitly.
- **Fan:** switch on/off; visible fan blades rotate while powered, and stop during an uncovered outage. Includes a cool-down activity.
- **Radio / speaker:** switch on/off, play the bundled original music and open playlist/volume controls. Music stops when power is lost and follows game volume/pause settings.
- **Washing machine:** start the wash-clothes activity with electricity available; washing restores hygiene. The activity is disabled without grid/backup supply.
- **Fridge:** access its existing home storage interaction; its menu reports cooling power availability. This does not introduce food-spoilage simulation.
- **Outdoor generator:** walk up to it for direct start/stop and refuel controls. Buy a **5 L fuel jerrycan**, keep it in your bag, then choose **Pour 5 L fuel**. It cannot start empty. Fuel consumption remains 1 L per 120 game minutes.
- Existing cooker, sink, bathroom, lamp, storage and furniture activities remain available. Appliance switch settings and battery reserves are saved with the home. Keeping an appliance switched on lets it resume when power returns.

## Safe upgrade

1. Export/back up your browser save and your own `server/data` folder. Do not clear browser storage.
2. Extract the full source into a fresh folder. Restore your own `server/data` into that project's `server` directory.
3. From the project folder, run `npm ci`, then `npm run dev`.
4. Keep the same browser profile, account and localhost address/port; hard-refresh and choose **Continue**. Look for **v0.29.1** in the loading footer.

No new character or save reset is required. All v0.29.0 features are included. Advertising payments remain test-only, not live money collection.

## Verification

The `qa/release291-*` files contain regression/build results and in-game checks. Placement tests cover all 200 billboard orientations, full clearance envelopes, stable IDs, roof overhangs and later venue construction. Power tests cover inverter charging, switching, depletion/recovery, saved appliance state and generator start restrictions. Chromium software-rendering checks are functional verification, not a performance guarantee for every device.

To repeat verification, use `node --test tests/*.test.mjs`, `npm run build`, and `npm run validate`. The optional `npm run e2e:roads-power291` check requires Playwright and a Chromium installation; set `CHROMIUM_PATH` if using a system Chromium. It writes captures/results under `.qa/roads-power291` and runs on loopback port 4291.
