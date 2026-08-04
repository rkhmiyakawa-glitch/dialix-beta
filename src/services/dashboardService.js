import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { fetchKpiResetState } from "./kpiResetService";

function periodRange(period) {
  const now = new Date();
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  const start = new Date(`${today}T00:00:00+09:00`);
  if (period === "week") {
    const day = (start.getUTCDay() + 6) % 7;
    start.setUTCDate(start.getUTCDate() - day);
  } else if (period === "month") {
    const month = today.slice(0, 7);
    return { start: new Date(`${month}-01T00:00:00+09:00`), end: now, label: "今月" };
  }
  return { start, end: now, label: period === "week" ? "今週" : period === "month" ? "今月" : "今日" };
}

const demo = {
  rangeLabel: "今日",
  metrics: { callCount: 32, validCount: 21, validRate: 65.6, decisionCount: 7, decisionRate: 33.3, prospectCount: 5, tossupCount: 2, activeOperatorCount: 2, totalOperatorCount: 2, overdueCount: 1 },
  callRanking: [
    { userId: "demo-1", displayName: "宮川", callCount: 18, validCount: 12, prospectCount: 3, tossupCount: 1 },
    { userId: "demo-2", displayName: "田中", callCount: 14, validCount: 9, prospectCount: 2, tossupCount: 1 },
  ],
  prospectRanking: [
    { userId: "demo-1", displayName: "宮川", callCount: 18, validCount: 12, prospectCount: 3, tossupCount: 1 },
    { userId: "demo-2", displayName: "田中", callCount: 14, validCount: 9, prospectCount: 2, tossupCount: 1 },
  ],
  tossupRanking: [
    { userId: "demo-1", displayName: "宮川", callCount: 18, validCount: 12, prospectCount: 3, tossupCount: 1 },
    { userId: "demo-2", displayName: "田中", callCount: 14, validCount: 9, prospectCount: 2, tossupCount: 1 },
  ], overdue: [], activeApNames: ["宮川", "田中"],
};

export async function fetchDashboardData(period = "today") {
  if (!isSupabaseConfigured) return demo;
  const { start, end, label } = periodRange(period);
  const resetState = await fetchKpiResetState();
  const resetAt = resetState.resetAt ? new Date(resetState.resetAt) : null;
  const effectiveStart = resetAt && resetAt > start ? resetAt : start;
  const [kpiResult, profilesResult, overdueResult] = await Promise.all([
    supabase.rpc("get_management_dashboard_kpi", {
      start_at: effectiveStart.toISOString(),
      end_at: end.toISOString(),
    }),
    supabase.from("profiles").select("id,display_name,role,is_active").eq("is_active", true),
    supabase.from("customers").select("id,list_id,company_name,ap_name,status,reminder_at,lists(name)").not("reminder_at", "is", null).lt("reminder_at", new Date().toISOString()).order("reminder_at", { ascending: true }).limit(100),
  ]);
  const failed = [kpiResult, profilesResult, overdueResult].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const profiles = profilesResult.data || [];
  const operators = (kpiResult.data || []).map((row) => ({
    userId: row.user_key,
    displayName: row.display_name || "名称未設定",
    callCount: Number(row.call_count || 0),
    validCount: Number(row.valid_count || 0),
    decisionCount: Number(row.decision_count || 0),
    prospectCount: Number(row.prospect_count || 0),
    tossupCount: Number(row.tossup_count || 0),
  }));
  const totals = operators.reduce((sum, row) => ({
    callCount: sum.callCount + row.callCount,
    validCount: sum.validCount + row.validCount,
    decisionCount: sum.decisionCount + row.decisionCount,
    prospectCount: sum.prospectCount + row.prospectCount,
    tossupCount: sum.tossupCount + row.tossupCount,
  }), { callCount: 0, validCount: 0, decisionCount: 0, prospectCount: 0, tossupCount: 0 });
  const sortRanking = (metricKey) => operators
    .filter((row) => row[metricKey] > 0)
    .sort((a, b) => b[metricKey] - a[metricKey] || b.callCount - a.callCount || a.displayName.localeCompare(b.displayName, "ja"));
  const callRanking = sortRanking("callCount");
  const prospectRanking = sortRanking("prospectCount");
  const tossupRanking = sortRanking("tossupCount");
  const mapReminder = (r) => ({ id: r.id, listId: r.list_id, companyName: r.company_name, apName: r.ap_name || "未設定", status: r.status, reminderAt: r.reminder_at, listName: r.lists?.name || "リスト" });
  const overdue = (overdueResult.data || []).map(mapReminder);

  const activeApNames = profiles
    .filter((profile) => ["owner", "admin", "admin_a", "sv", "operator"].includes(String(profile.role || "").toLowerCase()))
    .map((profile) => profile.display_name || "")
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "ja"));

  return {
    rangeLabel: label,
    activeApNames,
    metrics: {
      callCount: totals.callCount,
      validCount: totals.validCount,
      validRate: totals.callCount ? Number((totals.validCount / totals.callCount * 100).toFixed(1)) : 0,
      decisionCount: totals.decisionCount,
      decisionRate: totals.validCount ? Number((totals.decisionCount / totals.validCount * 100).toFixed(1)) : 0,
      prospectCount: totals.prospectCount,
      tossupCount: totals.tossupCount,
      activeOperatorCount: callRanking.length,
      totalOperatorCount: profiles.length,
      overdueCount: overdue.length,
    }, callRanking, prospectRanking, tossupRanking, overdue, resetAt: resetState.resetAt, canUndoReset: resetState.canUndo,
  };
}

export function subscribeDashboardChanges(onChange) {
  if (!isSupabaseConfigured) return () => {};
  let timer;
  const notify = () => {
    window.clearTimeout(timer);
    if (document.visibilityState !== "visible") return;
    timer = window.setTimeout(() => onChange?.(), 1500);
  };
  const channel = supabase.channel("dialix-dashboard-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "call_histories" }, notify)
    .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, notify)
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, notify)
    .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records" }, notify)
    .subscribe();
  return () => { window.clearTimeout(timer); supabase.removeChannel(channel); };
}
