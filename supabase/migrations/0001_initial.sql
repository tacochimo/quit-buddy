-- Run in Supabase SQL Editor, or via `npx drizzle-kit push` after editing schema.ts.
-- This file is the authoritative initial migration including RLS policies that
-- drizzle-kit does NOT generate.

-- ============================================================================
-- TABLES
-- ============================================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  quit_date timestamptz,
  baseline_cigs_per_day integer,
  cost_per_pack numeric(6,2),
  cigs_per_pack integer default 20,
  created_at timestamptz not null default now()
);

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references public.profiles(id) on delete cascade,
  is_private boolean not null default true,
  max_members integer not null default 50,
  created_at timestamptz not null default now()
);

create type channel_role as enum ('owner', 'member');

create table public.channel_members (
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role channel_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (channel_id, user_id)
);

create type streak_event_type as enum ('quit', 'relapse');

create table public.streak_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type streak_event_type not null,
  occurred_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);

create index streak_events_user_occurred_idx
  on public.streak_events (user_id, occurred_at desc);

create table public.stars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  kind text not null,
  awarded_at timestamptz not null default now()
);

create unique index stars_user_kind_channel_idx
  on public.stars (user_id, kind, coalesce(channel_id, '00000000-0000-0000-0000-000000000000'));

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles        enable row level security;
alter table public.channels        enable row level security;
alter table public.channel_members enable row level security;
alter table public.streak_events   enable row level security;
alter table public.stars           enable row level security;
alter table public.reactions       enable row level security;

-- Helper: is the current user a member of this channel?
create or replace function public.is_channel_member(cid uuid)
returns boolean
language sql security definer set search_path = public
as $$
  select exists (
    select 1 from public.channel_members
    where channel_id = cid and user_id = auth.uid()
  );
$$;

-- profiles: a user can read anyone's profile that shares a channel with them;
--           but can only update their own.
create policy "profiles_self_read" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_channel_peer_read" on public.profiles
  for select using (
    exists (
      select 1
      from public.channel_members me
      join public.channel_members peer using (channel_id)
      where me.user_id = auth.uid() and peer.user_id = profiles.id
    )
  );

create policy "profiles_self_update" on public.profiles
  for update using (id = auth.uid());

-- channels: members can read; owner can update; anyone authenticated can create.
create policy "channels_member_read" on public.channels
  for select using (public.is_channel_member(id));

create policy "channels_authenticated_insert" on public.channels
  for insert with check (created_by = auth.uid());

create policy "channels_owner_update" on public.channels
  for update using (created_by = auth.uid());

create policy "channels_owner_delete" on public.channels
  for delete using (created_by = auth.uid());

-- channel_members: members can see fellow members; users can add themselves
-- (join by invite code is server-side); users can remove themselves.
create policy "members_read" on public.channel_members
  for select using (public.is_channel_member(channel_id));

create policy "members_self_insert" on public.channel_members
  for insert with check (user_id = auth.uid());

create policy "members_self_delete" on public.channel_members
  for delete using (user_id = auth.uid());

-- streak_events: users see their own + channel peers'; only write own.
create policy "streaks_self_read" on public.streak_events
  for select using (user_id = auth.uid());

create policy "streaks_peer_read" on public.streak_events
  for select using (
    exists (
      select 1
      from public.channel_members me
      join public.channel_members peer using (channel_id)
      where me.user_id = auth.uid() and peer.user_id = streak_events.user_id
    )
  );

create policy "streaks_self_insert" on public.streak_events
  for insert with check (user_id = auth.uid());

-- stars: same visibility as streaks.
create policy "stars_self_read" on public.stars
  for select using (user_id = auth.uid());

create policy "stars_peer_read" on public.stars
  for select using (
    channel_id is not null and public.is_channel_member(channel_id)
  );

-- reactions: any channel member can read/write within their channel.
create policy "reactions_member_read" on public.reactions
  for select using (public.is_channel_member(channel_id));

create policy "reactions_member_insert" on public.reactions
  for insert with check (
    from_user_id = auth.uid() and public.is_channel_member(channel_id)
  );
