# DIALIX v1.0 RC4 Edge Function 更新手順

RC4では招待メール方式を廃止し、管理者が初期パスワードを設定してユーザーを作成します。

## 1. GitHub / Vercel

このZIPの内容を既存の `dialix-beta` リポジトリへ上書きし、コミット・Pushしてください。

## 2. Supabase Edge Function

1. Supabase Dashboard → Edge Functions → `admin-users`
2. Edit function（編集）を開く
3. 現在の `index.ts` をすべて削除
4. ZIP内の `supabase/functions/admin-users/index.ts` をすべて貼り付け
5. Deploy / Save and deploy を実行

関数名は引き続き `admin-users` です。新しい関数を別名で作らないでください。

## 3. 動作確認

管理画面 → ユーザー管理 → ユーザー追加で、名前・メール・初期パスワード・権限・状態を入力して登録します。

登録後、本人は通常のDIALIXログイン画面からメールアドレスと初期パスワードでログインし、マイページからパスワードを変更します。

## 変更点

- 招待メール送信を完全廃止
- 招待方式の選択欄を削除
- 初期パスワードと確認入力を必須化
- Authユーザーは `email_confirm: true` で作成
- 初期パスワードはprofilesテーブル等へ保存しない
- `DIALIX_SITE_URL` Secretはこの機能では不要
