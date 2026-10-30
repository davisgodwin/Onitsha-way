# v0.18.0 — Release checks

## Automated checks

- Core game regression suite: 251 assertions passed.
- Production build and asset/map validation passed. Vite emits its normal advisory about the main bundle size; validation remains within its configured limit.
- Local multiplayer/social/advertising suite: 40 scenario checks, plus account-scope isolation and disabled-test-payment checks, passed.
- Account-response suite: 10 tests passed.
- Remembered-session suite: restart, expiry, cookie/token handling and logout passed.
- New mail suite: 29 scenario checks passed. Covers exact username lookup, private inbox scoping, request consent, read cursors, idempotent retries, inert text, offline delivery, server restart persistence, crew membership, block/decline and host-authorized visits.
- Phone/HUD browser suite: see qa/phone18-browser-results.json for the exact latest checks and errors. It uses a real browser client and a second authenticated WebSocket peer on an isolated local server. No user accounts or saves are used.

## Browser and visual scope

Headless Chromium with SwiftShader, desktop 1366×900 and mobile 390×844. Browser checks use the production build and real welcome/signup/character Start entry. They exercise private request acceptance, sending/read receipts, incoming-message draft preservation, HTML rendered as literal text, unread/search filters, current-crew group sending, real home invitations, history after reload, responsive HUD bounds and disabled sending on disconnection.

Phone home, inbox, incoming request, clean conversation, crew empty state, crew conversation, offline state, street HUD and indoor HUD were rendered and visually inspected individually. The mobile global voice dock overlap was corrected. Notification toasts no longer stretch across the viewport. Indoor capture uses live rendering after resize, rather than a cleared paused WebGL buffer. No account, billing or cloud hosting claims are inferred from screenshots.

Earlier QA files remain historical evidence for earlier builds, not new v0.18 runs. The complete two-renderer WebRTC/vehicle regression was not rerun for this phone-focused release; it remains covered by earlier-release results. Current server suites and new real-browser phone tests were rerun.

## Remaining limits

This is still a local prototype. No live payments, email recovery, public moderation, message attachments, recorded voice notes, money-transfer app or arbitrary persistent group creation. Crew membership is runtime-only. Character progress remains browser-local. Private message files on the server are not end-to-end encrypted. See PHONE_HUD_18.md before use or hosting.
