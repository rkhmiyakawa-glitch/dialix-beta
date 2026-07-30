import { useEffect, useMemo, useState } from "react";
import ShiftCalendarEditor from "../components/ShiftCalendarEditor";
import { fetchProfiles } from "../services/profileService";
import { fetchAllAttendance, fetchAllShifts, saveShifts, fetchAttendanceCorrectionRequests, resolveAttendanceCorrectionRequest, updateAttendanceRecordAsManager } from "../services/attendanceService";

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
  const [correctionRequests, setCorrectionRequests] = useState([]);
  const [editingAttendance, setEditingAttendance] = useState(null);
  const [requestFilter, setRequestFilter] = useState("pending");
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [overviewDate, setOverviewDate] = useState(dateNow());
  const today = dateNow();
  const selectedShifts = useMemo(() => shifts.filter((s) => s.user_id === selectedUserId), [shifts, selectedUserId]);
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const shiftByUserAndDate = useMemo(() => new Map(shifts.map((item) => [`${item.user_id}:${item.shift_date}`, item])), [shifts]);
  const attendanceByUserAndDate = useMemo(() => new Map(attendance.map((item) => [`${item.user_id}:${item.work_date}`, item])), [attendance]);
  const todayRows = useMemo(() => users.map((u) => {
    const shift = shiftByUserAndDate.get(`${u.id}:${today}`);
    const record = attendanceByUserAndDate.get(`${u.id}:${today}`);
    let status = "no-shift";
    if (shift?.is_off) status = "off";
    else if (record?.clock_out) status = "done";
    else if (record?.clock_in) status = "working";
    else if (shift?.start_time && now > new Date(`${today}T${shift.start_time}+09:00`).getTime()) status = "late";
    else if (shift) status = "before";
    return { user:u, shift, record, status };
  }), [users, shiftByUserAndDate, attendanceByUserAndDate, today, now]);
  const filteredRows = todayRows.filter((r) => filter === "all" || r.status === filter);
  const lateRows = todayRows.filter((r) => r.status === "late");
  const monthDates = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const days = new Date(year, monthNumber, 0).getDate();
    const leading = new Date(year, monthNumber - 1, 1).getDay();
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: days }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`),
    ];
  }, [month]);
  const selectedOverviewDate = overviewDate.startsWith(`${month}-`) ? overviewDate : `${month}-01`;
  const overviewRows = useMemo(() => users.map((user) => {
    const shift = shiftByUserAndDate.get(`${user.id}:${selectedOverviewDate}`);
    if (!shift) return null;
    const record = attendanceByUserAndDate.get(`${user.id}:${selectedOverviewDate}`);
    let status = "before";
    if (shift.is_off) status = "off";
    else if (record?.clock_out) status = "done";
    else if (record?.clock_in) status = "working";
    else if (shift.start_time && now > new Date(`${selectedOverviewDate}T${shift.start_time}+09:00`).getTime()) status = "late";
    return { user, shift, record, status, workDate: selectedOverviewDate };
  }).filter(Boolean).sort((a, b) => {
    if (a.shift.is_off !== b.shift.is_off) return a.shift.is_off ? 1 : -1;
    return String(a.shift.start_time || "99:99").localeCompare(String(b.shift.start_time || "99:99"));
  }), [users, shiftByUserAndDate, attendanceByUserAndDate, selectedOverviewDate, now]);
  const overviewCounts = useMemo(() => ({
    scheduled: overviewRows.filter((row) => !row.shift.is_off).length,
    working: overviewRows.filter((row) => row.status === "working").length,
    late: overviewRows.filter((row) => row.status === "late").length,
    done: overviewRows.filter((row) => row.status === "done").length,
    off: overviewRows.filter((row) => row.status === "off").length,
  }), [overviewRows]);

  async function reload() {
    setLoading(true); setError("");
    try {
      const [nextUsers, nextShifts, nextAttendance, nextRequests] = await Promise.all([fetchProfiles(), fetchAllShifts(month), fetchAllAttendance(month), fetchAttendanceCorrectionRequests(requestFilter)]);
      const activeUsers = nextUsers.filter((u) => u.isActive);
      setUsers(activeUsers); setShifts(nextShifts); setAttendance(nextAttendance); setCorrectionRequests(nextRequests);
      setSelectedUserId((current) => current || activeUsers[0]?.id || "");
    } catch (e) { setError(e.message || "シフトを取得できませんでした。SQLの適用状況を確認してください。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [month, requestFilter]);
  useEffect(() => { setOverviewDate(month === monthNow() ? dateNow() : `${month}-01`); }, [month]);
  useEffect(() => {
    const updateClock = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
    };
    const timer = window.setInterval(updateClock, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now());
        reload();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [month, requestFilter]);

  async function bulkSave(dates, settings) {
    if (!canManage || !selectedUserId) return;
    try { await saveShifts(selectedUserId, dates, settings); await reload(); }
    catch(e) { setError(e.message || "シフト登録に失敗しました。"); throw e; }
  }

  function openAttendanceEdit(row, request = null) {
    const date = request?.work_date || row.workDate || today;
    const record = attendance.find((a) => a.user_id === row.user.id && a.work_date === date);
    const toTime = (value) => value ? new Date(value).toLocaleTimeString("ja-JP", { hour:"2-digit", minute:"2-digit", hour12:false, timeZone:"Asia/Tokyo" }) : "";
    setEditingAttendance({
      requestId: request?.id || null, userId: row.user.id, userName: row.user.displayName || row.user.email,
      workDate: date,
      clockIn: toTime(request?.requested_clock_in || record?.clock_in),
      clockOut: toTime(request?.requested_clock_out || record?.clock_out),
      breakMinutes: record?.break_minutes || 0,
      managerNote: request ? `${request.reason_type}${request.reason_detail ? `：${request.reason_detail}` : ""}` : "管理者による直接修正",
    });
  }
  async function saveAttendanceEdit(status = "approved") {
    if (!editingAttendance) return;
    setSavingAttendance(true); setError("");
    try {
      const toIso = (date, time) => time ? new Date(`${date}T${time}:00+09:00`).toISOString() : null;
      const payload = { ...editingAttendance, clockIn: toIso(editingAttendance.workDate, editingAttendance.clockIn), clockOut: toIso(editingAttendance.workDate, editingAttendance.clockOut), managerId: currentProfile.id, status };
      if (editingAttendance.requestId) await resolveAttendanceCorrectionRequest(payload);
      else await updateAttendanceRecordAsManager({ ...payload, reason: editingAttendance.managerNote });
      setEditingAttendance(null); await reload();
    } catch(e) { setError(e.message || "勤怠修正に失敗しました。"); }
    finally { setSavingAttendance(false); }
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
      <div className="table-scroll"><table className="admin-table today-shift-table"><thead><tr><th>AP</th><th>シフト</th><th>出勤</th><th>退勤</th><th>状態</th><th>操作</th></tr></thead><tbody>{filteredRows.map((r) => <tr key={r.user.id} className={r.status === "late" ? "late-row" : ""}><td>{r.user.displayName || r.user.email}</td><td>{!r.shift ? "未登録" : r.shift.is_off ? "休み" : `${r.shift.start_time?.slice(0,5)}〜${r.shift.end_time?.slice(0,5)}`}</td><td>{fmt(r.record?.clock_in)}</td><td>{fmt(r.record?.clock_out)}</td><td><span className={`shift-status ${r.status}`}>{({working:"出勤中",late:"未出勤",before:"勤務前",done:"退勤済み",off:"休み","no-shift":"未登録"})[r.status]}</span></td><td><button className="table-action" type="button" onClick={()=>openAttendanceEdit(r)}>勤怠修正</button></td></tr>)}</tbody></table></div>
    </section>


    <section className="attendance-request-management">
      <div className="today-shift-head"><div><h3>勤怠修正申請</h3><p>APから届いた申請を確認し、承認・修正・却下できます。</p></div><select value={requestFilter} onChange={(e)=>setRequestFilter(e.target.value)}><option value="pending">未対応</option><option value="approved">承認済み</option><option value="rejected">却下済み</option><option value="all">すべて</option></select></div>
      {correctionRequests.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>AP</th><th>対象日</th><th>希望時刻</th><th>理由</th><th>状態</th><th>操作</th></tr></thead><tbody>{correctionRequests.map((req)=>{ const user=userMap.get(req.user_id); const row={user:user||{id:req.user_id,displayName:"不明なユーザー"}}; return <tr key={req.id}><td>{user?.displayName || user?.email || "不明"}</td><td>{req.work_date}</td><td>{fmt(req.requested_clock_in)}〜{fmt(req.requested_clock_out)}</td><td>{req.reason_type}{req.reason_detail ? `：${req.reason_detail}` : ""}</td><td><span className={`request-status ${req.status}`}>{({pending:"未対応",approved:"承認",rejected:"却下"})[req.status]}</span></td><td>{req.status === "pending" ? <div className="user-action-group"><button className="table-action" onClick={()=>openAttendanceEdit(row,req)}>確認・修正</button><button className="table-action danger" onClick={()=>{openAttendanceEdit(row,req); setTimeout(()=>{},0)}}>却下は確認画面から</button></div> : "—"}</td></tr>})}</tbody></table></div> : <div className="empty-state">該当する申請はありません。</div>}
    </section>

    <section className="all-shifts-overview calendar-overview">
      <div className="today-shift-head"><div><h3>月間シフト一覧</h3><p>日付を選択すると、その日のシフト一覧を確認できます。</p></div></div>
      <div className="overview-layout">
        <div className="overview-calendar-wrap shift-editor-calendar-pane">
          <div className="shift-calendar-grid weekday-row">{["日","月","火","水","木","金","土"].map((day)=><div key={day}>{day}</div>)}</div>
          <div className="shift-calendar-grid">{monthDates.map((date,index)=>{
            if (!date) return <div key={`empty-${index}`} className="shift-day empty" />;
            const dayShifts=shifts.filter((item)=>item.shift_date===date);
            const scheduled=dayShifts.filter((item)=>!item.is_off);
            const dayAttendance=attendance.filter((item)=>item.work_date===date);
            const hasLate=scheduled.some((item)=>item.start_time && now > new Date(`${date}T${item.start_time}+09:00`).getTime() && !dayAttendance.some((record)=>record.user_id===item.user_id && record.clock_in));
            const allClocked=scheduled.length>0 && scheduled.every((item)=>dayAttendance.some((record)=>record.user_id===item.user_id && record.clock_in));
            const className=["shift-day","overview-shift-day",dayShifts.length?"registered":"",date===selectedOverviewDate?"selected":"",date===today?"today":"",hasLate?"has-late":"",allClocked?"all-clocked":""].filter(Boolean).join(" ");
            return <div key={date} className={className}>
              <button type="button" className="shift-day-select" onClick={()=>setOverviewDate(date)} aria-label={`${date}のシフトを表示`}>
                <span className="shift-day-number">{Number(date.slice(-2))}</span>
                {dayShifts.length > 0 && <span className="shift-registered-badge">登録済み</span>}
                <span className="shift-day-summary"><strong>{scheduled.length}名</strong>{dayShifts.length > scheduled.length && <span>休み {dayShifts.length - scheduled.length}名</span>}{hasLate && <span className="overview-late-label">未打刻あり</span>}</span>
              </button>
            </div>;
          })}</div>
        </div>
        <div className="overview-day-panel">
          <div className="overview-day-head"><div><h4>{selectedOverviewDate}</h4><p>選択日のシフト・勤怠状況</p></div><div className="overview-mini-counts"><span>予定 <b>{overviewCounts.scheduled}</b></span><span className={overviewCounts.late?"danger":""}>未打刻 <b>{overviewCounts.late}</b></span><span>休み <b>{overviewCounts.off}</b></span></div></div>
          {overviewRows.length ? <div className="table-scroll"><table className="admin-table overview-day-table"><thead><tr><th>AP</th><th>シフト</th><th>出勤</th><th>退勤</th><th>状態</th><th>操作</th></tr></thead><tbody>{overviewRows.map((row)=><tr key={row.user.id} className={row.status==="late"?"late-row":""}><td>{row.user.displayName || row.user.email}</td><td>{row.shift.is_off?"休み":`${row.shift.start_time?.slice(0,5)}〜${row.shift.end_time?.slice(0,5)}`}</td><td>{fmt(row.record?.clock_in)}</td><td>{fmt(row.record?.clock_out)}</td><td><span className={`shift-status ${row.status}`}>{({working:"出勤中",late:"未出勤",before:"勤務前",done:"退勤済み",off:"休み"})[row.status]}</span></td><td><button className="table-action" type="button" onClick={()=>openAttendanceEdit(row)}>勤怠修正</button></td></tr>)}</tbody></table></div> : <div className="empty-state">この日のシフト登録はありません。</div>}
        </div>
      </div>
    </section>

    <section className="shift-registration-section">
      <div className="today-shift-head shift-registration-head">
        <div><h3>シフトの登録・確認</h3><p>APを選択して、カレンダーからシフトを登録・編集できます。</p></div>
        <label className="shift-registration-user-select"><span>登録・編集するAP</span><select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">選択してください</option>{users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></label>
      </div>
      {loading ? <div className="empty-state">読み込み中...</div> : <ShiftCalendarEditor month={month} shifts={selectedShifts} onBulkSave={bulkSave} disabled={!canManage || !selectedUserId} />}
    </section>

    {editingAttendance && <div className="lock-overlay"><section className="edit-modal attendance-edit-modal"><h2>勤怠修正</h2><p><strong>{editingAttendance.userName}</strong></p><label>対象日<input type="date" value={editingAttendance.workDate} onChange={(e)=>setEditingAttendance({...editingAttendance,workDate:e.target.value})} /></label><label>出勤時刻<input type="time" value={editingAttendance.clockIn} onChange={(e)=>setEditingAttendance({...editingAttendance,clockIn:e.target.value})} /></label><label>退勤時刻<input type="time" value={editingAttendance.clockOut} onChange={(e)=>setEditingAttendance({...editingAttendance,clockOut:e.target.value})} /></label><label>休憩時間（分）<input type="number" min="0" value={editingAttendance.breakMinutes} onChange={(e)=>setEditingAttendance({...editingAttendance,breakMinutes:e.target.value})} /></label><label>修正理由・管理メモ<textarea rows="3" value={editingAttendance.managerNote} onChange={(e)=>setEditingAttendance({...editingAttendance,managerNote:e.target.value})} /></label><div className="modal-actions">{editingAttendance.requestId && <button className="secondary-button danger" onClick={()=>saveAttendanceEdit("rejected")} disabled={savingAttendance}>却下</button>}<button className="secondary-button" onClick={()=>setEditingAttendance(null)} disabled={savingAttendance}>キャンセル</button><button className="primary-button" onClick={()=>saveAttendanceEdit("approved")} disabled={savingAttendance}>{savingAttendance ? "保存中..." : editingAttendance.requestId ? "承認して保存" : "修正を保存"}</button></div></section></div>}
  </section>;
}
