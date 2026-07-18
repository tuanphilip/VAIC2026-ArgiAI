-- Adds multi-crop support (crop_types) and an owner contact phone to plots.
-- Run this file in Supabase SQL Editor or with `supabase db push`, after 001/002/003.

alter table public.plots
  add column if not exists crop_types jsonb not null default '[]'::jsonb,
  add column if not exists owner_phone varchar(20);

alter table public.plots
  drop constraint if exists plots_crop_types_check;
alter table public.plots
  add constraint plots_crop_types_check check (jsonb_typeof(crop_types) = 'array');

comment on column public.plots.crop_types is
  'Danh sách các loại cây trồng trên thửa đất: mảng [{"name": "Lúa", "variety": "Seng Cù"}, ...]. plots.crop_id/plots.crop vẫn trỏ tới loại cây đầu tiên (cây chính), dùng cho dự báo năng suất và thống kê.';
comment on column public.plots.owner_phone is
  'Số điện thoại liên hệ của chủ sở hữu thửa đất (owner là tên tự do, chưa gắn với bảng users thật).';
