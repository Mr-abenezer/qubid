# Bid X — Telegram Mini App

A production-ready earn-and-bid economy inside Telegram: watch reward ads
(AdsGram-ready), complete **tasks published by other users in Promote**, run
your own ad campaigns, play the realtime **Bid & Win** auction game (every bid
must beat the last by 1+ Coins; ladder resets to 10 each round), grow through
the **referral program** (+30 per friend, +5 per task they complete), and
withdraw Coins to **USDT · BEP20** — with a full admin panel.

> **Every Coin, bid, timer and payout is decided server-side** (Postgres
> `SECURITY DEFINER` RPCs + Edge Functions). The frontend can never write a
> balance, fake a completion, or settle a round.

---

## What's inside

| Layer | Location |
|---|---|
| Mini App frontend (React + Vite + Tailwind) | `src/` |
| Database schema, RLS, atomic RPCs, bid engine | `supabase/migrations/001_bidx.sql` |
| Referral program + escalating-bid ladder | `supabase/migrations/002_referrals_and_escalating_bids.sql` |
| Telegram auth Edge Function (initData HMAC verify + referral capture) | `supabase/functions/telegram-login/` |
| Bot brain — answers /start, opens the mini app, forwards referral codes | `supabase/functions/telegram-bot/` |
| Cron worker (round settlement, notifications, campaign expiry) | `supabase/functions/housekeeping/` |
| Env template | `.env.example` |

## Economy defaults (all admin-configurable in `platform_settings`)

- 1 Coin = **0.0006 USDT** · ad reward **5** · task reward **5** · click price **5**
- Campaigns: **5 Coins/click**, min budget **50** — go live as tasks on every user's Home
- Withdrawals: **USDT · BEP20 only**, min **300 Coins** (≈ 0.18 USDT)
- Bid & Win: opens at **10 Coins**, each bid **≥ last bid + 1**, timer **60s** resets per bid, winner **85%** / platform **15%**, ladder resets to 10 each new round
- Referrals: **+30 Coins** per friend who joins · **+5 Coins** for every task/ad they complete (admin-tunable)

---

# How to publish

There are two tracks: **instant demo** (no backend) and **full production**.
Do the demo first — it takes 5 minutes and lets you click through everything
(exactly what a user sees, simulated locally).

## Track A — instant demo (no database, no bot config)

1. `npm install && npm run build`
2. Host the `dist/` folder on any static host —
   - **Vercel**: `npx vercel --prod` (or drag-and-drop at vercel.com/new)
   - **Netlify**: drag `dist/` onto app.netlify.com/drop
   - **Cloudflare Pages**: connect the repo, build `npm run build`, output `dist`
3. Open your URL with `?preview=1` (e.g. `https://your-app.vercel.app?preview=1`).

That's it. The preview simulates Telegram + Supabase locally: live Bid & Win
bots, campaigns, withdrawals, the admin panel (you are the admin), and the
referral feed. Use it to test flows or show investors. Real users never see it
— without `?preview=1` the app only runs inside Telegram.

## Track B — full production launch (7 steps)

### 1 · Database (Supabase, ~3 min)

Open the SQL editor of your Supabase project (`iybyohxhueyzxuzqphjv`) and run,
in order:

1. `supabase/migrations/001_bidx.sql` — all 14 tables, RLS, RPCs, demo content.
   *(If tables already exist from a previous attempt, run `supabase/reset.sql`
   first — it wipes only Bid X objects.)*
2. `supabase/migrations/002_referrals_and_escalating_bids.sql` — referral
   tables/triggers, `referral_stats()` RPC, and the escalating-bid
   `place_bid(p_amount)`. **Run it even if 001 was already applied** — it is
   idempotent (`create … if not exists` / `create or replace`).

### 2 · Frontend environment

In `.env` (or your host's env vars):

```bash
VITE_SUPABASE_URL=https://iybyohxhueyzxuzqphjv.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key>   # public by design
VITE_APP_URL=https://t.me/BidX_SmartEarningsbot/app
```

Then rebuild: `npm run build`.

### 3 · Edge Functions + secrets (stay server-side)

All three functions are zero-dependency — no CLI needed:

- Dashboard → **Edge Functions** → **New function** → `telegram-login` →
  paste `supabase/functions/telegram-login/index.ts` → Deploy.
- Repeat: `telegram-bot` ← `supabase/functions/telegram-bot/index.ts`.
  ⚠ Then open the function → **Settings → turn OFF "Verify JWT"**
  (Telegram calls it server-to-server). Optional secret `MINI_APP_URL` =
  your hosted app URL makes the /start button open the app instantly.
  Activate the webhook once — open in a browser:
  `https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<ref>.supabase.co/functions/v1/telegram-bot&allowed_updates=%5B%22message%22%5D`
- Repeat: `housekeeping` ← `supabase/functions/housekeeping/index.ts`.
- **Edge Functions → Secrets** (both):
  - `TELEGRAM_BOT_TOKEN` = your bot token (`8073660163:AAE...`)
  - `SERVICE_ROLE_KEY` = the **service_role** key (Project Settings → API).
    Name must NOT start with `SUPABASE_` (reserved).

CLI alternative:

```bash
supabase link --project-ref iybyohxhueyzxuzqphjv
supabase secrets set TELEGRAM_BOT_TOKEN=***your-token***
supabase secrets set SERVICE_ROLE_KEY=***your-service-role-key***
supabase functions deploy telegram-login --no-verify-jwt
supabase functions deploy housekeeping --no-verify-jwt
```

### 4 · Host the built app (HTTPS required)

Deploy `dist/` to Vercel / Netlify / Cloudflare Pages. Telegram only accepts
**HTTPS** URLs. Note the final URL — e.g. `https://bidx.vercel.app`.

### 5 · Wire the Telegram bot (@BotFather)

With your bot `@BidX_SmartEarningsbot`:

1. `/mybots` → **Bot Settings → Menu Button** → set the URL from step 4.
   (This is what opens the app inside the chat.)
2. `/newapp` → pick the bot → attach the same URL. Shareable as
   `t.me/BidX_SmartEarningsbot/app`.
3. **Referral links** need no extra setup: the Invite tab builds
   `https://t.me/BidX_SmartEarningsbot/app?startapp=<user_telegram_id>`.
   To auto-apply the inviter server-side, read
   `initDataUnsafe.start_param` in `telegram-login` and store it as
   `users.referred_by` on signup (migration 002 already has the column,
   trigger and bonus credit).

### 6 · Cron worker (round settlement + notifications)

Hit `https://<ref>.supabase.co/functions/v1/housekeeping` every minute —
GitHub Actions cron or pg_cron + pg_net (snippets in the function header).
Rounds also self-settle on every `get_round()`/`place_bid()` call, so the game
already works before cron is wired.

### 7 · Verify admin access

`platform_settings.admin_telegram_id` is `7734124559` — that Telegram account
gets the Admin Panel (Profile → Open Admin Panel). Change it in SQL if needed.

## Launch checklist

- [ ] Migrations 001 + 002 ran without errors
- [ ] Both Edge Functions deployed, secrets set, `telegram-login` returns a session
- [ ] `dist/` live on HTTPS, `.env` keys baked in
- [ ] Menu button + `/newapp` URL set in @BotFather
- [ ] Open the bot in Telegram → app loads, balance shows, one ad completes
- [ ] Place a bid → timer extends; wait it out → round settles, winner paid
- [ ] Wallet → request a BEP20 withdrawal → appears in Admin → approve it
- [ ] Invite tab → copy link, open in a second Telegram account → +30 credited
- [ ] Housekeeping cron returns 200 every minute
- [ ] AdsGram: when ready, drop your block ID into the Watch-Ad card
      (`Home.tsx` marks the integration point) and enable `completeAd`
      on the AdsGram `onReward` callback

## How login works (zero registration)

1. Client reads `Telegram.WebApp.initData` (signed by Telegram).
2. `telegram-login` verifies the HMAC-SHA256 signature with the bot token,
   rejects payloads older than 24h, and parses the user **from the signed
   payload — never from client fields**.
3. It upserts `users` (unique on `telegram_id`) + wallet, then returns a
   one-time `token_hash`; the client exchanges it via
   `supabase.auth.verifyOtp(magiclink)` for a normal Supabase session.
4. All RPCs resolve the caller with `auth.uid() → users` and check
   `is_admin()` against `platform_settings.admin_telegram_id`.

## Security model

- **RLS**: users can only *read* their own wallet/transactions/withdrawals;
  economy tables have **no write policies at all** — mutations only via
  definer RPCs.
- **Atomicity**: `adjust_balance()` row-locks the wallet (`FOR UPDATE`),
  enforces `balance >= 0`, writes the ledger row in the same transaction.
- **Idempotency**: `ad_completions (ad_id, user_id)` unique + conditional
  upsert, `campaign_clicks (campaign_id, user_id)` unique,
  `task_submissions (task_id, user_id)` unique.
- **Bid safety**: `place_bid(p_amount)` locks the round row, rejects any bid
  below `last.amount + 1`, re-checks the deadline, extends `ends_at`
  atomically. Settlement uses `FOR UPDATE SKIP LOCKED`, so two concurrent
  settlers can **never produce two winners**.
- **Referrals**: the bonus is granted by a DB trigger on `users` insert —
  never by the client — and a unique partial index blocks double crediting.
- **Rate limits**: daily ad/click limit per user; withdrawal min/max bounds;
  budget checks use conditional `UPDATE ... WHERE spent + cpc <= budget`.
- **Audit**: every admin RPC writes to `admin_actions`.
- **Secrets**: the service-role key and bot token exist only in Edge
  Function secrets. `.env.example` documents this boundary.

## Developer preview (browser testing)

The app refuses to run outside Telegram — that's the gate you'll see in a
plain browser. For development, open `?preview=1` (or click *Launch the
developer preview* on the gate): a local engine simulates Telegram +
Supabase (ads, community tasks, live Bid & Win bots with escalating bids,
BEP20 withdrawals, referral commissions, full admin panel as the admin
account) and persists to `localStorage`. In preview, use *Profile →
Exit preview* to return to strict mode. The preview never touches
production data.
