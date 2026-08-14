# Bid X — Telegram Mini App

A production-ready earn-and-bid economy inside Telegram: watch ads, complete
tasks, run your own ad campaigns, play the realtime **Bid & Win** auction
game, and withdraw Coins to USDT — with a full admin panel.

> **Every Coin, bid, timer and payout is decided server-side** (Postgres
> `SECURITY DEFINER` RPCs + Edge Functions). The frontend can never write a
> balance, fake a completion, or settle a round.

---

## What's inside

| Layer | Location |
|---|---|
| Mini App frontend (React + Vite + Tailwind) | `src/` |
| Database schema, RLS, atomic RPCs, bid engine | `supabase/migrations/001_bidx.sql` |
| Telegram auth Edge Function (initData HMAC verify) | `supabase/functions/telegram-login/` |
| Cron worker (round settlement, Telegram notifications, campaign expiry) | `supabase/functions/housekeeping/` |
| Env template | `.env.example` |

## Economy defaults (all admin-configurable in `platform_settings`)

- 1 Coin = **0.0006 USDT** · ad reward **5** · task reward **5** · click price **5**
- Campaigns: **5 Coins/click**, min budget **50** (100 Coins ⇒ up to 20 clicks)
- Withdrawals: min **300 Coins** (= 0.18 USDT), statuses pending → approved → processing → completed (rejected/cancelled auto-refund via the ledger)
- Bid & Win: fixed bid **10 Coins**, **60s** server timer reset per bid, winner **85%** / platform **15%**

## Setup (you only do these 6 steps)

1. **Database** — open the Supabase SQL editor (project `iybyohxhueyzxuzqphjv`).
   If a previous attempt already created tables/functions, run
   `supabase/reset.sql` FIRST (it wipes only Bid X objects, safe on a fresh
   project). Then run `supabase/migrations/001_bidx.sql` in full — it creates
   all 14 tables, RLS, RPCs and demo content.
2. **Frontend env** — `.env` already contains your `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY` (public by design). Adjust `VITE_APP_URL` if the
   bot link changes.
3. **Edge Functions** (service-role key + bot token stay server-side).
   Both functions are **zero-dependency** — no CLI needed:

   a. Supabase Dashboard → **Edge Functions** → **New function** → name it
      `telegram-login` → replace the editor contents with
      `supabase/functions/telegram-login/index.ts` → **Deploy**.
   b. Repeat for `housekeeping` using
      `supabase/functions/housekeeping/index.ts`.
   c. **Edge Functions → Secrets** (applies to all functions) — add both:
      - `TELEGRAM_BOT_TOKEN` = your bot token (`8073660163:AAE...`)
      - `SERVICE_ROLE_KEY` = the **service_role** key from
        Project Settings → API (not the anon key). The name must NOT start
        with `SUPABASE_` — that prefix is reserved by Supabase.

   CLI alternative:
    ```bash
    supabase link --project-ref iybyohxhueyzxuzqphjv
    supabase secrets set TELEGRAM_BOT_TOKEN=***your-token***
    supabase secrets set SERVICE_ROLE_KEY=***your-service-role-key***
    supabase functions deploy telegram-login --no-verify-jwt
    supabase functions deploy housekeeping --no-verify-jwt
    ```4. **Host the app** — `npm run build`, deploy `dist/` anywhere static
   (Vercel, Netlify, Cloudflare Pages, Supabase storage…).
5. **Telegram bot** — with @BotFather: `/newapp` → pick
   `@BidX_SmartEarningsbot` → set the web app URL to your hosted `dist/`
   (your menu button already points at `https://t.me/BidX_SmartEarningsbot/Earn`).
6. **Cron** — hit `https://<ref>.supabase.co/functions/v1/housekeeping`
   every minute (GitHub Action cron or pg_cron + pg_net — snippets are in
   the function header). Rounds also self-settle on every `get_round()` /
   `place_bid()` call, so the game works even before cron is wired.

## How login works (zero registration)

1. Client reads `Telegram.WebApp.initData` (signed by Telegram).
2. `telegram-login` Edge Function verifies the HMAC-SHA256 signature with the
   bot token, rejects payloads older than 24h, and parses the user **from the
   signed payload — never from client fields**.
3. It upserts `users` (unique on `telegram_id`) + wallet, then returns a
   one-time `token_hash`; the client exchanges it via
   `supabase.auth.verifyOtp(magiclink)` for a normal Supabase session.
4. All RPCs resolve the caller with `auth.uid() → users` and check
   `is_admin()` against `platform_settings.admin_telegram_id` (`7734124559`).

## Security model

- **RLS**: users can only *read* their own wallet/transactions/withdrawals;
  economy tables have **no write policies at all** — mutations only via
  definer RPCs.
- **Atomicity**: `adjust_balance()` row-locks the wallet (`FOR UPDATE`),
  enforces `balance >= 0`, writes the ledger row in the same transaction.
- **Idempotency**: `ad_completions (ad_id, user_id)` unique + conditional
  upsert, `campaign_clicks (campaign_id, user_id)` unique,
  `task_submissions (task_id, user_id)` unique.
- **Bid safety**: `place_bid` locks the round row, re-checks the deadline,
  extends `ends_at` atomically. Settlement uses `FOR UPDATE SKIP LOCKED`, so
  two concurrent settlers can **never produce two winners**.
- **Rate limits**: daily ad/click limit per user; withdrawal min/max bounds;
  budget checks use conditional `UPDATE ... WHERE spent + cpc <= budget`.
- **Audit**: every admin RPC writes to `admin_actions`.
- **Secrets**: the service-role key and bot token exist only in Edge
  Function secrets. `.env.example` documents this boundary.

## Developer preview (browser testing)

The app refuses to run outside Telegram — that's the gate you'll see in a
plain browser. For development, open `?preview=1` (or click *Launch the
developer preview* on the gate): a local engine simulates Telegram +
Supabase (ads, tasks, live Bid & Win bots, withdrawals, full admin panel as
the admin account) and persists to `localStorage`. In preview, use *Profile →
Exit preview* to return to strict mode. Real authentication is unaffected —
the preview never touches production data.
