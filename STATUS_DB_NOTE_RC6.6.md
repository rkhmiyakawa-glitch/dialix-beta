# RC6.6 ステータス追加時のDB確認

通常はフロント反映だけで利用できます。

保存時に `23514` / `check constraint` エラーが出た場合のみ、Supabase の customers または call_histories の status 列に CHECK 制約があります。
その場合は既存制約を確認し、「対象外」「現アナ」を許可値へ追加してください。

確認SQL:

```sql
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid in ('public.customers'::regclass, 'public.call_histories'::regclass)
  and contype = 'c';
```

制約名は環境ごとに異なるため、確認結果に合わせて変更してください。
