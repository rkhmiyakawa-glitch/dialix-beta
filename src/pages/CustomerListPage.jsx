import { useMemo, useState } from "react";
import Header from "../components/Header";

const statusTone = {
  留守: "gray",
  フロントNG: "slate",
  担当NG: "red",
  見込み: "green",
  非決裁NG: "slate",
  決裁NG: "red",
  再コール: "blue",
  対象外: "slate",
  現アナ: "gray",
  再コール留守: "blue",
  見込み留守: "green",
  非決裁見込み: "green",
  決裁見込み: "green",
  トスアップ: "orange",
};

const groupedStatuses = {
  NG: new Set(["NG", "非決裁NG", "決裁NG"]),
  見込み: new Set(["見込み", "非決裁見込み", "決裁見込み"]),
};

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLocaleLowerCase("ja").replace(/\s+/g, "");
}

export default function CustomerListPage({
  selectedList,
  customers,
  onBack,
  onGoLists,
  onOpenCustomer,
  onLogout,
  currentUserId,
  presenceByCustomer = {},
  currentProfile,
  onOpenAdmin,
  onOpenMyPage,
}) {
  const [apInput, setApInput] = useState("");
  const [apFilter, setApFilter] = useState("");
  const [sortKey, setSortKey] = useState("import");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const visibleCustomers = useMemo(() => {
    const normalizedAp = normalizeSearchText(apFilter);

    let result = customers.filter((customer) => {
      const matchesAp =
        !normalizedAp ||
        normalizeSearchText(customer.ap).includes(normalizedAp);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "uncontacted" && !customer.status) ||
        groupedStatuses[statusFilter]?.has(customer.status) ||
        customer.status === statusFilter;

      return matchesAp && matchesStatus;
    });

    result = [...result].sort((a, b) => {
      if (sortKey === "companyAsc") {
        return a.companyName.localeCompare(b.companyName, "ja");
      }

      if (sortKey === "lastCallAsc") {
        return (a.lastCallAt || "9999").localeCompare(b.lastCallAt || "9999");
      }

      if (sortKey === "lastCallDesc") {
        return (b.lastCallAt || "").localeCompare(a.lastCallAt || "");
      }

      if (sortKey === "reminderAsc") {
        return (a.reminderAt || "9999").localeCompare(b.reminderAt || "9999");
      }

      return 0;
    });

    return result;
  }, [customers, apFilter, sortKey, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(visibleCustomers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageCustomers = visibleCustomers.slice((safePage - 1) * pageSize, safePage * pageSize);

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function handleSearch(event) {
    event.preventDefault();
    setApFilter(apInput.trim());
    setPage(1);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  function changePage(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  return (
    <main className="app-page">
      <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle={`${selectedList.name} / 顧客一覧`} />

      <section className="content customer-list-content">
        <div className="customer-list-heading">
          <div>
            <button className="back-button" type="button" onClick={onBack}>
              ← リスト一覧へ
            </button>
            <p className="eyebrow">CUSTOMERS</p>
            <h1>{selectedList.name}</h1>
            <p>
              全{customers.length}件
            </p>
          </div>

          <button
            className="start-call-button"
            type="button"
            onClick={() => visibleCustomers[0] && onOpenCustomer(visibleCustomers[0], visibleCustomers, (apFilter || statusFilter !== "all") ? "条件検索結果" : "リスト")}
            disabled={visibleCustomers.length === 0}
          >
            架電開始
          </button>
        </div>

        <section className="customer-filter-panel">
          <form className="customer-search-field" onSubmit={handleSearch}>
            <label htmlFor="customer-list-search">AP</label>
            <div className="customer-search-row">
              <input
                id="customer-list-search"
                type="search"
                placeholder="AP名を入力"
                value={apInput}
                onChange={(event) => setApInput(event.target.value)}
              />
              <button type="submit">検索</button>
            </div>
          </form>

          <label>
            ステータス
            <select
              value={statusFilter}
              onChange={(event) => updateFilter(setStatusFilter, event.target.value)}
            >
              <option value="all">すべて</option>
              <option value="uncontacted">未架電</option>
              <option value="留守">留守</option>
              <option value="NG">NG</option>
              <option value="対象外">対象外</option>
              <option value="現アナ">現アナ</option>
              <option value="再コール">再コール</option>
              <option value="再コール留守">再コール留守</option>
              <option value="見込み">見込み</option>
              <option value="見込み留守">見込み留守</option>
              <option value="トスアップ">トスアップ</option>
              <option value="前確依頼">前確依頼</option>
              <option value="前確NG">前確NG</option>
              <option value="前確OK">前確OK</option>
            </select>
          </label>

          <label>
            並び替え
            <select
              value={sortKey}
              onChange={(event) => updateFilter(setSortKey, event.target.value)}
            >
              <option value="import">取り込み順</option>
              <option value="companyAsc">顧客名 昇順</option>
              <option value="lastCallAsc">最終架電 古い順</option>
              <option value="lastCallDesc">最終架電 新しい順</option>
              <option value="reminderAsc">リマインドが近い順</option>
            </select>
          </label>
        </section>

        <div className="customer-summary">
          <span>表示件数：{visibleCustomers.length}件（{safePage} / {totalPages}ページ）</span>
          <label className="page-size-select">1ページ
            <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              <option value={25}>25件</option><option value={50}>50件</option><option value={100}>100件</option>
            </select>
          </label>
          <div className="legend">
            <span><i className="legend-dot room" />入室中</span>
            <span><i className="legend-dot calling" />架電中</span>
            <span><i className="legend-dot reminder" />リマインド対象</span>
          </div>
        </div>

        <section className="customer-table-card">
          <div className="customer-table-scroll">
            <table className="customer-table">
              <thead>
                <tr>
                  <th>顧客名</th>
                  <th>電話番号</th>
                  <th>詳細</th>
                  <th>担当AP</th>
                  <th>ステータス</th>
                  <th>最終架電日時</th>
                  <th>リマインド</th>
                  <th>利用状況</th>
                </tr>
              </thead>
              <tbody>
                {pageCustomers.map((customer) => {
                  const otherUsers = (presenceByCustomer[customer.id] || []).filter(
                    (row) => row.userId !== currentUserId
                  );
                  const locked = otherUsers.length > 0;
                  const liveUser = otherUsers[0];
                  return (
                  <tr
                    key={customer.id}
                    className={[
                      customer.reminderDue ? "is-reminder-due" : "",
                      locked ? "is-locked" : "",
                    ].join(" ")}
                  >
                    <td>
                      <button
                        className="customer-name-button"
                        type="button"
                        onClick={() => !locked && onOpenCustomer(customer, visibleCustomers, (apFilter || statusFilter !== "all") ? "条件検索結果" : "リスト")}
                        disabled={locked}
                      >
                        <strong>{customer.companyName}</strong>
                        <small>{customer.id}</small>
                      </button>
                    </td>
                    <td>{customer.phone}</td>
                    <td>{customer.businessSubcategory || "―"}</td>
                    <td>{customer.status || customer.history?.length ? (customer.ap || "―") : ""}</td>
                    <td>
                      {customer.status ? (
                        <span className={`table-status ${statusTone[customer.status]}`}>
                          {customer.status}
                        </span>
                      ) : (
                        <span className="uncontacted-badge">未架電</span>
                      )}
                    </td>
                    <td>{customer.lastCallAt || "―"}</td>
                    <td>
                      {customer.reminderAt ? (
                        <span className={customer.reminderDue ? "reminder-text due" : "reminder-text"}>
                          {customer.reminderAt}
                        </span>
                      ) : (
                        "―"
                      )}
                    </td>
                    <td>
                      {locked && liveUser?.callState === "calling" && (
                        <span className="presence-pill calling">架電中：{liveUser.userName}</span>
                      )}
                      {locked && liveUser?.callState !== "calling" && (
                        <span className="presence-pill room">入室中：{liveUser?.userName}</span>
                      )}
                      {!locked && <span className="presence-pill idle">待機</span>}
                    </td>
                  </tr>
                );
                })}
              </tbody>
            </table>
          </div>

          {visibleCustomers.length === 0 && (
            <div className="empty-state customer-empty-state">条件に一致する顧客がありません。</div>
          )}
          {visibleCustomers.length > 0 && totalPages > 1 && (
            <nav className="pagination" aria-label="顧客一覧ページ">
              <button type="button" onClick={() => changePage(1)} disabled={safePage === 1}>最初</button>
              <button type="button" onClick={() => changePage(Math.max(1, safePage - 1))} disabled={safePage === 1}>前へ</button>
              <strong>{safePage} / {totalPages}</strong>
              <button type="button" onClick={() => changePage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages}>次へ</button>
              <button type="button" onClick={() => changePage(totalPages)} disabled={safePage === totalPages}>最後</button>
            </nav>
          )}
        </section>
      </section>
    </main>
  );
}
