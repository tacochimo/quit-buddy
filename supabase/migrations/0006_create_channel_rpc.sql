-- Atomic create-channel-and-add-owner. SECURITY DEFINER bypasses the
-- RETURNING-needs-SELECT RLS issue: an inserted channel isn't yet visible
-- to the caller because they're not a member until the next insert.

create or replace function public.create_channel(channel_name text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  cid uuid;
  code text;
  attempts int := 0;
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if length(trim(channel_name)) < 2 or length(channel_name) > 50 then
    raise exception 'invalid_name';
  end if;

  loop
    attempts := attempts + 1;
    -- 6-char code from unambiguous alphabet (no 0/O/1/I/L).
    code := upper(
      translate(
        substring(md5(random()::text || clock_timestamp()::text), 1, 6),
        '0o1il',
        '23456'
      )
    );

    begin
      insert into channels (name, invite_code, created_by)
      values (trim(channel_name), code, uid)
      returning id into cid;
      exit;
    exception when unique_violation then
      if attempts > 10 then
        raise exception 'could_not_generate_code';
      end if;
    end;
  end loop;

  insert into channel_members (channel_id, user_id, role)
  values (cid, uid, 'owner');

  return cid;
end;
$$;

grant execute on function public.create_channel(text) to authenticated;
