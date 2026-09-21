-- ────────────────────────────────────────────────────────────────────────────
-- Bid X · migration 007 — public proof-of-payouts feed
--
-- AdsGram (and users) need visible evidence that rewards are real. This adds:
--   · recent_payouts()   — live feed of approved withdrawals (payouts only)
--   · payouts_channel_url setting — optional public Telegram channel link
-- Idempotent — safe to re-run.
-- ────────────────────────────────────────────────────────────────────────────

insert into public.platform_settings(key, value) values ('payouts_channel_url', '')
on conflict (key) do nothing;

-- ─── the feed: every approved withdrawal (real money paid out) ─────────────
-- Payouts only — bid wins stay private. The displayed name is the user's
-- profile first name; usernames are never exposed. Withdrawal destinations
-- are masked to the last digits.
create or replace function public.recent_payouts(p_limit int default 25) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by (x->>'when') desc), '[]'::jsonb) from (
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
  ) t
  limit greatest(5, least(coalesce(p_limit, 25), 50));
$$;

grant execute on function public.recent_payouts(int) to authenticated;

-- ─── expose the channel setting to users ───────────────────────────────────
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
    'referral_bonus', coalesce((public.get_setting('referral_bonus'))::int, 30),
    'referral_commission', coalesce((public.get_setting('referral_commission'))::int, 5),
    'maintenance_mode', (public.get_setting('maintenance_mode'))::boolean,
    'admin_telegram_id', public.get_setting('admin_telegram_id'),
    'min_deposit', coalesce((public.get_setting('min_deposit'))::int, 100),
    'deposit_bonus_pct', coalesce((public.get_setting('deposit_bonus_pct'))::int, 0),
    'deposit_bep20_address', coalesce(public.get_setting('deposit_bep20_address'), ''),
    'deposit_telebirr_number', coalesce(public.get_setting('deposit_telebirr_number'), ''),
    'payouts_channel_url', coalesce(public.get_setting('payouts_channel_url'), '')
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
  if p ? 'referral_bonus' and (p->>'referral_bonus')::int < 0 then
    raise exception 'Referral bonus cannot be negative';
  end if;
  if p ? 'referral_commission' and (p->>'referral_commission')::int < 0 then
    raise exception 'Referral commission cannot be negative';
  end if;
  foreach k in array array['ad_reward','task_reward','click_price','click_reward','min_campaign_budget',
    'bid_amount','bid_timer_sec','winner_pct','platform_pct','coin_usdt_rate','min_withdrawal',
    'daily_ad_limit','maintenance_mode','admin_telegram_id',
    'referral_bonus','referral_commission',
    'min_deposit','deposit_bonus_pct','deposit_bep20_address','deposit_telebirr_number',
    'payouts_channel_url']
  loop
    if p ? k then
      insert into public.platform_settings(key, value) values (k, p->>k)
      on conflict (key) do update set value = excluded.value;
    end if;
  end loop;
  perform public.audit('settings_save', '', p);
  return jsonb_build_object('ok', true);
end $$;

-- refresh the PostgREST schema cache so the new RPC works immediately
do $$ begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then null; end $$;
