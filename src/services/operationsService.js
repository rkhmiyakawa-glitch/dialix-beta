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
};

export async function fetchOperationalTasks() {
  if (!isSupabaseConfigured) return demoTasks;

  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const baseColumns = "id,list_id,company_name,phone,address,ap_name,status,last_called_at,reminder_at,lists(name)";
  const [reminderResult, prospectResult, tossupResult, todayResult] = await Promise.all([
    supabase.from("customers").select(baseColumns).not("reminder_at", "is", null).lte("reminder_at", now.toISOString()).order("reminder_at", { ascending: true }).limit(100),
    supabase.from("customers").select(baseColumns).in("status", ["非決裁見込み", "決裁見込み", "見込み", "見込み留守"]).order("last_called_at", { ascending: true, nullsFirst: true }).limit(100),
    supabase.from("customers").select(baseColumns).eq("status", "トスアップ").order("last_called_at", { ascending: false, nullsFirst: false }).limit(100),
    supabase.from("customers").select(baseColumns).not("reminder_at", "is", null).gt("reminder_at", now.toISOString()).lte("reminder_at", endOfToday.toISOString()).order("reminder_at", { ascending: true }).limit(100),
  ]);

  const failed = [reminderResult, prospectResult, tossupResult, todayResult].find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    reminders: (reminderResult.data || []).map(mapTask),
    prospects: (prospectResult.data || []).map(mapTask),
    tossups: (tossupResult.data || []).map(mapTask),
    dueToday: (todayResult.data || []).map(mapTask),
  };
}

export async function searchCustomersAcrossLists(keyword) {
  const clean = String(keyword || "").trim();
  if (!clean) return [];

  if (!isSupabaseConfigured) {
    const normalized = clean.toLowerCase();
    const digits = clean.replace(/\D/g, "");
    return sampleLists.flatMap((list) =>
      (customersByList[list.id] || [])
        .filter((customer) =>
          customer.companyName.toLowerCase().includes(normalized) ||
          (digits && customer.phone.replace(/\D/g, "").includes(digits))
        )
        .map((customer) => ({
          ...customer,
          listId: list.id,
          listName: list.name,
        }))
    ).slice(0, 50);
  }
  const digits = clean.replace(/\D/g, "");
  const safeText = clean.replace(/[%,]/g, "");
  const filters = [`company_name.ilike.%${safeText}%`];
  if (digits) filters.push(`phone.ilike.%${digits}%`);
  const { data, error } = await supabase
    .from("customers")
    .select("id,list_id,company_name,phone,address,ap_name,status,last_called_at,reminder_at,lists(name)")
    .or(filters.join(","))
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
