import { useEffect, useRef, useState } from "react";

export default function Header({ onLogout, onGoLists, currentProfile, onOpenAdmin, onOpenMyPage, pageTitle = "DIALIX" }) {
  const normalizedRole = String(currentProfile?.role || "").trim().toLowerCase();
  const canOpenAdmin = ["admin", "sv", "supervisor", "管理者"].includes(normalizedRole);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function closeMenu(event) { if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false); }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  async function goHome() {
    setMenuOpen(false);
    await onGoLists?.();
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.requestAnimationFrame(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }));
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <button className="header-brand" type="button" onClick={goHome} aria-label="リスト一覧へ戻る">
          <span className="header-mark">D</span><strong>DIALIX</strong><span className="beta-badge">Beta 1.0</span>
        </button>
        <div className="topbar-breadcrumb"><button type="button" onClick={goHome}>リスト一覧</button><span>›</span><strong>{pageTitle}</strong></div>
      </div>
      <div className="header-actions">
        <span className="top-metric">♟ 現在架電中 <b>—人</b></span>
        <button className="header-quick-link" type="button" onClick={onOpenMyPage}>マイページ</button>
        {canOpenAdmin && onOpenAdmin && <button className="header-quick-link" type="button" onClick={onOpenAdmin}>管理画面</button>}
        <div className="user-menu" ref={menuRef}>
          <button className="header-user-button" type="button" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen}>
            {currentProfile?.displayName || "オペレーター"}<span>⌄</span>
          </button>
          {menuOpen && <div className="user-menu-popover">
            {onOpenMyPage && <button type="button" onClick={() => { setMenuOpen(false); onOpenMyPage(); }}>マイページ</button>}
            {canOpenAdmin && onOpenAdmin && <button type="button" onClick={() => { setMenuOpen(false); onOpenAdmin(); }}>管理画面</button>}
            <button className="user-menu-logout" type="button" onClick={onLogout}>ログアウト</button>
          </div>}
        </div>
      </div>
    </header>
  );
}
