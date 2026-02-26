import { useEffect, useRef, useState } from "react";

export default function AppHeader({
  isAuthenticated,
  viewerDepartment,
  viewerFullName,
  roleLabel,
  canManage,
  canOpenServicesTab,
  showVaultTab,
  currentView,
  pendingRequestsCount,
  onToggleView,
  onLogout
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState({ top: 0, left: 0 });
  const profileButtonRef = useRef(null);
  const profileMenuRef = useRef(null);

  const updateProfileMenuPosition = () => {
    const button = profileButtonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    setProfileMenuPosition({
      top: rect.bottom + 8,
      left: Math.max(8, Math.min(rect.right - 280, window.innerWidth - 288))
    });
  };

  useEffect(() => {
    if (!isProfileOpen) return;

    const closeOnOutsideClick = (event) => {
      if (
        profileMenuRef.current?.contains(event.target) ||
        profileButtonRef.current?.contains(event.target)
      ) {
        return;
      }
      setIsProfileOpen(false);
    };

    const closeMenu = () => setIsProfileOpen(false);

    window.addEventListener("click", closeOnOutsideClick);
    window.addEventListener("scroll", closeMenu, true);
    window.addEventListener("resize", closeMenu);

    return () => {
      window.removeEventListener("click", closeOnOutsideClick);
      window.removeEventListener("scroll", closeMenu, true);
      window.removeEventListener("resize", closeMenu);
    };
  }, [isProfileOpen]);

  if (!isAuthenticated) {
    return (
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-title">Avatariya Vault Access</div>
            <div className="brand-subtitle">Безопасный доступ к сервисам</div>
          </div>
        </div>
        <nav className="header-nav" aria-label="Разделы">
          <span className="header-nav-link is-active">Login</span>
        </nav>
      </header>
    );
  }

  return (
    <>
      <header className="app-header">
        <div className="brand">
          <div className="brand-mark">A</div>
          <div>
            <div className="brand-title">Avatariya Vault Access</div>
            <div className="brand-subtitle">Рабочий доступ сотрудников</div>
          </div>
        </div>

        <nav className="header-nav" aria-label="Разделы">
          {showVaultTab && (
            <button
              className={`header-nav-link ${currentView === "vault" ? "is-active" : ""}`}
              type="button"
              onClick={() => onToggleView("vault")}
            >
              Мои доступы
            </button>
          )}
          {canOpenServicesTab && (
            <button
              className={`header-nav-link ${currentView === "services" ? "is-active" : ""}`}
              type="button"
              onClick={() => onToggleView("services")}
            >
              Заявки
            </button>
          )}
          {/* {canManage && (
            <button
              className={`header-nav-link ${currentView === "admin" ? "is-active" : ""}`}
              type="button"
              onClick={() => onToggleView("admin")}
            >
              Панель руководителя
              {pendingRequestsCount > 0 && <span className="nav-badge">{pendingRequestsCount}</span>}
            </button>
          )} */}
        </nav>

        <div className="header-actions">
          <button
            ref={profileButtonRef}
            className="btn btn-secondary"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (!isProfileOpen) {
                updateProfileMenuPosition();
              }
              setIsProfileOpen((prev) => !prev);
            }}
          >
            Профиль
          </button>
          <button className="btn btn-secondary" type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </header>

      {isProfileOpen && (
        <div
          ref={profileMenuRef}
          className="floating-menu profile-floating-menu"
          style={{
            top: `${Math.max(8, profileMenuPosition.top)}px`,
            left: `${Math.max(8, profileMenuPosition.left)}px`
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="floating-menu-group">
            <div className="floating-menu-title">Профиль</div>
            <div className="floating-menu-meta">{viewerFullName || "Без ФИО"}</div>
            <div className="floating-menu-meta">Роль: {roleLabel}</div>
            <div className="floating-menu-meta">Отдел: {viewerDepartment}</div>
          </div>
        </div>
      )}
    </>
  );
}
