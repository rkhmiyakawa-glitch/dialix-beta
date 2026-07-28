import { isSupabaseConfigured, supabase } from "../lib/supabase";

function periodRange(period) {
  const now = new Date();
  const start = new Date(now);
  if (period === "week") {
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day); start.setHours(0, 0, 0, 0);
  } else if (period === "month") {
    start.setDate(1); start.setHours(0, 0, 0, 0);
  } else start.setHours(0, 0, 0, 0);
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
  ], overdue: [],
};

export async function fetchDashboardData(period = "today") {
  if (!isSupabaseConfigured) return demo;
  const { start, end, label } = periodRange(period);
  const historyColumns = "id,user_id,operator_name,status,memo,called_at,customers(company_name)";
  const [historyResult, profilesResult, overdueResult] = await Promise.all([
    supabase.from("call_histories").select(historyColumns).gte("called_at", start.toISOString()).lte("called_at", end.toISOString()),
    supabase.from("profiles").select("id,display_name,role,is_active").eq("is_active", true),
    supabase.from("customers").select("id,list_id,company_name,ap_name,status,reminder_at,lists(name)").not("reminder_at", "is", null).lt("reminder_at", new Date().toISOString()).order("reminder_at", { ascending: true }).limit(100),
  ]);
  const failed = [historyResult, profilesResult, overdueResult].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const histories = historyResult.data || [];
  const profiles = profilesResult.data || [];
  const byUser = new Map(profiles.map((p) => [p.id, { userId: p.id, displayName: p.display_name || "名称未設定", callCount: 0, validCount: 0, decisionCount: 0, prospectCount: 0, tossupCount: 0 }]));
  histories.forEach((h) => {
    const key = h.user_id || `name:${h.operator_name}`;
    if (!byUser.has(key)) byUser.set(key, { userId: key, displayName: h.operator_name || "不明", callCount: 0, validCount: 0, decisionCount: 0, prospectCount: 0, tossupCount: 0 });
    const row = byUser.get(key); row.callCount += 1;
    if (["NG", "フロントNG", "担当NG", "非決裁NG", "決裁NG", "再コール", "見込み", "非決裁見込み", "決裁見込み", "トスアップ"].includes(h.status)) row.validCount += 1;
    if (["決裁NG", "決裁見込み"].includes(h.status)) row.decisionCount += 1;
    if (String(h.status || "").includes("見込み")) row.prospectCount += 1;
    if (h.status === "トスアップ") row.tossupCount += 1;
  });
  const operators = [...byUser.values()];
  const sortRanking = (metricKey) => operators
    .filter((row) => row[metricKey] > 0)
    .sort((a, b) => b[metricKey] - a[metricKey] || b.callCount - a.callCount || a.displayName.localeCompare(b.displayName, "ja"));
  const callRanking = sortRanking("callCount");
  const prospectRanking = sortRanking("prospectCount");
  const tossupRanking = sortRanking("tossupCount");
  const validCount = histories.filter((h) => ["NG", "フロントNG", "担当NG", "非決裁NG", "決裁NG", "再コール", "見込み", "非決裁見込み", "決裁見込み", "トスアップ"].includes(h.status)).length;
  const decisionCount = histories.filter((h) => ["決裁NG", "決裁見込み"].includes(h.status)).length;
  const mapReminder = (r) => ({ id: r.id, listId: r.list_id, companyName: r.company_name, apName: r.ap_name || "未設定", status: r.status, reminderAt: r.reminder_at, listName: r.lists?.name || "リスト" });
  const overdue = (overdueResult.data || []).map(mapReminder);

  return {
    rangeLabel: label,
    metrics: {
      callCount: histories.length,
      validCount,
      validRate: histories.length ? Number((validCount / histories.length * 100).toFixed(1)) : 0,
      decisionCount,
      decisionRate: validCount ? Number((decisionCount / validCount * 100).toFixed(1)) : 0,
      prospectCount: histories.filter((h) => String(h.status || "").includes("見込み")).length,
      tossupCount: histories.filter((h) => h.status === "トスアップ").length,
      activeOperatorCount: callRanking.length,
      totalOperatorCount: profiles.length,
      overdueCount: overdue.length,
    }, callRanking, prospectRanking, tossupRanking, overdue,
  };
}

export function subscribeDashboardChanges(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase.channel("dialix-dashboard-realtime")
    .on("postgres_changes", { event: "*", schema: "public", table: "call_histories" }, () => onChange?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => onChange?.())
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => onChange?.())
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}
