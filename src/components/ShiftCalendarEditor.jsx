import { useMemo, useState } from "react";
import { dialog } from "../services/dialogService";

const pad = (n) => String(n).padStart(2, "0");
const isoDate = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;

export default function ShiftCalendarEditor({ month, shifts, onBulkSave, disabled = false, sideTop = null }) {
  const [selected, setSelected] = useState([]);
  const [bulk, setBulk] = useState({ startTime: "09:00", endTime: "18:00", breakMinutes: 60, memo: "", isOff: false });
  const [saving, setSaving] = useState(false);

  const shiftMap = useMemo(() => new Map(shifts.map((s) => [s.shift_date, s])), [shifts]);
  const days = useMemo(() => {
    const [year, monthNo] = month.split("-").map(Number);
    return { year, monthNo, count: new Date(year, monthNo, 0).getDate(), first: new Date(year, monthNo - 1, 1).getDay() };
  }, [month]);

  function toggle(date) {
    if (disabled) return;
    const shift = shiftMap.get(date);
    setSelected((prev) => {
      const next = prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date].sort();
      if (!prev.includes(date) && next.length === 1 && shift) {
        setBulk({
          startTime: shift.start_time?.slice(0, 5) || "09:00",
          endTime: shift.end_time?.slice(0, 5) || "18:00",
          breakMinutes: shift.break_minutes ?? 60,
          memo: shift.memo || "",
          isOff: Boolean(shift.is_off),
        });
      }
      return next;
    });
  }

  async function saveBulk() {
    if (!selected.length) return dialog.alert("登録する日付を選択してください。");
    setSaving(true);
    try { await onBulkSave(selected, bulk); setSelected([]); }
    finally { setSaving(false); }
  }

  const allDates = Array.from({ length: days.count }, (_, i) => isoDate(days.year, days.monthNo, i + 1));
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  const cells = [...Array(days.first).fill(null), ...Array.from({ length: days.count }, (_, i) => i + 1)];
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });

  const chooseWeekdays = () => setSelected(allDates.filter((d) => { const day = new Date(`${d}T00:00:00`).getDay(); return day >= 1 && day <= 5; }));
  const chooseWeekend = () => setSelected(allDates.filter((d) => { const day = new Date(`${d}T00:00:00`).getDay(); return day === 0 || day === 6; }));

  return <div className="shift-editor-layout">
    <div className="shift-editor-calendar-pane">
      <div className="shift-calendar-grid weekday-row">{weekdays.map((w) => <div key={w}>{w}</div>)}</div>
      <div className="shift-calendar-grid">
        {cells.map((day, index) => {
          if (!day) return <div className="shift-day empty" key={`e-${index}`} />;
          const date = isoDate(days.year, days.monthNo, day);
          const s = shiftMap.get(date);
          const active = selected.includes(date);
          return <div key={date} className={`shift-day ${active ? "selected" : ""} ${s ? "registered" : ""} ${s?.is_off ? "off" : ""} ${date === today ? "today" : ""}`}>
            <button type="button" className="shift-day-select" onClick={() => toggle(date)} disabled={disabled} aria-label={`${date}を選択`}>
              <span className="shift-day-number">{day}</span>
              {s && <span className="shift-registered-badge">登録済み</span>}
              <span className="shift-day-summary">{s ? (s.is_off ? "休み" : <><strong>{s.start_time?.slice(0,5)}</strong><span>〜</span><strong>{s.end_time?.slice(0,5)}</strong></>) : "未登録"}</span>
            </button>
          </div>;
        })}
      </div>
    </div>

    <aside className="shift-editor-side-pane">
      <div className={`shift-registration-controls ${disabled ? "single-control" : ""}`}>
        <section className="shift-side-section shift-date-selector">
          <div className="shift-side-heading"><h3>日付を選択</h3><span>{selected.length}日選択中</span></div>
          <div className="shift-side-actions">
            <button type="button" className="secondary-button" disabled={disabled} onClick={chooseWeekdays}>平日</button>
            <button type="button" className="secondary-button" disabled={disabled} onClick={chooseWeekend}>土日</button>
            <button type="button" className="secondary-button" disabled={disabled} onClick={() => setSelected(allDates)}>全選択</button>
            <button type="button" className="secondary-button" disabled={disabled} onClick={() => setSelected([])}>全解除</button>
          </div>
        </section>

        {!disabled && <section className="shift-side-section shift-bulk-box">
          <h3>選択した日に登録</h3>
          <p className="shift-form-note">選択した日付へ時間・休憩・メモをまとめて登録できます。</p>
          <div className="shift-side-form">
            <label>出勤<input type="time" value={bulk.startTime} disabled={bulk.isOff} onChange={(e) => setBulk({...bulk,startTime:e.target.value})}/></label>
            <label>退勤<input type="time" value={bulk.endTime} disabled={bulk.isOff} onChange={(e) => setBulk({...bulk,endTime:e.target.value})}/></label>
            <label>休憩（分）<input type="number" min="0" step="5" value={bulk.breakMinutes} disabled={bulk.isOff} onChange={(e) => setBulk({...bulk,breakMinutes:e.target.value})}/></label>
            <label>メモ<input value={bulk.memo} onChange={(e) => setBulk({...bulk,memo:e.target.value})}/></label>
            <label className="toggle-row"><input type="checkbox" checked={bulk.isOff} onChange={(e) => setBulk({...bulk,isOff:e.target.checked})}/>休み</label>
            <button type="button" className="primary-button shift-save-button" onClick={saveBulk} disabled={saving || !selected.length}>{saving ? "保存中..." : "選択日に登録"}</button>
          </div>
        </section>}
      </div>
    </aside>
  </div>;
}
