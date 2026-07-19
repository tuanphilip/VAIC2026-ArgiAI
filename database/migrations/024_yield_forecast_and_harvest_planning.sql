-- Forecast provenance, harvest planning, task workflow, and feedback.
-- Idempotent: safe to apply after migrations 001-023.

alter table public.yield_forecasts
  add column if not exists forecast_method varchar(40) not null default 'heuristic_v1',
  add column if not exists model_version varchar(80) not null default 'heuristic-v1',
  add column if not exists status varchar(30) not null default 'review_required',
  add column if not exists forecasted_yield_min_tons double precision,
  add column if not exists forecasted_yield_max_tons double precision,
  add column if not exists input_snapshot jsonb not null default '{}',
  add column if not exists weather_source varchar(150),
  add column if not exists weather_snapshot jsonb,
  add column if not exists explanation text,
  add column if not exists needs_human_review boolean not null default true;

alter table public.yield_forecasts drop constraint if exists yield_forecast_status_check;
alter table public.yield_forecasts add constraint yield_forecast_status_check
  check (status in ('advisory', 'review_required', 'approved', 'superseded'));
alter table public.yield_forecasts drop constraint if exists yield_forecast_range_check;
alter table public.yield_forecasts add constraint yield_forecast_range_check
  check (forecasted_yield_min_tons is null or forecasted_yield_max_tons is null
    or forecasted_yield_max_tons >= forecasted_yield_min_tons);

create table if not exists public.harvest_plans (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  forecast_id uuid references public.yield_forecasts(id) on delete set null,
  owner_id uuid not null references public.users(id) on delete cascade,
  title varchar(200) not null,
  status varchar(30) not null default 'draft',
  planned_start_date date not null,
  planned_end_date date not null,
  expected_yield_tons double precision,
  actual_yield_tons double precision,
  labor_count integer,
  transport_notes text,
  storage_notes text,
  risk_notes text,
  created_by uuid not null references public.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint harvest_plan_dates_check check (planned_end_date >= planned_start_date),
  constraint harvest_plan_status_check check (status in ('draft', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  constraint harvest_plan_yield_check check (expected_yield_tons is null or expected_yield_tons >= 0)
);

create table if not exists public.harvest_plan_tasks (
  id uuid primary key default gen_random_uuid(),
  harvest_plan_id uuid not null references public.harvest_plans(id) on delete cascade,
  task_type varchar(40) not null,
  title varchar(200) not null,
  description text,
  planned_date date not null,
  completed_at timestamptz,
  status varchar(30) not null default 'pending',
  assigned_to uuid references public.users(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint harvest_task_type_check check (task_type in ('pre_harvest_check', 'weather_check', 'labor_prepare', 'equipment_prepare', 'harvest', 'transport', 'storage', 'quality_check')),
  constraint harvest_task_status_check check (status in ('pending', 'in_progress', 'completed', 'skipped'))
);

create table if not exists public.yield_forecast_feedback (
  id uuid primary key default gen_random_uuid(),
  forecast_id uuid not null references public.yield_forecasts(id) on delete cascade,
  actual_yield_tons double precision,
  actual_harvest_date date,
  reviewer_id uuid references public.users(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_yield_forecasts_status on public.yield_forecasts(status);
create index if not exists idx_harvest_plans_owner_status on public.harvest_plans(owner_id, status);
create index if not exists idx_harvest_plans_plot_dates on public.harvest_plans(plot_id, planned_start_date);
create index if not exists idx_harvest_plan_tasks_plan_date on public.harvest_plan_tasks(harvest_plan_id, planned_date);

drop trigger if exists harvest_plans_set_updated_at on public.harvest_plans;
create trigger harvest_plans_set_updated_at
before update on public.harvest_plans
for each row execute function public.set_updated_at();
