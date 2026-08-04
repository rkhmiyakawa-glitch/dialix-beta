import { useEffect, useState } from "react";
import Header from "../components/Header";
import { updateMyDisplayName } from "../services/profileService";
import { updateMyPassword } from "../services/authService";
import { fetchMyPerformance } from "../services/dataService";

const roleLabels = { owner: "オーナー", admin: "管理者S", admin_a: "管理者A", sv: "SV", supervisor: "SV", operator: "オペレーター", 管理者: "管理者S", 管理者s: "管理者S", 管理者a: "管理者A", オーナー: "オーナー" };
const emptyPerformance = { calls: 0, valid: 0, decisions: 0, prospects: 0, tossups: 0 };
const metricItems = [
  { key: "calls", label: "コール" },
  { key: "valid", label: "有効" },
  { key: "decisions", label: "決裁" },
  { key: "prospects", label: "見込み" },
  { key: "tossups", label: "トスアップ" },
];

function PerformancePanel({ title, values, loading }) {
  return <section className="panel mypage-performance-panel">
    <div className="mypage-performance-heading">
      <div><p className="eyebrow">PERFORMANCE</p><h2>{title}</h2></div>
      {loading && <span className="mypage-kpi-loading">集計中...</span>}
    </div>
    <div className="mypage-kpi-grid">
      {metricItems.map((item) => <div className="mypage-kpi-card" key={item.key}>
        <span>{item.label}</span>
        <strong>{Number(values?.[item.key] || 0).toLocaleString("ja-JP")}</strong>
        <small>件</small>
      </div>)}
    </div>
  </section>;
}

export default function MyPage({ currentProfile, onProfileUpdated, onBack, onGoLists, onLogout, onOpenAdmin, overdueReminderCount }) {
  const [displayName, setDisplayName] = useState(currentProfile?.displayName || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [performance, setPerformance] = useState({ today: emptyPerformance, month: emptyPerformance });
  const [performanceLoading, setPerformanceLoading] = useState(true);
  const [performanceError, setPerformanceError] = useState("");

  useEffect(() => setDisplayName(currentProfile?.displayName || ""), [currentProfile?.displayName]);

  useEffect(() => {
    let active = true;
    setPerformanceLoading(true);
    setPerformanceError("");
    fetchMyPerformance(currentProfile?.id)
      .then((next) => { if (active) setPerformance(next); })
      .catch((error) => { if (active) setPerformanceError(error.message || "実績を取得できませんでした。"); })
      .finally(() => { if (active) setPerformanceLoading(false); });
    return () => { active = false; };
  }, [currentProfile?.id]);

  async function saveProfile(event) {
    event.preventDefault();
    const nextName = displayName.trim();
    if (!nextName) return window.alert("表示名を入力してください。");
    setProfileSaving(true); setMessage("");
    try {
      const updated = await updateMyDisplayName(nextName);
      onProfileUpdated?.({ ...currentProfile, ...updated, displayName: nextName });
      setMessage("表示名を更新しました。");
    } catch (error) {
      window.alert(error.message || "表示名の更新に失敗しました。");
    } finally { setProfileSaving(false); }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (newPassword.length < 8) return window.alert("パスワードは8文字以上で入力してください。");
    if (newPassword !== confirmPassword) return window.alert("確認用パスワードが一致しません。");
    setPasswordSaving(true); setMessage("");
    try {
      await updateMyPassword(newPassword);
      setNewPassword(""); setConfirmPassword("");
      setMessage("パスワードを変更しました。");
    } catch (error) {
      window.alert(error.message || "パスワードの変更に失敗しました。");
    } finally { setPasswordSaving(false); }
  }

  return <main className="app-page">
    <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={onOpenAdmin} pageTitle="マイページ" overdueReminderCount={overdueReminderCount} />
    <section className="content mypage-content">
      <div className="page-title"><div>
        <p className="eyebrow">MY PAGE</p><h1>マイページ</h1><p>アカウント情報と自分の実績を確認できます。</p>
      </div></div>
      {message && <div className="mypage-success">{message}</div>}
      {performanceError && <div className="mypage-error">{performanceError}</div>}

      <div className="mypage-performance-stack">
        <PerformancePanel title="今日の実績" values={performance.today} loading={performanceLoading} />
        <PerformancePanel title="今月の実績" values={performance.month} loading={performanceLoading} />
      </div>

      <div className="mypage-grid">
        <form className="panel mypage-panel" onSubmit={saveProfile}>
          <h2>プロフィール</h2>
          <label>表示名<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} /></label>
          <dl className="mypage-info">
            <div><dt>メールアドレス</dt><dd>{currentProfile?.email || "―"}</dd></div>
            <div><dt>権限</dt><dd>{roleLabels[String(currentProfile?.role || "").toLowerCase()] || "オペレーター"}</dd></div>
            <div><dt>アカウント状態</dt><dd>{currentProfile?.isActive === false ? "停止" : "有効"}</dd></div>
          </dl>
          <p className="mypage-note">メールアドレスと権限の変更は管理者が行います。</p>
          <button className="primary-button" type="submit" disabled={profileSaving}>{profileSaving ? "保存中..." : "表示名を保存"}</button>
        </form>
        <form className="panel mypage-panel" onSubmit={savePassword}>
          <h2>パスワード変更</h2>
          <label>新しいパスワード<input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="8文字以上" /></label>
          <label>新しいパスワード（確認）<input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
          <button className="primary-button" type="submit" disabled={passwordSaving}>{passwordSaving ? "変更中..." : "パスワードを変更"}</button>
        </form>
      </div>
    </section>
  </main>;
}
