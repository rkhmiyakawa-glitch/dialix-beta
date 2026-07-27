-- DIALIX Beta 1.0.18
-- Supabase SQL Editorで実行してください。

alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.import_batches add column if not exists imported_history_rows integer not null default 0;

-- 管理者がユーザー一覧を参照できるための補助関数
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active = true
  );
$$;

revoke all on function public.is_current_user_admin() from public;
grant execute on function public.is_current_user_admin() to authenticated;

-- 既存ポリシーと重複する場合は、プロジェクトの方針に合わせて調整してください。
drop policy if exists "admins can read all profiles" on public.profiles;
create policy "admins can read all profiles" on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_current_user_admin());

-- CSV取込は管理者/SVのみ
create or replace function public.can_manage_imports()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role in ('admin','sv') and is_active = true);
$$;
grant execute on function public.can_manage_imports() to authenticated;
