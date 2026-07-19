create table if not exists public.seasonal_events (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id) on delete cascade,
 title varchar(200) not null, start_at timestamptz not null, end_at timestamptz, calendar_key varchar(40) not null default 'work', description text,
 created_at timestamptz not null default now()
);
create index if not exists seasonal_events_owner_start_idx on public.seasonal_events(owner_id,start_at);
