export default function AppHeader({
  isAuthenticated,
  viewerDepartment,
  viewerFullName,
  roleLabel,
  canManage,
  currentView,
  onToggleView,
  onLogout
}) {
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
          <span className="header-nav-link is-muted">Vault: доступы и запрос</span>
          <span className="header-nav-link is-muted">Панель руководителя (по роли)</span>
        </nav>
      </header>
    );
  }

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <div className="brand-title">Avatariya Vault Access</div>
          <div className="brand-subtitle">Рабочий доступ сотрудников</div>
        </div>
      </div>

      <nav className="header-nav" aria-label="Разделы">
        <button
          className={`header-nav-link ${currentView === "vault" ? "is-active" : ""}`}
          type="button"
          onClick={() => onToggleView("vault")}
        >
          Vault
        </button>
        {canManage && (
          <button
            className={`header-nav-link ${currentView === "admin" ? "is-active" : ""}`}
            type="button"
            onClick={() => onToggleView("admin")}
          >
            Панель руководителя
          </button>
        )}
      </nav>

      <div className="header-actions">
        <details className="profile-menu">
          <summary>Профиль</summary>
          <div className="profile-menu-body">
            <div>{viewerFullName || "Без ФИО"}</div>
            <div>Роль: {roleLabel}</div>
            <div>Отдел: {viewerDepartment}</div>
          </div>
        </details>
        <button className="btn btn-secondary" type="button" onClick={onLogout}>
          Выйти
        </button>
      </div>
    </header>
  );
}
