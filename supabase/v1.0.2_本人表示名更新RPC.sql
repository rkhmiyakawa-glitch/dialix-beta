-- DIALIX v1.0.2
-- AP本人が自分の表示名だけを安全に変更するためのRPC

create or replace function public.update_my_display_name(next_display_name text)
returns setof public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := btrim(coalesce(next_display_name, ''));
begin
  if auth.uid() is null then
    raise exception 'ログインが必要です。';
  end if;

  if clean_name = '' then
    raise exception '表示名を入力してください。';
  end if;

  if char_length(clean_name) > 50 then
    raise exception '表示名は50文字以内で入力してください。';
  end if;

  return query
    update public.profiles
       set display_name = clean_name
     where id = auth.uid()
     returning *;

  if not found then
    raise exception 'プロフィールが見つかりません。';
  end if;
end;
$$;

revoke all on function public.update_my_display_name(text) from public;
grant execute on function public.update_my_display_name(text) to authenticated;

