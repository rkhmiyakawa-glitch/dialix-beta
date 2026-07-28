import { useEffect, useMemo, useState } from "react";
import ShiftCalendarEditor from "../components/ShiftCalendarEditor";
import { fetchProfiles } from "../services/profileService";
import { deleteShift, fetchAllShifts, saveShift, saveShifts } from "../services/attendanceService";

const monthNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);

export default function ShiftManagementPanel({ currentProfile }) {
  const canManage = ["owner", "admin"].includes(String(currentProfile?.role || "").toLowerCase());
  const [month, setMonth] = useState(monthNow);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectedShifts = useMemo(() => shifts.filter((s) => s.user_id === selectedUserId), [shifts, selectedUserId]);

  async function reload() {
    setLoading(true); setError("");
    try {
      const [nextUsers, nextShifts] = await Promise.all([fetchProfiles(), fetchAllShifts(month)]);
      const activeUsers = nextUsers.filter((u) => u.isActive);
      setUsers(activeUsers); setShifts(nextShifts);
      setSelectedUserId((current) => current || activeUsers[0]?.id || "");
    } catch (e) { setError(e.message || "シフトを取得できませんでした。SQLの適用状況を確認してください。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [month]);

  async function bulkSave(dates, settings) {
    if (!canManage || !selectedUserId) return;
    try { await saveShifts(selectedUserId, dates, settings); await reload(); }
    catch(e) { setError(e.message || "シフトの一括登録に失敗しました。"); throw e; }
  }
  async function singleSave(date, settings) {
    if (!canManage || !selectedUserId) return;
    try { await saveShift({ userId: selectedUserId, shiftDate: date, ...settings }); await reload(); }
    catch(e) { setError(e.message || "シフト保存に失敗しました。"); throw e; }
  }
  async function removeShift(shift) {
    if (!canManage) return;
    try { await deleteShift(shift.id); await reload(); }
    catch(e) { setError(e.message || "削除に失敗しました。"); throw e; }
  }

  return <section className="admin-panel shift-management-panel">
    <div className="admin-panel-head"><div><h2>シフト管理</h2><p>APを選び、複数日の一括登録と日ごとの変則シフト設定ができます。</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
    {error && <div className="admin-error">{error}</div>}
    <div className="shift-user-selector"><label>対象AP<select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}><option value="">選択してください</option>{users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></label></div>
    {loading ? <div className="empty-state">読み込み中...</div> : selectedUserId ? <ShiftCalendarEditor month={month} shifts={selectedShifts} onBulkSave={bulkSave} onSingleSave={singleSave} onDelete={removeShift} disabled={!canManage} /> : <div className="empty-state">APを選択してください。</div>}
  </section>;
}
