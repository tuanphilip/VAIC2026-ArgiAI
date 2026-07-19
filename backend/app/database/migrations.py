"""Idempotent runtime migrations for tables added after the initial schema.

The deployment image only contains ``backend/``. Keeping these small, additive
migrations here prevents a deployed API from advertising routes backed by
missing tables. Every statement is safe to run repeatedly.
"""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine


_MIGRATIONS = (
    (
        "003_plot_geometry_and_livestock",
        """
        alter table public.plots add column if not exists boundary jsonb;
        alter table public.plots add column if not exists livestock jsonb not null default '[]'::jsonb;
        """,
    ),
    (
        "004_plot_crop_types_and_owner_phone",
        """
        alter table public.plots add column if not exists crop_types jsonb not null default '[]'::jsonb;
        alter table public.plots add column if not exists owner_phone varchar(20);
        """,
    ),
    (
        "005_plot_region",
        """
        alter table public.plots add column if not exists region varchar(100);
        create index if not exists ix_plots_region on public.plots(region);
        """,
    ),
    (
        "006_disaster_warnings",
        """
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
        create index if not exists idx_disaster_warnings_start_date on public.disaster_warnings(start_date desc);
        """,
    ),
    (
        "008_user_identity_fields",
        """
        alter table public.users add column if not exists citizen_id varchar(12);
        alter table public.users add column if not exists phone_number varchar(20);
        create index if not exists idx_users_phone_number on public.users(phone_number);
        """,
    ),
    (
        "012_chat_history",
        """
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
          created_at timestamptz not null default now()
        );
        create index if not exists idx_chat_sessions_user_updated on public.chat_sessions(user_id, updated_at desc);
        create index if not exists idx_chat_messages_session_created on public.chat_messages(session_id, created_at asc);
        """,
    ),
    (
        "022_seasonal_events",
        """
        create table if not exists public.seasonal_events (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          title varchar(200) not null,
          start_at timestamptz not null,
          end_at timestamptz,
          calendar_key varchar(40) not null default 'work',
          description text,
          created_at timestamptz not null default now()
        );
        create index if not exists seasonal_events_owner_start_idx on public.seasonal_events(owner_id, start_at);
        """,
    ),
    (
        "023_user_settings",
        """
        create table if not exists public.user_settings (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          settings jsonb not null default '{}'::jsonb,
          updated_at timestamptz not null default now(),
          unique(owner_id)
        );
        """,
    ),
    (
        "017_inventory_and_stock_movements",
        """
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
        """,
    ),
    (
        "018_shipment_records",
        """
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
        """,
    ),
    (
        "019_finance_transactions",
        """
        create table if not exists public.finance_transactions (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          title varchar(200) not null,
          type varchar(20) not null check (type in ('income','expense')),
          amount numeric(16,2) not null check (amount >= 0),
          category varchar(100) not null,
          transaction_date date not null default current_date,
          created_at timestamptz not null default now()
        );
        create index if not exists finance_transactions_owner_date_idx on public.finance_transactions(owner_id, transaction_date desc);
        """,
    ),
    (
        "020_inventory_procurement",
        """
        create table if not exists public.suppliers (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          name varchar(150) not null,
          contact varchar(100),
          email varchar(150),
          address varchar(255),
          created_at timestamptz not null default now()
        );
        create table if not exists public.purchase_requests (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          item_name varchar(150) not null,
          quantity numeric(14,3) not null check(quantity > 0),
          supplier_id uuid references public.suppliers(id) on delete set null,
          status varchar(30) not null default 'pending',
          created_at timestamptz not null default now()
        );
        create table if not exists public.stock_transfers (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          item_name varchar(150) not null,
          quantity numeric(14,3) not null check(quantity > 0),
          source varchar(120) not null,
          destination varchar(120) not null,
          created_at timestamptz not null default now()
        );
        create index if not exists suppliers_owner_idx on public.suppliers(owner_id);
        create index if not exists purchase_requests_owner_idx on public.purchase_requests(owner_id);
        create index if not exists stock_transfers_owner_idx on public.stock_transfers(owner_id);
        """,
    ),
    (
        "021_traceability_labels",
        """
        create table if not exists public.traceability_labels (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          lot_name varchar(200) not null,
          harvest_date date not null,
          standard varchar(80) not null,
          farmer varchar(150) not null,
          qr_value varchar(100) not null unique,
          created_at timestamptz not null default now()
        );
        create index if not exists traceability_labels_owner_idx on public.traceability_labels(owner_id);
        """,
    ),
    (
        "025_treatment_plans",
        """
        create table if not exists public.treatment_plans (
          id uuid primary key default gen_random_uuid(),
          owner_id uuid not null references public.users(id) on delete cascade,
          disease_log_id uuid not null references public.disease_logs(id) on delete cascade,
          plot_label varchar(200) not null,
          treatment_agent varchar(200) not null,
          interval_days integer not null check (interval_days between 3 and 90),
          status varchar(20) not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );
        create index if not exists treatment_plans_owner_created_idx on public.treatment_plans(owner_id, created_at desc);
        create index if not exists treatment_plans_disease_log_idx on public.treatment_plans(disease_log_id);
        """,
    ),
)
async def run_runtime_migrations(engine: AsyncEngine) -> None:
    for migration_name, sql in _MIGRATIONS:
        try:
            async with engine.begin() as connection:
                for statement in sql.split(";"):
                    statement = statement.strip()
                    if statement:
                        await connection.execute(text(statement))
            print(f"database migration ready: {migration_name}")
        except Exception as exc:  # noqa: BLE001
            # Migrations are additive and independent. A pre-existing object or
            # legacy schema mismatch must not roll back unrelated fixes.
            print(f"database migration skipped: {migration_name} ({exc.__class__.__name__})")