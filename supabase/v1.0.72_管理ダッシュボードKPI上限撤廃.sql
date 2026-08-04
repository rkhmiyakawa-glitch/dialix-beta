-- DIALIX v1.0.72
-- 管理ダッシュボードのKPI・ランキングをDB側で全件集計します。
-- call_historiesをブラウザへ取得しないため、Supabase APIの1,000行上限を受けません。

drop function if exists public.get_management_dashboard_kpi(timestamptz, timestamptz);
create function public.get_management_dashboard_kpi(start_at timestamptz, end_at timestamptz)
returns table (
  user_key text,
  display_name text,
  call_count bigint,
  valid_count bigint,
  decision_count bigint,
  prospect_count bigint,
  tossup_count bigint
)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.dialix_is_kpi_viewer() then
    raise exception 'KPIを閲覧する権限がありません。';
  end if;
  if start_at is null or end_at is null or start_at > end_at then
    raise exception '集計期間が正しくありません。';
  end if;

  return query
  with active_profiles as (
    select p.id, coalesce(p.display_name, p.email, '名称未設定')::text as name
    from public.profiles p
    where coalesce(p.is_active, true) = true
  ),
  period_histories as (
    select h.user_id, h.operator_name, h.status
    from public.call_histories h
    where h.called_at >= start_at
      and h.called_at <= end_at
      and h.status is distinct from '内容修正'
  ),
  known_operators as (
    select
      p.id::text as key,
      p.name,
      count(h.user_id)::bigint as calls,
      count(h.user_id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint as valid,
      count(h.user_id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint as decision,
      count(h.user_id) filter (where coalesce(h.status,'') like '%見込み%')::bigint as prospect,
      count(h.user_id) filter (where h.status = 'トスアップ')::bigint as tossup
    from active_profiles p
    left join period_histories h on h.user_id = p.id
    group by p.id, p.name
  ),
  unknown_operators as (
    select
      case when h.user_id is not null then h.user_id::text else 'name:' || coalesce(nullif(h.operator_name,''), '不明') end as key,
      coalesce(nullif(h.operator_name,''), '不明')::text as name,
      count(*)::bigint as calls,
      count(*) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint as valid,
      count(*) filter (where h.status in ('決裁NG','決裁見込み'))::bigint as decision,
      count(*) filter (where coalesce(h.status,'') like '%見込み%')::bigint as prospect,
      count(*) filter (where h.status = 'トスアップ')::bigint as tossup
    from period_histories h
    left join active_profiles p on p.id = h.user_id
    where p.id is null
    group by 1, 2
  )
  select key, name, calls, valid, decision, prospect, tossup from known_operators
  union all
  select key, name, calls, valid, decision, prospect, tossup from unknown_operators;
end;
$$;

revoke all on function public.get_management_dashboard_kpi(timestamptz, timestamptz) from public;
grant execute on function public.get_management_dashboard_kpi(timestamptz, timestamptz) to authenticated;
