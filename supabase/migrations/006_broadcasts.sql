-- ────────────────────────────────────────────────────────────────────────────
-- Bid X · migration 006 — admin broadcast popups
--
-- A single active announcement slot. The admin sends an HTML message from the
-- Admin panel; every client polls `get_broadcast()` and shows it as a bottom
-- popup with a close button (dismissals are tracked client-side by id).
-- Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.broadcasts (
  id          uuid primary key default gen_random_uuid(),
  body        text not null,
  active      boolean not null default true,
  created_by  uuid references public.users(id),
  created_at  timestamptz not null default now()
);

alter table public.broadcasts enable row level security;
drop policy if exists "broadcasts_read_all" on public.broadcasts;
create policy "broadcasts_read_all" on public.broadcasts
  for select using (true);

-- latest active message (or null) — called by every client on boot + every 60s
create or replace function public.get_broadcast() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('id', id, 'body', body, 'created_at', created_at)
     from public.broadcasts where active
     order by created_at desc limit 1),
    null
  );
$$;

-- admin publishes a new popup (deactivates any previous one)
create or replace function public.admin_send_broadcast(p_html text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public.require_admin();
  if length(btrim(coalesce(p_html, ''))) = 0 then raise exception 'Write a message first'; end if;
  if length(p_html) > 5000 then raise exception 'Keep it under 5,000 characters'; end if;
  update public.broadcasts set active = false where active;
  insert into public.broadcasts(body, created_by)
  values (btrim(p_html), (public.me()).id)
  returning id into v_id;
  perform public.audit('broadcast_send', v_id::text);
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

-- admin removes the popup for everyone
create or replace function public.admin_clear_broadcast() returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.broadcasts set active = false where active;
  perform public.audit('broadcast_clear', '');
  return jsonb_build_object('ok', true);
end $$;

-- refresh the PostgREST schema cache so the new RPCs work immediately
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null; end $$;
