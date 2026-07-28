import { useEffect, useMemo, useState } from "react";
import ShiftCalendarEditor from "../components/ShiftCalendarEditor";
import { fetchProfiles } from "../services/profileService";
import { fetchAllAttendance, fetchAllShifts, saveShifts } from "../services/attendanceService";

const monthNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
const dateNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
const fmt = (v) => v ? new Date(v).toLocaleTimeString("ja-JP", { hour:"2-digit", minute:"2-digit", timeZone:"Asia/Tokyo" }) : "--:--";

export default function ShiftManagementPanel({ currentProfile }) {
  const canManage = ["owner", "admin"].includes(String(currentProfile?.role || "").toLowerCase());
  const [month, setMonth] = useState(monthNow);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [now, setNow] = useState(Date.now());
  const today = dateNow();
  const selectedShifts = useMemo(() => shifts.filter((s) => s.user_id === selectedUserId), [shifts, selectedUserId]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const todayRows = useMemo(() => users.map((u) => {
    const shift = shifts.find((s) => s.user_id === u.id && s.shift_date === today);
    const record = attendance.find((a) => a.user_id === u.id && a.work_date === today);
    let status = "no-shift";
    if (shift?.is_off) status = "off";
    else if (record?.clock_out) status = "done";
    else if (record?.clock_in) status = "working";
    else if (shift?.start_time && now > new Date(`${today}T${shift.start_time}+09:00`).getTime()) status = "late";
    else if (shift) status = "before";
    return { user:u, shift, record, status };
  }), [users, shifts, attendance, today, now]);
  const filteredRows = todayRows.filter((r) => filter === "all" || r.status === filter);
  const lateRows = todayRows.filter((r) => r.status === "late");

  async function reload() {
    setLoading(true); setError("");
    try {
      const [nextUsers, nextShifts, nextAttendance] = await Promise.all([fetchProfiles(), fetchAllShifts(month), fetchAllAttendance(month)]);
      const activeUsers = nextUsers.filter((u) => u.isActive);
      setUsers(activeUsers); setShifts(nextShifts); setAttendance(nextAttendance);
      setSelectedUserId((current) => current || activeUsers[0]?.id || "");
    } catch (e) { setError(e.message || "シフトを取得できませんでした。SQLの適用状況を確認してください。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [month]);
  useEffect(() => { const timer = setInterval(() => { setNow(Date.now()); reload(); }, 60000); return () => clearInterval(timer); }, [month]);

  async function bulkSave(dates, settings) {
    if (!canManage || !selectedUserId) return;
    try { await saveShifts(selectedUserId, dates, settings); await reload(); }
    catch(e) { setError(e.message || "シフト登録に失敗しました。"); throw e; }
  }

  const counts = {
    scheduled: todayRows.filter((r) => r.shift && !r.shift.is_off).length,
    working: todayRows.filter((r) => r.status === "working").length,
    late: lateRows.length,
    done: todayRows.filter((r) => r.status === "done").length,
    off: todayRows.filter((r) => r.status === "off").length,
  };

  return <section className="admin-panel shift-management-panel">
    <div className="admin-panel-head"><div><h2>シフト管理</h2><p>全員のシフトと本日の出勤状況を確認し、APごとにまとめて登録できます。</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
    {error && <div className="admin-error">{error}</div>}
    {lateRows.length > 0 && <div className="attendance-alert"><strong>未出勤アラート（{lateRows.length}名）</strong><span>{lateRows.map((r) => `${r.user.displayName || r.user.email}（${r.shift.start_time?.slice(0,5)}開始）`).join("、")}</span></div>}

    <section className="today-shift-dashboard">
      <div className="today-shift-head"><div><h3>本日の出勤状況</h3><p>{today}</p></div><div className="shift-status-filters">
        <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>全員</button>
        <button className={filter === "working" ? "active" : ""} onClick={() => setFilter("working")}>出勤中</button>
        <button className={filter === "late" ? "active" : ""} onClick={() => setFilter("late")}>未出勤</button>
        <button className={filter === "done" ? "active" : ""} onClick={() => setFilter("done")}>退勤済み</button>
      </div></div>
      <div className="shift-summary-cards">
        <div><span>出勤予定</span><strong>{counts.scheduled}</strong></div><div><span>出勤中</span><strong>{counts.working}</strong></div><div className={counts.late ? "danger" : ""}><span>未出勤</span><strong>{counts.late}</strong></div><div><span>退勤済み</span><strong>{counts.done}</strong></div><div><span>休み</span><strong>{counts.off}</strong></div>
      </div>
      <div className="table-scroll"><table className="admin-table today-shift-table"><thead><tr><th>AP</th><th>シフト</th><th>出勤</th><th>退勤</th><th>状態</th></tr></thead><tbody>{filteredRows.map((r) => <tr key={r.user.id} className={r.status === "late" ? "late-row" : ""}><td>{r.user.displayName || r.user.email}</td><td>{!r.shift ? "未登録" : r.shift.is_off ? "休み" : `${r.shift.start_time?.slice(0,5)}〜${r.shift.end_time?.slice(0,5)}`}</td><td>{fmt(r.record?.clock_in)}</td><td>{fmt(r.record?.clock_out)}</td><td><span className={`shift-status ${r.status}`}>{({working:"出勤中",late:"未出勤",before:"勤務前",done:"退勤済み",off:"休み","no-shift":"未登録"})[r.status]}</span></td></tr>)}</tbody></table></div>
    </section>

    <section className="all-shifts-overview"><h3>全員の月間シフト一覧</h3><div className="table-scroll"><table className="admin-table monthly-shift-table"><thead><tr><th>日付</th><th>出勤者</th><th>人数</th></tr></thead><tbody>{Array.from({length:new Date(Number(month.slice(0,4)),Number(month.slice(5,7)),0).getDate()},(_,i)=>`${month}-${String(i+1).padStart(2,"0")}`).map((date) => { const rows=shifts.filter((s)=>s.shift_date===date&&!s.is_off); return <tr key={date}><td>{date}</td><td>{rows.length ? rows.map((s)=>`${userMap.get(s.user_id)?.displayName || userMap.get(s.user_id)?.email || "不明"} ${s.start_time?.slice(0,5)}〜${s.end_time?.slice(0,5)}`).join(" / ") : "—"}</td><td>{rows.length}名</td></tr>; })}</tbody></table></div></section>

    <div className="shift-user-selector"><label>登録・編集するAP<select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">選択してください</option>{users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></label></div>
    {loading ? <div className="empty-state">読み込み中...</div> : selectedUserId ? <ShiftCalendarEditor month={month} shifts={selectedShifts} onBulkSave={bulkSave} disabled={!canManage} /> : <div className="empty-state">APを選択してください。</div>}
  </section>;
}
