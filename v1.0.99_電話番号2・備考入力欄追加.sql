alter table public.customers
  add column if not exists phone_2 text;

comment on column public.customers.phone_2 is '予備の電話番号';
