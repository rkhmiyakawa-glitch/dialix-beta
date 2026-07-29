import { useEffect, useMemo, useState } from "react";
import { fetchDashboardData, subscribeDashboardChanges } from "../services/dashboardService";

function MetricCard({ label, value, sub }) {
  return <article className="dashboard-card"><p>{label}</p><strong>{value}</strong><span>{sub}</span></article>;
}

function fmtDateTime(value) {
  return value ? new Date(value).toLocaleString("ja-JP") : "―";
}

function RankingBox({ title, rows, metricKey, emptyText }) {
  const maxValue = useMemo(() => Math.max(1, ...rows.map((row) => row[metricKey] || 0)), [rows, metricKey]);
  return <section className="dashboard-box ranking-box">
    <div className="dashboard-box-head"><h3>{title}</h3><span>上位順</span></div>
    {!rows.length ? <div className="empty-state">{emptyText}</div> :
      <div className="ranking-list">{rows.map((row, index) => <div className="ranking-row" key={row.userId || row.displayName}>
        <span className="ranking-rank">{index + 1}</span>
        <div className="ranking-main"><div><strong>{row.displayName}</strong><span>{row[metricKey]}件</span></div>
          <div className="ranking-bar"><i style={{ width: `${Math.max(4, row[metricKey] / maxValue * 100)}%` }} /></div>
        </div>
      </div>)}</div>}
  </section>;
}

export default function DashboardPanel({ onOpenOverdueCustomer }) {
  const [period, setPeriod] = useState("today");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedAp, setSelectedAp] = useState("all");

  async function reload() {
    setLoading(true); setError("");
    try { setData(await fetchDashboardData(period)); }
    catch (e) { setError(e.message || "ダッシュボードを取得できませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, [period]);
  useEffect(() => subscribeDashboardChanges(reload), [period]);

  const apOptions = useMemo(() => {
    if (!data) return [];
    const names = data.activeApNames?.length
      ? data.activeApNames
      : data.overdue.map((item) => item.apName).filter((name) => name && name !== "未設定");
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "ja"));
  }, [data]);

  const filteredOverdue = useMemo(() => {
    if (!data) return [];
    return selectedAp === "all"
      ? data.overdue
      : data.overdue.filter((item) => item.apName === selectedAp);
  }, [data, selectedAp]);

  useEffect(() => {
    if (selectedAp !== "all" && !apOptions.includes(selectedAp)) setSelectedAp("all");
  }, [apOptions, selectedAp]);

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
        <MetricCard label="コール" value={data.metrics.callCount.toLocaleString()} sub={`${data.rangeLabel}の合計`} />
        <MetricCard label="有効" value={data.metrics.validCount.toLocaleString()} sub={`有効率 ${data.metrics.validRate}%`} />
        <MetricCard label="決裁" value={data.metrics.decisionCount.toLocaleString()} sub={`決裁者率 ${data.metrics.decisionRate}%`} />
        <MetricCard label="見込み" value={data.metrics.prospectCount.toLocaleString()} sub="決裁・非決裁の合計" />
        <MetricCard label="トスアップ" value={data.metrics.tossupCount.toLocaleString()} sub="商談連携対象" />
        <MetricCard label="稼働実績者" value={`${data.metrics.activeOperatorCount}人`} sub={`登録 ${data.metrics.totalOperatorCount}人`} />
        <MetricCard label="期限超過" value={`${data.metrics.overdueCount}件`} sub="要対応リマインド" />
      </div>

      <section className="dashboard-box dashboard-full-width dashboard-overdue-panel">
        <div className="dashboard-box-head dashboard-overdue-head">
          <h3>期限超過リマインド</h3>
          <div className="dashboard-overdue-filter">
            <label htmlFor="overdue-ap-filter">担当AP</label>
            <select id="overdue-ap-filter" value={selectedAp} onChange={(e) => setSelectedAp(e.target.value)}>
              <option value="all">全AP</option>
              {apOptions.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <span>{filteredOverdue.length}件表示</span>
          </div>
        </div>
        {!filteredOverdue.length ? <div className="empty-state">{selectedAp === "all" ? "期限超過はありません。" : `${selectedAp}さんの期限超過はありません。`}</div> :
          <div className="task-list dashboard-overdue-list">
            {filteredOverdue.map((item) => (
              <button
                key={item.id}
                className="task-row dashboard-overdue-row"
                type="button"
                onClick={() => onOpenOverdueCustomer?.(item, filteredOverdue)}
              >
                <div className="dashboard-overdue-customer">
                  <strong>{item.companyName}</strong>
                  <small>{item.listName}</small>
                </div>
                <div className="dashboard-overdue-details">
                  <span><small>担当AP</small><b>{item.apName}</b></span>
                  <span><small>期限</small><b>{fmtDateTime(item.reminderAt)}</b></span>
                  <span><small>状態</small><b>{item.status || "未設定"}</b></span>
                  <em>開く ›</em>
                </div>
              </button>
            ))}
          </div>}
      </section>

      <div className="dashboard-section-title"><h3>ランキング</h3><span>{data.rangeLabel}の実績</span></div>
      <div className="dashboard-ranking-grid">
        <RankingBox title="コールランキング" rows={data.callRanking} metricKey="callCount" emptyText="対象期間のコール実績はありません。" />
        <RankingBox title="見込みランキング" rows={data.prospectRanking} metricKey="prospectCount" emptyText="対象期間の見込み実績はありません。" />
        <RankingBox title="トスアップランキング" rows={data.tossupRanking} metricKey="tossupCount" emptyText="対象期間のトスアップ実績はありません。" />
      </div>
    </>}
  </section>;
}
