-- Rich demo dataset for ArgiAI. Safe to run repeatedly.
-- Uses existing demo users; it never creates or changes passwords.

-- Catalog
insert into public.crops (name, variety, growth_duration_days, description)
values
  ('Lúa', 'Seng Cù Điện Biên', 120, 'Lúa đặc sản vùng Tây Bắc, phù hợp thung lũng Điện Biên.'),
  ('Cà phê', 'Robusta Mường Ảng', 270, 'Cà phê Robusta vùng cao, theo dõi độ ẩm và sâu bệnh.'),
  ('Rau vụ đông', 'Cải ngọt', 45, 'Rau ngắn ngày, quay vòng nhanh trong vụ đông.'),
  ('Hồ tiêu', 'Phú Quốc', 240, 'Hồ tiêu chất lượng cao, cần kiểm soát nấm bệnh.'),
  ('Mắc ca', 'Mắc ca Tây Bắc', 240, 'Cây lâu năm phù hợp vùng đồi cao, giá trị kinh tế tốt.'),
  ('Ngô', 'Ngô nếp Sơn La', 100, 'Ngô nếp phục vụ thị trường thực phẩm tươi.')
on conflict (name, variety) do update set
  growth_duration_days = excluded.growth_duration_days,
  description = excluded.description;

-- 14-day price history for charts and alerts.
insert into public.market_prices (crop_id, price_per_kg, source, recorded_date)
select c.id,
       round((v.base_price + v.daily_delta * s.day_no + (s.day_no % 3) * v.jitter)::numeric, 0)::double precision,
       'Dữ liệu demo ArgiAI',
       current_date - (13 - s.day_no)
from (values
  ('Lúa', 'Seng Cù Điện Biên', 15800::double precision, 230::double precision, 35::double precision),
  ('Cà phê', 'Robusta Mường Ảng', 82000::double precision, 900::double precision, 250::double precision),
  ('Rau vụ đông', 'Cải ngọt', 18000::double precision, 120::double precision, 80::double precision),
  ('Hồ tiêu', 'Phú Quốc', 92000::double precision, -180::double precision, 300::double precision),
  ('Mắc ca', 'Mắc ca Tây Bắc', 145000::double precision, 1100::double precision, 450::double precision),
  ('Ngô', 'Ngô nếp Sơn La', 12500::double precision, 160::double precision, 50::double precision)
) as v(name, variety, base_price, daily_delta, jitter)
join public.crops c on c.name = v.name and c.variety = v.variety
cross join generate_series(0, 13) as s(day_no)
on conflict (crop_id, source, recorded_date) do update set price_per_kg = excluded.price_per_kg;

-- Representative plots. Existing rows with these codes are updated, not duplicated.
insert into public.plots (
  code, user_id, crop_id, area_hectares, location_lat, location_lng,
  seeding_date, status, health, moisture, boundary, livestock, crop_types,
  owner_phone, region
)
select v.code, u.id, c.id, v.area_hectares, v.lat, v.lng, v.seeding_date::date,
       v.status, v.health, v.moisture, v.boundary::jsonb, v.livestock::jsonb,
       v.crop_types::jsonb, v.owner_phone, v.region
from (values
  ('DEMO-DB-001', 'nongdan_dienbien', 'Lúa', 'Seng Cù Điện Biên', 2.40, 21.3852, 103.0168, current_date - 76, 'growing', 'Khỏe mạnh', 68, '[[21.3839,103.0154],[21.3861,103.0151],[21.3868,103.0185],[21.3845,103.0191]]', '[{"type":"Trâu","quantity":2}]', '[{"type":"Lúa nước","area_hectares":2.4}]', '0912000001', 'Điện Biên'),
  ('DEMO-DB-002', 'nongdan_dienbien', 'Cà phê', 'Robusta Mường Ảng', 4.80, 21.5284, 103.2236, current_date - 188, 'growing', 'Cần theo dõi nấm lá', 54, '[[21.5268,103.2213],[21.5302,103.2218],[21.5307,103.2255],[21.5274,103.2250]]', '[{"type":"Gà thả đồi","quantity":35}]', '[{"type":"Cà phê","area_hectares":4.8}]', '0912000001', 'Mường Ảng'),
  ('DEMO-SL-001', 'nongdan_demo', 'Ngô', 'Ngô nếp Sơn La', 3.10, 21.3272, 103.9141, current_date - 52, 'growing', 'Khỏe mạnh', 61, '[[21.3258,103.9127],[21.3284,103.9123],[21.3291,103.9156],[21.3265,103.9162]]', '[{"type":"Bò","quantity":4}]', '[{"type":"Ngô nếp","area_hectares":3.1}]', '0912000002', 'Sơn La'),
  ('DEMO-LC-001', 'nongdan_demo', 'Rau vụ đông', 'Cải ngọt', 0.85, 22.4856, 103.9754, current_date - 24, 'growing', 'Khỏe mạnh', 73, '[[22.4849,103.9744],[22.4867,103.9741],[22.4871,103.9763],[22.4852,103.9767]]', '[]', '[{"type":"Rau ăn lá","area_hectares":0.85}]', '0912000002', 'Lào Cai'),
  ('DEMO-DB-003', 'nongdan_dienbien', 'Hồ tiêu', 'Phú Quốc', 1.70, 21.4014, 103.0112, current_date - 214, 'disease_outbreak', 'Cảnh báo: đốm lá', 46, '[[21.4002,103.0098],[21.4025,103.0096],[21.4030,103.0123],[21.4008,103.0128]]', '[]', '[{"type":"Hồ tiêu","area_hectares":1.7}]', '0912000001', 'Điện Biên')
) as v(code, username, crop_name, variety, area_hectares, lat, lng, seeding_date, status, health, moisture, boundary, livestock, crop_types, owner_phone, region)
join public.users u on u.username = v.username
join public.crops c on c.name = v.crop_name and c.variety = v.variety
on conflict (code) do update set
  user_id = excluded.user_id, crop_id = excluded.crop_id, area_hectares = excluded.area_hectares,
  location_lat = excluded.location_lat, location_lng = excluded.location_lng,
  seeding_date = excluded.seeding_date, status = excluded.status, health = excluded.health,
  moisture = excluded.moisture, boundary = excluded.boundary, livestock = excluded.livestock,
  crop_types = excluded.crop_types, owner_phone = excluded.owner_phone, region = excluded.region;

-- Yield cards shown on the dashboard.
insert into public.yield_forecasts (
  id, plot_id, forecasted_yield_tons, confidence_score,
  optimal_harvest_start, optimal_harvest_end, weather_advisory, generated_at
)
select x.id::uuid, p.id, x.yield_tons, 0.5, current_date + x.start_offset,
       current_date + x.end_offset, x.advisory, now() - x.generated_offset
from (values
  ('10000000-0000-4000-8000-000000000001', 'DEMO-DB-001', 11.80, 24, 31, '[HEURISTIC] Theo dõi mưa lớn trước thu hoạch lúa.', interval '1 day'),
  ('10000000-0000-4000-8000-000000000002', 'DEMO-DB-002', 8.40, 68, 78, '[HEURISTIC] Ưu tiên kiểm tra nấm lá sau các đợt mưa.', interval '2 days'),
  ('10000000-0000-4000-8000-000000000003', 'DEMO-SL-001', 9.10, 30, 38, '[HEURISTIC] Độ ẩm đang phù hợp cho giai đoạn phát triển.', interval '3 days'),
  ('10000000-0000-4000-8000-000000000004', 'DEMO-LC-001', 2.15, 12, 18, '[HEURISTIC] Rau ngắn ngày: kiểm tra sâu ăn lá mỗi sáng.', interval '4 days')
) as x(id, code, yield_tons, start_offset, end_offset, advisory, generated_offset)
join public.plots p on p.code = x.code
on conflict (id) do update set
  plot_id = excluded.plot_id, forecasted_yield_tons = excluded.forecasted_yield_tons,
  confidence_score = excluded.confidence_score, optimal_harvest_start = excluded.optimal_harvest_start,
  optimal_harvest_end = excluded.optimal_harvest_end, weather_advisory = excluded.weather_advisory,
  generated_at = excluded.generated_at;

-- Disease history for the disease panel and plot detail page.
insert into public.disease_logs (
  id, plot_id, reporter_id, image_url, detected_disease, confidence,
  severity, treatment_measures, status, official_notes, created_at
)
select x.id::uuid, p.id, u.id, x.image_url, x.disease, x.confidence,
       x.severity, x.treatment, x.status, x.notes, now() - x.age
from (values
  ('20000000-0000-4000-8000-000000000001', 'DEMO-DB-003', 'nongdan_dienbien', 'https://images.unsplash.com/photo-1598512752271-33f913a5af13?w=1200', 'Đốm lá do nấm', 0.50, 'Cao', 'Cắt bỏ lá bệnh, tăng thông thoáng và tham vấn cán bộ nông nghiệp trước khi dùng thuốc.', 'active', 'Cần kiểm tra lại sau 72 giờ.', interval '2 days'),
  ('20000000-0000-4000-8000-000000000002', 'DEMO-DB-002', 'nongdan_dienbien', 'https://images.unsplash.com/photo-1499529112087-3cb3b73cec95?w=1200', 'Nghi ngờ rỉ sắt cà phê', 0.50, 'Trung bình', 'Theo dõi mặt dưới lá và loại bỏ lá có triệu chứng lan rộng.', 'resolved', 'Đã xử lý vệ sinh vườn; chưa ghi nhận lan rộng.', interval '9 days'),
  ('20000000-0000-4000-8000-000000000003', 'DEMO-SL-001', 'nongdan_demo', 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=1200', 'Sâu keo mùa thu', 0.50, 'Thấp', 'Kiểm tra ổ trứng, ưu tiên biện pháp sinh học và ghi nhận mật độ sâu.', 'resolved', 'Mật độ đã giảm sau canh tác thủ công.', interval '16 days')
) as x(id, code, username, image_url, disease, confidence, severity, treatment, status, notes, age)
join public.plots p on p.code = x.code
join public.users u on u.username = x.username
on conflict (id) do update set
  plot_id = excluded.plot_id, detected_disease = excluded.detected_disease,
  confidence = excluded.confidence, severity = excluded.severity,
  treatment_measures = excluded.treatment_measures, status = excluded.status,
  official_notes = excluded.official_notes, created_at = excluded.created_at;

-- Alert cards: latest Robusta price exceeds target.
insert into public.price_alerts (id, user_id, crop_id, target_price, is_active)
select '30000000-0000-4000-8000-000000000001'::uuid, u.id, c.id, 85000, true
from public.users u
join public.crops c on c.name = 'Cà phê' and c.variety = 'Robusta Mường Ảng'
where u.username = 'nongdan_dienbien'
on conflict (id) do update set target_price = excluded.target_price, is_active = excluded.is_active;

-- Persistent warning cards. These are demo records, not live upstream claims.
insert into public.disaster_warnings (
  id, type, severity, title, description, affected_region,
  start_date, end_date, source, raw_data
)
values
  ('40000000-0000-4000-8000-000000000001', 'heavy_rain', 'high',
   'Mưa lớn cục bộ tại Điện Biên',
   'Mưa lớn có thể gây úng tạm thời tại vùng trũng. Kiểm tra bờ bao, rãnh thoát nước và lịch phun/xử lý trên ruộng lúa.',
   '[{"lat":21.38,"lng":103.02},{"lat":21.43,"lng":103.08}]',
   now() - interval '3 hours', now() + interval '18 hours', 'Dữ liệu demo ArgiAI', '{"demo":true,"source":"seed"}'),
  ('40000000-0000-4000-8000-000000000002', 'heatwave', 'medium',
   'Nắng nóng tại Mường Ảng',
   'Nhiệt độ cao trong buổi trưa. Ưu tiên kiểm tra ẩm đất trước khi tưới và tránh thao tác ngoài đồng lúc nắng gắt.',
   '[{"lat":21.50,"lng":103.19},{"lat":21.57,"lng":103.27}]',
   now() - interval '1 day', now() + interval '2 days', 'Dữ liệu demo ArgiAI', '{"demo":true,"source":"seed"}')
on conflict (id) do update set
  type = excluded.type, severity = excluded.severity, title = excluded.title,
  description = excluded.description, affected_region = excluded.affected_region,
  start_date = excluded.start_date, end_date = excluded.end_date,
  source = excluded.source, raw_data = excluded.raw_data;
