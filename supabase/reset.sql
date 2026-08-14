-- ─── Bid X · clean slate ────────────────────────────────────────────────
-- Run this ONCE in the SQL Editor BEFORE 001_bidx.sql, and ONLY if an
-- earlier attempt (another AI / tool) already created tables or functions.
-- It removes only user-created objects — Supabase core (auth, storage,
-- realtime schemas) is untouched.
--
-- ⚠ This deletes data in the listed tables. Fine for a fresh project;
--   do NOT run it once real users exist.

-- 1 · Bid X tables (their RLS policies, triggers and indexes go with them)
drop table if exists
  public.bids,
  public.bid_rounds,
  public.campaign_clicks,
  public.campaigns,
  public.task_submissions,
  public.tasks,
  public.ad_completions,
  public.advertisements,
  public.withdrawals,
  public.transactions,
  public.wallets,
  public.users,
  public.notifications,
  public.admin_actions,
  public.platform_settings
cascade;

-- 2 · every user-defined function in schema public
--     (removes the previous attempt's RPCs so none can shadow mine)
do $$
declare f text;
begin
  for f in
    select p.oid::regprocedure::text
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  loop
    execute 'drop function if exists ' || f || ' cascade';
  end loop;
end $$;

-- 3 · verify — this should return ZERO rows (or only tables you
--     intentionally keep, which you'd drop manually):
select table_name from information_schema.tables
where table_schema = 'public';
