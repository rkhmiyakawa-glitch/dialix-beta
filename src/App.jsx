import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import LoginPage from "./pages/LoginPage";
import ListPage from "./pages/ListPage";
import CustomerListPage from "./pages/CustomerListPage";
import CallPage from "./pages/CallPage";

const AdminPage = lazy(() => import("./pages/AdminPage"));
const MyPage = lazy(() => import("./pages/MyPage"));
const AttendancePage = lazy(() => import("./pages/AttendancePage"));
const LinksPage = lazy(() => import("./pages/LinksPage"));
const ReminderListPage = lazy(() => import("./pages/ReminderListPage"));
import SystemBanner from "./components/SystemBanner";
import useAuth from "./hooks/useAuth";
import useCustomerPresence from "./hooks/useCustomerPresence";
import useDeploymentRefresh from "./hooks/useDeploymentRefresh";
import { fetchMyProfile, touchUserActivity } from "./services/profileService";
import { fetchCustomerDetails, fetchCustomers, fetchLists, fetchTodayKpi, saveCallResult } from "./services/dataService";
import { todayKpi as fallbackKpi } from "./data/sampleData";
import { fetchOperationalTasks, searchCustomersAcrossLists, subscribeOperationalTasks } from "./services/operationsService";

function scrollPageTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

const NAVIGATION_STORAGE_KEY = "dialix:navigation:v1";

function readSavedNavigation() {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(NAVIGATION_STORAGE_KEY) || "null");
    return saved && typeof saved === "object" ? saved : { page: "lists" };
  } catch {
    return { page: "lists" };
  }
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
  const [showAttendance, setShowAttendance] = useState(false);
  const [showLinks, setShowLinks] = useState(false);
  const [reminderPage, setReminderPage] = useState("");
  const [tasks, setTasks] = useState({ reminders: [], dueToday: [], allReminders: [], prospects: [], tossups: [] });
  const [pendingCustomerId, setPendingCustomerId] = useState("");
  const [navigationItems, setNavigationItems] = useState([]);
  const [navigationLabel, setNavigationLabel] = useState("リスト");
  const [navigationReady, setNavigationReady] = useState(false);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const taskRefreshTimerRef = useRef(null);
  const customerDetailCacheRef = useRef(new Map());
  const customerRequestIdRef = useRef(0);
  const savedNavigationRef = useRef(readSavedNavigation());

  const userId = session?.user?.id || "";
  const userName = currentProfile?.displayName || session?.user?.user_metadata?.display_name || session?.user?.email || "オペレーター";
  const presence = useCustomerPresence({ listId: selectedList?.id, userId, userName });
  const deploymentNavigationKey = [
    reminderPage,
    showAttendance,
    showLinks,
    showMyPage,
    showAdmin,
    selectedList?.id,
    selectedCustomer?.id,
  ].join(":");

  useDeploymentRefresh({ navigationKey: deploymentNavigationKey, hasUnsavedChanges });

  const lockedUsers = useMemo(
    () => selectedCustomer ? presence.getOtherUsers(selectedCustomer.id) : [],
    [selectedCustomer, presence.rows]
  );

  useLayoutEffect(() => {
    scrollPageTop();
  }, [selectedList?.id, selectedCustomer?.id, showAdmin, showMyPage, showAttendance, showLinks, reminderPage]);


  useEffect(() => {
    function handleNavigation(event) {
      const destination = event.detail;
      setShowAdmin(false);
      setShowMyPage(false);
      setShowAttendance(false);
      setShowLinks(false);
      setReminderPage("");
      presence.clearCustomer()?.catch?.(() => {});
      setSelectedCustomer(null);

      if (destination === "attendance") {
        setSelectedList(null);
        setCustomers([]);
        setShowAttendance(true);
      } else if (destination === "links") {
        setSelectedList(null);
        setCustomers([]);
        setShowLinks(true);
      } else if (destination === "today-reminders") {
        setSelectedList(null);
        setCustomers([]);
        setReminderPage("today");
      } else if (destination === "reminders") {
        setSelectedList(null);
        setCustomers([]);
        setReminderPage("all");
      }
      scrollPageTop();
    }
    window.addEventListener("dialix:navigate", handleNavigation);
    return () => window.removeEventListener("dialix:navigate", handleNavigation);
  }, [presence]);

  useEffect(() => {
    if (!session) return undefined;
    const touchIfVisible = () => {
      if (document.visibilityState === "visible") touchUserActivity().catch(() => {});
    };
    touchIfVisible();
    const timer = window.setInterval(touchIfVisible, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", touchIfVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", touchIfVisible);
    };
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
      .finally(() => {
        setDataLoading(false);
        setInitialDataReady(true);
      });
  }, [session]);

  useEffect(() => {
    if (!session || !initialDataReady || navigationReady) return;

    let cancelled = false;
    const saved = savedNavigationRef.current;

    async function restoreNavigation() {
      try {
        if (saved.page === "admin") setShowAdmin(true);
        else if (saved.page === "mypage") setShowMyPage(true);
        else if (saved.page === "attendance") setShowAttendance(true);
        else if (saved.page === "links") setShowLinks(true);
        else if (saved.page === "today-reminders") setReminderPage("today");
        else if (saved.page === "reminders") setReminderPage("all");
        else if ((saved.page === "list" || saved.page === "customer") && saved.listId) {
          const list = lists.find((item) => item.id === saved.listId);
          if (!list) return;
          const nextCustomers = await fetchCustomers(list.id);
          if (cancelled) return;
          setCustomers(nextCustomers);
          setSelectedList({ ...list, count: list.count || nextCustomers.length });

          if (saved.page === "customer" && saved.customerId) {
            const customer = nextCustomers.find((item) => item.id === saved.customerId);
            if (customer) {
              const detailedCustomer = await fetchCustomerDetails(customer.id).catch(() => null);
              if (cancelled) return;
              const restoredCustomer = detailedCustomer || customer;
              if (detailedCustomer) customerDetailCacheRef.current.set(customer.id, detailedCustomer);
              setSelectedCustomer(restoredCustomer);
              setNavigationItems(nextCustomers.map((item) => ({ id: item.id, listId: list.id })));
              presence.trackCustomer(customer.id)?.catch?.(() => {});
            }
          }
        }
      } finally {
        if (!cancelled) setNavigationReady(true);
      }
    }

    restoreNavigation();
    return () => { cancelled = true; };
  }, [session, initialDataReady, navigationReady, lists]);

  useEffect(() => {
    if (!navigationReady || !session) return;
    let page = "lists";
    if (reminderPage === "today") page = "today-reminders";
    else if (reminderPage === "all") page = "reminders";
    else if (showAttendance) page = "attendance";
    else if (showLinks) page = "links";
    else if (showMyPage) page = "mypage";
    else if (showAdmin) page = "admin";
    else if (selectedList && selectedCustomer) page = "customer";
    else if (selectedList) page = "list";

    window.sessionStorage.setItem(NAVIGATION_STORAGE_KEY, JSON.stringify({
      page,
      listId: selectedList?.id || "",
      customerId: selectedCustomer?.id || "",
    }));
  }, [navigationReady, session, reminderPage, showAttendance, showLinks, showMyPage, showAdmin, selectedList?.id, selectedCustomer?.id]);


  useEffect(() => {
    if (!session || !currentProfile) return undefined;
    const unsubscribe = subscribeOperationalTasks(() => {
      // CSV取込などの連続更新で再取得が多発しないよう、短時間の変更を1回にまとめる。
      window.clearTimeout(taskRefreshTimerRef.current);
      taskRefreshTimerRef.current = window.setTimeout(async () => {
        try {
          setTasks(await fetchOperationalTasks({
            userId: session.user?.id,
            displayName: currentProfile?.displayName,
            email: currentProfile?.email || session.user?.email,
          }));
        } catch { /* next manual refresh will recover */ }
      }, 500);
    });
    return () => {
      window.clearTimeout(taskRefreshTimerRef.current);
      unsubscribe();
    };
  }, [session, currentProfile]);

  async function openTaskCustomer(task, contextItems = [task], contextLabel = "リスト") {
    // リマインド専用ページ・管理画面などを閉じてから顧客画面へ遷移する。
    // 先に表示状態を解除しないと、selectedList / selectedCustomer が更新されても
    // 専用ページ側の return が優先され、案件を押しても画面が変わらない。
    setShowAdmin(false);
    setShowMyPage(false);
    setShowAttendance(false);
    setShowLinks(false);
    setReminderPage("");
    setNavigationItems(contextItems.map((item) => ({ id: item.id, listId: item.listId || task.listId })));
    setNavigationLabel(contextLabel);
    const list = lists.find((item) => item.id === task.listId) || { id: task.listId, name: task.listName, count: 0 };
    if (!list.id || !task.id) throw new Error("顧客の移動先情報が不足しています。");

    // 一覧全件の取得完了を待たず、押した顧客をすぐ画面へ渡す。
    // 詳細は openCustomer がIDで取得し、一覧は背後で更新する。
    const taskCustomer = {
      id: task.id,
      companyName: task.companyName || "顧客",
      phone: task.phone || "",
      address: task.address || "",
      businessSubcategory: task.businessSubcategory || "",
      ap: task.apName || "",
      status: task.status || "",
      reminderAt: task.reminderAt || "",
      history: [],
    };
    setCustomers([taskCustomer]);
    setSelectedList({ ...list, count: list.count || 1 });
    setPendingCustomerId(taskCustomer.id);

    fetchCustomers(list.id)
      .then((nextCustomers) => {
        setCustomers(nextCustomers);
        setSelectedList((current) => current?.id === list.id
          ? { ...current, count: list.count || nextCustomers.length }
          : current);
      })
      .catch((error) => setDataError(error.message || "顧客一覧の取得に失敗しました。"));
  }

  useEffect(() => {
    if (!pendingCustomerId || !selectedList || !customers.length) return;
    const customer = customers.find((item) => item.id === pendingCustomerId);
    if (!customer) return;
    setPendingCustomerId("");
    openCustomer(customer);
  }, [pendingCustomerId, selectedList, customers]);

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

  function prefetchCustomerDetails(customerId) {
    if (!customerId || customerDetailCacheRef.current.has(customerId)) return;
    fetchCustomerDetails(customerId)
      .then((detail) => {
        if (detail) customerDetailCacheRef.current.set(customerId, detail);
      })
      .catch(() => {});
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

    // 画面遷移を通信待ちにしない。キャッシュまたは一覧データを即時表示し、詳細は後から差し替える。
    const cached = customerDetailCacheRef.current.get(customer.id);
    setSelectedCustomer(cached || customer);
    presence.trackCustomer(customer.id)?.catch?.(() => {});

    const requestId = ++customerRequestIdRef.current;
    fetchCustomerDetails(customer.id)
      .then((detailedCustomer) => {
        if (!detailedCustomer) throw new Error("顧客が見つかりませんでした。");
        customerDetailCacheRef.current.set(customer.id, detailedCustomer);
        setCustomers((current) => current.map((item) => item.id === detailedCustomer.id ? detailedCustomer : item));
        if (customerRequestIdRef.current === requestId) setSelectedCustomer(detailedCustomer);
      })
      .catch((error) => setDataError(error.message || "顧客詳細の取得に失敗しました。"));

    const items = sequence || navigationItems;
    const index = items.findIndex((item) => item.id === customer.id);
    [items[index - 1], items[index + 1]].forEach((item) => item && prefetchCustomerDetails(item.id));
  }

  function closeCustomer() {
    scrollPageTop();
    presence.clearCustomer()?.catch?.(() => {});
    setSelectedCustomer(null);
  }

  async function goToLists() {
    // ロゴ・パンくず・各画面の「一覧へ戻る」は必ず同じ処理を通す。
    // 管理画面表示中でも先に管理画面を閉じ、リスト一覧へ確実に戻す。
    setShowAdmin(false);
    setShowMyPage(false);
    setShowAttendance(false);
    setShowLinks(false);
    setReminderPage("");
    scrollPageTop();
    presence.clearCustomer()?.catch?.(() => {});
    setSelectedCustomer(null);
    setSelectedList(null);
    setCustomers([]);
    setNavigationItems([]);
    window.requestAnimationFrame(scrollPageTop);
  }

  function openAdmin() {
    scrollPageTop();
    setShowMyPage(false);
    setShowAttendance(false);
    setShowLinks(false);
    setReminderPage("");
    setShowAdmin(true);
  }

  function openMyPage() {
    scrollPageTop();
    setShowAdmin(false);
    setShowAttendance(false);
    setShowLinks(false);
    setReminderPage("");
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
    setShowAttendance(false);
    setShowLinks(false);
    setReminderPage("");
    window.sessionStorage.removeItem(NAVIGATION_STORAGE_KEY);
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

    // 保存完了後は画面遷移を優先。表示は即時更新し、詳細・KPI・リマインドは裏で同期する。
    const savedAtLabel = new Date(result.savedAt).toLocaleString("ja-JP");
    const optimistic = {
      ...selectedCustomer,
      ap: userName,
      status: payload.status,
      lastCallAt: savedAtLabel,
      reminderAt: payload.reminderDate && payload.reminderTime
        ? new Date(`${payload.reminderDate}T${payload.reminderTime}`).toLocaleString("ja-JP")
        : "",
    };
    customerDetailCacheRef.current.set(payload.customerId, optimistic);
    setCustomers((current) => current.map((customer) => customer.id === payload.customerId ? optimistic : customer));
    setSelectedCustomer((current) => current?.id === payload.customerId ? optimistic : current);

    Promise.all([
      fetchCustomerDetails(payload.customerId),
      fetchTodayKpi(userId),
      fetchOperationalTasks({
        userId,
        displayName: currentProfile?.displayName || userName,
        email: currentProfile?.email || session?.user?.email,
      }),
    ]).then(([refreshedCustomer, nextKpi, nextTasks]) => {
      if (refreshedCustomer) {
        customerDetailCacheRef.current.set(payload.customerId, refreshedCustomer);
        setCustomers((current) => current.map((customer) => customer.id === payload.customerId ? refreshedCustomer : customer));
        setSelectedCustomer((current) => current?.id === payload.customerId ? refreshedCustomer : current);
      }
      setKpi(nextKpi);
      setTasks(nextTasks);
    }).catch(() => {});
    return result;
  }

  async function navigateCustomer(offset) {
    scrollPageTop();
    if (!selectedCustomer || !navigationItems.length) return;
    const currentIndex = navigationItems.findIndex((item) => item.id === selectedCustomer.id);
    const targetIndex = currentIndex + offset;
    if (targetIndex < 0 || targetIndex >= navigationItems.length) return;
    const target = navigationItems[targetIndex];

    presence.clearCustomer()?.catch?.(() => {});
    if (target.listId && target.listId !== selectedList?.id) {
      const list = lists.find((item) => item.id === target.listId) || { id: target.listId, name: "検索結果", count: 0 };
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
    openCustomer(next);
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
  if (!navigationReady) return <main className="loading-screen">画面を復元しています...</main>;

  const banner = <SystemBanner demoMode={demoMode} error={dataError} />;
  const sessionNotice = sessionState !== "ready" && (
    <div className={`session-warning ${sessionState}`}>
      {sessionState === "recovering" && "セッションを再確認しています…"}
      {sessionState === "offline" && <>通信を確認できません。<button type="button" onClick={recoverSession}>再接続</button></>}
      {sessionState === "expired" && <>セッションの有効期限が切れました。<button type="button" onClick={recoverSession}>再認証</button></>}
    </div>
  );



  if (reminderPage) {
    return <>
      {banner}
      {sessionNotice}
      <Suspense fallback={<main className="loading-screen">画面を読み込んでいます...</main>}>
        <ReminderListPage
          mode={reminderPage}
          tasks={tasks}
          currentProfile={currentProfile}
          onLogout={handleLogout}
          onGoLists={goToLists}
          onOpenAdmin={openAdmin}
          onOpenMyPage={openMyPage}
          onOpenTask={openTaskCustomer}
        />
      </Suspense>
    </>;
  }


  if (showAttendance) {
    return <>
      {banner}
      {sessionNotice}
      <Suspense fallback={<main className="loading-screen">画面を読み込んでいます...</main>}>
        <AttendancePage currentProfile={currentProfile} onGoLists={goToLists} onLogout={handleLogout} onOpenAdmin={openAdmin} onOpenMyPage={openMyPage} />
      </Suspense>
    </>;
  }

  if (showLinks) {
    return <>
      {banner}
      {sessionNotice}
      <Suspense fallback={<main className="loading-screen">画面を読み込んでいます...</main>}>
        <LinksPage currentProfile={currentProfile} onGoLists={goToLists} onLogout={handleLogout} onOpenAdmin={openAdmin} onOpenMyPage={openMyPage} />
      </Suspense>
    </>;
  }

  if (showMyPage) {
    return <>
      {banner}
      {sessionNotice}
      <Suspense fallback={<main className="loading-screen">画面を読み込んでいます...</main>}>
      <MyPage
        currentProfile={currentProfile || { displayName: userName, email: session?.user?.email || "", role: "operator", isActive: true }}
        onProfileUpdated={setCurrentProfile}
        onBack={closeMyPage}
        onGoLists={goToLists}
        onLogout={handleLogout}
        onOpenAdmin={openAdmin}
        onOpenMyPage={openMyPage}
      />
      </Suspense>
    </>;
  }

  const normalizedRole = String(currentProfile?.role || "").trim().toLowerCase();
  const canOpenAdmin = ["owner", "admin", "sv", "supervisor", "管理者", "オーナー"].includes(normalizedRole);

  if (showAdmin && currentProfile && canOpenAdmin) {
    return <>
      {banner}
      {sessionNotice}
      <Suspense fallback={<main className="loading-screen">管理画面を読み込んでいます...</main>}>
        <AdminPage currentProfile={currentProfile} onBack={closeAdmin} onGoLists={goToLists} onLogout={handleLogout} onOpenMyPage={openMyPage} onOpenOverdueCustomer={(item, items) => { setShowAdmin(false); openTaskCustomer(item, items, "期限超過一覧").catch((error) => setDataError(error.message || "顧客を開けませんでした。")); }} />
      </Suspense>
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
        onUnsavedChange={setHasUnsavedChanges}
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
