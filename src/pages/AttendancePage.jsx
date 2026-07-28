import { useMemo, useState } from "react";
import Header from "../components/Header";

const STORAGE_KEY = "dialix-attendance-records";

function readRecords() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

export default function AttendancePage({ currentProfile, onGoLists, onLogout, onOpenAdmin, onOpenMyPage }) {
  const [records, setRecords] = useState(readRecords);
  const today = new Date().toLocaleDateString("ja-JP");
  const todayRecord = useMemo(() => records.find((item) => item.date === today), [records, today]);

  function save(nextRecords) {
    setRecords(nextRecords);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
  }

  function clockIn() {
    if (todayRecord?.clockIn) return;
    const time = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    save([{ date: today, clockIn: time, clockOut: "" }, ...records.filter((item) => item.date !== today)]);
  }

  function clockOut() {
    const time = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
    save(records.map((item) => item.date === today ? { ...item, clockOut: time } : item));
  }

  return <main className="app-page">
    <Header currentProfile={currentProfile} onGoLists={onGoLists} onLogout={onLogout} onOpenAdmin={onOpenAdmin} onOpenMyPage={onOpenMyPage} pageTitle="勤怠" />
    <section className="content">
      <div className="page-title"><div><p className="eyebrow">ATTENDANCE</p><h1>勤怠</h1><p>{currentProfile?.displayName || "オペレーター"}さんの出退勤を記録します。</p></div></div>
      <section className="attendance-card">
        <div><span>本日</span><strong>{today}</strong></div>
        <div className="attendance-times"><span>出勤 <b>{todayRecord?.clockIn || "--:--"}</b></span><span>退勤 <b>{todayRecord?.clockOut || "--:--"}</b></span></div>
        <div className="attendance-actions"><button type="button" onClick={clockIn} disabled={Boolean(todayRecord?.clockIn)}>出勤</button><button type="button" onClick={clockOut} disabled={!todayRecord?.clockIn || Boolean(todayRecord?.clockOut)}>退勤</button></div>
      </section>
      <section className="simple-panel"><h2>勤怠履歴</h2>{records.length ? <div className="attendance-table">{records.slice(0, 31).map((item) => <div key={item.date}><span>{item.date}</span><span>{item.clockIn || "--:--"}</span><span>{item.clockOut || "--:--"}</span></div>)}</div> : <div className="empty-state">勤怠履歴はありません。</div>}</section>
    </section>
  </main>;
}
