# Supabase設定手順（Beta 1.0.18）

## 1. SQLを実行
Supabase Dashboard → SQL Editor で次のファイルを開き、実行します。

`supabase/migrations/018_user_management_and_csv_import.sql`

## 2. Edge Functionをデプロイ
Supabase CLIを使用できるPCでプロジェクト直下から実行します。

```bash
supabase login
supabase link --project-ref あなたのPROJECT_REF
supabase functions deploy admin-users
```

Edge FunctionにはSupabaseが標準で以下を渡します。
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

招待メール後の遷移先を固定したい場合は追加します。

```bash
supabase secrets set DIALIX_SITE_URL=https://あなたのVercelドメイン
```

## 3. Auth URL設定
Authentication → URL Configuration で以下を設定します。
- Site URL: DIALIXのVercel URL
- Redirect URLs: `https://あなたのVercelドメイン/**`

## 4. メール送信
招待メールはSupabase Authのメール機能を使います。本格運用では Authentication → SMTP Settings に独自SMTPを設定してください。

## セキュリティ
`service_role`キーをVite/Vercelのフロントエンド環境変数へ入れないでください。今回の実装ではEdge Function内だけで使用します。
