-- ─── Bid X · make an account the admin ────────────────────────────────────
-- Admin = users.telegram_id matches platform_settings['admin_telegram_id'].
-- Username is NOT part of the check (and Telegram lowercases usernames, so
-- never filter by exact username — use the numeric telegram_id instead).
--
-- HOW TO USE: put the numeric Telegram ID of the admin account below
-- (visible in the app: avatar → Profile → Telegram ID), then Run.

-- 1 · set the admin id (no subqueries → can never hit the NOT NULL guard)
update public.platform_settings
set value = '7734124559'          -- ← the admin's numeric Telegram ID
where key = 'admin_telegram_id';

-- 2 · verify: every column below should look right
--    (run as-is in the SQL editor — do NOT rely on is_admin() here, the
--     editor has no auth session so it would always say false)
select
  u.username,
  u.first_name,
  u.telegram_id,
  (select value from public.platform_settings where key = 'admin_telegram_id') as admin_id,
  (u.telegram_id = (select value from public.platform_settings where key = 'admin_telegram_id')) as ids_match,
  case when u.auth_id is null then 'NOT LINKED — run link-accounts.sql' else 'linked ok' end as auth_link
from public.users u
where u.telegram_id = '7734124559';  -- ← same id as above

-- 3 · IF you see ids_match = true and auth_link = 'linked ok':
--    the database is 100% correct. Admin only refreshes at login, so
--    CLOSE the Mini App completely and reopen it from the bot.
