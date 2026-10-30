# v0.34.0 test results

Linux sandbox, Node 22, MariaDB 10.11, headless Chromium (software rendering). **No real phone or Windows PC was
used.** The "phone" is a phone-sized, touch-enabled Chromium window opening the game on this machine's network address
over plain http, which gives the same non-secure page a real phone gets on LAN.

## Unit, layout, build
| Command | Result |
|---|---|
| `npm run check` | **Pass** — 283 tests, 7/7 layout, build, build validation |
| `npm run test:all` | **Pass — 282/282**, 0 skipped (MySQL tests ran against MariaDB) |

### `tests/lan34.test.mjs`
- Which addresses count as local (home ranges, link-local, IPv6 local, IPv4-mapped) and which don't (public, carrier
  100.64/10, documentation ranges).
- Through a real gateway, connecting from this machine's network address as a LAN device: the game page and SPA fallback
  are served; hashed assets are gzip-compressed and cached long; `..` paths never reach files outside the build;
  **a gateway that doesn't count that address as local answers 403** to pages and to `/api` (what happens if the port is
  ever forwarded to the internet).
- Join code: `/api/session` tells LAN devices it's needed and the host computer it isn't; registering from a LAN device
  without the code or with a wrong one is refused; the right code works in any letter case; the host computer
  registers without a code; logging in never needs it.
- Origins: the LAN page address is accepted through the gateway; a foreign website's origin is refused; the account
  server on 127.0.0.1 still refuses LAN origins sent directly to it.
- Forging: a client can't fake the gateway's secret header or another address, either straight to the server or through
  the gateway, which replaces those headers.
- Rate limits per device: 30 bad logins lock out that phone only, and the host computer can still log in.
- The live WebSocket works through the gateway; a foreign origin can't open it. Cloud save uploads through the gateway.
- Without LAN mode nothing changes: LAN origins are refused, there's no join code, and `/api/health` reports `lan: false`.
- The `crypto.randomUUID` fallback returns valid, unique v4 IDs when the browser's version is missing.

## Browser end-to-end
| Suite | Result |
|---|---|
| `lan34.mjs` (new) | **14/14**. Checks: `npm run lan` prints the phone address and a join code; the account server isn't reachable from the network; the host PC isn't asked for a code; the phone page is plain http and non-secure; the phone shows a Join code field; a wrong code is refused with a clear message; with the right code the phone creates an account and reaches character creation; **the phone joins the live server**; PC and phone see each other in the city; online actions work on the plain-http page; **a message from the phone reaches the PC**; the phone's game saves to the account on the host; voice on the phone says it needs HTTPS; no page errors |
| `cloudsave33.mjs` | Pass, 14 |
| `entry.mjs` | Pass, 15 |
| `smoke.mjs` | Pass, 8 |
| `phone18.mjs` | Pass, 20 |

Found and fixed during this work: browsers turn off `crypto.randomUUID` on plain-http pages that aren't localhost.
Online actions and messaging use it, so without the new fallback a phone couldn't send anything.

The test browser is told not to use this sandbox's outbound web proxy (`--no-proxy-server`). A phone on your Wi-Fi
connects to your PC directly, so the test does the same.

## Not verified
- A real phone and a real Windows firewall prompt; Wi-Fi with client isolation (expected to block it; see the hotspot
  tip in UPDATE_34.md).
- Frame rate and touch feel on actual phone hardware.
