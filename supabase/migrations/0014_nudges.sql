-- Record of every proactive nudge sent by the coach. Lets the cron skip users
-- who already got one recently, and gives us audit history if a user complains
-- about over-messaging.
create table public.nudges_sent (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  details jsonb,
  sent_at timestamptz not null default now()
);

create index nudges_sent_user_sent_idx
  on public.nudges_sent (user_id, sent_at desc);

alter table public.nudges_sent enable row level security;

-- Users can see their own nudge history. Only service_role writes.
create policy "nudges_self_read" on public.nudges_sent
  for select to authenticated using (user_id = (select auth.uid()));
