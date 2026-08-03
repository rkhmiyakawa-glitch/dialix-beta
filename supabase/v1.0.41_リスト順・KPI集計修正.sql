-- DIALIX v1.0.41
-- Owner限定のリスト並び替えと、KPI・レポート集計の修正
-- Supabase SQL Editorで全文を1回実行してください。

alter table public.lists add column if not exists sort_order integer;

with numbered as (
  select id, row_number() over (
    order by sort_order asc nulls last, created_at asc, id asc
  )::integer as next_order
  from public.lists
)
update public.lists as target
set sort_order = numbered.next_order
from numbered
where target.id = numbered.id
  and target.sort_order is null;

create or replace function public.dialix_is_kpi_viewer()
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
      and lower(coalesce(role, '')) in ('owner', 'admin', 'admin_a', 'sv', 'supervisor')
      and coalesce(is_active, true) = true
  );
$$;

revoke all on function public.dialix_is_kpi_viewer() from public;
grant execute on function public.dialix_is_kpi_viewer() to authenticated;

drop policy if exists "dialix_v1041_call_histories_select" on public.call_histories;
create policy "dialix_v1041_call_histories_select"
on public.call_histories
for select
to authenticated
using (user_id = auth.uid() or public.dialix_is_kpi_viewer());

create or replace function public.reorder_dialix_lists(order_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) = 'owner'
      and coalesce(is_active, true) = true
  ) then
    raise exception 'リストの順番を変更できるのはオーナーだけです。';
  end if;

  update public.lists as target
  set sort_order = source.sort_order,
      updated_at = now()
  from (
    select (item->>'listId')::uuid as list_id,
           (item->>'sortOrder')::integer as sort_order
    from jsonb_array_elements(coalesce(order_rows, '[]'::jsonb)) as item
  ) as source
  where target.id = source.list_id;
end;
$$;

revoke all on function public.reorder_dialix_lists(jsonb) from public;
grant execute on function public.reorder_dialix_lists(jsonb) to authenticated;

create or replace function public.get_daily_operator_kpi(target_date date)
returns table (
  user_id uuid,
  display_name text,
  role text,
  call_count bigint,
  valid_count bigint,
  decision_count bigint,
  prospect_count bigint,
  tossup_count bigint,
  re_call_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dialix_is_kpi_viewer() then
    raise exception 'KPIを閲覧する権限がありません。';
  end if;

  return query
  select p.id,
         coalesce(p.display_name, p.email, '名称未設定')::text,
         coalesce(p.role, 'operator')::text,
         count(h.id)::bigint,
         count(h.id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
         count(h.id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint,
         count(h.id) filter (where coalesce(h.status, '') like '%見込み%')::bigint,
         count(h.id) filter (where h.status = 'トスアップ')::bigint,
         count(h.id) filter (where h.status in ('再コール','再コール留守'))::bigint
  from public.profiles p
  left join public.call_histories h
    on h.user_id = p.id
   and h.called_at >= (target_date::timestamp at time zone 'Asia/Tokyo')
   and h.called_at < ((target_date + 1)::timestamp at time zone 'Asia/Tokyo')
  where coalesce(p.is_active, true) = true
  group by p.id, p.display_name, p.email, p.role
  order by count(h.id) desc, coalesce(p.sort_order, 0), coalesce(p.display_name, p.email, '');
end;
$$;

revoke all on function public.get_daily_operator_kpi(date) from public;
grant execute on function public.get_daily_operator_kpi(date) to authenticated;

create or replace function public.get_operator_report(start_date date, end_date date)
returns table (
  period_date date,
  user_id uuid,
  display_name text,
  role text,
  call_count bigint,
  valid_count bigint,
  decision_count bigint,
  prospect_count bigint,
  tossup_count bigint,
  re_call_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.dialix_is_kpi_viewer() then
    raise exception 'レポートを閲覧する権限がありません。';
  end if;
  if start_date is null or end_date is null or start_date > end_date then
    raise exception '集計期間が正しくありません。';
  end if;

  return query
  select (h.called_at at time zone 'Asia/Tokyo')::date,
         p.id,
         coalesce(p.display_name, p.email, h.operator_name, '名称未設定')::text,
         coalesce(p.role, 'operator')::text,
         count(h.id)::bigint,
         count(h.id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
         count(h.id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint,
         count(h.id) filter (where coalesce(h.status, '') like '%見込み%')::bigint,
         count(h.id) filter (where h.status = 'トスアップ')::bigint,
         count(h.id) filter (where h.status in ('再コール','再コール留守'))::bigint
  from public.call_histories h
  left join public.profiles p on p.id = h.user_id
  where h.called_at >= (start_date::timestamp at time zone 'Asia/Tokyo')
    and h.called_at < ((end_date + 1)::timestamp at time zone 'Asia/Tokyo')
  group by (h.called_at at time zone 'Asia/Tokyo')::date, p.id, p.display_name, p.email, p.role, h.operator_name
  order by (h.called_at at time zone 'Asia/Tokyo')::date desc, count(h.id) desc, coalesce(p.display_name, p.email, h.operator_name, '');
end;
$$;

revoke all on function public.get_operator_report(date, date) from public;
grant execute on function public.get_operator_report(date, date) to authenticated;

grant select on public.call_histories to authenticated;
