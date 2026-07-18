-- Adds real polygon boundary storage + livestock data to plots,
-- so map-drawn plot boundaries (frontend "Lands" feature) persist permanently.
-- Run this file in Supabase SQL Editor or with `supabase db push`, after 001/002.

alter table public.plots
  add column if not exists boundary jsonb,
  add column if not exists livestock jsonb not null default '[]'::jsonb;

alter table public.plots
  drop constraint if exists plots_boundary_check;
alter table public.plots
  add constraint plots_boundary_check check (
    boundary is null or (
      jsonb_typeof(boundary) = 'array' and jsonb_array_length(boundary) >= 3
    )
  );

alter table public.plots
  drop constraint if exists plots_livestock_check;
alter table public.plots
  add constraint plots_livestock_check check (jsonb_typeof(livestock) = 'array');

comment on column public.plots.boundary is
  'Ranh giới thật của thửa đất: mảng [[lat, lng], ...] theo thứ tự quanh biên (>= 3 điểm). NULL nếu chưa đo đạc/vẽ, frontend sẽ tự ước lượng hình dạng quanh location_lat/location_lng.';
comment on column public.plots.livestock is
  'Vật nuôi trên thửa đất: mảng [{"type": "Bò", "quantity": 4}, ...]. Mặc định mảng rỗng.';
