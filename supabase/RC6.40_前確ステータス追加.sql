-- DIALIX RC6.40
-- Supabase SQL Editorで1回だけ実行してください。
-- 前確依頼 / 前確OK / 前確NG を顧客・架電履歴へ保存できるようにします。

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.customers drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.customers
  add constraint customers_status_check
  check (status in (
    '未架電',
    '留守',
    'NG',
    '非決裁NG',
    '決裁NG',
    '対象外',
    '現アナ',
    '再コール',
    '再コール留守',
    '見込み',
    '非決裁見込み',
    '決裁見込み',
    '見込み留守',
    'トスアップ',
    '前確依頼',
    '前確OK',
    '前確NG'
  ));

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.call_histories'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.call_histories drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.call_histories
  add constraint call_histories_status_check
  check (status in (
    '未架電',
    '留守',
    'NG',
    '非決裁NG',
    '決裁NG',
    '対象外',
    '現アナ',
    '再コール',
    '再コール留守',
    '見込み',
    '非決裁見込み',
    '決裁見込み',
    '見込み留守',
    'トスアップ',
    '前確依頼',
    '前確OK',
    '前確NG'
  ));
