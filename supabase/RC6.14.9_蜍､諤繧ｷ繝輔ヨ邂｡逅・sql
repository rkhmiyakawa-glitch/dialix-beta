-- DIALIX RC6.14.9 勤怠・シフト管理
create table if not exists public.shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  shift_date date not null,
  start_time time,
  end_time time,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  memo text not null default '',
  is_off boolean not null default false,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, shift_date)
);
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  clock_in timestamptz,
  clock_out timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, work_date)
);
alter table public.shifts enable row level security;
alter table public.attendance_records enable row level security;

drop policy if exists "shifts_select_self_or_manager" on public.shifts;
create policy "shifts_select_self_or_manager" on public.shifts for select using (
  user_id = auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
);
drop policy if exists "shifts_manage_manager" on public.shifts;
create policy "shifts_manage_manager" on public.shifts for all using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
);
drop policy if exists "attendance_self_select" on public.attendance_records;
create policy "attendance_self_select" on public.attendance_records for select using (user_id=auth.uid());
drop policy if exists "attendance_self_insert" on public.attendance_records;
create policy "attendance_self_insert" on public.attendance_records for insert with check (user_id=auth.uid());
drop policy if exists "attendance_self_update" on public.attendance_records;
create policy "attendance_self_update" on public.attendance_records for update using (user_id=auth.uid()) with check (user_id=auth.uid());

-- RC6.15: AP本人による自分のシフト登録・編集・削除を許可
-- 管理者・オーナーは従来どおり全APを管理可能です。
drop policy if exists "shifts_self_insert" on public.shifts;
create policy "shifts_self_insert" on public.shifts for insert
with check (user_id = auth.uid());

drop policy if exists "shifts_self_update" on public.shifts;
create policy "shifts_self_update" on public.shifts for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "shifts_self_delete" on public.shifts;
create policy "shifts_self_delete" on public.shifts for delete
using (user_id = auth.uid());

-- RC6.17 勤怠修正申請・管理者修正
alter table public.attendance_records add column if not exists break_minutes integer not null default 0;
alter table public.attendance_records add column if not exists correction_reason text not null default '';
alter table public.attendance_records add column if not exists corrected_by uuid references auth.users(id) on delete set null;
alter table public.attendance_records add column if not exists corrected_at timestamptz;

create table if not exists public.attendance_correction_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  work_date date not null,
  requested_clock_in timestamptz,
  requested_clock_out timestamptz,
  reason_type text not null,
  reason_detail text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  manager_note text not null default '',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.attendance_correction_requests enable row level security;

drop policy if exists "attendance_manager_select" on public.attendance_records;
create policy "attendance_manager_select" on public.attendance_records for select using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
);
drop policy if exists "attendance_manager_insert" on public.attendance_records;
create policy "attendance_manager_insert" on public.attendance_records for insert with check (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
);
drop policy if exists "attendance_manager_update" on public.attendance_records;
create policy "attendance_manager_update" on public.attendance_records for update using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
) with check (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
);

drop policy if exists "correction_request_self_insert" on public.attendance_correction_requests;
create policy "correction_request_self_insert" on public.attendance_correction_requests for insert with check (user_id=auth.uid());
drop policy if exists "correction_request_self_select" on public.attendance_correction_requests;
create policy "correction_request_self_select" on public.attendance_correction_requests for select using (
  user_id=auth.uid() or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
);
drop policy if exists "correction_request_manager_update" on public.attendance_correction_requests;
create policy "correction_request_manager_update" on public.attendance_correction_requests for update using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
) with check (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role in ('owner','admin'))
);
