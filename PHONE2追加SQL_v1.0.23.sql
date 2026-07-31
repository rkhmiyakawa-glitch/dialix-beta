alter table public.customers
  add column if not exists phone2 text;

comment on column public.customers.phone2 is '追加電話番号';
