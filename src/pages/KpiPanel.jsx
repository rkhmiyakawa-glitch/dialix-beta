import { useEffect, useMemo, useState } from "react";
import { fetchOperatorKpi, subscribeManagementChanges } from "../services/managementService";

const todayJa = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const roleLabel = { owner: "オーナー", admin: "管理者S", admin_a: "管理者A", sv: "SV", operator: "オペレーター" };

export default function KpiPanel() {
  const [date, setDate] = useState(todayJa());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true); setError("");
    try { setRows(await fetchOperatorKpi(date)); }
    catch (e) { setError(e.message || "KPIを取得できませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, [date]);
  useEffect(() => subscribeManagementChanges({ onKpiChange: reload }), [date]);

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    callCount: acc.callCount + row.callCount,
    validCount: acc.validCount + row.validCount,
    prospectCount: acc.prospectCount + row.prospectCount,
    tossupCount: acc.tossupCount + row.tossupCount,
    reCallCount: acc.reCallCount + row.reCallCount,
  }), { callCount: 0, validCount: 0, prospectCount: 0, tossupCount: 0, reCallCount: 0 }), [rows]);

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h2>リアルタイムKPI</h2><p>架電結果の保存後、自動で更新されます。</p></div>
      <label className="kpi-date">対象日<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
    </div>
    {error && <div className="admin-error">{error}</div>}
    <div className="management-kpi-cards">
      <article><span>コール</span><strong>{totals.callCount}</strong><small>件</small></article>
      <article><span>有効</span><strong>{totals.validCount}</strong><small>件</small></article>
      <article><span>見込み</span><strong>{totals.prospectCount}</strong><small>件</small></article>
      <article><span>トスアップ</span><strong>{totals.tossupCount}</strong><small>件</small></article>
    </div>
    {loading ? <div className="empty-state">読み込み中...</div> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>順位</th><th>担当者</th><th>権限</th><th>コール</th><th>有効</th><th>有効率</th><th>再コール</th><th>見込み</th><th>トスアップ</th></tr></thead><tbody>
      {rows.map((row, index) => <tr key={row.userId}><td>{index + 1}</td><td><strong>{row.displayName}</strong></td><td>{roleLabel[row.role]}</td><td>{row.callCount}</td><td>{row.validCount}</td><td>{row.callCount ? `${Math.round(row.validCount / row.callCount * 100)}%` : "―"}</td><td>{row.reCallCount}</td><td>{row.prospectCount}</td><td>{row.tossupCount}</td></tr>)}
    </tbody></table></div>}
  </section>;
}
