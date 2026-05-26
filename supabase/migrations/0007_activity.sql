-- The activity feed needs to show "Maya hit 30 days" to her channel peers.
-- Personal milestone stars have channel_id = NULL, which the existing
-- stars_peer_read policy (which requires channel_id is not null) skips.
create policy "stars_peer_read_personal" on public.stars
  for select to authenticated
  using (
    channel_id is null
    and exists (
      select 1
      from public.channel_members me
      join public.channel_members peer on peer.channel_id = me.channel_id
      where me.user_id = (select auth.uid())
        and peer.user_id = stars.user_id
    )
  );

-- Drop the temporary debug helper from 0005 — no longer needed.
drop function if exists public.whoami();
