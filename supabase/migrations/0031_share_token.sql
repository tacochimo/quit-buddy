-- Public share token. Lets a user generate a no-auth URL that renders their
-- current streak as a shareable card. Created lazily on first share; can be
-- rotated (just set to NULL and the next share regenerates).

alter table public.profiles
  add column share_token text unique;
