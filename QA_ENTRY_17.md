# v0.17 account-entry QA

Verified against the production build, with temporary local test accounts only.

- 251 economy/progression/save assertions pass.
- Production build and asset/map validation pass (bundle-size advisory remains).
- 10 account-response cases pass, including empty proxy responses and timeouts.
- Existing local-server suite passes: 40 multiplayer/social/ad scenarios, independent
  account browser-save scopes and TEST_PAYMENTS=false activation rejection.
- Remembered-session test passes: cookie attributes, no plaintext tokens on disk,
  unauthenticated rejection, restoration after server restart, logout and expiry.
- 14 browser entry checks pass: pre-world welcome, signup sequence, remember-me,
  390px layout, show-password, automatic character creation handoff, adult-only
  choices, city connection, profile-only Account tab, saved remembered return,
  signout, wrong-password retry and credential login restoring the character.
- 3 additional UI failure checks pass: submit is disabled while pending; empty
  HTTP 500 shows useful local-start guidance instead of a JSON parser error;
  signup stays outside the world and remains retryable.
- Desktop welcome/signup/creator and 390px welcome/signup/login/failure screenshots
  inspected individually; mobile forms scroll vertically without horizontal clipping.

See qa/entry-*.json and qa/entry-*.txt for saved outcomes. The ordinary journey was
verified without ?quickstart. The in-world city and prior milestone graphics remain
local-prototype quality; this patch primarily changes onboarding.

- Updated two-player browser regression: all 21 checks pass with zero browser errors.
  This includes real WebRTC/hold-V, home visits/revocation, actual car passenger
  movement, co-op, billboard checkout/display and phone-width panel layout.
  The passenger test now polls for replicated state instead of assuming a fixed
  one-second software-rendering deadline. No passenger gameplay code was changed.
