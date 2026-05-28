-- Daily prize wheel. One spin per (user, UTC date). The outcome's effect
-- runs until expires_at (NULL = instant / no time-bound effect, e.g. a
-- one-shot star insert).

create table public.prize_spins (
  user_id uuid not null references public.profiles(id) on delete cascade,
  spin_date date not null,
  outcome text not null check (outcome in (
    'bonus_messages', 'tricks_unlock', 'milestone_star',
    'sparkle', 'companion_swap', 'dud'
  )),
  payload jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, spin_date)
);

create index prize_spins_user_active_idx
  on public.prize_spins (user_id, expires_at desc);

alter table public.prize_spins enable row level security;

create policy "prize_spins_self_all" on public.prize_spins
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
