# v0.19.1 — Minimize the car radio

The radio now has a **− Minimize radio** button next to its power control.

- Minimize folds tuning, volume and help details into a compact station/status bar.
- Playback continues unchanged. Folding the panel does not replace the audio element, reconnect to the stream or change station/volume.
- The compact bar keeps the current station, real playback status, power and **↗ Expand radio** control visible.
- Expand restores all controls. The last expanded/minimized choice is remembered in this browser's device settings.
- Vehicle speed, fuel, Get out, horn and handbrake remain available. This minimizes the radio controls, not the whole driving dashboard.
- Before the first Enable live radio choice, the compact power control expands the panel instead of silently granting stream consent.

Run `npm ci`, then `npm run local`; open http://localhost:5173. Stop the old terminal first. Retain your own server/data folder and the same browser/URL when upgrading. See CAR_RADIO_19.md for station availability, external data use and local-only limitations.

## Verification

The browser regression suite additionally checks compact/expanded controls, the same active media element across minimize/expand, mobile status/power availability and the remembered view after reload. See qa/radio191-browser-results.json and qa/v19.1-radio-browser-tests.txt for exact final results. Radio engine logic is unchanged; its 25 deterministic tests and the core regression/build checks were rerun. Earlier server test reports remain historical v0.19 evidence, not new v0.19.1 runs.

Final result: 20 browser checks, 25 radio unit tests and 251 core assertions passed; production build/validation passed. Expanded desktop and compact desktop/mobile/landscape views were visually inspected with no radio-control overlap.
