-- Persistent agricultural chatbot sessions and messages.
-- Idempotent: safe to run in Supabase SQL Editor more than once.

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  title varchar(200) not null default 'Tư vấn nông nghiệp',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role varchar(20) not null,
  content text not null,
  intent varchar(50),
  confidence double precision,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint chat_messages_role_check check (role in ('user', 'assistant')),
  constraint chat_messages_confidence_check check (confidence is null or confidence between 0 and 1)
);

create index if not exists idx_chat_sessions_user_updated
  on public.chat_sessions(user_id, updated_at desc);
create index if not exists idx_chat_messages_session_created
  on public.chat_messages(session_id, created_at asc);

 drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at
before update on public.chat_sessions
for each row execute function public.set_updated_at();

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

-- The FastAPI service uses the Supabase service role and applies user scoping itself.
