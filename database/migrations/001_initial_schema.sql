-- ArgiAI initial production schema for Supabase/PostgreSQL.
-- Run this file in Supabase SQL Editor or with `supabase db push`.

create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  username varchar(50) not null unique,
  password_hash varchar(255) not null,
  email varchar(100) unique,
  full_name varchar(100) not null,
  role varchar(20) not null default 'farmer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_check check (role in ('farmer', 'official', 'admin'))
);

create table if not exists public.crops (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  variety varchar(100) not null,
  growth_duration_days integer not null,
  description text,
  created_at timestamptz not null default now(),
  constraint crops_unique_name_variety unique (name, variety)
);

create table if not exists public.plots (
  id uuid primary key default gen_random_uuid(),
  code varchar(30) not null unique,
  user_id uuid not null references public.users(id) on delete cascade,
  crop_id uuid not null references public.crops(id) on delete restrict,
  area_hectares double precision not null,
  location_lat double precision not null,
  location_lng double precision not null,
  seeding_date date not null,
  status varchar(20) not null default 'growing',
  health varchar(100) not null default 'Khỏe mạnh',
  moisture integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plots_area_check check (area_hectares > 0),
  constraint plots_lat_check check (location_lat between -90 and 90),
  constraint plots_lng_check check (location_lng between -180 and 180),
  constraint plots_status_check check (status in ('growing', 'harvested', 'disease_outbreak')),
  constraint plots_moisture_check check (moisture is null or moisture between 0 and 100)
);

create table if not exists public.disease_logs (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid references public.plots(id) on delete set null,
  reporter_id uuid not null references public.users(id) on delete cascade,
  image_url varchar(500) not null,
  detected_disease varchar(150) not null,
  confidence double precision not null,
  severity varchar(30) not null default 'Trung bình',
  treatment_measures text not null,
  status varchar(20) not null default 'active',
  official_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint disease_confidence_check check (confidence between 0 and 1),
  constraint disease_status_check check (status in ('active', 'resolved'))
);

create table if not exists public.yield_forecasts (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  forecasted_yield_tons double precision not null,
  confidence_score double precision not null,
  optimal_harvest_start date not null,
  optimal_harvest_end date not null,
  weather_advisory text,
  generated_at timestamptz not null default now(),
  constraint yield_amount_check check (forecasted_yield_tons >= 0),
  constraint yield_confidence_check check (confidence_score between 0 and 1),
  constraint yield_window_check check (optimal_harvest_end >= optimal_harvest_start)
);

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references public.crops(id) on delete cascade,
  price_per_kg double precision not null,
  source varchar(150) not null,
  recorded_date date not null,
  created_at timestamptz not null default now(),
  constraint market_price_check check (price_per_kg >= 0),
  constraint market_prices_unique_daily_source unique (crop_id, source, recorded_date)
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  crop_id uuid not null references public.crops(id) on delete cascade,
  target_price double precision not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_alert_target_check check (target_price >= 0)
);

create index if not exists idx_plots_user_id on public.plots(user_id);
create index if not exists idx_plots_crop_id on public.plots(crop_id);
create index if not exists idx_disease_logs_plot_id on public.disease_logs(plot_id);
create index if not exists idx_disease_logs_reporter_id on public.disease_logs(reporter_id);
create index if not exists idx_disease_logs_status on public.disease_logs(status);
create index if not exists idx_yield_forecasts_plot_generated on public.yield_forecasts(plot_id, generated_at desc);
create index if not exists idx_market_prices_crop_date on public.market_prices(crop_id, recorded_date desc);
create index if not exists idx_price_alerts_user_id on public.price_alerts(user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

drop trigger if exists plots_set_updated_at on public.plots;
create trigger plots_set_updated_at
before update on public.plots
for each row execute function public.set_updated_at();

drop trigger if exists price_alerts_set_updated_at on public.price_alerts;
create trigger price_alerts_set_updated_at
before update on public.price_alerts
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.crops enable row level security;
alter table public.plots enable row level security;
alter table public.disease_logs enable row level security;
alter table public.yield_forecasts enable row level security;
alter table public.market_prices enable row level security;
alter table public.price_alerts enable row level security;

-- The backend uses Supabase service-role credentials, which bypass RLS.
-- These permissive read policies are useful only if the frontend later reads public catalog data directly.
drop policy if exists "Public crops are readable" on public.crops;
create policy "Public crops are readable" on public.crops for select using (true);

drop policy if exists "Public market prices are readable" on public.market_prices;
create policy "Public market prices are readable" on public.market_prices for select using (true);
