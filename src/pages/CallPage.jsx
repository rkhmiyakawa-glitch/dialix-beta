import { useEffect, useState } from "react";
import Header from "../components/Header";
import Toast from "../components/Toast";
import CustomerLockModal from "../components/CustomerLockModal";
import KpiCards from "../components/KpiCards";
import CustomerInfoCard from "../components/CustomerInfoCard";
import StatusButtons from "../components/StatusButtons";
import MemoBox from "../components/MemoBox";
import SaveBar from "../components/SaveBar";
import LastContactCard from "../components/LastContactCard";
import HistoryTimeline from "../components/HistoryTimeline";
import useToast from "../hooks/useToast";
import { statuses } from "../data/sampleData";

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
}) {
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [memo, setMemo] = useState("");
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [callState, setCallState] = useState("room");
  const { message, showToast } = useToast();

  useEffect(() => {
    setSelectedCategory("");
    setSelectedStatus("");
    setMemo("");
    setReminderDate("");
    setReminderTime("");
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

  function markDirty(callback) {
    return (value) => {
      callback(value);
      setIsDirty(true);
    };
  }

  function handleSelectCategory(category) {
    const directStatuses = ["留守", "再コール", "再コール留守", "見込み留守", "トスアップ"];
    const isProspectCategory = category === "見込み" || category === "見込み留守";

    setSelectedCategory(category);
    setSelectedStatus(directStatuses.includes(category) ? category : "");

    if (!isProspectCategory) {
      setReminderDate("");
      setReminderTime("");
    }

    setIsDirty(true);
  }

  function handleClearStatus() {
    setSelectedCategory("");
    setSelectedStatus("");
    setReminderDate("");
    setReminderTime("");
    setIsDirty(true);
  }

  async function handleSave(moveNext = false) {
    if (isSaving) return;
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
      });

      setIsDirty(false);
      setCallState("room");
      await onCallStateChange?.("room");

      if (moveNext && onOpenNext) {
        showToast("保存しました。次の顧客を開きます。");
        await onOpenNext();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        showToast("保存しました。");
      }
    } catch (error) {
      window.alert(error.message || "保存に失敗しました。通信状態を確認して、もう一度お試しください。");
    } finally {
      setIsSaving(false);
    }
  }


  async function handleNavigate(direction) {
    if (isSaving) return;
    if (isDirty && !window.confirm("保存されていない内容があります。破棄して移動しますか？")) return;
    if (direction === "previous") await onOpenPrevious?.();
    else await onOpenNext?.();
  }

  function handleBack() {
    if (isSaving) return;
    if (isDirty && !window.confirm("保存されていない内容があります。破棄して戻りますか？")) return;
    onBack();
  }

  function handleZoomCall() {
    if (isSaving) return;
    const phone = String(selectedCustomer.phone || "").replace(/[^0-9+]/g, "");
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
      <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={onOpenAdmin} pageTitle={`${selectedList.name} / 顧客詳細`} />
      <Toast message={message} />

      <section className="content call-content">
        <KpiCards items={kpi} />
        <div className="call-toolbar">
          <button className="back-button" type="button" onClick={handleBack} disabled={isSaving}>← 顧客一覧へ</button>
          <div className="call-progress">
            <span>リスト：{selectedList.name}</span>
            <strong>{navigationLabel === "検索結果" ? "検索結果 " : ""}{navigationPosition} / {navigationTotal}</strong>
          </div>
        </div>
        <nav className="customer-navigation" aria-label="顧客移動">
          <button type="button" onClick={() => handleNavigate("previous")} disabled={isSaving || navigationPosition <= 1}>← 前の顧客</button>
          <span>{navigationLabel === "検索結果" ? "検索結果 " : ""}{navigationPosition} / {navigationTotal}</span>
          <button type="button" onClick={() => handleNavigate("next")} disabled={isSaving || navigationPosition >= navigationTotal}>次の顧客 →</button>
        </nav>

        <div className="call-layout call-layout-v110">
          <section className="call-column customer-column-v106">
            <CustomerInfoCard
              customer={selectedCustomer}
              callState={callState}
              onZoomCall={handleZoomCall}
              onCopyField={handleCopyField}
              isSaving={isSaving}
            />
          </section>

          <section className="call-column last-contact-column-v106">
            <LastContactCard lastContact={{ at: selectedCustomer.lastCallAt || "未対応", ap: selectedCustomer.ap || "―", status: selectedCustomer.status || "未架電" }} />
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
            />
          </section>

          <section className="call-column memo-column-v106">
            <MemoBox value={memo} onChange={markDirty(setMemo)} disabled={isSaving} />
          </section>

          <section className="call-column history-column-v106">
            <HistoryTimeline history={selectedCustomer.history || []} />
          </section>
        </div>
        <SaveBar onSave={() => handleSave(false)} onSaveAndNext={() => handleSave(true)} isSaving={isSaving} />
        <nav className="customer-navigation bottom" aria-label="顧客移動（下部）">
          <button type="button" onClick={() => handleNavigate("previous")} disabled={isSaving || navigationPosition <= 1}>← 前の顧客</button>
          <span>{navigationLabel === "検索結果" ? "検索結果 " : ""}{navigationPosition} / {navigationTotal}</span>
          <button type="button" onClick={() => handleNavigate("next")} disabled={isSaving || navigationPosition >= navigationTotal}>次の顧客 →</button>
        </nav>
      </section>
    </main>
  );
}
