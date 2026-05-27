-- Daily 1-tap mood check-in. One row per (user, day) in their local timezone.
-- Feeds the withdrawal timeline display and the coach context.

create table public.mood_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  mood text not null check (mood in (
    'good', 'steady', 'irritable', 'anxious', 'low', 'tired'
  )),
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);

create index mood_logs_user_date_idx
  on public.mood_logs (user_id, log_date desc);

alter table public.mood_logs enable row level security;

create policy "mood_logs_self_all" on public.mood_logs
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
