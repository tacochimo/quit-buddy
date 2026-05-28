-- Subscription tier on profiles. Updated by the Stripe webhook; read by the
-- coach API to pick the correct daily quota. Default 'free' for everyone
-- including existing users — no backfill needed.

alter table public.profiles
  add column subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'plus')),
  add column subscription_renews_at timestamptz,
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

create index profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
