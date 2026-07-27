import { useEffect, useMemo, useState } from "react";
import { bulkDeleteCustomers, bulkUpdateCustomers, downloadCustomersCsv, duplicateList, fetchListCustomers, fetchManagedLists, moveListToTrash, permanentlyDeleteList, renameList, restoreList } from "../services/listManagementService";

const STATUSES = ["", "留守", "非決裁NG", "決裁NG", "再コール", "再コール留守", "非決裁見込み", "決裁見込み", "見込み留守", "トスアップ"];
const dateText = (value) => value ? new Date(value).toLocaleString("ja-JP") : "―";
const daysLeft = (value) => Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86400000));

export default function ListManagementPanel() {
  const [lists, setLists] = useState([]); const [trash, setTrash] = useState([]); const [selectedListId, setSelectedListId] = useState("");
  const [customers, setCustomers] = useState([]); const [selected, setSelected] = useState([]); const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const [bulk, setBulk] = useState({ status: "", reminderDate: "", reminderTime: "", destinationListId: "" });

  async function reload() { const [active, deleted] = await Promise.all([fetchManagedLists(), fetchManagedLists({ trash: true })]); setLists(active); setTrash(deleted); if (selectedListId && !active.some((item) => item.id === selectedListId)) { setSelectedListId(""); setCustomers([]); } }
  useEffect(() => { reload().catch((e) => setError(e.message)); }, []);
  useEffect(() => { if (!selectedListId) return; setSelected([]); fetchListCustomers(selectedListId).then(setCustomers).catch((e) => setError(e.message)); }, [selectedListId]);

  const visibleLists = useMemo(() => lists.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())), [lists, query]);
  const selectedList = lists.find((item) => item.id === selectedListId);
  const allSelected = customers.length > 0 && selected.length === customers.length;
  async function run(action, success) { setBusy(true); setError(""); setMessage(""); try { await action(); setMessage(success); await reload(); if (selectedListId) setCustomers(await fetchListCustomers(selectedListId)); } catch (e) { setError(e.message || "処理に失敗しました。"); } finally { setBusy(false); } }

  function startDuplicate(list) { const name = window.prompt("複製後のリスト名", `${list.name}（コピー）`); if (!name?.trim()) return; run(() => duplicateList(list.id, name.trim()), "リストを複製しました。"); }
  function trashList(list) { if (!window.confirm(`「${list.name}」をゴミ箱へ移動しますか？\n顧客・履歴・メモ・リマインドは30日間保持されます。`)) return; run(() => moveListToTrash(list.id), "リストをゴミ箱へ移動しました。"); }
  function deleteForever(list) { const text = window.prompt(`「${list.name}」と顧客${list.count}件を完全削除します。\n実行するには「完全削除」と入力してください。`); if (text !== "完全削除") return; run(() => permanentlyDeleteList(list.id), "完全削除しました。"); }
  async function applyBulk() {
    if (!selected.length) return window.alert("顧客を選択してください。");
    const reminderAt = bulk.reminderDate && bulk.reminderTime ? new Date(`${bulk.reminderDate}T${bulk.reminderTime}`).toISOString() : undefined;
    if (!bulk.status && !reminderAt && !bulk.destinationListId) return window.alert("一括変更する内容を指定してください。");
    await run(() => bulkUpdateCustomers({ customerIds: selected, status: bulk.status || undefined, reminderAt, destinationListId: bulk.destinationListId }), `${selected.length}件を一括更新しました。`); setSelected([]);
  }
  function removeSelected() { if (!selected.length || !window.confirm(`選択した${selected.length}件を削除しますか？架電履歴も削除されます。`)) return; run(() => bulkDeleteCustomers(selected), `${selected.length}件を削除しました。`); setSelected([]); }

  return <div className="list-management-stack">
    {error && <div className="admin-error">{error}</div>}{message && <div className="admin-success">{message}</div>}
    <section className="admin-panel"><div className="admin-panel-head"><div><h2>リスト管理</h2><p>名称変更・複製・CSV出力・一括編集・削除を管理します。</p></div><input className="list-manager-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="リスト名で検索" /></div>
      <div className="table-scroll"><table className="admin-table"><thead><tr><th>リスト名</th><th>件数</th><th>更新日時</th><th>操作</th></tr></thead><tbody>{visibleLists.map((list) => <tr key={list.id}><td><strong>{list.name}</strong></td><td>{list.count.toLocaleString()}件</td><td>{dateText(list.updatedAt)}</td><td><div className="user-action-group"><button className="table-action" onClick={() => setSelectedListId(list.id)}>顧客管理</button><button className="table-action" onClick={() => setEditing({ ...list })}>編集</button><button className="table-action" onClick={() => startDuplicate(list)} disabled={busy}>複製</button><button className="table-action danger" onClick={() => trashList(list)} disabled={busy}>削除</button></div></td></tr>)}</tbody></table></div>
    </section>

    {selectedList && <section className="admin-panel"><div className="admin-panel-head"><div><h2>{selectedList.name}：顧客一括操作</h2><p>{customers.length}件中 {selected.length}件を選択中</p></div><button className="secondary-button" onClick={() => downloadCustomersCsv(selectedList.name, selected.length ? customers.filter((item) => selected.includes(item.id)) : customers)}>CSVエクスポート</button></div>
      <div className="bulk-toolbar"><select value={bulk.status} onChange={(e) => setBulk({ ...bulk, status: e.target.value })}><option value="">ステータス変更なし</option>{STATUSES.filter(Boolean).map((status) => <option key={status}>{status}</option>)}</select><input type="date" value={bulk.reminderDate} onChange={(e) => setBulk({ ...bulk, reminderDate: e.target.value })} /><input type="time" value={bulk.reminderTime} onChange={(e) => setBulk({ ...bulk, reminderTime: e.target.value })} /><select value={bulk.destinationListId} onChange={(e) => setBulk({ ...bulk, destinationListId: e.target.value })}><option value="">リスト移動なし</option>{lists.filter((item) => item.id !== selectedListId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><button className="primary-button" onClick={applyBulk} disabled={busy}>一括反映</button><button className="danger-button" onClick={removeSelected} disabled={busy}>選択削除</button></div>
      <div className="table-scroll"><table className="admin-table"><thead><tr><th><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? customers.map((item) => item.id) : [])} /></th><th>会社名</th><th>電話番号</th><th>ステータス</th><th>次回架電</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.id}><td><input type="checkbox" checked={selected.includes(customer.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, customer.id] : selected.filter((id) => id !== customer.id))} /></td><td>{customer.companyName}</td><td>{customer.phone}</td><td>{customer.status || "未架電"}</td><td>{dateText(customer.reminderAt)}</td></tr>)}</tbody></table></div>
    </section>}

    <section className="admin-panel"><div className="admin-panel-head"><div><h2>ゴミ箱</h2><p>削除したリストは30日以内なら復元できます。</p></div></div>{trash.length === 0 ? <div className="empty-state">ゴミ箱は空です。</div> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>リスト名</th><th>件数</th><th>削除日時</th><th>残り</th><th>操作</th></tr></thead><tbody>{trash.map((list) => <tr key={list.id}><td>{list.name}</td><td>{list.count}件</td><td>{dateText(list.deletedAt)}</td><td>{daysLeft(list.expiresAt)}日</td><td><div className="user-action-group"><button className="table-action" onClick={() => run(() => restoreList(list.id), "リストを復元しました。")} disabled={busy}>復元</button><button className="table-action danger" onClick={() => deleteForever(list)} disabled={busy}>完全削除</button></div></td></tr>)}</tbody></table></div>}</section>

    {editing && <div className="lock-overlay"><section className="edit-modal"><h2>リスト編集</h2><label>リスト名<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(null)}>キャンセル</button><button className="primary-button" onClick={() => { if (!editing.name.trim()) return; run(() => renameList(editing.id, editing), "リスト情報を更新しました。"); setEditing(null); }}>保存</button></div></section></div>}
  </div>;
}
