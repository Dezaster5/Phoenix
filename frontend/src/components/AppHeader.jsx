export default function AppHeader({ isAuthenticated, onLogout }) {
  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-mark">A</div>
        <div>
          <div className="brand-title">Avatariya Vault Access</div>
          <div className="brand-subtitle">
            {isAuthenticated ? "Рабочий доступ сотрудников" : "Безопасный доступ к сервисам"}
          </div>
        </div>
      </div>

      {isAuthenticated && (
        <div className="header-actions">
          <button className="btn btn-secondary" type="button" onClick={onLogout}>
            Выйти
          </button>
        </div>
      )}
    </header>
  );
}
