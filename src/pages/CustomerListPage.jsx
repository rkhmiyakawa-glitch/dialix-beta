import { useMemo, useState } from "react";
import Header from "../components/Header";
import StatusMultiSelect from "../components/StatusMultiSelect";

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

function lastCalledTime(value) {
  if (!value) return null;
  const timestamp = new Date(String(value).replace(/\//g, "-")).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function sortCalledCustomersKeepingListOrder(customers, direction) {
  const calledCustomers = customers
    .filter((customer) => lastCalledTime(customer.lastCallAt) !== null)
    .sort((left, right) => {
      const leftTime = lastCalledTime(left.lastCallAt);
      const rightTime = lastCalledTime(right.lastCallAt);
      return direction === "asc" ? leftTime - rightTime : rightTime - leftTime;
    });
  let calledIndex = 0;
  return customers.map((customer) =>
    lastCalledTime(customer.lastCallAt) === null ? customer : calledCustomers[calledIndex++]
  );
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
  const [customerQuery, setCustomerQuery] = useState("");
  const [apFilter, setApFilter] = useState("");
  const [statusFilters, setStatusFilters] = useState([]);
  const [lastCalledSort, setLastCalledSort] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const apOptions = useMemo(
    () => [...new Set(customers.map((customer) => String(customer.ap || "").trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "ja")),
    [customers]
  );

  const visibleCustomers = useMemo(() => {
    const filtered = customers.filter((customer) => {
      const normalizedQuery = normalizeSearchText(customerQuery);
      const phoneQuery = String(customerQuery || "").replace(/\D/g, "");
      const normalizedPhone = String(customer.phone || "").replace(/\D/g, "");
      const matchesCustomer =
        !normalizedQuery ||
        normalizeSearchText(customer.companyName).includes(normalizedQuery) ||
        (phoneQuery && normalizedPhone.includes(phoneQuery));

      const matchesAp =
        !apFilter ||
        normalizeSearchText(customer.ap) === normalizeSearchText(apFilter);

      const matchesStatus =
        statusFilters.length === 0 ||
        statusFilters.some((status) =>
          (status === "uncontacted" &&
            (!String(customer.status || "").trim() || customer.status === "未架電")) ||
          groupedStatuses[status]?.has(customer.status) ||
          customer.status === status
        );

      return matchesCustomer && matchesAp && matchesStatus;
    });
    if (!lastCalledSort) return filtered;
    return sortCalledCustomersKeepingListOrder(filtered, lastCalledSort);
  }, [customers, customerQuery, apFilter, statusFilters, lastCalledSort]);

  const totalPages = Math.max(1, Math.ceil(visibleCustomers.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageCustomers = visibleCustomers.slice((safePage - 1) * pageSize, safePage * pageSize);

  function updateFilter(setter, value) {
    setter(value);
    setPage(1);
  }

  function changePage(nextPage) {
    setPage(nextPage);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  const hasSearchConditions =
    Boolean(customerQuery.trim()) || Boolean(apFilter) || statusFilters.length > 0 || Boolean(lastCalledSort);

  function clearSearchConditions() {
    setCustomerQuery("");
    setApFilter("");
    setStatusFilters([]);
    setLastCalledSort("");
    setPage(1);
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
            <h1>{selectedList.name}</h1>
            <p>
              全{customers.length}件
            </p>
          </div>

          <button
            className="start-call-button"
            type="button"
            onClick={() => visibleCustomers[0] && onOpenCustomer(visibleCustomers[0], visibleCustomers, hasSearchConditions ? "条件検索結果" : "リスト")}
            disabled={visibleCustomers.length === 0}
          >
            架電開始
          </button>
        </div>

        <section className="customer-filter-panel">
          <label className="customer-search-field" htmlFor="customer-list-query">
            顧客名または電話番号検索
            <input
              id="customer-list-query"
              type="search"
              placeholder="顧客名または電話番号を入力"
              value={customerQuery}
              onChange={(event) => updateFilter(setCustomerQuery, event.target.value)}
            />
          </label>

          <label htmlFor="customer-list-ap-filter">
            AP
            <select
              id="customer-list-ap-filter"
              value={apFilter}
              onChange={(event) => updateFilter(setApFilter, event.target.value)}
            >
              <option value="">すべてのAP</option>
              {apOptions.map((apName) => (
                <option key={apName} value={apName}>{apName}</option>
              ))}
            </select>
          </label>

          <label>
            ステータス
            <StatusMultiSelect
              value={statusFilters}
              onChange={(value) => updateFilter(setStatusFilters, value)}
            />
          </label>

          <label htmlFor="customer-list-last-called-sort">
            最終架電日時
            <select
              id="customer-list-last-called-sort"
              value={lastCalledSort}
              onChange={(event) => updateFilter(setLastCalledSort, event.target.value)}
            >
              <option value="">指定なし</option>
              <option value="desc">新しい順</option>
              <option value="asc">古い順</option>
            </select>
          </label>

          <button
            className="secondary-button customer-filter-clear"
            type="button"
            onClick={clearSearchConditions}
            disabled={!hasSearchConditions}
          >
            条件クリア
          </button>
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
                        onClick={() => !locked && onOpenCustomer(customer, visibleCustomers, hasSearchConditions ? "条件検索結果" : "リスト")}
                        disabled={locked}
                      >
                        <strong>{customer.companyName}</strong>
                        <small>{customer.id}</small>
                      </button>
                    </td>
                    <td>{customer.phone}</td>
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
