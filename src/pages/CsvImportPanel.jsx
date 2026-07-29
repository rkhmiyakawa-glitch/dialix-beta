import { useEffect, useMemo, useState } from "react";
import { DIALIX_STATUSES, fetchImportHistory, fetchImportLists, fetchImportProfiles, guessMapping, guessStatusMappings, importCustomers, parseCsv, prepareRows } from "../services/importService";

const fieldLabels = {
  companyName: "顧客名（必須）", phone: "電話番号（必須）", address: "住所", businessSubcategory: "詳細・事業内容",
  status: "既存ステータス", memo: "メモ", apName: "最終担当AP", lastCalledAt: "最終架電日時", reminderAt: "次回架電日時",
};

export default function CsvImportPanel({ currentProfile }) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [parsedRows, setParsedRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [statusMappings, setStatusMappings] = useState({});
  const [apMappings, setApMappings] = useState({});
  const [lists, setLists] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [history, setHistory] = useState([]);
  const [listMode, setListMode] = useState("existing");
  const [listId, setListId] = useState("");
  const [newListName, setNewListName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function reload() {
    const [nextLists, nextProfiles, nextHistory] = await Promise.all([fetchImportLists(), fetchImportProfiles(), fetchImportHistory()]);
    setLists(nextLists); setProfiles(nextProfiles); setHistory(nextHistory);
    if (!listId && nextLists[0]) setListId(nextLists[0].id);
  }
  useEffect(() => { reload().catch((e) => setError(e.message)); }, []);

  const rawStatuses = useMemo(() => [...new Set(parsedRows.map(({ raw }) => String(raw[mapping.status] || "").trim()).filter(Boolean))], [parsedRows, mapping.status]);
  const rawApNames = useMemo(() => [...new Set(parsedRows.map(({ raw }) => String(raw[mapping.apName] || "").trim()).filter(Boolean))], [parsedRows, mapping.apName]);
  const rows = useMemo(() => prepareRows(parsedRows, mapping, statusMappings, apMappings), [parsedRows, mapping, statusMappings, apMappings]);
  const validCount = rows.filter((row) => row.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  useEffect(() => { setStatusMappings((prev) => ({ ...guessStatusMappings(rawStatuses), ...prev })); }, [rawStatuses.join("|")]);
  useEffect(() => {
    setApMappings((prev) => {
      const next = { ...prev };
      rawApNames.forEach((name) => {
        if (next[name] !== undefined) return;
        const match = profiles.find((profile) => profile.displayName === name || profile.email?.toLowerCase() === name.toLowerCase());
        next[name] = match || null;
      });
      return next;
    });
  }, [rawApNames.join("|"), profiles]);

  async function onFileChange(event) {
    setError(""); setMessage("");
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      setFileName(file.name); setHeaders(parsed.headers); setParsedRows(parsed.rows); setMapping(guessMapping(parsed.headers)); setStatusMappings({}); setApMappings({});
    } catch (e) { setError(e.message || "CSVを読み込めませんでした。"); }
  }

  async function runImport() {
    if (!mapping.companyName || !mapping.phone) return setError("顧客名と電話番号の列を指定してください。");
    if (!rows.length) return setError("CSVを選択してください。");
    setBusy(true); setError(""); setMessage("");
    try {
      const result = await importCustomers({ fileName, listMode, listId, newListName, rows, userId: currentProfile?.id, userName: currentProfile?.displayName });
      const warningText = result.postProcessWarnings?.length ? `（補助処理警告：${result.postProcessWarnings.join("／")}）` : "";
      setMessage(`取込完了：新規 ${result.insertedRows}件／履歴 ${result.importedHistoryRows}件／重複 ${result.duplicateRows}件／エラー ${result.errorRows}件${warningText}`);
      await reload();
    } catch (e) { setError(e.message || "インポートに失敗しました。"); }
    finally { setBusy(false); }
  }

  return <div className="csv-import-grid">
    <section className="admin-panel csv-panel">
      <div className="admin-panel-head"><div><h2>CSVインポート</h2><p>顧客IDは自動採番。電話番号は全角を半角化し、ハイフン・空白を除去します。</p></div></div>
      {error && <div className="admin-error">{error}</div>}{message && <div className="admin-success">{message}</div>}
      <div className="csv-form">
        <label className="file-drop">CSVファイル<input type="file" accept=".csv,text/csv" onChange={onFileChange} /><span>{fileName || "ファイルを選択してください"}</span></label>
        <div className="import-destination"><label><input type="radio" checked={listMode === "existing"} onChange={() => setListMode("existing")} />既存リストへ追加</label><label><input type="radio" checked={listMode === "new"} onChange={() => setListMode("new")} />新規リストを作成</label></div>
        {listMode === "existing" ? <select value={listId} onChange={(e) => setListId(e.target.value)}><option value="">選択してください</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}（{list.customer_count || 0}件）</option>)}</select> : <input value={newListName} onChange={(e) => setNewListName(e.target.value)} placeholder="新しいリスト名" />}
      </div>

      {headers.length > 0 && <>
        <h3 className="csv-subtitle">列の割り当て</h3>
        <div className="mapping-grid">{Object.entries(fieldLabels).map(([field, label]) => <label key={field}>{label}<select value={mapping[field] || ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}><option value="">使用しない</option>{headers.map((header) => <option key={header} value={header}>{header}</option>)}</select></label>)}</div>

        {rawStatuses.length > 0 && <><h3 className="csv-subtitle">ステータスマッピング</h3><p className="csv-note">スプレッドシート側の表記をDIALIXのステータスへ割り当ててください。未設定の値がある行は取り込みません。</p><div className="mapping-grid status-mapping-grid">{rawStatuses.map((value) => <label key={value}><span>{value}</span><select value={statusMappings[value] || ""} onChange={(e) => setStatusMappings({ ...statusMappings, [value]: e.target.value })}><option value="">選択してください</option>{DIALIX_STATUSES.filter(Boolean).map((status) => <option key={status} value={status}>{status}</option>)}</select></label>)}</div></>}

        {rawApNames.length > 0 && <><h3 className="csv-subtitle">最終担当APマッピング</h3><p className="csv-note">該当ユーザーがいない場合は「名前だけ履歴に残す」を選択できます。</p><div className="mapping-grid status-mapping-grid">{rawApNames.map((name) => <label key={name}><span>{name}</span><select value={apMappings[name]?.id || ""} onChange={(e) => { const match = profiles.find((p) => p.id === e.target.value) || null; setApMappings({ ...apMappings, [name]: match }); }}><option value="">名前だけ履歴に残す</option>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.displayName}{profile.isActive ? "" : "（停止中）"}</option>)}</select></label>)}</div></>}

        <div className="csv-summary"><strong>全{rows.length}件</strong><span>取込可能 {validCount}件</span><span className={errorCount ? "has-error" : ""}>入力エラー {errorCount}件</span></div>
        <div className="table-scroll"><table className="admin-table csv-preview"><thead><tr><th>行</th><th>顧客名</th><th>電話番号</th><th>ステータス</th><th>最終担当AP</th><th>メモ</th><th>判定</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={row.rowNumber}><td>{row.rowNumber}</td><td>{row.companyName || "―"}</td><td>{row.phone || "―"}</td><td>{row.status || "―"}</td><td>{row.apName || "―"}</td><td className="csv-memo-cell">{row.memo || "―"}</td><td>{row.errors.length ? <span className="csv-error-text">{row.errors.join("／")}</span> : <span className="csv-ok-text">OK</span>}</td></tr>)}</tbody></table></div>
        {rows.length > 100 && <p className="csv-note">プレビューは先頭100件を表示しています。</p>}
        <div className="csv-actions"><button className="primary-button" disabled={busy || validCount === 0} onClick={runImport}>{busy ? "取込中..." : `${validCount}件をインポート`}</button></div>
      </>}
    </section>

    <section className="admin-panel csv-history"><h2>インポート履歴</h2>{history.length === 0 ? <div className="empty-state">履歴はありません。</div> : <div className="table-scroll"><table className="admin-table"><thead><tr><th>日時</th><th>ファイル</th><th>リスト</th><th>結果</th><th>実行者</th></tr></thead><tbody>{history.map((item) => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("ja-JP")}</td><td>{item.file_name}</td><td>{item.lists?.name || "―"}</td><td>新規 {item.inserted_rows}／重複 {item.duplicate_rows}／エラー {item.error_rows}</td><td>{item.imported_by_name || "―"}</td></tr>)}</tbody></table></div>}</section>
  </div>;
}
