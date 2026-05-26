-- Allow users to insert their own stars (for client-side milestone awards).
-- Cron jobs will use service_role and bypass RLS for channel-rank stars later.
create policy "stars_self_insert" on public.stars
  for insert with check (user_id = auth.uid());
