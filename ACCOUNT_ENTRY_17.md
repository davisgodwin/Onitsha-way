# v0.17.0 · Account-first player entry

## Player journey

**New player:** welcome → Create an account → display name, username, password,
18+ confirmation → character creator → enter city. Account registration runs
before the 3D city initializes. The new account receives its own browser-save
scope automatically. No phone menu, offline character, or manual copying required.
The character name is prefilled from the account display name, but remains editable.
Online characters offer young adult, adult and older adult, not child mode.

**Returning player:** valid remembered session → automatically continue saved
character. Without a valid session: welcome → Log in → continue saved character.
An account without a character save in this browser opens the character creator;
this also resumes onboarding if registration finished but character creation did not.

**In game:** Online city → Account shows the signed-in profile, connection status,
reconnect and Save and sign out. No registration form remains in that panel.
Signing out saves locally and returns to welcome. If server logout fails, an error
is shown rather than falsely claiming logout succeeded.

The authenticated main menu can still start a replacement life after confirmation,
change settings and show credits. Registration is not required again for a new life.

## Local persistence and limitations

- Accounts, password hashes, friendships and campaigns remain in server/data.
- Remembered sessions last up to 30 days, use an HttpOnly SameSite=Lax cookie,
  and survive a local-server restart. Only hashed session tokens are persisted.
- Unchecked Keep me logged in uses a browser-session cookie and a 12-hour server
  limit. Logout invalidates that specific session and deletes its cookie.
- Character progress is still browser-local, scoped to the authenticated account.
  It is NOT cloud/server character sync. Use the same browser profile and origin.
  Export important saves. Another device/browser will not see that progress.
- v0.16 account saves in the same origin/profile load automatically for that same
  account ID; retain your existing server/data when upgrading to preserve IDs.
- Original offline saves are not imported or overwritten. If one exists, welcome
  offers Open previous offline save as an explicit legacy path, separate from accounts.
- No email verification, password recovery, public moderation or production hardening.
  Do not reuse an important password or expose this prototype to the internet.
- Before hosting: move character state and economy to an authoritative server,
  configure HTTPS/secure cookies, session/device policies, recovery and moderation,
  and verified real-payment webhooks. Set COOKIE_SECURE=true only behind HTTPS.
- Ads remain local TEST payment simulations: ₦3,000 per seven-day slot.

## Reference: what was checked

The live public Lagos Life site (https://lagoslife.app/) was inspected: its landing
page offers Sign up / Log in before gameplay. Its dedicated account screen has
Create account / Log in modes; signup requests name, username, password, email,
birth date and an 18+ agreement. Login requests username/email and password.
No reference account was created; its authenticated post-signup screens were NOT
observed. Onitsha's character-creation sequence is our implementation of the
requested journey, not a claim about an unobserved reference screen.

This adapts the account-before-play pattern with original Onitsha Way branding.
It intentionally does not collect email or birth dates without implementing their
supporting workflows. It does not copy another game's legal agreements or recovery
links. The local build retains its ten-character password requirement.

## Developer checks

- npm run check: economy/save regression suite, production build and validation.
- npm run test:account: helpful handling of missing/malformed backend responses.
- npm run test:online: social consent, ad slots, expiry, accounts and save isolation.
- npm run test:entry: remembered cookie, server restart, token hashing, logout, expiry.
- npm run e2e:entry: welcome/signup/mobile, character handoff, saved return, logout/login.
- npm run e2e:online: updated two-player test uses the welcome/signup/creator journey.

Browser tests need Playwright and Chromium; PLAYWRIGHT_MODULE may specify a local
Playwright module path when it is not installed in this project. They use temporary
server data, never user accounts. ?quickstart remains a developer regression shortcut,
not the normal player journey and not a security boundary for this prototype.
