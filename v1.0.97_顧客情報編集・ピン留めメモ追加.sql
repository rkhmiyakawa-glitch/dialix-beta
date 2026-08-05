-- DIALIX v1.0.97
-- 通常の架電メモとは独立して、顧客ごとにピン留めメモを保持します。
-- 既存データ、架電履歴、KPIには影響しません。

alter table public.customers
  add column if not exists pinned_memo text not null default '';

comment on column public.customers.pinned_memo is
  '顧客ページに常時表示するピン留めメモ。架電履歴・KPIには含めない。';
