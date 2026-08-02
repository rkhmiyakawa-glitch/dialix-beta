import { useEffect, useMemo, useState } from "react";
import { downloadOperatorReportCsv, fetchOperatorReport } from "../services/reportService";

const today = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date());
const firstOfMonth = () => `${today().slice(0, 7)}-01`;
const roleLabel = { owner: "オーナー", admin: "管理者S", admin_a: "管理者A", sv: "SV", operator: "オペレーター" };

export default function ReportsPanel() {
  const [startDate, setStartDate] = useState(firstOfMonth());
  const [endDate, setEndDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    if (!startDate || !endDate || startDate > endDate) {
      setError("開始日と終了日を正しく指定してください。");
      return;
    }
    setLoading(true); setError("");
    try { setRows(await fetchOperatorReport({ startDate, endDate })); }
    catch (e) { setError(e.message || "レポートを取得できませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);

  const totals = useMemo(() => rows.reduce((acc, row) => ({
    callCount: acc.callCount + row.callCount,
    validCount: acc.validCount + row.validCount,
    decisionCount: acc.decisionCount + row.decisionCount,
    prospectCount: acc.prospectCount + row.prospectCount,
    tossupCount: acc.tossupCount + row.tossupCount,
    reCallCount: acc.reCallCount + row.reCallCount,
  }), { callCount: 0, validCount: 0, decisionCount: 0, prospectCount: 0, tossupCount: 0, reCallCount: 0 }), [rows]);

  return <section className="admin-panel">
    <div className="admin-panel-head">
      <div><h2>業務レポート</h2><p>期間・日別・オペレーター別のKPIを確認し、CSVで出力できます。</p></div>
      <div className="report-actions">
        <label>開始日<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label>終了日<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        <button className="secondary-button" type="button" onClick={reload} disabled={loading}>集計</button>
        <button className="primary-button" type="button" disabled={!rows.length || loading} onClick={() => downloadOperatorReportCsv(rows, `DIALIX_KPI_${startDate}_${endDate}.csv`)}>CSV出力</button>
      </div>
    </div>
    {error && <div className="admin-error">{error}</div>}
    <div className="management-kpi-cards">
      <article><span>コール</span><strong>{totals.callCount}</strong><small>件</small></article>
      <article><span>有効</span><strong>{totals.validCount}</strong><small>件</small></article>
      <article><span>決裁</span><strong>{totals.decisionCount}</strong><small>件 / {totals.validCount ? Math.round(totals.decisionCount / totals.validCount * 100) : 0}%</small></article>
      <article><span>見込み</span><strong>{totals.prospectCount}</strong><small>件</small></article>
      <article><span>トスアップ</span><strong>{totals.tossupCount}</strong><small>件</small></article>
    </div>
    {loading ? <div className="empty-state">集計中...</div> : !rows.length ? <div className="empty-state">対象期間のデータはありません。</div> :
      <div className="table-scroll"><table className="admin-table report-table"><thead><tr><th>日付</th><th>担当者</th><th>権限</th><th>コール</th><th>有効</th><th>有効率</th><th>決裁</th><th>決裁者率</th><th>再コール</th><th>見込み</th><th>トスアップ</th></tr></thead><tbody>
        {rows.map((row) => <tr key={`${row.periodDate}-${row.userId}`}><td>{row.periodDate}</td><td><strong>{row.displayName}</strong></td><td>{roleLabel[row.role]}</td><td>{row.callCount}</td><td>{row.validCount}</td><td>{row.callCount ? `${Math.round(row.validCount / row.callCount * 100)}%` : "0%"}</td><td>{row.decisionCount}</td><td>{row.validCount ? `${Math.round(row.decisionCount / row.validCount * 100)}%` : "0%"}</td><td>{row.reCallCount}</td><td>{row.prospectCount}</td><td>{row.tossupCount}</td></tr>)}
      </tbody></table></div>}
  </section>;
}
