-- Demo household/user directory records. Passwords are random and intentionally unknown.
-- Existing demo accounts get stable identity fields; new farmer records are data-only.

insert into public.users (username, password_hash, email, citizen_id, phone_number, full_name, role)
values
  ('nongdan_mocchau', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')), 'ho.mocchau@demo.argiai.local', '010203040506', '0912000003', 'Lò Thị Mai', 'farmer'),
  ('nongdan_sapa', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')), 'ho.sapa@demo.argiai.local', '010203040507', '0912000004', 'Vàng A Páo', 'farmer'),
  ('nongdan_yenbai', crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf')), 'ho.yenbai@demo.argiai.local', '010203040508', '0912000005', 'Nguyễn Thị Hương', 'farmer')
on conflict (username) do update set
  email = excluded.email,
  citizen_id = excluded.citizen_id,
  phone_number = excluded.phone_number,
  full_name = excluded.full_name,
  role = excluded.role;

update public.users set email = 'ho.dienbien@demo.argiai.local', citizen_id = '010203040501', phone_number = '0912000001'
where username = 'nongdan_dienbien';
update public.users set email = 'ho.sonla@demo.argiai.local', citizen_id = '010203040502', phone_number = '0912000002'
where username = 'nongdan_demo';

-- Extra parcels make official search/show all households meaningful.
insert into public.plots (
  code, user_id, crop_id, area_hectares, location_lat, location_lng,
  seeding_date, status, health, moisture, boundary, livestock, crop_types,
  owner_phone, region
)
select v.code, u.id, c.id, v.area_hectares, v.lat, v.lng, current_date - v.age,
       v.status, v.health, v.moisture, v.boundary::jsonb, v.livestock::jsonb,
       v.crop_types::jsonb, v.phone, v.region
from (values
  ('DEMO-SL-002', 'nongdan_mocchau', 'Cà phê', 'Robusta Mường Ảng', 2.20, 20.8501, 104.6297, 92, 'growing', 'Khỏe mạnh', 64, '[[20.8488,104.6279],[20.8511,104.6282],[20.8514,104.6310],[20.8490,104.6307]]', '[{"type":"Bò","quantity":3}]', '[{"type":"Cà phê","area_hectares":2.2}]', '0912000003', 'Mộc Châu'),
  ('DEMO-LC-002', 'nongdan_sapa', 'Rau vụ đông', 'Cải ngọt', 1.15, 22.3364, 103.8438, 38, 'growing', 'Cảnh báo độ ẩm', 81, '[[22.3354,103.8425],[22.3373,103.8422],[22.3377,103.8450],[22.3358,103.8454]]', '[]', '[{"type":"Rau ăn lá","area_hectares":1.15}]', '0912000004', 'Sa Pa'),
  ('DEMO-YB-001', 'nongdan_yenbai', 'Mắc ca', 'Mắc ca Tây Bắc', 5.60, 21.7208, 104.9110, 310, 'growing', 'Khỏe mạnh', 58, '[[21.7189,104.9087],[21.7222,104.9093],[21.7227,104.9134],[21.7195,104.9128]]', '[{"type":"Dê","quantity":8}]', '[{"type":"Mắc ca","area_hectares":5.6}]', '0912000005', 'Yên Bái')
) as v(code, username, crop_name, variety, area_hectares, lat, lng, age, status, health, moisture, boundary, livestock, crop_types, phone, region)
join public.users u on u.username = v.username
join public.crops c on c.name = v.crop_name and c.variety = v.variety
on conflict (code) do update set
  user_id = excluded.user_id, crop_id = excluded.crop_id, area_hectares = excluded.area_hectares,
  location_lat = excluded.location_lat, location_lng = excluded.location_lng,
  seeding_date = excluded.seeding_date, status = excluded.status, health = excluded.health,
  moisture = excluded.moisture, boundary = excluded.boundary, livestock = excluded.livestock,
  crop_types = excluded.crop_types, owner_phone = excluded.owner_phone, region = excluded.region;
