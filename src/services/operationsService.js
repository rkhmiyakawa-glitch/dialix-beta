import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { customersByList, sampleLists } from "../data/sampleData";

function mapTask(row) {
  return {
    id: row.id,
    listId: row.list_id,
    listName: row.lists?.name || "リスト",
    companyName: row.company_name,
    phone: row.phone,
    address: row.address || "",
    ap: row.ap_name || "",
    status: row.status || "",
    reminderAtRaw: row.reminder_at || null,
    reminderAt: row.reminder_at ? new Date(row.reminder_at).toLocaleString("ja-JP") : "",
    lastCallAt: row.last_called_at ? new Date(row.last_called_at).toLocaleString("ja-JP") : "",
  };
}

const demoTasks = {
  reminders: [],
  prospects: [],
  tossups: [],
  dueToday: [],
  allReminders: [],
};

function buildAssigneeFilter(currentUser = {}) {
  const candidates = [currentUser.displayName, currentUser.email]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!candidates.length) return null;
  return candidates.map((value) => `ap_name.eq.${value.replace(/[(),]/g, "")}`).join(",");
}

export async function fetchOperationalTasks(currentUser = {}) {
  if (!isSupabaseConfigured) return demoTasks;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const baseColumns = "id,list_id,company_name,phone,address,ap_name,status,last_called_at,reminder_at,lists(name)";
  const assigneeFilter = buildAssigneeFilter(currentUser);
  if (!assigneeFilter) return demoTasks;

  const overdueQuery = supabase.from("customers").select(baseColumns)
    .not("reminder_at", "is", null)
    .or(assigneeFilter)
    .lte("reminder_at", now.toISOString())
    .order("reminder_at", { ascending: true })
    .limit(100);
  const allReminderQuery = supabase.from("customers").select(baseColumns)
    .not("reminder_at", "is", null)
    .or(assigneeFilter)
    .gte("reminder_at", startOfToday.toISOString())
    .order("reminder_at", { ascending: true })
    .limit(300);

  const [reminderResult, prospectResult, tossupResult, allReminderResult] = await Promise.all([
    overdueQuery,
    supabase.from("customers").select(baseColumns)
      .in("status", ["非決裁見込み", "決裁見込み", "見込み", "見込み留守"])
      .or(assigneeFilter)
      .order("last_called_at", { ascending: true, nullsFirst: true })
      .limit(100),
    supabase.from("customers").select(baseColumns).eq("status", "トスアップ").order("last_called_at", { ascending: false, nullsFirst: false }).limit(100),
    allReminderQuery,
  ]);

  const failed = [reminderResult, prospectResult, tossupResult, allReminderResult].find((result) => result.error);
  if (failed?.error) throw failed.error;

  const futureReminders = allReminderResult.data || [];
  const dueToday = futureReminders
    .filter((row) => row.reminder_at <= endOfToday.toISOString())
    .slice(0, 100);
  return {
    reminders: (reminderResult.data || []).map(mapTask),
    prospects: (prospectResult.data || []).map(mapTask),
    tossups: (tossupResult.data || []).map(mapTask),
    dueToday: dueToday.map(mapTask),
    allReminders: futureReminders.map(mapTask),
  };
}

const groupedSearchStatuses = {
  NG: ["NG", "非決裁NG", "決裁NG"],
  見込み: ["見込み", "非決裁見込み", "決裁見込み"],
};

export async function searchCustomersAcrossLists(conditions = {}) {
  const values = typeof conditions === "string" ? { keyword: conditions } : conditions;
  const clean = String(values.keyword || "").trim();
  const ap = String(values.ap || "").trim();
  const statuses = Array.isArray(values.statuses)
    ? values.statuses.filter(Boolean)
    : values.status && values.status !== "all" ? [String(values.status)] : [];
  if (!clean && !ap && statuses.length === 0) return [];

  if (!isSupabaseConfigured) {
    const normalized = clean.toLowerCase();
    const digits = clean.replace(/\D/g, "");
    const normalizedAp = ap.toLowerCase();
    return sampleLists.flatMap((list) =>
      (customersByList[list.id] || [])
        .filter((customer) => {
          const matchesKeyword = !clean ||
            customer.companyName.toLowerCase().includes(normalized) ||
            (digits && String(customer.phone || "").replace(/\D/g, "").includes(digits));
          const matchesAp = !ap || String(customer.ap || "").toLowerCase().includes(normalizedAp);
          const matchesStatus = statuses.length === 0 || statuses.some((status) =>
            (status === "uncontacted" && (!customer.status || customer.status === "未架電")) ||
            groupedSearchStatuses[status]?.includes(customer.status) ||
            customer.status === status
          );
          return matchesKeyword && matchesAp && matchesStatus;
        })
        .map((customer) => ({
          ...customer,
          listId: list.id,
          listName: list.name,
        }))
    ).slice(0, 50);
  }
  let query = supabase
    .from("customers")
    .select("id,list_id,company_name,phone,address,ap_name,status,last_called_at,reminder_at,lists(name)");
  if (clean) {
    const digits = clean.replace(/\D/g, "");
    const safeText = clean.replace(/[%,]/g, "");
    const filters = [`company_name.ilike.%${safeText}%`];
    if (digits) {
      filters.push(`phone.ilike.%${digits}%`);
    }
    query = query.or(filters.join(","));
  }
  if (ap) query = query.ilike("ap_name", `%${ap.replace(/[%]/g, "")}%`);
  if (statuses.length > 0) {
    const includeUncontacted = statuses.includes("uncontacted");
    const dbStatuses = [...new Set(
      statuses
        .filter((status) => status !== "uncontacted")
        .flatMap((status) => groupedSearchStatuses[status] || [status])
    )];
    if (includeUncontacted && dbStatuses.length > 0) {
      query = query.or(`status.is.null,status.eq.,status.eq.未架電,status.in.(${dbStatuses.join(",")})`);
    } else if (includeUncontacted) {
      query = query.or("status.is.null,status.eq.,status.eq.未架電");
    } else {
      query = query.in("status", dbStatuses);
    }
  }
  const { data, error } = await query
    .order("last_called_at", { ascending: false, nullsFirst: false })
    .limit(50);
  if (error) throw error;
  return (data || []).map(mapTask);
}

export function subscribeOperationalTasks(onChange) {
  if (!isSupabaseConfigured) return () => {};
  const channel = supabase
    .channel("dialix-operational-tasks")
    .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, () => onChange?.())
    .subscribe();
  return () => supabase.removeChannel(channel);
}
