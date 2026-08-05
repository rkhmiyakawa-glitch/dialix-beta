-- DIALIX v1.0.93
-- 本人の今日・今月KPIをDB側で全件集計し、APIの1,000行上限と大量履歴転送を解消します。

drop function if exists public.get_my_kpi_summary(timestamptz, timestamptz, timestamptz);
create function public.get_my_kpi_summary(
  today_start timestamptz,
  month_start timestamptz,
  end_at timestamptz
)
returns table (
  today_calls bigint, today_valid bigint, today_decisions bigint,
  today_prospects bigint, today_tossups bigint,
  month_calls bigint, month_valid bigint, month_decisions bigint,
  month_prospects bigint, month_tossups bigint
)
language plpgsql stable security definer set search_path = public
as $$
declare cutoff timestamptz;
begin
  if auth.uid() is null then raise exception 'ログインが必要です。'; end if;
  if today_start is null or month_start is null or end_at is null
     or month_start > today_start or today_start > end_at then
    raise exception '集計期間が正しくありません。';
  end if;

  select e.reset_at into cutoff
  from public.kpi_reset_events e
  where e.undone_at is null
  order by e.reset_at desc limit 1;

  return query
  select
    count(h.id) filter (where h.called_at >= greatest(today_start, coalesce(cutoff, '-infinity'::timestamptz)) and h.status is distinct from '内容修正')::bigint,
    count(h.id) filter (where h.called_at >= greatest(today_start, coalesce(cutoff, '-infinity'::timestamptz)) and h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
    count(h.id) filter (where h.called_at >= greatest(today_start, coalesce(cutoff, '-infinity'::timestamptz)) and h.status in ('決裁NG','決裁見込み'))::bigint,
    count(h.id) filter (where h.called_at >= greatest(today_start, coalesce(cutoff, '-infinity'::timestamptz)) and coalesce(h.status,'') like '%見込み%')::bigint,
    count(h.id) filter (where h.called_at >= greatest(today_start, coalesce(cutoff, '-infinity'::timestamptz)) and h.status = 'トスアップ')::bigint,
    count(h.id) filter (where h.status is distinct from '内容修正')::bigint,
    count(h.id) filter (where h.status in ('NG','フロントNG','担当NG','非決裁NG','決裁NG','対象外','内容相違','再コール','見込み','非決裁見込み','決裁見込み','トスアップ'))::bigint,
    count(h.id) filter (where h.status in ('決裁NG','決裁見込み'))::bigint,
    count(h.id) filter (where coalesce(h.status,'') like '%見込み%')::bigint,
    count(h.id) filter (where h.status = 'トスアップ')::bigint
  from public.call_histories h
  where h.user_id = auth.uid()
    and h.counts_toward_kpi = true
    and h.called_at >= greatest(month_start, coalesce(cutoff, '-infinity'::timestamptz))
    and h.called_at <= end_at;
end;
$$;

revoke all on function public.get_my_kpi_summary(timestamptz, timestamptz, timestamptz) from public;
grant execute on function public.get_my_kpi_summary(timestamptz, timestamptz, timestamptz) to authenticated;

-- 集計対象の絞り込みを軽くする索引。既に存在する場合は変更しません。
create index if not exists call_histories_user_kpi_called_at_idx
  on public.call_histories (user_id, called_at desc)
  where counts_toward_kpi = true;
