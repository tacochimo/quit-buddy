-- PayPal subscription support, alongside Stripe. payment_provider records
-- which path the user upgraded through so the "Manage" button knows whether
-- to send them to Stripe's Customer Portal or PayPal's subscription page.

alter table public.profiles
  add column paypal_subscription_id text,
  add column payment_provider text
    check (payment_provider is null or payment_provider in ('stripe', 'paypal'));

create index profiles_paypal_subscription_idx
  on public.profiles (paypal_subscription_id)
  where paypal_subscription_id is not null;
