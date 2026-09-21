-- ────────────────────────────────────────────────────────────────────────────
-- Bid X · migration 008 — public leaderboard + owner privacy
--
--   · top_earners()    — ranked list of the highest Coin balances.
--   · recent_payouts() — re-issued here with the same privacy rule.
--
-- Privacy rules (both functions):
--   · Only the profile FIRST NAME is returned — usernames are never read.
--   · The admin account (users.telegram_id = admin_telegram_id) is excluded
--     entirely, so the owner's balance and withdrawals never appear publicly.
-- Idempotent — safe to re-run (this version supersedes the earlier 008).
-- ────────────────────────────────────────────────────────────────────────────

create or replace function public.top_earners(p_limit int default 10) returns jsonb
language sql stable security definer set search_path = public as $$
  with me as (select (public.me()).id as id),
  ranked as (
    select coalesce(nullif(split_part(u.first_name, ' ', 1), ''), 'User') as name,
           w.balance as coins,
           (u.id = (select id from me)) as me,
           row_number() over (order by w.balance desc, u.created_at asc) as rank
    from public.wallets w
    join public.users u on u.id = w.user_id
    where u.status = 'active' and w.balance > 0
      -- owner/admin accounts stay off the public board
      and u.telegram_id is distinct from public.get_setting('admin_telegram_id')
    order by w.balance desc, u.created_at asc
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  select coalesce(jsonb_agg(
    jsonb_build_object('rank', rank, 'name', name, 'coins', coins, 'me', me)
    order by rank
  ), '[]'::jsonb)
  from ranked;
$$;

-- ─── payouts feed, re-issued with the owner excluded ───────────────────────
create or replace function public.recent_payouts(p_limit int default 25) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'when') desc), '[]'::jsonb) from (
    -- real money leaving the platform (USDT or Birr)
    select jsonb_build_object(
      'kind', 'withdrawal',
      'name', coalesce(nullif(split_part(u.first_name, ' ', 1), ''), 'User'),
      'amount', round(w.coins * (public.get_setting('coin_usdt_rate'))::numeric
               * case when w.network = 'Telebirr' then 180 else 1 end, 2),
      'unit', case when w.network = 'Telebirr' then 'Birr' else 'USDT' end,
      'detail', case when w.network = 'Telebirr'
                then 'Telebirr ••••' || right(trim(w.address), 2)
                else 'BEP20 ••••' || right(trim(w.address), 4) end,
      'when', w.created_at
    ) as x
    from public.withdrawals w join public.users u on u.id = w.user_id
    where w.status in ('approved', 'completed')
      -- owner/admin withdrawals are never shown as public proof
      and u.telegram_id is distinct from public.get_setting('admin_telegram_id')
  ) t
  limit greatest(5, least(coalesce(p_limit, 25), 50));
$$;

grant execute on function public.top_earners(int) to authenticated;
grant execute on function public.recent_payouts(int) to authenticated;

-- refresh the PostgREST schema cache so the changes work immediately
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null; end $$;
