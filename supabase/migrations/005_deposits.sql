-- ────────────────────────────────────────────────────────────────────────────
-- Bid X · migration 005 — manual deposits (USDT BEP20 + Telebirr)
--
-- Flow: user picks a method and an amount of Coins, sends USDT to the admin
-- wallet (or Birr to the admin Telebirr number), submits the payment proof.
-- An admin reviews it in the Admin panel; approving credits the Coins
-- server-side, rejecting closes the request. Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

create table if not exists public.deposits (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users(id),
  method       text not null check (method in ('BEP20', 'Telebirr')),
  coins        bigint not null check (coins > 0),
  amount_usdt  numeric(18, 4),
  amount_birr  numeric(18, 2),
  proof        text not null,
  status       text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  uuid references public.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

do $$ begin
  create trigger deposits_updated before update on public.deposits
  for each row execute function public.handle_updated_at();
exception when duplicate_object then null; end $$;

alter table public.deposits enable row level security;
drop policy if exists "deposits_select_own" on public.deposits;
create policy "deposits_select_own" on public.deposits
  for select using (user_id = (public.me()).id or public.is_admin());
drop policy if exists "deposits_insert_own" on public.deposits;
create policy "deposits_insert_own" on public.deposits
  for insert with check (user_id = (public.me()).id);

-- ─── new settings keys (admin fills in the real addresses) ─────────────────
insert into public.platform_settings(key, value) values
  ('deposit_bep20_address', ''),
  ('deposit_telebirr_number', ''),
  ('min_deposit', '100')
on conflict (key) do nothing;

-- settings_json + admin_save_settings rebuilt to carry the new keys
create or replace function public.settings_json() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ad_reward', (public.get_setting('ad_reward'))::int,
    'task_reward', (public.get_setting('task_reward'))::int,
    'click_price', (public.get_setting('click_price'))::int,
    'click_reward', (public.get_setting('click_reward'))::int,
    'min_campaign_budget', (public.get_setting('min_campaign_budget'))::int,
    'bid_amount', (public.get_setting('bid_amount'))::int,
    'bid_timer_sec', (public.get_setting('bid_timer_sec'))::int,
    'winner_pct', (public.get_setting('winner_pct'))::int,
    'platform_pct', (public.get_setting('platform_pct'))::int,
    'coin_usdt_rate', (public.get_setting('coin_usdt_rate'))::float8,
    'min_withdrawal', (public.get_setting('min_withdrawal'))::int,
    'daily_ad_limit', (public.get_setting('daily_ad_limit'))::int,
    'maintenance_mode', (public.get_setting('maintenance_mode'))::boolean,
    'admin_telegram_id', public.get_setting('admin_telegram_id'),
    'min_deposit', coalesce((public.get_setting('min_deposit'))::int, 100),
    'deposit_bep20_address', coalesce(public.get_setting('deposit_bep20_address'), ''),
    'deposit_telebirr_number', coalesce(public.get_setting('deposit_telebirr_number'), '')
  );
$$;

create or replace function public.admin_save_settings(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  perform public.require_admin();
  if p ? 'winner_pct' and p ? 'platform_pct' and ((p->>'winner_pct')::int + (p->>'platform_pct')::int) <> 100 then
    raise exception 'Winner %% + platform %% must total 100';
  end if;
  if p ? 'coin_usdt_rate' and (p->>'coin_usdt_rate')::float8 <= 0 then
    raise exception 'Coin rate must be positive';
  end if;
  foreach k in array array['ad_reward','task_reward','click_price','click_reward','min_campaign_budget',
    'bid_amount','bid_timer_sec','winner_pct','platform_pct','coin_usdt_rate','min_withdrawal',
    'daily_ad_limit','maintenance_mode','admin_telegram_id',
    'min_deposit','deposit_bep20_address','deposit_telebirr_number']
  loop
    if p ? k then
      insert into public.platform_settings(key, value) values (k, p->>k)
      on conflict (key) do update set value = excluded.value;
    end if;
  end loop;
  perform public.audit('settings_save', '', p);
  return jsonb_build_object('ok', true);
end $$;

-- ─── user side ──────────────────────────────────────────────────────────────
create or replace function public.request_deposit(p_method text, p_coins bigint, p_proof text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users := public.me(); v_min bigint; v_usdt numeric; v_birr numeric; v_id uuid; v_admin uuid;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  v_min := coalesce((public.get_setting('min_deposit'))::bigint, 100);
  if p_coins < v_min then raise exception 'Minimum deposit is % Coins', v_min; end if;
  if p_coins > 10000000 then raise exception 'Amount too large — contact support'; end if;
  if length(btrim(coalesce(p_proof, ''))) < 6 then raise exception 'Enter a valid payment reference (at least 6 characters)'; end if;

  if p_method = 'BEP20' then
    v_usdt := round(p_coins * (public.get_setting('coin_usdt_rate'))::numeric, 4);
  elsif p_method = 'Telebirr' then
    v_birr := round(p_coins * 0.2, 2); -- 1 USDT ≈ 180 Birr → 1 Coin ≈ 0.2 Birr
  else raise exception 'Unknown deposit method'; end if;

  insert into public.deposits(user_id, method, coins, amount_usdt, amount_birr, proof)
  values (u.id, p_method, p_coins, v_usdt, v_birr, btrim(p_proof))
  returning id into v_id;

  select id into v_admin from public.users where is_admin = true order by created_at limit 1;
  if v_admin is not null then
    perform public.notify_user(v_admin, 'withdrawal', 'New deposit request',
      coalesce(u.first_name, 'A user') || ' wants to top up ' || p_coins || ' Coins via ' || p_method || '.');
  end if;
  perform public.audit('deposit_request', v_id::text, jsonb_build_object('coins', p_coins, 'method', p_method));
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.list_my_deposits() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'user_id', user_id, 'method', method, 'coins', coins,
    'amount_usdt', amount_usdt, 'amount_birr', amount_birr, 'proof', proof,
    'status', status, 'created_at', created_at)
  from public.deposits where user_id = (public.me()).id
  order by created_at desc limit 100;
$$;

-- ─── admin side ─────────────────────────────────────────────────────────────
create or replace function public.admin_deposits() returns setof jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return query
    select jsonb_build_object('id', d.id, 'user_id', d.user_id, 'method', d.method, 'coins', d.coins,
      'amount_usdt', d.amount_usdt, 'amount_birr', d.amount_birr, 'proof', d.proof,
      'status', d.status, 'created_at', d.created_at,
      'user', jsonb_build_object('id', u.id, 'username', u.username, 'first_name', u.first_name))
    from public.deposits d join public.users u on u.id = d.user_id
    order by (d.status = 'pending') desc, d.created_at desc
    limit 300;
end $$;

create or replace function public.admin_set_deposit(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.deposits; v_reviewer uuid;
begin
  perform public.require_admin();
  v_reviewer := (public.me()).id;
  select * into d from public.deposits where id = p_id for update;
  if not found then raise exception 'Deposit not found'; end if;
  if d.status <> 'pending' then raise exception 'This deposit was already reviewed'; end if;

  if p_status = 'approved' then
    -- Coins are minted to the user only after the payment is verified
    perform public.adjust_balance(d.user_id, d.coins, 'deposit', 'Deposit via ' || d.method);
    update public.deposits set status = 'approved', reviewed_by = v_reviewer where id = p_id;
    perform public.notify_user(d.user_id, 'earn', 'Deposit approved', '+' || d.coins || ' Coins added to your balance.');
  elsif p_status = 'rejected' then
    update public.deposits set status = 'rejected', reviewed_by = v_reviewer where id = p_id;
    perform public.notify_user(d.user_id, 'withdrawal', 'Deposit rejected',
      'Your ' || d.method || ' deposit could not be verified. Contact support if you already paid.');
  else raise exception 'Unknown deposit status'; end if;

  perform public.audit('deposit_' || p_status, p_id::text, jsonb_build_object('coins', d.coins, 'method', d.method));
  return jsonb_build_object('ok', true);
end $$;

-- refresh the PostgREST schema cache so the new RPCs work immediately
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null; end $$;
