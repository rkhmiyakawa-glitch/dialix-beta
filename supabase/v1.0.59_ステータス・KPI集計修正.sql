-- DIALIX v1.0.59
-- 「内容相違」「内容修正」の追加とKPI集計ルールの統一

-- 既存環境にステータスのCHECK制約がある場合、新しい値を保存できるよう更新します。
do $$
begin
  alter table public.customers drop constraint if exists customers_status_check;
  alter table public.customers
    add constraint customers_status_check
    check (status is null or status in (
      '','未架電','留守','NG','フロントNG','担当NG','非決裁NG','決裁NG',
      '対象外','内容相違','現アナ','再コール','再コール留守',
      '見込み','非決裁見込み','決裁見込み','見込み留守','トスアップ',
      '前確依頼','前確OK','前確NG','内容修正'
    ));
end $$;

-- KPI一覧（内容修正はコール数にも含めない）
drop function if exists public.get_daily_operator_kpi(date);
create function public.get_daily_operator_kpi(target_date date)
returns table (
  user_id uuid, display_name text, role text, call_count bigint,
  valid_count bigint, decision_count bigint, prospect_count bigint,
  tossup_count bigint, re_call_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare cutoff timestamptz;
begin
  if not public.dialix_is_kpi_viewer() then raise exception 'KPIを閲覧する権限がありません。'; end if;
  select e.reset_at into cutoff from public.kpi_reset_events e where e.undone_at is null order by e.reset_at desc limit 1;
  return query
  select p.id, coalesce(p.display_name,p.email,'名称未設定')::text, coalesce(p.role,'operator')::text,
    count(h.id) filter (where h.status is distinct from '内容修正')::bigint,
    count(h.id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
    count(h.id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint,
    count(h.id) filter (where coalesce(h.status,'') like '%見込み%')::bigint,
    count(h.id) filter (where h.status='トスアップ')::bigint,
    count(h.id) filter (where h.status in ('再コール','再コール留守'))::bigint
  from public.profiles p left join public.call_histories h on h.user_id=p.id
   and h.called_at >= greatest((target_date::timestamp at time zone 'Asia/Tokyo'), coalesce(cutoff,'-infinity'::timestamptz))
   and h.called_at < ((target_date+1)::timestamp at time zone 'Asia/Tokyo')
  where coalesce(p.is_active,true)=true
  group by p.id,p.display_name,p.email,p.role
  order by count(h.id) filter (where h.status is distinct from '内容修正') desc,coalesce(p.sort_order,0),coalesce(p.display_name,p.email,'');
end;
$$;

-- 期間レポート（内容修正はコール数にも含めない）
drop function if exists public.get_operator_report(date, date);
create function public.get_operator_report(start_date date, end_date date)
returns table (
  period_date date, user_id uuid, display_name text, role text,
  call_count bigint, valid_count bigint, decision_count bigint,
  prospect_count bigint, tossup_count bigint, re_call_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare cutoff timestamptz;
begin
  if not public.dialix_is_kpi_viewer() then raise exception 'レポートを閲覧する権限がありません。'; end if;
  if start_date is null or end_date is null or start_date>end_date then raise exception '集計期間が正しくありません。'; end if;
  select e.reset_at into cutoff from public.kpi_reset_events e where e.undone_at is null order by e.reset_at desc limit 1;
  return query
  select (h.called_at at time zone 'Asia/Tokyo')::date,p.id,
    coalesce(p.display_name,p.email,h.operator_name,'名称未設定')::text,coalesce(p.role,'operator')::text,
    count(h.id) filter (where h.status is distinct from '内容修正')::bigint,
    count(h.id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
    count(h.id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint,
    count(h.id) filter (where coalesce(h.status,'') like '%見込み%')::bigint,
    count(h.id) filter (where h.status='トスアップ')::bigint,
    count(h.id) filter (where h.status in ('再コール','再コール留守'))::bigint
  from public.call_histories h left join public.profiles p on p.id=h.user_id
  where h.called_at >= greatest((start_date::timestamp at time zone 'Asia/Tokyo'),coalesce(cutoff,'-infinity'::timestamptz))
    and h.called_at < ((end_date+1)::timestamp at time zone 'Asia/Tokyo')
  group by (h.called_at at time zone 'Asia/Tokyo')::date,p.id,p.display_name,p.email,p.role,h.operator_name
  order by (h.called_at at time zone 'Asia/Tokyo')::date desc,
    count(h.id) filter (where h.status is distinct from '内容修正') desc,
    coalesce(p.display_name,p.email,h.operator_name,'');
end;
$$;

revoke all on function public.get_daily_operator_kpi(date) from public;
revoke all on function public.get_operator_report(date,date) from public;
grant execute on function public.get_daily_operator_kpi(date) to authenticated;
grant execute on function public.get_operator_report(date,date) to authenticated;
