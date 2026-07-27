import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { fetchProfiles } from "../services/profileService";
import { createManagedUser, deleteManagedUser, resetManagedUserPassword, updateManagedUser } from "../services/userManagementService";
import CsvImportPanel from "./CsvImportPanel";
import AuditLogPanel from "./AuditLogPanel";
import DashboardPanel from "./DashboardPanel";
import ReportsPanel from "./ReportsPanel";
import ListManagementPanel from "./ListManagementPanel";

const roleLabels = { admin: "管理者", sv: "SV", operator: "オペレーター" };

export default function AdminPage({ currentProfile, onBack, onGoLists, onLogout, onOpenMyPage }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({
    displayName: "",
    email: "",
    password: "",
    passwordConfirm: "",
    role: "operator",
    isActive: true,
  });

  const activeAdminCount = useMemo(() => users.filter((u) => u.role === "admin" && u.isActive).length, [users]);

  async function reload() {
    setLoading(true); setError("");
    try { setUsers(await fetchProfiles()); }
    catch (e) { setError(e.message || "ユーザー一覧を取得できませんでした。"); }
    finally { setLoading(false); }
  }

  useEffect(() => { reload(); }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }, [activeTab]);

  function beginEdit(user) { setEditing({ ...user }); }

  async function saveEdit() {
    if (!editing.displayName.trim()) return window.alert("名前を入力してください。");
    const original = users.find((u) => u.id === editing.id);
    const removingLastAdmin = original?.role === "admin" && original.isActive && activeAdminCount <= 1 && (editing.role !== "admin" || !editing.isActive);
    if (removingLastAdmin) return window.alert("最後の管理者は降格・停止できません。");

    setSaving(true); setError("");
    try {
      await updateManagedUser({ userId: editing.id, displayName: editing.displayName, role: editing.role, isActive: editing.isActive });
      setEditing(null);
      await reload();
    } catch (e) { setError(e.message || "更新に失敗しました。"); }
    finally { setSaving(false); }
  }

  async function createUser() {
    if (!newUser.displayName.trim() || !newUser.email.trim()) return window.alert("名前とメールアドレスを入力してください。");
    if (newUser.password.length < 8) return window.alert("初期パスワードは8文字以上で入力してください。");
    if (newUser.password !== newUser.passwordConfirm) return window.alert("確認用パスワードが一致しません。");
    setSaving(true); setError("");
    try {
      await createManagedUser({
        displayName: newUser.displayName,
        email: newUser.email,
        password: newUser.password,
        role: newUser.role,
        isActive: newUser.isActive,
      });
      setCreating(false);
      setNewUser({ displayName: "", email: "", password: "", passwordConfirm: "", role: "operator", isActive: true });
      await reload();
      window.alert("ユーザーを追加しました。初期パスワードを本人へ安全に共有してください。");
    } catch (e) { setError(e.message || "ユーザー追加に失敗しました。"); }
    finally { setSaving(false); }
  }

  async function resetPassword(user) {
    const password = window.prompt(`${user.displayName}さんの新しいパスワードを入力してください（8文字以上）`);
    if (!password) return;
    if (password.length < 8) return window.alert("パスワードは8文字以上で入力してください。");
    try { await resetManagedUserPassword(user.id, password); window.alert("パスワードを変更しました。"); }
    catch (e) { setError(e.message || "パスワード変更に失敗しました。"); }
  }

  async function removeUser(user) {
    if (user.id === currentProfile?.id) return window.alert("自分自身は削除できません。");
    if (!window.confirm(`${user.displayName}さんを削除しますか？この操作は元に戻せません。`)) return;
    try { await deleteManagedUser(user.id); await reload(); }
    catch (e) { setError(e.message || "削除に失敗しました。"); }
  }

  return <main className="app-page">
    <Header onLogout={onLogout} onGoLists={onGoLists} currentProfile={currentProfile} onOpenAdmin={() => {}} onOpenMyPage={onOpenMyPage} />
    <section className="content admin-content">
      <div className="page-title">
        <div>
          <button className="back-button" type="button" onClick={onBack}>
            ← リスト一覧へ
          </button>
          <p className="eyebrow">ADMIN CONSOLE</p>
          <h1>管理画面</h1>
          <p>ユーザーと権限を管理します。</p>
        </div>
      </div>

      <div className="admin-tabs">
        <button className={`admin-tab ${activeTab === "dashboard" ? "active" : ""}`} onClick={() => setActiveTab("dashboard")}>ダッシュボード</button>
        <button className={`admin-tab ${activeTab === "users" ? "active" : ""}`} onClick={() => setActiveTab("users")}>ユーザー管理</button>
        <button className={`admin-tab ${activeTab === "csv" ? "active" : ""}`} onClick={() => setActiveTab("csv")}>CSVインポート</button>
        <button className={`admin-tab ${activeTab === "lists" ? "active" : ""}`} onClick={() => setActiveTab("lists")}>リスト管理</button>
        <button className={`admin-tab ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>レポート</button>
        <button className={`admin-tab ${activeTab === "audit" ? "active" : ""}`} onClick={() => setActiveTab("audit")}>監査ログ</button>
      </div>

      {activeTab === "dashboard" ? <DashboardPanel /> : activeTab === "csv" ? <CsvImportPanel currentProfile={currentProfile} /> : activeTab === "lists" ? <ListManagementPanel /> : activeTab === "reports" ? <ReportsPanel /> : activeTab === "audit" ? <AuditLogPanel /> : <section className="admin-panel">
        <div className="admin-panel-head">
          <div><h2>ユーザー一覧</h2><p>追加・権限変更・停止・パスワード変更・削除をDIALIX上で行えます。</p></div>
          <button className="primary-button" type="button" onClick={() => setCreating(true)} disabled={currentProfile?.role !== "admin"}>＋ ユーザー追加</button>
        </div>
        {error && <div className="admin-error">{error}</div>}
        {loading ? <div className="empty-state">読み込み中...</div> :
          <div className="table-scroll"><table className="admin-table"><thead><tr><th>名前</th><th>メール</th><th>権限</th><th>状態</th><th>最終稼働</th><th>登録日時</th><th>操作</th></tr></thead>
          <tbody>{users.map((user) => <tr key={user.id}>
            <td><strong>{user.displayName}</strong>{user.id === currentProfile?.id && <span className="self-badge">自分</span>}</td>
            <td>{user.email || "―"}</td><td><span className={`role-badge ${user.role}`}>{roleLabels[user.role]}</span></td>
            <td><span className={`state-badge ${user.isActive ? "active" : "stopped"}`}>{user.isActive ? "有効" : "停止"}</span></td>
            <td>{user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString("ja-JP") : "未記録"}</td><td>{user.createdAt ? new Date(user.createdAt).toLocaleString("ja-JP") : "―"}</td>
            <td><div className="user-action-group"><button className="table-action" type="button" onClick={() => beginEdit(user)} disabled={currentProfile?.role !== "admin"}>{currentProfile?.role === "admin" ? "編集" : "閲覧のみ"}</button>{currentProfile?.role === "admin" && <><button className="table-action" type="button" onClick={() => resetPassword(user)}>PW変更</button><button className="table-action danger" type="button" onClick={() => removeUser(user)} disabled={user.id === currentProfile?.id}>削除</button></>}</div></td>
          </tr>)}</tbody></table></div>}
      </section>}
    </section>

    {creating && <div className="lock-overlay"><section className="edit-modal">
      <h2>ユーザー追加</h2>
      <label>名前<input value={newUser.displayName} onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })} /></label>
      <label>メールアドレス<input type="email" value={newUser.email} onChange={(e) => setNewUser({ ...newUser, email: e.target.value })} /></label>
      <label>権限<select value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}><option value="admin">管理者</option><option value="sv">SV</option><option value="operator">オペレーター</option></select></label>
      <label>初期パスワード<input type="password" minLength="8" autoComplete="new-password" value={newUser.password} onChange={(e) => setNewUser({ ...newUser, password: e.target.value })} placeholder="8文字以上" /></label>
      <label>初期パスワード（確認）<input type="password" minLength="8" autoComplete="new-password" value={newUser.passwordConfirm} onChange={(e) => setNewUser({ ...newUser, passwordConfirm: e.target.value })} placeholder="もう一度入力" /></label>
      <label className="toggle-row"><input type="checkbox" checked={newUser.isActive} onChange={(e) => setNewUser({ ...newUser, isActive: e.target.checked })} />アカウントを有効にする</label>
      <p className="csv-note">招待メールは送信されません。登録後、メールアドレスと初期パスワードを本人へ安全に共有し、初回ログイン後にマイページから変更してもらってください。</p>
      <div className="modal-actions"><button className="secondary-button" onClick={() => setCreating(false)} disabled={saving}>キャンセル</button><button className="primary-button" onClick={createUser} disabled={saving}>{saving ? "登録中..." : "登録"}</button></div>
    </section></div>}

    {editing && <div className="lock-overlay"><section className="edit-modal">
      <h2>ユーザー編集</h2>
      <label>名前<input value={editing.displayName} onChange={(e) => setEditing({ ...editing, displayName: e.target.value })} /></label>
      <label>権限<select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}><option value="admin">管理者</option><option value="sv">SV</option><option value="operator">オペレーター</option></select></label>
      <label className="toggle-row"><input type="checkbox" checked={editing.isActive} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />アカウントを有効にする</label>
      <div className="modal-actions"><button className="secondary-button" onClick={() => setEditing(null)} disabled={saving}>キャンセル</button><button className="primary-button" onClick={saveEdit} disabled={saving}>{saving ? "保存中..." : "保存"}</button></div>
    </section></div>}
  </main>;
}
