-- "Invite a friend" mechanic. Each user gets a unique referral_code (lazy).
-- When a new user lands on /?ref=CODE and then completes onboarding, the
-- referrer/referee pair is recorded and both get a 🤝 referral star + a
-- bonus to their daily coach message limit for 7 days.

alter table public.profiles
  add column referral_code text unique,
  add column referred_by uuid references public.profiles(id),
  add column bonus_messages_until timestamptz;

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending','qualified')),
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (referee_id)
);

create index referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;

-- Users can see referrals they're part of (either side). Writes are admin-only.
create policy "referrals_self_read" on public.referrals
  for select to authenticated using (
    referrer_id = (select auth.uid()) or referee_id = (select auth.uid())
  );
