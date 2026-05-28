-- User-picked animated chat companion. Free for everyone; just visual.
-- NULL = no companion (default), otherwise one of the ids in lib/companions.ts.

alter table public.profiles
  add column companion text;
