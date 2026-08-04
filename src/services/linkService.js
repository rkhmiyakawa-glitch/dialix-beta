import { supabase } from "../lib/supabase";

function ensureClient() {
  if (!supabase) throw new Error("Supabaseが設定されていません。");
}

export async function fetchSharedLinks() {
  ensureClient();
  const { data, error } = await supabase
    .from("shared_links")
    .select("id,name,url,sort_order,created_at,updated_at")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createSharedLink({ name, url, sortOrder }) {
  ensureClient();
  const { data, error } = await supabase
    .from("shared_links")
    .insert({ name, url, sort_order: sortOrder })
    .select("id,name,url,sort_order,created_at,updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteSharedLink(id) {
  ensureClient();
  const { error } = await supabase.from("shared_links").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderSharedLinks(links) {
  ensureClient();
  const results = await Promise.all(
    links.map((link, index) =>
      supabase
        .from("shared_links")
        .update({ sort_order: index + 1 })
        .eq("id", link.id)
    )
  );
  const failed = results.find(({ error }) => error);
  if (failed?.error) throw failed.error;
}
