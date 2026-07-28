import { useEffect, useMemo, useState } from "react";
import { fetchProfiles } from "../services/profileService";
import { deleteShift, fetchAllShifts, saveShift } from "../services/attendanceService";

const monthNow = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" }).slice(0, 7);
const emptyForm = { userId: "", shiftDate: "", startTime: "09:00", endTime: "18:00", breakMinutes: 60, memo: "", isOff: false };

export default function ShiftManagementPanel({ currentProfile }) {
  const canManage = ["owner", "admin"].includes(String(currentProfile?.role || "").toLowerCase());
  const [month, setMonth] = useState(monthNow);
  const [users, setUsers] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u.displayName || u.email])), [users]);

  async function reload() {
    setLoading(true); setError("");
    try {
      const [nextUsers, nextShifts] = await Promise.all([fetchProfiles(), fetchAllShifts(month)]);
      setUsers(nextUsers.filter((u) => u.isActive)); setShifts(nextShifts);
    } catch (e) { setError(e.message || "シフトを取得できませんでした。SQLの適用状況を確認してください。"); }
    finally { setLoading(false); }
  }
  useEffect(() => { reload(); }, [month]);

  function editShift(s) {
    setForm({ userId: s.user_id, shiftDate: s.shift_date, startTime: s.start_time?.slice(0,5) || "09:00", endTime: s.end_time?.slice(0,5) || "18:00", breakMinutes: s.break_minutes || 0, memo: s.memo || "", isOff: Boolean(s.is_off) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e) {
    e.preventDefault();
    if (!canManage) return;
    if (!form.userId || !form.shiftDate) return window.alert("APと日付を選択してください。");
    if (!form.isOff && (!form.startTime || !form.endTime)) return window.alert("出勤予定と退勤予定を入力してください。");
    setSaving(true); setError("");
    try { await saveShift(form); setForm(emptyForm); await reload(); }
    catch (err) { setError(err.message || "シフト保存に失敗しました。"); }
    finally { setSaving(false); }
  }

  async function remove(s) {
    if (!canManage || !window.confirm(`${userMap.get(s.user_id) || "AP"}の${s.shift_date}のシフトを削除しますか？`)) return;
    try { await deleteShift(s.id); await reload(); } catch (e) { setError(e.message || "削除に失敗しました。"); }
  }

  return <section className="admin-panel shift-management-panel">
    <div className="admin-panel-head"><div><h2>シフト管理</h2><p>各APのシフトを登録・編集・削除できます。</p></div><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
    {error && <div className="admin-error">{error}</div>}
    {canManage && <form className="shift-form" onSubmit={submit}>
      <label>AP<select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}><option value="">選択してください</option>{users.map((u) => <option key={u.id} value={u.id}>{u.displayName || u.email}</option>)}</select></label>
      <label>日付<input type="date" value={form.shiftDate} onChange={(e) => setForm({ ...form, shiftDate: e.target.value })} /></label>
      <label>出勤予定<input type="time" value={form.startTime} disabled={form.isOff} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></label>
      <label>退勤予定<input type="time" value={form.endTime} disabled={form.isOff} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></label>
      <label>休憩（分）<input type="number" min="0" step="5" value={form.breakMinutes} disabled={form.isOff} onChange={(e) => setForm({ ...form, breakMinutes: e.target.value })} /></label>
      <label className="shift-memo">メモ<input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></label>
      <label className="toggle-row"><input type="checkbox" checked={form.isOff} onChange={(e) => setForm({ ...form, isOff: e.target.checked })} />休み</label>
      <div className="shift-form-actions"><button type="button" className="secondary-button" onClick={() => setForm(emptyForm)}>クリア</button><button type="submit" className="primary-button" disabled={saving}>{saving ? "保存中..." : "登録・更新"}</button></div>
    </form>}
    {loading ? <div className="empty-state">読み込み中...</div> : shifts.length ? <div className="table-scroll"><table className="admin-table"><thead><tr><th>日付</th><th>AP</th><th>予定</th><th>休憩</th><th>メモ</th><th>操作</th></tr></thead><tbody>{shifts.map((s) => <tr key={s.id}><td>{s.shift_date}</td><td>{userMap.get(s.user_id) || "不明"}</td><td>{s.is_off ? "休み" : `${s.start_time?.slice(0,5)}〜${s.end_time?.slice(0,5)}`}</td><td>{s.is_off ? "―" : `${s.break_minutes || 0}分`}</td><td>{s.memo || "―"}</td><td>{canManage ? <div className="user-action-group"><button className="table-action" onClick={() => editShift(s)}>編集</button><button className="table-action danger" onClick={() => remove(s)}>削除</button></div> : "閲覧のみ"}</td></tr>)}</tbody></table></div> : <div className="empty-state">この月のシフトはありません。</div>}
  </section>;
}
