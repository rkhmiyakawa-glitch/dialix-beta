# DIALIX v1.0 RC1 データベース基準

このRCは、現在確認できたSupabaseの既存カラムを基準にしています。

## lists
- id
- name
- customer_count
- active_users
- is_active
- created_at
- updated_at

`description` と `deleted_at` は参照しません。
ゴミ箱は `is_active=false`、削除日時は `updated_at` を利用します。

## import_batches
- id
- list_id
- file_name
- total_rows
- inserted_rows
- duplicate_rows
- error_rows
- created_at

`imported_history_rows` と `imported_by_name` は参照・保存しません。

## 運用上の注意
- このRCでは追加SQLの実行は不要です。
- リストの完全削除は顧客の架電履歴、顧客、リストの順に削除します。
- RLSにより削除が拒否される場合は、管理者ポリシーの確認が必要です。
