-- DIALIX v1.0.77
-- customers と call_histories のステータス制約を統一します。
-- 既存データは削除・更新しません。

begin;

alter table public.customers
  drop constraint if exists customers_status_check;

alter table public.customers
  add constraint customers_status_check
  check (status is null or status in (
    '', '未架電', '留守',
    'NG', 'フロントNG', '担当NG', '非決裁NG', '決裁NG',
    '対象外', '内容相違', '現アナ',
    '再コール', '再コール留守',
    '見込み', '非決裁見込み', '決裁見込み', '見込み留守',
    'トスアップ', '前確依頼', '前確OK', '前確NG', '内容修正'
  ));

alter table public.call_histories
  drop constraint if exists call_histories_status_check;

alter table public.call_histories
  add constraint call_histories_status_check
  check (status is null or status in (
    '', '未架電', '留守',
    'NG', 'フロントNG', '担当NG', '非決裁NG', '決裁NG',
    '対象外', '内容相違', '現アナ',
    '再コール', '再コール留守',
    '見込み', '非決裁見込み', '決裁見込み', '見込み留守',
    'トスアップ', '前確依頼', '前確OK', '前確NG', '内容修正'
  ));

commit;
