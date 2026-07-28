import { useEffect, useState } from "react";
import Header from "../components/Header";

const taskTabs = [
  ["reminders", "期限超過リマインド"],
  ["dueToday", "本日のリマインド"],
  ["prospects", "リマインド一覧"],
  ["tossups", "トスアップ"],
];

export default function ListPage({ initialActiveTask = "reminders", lists, onLogout, onGoLists, onOpenCall, currentProfile, onOpenAdmin, onOpenMyPage, tasks, onOpenTask, onSearchCustomers }) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeTask, setActiveTask] = useState(initialActiveTask);

  useEffect(() => { setActiveTask(initialActiveTask); }, [initialActiveTask]);

  async function handleCustomerSearch(event) {
    event.preventDefault();
    const keyword = customerQuery.trim();
    if (!keyword) return window.alert("顧客名または電話番号を入力してください。");
    setSearching(true);
    setHasSearched(true);
    try { setSearchResults(await onSearchCustomers(keyword)); }
    catch (error) { window.alert(error.message || "検索に失敗しました。"); }
    finally { setSearching(false); }
  }

  const taskItems = tasks?.[activeTask] || [];

  return <main className="app-page">
    <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle="リスト一覧" />
    <section className="content">
      <div className="page-title"><div><p className="eyebrow">TODAY</p><h1>今日のタスク</h1><p>優先対応が必要な顧客を確認できます。</p></div></div>

      <section className="task-summary-grid">
        {taskTabs.map(([key, label]) => <button key={key} className={`task-summary-card ${activeTask === key ? "active" : ""}`} onClick={() => setActiveTask(key)}>
          <span>{label}</span><strong>{tasks?.[key]?.length || 0}</strong><small>件</small>
        </button>)}
      </section>

      <section className="task-panel">
        <div className="task-panel-head"><h2>{taskTabs.find(([key]) => key === activeTask)?.[1]}</h2><span>最大100件を表示</span></div>
        {taskItems.length === 0 ? <div className="empty-state">現在、対象の顧客はいません。</div> : <div className="task-list">
          {taskItems.slice(0, 20).map((item) => <button className="task-row" key={item.id} onClick={() => onOpenTask(item, taskItems, "リスト")}>
            <div><strong>{item.companyName}</strong><small>{item.listName}・{item.phone}</small></div>
            <div className="task-row-meta"><span>{item.reminderAt || item.status || "未架電"}</span><b>開く ›</b></div>
          </button>)}
        </div>}
      </section>

      <div className="page-title list-section-title"><div><p className="eyebrow">CALL LISTS</p><h1>リスト一覧</h1><p>架電するリストを選択してください。</p></div></div>
      <form className="search-panel" onSubmit={handleCustomerSearch}><label htmlFor="customer-search">検索</label><div className="search-row"><input id="customer-search" type="search" placeholder="顧客名または電話番号を入力" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} /><button type="submit" disabled={searching}>{searching ? "検索中" : "検索"}</button></div><p>すべてのリストを対象に顧客を検索します。</p></form>
      {searchResults.length > 0 && <section className="task-panel search-result-panel"><div className="task-panel-head"><h2>検索結果</h2><span>{searchResults.length}件</span></div><div className="task-list">{searchResults.map((item) => <button className="task-row" key={item.id} onClick={() => onOpenTask(item, searchResults, "検索結果")}><div><strong>{item.companyName}</strong><small>{item.listName}・{item.phone}</small></div><div className="task-row-meta"><span>{item.status || "未架電"}</span><b>開く ›</b></div></button>)}</div></section>}
      {hasSearched && !searching && searchResults.length === 0 && <div className="empty-state search-empty-state">検索条件に一致する顧客はいません。</div>}
      <section className="list-grid" aria-label="架電リスト">
        {lists.map((list) => (
          <button className="list-card" type="button" key={list.id} onClick={() => onOpenCall(list)}>
            <span className="list-info">
              <span className="list-name">{list.name}</span>
              <span className="list-progress-summary">
                <span>未架電 <strong>{(list.uncontactedCount || 0).toLocaleString()}</strong>件</span>
                <span>留守 <strong>{(list.absenceCount || 0).toLocaleString()}</strong>件</span>
                <span>再コール <strong>{(list.recallCount || 0).toLocaleString()}</strong>件</span>
              </span>
            </span>
            <span className="list-count"><strong>{list.count.toLocaleString()}</strong><span>件</span><span className="arrow">›</span></span>
          </button>
        ))}
        {lists.length === 0 && <div className="empty-state">利用できるリストがありません。</div>}
      </section>
    </section>
  </main>;
}
