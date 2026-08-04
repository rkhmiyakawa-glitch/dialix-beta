import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import ShiftCalendarEditor from "../components/ShiftCalendarEditor";
import { clockIn, clockOut, fetchMyAttendance, fetchMyShifts, saveShifts, submitAttendanceCorrectionRequest, fetchMyAttendanceCorrectionRequests } from "../services/attendanceService";

const monthNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
const dateNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const fmtTime = (value) => value ? new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }) : "--:--";

export default function AttendancePage({ currentProfile, onGoLists, onLogout, onOpenAdmin, onOpenMyPage, overdueReminderCount }) {
  const [month, setMonth] = useState(monthNow);
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [requests, setRequests] = useState([]);
  const [requestForm, setRequestForm] = useState({ workDate: dateNow(), clockIn: "", clockOut: "", reasonType: "出勤押し忘れ", reasonDetail: "" });
  const [requestSaving, setRequestSaving] = useState(false);
  const userId = currentProfile?.id;
  const today = dateNow();
  const todayRecord = useMemo(() => records.find((item) => item.work_date === today), [records, today]);
  const todayShift = useMemo(() => shifts.find((item) => item.shift_date === today), [shifts, today]);
  const missedClockIn = useMemo(() => {
    if (!todayShift || todayShift.is_off || todayRecord?.clock_in || !todayShift.start_time) return false;
    return now > new Date(`${today}T${todayShift.start_time}+09:00`).getTime();
  }, [todayShift, todayRecord, today, now]);

  async function reload() {
    if (!userId) return;
    setLoading(true); setError("");
    try {
      const [nextRecords, nextShifts, nextRequests] = await Promise.all([fetchMyAttendance(userId, month), fetchMyShifts(userId, month), fetchMyAttendanceCorrectionRequests(userId)]);
      setRecords(nextRecords); setShifts(nextShifts); setRequests(nextRequests);
    } catch (e) { setError(e.message || "勤怠データを取得できませんでした。SQLの適用状況を確認してください。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [userId, month]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);

  async function handleClockIn() { try { await clockIn(userId); await reload(); window.dispatchEvent(new CustomEvent("dialix:attendance-updated")); } catch (e) { setError(e.message || "出勤登録に失敗しました。"); } }
  async function handleClockOut() { try { await clockOut(userId); await reload(); window.dispatchEvent(new CustomEvent("dialix:attendance-updated")); } catch (e) { setError(e.message || "退勤登録に失敗しました。"); } }
  async function bulkSave(dates, settings) { try { await saveShifts(userId, dates, settings); await reload(); } catch(e) { setError(e.message || "シフト登録に失敗しました。"); throw e; } }
  async function submitCorrection(e) {
    e.preventDefault();
    if (!requestForm.workDate || (!requestForm.clockIn && !requestForm.clockOut)) return window.alert("修正する日付と時刻を入力してください。");
    setRequestSaving(true); setError("");
    try {
      const toIso = (date, time) => time ? new Date(`${date}T${time}:00+09:00`).toISOString() : null;
      await submitAttendanceCorrectionRequest({ userId, workDate: requestForm.workDate, clockIn: toIso(requestForm.workDate, requestForm.clockIn), clockOut: toIso(requestForm.workDate, requestForm.clockOut), reasonType: requestForm.reasonType, reasonDetail: requestForm.reasonDetail });
      setRequestForm({ workDate: dateNow(), clockIn: "", clockOut: "", reasonType: "出勤押し忘れ", reasonDetail: "" });
      await reload(); window.alert("勤怠修正依頼を送信しました。");
    } catch (e) { setError(e.message || "勤怠修正依頼に失敗しました。"); }
    finally { setRequestSaving(false); }
  }

  return <main className="app-page">
    <Header currentProfile={currentProfile} onGoLists={onGoLists} onLogout={onLogout} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle="勤怠" overdueReminderCount={overdueReminderCount} />
    <section className="content">
      <div className="page-title"><div><p className="eyebrow">ATTENDANCE</p><h1>勤怠</h1><p>出退勤の登録と、自分のシフト登録・確認ができます。</p></div></div>
      {error && <div className="admin-error">{error}</div>}
      <section className="simple-panel"><div className="admin-panel-head"><div><h2>シフト登録・確認</h2><p>カレンダーで日付を選び、右側から出退勤・シフト登録を操作できます。</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        {loading ? <div className="empty-state">読み込み中...</div> : <ShiftCalendarEditor month={month} shifts={shifts} onBulkSave={bulkSave} />}
      </section>

      <section className="simple-panel attendance-correction-panel"><div className="admin-panel-head"><div><h2>勤怠修正依頼</h2><p>打刻忘れや時刻間違いがある場合は、管理者へ修正を依頼してください。</p></div></div>
        <form className="attendance-correction-form" onSubmit={submitCorrection}>
          <label>対象日<input type="date" value={requestForm.workDate} onChange={(e)=>setRequestForm({...requestForm,workDate:e.target.value})} /></label>
          <label>希望出勤時刻<input type="time" value={requestForm.clockIn} onChange={(e)=>setRequestForm({...requestForm,clockIn:e.target.value})} /></label>
          <label>希望退勤時刻<input type="time" value={requestForm.clockOut} onChange={(e)=>setRequestForm({...requestForm,clockOut:e.target.value})} /></label>
          <label>理由<select value={requestForm.reasonType} onChange={(e)=>setRequestForm({...requestForm,reasonType:e.target.value})}><option>出勤押し忘れ</option><option>退勤押し忘れ</option><option>時間修正</option><option>その他</option></select></label>
          <label className="attendance-correction-detail">詳細<input value={requestForm.reasonDetail} onChange={(e)=>setRequestForm({...requestForm,reasonDetail:e.target.value})} placeholder="状況を入力してください" /></label>
          <button className="primary-button" type="submit" disabled={requestSaving}>{requestSaving ? "依頼中..." : "修正依頼を送信"}</button>
        </form>
        {requests.length > 0 && <div className="table-scroll"><table className="admin-table"><thead><tr><th>依頼日</th><th>対象日</th><th>内容</th><th>理由</th><th>状態</th></tr></thead><tbody>{requests.map((r)=><tr key={r.id}><td>{new Date(r.created_at).toLocaleString("ja-JP")}</td><td>{r.work_date}</td><td>{fmtTime(r.requested_clock_in)}〜{fmtTime(r.requested_clock_out)}</td><td>{r.reason_type}{r.reason_detail ? `：${r.reason_detail}` : ""}</td><td><span className={`request-status ${r.status}`}>{({pending:"依頼中",approved:"承認",rejected:"却下"})[r.status] || r.status}</span></td></tr>)}</tbody></table></div>}
      </section>
      <section className="simple-panel"><h2>勤怠履歴</h2>{records.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>日付</th><th>出勤</th><th>退勤</th></tr></thead><tbody>{records.map((r) => <tr key={r.id}><td>{r.work_date}</td><td>{fmtTime(r.clock_in)}</td><td>{fmtTime(r.clock_out)}</td></tr>)}</tbody></table></div> : <div className="empty-state">勤怠履歴はありません。</div>}</section>
    </section>
  </main>;
}
