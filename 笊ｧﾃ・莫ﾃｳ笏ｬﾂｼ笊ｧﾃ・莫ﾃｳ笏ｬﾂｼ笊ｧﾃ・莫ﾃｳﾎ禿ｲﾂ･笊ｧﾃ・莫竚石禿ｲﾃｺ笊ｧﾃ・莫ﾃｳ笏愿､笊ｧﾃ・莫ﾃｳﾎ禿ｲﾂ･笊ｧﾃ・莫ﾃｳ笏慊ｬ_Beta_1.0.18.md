# DIALIX Beta 1.0.18

## ユーザー管理
- DIALIX管理画面からAuthユーザーとprofilesを同時作成
- 招待メール（本人がパスワード設定）または初期パスワードで登録
- 名前・権限・有効/停止の変更
- 管理者によるパスワード変更
- ユーザー削除
- 最後の有効な管理者は降格・停止・削除不可
- 自分自身の削除不可

## CSVインポート
- 顧客IDはDIALIX/Supabase側で自動採番
- 電話番号の全角数字を半角化し、ハイフン・空白・記号を自動除去
- スプレッドシートのステータス表記をDIALIXへマッピング
- メモを架電履歴へ登録
- 最終担当APをDIALIXユーザーへマッピング（未登録者は名前のみ履歴に保持）
- 最終架電日時・次回架電日時を反映
- 電話番号で重複判定し、既存番号はスキップ

## Supabase設定
`supabase/migrations/018_user_management_and_csv_import.sql` をSQL Editorで実行し、
`supabase/functions/admin-users` をEdge Functionとしてデプロイしてください。
詳細は `SUPABASE_SETUP_1.0.18.md` を参照してください。
