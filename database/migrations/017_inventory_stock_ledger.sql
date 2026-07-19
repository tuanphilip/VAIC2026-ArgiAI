-- Inventory items and immutable stock movement ledger.
-- Apply after 016_seed_dien_bien_weather_nasa_power.sql.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  name varchar(200) not null,
  category varchar(50) not null,
  quantity double precision not null default 0,
  unit varchar(30) not null,
  min_quantity double precision not null default 0,
  location varchar(100) not null default 'Kho chính',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_quantity_check check (quantity >= 0),
  constraint inventory_min_quantity_check check (min_quantity >= 0)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete cascade,
  quantity_change double precision not null,
  movement_type varchar(20) not null,
  supplier varchar(200),
  note varchar(500),
  created_at timestamptz not null default now(),
  constraint inventory_movement_type_check check (movement_type in ('receipt', 'issue', 'adjustment')),
  constraint inventory_movement_quantity_check check (quantity_change <> 0)
);

create index if not exists idx_inventory_items_owner on public.inventory_items(owner_id);
create index if not exists idx_inventory_items_name on public.inventory_items(name);
create index if not exists idx_inventory_movements_item_date on public.inventory_movements(item_id, created_at desc);
create index if not exists idx_inventory_movements_creator on public.inventory_movements(created_by);

drop trigger if exists inventory_items_set_updated_at on public.inventory_items;
create trigger inventory_items_set_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();
