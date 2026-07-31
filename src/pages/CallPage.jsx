import { useEffect, useState } from "react";
import Header from "../components/Header";
import Toast from "../components/Toast";
import CustomerLockModal from "../components/CustomerLockModal";
import KpiCards from "../components/KpiCards";
import CustomerInfoCard from "../components/CustomerInfoCard";
import StatusButtons from "../components/StatusButtons";
import MemoBox from "../components/MemoBox";
import LastContactCard from "../components/LastContactCard";
import HistoryTimeline from "../components/HistoryTimeline";
import useToast from "../hooks/useToast";
import { statuses } from "../data/sampleData";
import { fetchAssignableProfiles } from "../services/dataService";

export default function CallPage({
  selectedList,
  selectedCustomer,
  onBack,
  onGoLists,
  onLogout,
  onOpenNext,
  onOpenPrevious,
  navigationPosition,
  navigationTotal,
  navigationLabel,
  onSaveCall,
  kpi,
  lockedUsers = [],
  onCallStateChange,
  currentProfile,
  onOpenAdmin,
  onOpenMyPage,
  onUnsavedChange,
}) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [memo, setMemo] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [assignableProfiles, setAssignableProfiles] = useState([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [callState, setCallState] = useState("room");
  const { message, showToast } = useToast();

  useEffect(() => {
    let active = true;
    fetchAssignableProfiles()
      .then((profiles) => {
        if (active) setAssignableProfiles(profiles);
      })
      .catch(() => {
        if (active) setAssignableProfiles([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelectedCategory("");
    setSelectedStatus("");
    setMemo("");
    setReminderDate("");
    setReminderTime("");
    setSelectedAssigneeId("");
    setIsDirty(false);
    setIsSaving(false);
    setCallState("room");
    onCallStateChange?.("room");
  }, [selectedCustomer.id]);

  useEffect(() => {
    function beforeUnload(event) {
      if (!isDirty || isSaving) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty, isSaving]);

  useEffect(() => {
    onUnsavedChange?.(isDirty && !isSaving);
    return () => onUnsavedChange?.(false);
  }, [isDirty, isSaving, onUnsavedChange]);

  function markDirty(callback) {
    return (value) => {
      callback(value);
      setIsDirty(true);
    };
  }

  function handleSelectCategory(category) {
    const directStatuses = ["留守", "対象外", "現アナ", "再コール", "再コール留守", "見込み留守", "トスアップ", "前確依頼", "前確OK", "前確NG"];
    const hasReminder = category === "見込み" || category === "見込み留守" || category === "前確依頼";

    setSelectedCategory(category);
    setSelectedStatus(directStatuses.includes(category) ? category : "");

    if (!hasReminder) {
      setReminderDate("");
      setReminderTime("");
    }
    if (category !== "前確依頼") setSelectedAssigneeId("");

    setIsDirty(true);
  }

  function handleClearStatus() {
    setSelectedCategory("");
    setSelectedStatus("");
    setReminderDate("");
    setReminderTime("");
    setSelectedAssigneeId("");
    setIsDirty(true);
  }

  async function handleSave() {
    if (isSaving || !isDirty) return;
    if (!selectedStatus) {
      window.alert("コールステータスを選択してください");
      return;
    }

    setIsSaving(true);
    try {
      await onSaveCall({
        customerId: selectedCustomer.id,
        status: selectedStatus,
        memo,
        reminderDate,
        reminderTime,
        reminderAssignee: assignableProfiles.find((profile) => profile.id === selectedAssigneeId) || null,
      });

      setIsDirty(false);
      setCallState("room");
      onCallStateChange?.("room");

      showToast("保存しました。");
    } catch (error) {
      window.alert(error.message || "保存に失敗しました。通信状態を確認して、もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }


  async function handleNavigate(direction) {
    if (isSaving) return;
    if (isDirty && !window.confirm("保存されていない内容があります。破棄して移動しますか？")) return;
    if (direction === "previous") onOpenPrevious?.();
    else onOpenNext?.();
  }

  function handleBack() {
    if (isSaving) return;
    if (isDirty && !window.confirm("保存されていない内容があります。破棄して戻りますか？")) return;
    onBack();
  }

  function handleZoomCall(phoneValue = selectedCustomer.phone) {
    if (isSaving) return;
    const phone = String(phoneValue || "").replace(/[^0-9+]/g, "");
    if (!phone) {
      window.alert("電話番号が登録されていません。");
      return;
    }
    setCallState("calling");
    onCallStateChange?.("calling");
    showToast("電話アプリを起動します。Zoom Phoneを既定の通話アプリに設定してください。");
    window.location.href = `tel:${phone}`;
  }

  async function handleCopyField(value, label) {
    const copyValue = String(value || "").trim();
    if (!copyValue) {
      window.alert(`${label}が登録されていません。`);
      return;
    }
    try {
      await navigator.clipboard.writeText(copyValue);
      showToast(`${label}をコピーしました。`);
    } catch {
      window.prompt(`${label}をコピーしてください。`, copyValue);
    }
  }

  return (
    <main className="app-page">
      <CustomerLockModal customerName={selectedCustomer.companyName} lockedUsers={lockedUsers} onClose={onBack} />
      <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle={`${selectedList.name} / 顧客詳細`} />
      <Toast message={message} />

      <section className="content call-content">
        <div className="call-toolbar">
          <button className="back-button" type="button" onClick={handleBack} disabled={isSaving}>← 顧客一覧へ</button>
          <div className="call-progress">
            <span>リスト：{selectedList.name}</span>
            <strong>{navigationLabel === "検索結果" ? "検索結果 " : ""}{navigationPosition} / {navigationTotal}</strong>
          </div>
        </div>
        <KpiCards items={kpi} />
        <div className="call-layout call-layout-v112">
          <div className="call-stack call-stack-left">
            <section className="call-column customer-column-v106">
              <CustomerInfoCard
                customer={selectedCustomer}
                callState={callState}
                onZoomCall={handleZoomCall}
                onCopyField={handleCopyField}
                isSaving={isSaving}
              />
            </section>

            <section className="call-column memo-column-v106">
              <MemoBox value={memo} onChange={markDirty(setMemo)} disabled={isSaving} />
            </section>

            <section className="call-column history-column-v106">
              <HistoryTimeline history={selectedCustomer.history || []} />
            </section>
          </div>

          <div className="call-stack call-stack-right">
            <section className="call-column last-contact-column-v106">
              <LastContactCard lastContact={{ at: selectedCustomer.lastCallAt || "未対応", ap: selectedCustomer.status || selectedCustomer.history?.length ? (selectedCustomer.ap || "") : "", status: selectedCustomer.status || "未架電" }} />
            </section>

            <section className="call-column status-column-v106">
              <StatusButtons
                statuses={statuses}
                selectedCategory={selectedCategory}
                selectedStatus={selectedStatus}
                onSelectCategory={handleSelectCategory}
                onSelectStatus={markDirty(setSelectedStatus)}
                onClearStatus={handleClearStatus}
                disabled={isSaving}
                reminderDate={reminderDate}
                reminderTime={reminderTime}
                onReminderDateChange={markDirty(setReminderDate)}
                onReminderTimeChange={markDirty(setReminderTime)}
                assignableProfiles={assignableProfiles}
                selectedAssigneeId={selectedAssigneeId}
                onAssigneeChange={markDirty(setSelectedAssigneeId)}
                onSave={handleSave}
                isDirty={isDirty}
                isSaving={isSaving}
              />
            </section>
          </div>
        </div>
        <nav className="customer-edge-navigation" aria-label="顧客の前後移動">
          <button
            className="back-button"
            type="button"
            onClick={() => handleNavigate("previous")}
            disabled={isSaving || navigationPosition <= 1}
          >
            ← 前の顧客
          </button>
          <button
            className="back-button"
            type="button"
            onClick={() => handleNavigate("next")}
            disabled={isSaving || navigationPosition >= navigationTotal}
          >
            次の顧客 →
          </button>
        </nav>
      </section>
    </main>
  );
}
