-- ─────────────────────────────────────────────────────────────────────────────
-- Bid X · migration 002
--  1. Referral program: +referral_bonus when an invited friend joins,
--     +referral_commission on every task/ad/click the friend completes.
--  2. Escalating bids: a bid must be >= previous bid + 1 (starting bid at
--     round open, resets to the round's starting bid for every new round).
--  3. Withdrawals are USDT · BEP20 only (enforced client-side too).
--
-- NOTE: admin_save_settings() in 001 whitelists setting keys — extend its
-- key list with 'referral_bonus' and 'referral_commission' if you want the
-- admin panel to tune them (defaults below apply otherwise).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── referral settings ────────────────────────────────────────────────────────
insert into public.platform_settings(key, value) values
  ('referral_bonus', '30'),
  ('referral_commission', '5')
on conflict (key) do nothing;

-- ── new transaction types ────────────────────────────────────────────────────
alter table public.transactions drop constraint if exists transactions_type_check;
alter table public.transactions add constraint transactions_type_check check (type in (
  'ad_reward','click_reward','task_reward','bid_payment','bid_winnings','platform_fee',
  'campaign_deposit','campaign_spend','campaign_refund','withdrawal','withdrawal_refund',
  'admin_adjust','referral_bonus','referral_commission'
));

-- ── users: who invited whom ──────────────────────────────────────────────────
alter table public.users add column if not exists referred_by uuid references public.users(id);
create index if not exists users_referred_by_idx on public.users(referred_by);

-- Bonus the inviter the moment a referred account is created.
-- (telegram-login must set referred_by from the ?startapp=<telegram_id> param.)
create or replace function public.referral_join_bonus() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_bonus bigint;
begin
  if new.referred_by is null or new.referred_by = new.id then return new; end if;
  v_bonus := (public.get_setting('referral_bonus'))::bigint;
  if v_bonus > 0 then
    perform public.adjust_balance(new.referred_by, v_bonus, 'referral_bonus',
      'Referral bonus — @' || coalesce(new.username, 'friend') || ' joined with your link');
  end if;
  return new;
end $$;

drop trigger if exists users_referral_join on public.users;
create trigger users_referral_join after insert on public.users
for each row execute function public.referral_join_bonus();

-- Commission the inviter on every earning event of a referred user.
create or replace function public.referral_commission() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_commission bigint;
begin
  if new.type not in ('ad_reward','click_reward','task_reward') then return new; end if;
  select referred_by into v_ref from public.users where id = new.user_id;
  if v_ref is null then return new; end if;
  v_commission := (public.get_setting('referral_commission'))::bigint;
  if v_commission > 0 then
    perform public.adjust_balance(v_ref, v_commission, 'referral_commission',
      'Friend activity — ' || coalesce(new.note, 'task completed'));
  end if;
  return new;
end $$;

drop trigger if exists tx_referral_commission on public.transactions;
create trigger tx_referral_commission after insert on public.transactions
for each row execute function public.referral_commission();

-- ── referral stats for the Invite screen ─────────────────────────────────────
create or replace function public.referral_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users := public.me();
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  return (
    select jsonb_build_object(
      'code', u.telegram_id,
      'count', count(f.id),
      'earned', coalesce(sum(x.earned), 0),
      'referrals', coalesce(jsonb_agg(jsonb_build_object(
        'id', f.id,
        'user', jsonb_build_object('id', f.id, 'telegram_id', f.telegram_id,
                                   'username', f.username, 'first_name', f.first_name,
                                   'photo_url', f.photo_url),
        'joined_at', f.created_at,
        'completed', coalesce(x.completed, 0),
        'earned', coalesce(x.earned, 0)
      ) order by f.created_at desc) filter (where f.id is not null), '[]'::jsonb)
    )
    from (select 1) anchor
    left join lateral (select * from public.users where referred_by = u.id) f on true
    left join lateral (
      select count(*) filter (where t.type in ('ad_reward','click_reward','task_reward')) as completed,
             coalesce(sum(t.amount) filter (where t.type = 'referral_commission'), 0)
               + (public.get_setting('referral_bonus'))::bigint as earned
      from public.transactions t where t.user_id = f.id
    ) x on true
  );
end $$;
grant execute on function public.referral_stats() to authenticated;

-- ── escalating bids ──────────────────────────────────────────────────────────
-- Replaces place_bid(): every bid must beat the previous bid by >= 1 Coin.
-- A round's first bid opens at the round's starting bid (bid_amount), and each
-- new round starts from the configured starting bid again (10 by default).
drop function if exists public.place_bid();
create or replace function public.place_bid(p_amount bigint default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u public.users := public.me();
  r public.bid_rounds;
  v_prev uuid; v_balance bigint; v_last_amount bigint; v_min bigint; v_amount bigint;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  if u.status <> 'active' then raise exception 'Account is %', u.status; end if;
  if (public.get_setting('maintenance_mode'))::boolean and not public.is_admin() then
    raise exception 'Bidding is paused (maintenance mode)';
  end if;
  perform public.try_finalize_round();

  select * into r from public.bid_rounds where status = 'running' order by created_at desc limit 1 for update;
  if not found then r := public.new_round(); end if;

  if r.ends_at is not null and r.ends_at <= now() then
    raise exception 'Round just ended — the next round is starting';
  end if;

  select amount into v_last_amount from public.bids
    where round_id = r.id order by created_at desc, id desc limit 1;
  v_min := coalesce(v_last_amount + 1, r.bid_amount);
  v_amount := coalesce(p_amount, v_min);
  if v_amount < v_min then
    raise exception 'Your bid must be at least % Coins — always 1 above the last bidder', v_min;
  end if;

  v_balance := public.adjust_balance(u.id, -v_amount, 'bid_payment', 'Bid & Win round #' || r.number, r.id);
  insert into public.bids(round_id, user_id, amount) values (r.id, u.id, v_amount);

  v_prev := r.last_bidder;
  update public.bid_rounds set
    pool = pool + v_amount,
    bid_count = bid_count + 1,
    last_bidder = u.id,
    last_bid_at = now(),
    ends_at = now() + (r.timer_sec || ' seconds')::interval
  where id = r.id;

  if v_prev is not null and v_prev <> u.id then
    perform public.notify_user(v_prev, 'outbid', 'You were outbid!',
      'Someone took the lead in round #' || r.number || '. Strike back before the timer ends.');
  end if;
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;
grant execute on function public.place_bid(bigint) to authenticated;
