import { useEffect, useState } from "react";
import Header from "../components/Header";
import StatusMultiSelect from "../components/StatusMultiSelect";
import { fetchProfiles } from "../services/profileService";

export default function ListPage({ lists, onLogout, onGoLists, onOpenCall, currentProfile, onOpenAdmin, onOpenMyPage, tasks, onOpenTask, onSearchCustomers }) {
  const [customerQuery, setCustomerQuery] = useState("");
  const [apQuery, setApQuery] = useState("");
  const [apOptions, setApOptions] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [lastCalledSort, setLastCalledSort] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let active = true;
    fetchProfiles()
      .then((profiles) => {
        if (!active) return;
        const names = [...new Set(
          profiles
            .filter((profile) => profile.isActive !== false)
            .map((profile) => String(profile.displayName || "").trim())
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, "ja"));
        setApOptions(names);
      })
      .catch(() => {
        if (active) setApOptions([]);
      });
    return () => { active = false; };
  }, []);

  async function handleCustomerSearch(event) {
    event.preventDefault();
    const conditions = {
      keyword: customerQuery.trim(),
      ap: apQuery.trim(),
      statuses: statusFilters,
      lastCalledSort,
    };
    if (!conditions.keyword && !conditions.ap && conditions.statuses.length === 0 && !conditions.lastCalledSort) {
      return window.alert("検索条件を1つ以上入力してください。");
    }
    setSearching(true);
    setHasSearched(true);
    try { setSearchResults(await onSearchCustomers(conditions)); }
    catch (error) { window.alert(error.message || "検索に失敗しました。"); }
    finally { setSearching(false); }
  }

  const overdueItems = tasks?.reminders || [];

  return <main className="app-page">
    <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle="リスト一覧" />
    <section className="content">
      <div className="page-title"><div><p className="eyebrow">OVERDUE</p><h1>期限超過リマインド</h1><p>期限を過ぎている顧客を確認できます。</p></div></div>

      <section className="admin-panel management-list-panel">
        <div className="admin-panel-head management-list-head"><h2>期限超過リマインド一覧</h2><span>最大100件を表示</span></div>
        {overdueItems.length === 0 ? <div className="empty-state">現在、対象の顧客はいません。</div> : <div className="task-list">
          {overdueItems.map((item) => <button className="task-row" key={item.id} type="button" onClick={() => onOpenTask(item, overdueItems, "期限超過リマインド")}>
            <div><strong>{item.companyName}</strong><small>{item.listName}・{item.phone}</small></div>
            <div className="task-row-meta"><span>{item.reminderAt || item.status || "未架電"}</span><b>開く ›</b></div>
          </button>)}
        </div>}
      </section>

      <div className="page-title list-section-title"><div><p className="eyebrow">CALL LISTS</p><h1>リスト一覧</h1><p>架電するリストを選択してください。</p></div></div>
      <form className="search-panel global-search-panel" onSubmit={handleCustomerSearch}>
        <label htmlFor="customer-search">全検索</label>
        <div className="global-search-fields">
          <input id="customer-search" type="search" placeholder="顧客名または電話番号" value={customerQuery} onChange={(e) => setCustomerQuery(e.target.value)} />
          <select aria-label="AP" value={apQuery} onChange={(e) => setApQuery(e.target.value)}>
            <option value="">AP：すべて</option>
            {apOptions.map((apName) => <option key={apName} value={apName}>{apName}</option>)}
          </select>
          <StatusMultiSelect value={statusFilters} onChange={setStatusFilters} />
          <select aria-label="最終架電日時の並び順" value={lastCalledSort} onChange={(e) => setLastCalledSort(e.target.value)}>
            <option value="">最終架電日時：指定なし</option>
            <option value="desc">最終架電日時：新しい順</option>
            <option value="asc">最終架電日時：古い順</option>
          </select>
          <button type="submit" disabled={searching}>{searching ? "検索中" : "検索"}</button>
        </div>
        <p>すべてのリストを対象に、顧客名・電話番号・AP・ステータス・最終架電日時の並び順を組み合わせて検索します。</p>
      </form>
      {searchResults.length > 0 && <section className="task-panel search-result-panel"><div className="task-panel-head"><h2>検索結果</h2><span>{searchResults.length}件</span></div><div className="task-list">{searchResults.map((item) => <button className="task-row" key={item.id} type="button" onClick={() => onOpenTask(item, searchResults, "検索結果")}><div><strong>{item.companyName}</strong><small>{item.listName}・{item.phone}</small></div><div className="task-row-meta"><span>{item.status || "未架電"}</span><b>開く ›</b></div></button>)}</div></section>}
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
