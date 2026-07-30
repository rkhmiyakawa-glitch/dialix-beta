import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Role = "owner" | "admin" | "sv" | "operator";
type AssignableRole = Exclude<Role, "owner">;

type RequestBody = {
  action?: "claim_owner" | "create" | "update" | "reset_password" | "delete" | "reorder";
  userId?: string;
  displayName?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
  userIds?: string[];
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function validateAssignableRole(value: unknown): AssignableRole {
  if (value === "admin" || value === "sv" || value === "operator") return value;
  return "operator";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "POSTのみ利用できます。" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ ok: false, error: "Edge FunctionのSupabase環境変数がありません。" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!accessToken) return json({ ok: false, error: "ログイン情報がありません。再ログインしてください。" }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: callerData, error: callerError } = await admin.auth.getUser(accessToken);
    const caller = callerData.user;
    if (callerError || !caller) return json({ ok: false, error: "ログイン情報を確認できません。再ログインしてください。" }, 401);

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("id,display_name,email,role,is_active")
      .eq("id", caller.id)
      .single();

    if (profileError || !callerProfile) return json({ ok: false, error: "管理者プロフィールを確認できません。" }, 403);
    const callerRole = String(callerProfile.role || "").toLowerCase() as Role;
    if (!["owner", "admin"].includes(callerRole) || callerProfile.is_active === false) {
      return json({ ok: false, error: "この操作は有効なオーナーまたは管理者だけが実行できます。" }, 403);
    }

    const body = (await req.json()) as RequestBody;
    const action = body.action;

    if (action === "claim_owner") {
      if (callerRole === "owner") return json({ ok: true, alreadyOwner: true });
      const { count: ownerCount, error: ownerCountError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "owner");
      if (ownerCountError) throw ownerCountError;
      if ((ownerCount ?? 0) > 0) return json({ ok: false, error: "オーナーはすでに設定されています。" }, 409);

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(caller.id, {
        user_metadata: { ...(caller.user_metadata || {}), display_name: callerProfile.display_name, role: "owner" },
      });
      if (authUpdateError) throw authUpdateError;

      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({ role: "owner", is_active: true })
        .eq("id", caller.id);
      if (profileUpdateError) throw profileUpdateError;
      return json({ ok: true, userId: caller.id, role: "owner" });
    }

    if (action === "create") {
      const email = normalizeEmail(body.email);
      const displayName = String(body.displayName ?? "").trim();
      const role = validateAssignableRole(body.role);
      const isActive = body.isActive !== false;
      const password = String(body.password ?? "");

      if (!email || !displayName) return json({ ok: false, error: "名前とメールアドレスは必須です。" }, 400);
      if (password.length < 8) return json({ ok: false, error: "初期パスワードは8文字以上にしてください。" }, 400);

      const metadata = { display_name: displayName, role };
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
      });
      if (error) throw error;
      const createdUserId = data.user?.id ?? "";
      if (!createdUserId) throw new Error("認証ユーザーIDを取得できませんでした。");

      const { data: lastProfile } = await admin
        .from("profiles")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const nextSortOrder = Number(lastProfile?.sort_order ?? -1) + 1;

      const { error: upsertError } = await admin.from("profiles").upsert(
        { id: createdUserId, display_name: displayName, email, role, is_active: isActive, sort_order: nextSortOrder },
        { onConflict: "id" },
      );
      if (upsertError) {
        await admin.auth.admin.deleteUser(createdUserId).catch(() => undefined);
        throw upsertError;
      }
      return json({ ok: true, userId: createdUserId });
    }

    if (action === "reorder") {
      const updates = Array.isArray(body.updates)
        ? body.updates
            .map((item) => ({
              userId: String(item?.userId ?? "").trim(),
              sortOrder: Number(item?.sortOrder),
            }))
            .filter((item) => item.userId && Number.isInteger(item.sortOrder) && item.sortOrder >= 0)
        : [];
      if (updates.length !== 2 || new Set(updates.map((item) => item.userId)).size !== 2) {
        return json({ ok: false, error: "入れ替えるユーザー情報が正しくありません。" }, 400);
      }
      const { data: existingProfiles, error: existingError } = await admin
        .from("profiles")
        .select("id")
        .in("id", updates.map((item) => item.userId));
      if (existingError) throw existingError;
      if ((existingProfiles ?? []).length !== updates.length) {
        return json({ ok: false, error: "ユーザー一覧が更新されています。画面を再読み込みしてから、もう一度お試しください。" }, 409);
      }
      // 矢印1回につき、実際に入れ替わる2人だけを更新する。
      for (const update of updates) {
        const { error: reorderError } = await admin
          .from("profiles")
          .update({ sort_order: update.sortOrder })
          .eq("id", update.userId);
        if (reorderError) throw reorderError;
      }
      return json({ ok: true });
    }

    const userId = String(body.userId ?? "").trim();
    if (!userId) return json({ ok: false, error: "対象ユーザーIDがありません。" }, 400);

    const { data: targetProfile, error: targetError } = await admin
      .from("profiles")
      .select("id,display_name,email,role,is_active")
      .eq("id", userId)
      .single();
    if (targetError || !targetProfile) return json({ ok: false, error: "対象ユーザーが見つかりません。" }, 404);

    const targetRole = String(targetProfile.role || "").toLowerCase() as Role;
    if (targetRole === "owner") {
      return json({ ok: false, error: "オーナーは編集・停止・パスワード変更・削除できません。" }, 403);
    }

    const { count: activeAdminCount, error: countError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("is_active", true);
    if (countError) throw countError;

    const { count: activeOwnerCount, error: ownerCountError } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "owner")
      .eq("is_active", true);
    if (ownerCountError) throw ownerCountError;

    if (action === "update") {
      const displayName = String(body.displayName ?? targetProfile.display_name ?? "").trim();
      const role = validateAssignableRole(body.role ?? targetProfile.role);
      const isActive = body.isActive !== false;
      const removesLastManager = targetRole === "admin" && targetProfile.is_active !== false && (activeAdminCount ?? 0) <= 1 && (activeOwnerCount ?? 0) === 0 && (role !== "admin" || !isActive);
      if (removesLastManager) return json({ ok: false, error: "最後の管理者は降格・停止できません。" }, 409);
      if (!displayName) return json({ ok: false, error: "名前を入力してください。" }, 400);

      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, {
        user_metadata: { display_name: displayName, role },
      });
      if (authUpdateError) throw authUpdateError;

      const { error: updateError } = await admin.from("profiles").update({ display_name: displayName, role, is_active: isActive }).eq("id", userId);
      if (updateError) throw updateError;
      return json({ ok: true });
    }

    if (action === "reset_password") {
      const password = String(body.password ?? "");
      if (password.length < 8) return json({ ok: false, error: "パスワードは8文字以上にしてください。" }, 400);
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "delete") {
      if (userId === caller.id) return json({ ok: false, error: "自分自身は削除できません。" }, 409);
      const deletesLastManager = targetRole === "admin" && targetProfile.is_active !== false && (activeAdminCount ?? 0) <= 1 && (activeOwnerCount ?? 0) === 0;
      if (deletesLastManager) return json({ ok: false, error: "最後の管理者は削除できません。" }, 409);

      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(userId);
      if (deleteAuthError) throw deleteAuthError;
      const { error: deleteProfileError } = await admin.from("profiles").delete().eq("id", userId);
      if (deleteProfileError) throw deleteProfileError;
      return json({ ok: true });
    }

    return json({ ok: false, error: "未対応の操作です。" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ユーザー管理処理に失敗しました。";
    console.error("admin-users error", error);
    return json({ ok: false, error: message }, 500);
  }
});
