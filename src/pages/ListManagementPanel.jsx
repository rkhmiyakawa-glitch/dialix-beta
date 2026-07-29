import { useEffect, useMemo, useState } from "react";
import { duplicateList, fetchManagedLists, moveListToTrash, permanentlyDeleteList, renameList, restoreList } from "../services/listManagementService";

const dateText = (value) => value ? new Date(value).toLocaleString("ja-JP") : "―";
const daysLeft = (value) => Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));

export default function ListManagementPanel() {
  const [lists, setLists] = useState([]);
  const [trash, setTrash] = useState([]);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const [active, deleted] = await Promise.all([fetchManagedLists(), fetchManagedLists({ trash: true })]);
    setLists(active);
    setTrash(deleted);
  }

  useEffect(() => { reload().catch((e) => setError(e.message)); }, []);

  const visibleLists = useMemo(
    () => lists.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())),
    [lists, query],
  );

  async function run(action, success) {
    setBusy(true); setError(""); setMessage("");
    try { await action(); setMessage(success); await reload(); }
    catch (e) { setError(e.message || "処理に失敗しました。"); }
    finally { setBusy(false); }
  }

  function startDuplicate(list) {
    const name = window.prompt("複製後のリスト名", `${list.name}（コピー）`);
    if (!name?.trim()) return;
    run(() => duplicateList(list.id, name.trim()), "リストを複製しました。");
  }

  function trashList(list) {
    if (!window.confirm(`「${list.name}」をゴミ箱へ移動しますか？\n顧客・履歴・メモ・リマインドは30日間保持されます。`)) return;
    run(() => moveListToTrash(list.id), "リストをゴミ箱へ移動しました。");
  }

  function deleteForever(list) {
    const text = window.prompt(`「${list.name}」と顧客${list.count}件を完全削除します。\n実行するには「完全削除」と入力してください。`);
    if (text !== "完全削除") return;
    run(() => permanentlyDeleteList(list.id), "完全削除しました。");
  }

  return <div className="list-management-stack">
    {error && <div className="admin-error">{error}</div>}
    {message && <div className="admin-success">{message}</div>}

    <section className="admin-panel">
      <div className="admin-panel-head">
        <div><h2>リスト管理</h2><p>名称変更・複製・削除を管理します。</p></div>
        <input className="list-manager-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="リスト名で検索" />
      </div>
      <div className="table-scroll"><table className="admin-table"><thead><tr><th>リスト名</th><th>件数</th><th>更新日時</th><th>操作</th></tr></thead><tbody>
        {visibleLists.map((list) => <tr key={list.id}>
          <td><strong>{list.name}</strong></td><td>{list.count.toLocaleString()}件</td><td>{dateText(list.updatedAt)}</td>
          <td><div className="user-action-group"><button className="table-action" onClick={() => setEditing({ ...list })}>編集</button><button className="table-action" onClick={() => startDuplicate(list)} disabled={busy}>複製</button><button className="table-action danger" onClick={() => trashList(list)} disabled={busy}>削除</button></div></td>
        </tr>)}
      </tbody></table></div>
    </section>

    <section className="admin-panel">
      <div className="admin-panel-head"><div><h2>ゴミ箱</h2><p>削除したリストは30日以内なら復元できます。</p></div></div>
      {trash.length === 0 ? <div className="empty-state">ゴミ箱は空です。</div> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>リスト名</th><th>件数</th><th>削除日時</th><th>残り</th><th>操作</th></tr></thead><tbody>
        {trash.map((list) => <tr key={list.id}><td>{list.name}</td><td>{list.count}件</td><td>{dateText(list.deletedAt)}</td><td>{daysLeft(list.expiresAt)}日</td><td><div className="user-action-group"><button className="table-action" onClick={() => run(() => restoreList(list.id), "リストを復元しました。")} disabled={busy}>復元</button><button className="table-action danger" onClick={() => deleteForever(list)} disabled={busy}>完全削除</button></div></td></tr>)}
      </tbody></table></div>}
    </section>

    {editing && <div className="lock-overlay"><section className="edit-modal"><h2>リスト編集</h2><label>リスト名<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(null)}>キャンセル</button><button className="primary-button" onClick={() => { if (!editing.name.trim()) return; run(() => renameList(editing.id, editing), "リスト情報を更新しました。"); setEditing(null); }}>保存</button></div></section></div>}
  </div>;
}
