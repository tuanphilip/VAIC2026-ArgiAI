create table if not exists public.shipment_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  shipment_code varchar(50) not null unique,
  status varchar(30) not null default 'scheduled',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists shipment_records_owner_idx on public.shipment_records(owner_id);
