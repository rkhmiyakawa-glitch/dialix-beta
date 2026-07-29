-- DIALIX v1.0 RC6.21
-- APを含む全ログインユーザーが同じリンク一覧を閲覧できるようにする。

create table if not exists public.shared_links (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  sort_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_links enable row level security;

create index if not exists shared_links_sort_order_idx
  on public.shared_links(sort_order, created_at);

drop policy if exists "shared_links_select_authenticated" on public.shared_links;
create policy "shared_links_select_authenticated"
on public.shared_links for select
to authenticated
using (true);

drop policy if exists "shared_links_insert_admin" on public.shared_links;
create policy "shared_links_insert_admin"
on public.shared_links for insert
to authenticated
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner','admin')
  )
);

drop policy if exists "shared_links_update_admin" on public.shared_links;
create policy "shared_links_update_admin"
on public.shared_links for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner','admin')
  )
);

drop policy if exists "shared_links_delete_admin" on public.shared_links;
create policy "shared_links_delete_admin"
on public.shared_links for delete
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('owner','admin')
  )
);
