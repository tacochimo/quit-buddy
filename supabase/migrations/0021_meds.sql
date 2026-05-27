-- Medication tracking for NRT (patch, gum, lozenge, inhaler, spray) and
-- cessation drugs (varenicline, bupropion). Two-table model: regimens =
-- what you're currently on; events = each dose taken/skipped + side effects.
-- Feeds the doctor PDF.

create table public.med_regimens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in (
    'patch', 'gum', 'lozenge', 'inhaler', 'spray',
    'varenicline', 'bupropion', 'other'
  )),
  dose_mg numeric(6,2),
  schedule text not null check (schedule in ('daily', 'twice-daily', 'prn')),
  started_on date not null default current_date,
  ended_on date,
  notes text,
  created_at timestamptz not null default now()
);

create index med_regimens_user_idx
  on public.med_regimens (user_id, started_on desc);

create table public.med_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  regimen_id uuid references public.med_regimens(id) on delete set null,
  occurred_at timestamptz not null default now(),
  kind text not null check (kind in ('dose', 'skipped', 'side_effect')),
  count int check (count is null or count > 0),
  side_effect text,
  notes text
);

create index med_events_user_occurred_idx
  on public.med_events (user_id, occurred_at desc);

alter table public.med_regimens enable row level security;
alter table public.med_events enable row level security;

create policy "med_regimens_self_all" on public.med_regimens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "med_events_self_all" on public.med_events
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
