import { isSupabaseConfigured, supabase } from "../lib/supabase";

export async function fetchKpiResetState() {
  if (!isSupabaseConfigured) return { resetAt: null, canUndo: false };
  const { data, error } = await supabase.rpc("get_kpi_reset_state");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return { resetAt: row?.reset_at || null, canUndo: Boolean(row?.can_undo) };
}

export async function resetManagementKpi() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc("reset_management_kpi");
  if (error) throw error;
}

export async function undoManagementKpiReset() {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.rpc("undo_management_kpi_reset");
  if (error) throw error;
}
