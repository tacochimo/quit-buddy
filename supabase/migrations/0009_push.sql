-- One row per active push subscription. A user can have many (phone + laptop).
-- Endpoint is unique to that browser/device install.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users manage their own subscriptions. The server uses service_role to read
-- targets when sending pushes (bypasses RLS).
create policy "push_self_select" on public.push_subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

create policy "push_self_insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "push_self_delete" on public.push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
