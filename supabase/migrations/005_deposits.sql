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

-- admin-granted bonus (in Coins) paid together with the approved deposit
alter table public.deposits add column if not exists bonus_coins bigint not null default 0;

-- anti-cheat: one transaction ID can back exactly one deposit, across all users
create unique index if not exists deposits_proof_uniq
  on public.deposits ((lower(btrim(proof))));

alter table public.deposits enable row level security;
drop policy if exists "deposits_select_own" on public.deposits;
create policy "deposits_select_own" on public.deposits
  for select using (user_id = (public.me()).id or public.is_admin());
drop policy if exists "deposits_insert_own" on public.deposits;
create policy "deposits_insert_own" on public.deposits
  for insert with check (user_id = (public.me()).id);

-- ─── withdrawable ledger: deposited Coins spend, but never cash out ────────
-- `withdrawable` tracks the share of the balance that came from real earning
-- (ads, tasks, bids won, referrals, admin grants). Deposits raise `balance`
-- only, so they can power bids & promotions but can never be withdrawn.
alter table public.wallets add column if not exists withdrawable bigint not null default 0;

-- backfill existing users from their transaction history (earn minus withdrawn)
update public.wallets w set withdrawable = greatest(0, least(w.balance,
  coalesce((select sum(t.amount) from public.transactions t
            where t.user_id = w.user_id and t.amount > 0
              and t.type in ('ad_reward','task_reward','click_reward','bid_winnings',
                             'referral_bonus','referral_commission','admin_adjust')), 0)
  - coalesce((select sum(-t.amount) from public.transactions t
              where t.user_id = w.user_id and t.type = 'withdrawal'), 0)
));

-- rebuilt so every balance move keeps `withdrawable` honest
create or replace function public.adjust_balance(p_user uuid, p_delta bigint, p_type text, p_note text default '', p_ref uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
  v_new bigint;
  v_earn boolean := p_delta > 0 and p_type in ('ad_reward','task_reward','click_reward','bid_winnings',
                                               'referral_bonus','referral_commission','admin_adjust');
begin
  if p_delta = 0 then return 0; end if;
  select balance into v_balance from public.wallets where user_id = p_user for update;
  if not found then
    insert into public.wallets(user_id) values (p_user) on conflict (user_id) do nothing;
    v_balance := 0;
  end if;
  v_new := v_balance + p_delta;
  if v_new < 0 then raise exception 'Insufficient Coin balance'; end if;
  update public.wallets set
    balance      = v_new,
    -- earnings and withdrawals move the withdrawable pool; deposits/refunds/spend do not
    withdrawable = greatest(0, withdrawable
                     + case when v_earn then p_delta
                            when p_type = 'withdrawal' then p_delta
                            else 0 end),
    total_earned = total_earned + case when v_earn then p_delta else 0 end,
    today_earned = case when today_date <> current_date then 0 else today_earned end
                   + case when v_earn then p_delta else 0 end,
    today_date   = current_date
  where user_id = p_user;
  insert into public.transactions(user_id, type, amount, balance_after, note, ref_id)
  values (p_user, p_type, p_delta, v_new, p_note, p_ref);
  return v_new;
end $$;

-- withdrawals are now capped by the withdrawable pool
create or replace function public.request_withdrawal(p_coins bigint, p_address text, p_network text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users := public.me(); v_rate numeric; v_balance bigint; v_min bigint; v_wd bigint;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  v_min := (public.get_setting('min_withdrawal'))::bigint;
  v_rate := (public.get_setting('coin_usdt_rate'))::numeric;
  if p_coins < v_min then raise exception 'Minimum withdrawal is % Coins', v_min; end if;
  if p_coins > 100000000 then raise exception 'Amount too large'; end if;
  if length(trim(p_address)) < 8 then raise exception 'Enter a valid withdrawal address'; end if;
  select withdrawable into v_wd from public.wallets where user_id = u.id for update;
  if p_coins > coalesce(v_wd, 0) then
    raise exception 'Only earned Coins can be withdrawn — deposited Coins are for bids and promotions';
  end if;
  v_balance := public.adjust_balance(u.id, -p_coins, 'withdrawal',
    'Withdrawal to ' || coalesce(p_network, 'TRC20') || ' ••••' || right(trim(p_address), 4));
  insert into public.withdrawals(user_id, coins, usdt, rate, address, network, status)
  values (u.id, p_coins, round(p_coins * v_rate, 6), v_rate, trim(p_address), coalesce(nullif(p_network, ''), 'TRC20'), 'pending');
  perform public.notify_user(u.id, 'withdrawal', 'Withdrawal received',
    p_coins || ' Coins (' || round(p_coins * v_rate, 4) || ' USDT) is pending review.');
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

-- wallet payload now carries the withdrawable amount
create or replace function public.bootstrap() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users; w public.wallets;
begin
  u := public.me();
  if u.id is null then raise exception 'Account not found — reopen the app from Telegram'; end if;
  if u.status <> 'active' then raise exception 'Account is %', u.status; end if;
  select * into w from public.wallets where user_id = u.id;
  if not found then
    insert into public.wallets(user_id) values (u.id) on conflict (user_id) do nothing returning * into w;
  end if;
  return jsonb_build_object(
    'user', jsonb_build_object(
      'id', u.id, 'telegram_id', u.telegram_id, 'username', coalesce(u.username,''),
      'first_name', u.first_name, 'last_name', coalesce(u.last_name,''),
      'photo_url', u.photo_url, 'language', u.language, 'status', u.status,
      'is_admin', public.is_admin(), 'created_at', u.created_at),
    'wallet', jsonb_build_object(
      'balance', w.balance, 'withdrawable', coalesce(w.withdrawable, 0),
      'total_earned', w.total_earned,
      'today_earned', case when w.today_date = current_date then w.today_earned else 0 end),
    'settings', public.settings_json()
  );
end $$;

-- ─── new settings keys (admin fills in the real addresses) ─────────────────
insert into public.platform_settings(key, value) values
  ('deposit_bep20_address', ''),
  ('deposit_telebirr_number', ''),
  ('min_deposit', '100'),
  ('deposit_bonus_pct', '0')
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
    'deposit_bonus_pct', coalesce((public.get_setting('deposit_bonus_pct'))::int, 0),
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
  if p ? 'deposit_bonus_pct' and ((p->>'deposit_bonus_pct')::int < 0 or (p->>'deposit_bonus_pct')::int > 500) then
    raise exception 'Deposit bonus must be between 0 and 500 %%';
  end if;
  foreach k in array array['ad_reward','task_reward','click_price','click_reward','min_campaign_budget',
    'bid_amount','bid_timer_sec','winner_pct','platform_pct','coin_usdt_rate','min_withdrawal',
    'daily_ad_limit','maintenance_mode','admin_telegram_id',
    'min_deposit','deposit_bonus_pct','deposit_bep20_address','deposit_telebirr_number']
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
  v_bonus bigint; v_proof text := lower(btrim(coalesce(p_proof, '')));
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  v_min := coalesce((public.get_setting('min_deposit'))::bigint, 100);
  if p_coins < v_min then raise exception 'Minimum deposit is % Coins', v_min; end if;
  if p_coins > 10000000 then raise exception 'Amount too large — contact support'; end if;
  if length(v_proof) < 6 then raise exception 'Enter a valid payment reference (at least 6 characters)'; end if;

  -- anti-cheat: a transaction ID can back exactly one deposit, ever
  if exists (select 1 from public.deposits where lower(btrim(proof)) = v_proof) then
    raise exception 'This transaction ID was already used for another deposit';
  end if;

  if p_method = 'BEP20' then
    v_usdt := round(p_coins * (public.get_setting('coin_usdt_rate'))::numeric, 4);
  elsif p_method = 'Telebirr' then
    v_birr := round(p_coins * 0.2, 2); -- 1 USDT ≈ 180 Birr → 1 Coin ≈ 0.2 Birr
  else raise exception 'Unknown deposit method'; end if;

  -- bonus promised at submission time (admin-set %), paid only on approval
  v_bonus := round(p_coins * coalesce((public.get_setting('deposit_bonus_pct'))::numeric, 0) / 100.0)::bigint;

  begin
    insert into public.deposits(user_id, method, coins, amount_usdt, amount_birr, proof, bonus_coins)
    values (u.id, p_method, p_coins, v_usdt, v_birr, btrim(p_proof), v_bonus)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'This transaction ID was already used for another deposit';
  end;

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
    'bonus_coins', bonus_coins, 'amount_usdt', amount_usdt, 'amount_birr', amount_birr,
    'proof', proof, 'status', status, 'created_at', created_at)
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
      'bonus_coins', d.bonus_coins, 'amount_usdt', d.amount_usdt, 'amount_birr', d.amount_birr,
      'proof', d.proof, 'status', d.status, 'created_at', d.created_at,
      'user', jsonb_build_object('id', u.id, 'username', u.username, 'first_name', u.first_name))
    from public.deposits d join public.users u on u.id = d.user_id
    order by (d.status = 'pending') desc, d.created_at desc
    limit 300;
end $$;

create or replace function public.admin_set_deposit(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.deposits; v_reviewer uuid; v_bonus bigint; v_total bigint;
begin
  perform public.require_admin();
  v_reviewer := (public.me()).id;
  select * into d from public.deposits where id = p_id for update;
  if not found then raise exception 'Deposit not found'; end if;
  if d.status <> 'pending' then raise exception 'This deposit was already reviewed'; end if;

  if p_status = 'approved' then
    -- Coins are minted only after the payment is verified. The deposit type
    -- raises the balance but NOT the withdrawable pool — deposited Coins can
    -- power bids & promotions yet never cash out. Bonus pays with the deposit.
    v_bonus := coalesce(d.bonus_coins, 0);
    v_total := d.coins + v_bonus;
    perform public.adjust_balance(d.user_id, v_total, 'deposit',
      'Deposit via ' || d.method || case when v_bonus > 0 then ' (+' || v_bonus || ' bonus)' else '' end, d.id);
    update public.deposits set status = 'approved', reviewed_by = v_reviewer where id = p_id;
    perform public.notify_user(d.user_id, 'earn', 'Deposit approved',
      '+' || v_total || ' Coins added to your balance' ||
      case when v_bonus > 0 then ' (includes +' || v_bonus || ' bonus)' else '' end || '.');
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
