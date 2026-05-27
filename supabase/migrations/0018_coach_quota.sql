-- Race-free per-user daily quota for the AI coach. Previously we counted
-- chat_messages rows; under concurrent requests two could both pass the
-- check before either inserted, letting the cap leak. This table + RPC
-- enforce it atomically (ON CONFLICT DO UPDATE ... WHERE).

create table public.coach_quota_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  used int not null default 0,
  primary key (user_id, day)
);

alter table public.coach_quota_daily enable row level security;

-- Users can read their own counter (for the "X/N left today" header).
create policy "coach_quota_self_read" on public.coach_quota_daily
  for select to authenticated using (user_id = (select auth.uid()));

-- Writes only via SECURITY DEFINER RPCs below — no insert/update/delete policy
-- for authenticated; the functions bypass RLS but check auth.uid() themselves.

-- Atomically reserve one quota slot for the calling user. Returns the new
-- count if reserved, NULL if blocked (already at limit).
create or replace function public.consume_coach_quota(p_limit int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
  v_used int;
begin
  if v_user_id is null then
    raise exception 'unauthorized';
  end if;

  insert into public.coach_quota_daily (user_id, day, used)
  values (v_user_id, v_day, 1)
  on conflict (user_id, day) do update
    set used = public.coach_quota_daily.used + 1
    where public.coach_quota_daily.used < p_limit
  returning used into v_used;

  return v_used;
end;
$$;

-- Refund one slot. Called when generation fails after consume succeeded.
create or replace function public.refund_coach_quota()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_day date := (now() at time zone 'utc')::date;
begin
  if v_user_id is null then return; end if;
  update public.coach_quota_daily
    set used = greatest(used - 1, 0)
    where user_id = v_user_id and day = v_day;
end;
$$;

grant execute on function public.consume_coach_quota(int) to authenticated;
grant execute on function public.refund_coach_quota() to authenticated;

-- Backfill today's counts so the cap behaves sensibly right after deploy.
insert into public.coach_quota_daily (user_id, day, used)
select
  user_id,
  (now() at time zone 'utc')::date as day,
  count(*) as used
from public.chat_messages
where role = 'user'
  and created_at >= (now() at time zone 'utc')::date
group by user_id
on conflict (user_id, day) do nothing;
