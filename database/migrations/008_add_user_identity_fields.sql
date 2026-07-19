-- Better user identity fields for official search and plot ownership.
alter table public.users
  add column if not exists citizen_id varchar(12),
  add column if not exists phone_number varchar(20);

create unique index if not exists ux_users_citizen_id
  on public.users(citizen_id)
  where citizen_id is not null;

create index if not exists idx_users_phone_number on public.users(phone_number);
