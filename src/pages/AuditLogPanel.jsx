import { useEffect, useMemo, useState } from "react";
import { fetchAuditLogs, subscribeManagementChanges } from "../services/managementService";

const actionLabel = { insert: "追加", update: "更新", delete: "削除" };
const tableLabel = { customers: "顧客", profiles: "ユーザー", lists: "リスト", call_histories: "架電履歴", import_batches: "CSV取込" };

export default function AuditLogPanel() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function reload() {
    setLoading(true); setError("");
    try { setLogs(await fetchAuditLogs()); }
    catch (e) { setError(e.message || "監査ログを取得できませんでした。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, []);
  useEffect(() => subscribeManagementChanges({ onAuditChange: reload }), []);
  const visible = useMemo(() => filter === "all" ? logs : logs.filter((log) => log.table_name === filter), [logs, filter]);

  return <section className="admin-panel">
    <div className="admin-panel-head"><div><h2>監査ログ</h2><p>誰が・いつ・何を変更したかを確認できます。</p></div><select className="audit-filter" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="all">すべて</option>{Object.entries(tableLabel).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div>
    {error && <div className="admin-error">{error}</div>}
    {loading ? <div className="empty-state">読み込み中...</div> : visible.length === 0 ? <div className="empty-state">監査ログはありません。</div> : <div className="table-scroll"><table className="admin-table audit-table"><thead><tr><th>日時</th><th>実行者</th><th>対象</th><th>操作</th><th>内容</th></tr></thead><tbody>{visible.map((log) => <tr key={log.id}><td>{new Date(log.created_at).toLocaleString("ja-JP")}</td><td>{log.actor_name || "システム"}</td><td>{tableLabel[log.table_name] || log.table_name}</td><td><span className={`audit-action ${log.action}`}>{actionLabel[log.action] || log.action}</span></td><td>{log.summary || log.record_id || "―"}</td></tr>)}</tbody></table></div>}
  </section>;
}
