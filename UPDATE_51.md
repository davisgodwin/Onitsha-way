# v0.51.0: pay for billboard ads with Paystack (test mode)

## What changed
In the phone's **Business ads** app, an ad order now has a **Pay ₦… with Paystack (test)** button instead of
"Simulate payment".

1. Create your flyer order as before. The billboard is held for you.
2. Type an email for the Paystack receipt and tap **Pay**.
3. Paystack's own payment window opens over the game. Pay with a Paystack **test card**; Paystack's docs list them.
   A common one is 4084 0840 8408 4081, any future expiry date, CVV 408.
4. When Paystack says the payment worked, the game server asks Paystack itself to confirm the payment, the amount
   in naira and the reference. Only then does the flyer go up on the billboard.

**If the popup can't open**, the Paystack payment page opens in a new tab instead. After paying, either come back to
the game (it checks the order by itself) or tap **I have paid — check**.

- **Holding the board**: starting a payment holds the billboard for 30 minutes.
- **If the board was taken meanwhile**, the flyer goes on another free board in the same area.
- **If the whole area is taken**, the order is marked *paid, not placed*. Refund it from your Paystack test
  dashboard.

## Setting it up
The keys stay on the server and the game in the browser only ever sees the public key.

- **The key file**: put the keys in `server/paystack.local.json` (template: `server/paystack.example.json`):
  ```json
  { "secretKey": "sk_test_...", "publicKey": "pk_test_..." }
  ```
- **Or environment variables**: set `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` instead.
- **Kept out of git and zips**: `server/paystack.local.json` is git-ignored and never goes into a zip.
- **Test keys only**: live keys (`sk_live_`, `pk_live_`) are refused, and the server says so when it starts.
- **Restart the server** after adding the keys. Its first lines say `Paystack: on (test keys)`.

**Webhook (optional).** The server also accepts Paystack's `charge.success` webhook at `/api/paystack/webhook`, and
checks Paystack's signature. Paystack can only reach it if the server has a public web address (for example through
a tunnel). Without it, everything still works through the popup and the "check" button.

**With no keys** the game falls back to the old "Simulate successful payment" button, as before. While test
payments are allowed on the server (`TEST_PAYMENTS` not set to `false`), that simulate action still exists on the
server even with Paystack on, so the older tests keep working. Before taking real money, set `TEST_PAYMENTS=false`
so a payment can only come from Paystack.

## Not done (needed before real money)
- Live keys are deliberately blocked.
- No refunds from inside the game.
- No moderation of the ads people upload.
- No receipts in the game; Paystack emails its own.
