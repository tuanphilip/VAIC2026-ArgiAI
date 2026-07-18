-- Scope demo/operational plot data to Điện Biên, Vietnam.
-- Idempotent and safe to rerun.

update public.plots
set region = 'Điện Biên'
where region = 'Mường Ảng' or region is null;

delete from public.plots
where coalesce(region, '') <> 'Điện Biên';

create index if not exists idx_plots_dien_bien_region on public.plots(region);
