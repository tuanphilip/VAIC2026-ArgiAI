-- Persisted weather/disaster warnings used by the list/detail API.
-- Idempotent: safe to apply to existing production databases.

create table if not exists public.disaster_warnings (
  id uuid primary key default gen_random_uuid(),
  type varchar(50) not null,
  severity varchar(20) not null,
  title varchar(255) not null,
  description text not null,
  affected_region text not null,
  start_date timestamptz not null,
  end_date timestamptz,
  source varchar(100) not null,
  raw_data text,
  created_at timestamptz not null default now()
);

create index if not exists idx_disaster_warnings_type on public.disaster_warnings(type);
create index if not exists idx_disaster_warnings_start_date on public.disaster_warnings(start_date desc);
create index if not exists idx_disaster_warnings_source on public.disaster_warnings(source);

alter table public.disaster_warnings enable row level security;

drop policy if exists "Public disaster warnings are readable" on public.disaster_warnings;
create policy "Public disaster warnings are readable"
  on public.disaster_warnings for select using (true);
