-- Quit-day prep checklist. One row per (user, step_id) when completed.
-- step_id is a stable string defined in lib/prep.ts. Toggling off = delete.

create table public.prep_steps (
  user_id uuid not null references public.profiles(id) on delete cascade,
  step_id text not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

alter table public.prep_steps enable row level security;

create policy "prep_steps_self_all" on public.prep_steps
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
