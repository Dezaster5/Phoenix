import { NavLink } from "react-router-dom";

export default function AppSidebar({
  viewerFullName,
  viewerDepartment,
  roleLabel,
  canOpenServicesTab,
  showVaultTab
}) {
  const navItems = [
    showVaultTab ? { id: "vault", label: "Мои доступы", to: "/vault" } : null,
    canOpenServicesTab ? { id: "services", label: "Заявки", to: "/services" } : null
  ].filter(Boolean);

  return (
    <aside className="workspace-sidebar">
      <section className="sidebar-card">
        <h2>Профиль</h2>
        <p className="sidebar-profile-name">{viewerFullName || "Без ФИО"}</p>
        <p className="hint">Роль: {roleLabel}</p>
        <p className="hint">Отдел: {viewerDepartment}</p>
      </section>

      {navItems.length > 0 && (
        <section className="sidebar-card">
          <h2>Разделы</h2>
          <nav>
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.to}
                className={({ isActive }) => `sidebar-link ${isActive ? "is-active" : ""}`}
              >
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </section>
      )}
    </aside>
  );
}
