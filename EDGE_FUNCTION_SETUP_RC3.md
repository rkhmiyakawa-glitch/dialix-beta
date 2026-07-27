# DIALIX v1.0 RC3 — admin-users Edge Function 設定

この設定は、DIALIXの管理画面からユーザーを追加・編集・停止・削除するために必要です。

## 1. SupabaseでEdge Functionを作成

1. Supabase Dashboardを開く
2. 左メニューの **Edge Functions** を開く
3. **Deploy a new function** → **Via Editor** を選ぶ
4. 画面右下の **Function name** を次の名前へ変更する

```text
admin-users
```

5. エディターに最初から入っているサンプルコードをすべて削除する
6. このZIP内の次のファイルを開き、中身をすべて貼り付ける

```text
supabase/functions/admin-users/index.ts
```

7. **Deploy function** を押す
8. Edge Functions一覧に `admin-users` が表示されたら完了

## 2. 招待メールの遷移先を設定（招待メールを使う場合）

Supabaseの **Edge Functions → Secrets** で次を追加します。

```text
Name: DIALIX_SITE_URL
Value: Vercelで公開しているDIALIXのURL
```

例:

```text
https://dialix-beta.vercel.app
```

`SUPABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` はSupabase Edge Functionの標準環境変数として利用します。フロントエンドやVercelにはservice role keyを置かないでください。

## 3. 動作確認

1. DIALIXへ管理者でログイン
2. 管理画面 → ユーザー追加
3. 名前、メール、権限、登録方式を入力
4. 登録を実行

エラーが出た場合は、Supabaseの **Edge Functions → admin-users → Logs** を開いて確認してください。

## 実装済み操作

- ユーザー追加（招待メール／初期パスワード）
- 表示名・権限・有効状態の更新
- 管理者によるパスワード再設定
- ユーザー削除
- 最後の有効な管理者の降格・停止・削除防止
- 自分自身の削除防止
