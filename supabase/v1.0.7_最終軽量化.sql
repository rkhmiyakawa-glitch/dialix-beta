-- DIALIX v1.0.7 最終軽量化
-- Supabase SQL Editorで全文を1回実行してください。

create or replace function public.get_list_status_counts()
returns table (
  list_id uuid,
  total_count bigint,
  uncontacted_count bigint,
  absence_count bigint,
  recall_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.list_id,
    count(*) as total_count,
    count(*) filter (
      where c.status is null or c.status = '' or c.status = '未架電'
    ) as uncontacted_count,
    count(*) filter (where c.status = '留守') as absence_count,
    count(*) filter (where c.status = '再コール') as recall_count
  from public.customers c
  join public.lists l on l.id = c.list_id
  where l.is_active = true
  group by c.list_id;
$$;

grant execute on function public.get_list_status_counts() to authenticated;

create index if not exists idx_customers_list_status
  on public.customers (list_id, status);
create index if not exists idx_customers_list_sort
  on public.customers (list_id, sort_order);
create index if not exists idx_customers_phone
  on public.customers (phone);
create index if not exists idx_customers_reminder_at
  on public.customers (reminder_at)
  where reminder_at is not null;
create index if not exists idx_call_histories_user_called
  on public.call_histories (user_id, called_at desc);
create index if not exists idx_call_histories_customer_called
  on public.call_histories (customer_id, called_at desc);
create index if not exists idx_profiles_sort
  on public.profiles (sort_order, created_at);
