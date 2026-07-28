import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { clockIn, clockOut, fetchMyAttendance, fetchMyShifts } from "../services/attendanceService";

const monthNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
const dateNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const fmtTime = (value) => value ? new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo" }) : "--:--";

export default function AttendancePage({ currentProfile, onGoLists, onLogout, onOpenAdmin, onOpenMyPage }) {
  const [month, setMonth] = useState(monthNow);
  const [records, setRecords] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const userId = currentProfile?.id;
  const today = dateNow();
  const todayRecord = useMemo(() => records.find((item) => item.work_date === today), [records, today]);
  const todayShift = useMemo(() => shifts.find((item) => item.shift_date === today), [shifts, today]);

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

  async function handleClockIn() { try { await clockIn(userId); await reload(); } catch (e) { setError(e.message || "出勤登録に失敗しました。"); } }
  async function handleClockOut() { try { await clockOut(userId); await reload(); } catch (e) { setError(e.message || "退勤登録に失敗しました。"); } }

  return <main className="app-page">
    <Header currentProfile={currentProfile} onGoLists={onGoLists} onLogout={onLogout} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle="勤怠" />
    <section className="content">
      <div className="page-title"><div><p className="eyebrow">ATTENDANCE</p><h1>勤怠</h1><p>出退勤の登録とシフト確認ができます。</p></div></div>
      {error && <div className="admin-error">{error}</div>}
      <section className="attendance-card">
        <div><span>本日</span><strong>{today}</strong><small>{todayShift ? (todayShift.is_off ? "休み" : `シフト ${todayShift.start_time?.slice(0,5)}〜${todayShift.end_time?.slice(0,5)}`) : "シフト未登録"}</small></div>
        <div className="attendance-times"><span>出勤 <b>{fmtTime(todayRecord?.clock_in)}</b></span><span>退勤 <b>{fmtTime(todayRecord?.clock_out)}</b></span></div>
        <div className="attendance-actions"><button type="button" onClick={handleClockIn} disabled={loading || Boolean(todayRecord?.clock_in)}>出勤</button><button type="button" onClick={handleClockOut} disabled={loading || !todayRecord?.clock_in || Boolean(todayRecord?.clock_out)}>退勤</button></div>
      </section>
      <section className="simple-panel"><div className="admin-panel-head"><h2>シフト確認</h2><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
        {loading ? <div className="empty-state">読み込み中...</div> : shifts.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>日付</th><th>予定</th><th>休憩</th><th>メモ</th></tr></thead><tbody>{shifts.map((s) => <tr key={s.id}><td>{s.shift_date}</td><td>{s.is_off ? "休み" : `${s.start_time?.slice(0,5)}〜${s.end_time?.slice(0,5)}`}</td><td>{s.is_off ? "―" : `${s.break_minutes || 0}分`}</td><td>{s.memo || "―"}</td></tr>)}</tbody></table></div> : <div className="empty-state">この月のシフトはありません。</div>}
      </section>
      <section className="simple-panel"><h2>勤怠履歴</h2>{records.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>日付</th><th>出勤</th><th>退勤</th></tr></thead><tbody>{records.map((r) => <tr key={r.id}><td>{r.work_date}</td><td>{fmtTime(r.clock_in)}</td><td>{fmtTime(r.clock_out)}</td></tr>)}</tbody></table></div> : <div className="empty-state">勤怠履歴はありません。</div>}</section>
    </section>
  </main>;
}
