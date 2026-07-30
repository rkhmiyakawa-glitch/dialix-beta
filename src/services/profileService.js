import { isSupabaseConfigured, supabase } from "../lib/supabase";

const demoProfile = { id: "demo-admin", displayName: "宮川", email: "demo@dialix.jp", role: "owner", isActive: true };
const demoUsers = [
  demoProfile,
  { id: "demo-sv", displayName: "佐藤 SV", email: "sv@dialix.jp", role: "sv", isActive: true },
  { id: "demo-op", displayName: "田中", email: "operator@dialix.jp", role: "operator", isActive: true },
];

const mapProfile = (row) => ({
  id: row.id,
  displayName: row.display_name || row.email || "名称未設定",
  email: row.email || "",
  role: row.role || "operator",
  isActive: row.is_active !== false,
  createdAt: row.created_at || null,
  lastActiveAt: row.last_active_at || null,
  lastLoginAt: row.last_login_at || null,
});

export async function fetchMyProfile(user) {
  if (!isSupabaseConfigured) return demoProfile;
  const { data, error } = await supabase.from("profiles").select("id,display_name,email,role,is_active,created_at,last_active_at,last_login_at").eq("id", user.id).single();
  if (error) throw error;
  return mapProfile(data);
}

export async function fetchProfiles() {
  if (!isSupabaseConfigured) return demoUsers;
  const { data, error } = await supabase.from("profiles").select("id,display_name,email,role,is_active,created_at,last_active_at,last_login_at").order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapProfile);
}

export async function updateProfile({ id, displayName, role, isActive }) {
  if (!isSupabaseConfigured) return { id, displayName, role, isActive };
  const { data, error } = await supabase.rpc("admin_update_profile", {
    target_user_id: id,
    next_display_name: displayName,
    next_role: role,
    next_is_active: isActive,
  });
  if (error) throw error;
  return data;
}

export async function touchUserActivity() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc("touch_user_activity");
  if (error) throw error;
}

export async function updateMyDisplayName(displayName) {
  if (!isSupabaseConfigured) return { ...demoProfile, displayName };
  const cleanName = String(displayName || "").trim();
  if (!cleanName) throw new Error("表示名を入力してください。");

  // profiles の直接 UPDATE は RLS 構成によって拒否されるため、
  // 本人の表示名だけを変更できる専用 RPC を使用する。
  const { data, error } = await supabase.rpc("update_my_display_name", {
    next_display_name: cleanName,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error("更新後のプロフィールを取得できませんでした。");

  // ヘッダー等は profiles を正として表示する。認証メタデータも可能な
  // 範囲で同期するが、こちらの失敗で保存済みプロフィールを巻き戻さない。
  await supabase.auth.updateUser({
    data: { display_name: cleanName },
  }).catch(() => {});

  window.dispatchEvent(new CustomEvent("dialix:profile-updated", {
    detail: { id: row.id, displayName: row.display_name },
  }));
  return mapProfile(row);
}
