import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AdminPanel from "./components/AdminPanel";
import AppHeader from "./components/AppHeader";
import AppSidebar from "./components/AppSidebar";
import AuthPage from "./components/AuthPage";
import NotFoundPage from "./components/NotFoundPage";
import ProtectedRoute from "./components/ProtectedRoute";
import ServicesPage from "./components/ServicesPage";
import VaultPage from "./components/VaultPage";
import usePhoenixAppState from "./hooks/usePhoenixAppState";

const getDocumentTitle = (pathname, isAuthenticated, canManage) => {
  if (!isAuthenticated) {
    return "Вход — Avatariya Vault Access";
  }

  switch (pathname) {
    case "/vault":
      return "Мои доступы — Avatariya Vault Access";
    case "/services":
      return "Заявки — Avatariya Vault Access";
    case "/manager":
      return "Панель руководителя — Avatariya Vault Access";
    case "/login":
      return canManage
        ? "Панель руководителя — Avatariya Vault Access"
        : "Мои доступы — Avatariya Vault Access";
    default:
      return "Avatariya Vault Access";
  }
};

export default function App() {
  const location = useLocation();
  const {
    isAuthenticated,
    canManage,
    canOpenServicesTab,
    showVaultTab,
    defaultAuthenticatedPath,
    toast,
    handleLogout,
    authPageProps,
    sidebarProps,
    vaultPageProps,
    servicesPageProps,
    managerPageProps
  } = usePhoenixAppState();

  useEffect(() => {
    document.title = getDocumentTitle(location.pathname, isAuthenticated, canManage);
  }, [location.pathname, isAuthenticated, canManage]);

  const appSidebar = <AppSidebar {...sidebarProps} />;

  const vaultPage = (
    <section className="workspace-shell">
      {appSidebar}

      <div className="workspace-main">
        <VaultPage {...vaultPageProps} />
      </div>
    </section>
  );

  const servicesPage = (
    <section className="workspace-shell">
      {appSidebar}

      <div className="workspace-main">
        <ServicesPage {...servicesPageProps} />
      </div>
    </section>
  );

  return (
    <div className={`page ${isAuthenticated ? "page-admin" : ""}`}>
      <div className="bg-orbs" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="orb orb-three" />
      </div>

      <AppHeader isAuthenticated={isAuthenticated} onLogout={handleLogout} />

      <Routes>
        <Route
          path="/"
          element={<Navigate to={isAuthenticated ? defaultAuthenticatedPath : "/login"} replace />}
        />
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to={defaultAuthenticatedPath} replace />
            ) : (
              <AuthPage {...authPageProps} />
            )
          }
        />
        <Route
          path="/vault"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ProtectedRoute isAllowed={showVaultTab} redirectTo={defaultAuthenticatedPath}>
                {vaultPage}
              </ProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/services"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ProtectedRoute isAllowed={canOpenServicesTab} redirectTo={defaultAuthenticatedPath}>
                {servicesPage}
              </ProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated}>
              <ProtectedRoute isAllowed={canManage} redirectTo={defaultAuthenticatedPath}>
                <AdminPanel {...managerPageProps} />
              </ProtectedRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={
            <NotFoundPage
              isAuthenticated={isAuthenticated}
              fallbackPath={isAuthenticated ? defaultAuthenticatedPath : "/login"}
            />
          }
        />
      </Routes>

      {toast.visible && (
        <div
          className={`app-toast ${toast.type === "error" ? "error" : ""}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
