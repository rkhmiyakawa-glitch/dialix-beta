import { useCallback, useEffect, useMemo, useState } from "react";
import { clockIn, clockOut, fetchMyAttendance, fetchMyShifts } from "../services/attendanceService";

function emitNavigation(destination) {
  window.dispatchEvent(new CustomEvent("dialix:navigate", { detail: destination }));
}

const tokyoDate = (date = new Date()) => date.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const tokyoMonth = (date = new Date()) => tokyoDate(date).slice(0, 7);
const formatClock = (value) => value ? new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }) : "--:--";

function SidebarAttendance({ currentProfile }) {
  const userId = currentProfile?.id;
  const [now, setNow] = useState(new Date());
  const [shift, setShift] = useState(null);
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const today = tokyoDate(now);
  const month = tokyoMonth(now);

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const [shifts, records] = await Promise.all([
        fetchMyShifts(userId, month),
        fetchMyAttendance(userId, month),
      ]);
      setShift(shifts.find((item) => item.shift_date === today) || null);
      setRecord(records.find((item) => item.work_date === today) || null);
      setError("");
    } catch (e) {
      setError(e.message || "勤怠情報を取得できませんでした。");
    }
  }, [userId, month, today]);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const handleRefresh = () => reload();
    window.addEventListener("dialix:attendance-updated", handleRefresh);
    return () => window.removeEventListener("dialix:attendance-updated", handleRefresh);
  }, [reload]);

  const state = useMemo(() => {
    if (shift?.is_off) return { key: "off", label: "本日は休日です" };
    if (record?.clock_out) return { key: "done", label: "勤務終了" };
    if (record?.clock_in) {
      if (shift?.end_time) {
        const endAt = new Date(`${today}T${shift.end_time}+09:00`).getTime();
        if (now.getTime() > endAt) return { key: "missed-out", label: "退勤打刻をしてください" };
      }
      return { key: "working", label: "勤務中" };
    }
    if (shift?.start_time) {
      const startAt = new Date(`${today}T${shift.start_time}+09:00`).getTime();
      if (now.getTime() > startAt) return { key: "missed-in", label: "出勤打刻をしてください" };
    }
    return { key: "before", label: shift ? "勤務前" : "シフト未登録" };
  }, [shift, record, today, now]);

  async function handleClockIn() {
    if (!userId || loading) return;
    setLoading(true); setError("");
    try {
      await clockIn(userId);
      await reload();
      window.dispatchEvent(new CustomEvent("dialix:attendance-updated"));
    } catch (e) { setError(e.message || "出勤登録に失敗しました。"); }
    finally { setLoading(false); }
  }

  async function handleClockOut() {
    if (!userId || loading) return;
    setLoading(true); setError("");
    try {
      await clockOut(userId);
      await reload();
      window.dispatchEvent(new CustomEvent("dialix:attendance-updated"));
    } catch (e) { setError(e.message || "退勤登録に失敗しました。"); }
    finally { setLoading(false); }
  }

  const dateLabel = now.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" });
  const timeLabel = now.toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const shiftLabel = shift ? (shift.is_off ? "休日" : `${shift.start_time?.slice(0, 5) || "--:--"} ～ ${shift.end_time?.slice(0, 5) || "--:--"}`) : "未登録";

  return (
    <section className={`sidebar-attendance sidebar-attendance-${state.key}`} aria-label="本日の勤怠">
      <div className="sidebar-attendance-block">
        <span className="sidebar-attendance-label">現在日時</span>
        <strong>{dateLabel}</strong>
        <b className="sidebar-current-time">{timeLabel}</b>
      </div>
      <div className="sidebar-attendance-block">
        <span className="sidebar-attendance-label">今日のシフト</span>
        <strong>{shiftLabel}</strong>
      </div>
      <div className={`sidebar-work-status ${state.key}`}>
        <span className="sidebar-status-dot" />
        <strong>{state.label}</strong>
      </div>
      {(state.key === "missed-in" || state.key === "missed-out") && (
        <div className="sidebar-attendance-alert">⚠ {state.label}</div>
      )}
      <div className="sidebar-clock-summary">
        <span>出勤 <b>{formatClock(record?.clock_in)}</b></span>
        <span>退勤 <b>{formatClock(record?.clock_out)}</b></span>
      </div>
      <div className="sidebar-attendance-actions">
        <button type="button" className="clock-in" onClick={handleClockIn} disabled={loading || Boolean(record?.clock_in) || shift?.is_off}>出勤</button>
        <button type="button" className="clock-out" onClick={handleClockOut} disabled={loading || !record?.clock_in || Boolean(record?.clock_out)}>退勤</button>
      </div>
      {error && <small className="sidebar-attendance-error">{error}</small>}
    </section>
  );
}

export default function Header({ onLogout, onGoLists, currentProfile, onOpenAdmin, onOpenMyPage, pageTitle = "DIALIX" }) {
  const normalizedRole = String(currentProfile?.role || "").trim().toLowerCase();
  const canOpenAdmin = ["owner", "admin", "sv", "supervisor", "管理者", "オーナー"].includes(normalizedRole);
  const displayName = currentProfile?.displayName || "マイページ";

  async function goLists() {
    await onGoLists?.();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  return (
    <>
      <aside className="app-sidebar" aria-label="メインメニュー">
        <button className="sidebar-brand" type="button" onClick={goLists} aria-label="リスト一覧へ戻る">
          <span className="sidebar-brand-mark">D</span>
          <strong>DIALIX</strong>
        </button>

        <nav className="sidebar-nav">
          <button type="button" onClick={onOpenMyPage}>
            <span className="sidebar-icon">👤</span><span>{displayName}</span>
          </button>
          <button type="button" onClick={() => emitNavigation("attendance")}>
            <span className="sidebar-icon">◷</span><span>勤怠</span>
          </button>
          <button type="button" onClick={goLists}>
            <span className="sidebar-icon">☷</span><span>リスト一覧</span>
          </button>
          <button type="button" onClick={() => emitNavigation("today-reminders")}>
            <span className="sidebar-icon">⏰</span><span>本日のリマインド</span>
          </button>
          <button type="button" onClick={() => emitNavigation("reminders")}>
            <span className="sidebar-icon">✓</span><span>リマインド一覧</span>
          </button>
          <button type="button" onClick={() => emitNavigation("links")}>
            <span className="sidebar-icon">↗</span><span>リンク</span>
          </button>
          {canOpenAdmin && onOpenAdmin && (
            <button type="button" onClick={onOpenAdmin}>
              <span className="sidebar-icon">⚙</span><span>管理画面</span>
            </button>
          )}
        </nav>

        <div className="sidebar-bottom-area">
          <SidebarAttendance currentProfile={currentProfile} />
          <button className="sidebar-logout" type="button" onClick={onLogout}>
            <span className="sidebar-icon">⇥</span><span>ログアウト</span>
          </button>
        </div>
      </aside>

      <header className="app-header sidebar-header">
        <div className="header-left">
          <div className="topbar-breadcrumb"><button type="button" onClick={goLists}>リスト一覧</button><span>›</span><strong>{pageTitle}</strong></div>
        </div>
      </header>
    </>
  );
}
