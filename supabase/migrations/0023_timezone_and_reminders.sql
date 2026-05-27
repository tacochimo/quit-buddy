-- Timezone for time-of-day cron logic (peak-window nudges + med reminders).
-- Captured from the browser on first home load; users can also set in settings.
alter table public.profiles
  add column timezone text;

-- Per-regimen reminder schedule. reminder_times are HH:MM strings in the
-- user's local timezone. PRN regimens never set reminder_enabled.
alter table public.med_regimens
  add column reminder_enabled boolean not null default false,
  add column reminder_times text[] not null default array[]::text[];

-- Dedup so a 15-minute cron doesn't fire the same reminder twice. A regimen
-- can have multiple reminder_times per day, so the key includes the slot.
create table public.med_reminders_sent (
  regimen_id uuid not null references public.med_regimens(id) on delete cascade,
  sent_for_date date not null,
  sent_for_time text not null,
  sent_at timestamptz not null default now(),
  primary key (regimen_id, sent_for_date, sent_for_time)
);

create index med_reminders_sent_date_idx
  on public.med_reminders_sent (sent_for_date);

alter table public.med_reminders_sent enable row level security;
-- Writes are service-role only; users can read their own to debug.
create policy "med_reminders_sent_self_read" on public.med_reminders_sent
  for select to authenticated
  using (
    regimen_id in (
      select id from public.med_regimens where user_id = (select auth.uid())
    )
  );
