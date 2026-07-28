import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import ListPage from "./pages/ListPage";
import CustomerListPage from "./pages/CustomerListPage";
import CallPage from "./pages/CallPage";
import AdminPage from "./pages/AdminPage";
import MyPage from "./pages/MyPage";
import SystemBanner from "./components/SystemBanner";
import useAuth from "./hooks/useAuth";
import useCustomerPresence from "./hooks/useCustomerPresence";
import { fetchMyProfile, touchUserActivity } from "./services/profileService";
import { fetchCustomers, fetchLists, fetchTodayKpi, saveCallResult } from "./services/dataService";
import { todayKpi as fallbackKpi } from "./data/sampleData";
import { fetchOperationalTasks, searchCustomersAcrossLists, subscribeOperationalTasks } from "./services/operationsService";

function scrollPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

export default function App() {
  const { session, loading: authLoading, login, logout, demoMode, recoverSession, sessionState } = useAuth();
  const [lists, setLists] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [kpi, setKpi] = useState(fallbackKpi);
  const [selectedList, setSelectedList] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [currentProfile, setCurrentProfile] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showMyPage, setShowMyPage] = useState(false);
  const [tasks, setTasks] = useState({ reminders: [], dueToday: [], prospects: [], tossups: [] });
  const [pendingCustomerId, setPendingCustomerId] = useState("");
  const [navigationItems, setNavigationItems] = useState([]);
  const [navigationLabel, setNavigationLabel] = useState("リスト");

  const userId = session?.user?.id || "";
  const userName = currentProfile?.displayName || session?.user?.user_metadata?.display_name || session?.user?.email || "オペレーター";
  const presence = useCustomerPresence({ listId: selectedList?.id, userId, userName });

  const lockedUsers = useMemo(
    () => selectedCustomer ? presence.getOtherUsers(selectedCustomer.id) : [],
    [selectedCustomer, presence.rows]
  );

  useLayoutEffect(() => {
    scrollPageTop();
  }, [selectedList?.id, selectedCustomer?.id, showAdmin, showMyPage]);

  useEffect(() => {
    if (!session) return undefined;
    touchUserActivity().catch(() => {});
    const timer = window.setInterval(() => touchUserActivity().catch(() => {}), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    setDataLoading(true);
    Promise.all([fetchLists(), fetchTodayKpi(session.user?.id), fetchMyProfile(session.user)])
      .then(async ([nextLists, nextKpi, nextProfile]) => {
        const nextTasks = await fetchOperationalTasks({
          userId: session.user?.id,
          displayName: nextProfile?.displayName,
          email: nextProfile?.email || session.user?.email,
        });
        setLists(nextLists);
        setKpi(nextKpi);
        setCurrentProfile(nextProfile);
        setTasks(nextTasks);
      })
      .catch((error) => setDataError(error.message || "データ取得に失敗しました。"))
      .finally(() => setDataLoading(false));
  }, [session]);


  useEffect(() => {
    if (!session || !currentProfile) return undefined;
    return subscribeOperationalTasks(async () => {
      try {
        setTasks(await fetchOperationalTasks({
          userId: session.user?.id,
          displayName: currentProfile?.displayName,
          email: currentProfile?.email || session.user?.email,
        }));
      } catch { /* next manual refresh will recover */ }
    });
  }, [session, currentProfile]);

  async function openTaskCustomer(task, contextItems = [task], contextLabel = "リスト") {
    setNavigationItems(contextItems.map((item) => ({ id: item.id, listId: item.listId || task.listId })));
    setNavigationLabel(contextLabel);
    const list = lists.find((item) => item.id === task.listId) || { id: task.listId, name: task.listName, count: 0, activeUsers: 0 };
    setDataLoading(true);
    try {
      const nextCustomers = await fetchCustomers(list.id);
      setCustomers(nextCustomers);
      setSelectedList({ ...list, count: list.count || nextCustomers.length });
      const customer = nextCustomers.find((item) => item.id === task.id);
      if (!customer) throw new Error("顧客が見つかりませんでした。");
      setPendingCustomerId(customer.id);
    } finally { setDataLoading(false); }
  }

  useEffect(() => {
    if (!pendingCustomerId || !selectedList || !customers.length) return;
    const customer = customers.find((item) => item.id === pendingCustomerId);
    if (!customer) return;
    const timer = window.setTimeout(async () => {
      setPendingCustomerId("");
      await openCustomer(customer);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [pendingCustomerId, selectedList, customers, presence.rows]);

  async function openList(list) {
    scrollPageTop();
    setDataLoading(true);
    try {
      setCustomers(await fetchCustomers(list.id));
      setSelectedList(list);
      setSelectedCustomer(null);
    } catch (error) {
      setDataError(error.message || "顧客データの取得に失敗しました。");
    } finally {
      setDataLoading(false);
    }
  }

  async function openCustomer(customer, sequence = null, label = "リスト") {
    scrollPageTop();
    if (sequence) {
      setNavigationItems(sequence.map((item) => ({ id: item.id, listId: item.listId || selectedList?.id })));
      setNavigationLabel(label);
    }
    const users = presence.getOtherUsers(customer.id);
    if (users.length) {
      window.alert(`${users[0].userName || "他のオペレーター"}さんが利用中です。`);
      return;
    }
    setSelectedCustomer(customer);
    await presence.trackCustomer(customer.id);
  }

  async function closeCustomer() {
    scrollPageTop();
    await presence.clearCustomer();
    setSelectedCustomer(null);
  }

  async function goToLists() {
    // ロゴ・パンくず・各画面の「一覧へ戻る」は必ず同じ処理を通す。
    // 管理画面表示中でも先に管理画面を閉じ、リスト一覧へ確実に戻す。
    setShowAdmin(false);
    setShowMyPage(false);
    scrollPageTop();
    await presence.clearCustomer();
    setSelectedCustomer(null);
    setSelectedList(null);
    setCustomers([]);
    setNavigationItems([]);
    window.requestAnimationFrame(scrollPageTop);
  }

  function openAdmin() {
    scrollPageTop();
    setShowMyPage(false);
    setShowAdmin(true);
  }

  function openMyPage() {
    scrollPageTop();
    setShowAdmin(false);
    setShowMyPage(true);
  }

  function closeMyPage() {
    scrollPageTop();
    setShowMyPage(false);
  }

  function closeAdmin() {
    scrollPageTop();
    setShowAdmin(false);
    setShowMyPage(false);
  }

  async function handleLogout() {
    await presence.clearCustomer();
    await logout();
    setSelectedCustomer(null);
    setSelectedList(null);
    setCustomers([]);
    setCurrentProfile(null);
    setShowAdmin(false);
    setShowMyPage(false);
  }

  async function handleSaveCall(payload) {
    const result = await saveCallResult({ ...payload, operatorName: userName, userId });

    if (result.demoMode) {
      const savedAt = new Date(result.savedAt);
      const savedAtLabel = savedAt.toLocaleString("ja-JP");
      const nextHistory = {
        id: `demo-${savedAt.getTime()}`,
        calledAt: result.savedAt,
        at: savedAtLabel,
        ap: userName,
        status: payload.status,
        memo: payload.memo || "",
      };
      const refreshed = customers.map((customer) =>
        customer.id === payload.customerId
          ? {
              ...customer,
              ap: userName,
              status: payload.status,
              lastCallAt: savedAtLabel,
              reminderAt: payload.reminderDate && payload.reminderTime
                ? new Date(`${payload.reminderDate}T${payload.reminderTime}`).toLocaleString("ja-JP")
                : "",
              history: [nextHistory, ...(customer.history || [])],
            }
          : customer
      );
      setCustomers(refreshed);
      setSelectedCustomer(refreshed.find((customer) => customer.id === payload.customerId) || selectedCustomer);
      return result;
    }

    const refreshed = await fetchCustomers(selectedList.id);
    setCustomers(refreshed);
    setSelectedCustomer(refreshed.find((c) => c.id === payload.customerId) || selectedCustomer);
    setKpi(await fetchTodayKpi(userId));
    setTasks(await fetchOperationalTasks({
      userId,
      displayName: currentProfile?.displayName || userName,
      email: currentProfile?.email || session?.user?.email,
    }));
    return result;
  }

  async function navigateCustomer(offset) {
    scrollPageTop();
    if (!selectedCustomer || !navigationItems.length) return;
    const currentIndex = navigationItems.findIndex((item) => item.id === selectedCustomer.id);
    const targetIndex = currentIndex + offset;
    if (targetIndex < 0 || targetIndex >= navigationItems.length) return;
    const target = navigationItems[targetIndex];

    await presence.clearCustomer();
    if (target.listId && target.listId !== selectedList?.id) {
      const list = lists.find((item) => item.id === target.listId) || { id: target.listId, name: "検索結果", count: 0, activeUsers: 0 };
      setDataLoading(true);
      try {
        const nextCustomers = await fetchCustomers(target.listId);
        setCustomers(nextCustomers);
        setSelectedList({ ...list, count: list.count || nextCustomers.length });
        setSelectedCustomer(null);
        setPendingCustomerId(target.id);
        scrollPageTop();
      } finally {
        setDataLoading(false);
      }
      return;
    }

    const next = customers.find((item) => item.id === target.id);
    if (!next) return;
    const users = presence.getOtherUsers(next.id);
    if (users.length) {
      window.alert(`${users[0].userName || "他のオペレーター"}さんが利用中です。`);
      return;
    }
    await presence.trackCustomer(next.id);
    setSelectedCustomer(next);
    scrollPageTop();
  }

  async function openNextCustomer() {
    return navigateCustomer(1);
  }

  async function openPreviousCustomer() {
    return navigateCustomer(-1);
  }

  if (authLoading) return <main className="loading-screen">認証情報を確認しています...</main>;
  if (!session) return <LoginPage onLogin={login} demoMode={demoMode} />;

  const banner = <SystemBanner demoMode={demoMode} error={dataError} />;
  const sessionNotice = sessionState !== "ready" && (
    <div className={`session-warning ${sessionState}`}>
      {sessionState === "recovering" && "セッションを再確認しています…"}
      {sessionState === "offline" && <>通信を確認できません。<button type="button" onClick={recoverSession}>再接続</button></>}
      {sessionState === "expired" && <>セッションの有効期限が切れました。<button type="button" onClick={recoverSession}>再認証</button></>}
    </div>
  );



  if (showMyPage) {
    return <>
      {banner}
      {sessionNotice}
      <MyPage
        currentProfile={currentProfile || { displayName: userName, email: session?.user?.email || "", role: "operator", isActive: true }}
        onProfileUpdated={setCurrentProfile}
        onBack={closeMyPage}
        onGoLists={goToLists}
        onLogout={handleLogout}
        onOpenAdmin={openAdmin}
        onOpenMyPage={openMyPage}
      />
    </>;
  }

  const normalizedRole = String(currentProfile?.role || "").trim().toLowerCase();
  const canOpenAdmin = ["owner", "admin", "sv", "supervisor", "管理者", "オーナー"].includes(normalizedRole);

  if (showAdmin && currentProfile && canOpenAdmin) {
    return <>
      {banner}
      {sessionNotice}
      <AdminPage currentProfile={currentProfile} onBack={closeAdmin} onGoLists={goToLists} onLogout={handleLogout} onOpenMyPage={openMyPage} />
    </>;
  }

  if (selectedList && selectedCustomer) {
    return <>
      {banner}
      {sessionNotice}
      <CallPage
        selectedList={selectedList}
        selectedCustomer={selectedCustomer}
        kpi={kpi}
        lockedUsers={lockedUsers}
        onBack={closeCustomer}
        onGoLists={goToLists}
        onOpenNext={openNextCustomer}
        onOpenPrevious={openPreviousCustomer}
        navigationPosition={Math.max(1, navigationItems.findIndex((item) => item.id === selectedCustomer.id) + 1)}
        navigationTotal={navigationItems.length || customers.length || 1}
        navigationLabel={navigationLabel}
        onSaveCall={handleSaveCall}
        onCallStateChange={presence.setCallState}
        onLogout={handleLogout}
        currentProfile={currentProfile}
        onOpenAdmin={openAdmin}
        onOpenMyPage={openMyPage}
      />
    </>;
  }

  if (selectedList) {
    return <>
      {banner}
      {sessionNotice}
      <CustomerListPage
        selectedList={selectedList}
        customers={customers}
        currentUserId={userId}
        presenceByCustomer={presence.presenceByCustomer}
        onBack={async () => {
          scrollPageTop();
          await presence.clearCustomer();
          setSelectedList(null);
        }}
        onGoLists={goToLists}
        onOpenCustomer={openCustomer}
        onLogout={handleLogout}
        currentProfile={currentProfile}
        onOpenAdmin={openAdmin}
        onOpenMyPage={openMyPage}
      />
    </>;
  }

  return <>
    {banner}
    {sessionNotice}
    {dataLoading && <div className="data-loading">データ読込中...</div>}
    <ListPage onGoLists={goToLists} lists={lists} tasks={tasks} onOpenTask={openTaskCustomer} onSearchCustomers={searchCustomersAcrossLists} onLogout={handleLogout} onOpenCall={openList} currentProfile={currentProfile} onOpenAdmin={openAdmin} onOpenMyPage={openMyPage} />
  </>;
}
