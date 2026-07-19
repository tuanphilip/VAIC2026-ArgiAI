-- inventory API: tenant-scoped stock items and immutable movement ledger
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name varchar(150) not null,
  category varchar(30) not null,
  quantity numeric(14,3) not null default 0 check (quantity >= 0),
  unit varchar(30) not null,
  location varchar(120),
  reorder_level numeric(14,3) not null default 0 check (reorder_level >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists inventory_items_owner_idx on public.inventory_items(owner_id);
create index if not exists inventory_items_category_idx on public.inventory_items(owner_id, category);

create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  actor_id uuid not null references public.users(id) on delete restrict,
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  reason varchar(255) not null,
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_item_idx on public.stock_movements(inventory_item_id, created_at desc);
