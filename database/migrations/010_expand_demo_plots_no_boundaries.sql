-- Expand the demo directory to 20 parcels.
-- Deliberately leaves boundary NULL: officials/households draw parcel boundaries manually.

update public.plots set boundary = null where code like 'DEMO-%';

insert into public.plots (
  code, user_id, crop_id, area_hectares, location_lat, location_lng,
  seeding_date, status, health, moisture, boundary, livestock, crop_types,
  owner_phone, region
)
select v.code, u.id, c.id, v.area_hectares, v.lat, v.lng, current_date - v.age,
       v.status, v.health, v.moisture, null, v.livestock::jsonb,
       v.crop_types::jsonb, v.phone, v.region
from (values
  ('DEMO-DB-004', 'nongdan_dienbien', 'Lúa', 'Seng Cù Điện Biên', 1.80, 21.3921, 103.0284, 64, 'growing', 'Khỏe mạnh', 70, '[{"type":"Trâu","quantity":1}]', '[{"type":"Lúa nước","area_hectares":1.8}]', '0912000001', 'Điện Biên'),
  ('DEMO-DB-005', 'nongdan_dienbien', 'Mắc ca', 'Mắc ca Tây Bắc', 3.40, 21.4157, 103.0452, 176, 'growing', 'Khỏe mạnh', 52, '[]', '[{"type":"Mắc ca","area_hectares":3.4}]', '0912000001', 'Điện Biên'),
  ('DEMO-SL-003', 'nongdan_demo', 'Ngô', 'Ngô nếp Sơn La', 2.60, 21.3298, 103.9287, 48, 'growing', 'Khỏe mạnh', 63, '[{"type":"Bò","quantity":2}]', '[{"type":"Ngô nếp","area_hectares":2.6}]', '0912000002', 'Sơn La'),
  ('DEMO-SL-004', 'nongdan_demo', 'Rau vụ đông', 'Cải ngọt', 0.72, 21.3442, 103.9011, 21, 'growing', 'Cảnh báo độ ẩm', 79, '[{"type":"Gà","quantity":18}]', '[{"type":"Rau ăn lá","area_hectares":0.72}]', '0912000002', 'Sơn La'),
  ('DEMO-MC-002', 'nongdan_mocchau', 'Ngô', 'Ngô nếp Sơn La', 2.95, 20.8469, 104.6651, 43, 'growing', 'Khỏe mạnh', 60, '[{"type":"Bò","quantity":5}]', '[{"type":"Ngô nếp","area_hectares":2.95}]', '0912000003', 'Mộc Châu'),
  ('DEMO-MC-003', 'nongdan_mocchau', 'Mắc ca', 'Mắc ca Tây Bắc', 4.25, 20.8714, 104.6382, 286, 'growing', 'Khỏe mạnh', 57, '[{"type":"Dê","quantity":6}]', '[{"type":"Mắc ca","area_hectares":4.25}]', '0912000003', 'Mộc Châu'),
  ('DEMO-SP-002', 'nongdan_sapa', 'Rau vụ đông', 'Cải ngọt', 0.64, 22.3412, 103.8504, 31, 'growing', 'Khỏe mạnh', 76, '[{"type":"Gà","quantity":24}]', '[{"type":"Rau ăn lá","area_hectares":0.64}]', '0912000004', 'Sa Pa'),
  ('DEMO-SP-003', 'nongdan_sapa', 'Ngô', 'Ngô nếp Sơn La', 1.90, 22.3127, 103.8651, 55, 'growing', 'Cần theo dõi sâu lá', 68, '[{"type":"Lợn bản","quantity":3}]', '[{"type":"Ngô nếp","area_hectares":1.9}]', '0912000004', 'Sa Pa'),
  ('DEMO-YB-002', 'nongdan_yenbai', 'Cà phê', 'Robusta Mường Ảng', 2.75, 21.7383, 104.9278, 198, 'growing', 'Khỏe mạnh', 55, '[{"type":"Dê","quantity":4}]', '[{"type":"Cà phê","area_hectares":2.75}]', '0912000005', 'Yên Bái'),
  ('DEMO-YB-003', 'nongdan_yenbai', 'Lúa', 'Seng Cù Điện Biên', 1.35, 21.7041, 104.8992, 73, 'harvested', 'Đã thu hoạch', 42, '[{"type":"Trâu","quantity":1}]', '[{"type":"Lúa nước","area_hectares":1.35}]', '0912000005', 'Yên Bái'),
  ('DEMO-YB-004', 'nongdan_yenbai', 'Hồ tiêu', 'Phú Quốc', 1.10, 21.6817, 104.9415, 226, 'disease_outbreak', 'Cảnh báo đốm lá', 48, '[{"type":"Gà","quantity":12}]', '[{"type":"Hồ tiêu","area_hectares":1.1}]', '0912000005', 'Yên Bái')
) as v(code, username, crop_name, variety, area_hectares, lat, lng, age, status, health, moisture, livestock, crop_types, phone, region)
join public.users u on u.username = v.username
join public.crops c on c.name = v.crop_name and c.variety = v.variety
on conflict (code) do update set
  user_id = excluded.user_id, crop_id = excluded.crop_id, area_hectares = excluded.area_hectares,
  location_lat = excluded.location_lat, location_lng = excluded.location_lng,
  seeding_date = excluded.seeding_date, status = excluded.status, health = excluded.health,
  moisture = excluded.moisture, boundary = null, livestock = excluded.livestock,
  crop_types = excluded.crop_types, owner_phone = excluded.owner_phone, region = excluded.region;
