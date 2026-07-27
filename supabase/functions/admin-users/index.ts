import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const callerClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const adminClient = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });

    const { data: authData, error: authError } = await callerClient.auth.getUser();
    if (authError || !authData.user) return json({ ok: false, error: "ログインが必要です。" }, 401);
    const { data: caller } = await adminClient.from("profiles").select("id,role,is_active").eq("id", authData.user.id).single();
    if (!caller || caller.role !== "admin" || caller.is_active === false) return json({ ok: false, error: "管理者権限が必要です。" }, 403);

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const displayName = String(body.displayName || "").trim();
      const role = ["admin", "sv", "operator"].includes(body.role) ? body.role : "operator";
      const isActive = body.isActive !== false;
      if (!email || !displayName) return json({ ok: false, error: "名前とメールアドレスは必須です。" }, 400);

      let user;
      if (body.sendInvite) {
        const redirectTo = body.redirectTo || Deno.env.get("DIALIX_SITE_URL") || undefined;
        const result = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo, data: { display_name: displayName } });
        if (result.error) throw result.error;
        user = result.data.user;
      } else {
        const password = String(body.password || "");
        if (password.length < 8) return json({ ok: false, error: "初期パスワードは8文字以上必要です。" }, 400);
        const result = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName } });
        if (result.error) throw result.error;
        user = result.data.user;
      }
      if (!user) throw new Error("Authユーザーを作成できませんでした。");
      const { error: profileError } = await adminClient.from("profiles").upsert({ id: user.id, email, display_name: displayName, role, is_active: isActive });
      if (profileError) {
        await adminClient.auth.admin.deleteUser(user.id);
        throw profileError;
      }
      return json({ ok: true, userId: user.id });
    }

    const userId = String(body.userId || "");
    if (!userId) return json({ ok: false, error: "対象ユーザーがありません。" }, 400);
    const { data: target } = await adminClient.from("profiles").select("id,role,is_active").eq("id", userId).single();
    if (!target) return json({ ok: false, error: "対象ユーザーが見つかりません。" }, 404);

    if (action === "update") {
      const nextRole = ["admin", "sv", "operator"].includes(body.role) ? body.role : target.role;
      const nextActive = body.isActive !== false;
      if (target.role === "admin" && (nextRole !== "admin" || !nextActive)) {
        const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
        if ((count || 0) <= 1) return json({ ok: false, error: "最後の管理者は降格・停止できません。" }, 400);
      }
      const { error } = await adminClient.from("profiles").update({ display_name: String(body.displayName || "").trim(), role: nextRole, is_active: nextActive }).eq("id", userId);
      if (error) throw error;
      await adminClient.auth.admin.updateUserById(userId, { user_metadata: { display_name: String(body.displayName || "").trim() }, ban_duration: nextActive ? "none" : "876000h" });
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const password = String(body.password || "");
      if (password.length < 8) return json({ ok: false, error: "パスワードは8文字以上必要です。" }, 400);
      const { error } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      if (userId === authData.user.id) return json({ ok: false, error: "自分自身は削除できません。" }, 400);
      if (target.role === "admin" && target.is_active) {
        const { count } = await adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("is_active", true);
        if ((count || 0) <= 1) return json({ ok: false, error: "最後の管理者は削除できません。" }, 400);
      }
      const { error } = await adminClient.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ ok: false, error: "不明な操作です。" }, 400);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : "処理に失敗しました。" }, 500);
  }
});
