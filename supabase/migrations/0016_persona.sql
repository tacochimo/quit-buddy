-- Selectable AI companion persona. Plain text column (no enum/FK) so adding
-- a new persona is a code-only change. App validates against lib/personas.ts.
alter table public.profiles
  add column coach_persona text not null default 'friend';
