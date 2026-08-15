-- ─── Bid X · make the current account the admin ─────────────────────────
-- Admin is decided by matching users.telegram_id against the
-- platform_settings row `admin_telegram_id` (seeded as 7734124559).
-- Your username is NOT part of the check — only your numeric Telegram ID.
--
-- STEP 1 · DIAGNOSE — run this first and look at the two numbers.
--          If `my_telegram_id` ≠ `current_admin_id`, that's why you're not admin.
select
  u.id,
  u.username,
  u.first_name,
  u.telegram_id                              as my_telegram_id,
  (select value from public.platform_settings
    where key = 'admin_telegram_id')         as current_admin_id,
  case when u.auth_id is null then 'NOT LINKED (run link-accounts.sql first)'
       else 'linked ok' end                  as auth_link
from public.users u
where u.username = 'EUN_admin';

-- STEP 2 · FIX — point the admin setting at YOUR actual Telegram ID.
--          (This finds your row by the username you gave and copies its
--           telegram_id into the admin setting, so it always matches.)
update public.platform_settings
set value = (
  select telegram_id from public.users
  where username = 'EUN_admin' limit 1
)
where key = 'admin_telegram_id';

-- STEP 3 · VERIFY — both columns below must now show the SAME number.
select
  (select telegram_id from public.users where username = 'EUN_admin' limit 1) as my_telegram_id,
  (select value from public.platform_settings where key = 'admin_telegram_id') as admin_id,
  public.is_admin() as am_i_admin;
