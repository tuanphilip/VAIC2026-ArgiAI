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
