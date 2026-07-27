# DIALIX v1.0 RC2 — admin-users Edge Function設定

このRC2では、DIALIXの「ユーザー追加・編集・パスワード変更・削除」をSupabase Edge Function `admin-users` で実行します。

## 最短手順（Supabase Dashboard）

1. Supabase Dashboardで **Edge Functions** を開く
2. 右上の **Deploy a new function** → **Via Editor**
3. Function name に `admin-users` と入力
4. 初期コードをすべて削除
5. `supabase/functions/admin-users/index.ts` の中身をすべて貼り付け
6. **Deploy function** を押す
7. Functions一覧に `admin-users` が表示されたら完了
8. DIALIXを再読み込みし、管理画面からユーザー追加を試す

## 招待メールの遷移先をDIALIXにする場合

Edge Functions → **Secrets** で次を追加します。

- Name: `DIALIX_SITE_URL`
- Value: VercelのDIALIX URL（例: `https://dialix-beta.vercel.app`）

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` はSupabase Edge Functionsに標準で用意されるため、通常は手入力不要です。

## セキュリティ

- `service_role` キーを `.env`、GitHub、Vercel、Reactコードへ入れないでください。
- Edge Functionはログイン中ユーザーのJWTを確認します。
- `profiles.role = admin` かつ `profiles.is_active = true` のユーザーだけが実行できます。
- 最後の有効な管理者は降格・停止・削除できません。

## 動作確認

ユーザー追加で失敗した場合は、Supabase Dashboardの

**Edge Functions → admin-users → Logs**

を開き、最新ログを確認してください。
