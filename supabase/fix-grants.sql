-- ─── Bid X · permission fix ──────────────────────────────────────────────
-- Run ONCE in the SQL Editor if telegram-login returns 500 with
-- "User upsert failed" + code 42501 (permission denied).
-- It restores the standard Supabase role grants so the Edge Functions
-- (which run as service_role) can write users/wallets, while keeping the
-- RLS security model intact (frontend = anon/authenticated, read-only).

grant usage on schema public to anon, authenticated, service_role;

-- Edge Functions (service_role): full access — they are the trusted backend
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- App users (anon/authenticated): SELECT only. All economy mutations go
-- through SECURITY DEFINER RPCs, never direct table writes.
grant select on all tables in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;

-- Future-proof: objects created later by postgres get the same treatment
alter default privileges for role postgres in schema public
  grant all on tables to service_role;
alter default privileges for role postgres in schema public
  grant select on tables to anon, authenticated;
alter default privileges for role postgres in schema public
  grant all on sequences to service_role;
