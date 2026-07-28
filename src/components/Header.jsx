function emitNavigation(destination) {
  window.dispatchEvent(new CustomEvent("dialix:navigate", { detail: destination }));
}

export default function Header({ onLogout, onGoLists, currentProfile, onOpenAdmin, onOpenMyPage, pageTitle = "DIALIX" }) {
  const normalizedRole = String(currentProfile?.role || "").trim().toLowerCase();
  const canOpenAdmin = ["owner", "admin", "sv", "supervisor", "管理者", "オーナー"].includes(normalizedRole);
  const displayName = currentProfile?.displayName || "マイページ";

  async function goLists() {
    await onGoLists?.();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  return (
    <>
      <aside className="app-sidebar" aria-label="メインメニュー">
        <button className="sidebar-brand" type="button" onClick={goLists} aria-label="リスト一覧へ戻る">
          <span className="sidebar-brand-mark">D</span>
          <strong>DIALIX</strong>
        </button>

        <nav className="sidebar-nav">
          <button type="button" onClick={onOpenMyPage}>
            <span className="sidebar-icon">👤</span><span>{displayName}</span>
          </button>
          <button type="button" onClick={() => emitNavigation("attendance")}>
            <span className="sidebar-icon">◷</span><span>勤怠</span>
          </button>
          <button type="button" onClick={goLists}>
            <span className="sidebar-icon">☷</span><span>リスト一覧</span>
          </button>
          <button type="button" onClick={() => emitNavigation("today-reminders")}>
            <span className="sidebar-icon">⏰</span><span>本日のリマインド</span>
          </button>
          <button type="button" onClick={() => emitNavigation("reminders")}>
            <span className="sidebar-icon">✓</span><span>リマインド一覧</span>
          </button>
          <button type="button" onClick={() => emitNavigation("links")}>
            <span className="sidebar-icon">↗</span><span>リンク</span>
          </button>
          {canOpenAdmin && onOpenAdmin && (
            <button type="button" onClick={onOpenAdmin}>
              <span className="sidebar-icon">⚙</span><span>管理画面</span>
            </button>
          )}
        </nav>

        <button className="sidebar-logout" type="button" onClick={onLogout}>
          <span className="sidebar-icon">⇥</span><span>ログアウト</span>
        </button>
      </aside>

      <header className="app-header sidebar-header">
        <div className="header-left">
          <div className="topbar-breadcrumb"><button type="button" onClick={goLists}>リスト一覧</button><span>›</span><strong>{pageTitle}</strong></div>
        </div>
      </header>
    </>
  );
}
