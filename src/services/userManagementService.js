import { isSupabaseConfigured, supabase } from "../lib/supabase";

async function invokeAdminUsers(body) {
  if (!isSupabaseConfigured) throw new Error("Supabase接続設定がありません。");
  const { data, error } = await supabase.functions.invoke("admin-users", { body });
  if (error) throw new Error(error.message || "ユーザー管理処理に失敗しました。");
  if (!data?.ok) throw new Error(data?.error || "ユーザー管理処理に失敗しました。");
  return data;
}

export function createManagedUser(payload) {
  return invokeAdminUsers({ action: "create", ...payload });
}

export function updateManagedUser(payload) {
  return invokeAdminUsers({ action: "update", ...payload });
}

export function resetManagedUserPassword(userId, password) {
  return invokeAdminUsers({ action: "reset_password", userId, password });
}

export function deleteManagedUser(userId) {
  return invokeAdminUsers({ action: "delete", userId });
}
