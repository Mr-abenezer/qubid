-- ─────────────────────────────────────────────────────────────────────────────
-- Bid X · migration 003
--  New referral rule: a referral is only VALIDATED (and the +referral_bonus
--  paid) once the invited friend completes at least 1 task/ad. Until then the
--  friend shows as "pending" and the inviter earns nothing for them.
--  The +referral_commission still pays on every earning event, including the
--  first one (so the first task pays bonus + commission).
--  Safe to run on a database that already has 001 + 002 applied.
-- ─────────────────────────────────────────────────────────────────────────────

-- one-time marker so the bonus can never be paid twice for the same friend
alter table public.users
  add column if not exists referral_bonus_paid boolean not null default false;

-- retire the old "bonus the moment they join" trigger
drop trigger if exists users_referral_join on public.users;
drop function if exists public.referral_join_bonus();

-- commission on every earning event + one-time bonus on the FIRST one
create or replace function public.referral_commission() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_ref uuid; v_commission bigint; v_bonus bigint;
begin
  if new.type not in ('ad_reward','click_reward','task_reward') then return new; end if;
  select referred_by into v_ref from public.users where id = new.user_id;
  if v_ref is null or v_ref = new.user_id then return new; end if;

  -- first earning activity validates the referral → one-time join bonus
  if not exists (
    select 1 from public.transactions
    where user_id = new.user_id
      and type in ('ad_reward','click_reward','task_reward')
      and id < new.id
  ) then
    v_bonus := (public.get_setting('referral_bonus'))::bigint;
    if v_bonus > 0 then
      -- conditional update = atomic claim; losers of a race see found = false
      update public.users set referral_bonus_paid = true
        where id = new.user_id and referral_bonus_paid = false;
      if found then
        perform public.adjust_balance(v_ref, v_bonus, 'referral_bonus',
          'Referral validated — your friend completed their first task');
      end if;
    end if;
  end if;

  v_commission := (public.get_setting('referral_commission'))::bigint;
  if v_commission > 0 then
    perform public.adjust_balance(v_ref, v_commission, 'referral_commission',
      'Friend activity — ' || coalesce(new.note, 'task completed'));
  end if;
  return new;
end $$;

-- Invite-screen stats with pending/validated status and corrected earned math
-- (earned = completed × commission, plus the bonus only once validated)
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
        'earned', coalesce(x.earned, 0),
        'status', case when coalesce(x.completed, 0) >= 1 then 'validated' else 'pending' end
      ) order by f.created_at desc) filter (where f.id is not null), '[]'::jsonb)
    )
    from (select 1) anchor
    left join lateral (select * from public.users where referred_by = u.id) f on true
    left join lateral (
      select n as completed,
             n * (public.get_setting('referral_commission'))::bigint
               + case when n >= 1 then (public.get_setting('referral_bonus'))::bigint else 0 end
               as earned
      from (
        select count(*) as n from public.transactions t
        where t.user_id = f.id
          and t.type in ('ad_reward','click_reward','task_reward')
      ) c
    ) x on true
  );
end $$;
grant execute on function public.referral_stats() to authenticated;
