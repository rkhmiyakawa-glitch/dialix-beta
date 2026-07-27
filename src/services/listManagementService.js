import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { sampleLists, customersByList } from "../data/sampleData";

const demoState = {
  lists: sampleLists.map((list, index) => ({ ...list, description: "", updatedAt: new Date(Date.now() - index * 86400000).toISOString(), deletedAt: null })),
  trash: [],
};

function mapList(row) {
  const deletedAt = row.deleted_at || null;
  return {
    id: row.id,
    name: row.name,
    description: row.description || "",
    count: Number(row.customer_count || 0),
    updatedAt: row.updated_at || row.created_at || null,
    deletedAt,
    expiresAt: deletedAt ? new Date(new Date(deletedAt).getTime() + 30 * 86400000).toISOString() : null,
  };
}

export async function fetchManagedLists({ trash = false } = {}) {
  if (!isSupabaseConfigured) return (trash ? demoState.trash : demoState.lists).map((item) => ({ ...item }));
  let query = supabase.from("lists").select("id,name,description,customer_count,created_at,updated_at,deleted_at").order(trash ? "deleted_at" : "updated_at", { ascending: false });
  query = trash ? query.not("deleted_at", "is", null) : query.is("deleted_at", null);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapList);
}

export async function renameList(listId, { name, description }) {
  if (!isSupabaseConfigured) {
    const list = demoState.lists.find((item) => item.id === listId);
    if (list) Object.assign(list, { name, description, updatedAt: new Date().toISOString() });
    return;
  }
  const { error } = await supabase.from("lists").update({ name, description: description || "", updated_at: new Date().toISOString() }).eq("id", listId);
  if (error) throw error;
}

export async function duplicateList(listId, newName) {
  if (!isSupabaseConfigured) {
    const original = demoState.lists.find((item) => item.id === listId);
    if (!original) throw new Error("複製元のリストが見つかりません。");
    const id = `demo-copy-${Date.now()}`;
    demoState.lists.push({ ...original, id, name: newName, updatedAt: new Date().toISOString(), count: original.count });
    customersByList[id] = (customersByList[listId] || []).map((customer, index) => ({ ...customer, id: `${id}-${index + 1}` }));
    return;
  }
  const { data, error } = await supabase.rpc("duplicate_dialix_list", { source_list_id: listId, new_list_name: newName });
  if (error) throw error;
  return data;
}

export async function moveListToTrash(listId) {
  const deletedAt = new Date().toISOString();
  if (!isSupabaseConfigured) {
    const index = demoState.lists.findIndex((item) => item.id === listId);
    if (index >= 0) demoState.trash.unshift({ ...demoState.lists.splice(index, 1)[0], deletedAt, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
    return;
  }
  const { error } = await supabase.from("lists").update({ deleted_at: deletedAt, is_active: false, updated_at: deletedAt }).eq("id", listId);
  if (error) throw error;
}

export async function restoreList(listId) {
  if (!isSupabaseConfigured) {
    const index = demoState.trash.findIndex((item) => item.id === listId);
    if (index >= 0) demoState.lists.unshift({ ...demoState.trash.splice(index, 1)[0], deletedAt: null, expiresAt: null, updatedAt: new Date().toISOString() });
    return;
  }
  const now = new Date().toISOString();
  const { error } = await supabase.from("lists").update({ deleted_at: null, is_active: true, updated_at: now }).eq("id", listId);
  if (error) throw error;
}

export async function permanentlyDeleteList(listId) {
  if (!isSupabaseConfigured) {
    demoState.trash = demoState.trash.filter((item) => item.id !== listId);
    delete customersByList[listId];
    return;
  }
  const { error } = await supabase.rpc("permanently_delete_dialix_list", { target_list_id: listId });
  if (error) throw error;
}

export async function fetchListCustomers(listId) {
  if (!isSupabaseConfigured) return (customersByList[listId] || []).map((customer) => ({ id: customer.id, companyName: customer.companyName, phone: customer.phone, status: customer.status || "", reminderAt: customer.reminderAt || "" }));
  const { data, error } = await supabase.from("customers").select("id,company_name,phone,status,reminder_at").eq("list_id", listId).order("sort_order", { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, companyName: row.company_name, phone: row.phone, status: row.status || "", reminderAt: row.reminder_at || "" }));
}

export async function bulkUpdateCustomers({ customerIds, status, reminderAt, destinationListId }) {
  if (!customerIds.length) return;
  if (!isSupabaseConfigured) return;
  const changes = { updated_at: new Date().toISOString() };
  if (status !== undefined) changes.status = status;
  if (reminderAt !== undefined) changes.reminder_at = reminderAt || null;
  if (destinationListId) changes.list_id = destinationListId;
  const { error } = await supabase.from("customers").update(changes).in("id", customerIds);
  if (error) throw error;
}

export async function bulkDeleteCustomers(customerIds) {
  if (!customerIds.length || !isSupabaseConfigured) return;
  const { error } = await supabase.from("customers").delete().in("id", customerIds);
  if (error) throw error;
}

function csvCell(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
export function downloadCustomersCsv(listName, customers) {
  const lines = [["会社名", "電話番号", "ステータス", "次回架電日時"], ...customers.map((item) => [item.companyName, item.phone, item.status, item.reminderAt])];
  const blob = new Blob(["\uFEFF" + lines.map((row) => row.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${listName || "DIALIXリスト"}.csv`; anchor.click(); URL.revokeObjectURL(url);
}
