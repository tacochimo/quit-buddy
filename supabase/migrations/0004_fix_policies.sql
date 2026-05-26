-- Make all INSERT policies explicit about the authenticated role. Without
-- `to authenticated`, the policy is evaluated for the anon role too, which
-- can fail in some Supabase configurations.

drop policy if exists "channels_authenticated_insert" on public.channels;
create policy "channels_authenticated_insert" on public.channels
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "members_self_insert" on public.channel_members;
create policy "members_self_insert" on public.channel_members
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "streaks_self_insert" on public.streak_events;
create policy "streaks_self_insert" on public.streak_events
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "stars_self_insert" on public.stars;
create policy "stars_self_insert" on public.stars
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "reactions_member_insert" on public.reactions;
create policy "reactions_member_insert" on public.reactions
  for insert to authenticated
  with check (
    from_user_id = (select auth.uid())
    and public.is_channel_member(channel_id)
  );
