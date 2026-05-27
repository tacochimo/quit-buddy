-- If-then trigger plans. One row per (user, trigger). The plan is the user's
-- own pre-committed response to a recurring trigger — CBT 101. Surfaced on
-- the cravings page, on the Home card during the peak craving window, and
-- in the coach system prompt.

create table public.trigger_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  trigger text not null,
  plan text not null check (char_length(plan) between 1 and 280),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, trigger)
);

create index trigger_plans_user_idx on public.trigger_plans (user_id);

alter table public.trigger_plans enable row level security;

create policy "trigger_plans_self_all" on public.trigger_plans
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
