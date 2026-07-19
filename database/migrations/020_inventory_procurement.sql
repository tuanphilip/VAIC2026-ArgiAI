create table if not exists public.suppliers (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id) on delete cascade,
 name varchar(150) not null, contact varchar(100), email varchar(150), address varchar(255), created_at timestamptz not null default now()
);
create table if not exists public.purchase_requests (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id) on delete cascade,
 item_name varchar(150) not null, quantity numeric(14,3) not null check(quantity > 0), supplier_id uuid references public.suppliers(id) on delete set null,
 status varchar(30) not null default 'pending', created_at timestamptz not null default now()
);
create table if not exists public.stock_transfers (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.users(id) on delete cascade,
 item_name varchar(150) not null, quantity numeric(14,3) not null check(quantity > 0), source varchar(120) not null, destination varchar(120) not null,
 created_at timestamptz not null default now()
);
create index if not exists suppliers_owner_idx on public.suppliers(owner_id);
create index if not exists purchase_requests_owner_idx on public.purchase_requests(owner_id);
create index if not exists stock_transfers_owner_idx on public.stock_transfers(owner_id);
