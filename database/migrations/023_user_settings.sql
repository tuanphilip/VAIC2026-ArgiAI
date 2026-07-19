create table if not exists public.user_settings (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id) on delete cascade,
 settings jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now(), unique(owner_id)
);
