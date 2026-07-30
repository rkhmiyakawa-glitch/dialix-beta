const DEFAULT_PAGE_SIZE = 500;

// Supabase/PostgREST has a server-side maximum row count per response.
// Always page explicitly so lists larger than that limit are never truncated.
export async function fetchAllRows(createQuery, pageSize = DEFAULT_PAGE_SIZE) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await createQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
