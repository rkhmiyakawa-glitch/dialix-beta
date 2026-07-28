export default function Header({ onLogout, onGoLists, currentProfile, onOpenAdmin, onOpenMyPage, pageTitle = "DIALIX" }) {
  const normalizedRole = String(currentProfile?.role || "").trim().toLowerCase();
  const canOpenAdmin = ["owner", "admin", "sv", "supervisor", "管理者", "オーナー"].includes(normalizedRole);

  async function goHome() {
    await onGoLists?.();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="header-brand" type="button" onClick={goHome} aria-label="リスト一覧へ戻る">
          <span className="header-mark">D</span><strong>DIALIX</strong><span className="beta-badge">RC5</span>
        </button>
        <div className="topbar-breadcrumb"><button type="button" onClick={goHome}>リスト一覧</button><span>›</span><strong>{pageTitle}</strong></div>
      </div>
      <div className="header-actions">
        {canOpenAdmin && onOpenAdmin && <button className="header-quick-link" type="button" onClick={onOpenAdmin}>管理画面</button>}
        {onOpenMyPage ? (
          <button className="header-user-name header-user-link" type="button" onClick={onOpenMyPage} aria-label="マイページを開く">
            {currentProfile?.displayName || "オペレーター"}
          </button>
        ) : (
          <span className="header-user-name" aria-label="ログイン中のユーザー">
            {currentProfile?.displayName || "オペレーター"}
          </span>
        )}
        <button className="header-logout-button" type="button" onClick={onLogout}>ログアウト</button>
      </div>
    </header>
  );
}
