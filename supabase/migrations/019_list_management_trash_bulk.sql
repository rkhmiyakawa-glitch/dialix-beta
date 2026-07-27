-- DIALIX Beta 1.0.19: リスト管理・ゴミ箱・一括操作
alter table public.lists add column if not exists description text not null default '';
alter table public.lists add column if not exists updated_at timestamptz not null default now();
alter table public.lists add column if not exists deleted_at timestamptz;
create index if not exists lists_deleted_at_idx on public.lists(deleted_at);

-- リスト複製。顧客の基本情報を複製し、過去の架電履歴は複製しません。
create or replace function public.duplicate_dialix_list(source_list_id uuid, new_list_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; caller_role text;
begin
  select role into caller_role from profiles where id = auth.uid() and is_active = true;
  if caller_role not in ('admin','sv') then raise exception '権限がありません'; end if;
  insert into lists(name,description,is_active,customer_count,active_users,created_at,updated_at)
  select new_list_name,description,true,0,0,now(),now() from lists where id=source_list_id returning id into new_id;
  insert into customers(list_id,company_name,phone,address,business_subcategory,status,last_called_at,reminder_at,ap_name,sort_order,created_at,updated_at)
  select new_id,company_name,phone,address,business_subcategory,status,last_called_at,reminder_at,ap_name,sort_order,now(),now() from customers where list_id=source_list_id;
  update lists set customer_count=(select count(*) from customers where list_id=new_id) where id=new_id;
  return new_id;
end $$;
grant execute on function public.duplicate_dialix_list(uuid,text) to authenticated;

create or replace function public.permanently_delete_dialix_list(target_list_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare caller_role text;
begin
  select role into caller_role from profiles where id = auth.uid() and is_active = true;
  if caller_role <> 'admin' then raise exception '管理者権限が必要です'; end if;
  if not exists(select 1 from lists where id=target_list_id and deleted_at is not null) then raise exception 'ゴミ箱内のリストだけ完全削除できます'; end if;
  delete from call_histories where customer_id in (select id from customers where list_id=target_list_id);
  delete from customers where list_id=target_list_id;
  delete from import_batches where list_id=target_list_id;
  delete from lists where id=target_list_id;
end $$;
grant execute on function public.permanently_delete_dialix_list(uuid) to authenticated;

-- 30日を過ぎたゴミ箱を削除する関数。Supabase Cronで1日1回の実行を推奨。
create or replace function public.purge_expired_dialix_lists()
returns integer language plpgsql security definer set search_path = public as $$
declare target record; deleted_count integer := 0;
begin
  for target in select id from lists where deleted_at < now() - interval '30 days' loop
    delete from call_histories where customer_id in (select id from customers where list_id=target.id);
    delete from customers where list_id=target.id;
    delete from import_batches where list_id=target.id;
    delete from lists where id=target.id;
    deleted_count := deleted_count + 1;
  end loop;
  return deleted_count;
end $$;
revoke all on function public.purge_expired_dialix_lists() from public, anon, authenticated;
