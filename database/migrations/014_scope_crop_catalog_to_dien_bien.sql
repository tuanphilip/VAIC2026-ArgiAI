-- Normalize the agricultural catalog to crops relevant to Điện Biên.
-- Idempotent: merge legacy crop variants before deleting them.

insert into public.crops (name, variety, growth_duration_days, description)
values
  ('Ngô', 'Ngô địa phương Điện Biên', 100, 'Ngô trồng tại vùng sản xuất Điện Biên; cần cập nhật giống thực tế theo hồ sơ hộ.'),
  ('Rau vụ đông', 'Cải ngọt Điện Biên', 45, 'Rau ngắn ngày phục vụ sản xuất vụ đông tại Điện Biên.'),
  ('Mắc ca', 'Mắc ca Điện Biên', 240, 'Cây lâu năm cần theo dõi độ ẩm, sâu bệnh và độ phù hợp tiểu vùng.'),
  ('Cây ăn quả', 'Cây ăn quả Điện Biên', 180, 'Nhóm cây ăn quả địa phương; cần bổ sung giống cụ thể theo từng thửa.')
on conflict (name, variety) do update set description = excluded.description;

-- Merge legacy variants into the canonical Điện Biên rows.
update public.market_prices mp set crop_id = target.id
from public.crops old, public.crops target
where mp.crop_id = old.id
  and target.name = 'Mắc ca' and target.variety = 'Mắc ca Điện Biên'
  and old.name = 'Mắc ca' and old.variety = 'Mắc ca Tây Bắc';
update public.plots p set crop_id = target.id
from public.crops old, public.crops target
where p.crop_id = old.id
  and target.name = 'Mắc ca' and target.variety = 'Mắc ca Điện Biên'
  and old.name = 'Mắc ca' and old.variety = 'Mắc ca Tây Bắc';
delete from public.crops where name = 'Mắc ca' and variety = 'Mắc ca Tây Bắc';

update public.market_prices mp set crop_id = target.id
from public.crops old, public.crops target
where mp.crop_id = old.id
  and target.name = 'Rau vụ đông' and target.variety = 'Cải ngọt Điện Biên'
  and old.name = 'Rau vụ đông' and old.variety = 'Cải ngọt';
update public.plots p set crop_id = target.id
from public.crops old, public.crops target
where p.crop_id = old.id
  and target.name = 'Rau vụ đông' and target.variety = 'Cải ngọt Điện Biên'
  and old.name = 'Rau vụ đông' and old.variety = 'Cải ngọt';
delete from public.crops where name = 'Rau vụ đông' and variety = 'Cải ngọt';

update public.market_prices mp set crop_id = target.id
from public.crops old, public.crops target
where mp.crop_id = old.id
  and target.name = 'Ngô' and target.variety = 'Ngô địa phương Điện Biên'
  and old.name = 'Ngô' and old.variety in ('Ngô', 'Ngô nếp Sơn La');
update public.plots p set crop_id = target.id
from public.crops old, public.crops target
where p.crop_id = old.id
  and target.name = 'Ngô' and target.variety = 'Ngô địa phương Điện Biên'
  and old.name = 'Ngô' and old.variety in ('Ngô', 'Ngô nếp Sơn La');
delete from public.crops where name = 'Ngô' and variety in ('Ngô', 'Ngô nếp Sơn La');

-- Map any legacy plot whose variety contains the generic Ngô label.
update public.plots p
set crop_id = target.id,
    crop_types = '[{"name":"Ngô","variety":"Ngô địa phương Điện Biên"}]'::jsonb
from public.crops target
where p.code = 'D3'
  and target.name = 'Ngô' and target.variety = 'Ngô địa phương Điện Biên';

-- Map the remaining out-of-scope crop on the Điện Biên plot to local vegetables.
update public.plots p
set crop_id = c.id,
    crop_types = '[{"name":"Rau vụ đông","variety":"Cải ngọt Điện Biên"}]'::jsonb,
    health = 'Cần theo dõi sâu bệnh',
    region = 'Điện Biên'
from public.crops c
where p.code = 'DEMO-DB-003'
  and c.name = 'Rau vụ đông' and c.variety = 'Cải ngọt Điện Biên';

-- Remove historical prices for products outside the Điện Biên catalog.
delete from public.market_prices mp
using public.crops c
where mp.crop_id = c.id
  and not (
    (c.name = 'Lúa' and c.variety = 'Seng Cù Điện Biên') or
    (c.name = 'Cà phê' and c.variety = 'Robusta Mường Ảng') or
    (c.name = 'Rau vụ đông' and c.variety = 'Cải ngọt Điện Biên') or
    (c.name = 'Mắc ca' and c.variety = 'Mắc ca Điện Biên') or
    (c.name = 'Ngô' and c.variety = 'Ngô địa phương Điện Biên')
  );

delete from public.crops c
where not (
  (c.name = 'Lúa' and c.variety = 'Seng Cù Điện Biên') or
  (c.name = 'Cà phê' and c.variety = 'Robusta Mường Ảng') or
  (c.name = 'Rau vụ đông' and c.variety = 'Cải ngọt Điện Biên') or
  (c.name = 'Mắc ca' and c.variety = 'Mắc ca Điện Biên') or
  (c.name = 'Ngô' and c.variety = 'Ngô địa phương Điện Biên') or
  (c.name = 'Cây ăn quả' and c.variety = 'Cây ăn quả Điện Biên')
);
