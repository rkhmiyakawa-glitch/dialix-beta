import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { withRetry } from "../lib/retry";
import {
  sampleLists,
  customersByList,
  todayKpi,
} from "../data/sampleData";

function mapList(row, statusCounts = {}) {
  return {
    id: row.id,
    name: row.name,
    count: row.customer_count ?? 0,
    uncontactedCount: statusCounts.uncontactedCount ?? 0,
    absenceCount: statusCounts.absenceCount ?? 0,
    recallCount: statusCounts.recallCount ?? 0,
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
    .select("id,name,customer_count")
    .eq("is_active", true)
    .order("created_at", { ascending: true }));

  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  // リスト一覧で必要な最低限の列だけを1回取得し、未架電・留守・再コールを集計する。
  const { data: customers, error: customerError } = await withRetry(() => supabase
    .from("customers")
    .select("list_id,status")
    .in("list_id", rows.map((row) => row.id)));

  if (customerError) throw customerError;
  const countsByList = new Map();
  for (const customer of customers || []) {
    const current = countsByList.get(customer.list_id) || { uncontactedCount: 0, absenceCount: 0, recallCount: 0 };
    const status = String(customer.status || "").trim();
    if (!status || status === "未架電") current.uncontactedCount += 1;
    if (status === "留守") current.absenceCount += 1;
    if (status === "再コール") current.recallCount += 1;
    countsByList.set(customer.list_id, current);
  }

  return rows.map((row) => mapList(row, countsByList.get(row.id)));
}

export async function fetchCustomers(listId) {
  if (!isSupabaseConfigured) return (customersByList[listId] || []).map((customer) => ({ ...customer, ap: customer.status || customer.history?.length ? customer.ap : "" }));

  // 顧客一覧では履歴を取得しない。大量リストでの初回表示を優先し、履歴は顧客を開いた時だけ取得する。
  const { data, error } = await withRetry(() => supabase
    .from("customers")
    .select("id,company_name,phone,address,business_subcategory,ap_name,status,last_called_at,reminder_at")
    .eq("list_id", listId)
    .order("sort_order", { ascending: true }));

  if (error) throw error;
  return (data || []).map((row) => ({
    ...mapCustomer({ ...row, call_histories: [] }),
    ap: row.status ? (row.ap_name || "") : "",
  }));
}

let profileCache = { rows: [], expiresAt: 0 };
async function fetchProfileMaps() {
  const now = Date.now();
  if (profileCache.expiresAt > now) {
    const rows = profileCache.rows;
    return {
      byId: new Map(rows.map((profile) => [profile.id, profile.display_name || profile.email || "名称未設定"])),
      byEmail: new Map(rows.filter((profile) => profile.email).map((profile) => [profile.email.toLowerCase(), profile.display_name || profile.email])),
    };
  }
  const result = await withRetry(() => supabase.from("profiles").select("id,display_name,email"));
  const rows = result.error ? [] : (result.data || []);
  profileCache = { rows, expiresAt: now + 5 * 60 * 1000 };
  return {
    byId: new Map(rows.map((profile) => [profile.id, profile.display_name || profile.email || "名称未設定"])),
    byEmail: new Map(rows.filter((profile) => profile.email).map((profile) => [profile.email.toLowerCase(), profile.display_name || profile.email])),
  };
}

export async function fetchCustomerDetails(customerId) {
  if (!isSupabaseConfigured) {
    const customer = Object.values(customersByList).flat().find((item) => item.id === customerId);
    return customer ? { ...customer } : null;
  }

  const [customerResult, profileMaps] = await Promise.all([
    withRetry(() => supabase
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
      .eq("id", customerId)
      .order("called_at", { foreignTable: "call_histories", ascending: false })
      .limit(50, { foreignTable: "call_histories" })
      .maybeSingle()),
    fetchProfileMaps(),
  ]);

  if (customerResult.error) throw customerResult.error;
  if (!customerResult.data) return null;
  const row = customerResult.data;
  const customer = mapCustomer(row, profileMaps.byId, profileMaps.byEmail);
  const latestHistory = customer.history[0];
  const legacyName = profileMaps.byEmail.get(String(row.ap_name || "").toLowerCase()) || row.ap_name || "";
  return { ...customer, ap: customer.status || customer.history.length ? (latestHistory?.ap || legacyName) : "" };
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

  // 顧客更新と履歴追加は互いに依存しないため並列実行し、保存待ち時間を短縮する。
  const [updateResult, historyResult] = await Promise.all([
    supabase
      .from("customers")
      .update({
        status,
        last_called_at: calledAt,
        reminder_at: reminderAt,
        ap_name: operatorName || "",
        updated_at: calledAt,
      })
      .eq("id", customerId),
    supabase
      .from("call_histories")
      .insert({
        customer_id: customerId,
        called_at: calledAt,
        user_id: userId || null,
        operator_name: operatorName,
        status,
        memo: memo || "",
        reminder_at: reminderAt,
      }),
  ]);

  if (updateResult.error) throw updateResult.error;
  if (historyResult.error) throw historyResult.error;

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
      calls: Number(todayKpi.find((item) => ["コール", "コール数"].includes(item.label))?.value || 0),
      valid: Number(todayKpi.find((item) => ["有効", "有効数"].includes(item.label))?.value || 0),
      decisions: Number(todayKpi.find((item) => ["決裁", "決裁数"].includes(item.label))?.value || 0),
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
    { label: "コール", value: rows.length, unit: "件" },
    {
      label: "有効",
      value: rows.filter((row) => ["NG", "フロントNG", "担当NG", "非決裁NG", "決裁NG", "再コール", "見込み", "非決裁見込み", "決裁見込み", "トスアップ"].includes(row.status)).length,
      unit: "件",
    },
    {
      label: "決裁",
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
