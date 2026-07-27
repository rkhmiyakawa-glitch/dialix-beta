# DIALIX Beta 1.0.19 Supabase設定

1. Supabaseの **SQL Editor** を開きます。
2. `supabase/migrations/019_list_management_trash_bulk.sql` の内容を貼り付けて実行します。
3. DIALIXを再デプロイします。

## 30日後の自動完全削除

ゴミ箱の画面には残り日数が表示されます。30日経過後に自動削除する場合は、Supabase Dashboardの **Integrations / Cron** で、次のSQLを1日1回実行してください。

```sql
select public.purge_expired_dialix_lists();
```

Cronを設定しない場合も、管理者はゴミ箱から手動で完全削除できます。

## 注意

- リスト複製では顧客の基本情報・現在ステータス・リマインドを複製します。
- 過去の架電履歴は二重集計を避けるため複製しません。
- 完全削除はゴミ箱にあるリストだけ実行できます。
