-- SOS signal: a member says "I need support" to a channel. One row per channel
-- so peers see it in their channel's activity feed; sender can broadcast to all
-- their channels via the send_sos RPC below.
create table public.sos_signals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  note text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index sos_signals_channel_idx
  on public.sos_signals (channel_id, created_at desc);

alter table public.sos_signals enable row level security;

-- Channel members can read SOS in their channels.
create policy "sos_member_read" on public.sos_signals
  for select to authenticated
  using (public.is_channel_member(channel_id));

-- Users can only insert SOS for themselves (via RPC normally; direct insert allowed).
create policy "sos_self_insert" on public.sos_signals
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Only the sender can resolve (mark "I'm OK now").
create policy "sos_self_update" on public.sos_signals
  for update to authenticated
  using (user_id = (select auth.uid()));

-- Add SOS table to realtime publication so channel pages update live.
alter publication supabase_realtime add table public.sos_signals;

-- Atomic broadcast: insert one SOS row per channel the caller belongs to.
-- Returns the IDs of the rows inserted (one per channel) for downstream push.
create or replace function public.send_sos(note text)
returns table (id uuid, channel_id uuid)
language plpgsql
security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  return query
  insert into sos_signals (user_id, channel_id, note)
  select uid, cm.channel_id, send_sos.note
  from channel_members cm
  where cm.user_id = uid
  returning sos_signals.id, sos_signals.channel_id;
end;
$$;

grant execute on function public.send_sos(text) to authenticated;
