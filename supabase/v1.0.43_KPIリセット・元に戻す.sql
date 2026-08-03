-- DIALIX v1.0.43
-- 管理ダッシュボード／レポートの集計リセットと取り消し
-- 架電履歴自体は削除しません。

create table if not exists public.kpi_reset_events (
  id uuid primary key default gen_random_uuid(),
  reset_at timestamptz not null default now(),
  reset_by uuid not null references public.profiles(id),
  undone_at timestamptz,
  undone_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.kpi_reset_events enable row level security;
revoke all on table public.kpi_reset_events from anon, authenticated;

create or replace function public.dialix_can_reset_kpi()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and lower(coalesce(role, '')) in ('owner', 'admin')
      and coalesce(is_active, true) = true
  );
$$;

create or replace function public.get_kpi_reset_state()
returns table (reset_at timestamptz, can_undo boolean)
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
  select e.reset_at, public.dialix_can_reset_kpi()
  from public.kpi_reset_events e
  where e.undone_at is null
  order by e.reset_at desc
  limit 1;
end;
$$;

create or replace function public.reset_management_kpi()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.dialix_can_reset_kpi() then
    raise exception '集計をリセットできるのはオーナーまたは管理者Sだけです。';
  end if;
  update public.kpi_reset_events
  set undone_at = now(), undone_by = auth.uid()
  where undone_at is null;
  insert into public.kpi_reset_events (reset_by) values (auth.uid());
end;
$$;

create or replace function public.undo_management_kpi_reset()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare target_id uuid;
begin
  if not public.dialix_can_reset_kpi() then
    raise exception '元に戻せるのはオーナーまたは管理者Sだけです。';
  end if;
  select id into target_id
  from public.kpi_reset_events
  where undone_at is null
  order by reset_at desc
  limit 1
  for update;
  if target_id is null then
    raise exception '元に戻せるリセットがありません。';
  end if;
  update public.kpi_reset_events
  set undone_at = now(), undone_by = auth.uid()
  where id = target_id;
end;
$$;

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
    count(h.id)::bigint,
    count(h.id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
    count(h.id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint,
    count(h.id) filter (where coalesce(h.status,'') like '%見込み%')::bigint,
    count(h.id) filter (where h.status='トスアップ')::bigint,
    count(h.id) filter (where h.status in ('再コール','再コール留守'))::bigint
  from public.profiles p left join public.call_histories h on h.user_id=p.id
   and h.called_at >= greatest((target_date::timestamp at time zone 'Asia/Tokyo'), coalesce(cutoff,'-infinity'::timestamptz))
   and h.called_at < ((target_date+1)::timestamp at time zone 'Asia/Tokyo')
  where coalesce(p.is_active,true)=true
  group by p.id,p.display_name,p.email,p.role
  order by count(h.id) desc,coalesce(p.sort_order,0),coalesce(p.display_name,p.email,'');
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
    count(h.id)::bigint,
    count(h.id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
    count(h.id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint,
    count(h.id) filter (where coalesce(h.status,'') like '%見込み%')::bigint,
    count(h.id) filter (where h.status='トスアップ')::bigint,
    count(h.id) filter (where h.status in ('再コール','再コール留守'))::bigint
  from public.call_histories h left join public.profiles p on p.id=h.user_id
  where h.called_at >= greatest((start_date::timestamp at time zone 'Asia/Tokyo'),coalesce(cutoff,'-infinity'::timestamptz))
    and h.called_at < ((end_date+1)::timestamp at time zone 'Asia/Tokyo')
  group by (h.called_at at time zone 'Asia/Tokyo')::date,p.id,p.display_name,p.email,p.role,h.operator_name
  order by (h.called_at at time zone 'Asia/Tokyo')::date desc,count(h.id) desc,coalesce(p.display_name,p.email,h.operator_name,'');
end;
$$;

revoke all on function public.dialix_can_reset_kpi() from public;
revoke all on function public.get_kpi_reset_state() from public;
revoke all on function public.reset_management_kpi() from public;
revoke all on function public.undo_management_kpi_reset() from public;
revoke all on function public.get_daily_operator_kpi(date) from public;
revoke all on function public.get_operator_report(date,date) from public;
grant execute on function public.get_kpi_reset_state() to authenticated;
grant execute on function public.reset_management_kpi() to authenticated;
grant execute on function public.undo_management_kpi_reset() to authenticated;
grant execute on function public.get_daily_operator_kpi(date) to authenticated;
grant execute on function public.get_operator_report(date,date) to authenticated;
