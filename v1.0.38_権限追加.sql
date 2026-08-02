-- DIALIX v1.0.38
-- 管理者A（admin_a）を profiles.role に追加します。

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('owner', 'admin', 'admin_a', 'sv', 'operator'));

