export default function AppSidebar({
  viewerFullName,
  viewerDepartment,
  roleLabel,
  currentView,
  canOpenServicesTab,
  showVaultTab,
  onToggleView
}) {
  const navItems = [
    showVaultTab ? { id: "vault", label: "Мои доступы" } : null,
    canOpenServicesTab ? { id: "services", label: "Заявки" } : null
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
              <button
                key={item.id}
                type="button"
                className={`sidebar-link ${currentView === item.id ? "is-active" : ""}`}
                onClick={() => onToggleView(item.id)}
              >
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </section>
      )}
    </aside>
  );
}
