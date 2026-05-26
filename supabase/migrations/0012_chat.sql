-- Chat history with the AI coach. One row per message; assistant messages are
-- stored after the model responds, so a refresh shows the full thread.
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

create policy "chat_self_read" on public.chat_messages
  for select to authenticated using (user_id = (select auth.uid()));

create policy "chat_self_insert" on public.chat_messages
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "chat_self_delete" on public.chat_messages
  for delete to authenticated using (user_id = (select auth.uid()));
