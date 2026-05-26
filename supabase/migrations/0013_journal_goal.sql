-- Savings goal: optional named goal with target dollar amount, shown as a
-- progress bar on home so users see a tangible reason to keep going.
alter table public.profiles
  add column savings_goal_name text,
  add column savings_goal_amount numeric(10,2);

-- Craving journal: small log to spot patterns (time of day, common triggers).
create table public.cravings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  intensity int not null check (intensity between 1 and 5),
  trigger text,
  note text,
  created_at timestamptz not null default now()
);

create index cravings_user_created_idx
  on public.cravings (user_id, created_at desc);

alter table public.cravings enable row level security;

create policy "cravings_self_read" on public.cravings
  for select to authenticated using (user_id = (select auth.uid()));

create policy "cravings_self_insert" on public.cravings
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "cravings_self_delete" on public.cravings
  for delete to authenticated using (user_id = (select auth.uid()));
