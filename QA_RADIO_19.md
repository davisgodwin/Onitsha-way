# v0.19.0 — Car radio verification

## Scope and evidence

The radio state machine has 25 deterministic Node tests for consent, remembered preferences, HTTPS endpoints, no on-foot requests, owned-vehicle entry/exit, single-source cleanup, station cycling, unavailable endpoints, autoplay refusal, late callbacks, buffering/timeout, stream end, visibility, offline/online, menu exit, volume bounds, global mute, voice ducking and destruction. See qa/v19-radio-unit-tests.txt.

All 16 final browser checks passed with no browser or recovered game-loop errors.

The real Chromium browser test uses an isolated temporary account server and actual account/character entry, purchases a vehicle through the existing game systems, and drives the real car-entry lifecycle. The Sapientia check requires an actual media playing event, browser readyState >= 2 and the expected stream source, not a mocked audio element. See qa/radio19-browser-results.json and qa/v19-radio-browser-tests.txt for the final exact checks and media state.

Udala/City are not claimed to have passed live browser playback. They returned HTTP 401 in direct probes. The browser station-failure test deliberately aborts a Zeno request to verify the error UI deterministically; that fixture is not evidence of a station outage or successful playback.

Voice ducking is tested using the existing transmit flags. No microphone is requested for radio. The full two-peer WebRTC regression was not rerun for this feature. Private chats, session/account handling and social/advertising logic are covered by their server regression suites.

## Builds and regressions

- Core regression suite: 251 assertions, production build and asset/map validation.
- Radio unit tests: 25.
- Retained multiplayer server suite: 40 scenario checks plus scope-isolation and disabled-test-payment tests.
- Mail server suite: 29 scenario checks.
- Account-response suite: 10 tests.
- Remembered-session suite: restart, expiry and logout.

Exact current logs are stored as qa/v19-*.txt. Older QA files are historical, not rerun v0.19 results.

## Visual checks

In-car first-use permission notice, live playback, failed-station retry, mobile live/error and landscape dashboard states were captured and individually inspected. Desktop: 1366×900; portrait: 390×844; landscape: 844×390. Driving controls and radio share one scrollable card above bottom navigation. In low-height landscape, scroll that card to reach lower radio controls.

Automated capture resumes rendering after viewport changes so the screenshot is not a cleared paused WebGL canvas. No production rendering pause is added by these tests. Initials/needs meters are hidden only while driving to avoid overlapping the larger control card.

## Not validated / not included

No iOS/Android physical-device audio verification, public-hosting readiness, rights clearance, always-on station guarantee, HLS/transcoding, shared passenger audio, recordings or offline radio. See CAR_RADIO_19.md. Browser autoplay and hardware-volume restrictions can vary by platform.
