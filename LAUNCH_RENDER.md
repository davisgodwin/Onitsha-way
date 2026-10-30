# Launching Onitsha Way on Render (everything online)

On Render, one service runs the game, accounts, multiplayer, chat, voice, cloud saves and Paystack (test mode) for
business ads.

## 1. Push
Push this code to GitHub. Before you push, check that `server/paystack.local.json` is **not** in the repo; it's
listed in `.gitignore`.

## 2. Create the service
1. On render.com, sign in with GitHub, then **New + → Blueprint**, and pick your `onitsha-way` repo. Render reads
   `render.yaml`:
   - a Node web service on the Starter plan (about $7/month) in Frankfurt;
   - a 1 GB disk at `/var/data` for accounts and saves;
   - build `npm ci && npm run build`, start `npm start`.
2. When it asks for values, fill them in:
   - `PAYSTACK_SECRET_KEY`: your **sk_test_…** key (live keys are refused);
   - `PAYSTACK_PUBLIC_KEY`: your **pk_test_…** key;
   - `EXTRA_ORIGINS`: leave empty, unless you'll also open the game from another address (see step 4).
3. Click **Apply**. The first build takes about 5 minutes. Your game is then at
   `https://onitsha-way.onrender.com` (or the name Render gives it).

**Why not the free plan?** Free services sleep after 15 minutes, which drops everyone online, and they have no disk,
so every account and save would be wiped at each restart.

## 3. Paystack
In the Paystack dashboard (Test mode), go to Settings → API Keys & Webhooks and set:
- **Test Callback URL**: `https://YOUR-APP.onrender.com/`
- **Test Webhook URL**: `https://YOUR-APP.onrender.com/api/paystack/webhook`

## 4. Your own domain (optional)
In Render, go to the service → Settings → Custom Domains → add `play.yourdomain.com`, and follow the DNS steps it
shows. Then add `https://play.yourdomain.com` to `EXTRA_ORIGINS` and redeploy.

## 5. Vercel
Vercel can't run the account server, because it can't keep live connections open. Either delete the Vercel project,
or keep it as the offline-only version (it shows "Play now" and saves in the browser). To send Vercel visitors to
Render instead, replace `vercel.json` with:
```json
{ "redirects": [{ "source": "/(.*)", "destination": "https://YOUR-APP.onrender.com/$1", "permanent": false }] }
```

## Updating
Each `git push` redeploys. Accounts and saves stay on the disk. During a deploy, players are disconnected for under
a minute and reconnect by themselves.

## Backups
In Render, go to the service → Disks → Snapshots: Render takes daily snapshots. You can also download
`/var/data/world.json` from the service's Shell tab.

## What to know before inviting players
- **Paystack is in TEST mode**: test cards only, no real money. That was your choice for launch. Uploaded ads go
  live without review: there is no moderation queue yet.
- **Voice chat** uses a public STUN server. Players behind some mobile networks may still not hear each other; that
  needs a paid TURN server.
- **Passwords** can't be recovered yet (there's no email).
- **Online play is 18+** (checkbox at sign-up). Child characters stay offline.
- **Size**: the server is one process. It's fine for a launch with hundreds of players, not tens of thousands.
