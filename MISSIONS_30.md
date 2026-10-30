# Onitsha Way v0.30.0 — Mission integration, stage one

## Scope

This is an update to the existing v0.29.1 game, not a new game or scene. It adds the mission foundation and **one playable mission: Find Your Friend**. The four remaining requested missions (Buy Food, Deliver a Package, Find a Job, Pay Your Rent) are not implemented in this stage. Existing daily trader jobs, careers, shops and housing remain available; they are not relabelled as completed mission work.

No new runtime dependency, asset, NPC identity, currency system or save store was introduced. The v0.29.1 road-facing billboards and working home appliances are retained.

## Install and launch safely

1. Export your current save from Settings before updating. Keep your browser profile, account and exact site address/port. Browser storage is origin-specific and account-scoped.
2. Stop the old development server. Back up the old project and **your own `server/data`**. Do not overwrite that folder with any release files, delete it, or clear browser storage.
3. Extract this full source into an updated project folder, retaining/copying your own `server/data` if you use the local account server.
4. Install Node.js 18 or newer. In the folder containing `package.json`, run:

```sh
npm ci
npm run dev
```

5. Open `http://localhost:5173` (or the same address you previously used), choose the same offline/account mode, then Continue. Keep the terminal open. The combined launcher starts the account server on 127.0.0.1:8787 and Vite together.

Do not launch by double-clicking `index.html`. For static hosting, run `npm run build` and publish `dist/`; existing account/social features still need their established server configuration. `npm run dev:client` is frontend-only. No real payments are involved.

Save schema 14 migrates to 15 without clearing existing jobs, wallet, purchases, rentals or character. Older builds cannot read schema 15: keep your exported pre-update save if you want to roll back. Private browser saves and server accounts are not bundled in this archive.

## Play Find Your Friend

1. Press **J**, use the existing Jobs menu entry, or open **Phone → Missions & Jobs → Open mission journal**.
2. Find **Find Your Friend — AVAILABLE**, then choose **Find contact to accept**. This follows the source on the existing map/route/beacon; it does not accept or complete the mission remotely. Explicitly following replaces a manual waypoint. Existing manual waypoints otherwise keep navigation priority.
3. Walk to the marked existing contact (a local workplace/service mentor). Approach within 2.4 metres. Press **E**, or tap the normal touch interaction control.
4. Choose **I am looking for my friend**, then **I will go and meet them**. Acceptance saves an ACTIVE record; no cash is paid.
5. Follow the updated marker to the named existing resident at their home gate. Names/locations are selected deterministically for each save and then retained. The journal shows their hours; the HUD warns if closed. Neighbours follow the existing daily/Sunday schedule; there is no mission deadline and no forced clock change. Return during visiting hours if needed.
6. Approach and interact with that resident. Choose **My guy, I don find you!**. The first objective advances only inside this actual conversation.
7. Read the welcome, then choose **Thank you, my friend. I am ready to settle in**. The second objective completes, the wallet receives **₦500 once**, the permanent receipt is stored, and mission guidance ends.
8. Reopen the journal to see **COMPLETED / 2 of 2**. Continue/reload must keep completion and must not pay again.

Simply arriving, opening the generic greeting, talking to someone else, or clicking a journal button does not finish the mission. The registered mission prompt temporarily takes precedence only inside the contact's 2.4 m talk radius; other workplace actions remain accessible from the surrounding interaction area. After the mission moves on/completes that override disappears.

## Architecture and changed files

| File | Focused change |
| --- | --- |
| `src/jobs/MissionDefinitions.js` (new) | Definition, fixed economy-appropriate reward, objective text, default state and stable binding to existing reachable residents. |
| `src/jobs/JobSystem.js` | One-off mission records alongside the existing repeatable jobs; lifecycle/progress validation and the sole mission reward operation via Economy.transact. Daily job slots are unchanged. |
| `src/jobs/MissionController.js` (new) | Thin city/dialogue adapter. Verifies current dialogue, actual active NPC, correct identity, range, schedule and city context. Tracks a runtime welcome-conversation session. Uses the existing interaction registry and navigation targets. |
| `src/core/Game.js` | Initialization, dialogue hooks, journal handlers, coherent mission/map priority and existing save calls. No player controller or world replacement. |
| `src/dialogue/Conversations.js` | Offer, welcome and outcome branches added to the existing conversation graph. Existing shop, directions and daily job responses are preserved. |
| `src/npc/NPCSystem.js` | A tracked resident is not randomly suppressed by ambient presence probability; opening hours still apply. Existing pooled NPC models are reused. |
| `src/save/SaveSystem.js` | Schema 15 migration/default under `jobs.missions` in the same account-scoped JSON snapshot. |
| `src/save/validateSave.js` | Validates record structure, bindings, statuses, timestamps, progress, tracking and completion/claimed consistency before import/load. Damaged records are rejected rather than reset to claimable. |
| `src/ui/UIManager.js`, `src/ui/styles.css` | Mission card in the existing responsive jobs modal: status, description, progress, offered reward, contact/hours and follow control. No remote claim button. |
| `src/phone/PhoneController.js`, `index.html` | Existing journal/phone labels and build label; no new parallel screen/control scheme. |
| `package.json`, `package-lock.json`, `public/sw.js` | v0.30.0, test scripts and service-worker cache version. Dependencies unchanged. |
| `tests/missions30.test.mjs` (new) | 13 mission, migration, receipt, wrong-context and storage-failure tests. |
| `release-tests/` (new) | Raw executed regression/build/validation reports; no player saves or accounts. |
| `tests/e2e/missions30.cjs` (new) | Local preview browser playthrough, existing E input/dialogue, save restore, mobile/touch journal, movement/camera checks and screenshots. |
| `README.md`, `START-HERE.txt`, `MISSIONS_30.md`, `MISSION_TEST_RESULTS_30.md` | Scope, safe upgrade, exact controls, results and remaining verification. |

### Persistence and reward safety

- Persistent state is under `jobs.missions`: version, records and tracked mission. Each record contains status, giver/target bindings, objective progress, accepted/completed time and durable rewardClaimed status.
- Reward amount comes from the definition, never a UI payload. A validated welcome dialogue is required; a current progress check, completed/claimed guard and a fixed wallet transaction key prevent replay.
- One-off completion receipts are **not** trimmed with the 400-entry daily job history or the wallet's bounded ledger/idempotency history.
- Wallet and mission receipt are written in one existing save JSON operation. If browser storage is blocked/full, the existing save warning is shown; current-session state remains coherent and cannot claim again. A later successful save persists both. Closing before that successful save can lose the unsaved session's reward **and** progress; export a backup and resolve storage problems. There is no separate partial wallet write.
- Persistence remains client-side, matching the existing single-player game. This is not server-authoritative anti-cheat: someone editing their own save/devtools can manipulate local state. The current backend handles accounts/social/ad features, not authoritative simulation; no mission credentials or new server endpoints are exposed.

## Next stages (not included)

- Buy Food: hook actual successful ShopSession purchase receipts, track the acquired item, then consume it with the correct requester. Generic inventory presence alone must not prove a mission purchase.
- Deliver a Package: use the existing bag/unique parcel and correct pickup/recipient checks with durable mission receipts.
- Find a Job: reuse real existing trader/career activity, not acceptance as completion; avoid adding a second reward on top of an existing job payout.
- Pay Your Rent: bind to an actual rental and due period, reuse existing wallet/housing payment path and sufficient-funds rules, no charge on load and no cash reward.

The stage-one adapter intentionally handles the introductory dialogue mission only. New objective types require their own real gameplay event integration and tests; simply adding a title to the definitions does not make them playable. There are no placeholder buttons for the other four missions.
