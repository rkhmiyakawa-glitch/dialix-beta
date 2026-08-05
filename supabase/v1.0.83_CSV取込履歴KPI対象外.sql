-- DIALIX v1.0.83
-- CSVインポート由来の架電履歴を保持したまま、KPI集計から除外します。
-- 既存履歴はすべて従来どおり集計対象です。

alter table public.call_histories
  add column if not exists counts_toward_kpi boolean not null default true;

comment on column public.call_histories.counts_toward_kpi is
  'true: DIALIX上の実架電としてKPI集計、false: CSV取込の初期履歴として集計対象外';

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
   and h.counts_toward_kpi = true
   and h.called_at >= greatest((target_date::timestamp at time zone 'Asia/Tokyo'), coalesce(cutoff,'-infinity'::timestamptz))
   and h.called_at < ((target_date+1)::timestamp at time zone 'Asia/Tokyo')
  where coalesce(p.is_active,true)=true
  group by p.id,p.display_name,p.email,p.role
  order by count(h.id) filter (where h.status is distinct from '内容修正') desc,coalesce(p.sort_order,0),coalesce(p.display_name,p.email,'');
end;
$$;

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
  where h.counts_toward_kpi = true
    and h.called_at >= greatest((start_date::timestamp at time zone 'Asia/Tokyo'),coalesce(cutoff,'-infinity'::timestamptz))
    and h.called_at < ((end_date+1)::timestamp at time zone 'Asia/Tokyo')
  group by (h.called_at at time zone 'Asia/Tokyo')::date,p.id,p.display_name,p.email,p.role,h.operator_name
  order by (h.called_at at time zone 'Asia/Tokyo')::date desc,
    count(h.id) filter (where h.status is distinct from '内容修正') desc,
    coalesce(p.display_name,p.email,h.operator_name,'');
end;
$$;

drop function if exists public.get_management_dashboard_kpi(timestamptz, timestamptz);
create function public.get_management_dashboard_kpi(start_at timestamptz, end_at timestamptz)
returns table (
  user_key text, display_name text, call_count bigint, valid_count bigint,
  decision_count bigint, prospect_count bigint, tossup_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.dialix_is_kpi_viewer() then raise exception 'KPIを閲覧する権限がありません。'; end if;
  if start_at is null or end_at is null or start_at > end_at then raise exception '集計期間が正しくありません。'; end if;
  return query
  with active_profiles as (
    select p.id, coalesce(p.display_name,p.email,'名称未設定')::text as name
    from public.profiles p where coalesce(p.is_active,true)=true
  ), period_histories as (
    select h.user_id,h.operator_name,h.status from public.call_histories h
    where h.called_at >= start_at and h.called_at <= end_at
      and h.counts_toward_kpi = true and h.status is distinct from '内容修正'
  ), known_operators as (
    select p.id::text as key,p.name,count(h.user_id)::bigint as calls,
      count(h.user_id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint as valid,
      count(h.user_id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint as decision,
      count(h.user_id) filter (where coalesce(h.status,'') like '%見込み%')::bigint as prospect,
      count(h.user_id) filter (where h.status='トスアップ')::bigint as tossup
    from active_profiles p left join period_histories h on h.user_id=p.id group by p.id,p.name
  ), unknown_operators as (
    select case when h.user_id is not null then h.user_id::text else 'name:'||coalesce(nullif(h.operator_name,''),'不明') end as key,
      coalesce(nullif(h.operator_name,''),'不明')::text as name,count(*)::bigint as calls,
      count(*) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint as valid,
      count(*) filter (where h.status in ('決裁NG','決裁見込み'))::bigint as decision,
      count(*) filter (where coalesce(h.status,'') like '%見込み%')::bigint as prospect,
      count(*) filter (where h.status='トスアップ')::bigint as tossup
    from period_histories h left join active_profiles p on p.id=h.user_id where p.id is null group by 1,2
  )
  select key,name,calls,valid,decision,prospect,tossup from known_operators
  union all select key,name,calls,valid,decision,prospect,tossup from unknown_operators;
end;
$$;

revoke all on function public.get_daily_operator_kpi(date) from public;
revoke all on function public.get_operator_report(date,date) from public;
revoke all on function public.get_management_dashboard_kpi(timestamptz,timestamptz) from public;
grant execute on function public.get_daily_operator_kpi(date) to authenticated;
grant execute on function public.get_operator_report(date,date) to authenticated;
grant execute on function public.get_management_dashboard_kpi(timestamptz,timestamptz) to authenticated;
