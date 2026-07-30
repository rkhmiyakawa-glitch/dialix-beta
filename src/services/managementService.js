import { isSupabaseConfigured, supabase } from "../lib/supabase";

const demoKpi = [
  { userId: "demo-admin", displayName: "宮川", role: "admin", callCount: 18, validCount: 12, decisionCount: 4, prospectCount: 3, tossupCount: 1, reCallCount: 4 },
  { userId: "demo-op", displayName: "田中", role: "operator", callCount: 14, validCount: 9, decisionCount: 3, prospectCount: 2, tossupCount: 1, reCallCount: 3 },
];

export async function fetchOperatorKpi(targetDate) {
  if (!isSupabaseConfigured) return demoKpi;
  const { data, error } = await supabase.rpc("get_daily_operator_kpi", { target_date: targetDate });
  if (error) throw error;
  return (data || []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name || "名称未設定",
    role: row.role || "operator",
    callCount: Number(row.call_count || 0),
    validCount: Number(row.valid_count || 0),
    decisionCount: Number(row.decision_count || 0),
    prospectCount: Number(row.prospect_count || 0),
    tossupCount: Number(row.tossup_count || 0),
    reCallCount: Number(row.re_call_count || 0),
  }));
}

export async function fetchAuditLogs(limit = 200) {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id,actor_id,actor_name,action,table_name,record_id,summary,old_data,new_data,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export function subscribeManagementChanges({ onKpiChange, onAuditChange }) {
  if (!isSupabaseConfigured) return () => {};
  let kpiTimer;
  let auditTimer;
  const notifyKpi = () => {
    if (document.visibilityState !== "visible") return;
    window.clearTimeout(kpiTimer);
    kpiTimer = window.setTimeout(() => onKpiChange?.(), 1500);
  };
  const notifyAudit = () => {
    if (document.visibilityState !== "visible") return;
    window.clearTimeout(auditTimer);
    auditTimer = window.setTimeout(() => onAuditChange?.(), 1500);
  };
  const channel = supabase
    .channel("dialix-management-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "call_histories" }, notifyKpi)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, notifyAudit)
    .subscribe();
  return () => {
    window.clearTimeout(kpiTimer);
    window.clearTimeout(auditTimer);
    supabase.removeChannel(channel);
  };
}
