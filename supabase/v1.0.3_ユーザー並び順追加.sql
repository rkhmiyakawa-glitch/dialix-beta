-- DIALIX v1.0.3
-- 管理画面のユーザー並び順を保存する列

alter table public.profiles
  add column if not exists sort_order integer;

with numbered as (
  select id, row_number() over (
    order by sort_order asc nulls last, created_at asc, id asc
  ) - 1 as new_sort_order
  from public.profiles
)
update public.profiles as profiles
set sort_order = numbered.new_sort_order
from numbered
where profiles.id = numbered.id
  and profiles.sort_order is distinct from numbered.new_sort_order;

alter table public.profiles
  alter column sort_order set default 0;

alter table public.profiles
  alter column sort_order set not null;

create index if not exists profiles_sort_order_idx
  on public.profiles(sort_order, created_at);
