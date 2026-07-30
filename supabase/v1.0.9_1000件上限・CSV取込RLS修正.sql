-- DIALIX v1.0.9
-- CSV取込時の架電履歴・インポート履歴RLS修正
-- Supabase SQL Editorで全文を1回実行してください。

create or replace function public.dialix_is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('owner', 'admin', 'sv')
      and coalesce(is_active, true) = true
  );
$$;

revoke all on function public.dialix_is_manager() from public;
grant execute on function public.dialix_is_manager() to authenticated;

drop policy if exists "dialix_v109_call_histories_insert" on public.call_histories;
create policy "dialix_v109_call_histories_insert"
on public.call_histories
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.dialix_is_manager()
);

drop policy if exists "dialix_v109_import_batches_select" on public.import_batches;
create policy "dialix_v109_import_batches_select"
on public.import_batches
for select
to authenticated
using (public.dialix_is_manager());

drop policy if exists "dialix_v109_import_batches_insert" on public.import_batches;
create policy "dialix_v109_import_batches_insert"
on public.import_batches
for insert
to authenticated
with check (
  imported_by = auth.uid()
  and public.dialix_is_manager()
);

grant select, insert on public.call_histories to authenticated;
grant select, insert on public.import_batches to authenticated;
