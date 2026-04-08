import { Link } from "react-router-dom";

export default function AppHeader({ isAuthenticated, onLogout }) {
  return (
    <header className="app-header">
      <Link className="brand brand-link" to={isAuthenticated ? "/" : "/login"}>
        <div className="brand-mark">A</div>
        <div>
          <div className="brand-title">Avatariya Vault Access</div>
          <div className="brand-subtitle">
            {isAuthenticated ? "Рабочий доступ сотрудников" : "Безопасный доступ к сервисам"}
          </div>
        </div>
      </Link>

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
