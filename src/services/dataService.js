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

function mapHistory(row) {
  return {
    id: row.id,
    calledAt: row.called_at || "",
    at: row.called_at
      ? new Date(row.called_at).toLocaleString("ja-JP")
      : "",
    ap: row.operator_name || "―",
    status: row.status || "未架電",
    memo: row.memo || "",
  };
}

function mapCustomer(row) {
  return {
    id: row.id,
    companyName: row.company_name,
    phone: row.phone,
    address: row.address || "",
    businessSubcategory: row.business_subcategory || "",
    ap: row.ap_name || "",
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
      .map(mapHistory)
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
  if (!isSupabaseConfigured) return customersByList[listId] || [];

  const { data, error } = await withRetry(() => supabase
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
        operator_name,
        status,
        memo
      )
    `)
    .eq("list_id", listId)
    .order("sort_order", { ascending: true }));

  if (error) throw error;
  return (data || []).map(mapCustomer);
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
