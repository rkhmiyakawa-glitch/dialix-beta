import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import ShiftCalendarEditor from "../components/ShiftCalendarEditor";
import { clockIn, clockOut, fetchMyAttendance, fetchMyShifts, saveShifts } from "../services/attendanceService";

const monthNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
const dateNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const fmtTime = (value) => value ? new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }) : "--:--";

export default function AttendancePage({ currentProfile, onGoLists, onLogout, onOpenAdmin, onOpenMyPage }) {
  const [month, setMonth] = useState(monthNow);
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
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
      const [nextRecords, nextShifts] = await Promise.all([fetchMyAttendance(userId, month), fetchMyShifts(userId, month)]);
      setRecords(nextRecords); setShifts(nextShifts);
    } catch (e) { setError(e.message || "勤怠データを取得できませんでした。SQLの適用状況を確認してください。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [userId, month]);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);

  async function handleClockIn() { try { await clockIn(userId); await reload(); } catch (e) { setError(e.message || "出勤登録に失敗しました。"); } }
  async function handleClockOut() { try { await clockOut(userId); await reload(); } catch (e) { setError(e.message || "退勤登録に失敗しました。"); } }
  async function bulkSave(dates, settings) { try { await saveShifts(userId, dates, settings); await reload(); } catch(e) { setError(e.message || "シフト登録に失敗しました。"); throw e; } }

  return <main className="app-page">
    <Header currentProfile={currentProfile} onGoLists={onGoLists} onLogout={onLogout} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle="勤怠" />
    <section className="content">
      <div className="page-title"><div><p className="eyebrow">ATTENDANCE</p><h1>勤怠</h1><p>出退勤の登録と、自分のシフト登録・確認ができます。</p></div></div>
      {error && <div className="admin-error">{error}</div>}
      {missedClockIn && <div className="attendance-alert"><strong>出勤打刻が必要です</strong><span>本日の勤務開始時刻（{todayShift.start_time?.slice(0,5)}）を過ぎています。出勤ボタンを押してください。</span></div>}
      <section className={`attendance-card ${missedClockIn ? "attendance-card-alert" : ""}`}>
        <div><span>本日</span><strong>{today}</strong><small>{todayShift ? (todayShift.is_off ? "休み" : `シフト ${todayShift.start_time?.slice(0,5)}〜${todayShift.end_time?.slice(0,5)}`) : "シフト未登録"}</small></div>
        <div className="attendance-times"><span>出勤 <b>{fmtTime(todayRecord?.clock_in)}</b></span><span>退勤 <b>{fmtTime(todayRecord?.clock_out)}</b></span></div>
        <div className="attendance-actions"><button type="button" onClick={handleClockIn} disabled={loading || Boolean(todayRecord?.clock_in)}>出勤</button><button type="button" onClick={handleClockOut} disabled={loading || !todayRecord?.clock_in || Boolean(todayRecord?.clock_out)}>退勤</button></div>
      </section>
      <section className="simple-panel"><div className="admin-panel-head"><div><h2>シフト登録・確認</h2><p>複数日をまとめて選択できます。1日だけ選択すれば変則時間も登録できます。</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        {loading ? <div className="empty-state">読み込み中...</div> : <ShiftCalendarEditor month={month} shifts={shifts} onBulkSave={bulkSave} />}
      </section>
      <section className="simple-panel"><h2>勤怠履歴</h2>{records.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>日付</th><th>出勤</th><th>退勤</th></tr></thead><tbody>{records.map((r) => <tr key={r.id}><td>{r.work_date}</td><td>{fmtTime(r.clock_in)}</td><td>{fmtTime(r.clock_out)}</td></tr>)}</tbody></table></div> : <div className="empty-state">勤怠履歴はありません。</div>}</section>
    </section>
  </main>;
}
