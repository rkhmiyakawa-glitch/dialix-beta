export default function Header({ onLogout, onGoLists, currentProfile, onOpenAdmin, pageTitle = "DIALIX" }) {
  const canOpenAdmin = currentProfile?.role === "admin" || currentProfile?.role === "sv";

  async function goHome() {
    await onGoLists?.();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="header-brand" type="button" onClick={goHome} aria-label="リスト一覧へ戻る">
          <span className="header-mark">D</span>
          <strong>DIALIX</strong>
          <span className="beta-badge">Beta 1.0</span>
        </button>
        <div className="topbar-breadcrumb">
          <button type="button" onClick={goHome}>リスト一覧</button>
          <span>›</span>
          <strong>{pageTitle}</strong>
        </div>
      </div>

      <div className="header-actions">
        <span className="top-metric">♟ 現在架電中 <b>—人</b></span>
        <span className="top-metric">☎ 今日のコール</span>
        <span className="top-metric">☆ 見込み</span>
        {canOpenAdmin && onOpenAdmin && (
          <button className="header-admin-button" type="button" onClick={onOpenAdmin}>管理</button>
        )}
        <span className="header-user-name">{currentProfile?.displayName || "オペレーター"}</span>
        <button className="logout-button" type="button" onClick={onLogout}>ログアウト</button>
      </div>
    </header>
  );
}
