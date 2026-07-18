-- Make provenance explicit: these are bootstrap values, not live market quotes.
-- Keep one value per crop/day before changing source, because source is part of the unique key.
with ranked as (
  select id, row_number() over (partition by crop_id, recorded_date order by id) as row_no
  from public.market_prices
)
delete from public.market_prices mp
using ranked r
where mp.id = r.id and r.row_no > 1;

update public.market_prices
set source = 'Dữ liệu khởi tạo Điện Biên — chưa xác minh live';
