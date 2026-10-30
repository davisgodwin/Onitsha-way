> Historical v0.16 notes. v0.17 account-first entry and remembered-session behavior supersede registration/session instructions below. See ACCOUNT_ENTRY_17.md.

# v0.16.1 · Account connection/startup fix

The screenshot's “Unexpected end of JSON input” means the account fetch returned an empty/incomplete JSON body. We reproduced the exact failure when Vite was running but the account server was not reachable. That is a confirmed reproduction, not a diagnosis of the user's computer without its terminal output.

## Changes

- Empty, HTML, malformed and unexpected account responses now show actionable local-server guidance instead of raw JSON parser errors.
- Username/password validation errors from the server are preserved.
- Account requests have a timeout; passwords are never placed in diagnostics.
- `npm run local` starts the account server first, waits for the matching health response on 8787, then starts Vite. Failed services stop the combined launcher instead of leaving an apparently healthy frontend.

## Run

1. Stop the old Onitsha Way terminal with Ctrl+C.
2. Extract this source ZIP to a fresh folder. If any accounts already exist, privately copy the previous `server/data` folder into the new `server/data` location. Do not delete your browser's site data or saves.
3. In the folder containing package.json, run `npm ci`, then `npm run local`.
4. Wait for “Account server ready” and Vite's Local URL. Open http://localhost:5173 and keep the terminal open.
5. Accounts need both services. `npm run dev` alone runs only the game frontend.

For diagnostics, http://localhost:5173/api/health should return JSON with `ok: true` and version `0.16.1`. If startup still fails, share the terminal error after `npm run local` (not passwords). A port conflict, failed dependency installation or damaged local database needs its actual terminal error to diagnose safely.

## Verified

10 account-response tests; existing 40 server assertions/save-scope/payment-mode tests; 251 existing unit assertions; production build/asset validation. Also tested real registration through the frontend proxy after launching both services, and reproduced the backend-missing empty response to verify the new guidance. Earlier v0.16.0 multiplayer/UI and Shoprite/car browser results remain historical; the full browser suites were not rerun for this targeted patch.

All game features, seven-day ad slot rules and TEST-only payment boundaries remain unchanged.
