-- Add tables to Supabase's default realtime publication so postgres_changes
-- events fire for our subscribers. RLS still scopes what each client receives.

alter publication supabase_realtime add table public.reactions;
alter publication supabase_realtime add table public.streak_events;
alter publication supabase_realtime add table public.stars;
alter publication supabase_realtime add table public.channel_members;
