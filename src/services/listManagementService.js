import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { sampleLists, customersByList } from "../data/sampleData";
import { fetchAllRows } from "../lib/fetchAllRows";

const demoState = {
  lists: sampleLists.map((list, index) => ({ ...list, updatedAt: new Date(Date.now() - index * 86400000).toISOString(), deletedAt: null })),
  trash: [],
};

function mapList(row) {
  const active = row.is_active !== false;
  const deletedAt = active ? null : (row.updated_at || row.created_at || null);
  return {
    id: row.id,
    name: row.name,
    count: Number(row.customer_count || 0),
    updatedAt: row.updated_at || row.created_at || null,
    deletedAt,
    expiresAt: deletedAt ? new Date(new Date(deletedAt).getTime() + 30 * 86400000).toISOString() : null,
    sortOrder: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0,
  };
}

export async function fetchManagedLists({ trash = false } = {}) {
  if (!isSupabaseConfigured) return (trash ? demoState.trash : demoState.lists).map((item) => ({ ...item }));
  const { data, error } = await supabase
    .from("lists")
    .select("id,name,customer_count,is_active,sort_order,created_at,updated_at")
    .eq("is_active", !trash)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapList);
}

export async function reorderLists(rows) {
  if (!rows.length) return;
  if (!isSupabaseConfigured) {
    const orderById = new Map(rows.map((row) => [row.listId, row.sortOrder]));
    demoState.lists.forEach((list) => {
      if (orderById.has(list.id)) list.sortOrder = orderById.get(list.id);
    });
    demoState.lists.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return;
  }
  const { error } = await supabase.rpc("reorder_dialix_lists", { order_rows: rows });
  if (error) throw error;
}

export async function renameList(listId, { name }) {
  if (!isSupabaseConfigured) {
    const list = [...demoState.lists, ...demoState.trash].find((item) => item.id === listId);
    if (list) Object.assign(list, { name, updatedAt: new Date().toISOString() });
    return;
  }
  const { error } = await supabase.from("lists").update({ name, updated_at: new Date().toISOString() }).eq("id", listId);
  if (error) throw error;
}

export async function duplicateList(listId, newName) {
  if (!isSupabaseConfigured) {
    const original = demoState.lists.find((item) => item.id === listId);
    if (!original) throw new Error("複製元のリストが見つかりません。");
    const id = `demo-copy-${Date.now()}`;
    const copied = (customersByList[listId] || []).map((customer, index) => ({ ...customer, id: `${id}-${index + 1}` }));
    customersByList[id] = copied;
    demoState.lists.push({ ...original, id, name: newName, count: copied.length, updatedAt: new Date().toISOString() });
    return;
  }
  const now = new Date().toISOString();
  const { data: newList, error: listError } = await supabase
    .from("lists")
    .insert({ name: newName, customer_count: 0, active_users: 0, is_active: true, created_at: now, updated_at: now })
    .select("id")
    .single();
  if (listError) throw listError;

  const sourceCustomers = await fetchAllRows(() => supabase
    .from("customers")
    .select("*")
    .eq("list_id", listId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true }));
  const copies = (sourceCustomers || []).map(({ id, created_at, updated_at, ...row }) => ({ ...row, list_id: newList.id, created_at: now, updated_at: now }));
  for (let i = 0; i < copies.length; i += 200) {
    const { error } = await supabase.from("customers").insert(copies.slice(i, i + 200));
    if (error) throw error;
  }
  const { error: countError } = await supabase.from("lists").update({ customer_count: copies.length, updated_at: now }).eq("id", newList.id);
  if (countError) throw countError;
  return newList.id;
}

export async function moveListToTrash(listId) {
  const deletedAt = new Date().toISOString();
  if (!isSupabaseConfigured) {
    const index = demoState.lists.findIndex((item) => item.id === listId);
    if (index >= 0) demoState.trash.unshift({ ...demoState.lists.splice(index, 1)[0], deletedAt, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
    return;
  }
  const { error } = await supabase.from("lists").update({ is_active: false, updated_at: deletedAt }).eq("id", listId);
  if (error) throw error;
}

export async function restoreList(listId) {
  if (!isSupabaseConfigured) {
    const index = demoState.trash.findIndex((item) => item.id === listId);
    if (index >= 0) demoState.lists.unshift({ ...demoState.trash.splice(index, 1)[0], deletedAt: null, expiresAt: null, updatedAt: new Date().toISOString() });
    return;
  }
  const { error } = await supabase.from("lists").update({ is_active: true, updated_at: new Date().toISOString() }).eq("id", listId);
  if (error) throw error;
}

export async function permanentlyDeleteList(listId) {
  if (!isSupabaseConfigured) {
    demoState.trash = demoState.trash.filter((item) => item.id !== listId);
    delete customersByList[listId];
    return;
  }
  const customers = await fetchAllRows(() => supabase
    .from("customers")
    .select("id")
    .eq("list_id", listId)
    .order("id", { ascending: true }));
  const ids = customers.map((row) => row.id);
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const { error: historyError } = await supabase.from("call_histories").delete().in("customer_id", chunk);
    if (historyError) throw historyError;
    const { error: customerError } = await supabase.from("customers").delete().in("id", chunk);
    if (customerError) throw customerError;
  }
  const { error } = await supabase.from("lists").delete().eq("id", listId);
  if (error) throw error;
}

export async function fetchListCustomers(listId) {
  if (!isSupabaseConfigured) return (customersByList[listId] || []).map((customer) => ({ id: customer.id, companyName: customer.companyName, phone: customer.phone, status: customer.status || "", reminderAt: customer.reminderAt || "" }));
  const data = await fetchAllRows(() => supabase
    .from("customers")
    .select("id,company_name,phone,status,reminder_at")
    .eq("list_id", listId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true }));
  return data.map((row) => ({ id: row.id, companyName: row.company_name, phone: row.phone, status: row.status || "", reminderAt: row.reminder_at || "" }));
}

export async function fetchListExportCustomers(listId) {
  if (!isSupabaseConfigured) {
    return (customersByList[listId] || []).map((customer) => ({
      id: customer.id,
      list_id: listId,
      company_name: customer.companyName || "",
      phone: customer.phone || "",
      phone_2: customer.phone2 || "",
      address: customer.address || "",
      industry: customer.industry || "",
      representative_name: customer.representativeName || "",
      business_subcategory: customer.businessSubcategory || "",
      pinned_memo: customer.pinnedMemo || "",
      ap_name: customer.ap || "",
      status: customer.status || "",
      last_called_at: customer.lastCallAt || "",
      reminder_at: customer.reminderAt || "",
      call_histories: customer.history || [],
    }));
  }

  const rows = await fetchAllRows(() => supabase
    .from("customers")
    .select("*")
    .eq("list_id", listId)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true }));

  const historiesByCustomer = new Map();
  const customerIds = rows.map((row) => row.id);
  for (let i = 0; i < customerIds.length; i += 500) {
    const ids = customerIds.slice(i, i + 500);
    const histories = await fetchAllRows(() => supabase
      .from("call_histories")
      .select("*")
      .in("customer_id", ids)
      .order("called_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false }));
    histories.forEach((history) => {
      const current = historiesByCustomer.get(history.customer_id) || [];
      current.push(history);
      historiesByCustomer.set(history.customer_id, current);
    });
  }

  return rows.map((row) => ({ ...row, call_histories: historiesByCustomer.get(row.id) || [] }));
}

export async function bulkUpdateCustomers({ customerIds, status, reminderAt, destinationListId }) {
  if (!customerIds.length || !isSupabaseConfigured) return;
  const changes = { updated_at: new Date().toISOString() };
  if (status !== undefined) changes.status = status;
  if (reminderAt !== undefined) changes.reminder_at = reminderAt || null;
  if (destinationListId) changes.list_id = destinationListId;
  const { error } = await supabase.from("customers").update(changes).in("id", customerIds);
  if (error) throw error;
}

export async function bulkDeleteCustomers(customerIds) {
  if (!customerIds.length || !isSupabaseConfigured) return;
  const { error: historyError } = await supabase.from("call_histories").delete().in("customer_id", customerIds);
  if (historyError) throw historyError;
  const { error } = await supabase.from("customers").delete().in("id", customerIds);
  if (error) throw error;
}

function csvCell(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function downloadCustomersCsv(listName, customers) {
  const lines = [["会社名", "電話番号", "ステータス", "次回架電日時"], ...customers.map((item) => [item.companyName, item.phone, item.status, item.reminderAt])];
  const blob = new Blob(["\uFEFF" + lines.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${listName || "DIALIXリスト"}.csv`; anchor.click(); URL.revokeObjectURL(url);
}

export function downloadListDataCsv(listName, customers) {
  const preferredColumns = ["id", "list_id", "company_name", "phone", "phone_2", "address", "industry", "representative_name", "business_subcategory", "pinned_memo", "ap_name", "status", "last_called_at", "reminder_at", "sort_order", "created_at", "updated_at", "call_histories"];
  const allColumns = [...new Set(customers.flatMap((item) => Object.keys(item)))];
  const columns = [...preferredColumns, ...allColumns.filter((column) => !preferredColumns.includes(column))];
  const headerLabels = {
    id: "顧客ID", list_id: "リストID", company_name: "顧客名", phone: "電話番号", phone_2: "電話番号2",
    address: "住所", industry: "業種", representative_name: "代表名", business_subcategory: "その他", pinned_memo: "備考", ap_name: "最終担当AP", status: "コールステータス",
    last_called_at: "最終架電日時", reminder_at: "次回架電日時", sort_order: "表示順", created_at: "顧客登録日時",
    updated_at: "顧客更新日時", call_histories: "架電履歴（全件）",
  };
  const valueForCsv = (value) => {
    if (value == null) return "";
    if (Array.isArray(value)) return value.map((item) => JSON.stringify(item)).join("\n");
    if (typeof value === "object") return JSON.stringify(value);
    return value;
  };
  const lines = [columns.map((column) => headerLabels[column] || column), ...customers.map((item) => columns.map((column) => valueForCsv(item[column])))];
  const blob = new Blob(["\uFEFF" + lines.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  const safeName = String(listName || "DIALIXリスト").replace(/[\\/:*?"<>|]/g, "_");
  anchor.download = `${safeName}_全データ_${new Date().toLocaleDateString("sv-SE")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}
