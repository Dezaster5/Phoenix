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
      <header className="site-header site-header-plain">
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-ring" />
            <span className="brand-letter">A</span>
          </div>
          <div>
            <div className="brand-title">avatariya</div>
            <div className="brand-subtitle">vault access</div>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="site-header">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <span className="brand-ring" />
            <span className="brand-letter">F</span>
          </div>
          <div>
            <div className="brand-title">Phoenix</div>
            <div className="brand-subtitle">vault access</div>
          </div>
        </div>
        <div className="topbar-actions">
          {isAuthenticated && (
            <>
              <div className="role-chip">
                Отдел: {viewerDepartment}
              </div>
              <div className="role-chip">
                ФИО: {viewerFullName || "Без ФИО"}
              </div>
              <div className="role-chip">
                Роль:{" "}
                {roleLabel}
              </div>
              {canManage && (
                <div className="view-switch" role="tablist" aria-label="Переключение между разделами">
                  <span
                    className={`view-switch-glider ${currentView === "admin" ? "is-admin" : "is-vault"}`}
                  />
                  <button
                    className={`view-switch-btn ${currentView === "vault" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => onToggleView("vault")}
                  >
                    Мои сервисы
                  </button>
                  <button
                    className={`view-switch-btn ${currentView === "admin" ? "is-active" : ""}`}
                    type="button"
                    onClick={() => onToggleView("admin")}
                  >
                    Панель руководителя
                  </button>
                </div>
              )}
              <button className="btn btn-ghost" type="button" onClick={onLogout}>
                Выйти
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
