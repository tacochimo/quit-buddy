-- Temporary debug helper. Returns whatever auth.uid() evaluates to inside
-- the PostgREST request. Used to diagnose RLS auth mismatches.
create or replace function public.whoami()
returns text
language sql
stable
as $$
  select coalesce(auth.uid()::text, 'NULL');
$$;

grant execute on function public.whoami() to authenticated, anon;
