import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { withRetry } from "../lib/retry";
import { fetchAllRows } from "../lib/fetchAllRows";
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

let listCache = { data: null, expiresAt: 0, pending: null };

export function invalidateListCache() {
  listCache = { data: null, expiresAt: 0, pending: null };
}

async function loadLists() {
  if (!isSupabaseConfigured) return sampleLists;

  const { data, error } = await withRetry(() => supabase
    .from("lists")
    .select("id,name,customer_count,sort_order,created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true }));

  if (error) throw error;
  const rows = data || [];
  if (!rows.length) return [];

  // 全リストの4種類の件数をDB内で一度に集計する。
  // 旧実装の「リスト数 × 4リクエスト」を常に2リクエストへ固定する。
  const countResult = await withRetry(() => supabase.rpc("get_list_status_counts"));
  if (countResult.error) throw countResult.error;
  const countsByList = new Map((countResult.data || []).map((item) => [item.list_id, {
    totalCount: Number(item.total_count || 0),
    uncontactedCount: Number(item.uncontacted_count || 0),
    absenceCount: Number(item.absence_count || 0),
    recallCount: Number(item.recall_count || 0),
  }]));

  return rows.map((row) => {
    const counts = countsByList.get(row.id) || {};
    return mapList({ ...row, customer_count: counts.totalCount ?? row.customer_count }, counts);
  });
}

export async function fetchLists({ force = false } = {}) {
  if (!isSupabaseConfigured) return sampleLists;
  const now = Date.now();
  if (!force && listCache.data && listCache.expiresAt > now) return listCache.data;
  if (!force && listCache.pending) return listCache.pending;
  const pending = loadLists()
    .then((data) => {
      listCache = { data, expiresAt: Date.now() + 60 * 1000, pending: null };
      return data;
    })
    .catch((error) => {
      listCache.pending = null;
      throw error;
    });
  listCache.pending = pending;
  return pending;
}

export async function fetchCustomers(listId) {
  if (!isSupabaseConfigured) return (customersByList[listId] || []).map((customer) => ({ ...customer, ap: customer.status || customer.history?.length ? customer.ap : "" }));

  // 顧客一覧では履歴を取得しない。大量リストでの初回表示を優先し、履歴は顧客を開いた時だけ取得する。
  const data = await fetchAllRows(() => supabase
    .from("customers")
    .select("id,company_name,phone,address,business_subcategory,ap_name,status,last_called_at,reminder_at")
    .eq("list_id", listId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true }));

  return data.map((row) => ({
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

export async function fetchAssignableProfiles() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await withRetry(() => supabase
    .from("profiles")
    .select("id,display_name,email,is_active")
    .eq("is_active", true)
    .order("display_name", { ascending: true }));
  if (error) throw error;
  return (data || []).map((profile) => ({
    id: profile.id,
    displayName: profile.display_name || profile.email || "名称未設定",
  }));
}

export async function saveCallResult({
  customerId,
  status,
  memo,
  reminderDate,
  reminderTime,
  operatorName,
  userId,
  reminderAssignee,
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
  const assignedApName =
    status === "前確依頼" && reminderAssignee?.displayName
      ? reminderAssignee.displayName
      : operatorName || "";

  // 顧客更新と履歴追加は互いに依存しないため並列実行し、保存待ち時間を短縮する。
  const [updateResult, historyResult] = await Promise.all([
    supabase
      .from("customers")
      .update({
        status,
        last_called_at: calledAt,
        reminder_at: reminderAt,
        ap_name: assignedApName,
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

  invalidateListCache();
  return {
    savedAt: calledAt,
    demoMode: false,
  };
}



const VALID_STATUSES = ["NG", "フロントNG", "担当NG", "非決裁NG", "決裁NG", "対象外", "内容相違", "再コール", "見込み", "非決裁見込み", "決裁見込み", "トスアップ"];
const DECISION_STATUSES = ["決裁NG", "決裁見込み"];
const NON_CALL_STATUSES = ["内容修正"];

function summarizePerformance(rows = []) {
  const result = { calls: 0, valid: 0, decisions: 0, prospects: 0, tossups: 0 };
  for (const row of rows) {
    const status = row.status;
    if (NON_CALL_STATUSES.includes(status)) continue;
    result.calls += 1;
    if (VALID_STATUSES.includes(status)) result.valid += 1;
    if (DECISION_STATUSES.includes(status)) result.decisions += 1;
    if (String(status || "").includes("見込み")) result.prospects += 1;
    if (status === "トスアップ") result.tossups += 1;
  }
  return result;
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
  const todayJa = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(now);
  const todayStart = new Date(`${todayJa}T00:00:00+09:00`);
  const monthStart = new Date(`${todayJa.slice(0, 7)}-01T00:00:00+09:00`);

  const { data, error } = await withRetry(() => supabase
    .from("call_histories")
    .select("status,called_at")
    .eq("user_id", userId)
    .eq("counts_toward_kpi", true)
    .gte("called_at", monthStart.toISOString()));

  if (error) throw error;
  const monthRows = data || [];
  const todayRows = monthRows.filter((row) => new Date(row.called_at).getTime() >= todayStart.getTime());
  return { today: summarizePerformance(todayRows), month: summarizePerformance(monthRows) };
}

export async function fetchTodayKpi(userId) {
  if (!isSupabaseConfigured || !userId) return todayKpi;

  const todayJa = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
  const start = new Date(`${todayJa}T00:00:00+09:00`);

  const { data, error } = await withRetry(() => supabase
    .from("call_histories")
    .select("status")
    .eq("user_id", userId)
    .eq("counts_toward_kpi", true)
    .gte("called_at", start.toISOString()));

  if (error) throw error;

  const rows = data || [];
  const summary = summarizePerformance(rows);
  return [
    { label: "コール", value: summary.calls, unit: "件" },
    { label: "有効", value: summary.valid, unit: "件" },
    { label: "決裁", value: summary.decisions, unit: "件" },
    { label: "見込み", value: summary.prospects, unit: "件" },
    { label: "トスアップ", value: summary.tossups, unit: "件" },
  ];
}
