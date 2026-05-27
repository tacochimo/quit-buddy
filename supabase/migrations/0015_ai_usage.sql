-- Per-call OpenAI usage log. Cost is computed at insert time using the model's
-- price table in lib/ai-usage.ts (stored so it survives price changes).

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null check (source in ('coach', 'nudge')),
  model text not null,
  prompt_tokens int not null,
  completion_tokens int not null,
  total_tokens int generated always as (prompt_tokens + completion_tokens) stored,
  cost_usd numeric(10, 6) not null,
  created_at timestamptz not null default now()
);

create index ai_usage_user_created_idx
  on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;

-- Users see their own usage. Writes go via admin client (service_role).
create policy "ai_usage_self_read" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
