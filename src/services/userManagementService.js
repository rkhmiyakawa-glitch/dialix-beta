import { isSupabaseConfigured, supabase } from "../lib/supabase";

async function invokeAdminUsers(body) {
  if (!isSupabaseConfigured) throw new Error("Supabase接続設定がありません。");
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) {
    const raw = error.message || "";
    let detail = "";
    try {
      const responseBody = await error.context?.json?.();
      detail = responseBody?.error || "";
    } catch {
      // 応答本文がJSONでない場合はSDKのメッセージを使用する。
    }
    if (/Failed to send a request|fetch/i.test(raw)) {
      throw new Error("SupabaseのEdge Function『admin-users』へ接続できません。Supabaseへ関数をデプロイしたか確認してください。");
    }
    throw new Error(detail || raw || "ユーザー管理処理に失敗しました。");
  }
  if (!data?.ok) throw new Error(data?.error || "ユーザー管理処理に失敗しました。");
  return data;
}

export function createManagedUser(payload) {
  return invokeAdminUsers({ action: "create", ...payload });
}

export function updateManagedUser(payload) {
  return invokeAdminUsers({ action: "update", ...payload }).then((result) => {
    const requestedEmail = String(payload.email || "").trim().toLowerCase();
    const updatedEmail = String(result.email || "").trim().toLowerCase();
    if (!updatedEmail || updatedEmail !== requestedEmail) {
      throw new Error("メールアドレスが反映されませんでした。Supabaseの『admin-users』Edge Functionを最新版へ再デプロイしてください。");
    }
    return result;
  });
}

export function resetManagedUserPassword(userId, password) {
  return invokeAdminUsers({ action: "reset_password", userId, password });
}

export function deleteManagedUser(userId) {
  return invokeAdminUsers({ action: "delete", userId });
}

export function claimOwnerRole() {
  return invokeAdminUsers({ action: "claim_owner" });
}

export function reorderManagedUsers(updates) {
  return invokeAdminUsers({ action: "reorder", updates });
}
