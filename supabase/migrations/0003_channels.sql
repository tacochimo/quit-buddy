-- Atomic join-by-invite-code RPC. SECURITY DEFINER so a non-member can look
-- up the channel by code (the RLS read policy requires membership, which is
-- the chicken-and-egg the function resolves).

create or replace function public.join_channel_by_code(code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  cid uuid;
  cap int;
  current_count int;
begin
  select id, max_members into cid, cap
  from channels
  where invite_code = upper(code);

  if cid is null then
    raise exception 'invalid_invite_code';
  end if;

  select count(*) into current_count from channel_members where channel_id = cid;
  if current_count >= cap then
    raise exception 'channel_full';
  end if;

  insert into channel_members (channel_id, user_id, role)
  values (cid, auth.uid(), 'member')
  on conflict do nothing;

  return cid;
end;
$$;
