-- Owner-scoped treatment plans created from a persisted disease diagnosis.
-- Idempotent: safe to apply after migrations 001-024.

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

create index if not exists treatment_plans_owner_created_idx
  on public.treatment_plans(owner_id, created_at desc);
create index if not exists treatment_plans_disease_log_idx
  on public.treatment_plans(disease_log_id);
