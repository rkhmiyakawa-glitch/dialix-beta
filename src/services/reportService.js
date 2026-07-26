import { isSupabaseConfigured, supabase } from "../lib/supabase";

const demoRows = [
  { periodDate: "2026-07-25", userId: "demo-admin", displayName: "宮川", role: "admin", callCount: 18, validCount: 12, decisionCount: 4, prospectCount: 3, tossupCount: 1, reCallCount: 4 },
  { periodDate: "2026-07-25", userId: "demo-op", displayName: "田中", role: "operator", callCount: 14, validCount: 9, decisionCount: 3, prospectCount: 2, tossupCount: 1, reCallCount: 3 },
];

export async function fetchOperatorReport({ startDate, endDate }) {
  if (!isSupabaseConfigured) return demoRows;
  const { data, error } = await supabase.rpc("get_operator_report", {
    start_date: startDate,
    end_date: endDate,
  });
  if (error) throw error;
  return (data || []).map((row) => ({
    periodDate: row.period_date,
    userId: row.user_id,
    displayName: row.display_name || "名称未設定",
    role: row.role || "operator",
    callCount: Number(row.call_count || 0),
    validCount: Number(row.valid_count || 0),
    decisionCount: Number(row.decision_count || 0),
    prospectCount: Number(row.prospect_count || 0),
    tossupCount: Number(row.tossup_count || 0),
    reCallCount: Number(row.re_call_count || 0),
  }));
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

export function downloadOperatorReportCsv(rows, fileName = "dialix_report.csv") {
  const header = ["日付", "担当者", "権限", "コール数", "有効数", "有効率", "決裁数", "決裁者率", "再コール", "見込み", "トスアップ"];
  const body = rows.map((row) => {
    const validRate = row.callCount ? `${Math.round((row.validCount / row.callCount) * 100)}%` : "0%";
    const decisionRate = row.validCount ? `${Math.round((row.decisionCount / row.validCount) * 100)}%` : "0%";
    return [row.periodDate, row.displayName, row.role, row.callCount, row.validCount, validRate, row.decisionCount, decisionRate, row.reCallCount, row.prospectCount, row.tossupCount];
  });
  const csv = `\ufeff${[header, ...body].map((line) => line.map(csvCell).join(",")).join("\r\n")}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
