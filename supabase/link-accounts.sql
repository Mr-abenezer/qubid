-- ─── Bid X · one-time repair ─────────────────────────────────────────────
-- Links existing Bid X accounts to their Supabase auth identities.
-- Needed only for accounts created before the telegram-login fix that
-- writes users.auth_id on every login. Safe to run multiple times.
--
-- The login email format is:  <telegram_id>@bidx.telegram

update public.users u
set auth_id = a.id
from auth.users a
where a.email = u.telegram_id || '@bidx.telegram'
  and u.auth_id is distinct from a.id;

-- verify: every account should now show a non-null auth_id
select u.telegram_id, u.username, u.auth_id is not null as linked, a.email
from public.users u
left join auth.users a on a.id = u.auth_id
order by u.created_at desc;
