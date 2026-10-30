# v0.27.3 — Original loading splash and npm run dev

## Changes
- `npm run dev` now starts the existing combined launcher: account/multiplayer backend on 127.0.0.1:8787, then Vite on localhost:5173 after a matching readiness check.
- `npm run local` remains an optional compatibility alias. `npm run dev:client` is explicitly frontend-only.
- Signup/login are mounted directly inside the original `#screen-loading`, before its existing loading bar. The original warm radial background, Anambra kicker and stacked ONITSHA WAY logo are reused, not replaced by a separate welcome page.
- New visitors see signup immediately, with a Log in switch for returning players. Remembered sessions skip the form as before.
- After successful authentication the form is removed; the same splash displays real city-loading progress, then opens character creation or the saved character.
- The stalled-loading timeout no longer interrupts an account form. The loading bar now exposes its progress accessibly.
- In-app recovery guidance, startup tests, README and START-HERE now use npm run dev.
- No extra in-game Account app or phone redesign was added.

## Compatibility and limits
- Account endpoints, local account storage and account-scoped browser-save keys are unchanged. Keep your own server/data and browser storage on upgrade.
- The downloaded source deliberately excludes real account/player data, dependencies, logs and QA outputs.
- This remains a local prototype. This update does not add a production database, cloud saves, email verification, password recovery or real payment processing.
- The static phone preview's quickstart route bypasses authentication by design. Use the downloaded source at localhost:5173 to test the restored signup/loading flow.

## Verification
- 187 automated regression tests passed, including actual npm run dev startup, API proxy, package-version matching, occupied-port safety, session handling and skills regressions.
- 15 browser checks passed: signup inside the original splash before world construction, retained branding/background, account-character-city steps, checked Remember me, mobile overflow, password visibility, signup to character creation, automatic local-city connection, remembered-cookie return with preserved wallet/character, signout, wrong-password feedback, credential login and no browser/recovered frame errors.
- Desktop signup, mobile signup/login/error and the genuine city-loading screen were rendered and visually inspected. The signup form scrolls vertically on shorter screens.
- Production build and asset/size validation passed. Browser checks use headless Chromium/touch layout emulation, not physical-device performance measurements.

## Run
```bash
npm ci
npm run dev
```
Open http://localhost:5173 and keep the terminal open. Ctrl+C stops both services.
