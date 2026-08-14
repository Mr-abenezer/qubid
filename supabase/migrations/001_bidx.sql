-- ═══════════════════════════════════════════════════════════════════════
-- BID X — complete schema, RLS and server-authoritative game/economy logic
-- Run this file in the Supabase SQL editor (or `supabase db push`).
-- ALL coin movements, bids, timers and results are decided HERE — the
-- frontend can only call the SECURITY DEFINER RPCs below.
-- ═══════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ─── tables ───────────────────────────────────────────────────────────────
create table if not exists public.users (
  id          uuid primary key default gen_random_uuid(),
  auth_id     uuid unique,
  telegram_id text unique not null,
  username    text,
  first_name  text default '',
  last_name   text,
  photo_url   text,
  language    text,
  status      text not null default 'active' check (status in ('active','banned','suspended')),
  created_at  timestamptz not null default now()
);

create table if not exists public.wallets (
  user_id      uuid primary key references public.users(id) on delete cascade,
  balance      bigint not null default 0 check (balance >= 0),
  total_earned bigint not null default 0,
  today_earned bigint not null default 0,
  today_date   date not null default current_date
);

create table if not exists public.transactions (
  id            bigserial primary key,
  user_id       uuid not null references public.users(id) on delete cascade,
  type          text not null check (type in ('ad_reward','click_reward','task_reward','bid_payment','bid_winnings','platform_fee','campaign_deposit','campaign_spend','campaign_refund','withdrawal','withdrawal_refund','admin_adjust')),
  amount        bigint not null,
  balance_after bigint,
  ref_id        uuid,
  note          text default '',
  created_at    timestamptz not null default now()
);
create index if not exists tx_user_time on public.transactions(user_id, created_at desc);

create table if not exists public.advertisements (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  description      text default '',
  image_url        text,
  url              text,
  reward           int not null default 5 check (reward >= 0),
  required_seconds int not null default 10,
  per_user_limit   int not null default 1,
  total_budget     bigint,
  spent            bigint not null default 0,
  starts_at        timestamptz,
  ends_at          timestamptz,
  status           text not null default 'active' check (status in ('active','paused','deleted')),
  created_at       timestamptz not null default now()
);

create table if not exists public.ad_completions (
  ad_id    uuid not null references public.advertisements(id) on delete cascade,
  user_id  uuid not null references public.users(id) on delete cascade,
  count    int not null default 0,
  last_at  timestamptz default now(),
  primary key (ad_id, user_id)
);

create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text default '',
  instructions text default '',
  link         text,
  reward       int not null default 5 check (reward >= 0),
  requires_proof boolean not null default false,
  deadline     timestamptz,
  status       text not null default 'active' check (status in ('active','paused','deleted')),
  created_at   timestamptz not null default now()
);

create table if not exists public.task_submissions (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks(id) on delete cascade,
  user_id    uuid not null references public.users(id) on delete cascade,
  proof      text default '',
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  unique (task_id, user_id)
);

create table if not exists public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  title       text not null,
  description text default '',
  image_url   text,
  url         text not null,
  budget      bigint not null check (budget > 0),
  cpc         int not null check (cpc > 0),
  clicks      int not null default 0,
  max_clicks  int not null default 0,
  spent       bigint not null default 0,
  starts_at   timestamptz default now(),
  ends_at     timestamptz,
  status      text not null default 'pending' check (status in ('pending','active','paused','completed','rejected','refunded')),
  created_at  timestamptz not null default now()
);

create table if not exists public.campaign_clicks (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id     uuid not null references public.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (campaign_id, user_id)
);

create table if not exists public.bid_rounds (
  id           uuid primary key default gen_random_uuid(),
  number       serial,
  bid_amount   int not null check (bid_amount > 0),
  timer_sec    int not null check (timer_sec >= 5),
  winner_pct   int not null check (winner_pct between 1 and 100),
  platform_pct int not null check (platform_pct between 0 and 99),
  pool         bigint not null default 0,
  bid_count    int not null default 0,
  last_bidder  uuid references public.users(id),
  last_bid_at  timestamptz,
  starts_at    timestamptz not null default now(),
  ends_at      timestamptz,
  status       text not null default 'running' check (status in ('running','completed','cancelled')),
  winner       uuid references public.users(id),
  payout       bigint,
  created_at   timestamptz not null default now()
);

create table if not exists public.bids (
  id        bigserial primary key,
  round_id  uuid not null references public.bid_rounds(id) on delete cascade,
  user_id   uuid not null references public.users(id) on delete cascade,
  amount    int not null,
  placed_at timestamptz not null default now()
);
create index if not exists bids_round_time on public.bids(round_id, placed_at desc, id desc);

create table if not exists public.withdrawals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  coins      bigint not null check (coins > 0),
  usdt       numeric(18,6) not null,
  rate       numeric(18,8) not null,
  address    text not null,
  network    text not null default 'TRC20',
  status     text not null default 'pending' check (status in ('pending','approved','processing','completed','rejected','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id         bigserial primary key,
  user_id    uuid not null references public.users(id) on delete cascade,
  kind       text not null default 'info',
  title      text not null default '',
  body       text not null default '',
  sent       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notif_queue on public.notifications(sent, created_at) where sent = false;

create table if not exists public.admin_actions (
  id         bigserial primary key,
  admin_id   uuid,
  action     text not null,
  target     text default '',
  details    jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.platform_settings (
  key   text primary key,
  value text not null
);

create or replace function public.handle_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists withdrawals_updated on public.withdrawals;
create trigger withdrawals_updated before update on public.withdrawals for each row execute function public.handle_updated_at();

-- ─── settings seed ────────────────────────────────────────────────────────
insert into public.platform_settings(key, value) values
  ('ad_reward','5'), ('task_reward','5'), ('click_price','5'), ('click_reward','5'),
  ('min_campaign_budget','50'), ('bid_amount','10'), ('bid_timer_sec','60'),
  ('winner_pct','85'), ('platform_pct','15'), ('coin_usdt_rate','0.0006'),
  ('min_withdrawal','300'), ('daily_ad_limit','20'), ('maintenance_mode','false'),
  ('admin_telegram_id','7734124559')
on conflict (key) do nothing;

-- ─── demo content (safe to delete) ────────────────────────────────────────
insert into public.advertisements(title, description, url, reward, required_seconds, per_user_limit)
select 'SolanaStake — Earn 7% APY','Stake SOL with non-custodial security. Instant rewards, zero lock-up for flexible pools.','https://example.com/solanastake',5,8,2
where not exists (select 1 from public.advertisements);
insert into public.advertisements(title, description, url, reward, required_seconds, per_user_limit)
select 'CryptoSignals Pro — Free week','Institutional-grade signals for spot and futures. Try the VIP room free for 7 days.','https://example.com/signals',5,10,1
where not exists (select 1 from public.advertisements where title like 'CryptoSignals%');
insert into public.tasks(title, description, instructions, link, reward, requires_proof)
select 'Join the Bid X channel','Stay in the loop with rounds, payouts and new campaigns.','Open the link and press Join, then submit.','https://t.me/BidX_SmartEarningsbot',5,false
where not exists (select 1 from public.tasks);
insert into public.tasks(title, description, instructions, link, reward, requires_proof)
select 'Watch: How Bid & Win works','A 90-second explainer of rounds, timers and the 85/15 split.','Watch the video and paste a timestamp as proof.','https://youtube.com',8,true
where not exists (select 1 from public.tasks where title like 'Watch:%');

-- ─── auth helpers ─────────────────────────────────────────────────────────
create or replace function public.me() returns public.users
language sql stable security definer set search_path = public as $$
  select * from public.users where auth_id = auth.uid() limit 1;
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.users u, public.platform_settings s
    where s.key = 'admin_telegram_id' and u.telegram_id = s.value and u.auth_id = auth.uid()
  );
$$;

create or replace function public.require_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin authorization required'; end if;
end $$;

create or replace function public.get_setting(k text) returns text
language sql stable security definer set search_path = public as $$
  select value from public.platform_settings where key = k;
$$;

create or replace function public.audit(action text, target text default '', details jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = public as $$
  insert into public.admin_actions(admin_id, action, target, details)
  select id, action, target, details from public.me();
$$;

-- Atomic ledger write. EVERY balance change in the system flows through here.
create or replace function public.adjust_balance(p_user uuid, p_delta bigint, p_type text, p_note text default '', p_ref uuid default null) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_balance bigint;
  v_new bigint;
  v_earn boolean := p_delta > 0 and p_type in ('ad_reward','task_reward','click_reward','bid_winnings');
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
    total_earned = total_earned + case when v_earn then p_delta else 0 end,
    today_earned = case when today_date <> current_date then 0 else today_earned end
                   + case when v_earn then p_delta else 0 end,
    today_date   = current_date
  where user_id = p_user;
  insert into public.transactions(user_id, type, amount, balance_after, note, ref_id)
  values (p_user, p_type, p_delta, v_new, p_note, p_ref);
  return v_new;
end $$;

create or replace function public.notify_user(p_user uuid, p_kind text, p_title text, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, kind, title, body) values (p_user, p_kind, p_title, p_body);
$$;

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
    'admin_telegram_id', public.get_setting('admin_telegram_id')
  );
$$;

create or replace function public.new_round(p_amount int default null, p_timer int default null) returns public.bid_rounds
language plpgsql security definer set search_path = public as $$
declare r public.bid_rounds;
begin
  insert into public.bid_rounds(bid_amount, timer_sec, winner_pct, platform_pct, status, ends_at)
  values (coalesce(p_amount, (public.get_setting('bid_amount'))::int),
          coalesce(p_timer, (public.get_setting('bid_timer_sec'))::int),
          (public.get_setting('winner_pct'))::int,
          (public.get_setting('platform_pct'))::int,
          'running', null)
  returning * into r;
  return r;
end $$;

-- ─── bootstrap ────────────────────────────────────────────────────────────
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
      'balance', w.balance, 'total_earned', w.total_earned,
      'today_earned', case when w.today_date = current_date then w.today_earned else 0 end),
    'settings', public.settings_json()
  );
end $$;

-- ─── ads ──────────────────────────────────────────────────────────────────
create or replace function public.list_ads() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select ad from (
    select jsonb_build_object(
      'id', a.id, 'source', 'ad', 'title', a.title, 'description', a.description,
      'image_url', a.image_url, 'url', a.url, 'reward', a.reward,
      'required_seconds', a.required_seconds, 'per_user_limit', a.per_user_limit,
      'my_completions', coalesce(c.count, 0), 'ends_at', a.ends_at,
      'hue', abs(hashtext(a.title)) % 360) as ad,
      1 as ord
    from public.advertisements a
    left join public.ad_completions c on c.ad_id = a.id and c.user_id = (public.me()).id
    where a.status = 'active'
      and (a.starts_at is null or a.starts_at <= now())
      and (a.ends_at is null or a.ends_at > now())
    union all
    select jsonb_build_object(
      'id', cp.id, 'source', 'campaign', 'title', cp.title, 'description', cp.description,
      'image_url', cp.image_url, 'url', cp.url, 'reward', (public.get_setting('click_reward'))::int,
      'required_seconds', 7, 'per_user_limit', 1,
      'my_completions', case when cc.user_id is null then 0 else 1 end,
      'ends_at', cp.ends_at, 'hue', abs(hashtext(cp.title)) % 360) as ad,
      2 as ord
    from public.campaigns cp
    left join public.campaign_clicks cc on cc.campaign_id = cp.id and cc.user_id = (public.me()).id
    where cp.status = 'active' and cp.user_id <> (public.me()).id
      and cp.spent < cp.budget
      and (cp.ends_at is null or cp.ends_at > now())
  ) x
  order by x.ord asc;
$$;

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
    insert into public.campaign_clicks(campaign_id, user_id) values (p_id, u.id)
    on conflict (campaign_id, user_id) do nothing;
    if not found then raise exception 'You already completed this campaign'; end if;
    v_reward := (public.get_setting('click_reward'))::int;
    update public.campaigns set clicks = clicks + 1, spent = spent + v_reward,
      status = case when spent + v_reward >= budget then 'completed' else status end
    where id = p_id and status = 'active' and spent + v_reward <= budget
      and (ends_at is null or ends_at > now())
    returning * into c;
    if not found then
      raise exception 'Campaign is no longer accepting clicks';
    end if;
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

-- ─── tasks ────────────────────────────────────────────────────────────────
create or replace function public.list_tasks() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'title', t.title, 'description', t.description, 'instructions', t.instructions,
    'link', t.link, 'reward', t.reward, 'requires_proof', t.requires_proof,
    'deadline', t.deadline, 'status', t.status,
    'my_status', s.status)
  from public.tasks t
  left join public.task_submissions s on s.task_id = t.id and s.user_id = (public.me()).id
  where t.status = 'active' and (t.deadline is null or t.deadline > now())
  order by t.created_at desc;
$$;

create or replace function public.submit_task(p_id uuid, p_proof text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users := public.me(); t public.tasks; v_balance bigint;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  select * into t from public.tasks where id = p_id and status = 'active';
  if not found then raise exception 'Task unavailable'; end if;
  if exists(select 1 from public.task_submissions where task_id = p_id and user_id = u.id) then
    raise exception 'Already submitted';
  end if;
  if t.requires_proof and length(trim(p_proof)) < 3 then
    raise exception 'Proof is required for this task';
  end if;
  if not t.requires_proof then
    insert into public.task_submissions(task_id, user_id, proof, status) values (p_id, u.id, 'auto-verified', 'approved');
    v_balance := public.adjust_balance(u.id, t.reward, 'task_reward', t.title, p_id);
    perform public.notify_user(u.id, 'earn', 'Task completed', '+' || t.reward || ' Coins — ' || t.title);
    return jsonb_build_object('ok', true, 'auto', true, 'reward', t.reward, 'balance', v_balance);
  end if;
  insert into public.task_submissions(task_id, user_id, proof, status) values (p_id, u.id, p_proof, 'pending');
  return jsonb_build_object('ok', true, 'auto', false);
end $$;

-- ─── campaigns ────────────────────────────────────────────────────────────
create or replace function public.list_my_campaigns() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', id, 'title', title, 'description', description, 'url', url, 'image_url', image_url,
    'budget', budget, 'cpc', cpc, 'clicks', clicks, 'max_clicks', max_clicks,
    'spent', spent, 'status', status, 'created_at', created_at)
  from public.campaigns where user_id = (public.me()).id order by created_at desc;
$$;

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
  if p_budget > 1000000 then raise exception 'Budget too large'; end if;
  v_balance := public.adjust_balance(u.id, -p_budget, 'campaign_deposit', 'Campaign budget — ' || p_title);
  insert into public.campaigns(user_id, title, description, url, image_url, budget, cpc, max_clicks, ends_at, status)
  values (u.id, p_title, p_description, p_url, nullif(p_image, ''), p_budget, v_cpc,
          floor(p_budget::numeric / v_cpc)::int, now() + (coalesce(p_days, 14) || ' days')::interval, 'pending');
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

-- ─── bid & win (server-controlled timer & settlement) ─────────────────────
create or replace function public.try_finalize_round() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r public.bid_rounds; last_bid public.bids;
  v_payout bigint; v_winner_name text;
begin
  -- SKIP LOCKED guarantees two concurrent settlers can never pick the same round
  for r in
    select * from public.bid_rounds
    where status = 'running' and ends_at is not null and ends_at <= now()
    for update skip locked
  loop
    select * into last_bid from public.bids where round_id = r.id order by placed_at desc, id desc limit 1;
    if found then
      v_payout := floor(r.pool::numeric * r.winner_pct / 100)::bigint;
      perform public.adjust_balance(last_bid.user_id, v_payout, 'bid_winnings',
        'Won round #' || r.number || ' — ' || r.winner_pct || '% of ' || r.pool || ' pool', r.id);
      update public.bid_rounds set status = 'completed', winner = last_bid.user_id, payout = v_payout where id = r.id;
      select coalesce(username, first_name) into v_winner_name from public.users where id = last_bid.user_id;
      perform public.notify_user(last_bid.user_id, 'win', 'You won Bid & Win! 🏆',
        'Round #' || r.number || ' paid ' || v_payout || ' Coins (' || r.winner_pct || '% of the pool).');
    else
      update public.bid_rounds set status = 'completed' where id = r.id;
    end if;
    perform public.new_round(); -- the arena never sleeps
  end loop;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.get_round() returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r public.bid_rounds; u public.users := public.me();
  v_last jsonb; v_bids jsonb; v_winners jsonb;
begin
  perform public.try_finalize_round(); -- self-heal expired rounds on every read
  select * into r from public.bid_rounds where status = 'running' order by created_at desc limit 1;
  if not found then r := public.new_round(); end if;

  select jsonb_build_object('id', b.id, 'amount', b.amount, 'placed_at', b.placed_at,
    'is_me', b.user_id = u.id,
    'user', jsonb_build_object('id', x.id, 'username', coalesce(x.username,''), 'first_name', x.first_name, 'photo_url', x.photo_url))
  into v_last
  from public.bids b join public.users x on x.id = b.user_id
  where b.round_id = r.id order by b.placed_at desc, b.id desc limit 1;

  select coalesce(jsonb_agg(row_to_json), '[]'::jsonb) into v_bids from (
    select jsonb_build_object('id', b.id, 'amount', b.amount, 'placed_at', b.placed_at,
      'is_me', b.user_id = u.id,
      'user', jsonb_build_object('id', x.id, 'username', coalesce(x.username,''), 'first_name', x.first_name, 'photo_url', x.photo_url)) as row_to_json
    from public.bids b join public.users x on x.id = b.user_id
    where b.round_id = r.id order by b.placed_at desc, b.id desc limit 15
  ) s;

  select coalesce(jsonb_agg(row_to_json), '[]'::jsonb) into v_winners from (
    select jsonb_build_object('payout', br.payout, 'pool', br.pool, 'round', br.number, 'at', br.last_bid_at,
      'user', jsonb_build_object('id', x.id, 'username', coalesce(x.username,''), 'first_name', x.first_name, 'photo_url', x.photo_url)) as row_to_json
    from public.bid_rounds br join public.users x on x.id = br.winner
    where br.status = 'completed' and br.winner is not null
    order by br.last_bid_at desc nulls last limit 6
  ) s;

  return jsonb_build_object(
    'round', jsonb_build_object('id', r.id, 'number', r.number, 'bid_amount', r.bid_amount,
      'timer_sec', r.timer_sec, 'winner_pct', r.winner_pct, 'platform_pct', r.platform_pct,
      'pool', r.pool, 'bid_count', r.bid_count, 'status', r.status, 'ends_at', r.ends_at,
      'winner', r.winner, 'payout', r.payout),
    'last_bid', v_last, 'bids', v_bids, 'winners', v_winners, 'server_now', now());
end $$;

create or replace function public.place_bid() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  u public.users := public.me();
  r public.bid_rounds;
  v_prev uuid; v_balance bigint;
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

  v_balance := public.adjust_balance(u.id, -r.bid_amount, 'bid_payment', 'Bid & Win round #' || r.number, r.id);
  insert into public.bids(round_id, user_id, amount) values (r.id, u.id, r.bid_amount);

  v_prev := r.last_bidder;
  update public.bid_rounds set
    pool = pool + r.bid_amount,
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

-- Called by the housekeeping worker when a campaign passes its end date.
create or replace function public.settle_expired_campaign(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.campaigns; v_remaining bigint;
begin
  select * into c from public.campaigns where id = p_id and status = 'active' for update;
  if not found then return jsonb_build_object('ok', true, 'skipped', true); end if;
  v_remaining := c.budget - c.spent;
  if v_remaining > 0 then
    perform public.adjust_balance(c.user_id, v_remaining, 'campaign_refund', 'Campaign ended — leftover refund for ' || c.title, p_id);
    update public.campaigns set status = 'refunded' where id = p_id;
  else
    update public.campaigns set status = 'completed' where id = p_id;
  end if;
  perform public.notify_user(c.user_id, 'campaign', 'Campaign finished',
    '"' || c.title || '" received ' || c.clicks || ' clicks. ' ||
    case when v_remaining > 0 then v_remaining || ' unused Coins were refunded.' else 'Full budget delivered.' end);
  return jsonb_build_object('ok', true, 'refunded', v_remaining);
end $$;

-- ─── wallet & withdrawals ─────────────────────────────────────────────────
create or replace function public.list_transactions(p_limit int default 100) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'type', type, 'amount', amount,
    'balance_after', balance_after, 'note', note, 'created_at', created_at)
  from public.transactions where user_id = (public.me()).id
  order by created_at desc, id desc limit greatest(1, least(p_limit, 500));
$$;

create or replace function public.request_withdrawal(p_coins bigint, p_address text, p_network text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare u public.users := public.me(); v_rate numeric; v_balance bigint; v_min bigint;
begin
  if u.id is null then raise exception 'Not authenticated'; end if;
  v_min := (public.get_setting('min_withdrawal'))::bigint;
  v_rate := (public.get_setting('coin_usdt_rate'))::numeric;
  if p_coins < v_min then raise exception 'Minimum withdrawal is % Coins', v_min; end if;
  if p_coins > 100000000 then raise exception 'Amount too large'; end if;
  if length(trim(p_address)) < 8 then raise exception 'Enter a valid withdrawal address'; end if;
  v_balance := public.adjust_balance(u.id, -p_coins, 'withdrawal',
    'Withdrawal to ' || coalesce(p_network, 'TRC20') || ' ••••' || right(trim(p_address), 4));
  insert into public.withdrawals(user_id, coins, usdt, rate, address, network, status)
  values (u.id, p_coins, round(p_coins * v_rate, 6), v_rate, trim(p_address), coalesce(nullif(p_network, ''), 'TRC20'), 'pending');
  perform public.notify_user(u.id, 'withdrawal', 'Withdrawal received',
    p_coins || ' Coins (' || round(p_coins * v_rate, 4) || ' USDT) is pending review.');
  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

create or replace function public.list_my_withdrawals() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'coins', coins, 'usdt', usdt, 'address', address,
    'network', network, 'status', status, 'created_at', created_at)
  from public.withdrawals where user_id = (public.me()).id order by created_at desc;
$$;

-- ─── admin ────────────────────────────────────────────────────────────────
create or replace function public.admin_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_totals jsonb; v_last7 jsonb; v_recent jsonb;
begin
  perform public.require_admin();
  select jsonb_build_object(
    'users', (select count(*) from public.users),
    'active_users', (select count(*) from public.users where status = 'active'),
    'new_today', (select count(*) from public.users where created_at >= current_date),
    'coins_issued', coalesce((select sum(amount) from public.transactions where amount > 0), 0),
    'coins_spent', coalesce((select abs(sum(amount)) from public.transactions where amount < 0), 0),
    'ad_earnings', coalesce((select sum(amount) from public.transactions where type = 'ad_reward'), 0),
    'task_earnings', coalesce((select sum(amount) from public.transactions where type = 'task_reward'), 0),
    'click_earnings', coalesce((select sum(amount) from public.transactions where type = 'click_reward'), 0),
    'campaign_clicks', coalesce((select sum(clicks) from public.campaigns), 0),
    'campaign_spend', coalesce((select sum(spent) from public.campaigns), 0),
    'bid_volume', coalesce((select abs(sum(amount)) from public.transactions where type = 'bid_payment'), 0),
    'platform_fees', coalesce((select sum(pool - coalesce(payout, 0)) from public.bid_rounds where status = 'completed' and winner is not null), 0),
    'withdrawals_total', coalesce((select sum(coins) from public.withdrawals), 0),
    'withdrawals_pending', (select count(*) from public.withdrawals where status = 'pending'),
    'withdrawals_completed', coalesce((select sum(coins) from public.withdrawals where status = 'completed'), 0)
  ) into v_totals;

  select coalesce(jsonb_agg(row_to_json order by d asc), '[]'::jsonb) into v_last7 from (
    select jsonb_build_object(
      'day', to_char(day, 'Dy'),
      'earned', coalesce((select sum(amount) from public.transactions t where t.created_at::date = s.day and t.amount > 0), 0),
      'bids', coalesce((select count(*) from public.transactions t where t.created_at::date = s.day and t.type = 'bid_payment'), 0)
    ) as row_to_json, s.day as d
    from (select (current_date - gs.n) as day from generate_series(6, 0, -1) as gs(n)) s
  ) x;

  select coalesce(jsonb_agg(row_to_json), '[]'::jsonb) into v_recent from (
    select jsonb_build_object('id', u.id, 'telegram_id', u.telegram_id, 'username', u.username,
      'first_name', u.first_name, 'photo_url', u.photo_url, 'status', u.status,
      'balance', coalesce(w.balance, 0), 'total_earned', coalesce(w.total_earned, 0), 'created_at', u.created_at) as row_to_json
    from public.users u left join public.wallets w on w.user_id = u.id
    order by u.created_at desc limit 5
  ) x;

  return jsonb_build_object('totals', v_totals, 'last7', v_last7, 'recent_users', v_recent);
end $$;

create or replace function public.admin_users(p_q text default '') returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', u.id, 'telegram_id', u.telegram_id, 'username', u.username,
    'first_name', u.first_name, 'last_name', u.last_name, 'photo_url', u.photo_url,
    'status', u.status, 'balance', coalesce(w.balance, 0), 'total_earned', coalesce(w.total_earned, 0),
    'created_at', u.created_at)
  from public.users u left join public.wallets w on w.user_id = u.id
  where p_q = '' or u.username ilike '%' || p_q || '%' or u.first_name ilike '%' || p_q || '%' or u.telegram_id ilike '%' || p_q || '%'
  order by u.created_at desc limit 100;
$$;

create or replace function public.admin_user_txns(p_user uuid) returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'type', type, 'amount', amount, 'balance_after', balance_after, 'note', note, 'created_at', created_at)
  from public.transactions where user_id = p_user order by created_at desc, id desc limit 30;
$$;

create or replace function public.admin_adjust(p_user uuid, p_delta bigint, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_delta = 0 then raise exception 'Amount must be non-zero'; end if;
  if abs(p_delta) > 100000000 then raise exception 'Amount too large'; end if;
  perform public.adjust_balance(p_user, p_delta, 'admin_adjust', coalesce(nullif(p_reason, ''), 'Admin adjustment'));
  perform public.audit('adjust_balance', p_user::text, jsonb_build_object('delta', p_delta, 'reason', p_reason));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_set_user_status(p_user uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p_status not in ('active','banned','suspended') then raise exception 'Invalid status'; end if;
  update public.users set status = p_status where id = p_user;
  perform public.audit('user_status', p_user::text, jsonb_build_object('status', p_status));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_ads() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'source', 'ad', 'title', title, 'description', description,
    'image_url', image_url, 'url', url, 'reward', reward, 'required_seconds', required_seconds,
    'per_user_limit', per_user_limit, 'my_completions', 0, 'ends_at', ends_at,
    'hue', abs(hashtext(title)) % 360, 'status', status)
  from public.advertisements where status <> 'deleted' order by created_at desc;
$$;

create or replace function public.admin_tasks() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'title', title, 'description', description, 'instructions', instructions,
    'link', link, 'reward', reward, 'requires_proof', requires_proof, 'deadline', deadline,
    'status', status, 'my_status', null)
  from public.tasks where status <> 'deleted' order by created_at desc;
$$;

create or replace function public.admin_upsert_ad(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p->>'id' is not null and exists(select 1 from public.advertisements where id = (p->>'id')::uuid) then
    update public.advertisements set
      title = coalesce(p->>'title', title), description = coalesce(p->>'description', description),
      url = coalesce(p->>'url', url), reward = coalesce((p->>'reward')::int, reward),
      required_seconds = coalesce((p->>'required_seconds')::int, required_seconds),
      per_user_limit = coalesce((p->>'per_user_limit')::int, per_user_limit),
      status = coalesce(p->>'status', status)
    where id = (p->>'id')::uuid;
    perform public.audit('ad_update', p->>'id', p);
  else
    insert into public.advertisements(title, description, url, reward, required_seconds, per_user_limit, status)
    values (coalesce(nullif(p->>'title', ''), 'New ad'), coalesce(p->>'description', ''), coalesce(p->>'url', ''),
      coalesce((p->>'reward')::int, 5), coalesce((p->>'required_seconds')::int, 10),
      coalesce((p->>'per_user_limit')::int, 1), coalesce(p->>'status', 'active'));
    perform public.audit('ad_create', '', p);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_delete_ad(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  update public.advertisements set status = 'deleted' where id = p_id;
  perform public.audit('ad_delete', p_id::text);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_upsert_task(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p->>'id' is not null and exists(select 1 from public.tasks where id = (p->>'id')::uuid) then
    update public.tasks set
      title = coalesce(p->>'title', title), description = coalesce(p->>'description', description),
      instructions = coalesce(p->>'instructions', instructions), link = coalesce(p->>'link', link),
      reward = coalesce((p->>'reward')::int, reward),
      requires_proof = coalesce((p->>'requires_proof')::boolean, requires_proof),
      status = coalesce(p->>'status', status)
    where id = (p->>'id')::uuid;
    perform public.audit('task_update', p->>'id', p);
  else
    insert into public.tasks(title, description, instructions, link, reward, requires_proof, status)
    values (coalesce(nullif(p->>'title', ''), 'New task'), coalesce(p->>'description', ''),
      coalesce(p->>'instructions', ''), nullif(p->>'link', ''),
      coalesce((p->>'reward')::int, 5), coalesce((p->>'requires_proof')::boolean, false),
      coalesce(p->>'status', 'active'));
    perform public.audit('task_create', '', p);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_submissions() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'proof', s.proof, 'status', s.status, 'created_at', s.created_at,
    'task', jsonb_build_object('id', t.id, 'title', t.title, 'reward', t.reward),
    'user', jsonb_build_object('id', u.id, 'username', coalesce(u.username,''), 'first_name', u.first_name, 'photo_url', u.photo_url))
  from public.task_submissions s
  join public.tasks t on t.id = s.task_id
  join public.users u on u.id = s.user_id
  order by (s.status = 'pending') desc, s.created_at desc limit 100;
$$;

create or replace function public.admin_review_submission(p_id uuid, p_approve boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.task_submissions; t public.tasks;
begin
  perform public.require_admin();
  select * into s from public.task_submissions where id = p_id for update;
  if not found then raise exception 'Submission not found'; end if;
  if s.status <> 'pending' then raise exception 'Submission already reviewed'; end if;
  select * into t from public.tasks where id = s.task_id;
  update public.task_submissions set status = case when p_approve then 'approved' else 'rejected' end where id = p_id;
  if p_approve then
    perform public.adjust_balance(s.user_id, t.reward, 'task_reward', t.title, s.task_id);
    perform public.notify_user(s.user_id, 'task', 'Task approved ✅', '+' || t.reward || ' Coins — ' || t.title);
  else
    perform public.notify_user(s.user_id, 'task', 'Task rejected', 'Your submission for "' || t.title || '" was rejected.');
  end if;
  perform public.audit('review_submission', p_id::text, jsonb_build_object('approve', p_approve));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_campaigns() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'title', c.title, 'description', c.description, 'url', c.url,
    'image_url', c.image_url, 'budget', c.budget, 'cpc', c.cpc, 'clicks', c.clicks,
    'max_clicks', c.max_clicks, 'spent', c.spent, 'status', c.status, 'created_at', c.created_at,
    'user', jsonb_build_object('id', u.id, 'username', coalesce(u.username,''), 'first_name', u.first_name, 'photo_url', u.photo_url))
  from public.campaigns c join public.users u on u.id = c.user_id
  order by c.created_at desc limit 100;
$$;

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
      if c.status <> 'pending' then raise exception 'Only pending campaigns can be approved'; end if;
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

create or replace function public.admin_campaign_edit(p_id uuid, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform public.require_admin();
  if p ? 'url' and (p->>'url') !~ '^https?://' then raise exception 'Enter a valid https:// URL'; end if;
  update public.campaigns set
    title = coalesce(nullif(p->>'title', ''), title),
    description = coalesce(p->>'description', description),
    url = coalesce(p->>'url', url)
  where id = p_id;
  perform public.audit('campaign_edit', p_id::text, p);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_rounds() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', id, 'number', number, 'bid_amount', bid_amount, 'timer_sec', timer_sec,
    'winner_pct', winner_pct, 'platform_pct', platform_pct, 'pool', pool, 'bid_count', bid_count,
    'status', status, 'ends_at', ends_at, 'winner', winner, 'payout', payout)
  from public.bid_rounds order by created_at desc limit 20;
$$;

create or replace function public.admin_round_action(p_action text, p_amount int default null, p_timer int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.bid_rounds; v_refund record;
begin
  perform public.require_admin();
  case p_action
    when 'start' then
      update public.bid_rounds set status = 'cancelled' where status = 'running';
      perform public.new_round(p_amount, p_timer);
    when 'end' then
      update public.bid_rounds set ends_at = now() - interval '1 second'
      where status = 'running' and ends_at is not null;
      perform public.try_finalize_round();
    when 'cancel' then
      select * into r from public.bid_rounds where status = 'running' order by created_at desc limit 1 for update;
      if found then
        for v_refund in select user_id, sum(amount)::bigint as total from public.bids where round_id = r.id group by user_id
        loop
          perform public.adjust_balance(v_refund.user_id, v_refund.total, 'admin_adjust', 'Round #' || r.number || ' cancelled — refund', r.id);
        end loop;
        update public.bid_rounds set status = 'cancelled' where id = r.id;
      end if;
      perform public.new_round();
    else raise exception 'Unknown action %', p_action;
  end case;
  perform public.audit('round_' || p_action, '', jsonb_build_object('amount', p_amount, 'timer', p_timer));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_withdrawals() returns setof jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', w.id, 'coins', w.coins, 'usdt', w.usdt, 'address', w.address,
    'network', w.network, 'status', w.status, 'created_at', w.created_at,
    'user', jsonb_build_object('id', u.id, 'username', coalesce(u.username,''), 'first_name', u.first_name, 'photo_url', u.photo_url))
  from public.withdrawals w join public.users u on u.id = w.user_id
  order by w.created_at desc limit 200;
$$;

create or replace function public.admin_set_withdrawal(p_id uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare w public.withdrawals;
begin
  perform public.require_admin();
  if p_status not in ('pending','approved','processing','completed','rejected','cancelled') then
    raise exception 'Invalid status';
  end if;
  select * into w from public.withdrawals where id = p_id for update;
  if not found then raise exception 'Withdrawal not found'; end if;
  if p_status in ('rejected','cancelled') and w.status in ('pending','approved','processing') then
    perform public.adjust_balance(w.user_id, w.coins, 'withdrawal_refund', 'Withdrawal ' || p_status || ' — refund', p_id);
    perform public.notify_user(w.user_id, 'withdrawal', 'Withdrawal ' || p_status, w.coins || ' Coins were returned to your balance.');
  end if;
  if p_status = 'completed' then
    perform public.notify_user(w.user_id, 'withdrawal', 'Withdrawal completed 💸', w.usdt || ' USDT sent to ••••' || right(w.address, 4));
  end if;
  update public.withdrawals set status = p_status where id = p_id;
  perform public.audit('withdrawal_' || p_status, p_id::text, jsonb_build_object('coins', w.coins));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.admin_get_settings() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.require_admin();
  return public.settings_json();
end $$;

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
    'daily_ad_limit','maintenance_mode','admin_telegram_id']
  loop
    if p ? k then
      insert into public.platform_settings(key, value) values (k, p->>k)
      on conflict (key) do update set value = excluded.value;
    end if;
  end loop;
  perform public.audit('settings_save', '', p);
  return jsonb_build_object('ok', true);
end $$;

-- ─── realtime ─────────────────────────────────────────────────────────────
do $$ begin
  alter publication supabase_realtime add table public.bids;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.bid_rounds;
exception when duplicate_object then null; end $$;

-- ─── RLS ──────────────────────────────────────────────────────────────────
alter table public.users enable row level security;
alter table public.wallets enable row level security;
alter table public.transactions enable row level security;
alter table public.advertisements enable row level security;
alter table public.ad_completions enable row level security;
alter table public.tasks enable row level security;
alter table public.task_submissions enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_clicks enable row level security;
alter table public.bid_rounds enable row level security;
alter table public.bids enable row level security;
alter table public.withdrawals enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_actions enable row level security;
alter table public.platform_settings enable row level security;

drop policy if exists users_self on public.users;
create policy users_self on public.users for select using (auth_id = auth.uid());
drop policy if exists wallets_self on public.wallets;
create policy wallets_self on public.wallets for select using (user_id = (select id from public.users where auth_id = auth.uid()));
drop policy if exists tx_self on public.transactions;
create policy tx_self on public.transactions for select using (user_id = (select id from public.users where auth_id = auth.uid()));
drop policy if exists ads_read on public.advertisements;
create policy ads_read on public.advertisements for select to authenticated using (status = 'active');
drop policy if exists tasks_read on public.tasks;
create policy tasks_read on public.tasks for select to authenticated using (status <> 'deleted');
drop policy if exists rounds_read on public.bid_rounds;
create policy rounds_read on public.bid_rounds for select to authenticated using (true);
drop policy if exists bids_read on public.bids;
create policy bids_read on public.bids for select to authenticated using (true);
drop policy if exists wd_self on public.withdrawals;
create policy wd_self on public.withdrawals for select using (user_id = (select id from public.users where auth_id = auth.uid()));
drop policy if exists notif_self on public.notifications;
create policy notif_self on public.notifications for select using (user_id = (select id from public.users where auth_id = auth.uid()));
drop policy if exists settings_read on public.platform_settings;
create policy settings_read on public.platform_settings for select to authenticated using (true);
-- ad_completions, task_submissions, campaigns, campaign_clicks, admin_actions:
-- NO direct policies — all mutations run through SECURITY DEFINER RPCs, so
-- the frontend can never write economy data directly.

grant execute on all functions in schema public to authenticated, anon;
