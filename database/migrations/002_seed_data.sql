-- Development/demo seed data. Safe to run multiple times.

insert into public.crops (name, variety, growth_duration_days, description)
values
  ('Lúa', 'Seng Cù Điện Biên', 120, 'Giống lúa đặc sản vùng Tây Bắc, phù hợp thung lũng Điện Biên.'),
  ('Cà phê', 'Robusta Mường Ảng', 270, 'Cà phê Robusta trồng tại Mường Ảng, chất lượng ổn định.'),
  ('Rau vụ đông', 'Cải ngọt', 45, 'Rau ngắn ngày phù hợp sản xuất vụ đông.'),
  ('Hồ tiêu', 'Phú Quốc', 240, 'Hồ tiêu chất lượng cao, cần theo dõi sâu bệnh chặt chẽ.')
on conflict (name, variety) do update set
  growth_duration_days = excluded.growth_duration_days,
  description = excluded.description;

insert into public.market_prices (crop_id, price_per_kg, source, recorded_date)
select c.id, v.price_per_kg, v.source, v.recorded_date::date
from (
  values
    ('Lúa', 'Seng Cù Điện Biên', 15800, 'Sở Công Thương Điện Biên', current_date - interval '6 days'),
    ('Lúa', 'Seng Cù Điện Biên', 16000, 'Sở Công Thương Điện Biên', current_date - interval '5 days'),
    ('Lúa', 'Seng Cù Điện Biên', 16150, 'Sở Công Thương Điện Biên', current_date - interval '4 days'),
    ('Lúa', 'Seng Cù Điện Biên', 16300, 'Sở Công Thương Điện Biên', current_date - interval '3 days'),
    ('Lúa', 'Seng Cù Điện Biên', 16450, 'Sở Công Thương Điện Biên', current_date - interval '2 days'),
    ('Lúa', 'Seng Cù Điện Biên', 16600, 'Sở Công Thương Điện Biên', current_date - interval '1 day'),
    ('Lúa', 'Seng Cù Điện Biên', 16800, 'Sở Công Thương Điện Biên', current_date),
    ('Cà phê', 'Robusta Mường Ảng', 84000, 'Sở Công Thương Điện Biên', current_date - interval '2 days'),
    ('Cà phê', 'Robusta Mường Ảng', 84800, 'Sở Công Thương Điện Biên', current_date - interval '1 day'),
    ('Cà phê', 'Robusta Mường Ảng', 86000, 'Sở Công Thương Điện Biên', current_date)
) as v(name, variety, price_per_kg, source, recorded_date)
join public.crops c on c.name = v.name and c.variety = v.variety
on conflict (crop_id, source, recorded_date) do update set
  price_per_kg = excluded.price_per_kg;
