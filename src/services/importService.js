import { isSupabaseConfigured, supabase } from "../lib/supabase";

const HEADER_ALIASES = {
  companyName: ["顧客名", "企業名", "会社名", "店舗名", "company", "company_name"],
  phone: ["電話番号", "電話", "tel", "phone"],
  address: ["住所", "所在地", "address"],
  businessSubcategory: ["詳細", "小項目", "小分類", "業種小分類", "サブカテゴリ", "business_subcategory", "事業内容"],
  status: ["ステータス", "架電結果", "コールステータス", "status"],
  memo: ["メモ", "備考", "架電メモ", "memo"],
  apName: ["最終担当AP", "担当AP", "ap", "AP", "アポインター", "担当者", "ap_name"],
  lastCalledAt: ["最終架電日時", "最終対応日時", "last_called_at"],
  reminderAt: ["次回架電日時", "リマインド", "reminder_at"],
};

export const IGNORE_STATUS_MAPPING = "__IGNORE_STATUS__";
export const IGNORE_AP_MAPPING = "__IGNORE_AP__";
export const DIALIX_STATUSES = ["", "留守", "NG", "非決裁NG", "決裁NG", "対象外", "現アナ", "再コール", "再コール留守", "見込み", "非決裁見込み", "決裁見込み", "見込み留守", "トスアップ", "前確依頼", "前確OK", "前確NG"];
const STATUS_ALIASES = {
  "留守電": "留守", "不在": "留守", "留守": "留守",
  "フロントNG": "非決裁NG", "担当NG": "非決裁NG", "非決裁NG": "非決裁NG",
  "決裁者NG": "決裁NG", "決裁NG": "決裁NG", "NG": "NG",
  "対象外": "対象外", "現アナ": "現アナ",
  "再架電": "再コール", "再コール": "再コール", "再コール留守": "再コール留守",
  "見込": "非決裁見込み", "見込み": "見込み", "非決裁見込み": "非決裁見込み",
  "決裁見込": "決裁見込み", "決裁見込み": "決裁見込み", "見込み留守": "見込み留守",
  "アポ": "トスアップ", "トスアップ": "トスアップ",
  "前確依頼": "前確依頼", "前確OK": "前確OK", "前確NG": "前確NG",
};

function normalizeHeader(value) { return String(value || "").replace(/^\uFEFF/, "").trim(); }
function toHalfWidth(value) { return String(value ?? "").replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)); }
export function normalizePhone(value) {
  let digits = toHalfWidth(value).replace(/[^0-9]/g, "");
  if (!digits) return "";
  if (!digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) digits = `0${digits}`;
  return digits;
}
function parseDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/年|\//g, "-").replace(/月/g, "-").replace(/日/g, " ");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function parseCsvLine(line) {
  const cells = []; let value = ""; let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') { if (quoted && line[i + 1] === '"') { value += '"'; i += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { cells.push(value); value = ""; } else value += char;
  }
  cells.push(value); return cells.map((cell) => cell.trim());
}
export function parseCsv(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((line) => line.trim() !== "");
  if (lines.length < 2) throw new Error("ヘッダー行とデータ行を含むCSVを選択してください。");
  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const rows = lines.slice(1).map((line, index) => {
    const cells = parseCsvLine(line);
    return { rowNumber: index + 2, raw: Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? ""])) };
  });
  return { headers, rows };
}
export function guessMapping(headers) {
  const mapping = {};
  Object.entries(HEADER_ALIASES).forEach(([field, aliases]) => { mapping[field] = headers.find((h) => aliases.some((a) => h.toLowerCase() === a.toLowerCase())) || ""; });
  return mapping;
}
export function guessStatusMappings(values) {
  return Object.fromEntries(values.map((value) => [value, value === "未架電" ? IGNORE_STATUS_MAPPING : (STATUS_ALIASES[value] ?? (DIALIX_STATUSES.includes(value) ? value : ""))]));
}
export function prepareRows(parsedRows, mapping, statusMappings = {}, apMappings = {}) {
  const seen = new Set();
  return parsedRows.map(({ rowNumber, raw }) => {
    const companyName = String(raw[mapping.companyName] || "").trim();
    const phone = normalizePhone(raw[mapping.phone]);
    const rawStatus = String(raw[mapping.status] || "").trim();
    const rawApName = String(raw[mapping.apName] || "").trim();
    const mappedStatus = rawStatus ? (statusMappings[rawStatus] || "") : "";
    const statusIgnored = mappedStatus === IGNORE_STATUS_MAPPING;
    const status = statusIgnored || !rawStatus ? "未架電" : mappedStatus;
    const apMapping = apMappings[rawApName];
    const apIgnored = apMapping === IGNORE_AP_MAPPING;
    const apMatch = apIgnored ? null : (apMapping || null);
    const errors = [];
    if (!companyName) errors.push("顧客名が空です");
    if (!phone) errors.push("電話番号が空です");
    if (phone && seen.has(phone)) errors.push("CSV内で電話番号が重複しています");
    if (rawStatus && !status && !statusIgnored) errors.push(`ステータス「${rawStatus}」が未設定です`);
    if (phone) seen.add(phone);
    return { rowNumber, companyName, phone, address: String(raw[mapping.address] || "").trim(), businessSubcategory: String(raw[mapping.businessSubcategory] || "").trim(), rawStatus, status, statusIgnored, memo: String(raw[mapping.memo] || "").trim(), rawApName: apIgnored ? "" : rawApName, apIgnored, apName: apIgnored ? "" : (apMatch?.displayName || rawApName), apUserId: apIgnored ? null : (apMatch?.id || null), lastCalledAt: parseDate(raw[mapping.lastCalledAt]), reminderAt: parseDate(raw[mapping.reminderAt]), errors };
  });
}
export async function fetchImportLists() {
  const { data, error } = await supabase.from("lists").select("id,name,customer_count").eq("is_active", true).order("created_at"); if (error) throw error; return data || [];
}
export async function fetchImportProfiles() {
  const { data, error } = await supabase.from("profiles").select("id,display_name,email,is_active").order("display_name"); if (error) throw error; return (data || []).map((p) => ({ id: p.id, displayName: p.display_name || p.email, email: p.email, isActive: p.is_active !== false }));
}
export async function fetchImportHistory() {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("import_batches").select("id,file_name,total_rows,inserted_rows,duplicate_rows,error_rows,created_at,lists(name)").order("created_at", { ascending: false }).limit(30); if (error) throw error; return data || [];
}
export async function importCustomers({ fileName, listMode, listId, newListName, rows, userId, userName }) {
  if (!isSupabaseConfigured) throw new Error("Supabase接続設定がありません。");
  let targetListId = listId;
  if (listMode === "new") { const cleanName = newListName.trim(); if (!cleanName) throw new Error("新しいリスト名を入力してください。"); const { data, error } = await supabase.from("lists").insert({ name: cleanName }).select("id").single(); if (error) throw error; targetListId = data.id; }
  if (!targetListId) throw new Error("取込先リストを選択してください。");
  const validRows = rows.filter((row) => row.errors.length === 0); const errorRows = rows.length - validRows.length;
  const phones = [...new Set(validRows.map((row) => row.phone))]; const existingPhones = new Set();
  const phoneChunks = [];
  for (let i = 0; i < phones.length; i += 500) phoneChunks.push(phones.slice(i, i + 500));
  const duplicateResults = await Promise.all(phoneChunks.map((chunk) => supabase.from("customers").select("phone").in("phone", chunk)));
  const duplicateError = duplicateResults.find((result) => result.error)?.error;
  if (duplicateError) throw duplicateError;
  duplicateResults.forEach((result) => (result.data || []).forEach((row) => existingPhones.add(row.phone)));
  const insertable = validRows.filter((row) => !existingPhones.has(row.phone)); const duplicateRows = validRows.length - insertable.length;
  let insertedRows = 0; let importedHistoryRows = 0;
  const postProcessWarnings = [];
  for (let i = 0; i < insertable.length; i += 200) {
    const chunk = insertable.slice(i, i + 200);
    const payload = chunk.map((row) => ({ list_id: targetListId, company_name: row.companyName, phone: row.phone, address: row.address, business_subcategory: row.businessSubcategory || null, ap_name: row.apName || "", status: row.status || "未架電", last_called_at: row.lastCalledAt, reminder_at: row.reminderAt }));
    const { data, error } = await supabase.from("customers").insert(payload).select("id,phone"); if (error) throw error;
    insertedRows += (data || []).length; const byPhone = new Map((data || []).map((r) => [r.phone, r.id]));
    const histories = chunk
      .filter((row) => row.status !== "未架電" || row.memo || row.rawApName || row.lastCalledAt || row.reminderAt)
      .map((row) => ({ customer_id: byPhone.get(row.phone), called_at: row.lastCalledAt || new Date().toISOString(), user_id: row.apUserId, operator_name: row.apName || row.rawApName || "", status: row.status || "未架電", memo: row.memo || "", reminder_at: row.reminderAt }));
    if (histories.length) {
      const { error: historyError } = await supabase.from("call_histories").insert(histories);
      if (historyError) postProcessWarnings.push(`架電履歴: ${historyError.message}`);
      else importedHistoryRows += histories.length;
    }
  }
  // 顧客本体の登録後に行う集計・履歴処理は、古いDB関数の権限判定で
  // owner が除外されている環境でもインポート全体を失敗扱いにしない。
  // まず既存RPCを試し、失敗時は直接件数を集計して更新する。
  const { error: refreshError } = await supabase.rpc("refresh_list_customer_count", { target_list_id: targetListId });
  if (refreshError) {
    const { count, error: countError } = await supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("list_id", targetListId);
    if (!countError) {
      const { error: updateCountError } = await supabase
        .from("lists")
        .update({ customer_count: count ?? insertedRows })
        .eq("id", targetListId);
      if (updateCountError) postProcessWarnings.push(`リスト件数更新: ${updateCountError.message}`);
    } else {
      postProcessWarnings.push(`リスト件数集計: ${countError.message}`);
    }
  }

  const { error: batchError } = await supabase.from("import_batches").insert({
    list_id: targetListId,
    file_name: fileName,
    total_rows: rows.length,
    inserted_rows: insertedRows,
    duplicate_rows: duplicateRows,
    error_rows: errorRows,
    imported_by: userId || null,
  });
  if (batchError) postProcessWarnings.push(`インポート履歴: ${batchError.message}`);

  return { targetListId, totalRows: rows.length, insertedRows, duplicateRows, errorRows, importedHistoryRows, postProcessWarnings };
}
