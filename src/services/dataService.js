import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { withRetry } from "../lib/retry";
import {
  sampleLists,
  customersByList,
  todayKpi,
} from "../data/sampleData";

function mapList(row) {
  return {
    id: row.id,
    name: row.name,
    count: row.customer_count ?? 0,
    activeUsers: row.active_users ?? 0,
  };
}

function resolveOperatorName(row, profilesById, profilesByEmail) {
  const byId = row.user_id ? profilesById.get(row.user_id) : "";
  const raw = row.operator_name || "";
  return byId || profilesByEmail.get(raw.toLowerCase()) || raw || "―";
}

function mapHistory(row, profilesById = new Map(), profilesByEmail = new Map()) {
  return {
    id: row.id,
    calledAt: row.called_at || "",
    at: row.called_at
      ? new Date(row.called_at).toLocaleString("ja-JP")
      : "",
    ap: resolveOperatorName(row, profilesById, profilesByEmail),
    status: row.status || "未架電",
    memo: row.memo || "",
  };
}

function mapCustomer(row, profilesById = new Map(), profilesByEmail = new Map()) {
  return {
    id: row.id,
    companyName: row.company_name,
    phone: row.phone,
    address: row.address || "",
    businessSubcategory: row.business_subcategory || "",
    ap: "",
    status: row.status || "",
    lastCallAt: row.last_called_at
      ? new Date(row.last_called_at).toLocaleString("ja-JP")
      : "",
    reminderAt: row.reminder_at
      ? new Date(row.reminder_at).toLocaleString("ja-JP")
      : "",
    reminderDue:
      Boolean(row.reminder_at) &&
      new Date(row.reminder_at).getTime() <= Date.now(),
    presence: "idle",
    presenceUser: "",
    history: (row.call_histories || [])
      .map((history) => mapHistory(history, profilesById, profilesByEmail))
      .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime()),
  };
}

export async function fetchLists() {
  if (!isSupabaseConfigured) return sampleLists;

  const { data, error } = await withRetry(() => supabase
    .from("lists")
    .select("id,name,customer_count,active_users")
    .eq("is_active", true)
    .order("created_at", { ascending: true }));

  if (error) throw error;
  return (data || []).map(mapList);
}

export async function fetchCustomers(listId) {
  if (!isSupabaseConfigured) return (customersByList[listId] || []).map((customer) => ({ ...customer, ap: customer.status || customer.history?.length ? customer.ap : "" }));

  const [{ data, error }, profilesResult] = await Promise.all([withRetry(() => supabase
    .from("customers")
    .select(`
      id,
      company_name,
      phone,
      address,
      business_subcategory,
      ap_name,
      status,
      last_called_at,
      reminder_at,
      call_histories (
        id,
        called_at,
        user_id,
        operator_name,
        status,
        memo
      )
    `)
    .eq("list_id", listId)
    .order("sort_order", { ascending: true })),
    withRetry(() => supabase.from("profiles").select("id,display_name,email")),
  ]);

  if (error) throw error;
  // profilesの参照権限がない環境でも顧客一覧自体は表示できるようにする。
  const profileRows = profilesResult.error ? [] : (profilesResult.data || []);
  const profilesById = new Map(profileRows.map((profile) => [profile.id, profile.display_name || profile.email || "名称未設定"]));
  const profilesByEmail = new Map(profileRows.filter((profile) => profile.email).map((profile) => [profile.email.toLowerCase(), profile.display_name || profile.email]));
  return (data || []).map((row) => {
    const customer = mapCustomer(row, profilesById, profilesByEmail);
    const latestHistory = customer.history[0];
    const legacyName = profilesByEmail.get(String(row.ap_name || "").toLowerCase()) || row.ap_name || "";
    return { ...customer, ap: customer.status || customer.history.length ? (latestHistory?.ap || legacyName) : "" };
  });
}

export async function saveCallResult({
  customerId,
  status,
  memo,
  reminderDate,
  reminderTime,
  operatorName,
  userId,
}) {
  if (!isSupabaseConfigured) {
    return {
      savedAt: new Date().toISOString(),
      demoMode: true,
    };
  }

  const reminderAt =
    reminderDate && reminderTime
      ? new Date(`${reminderDate}T${reminderTime}`).toISOString()
      : null;

  const calledAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      status,
      last_called_at: calledAt,
      reminder_at: reminderAt,
      ap_name: operatorName || "",
      updated_at: calledAt,
    })
    .eq("id", customerId);

  if (updateError) throw updateError;

  const { error: historyError } = await supabase
    .from("call_histories")
    .insert({
      customer_id: customerId,
      called_at: calledAt,
      user_id: userId || null,
      operator_name: operatorName,
      status,
      memo: memo || "",
      reminder_at: reminderAt,
    });

  if (historyError) throw historyError;

  return {
    savedAt: calledAt,
    demoMode: false,
  };
}



const VALID_STATUSES = ["NG", "フロントNG", "担当NG", "非決裁NG", "決裁NG", "再コール", "見込み", "非決裁見込み", "決裁見込み", "トスアップ"];
const DECISION_STATUSES = ["決裁NG", "決裁見込み"];

function summarizePerformance(rows = []) {
  return {
    calls: rows.length,
    valid: rows.filter((row) => VALID_STATUSES.includes(row.status)).length,
    decisions: rows.filter((row) => DECISION_STATUSES.includes(row.status)).length,
    prospects: rows.filter((row) => String(row.status || "").includes("見込み")).length,
    tossups: rows.filter((row) => row.status === "トスアップ").length,
  };
}

export async function fetchMyPerformance(userId) {
  const empty = { calls: 0, valid: 0, decisions: 0, prospects: 0, tossups: 0 };
  if (!userId) return { today: empty, month: empty };

  if (!isSupabaseConfigured) {
    const today = {
      calls: Number(todayKpi.find((item) => item.label === "コール数")?.value || 0),
      valid: Number(todayKpi.find((item) => item.label === "有効数")?.value || 0),
      decisions: Number(todayKpi.find((item) => item.label === "決裁数")?.value || 0),
      prospects: Number(todayKpi.find((item) => item.label === "見込み")?.value || 0),
      tossups: Number(todayKpi.find((item) => item.label === "トスアップ")?.value || 0),
    };
    return { today, month: today };
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await withRetry(() => supabase
    .from("call_histories")
    .select("status,called_at")
    .eq("user_id", userId)
    .gte("called_at", monthStart.toISOString()));

  if (error) throw error;
  const monthRows = data || [];
  const todayRows = monthRows.filter((row) => new Date(row.called_at).getTime() >= todayStart.getTime());
  return { today: summarizePerformance(todayRows), month: summarizePerformance(monthRows) };
}

export async function fetchTodayKpi(userId) {
  if (!isSupabaseConfigured || !userId) return todayKpi;

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { data, error } = await withRetry(() => supabase
    .from("call_histories")
    .select("status")
    .eq("user_id", userId)
    .gte("called_at", start.toISOString()));

  if (error) throw error;

  const rows = data || [];
  return [
    { label: "コール数", value: rows.length, unit: "件" },
    {
      label: "有効数",
      value: rows.filter((row) => ["NG", "フロントNG", "担当NG", "非決裁NG", "決裁NG", "再コール", "見込み", "非決裁見込み", "決裁見込み", "トスアップ"].includes(row.status)).length,
      unit: "件",
    },
    {
      label: "決裁数",
      value: rows.filter((row) => ["決裁NG", "決裁見込み"].includes(row.status)).length,
      unit: "件",
    },
    {
      label: "見込み",
      value: rows.filter((row) => String(row.status || "").includes("見込み")).length,
      unit: "件",
    },
    {
      label: "トスアップ",
      value: rows.filter((row) => row.status === "トスアップ").length,
      unit: "件",
    },
  ];
}
