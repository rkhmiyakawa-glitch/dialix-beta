import { useEffect, useMemo, useState } from "react";
import { fetchDashboardData, subscribeDashboardChanges } from "../services/dashboardService";

function MetricCard({ label, value, sub }) {
  return <article className="dashboard-card"><p>{label}</p><strong>{value}</strong><span>{sub}</span></article>;
}

function fmtDateTime(value) {
  return value ? new Date(value).toLocaleString("ja-JP") : "―";
}

export default function DashboardPanel() {
  const [period, setPeriod] = useState("today");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true); setError("");
    try { setData(await fetchDashboardData(period)); }
    catch (e) { setError(e.message || "ダッシュボードを取得できませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, [period]);
  useEffect(() => subscribeDashboardChanges(reload), [period]);

  const maxCalls = useMemo(() => Math.max(1, ...(data?.ranking || []).map((row) => row.callCount)), [data]);

  if (loading && !data) return <section className="admin-panel"><div className="empty-state">ダッシュボードを読み込み中...</div></section>;

  return <section className="admin-panel dashboard-panel">
    <div className="admin-panel-head">
      <div><h2>管理ダッシュボード</h2><p>架電実績・見込み・リマインド超過をリアルタイムで把握します。</p></div>
      <div className="dashboard-actions">
        <select value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="today">今日</option><option value="week">今週</option><option value="month">今月</option>
        </select>
        <button className="secondary-button" type="button" onClick={reload}>更新</button>
      </div>
    </div>
    {error && <div className="admin-error">{error}</div>}
    {data && <>
      <div className="dashboard-grid">
        <MetricCard label="コール数" value={data.metrics.callCount.toLocaleString()} sub={`${data.rangeLabel}の合計`} />
        <MetricCard label="有効数" value={data.metrics.validCount.toLocaleString()} sub={`有効率 ${data.metrics.validRate}%`} />
        <MetricCard label="決裁数" value={data.metrics.decisionCount.toLocaleString()} sub={`決裁者率 ${data.metrics.decisionRate}%`} />
        <MetricCard label="見込み" value={data.metrics.prospectCount.toLocaleString()} sub="フォロー対象" />
        <MetricCard label="トスアップ" value={data.metrics.tossupCount.toLocaleString()} sub="商談連携対象" />
        <MetricCard label="稼働実績者" value={`${data.metrics.activeOperatorCount}人`} sub={`登録 ${data.metrics.totalOperatorCount}人`} />
        <MetricCard label="期限超過" value={`${data.metrics.overdueCount}件`} sub="要対応リマインド" />
      </div>

      <div className="dashboard-two-column">
        <section className="dashboard-box">
          <div className="dashboard-box-head"><h3>KPIランキング</h3><span>コール数順</span></div>
          {!data.ranking.length ? <div className="empty-state">対象期間の架電実績はありません。</div> :
            <div className="ranking-list">{data.ranking.map((row, index) => <div className="ranking-row" key={row.userId || row.displayName}>
              <span className="ranking-rank">{index + 1}</span>
              <div className="ranking-main"><div><strong>{row.displayName}</strong><span>{row.callCount}件 / 見込み{row.prospectCount} / トス{row.tossupCount}</span></div>
              <div className="ranking-bar"><i style={{ width: `${Math.max(4, row.callCount / maxCalls * 100)}%` }} /></div></div>
            </div>)}</div>}
        </section>

        <section className="dashboard-box">
          <div className="dashboard-box-head"><h3>期限超過一覧</h3><span>{data.overdue.length}件表示</span></div>
          {!data.overdue.length ? <div className="empty-state">期限超過はありません。</div> :
            <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>顧客名</th><th>担当AP</th><th>期限</th><th>状態</th></tr></thead><tbody>
              {data.overdue.map((item) => <tr key={item.id}><td><strong>{item.companyName}</strong><small>{item.listName}</small></td><td>{item.apName}</td><td>{fmtDateTime(item.reminderAt)}</td><td>{item.status || "未設定"}</td></tr>)}
            </tbody></table></div>}
        </section>
      </div>


      <section className="dashboard-box">
        <div className="dashboard-box-head"><h3>全体リマインド一覧</h3><span>{data.allReminders.length}件表示</span></div>
        {!data.allReminders.length ? <div className="empty-state">設定中のリマインドはありません。</div> :
          <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>顧客名</th><th>担当AP</th><th>予定日時</th><th>状態</th></tr></thead><tbody>
            {data.allReminders.map((item) => <tr key={item.id}><td><strong>{item.companyName}</strong><small>{item.listName}</small></td><td>{item.apName}</td><td>{fmtDateTime(item.reminderAt)}</td><td>{item.status || "未設定"}</td></tr>)}
          </tbody></table></div>}
      </section>

      <section className="dashboard-box">
        <div className="dashboard-box-head"><h3>直近の架電</h3><span>最新10件</span></div>
        {!data.recentCalls.length ? <div className="empty-state">架電履歴はありません。</div> :
          <div className="dashboard-table-wrap"><table className="dashboard-table"><thead><tr><th>日時</th><th>担当</th><th>顧客</th><th>結果</th><th>メモ</th></tr></thead><tbody>
            {data.recentCalls.map((item) => <tr key={item.id}><td>{fmtDateTime(item.calledAt)}</td><td>{item.operatorName || "―"}</td><td>{item.companyName || "―"}</td><td><span className="state-badge active">{item.status}</span></td><td className="memo-cell">{item.memo || "―"}</td></tr>)}
          </tbody></table></div>}
      </section>
    </>}
  </section>;
}
