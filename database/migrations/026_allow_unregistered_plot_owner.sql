-- Allow officials to register plots before the owner has an account.
-- The entered owner name remains queryable until a user account is linked.

alter table public.plots
  alter column user_id drop not null;

alter table public.plots
  drop constraint if exists plots_user_id_fkey;

alter table public.plots
  add constraint plots_user_id_fkey
  foreign key (user_id) references public.users(id) on delete set null;

alter table public.plots
  add column if not exists owner_name varchar(150);

create index if not exists ix_plots_owner_name on public.plots(owner_name);
