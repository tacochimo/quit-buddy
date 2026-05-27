-- Slip / relapse log. Captures the context around a slip so the coach can
-- talk about it and the user can look back at the pattern. A 'slip' is one
-- moment (does not reset the streak); a 'relapse' is back to daily smoking
-- (resets via a corresponding streak_events row, linked here).

create table public.slips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('slip', 'relapse')),
  count int check (count is null or count >= 0),
  trigger text,
  intensity int check (intensity is null or intensity between 1 and 5),
  what_was_happening text,
  what_id_do_differently text,
  streak_event_id uuid references public.streak_events(id) on delete set null
);

create index slips_user_occurred_idx
  on public.slips (user_id, occurred_at desc);

alter table public.slips enable row level security;

create policy "slips_self_read" on public.slips
  for select to authenticated using (user_id = (select auth.uid()));

create policy "slips_self_insert" on public.slips
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "slips_self_update" on public.slips
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
