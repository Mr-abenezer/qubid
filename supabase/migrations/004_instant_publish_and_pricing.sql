-- ─────────────────────────────────────────────────────────────────────────────
-- 004 — Instant publishing + click pricing
--
--  1) Campaigns go LIVE the moment they are created — there is no admin
--     approval gate. They appear on every user's Home screen immediately.
--  2) Click pricing: the advertiser pays `click_price` (7 Coins) per completed
--     view, the viewer earns `click_reward` (5 Coins). The difference stays
--     with the platform automatically — nothing extra to bookkeep.
--
-- Safe to run on a database that already has 001–003 applied.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── pricing: 7 charged per view, 5 paid to the viewer ─────────────────────
insert into public.platform_settings(key, value) values
  ('click_price', '7'), ('click_reward', '5')
on conflict (key) do update set value = excluded.value;

-- campaigns that are already waiting for approval go live right now
update public.campaigns set status = 'active' where status = 'pending';

-- ─── campaigns: publish instantly ───────────────────────────────────────────
create or replace function public.create_campaign(p_title text, p_description text, p_url text, p_image text, p_budget bigint, p_days int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users := public.me(); v_cpc int; v_balance bigint;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  if length(trim(p_title)) < 3 then raise exception 'Title is too short'; end if;
  if p_url !~ '^https?://' then raise exception 'Enter a valid https:// destination URL'; end if;
  v_cpc := (public.get_setting('click_price'))::int;
  if p_budget < (public.get_setting('min_campaign_budget'))::int then
    raise exception 'Minimum campaign budget is % Coins', public.get_setting('min_campaign_budget');
  end if;
  if p_budget > 100000 then raise exception 'Maximum campaign budget is 100,000 Coins'; end if;
  v_balance := public.adjust_balance(u.id, -p_budget, 'campaign_deposit', 'Campaign budget — ' || p_title);
  -- status is 'active' straight away: the ad is live on Home the second it is paid for
  insert into public.campaigns(user_id, title, description, url, image_url, budget, cpc, max_clicks, ends_at, status)
  values (u.id, p_title, p_description, p_url, nullif(p_image, ''), p_budget, v_cpc,
          floor(p_budget::numeric / v_cpc)::int, now() + (coalesce(p_days, 14) || ' days')::interval, 'active');
  perform public.notify_user(u.id, 'campaign', 'Campaign is live',
    '"' || p_title || '" is now showing on every user''s Home screen.');
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

-- ─── complete_ad: charge the campaign its cpc, pay the viewer click_reward ──
create or replace function public.complete_ad(p_id uuid, p_source text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u public.users := public.me();
  v_reward int; v_balance bigint; v_count int; v_daily int;
  c public.campaigns; a public.advertisements;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  if (public.get_setting('maintenance_mode'))::boolean and not public.is_admin() then
    raise exception 'Earning is paused (maintenance mode)';
  end if;
  select count(*) into v_daily from public.transactions
    where user_id = u.id and created_at >= current_date and type in ('ad_reward','click_reward');
  if v_daily >= (public.get_setting('daily_ad_limit'))::int then
    raise exception 'Daily ad limit reached — come back tomorrow';
  end if;

  if p_source = 'campaign' then
    select * into c from public.campaigns where id = p_id and status = 'active' for update;
    if not found then raise exception 'Campaign is no longer accepting clicks'; end if;
    if c.user_id = u.id then raise exception 'You can''t complete your own campaign'; end if;
    if c.ends_at is not null and c.ends_at <= now() then raise exception 'Campaign has ended'; end if;
    if c.spent + c.cpc > c.budget then raise exception 'Campaign budget exhausted'; end if;
    insert into public.campaign_clicks(campaign_id, user_id) values (p_id, u.id)
    on conflict (campaign_id, user_id) do nothing;
    if not found then raise exception 'You already completed this campaign'; end if;
    -- the advertiser is charged the full click price; the viewer earns click_reward
    update public.campaigns set clicks = clicks + 1, spent = spent + c.cpc,
      status = case when spent + c.cpc >= budget then 'completed' else status end
    where id = p_id;
    v_reward := (public.get_setting('click_reward'))::int;
    v_balance := public.adjust_balance(u.id, v_reward, 'click_reward', c.title, p_id);
  else
    select * into a from public.advertisements where id = p_id and status = 'active' for update;
    if not found then raise exception 'Ad unavailable'; end if;
    if a.ends_at is not null and a.ends_at <= now() then raise exception 'Ad has ended'; end if;
    insert into public.ad_completions(ad_id, user_id, count, last_at) values (p_id, u.id, 1, now())
    on conflict (ad_id, user_id) do update
      set count = public.ad_completions.count + 1, last_at = now()
      where public.ad_completions.count < a.per_user_limit
    returning count into v_count;
    if v_count is null then raise exception 'Completion limit reached for this ad'; end if;
    update public.advertisements set spent = spent + a.reward where id = p_id;
    v_balance := public.adjust_balance(u.id, a.reward, 'ad_reward', a.title, p_id);
    v_reward := a.reward;
  end if;

  perform public.notify_user(u.id, 'earn', 'Coins earned', '+' || v_reward || ' Coins — keep going!');
  return jsonb_build_object('ok', true, 'reward', v_reward, 'balance', v_balance);
end $$;

-- ─── admin: approve stays available for legacy rows but is idempotent ──────
create or replace function public.admin_campaign_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.campaigns; v_remaining bigint;
begin
  perform public.require_admin();
  select * into c from public.campaigns where id = p_id for update;
  if not found then raise exception 'Campaign not found'; end if;
  v_remaining := c.budget - c.spent;
  case p_action
    when 'approve' then
      -- campaigns publish themselves now; approve just (re)activates legacy rows
      if c.status not in ('pending', 'paused') then raise exception 'Campaign is already live'; end if;
      update public.campaigns set status = 'active' where id = p_id;
    when 'reject' then
      if v_remaining > 0 then perform public.adjust_balance(c.user_id, v_remaining, 'campaign_refund', 'Campaign rejected — ' || c.title, p_id); end if;
      update public.campaigns set status = 'rejected' where id = p_id;
    when 'pause' then update public.campaigns set status = 'paused' where id = p_id;
    when 'resume' then update public.campaigns set status = 'active' where id = p_id;
    when 'refund' then
      if v_remaining > 0 then perform public.adjust_balance(c.user_id, v_remaining, 'campaign_refund', 'Campaign refunded — ' || c.title, p_id); end if;
      update public.campaigns set status = 'refunded' where id = p_id;
    else raise exception 'Unknown action %', p_action;
  end case;
  perform public.notify_user(c.user_id, 'campaign', 'Campaign ' || p_action, 'Your campaign "' || c.title || '" was ' || p_action || 'd by an admin.');
  perform public.audit('campaign_' || p_action, p_id::text);
  return jsonb_build_object('ok', true);
end $$;

-- ─── owner-side campaign management (no admin needed) ──────────────────────
create or replace function public.owner_campaign_action(p_id uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.campaigns; v_remaining bigint; v_balance bigint;
begin
  -- owners only: the row lock also proves the caller owns the campaign
  select * into c from public.campaigns where id = p_id and user_id = (public.me()).id for update;
  if not found then raise exception 'Campaign not found'; end if;
  v_balance := (select balance from public.wallets where user_id = c.user_id);
  case p_action
    when 'pause' then
      if c.status <> 'active' then raise exception 'Only live campaigns can be paused'; end if;
      update public.campaigns set status = 'paused' where id = p_id;
    when 'resume' then
      if c.status <> 'paused' then raise exception 'Only paused campaigns can be resumed'; end if;
      if c.ends_at is not null and c.ends_at <= now() then raise exception 'This campaign already ended'; end if;
      update public.campaigns set status = 'active' where id = p_id;
    when 'delete' then
      -- unspent budget is refunded and the campaign disappears entirely
      v_remaining := c.budget - c.spent;
      if v_remaining > 0 then
        v_balance := public.adjust_balance(c.user_id, v_remaining, 'campaign_refund', 'Campaign deleted — ' || c.title, p_id);
      end if;
      delete from public.campaigns where id = p_id;
    else raise exception 'Unknown action %', p_action;
  end case;
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

create or replace function public.owner_set_campaign_budget(p_id uuid, p_budget bigint) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.campaigns; v_new bigint; v_delta bigint; v_balance bigint;
begin
  select * into c from public.campaigns where id = p_id and user_id = (public.me()).id for update;
  if not found then raise exception 'Campaign not found'; end if;
  if c.status in ('completed', 'rejected', 'refunded') then raise exception 'This campaign is finished'; end if;
  -- never below what is already spent, never above the 50k cap
  v_new := greatest(coalesce(p_budget, 0), c.spent, (public.get_setting('min_campaign_budget'))::int);
  if v_new > 100000 then raise exception 'Maximum campaign budget is 100,000 Coins'; end if;
  v_delta := v_new - c.budget;
  v_balance := (select balance from public.wallets where user_id = c.user_id);
  if v_delta <> 0 then
    -- positive delta reserves more Coins, negative delta refunds the difference
    v_balance := public.adjust_balance(c.user_id, -v_delta, 'campaign_deposit', 'Budget updated — ' || c.title, p_id);
  end if;
  update public.campaigns set
    budget = v_new,
    max_clicks = case when c.cpc > 0 then floor(v_new::numeric / c.cpc)::int else 0 end
  where id = p_id;
  return jsonb_build_object('ok', true, 'balance', v_balance, 'budget', v_new);
end $$;

-- ─── rewarded video slot (AdsGram) — no ad row, no uuid needed ─────────────
create or replace function public.watch_reward_ad() returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users := public.me(); v_daily int; v_reward int; v_balance bigint;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  if (public.get_setting('maintenance_mode'))::boolean and not public.is_admin() then
    raise exception 'Earning is paused (maintenance mode)';
  end if;
  select count(*) into v_daily from public.transactions
    where user_id = u.id and created_at >= current_date and type in ('ad_reward','click_reward');
  if v_daily >= (public.get_setting('daily_ad_limit'))::int then
    raise exception 'Daily ad limit reached — come back tomorrow';
  end if;
  v_reward := (public.get_setting('ad_reward'))::int;
  v_balance := public.adjust_balance(u.id, v_reward, 'ad_reward', 'Watch Ad reward');
  perform public.notify_user(u.id, 'earn', 'Coins earned', '+' || v_reward || ' Coins — keep going!');
  return jsonb_build_object('ok', true, 'reward', v_reward, 'balance', v_balance);
end $$;
