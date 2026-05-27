-- 1:1 accountability partner ("buddy"). Distinct from channels (group) —
-- the social cost of letting one specific person down is the active
-- ingredient, so we enforce at most one accepted buddy per user.
--
-- Model: inviter creates a pending row with an unguessable code, shares it
-- out-of-band. The first signed-in user to redeem the code via the RPC
-- becomes the buddy. Symmetric afterwards.

create table public.buddy_links (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid references public.profiles(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'removed', 'declined')) default 'pending',
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  removed_at timestamptz
);

create index buddy_links_inviter_status_idx
  on public.buddy_links (inviter_id, status);
create index buddy_links_invitee_status_idx
  on public.buddy_links (invitee_id, status);

-- A user can be on at most ONE accepted edge — either as inviter or invitee.
-- Two partial unique indexes enforce both halves.
create unique index buddy_links_one_accepted_inviter
  on public.buddy_links (inviter_id) where status = 'accepted';
create unique index buddy_links_one_accepted_invitee
  on public.buddy_links (invitee_id) where status = 'accepted';

alter table public.buddy_links enable row level security;

-- Read your own edges (whether you sent or received the invite).
create policy "buddy_self_read" on public.buddy_links
  for select to authenticated
  using (
    inviter_id = (select auth.uid())
    or invitee_id = (select auth.uid())
  );

-- Only the inviter inserts a pending row, with no invitee yet.
create policy "buddy_self_invite" on public.buddy_links
  for insert to authenticated
  with check (
    inviter_id = (select auth.uid())
    and invitee_id is null
    and status = 'pending'
  );

-- Cancel your own outstanding invite (pending, you are inviter).
create policy "buddy_inviter_cancel" on public.buddy_links
  for delete to authenticated
  using (
    inviter_id = (select auth.uid())
    and status = 'pending'
  );

-- Accept a pending invite by its code. SECURITY DEFINER so the caller can
-- look up a row they don't yet have a row-level read on.
create or replace function public.accept_buddy(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_inviter uuid;
begin
  if v_user is null then
    raise exception 'unauthorized';
  end if;

  select id, inviter_id into v_id, v_inviter
  from public.buddy_links
  where invite_code = p_code and status = 'pending'
  for update;

  if v_id is null then
    raise exception 'invalid_or_used_code';
  end if;

  if v_inviter = v_user then
    raise exception 'cannot_buddy_yourself';
  end if;

  -- Reject if either party already has an accepted buddy.
  if exists (
    select 1 from public.buddy_links
    where status = 'accepted'
      and (inviter_id = v_user or invitee_id = v_user
        or inviter_id = v_inviter or invitee_id = v_inviter)
  ) then
    raise exception 'already_has_buddy';
  end if;

  update public.buddy_links
    set invitee_id = v_user,
        status = 'accepted',
        accepted_at = now()
    where id = v_id;

  return v_id;
end;
$$;

-- End the current buddy relationship. Sets status='removed' on the user's
-- one accepted edge. Either party can end it.
create or replace function public.remove_buddy()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then return; end if;

  update public.buddy_links
    set status = 'removed',
        removed_at = now()
    where status = 'accepted'
      and (inviter_id = v_user or invitee_id = v_user);
end;
$$;

grant execute on function public.accept_buddy(text) to authenticated;
grant execute on function public.remove_buddy() to authenticated;
