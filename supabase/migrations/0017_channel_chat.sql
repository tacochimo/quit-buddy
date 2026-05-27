-- Text chat between channel members. Separate from streak_events/stars/SOS
-- (which form the activity feed) — these are manual messages.
create table public.channel_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index channel_messages_channel_created_idx
  on public.channel_messages (channel_id, created_at desc);

alter table public.channel_messages enable row level security;

create policy "channel_msgs_member_read" on public.channel_messages
  for select to authenticated
  using (public.is_channel_member(channel_id));

create policy "channel_msgs_self_insert" on public.channel_messages
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_channel_member(channel_id)
  );

-- Authors can delete their own messages. Channel owners can't moderate
-- others' messages in v1 — add later if needed.
create policy "channel_msgs_self_delete" on public.channel_messages
  for delete to authenticated using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.channel_messages;
