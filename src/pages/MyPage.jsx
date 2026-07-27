import { useEffect, useState } from "react";
import Header from "../components/Header";
import { updateMyDisplayName } from "../services/profileService";
import { updateMyPassword } from "../services/authService";

const roleLabels = { admin: "管理者", sv: "SV", operator: "オペレーター" };

export default function MyPage({ currentProfile, onProfileUpdated, onBack, onGoLists, onLogout, onOpenAdmin }) {
  const [displayName, setDisplayName] = useState(currentProfile?.displayName || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setDisplayName(currentProfile?.displayName || ""), [currentProfile?.displayName]);

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
    <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={onOpenAdmin} pageTitle="マイページ" />
    <section className="content mypage-content">
      <div className="page-title"><div>
        <button className="back-button" type="button" onClick={onBack}>← 前の画面へ</button>
        <p className="eyebrow">MY PAGE</p><h1>マイページ</h1><p>表示名とログインパスワードを変更できます。</p>
      </div></div>
      {message && <div className="mypage-success">{message}</div>}
      <div className="mypage-grid">
        <form className="panel mypage-panel" onSubmit={saveProfile}>
          <h2>プロフィール</h2>
          <label>表示名<input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} /></label>
          <dl className="mypage-info">
            <div><dt>メールアドレス</dt><dd>{currentProfile?.email || "―"}</dd></div>
            <div><dt>権限</dt><dd>{roleLabels[currentProfile?.role] || "オペレーター"}</dd></div>
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
