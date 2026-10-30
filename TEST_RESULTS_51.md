# v0.51.0 test results

Linux sandbox, Node 22, headless Chromium, MariaDB 10.11.

**Not tested against the real Paystack.** The test machine can't reach api.paystack.co or js.paystack.co, so every
test below uses a fake Paystack that answers like the real API. The first real test is yours: with your test keys,
pay with a Paystack test card.

## Unit, server and integration tests
`node --test --test-concurrency=1 tests/*.test.mjs` with MariaDB: **414 tests: 414 pass, 0 fail.**

New: `tests/paystack51.test.mjs`
- **Keys**: test keys are accepted; live keys (`sk_live_`, `pk_live_`) are refused; with no key, Paystack is off.
- **Starting a payment**: the server asks Paystack for the exact amount in kobo (₦6,000 → 600,000), in NGN, with
  the email and a fresh reference.
- **Who can pay**: a bad email is refused, and another player can't pay into your order.
- **Not paid yet** and **underpaid** (the amount Paystack confirms is too small) both leave the order waiting.
- **Webhooks**: one with a bad signature is refused and changes nothing; a correctly signed `charge.success`
  activates the order (after the server checks with Paystack).
- **Paid**: the server checks with Paystack, then the flyer goes live and the payment is recorded.
- **Privacy**: other players never receive the payer's email or the access code.

## In the browser
`tests/e2e/paystack51.mjs`: **10 of 10.**
- **Server and keys**:
  - the server reports Paystack on, in test mode;
  - the game only ever receives the public key.
- **The ads app**:
  - it shows *Pay ₦6,000 with Paystack (test)*, the email box and the test-card hint;
  - there's no *simulate* button;
  - a bad email is stopped before anything is sent.
- **The payment page**: paying opens the Paystack page. The popup script can't load here, so this test covers the
  fall-back new tab, not the popup itself.
- **Checking**:
  - *I have paid — check* before paying leaves the order waiting;
  - after paying, it puts the flyer up;
  - coming back from the Paystack page checks the order by itself and tidies the address bar.
- No page errors.

Screenshots: `qa/v51/ads-pay-button.png`, `qa/v51/ads-paid.png`.

## Regressions
- **Passed**: `entry` 15/15 · `paystack51` 10/10.
- **`together44`** (two players on the real server) **is unreliable** in v0.51: 5 runs out of 9 passed (4 failed).
  - **Where it fails**: when the failures happen, the pickpocket step's server answer never arrives, so the result
    screen doesn't appear.
  - **What I found**: on the runs where server error logging was on (`OW_DEBUG=1`), the server logged no error for
    that step.
  - **What I changed**: the test now waits up to 20 s for the answer instead of 1.5 s.
  - **Cause**: not found. The only server change near it is that actions are now awaited (needed for the Paystack
    calls). The same test passed on v0.50.
  - Please try a pickpocket with two players before relying on it.
- **Not re-run for v0.51**: the v0.50 browser suites. The only code v0.51 touches is the online server and the ads
  app.
