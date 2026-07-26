import { isSupabaseConfigured, supabase } from "../lib/supabase";

const HEADER_ALIASES = {
  companyName: ["顧客名", "企業名", "店舗名", "company", "company_name"],
  phone: ["電話番号", "電話", "tel", "phone"],
  address: ["住所", "所在地", "address"],
  businessSubcategory: ["詳細", "小項目", "小分類", "業種小分類", "サブカテゴリ", "business_subcategory"],
  customerCode: ["顧客id", "顧客ID", "顧客コード", "customer_code", "id"],
  apName: ["ap", "AP", "アポインター", "担当者", "ap_name"],
};

function normalizeHeader(value) {
  return String(value || "").replace(/^\uFEFF/, "").trim();
}

export function normalizePhone(value) {
  let digits = String(value ?? "").replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (!digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) digits = `0${digits}`;
  return digits;
}

function parseCsvLine(line) {
  const cells = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(value); value = "";
    } else value += char;
  }
  cells.push(value);
  return cells.map((cell) => cell.trim());
}

export function parseCsv(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new Error("ヘッダー行とデータ行を含むCSVを選択してください。");
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    const raw = Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""]));
    return { rowNumber: index + 2, raw };
  });
  return { headers, rows };
}

export function guessMapping(headers) {
  const mapping = {};
  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => {
    const found = headers.find((header) => aliases.some((alias) => header.toLowerCase() === alias.toLowerCase()));
    mapping[field] = found || "";
  });
  return mapping;
}

export function prepareRows(parsedRows, mapping) {
  const seen = new Set();
  return parsedRows.map(({ rowNumber, raw }) => {
    const companyName = String(raw[mapping.companyName] || "").trim();
    const phone = normalizePhone(raw[mapping.phone]);
    const errors = [];
    if (!companyName) errors.push("顧客名が空です");
    if (!phone) errors.push("電話番号が空です");
    if (phone && seen.has(phone)) errors.push("CSV内で電話番号が重複しています");
    if (phone) seen.add(phone);
    return {
      rowNumber,
      companyName,
      phone,
      address: String(raw[mapping.address] || "").trim(),
      businessSubcategory: String(raw[mapping.businessSubcategory] || "").trim(),
      customerCode: String(raw[mapping.customerCode] || "").trim(),
      apName: String(raw[mapping.apName] || "").trim(),
      errors,
    };
  });
}

export async function fetchImportLists() {
  const { data, error } = await supabase.from("lists").select("id,name,customer_count").eq("is_active", true).order("created_at");
  if (error) throw error;
  return data || [];
}

export async function fetchImportHistory() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("import_batches").select("id,file_name,total_rows,inserted_rows,duplicate_rows,error_rows,imported_by_name,created_at,lists(name)").order("created_at", { ascending: false }).limit(30);
  if (error) throw error;
  return data || [];
}

export async function importCustomers({ fileName, listMode, listId, newListName, rows, userId, userName }) {
  if (!isSupabaseConfigured) throw new Error("Supabase接続設定がありません。");
  let targetListId = listId;
  if (listMode === "new") {
    const cleanName = newListName.trim();
    if (!cleanName) throw new Error("新しいリスト名を入力してください。");
    const { data, error } = await supabase.from("lists").insert({ name: cleanName }).select("id").single();
    if (error) throw error;
    targetListId = data.id;
  }
  if (!targetListId) throw new Error("取込先リストを選択してください。");

  const validRows = rows.filter((row) => row.errors.length === 0);
  const errorRows = rows.length - validRows.length;
  const phones = [...new Set(validRows.map((row) => row.phone))];
  let existingPhones = new Set();
  for (let i = 0; i < phones.length; i += 500) {
    const { data, error } = await supabase.from("customers").select("phone").in("phone", phones.slice(i, i + 500));
    if (error) throw error;
    (data || []).forEach((row) => existingPhones.add(row.phone));
  }

  const insertable = validRows.filter((row) => !existingPhones.has(row.phone));
  const duplicateRows = validRows.length - insertable.length;
  let insertedRows = 0;
  for (let i = 0; i < insertable.length; i += 250) {
    const payload = insertable.slice(i, i + 250).map((row) => ({
      list_id: targetListId,
      customer_code: row.customerCode || null,
      company_name: row.companyName,
      phone: row.phone,
      address: row.address,
      business_subcategory: row.businessSubcategory || null,
      ap_name: row.apName,
    }));
    const { error } = await supabase.from("customers").insert(payload);
    if (error) throw error;
    insertedRows += payload.length;
  }

  const { error: refreshError } = await supabase.rpc("refresh_list_customer_count", { target_list_id: targetListId });
  if (refreshError) throw refreshError;

  const { error: historyError } = await supabase.from("import_batches").insert({
    list_id: targetListId,
    file_name: fileName,
    total_rows: rows.length,
    inserted_rows: insertedRows,
    duplicate_rows: duplicateRows,
    error_rows: errorRows,
    imported_by: userId || null,
    imported_by_name: userName || "",
  });
  if (historyError) throw historyError;

  return { targetListId, totalRows: rows.length, insertedRows, duplicateRows, errorRows };
}
