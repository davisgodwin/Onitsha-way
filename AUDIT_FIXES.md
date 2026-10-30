# v0.14.1 — game audit and repairs

Export a save before replacing the previous build. No new game is required. Use the same site address to retain browser storage, or import an exported save on a new address.

## Confirmed problems fixed

- **Repeated repairs:** a second repair with the same damage and odometer reading could be rejected as an already-processed transaction. Services now have a saved sequence; a fixed car still cannot be charged again.
- **Fuel cans:** pouring a 5 L can into only 3 L of available tank space consumed the whole can. The action now requires room for all 5 L, with matching UI and backend checks.
- **Market errands:** requests could choose a catalogue category with no actual trader. New errands choose an open supplier, respect supplier/client closing times and point the player to the seller before returning them to the client once the item is owned.
- **Menu shortcuts:** closing a map or overlay could leave a queued shortcut and immediately reopen the map or pause the game. State changes clear stale input. Map dismissal now consumes a queued keypress so a short M/Esc tap is not missed between rendered frames.
- **Touch controls:** opening a menu, switching away or losing pointer capture could leave movement/run active. The joystick, look pointer and run toggle now reset appropriately.
- **Damaged save data:** malformed inventory, wallet, jobs, vehicles and other structural fields could be accepted and then crash Continue or a menu. Validation now rejects the tested malformed structures before replacing a working save. Failed imports preserve both current save and backup.
- **Older vehicles:** absent optional odometer, fuel and heading fields now receive safe defaults. No fuel or money is granted by this repair.
- **Home equipment:** incomplete upgrade records no longer crash power updates.
- **Age restriction:** betting is rejected by the service backend for child characters, not merely hidden in the phone UI.
- **Real-clock HUD:** minute/date changes refresh on the next frame even when low rendering speed caps simulation time. The paused clock display no longer waits for several capped frames to catch up.
- **Pause button:** replaced font-dependent pause symbols with two high-contrast CSS bars so the icon cannot disappear on a device missing the glyph.
- **Club camera:** entry initializes the indoor follow camera immediately instead of interpolating from an exterior position through walls.

## Player-facing place cleanup

Removed repeated “fictional”, “game venue” and similar labels from HUD location text, map names, workplace/service descriptions, story-office screens, phone listings and story messages. Removed the non-playable venue research list from the phone. The direction marker is retained.

**Destinations were not deleted.** Metadav ICT Hub, hotels, filling stations, offices, clubs and career workplaces remain usable so their jobs and saved progress do not break. Deleting locations is a separate change requiring confirmation of which ones to remove.

Source/placement notes remain in documentation and internal data. Removing a display label does not verify an address or make an interior, service, fee or character a real-world representation. Approximate entrances remain identified; no real hotel booking, fuel purchase, agency payment or betting is performed.

## Compatibility and scope

Package version: 0.14.1. Save version remains 12; repair sequence is optional and defaults to zero for older saves. A new service-worker cache name requests the updated assets. Do not clear site data to update.

The audit combines source review, unit/rule tests, build validation and local Chromium browser regressions. See QA_AUDIT_14_1.md for the final run results. Browser tests use software rendering and test-only fixtures for money, equipment, skill levels, controlled weather/time and selected positions; those fixtures do not grant resources in normal play.

This is a confirmed-defect repair patch, not a guarantee that every possible device, route or save combination is bug-free. Career jobs remain travel-and-decision gameplay, not a live coding editor or camera-file capture system.
