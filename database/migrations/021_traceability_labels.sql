create table if not exists public.traceability_labels (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id) on delete cascade,
 lot_name varchar(200) not null, harvest_date date not null, standard varchar(80) not null, farmer varchar(150) not null,
 qr_value varchar(100) not null unique, created_at timestamptz not null default now()
);
create index if not exists traceability_labels_owner_idx on public.traceability_labels(owner_id);
